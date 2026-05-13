import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Debug logging (development only — avoids noisy / blocking work in production)
if (process.env.NODE_ENV === "development") {
  console.log("=== Supabase Configuration Debug ===")
  console.log("Environment variables loaded:", {
    hasUrl: !!supabaseUrl,
    urlLength: supabaseUrl.length,
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey.length,
    urlPrefix: supabaseUrl.substring(0, 10) + "...",
    keyPrefix: supabaseAnonKey.substring(0, 10) + "...",
  })
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local",
  )
} else if (process.env.NODE_ENV === "development") {
  console.log("✅ Supabase credentials found in environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Optional dev-only connection check (avoids extra auth + DB traffic on every page load)
async function testConnection() {
  try {
    console.log("=== Testing Supabase Connection ===")

    const { data: authData, error: authError } = await supabase.auth.getSession()
    console.log("Auth connection test:", {
      success: !authError,
      hasSession: !!authData?.session,
      error: authError ? authError.message : null
    })

    const { data: dbData, error: dbError } = await supabase.from("profiles").select("count")
    console.log("Database connection test:", {
      success: !dbError,
      data: dbData,
      error: dbError ? dbError.message : null
    })

    if (authError || dbError) {
      console.error("❌ Supabase connection test failed")
      if (authError) console.error("Auth error:", authError)
      if (dbError) console.error("Database error:", dbError)
      return false
    }

    console.log("✅ Supabase connection tests passed")
    return true
  } catch (err) {
    console.error("❌ Supabase connection test threw an exception:", err)
    return false
  }
}

if (process.env.NODE_ENV === "development") {
  testConnection().then((success) => {
    if (success) {
      console.log("✅ Supabase is properly configured and connected")
    } else {
      console.error("❌ Supabase connection failed - check the console for details")
    }
  })
}

export type User = {
  id: string
  email: string
  username: string
  role: 'admin' | 'user'
  created_at: string
}
