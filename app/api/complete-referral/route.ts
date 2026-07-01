import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { referralPlanFor } from '@/lib/plans'

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
    const { referredUserId, referredEmail } = await request.json()

    if (!referredUserId || !referredEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: referredUserId and referredEmail' },
        { status: 400 }
      )
    }

    // Find the referral record for this user
    const { data: referral, error: referralError } = await supabaseAdmin
      .from('user_referrals')
      .select('*')
      .eq('referred_email', referredEmail)
      .eq('status', 'pending')
      .single()

    if (referralError) {
      if (referralError.code === 'PGRST116') {
        // No pending referral found - this is okay
        return NextResponse.json({
          success: true,
          message: 'No pending referral found for this user'
        })
      }
      console.error('Error finding referral:', referralError)
      return NextResponse.json(
        { error: 'Failed to find referral' },
        { status: 500 }
      )
    }

    if (!referral) {
      return NextResponse.json({
        success: true,
        message: 'No pending referral found for this user'
      })
    }

    // Update the referral status to completed
    const { error: updateError } = await supabaseAdmin
      .from('user_referrals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', referral.id)

    if (updateError) {
      console.error('Error updating referral:', updateError)
      return NextResponse.json(
        { error: 'Failed to update referral' },
        { status: 500 }
      )
    }

    // Check if referrer now qualifies for bonus trials
    const { data: referrerReferrals, error: countError } = await supabaseAdmin
      .from('user_referrals')
      .select('id')
      .eq('referrer_id', referral.referrer_id)
      .eq('status', 'completed')

    if (countError) {
      console.error('Error counting referrer referrals:', countError)
      return NextResponse.json(
        { error: 'Failed to count referrer referrals' },
        { status: 500 }
      )
    }

    const completedCount = referrerReferrals?.length || 0

    // Update referrer's usage record if they qualify for bonus trials
    const earned = referralPlanFor(completedCount)
    if (earned) {
      const planType = earned.planType
      const maxChoices = earned.maxChoices

      const { error: usageUpdateError } = await supabaseAdmin
        .from('choice_filling_usage')
        .update({
          plan_type: planType,
          max_choices: maxChoices,
          referral_trials_earned: completedCount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', referral.referrer_id)

      if (usageUpdateError) {
        console.error('Error updating referrer usage:', usageUpdateError)
        // Don't fail the request, just log the error
      } else {
        console.log(`✅ Updated referrer usage with ${completedCount} referral trials, plan: ${planType}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Referral marked as completed',
      referral: {
        ...referral,
        status: 'completed',
        completed_at: new Date().toISOString()
      },
      referrerStats: {
        completedReferrals: completedCount,
        qualifiesForBonus: completedCount >= 3
      }
    })

  } catch (error: any) {
    console.error('Error in complete-referral:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 