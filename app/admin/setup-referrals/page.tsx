'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupReferrals() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const setupReferralsSheet = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/setup-referrals-sheet', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message
        })
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to setup referrals sheet'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Network error occurred'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Setup Referrals System</CardTitle>
          <CardDescription>
            Initialize the referrals tracking system in Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={setupReferralsSheet}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Setting up...' : 'Setup Referrals Sheet'}
          </Button>

          {message && (
            <div className={`mt-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-red-100 text-red-700 border border-red-300'
            }`}>
              {message.text}
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <h4 className="font-semibold mb-2">What this does:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Creates a REFERRALS sheet in Google Sheets</li>
              <li>Sets up headers for tracking referrals</li>
              <li>Enables the referral bonus system</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 