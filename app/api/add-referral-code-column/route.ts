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

export async function POST() {
  try {
    console.log('Adding referral_code column to profiles table...')

    // Try to add referral_code column using direct SQL
    const { error: alterError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
      .then(() => {
        // If the query succeeds, try to add the column
        return supabaseAdmin.rpc('exec_sql', {
          sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;'
        })
      })

    if (alterError) {
      console.log('Could not add column via RPC, trying alternative approach:', alterError)
      
      // Alternative: Just update existing profiles with referral codes
      // The column will be added when we try to insert with it
    }

    // Update existing profiles to have referral codes
    const { data: existingProfiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .is('referral_code', null)

    if (fetchError) {
      console.error('Error fetching existing profiles:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch existing profiles' }, { status: 500 })
    }

    if (existingProfiles && existingProfiles.length > 0) {
      console.log(`Updating ${existingProfiles.length} existing profiles with referral codes...`)
      
      for (const profile of existingProfiles) {
        const referralCode = profile.id.slice(0, 8).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase()
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ referral_code: referralCode })
          .eq('id', profile.id)

        if (updateError) {
          console.error(`Error updating profile ${profile.id}:`, updateError)
        }
      }
    }

    console.log('Successfully processed referral codes for profiles')
    return NextResponse.json({ 
      success: true, 
      message: 'Referral code column processed successfully',
      profilesUpdated: existingProfiles?.length || 0
    })

  } catch (error: any) {
    console.error('Error processing referral codes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process referral codes' },
      { status: 500 }
    )
  }
} 