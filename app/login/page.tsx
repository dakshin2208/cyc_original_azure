'use client'

import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { AuthForm } from '../components/AuthForm'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push('/choice-filling')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B5588] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-[#0B5588]">Welcome to ChooseYourCollege</h1>
            <p className="text-lg text-gray-600">
              Sign in or create an account to get started with choice filling
            </p>
          </div>
          <AuthForm />
        </div>
      </main>
      <Footer />
    </div>
  )
} 