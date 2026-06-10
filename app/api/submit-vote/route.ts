import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

const VOTE_STATES = [
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Maharashtra',
  'Kerala',
] as const

function getSheetsClient() {
  const googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}')
  const auth = new JWT({
    email: googleCredentials.client_email,
    key: googleCredentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return {
    sheets: google.sheets({ version: 'v4', auth }),
    serviceAccountEmail: googleCredentials.client_email as string | undefined,
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.GOOGLE_CREDENTIALS) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const spreadsheetId = process.env.GOOGLE_VOTE_SHEET_ID
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Vote sheet is not configured. Set GOOGLE_VOTE_SHEET_ID.' },
        { status: 500 }
      )
    }

    const data = await request.json()
    const { state, name, email, phone, message, friendsCount } = data

    if (!state || !name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'State, name, and email are required' },
        { status: 400 }
      )
    }

    if (!VOTE_STATES.includes(state)) {
      return NextResponse.json({ error: 'Invalid state selected' }, { status: 400 })
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const { sheets, serviceAccountEmail } = getSheetsClient()

    try {
      await sheets.spreadsheets.get({ spreadsheetId })
    } catch {
      return NextResponse.json(
        {
          error:
            'Cannot access the vote Google Sheet. Share it with edit access for the service account.',
          serviceAccountEmail,
        },
        { status: 403 }
      )
    }

    const rowData = [
      new Date().toISOString(),
      state,
      name.trim(),
      email.trim().toLowerCase(),
      phone?.trim() || '',
      message?.trim() || '',
      friendsCount ? String(friendsCount) : '1',
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    })

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your vote has been recorded.',
    })
  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json(
      {
        error: 'Failed to submit vote',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
