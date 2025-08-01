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
    console.log('=== UPDATE REFERRAL STATUS API CALLED ===')
    
    const { referredUserId, referredEmail, status } = await request.json()
    console.log('Request data:', { referredUserId, referredEmail, status })

    if (!referredUserId || !referredEmail || !status) {
      console.log('❌ Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: referredUserId, referredEmail, and status' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['signed_in', 'completed']
    if (!validStatuses.includes(status)) {
      console.log('❌ Invalid status:', status)
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: signed_in, completed' },
        { status: 400 }
      )
    }

    console.log('🔍 Looking for referral for user:', referredEmail)
    
    // Find the referral record for this user - more flexible search
    const { data: referrals, error: referralError } = await supabaseAdmin
      .from('user_referrals')
      .select('*')
      .eq('referred_email', referredEmail)

    console.log('Referral query result:', { referrals, referralError })

    if (referralError) {
      console.error('❌ Error finding referral:', referralError)
      return NextResponse.json(
        { error: 'Failed to find referral' },
        { status: 500 }
      )
    }

    if (!referrals || referrals.length === 0) {
      console.log('❌ No referral found for this user')
      return NextResponse.json(
        { error: 'No referral found for this user' },
        { status: 404 }
      )
    }

    // Find the most recent referral that can be updated
    let referralToUpdate: any = null
    for (const referral of referrals) {
      if (status === 'signed_in' && ['pending'].includes(referral.status)) {
        referralToUpdate = referral
        break
      } else if (status === 'completed' && ['pending', 'signed_in'].includes(referral.status)) {
        referralToUpdate = referral
        break
      }
    }

    if (!referralToUpdate) {
      console.log('❌ No eligible referral found for status update:', status)
      console.log('Available referrals:', referrals.map(r => ({ id: r.id, status: r.status })))
      return NextResponse.json(
        { error: `No eligible referral found for status update to ${status}` },
        { status: 400 }
      )
    }

    console.log('✅ Eligible referral found:', referralToUpdate)

    // Prepare update data
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    }

    // Add completed_at timestamp if status is 'completed'
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    // Update the referral status
    const { data: updatedReferral, error: updateError } = await supabaseAdmin
      .from('user_referrals')
      .update(updateData)
      .eq('id', referralToUpdate.id)
      .select()
      .single()

    console.log('Update referral result:', { updatedReferral, updateError })

    if (updateError) {
      console.error('❌ Error updating referral:', updateError)
      return NextResponse.json(
        { error: 'Failed to update referral' },
        { status: 500 }
      )
    }

    console.log('✅ Referral status updated successfully:', updatedReferral)

    // If status is 'completed', check if referrer now qualifies for bonus trials
    if (status === 'completed') {
      try {
        const { data: referrerReferrals, error: countError } = await supabaseAdmin
          .from('user_referrals')
          .select('id')
          .eq('referrer_id', referralToUpdate.referrer_id)
          .eq('status', 'completed')

        if (countError) {
          console.error('Error counting referrer referrals:', countError)
          // Don't fail the request, just log the error
        } else {
          const completedCount = referrerReferrals?.length || 0
          console.log(`Referrer has ${completedCount} completed referrals`)

          // Update referrer's usage record if they qualify for bonus trials
          if (completedCount >= 3) {
            // Determine plan type and max choices based on completed referrals
            let planType = 'freemium'
            let maxChoices = 20
            
            if (completedCount >= 5) {
              planType = 'referral_200'
              maxChoices = 200
            } else if (completedCount >= 3) {
              planType = 'referral_75'
              maxChoices = 75
            }
            
            const { error: usageUpdateError } = await supabaseAdmin
              .from('choice_filling_usage')
              .update({
                plan_type: planType,
                max_choices: maxChoices,
                referral_trials_earned: completedCount,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', referralToUpdate.referrer_id)

            if (usageUpdateError) {
              console.error('Error updating referrer usage:', usageUpdateError)
              // Don't fail the request, just log the error
            } else {
              console.log(`✅ Updated referrer usage with ${completedCount} referral trials, plan: ${planType}`)
            }
          }
        }
      } catch (error) {
        console.error('Error processing referrer bonus:', error)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: `Referral status updated to ${status}`,
      referral: updatedReferral
    })

  } catch (error: any) {
    console.error('❌ Error in update-referral-status:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 