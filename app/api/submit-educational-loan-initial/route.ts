import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

// Google Sheets configuration
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS
const GOOGLE_SHEET_ID = "1tPtjgklEjDNGEvseBN6nbOYwn2gSkOM5sADVyRjz3qg"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Extract student details
    const studentName = body.studentName
    const studentEmail = body.studentEmail
    const studentContact = body.studentContact

    // Extract parent details
    const parentName = body.parentName
    const parentEmail = body.parentEmail
    const parentContact = body.parentContact

    // Validate required fields
    if (!studentName || !studentEmail || !studentContact || !parentName || !parentEmail || !parentContact) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(studentEmail) || !emailRegex.test(parentEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate phone format
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(studentContact) || !phoneRegex.test(parentContact)) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
    }

    // Generate application number
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase()
    const applicationNumber = `EL${timestamp}${randomSuffix}`

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
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    // Add row to Google Sheet for initial application
    const sheets = google.sheets({ version: "v4", auth })
    const currentTimestamp = new Date().toISOString()

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: "Sheet1!A:H", // Using Sheet1 for initial applications
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          currentTimestamp,
          applicationNumber,
          studentName,
          studentEmail,
          studentContact,
          parentName,
          parentEmail,
          parentContact,
          "PENDING" // Status: PENDING, COMPLETED, REJECTED
        ]],
      },
    })

    return NextResponse.json({
      success: true,
      message: "Initial application submitted successfully",
      applicationNumber: applicationNumber,
      data: {
        studentName,
        studentEmail,
        studentContact,
        parentName,
        parentEmail,
        parentContact
      }
    })
  } catch (error) {
    console.error("Error submitting initial educational loan application:", error)
    return NextResponse.json({ error: "Failed to submit initial application" }, { status: 500 })
  }
} 