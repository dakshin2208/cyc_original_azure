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
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      )
    }

    // Get the user's referral code from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    if (!profile || !profile.referral_code) {
      // Generate a new referral code if one doesn't exist
      const referralCode = userId.slice(0, 8).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase()
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ referral_code: referralCode })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating profile with referral code:', updateError)
        return NextResponse.json(
          { error: 'Failed to generate referral code' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        referralCode: referralCode,
        message: 'Referral code generated successfully'
      })
    }

    return NextResponse.json({
      success: true,
      referralCode: profile.referral_code,
      message: 'Referral code retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error in get-user-referral-code:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 