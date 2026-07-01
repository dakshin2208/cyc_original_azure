import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { referralTrialCap } from '@/lib/plans'

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
    const { userId, email, sessionId, choicesGenerated, pdfDownloaded } = await request.json()

    console.log('=== TRACK USAGE API CALL ===')
    console.log('User ID:', userId)
    console.log('Session ID:', sessionId)
    console.log('Choices Generated:', choicesGenerated)
    console.log('PDF Downloaded:', pdfDownloaded)

    if (!userId || !email || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, and sessionId' },
        { status: 400 }
      )
    }

    // Check if this session has already been tracked to prevent duplicate counting
    const { data: existingLog, error: logCheckError } = await supabaseAdmin
      .from('choice_filling_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single()

    if (logCheckError && logCheckError.code !== 'PGRST116') {
      console.error('Error checking existing log:', logCheckError)
      return NextResponse.json(
        { error: 'Failed to check existing usage log' },
        { status: 500 }
      )
    }

    // If session already exists, update the log but don't increment usage
    if (existingLog) {
      console.log(`Session ${sessionId} already tracked, updating log entry only`)
      
      // Update the existing log entry with new data (e.g., PDF download)
      const { error: updateLogError } = await supabaseAdmin
        .from('choice_filling_logs')
        .update({
          choices_generated: choicesGenerated || 0,
          pdf_downloaded: pdfDownloaded || false
        })
        .eq('id', existingLog.id)

      if (updateLogError) {
        console.error('Error updating usage log:', updateLogError)
      }
      
      // Get current usage data to return accurate counts
      const { data: currentUsage } = await supabaseAdmin
        .from('choice_filling_usage')
        .select('*')
        .eq('user_id', userId)
        .single()

      // Calculate available trials using parsed values
      const currentTrialsUsed = parseInt(currentUsage?.referral_trials_used) || 0
      let availableTrials = 0
      if (currentUsage?.plan_type.startsWith('premium')) {
        availableTrials = 999
      } else if (referralTrialCap(currentUsage?.plan_type) > 0) {
        availableTrials = Math.max(0, referralTrialCap(currentUsage?.plan_type) - currentTrialsUsed)
      } else {
        availableTrials = Math.max(0, (parseInt(currentUsage?.referral_trials_earned) || 0) - currentTrialsUsed)
      }

      return NextResponse.json({
        success: true,
        message: 'Session updated, no new usage counted',
        usage: {
          sessionAlreadyTracked: true,
          usageCount: parseInt(currentUsage?.usage_count) || 0,
          trialsUsed: currentTrialsUsed,
          availableTrials: availableTrials
        }
      })
    }

    // Create usage log entry
    const { error: logError } = await supabaseAdmin
      .from('choice_filling_logs')
      .insert({
        user_id: userId,
        email: email,
        session_id: sessionId,
        choices_generated: choicesGenerated || 0,
        pdf_downloaded: pdfDownloaded || false
      })

    if (logError) {
      console.error('Error creating usage log:', logError)
      return NextResponse.json(
        { error: 'Failed to create usage log' },
        { status: 500 }
      )
    }

    // Get all usage records for this user (handle duplicates)
    const { data: usageRecords, error: usageError } = await supabaseAdmin
      .from('choice_filling_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (usageError) {
      console.error('Error fetching usage data:', usageError)
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      )
    }

    if (!usageRecords || usageRecords.length === 0) {
      return NextResponse.json(
        { error: 'No usage record found for user' },
        { status: 404 }
      )
    }

    // If there are multiple records, keep the first one and delete the rest
    if (usageRecords.length > 1) {
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

    // Use the first (and now only) record
    const usageData = usageRecords[0]

    // Ensure numeric values are properly handled
    let newUsageCount = parseInt(usageData.usage_count) || 0
    let newTrialsUsed = parseInt(usageData.referral_trials_used) || 0
    const currentUsageCount = parseInt(usageData.usage_count) || 0
    const currentTrialsUsed = parseInt(usageData.referral_trials_used) || 0

    // Check if user has available trials based on plan type
    let availableTrials = 0
    if (usageData.plan_type.startsWith('premium')) {
      availableTrials = 999 // Unlimited for premium plans
    } else if (referralTrialCap(usageData.plan_type) > 0) {
      availableTrials = Math.max(0, referralTrialCap(usageData.plan_type) - currentTrialsUsed)
    } else {
      availableTrials = Math.max(0, (parseInt(usageData.referral_trials_earned) || 0) - currentTrialsUsed)
    }

    console.log('Current usage data:', {
      planType: usageData.plan_type,
      currentUsageCount: currentUsageCount,
      currentTrialsUsed: currentTrialsUsed,
      availableTrials: availableTrials
    })

    // For referral premium plans, always use referral trials first
    if (referralTrialCap(usageData.plan_type) > 0) {
      if (availableTrials > 0) {
        // Use a referral trial
        newTrialsUsed = currentTrialsUsed + 1

        // Ensure trials used doesn't exceed maximum for the plan
        const cap = referralTrialCap(usageData.plan_type)
        if (newTrialsUsed > cap) newTrialsUsed = cap

        console.log(`Using referral trial for ${usageData.plan_type}: trials_used ${currentTrialsUsed} -> ${newTrialsUsed}`)
      } else {
        // No more trials available, increment usage count
        newUsageCount = currentUsageCount + 1
        console.log(`No trials available for ${usageData.plan_type}: usage_count ${currentUsageCount} -> ${newUsageCount}`)
      }
    } else {
      // For other plans, use existing logic
      if (availableTrials > 0) {
        // Use a referral trial
        newTrialsUsed = currentTrialsUsed + 1
        console.log(`Using referral trial for ${usageData.plan_type}: trials_used ${currentTrialsUsed} -> ${newTrialsUsed}`)
      } else {
        // Increment usage count
        newUsageCount = currentUsageCount + 1
        console.log(`No trials available for ${usageData.plan_type}: usage_count ${currentUsageCount} -> ${newUsageCount}`)
      }
    }

    console.log('Final usage update:', {
      newUsageCount: newUsageCount,
      newTrialsUsed: newTrialsUsed
    })

    // Update usage record
    const { error: updateError } = await supabaseAdmin
      .from('choice_filling_usage')
      .update({
        usage_count: newUsageCount,
        referral_trials_used: newTrialsUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', usageData.id)

    if (updateError) {
      console.error('Error updating usage:', updateError)
      return NextResponse.json(
        { error: 'Failed to update usage' },
        { status: 500 }
      )
    }

    // Calculate final available trials after this usage
    let finalAvailableTrials = 0
    if (usageData.plan_type.startsWith('premium')) {
      finalAvailableTrials = 999 // Unlimited for premium plans
    } else if (referralTrialCap(usageData.plan_type) > 0) {
      finalAvailableTrials = Math.max(0, referralTrialCap(usageData.plan_type) - newTrialsUsed)
    } else {
      finalAvailableTrials = Math.max(0, usageData.referral_trials_earned - newTrialsUsed)
    }

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
      usage: {
        usageCount: newUsageCount,
        trialsUsed: newTrialsUsed,
        availableTrials: finalAvailableTrials
      }
    })

  } catch (error: any) {
    console.error('Error in track-usage:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 