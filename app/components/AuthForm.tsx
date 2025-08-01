'use client'

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

export function AuthForm() {
  const { signUp, signIn, signInWithGoogle, signUpWithGoogle, loading, resendVerificationEmail, testEmailVerification, checkEmailStatus } = useAuth()
  const searchParams = useSearchParams()
  
  // Get the tab parameter from URL, default to 'signup' if not specified or invalid
  const tabParam = searchParams?.get('tab')
  const initialTab = (tabParam === 'login' || tabParam === 'signup') ? tabParam : 'signup'
  
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(initialTab)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: ''
  })
  const [showResendButton, setShowResendButton] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ confirmed: boolean; confirmedAt?: string; userId?: string; error?: string } | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (activeTab === 'login') {
      try {
        await signIn(formData.email, formData.password)
      } catch (error: any) {
        if (error.message?.includes('Email not confirmed') || error.message?.includes('Invalid login credentials')) {
          setShowResendButton(true)
        }
      }
    } else {
      await signUp(formData.email, formData.password, formData.fullName, formData.phoneNumber)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Google sign in error:', error)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      await signUpWithGoogle()
    } catch (error) {
      console.error('Google sign up error:', error)
    }
  }

  const handleResendVerification = async () => {
    if (formData.email) {
      await resendVerificationEmail(formData.email)
    }
  }

  const handleTestEmail = async () => {
    if (formData.email) {
      await testEmailVerification(formData.email)
    }
  }

  const handleCheckEmailStatus = async () => {
    if (formData.email) {
      const status = await checkEmailStatus(formData.email)
      setEmailStatus(status)
      console.log('Email status:', status)
    }
  }

  const handleDebugProfileCreation = async () => {
    try {
      console.log('=== DEBUGGING PROFILE CREATION ===')
      
      // Test API route
      const testResponse = await fetch('/api/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 'test-user-id-' + Date.now(),
          email: 'test@example.com',
          full_name: 'Test User',
          phone_number: '1234567890',
        }),
      })
      
      console.log('Test profile creation response:', testResponse.status)
      const testData = await testResponse.json()
      console.log('Test profile creation data:', testData)
      
      toast.success('Debug test completed. Check console for results.')
    } catch (error) {
      console.error('Debug test error:', error)
      toast.error('Debug test failed. Check console for details.')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center text-[#0B5588]">
          {activeTab === 'login' ? 'Welcome Back!' : 'Create Account'}
        </CardTitle>
        <CardDescription className="text-center">
          {activeTab === 'login' 
            ? 'Sign in to access your choice filling dashboard'
            : 'Create your account to get started with choice filling'}
        </CardDescription>
        {activeTab === 'login' && (
          <div className="text-center text-sm text-muted-foreground mt-2">
            Don't have an account? <button 
              type="button" 
              onClick={() => setActiveTab('signup')}
              className="text-[#0B5588] hover:underline font-medium"
            >
              Sign up here
            </button>
          </div>
        )}
        {activeTab === 'signup' && (
          <div className="text-center text-sm text-muted-foreground mt-2">
            Already have an account? <button 
              type="button" 
              onClick={() => setActiveTab('login')}
              className="text-[#0B5588] hover:underline font-medium"
            >
              Sign in here
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            {/* Google Sign In Button for Login */}
            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2 border-2 hover:bg-gray-50"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? 'Signing in...' : 'Sign in with Google (Existing Users)'}
              </Button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  Or sign in with email
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signup">
            {/* Google Sign Up Button for Signup */}
            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2 border-2 hover:bg-gray-50"
                onClick={handleGoogleSignUp}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? 'Creating account...' : 'Sign up with Google (New Users)'}
              </Button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  Or create account with email
                </span>
              </div>
            </div>
          </TabsContent>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'signup' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                    required
                    pattern="[0-9]{10}"
                    title="Please enter a valid 10-digit phone number"
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading 
                ? 'Please wait...' 
                : activeTab === 'login' 
                  ? 'Sign In' 
                  : 'Create Account'
              }
            </Button>
          </form>
          
          {activeTab === 'login' && showResendButton && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="mt-2 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="text-blue-800 border-blue-300 hover:bg-blue-100"
                >
                  {loading ? 'Sending...' : 'Resend Verification Email'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestEmail}
                  disabled={loading}
                  className="text-blue-800 border-blue-300 hover:bg-blue-100 ml-2"
                >
                  {loading ? 'Testing...' : 'Test Email'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCheckEmailStatus}
                  disabled={loading}
                  className="text-blue-800 border-blue-300 hover:bg-blue-100 ml-2"
                >
                  {loading ? 'Checking...' : 'Check Email Status'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDebugProfileCreation}
                  disabled={loading}
                  className="text-blue-800 border-blue-300 hover:bg-blue-100 ml-2"
                >
                  {loading ? 'Testing...' : 'Debug Profile Creation'}
                </Button>
              </div>
              {emailStatus && (
                <div className="mt-2 p-2 bg-white border rounded">
                  <p className="text-xs">
                    <strong>Email Status:</strong> {emailStatus.confirmed ? 'Confirmed' : 'Not Confirmed'}
                    {emailStatus.confirmedAt && ` (${new Date(emailStatus.confirmedAt).toLocaleString()})`}
                    {emailStatus.error && ` - Error: ${emailStatus.error}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-gray-500">
          {activeTab === 'login' 
            ? "Don't have an account? " 
            : "Already have an account? "}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'login' ? 'signup' : 'login')}
            className="text-[#0B5588] hover:underline"
          >
            {activeTab === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </CardFooter>
    </Card>
  )
} 