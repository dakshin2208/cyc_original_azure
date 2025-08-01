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
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and email' },
        { status: 400 }
      )
    }

    console.log('=== TESTING REFERRAL TRACKING ===')
    console.log('User ID:', userId)
    console.log('Email:', email)

    // Get current usage data
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('choice_filling_usage')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (usageError) {
      console.error('Error fetching usage data:', usageError)
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      )
    }

    // Get usage logs
    const { data: usageLogs, error: logsError } = await supabaseAdmin
      .from('choice_filling_logs')
      .select('*')
      .eq('user_id', userId)

    if (logsError) {
      console.error('Error fetching usage logs:', logsError)
      return NextResponse.json(
        { error: 'Failed to fetch usage logs' },
        { status: 500 }
      )
    }

    // Get referrals
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('user_referrals')
      .select('*')
      .eq('referrer_id', userId)

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError)
      return NextResponse.json(
        { error: 'Failed to fetch referrals' },
        { status: 500 }
      )
    }

    const completedReferrals = referrals?.filter(r => r.status === 'completed').length || 0

    // Calculate expected values
    let expectedTrialsUsed = 0
    let expectedUsageCount = 0
    const actualUsageCount = usageLogs?.length || 0
    const currentTrialsEarned = parseInt(usageData.referral_trials_earned) || 0

    if (usageData.plan_type === 'referral_75') {
      if (actualUsageCount <= 3) {
        expectedTrialsUsed = actualUsageCount
        expectedUsageCount = 0
      } else {
        expectedTrialsUsed = 3
        expectedUsageCount = actualUsageCount - 3
      }
    } else if (usageData.plan_type === 'referral_200') {
      if (actualUsageCount <= 5) {
        expectedTrialsUsed = actualUsageCount
        expectedUsageCount = 0
      } else {
        expectedTrialsUsed = 5
        expectedUsageCount = actualUsageCount - 5
      }
    } else {
      if (currentTrialsEarned > 0) {
        if (actualUsageCount <= currentTrialsEarned) {
          expectedTrialsUsed = actualUsageCount
          expectedUsageCount = 0
        } else {
          expectedTrialsUsed = currentTrialsEarned
          expectedUsageCount = actualUsageCount - currentTrialsEarned
        }
      } else {
        expectedTrialsUsed = 0
        expectedUsageCount = actualUsageCount
      }
    }

    const testResult: any = {
      currentData: {
        planType: usageData.plan_type,
        trialsUsed: parseInt(usageData.referral_trials_used) || 0,
        usageCount: parseInt(usageData.usage_count) || 0,
        trialsEarned: parseInt(usageData.referral_trials_earned) || 0,
        maxChoices: usageData.max_choices
      },
      actualUsage: {
        totalLogs: actualUsageCount,
        logs: usageLogs?.map((log: any) => ({
          sessionId: log.session_id,
          choicesGenerated: log.choices_generated,
          pdfDownloaded: log.pdf_downloaded,
          createdAt: log.created_at
        }))
      },
      referrals: {
        total: referrals?.length || 0,
        completed: completedReferrals,
        pending: referrals?.filter((r: any) => r.status === 'pending').length || 0,
        signedIn: referrals?.filter((r: any) => r.status === 'signed_in').length || 0
      },
      expectedValues: {
        trialsUsed: expectedTrialsUsed,
        usageCount: expectedUsageCount
      },
      issues: [] as string[]
    }

    // Check for issues
    const currentTrialsUsed = parseInt(usageData.referral_trials_used) || 0
    const currentUsageCount = parseInt(usageData.usage_count) || 0
    
    if (currentTrialsUsed !== expectedTrialsUsed) {
      testResult.issues.push(`Trials used mismatch: expected ${expectedTrialsUsed}, got ${currentTrialsUsed}`)
    }

    if (currentUsageCount !== expectedUsageCount) {
      testResult.issues.push(`Usage count mismatch: expected ${expectedUsageCount}, got ${currentUsageCount}`)
    }

    if (usageData.plan_type === 'referral_75' && currentTrialsUsed > 3) {
      testResult.issues.push(`Referral_75 plan has more than 3 trials used: ${currentTrialsUsed}`)
    }

    if (usageData.plan_type === 'referral_200' && currentTrialsUsed > 5) {
      testResult.issues.push(`Referral_200 plan has more than 5 trials used: ${currentTrialsUsed}`)
    }

    console.log('Test result:', testResult)

    return NextResponse.json({
      success: true,
      testResult
    })

  } catch (error: any) {
    console.error('Error in test-referral-tracking:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 