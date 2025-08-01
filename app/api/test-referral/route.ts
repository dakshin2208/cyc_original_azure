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
    const SPREADSHEET_ID = '1XKxNz61GWicOpRV6UwrftNfchhzfmRUOailI6bVWm2M'
    const REFERRALS_SHEET = 'Sheet1'
    
    // Test adding a referral record
    const testReferralData = [
      new Date().toISOString(),
      'TEST123', // referrer code
      'test@example.com', // referred email
      '1234567890', // referred phone
      'pending' // status
    ]

    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${REFERRALS_SHEET}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [testReferralData],
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Test referral added successfully',
      updatedRange: result.data.updates?.updatedRange,
      updatedRows: result.data.updates?.updatedRows
    })

  } catch (error) {
    console.error('Test referral error:', error)
    return NextResponse.json({
      error: 'Failed to test referral',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 