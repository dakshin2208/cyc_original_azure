'use client';

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, ArrowRight } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function PaymentSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [paymentDetails, setPaymentDetails] = useState({
    paymentId: '',
    orderId: '',
    amount: '',
    planName: ''
  })

  useEffect(() => {
    if (!searchParams) return;
    
    const paymentId = searchParams.get('payment_id')
    const orderId = searchParams.get('order_id')
    const amount = searchParams.get('amount')
    const planName = searchParams.get('plan')

    if (paymentId && orderId) {
      setPaymentDetails({
        paymentId,
        orderId,
        amount: amount || '',
        planName: planName || ''
      })
    }
  }, [searchParams])

  const handleContinue = () => {
    router.push('/choice-filling')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <CardTitle className="text-3xl font-bold text-green-600">
                Payment Successful!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                Thank you for your purchase. Your payment has been processed successfully.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-lg mb-4">Payment Details</h3>
                <div className="space-y-2 text-left">
                  {paymentDetails.paymentId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment ID:</span>
                      <span className="font-mono text-sm">{paymentDetails.paymentId}</span>
                    </div>
                  )}
                  {paymentDetails.orderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-mono text-sm">{paymentDetails.orderId}</span>
                    </div>
                  )}
                  {paymentDetails.planName && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-semibold">{paymentDetails.planName}</span>
                    </div>
                  )}
                  {paymentDetails.amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold">₹{paymentDetails.amount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600">
                  You can now access your purchased plan features. A confirmation email has been sent to your registered email address.
                </p>
                
                <Button 
                  onClick={handleContinue}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  Continue to Choice Filling
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
} 