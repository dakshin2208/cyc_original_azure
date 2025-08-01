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
  try {
    console.log('=== RECORD REFERRAL API CALLED ===')
    
    const { referrerCode, referredUserId, referredEmail, referredPhone } = await request.json()
    console.log('Request data:', { referrerCode, referredUserId, referredEmail, referredPhone })

    if (!referrerCode || !referredUserId || !referredEmail) {
      console.log('❌ Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: referrerCode, referredUserId, and referredEmail' },
        { status: 400 }
      )
    }

    console.log('🔍 Looking for referrer with code:', referrerCode)
    
    // Find the referrer by their referral code (stored in profiles table)
    const { data: referrerProfile, error: referrerError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('referral_code', referrerCode)
      .single()

    console.log('Referrer query result:', { referrerProfile, referrerError })

    if (referrerError || !referrerProfile) {
      console.error('❌ Referrer not found:', referrerCode, referrerError)
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      )
    }

    console.log('✅ Referrer found:', referrerProfile)

    // Check if this referral already exists - more comprehensive check
    console.log('🔍 Checking for existing referral...')
    const { data: existingReferrals, error: checkError } = await supabaseAdmin
      .from('user_referrals')
      .select('id, status, created_at')
      .eq('referrer_id', referrerProfile.id)
      .eq('referred_email', referredEmail)

    console.log('Existing referral check:', { existingReferrals, checkError })

    if (checkError) {
      console.error('❌ Error checking existing referral:', checkError)
      return NextResponse.json(
        { error: 'Failed to check existing referral' },
        { status: 500 }
      )
    }

    // If any referral exists for this email, return success (idempotent)
    if (existingReferrals && existingReferrals.length > 0) {
      console.log('✅ Referral already exists for this email, returning existing record')
      const existingReferral = existingReferrals[0]
      return NextResponse.json({
        success: true,
        message: 'Referral already exists',
        referral: existingReferral,
        alreadyExists: true
      })
    }

    console.log('✅ No existing referral found, creating new one...')

    // Create the referral record with upsert to handle race conditions
    const { data: newReferral, error: createError } = await supabaseAdmin
      .from('user_referrals')
      .upsert({
        referrer_id: referrerProfile.id,
        referrer_email: referrerProfile.email,
        referred_email: referredEmail,
        referred_phone: referredPhone || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'referrer_id,referred_email'
      })
      .select()
      .single()

    console.log('Create referral result:', { newReferral, createError })

    if (createError) {
      console.error('❌ Error creating referral:', createError)
      
      // If it's a duplicate key error, try to fetch the existing record
      if (createError.code === '23505') { // PostgreSQL unique violation
        console.log('🔄 Duplicate key error, fetching existing record...')
        const { data: existingReferral, error: fetchError } = await supabaseAdmin
          .from('user_referrals')
          .select('*')
          .eq('referrer_id', referrerProfile.id)
          .eq('referred_email', referredEmail)
          .single()

        if (!fetchError && existingReferral) {
          console.log('✅ Found existing referral after duplicate error')
          return NextResponse.json({
            success: true,
            message: 'Referral already exists',
            referral: existingReferral,
            alreadyExists: true
          })
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to create referral' },
        { status: 500 }
      )
    }

    console.log('✅ Referral created successfully:', newReferral)

    return NextResponse.json({
      success: true,
      message: 'Referral recorded successfully',
      referral: newReferral,
      alreadyExists: false
    })

  } catch (error: any) {
    console.error('❌ Error in record-referral:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 