'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, User } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login")
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [showResendButton, setShowResendButton] = useState(false)
  const { signIn, signUp, resendVerificationEmail } = useAuth()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setShowResendButton(false)

    console.log('Login form submitted with:', { email })

    try {
      console.log('Calling login function...')
      await signIn(email, password)
      console.log('Login function completed successfully')
      
      // After successful login, redirect to choice filling page
      router.push('/choice-filling')
    } catch (error) {
      console.error('Login error in form:', error)
      if (error instanceof Error) {
        console.log('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        })
        
        if (error.message.includes('rate limit')) {
          const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '30')
          setRetryAfter(waitTime)
          const timer = setInterval(() => {
            setRetryAfter(prev => {
              if (prev === null || prev <= 1) {
                clearInterval(timer)
                return null
              }
              return prev - 1
            })
          }, 1000)
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          console.log('Email not confirmed, showing resend button')
          setShowResendButton(true)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      await resendVerificationEmail(email)
      setShowResendButton(false)
    } catch (error) {
      console.error('Resend verification error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    // Validate inputs
    if (!email || !password || !username) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive"
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    try {
      console.log('Starting signup process...')
      await signUp(email, password, username, '0000000000') // Using username as fullName and placeholder phone
      console.log('Signup completed successfully')
      
      // Show resend verification button
      setShowResendButton(true)
      
      // Switch to login tab but keep the email
      setActiveTab("login")
      setPassword('') // Clear password but keep email
      
      toast({
        title: "Success",
        description: "Account created! Please check your email for verification.",
      })
    } catch (error) {
      console.error('Signup error:', error)
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '30')
          setRetryAfter(waitTime)
          const timer = setInterval(() => {
            setRetryAfter(prev => {
              if (prev === null || prev <= 1) {
                clearInterval(timer)
                return null
              }
              return prev - 1
            })
          }, 1000)
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Welcome</CardTitle>
        <CardDescription className="text-center">
          {activeTab === "login" ? "Sign in to your account" : "Create a new account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value as "login" | "signup")
          setRetryAfter(null)
          setShowResendButton(false)
          // Clear form when switching tabs
          setEmail('')
          setPassword('')
          setUsername('')
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Login
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sign Up
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || retryAfter !== null}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || retryAfter !== null}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || retryAfter !== null}
              >
                {retryAfter !== null 
                  ? `Please wait ${retryAfter}s...` 
                  : isLoading 
                    ? "Logging in..." 
                    : "Login"}
              </Button>
              {showResendButton && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendVerification}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Resend Verification Email"}
                </Button>
              )}
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading || retryAfter !== null}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || retryAfter !== null}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || retryAfter !== null}
                  minLength={6}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || retryAfter !== null}
              >
                {retryAfter !== null 
                  ? `Please wait ${retryAfter}s...` 
                  : isLoading 
                    ? "Creating account..." 
                    : "Sign Up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
} 