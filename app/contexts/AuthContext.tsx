'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

type User = {
  id: string
  email: string
  fullName: string
  phoneNumber: string
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUpWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resendVerificationEmail: (email: string) => Promise<void>
  testEmailVerification: (email: string) => Promise<void>
  checkEmailStatus: (email: string) => Promise<{ confirmed: boolean; confirmedAt?: string; userId?: string; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event, session?.user?.email)

      if (session?.user) {
        // Check if user has a profile before proceeding
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
          .select('*')
            .eq('id', session.user.id)
          .maybeSingle()

        if (profileError) {
          console.error('Error checking user profile:', profileError)
          setLoading(false)
          return
        }

        if (!profileData) {
          console.log('No profile found for user:', session.user.id)
          
          // Check if this is a new user (first time OAuth) or existing user trying to sign in
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            console.error('Error getting user from auth:', userError)
            
            // If the error is about user not existing in JWT, clear the session
            if (userError.message?.includes('User from sub claim in JWT does not exist')) {
              console.log('Invalid JWT detected, clearing session...')
              try {
                await supabase.auth.signOut()
                // Clear any stored tokens
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('supabase.auth.token')
                  sessionStorage.removeItem('supabase.auth.token')
                }
              } catch (signOutError) {
                console.log('Error during sign out:', signOutError)
              }
            }
            
            setUser(null)
            setLoading(false)
            return
          }
          
          if (user && user.id === session.user.id) {
            // Check if user was created recently (within last 5 minutes) - likely first time OAuth
            const userCreatedAt = new Date(user.created_at)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
            
            if (userCreatedAt > fiveMinutesAgo) {
              // This is likely a new user signing up with OAuth - create profile
              console.log('New OAuth user detected, creating profile...')
              
              try {
                // Extract user data from Google OAuth
                const userEmail = user.email || `user-${Date.now()}@example.com`
                const userFullName = user.user_metadata?.full_name || 
                                   user.user_metadata?.name || 
                                   user.user_metadata?.display_name ||
                                   user.email?.split('@')[0] || 
                                   'User'
                const userPhoneNumber = user.user_metadata?.phone_number || 
                                      user.phone || 
                                      ''
                
                console.log('Creating profile for new OAuth user:', {
                  id: user.id,
                  email: userEmail,
                  full_name: userFullName,
                  phone_number: userPhoneNumber
                })
                
                const profileResponse = await fetch('/api/create-profile', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    id: user.id,
                    email: userEmail,
                    full_name: userFullName,
                    phone_number: userPhoneNumber,
                  }),
                })
                
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json()
                  console.log('Profile created successfully for OAuth user:', profileData)
                  
                  // Set user data and proceed
                  setUser({
                    id: user.id,
                    email: userEmail,
                    fullName: userFullName,
                    phoneNumber: userPhoneNumber
                  })
                  
                  // Redirect to choice-filling for new OAuth users
                  if (event === 'SIGNED_IN') {
                    console.log('New OAuth user signed up, redirecting to choice-filling...')
                    setTimeout(() => {
                      router.push('/choice-filling')
                    }, 1000)
                  }
                } else {
                  const errorData = await profileResponse.json()
                  console.error('Failed to create profile for OAuth user:', errorData)
                  toast.error('Failed to create account. Please try again.')
                  
                  // Try to sign out gracefully
                  try {
                    await supabase.auth.signOut()
                  } catch (signOutError) {
                    console.log('Sign out error (expected):', signOutError)
                  }
                  
                  setUser(null)
                  setLoading(false)
                  return
                }
              } catch (profileCreateError) {
                console.error('Error creating profile for OAuth user:', profileCreateError)
                toast.error('Failed to create account. Please try again.')
                
                // Try to sign out gracefully
                try {
                  await supabase.auth.signOut()
                } catch (signOutError) {
                  console.log('Sign out error (expected):', signOutError)
                }
                
                setUser(null)
                setLoading(false)
                return
              }
            } else {
              // This is an existing user trying to sign in without a profile
              console.log('Existing user without profile trying to sign in')
              toast.error('Please sign up first before signing in.')
              
              // Try to sign out gracefully
              try {
                await supabase.auth.signOut()
              } catch (signOutError) {
                console.log('Sign out error (expected):', signOutError)
              }
              
              setUser(null)
              setLoading(false)
              // Redirect to login page
              if (typeof window !== 'undefined') {
                window.location.href = '/login'
              }
              return
            }
          }
          
          setLoading(false)
          return
        }

        // User has a profile, proceed with normal flow
        await fetchUserProfile(session.user.id)
        
        // If this is a sign in event, redirect to choice-filling
        if (event === 'SIGNED_IN') {
          console.log('User signed in, redirecting to choice-filling...')
          // Use setTimeout with a longer delay to ensure all state updates are complete
          setTimeout(() => {
            router.push('/choice-filling')
          }, 1000)
        }
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        setLoading(false)
        return
      }

      if (!data) {
        console.log('No profile found for user:', userId)
        // Don't create profile automatically - user must sign up first
        setUser(null)
        setLoading(false)
        return
      }

      console.log('User profile fetched successfully:', data)
      setUser({
        id: userId,
        email: data.email,
        fullName: data.full_name,
        phoneNumber: data.phone_number
      })
      setLoading(false)
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, phoneNumber: string) => {
    let signupTimeout: NodeJS.Timeout;
    
    try {
      setLoading(true)
      console.log('Starting signup process for:', email)
      
      // Increase timeout to 90 seconds
      signupTimeout = setTimeout(() => {
        console.error('Signup process timed out after 90 seconds')
        setLoading(false)
        toast.error('Signup process is taking longer than expected. Please try again.')
        throw new Error('Signup timeout')
      }, 90000) // 90 second timeout

      try {
        // First check if user already exists with increased timeout
        console.log('Checking if user exists...')
        let existingUser: { email: string } | null = null
        let checkError: any = null
        let userCheckRetryCount = 0
        const userCheckMaxRetries = 3

        while (userCheckRetryCount < userCheckMaxRetries) {
          try {
            const { data, error } = await supabase
        .from('profiles')
              .select('email')
        .eq('email', email)
              .maybeSingle()

            if (error) {
              console.error(`User check attempt ${userCheckRetryCount + 1} failed:`, error)
              checkError = error
              userCheckRetryCount++
              if (userCheckRetryCount < userCheckMaxRetries) {
                console.log(`Retrying user check in ${userCheckRetryCount * 2} seconds...`)
                await new Promise(resolve => setTimeout(resolve, userCheckRetryCount * 2000))
                continue
              }
            } else {
              existingUser = data
              break
            }
          } catch (error) {
            console.error(`User check attempt ${userCheckRetryCount + 1} failed:`, error)
            checkError = error
            userCheckRetryCount++
            if (userCheckRetryCount < userCheckMaxRetries) {
              console.log(`Retrying user check in ${userCheckRetryCount * 2} seconds...`)
              await new Promise(resolve => setTimeout(resolve, userCheckRetryCount * 2000))
            }
          }
        }

        if (checkError) {
          console.error('Error checking existing user after retries:', checkError)
          throw new Error('Failed to check if user exists. Please try again.')
        }

      if (existingUser) {
          console.log('User already exists:', email)
          clearTimeout(signupTimeout)
          toast.error('An account with this email already exists')
          setLoading(false)
          return
        }

        console.log('No existing user found, proceeding with signup...')

        // Create auth user
        console.log('Creating auth user...')
        // Sign up the user with email confirmation
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: fullName,
              phone_number: phoneNumber
            }
          }
        })

        console.log('Auth signup response:', { authData, authError })

        if (authError) {
          console.error('Auth error:', authError)
          throw authError
        }

        if (!authData.user) {
          console.error('No user data returned from signup')
          throw new Error('No user data returned from signup')
        }

        console.log('Auth user created:', authData.user.id)
        console.log('User email confirmed:', authData.user.email_confirmed_at)
        console.log('Session:', authData.session)

        // Wait a moment to ensure the auth user is fully created
        console.log('Waiting for auth system to complete user creation...')
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Create profile in profiles table
        console.log('Creating user profile via API...')
        const profileResponse = await fetch('/api/create-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: authData.user.id,
            email,
            full_name: fullName,
            phone_number: phoneNumber,
          }),
        })

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json()
          console.error('Profile creation API error:', errorData)
          throw new Error(errorData.error || 'Failed to create profile')
        }

        const { data: profileData, error: profileError } = await profileResponse.json()

      if (profileError) {
          console.error('Profile creation error:', profileError)
          // Clean up auth user
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.log('Sign out error (expected):', signOutError)
          }
          throw new Error('Failed to create profile. Please try again.')
        }

        if (!profileData) {
          console.error('No profile data returned after creation')
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.log('Sign out error (expected):', signOutError)
          }
          throw new Error('Profile creation failed - no data returned')
        }

        console.log('Profile created successfully:', profileData)

        // Check if email confirmation was sent automatically
        if (authData.user.email_confirmed_at) {
          console.log('Email already confirmed during signup')
          toast.success('Account created and email confirmed! You can now sign in.')
        } else {
          console.log('Email not confirmed, sending verification email...')
          
          // Send verification email
          console.log('Sending verification email...')
          console.log('Email:', email)
          console.log('Redirect URL:', `${window.location.origin}/auth/callback`)
          
          // Try with different redirect URLs
          const redirectUrls = [
            `${window.location.origin}/auth/callback`,
            `${window.location.origin}/login`,
            `${window.location.origin}`,
            'http://localhost:3000/auth/callback',
            'http://localhost:3000/login'
          ]
          
          let emailSent = false
          
          for (const redirectUrl of redirectUrls) {
            if (emailSent) break
            
            try {
              console.log(`Trying with redirect URL: ${redirectUrl}`)
              
              const { data: emailData, error: emailError } = await supabase.auth.resend({
                type: 'signup',
                email,
                options: {
                  emailRedirectTo: redirectUrl,
                },
              })

              console.log(`Email resend response for ${redirectUrl}:`, { emailData, emailError })

              if (emailError) {
                console.error(`Email verification error for ${redirectUrl}:`, emailError)
                continue
              } else {
                console.log(`Verification email sent successfully with ${redirectUrl}:`, emailData)
                emailSent = true
                toast.success(
                  'Account created successfully! Please check your email for verification. You will be able to log in after verifying your email.',
                  { duration: 5000 }
                )
                break
              }
    } catch (error) {
              console.error(`Error with redirect URL ${redirectUrl}:`, error)
              continue
            }
          }
          
          if (!emailSent) {
            console.error('Failed to send verification email with any redirect URL')
            toast.error('Account created but failed to send verification email. Please try logging in to resend.')
          }
        }

        // Sign out the user immediately after signup to prevent automatic login
        console.log('Signing out user after successful signup...')
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          console.log('Sign out error (expected):', signOutError)
        }

        // Clear the timeout and complete the process
        clearTimeout(signupTimeout)
        setLoading(false)
        
        // Show a more detailed success message and redirect
        toast.success(
          'Account created! Please check your email and click the verification link before signing in.',
          { duration: 6000 }
        )
        
        router.push('/login')
        
      } catch (error: any) {
        clearTimeout(signupTimeout)
        throw error
      }
      
    } catch (error: any) {
      console.error('Error in signup process:', error)
      setLoading(false)
      
      // Handle specific error cases
      if (error.message?.includes('timeout')) {
        toast.error('The signup process is taking longer than expected. Please try again.')
      } else if (error.message?.includes('security policy')) {
        toast.error('Unable to create account due to security restrictions. Please try again or contact support.')
      } else if (error.message?.includes('email already registered')) {
        toast.error('An account with this email already exists')
      } else if (error.message?.includes('password')) {
        toast.error('Password must be at least 6 characters long')
      } else if (error.message?.includes('email')) {
        toast.error('Please enter a valid email address')
      } else if (error.message?.includes('profile')) {
        toast.error('Failed to create user profile. Please try again.')
      } else if (error.message?.includes('Failed to fetch')) {
        toast.error('Unable to connect to the server. Please check your internet connection and try again.')
      } else if (error.message?.includes('foreign key constraint')) {
        toast.error('Failed to create account. Please try again.')
      } else {
        toast.error(error.message || 'Failed to create account. Please try again.')
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('Starting sign in process for:', email)
      
      // First, check if user has a profile in our database
      console.log('Checking if user profile exists...')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (profileError) {
        console.error('Error checking user profile:', profileError)
        throw new Error('Unable to verify user account. Please try again.')
      }

      if (!profileData) {
        console.log('No profile found for user:', email)
        toast.error('No account found with this email. Please sign up first.')
        setLoading(false)
        return
      }

      console.log('User profile found, proceeding with sign in...')
      
      // Proceed with sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Sign in error:', error)
        
        if (error.message.includes('Email not confirmed')) {
          // Resend verification email
          console.log('Email not confirmed, resending verification email...')
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
      })

          if (resendError) {
            console.error('Error resending verification:', resendError)
            throw new Error('Failed to resend verification email')
          }
          
          toast.error('Please verify your email first. A new verification email has been sent.')
          setLoading(false)
          return
        }
        
        throw error
      }

      if (!data.user) {
        throw new Error('No user data returned from sign in')
      }

      // Check if email is verified
      if (!data.user.email_confirmed_at) {
        console.log('User email not verified, resending verification email...')
        
        // Resend verification email
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (resendError) {
          console.error('Error resending verification:', resendError)
          throw new Error('Failed to resend verification email')
        }
        
        toast.error('Please verify your email before signing in. A new verification email has been sent.')
        setLoading(false)
        return
      }

      console.log('User signed in successfully:', data.user.id)
      toast.success('Logged in successfully!')
      router.push('/choice-filling')
    } catch (error: any) {
      console.error('Error signing in:', error)
      
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('Invalid email or password')
      } else if (error.message?.includes('Email not confirmed')) {
        toast.error('Please verify your email before signing in')
      } else if (error.message?.includes('Auth session missing')) {
        toast.error('Please verify your email before signing in')
      } else if (error.message?.includes('Failed to resend')) {
        toast.error('Failed to resend verification email. Please try again.')
      } else if (error.message?.includes('No account found')) {
        toast.error('No account found with this email. Please sign up first.')
      } else {
        toast.error(error.message || 'Failed to sign in')
      }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    console.log('Sign out function called')
    
    try {
      console.log('Starting sign out process...')
      
      // First check if there's an active session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Error getting session:', sessionError)
        // Even if we can't get the session, proceed with clearing local state
      }
      
      if (!session) {
        console.log('No active session found, clearing local state only')
        // Clear user state even if no session
        setUser(null)
        setLoading(false)
        toast.success('Logged out successfully!')
        
        // Force redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }
      
      // Complete the Supabase sign-out process
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Error signing out from Supabase:', error)
        
        // If it's an auth session missing error, just clear local state
        if (error.message?.includes('Auth session missing')) {
          console.log('Auth session missing, clearing local state only')
          setUser(null)
          setLoading(false)
          toast.success('Logged out successfully!')
          
          // Force redirect to login page
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return
        }
        
        throw error
      }
      
      console.log('Supabase sign out successful')
      
      // Clear user state after successful Supabase sign-out
      setUser(null)
      setLoading(false)
      
      toast.success('Logged out successfully!')
      
      // Force redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      
    } catch (error: any) {
      console.error('Error in sign out process:', error)
      
      // For any other errors, still clear the user state and redirect
      setUser(null)
      setLoading(false)
      toast.success('Logged out successfully!')
      
      // Force redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  const checkEmailStatus = async (email: string) => {
    try {
      console.log('Checking email status for:', email)
      
      // Try to get user info
      const { data: { user }, error } = await supabase.auth.getUser()
      
    if (error) {
        console.error('Error getting user:', error)
        return { confirmed: false, error: error.message }
      }
      
      if (user && user.email === email) {
        console.log('User found:', user)
        console.log('Email confirmed at:', user.email_confirmed_at)
        return { 
          confirmed: !!user.email_confirmed_at, 
          confirmedAt: user.email_confirmed_at,
          userId: user.id
        }
      }
      
      return { confirmed: false, error: 'User not found' }
    } catch (error: any) {
      console.error('Error checking email status:', error)
      return { confirmed: false, error: error.message }
    }
  }

  const resendVerificationEmail = async (email: string) => {
    try {
      setLoading(true)
      console.log('Resending verification email to:', email)
      
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error('Resend verification error:', error)
        throw error
      }

      console.log('Verification email resent successfully:', data)
      toast.success('Verification email sent! Please check your inbox and spam folder.')
    } catch (error: any) {
      console.error('Error resending verification email:', error)
      toast.error(error.message || 'Failed to resend verification email')
    } finally {
      setLoading(false)
    }
  }

  const testEmailVerification = async (email: string) => {
    try {
      setLoading(true)
      console.log('Testing email verification for:', email)
      
      // Try different email types
      const emailTypes = ['signup', 'recovery', 'change']
      
      for (const type of emailTypes) {
        console.log(`Testing ${type} email...`)
        const { data, error } = await supabase.auth.resend({
          type: type as any,
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        
        console.log(`${type} email response:`, { data, error })
        
        if (!error) {
          console.log(`${type} email sent successfully`)
      } else {
          console.error(`${type} email error:`, error)
        }
      }
      
      toast.success('Email tests completed. Check console for results.')
    } catch (error: any) {
      console.error('Error testing email verification:', error)
      toast.error(error.message || 'Failed to test email verification')
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      console.log('Starting Google sign in process...')
      console.log('Current origin:', window.location.origin)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Use Supabase's default OAuth handling
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      })

      if (error) {
        console.error('Google sign in error:', error)
        throw error
      }

      console.log('Google sign in initiated:', data)
      toast.success('Redirecting to Google for authentication...')
      
    } catch (error: any) {
      console.error('Error signing in with Google:', error)
      toast.error(error.message || 'Failed to sign in with Google')
    } finally {
      setLoading(false)
    }
  }

  const signUpWithGoogle = async () => {
    try {
      setLoading(true)
      console.log('Starting Google sign up process...')
      console.log('Current origin:', window.location.origin)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Force account selection for signup
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account', // This forces account selection
          },
          redirectTo: `${window.location.origin}/auth/callback?signup=true`, // Add signup flag
        }
      })

      if (error) {
        console.error('Google sign up error:', error)
      throw error
      }

      console.log('Google sign up initiated:', data)
      toast.success('Redirecting to Google to create your account...')
      
    } catch (error: any) {
      console.error('Error signing up with Google:', error)
      toast.error(error.message || 'Failed to sign up with Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signUp, 
      signIn, 
      signInWithGoogle,
      signUpWithGoogle,
      signOut, 
      resendVerificationEmail, 
      testEmailVerification,
      checkEmailStatus 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 