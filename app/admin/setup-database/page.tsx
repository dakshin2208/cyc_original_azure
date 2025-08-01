'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react'

export default function SetupDatabase() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    message?: string
    error?: string
    profilesUpdated?: number
    setupInstructions?: any
    missingTables?: string[]
    needsReferralCodeColumn?: boolean
  } | null>(null)

  const setupDatabase = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/setup-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          profilesUpdated: data.profilesUpdated,
        })
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to setup database',
          setupInstructions: data.setupInstructions,
          missingTables: data.missingTables,
          needsReferralCodeColumn: data.needsReferralCodeColumn,
        })
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error occurred',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Database Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                This will check your database setup and provide instructions for creating the necessary tables.
              </p>
              
              <Button 
                onClick={setupDatabase} 
                disabled={isLoading}
                className="w-full max-w-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking database...
                  </>
                ) : (
                  'Check Database Setup'
                )}
              </Button>
            </div>

            {result && (
              <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
                  {result.success ? (
                    <div>
                      <p className="font-medium">{result.message}</p>
                      {result.profilesUpdated !== undefined && (
                        <p className="text-sm mt-1">
                          Updated {result.profilesUpdated} existing profiles with referral codes.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{result.error}</p>
                      {result.setupInstructions && (
                        <div className="mt-4">
                          <div className="bg-white dark:bg-gray-800 p-4 rounded border">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold">Setup Instructions:</h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(result.setupInstructions.instructions)}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy All
                              </Button>
                            </div>
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                              {result.setupInstructions.instructions}
                            </pre>
                          </div>
                          
                          {result.missingTables && result.missingTables.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Missing Tables:</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {result.missingTables.map((table, index) => (
                                  <li key={index} className="text-sm">{table}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.needsReferralCodeColumn && (
                            <div className="mt-4">
                              <h4 className="font-semibold mb-2">Missing Column:</h4>
                              <p className="text-sm">referral_code column in profiles table</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">What this will check:</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <li>• choice_filling_usage table (tracks user usage)</li>
                <li>• user_referrals table (tracks referral relationships)</li>
                <li>• choice_filling_logs table (logs user actions)</li>
                <li>• referral_code column in profiles table</li>
                <li>• All necessary indexes for performance</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 