'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { 
  Search, 
  BarChart3, 
  Building2, 
  BookOpen, 
  Calculator, 
  FileText, 
  Users, 
  Gift, 
  DollarSign, 
  Phone, 
  Mail, 
  Shield, 
  Truck, 
  RotateCcw,
  ArrowRight,
  Star,
  TrendingUp,
  Target,
  Award,
  GraduationCap,
  MapPin,
  Clock,
  CheckCircle,
  Play,
  ChevronRight,
  Sparkles,
  Zap,
  Globe,
  Heart
} from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  const features = [
    {
      title: "College Search & Comparison",
      description: "Find and compare colleges based on multiple parameters like placement rates, median salary, and academic performance.",
      icon: Search,
      color: "text-blue-600",
      bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
      route: "/college-search",
      badge: "Main Feature",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      title: "Cutoff Rank Prediction",
      description: "Predict your chances of getting into colleges based on your rank and previous years' cutoff data.",
      icon: Calculator,
      color: "text-green-600",
      bgColor: "bg-gradient-to-br from-green-50 to-green-100",
      route: "/cutoff-rank-prediction",
      badge: "AI Powered",
      gradient: "from-green-500 to-green-600"
    },
    {
      title: "Compare Colleges",
      description: "Side-by-side comparison of multiple colleges to make informed decisions.",
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-gradient-to-br from-purple-50 to-purple-100",
      route: "/compare-colleges",
      gradient: "from-purple-500 to-purple-600"
    },
    {
      title: "Branch Explorer",
      description: "Explore different branches and their details for each college including cutoff ranks and placement data.",
      icon: Building2,
      color: "text-orange-600",
      bgColor: "bg-gradient-to-br from-orange-50 to-orange-100",
      route: "/branch-explorer",
      gradient: "from-orange-500 to-orange-600"
    },
    {
      title: "Choice Filling",
      description: "AI-assisted college choice filling with smart recommendations and traditional methods.",
      icon: Target,
      color: "text-red-600",
      bgColor: "bg-gradient-to-br from-red-50 to-red-100",
      route: "/choice-filling",
      badge: "Premium",
      gradient: "from-red-500 to-red-600"
    },
    {
      title: "Add College Data",
      description: "Contribute to our database by adding or updating college information and data.",
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-gradient-to-br from-indigo-50 to-indigo-100",
      route: "/nirf-upload",
      gradient: "from-indigo-500 to-indigo-600"
    },
    {
      title: "Educational Blogs",
      description: "Comprehensive guides and articles about college selection, admission processes, and career guidance.",
      icon: BookOpen,
      color: "text-teal-600",
      bgColor: "bg-gradient-to-br from-teal-50 to-teal-100",
      route: "/blogs",
      gradient: "from-teal-500 to-teal-600"
    },
    {
      title: "Pricing Plans",
      description: "Choose from our flexible pricing plans for premium features and choice filling services.",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-gradient-to-br from-emerald-50 to-emerald-100",
      route: "/pricing",
      gradient: "from-emerald-500 to-emerald-600"
    },
    {
      title: "Educational Loans",
      description: "Information and guidance about educational loan options for college education.",
      icon: GraduationCap,
      color: "text-cyan-600",
      bgColor: "bg-gradient-to-br from-cyan-50 to-cyan-100",
      route: "/educational-loan",
      gradient: "from-cyan-500 to-cyan-600"
    }
  ]

  const stats = [
    { label: "Colleges", value: "320+", icon: Building2, description: "Verified Institutions" },
    { label: "Students Helped", value: "10K+", icon: Users, description: "Successful Placements" },
    { label: "Data Points", value: "50K+", icon: BarChart3, description: "Comprehensive Data" },
    { label: "Success Rate", value: "95%", icon: TrendingUp, description: "Student Satisfaction" }
  ]

  const highlights = [
    {
      title: "Government Verified Data",
      description: "All data sourced from official NIRF reports published by the Government of India",
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "AI-Powered Recommendations",
      description: "Smart algorithms help you find the best colleges based on your preferences",
      icon: Sparkles,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Real-time Updates",
      description: "Regular updates with latest cutoff ranks and placement statistics",
      icon: Zap,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Comprehensive Coverage",
      description: "Complete information on placement, salary, scholarships, and academic performance",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50"
    }
  ]



  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0B5588] via-[#1e40af] to-[#3b82f6] text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
        
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Login/Signup Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 sm:mb-8 px-4 sm:px-0">
              <Button 
                size="lg"
                className="bg-white text-[#0B5588] hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border-2 border-white w-full sm:w-auto"
                onClick={() => router.push('/login?tab=login')}
              >
                <Shield className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5" />
                Login Here
              </Button>
              <Button 
                size="lg"
                className="bg-white text-[#0B5588] hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold border-2 border-white w-full sm:w-auto"
                onClick={() => router.push('/login?tab=signup')}
              >
                <Users className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5" />
                Signup Here
              </Button>
            </div>
            
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">AI-Powered College Selection Platform</span>
            </div>
            
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Choose Your
              <span className="block text-white">
                Perfect College
              </span>
          </h1>
            
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Make informed college decisions with data-driven insights, AI-powered recommendations, and comprehensive comparison tools.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg"
                className="bg-white text-[#0B5588] hover:bg-gray-100 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => router.push('/college-search')}
              >
                <Search className="mr-3 h-6 w-6" />
                Start College Search
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                className="bg-white text-[#0B5588] hover:bg-gray-100 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => router.push('/choice-filling')}
              >
                <Target className="mr-3 h-6 w-6" />
                Start Choice Filling
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          
          {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-white/10 backdrop-blur-sm rounded-full">
                      <stat.icon className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-blue-100 font-medium">{stat.label}</div>
                  <div className="text-xs text-blue-200">{stat.description}</div>
                </div>
              ))}
              </div>
          </div>
        </div>
      </section>

        {/* Highlights Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#0B5588] mb-6">
            Why Choose ChooseYourCollege.com?
          </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We provide the most comprehensive and reliable platform for college selection with cutting-edge technology and verified data.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {highlights.map((highlight, index) => (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50">
                <CardContent className="pt-8 pb-8">
                  <div className="flex justify-center mb-6">
                    <div className={`p-4 rounded-2xl ${highlight.bgColor}`}>
                      <highlight.icon className={`h-10 w-10 ${highlight.color}`} />
                    </div>
                  </div>
                  <h3 className="font-bold text-xl mb-4 text-gray-900">{highlight.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{highlight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

            {/* Educational Loan CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-emerald-100 rounded-full px-4 py-2 mb-6">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Financial Support</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Need Financial Support for Your Education?
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Apply for educational loans with our streamlined process. Get quick approval and competitive interest rates to fund your college education.
            </p>
            <Button 
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              onClick={() => router.push('/educational-loan')}
            >
              <GraduationCap className="mr-3 h-6 w-6" />
              Apply for Educational Loan
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

            {/* Features Showcase */}
      <section className="py-20 bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#0B5588] mb-6">
            Explore Our Features
          </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover powerful tools designed to help you make the best college decisions with confidence.
            </p>
          </div>
          
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {features.map((feature, index) => (
                <div 
                key={index} 
                  className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden"
                onClick={() => router.push(feature.route)}
              >
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0B5588]/5 via-transparent to-[#0B5588]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#0B5588] to-[#1e40af] rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <feature.icon className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 group-hover:text-[#0B5588] transition-colors">
                            {feature.title}
                          </h3>
                          {feature.badge && (
                            <Badge className="bg-gradient-to-r from-[#0B5588] to-[#1e40af] text-white px-3 py-1 rounded-full text-xs font-medium shadow-sm mt-2">
                              {feature.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-600 text-lg leading-relaxed mb-8">
                      {feature.description}
                    </p>
                    
                    {/* Action */}
                    <div className="flex items-center">
                      <span className="text-[#0B5588] font-semibold group-hover:translate-x-2 transition-transform duration-300">
                        Explore Feature
                      </span>
                    </div>
                  </div>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-6 right-6 w-4 h-4 bg-gradient-to-br from-[#0B5588]/30 to-[#1e40af]/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute bottom-6 left-6 w-3 h-3 bg-gradient-to-br from-[#0B5588]/20 to-[#1e40af]/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100"></div>
                </div>
            ))}
            </div>
          </div>
        </div>
      </section>

      

        {/* Call to Action */}
      <section className="py-20 bg-gradient-to-r from-[#0B5588] to-[#1e40af] text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Find Your Perfect College?
            </h2>
            <p className="text-xl mb-8 opacity-90 leading-relaxed">
              Start your journey today with our comprehensive college search and comparison tools. 
              Join thousands of students who have already found their dream college.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                className="bg-white text-[#0B5588] hover:bg-gray-100 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => router.push('/college-search')}
                >
                <Search className="mr-3 h-6 w-6" />
                  Start College Search
                <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg"
                  className="bg-white text-[#0B5588] hover:bg-gray-100 text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => router.push('/pricing')}
                >
                <DollarSign className="mr-3 h-6 w-6" />
                View Pricing Plans
                </Button>
              </div>
          </div>
        </div>
      </section>

        {/* Additional Links */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader>
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-50 rounded-xl mr-4">
                    <Shield className="h-8 w-8 text-[#0B5588]" />
                  </div>
                  <CardTitle className="text-xl text-gray-900">Legal & Privacy</CardTitle>
              </div>
            </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/privacy-policy')}>
                Privacy Policy
              </Button>
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/terms-and-conditions')}>
                Terms & Conditions
              </Button>
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/refund-policy')}>
                Refund Policy
              </Button>
            </CardContent>
          </Card>

            <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader>
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-green-50 rounded-xl mr-4">
                    <Truck className="h-8 w-8 text-[#0B5588]" />
                  </div>
                  <CardTitle className="text-xl text-gray-900">Services</CardTitle>
              </div>
            </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/shipping-delivery')}>
                Shipping & Delivery
              </Button>
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/educational-loan')}>
                Educational Loans
              </Button>
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/contact')}>
                Contact Support
              </Button>
            </CardContent>
          </Card>

            <Card className="border-0 shadow-lg bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader>
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-purple-50 rounded-xl mr-4">
                    <Award className="h-8 w-8 text-[#0B5588]" />
                  </div>
                  <CardTitle className="text-xl text-gray-900">Resources</CardTitle>
              </div>
            </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/blogs')}>
                Educational Blogs
              </Button>
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/nirf-upload')}>
                Add College Data
              </Button>
                <Button variant="link" className="p-0 h-auto text-left text-gray-600 hover:text-[#0B5588] transition-colors" onClick={() => router.push('/compare-colleges')}>
                Compare Colleges
              </Button>
            </CardContent>
          </Card>
        </div>
        </div>
      </section>

      <Footer />
    </div>
  )
} 