import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { Readable } from "stream"

// This would be set up in your environment variables
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

export async function POST(request: NextRequest) {
  try {
    // Parse the form data
    const formData = await request.formData()

    const collegeName = formData.get("collegeName") as string
    const nirfCode = formData.get("nirfCode") as string
    const websiteUrl = formData.get("websiteUrl") as string
    const file = formData.get("file") as File
    const personName = formData.get("personName") as string
    const emailId = formData.get("emailId") as string
    const contactNumber = formData.get("contactNumber") as string

    if (!collegeName || !nirfCode || !websiteUrl || !file || !personName || !emailId || !contactNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate file is a PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    // Check if Google credentials are configured
    if (!GOOGLE_CREDENTIALS || !GOOGLE_SHEET_ID || !GOOGLE_DRIVE_FOLDER_ID) {
      console.error("Missing Google API credentials or configuration")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Set up Google auth
    let credentials;
    try {
      credentials = JSON.parse(GOOGLE_CREDENTIALS);
    } catch (error) {
      console.error("Error parsing Google credentials:", error);
      return NextResponse.json({ error: "Invalid Google credentials format" }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    })

    // Upload file to Google Drive
    const drive = google.drive({ version: "v3", auth })

    // Convert File to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a readable stream from the buffer
    const fileStream = new Readable()
    fileStream.push(buffer)
    fileStream.push(null)

    // Upload to Google Drive
    const driveResponse = await drive.files.create({
      requestBody: {
        name: `${nirfCode}_${collegeName.replace(/[^a-zA-Z0-9]/g, "_")}_NIRF_Data.pdf`,
        mimeType: "application/pdf",
        parents: [GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: "application/pdf",
        body: fileStream,
      },
    })

    const fileId = driveResponse.data.id
    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`

    // Add row to Google Sheet
    const sheets = google.sheets({ version: "v4", auth })

    const timestamp = new Date().toISOString()

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Sheet1!A:H", // Updated range to include new columns
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[timestamp, collegeName, nirfCode, websiteUrl, personName, emailId, contactNumber, fileUrl]],
      },
    })

    return NextResponse.json({
      success: true,
      message: "College data submitted successfully",
    })
  } catch (error) {
    console.error("Error submitting college data:", error)
    return NextResponse.json({ error: "Failed to submit college data" }, { status: 500 })
  }
}
