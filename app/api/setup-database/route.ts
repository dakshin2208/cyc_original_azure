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
    console.log('Checking database setup requirements...')

    // Check if the required tables exist by attempting to query them
    const tablesToCheck = ['choice_filling_usage', 'user_referrals', 'choice_filling_logs', 'ai_chat_usage']
    const missingTables: string[] = []

    for (const tableName of tablesToCheck) {
      try {
        const { error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
          missingTables.push(tableName)
        }
      } catch (error) {
        missingTables.push(tableName)
      }
    }

    // Check if referral_code column exists in profiles table
    let referralCodeColumnExists = false
    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .select('referral_code')
        .limit(1)
      
      if (!error) {
        referralCodeColumnExists = true
      }
    } catch (error) {
      // Column doesn't exist
    }

    if (missingTables.length > 0 || !referralCodeColumnExists) {
      const setupInstructions = {
        missingTables,
        needsReferralCodeColumn: !referralCodeColumnExists,
        instructions: `
## Manual Database Setup Required

Since Supabase doesn't allow direct SQL execution via API, you need to create these tables manually in your Supabase dashboard:

### 1. Create Tables in Supabase Dashboard:

**choice_filling_usage table:**
\`\`\`sql
CREATE TABLE choice_filling_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  max_choices INTEGER DEFAULT 10,
  plan_type TEXT DEFAULT 'freemium' CHECK (plan_type IN ('freemium', 'premium_199', 'premium_299', 'premium_499', 'referral_75', 'referral_200', 'referral_300')),
  referral_trials_earned INTEGER DEFAULT 0,
  referral_trials_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_choice_filling_usage_user_id ON choice_filling_usage(user_id);
CREATE INDEX idx_choice_filling_usage_email ON choice_filling_usage(email);
\`\`\`

**user_referrals table:**
\`\`\`sql
CREATE TABLE user_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_email TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  referred_phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_referrals_referrer_id ON user_referrals(referrer_id);
CREATE INDEX idx_user_referrals_referred_email ON user_referrals(referred_email);
CREATE INDEX idx_user_referrals_status ON user_referrals(status);
\`\`\`

**choice_filling_logs table:**
\`\`\`sql
CREATE TABLE choice_filling_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  session_id TEXT NOT NULL,
  choices_generated INTEGER DEFAULT 0,
  pdf_downloaded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_choice_filling_logs_user_id ON choice_filling_logs(user_id);
CREATE INDEX idx_choice_filling_logs_session_id ON choice_filling_logs(session_id);
\`\`\`

**ai_chat_usage table (AI counsellor question limits — mirrors choice_filling_usage):**
\`\`\`sql
CREATE TABLE ai_chat_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  questions_used INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT 'freemium' CHECK (plan_type IN ('freemium', 'premium_199', 'premium_299', 'premium_499', 'referral_75', 'referral_200', 'referral_300')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ai_chat_usage_user_id ON ai_chat_usage(user_id);
\`\`\`

### 2. Add referral_code column to profiles table:
\`\`\`sql
ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);
\`\`\`

### Steps:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run each CREATE TABLE statement above
4. Run the ALTER TABLE statement for profiles
5. Come back here and click "Setup Database" again
        `
      }

      return NextResponse.json({
        error: 'Manual database setup required',
        setupInstructions,
        missingTables,
        needsReferralCodeColumn: !referralCodeColumnExists
      }, { status: 400 })
    }

    // If we get here, all tables exist, so let's update existing profiles
    const { data: existingProfiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .is('referral_code', null)

    if (fetchError) {
      console.error('Error fetching existing profiles:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch existing profiles' }, { status: 500 })
    }

    let profilesUpdated = 0
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
        } else {
          profilesUpdated++
        }
      }
    }

    console.log('Database setup completed successfully')
    return NextResponse.json({ 
      success: true, 
      message: 'All database tables exist and profiles updated successfully',
      profilesUpdated: profilesUpdated
    })

  } catch (error: any) {
    console.error('Error checking database setup:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check database setup' },
      { status: 500 }
    )
  }
} 