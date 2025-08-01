'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('=== AUTH CALLBACK STARTED ===')
        console.log('Current URL:', window.location.href)
        console.log('Current pathname:', window.location.pathname)
        console.log('Current search:', window.location.search)
        
        // Get the URL parameters
        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token')
        const type = urlParams.get('type')
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        const signup = urlParams.get('signup') // Check if this is a signup flow
        
        console.log('Auth callback params:', { 
          token, 
          type, 
          code, 
          error, 
          errorDescription,
          signup
        })
        
        // Handle OAuth errors
        if (error) {
          console.error('OAuth error:', error, errorDescription)
          toast.error(errorDescription || 'Authentication failed. Please try again.')
          router.push('/login')
          return
        }
        
        // Handle Google OAuth callback with code
        if (code) {
          console.log('Processing OAuth callback with code...')
          const { data, error: oauthError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (oauthError) {
            console.error('OAuth callback error:', oauthError)
            toast.error('Failed to complete authentication. Please try again.')
            router.push('/login')
            return
          }
          
          if (data.user) {
            console.log('OAuth authentication successful:', data.user)
            console.log('User metadata:', data.user.user_metadata)
            
            // Let AuthContext handle the rest - don't redirect here
            return
          }
        }
        
        // Handle email verification
        if (token && type) {
          console.log('Processing email verification...')
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any,
          })

          if (error) {
            console.error('Email verification error:', error)
            toast.error('Failed to verify email. Please try again.')
            router.push('/login')
            return
          }

          if (data.user) {
            console.log('Email verified successfully:', data.user)
            toast.success('Email verified successfully! You can now sign in.')
            router.push('/login')
            return
          }
        }
        
        // If no valid parameters, redirect to login
        console.log('No valid auth parameters found, redirecting to login')
        router.push('/login')
        
      } catch (error) {
        console.error('Error in auth callback:', error)
        toast.error('An error occurred during authentication.')
        router.push('/login')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-4 text-center">
        <h2 className="text-lg font-semibold mb-2">Processing...</h2>
        <p className="text-gray-600">Please wait while we complete your authentication.</p>
      </div>
    </div>
  )
} 