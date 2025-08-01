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
      'studentName',
      'aadhaarNumber',
      'registrationNumber',
      'dateOfBirth',
      'studentPhone',
      'studentEmail',
      'fatherName',
      'fatherOccupation',
      'fatherIncome',
      'fatherPhone',
      'fatherEmail',
      'mathsMarks',
      'physicsMarks',
      'chemistryMarks',
      'totalMarks',
      'collegePreference1',
      'collegePreference2',
      'collegePreference3',
      'branchPreference1',
      'branchPreference2',
      'branchPreference3'
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
      data.studentName,
      data.aadhaarNumber,
      data.registrationNumber,
      data.dateOfBirth,
      data.studentPhone,
      data.studentEmail,
      data.fatherName,
      data.fatherOccupation,
      data.fatherIncome,
      data.fatherPhone,
      data.fatherEmail,
      data.mathsMarks,
      data.physicsMarks,
      data.chemistryMarks,
      data.totalMarks,
      data.collegePreference1,
      data.collegePreference2,
      data.collegePreference3,
      data.branchPreference1,
      data.branchPreference2,
      data.branchPreference3
    ]

    console.log('Attempting to append data to Google Sheet...')
    console.log('Using service account:', googleCredentials.client_email)
    console.log('Spreadsheet ID:', '1i74sQlyVz7KaThKbJbSYr6SMqOi1XH5MVPv7H9mVXGs')

    try {
      // First try to get the spreadsheet to verify access
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: '1i74sQlyVz7KaThKbJbSYr6SMqOi1XH5MVPv7H9mVXGs'
      })
      console.log('Successfully accessed spreadsheet:', spreadsheet.data.properties?.title)
    } catch (error) {
      console.error('Error accessing spreadsheet:', error)
      return NextResponse.json(
        { 
          error: 'Cannot access Google Sheet. Please ensure the service account has been given edit access.',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 403 }
      )
    }

    // Append the data to the Google Sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: '1i74sQlyVz7KaThKbJbSYr6SMqOi1XH5MVPv7H9mVXGs',
      range: 'Sheet1!A:V',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    })

    console.log('Google Sheets API Response:', response.data)

    if (!response.data) {
      throw new Error('No response data from Google Sheets API')
    }

    return NextResponse.json({ 
      success: true,
      message: 'Data successfully saved to Google Sheet'
    })
  } catch (error) {
    console.error('Error submitting management seat application:', error)
    
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