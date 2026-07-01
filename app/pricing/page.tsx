'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X, Users, IndianRupee } from "lucide-react"
import { useRouter } from "next/navigation"
import { PaymentButton } from "@/components/PaymentButton"
import { toast } from "sonner"
import { useAuth } from "@/app/contexts/AuthContext"

type Feature = { ok: boolean; text: string }

type Plan = {
  name: string
  headline: string
  subtitle: string
  features: Feature[]
  popular?: boolean
  accent: {
    border: string
    title: string
    headline: string
    check: string
    button: string
    badge: string
  }
  // Paid plans only:
  price?: number
  planName?: 'Secure' | 'Annual' | 'Annual+'
  referrals?: number
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    headline: 'Free',
    subtitle: 'Forever',
    accent: {
      border: 'border-gray-200',
      title: 'text-gray-700',
      headline: 'text-gray-900',
      check: 'text-gray-600',
      button: 'bg-gray-600 hover:bg-gray-700',
      badge: 'bg-gray-600',
    },
    features: [
      { ok: true, text: 'upto 10 Choices' },
      { ok: true, text: 'PowerScore' },
      { ok: true, text: 'Traditional Method' },
      { ok: false, text: 'AI Method' },
      { ok: true, text: 'AI Chat: 2 questions' },
      { ok: false, text: 'Aspirational Choices' },
      { ok: false, text: 'Referral Rewards' },
    ],
  },
  {
    name: 'Secure',
    headline: 'upto 75 Choices',
    subtitle: 'Choose your path',
    popular: true,
    price: 299,
    planName: 'Secure',
    referrals: 3,
    accent: {
      border: 'border-green-200',
      title: 'text-green-700',
      headline: 'text-green-900',
      check: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
      badge: 'bg-green-600',
    },
    features: [
      { ok: true, text: 'upto 75 Choices' },
      { ok: true, text: 'PowerScore' },
      { ok: true, text: 'Traditional Method' },
      { ok: false, text: 'AI Method' },
      { ok: true, text: 'AI Chat: 5 questions' },
      { ok: true, text: '5 Aspirational Choices' },
    ],
  },
  {
    name: 'Annual',
    headline: 'upto 200 Choices',
    subtitle: 'More room to plan',
    price: 399,
    planName: 'Annual',
    referrals: 5,
    accent: {
      border: 'border-blue-200',
      title: 'text-blue-700',
      headline: 'text-blue-900',
      check: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      badge: 'bg-blue-600',
    },
    features: [
      { ok: true, text: 'upto 200 Choices' },
      { ok: true, text: 'PowerScore' },
      { ok: true, text: 'Traditional Method' },
      { ok: false, text: 'AI Method' },
      { ok: true, text: 'AI Chat: 8 questions' },
      { ok: true, text: '15 Aspirational Choices' },
    ],
  },
  {
    name: 'Annual+',
    headline: 'upto 300+ Choices',
    subtitle: 'Everything, incl. AI',
    price: 499,
    planName: 'Annual+',
    referrals: 10,
    accent: {
      border: 'border-purple-300',
      title: 'text-purple-700',
      headline: 'text-purple-900',
      check: 'text-purple-600',
      button: 'bg-purple-600 hover:bg-purple-700',
      badge: 'bg-purple-600',
    },
    features: [
      { ok: true, text: 'upto 300+ Choices' },
      { ok: true, text: 'PowerScore' },
      { ok: true, text: 'Traditional Method' },
      { ok: true, text: 'AI Method' },
      { ok: true, text: 'AI Chat: 20 questions' },
      { ok: true, text: '50 Aspirational Choices' },
    ],
  },
]

export default function Pricing() {
  const router = useRouter()
  const { user } = useAuth()

  const handleGetStarted = () => {
    router.push('/choice-filling')
  }

  const handlePaymentSuccess = (paymentId: string) => {
    toast.success(`Payment successful! Your plan has been upgraded. Payment ID: ${paymentId}`)
    setTimeout(() => {
      router.push('/choice-filling')
    }, 2000)
  }

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`)
  }

  const handleReferralOption = () => {
    router.push('/choice-filling')
  }

  const handlePaymentClick = () => {
    if (!user) {
      toast.error('Please login first to make a payment')
      router.push('/login')
      return false
    }
    return true
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Choice Filling Plans</h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">Choose the plan that fits your college choice-filling needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 items-start">
            {PLANS.map((plan) => (
              <Card key={plan.name} className={`shadow-lg relative ${plan.accent.border}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className={`${plan.accent.badge} text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-semibold`}>
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center p-4 sm:p-6">
                  <CardTitle className={`text-xl sm:text-2xl font-bold ${plan.accent.title}`}>{plan.name}</CardTitle>
                  <p className={`text-2xl sm:text-3xl font-bold ${plan.accent.headline}`}>{plan.headline}</p>
                  <p className="text-sm sm:text-base text-gray-600">{plan.subtitle}</p>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  <div className="space-y-2 sm:space-y-3">
                    {plan.features.map((f) => (
                      <div key={f.text} className="flex items-center">
                        {f.ok ? (
                          <Check className={`h-4 w-4 sm:h-5 sm:w-5 ${plan.accent.check} mr-2 sm:mr-3 shrink-0`} />
                        ) : (
                          <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mr-2 sm:mr-3 shrink-0" />
                        )}
                        <span className={`text-sm sm:text-base ${f.ok ? '' : 'text-gray-500'}`}>
                          {f.ok ? f.text : `No ${f.text}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {plan.planName ? (
                    <div className={`border-t pt-3 sm:pt-4 ${plan.accent.border}`}>
                      <div className="text-center mb-3">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Earn Free Access</div>
                        <div className={`text-base sm:text-lg font-bold ${plan.accent.title}`}>{plan.referrals} Referrals</div>
                        <div className="text-xs text-gray-600 mb-3">Complete choice filling</div>
                        <Button
                          onClick={handleReferralOption}
                          className={`w-full mb-3 ${plan.accent.button} text-white text-sm sm:text-base`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Refer {plan.referrals} &amp; Get Free
                        </Button>
                      </div>

                      <div className="text-center">
                        <p className="text-xs sm:text-sm font-bold text-gray-700 mb-3">OR</p>
                      </div>

                      <div className="text-center">
                        <div className="text-xs sm:text-sm text-gray-600 mb-1">Premium Access</div>
                        <div className={`text-xl sm:text-2xl font-bold ${plan.accent.title}`}>₹{plan.price}</div>
                        <div className="text-xs text-gray-600 mb-3">Unlimited access for 30 days</div>
                        <PaymentButton
                          amount={plan.price!}
                          planName={plan.planName}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          className={`w-full ${plan.accent.button} text-white text-sm sm:text-base`}
                          userId={user?.id}
                          userEmail={user?.email}
                          onClick={handlePaymentClick}
                        >
                          <IndianRupee className="h-4 w-4 mr-2" />
                          Buy Now
                        </PaymentButton>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={handleGetStarted}
                      className={`w-full ${plan.accent.button} text-white font-semibold py-2 sm:py-3 text-sm sm:text-base`}
                    >
                      Get Started Free
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 sm:mt-12 text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-yellow-800 text-sm">
                <strong>Note:</strong> Referrals will only be counted after your friends complete the choice filling feature.
                You can track your referrals and payment status in the choice filling dashboard.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
