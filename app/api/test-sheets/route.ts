import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if credentials exist
    if (!process.env.GOOGLE_CREDENTIALS) {
      return NextResponse.json({
        error: 'GOOGLE_CREDENTIALS environment variable is missing',
        status: 'missing_credentials'
      })
    }

    // Parse credentials
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    
    // Create auth
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Test spreadsheet access
    const SPREADSHEET_ID = '1IBwBSkvrrJKp3WFMpRFWacXTWDcFN0TdHTk6-aivBdU'
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })

    // Get sample data from each sheet to understand structure
    const sheetNames = response.data.sheets?.map(sheet => sheet.properties?.title) || []
    const sheetData = {}

    for (const sheetName of sheetNames) {
      if (sheetName) {
        try {
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:Z10`, // Get first 10 rows
          })
          sheetData[sheetName] = {
            rowCount: dataResponse.data.values?.length || 0,
            headers: dataResponse.data.values?.[0] || [],
            sampleData: dataResponse.data.values?.slice(1, 3) || [] // First 2 data rows
          }
        } catch (error) {
          sheetData[sheetName] = { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheetId: response.data.spreadsheetId,
      title: response.data.properties?.title,
      sheets: sheetNames,
      sheetData: sheetData
    })

  } catch (error) {
    console.error('Test sheets error:', error)
    return NextResponse.json({
      error: 'Failed to test Google Sheets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 