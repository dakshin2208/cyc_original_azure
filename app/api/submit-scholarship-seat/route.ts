import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// Parse Google credentials from environment variable
const googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}')

// Initialize Google Sheets API
const auth = new JWT({
  email: googleCredentials.client_email,
  key: googleCredentials.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

export async function POST(request: Request) {
  try {
    // Check if environment variables are set
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.error('Missing Google credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const data = await request.json()
    console.log('Received form data:', data)

    // Validate required fields
    const requiredFields = [
      'isFirstGraduate',
      'studentName',
      'studentAadhaar',
      'registrationNumber',
      'dateOfBirth',
      'studentPhone',
      'studentEmail',
      'fatherName',
      'fatherIncome',
      'fatherPhone',
      'motherName',
      'motherIncome',
      'motherPhone',
      'mathsMarks',
      'physicsMarks',
      'chemistryMarks',
      'totalMarks'
    ]

    for (const field of requiredFields) {
      if (!data[field]) {
        console.error(`Missing required field: ${field}`)
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Prepare the row data
    const rowData = [
      new Date().toISOString(), // Timestamp
      data.isFirstGraduate,
      data.studentName,
      data.studentAadhaar,
      data.registrationNumber,
      data.dateOfBirth,
      data.studentPhone,
      data.studentEmail,
      data.fatherName,
      data.fatherIncome,
      data.fatherPhone,
      data.motherName,
      data.motherIncome,
      data.motherPhone,
      data.mathsMarks,
      data.physicsMarks,
      data.chemistryMarks,
      data.totalMarks,
      Array.isArray(data.cityPreferences) ? data.cityPreferences.join(', ') : (data.cityPreferences || '')
    ]

    console.log('Attempting to append data to Google Sheet...')
    console.log('Using service account:', googleCredentials.client_email)
    console.log('Spreadsheet ID:', '1icbP8drpMPwhAae6VbX3r3mQRHpITR_j8A0OFJulqko')

    try {
      // First try to get the spreadsheet to verify access
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: '1icbP8drpMPwhAae6VbX3r3mQRHpITR_j8A0OFJulqko'
      }).catch(error => {
        console.error('Detailed access error:', {
          message: error.message,
          code: error.code,
          errors: error.errors,
          response: error.response?.data
        });
        throw error;
      });

      console.log('Successfully accessed spreadsheet:', spreadsheet.data.properties?.title)
      console.log('Available sheets:', spreadsheet.data.sheets?.map(sheet => sheet.properties?.title))
      
      // Look specifically for Sheet1
      const targetSheet = spreadsheet.data.sheets?.find(
        sheet => sheet.properties?.title === 'Sheet1'
      )
      
      if (!targetSheet) {
        console.error('Spreadsheet data:', JSON.stringify(spreadsheet.data, null, 2))
        throw new Error('Sheet "Sheet1" not found. Available sheets: ' + 
          spreadsheet.data.sheets?.map(s => s.properties?.title).join(', '))
      }
      
      console.log('Found Sheet1:', targetSheet.properties?.title)

      // Try to read the first row to verify access
      try {
        const testRead = await sheets.spreadsheets.values.get({
          spreadsheetId: '1icbP8drpMPwhAae6VbX3r3mQRHpITR_j8A0OFJulqko',
          range: 'Sheet1!A1:X1'
        })
        console.log('Successfully read sheet headers:', testRead.data.values)
      } catch (readError) {
        console.error('Error reading sheet:', readError)
        throw new Error('Cannot read from sheet. Please check permissions and sheet name.')
      }

      // Append the data to the Google Sheet
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: '1icbP8drpMPwhAae6VbX3r3mQRHpITR_j8A0OFJulqko',
        range: 'Sheet1!A:X',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowData],
        },
      }).catch(error => {
        console.error('Detailed append error:', {
          message: error.message,
          code: error.code,
          errors: error.errors,
          response: error.response?.data
        });
        throw error;
      });

      console.log('Google Sheets API Response:', response.data)

      if (!response.data) {
        throw new Error('No response data from Google Sheets API')
      }

      return NextResponse.json({ 
        success: true,
        message: 'Data successfully saved to Google Sheet'
      })
    } catch (error) {
      console.error('Error accessing spreadsheet:', error)
      return NextResponse.json(
        { 
          error: 'Cannot access Google Sheet. Please ensure the service account has been given edit access and the sheet "Sheet1" exists.',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('Error submitting scholarship seat application:', error)
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }

    return NextResponse.json(
      { 
        error: 'Failed to submit application',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 