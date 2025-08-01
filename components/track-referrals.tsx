'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Trophy, Clock, CheckCircle, XCircle, Share2 } from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'

interface Referral {
  id: string
  referred_email: string
  referred_phone: string | null
  status: 'pending' | 'signed_in' | 'completed' | 'expired'
  created_at: string
  completed_at: string | null
}

interface ReferralStats {
  total: number
  pending: number
  signed_in: number
  completed: number
  expired: number
  availableTrials: number
  currentPlan: string
  maxChoices: number
  trialsEarned: number
}

export function TrackReferrals() {
  const { user } = useAuth()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [referralCode, setReferralCode] = useState<string>('')

  const fetchReferrals = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const response = await fetch('/api/get-user-referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await response.json()
      if (data.success) {
        setReferrals(data.referrals)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching referrals:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReferralCode = async () => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/get-user-referral-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.referralCode) {
          setReferralCode(data.referralCode)
        }
      }
    } catch (error) {
      console.error('Error fetching referral code:', error)
    }
  }

  useEffect(() => {
    if (open) {
      fetchReferrals()
      fetchReferralCode()
    }
  }, [open, user?.id])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'signed_in':
        return <Users className="h-4 w-4 text-blue-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case 'signed_in':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Signed In</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const shareReferralLink = async () => {
    // Use the stored referral code if available, otherwise fetch it
    let codeToUse = referralCode
    
    if (!codeToUse) {
      try {
        const response = await fetch('/api/get-user-referral-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user?.id }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.referralCode) {
            codeToUse = data.referralCode
            setReferralCode(data.referralCode) // Store it for future use
          }
        }
      } catch (error) {
        console.error('Error fetching referral code:', error)
      }
    }

    // Fallback if we still don't have a referral code
    if (!codeToUse) {
      codeToUse = user?.id?.slice(0, 8).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase() || 'REF' + Math.random().toString(36).substr(2, 10).toUpperCase()
    }

    const referralLink = `${window.location.origin}/choice-filling?ref=${codeToUse}`
    
    if (navigator.share) {
      navigator.share({
        title: 'Join ChooseYourCollege Choice Filling',
        text: 'Get AI-assisted choice filling recommendations! Use my referral link:',
        url: referralLink
      })
    } else {
      navigator.clipboard.writeText(referralLink).then(() => {
        alert('Referral link copied to clipboard!')
      })
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2" data-track-referrals>
          <Users className="h-4 w-4" />
          Track Referrals
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Your Referral Dashboard
          </DialogTitle>
          <DialogDescription>
            Track your referrals and earn free choice filling trials
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B5588]"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Referrals</p>
                        <p className="text-2xl font-bold text-[#0B5588]">{stats.total}</p>
                      </div>
                      <Users className="h-8 w-8 text-[#0B5588]" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Available Trials</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {stats.availableTrials >= 999 ? 'Unlimited' : stats.availableTrials}
                        </p>
                      </div>
                      <Trophy className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Current Plan</p>
                        <p className="text-lg font-semibold text-[#0B5588]">{stats.currentPlan}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Referral Progress */}
            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Referral Progress</CardTitle>
                  <CardDescription>
                    Complete referrals to unlock more choice filling trials
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">3 Referrals (75 choices)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                          {stats.completed >= 3 ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-500">{stats.completed}/3</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">5 Referrals (200 choices)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                          {stats.completed >= 5 ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-500">{stats.completed}/5</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Important Note */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm text-yellow-800 font-medium mb-1">Important Note:</p>
                  <p className="text-xs text-yellow-700">
                    Referrals will only be counted after your friends complete the choice filling feature. 
                    You can track your referral progress anytime using the button above.
                  </p>
                </div>
              </div>
            </div>

            {/* Referrals Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Referrals</CardTitle>
                    <CardDescription>
                      Track the status of users you've referred
                    </CardDescription>
                  </div>
                  <Button onClick={() => shareReferralLink()} size="sm" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Share Link
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No referrals yet</p>
                    <p className="text-sm">Share your referral link to start earning trials</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Referred On</TableHead>
                        <TableHead>Completed On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((referral) => (
                        <TableRow key={referral.id}>
                          <TableCell className="font-medium">{referral.referred_email}</TableCell>
                          <TableCell>{referral.referred_phone || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(referral.status)}
                              {getStatusBadge(referral.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(referral.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {referral.completed_at 
                              ? new Date(referral.completed_at).toLocaleDateString()
                              : 'Not completed'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 