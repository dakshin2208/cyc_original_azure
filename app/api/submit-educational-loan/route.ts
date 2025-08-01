import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Readable } from "stream"

// Google Sheets and Drive configuration
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS
const GOOGLE_SHEET_ID = "1qE4KVGMZbW02Eqqe8Rjx06VCCvKBK8Di7ZNHmxvuInY"
const GOOGLE_DRIVE_FOLDER_ID = "1I1wFqYakoEEBijEElJwAC2ElPOV0H2uo"

export async function POST(request: NextRequest) {
  try {
    // Parse the form data
    const formData = await request.formData()

    // Extract student details
    const studentName = formData.get("studentName") as string
    const studentEmail = formData.get("studentEmail") as string
    const studentContact = formData.get("studentContact") as string

    // Extract parent details
    const parentName = formData.get("parentName") as string
    const parentEmail = formData.get("parentEmail") as string
    const parentContact = formData.get("parentContact") as string
    const parentAlternativeContact = formData.get("parentAlternativeContact") as string

    // Extract files
    const admissionLetter = formData.get("admissionLetter") as File
    const feeStructure = formData.get("feeStructure") as File
    const marksheet10th = formData.get("marksheet10th") as File
    const marksheet12th = formData.get("marksheet12th") as File
    const studentPhoto = formData.get("studentPhoto") as File
    const studentAddressProof = formData.get("studentAddressProof") as File
    const incomeProof = formData.get("incomeProof") as File
    const parentAddressProof = formData.get("parentAddressProof") as File
    const utilityBill = formData.get("utilityBill") as File
    const panCard = formData.get("panCard") as File

    // Extract bank statement data
    const bankStatementType = formData.get("bankStatementType") as string
    const bankStatementFileCount = parseInt(formData.get("bankStatementFileCount") as string || "0")
    
    // Extract bank statement files
    const bankStatementFiles: File[] = []
    for (let i = 0; i < bankStatementFileCount; i++) {
      const file = formData.get(`bankStatementFile_${i}`) as File
      if (file) {
        bankStatementFiles.push(file)
      }
    }

    // Validate required fields
    if (!studentName || !studentEmail || !studentContact || !parentName || !parentEmail || !parentContact) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate bank statement data
    if (!bankStatementType || bankStatementFiles.length === 0) {
      return NextResponse.json({ error: "Missing bank statement type or files" }, { status: 400 })
    }

    // Validate required files
    const requiredFiles = [
      admissionLetter, feeStructure, marksheet10th, marksheet12th, 
      studentPhoto, studentAddressProof, incomeProof, 
      parentAddressProof, utilityBill, panCard
    ]

    for (const file of requiredFiles) {
      if (!file) {
        return NextResponse.json({ error: "Missing required documents" }, { status: 400 })
      }
    }

    // Check if Google credentials are configured
    if (!GOOGLE_CREDENTIALS) {
      console.error("Missing Google API credentials")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Set up Google auth
    let credentials
    try {
      credentials = JSON.parse(GOOGLE_CREDENTIALS)
    } catch (error) {
      console.error("Error parsing Google credentials:", error)
      return NextResponse.json({ error: "Invalid Google credentials format" }, { status: 500 })
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    })

    // Create folder in Google Drive with student name
    const drive = google.drive({ version: "v3", auth })
    
    // Sanitize student name for folder name
    const sanitizedStudentName = studentName.replace(/[^a-zA-Z0-9\s]/g, "_").replace(/\s+/g, "_")
    const folderName = `Educational_Loan_${sanitizedStudentName}_${Date.now()}`

    // Create folder
    const folderResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [GOOGLE_DRIVE_FOLDER_ID],
      },
    })

    const folderId = folderResponse.data.id

    if (!folderId) {
      throw new Error("Failed to create folder in Google Drive")
    }

    // Upload all files to the created folder
    const fileUploadPromises = [
      { file: admissionLetter, name: "01_Admission_Letter" },
      { file: feeStructure, name: "02_Fee_Structure" },
      { file: marksheet10th, name: "03_10th_Marksheet" },
      { file: marksheet12th, name: "04_12th_Marksheet" },
      { file: studentPhoto, name: "05_Student_Photo" },
      { file: studentAddressProof, name: "06_Student_Address_Proof" },
      { file: incomeProof, name: "07_Income_Proof" },
      { file: parentAddressProof, name: "08_Parent_Address_Proof" },
      { file: utilityBill, name: "09_Utility_Bill" },
      { file: panCard, name: "10_PAN_Card" }
    ].map(async ({ file, name }) => {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      const fileStream = new Readable()
      fileStream.push(buffer)
      fileStream.push(null)

      const fileExtension = file.name.split('.').pop() || 'pdf'
      
      return drive.files.create({
        requestBody: {
          name: `${name}.${fileExtension}`,
          mimeType: file.type,
          parents: [folderId],
        },
        media: {
          mimeType: file.type,
          body: fileStream,
        },
      })
    })

    // Upload bank statement files
    const bankStatementUploadPromises = bankStatementFiles.map(async (file, index) => {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      const fileStream = new Readable()
      fileStream.push(buffer)
      fileStream.push(null)

      const fileExtension = file.name.split('.').pop() || 'pdf'
      const documentType = bankStatementType === 'bankStatement' ? 'Bank_Statement' : 'Salary_Slip'
      
      return drive.files.create({
        requestBody: {
          name: `07_${documentType}_${index + 1}.${fileExtension}`,
          mimeType: file.type,
          parents: [folderId],
        },
        media: {
          mimeType: file.type,
          body: fileStream,
        },
      })
    })

    // Wait for all file uploads to complete
    await Promise.all([...fileUploadPromises, ...bankStatementUploadPromises])

    // Add row to Google Sheet
    const sheets = google.sheets({ version: "v4", auth })
    const timestamp = new Date().toISOString()

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Sheet1!A:O", // Adjust range based on your sheet structure
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          timestamp,
          studentName,
          studentEmail,
          studentContact,
          parentName,
          parentEmail,
          parentContact,
          parentAlternativeContact,
          folderName,
          `https://drive.google.com/drive/folders/${folderId}`,
          admissionLetter.name,
          feeStructure.name,
          marksheet10th.name,
          marksheet12th.name,
          studentPhoto.name,
          bankStatementType,
          bankStatementFiles.length
        ]],
      },
    })

    return NextResponse.json({
      success: true,
      message: "Educational loan application submitted successfully",
      folderId: folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`
    })
  } catch (error) {
    console.error("Error submitting educational loan application:", error)
    return NextResponse.json({ error: "Failed to submit educational loan application" }, { status: 500 })
  }
} 