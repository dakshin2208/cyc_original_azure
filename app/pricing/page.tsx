'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Check, X, Users, IndianRupee } from "lucide-react"
import { useRouter } from "next/navigation"
import { PaymentButton } from "@/components/PaymentButton"
import { toast } from "sonner"
import { useAuth } from "@/app/contexts/AuthContext"
import { cn } from "@/lib/utils"

type PlanCol = {
  key: string
  name: string
  price: string
  tagline: string
  badge?: string
  badgeBg?: string
  highlightRing?: string
  highlightCell?: string
  headerText: string
  headerBg: string
  // Paid plans only:
  amount?: number
  planName?: 'Secure' | 'Assured' | 'Assured+'
}

const PLANS: PlanCol[] = [
  {
    key: 'free',
    name: 'Free',
    price: 'Free',
    tagline: 'Forever',
    headerText: 'text-gray-700',
    headerBg: 'bg-gray-50',
  },
  {
    key: 'secure',
    name: 'Secure',
    price: '₹299',
    tagline: 'Choose your path',
    amount: 299,
    planName: 'Secure',
    headerText: 'text-green-700',
    headerBg: 'bg-green-50',
  },
  {
    key: 'assured',
    name: 'Assured',
    price: '₹399',
    tagline: 'More room to plan',
    amount: 399,
    planName: 'Assured',
    headerText: 'text-blue-700',
    headerBg: 'bg-blue-50',
  },
  {
    key: 'assuredPlus',
    name: 'Assured+',
    price: '₹699',
    tagline: 'Everything, incl. AI',
    badge: 'Safest Plan',
    badgeBg: 'bg-purple-600',
    highlightRing: 'ring-2 ring-purple-400 ring-inset',
    highlightCell: 'bg-purple-50/50',
    amount: 699,
    planName: 'Assured+',
    headerText: 'text-purple-700',
    headerBg: 'bg-purple-50',
  },
]

// Each feature row. Values align with the PLANS order [Free, Secure, Assured, Assured+].
// A boolean renders a tick / cross; a string renders as text.
const FEATURES: { label: string; values: (boolean | string)[] }[] = [
  { label: 'Choices', values: ['upto 10', 'upto 75', 'upto 200', 'upto 300+'] },
  { label: 'PowerScore', values: [true, true, true, true] },
  { label: 'Traditional Method', values: [true, true, true, true] },
  { label: 'AI Method', values: [false, false, false, true] },
  { label: 'AI Chat (questions)', values: ['2', '5', '8', '20'] },
  { label: 'Aspirational Choices', values: [false, '5', '15', '50'] },
  { label: 'Unlock via Referrals', values: ['—', '3 referrals', '5 referrals', '10 referrals'] },
]

export default function Pricing() {
  const router = useRouter()
  const { user } = useAuth()

  const handleGetStarted = () => router.push('/choice-filling')

  const handlePaymentSuccess = (paymentId: string) => {
    toast.success(`Payment successful! Your plan has been upgraded. Payment ID: ${paymentId}`)
    setTimeout(() => router.push('/choice-filling'), 2000)
  }

  const handlePaymentError = (error: string) => toast.error(`Payment failed: ${error}`)

  const handlePaymentClick = () => {
    if (!user) {
      toast.error('Please login first to make a payment')
      router.push('/login')
      return false
    }
    return true
  }

  const renderValue = (v: boolean | string) => {
    if (v === true) return <Check className="h-5 w-5 text-green-600 mx-auto" />
    if (v === false) return <X className="h-5 w-5 text-red-400 mx-auto" />
    return <span className="text-sm sm:text-base text-gray-800">{v}</span>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-6 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">Choice Filling Plans</h1>
            <p className="text-base sm:text-lg text-gray-600">Compare every plan at a glance and pick what fits you</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
            <table className="w-full min-w-[640px] border-collapse">
              {/* Plan headers */}
              <thead>
                <tr>
                  <th className="text-left p-4 align-bottom w-48 border-b border-gray-200">
                    <span className="text-sm font-semibold text-gray-500">Features</span>
                  </th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.key}
                      className={cn(
                        'p-4 text-center border-b border-gray-200 relative',
                        plan.headerBg,
                        plan.highlightRing,
                      )}
                    >
                      {plan.badge && (
                        <span
                          className={cn(
                            'absolute top-1 left-1/2 -translate-x-1/2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                            plan.badgeBg,
                          )}
                        >
                          {plan.badge}
                        </span>
                      )}
                      <div className={cn('text-lg font-bold mt-2', plan.headerText)}>{plan.name}</div>
                      <div className="text-2xl font-extrabold text-gray-900">{plan.price}</div>
                      <div className="text-xs text-gray-500">{plan.tagline}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Feature rows */}
              <tbody>
                {FEATURES.map((feature, ri) => (
                  <tr key={feature.label} className={ri % 2 === 1 ? 'bg-gray-50/60' : ''}>
                    <td className="p-3 sm:p-4 text-sm font-medium text-gray-700 border-b border-gray-100">
                      {feature.label}
                    </td>
                    {feature.values.map((v, ci) => (
                      <td
                        key={PLANS[ci].key}
                        className={cn(
                          'p-3 sm:p-4 text-center border-b border-gray-100',
                          PLANS[ci].highlightCell,
                        )}
                      >
                        {renderValue(v)}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Action row */}
                <tr>
                  <td className="p-3 sm:p-4" />
                  {PLANS.map((plan) => (
                    <td key={plan.key} className={cn('p-3 sm:p-4 align-top', plan.highlightCell)}>
                      {plan.planName ? (
                        <PaymentButton
                          amount={plan.amount!}
                          planName={plan.planName}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          className="w-full bg-[#0B5588] hover:bg-[#094670] text-white text-sm"
                          userId={user?.id}
                          userEmail={user?.email}
                          onClick={handlePaymentClick}
                        >
                          <IndianRupee className="h-4 w-4 mr-1" />
                          Buy {plan.price}
                        </PaymentButton>
                      ) : (
                        <Button
                          onClick={handleGetStarted}
                          variant="outline"
                          className="w-full text-sm"
                        >
                          Get Started
                        </Button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Referral note */}
          <div className="mt-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-3xl mx-auto">
            <Users className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm">
              Prefer not to pay? Unlock a plan for free by referring friends — <strong>3</strong> referrals for Secure,
              <strong> 5</strong> for Assured, <strong>10</strong> for Assured+. Referrals count once your friends
              complete choice filling. Track them in the choice-filling dashboard.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
