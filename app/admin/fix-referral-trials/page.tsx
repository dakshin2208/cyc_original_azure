'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../../contexts/AuthContext'

export default function FixReferralTrials() {
  const { user } = useAuth()
  const [isFixing, setIsFixing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDebugging, setIsDebugging] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [debugResult, setDebugResult] = useState<any>(null)
  const [testUserId, setTestUserId] = useState('')
  const [testEmail, setTestEmail] = useState('')

  const runFix = async () => {
    setIsFixing(true)
    setFixResult(null)
    
    try {
      const response = await fetch('/api/fix-referral-trials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setFixResult(data)
    } catch (error) {
      console.error('Error running fix:', error)
      setFixResult({ error: 'Failed to run fix' })
    } finally {
      setIsFixing(false)
    }
  }

  const runTest = async () => {
    if (!testUserId || !testEmail) {
      alert('Please enter both User ID and Email')
      return
    }

    setIsTesting(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/test-referral-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: testUserId,
          email: testEmail
        }),
      })

      const data = await response.json()
      setTestResult(data)
    } catch (error) {
      console.error('Error running test:', error)
      setTestResult({ error: 'Failed to run test' })
    } finally {
      setIsTesting(false)
    }
  }

  const testCurrentUser = async () => {
    if (!user?.id || !user?.email) {
      alert('No user logged in')
      return
    }

    setTestUserId(user.id)
    setTestEmail(user.email)
    await runTest()
  }

  const runDebug = async () => {
    if (!testUserId || !testEmail) {
      alert('Please enter both User ID and Email')
      return
    }

    setIsDebugging(true)
    setDebugResult(null)
    
    try {
      const response = await fetch('/api/debug-user-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: testUserId,
          email: testEmail
        }),
      })

      const data = await response.json()
      setDebugResult(data)
    } catch (error) {
      console.error('Error running debug:', error)
      setDebugResult({ error: 'Failed to run debug' })
    } finally {
      setIsDebugging(false)
    }
  }

  const debugCurrentUser = async () => {
    if (!user?.id || !user?.email) {
      alert('No user logged in')
      return
    }

    setTestUserId(user.id)
    setTestEmail(user.email)
    await runDebug()
  }

  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Fix Referral Trials</h1>
        <p>Please log in to access this page.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Fix Referral Trials & Usage Count</h1>
      
      <div className="grid gap-6 md:grid-cols-3">
        {/* Fix Section */}
        <Card>
          <CardHeader>
            <CardTitle>Fix Database Issues</CardTitle>
            <CardDescription>
              Run the fix script to correct referral trial counting and usage count issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runFix} 
              disabled={isFixing}
              className="w-full"
            >
              {isFixing ? 'Fixing...' : 'Run Fix Script'}
            </Button>
            
            {fixResult && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Fix Result:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(fixResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Section */}
        <Card>
          <CardHeader>
            <CardTitle>Test User Tracking</CardTitle>
            <CardDescription>
              Test referral tracking for a specific user
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="testUserId">User ID</Label>
                <Input
                  id="testUserId"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="Enter user ID"
                />
              </div>
              
              <div>
                <Label htmlFor="testEmail">Email</Label>
                <Input
                  id="testEmail"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter email"
                />
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={runTest} 
                  disabled={isTesting || !testUserId || !testEmail}
                  className="w-full"
                >
                  {isTesting ? 'Testing...' : 'Test User'}
                </Button>
                
                <Button 
                  onClick={testCurrentUser} 
                  disabled={isTesting || !user?.id}
                  variant="outline"
                  className="w-full"
                >
                  Test Current User
                </Button>
              </div>
            </div>
            
            {testResult && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Test Result:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug Section */}
        <Card>
          <CardHeader>
            <CardTitle>Debug User Usage</CardTitle>
            <CardDescription>
              Detailed analysis of user's usage logs and trial counting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                onClick={runDebug} 
                disabled={isDebugging || !testUserId || !testEmail}
                className="w-full"
              >
                {isDebugging ? 'Debugging...' : 'Debug User'}
              </Button>
              
              <Button 
                onClick={debugCurrentUser} 
                disabled={isDebugging || !user?.id}
                variant="outline"
                className="w-full"
              >
                Debug Current User
              </Button>
            </div>
            
            {debugResult && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Debug Result:</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(debugResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1. Run Fix Script:</strong> This will correct all referral trial counting issues in the database.</p>
            <p><strong>2. Test User:</strong> Enter a user ID and email to test their referral tracking status.</p>
            <p><strong>3. Test Current User:</strong> Test the currently logged-in user's referral tracking.</p>
            <p><strong>Issues Fixed:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Referral trials used exceeding maximum (3 for referral_75, 5 for referral_200)</li>
              <li>Usage count not being properly incremented when trials are exhausted</li>
              <li>Incorrect trial counting when multiple API calls are made</li>
              <li>Mismatch between actual usage logs and recorded usage data</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 