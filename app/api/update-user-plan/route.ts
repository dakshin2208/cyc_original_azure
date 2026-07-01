import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { planTypeForPlanName } from '@/lib/plans'

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

export async function POST(request: NextRequest) {
  try {
    const { userId, email, planName, paymentId } = await request.json()

    if (!userId || !email || !planName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Map plan names to database plan types (Secure / Annual / Annual+).
    // 'Assured+' kept as a legacy alias for the Annual tier.
    const { planType, maxChoices } = planTypeForPlanName(
      planName === 'Assured+' ? 'Annual' : planName
    )

    // Update or create usage record
    const { data: existingUsage, error: fetchError } = await supabaseAdmin
      .from('choice_filling_usage')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching usage record:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch usage record' },
        { status: 500 }
      )
    }

    if (existingUsage) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('choice_filling_usage')
        .update({
          plan_type: planType,
          max_choices: maxChoices,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Error updating usage record:', updateError)
        return NextResponse.json(
          { error: 'Failed to update usage record' },
          { status: 500 }
        )
      }
    } else {
      // Create new record
      const { error: createError } = await supabaseAdmin
        .from('choice_filling_usage')
        .insert({
          user_id: userId,
          email: email,
          usage_count: 0,
          max_choices: maxChoices,
          plan_type: planType,
          referral_trials_earned: 0,
          referral_trials_used: 0
        })

      if (createError) {
        console.error('Error creating usage record:', createError)
        return NextResponse.json(
          { error: 'Failed to create usage record' },
          { status: 500 }
        )
      }
    }

    // Log the payment for tracking
    console.log(`✅ User ${userId} (${email}) upgraded to ${planName} plan (${planType}) with payment ID: ${paymentId}`)
    console.log(`✅ Plan details: ${planType} with ${maxChoices} max choices`)

    return NextResponse.json({
      success: true,
      message: 'Plan updated successfully',
      planType,
      maxChoices,
      planName
    })

  } catch (error: any) {
    console.error('Error updating user plan:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 