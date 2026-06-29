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

    // Get all referrals for this user
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('user_referrals')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError)
      return NextResponse.json(
        { error: 'Failed to fetch referrals' },
        { status: 500 }
      )
    }

    // Get usage data to show current status
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('choice_filling_usage')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (usageError && usageError.code !== 'PGRST116') {
      console.error('Error fetching usage data:', usageError)
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      )
    }

    // Count referrals by status
    const pendingCount = referrals?.filter(r => r.status === 'pending').length || 0
    const signedInCount = referrals?.filter(r => r.status === 'signed_in').length || 0
    const completedCount = referrals?.filter(r => r.status === 'completed').length || 0
    const expiredCount = referrals?.filter(r => r.status === 'expired').length || 0

    // Calculate available trials based on plan type
    let availableTrials = 0
    if (usageData?.plan_type?.startsWith('premium')) {
      // Premium plans have unlimited access
      availableTrials = 999 // Represent unlimited access
    } else if (usageData?.plan_type === 'referral_75') {
      // Referral premium 75 plan has 3 fixed trials
      availableTrials = Math.max(0, 3 - (usageData?.referral_trials_used || 0))
    } else if (usageData?.plan_type === 'referral_200') {
      // Referral premium 200 plan has 5 fixed trials
      availableTrials = Math.max(0, 5 - (usageData?.referral_trials_used || 0))
    } else {
      // For freemium and regular referral plans, calculate from earned trials
      availableTrials = Math.max(0, (usageData?.referral_trials_earned || 0) - (usageData?.referral_trials_used || 0))
    }

    // Determine current plan benefits based on actual database plan first
    let currentPlan = 'Freemium'
    let maxChoices = usageData?.max_choices || 20
    let trialsEarned = 0

    // Check actual plan from database first
    if (usageData?.plan_type === 'premium_199') {
      currentPlan = 'Secure (₹299)'
      maxChoices = 75
    } else if (usageData?.plan_type === 'premium_299') {
      currentPlan = 'Assured+ (₹399)'
      maxChoices = 200
    } else if (usageData?.plan_type === 'referral_75') {
      currentPlan = 'Referral Premium (75 Choices)'
      maxChoices = 75
      trialsEarned = 3
    } else if (usageData?.plan_type === 'referral_200') {
      currentPlan = 'Referral Premium (200 Choices)'
      maxChoices = 200
      trialsEarned = 5
    } else {
      // Only apply referral upgrades if user doesn't have a premium plan
      if (completedCount >= 5) {
        currentPlan = 'Referral Premium (5+ referrals)'
        maxChoices = 200
        trialsEarned = 5
      } else if (completedCount >= 3) {
        currentPlan = 'Referral Premium (3+ referrals)'
        maxChoices = 75
        trialsEarned = 3
      }
    }

    return NextResponse.json({
      success: true,
      referrals: referrals || [],
      stats: {
        total: referrals?.length || 0,
        pending: pendingCount,
        signed_in: signedInCount,
        completed: completedCount,
        expired: expiredCount,
        availableTrials: availableTrials,
        currentPlan: currentPlan,
        maxChoices: maxChoices,
        trialsEarned: trialsEarned
      }
    })

  } catch (error: any) {
    console.error('Error in get-user-referrals:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 