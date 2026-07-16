'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { MapPin, Users, Vote, ArrowRight, CheckCircle2 } from 'lucide-react'

const VOTE_STATES = [
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Maharashtra',
  'Kerala',
] as const

export default function VotePage() {
  const [state, setState] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [friendsCount, setFriendsCount] = useState('1')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!state || !name.trim() || !email.trim()) {
      toast.error('Please fill in your state, name, and email.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/submit-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          name,
          email,
          phone,
          message,
          friendsCount,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit vote')
      }

      setSubmitted(true)
      toast.success('Your vote has been recorded. Thank you!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://chooseyourcollege.com/vote'

  const handleShare = async () => {
    const text =
      'Vote for ChooseYourCollege to launch in our state! The more votes from your state, the faster we move up the queue.'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vote for ChooseYourCollege', text, url: shareUrl })
      } catch {
        // user cancelled
      }
      return
    }
    await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
    toast.success('Link copied! Share it with friends and relatives.')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#005596]/10 mb-4">
              <Vote className="h-7 w-7 text-[#005596]" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-[#005596]">Vote for Your State</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Help us bring AI-assisted college choice filling to your state. Every vote moves your
              state higher on our launch queue.
            </p>
          </div>

          <Card className="mb-6 border-[#005596]/20 bg-blue-50/50">
            <CardContent className="pt-6">
              <p className="text-gray-700 leading-relaxed">
                <strong className="text-[#005596]">In Tamil Nadu?</strong> ChooseYourCollege is
                already live —{' '}
                <Link href="/choice-filling" className="text-[#005596] font-medium hover:underline">
                  start choice filling now
                </Link>
                .
              </p>
              <p className="text-gray-700 leading-relaxed mt-3">
                <strong>In Karnataka, Andhra Pradesh, Telangana, Maharashtra, or Kerala?</strong>{' '}
                Vote below and tell us you need it. Bring your friends. Bring your relatives. The
                more votes from your state, the faster your state moves up the queue.
              </p>
            </CardContent>
          </Card>

          {submitted ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-[#005596] mb-2">Thank you for voting!</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Your vote for <strong>{state}</strong> has been recorded. Share this page with
                  friends and family to help your state move up faster.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={handleShare} className="bg-[#005596] hover:bg-[#094670]">
                    <Users className="h-4 w-4 mr-2" />
                    Share with friends & relatives
                  </Button>
                  <Button variant="outline" onClick={() => setSubmitted(false)}>
                    Submit another vote
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#005596]">Cast your vote</CardTitle>
                <CardDescription>
                  Tell us your state and how we can reach you. One vote per person helps us plan
                  where to launch next.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="state">Your state *</Label>
                    <Select value={state} onValueChange={setState} required>
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent>
                        {VOTE_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone (optional)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit mobile"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="friendsCount">People you&apos;ll bring along</Label>
                      <Input
                        id="friendsCount"
                        type="number"
                        min={1}
                        max={999}
                        value={friendsCount}
                        onChange={(e) => setFriendsCount(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Friends, relatives, classmates — estimate is fine
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message (optional)</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us you need ChooseYourCollege in your state…"
                      rows={3}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#005596] hover:bg-[#094670]"
                    disabled={loading}
                  >
                    {loading ? 'Submitting…' : 'Submit my vote'}
                    {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center text-sm text-gray-600">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50">
              <MapPin className="h-5 w-5 text-[#005596]" />
              <span>State-level votes decide launch priority</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50">
              <Users className="h-5 w-5 text-[#005596]" />
              <span>More votes = faster rollout in your state</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50">
              <Vote className="h-5 w-5 text-[#005596]" />
              <span>Takes less than a minute</span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
