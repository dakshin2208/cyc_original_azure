'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-[#0B5588]">Privacy Policy</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              How we collect, use, and protect your personal information
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-[#0B5588]">Privacy Policy</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: December 21, 2024
              </p>
            </CardHeader>
            <CardContent className="space-y-6 text-gray-700 dark:text-gray-300">
              <div className="space-y-4">
                <p>
                  This Privacy Policy describes how EMMESS TECHNOLOGIES PRIVATE LIMITED and its affiliates (collectively "EMMESS TECHNOLOGIES PRIVATE LIMITED, we, our, us") collect, use, share, protect or otherwise process your information/personal data through our website https://chooseyourcollege.com/ (hereinafter referred to as Platform).
                </p>

                <p>
                  Please note that you may be able to browse certain sections of the Platform without registering with us. We do not offer any product/service under this Platform outside India and your personal data will primarily be stored and processed in India.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Collection</h2>
                <p>
                  We collect your personal data when you use our Platform, services or otherwise interact with us during the course of our relationship. Some of the information that we may collect includes but is not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Personal data provided during sign-up/registration (name, date of birth, address)</li>
                  <li>Contact information (telephone/mobile number, email ID)</li>
                  <li>Identity and address proof documents</li>
                  <li>Payment information (with consent)</li>
                  <li>Biometric information (when opted for specific features)</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Usage</h2>
                <p>We use personal data to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide the services you request</li>
                  <li>Assist sellers and business partners in handling orders</li>
                  <li>Enhance customer experience</li>
                  <li>Resolve disputes and troubleshoot problems</li>
                  <li>Inform you about offers, products, services, and updates</li>
                  <li>Detect and protect against fraud</li>
                  <li>Conduct marketing research and analysis</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Sharing</h2>
                <p>We may share your personal data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Internally within our group entities</li>
                  <li>With sellers and business partners</li>
                  <li>With third-party service providers</li>
                  <li>With government agencies when required by law</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Security Precautions</h2>
                <p>
                  To protect your personal data from unauthorised access or disclosure, loss or misuse we adopt reasonable security practices and procedures. Users are responsible for ensuring the protection of login and password records for their account.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Data Deletion and Retention</h2>
                <p>
                  You have an option to delete your account by visiting your profile and settings on our Platform. We retain your personal data information for a period no longer than is required for the purpose for which it was collected or as required under any applicable law.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#0B5588] mt-8 mb-4">Contact Us</h2>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                  <h3 className="font-semibold text-lg mb-4">Grievance Officer</h3>
                  <div className="space-y-2">
                    <p><strong>Phone:</strong> Monday - Friday (9:00 - 18:00)</p>
                    <div>
                      <p className="font-medium mb-2">Address:</p>
                      <p>EMMESS TECHNOLOGIES PRIVATE LIMITED</p>
                      <p>Prestige sunrise park</p>
                      <p>Bengaluru Electronics City Phase 1</p>
                      <p>Bangalore, India</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  For any questions about this Privacy Policy, please contact us using the information provided above.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
} 