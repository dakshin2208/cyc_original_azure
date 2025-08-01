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
  console.log('=== PROFILE CREATION API ROUTE CALLED ===')
  
  // Verify environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.error('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json()
    console.log('Received request body:', { ...body, password: '[REDACTED]' })

    const { id, email, full_name, phone_number } = body

    // Validate required fields with better error messages
    if (!id) {
      console.error('Missing required field: id')
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    if (!email) {
      console.error('Missing required field: email')
      return NextResponse.json(
        { error: 'Missing required field: email' },
        { status: 400 }
      )
    }

    if (!full_name) {
      console.error('Missing required field: full_name')
      return NextResponse.json(
        { error: 'Missing required field: full_name' },
        { status: 400 }
      )
    }

    // Use empty string for phone_number if not provided
    const phoneNumber = phone_number || ''

    console.log('Attempting to create profile for user:', id)
    
    // First check if profile already exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    
    if (checkError) {
      console.error('Error checking existing profile:', checkError)
    }
    
    if (existingProfile) {
      console.log('Profile already exists for user:', id)
      return NextResponse.json({ 
        data: existingProfile,
        message: 'Profile already exists'
      })
    }

    console.log('Profile data to insert:', {
      id,
      email,
      full_name,
      phone_number: phoneNumber,
      created_at: new Date().toISOString(),
    })
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id,
          email,
          full_name,
          phone_number: phoneNumber,
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error creating profile:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // Log the exact data that was attempted to be inserted
      console.error('Failed insert data:', {
        id,
        email,
        full_name,
        phone_number: phoneNumber,
        created_at: new Date().toISOString(),
      })
      
      return NextResponse.json(
        { 
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      )
    }

    if (!data) {
      console.error('No data returned after profile creation')
      return NextResponse.json(
        { error: 'Profile creation succeeded but no data returned' },
        { status: 500 }
      )
    }

    console.log('Profile created successfully:', { id: data.id, email: data.email })
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Unexpected error in create-profile route:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    console.log('Testing database connection...')
    
    // Test if we can connect to the profiles table
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, phone_number')
      .limit(1)
    
    if (error) {
      console.error('Database connection test failed:', error)
      return NextResponse.json(
        { error: 'Database connection failed', details: error },
        { status: 500 }
      )
    }
    
    console.log('Database connection test successful')
    return NextResponse.json({ 
      message: 'Database connection successful',
      sampleData: data 
    })
  } catch (error: any) {
    console.error('Unexpected error in GET test:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 