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
    const { referralCode } = await request.json()

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Missing referral code' },
        { status: 400 }
      )
    }

    console.log('Testing referral code:', referralCode)

    // Check if referral code exists in profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, referral_code')
      .eq('referral_code', referralCode)
      .single()

    if (profileError) {
      console.log('Referral code not found:', referralCode, profileError)
      return NextResponse.json({
        success: false,
        error: 'Referral code not found',
        details: profileError
      })
    }

    console.log('Referral code found:', profile)

    return NextResponse.json({
      success: true,
      message: 'Referral code found',
      profile: {
        id: profile.id,
        email: profile.email,
        referralCode: profile.referral_code
      }
    })

  } catch (error: any) {
    console.error('Error testing referral code:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 