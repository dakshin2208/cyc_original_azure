import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

// Google Sheets configuration
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS
const INITIAL_SHEET_ID = "1qE4KVGMZbW02Eqqe8Rjx06VCCvKBK8Di7ZNHmxvuInY"
const COMPLETED_SHEET_ID = "1qE4KVGMZbW02Eqqe8Rjx06VCCvKBK8Di7ZNHmxvuInY" // Same sheet for now

export async function POST(request: NextRequest) {
  try {
    const { studentEmail } = await request.json()

    if (!studentEmail) {
      return NextResponse.json({ error: "Student email is required" }, { status: 400 })
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
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    // First check completed applications (higher priority)
    try {
      const completedResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: COMPLETED_SHEET_ID,
        range: "Sheet1!A:Z",
      })

      const completedRows = completedResponse.data.values || []
      
      // Look for the student email in completed applications
      for (const row of completedRows) {
        if (row[2] === studentEmail) { // Assuming email is in column C (index 2)
          return NextResponse.json({
            hasCompletedApplication: true,
            hasInitialApplication: false,
            applicationNumber: row[0] || "N/A",
            data: null
          })
        }
      }
    } catch (error) {
      console.error("Error checking completed applications:", error)
    }

    // Then check initial applications
    try {
      const initialResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: INITIAL_SHEET_ID,
        range: "Sheet1!A:Z",
      })

      const initialRows = initialResponse.data.values || []
      
      // Look for the student email in initial applications
      for (const row of initialRows) {
        if (row[2] === studentEmail) { // Assuming email is in column C (index 2)
          return NextResponse.json({
            hasCompletedApplication: false,
            hasInitialApplication: true,
            applicationNumber: row[0] || "N/A",
            data: {
              studentName: row[1] || "",
              studentEmail: row[2] || "",
              studentContact: row[3] || "",
              parentName: row[4] || "",
              parentEmail: row[5] || "",
              parentContact: row[6] || ""
            }
          })
        }
      }
    } catch (error) {
      console.error("Error checking initial applications:", error)
    }

    // No application found
    return NextResponse.json({
      hasCompletedApplication: false,
      hasInitialApplication: false,
      applicationNumber: null,
      data: null
    })

  } catch (error) {
    console.error("Error checking educational loan status:", error)
    return NextResponse.json({ error: "Failed to check application status" }, { status: 500 })
  }
} 