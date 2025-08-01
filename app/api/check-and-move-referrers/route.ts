import { google } from 'googleapis'
import { NextResponse } from 'next/server'

// Initialize Google Sheets API with JSON credentials
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}')
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })
const WAITLIST_SPREADSHEET_ID = '1IBwBSkvrrJKp3WFMpRFWacXTWDcFN0TdHTk6-aivBdU'
const WAITLIST_SHEET = 'WAITLIST'
const REFERRALS_SPREADSHEET_ID = '1XKxNz61GWicOpRV6UwrftNfchhzfmRUOailI6bVWm2M'
const REFERRALS_SHEET = 'Sheet1'

export async function GET() {
  try {
    // Get all referrals
    const referralsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: REFERRALS_SPREADSHEET_ID,
      range: `${REFERRALS_SHEET}!A:E`,
    })

    const referralRows = referralsResponse.data.values || []
    
    // Count pending referrals for each referrer
    const referralCounts = new Map()
    
    for (let i = 1; i < referralRows.length; i++) { // Skip header
      const row = referralRows[i]
      const referrerCode = row[1]
      const status = row[4]
      
      if (status === 'pending' && referrerCode) {
        referralCounts.set(referrerCode, (referralCounts.get(referrerCode) || 0) + 1)
      }
    }

    console.log('Referral counts:', Object.fromEntries(referralCounts))

    // Find referrers with 3 or more pending referrals
    const eligibleReferrers = Array.from(referralCounts.entries())
      .filter(([code, count]) => count >= 3)
      .map(([code, count]) => ({ code, count }))

    console.log('Eligible referrers:', eligibleReferrers)

    const results: Array<{
      referrerCode: string;
      referralCount: number;
      status: string;
      message: string;
    }> = []

    // Move each eligible referrer up
    for (const { code, count } of eligibleReferrers) {
      try {
        await moveReferrerUp(code)
        await markReferralsAsProcessed(code)
        results.push({
          referrerCode: code,
          referralCount: count,
          status: 'moved',
          message: `Moved up 100 positions`
        })
      } catch (error) {
        results.push({
          referrerCode: code,
          referralCount: count,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalEligible: eligibleReferrers.length
    })

  } catch (error) {
    console.error('Error checking and moving referrers:', error)
    return NextResponse.json({
      error: 'Failed to check and move referrers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function moveReferrerUp(referrerCode: string) {
  try {
    // Get all waitlist entries
    const waitlistResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: WAITLIST_SPREADSHEET_ID,
      range: `${WAITLIST_SHEET}!A:M`, // Include column M for referral code
    })

    const waitlistRows = waitlistResponse.data.values || []
    
    // Find the referrer's current position
    let referrerRowIndex = -1
    let referrerCurrentNumber = 0
    
    for (let i = 1; i < waitlistRows.length; i++) { // Skip header
      const row = waitlistRows[i]
      if (row[12] === referrerCode) { // Column M (index 12) contains referral code
        referrerRowIndex = i
        referrerCurrentNumber = parseInt(row[0]) || 0
        console.log(`Found referrer ${referrerCode} at position ${referrerCurrentNumber}, row ${referrerRowIndex}`)
        break
      }
    }

    if (referrerRowIndex === -1) {
      throw new Error(`Referrer ${referrerCode} not found in waitlist`)
    }

    // Calculate new position (move up 100 positions)
    const newPosition = Math.max(1, referrerCurrentNumber - 100)
    console.log(`Moving from position ${referrerCurrentNumber} to position ${newPosition}`)
    
    // Find the target position in the sheet
    let targetRowIndex = -1
    for (let i = 1; i < waitlistRows.length; i++) {
      const currentNumber = parseInt(waitlistRows[i][0]) || 0
      if (currentNumber >= newPosition) {
        targetRowIndex = i
        break
      }
    }

    if (targetRowIndex === -1) {
      targetRowIndex = waitlistRows.length
    }

    // Move the referrer to the new position
    const referrerRow = [...waitlistRows[referrerRowIndex]] // Create a copy
    referrerRow[0] = newPosition // Update waitlist number

    // Remove from old position first
    waitlistRows.splice(referrerRowIndex, 1)
    
    // Insert at new position
    waitlistRows.splice(targetRowIndex, 0, referrerRow)

    // Update the entire sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: WAITLIST_SPREADSHEET_ID,
      range: `${WAITLIST_SHEET}!A:M`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: waitlistRows,
      },
    })

    console.log(`Successfully moved referrer ${referrerCode} from position ${referrerCurrentNumber} to ${newPosition}`)

  } catch (error) {
    console.error('Error moving referrer up:', error)
    throw error
  }
}

async function markReferralsAsProcessed(referrerCode: string) {
  try {
    // Get all referrals
    const referralsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: REFERRALS_SPREADSHEET_ID,
      range: `${REFERRALS_SHEET}!A:E`,
    })

    const referralRows = referralsResponse.data.values || []
    
    // Update status to 'processed' for this referrer's pending referrals
    for (let i = 1; i < referralRows.length; i++) {
      if (referralRows[i][1] === referrerCode && referralRows[i][4] === 'pending') {
        referralRows[i][4] = 'processed'
      }
    }

    // Update the referrals sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: REFERRALS_SPREADSHEET_ID,
      range: `${REFERRALS_SHEET}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: referralRows,
      },
    })

    console.log(`Marked all referrals for ${referrerCode} as processed`)

  } catch (error) {
    console.error('Error marking referrals as processed:', error)
    throw error
  }
} 