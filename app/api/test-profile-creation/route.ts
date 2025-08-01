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
    console.log('=== TESTING PROFILE CREATION ===')
    
    // Test data
    const testData = {
      id: 'test-user-' + Date.now(),
      email: 'test@example.com',
      full_name: 'Test User',
      phone_number: '1234567890'
    }
    
    console.log('Test data:', testData)
    
    // Try to insert test data
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert([testData])
      .select()
      .single()
    
    if (error) {
      console.error('Test insert failed:', error)
      return NextResponse.json(
        { error: 'Test insert failed', details: error },
        { status: 500 }
      )
    }
    
    console.log('Test insert successful:', data)
    
    // Clean up - delete the test data
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', testData.id)
    
    return NextResponse.json({ 
      success: true,
      message: 'Test profile creation successful',
      data 
    })
  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    )
  }
} 