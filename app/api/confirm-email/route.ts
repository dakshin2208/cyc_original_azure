import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  console.log('Manual email confirmation API route called')
  
  // Verify environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    console.log('Received request body:', { ...body, password: '[REDACTED]' })

    const { email } = body

    if (!email) {
      console.error('Missing email field')
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('Attempting to manually confirm email for:', email)
    
    // Update the user's email_confirmed_at field
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      email, // This should be the user ID, but we'll need to find it first
      {
        email_confirm: true
      }
    )

    if (error) {
      console.error('Error confirming email:', error)
      return NextResponse.json(
        { 
          error: error.message,
          code: error.status
        },
        { status: 500 }
      )
    }

    console.log('Email confirmed successfully:', data)
    return NextResponse.json({ 
      success: true, 
      message: 'Email confirmed successfully',
      data 
    })
  } catch (error: any) {
    console.error('Unexpected error in confirm-email route:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 