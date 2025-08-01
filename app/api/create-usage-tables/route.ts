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
    console.log('Creating usage tracking tables...')

    // Create choice_filling_usage table
    const { error: usageError } = await supabaseAdmin.rpc('create_usage_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS choice_filling_usage (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          usage_count INTEGER DEFAULT 0,
          max_choices INTEGER DEFAULT 20,
          plan_type TEXT DEFAULT 'freemium' CHECK (plan_type IN ('freemium', 'premium_199', 'premium_299')),
          referral_trials_earned INTEGER DEFAULT 0,
          referral_trials_used INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_choice_filling_usage_user_id ON choice_filling_usage(user_id);
        CREATE INDEX IF NOT EXISTS idx_choice_filling_usage_email ON choice_filling_usage(email);
      `
    })

    if (usageError) {
      console.error('Error creating usage table:', usageError)
      return NextResponse.json({ error: 'Failed to create usage table' }, { status: 500 })
    }

    // Create user_referrals table
    const { error: referralsError } = await supabaseAdmin.rpc('create_referrals_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_referrals (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          referrer_email TEXT NOT NULL,
          referred_email TEXT NOT NULL,
          referred_phone TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'signed_in', 'completed', 'expired')),
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(referrer_id, referred_email)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer_id ON user_referrals(referrer_id);
        CREATE INDEX IF NOT EXISTS idx_user_referrals_referred_email ON user_referrals(referred_email);
        CREATE INDEX IF NOT EXISTS idx_user_referrals_status ON user_referrals(status);
      `
    })

    if (referralsError) {
      console.error('Error creating referrals table:', referralsError)
      return NextResponse.json({ error: 'Failed to create referrals table' }, { status: 500 })
    }

    // Create usage_logs table for tracking individual usage sessions
    const { error: logsError } = await supabaseAdmin.rpc('create_logs_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS choice_filling_logs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          session_id TEXT NOT NULL,
          choices_generated INTEGER DEFAULT 0,
          pdf_downloaded BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_choice_filling_logs_user_id ON choice_filling_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_choice_filling_logs_session_id ON choice_filling_logs(session_id);
      `
    })

    if (logsError) {
      console.error('Error creating logs table:', logsError)
      return NextResponse.json({ error: 'Failed to create logs table' }, { status: 500 })
    }

    console.log('All tables created successfully')
    return NextResponse.json({ 
      success: true, 
      message: 'Usage tracking tables created successfully' 
    })

  } catch (error: any) {
    console.error('Error creating tables:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create tables' },
      { status: 500 }
    )
  }
} 