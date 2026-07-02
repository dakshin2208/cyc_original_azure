'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CancellationAndRefund() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-[#0B5588]">Cancellation and Refund</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Our policy regarding cancellations and refunds
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-[#0B5588]">Cancellation and Refund Policy</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </CardHeader>
            <CardContent className="space-y-6 text-gray-700 dark:text-gray-300">
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                        Important Notice
                      </h3>
                      <p className="text-red-700 dark:text-red-300">
                        Payments made for the Services offered on this Platform are non-refundable. Once a transaction is processed, no refund requests will be entertained under any circumstances.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Policy Details</h2>
                  <div className="space-y-3">
                    <p>
                      At Happi Global Ventures LLP, we strive to provide the best possible service to our users. However, due to the nature of our digital services and the immediate access provided upon payment, we maintain a strict no-refund policy.
                    </p>
                    
                    <p>
                      This policy applies to all services offered on our platform, including but not limited to:
                    </p>
                    
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Choice filling services</li>
                      <li>College comparison tools</li>
                      <li>Cutoff prediction services</li>
                      <li>Any other premium features or services</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Cancellation Policy</h2>
                  <p>
                    Due to the immediate digital delivery of our services, cancellations are not possible once a payment has been processed. All services are delivered instantly upon successful payment completion.
                  </p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Before Making a Payment</h2>
                  <p>
                    We encourage all users to carefully review our service descriptions, terms and conditions, and this cancellation and refund policy before making any payment. By proceeding with a payment, you acknowledge that you have read and understood this policy.
                  </p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Contact Information</h2>
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                    <p className="mb-4">
                      If you have any questions about this cancellation and refund policy or need clarification about our services before making a payment, please contact us:
                    </p>
                    <div className="space-y-2">
                      <p><strong>Company:</strong> Happi Global Ventures LLP</p>
                      <p><strong>Address:</strong> Innov8 Mantri Commercio MIS Deeta, Cnst, No 51 Bellandur, South Karnataka 560103, Bangalore</p>
                      <p><strong>Website:</strong> https://chooseyourcollege.com/</p>
                      <p><strong>Email:</strong> gautam@chooseyourcollege.com</p>
                      <p><strong>Phone:</strong> +91 98800 12482</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This cancellation and refund policy is part of our Terms and Conditions. By using our services, you agree to be bound by this policy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
} 