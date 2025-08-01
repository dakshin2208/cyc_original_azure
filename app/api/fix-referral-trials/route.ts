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
    console.log('=== FIXING REFERRAL TRIALS AND USAGE COUNT ===')
    
    // Get all usage records
    const { data: usageRecords, error: fetchError } = await supabaseAdmin
      .from('choice_filling_usage')
      .select('*')

    if (fetchError) {
      console.error('Error fetching usage records:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch usage records' },
        { status: 500 }
      )
    }

    const fixedRecords: Array<{
      userId: string;
      planType: string;
      oldTrialsUsed: number;
      newTrialsUsed: number;
      oldUsageCount: number;
      newUsageCount: number;
    }> = []
    const errors: Array<{
      recordId: string;
      error: string;
    }> = []

    for (const record of usageRecords || []) {
      try {
        let needsUpdate = false
        let updateData: any = {}

        // Get actual usage count from logs for this user
        const { data: usageLogs, error: logsError } = await supabaseAdmin
          .from('choice_filling_logs')
          .select('session_id')
          .eq('user_id', record.user_id)

        if (logsError) {
          console.error(`Error fetching logs for user ${record.user_id}:`, logsError)
          continue
        }

        const actualUsageCount = usageLogs?.length || 0
        console.log(`User ${record.user_id}: actual usage from logs: ${actualUsageCount}, current usage_count: ${record.usage_count}`)

        // Fix referral_75 plans
        if (record.plan_type === 'referral_75') {
          // Ensure numeric values
          const currentTrialsUsed = parseInt(record.referral_trials_used) || 0
          const currentUsageCount = parseInt(record.usage_count) || 0
          
          // Cap trials used at 3
          if (currentTrialsUsed > 3) {
            updateData.referral_trials_used = 3
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: referral_75 trials_used reduced from ${currentTrialsUsed} to 3`)
          }
          
          // Calculate correct trials used and usage count
          if (actualUsageCount <= 3) {
            // All usage should be trials
            updateData.referral_trials_used = actualUsageCount
            updateData.usage_count = 0
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: referral_75 set trials_used to ${actualUsageCount}, usage_count to 0`)
          } else {
            // First 3 are trials, rest are usage
            updateData.referral_trials_used = 3
            updateData.usage_count = actualUsageCount - 3
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: referral_75 set trials_used to 3, usage_count to ${actualUsageCount - 3}`)
          }
        }
        // Fix referral_200 plans
        else if (record.plan_type === 'referral_200') {
          // Ensure numeric values
          const currentTrialsUsed = parseInt(record.referral_trials_used) || 0
          const currentUsageCount = parseInt(record.usage_count) || 0
          
          // Cap trials used at 5
          if (currentTrialsUsed > 5) {
            updateData.referral_trials_used = 5
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: referral_200 trials_used reduced from ${currentTrialsUsed} to 5`)
          }
          
          // Calculate correct trials used and usage count
          if (actualUsageCount <= 5) {
            // All usage should be trials
            updateData.referral_trials_used = actualUsageCount
            updateData.usage_count = 0
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: referral_200 set trials_used to ${actualUsageCount}, usage_count to 0`)
          } else {
            // First 5 are trials, rest are usage
            updateData.referral_trials_used = 5
            updateData.usage_count = actualUsageCount - 5
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: referral_200 set trials_used to 5, usage_count to ${actualUsageCount - 5}`)
          }
        }
        // Fix freemium and other plans
        else {
          // Ensure numeric values
          const currentTrialsUsed = parseInt(record.referral_trials_used) || 0
          const currentUsageCount = parseInt(record.usage_count) || 0
          const currentTrialsEarned = parseInt(record.referral_trials_earned) || 0
          
          // For freemium and other plans, check if they have referral trials earned
          if (currentTrialsEarned > 0) {
            // Calculate correct trials used and usage count
            if (actualUsageCount <= currentTrialsEarned) {
              // All usage should be trials
              updateData.referral_trials_used = actualUsageCount
              updateData.usage_count = 0
              needsUpdate = true
              console.log(`Fixing user ${record.user_id}: freemium with ${currentTrialsEarned} trials earned, set trials_used to ${actualUsageCount}, usage_count to 0`)
            } else {
              // First N are trials, rest are usage
              updateData.referral_trials_used = currentTrialsEarned
              updateData.usage_count = actualUsageCount - currentTrialsEarned
              needsUpdate = true
              console.log(`Fixing user ${record.user_id}: freemium with ${currentTrialsEarned} trials earned, set trials_used to ${currentTrialsEarned}, usage_count to ${actualUsageCount - currentTrialsEarned}`)
            }
          } else {
            // No referral trials, all usage should be in usage_count
            updateData.usage_count = actualUsageCount
            updateData.referral_trials_used = 0
            needsUpdate = true
            console.log(`Fixing user ${record.user_id}: freemium no trials earned, set usage_count to ${actualUsageCount}, trials_used to 0`)
          }
        }

        if (needsUpdate) {
          updateData.updated_at = new Date().toISOString()
          
          const { error: updateError } = await supabaseAdmin
            .from('choice_filling_usage')
            .update(updateData)
            .eq('id', record.id)

          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError)
            errors.push({ recordId: record.id, error: updateError.message })
          } else {
            fixedRecords.push({
              userId: record.user_id,
              planType: record.plan_type,
              oldTrialsUsed: record.referral_trials_used,
              newTrialsUsed: updateData.referral_trials_used,
              oldUsageCount: record.usage_count,
              newUsageCount: updateData.usage_count
            })
          }
        }
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error)
        errors.push({ recordId: record.id, error: error.message })
      }
    }

    console.log(`✅ Fixed ${fixedRecords.length} records`)
    if (errors.length > 0) {
      console.error(`❌ ${errors.length} errors occurred`)
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedRecords.length} referral trial records`,
      fixedRecords,
      errors
    })

  } catch (error: any) {
    console.error('Error fixing referral trials:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 