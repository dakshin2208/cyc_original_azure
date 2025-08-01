import { google } from 'googleapis'
import { NextResponse } from 'next/server'

// Initialize Google Sheets API with JSON credentials
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}')
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })
const SPREADSHEET_ID = '1IBwBSkvrrJKp3WFMpRFWacXTWDcFN0TdHTk6-aivBdU'

export async function GET() {
  try {
    // First, check if REFERRALS sheet exists
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })

    const existingSheets = spreadsheetInfo.data.sheets?.map(sheet => sheet.properties?.title) || []
    console.log('Existing sheets:', existingSheets)

    if (existingSheets.includes('REFERRALS')) {
      return NextResponse.json({
        success: true,
        message: 'REFERRALS sheet already exists',
        existingSheets
      })
    }

    // Create the REFERRALS sheet
    const createSheetRequest = {
      requests: [
        {
          addSheet: {
            properties: {
              title: 'REFERRALS'
            }
          }
        }
      ]
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: createSheetRequest
    })

    // Add headers to the new sheet
    const headers = [
      'Timestamp',
      'Referrer Code',
      'Referred Email',
      'Referred Phone',
      'Status'
    ]

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'REFERRALS!A1:E1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers]
      }
    })

    return NextResponse.json({
      success: true,
      message: 'REFERRALS sheet created successfully with headers',
      headers: headers
    })

  } catch (error) {
    console.error('Error setting up REFERRALS sheet:', error)
    return NextResponse.json({
      error: 'Failed to set up REFERRALS sheet',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 