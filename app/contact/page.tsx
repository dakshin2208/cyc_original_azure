'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Phone, MapPin, Building } from "lucide-react"

export default function Contact() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-[#0B5588]">Contact Us</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Get in touch with us for any queries or support
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-[#0B5588]">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-gray-700 dark:text-gray-300">
              <div className="space-y-6">
                {/* Email Contact */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        Email Support
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300 mb-3">
                        For any queries contact us to this e-mail address:
                      </p>
                      <a 
                        href="mailto:gautam@chooseyourcollege.com"
                        className="text-lg font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors duration-200 break-all"
                      >
                        gautam@chooseyourcollege.com
                      </a>
                    </div>
                  </div>
                </div>

                {/* Phone Contact */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <Phone className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                        Phone Support
                      </h3>
                      <p className="text-green-700 dark:text-green-300 mb-3">
                        Call us directly for immediate assistance:
                      </p>
                      <a 
                        href="tel:+919880012482"
                        className="text-lg font-medium text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors duration-200"
                      >
                        +91 98800 12482
                      </a>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                        Available: Monday - Friday (9:00 AM - 6:00 PM IST)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Company Information */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Company Details</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-start space-x-3">
                      <Building className="h-6 w-6 text-[#0B5588] mt-1" />
                      <div>
                        <p className="font-medium">Company</p>
                        <p>Happi Global Ventures LLP</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-6 w-6 text-[#0B5588] mt-1" />
                      <div>
                        <p className="font-medium">Address</p>
                        <p>Innov8 Mantri Commercio MIS Deeta</p>
                        <p>Cnst, No 51 Bellandur</p>
                        <p>South Karnataka 560103, Bangalore</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Response Time */}
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">Response Time</h3>
                  <div className="space-y-2">
                    <p className="text-gray-600 dark:text-gray-400">
                      <strong>Phone:</strong> Immediate assistance during business hours
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      <strong>Email:</strong> We typically respond to all email inquiries within 24-48 hours during business days (Monday to Friday).
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Thank you for choosing ChooseYourCollege.com. We're here to help!
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