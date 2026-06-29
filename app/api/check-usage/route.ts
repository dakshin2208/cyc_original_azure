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
    // Check if request body is empty
    const body = await request.text()
    if (!body) {
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      )
    }

    let requestData
    try {
      requestData = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { userId, email } = requestData

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and email' },
        { status: 400 }
      )
    }

    // Check if user has usage record (handle duplicates)
    let { data: usageRecords, error: usageError } = await supabaseAdmin
      .from('choice_filling_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (usageError) {
      console.error('Error checking usage:', usageError)
      return NextResponse.json(
        { error: 'Failed to check usage' },
        { status: 500 }
      )
    }

    let usageData = usageRecords?.[0] || null

    // If there are multiple records, keep the first one and delete the rest
    if (usageRecords && usageRecords.length > 1) {
      console.log(`Found ${usageRecords.length} usage records for user ${userId}, cleaning up duplicates`)
      
      // Delete all but the first record
      const recordsToDelete = usageRecords.slice(1).map(record => record.id)
      const { error: deleteError } = await supabaseAdmin
        .from('choice_filling_usage')
        .delete()
        .in('id', recordsToDelete)

      if (deleteError) {
        console.error('Error deleting duplicate records:', deleteError)
      }
    }

    // If no usage record exists, create one
    if (!usageData) {
      const { data: newUsage, error: createError } = await supabaseAdmin
        .from('choice_filling_usage')
        .insert({
          user_id: userId,
          email: email,
          usage_count: 0,
          max_choices: 20,
          plan_type: 'freemium',
          referral_trials_earned: 0,
          referral_trials_used: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating usage record:', createError)
        return NextResponse.json(
          { error: 'Failed to create usage record' },
          { status: 500 }
        )
      }

      usageData = newUsage
    }

    // Check referral status
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('user_referrals')
      .select('*')
      .eq('referrer_id', userId)
      .eq('status', 'completed')

    if (referralsError) {
      console.error('Error checking referrals:', referralsError)
      return NextResponse.json(
        { error: 'Failed to check referrals' },
        { status: 500 }
      )
    }

    const completedReferrals = referrals?.length || 0
    
    // Determine max choices based on plan and referrals
    let maxChoices = usageData.max_choices
    let planType = usageData.plan_type

    // Only apply referral upgrades if user doesn't have a premium plan
    if (!planType.startsWith('premium')) {
      if (completedReferrals >= 5) {
        maxChoices = 200
        planType = 'referral_200'
      } else if (completedReferrals >= 3) {
        maxChoices = 75
        planType = 'referral_75'
      }
    }

    // Calculate available trials based on plan type
    let availableTrials = 0
    const currentTrialsUsed = parseInt(usageData.referral_trials_used) || 0
    const currentTrialsEarned = parseInt(usageData.referral_trials_earned) || 0
    
    if (planType.startsWith('premium')) {
      // Premium plans have unlimited access - show a high number or "Unlimited"
      availableTrials = 999 // Represent unlimited access
    } else if (planType === 'referral_75') {
      // Referral premium 75 plan has 3 fixed trials
      availableTrials = Math.max(0, 3 - currentTrialsUsed)
    } else if (planType === 'referral_200') {
      // Referral premium 200 plan has 5 fixed trials
      availableTrials = Math.max(0, 5 - currentTrialsUsed)
    } else {
      // For freemium and regular referral plans, calculate from earned trials
      availableTrials = Math.max(0, currentTrialsEarned - currentTrialsUsed)
    }

    // Update usage record if plan type changed (but don't override premium plans)
    if (planType !== usageData.plan_type && !usageData.plan_type.startsWith('premium')) {
      const { data: updatedUsage, error: updateError } = await supabaseAdmin
        .from('choice_filling_usage')
        .update({
          plan_type: planType,
          max_choices: maxChoices,
          referral_trials_earned: completedReferrals,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating usage record:', updateError)
      } else if (updatedUsage) {
        // Use the updated data for the response
        usageData = updatedUsage
      }
    }

    // Map plan type to human-readable name
    let currentPlan = 'Freemium'
    if (planType === 'premium_199') {
      currentPlan = 'Secure (₹299)'
    } else if (planType === 'premium_299') {
      currentPlan = 'Assured+ (₹399)'
    } else if (planType === 'referral_75') {
      currentPlan = 'Referral Premium (75 Choices)'
    } else if (planType === 'referral_200') {
      currentPlan = 'Referral Premium (200 Choices)'
    }

    return NextResponse.json({
      success: true,
      usage: {
        usageCount: parseInt(usageData.usage_count) || 0,
        maxChoices: maxChoices,
        planType: planType,
        currentPlan: currentPlan,
        availableTrials: availableTrials,
        completedReferrals: completedReferrals,
        canUse: (parseInt(usageData.usage_count) || 0) === 0 || availableTrials > 0 || planType.startsWith('premium')
      }
    })

  } catch (error: any) {
    console.error('Error in check-usage:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 