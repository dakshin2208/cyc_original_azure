'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

/**
 * Supabase often returns tokens in the URL **hash** (#access_token=…),
 * not in ?code= (PKCE). The query string may only show ?signup=true.
 */
function parseHashParams(): URLSearchParams {
  const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
  return new URLSearchParams(raw)
}

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('=== AUTH CALLBACK STARTED ===')
        console.log('Current URL:', window.location.href)
        console.log('Current pathname:', window.location.pathname)
        console.log('Current search:', window.location.search)
        console.log('Current hash (truncated):', window.location.hash?.slice(0, 40) + '…')

        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token')
        const type = urlParams.get('type')
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        const signup = urlParams.get('signup')

        const hashParams = parseHashParams()
        const hashError = hashParams.get('error')
        const hashErrorDescription = hashParams.get('error_description')
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        console.log('Auth callback params:', {
          hasCode: !!code,
          hasTokenType: !!(token && type),
          hasHashTokens: !!(accessToken && refreshToken),
          signup,
        })

        if (error) {
          console.error('OAuth error:', error, errorDescription)
          toast.error(errorDescription || 'Authentication failed. Please try again.')
          router.replace('/login')
          return
        }

        if (hashError) {
          console.error('OAuth hash error:', hashError, hashErrorDescription)
          toast.error(
            hashErrorDescription
              ? decodeURIComponent(hashErrorDescription.replace(/\+/g, ' '))
              : 'Authentication failed. Please try again.'
          )
          router.replace('/login')
          return
        }

        // PKCE: ?code=…
        if (code) {
          console.log('Processing OAuth callback with code...')
          const { data, error: oauthError } = await supabase.auth.exchangeCodeForSession(code)

          if (oauthError) {
            console.error('OAuth callback error:', oauthError)
            toast.error('Failed to complete authentication. Please try again.')
            router.replace('/login')
            return
          }

          if (data.user) {
            console.log('OAuth authentication successful:', data.user)
            window.history.replaceState({}, document.title, '/auth/callback')
            router.replace('/choice-filling')
            return
          }
        }

        // Implicit / some redirect flows: #access_token=…&refresh_token=…
        if (accessToken && refreshToken) {
          console.log('Processing session from URL hash…')
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('setSession error:', sessionError)
            toast.error(sessionError.message || 'Failed to complete sign-in. Please try again.')
            router.replace('/login')
            return
          }

          if (data.session?.user) {
            console.log('Session established from hash:', data.session.user.email)
            // Strip tokens from the address bar (sensitive)
            const qs = signup === 'true' ? '?signup=true' : ''
            window.history.replaceState({}, document.title, `${window.location.pathname}${qs}`)
            router.replace('/choice-filling')
            return
          }
        }

        // Email verification (query)
        if (token && type) {
          console.log('Processing email verification...')
          const { data, error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink',
          })

          if (verifyErr) {
            console.error('Email verification error:', verifyErr)
            toast.error('Failed to verify email. Please try again.')
            router.replace('/login')
            return
          }

          if (data.user) {
            console.log('Email verified successfully:', data.user)
            toast.success('Email verified successfully! You can now sign in.')
            router.replace('/login')
            return
          }
        }

        // Fallback: Supabase may have already parsed the URL (detectSessionInUrl)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('Session found via getSession after callback')
          router.replace('/choice-filling')
          return
        }

        console.log('No valid auth parameters found, redirecting to login')
        router.replace('/login')
      } catch (err) {
        console.error('Error in auth callback:', err)
        toast.error('An error occurred during authentication.')
        router.replace('/login')
      }
    }

    void handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-4 text-center">
        <h2 className="text-lg font-semibold mb-2">Processing…</h2>
        <p className="text-gray-600">Please wait while we complete your authentication.</p>
      </div>
    </div>
  )
}
