"use server"

import { google } from "googleapis"
import { Readable } from "stream"

export async function submitCollegeData(formData: FormData) {
  try {
    // Extract form data
    const collegeName = formData.get("collegeName") as string
    const nirfCode = formData.get("nirfCode") as string
    const websiteUrl = formData.get("websiteUrl") as string
    const file = formData.get("file") as File
    const personName = formData.get("personName") as string
    const emailId = formData.get("emailId") as string
    const contactNumber = formData.get("contactNumber") as string

    // Validate inputs
    if (!collegeName || !nirfCode || !websiteUrl || !file || !personName || !emailId || !contactNumber) {
      return {
        success: false,
        message: "All fields are required",
      }
    }

    // Validate file is a PDF
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      return {
        success: false,
        message: "Please upload a PDF file",
      }
    }

    // Check if Google credentials are configured
    const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS
    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID
    const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!GOOGLE_CREDENTIALS || !GOOGLE_SHEET_ID || !GOOGLE_DRIVE_FOLDER_ID) {
      console.error("Missing Google API credentials or configuration")
      return {
        success: false,
        message: "Server configuration error. Please contact the administrator.",
      }
    }

    // Set up Google auth
    let credentials;
    try {
      credentials = JSON.parse(GOOGLE_CREDENTIALS);
    } catch (error) {
      console.error("Error parsing Google credentials:", error);
      return {
        success: false,
        message: "Invalid Google credentials format",
      };
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

    try {
      console.log('Attempting to append to sheet with ID:', GOOGLE_SHEET_ID);
      
      // First, get the spreadsheet to verify access and get sheet details
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: "1P7C-OKe1ZfhV9gZvN9AKgTYuZRkjN-TnX4QFZBAlhw8"
      });
      
      // Find the first sheet
      const firstSheet = spreadsheet.data.sheets?.[0];
      if (!firstSheet) {
        throw new Error('No sheets found in the spreadsheet');
      }
      
      const sheetName = firstSheet.properties?.title;
      console.log('Found sheet:', sheetName);
      
      // Append the data using the exact sheet name
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: "1P7C-OKe1ZfhV9gZvN9AKgTYuZRkjN-TnX4QFZBAlhw8",
        range: "Sheet1!A:H", // Explicitly using Sheet1
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[timestamp, collegeName, nirfCode, websiteUrl, personName, emailId, contactNumber, fileUrl]],
        },
      });

      console.log('Google Sheets API Response:', response.data);

      return {
        success: true,
        message: "College data submitted successfully!",
      }
    } catch (error) {
      // Type guard for Google API errors
      const sheetsError = error as {
        message?: string;
        code?: number;
        errors?: Array<{ message: string; domain: string; reason: string }>;
        response?: { data?: any };
      };

      console.error("Detailed Google Sheets Error:", {
        message: sheetsError.message,
        code: sheetsError.code,
        errors: sheetsError.errors,
        response: sheetsError.response?.data
      });
      
      return {
        success: false,
        message: `Failed to update Google Sheet: ${sheetsError.message || 'Unknown error'}`,
      }
    }
  } catch (error) {
    console.error("Error submitting college data:", error)
    return {
      success: false,
      message:
        error instanceof Error ? `Error: ${error.message}` : "An unexpected error occurred. Please try again later.",
    }
  }
}
