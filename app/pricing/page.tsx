'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Users, IndianRupee } from "lucide-react"
import { useRouter } from "next/navigation"
import { PaymentButton } from "@/components/PaymentButton"
import { toast } from "sonner"
import { useAuth } from "@/app/contexts/AuthContext"

export default function Pricing() {
  const router = useRouter()
  const { user } = useAuth()

  const handleGetStarted = () => {
    router.push('/choice-filling')
  }

  const handlePaymentSuccess = (paymentId: string) => {
    toast.success(`Payment successful! Your plan has been upgraded. Payment ID: ${paymentId}`)
    // Redirect to choice filling page after successful payment
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
      return false // Prevent payment from proceeding
    }
    return true // Allow payment to proceed
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Choice Filling Plans</h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600">Choose your plan for AI-assisted college choice filling</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Freemium Plan */}
            <Card className="shadow-lg border-gray-200">
              <CardHeader className="text-center p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl font-bold text-gray-700">Freemium</CardTitle>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">Free</p>
                <p className="text-sm sm:text-base text-gray-600">Forever</p>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">upto 20 Choices</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">AI Recommendations</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">Traditional Method</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">1 Free Trial</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base text-gray-500">No Aspirational Choices</span>
                  </div>
                </div>
                
                <Button 
                  onClick={handleGetStarted}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 sm:py-3 text-sm sm:text-base"
                >
                  Get Started Free
                </Button>
              </CardContent>
            </Card>

            {/* Secure Plan - 75 Choices */}
            <Card className="shadow-lg border-green-200 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-green-600 text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <CardHeader className="text-center p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl font-bold text-green-700">Secure</CardTitle>
                <p className="text-2xl sm:text-3xl font-bold text-green-900">upto 75 Choices</p>
                <p className="text-sm sm:text-base text-gray-600">Choose your path</p>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">upto 75 Choices</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">AI Recommendations</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">Traditional Method</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">3 Trials</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">5 Aspirational Choices</span>
                  </div>
                </div>

                {/* Referral Option */}
                <div className="border-t border-green-200 pt-3 sm:pt-4">
                  <div className="text-center mb-3">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">Earn Free Access</div>
                    <div className="text-base sm:text-lg font-bold text-green-700">3 Referrals</div>
                    <div className="text-xs text-gray-600 mb-3">Complete choice filling</div>
                    <Button 
                      onClick={handleReferralOption}
                      className="w-full mb-3 bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Refer 3 & Get Free
                    </Button>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-bold text-gray-700 mb-3">OR</p>
                  </div>
                  
                  {/* Payment Option */}
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">Premium Access</div>
                    <div className="text-xl sm:text-2xl font-bold text-green-700">₹299</div>
                    <div className="text-xs text-gray-600 mb-3">Unlimited access for 30 days</div>
                    <PaymentButton
                      amount={299}
                      planName="Secure"
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base"
                      userId={user?.id}
                      userEmail={user?.email}
                      onClick={handlePaymentClick}
                    >
                      <IndianRupee className="h-4 w-4 mr-2" />
                      Buy Now
                    </PaymentButton>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assured+ Plan - 200 Choices */}
            <Card className="shadow-lg border-blue-200">
              <CardHeader className="text-center p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl font-bold text-blue-700">Assured+</CardTitle>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900">upto 200 Choices</p>
                <p className="text-sm sm:text-base text-gray-600">Maximum options</p>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">upto 200 Choices</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">AI Recommendations</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">Traditional Method</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">10 Trials</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2 sm:mr-3" />
                    <span className="text-sm sm:text-base">5 Aspirational Choices</span>
                  </div>
                </div>

                {/* Referral Option */}
                <div className="border-t border-blue-200 pt-3 sm:pt-4">
                  <div className="text-center mb-3">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">Earn Free Access</div>
                    <div className="text-base sm:text-lg font-bold text-blue-700">5 Referrals</div>
                    <div className="text-xs text-gray-600 mb-3">Complete choice filling</div>
                    <Button 
                      onClick={handleReferralOption}
                      className="w-full mb-3 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Refer 5 & Get Free
                    </Button>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-bold text-gray-700 mb-3">OR</p>
                  </div>
                  
                  {/* Payment Option */}
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-600 mb-1">Premium Access</div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-700">₹399</div>
                    <div className="text-xs text-gray-600 mb-3">Unlimited access for 30 days</div>
                    <PaymentButton
                      amount={399}
                      planName="Assured+"
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base"
                      userId={user?.id}
                      userEmail={user?.email}
                      onClick={handlePaymentClick}
                    >
                      <IndianRupee className="h-4 w-4 mr-2" />
                      Buy Now
                    </PaymentButton>
                  </div>
                </div>
              </CardContent>
            </Card>
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