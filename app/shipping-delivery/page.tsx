'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Mail, Clock, CheckCircle, Smartphone, Monitor } from "lucide-react"

export default function ShippingDelivery() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-[#0B5588]">Shipping & Delivery</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              How our educational services are delivered to you
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-[#0B5588]">Service Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-gray-700 dark:text-gray-300">
              <div className="space-y-6">
                {/* Digital Services Overview */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <Monitor className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        Digital Service Platform
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300">
                        ChooseYourCollege.com is primarily a digital platform providing educational services. All our services are delivered electronically through our website and mobile applications.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Instant Access */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Instant Digital Delivery</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                      <div>
                        <p className="font-medium">Immediate Access</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          All services are available instantly upon successful payment
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Smartphone className="h-6 w-6 text-[#0B5588] mt-1" />
                      <div>
                        <p className="font-medium">Multi-Device Access</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Access from desktop, tablet, or mobile devices
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Download className="h-6 w-6 text-[#0B5588] mt-1" />
                      <div>
                        <p className="font-medium">Downloadable Reports</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          PDF reports available for download and offline access
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Mail className="h-6 w-6 text-[#0B5588] mt-1" />
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Service confirmations sent to your registered email
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Service Types */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Service Delivery Details</h2>
                  <div className="space-y-4">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-2">Choice Filling Services</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>AI-powered choice filling recommendations</li>
                        <li>Instant access to personalized college lists</li>
                        <li>Downloadable PDF reports with detailed analysis</li>
                        <li>Real-time updates and modifications</li>
                      </ul>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-2">College Comparison Tools</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Interactive comparison charts and tables</li>
                        <li>Side-by-side college analysis</li>
                        <li>Exportable comparison reports</li>
                        <li>Mobile-responsive interface</li>
                      </ul>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-2">Cutoff Prediction Services</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Real-time cutoff predictions</li>
                        <li>Historical data analysis</li>
                        <li>Trend analysis reports</li>
                        <li>Personalized prediction alerts</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Delivery Timeline */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Delivery Timeline</h2>
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                    <div className="flex items-center space-x-3 mb-4">
                      <Clock className="h-6 w-6 text-[#0B5588]" />
                      <h3 className="font-semibold text-lg">Service Delivery Schedule</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span><strong>Instant:</strong> Basic platform access and tools</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span><strong>Within 5 minutes:</strong> AI-generated choice filling results</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span><strong>Within 10 minutes:</strong> Detailed PDF reports and analysis</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span><strong>24 hours:</strong> Email confirmations and follow-up support</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* No Physical Shipping */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">No Physical Shipping</h2>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          Important Notice
                        </h3>
                        <p className="text-yellow-700 dark:text-yellow-300">
                          Our platform does not ship physical products. All services are delivered digitally through our website and mobile applications. No shipping charges or delivery delays apply.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Requirements */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Technical Requirements</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold">Device Requirements</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Desktop, laptop, tablet, or smartphone</li>
                        <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
                        <li>Stable internet connection</li>
                        <li>JavaScript enabled</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold">Account Access</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Valid email address for registration</li>
                        <li>Secure password for account protection</li>
                        <li>Email verification completed</li>
                        <li>Payment confirmation received</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Support */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Need Help?</h2>
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                    <p className="mb-4">
                      If you experience any issues accessing our services or have questions about delivery:
                    </p>
                    <div className="space-y-2">
                      <p><strong>Email Support:</strong> gautam@chooseyourcollege.com</p>
                      <p><strong>Response Time:</strong> Within 24-48 hours during business days</p>
                      <p><strong>Platform Status:</strong> Check our website for any service updates</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    All digital services are subject to our Terms and Conditions and Privacy Policy.
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