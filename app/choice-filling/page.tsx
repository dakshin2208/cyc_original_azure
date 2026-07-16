'use client'

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Trophy, Users, IndianRupee, ArrowUp, ArrowDown, ArrowRight, Minus } from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from 'jspdf-autotable'
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { planAllowsAiMethod, planAllowsPowerScore, planAspirationalLimit } from "@/lib/plans"
import { LoginForm } from "@/app/components/LoginForm"
import { useAuth } from "../contexts/AuthContext"
import { useRouter, useSearchParams } from 'next/navigation'
import { PaymentButton } from "@/components/PaymentButton"
import { TrackReferrals } from "@/components/track-referrals"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Define types for our chat messages and user preferences
type Message = {
  type: 'bot' | 'user'
  content: string
  options?: string[]
  selectedOption?: string
  selectedDistricts?: string[]
  selectedBranches?: string[]
  selectedColleges?: string[]
  results?: any[]
  showDistrictSelection?: boolean
  availableDistricts?: string[]
  showBranchSelection?: boolean
  showCollegeSelection?: boolean
  availableBranches?: string[]
  showSelectedOptions?: boolean
  showPricingPlans?: boolean
}

type UserPreferences = {
  name: string
  cutoff: number
  category: string
  cityPreference: 'any' | 'specific'
  districtOption: 'one' | 'two' | 'three' | null
  selectedDistricts: string[]
  branchOption: 'specific' | 'cs' | 'circuit' | null
  selectedBranches: string[]
  collegeOption: 'cutoff' | 'cutoff+five' | 'specific' | null
  selectedColleges: string[]
  choiceType: 'traditional' | 'smart' | null
  // Display label for the chosen method: 'Traditional Method' | 'Power Score' | 'AI Method'.
  // 'Power Score' and 'AI Method' both run the same 'smart' (PowerScore-ranked) engine;
  // the label only differs so results/exports read correctly and AI Method can be plan-gated.
  choiceMethodLabel?: string
  requiredCollegeCount?: number
  resultType: 'cutoff' | 'rank' | null
}

// Add this type near the top with other types
type College = {
  code: string
  name: string
}

// Add this type near other type definitions
type CollegeRecord = {
  'College Code': string
  'College Name': string
}

// Initial districts list
const districts = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", 
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", 
  "Nagapattinam", "Namakkal", "Perambalur", "Pudukkottai", "Ramanathapuram", 
  "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "The Nilgiris", 
  "Theni", "Thirupattur", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", 
  "Tiruppur", "Thiruvallur", "Thiruvannamalai", "Thiruvarur", "Vellore", 
  "Viluppuram", "Virudhunagar"
]

// All available branches
const allBranches = [
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Data Science (SS)",
  "Artificial Intelligence and Machine Learning",
  "Computer Science and Design",
  "Computer Science and Engineering (Tamil Medium)",
  "Computer Science and Engineering (Artificial Intelligence and Machine Learning) (SS)",
  "Computer Science and Engineering (Cyber Security)",
  "Computer Science and Engineering (Data Science)",
  "Computer Science and Engineering (Internet of Things)",
  "Aeronautical Engineering",
  "Agriculture Engineering",
  "Agricultural and Irrigation Engineering (SS)",
  "Computer Science and Engineering (AI and Machine Learning)",
  "Aerospace Engineering",
  "Apparel Technology (SS)",
  "Architecture",
  "Automobile Engineering (SS)",
  "Automobile Engineering",
  "Computer Science and Engineering (Big Data Analytics)",
  "Bio- Medical Engineering",
  "Architecture (SS)",
  "Bio Technology (SS)",
  "Bio Technology",
  "Bio- Medical Engineering (SS)",
  "Civil and Structural Engineering",
  "Computer Science and Business System",
  "Chemical and Electro Chemical Engineering (SS)",
  "Civil Engineering",
  "Chemical Engineering",
  "Chemical Engineering (SS)",
  "Computer Science and Engineering (SS)",
  "Civil Engineering (SS)",
  "Computer and Communication Engineering",
  "Civil Engg. and Planning",
  "Ceramic Technology (SS)",
  "Computer Science and Engineering",
  "Computer Technology",
  "Computer Science and Business System (SS)",
  "Cyber Security",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Electronics and Instrumentation Engineering",
  "Electronics and Communication Engg. (SS)",
  "Environmental Engg.",
  "Electrical and Electronics (Sandwich) (SS)",
  "Electronics and Telecommunication Engg.",
  "Electronics and Instrumentation Engg. (SS)",
  "Elec. And Electronics Engg (SS)",
  "Food Technology",
  "Food Technology (SS)",
  "Fashion Technology",
  "Fashion Technology (SS)",
  "Geo-Informatics",
  "Handloom and Textile Technology",
  "Industrial Bio-Technology",
  "Instrumentation and Control Engineering",
  "Industrial Engineering",
  "Information Science and Engineering",
  "Information Tech. (SS)",
  "Industrial Engineering and Management",
  "Industrial Bio-Tech. (SS)",
  "Information Technology",
  "Instrumentation and Control Engineering (SS)",
  "Leather Technology",
  "Material Science and Engineering (SS)",
  "Mechatronics",
  "Mechatronics Engineering",
  "Mechatronics Engineering (SS)",
  "Mechatronics Engineering (Tamil Medium)",
  "Medical Electronics Engg.",
  "Mechanical Engineering",
  "Mechanical (Manufacturing)",
  "Mechanical Engg. (SS)",
  "Mechatronics (SS)",
  "Mechanical Engineering (Sandwich)",
  "Mechanical Engineering (SS)",
  "Mechanical Engineering (Tamil Medium)",
  "Mining Engineering",
  "Manufacturing Engineering",
  "Mechanical and Mechatronics Engineering (Additive Manufacturing)",
  "Marine Engineering",
  "Mechanical Engineering (Sandwich) (SS)",
  "Metallurgical Engineering",
  "Mechanical and Automation Engineering",
  "Metallurgical Engg. (SS)",
  "Nano Science and Technology",
  "Plastic Technology",
  "Petro Chemical Technology",
  "Petrochemical Engineering",
  "Petroleum Engineering",
  "Pharmaceutical Technology",
  "Polymer Technology",
  "Pharmaceutical Tech (SS)",
  "Production Engineering (SS)",
  "Petroleum Engineering and Technology (SS)",
  "Production Engineering",
  "Production Engineering (Sandwich) (SS)",
  "Printing and Packaging Technology",
  "Robotics and Automation (SS)",
  "Robotics and Automation",
  "Rubber and Plastic Tech.",
  "Computer Science and Engineering (Internet of Things and Cyber Security including Block Chain Technology)",
  "Textile Chemistry",
  "Computer Science and Technology",
  "Textile Technology (SS)",
  "Textile Technology"
].sort((a, b) => a.localeCompare(b))

// Branch categories for quick selection
const computerScienceBranches = [
  "Computer Science and Engineering",
  "COMPUTER SCIENCE AND ENGINEERING (SS)",
  "Information Technology",
  "Information Tech. (SS)",
  "Artificial Intelligence and Data Science",
  "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE (SS)",
  "Artificial Intelligence and Machine Learning",
  "Cyber Security",
  "COMPUTER SCIENCE AND ENGINEERING (AI AND MACHINE LEARNING)",
  "Computer Science and Engineering (Artificial Intelligence and Machine Learning) (SS)",
  "Computer Science and Engineering (Data Science)",
  "Computer Science and Engineering (Cyber Security)",
  "Computer Science and Engineering (Big Data Analytics)",
  "Computer Science and Engineering (Internet of Things and Cyber Security including Block Chain Technology)",
  "Computer Science and Engineering (Internet of Things)",
  "Computer Science and Technology",
  "Computer Technology",
  "Computer Science and Business System",
  "Computer Science and Business System (SS)",
  "Computer Science and Design",
  "Computer and Communication Engineering",
  "Information Science and Engineering"
]

const branchCategories = {
  cs: computerScienceBranches,
  circuit: [
    ...computerScienceBranches,  // Include computer science branches first
    ...allBranches.filter(branch => 
      (branch.toLowerCase().includes('electronics') || 
      branch.toLowerCase().includes('electrical') || 
      branch.toLowerCase().includes('instrumentation')) &&
      !computerScienceBranches.includes(branch)  // Exclude branches already in computerScienceBranches
    )
  ],
  mechanical: allBranches.filter(branch => 
    branch.toLowerCase().includes('mechanical') || 
    branch.toLowerCase().includes('mechatronics') || 
    branch.toLowerCase().includes('automation') ||
    branch.toLowerCase().includes('manufacturing') ||
    branch.toLowerCase().includes('production') ||
    branch.toLowerCase().includes('industrial') ||
    branch.toLowerCase().includes('automobile') ||
    branch.toLowerCase().includes('mechatronics engineering') ||
    branch.toLowerCase().includes('production engineering') ||
    branch.toLowerCase().includes('tamil medium')
  )
}

// Add reservation categories at the top with other constants
const reservationCategories = [
  "OC", "BC", "BCM", "MBC", "MBCDNC", "MBCV", "SC", "SCA", "ST"
]

// Choice-method options shown in the chat. The method NAME must come first and
// any description must sit in parentheses — the response handler strips
// everything from "(" onwards to recover the method name.
const CHOICE_METHOD_OPTIONS = [
  'Traditional Method (Using Last year Cutoff)',
  'Power Score (A Placement focussed proprietary score of CYC - which you can use to find better colleges at lower cut off)',
  'AI Method (Rank based results along with the Power Score)',
]

// Add this constant near the top with other constants
const BRANCH_PRIORITY_ORDER = [
  [1, "Computer Science and Engineering"],
  [2, "COMPUTER SCIENCE AND ENGINEERING (SS)"],
  [3, "Information Technology"],
  [4, "Information Tech. (SS)"],
  [5, "Artificial Intelligence and Data Science"],
  [6, "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE (SS)"],
  [7, "Artificial Intelligence and Machine Learning"],
  [8, "Cyber Security"],
  [9, "COMPUTER SCIENCE AND ENGINEERING (AI AND MACHINE LEARNING)"],
  [10, "Computer Science and Engineering (Artificial Intelligence and Machine Learning) (SS)"],
  [11, "Computer Science and Engineering (Data Science)"],
  [12, "Computer Science and Engineering (Cyber Security)"],
  [13, "Computer Science and Engineering (Big Data Analytics)"],
  [14, "Computer Science and Engineering (Internet of Things and Cyber Security including Block Chain Technology)"],
  [15, "Computer Science and Engineering (Internet of Things)"],
  [16, "Computer Science and Technology"],
  [17, "Computer Technology"],
  [18, "Computer Science and Business System"],
  [19, "Computer Science and Business System (SS)"],
  [20, "Computer Science and Design"],
  [21, "Computer and Communication Engineering"],
  [22, "Information Science and Engineering"]
]

export default function ChoiceFilling() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<'form' | 'chat'>('form')
  const [messages, setMessages] = useState<Message[]>([])
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    name: '',
    cutoff: 0,
    category: '',
    cityPreference: 'any',
    districtOption: null,
    selectedDistricts: [],
    branchOption: null,
    selectedBranches: [],
    collegeOption: null,
    selectedColleges: [],
    choiceType: null,
    resultType: null
  })
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    rollNumber: "",
    dateOfBirth: "",
    mathsMarks: "",
    physicsMarks: "",
    chemistryMarks: "",
    cutoff: "",
    category: "",
    rank: "",
    communityRank: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collegeResults, setCollegeResults] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [isSelectingDistricts, setIsSelectingDistricts] = useState(false)
  const [isSelectingBranches, setIsSelectingBranches] = useState(false)
  const [availableOptions, setAvailableOptions] = useState<string[]>([])
  const [selectionLimit, setSelectionLimit] = useState<number>(0)
  const [selectionInProgress, setSelectionInProgress] = useState(false)
  const [selectionMessage, setSelectionMessage] = useState('')
  const [isSelectingColleges, setIsSelectingColleges] = useState(false)
  const [availableColleges, setAvailableColleges] = useState<College[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollegeCodes, setSelectedCollegeCodes] = useState<string[]>([])
  const [showSelectedOptions, setShowSelectedOptions] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showPricingDialog, setShowPricingDialog] = useState(false)
  
  // New state variables for user data management
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  // Set once the final question is answered; an effect then generates the results
  // (deferred so the latest preferences have committed first).
  const [pendingResultType, setPendingResultType] = useState<'cutoff' | 'rank' | null>(null)
  // Persistent inline error shown on the details form (e.g. when the entered
  // rank/category/community-rank don't match the TNEA records).
  const [detailsError, setDetailsError] = useState("")
  const [userDataLoaded, setUserDataLoaded] = useState(false)
  const [isLoadingUserData, setIsLoadingUserData] = useState(true)
  
  // Usage tracking state
  const [usageData, setUsageData] = useState<any>(null)
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9))
  const [usageSessionId, setUsageSessionId] = useState<string>('')
  const currentSessionIdRef = useRef<string>('')
  
  // Referral tracking state
  const [referralProcessed, setReferralProcessed] = useState(false)
  const [signInTracked, setSignInTracked] = useState(false)
  
  // AI processing loading state
  const [isAIProcessing, setIsAIProcessing] = useState(false)

  // Function to generate a new usage session ID for each actual usage
  const generateUsageSessionId = () => {
    const newSessionId = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setUsageSessionId(newSessionId)
    currentSessionIdRef.current = newSessionId
    return newSessionId
  }

  // Log usage data changes for debugging
  useEffect(() => {
    if (usageData) {
      console.log('🔄 Usage data updated:', {
        currentPlan: usageData.currentPlan,
        planType: usageData.planType,
        maxChoices: usageData.maxChoices,
        usageCount: usageData.usageCount,
        canUse: usageData.canUse
      })
    }
  }, [usageData])

  // Check if user is authenticated
  useEffect(() => {
    console.log('Auth state changed:', { user, loading, isSigningOut })
    if (!loading && !user && !isSigningOut) {
      console.log('Redirecting to login - no user found')
      router.push('/login')
    }
  }, [user, loading, router])

  // Store referral code in localStorage when page loads
  useEffect(() => {
    if (!searchParams) return
    
    // Check multiple possible referral parameter names
    let referralCode = searchParams.get('ref') || 
                      searchParams.get('referral') || 
                      searchParams.get('code') || 
                      searchParams.get('refcode')
    
    console.log('🔍 Checking URL for referral code...')
    console.log('🔍 Current URL:', window.location.href)
    console.log('🔍 URL search params:', window.location.search)
    console.log('🔍 All URL parameters:', Object.fromEntries(searchParams.entries()))
    
    if (referralCode) {
      console.log('🔗 Referral code found in URL, storing in localStorage:', referralCode)
      localStorage.setItem('referralCode', referralCode)
      
      // Don't remove the referral code from URL immediately
      // Keep it until the user is authenticated and referral is tracked
      console.log('✅ Referral code stored in localStorage, keeping in URL for now')
    } else {
      console.log('❌ No referral code found in URL parameters')
      console.log('🔍 Checked parameters: ref, referral, code, refcode')
    }
  }, [searchParams])

  // Track when user signs in through referral link - ONLY ONCE
  useEffect(() => {
    console.log('=== SIGN-IN TRACKING USEFFECT TRIGGERED ===')
    console.log('User state:', { id: user?.id, email: user?.email, signInTracked })
    
    const trackSignInThroughReferral = async () => {
      // Only proceed if user is authenticated, has email, and we haven't tracked sign-in yet
      if (user?.id && user?.email && !signInTracked) {
        const referralCode = localStorage.getItem('referralCode')
        console.log('Referral code from localStorage:', referralCode)
        
        if (referralCode) {
          console.log('=== TRACKING SIGN IN THROUGH REFERRAL ===')
          console.log('User signed in with referral code:', referralCode)
          console.log('User ID:', user.id)
          console.log('User email:', user.email)
          
          try {
            // Create referral record if it doesn't exist
            const recordResponse = await fetch('/api/record-referral', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                referrerCode: referralCode,
                referredUserId: user.id,
                referredEmail: user.email,
                referredPhone: null
              }),
            })
            
            const recordData = await recordResponse.json()
            console.log('Record referral response:', recordData)
            
            if (recordData.success) {
              // Update status to 'signed_in'
              const statusResponse = await fetch('/api/update-referral-status', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  referredUserId: user.id,
                  referredEmail: user.email,
                  status: 'signed_in'
                }),
              })
              
              const statusData = await statusResponse.json()
              console.log('Update status response:', statusData)
              
              if (statusData.success) {
                console.log('✅ Referral recorded and status updated to signed_in')
              } else {
                console.error('❌ Failed to update referral status:', statusData.error)
              }
            } else {
              console.error('❌ Failed to record referral:', recordData.error)
            }
          } catch (error) {
            console.error('❌ Error tracking sign-in through referral:', error)
          }
          
          // Mark as tracked to prevent duplicate calls
          setSignInTracked(true)
        } else {
          console.log('No referral code found in localStorage')
        }
      } else {
        console.log('Conditions not met for sign-in tracking:', {
          hasUserId: !!user?.id,
          hasEmail: !!user?.email,
          signInTracked
        })
      }
    }
    
    trackSignInThroughReferral()
  }, [user?.id, user?.email, signInTracked])

  // Test function to debug referral tracking
  const testReferralTracking = async (referralCode: string) => {
    console.log('=== TESTING REFERRAL TRACKING ===')
    console.log('Testing with referral code:', referralCode)
    
    // Test 1: Check if referral code exists in database
    try {
      const testResponse = await fetch('/api/test-referral-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ referralCode }),
      })
      
      const testData = await testResponse.json()
      console.log('Referral code test result:', testData)
    } catch (error) {
      console.error('Error testing referral code:', error)
    }
  }

  // Test function to debug referral link format
  const testReferralLink = () => {
    console.log('=== TESTING REFERRAL LINK FORMAT ===')
    console.log('Current URL:', window.location.href)
    console.log('URL search params:', window.location.search)
    
    console.log('All URL parameters:', searchParams ? Object.fromEntries(searchParams.entries()) : {})
    
    const possibleParams = ['ref', 'referral', 'code', 'refcode']
    possibleParams.forEach(param => {
      const value = searchParams?.get(param)
      console.log(`Parameter "${param}":`, value)
    })
    
    const localStorageCode = localStorage.getItem('referralCode')
    console.log('Referral code in localStorage:', localStorageCode)
    
    // Test creating a referral link
    const testCode = 'TEST123'
    const testLink = `${window.location.origin}/choice-filling?ref=${testCode}`
    console.log('Example referral link format:', testLink)
  }

  // Function to track referral completion - creates record if needed, then updates status
  const trackReferral = async (referralCode: string) => {
    if (!user?.id || !user?.email) {
      console.log('❌ User data not available for referral tracking')
      return
    }
    
    try {
      console.log('=== TRACKING REFERRAL COMPLETION ===')
      console.log('User ID:', user.id)
      console.log('User email:', user.email)
      console.log('Referral code:', referralCode)
      
      // First, try to create the referral record if it doesn't exist
      const recordResponse = await fetch('/api/record-referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrerCode: referralCode,
          referredUserId: user.id,
          referredEmail: user.email,
          referredPhone: formData.phoneNumber || null
        }),
      })
      
      const recordData = await recordResponse.json()
      console.log('Record referral response:', recordData)
      
      if (recordData.success) {
        // Now update status to completed
        const statusResponse = await fetch('/api/update-referral-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referredUserId: user.id,
            referredEmail: user.email,
            status: 'completed'
          }),
        })
        
        const statusData = await statusResponse.json()
        console.log('Update referral status response:', statusData)
        
        if (statusData.success) {
          console.log('✅ Referral recorded and status updated to completed')
          // Clear the referral code from localStorage after successful tracking
          localStorage.removeItem('referralCode')
          console.log('✅ Referral code cleared from localStorage')
        } else {
          console.error('❌ Failed to update referral status:', statusData.error)
        }
      } else {
        console.error('❌ Failed to record referral:', recordData.error)
      }
    } catch (error) {
      console.error('❌ Error tracking referral:', error)
    }
  }

  // Check user data when user is authenticated
  useEffect(() => {
    if (user?.id && user?.email && !userDataLoaded) {
      checkUserExists()
      checkUsage()
    }
  }, [user, userDataLoaded])

  // Handle sign out with loading state
  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process...')
      setIsSigningOut(true)
      await signOut()
      console.log('Sign out completed')
    } catch (error) {
      console.error('Error during sign out:', error)
      // Don't redirect on error - let user try again
    } finally {
      setIsSigningOut(false)
    }
  }

  // Payment handlers
  const handlePaymentSuccess = (paymentId: string) => {
    toast.success(`Payment successful! Your plan has been upgraded. You now have access to premium features. Payment ID: ${paymentId}`)
    setShowUsageModal(false)
    setShowPricingDialog(false)
    // Refresh usage data immediately after successful payment
    checkUsage()
  }

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`)
  }



  // Check if user exists and load their data
  const checkUserExists = async () => {
    if (!user?.email) return
    
    console.log('checkUserExists called for email:', user.email)
    
    try {
      setIsLoadingUserData(true)
      const { data, error } = await supabase
        .from('user_choice_filling_data')
        .select('*')
        .eq('email', user.email)
        .single()

      console.log('Database query result:', { data, error })

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking user data:', error)
        setIsNewUser(true) // Default to new user on error
        return
      }

      if (data) {
        // User exists, load their data
        console.log('User exists, loading data:', data)
        setIsNewUser(false)
        setFormData({
          fullName: data.full_name || "",
          phoneNumber: data.phone_number || "",
          email: data.email || "",
          rollNumber: data.roll_number || "",
          dateOfBirth: data.date_of_birth || "",
          mathsMarks: data.maths_marks || "",
          physicsMarks: data.physics_marks || "",
          chemistryMarks: data.chemistry_marks || "",
          cutoff: data.cutoff || "",
          category: data.category || "",
          rank: data.rank || "",
          communityRank: data.community_rank || ""
        })
        setUserPreferences(prev => ({
          ...prev,
          name: data.full_name || '',
          cutoff: parseFloat(data.cutoff) || 0,
          category: data.category || ''
        }))
      } else {
        // User is new
        console.log('User is new')
        setIsNewUser(true)
      }
    } catch (error) {
      console.error('Error checking user data:', error)
      setIsNewUser(true) // Default to new user on error
    } finally {
      setIsLoadingUserData(false)
      setUserDataLoaded(true)
      console.log('User data check completed. isNewUser:', isNewUser)
    }
  }

  // Check user usage and restrictions
  const checkUsage = async () => {
    if (!user?.id || !user?.email) {
      console.log('User data not available for usage check')
      return
    }
    
    try {
      console.log('Checking usage for user:', user.id, user.email)
      const response = await fetch('/api/check-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id, 
          email: user.email 
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Usage check failed:', response.status, errorText)
        return
      }

      const data = await response.json()
      if (data.success) {
        console.log('✅ Usage check successful:', data.usage)
        console.log('📊 Plan Details:', {
          currentPlan: data.usage.currentPlan,
          planType: data.usage.planType,
          maxChoices: data.usage.maxChoices,
          usageCount: data.usage.usageCount
        })
        setUsageData(data.usage)
        
        // If user has used their free trial and has no available trials, show modal
        if (!data.usage.canUse) {
          console.log('❌ User cannot use service, showing modal')
          setShowUsageModal(true)
        } else {
          // Hide modal if user can use the service (has premium plan or available trials)
          console.log('✅ User can use service, hiding modal')
          setShowUsageModal(false)
        }
      } else {
        console.error('Usage check returned error:', data.error)
      }
    } catch (error) {
      console.error('Error checking usage:', error)
    }
  }

  // Save user data to database
  const saveUserData = async () => {
    if (!user?.email) return
    
    try {
      const { error } = await supabase
        .from('user_choice_filling_data')
        .insert({
          email: user.email,
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
          roll_number: formData.rollNumber,
          date_of_birth: formData.dateOfBirth,
          maths_marks: formData.mathsMarks,
          physics_marks: formData.physicsMarks,
          chemistry_marks: formData.chemistryMarks,
          cutoff: formData.cutoff,
          category: formData.category,
          rank: formData.rank,
          community_rank: formData.communityRank,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error saving user data:', error)
        throw new Error('Failed to save user data')
      }
    } catch (error) {
      console.error('Error saving user data:', error)
      throw error
    }
  }

  useEffect(() => {
    if (step === 'chat' && messages.length === 0) {
      const welcomeMessage: Message = {
        type: 'bot',
        content: `Welcome ${userPreferences.name}! I'm "AARVI" - your personal AI-Agent to help you in doing the perfect choice filling.`
      }
      const cityQuestion: Message = {
        type: 'bot',
        content: 'Do you have any specific cities or any city is fine?',
        options: ['Any city is fine', 'I have specific cities in mind']
      }
      setMessages([welcomeMessage, cityQuestion])
    }
  }, [step, userPreferences.name])

  useEffect(() => {
    if (isSelectingColleges && selectedCollegeCodes.length === (userPreferences.requiredCollegeCount || 5)) {
      setIsSelectingColleges(false)
      setUserPreferences(prev => ({ ...prev, selectedColleges: selectedCollegeCodes }))
      // Result type already comes from the chosen method — go straight to results.
      setPendingResultType(userPreferences.resultType ?? 'cutoff')
    }
  }, [isSelectingColleges, selectedCollegeCodes, userPreferences.requiredCollegeCount, userPreferences.resultType])

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    if (name === 'phoneNumber') {
      const numericValue = value.replace(/\D/g, '').slice(0, 10)
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }))
    } else if (name === 'rollNumber') {
      const numericValue = value.replace(/\D/g, '').slice(0, 7)
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }))
    } else if (name === 'rank' || name === 'communityRank') {
      const numericValue = value.replace(/\D/g, '')
      const numValue = parseInt(numericValue)
      if (numValue >= 1 && numValue <=299999) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }))
      } else if (numericValue === '') {
        setFormData(prev => ({
          ...prev,
          [name]: ''
        }))
      }
    } else if (name === 'mathsMarks' || name === 'physicsMarks' || name === 'chemistryMarks') {
      const numericValue = value.replace(/\D/g, '')
      
      setFormData(prev => {
        const newData = { ...prev, [name]: numericValue }
        
        const maths = parseInt(newData.mathsMarks) || 0
        const physics = parseInt(newData.physicsMarks) || 0
        const chemistry = parseInt(newData.chemistryMarks) || 0
        
        if (maths >= 35 && maths <= 100 && 
            physics >= 35 && physics <= 100 && 
            chemistry >= 35 && chemistry <= 100) {
          newData.cutoff = ((maths) + (physics * 0.5) + (chemistry * 0.5)).toFixed(2)
        } else {
          newData.cutoff = ''
        }
        
        return newData
      })
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  // Parse a rank value that may be stored as a string ("1,234") or a number.
  const toRankNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    const digits = String(value).replace(/[^\d]/g, "")
    if (!digits) return null
    const n = parseInt(digits, 10)
    return isNaN(n) ? null : n
  }

  // Parse a marks/cutoff value (0–200, may be decimal) stored as string or number.
  const toMarkNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    const n = parseFloat(String(value).replace(/[^\d.]/g, ""))
    return Number.isFinite(n) ? n : null
  }

  // Validate the student's General Rank + Reservation Category + Community Rank
  // against the rank_list table. All three must match a single stored row before
  // the user is allowed into choice filling and the details are frozen.
  // Filter by GENERAL RANK server-side (a narrow, uncapped filter, so we never
  // rely on Supabase's 1000-row page cap), then confirm community and community
  // rank in memory (robust to number/string storage). Returns true on an exact
  // match, false (after surfacing an error toast) otherwise.
  const validateRankDetails = async (): Promise<boolean> => {
    // Surface validation problems both as a toast and as a persistent inline
    // banner on the form, so the user always sees why it didn't proceed.
    const fail = (message: string): false => {
      setDetailsError(message)
      toast.error(message)
      return false
    }

    setDetailsError("")

    const generalRankNum = toRankNumber(formData.rank)
    const communityRankNum = toRankNumber(formData.communityRank)
    const cutoffNum = toMarkNumber(formData.cutoff)
    const category = (formData.category || '').trim().toUpperCase()
    // OC (open category) candidates do not have a separate community rank, so
    // only the general rank + category + cutoff are matched for them.
    const isOC = category === 'OC'

    if (generalRankNum === null || generalRankNum < 1) {
      return fail('Please enter a valid general rank.')
    }
    if (!category) {
      return fail('Please select your reservation category.')
    }
    if (!isOC && (communityRankNum === null || communityRankNum < 1)) {
      return fail('Please enter a valid community rank.')
    }
    if (cutoffNum === null || cutoffNum <= 0 || cutoffNum > 200) {
      return fail('Please enter valid marks so your cutoff can be calculated.')
    }

    try {
      const { data: matches, error } = await supabase
        .from('rank_list')
        .select('*')
        .eq('GENERAL RANK', generalRankNum)

      if (error) {
        console.error('rank_list validation error:', error)
        return fail('Could not verify your details. Please try again.')
      }

      // All four details must match a single stored row: general rank (already
      // filtered server-side), community, community rank and the cutoff
      // (rank_list."AGGREGATE MARK").
      const matchedRow = (matches || []).find((row) => {
        const storedCommunity = String(row['COMMUNITY'] ?? '').trim().toUpperCase()
        if (storedCommunity !== category) return false

        const storedAggregate = toMarkNumber(row['AGGREGATE MARK'])
        if (storedAggregate === null || Math.abs(storedAggregate - cutoffNum) > 0.01) return false

        // OC has no community rank stored — general rank + community + cutoff
        // are sufficient.
        if (isOC) return true

        const storedCommunityRank = toRankNumber(row['COMMUNITY RANK'])
        return storedCommunityRank === communityRankNum
      })

      if (!matchedRow) {
        return fail('We are connected to the TNEA portal data — only correct data will fetch the results. Please enter your correct data.')
      }

      return true
    } catch (err) {
      console.error('rank_list validation exception:', err)
      return fail('Could not verify your details. Please try again.')
    }
  }

  // Maps the student's reservation category to the matching colour column in the
  // Trend_rate table. The table only carries these categories; MBCDNC / MBCV have
  // no trend column and therefore render no trend.
  const TREND_RATE_COLUMN_BY_CATEGORY: Record<string, string> = {
    OC: 'oc trend rate',
    BC: 'bc trend rate',
    BCM: 'bcm trend rate',
    MBC: 'mbc trend rate',
    SC: 'sc trend rate',
    SCA: 'sca trend rate',
    ST: 'st trend rate',
  }

  // Normalise a branch name for matching between our results and the Trend_rate
  // table (case-insensitive, trimmed, collapsed whitespace).
  const normBranchName = (b: unknown) =>
    String(b ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

  // After results are computed, fetch the trend rate (a colour name per
  // college-branch, for the user's category) from the Trend_rate table and
  // attach it as `trendRate` to each branch/college. Handles both the grouped
  // "smart" shape (college.branches[]) and the flat "traditional" shape
  // (college.branch). Best-effort: any failure leaves results untouched.
  const enrichResultsWithTrendRate = async (results: any[]) => {
    try {
      const category = (userPreferences.category || '').trim().toUpperCase()
      const column = TREND_RATE_COLUMN_BY_CATEGORY[category]
      console.log('[Trend_rate] category:', category, '-> column:', column)
      if (!column || !Array.isArray(results) || results.length === 0) {
        console.log('[Trend_rate] skipping — no column for category or empty results')
        return results
      }

      // Collect the college (counselling) codes we need trend rows for.
      const codes = Array.from(
        new Set(
          results
            .map((college) => String(college?.code ?? '').trim())
            .filter(Boolean)
        )
      )
      console.log('[Trend_rate] querying codes:', codes)
      if (codes.length === 0) return results

      const { data, error } = await supabase
        .from('Trend_rate')
        .select(`counselling_code, branch, "${column}"`)
        .in('counselling_code', codes)

      if (error) {
        console.error('[Trend_rate] fetch error:', error)
        return results
      }

      console.log('[Trend_rate] rows returned:', data?.length ?? 0, 'sample:', (data || []).slice(0, 3))

      // If nothing came back, probe the table unfiltered to tell apart an RLS/
      // table-name problem (returns empty/errors) from a code-mismatch (probe
      // returns rows but our codes don't match).
      if (!data || data.length === 0) {
        const probe = await supabase.from('Trend_rate').select('*').limit(3)
        console.log('[Trend_rate] unfiltered probe — error:', probe.error, 'rows:', probe.data?.length ?? 0, 'sample:', probe.data)
        return results
      }

      // Index by "code||branch" -> colour.
      const trendMap = new Map<string, string>()
      for (const row of data || []) {
        const code = String(row['counselling_code'] ?? '').trim()
        const branch = normBranchName(row['branch'])
        const colour = String(row[column] ?? '').trim().toLowerCase()
        if (code && branch) trendMap.set(`${code}||${branch}`, colour)
      }

      let matched = 0
      let missed = 0
      const missSamples: string[] = []
      const lookup = (code: unknown, branch: unknown) => {
        const key = `${String(code ?? '').trim()}||${normBranchName(branch)}`
        const hit = trendMap.get(key)
        if (hit) { matched++; return hit }
        missed++
        if (missSamples.length < 5) missSamples.push(key)
        return ''
      }

      const enriched = results.map((college) => {
        if (Array.isArray(college?.branches)) {
          return {
            ...college,
            branches: college.branches.map((branch: any) => ({
              ...branch,
              trendRate: lookup(college.code, branch.name),
            })),
          }
        }
        return { ...college, trendRate: lookup(college.code, college.branch) }
      })

      console.log('[Trend_rate] matched:', matched, 'missed:', missed, 'miss samples (code||branch):', missSamples)
      console.log('[Trend_rate] index keys sample:', Array.from(trendMap.keys()).slice(0, 5))
      return enriched
    } catch (err) {
      console.error('[Trend_rate] enrichment exception:', err)
      return results
    }
  }

  // For rank-based (AI Method) results the colleges come from the "Rank" table,
  // which carries the closing RANK per category — not the cutoff. This fetches
  // the closing CUTOFF (student's category column) from the "Cutoff" table for
  // each college-branch and attaches it as `cutoff`, so the AI Method results can
  // show rank, PowerScore AND cutoff together. Best-effort: failures leave the
  // results untouched.
  const enrichResultsWithCutoff = async (results: any[]) => {
    try {
      const category = (userPreferences.category || '').trim()
      if (!category || !Array.isArray(results) || results.length === 0) return results

      const codes = Array.from(
        new Set(results.map((c) => String(c?.code ?? '').trim()).filter(Boolean))
      )
      if (codes.length === 0) return results

      const { data, error } = await supabase
        .from('Cutoff')
        .select(`"College Code", "Branch Name", "${category}"`)
        .in('College Code', codes)

      if (error) {
        console.error('[Cutoff enrich] fetch error:', error)
        return results
      }

      // Index by "code||branch" -> closing cutoff (number).
      const cutoffMap = new Map<string, number>()
      for (const row of data || []) {
        const code = String(row['College Code'] ?? '').trim()
        const branch = normBranchName(row['Branch Name'])
        const cut = parseFloat(String(row[category] ?? '').replace(/[^\d.]/g, ''))
        if (code && branch && Number.isFinite(cut)) cutoffMap.set(`${code}||${branch}`, cut)
      }

      const lookup = (code: unknown, branch: unknown): number | null => {
        const hit = cutoffMap.get(`${String(code ?? '').trim()}||${normBranchName(branch)}`)
        return hit === undefined ? null : hit
      }

      return results.map((college) => {
        if (Array.isArray(college?.branches)) {
          return {
            ...college,
            branches: college.branches.map((branch: any) => ({
              ...branch,
              cutoff: lookup(college.code, branch.name),
            })),
          }
        }
        return { ...college, cutoff: lookup(college.code, college.branch) }
      })
    } catch (err) {
      console.error('[Cutoff enrich] exception:', err)
      return results
    }
  }

  // "Aspirational" (reach) colleges: the plan grants N of them (Free 0, Secure 5,
  // Assured 15, Assured+ 50). These are colleges ABOVE the student's cutoff
  // (cutoff-based) or BELOW their rank (rank-based) — i.e. reach colleges they
  // might not get. This fetches the N nearest reach colleges (respecting the same
  // branch/district filters) and merges them at the TOP of the results, trimming
  // the usual list so the total stays within the plan's choice limit.
  const withAspirationalReach = async (
    flatResults: any[],
    maxChoices: number,
    resultType: 'cutoff' | 'rank',
  ) => {
    try {
      const N = planAspirationalLimit(usageData?.planType)
      const category = (userPreferences.category || '').trim()
      if (!N || N <= 0 || !category) return flatResults

      const userCutoff = Number(userPreferences.cutoff)
      const userRank = parseInt(formData.rank)
      const table = resultType === 'rank' ? 'Rank' : 'Cutoff'

      // Page all rows for the category that have a PowerScore.
      const pageSize = 1000
      let from = 0
      const rows: any[] = []
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select(`"College Code","College Name","Branch Name","District","BranchNo","PowerScore","avgMedianSalary","avgPlacementPercentage","${category}"`)
          .gt('PowerScore', 0)
          .range(from, from + pageSize - 1)
        if (error) { console.error('[Aspirational] fetch error:', error); return flatResults }
        if (!data || data.length === 0) break
        rows.push(...data)
        if (data.length < pageSize) break
        from += pageSize
      }

      const branches = userPreferences.selectedBranches || []
      const districts = userPreferences.selectedDistricts || []
      const matchesBranch = (b: unknown) =>
        branches.length === 0 || branches.some((sel) => String(b ?? '').toLowerCase().includes(sel.trim().toLowerCase()))
      const matchesDistrict = (d: unknown) =>
        districts.length === 0 || districts.includes(String(d ?? '').trim())

      // Reach candidates, nearest to the boundary first.
      const reach = rows
        .map((item) => ({ item, val: parseFloat(String(item[category] ?? '').replace(/[^\d.]/g, '')) }))
        .filter(({ item, val }) =>
          Number.isFinite(val) && val > 0 &&
          matchesBranch(item['Branch Name']) && matchesDistrict(item['District']) &&
          (resultType === 'rank' ? val < userRank : val > userCutoff)
        )
        .sort((a, b) => (resultType === 'rank' ? b.val - a.val : a.val - b.val))

      const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
      const seen = new Set(flatResults.map((r) => `${String(r.code).trim()}||${norm(r.branch)}`))
      const aspirational: any[] = []
      for (const { item, val } of reach) {
        if (aspirational.length >= N) break
        const code = String(item['College Code'] ?? '').trim()
        const branch = String(item['Branch Name'] ?? '').trim()
        const key = `${code}||${norm(branch)}`
        if (!code || seen.has(key)) continue
        seen.add(key)
        aspirational.push({
          code,
          name: String(item['College Name'] ?? '').trim(),
          branch,
          branchNo: Number(item['BranchNo']) || 999,
          cutoff: resultType === 'cutoff' ? val : 0,
          rank: resultType === 'rank' ? val : 0,
          medianSalary: parseFloat(item['avgMedianSalary']) || 0,
          placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
          powerScore: parseFloat(item['PowerScore']) || 0,
          district: String(item['District'] ?? '').trim(),
          category,
          isSelected: false,
          isAspirational: true,
        })
      }

      if (aspirational.length === 0) return flatResults
      // Reach first, then the usual list (trimmed so total stays within maxChoices).
      const usual = flatResults.slice(0, Math.max(0, maxChoices - aspirational.length))
      return [...aspirational, ...usual]
    } catch (e) {
      console.error('[Aspirational] exception:', e)
      return flatResults
    }
  }

  // Render the trend rate as a coloured arrow:
  //   green  -> upward arrow (green)
  //   red    -> downward arrow (red)
  //   yellow -> straight/right arrow (yellow)
  // Anything else (no data) renders a neutral dash.
  const renderTrendRate = (colour?: string) => {
    const c = (colour || '').trim().toLowerCase()
    if (c === 'green') return <ArrowUp className="h-5 w-5 text-green-600" aria-label="Upward trend" />
    if (c === 'red') return <ArrowDown className="h-5 w-5 text-red-600" aria-label="Downward trend" />
    if (c === 'yellow') return <ArrowRight className="h-5 w-5 text-yellow-500" aria-label="Stable trend" />
    return <Minus className="h-4 w-4 text-gray-400" aria-label="No trend data" />
  }

  // Choice "bucket" and its display colour:
  //   aspirational (student's own picked colleges, isSelected) -> green
  //   matching (rank/cutoff is an EXACT match to the student's)  -> yellow
  //   safe (everything else)                                     -> pink
  type ChoiceBucket = 'aspirational' | 'safe' | 'matching'

  // Does this record's rank (rank-based) or cutoff (cutoff-based) exactly equal
  // the student's rank/cutoff? `holder` is a flat college (traditional) or a
  // single branch (smart), both of which carry `rank` and `cutoff`.
  const isExactRankCutoffMatch = (holder: any): boolean => {
    if (userPreferences.resultType === 'rank') {
      const userRank = parseInt(formData.rank)
      const v = Number(holder?.rank)
      return Number.isFinite(userRank) && Number.isFinite(v) && v === userRank
    }
    const userCutoff = Number(userPreferences.cutoff)
    const v = Number(holder?.cutoff)
    return Number.isFinite(userCutoff) && Number.isFinite(v) && Math.abs(v - userCutoff) < 0.001
  }

  // Aspirational = "reach" colleges above the student's cutoff / below their rank
  // (flagged isAspirational during generation). NOT the colleges the user picked.
  // Bucket for a flat college row (traditional view) — carries rank/cutoff.
  const getChoiceBucket = (college: any): ChoiceBucket => {
    if (college?.isAspirational) return 'aspirational'
    return isExactRankCutoffMatch(college) ? 'matching' : 'safe'
  }

  // Bucket for a single branch row inside a smart college card. Aspirational is
  // decided PER BRANCH (not per college) — a college can have some reach branches
  // and some regular ones, and only the reach branches are aspirational.
  const getBranchBucket = (college: any, branch: any): ChoiceBucket => {
    if (branch?.isAspirational) return 'aspirational'
    return isExactRankCutoffMatch(branch) ? 'matching' : 'safe'
  }

  // Bucket for a smart college card/header: aspirational if any branch is a reach
  // college, else matching when any branch is an exact match, otherwise safe.
  const getCollegeAggregateBucket = (college: any): ChoiceBucket => {
    if (college?.isAspirational || (Array.isArray(college?.branches) && college.branches.some((b: any) => b?.isAspirational))) {
      return 'aspirational'
    }
    const anyMatch = Array.isArray(college?.branches) && college.branches.some((b: any) => isExactRankCutoffMatch(b))
    return anyMatch ? 'matching' : 'safe'
  }

  // Tailwind classes for the college card, its header strip, and its table rows.
  const bucketCardClass = (bucket: ChoiceBucket) => {
    switch (bucket) {
      case 'aspirational': return 'border-green-500 bg-green-50 dark:bg-green-900/20'
      case 'matching': return 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      default: return 'border-pink-400 bg-pink-50 dark:bg-pink-900/20'
    }
  }
  const bucketHeaderClass = (bucket: ChoiceBucket) => {
    switch (bucket) {
      case 'aspirational': return 'bg-green-100 dark:bg-green-900/30'
      case 'matching': return 'bg-yellow-100 dark:bg-yellow-900/30'
      default: return 'bg-pink-100 dark:bg-pink-900/30'
    }
  }
  const bucketRowClass = (bucket: ChoiceBucket) => {
    switch (bucket) {
      case 'aspirational': return 'bg-green-50 dark:bg-green-900/10'
      case 'matching': return 'bg-yellow-50 dark:bg-yellow-900/10'
      default: return 'bg-pink-50 dark:bg-pink-900/10'
    }
  }

  // PDF row fill colour (RGB) for each choice bucket.
  const bucketFill = (bucket: ChoiceBucket): [number, number, number] => {
    switch (bucket) {
      case 'aspirational': return [220, 252, 231] // green-100
      case 'matching': return [254, 249, 195]      // yellow-100
      default: return [252, 231, 243]              // pink-100
    }
  }

  // Flatten the grouped (college -> branches) smart results into one entry per
  // college-branch, so each BRANCH gets its own choice number — matching how the
  // PDF numbers them. Ordering: ALL aspirational (reach) choices first, then the
  // student's selected colleges, then the rest — and within each of those groups
  // by closing rank ascending (rank-based) or branchNo (cutoff-based).
  const flattenSmartChoices = (colleges: any[]): { college: any; branch: any }[] => {
    const rankBased = userPreferences.resultType === 'rank'
    const flat = (colleges || []).flatMap((college: any) =>
      [...(college.branches || [])].map((branch: any) => ({ college, branch }))
    )
    const priority = ({ college, branch }: { college: any; branch: any }) => {
      if (branch?.isAspirational) return 0
      if (branch?.isSelected || college?.isSelected) return 1
      return 2
    }
    flat.sort((a, b) => {
      const pa = priority(a)
      const pb = priority(b)
      if (pa !== pb) return pa - pb
      return rankBased
        ? (a.branch.rank || 0) - (b.branch.rank || 0)
        : (a.branch.branchNo || 0) - (b.branch.branchNo || 0)
    })
    return flat
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // For existing users, re-validate the frozen details against rank_list
    // before proceeding to chat.
    if (isNewUser === false) {
      setIsSubmitting(true)
      try {
        const isValid = await validateRankDetails()
        if (!isValid) return

        setUserPreferences(prev => ({
          ...prev,
          name: formData.fullName,
          cutoff: parseFloat(formData.cutoff),
          category: formData.category
        }))
        setStep('chat')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // For new users or undetermined status, show confirmation dialog
    if (isNewUser === true || isNewUser === null) {
      setShowConfirmationDialog(true)
      return
    }
  }

  const handleConfirmStart = async () => {
    setIsSubmitting(true)
    setShowConfirmationDialog(false)

    try {
      console.log('=== STARTING CHOICE FILLING ===')
      console.log('Current URL:', window.location.href)
      console.log('Referral processed state:', referralProcessed)
      
      // Check for referral code in URL or session storage
      let referralCode = searchParams?.get('ref') || 
                        searchParams?.get('referral') || 
                        searchParams?.get('code') || 
                        searchParams?.get('refcode')
      
      // If no referral code in URL, check localStorage
      if (!referralCode) {
        referralCode = localStorage.getItem('referralCode')
        console.log('Referral code from localStorage:', referralCode)
      } else {
        console.log('Referral code from URL:', referralCode)
      }
      
      // Test referral code if it exists
      if (referralCode) {
        await testReferralTracking(referralCode)
      }
      
      // Validate form data
      if (!formData.fullName || !formData.phoneNumber || !formData.email ||
          !formData.dateOfBirth || !formData.cutoff ||
          !formData.category || !formData.rank ||
          (formData.category !== 'OC' && !formData.communityRank)) {
        throw new Error("Please fill in all required fields")
      }

      if (formData.phoneNumber.length !== 10) {
        throw new Error("Phone number must be exactly 10 digits")
      }

      // Only validate roll number if it's provided
      if (formData.rollNumber && formData.rollNumber.length !== 7) {
        throw new Error("Roll number must be exactly 7 digits")
      }

      const rankValue = parseInt(formData.rank)
      if (rankValue < 1 || rankValue > 199900) {
        throw new Error("Rank must be between 1 and 199900")
      }

      // Gate entry to choice filling: the general rank, reservation category and
      // community rank must all match a single row in rank_list. Only then are
      // the details frozen (saved) and the user let into choice filling.
      const detailsValid = await validateRankDetails()
      if (!detailsValid) {
        setIsSubmitting(false)
        return
      }

      // Save user data to database
      console.log('Saving user data...')
      await saveUserData()
      console.log('User data saved successfully')

      // Track referral if not already processed and referral code exists
      if (!referralProcessed && referralCode) {
        console.log('=== PROCESSING REFERRAL ===')
        console.log('Referral code found:', referralCode)
        console.log('User ID:', user?.id)
        console.log('User email:', user?.email)
        console.log('Phone number:', formData.phoneNumber)
        
        try {
          await trackReferral(referralCode)
          setReferralProcessed(true)
          // Clear the referral code from localStorage after successful tracking
          localStorage.removeItem('referralCode')
          console.log('Referral processed successfully and cleared from localStorage')
        } catch (referralError) {
          console.error('Error processing referral:', referralError)
          // Don't block the flow if referral fails
        }
      } else {
        console.log('Referral not processed:', {
          referralProcessed,
          referralCode: !!referralCode,
          hasReferralCode: !!referralCode
        })
      }

      // Update user preferences and move to chat
      setUserPreferences(prev => ({
        ...prev,
        name: formData.fullName,
        cutoff: parseFloat(formData.cutoff),
        category: formData.category
      }))
      setStep('chat')
      console.log('Moving to chat step')

    } catch (error) {
      console.error('Form submission error:', error)
      toast.error(error instanceof Error ? error.message : "Failed to submit form. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Results are generated as soon as the last question is answered — the result
  // type comes from the chosen method (Traditional / Power Score -> cutoff,
  // AI Method -> rank), so we no longer ask "Cutoff or AI Based?" separately.
  //
  // We can't call the generators inline from a handler: they read `userPreferences`
  // from their closure, and preferences set in that same handler (collegeOption,
  // selectedColleges, ...) haven't committed yet. Setting this flag defers the
  // generation to an effect that runs after the state has committed.
  const triggerResultsGeneration = (resultType: 'cutoff' | 'rank') => {
    setPendingResultType(resultType)
  }

  useEffect(() => {
    if (!pendingResultType) return
    const resultType = pendingResultType
    setPendingResultType(null)

    const run = async () => {
      setIsAIProcessing(true)
      const loadingMessage: Message = {
        type: 'bot',
        content: '🤖 AI is working the magic... Please wait while I analyze your preferences and generate the perfect choices for you! ✨'
      }
      setMessages(prev => [...prev, loadingMessage])

      if (resultType === 'rank') {
        await generateRankBasedResults()
      } else {
        await generateResultsBasedOnChoiceType()
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResultType])

  // When the user picks an option their current plan doesn't include, never drop
  // it silently: explain what it is, show the upgrade plans inline, and say what
  // we'll continue with instead so the flow keeps moving.
  const showUpgradeUpsell = (opts: {
    feature: string
    description?: string
    continuingWith: string
  }) => {
    const content = [
      `${opts.feature} isn't available on your current plan.`,
      opts.description,
      `We'll continue with ${opts.continuingWith} for now — upgrade any time to unlock it:`,
    ]
      .filter(Boolean)
      .join(' ')

    const upsellMessage: Message = {
      type: 'bot',
      content,
      showPricingPlans: true
    }
    setMessages(prev => [...prev, upsellMessage])
  }

  const handleChatResponse = async (message: Message, response: string) => {
    // Add user's response to chat
    const userMessage: Message = {
      type: 'user',
      content: response
    }
    setMessages(prev => [...prev, userMessage])

    // Process the response and determine next question
    let nextMessage: Message | null = null

    if (message.content.includes('specific cities')) {
      if (response === 'I have specific cities in mind') {
        nextMessage = {
          type: 'bot',
          content: 'Please select your district preference:',
          options: ['Any 1 District', 'any 2 districts', 'any 3 districts']
        }
      } else {
        // User chose "Any city is fine"
        setUserPreferences(prev => ({ ...prev, cityPreference: 'any' }))
        nextMessage = {
          type: 'bot',
          content: 'Do you have any branches in mind?',
          options: ['Computer Science & Related', 'Circuit Branch & Related', 'Choose specific branches that you want']
        }
      }
    } else if (message.content.includes('district preference')) {
      const option = response.split(':')[0].trim()
      setUserPreferences(prev => ({ 
        ...prev, 
        districtOption: option === 'Any 1 District' ? 'one' : 
                       option === 'any 2 districts' ? 'two' : 'three'
      }))

        setSelectedDistricts([])
        setIsSelectingDistricts(true)
      const selectionLimit = option === 'Any 1 District' ? 1 : 
                            option === 'any 2 districts' ? 2 : 3
      setSelectionLimit(selectionLimit)
        setAvailableOptions(districts)
        setSelectionInProgress(true)

        nextMessage = {
          type: 'bot',
        content: `Please select ${selectionLimit} district${selectionLimit > 1 ? 's' : ''} from the list below:`,
          options: [],
          showDistrictSelection: true,
          availableDistricts: districts
      }
    } else if (isSelectingDistricts && selectionInProgress) {
      // Handle district selection completion
      if (selectedDistricts.length === selectionLimit) {
        setIsSelectingDistricts(false)
        setSelectionInProgress(false)
        setUserPreferences(prev => ({ ...prev, selectedDistricts: selectedDistricts }))
        nextMessage = {
          type: 'bot',
          content: 'Do you have any branches in mind?',
          options: ['Computer Science & Related', 'Circuit Branch & Related', 'Choose specific branches that you want']
        }
      }
    } else if (message.content.includes('branches in mind')) {
      const option = response.split(':')[0].trim()
      setUserPreferences(prev => ({ 
        ...prev, 
        branchOption: option === 'Choose specific branches that you want' ? 'specific' :
                     option === 'Computer Science & Related' ? 'cs' :
                     option === 'Circuit Branch & Related' ? 'circuit' : 'specific'
      }))

      // Get the appropriate branch list based on the option
      const branches = option === 'Computer Science & Related' ? branchCategories.cs :
                      option === 'Circuit Branch & Related' ? branchCategories.circuit :
                      allBranches

      // Only auto-select branches for category options, not for specific selection
      if (option === 'Choose specific branches that you want') {
        setSelectedBranches([]) // Start with no branches selected for specific selection
      } else {
        setSelectedBranches(branches) // Auto-select all branches for category options
      }
      
      setIsSelectingBranches(true)
      setSelectionLimit(option === 'Choose specific branches that you want' ? branches.length : branches.length)
      setSelectionInProgress(true)
      setAvailableOptions(branches)

      nextMessage = {
        type: 'bot',
        content: option === 'Choose specific branches that you want' 
          ? 'Please select the specific branches you are interested in:'
          : `All ${option.toLowerCase()} branches have been selected. You can uncheck any branches you don't want.`,
        options: [],
        showBranchSelection: true,
        availableBranches: branches
      }
    } else if (isSelectingBranches && selectionInProgress) {
      // Only proceed if at least one branch is selected
      if (selectedBranches.length > 0) {
        setIsSelectingBranches(false)
        setSelectionInProgress(false)
        setUserPreferences(prev => ({ ...prev, selectedBranches }))
        
        // First add the options message
        const optionsMessage: Message = {
          type: 'bot',
          content: '',
          showSelectedOptions: true
        }
        
        // Then add the choice type question. Both methods are always shown; if a
        // free-plan user picks Power Score the handler falls back to Traditional
        // and explains why.
        const choiceTypeMessage: Message = {
          type: 'bot',
          content: 'Which method would you like to use for your choices?',
          options: [...CHOICE_METHOD_OPTIONS]
        }
        
        // Add both messages in sequence
        setMessages(prev => [...prev, optionsMessage, choiceTypeMessage])
      } else {
        toast.error('Please select at least one branch')
      }
    } else if (message.content.includes('Yes, proceed to college selection')) {
      // Handle the proceed button click - choice type should already be selected
      // Ask about colleges in mind directly
      nextMessage = {
        type: 'bot',
        content: 'Do you have any specific colleges in mind to add it in your choices?',
        options: ['Yes', 'No']
      }
    } else if (message.content.includes('Which method would you like to use for your choices')) {
      // Options carry a parenthetical description (e.g. "Power Score (…)") — strip
      // it (and any trailing ":") to recover the bare method name.
      const option = response.split(':')[0].split('(')[0].trim()
      // Each method fixes BOTH the engine and the data source, so we no longer ask
      // "Cutoff or AI Based?" separately:
      //   Traditional Method -> traditional engine, cutoff data
      //   Power Score        -> PowerScore ('smart') engine, cutoff data
      //   AI Method          -> PowerScore ('smart') engine, rank data
      let choiceType: 'traditional' | 'smart' = option === 'Traditional Method' ? 'traditional' : 'smart'
      let resultType: 'cutoff' | 'rank' = option === 'AI Method' ? 'rank' : 'cutoff'
      let choiceMethodLabel = option
      // Enforce plan gating. AI Method needs Assured or higher; Power Score needs
      // any paid plan. Both fall back to a cutoff-based method.
      if (option === 'AI Method' && !planAllowsAiMethod(usageData?.planType)) {
        const fallbackToPowerScore = planAllowsPowerScore(usageData?.planType)
        choiceMethodLabel = fallbackToPowerScore ? 'Power Score' : 'Traditional Method'
        choiceType = fallbackToPowerScore ? 'smart' : 'traditional'
        resultType = 'cutoff'
        toast.error(`AI Method needs the Assured plan or higher — continuing with ${choiceMethodLabel}.`)
        showUpgradeUpsell({
          feature: 'AI Method',
          description: 'It gives rank-based results along with the Power Score, and needs the Assured plan or higher.',
          continuingWith: fallbackToPowerScore ? 'Power Score' : 'the Traditional Method',
        })
      } else if (option === 'Power Score' && !planAllowsPowerScore(usageData?.planType)) {
        toast.error('Power Score is available on paid plans — continuing with the Traditional Method.')
        choiceMethodLabel = 'Traditional Method'
        choiceType = 'traditional'
        resultType = 'cutoff'
        showUpgradeUpsell({
          feature: 'Power Score',
          description:
            "It's our placement-focused proprietary score that helps you find better colleges at a lower cutoff.",
          continuingWith: 'the Traditional Method',
        })
      }
      setUserPreferences(prev => ({
        ...prev,
        choiceType,
        choiceMethodLabel,
        resultType
      }))

      // Ask about colleges in mind after choice type selection
      nextMessage = {
        type: 'bot',
        content: 'Do you have any specific colleges in mind to add it in your choices?',
        options: ['Yes', 'No']
      }
    } else if (message.content.includes('specific colleges in mind to add it in your choices')) {
      const option = response.split(':')[0].trim()

      const aspirationalLimit = planAspirationalLimit(usageData?.planType)

      if (option === 'Yes' && aspirationalLimit <= 0) {
        // Aspirational (specific-college) choices are not available on the Free plan
        toast.error('Aspirational choices are available on paid plans — continuing with colleges that match your cutoff.')
        setUserPreferences(prev => ({ ...prev, collegeOption: 'cutoff' }))
        showUpgradeUpsell({
          feature: 'Aspirational choices',
          description: 'They let you hand-pick specific colleges to add to your list.',
          continuingWith: 'colleges that match your cutoff',
        })
        triggerResultsGeneration(userPreferences.resultType ?? 'cutoff')
      } else if (option === 'Yes') {
        // Specific-college selection is capped at 5 (and never more than the
        // plan's aspirational limit).
        const maxSelectable = Math.min(5, aspirationalLimit)
        const options = Array.from({ length: maxSelectable }, (_, i) => i + 1)
          .map((n) => `Select ${n} specific college${n > 1 ? 's' : ''}`)
        nextMessage = {
          type: 'bot',
          content: `How many specific colleges would you like to select? (up to ${maxSelectable})`,
          options
        }
      } else if (option === 'No') {
        // User chose No, so use cutoff-based colleges
        setUserPreferences(prev => ({
          ...prev,
          collegeOption: 'cutoff'
        }))
        triggerResultsGeneration(userPreferences.resultType ?? 'cutoff')
      }
    } else if (message.content.includes('How many specific colleges would you like to select')) {
      const option = response.split(':')[0].trim()
      setUserPreferences(prev => ({
        ...prev,
        collegeOption: 'specific'
      }))

      // Extract the number of colleges to select, clamped to the plan's aspirational limit
      const collegeCountMatch = option.match(/Select (\d+) specific college/)
      const aspirationalLimit = planAspirationalLimit(usageData?.planType)
      const requested = collegeCountMatch ? parseInt(collegeCountMatch[1]) : 5
      const collegeCount = Math.max(1, Math.min(requested, aspirationalLimit || 5))

      if (option.includes('Select') && option.includes('specific college')) {
        setIsSelectingColleges(true)
        setUserPreferences(prev => ({ ...prev, requiredCollegeCount: collegeCount }))
        try {
          await fetchColleges()
          nextMessage = {
            type: 'bot',
            content: `Please select ${collegeCount} college${collegeCount > 1 ? 's' : ''} from the list below. You can search for colleges by name or code.`,
            options: [],
            showCollegeSelection: true
          }
        } catch (error) {
          console.error('Error in college selection:', error)
          toast.error('Failed to load colleges. Please try again.')
          nextMessage = {
            type: 'bot',
            content: 'Sorry, there was an error loading the colleges. Please try again.',
            options: ['Yes', 'No']
          }
          setIsSelectingColleges(false)
        }
      }
    } else if (message.content.includes('colleges in mind')) {
      // This is the old logic - keeping for backward compatibility but it should not be reached
      const option = response.split(':')[0].trim()
      setUserPreferences(prev => ({ 
        ...prev, 
        collegeOption: option === 'Colleges that match my Cutoff' ? 'cutoff' : 'specific'
      }))

      // Extract the number of colleges to select from the option
      const collegeCountMatch = option.match(/Select (\d+) specific college/)
      const collegeCount = collegeCountMatch ? parseInt(collegeCountMatch[1]) : 5

      if (option.includes('Select') && option.includes('specific college')) {
        setIsSelectingColleges(true)
        setUserPreferences(prev => ({ ...prev, requiredCollegeCount: collegeCount }))
        try {
          await fetchColleges()
          nextMessage = {
            type: 'bot',
            content: `Please select ${collegeCount} college${collegeCount > 1 ? 's' : ''} from the list below. You can search for colleges by name or code.`,
            options: [],
            showCollegeSelection: true
          }
        } catch (error) {
          console.error('Error in college selection:', error)
          toast.error('Failed to load colleges. Please try again.')
          nextMessage = {
            type: 'bot',
            content: 'Sorry, there was an error loading the colleges. Please try again.',
            options: [
              'Colleges that match my Cutoff',
              'Select 1 specific college',
              'Select 2 specific colleges', 
              'Select 3 specific colleges',
              'Select 4 specific colleges',
              'Select 5 specific colleges'
            ]
          }
          setIsSelectingColleges(false)
        }
      } else {
        triggerResultsGeneration(userPreferences.resultType ?? 'cutoff')
      }
    } else if (isSelectingColleges) {
      const requiredCount = userPreferences.requiredCollegeCount || 5
      if (selectedCollegeCodes.length === requiredCount) {
        setIsSelectingColleges(false)
        setUserPreferences(prev => ({ ...prev, selectedColleges: selectedCollegeCodes }))
        triggerResultsGeneration(userPreferences.resultType ?? 'cutoff')
      }
    } else if (message.content.includes('college codes')) {
      // Handle college selection
      const selectedColleges = response.split(',').map(c => c.trim())
      setUserPreferences(prev => ({ ...prev, selectedColleges }))
      triggerResultsGeneration(userPreferences.resultType ?? 'cutoff')
    }

    if (nextMessage) {
      setMessages(prev => [...prev, nextMessage!])
    }
  }

  const fetchNullCutoffColleges = async (resultType: 'cutoff' | 'rank', userPreferences: UserPreferences, usage: any) => {
    try {
      console.log('=== Fetching colleges with null cutoff values ===')
      
      const tableName = resultType === 'rank' ? 'Rank' : 'Cutoff'
      const categoryField = userPreferences.category
      
      // Base query to get colleges with null cutoff values
      let query = supabase
        .from(tableName)
        .select(`
          "College Code",
          "College Name",
          "Branch Name",
          "BranchNo",
          "${categoryField}",
          "District",
          "avgMedianSalary",
          "avgPlacementPercentage",
          "avgPassingPercentage",
          "PowerScore"
        `)
        .is(categoryField, null)
        .not('avgPlacementPercentage', 'is', null)
        .not('PowerScore', 'is', null)
        .not('avgPassingPercentage', 'is', null)

      // Apply branch filter if specified
      if (userPreferences.selectedBranches.length > 0) {
        console.log('Applying branch filter for null colleges:', userPreferences.selectedBranches)
        
        // For null colleges, we'll use a simpler approach - filter after fetching
        // since Supabase doesn't support complex OR conditions easily
      }

      // Apply district filter if specified
      if (userPreferences.selectedDistricts.length > 0) {
        console.log('Applying district filter for null colleges:', userPreferences.selectedDistricts)
        query = query.in('District', userPreferences.selectedDistricts)
      }

      const { data: nullData, error } = await query

      if (error) {
        console.error('Error fetching null cutoff colleges:', error)
        return []
      }

      if (!nullData || nullData.length === 0) {
        console.log('No colleges found with null cutoff values')
        return []
      }

      console.log(`Found ${nullData.length} colleges with null cutoff values`)

      // Transform results
      let transformedResults = nullData.map(item => ({
        code: item['College Code']?.toString().trim() || '',
        name: item['College Name']?.toString().trim() || '',
        branch: item['Branch Name']?.toString().trim() || '',
        branchNo: Number(item['BranchNo']) || 999,
        cutoff: resultType === 'cutoff' ? parseFloat(item[categoryField]) || 0 : 0,
        rank: resultType === 'rank' ? parseFloat(item[categoryField]) || 0 : 0,
        medianSalary: parseFloat(item['avgMedianSalary']) || 0,
        placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
        passingPercentage: parseFloat(item['avgPassingPercentage']) || 0,
        powerScore: parseFloat(item['PowerScore']) || 0,
        district: item['District']?.toString().trim() || '',
        category: userPreferences.category,
        isSelected: false,
        isNullCollege: true // Mark as null college
      }))

      // Apply branch filter if specified
      if (userPreferences.selectedBranches.length > 0) {
        console.log('Filtering null colleges by selected branches:', userPreferences.selectedBranches)
        transformedResults = transformedResults.filter(college => {
          return userPreferences.selectedBranches.some(selectedBranch => {
            const baseBranch = selectedBranch.trim()
            if (userPreferences.branchOption === 'specific') {
              return college.branch.toLowerCase().includes(baseBranch.toLowerCase())
            } else {
              return college.branch.toLowerCase().includes(baseBranch.toLowerCase())
            }
          })
        })
        console.log(`After branch filtering: ${transformedResults.length} null colleges`)
      }

      // Apply district filter if specified
      if (userPreferences.selectedDistricts.length > 0) {
        console.log('Filtering null colleges by selected districts:', userPreferences.selectedDistricts)
        transformedResults = transformedResults.filter(college => 
          userPreferences.selectedDistricts.includes(college.district)
        )
        console.log(`After district filtering: ${transformedResults.length} null colleges`)
      }

      // Sort by PowerScore for better quality colleges
      const sortedResults = transformedResults
        .sort((a, b) => b.powerScore - a.powerScore)
        .slice(0, usage.maxChoices || 5) // Limit based on user's plan

      console.log(`Returning ${sortedResults.length} null colleges after filtering and sorting`)
      return sortedResults

    } catch (error) {
      console.error('Error in fetchNullCutoffColleges:', error)
      return []
    }
  }

  const generateResultsBasedOnChoiceType = async () => {
    try {
      console.log('=== DEBUG: generateResultsBasedOnChoiceType called ===')
      
      // Check usage and apply restrictions BEFORE generating results
      if (!user?.id || !user?.email) {
        toast.error('User not authenticated. Please sign in again.')
        return
      }

      // Check current usage status
      const usageResponse = await fetch('/api/check-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id, 
          email: user.email 
        }),
      })

      if (!usageResponse.ok) {
        toast.error('Failed to check usage status. Please try again.')
        return
      }

      const usageData = await usageResponse.json()
      if (!usageData.success) {
        toast.error(usageData.error || 'Failed to check usage status.')
        return
      }

      const { usage } = usageData
      console.log('Current usage status:', usage)

      // Check if user can use the service
      if (!usage.canUse) {
        setShowUsageModal(true)
        return
      }

      // Track usage BEFORE generating results
      const newSessionId = generateUsageSessionId()
      try {
        await fetch('/api/track-usage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            sessionId: newSessionId,
            choicesGenerated: 0, // Will be updated after results are generated
            pdfDownloaded: false
          }),
        })
      } catch (error) {
        console.error('Error tracking usage:', error)
        // Don't block the user if tracking fails
      }

      console.log('userPreferences:', userPreferences)
      console.log('resultType:', userPreferences.resultType)
      console.log('formData.rank:', formData.rank)
      
      // Check if user wants rank-based results
      if (userPreferences.resultType === 'rank') {
        console.log('=== DEBUG: Calling generateRankBasedResults ===')
        await generateRankBasedResults()
        return
      }

      console.log('=== DEBUG: Using cutoff-based logic ===')
      let allResults: any[] = []
      
      // Use override if provided, otherwise use userPreferences
      const collegesToUse = userPreferences.selectedColleges.length > 0 ? userPreferences.selectedColleges : userPreferences.selectedColleges
      const branchesToUse = userPreferences.selectedBranches
      
      // Debug: Log selected colleges and branches
      console.log('Debug - Selected colleges:', collegesToUse)
      console.log('Debug - Selected branches:', branchesToUse)
      console.log('Debug - Selected colleges length:', collegesToUse.length)
      console.log('Debug - Selected branches length:', branchesToUse.length)
      
      // First, fetch selected colleges with their specific branches (irrespective of cutoff)
      if (collegesToUse.length > 0 && branchesToUse.length > 0) {
        console.log('Fetching selected colleges with specific branches...')
        
        try {
          // Create queries for each selected college and branch combination
          const selectedCollegeQueries = collegesToUse.map(async (collegeCode) => {
            console.log(`Debug - Processing college code: ${collegeCode}`)
            const branchQueries = branchesToUse.map(async (branch) => {
              const baseBranch = branch.trim()
              console.log(`Debug - Processing branch: ${baseBranch} for college: ${collegeCode}`)
              
              try {
                const queryCollegeCode = collegeCode.toUpperCase()
                console.log(`Debug - Querying with college code: "${queryCollegeCode}" and branch: "${baseBranch}"`)
                
                const { data: selectedData, error } = await supabase
                  .from('Cutoff')
                  .select(`
                    "College Code",
                    "College Name",
                    "Branch Name",
                    "BranchNo",
                    "${userPreferences.category}",
                    "District",
                    "avgMedianSalary",
                    "avgPlacementPercentage",
                    "PowerScore"
                  `)
                  .eq('College Code', queryCollegeCode)
                  .ilike('Branch Name', `%${baseBranch}%`)

                if (error) {
                  console.error('Database query error for selected college:', error)
                  return []
                }

                console.log(`Debug - Found ${selectedData?.length || 0} records for college ${queryCollegeCode} branch ${baseBranch}`)
                if (selectedData && selectedData.length > 0) {
                  console.log('Debug - Sample data:', selectedData[0])
                } else {
                  console.log('Debug - No data found for this combination')
                }

                if (!selectedData || selectedData.length === 0) {
                  return []
                }

                // Transform results and mark as selected
                return selectedData.map(item => ({
                  code: item['College Code']?.toString().trim() || '',
                  name: item['College Name']?.toString().trim() || '',
                  branch: item['Branch Name']?.toString().trim() || '',
                  branchNo: Number(item['BranchNo']) || 999,
                  cutoff: parseFloat(item[userPreferences.category]) || 0,
                  medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                  placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                  powerScore: parseFloat(item['PowerScore']) || 0,
                  district: item['District']?.toString().trim() || '',
                  category: userPreferences.category,
                  isSelected: true // Mark as selected
                }))
              } catch (error) {
                console.error(`Error processing selected college ${collegeCode} branch ${baseBranch}:`, error)
                return []
              }
            })

            const branchResults = await Promise.all(branchQueries)
            return branchResults.flat()
          })

          const selectedCollegeResults = await Promise.all(selectedCollegeQueries)
          const selectedResults = selectedCollegeResults.flat()
          
          console.log('Selected college results:', selectedResults.length)
          console.log('Debug - Selected results sample:', selectedResults.slice(0, 2))
          allResults = [...selectedResults]
        } catch (error) {
          console.error('Error fetching selected colleges:', error)
        }
      } else {
        console.log('Debug - No selected colleges or branches to process')
        console.log('Debug - Selected colleges length:', collegesToUse.length)
        console.log('Debug - Selected branches length:', branchesToUse.length)
      }

      // NEW AI METHOD LOGIC: Fetch all colleges below cutoff, then filter by PowerScore
      if (userPreferences.choiceType === 'smart') {
        console.log('=== AI METHOD: Fetching all colleges below cutoff, then filtering by PowerScore ===')
        
        if (userPreferences.selectedBranches.length > 0) {
          console.log('Filtering by branches:', userPreferences.selectedBranches)
          
          try {
            // Create separate queries for each branch and combine results
            const branchQueries = userPreferences.selectedBranches.map(async (branch) => {
              const baseBranch = branch.trim()
              console.log('AI Method - Querying for branch:', baseBranch, 'with cutoff:', userPreferences.cutoff)
              
              try {
                console.log(`DEBUG - User cutoff: ${userPreferences.cutoff}, Category: ${userPreferences.category}`)
                
                // For AI method: Get ALL colleges below cutoff (no limit initially)
                const cutoffCollegesQuery = supabase
                  .from('Cutoff')
                  .select(`
                    "College Code",
                    "College Name",
                    "Branch Name",
                    "BranchNo",
                    "${userPreferences.category}",
                    "District",
                    "avgMedianSalary",
                    "avgPlacementPercentage",
                    "PowerScore"
                  `)
                  .ilike('Branch Name', `%${baseBranch}%`)
                  .lt(`"${userPreferences.category}"`, userPreferences.cutoff)
                  .gt(`"${userPreferences.category}"`, 0)
                  .not(`"${userPreferences.category}"`, 'is', null)
                  .gt('PowerScore', 0)

                // Apply district filter if specified
                if (userPreferences.selectedDistricts.length > 0) {
                  console.log('Applying district filter:', userPreferences.selectedDistricts)
                  cutoffCollegesQuery.in('District', userPreferences.selectedDistricts)
                }

                // Execute query to get ALL colleges below cutoff
                const { data: cutoffData, error } = await cutoffCollegesQuery

                if (error) {
                  console.error('Database query error:', error)
                  throw new Error(`Database query failed: ${error.message}`)
                }

                if (!cutoffData || cutoffData.length === 0) {
                  console.log(`No colleges found below cutoff ${userPreferences.cutoff} for branch ${baseBranch}`)
                  return []
                }

                console.log(`AI Method - Found ${cutoffData.length} colleges below cutoff for branch ${baseBranch}`)

                // Transform results and filter to ensure only colleges below user cutoff
                const transformedResults = cutoffData
                  .map(item => {
                    console.log('DEBUG - AI Method - Raw database item:', item)
                    console.log('DEBUG - AI Method - Category field value:', item[userPreferences.category], 'type:', typeof item[userPreferences.category])
                    console.log('DEBUG - AI Method - User cutoff:', userPreferences.cutoff, 'type:', typeof userPreferences.cutoff)
                    console.log('DEBUG - AI Method - Is cutoff below user cutoff?', parseFloat(item[userPreferences.category]) < userPreferences.cutoff)
                    
                    return {
                      code: item['College Code']?.toString().trim() || '',
                      name: item['College Name']?.toString().trim() || '',
                      branch: item['Branch Name']?.toString().trim() || '',
                      branchNo: Number(item['BranchNo']) || 999,
                      cutoff: parseFloat(item[userPreferences.category]) || 0,
                      medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                      placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                      powerScore: parseFloat(item['PowerScore']) || 0,
                      district: item['District']?.toString().trim() || '',
                      category: userPreferences.category,
                      isSelected: false
                    }
                  })
                  .filter(item => {
                    // Additional safety filter: ensure cutoff is below user's cutoff
                    const isValid = item.cutoff < userPreferences.cutoff && item.cutoff > 0
                    if (!isValid) {
                      console.log(`DEBUG - AI Method - Filtering out college ${item.name} with cutoff ${item.cutoff} (user cutoff: ${userPreferences.cutoff})`)
                    }
                    return isValid
                  })

                // For AI method: Sort by PowerScore (descending) and take top colleges based on plan
                const maxChoices = usage.maxChoices || 5 // Default to freemium limit
                const sortedByPowerScore = transformedResults
                  .sort((a, b) => b.powerScore - a.powerScore)
                  .slice(0, maxChoices)

                console.log(`AI Method - After PowerScore filtering: ${sortedByPowerScore.length} colleges for branch ${baseBranch}`)
                return sortedByPowerScore
              } catch (error) {
                console.error(`Error processing branch ${baseBranch}:`, error)
                return []
              }
            })

            // Execute all branch queries in parallel
            const branchResults = await Promise.all(branchQueries)
            
            // Combine and deduplicate results
            const uniqueResults = Array.from(
              new Map(
                branchResults
                  .flat()
                  .map(item => [
                    `${item.code}-${item.branch}`,
                    item
                  ])
              ).values()
            )
            .sort((a, b) => b.powerScore - a.powerScore) // Sort by PowerScore for AI method
            .slice(0, usage.maxChoices || 5) // Limit based on user's plan

            console.log('AI Method - Total unique results after PowerScore filtering:', uniqueResults.length)
            allResults = [...allResults, ...uniqueResults]

          } catch (error) {
            console.error('Detailed error in AI method branch queries:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch college results'
            toast.error(errorMessage)
            const errorBotMessage: Message = {
              type: 'bot',
              content: `Sorry, there was an error: ${errorMessage}. Please try adjusting your criteria or selecting different branches.`
            }
            setMessages(prev => [...prev, errorBotMessage])
            return
          }
        } else {
          // If no branches selected, get ALL colleges below cutoff
          console.log('AI Method - No specific branches selected, getting all colleges below cutoff')
          
          try {
            console.log(`DEBUG - No branches - User cutoff: ${userPreferences.cutoff}, Category: ${userPreferences.category}`)
            
            let query = supabase
              .from('Cutoff')
              .select(`
                "College Code",
                "College Name",
                "Branch Name",
                "${userPreferences.category}",
                "District",
                "avgMedianSalary",
                "avgPlacementPercentage",
                "PowerScore"
              `)
              .lt(`"${userPreferences.category}"`, userPreferences.cutoff) // Get ALL colleges below cutoff
              .gt(`"${userPreferences.category}"`, 0)
              .not(`"${userPreferences.category}"`, 'is', null)
              .gt('PowerScore', 0)

            // Apply district filter if specified
            if (userPreferences.selectedDistricts.length > 0) {
              console.log('Applying district filter:', userPreferences.selectedDistricts)
              query = query.in('District', userPreferences.selectedDistricts)
            }

            // Execute the query to get ALL colleges
            console.log('AI Method - Executing query for all colleges below cutoff...')
            let { data: cutoffData, error } = await query

            if (error) {
              console.error('Query execution error:', error)
              throw new Error(`Database query failed: ${error.message}`)
            }

            if (!cutoffData || cutoffData.length === 0) {
              throw new Error('No colleges found below your cutoff. Please try adjusting your criteria.')
            }

            console.log(`AI Method - Found ${cutoffData.length} total colleges below cutoff`)

            // Transform the data for display and filter to ensure only colleges below user cutoff
            const regularResults = cutoffData
              .map(item => {
                console.log('DEBUG - No branches - Raw database item:', item)
                console.log('DEBUG - No branches - Category field value:', item[userPreferences.category], 'type:', typeof item[userPreferences.category])
                console.log('DEBUG - No branches - User cutoff:', userPreferences.cutoff, 'type:', typeof userPreferences.cutoff)
                console.log('DEBUG - No branches - Is cutoff below user cutoff?', parseFloat(item[userPreferences.category]) < userPreferences.cutoff)
                
                return {
                  code: item['College Code']?.toString().trim() || '',
                  name: item['College Name']?.toString().trim() || '',
                  branch: item['Branch Name']?.toString().trim() || '',
                  cutoff: parseFloat(item[userPreferences.category]) || 0,
                  medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                  placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                  powerScore: parseFloat(item['PowerScore']) || 0,
                  district: item['District']?.toString().trim() || '',
                  category: userPreferences.category,
                  isSelected: false
                }
              })
              .filter(item => {
                // Additional safety filter: ensure cutoff is below user's cutoff
                const isValid = item.cutoff < userPreferences.cutoff && item.cutoff > 0
                if (!isValid) {
                  console.log(`DEBUG - No branches - Filtering out college ${item.name} with cutoff ${item.cutoff} (user cutoff: ${userPreferences.cutoff})`)
                }
                return isValid
              })
              .sort((a, b) => b.powerScore - a.powerScore) // Sort by PowerScore for AI method
              .slice(0, usage.maxChoices || 5) // Take top colleges based on user's plan

            console.log('AI Method - After PowerScore filtering:', regularResults.length)
            allResults = [...allResults, ...regularResults]
          } catch (error) {
            console.error('Error in AI method all colleges query:', error)
            throw error
          }
        }
      } else {
        // TRADITIONAL METHOD LOGIC (unchanged)
        if (userPreferences.selectedBranches.length > 0) {
          console.log('Filtering by branches:', userPreferences.selectedBranches)
          
          try {
            // Create separate queries for each branch and combine results
            const branchQueries = userPreferences.selectedBranches.map(async (branch) => {
              const baseBranch = branch.trim()
              console.log('Traditional Method - Querying for branch:', baseBranch, 'with cutoff:', userPreferences.cutoff)
              
              try {
                // First, check if this branch has any colleges within cutoff range
                const cutoffCheckQuery = await supabase
                .from('Cutoff')
                  .select(`"${userPreferences.category}"`)
                  .ilike('Branch Name', `%${baseBranch}%`)
                  .lt(`"${userPreferences.category}"`, userPreferences.cutoff)
                  .limit(1)

                // If no colleges found below cutoff, skip this branch
                if (!cutoffCheckQuery.data || cutoffCheckQuery.data.length === 0) {
                  console.log(`Skipping branch ${baseBranch} as no colleges found below cutoff ${userPreferences.cutoff}`)
                  return []
                }

                console.log(`DEBUG - User cutoff: ${userPreferences.cutoff}, Category: ${userPreferences.category}`)
                
                // For traditional choices, get colleges below cutoff with limit
                const cutoffCollegesQuery = supabase
                  .from('Cutoff')
                  .select(`
                    "College Code",
                    "College Name",
                    "Branch Name",
                    "BranchNo",
                    "${userPreferences.category}",
                    "District",
                    "avgMedianSalary",
                    "avgPlacementPercentage",
                    "PowerScore"
                  `)
                  .ilike('Branch Name', `%${baseBranch}%`)
                  .lt(`"${userPreferences.category}"`, userPreferences.cutoff)
                  .gt(`"${userPreferences.category}"`, 0)
                  .not(`"${userPreferences.category}"`, 'is', null)
                  .gt('PowerScore', 0)
                  .order(`"${userPreferences.category}"`, { ascending: true })
                  .limit(usage.maxChoices || 5) // Limit based on user's plan

                // Apply district filter if specified
                if (userPreferences.selectedDistricts.length > 0) {
                  console.log('Applying district filter:', userPreferences.selectedDistricts)
                  cutoffCollegesQuery.in('District', userPreferences.selectedDistricts)
                }

                // Execute query
                const { data: cutoffData, error } = await cutoffCollegesQuery

                if (error) {
                  console.error('Database query error:', error)
                  throw new Error(`Database query failed: ${error.message}`)
                }

                if (!cutoffData || cutoffData.length === 0) {
                  return [] // Return empty array instead of throwing error
                }

                // Transform results and filter to ensure only colleges below user cutoff
                return cutoffData
                  .map(item => {
                    console.log('DEBUG - Raw database item:', item)
                    console.log('DEBUG - Category field value:', item[userPreferences.category], 'type:', typeof item[userPreferences.category])
                    console.log('DEBUG - User cutoff:', userPreferences.cutoff, 'type:', typeof userPreferences.cutoff)
                    console.log('DEBUG - Is cutoff below user cutoff?', parseFloat(item[userPreferences.category]) < userPreferences.cutoff)
                    console.log('DEBUG - avgMedianSalary:', item['avgMedianSalary'], 'type:', typeof item['avgMedianSalary'])
                    console.log('DEBUG - avgPlacementPercentage:', item['avgPlacementPercentage'], 'type:', typeof item['avgPlacementPercentage'])
                    console.log('DEBUG - PowerScore:', item['PowerScore'], 'type:', typeof item['PowerScore'])
                    
                    const transformed = {
                    code: item['College Code']?.toString().trim() || '',
                    name: item['College Name']?.toString().trim() || '',
                    branch: item['Branch Name']?.toString().trim() || '',
                    branchNo: Number(item['BranchNo']) || 999,
                    cutoff: parseFloat(item[userPreferences.category]) || 0,
                    medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                    placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                    powerScore: parseFloat(item['PowerScore']) || 0,
                    district: item['District']?.toString().trim() || '',
                    category: userPreferences.category,
                    isSelected: false
                    }
                    
                    console.log('DEBUG - Transformed item:', transformed)
                    return transformed
                  })
                  .filter(item => {
                    // Additional safety filter: ensure cutoff is below user's cutoff
                    const isValid = item.cutoff < userPreferences.cutoff && item.cutoff > 0
                    if (!isValid) {
                      console.log(`DEBUG - Filtering out college ${item.name} with cutoff ${item.cutoff} (user cutoff: ${userPreferences.cutoff})`)
                    }
                    return isValid
                  })
              } catch (error) {
                console.error(`Error processing branch ${baseBranch}:`, error)
                return [] // Return empty array instead of throwing error
              }
            })

            // Execute all branch queries in parallel
            const branchResults = await Promise.all(branchQueries)
            
            // Combine and deduplicate results
            const uniqueResults = Array.from(
              new Map(
                branchResults
                  .flat()
                  .map(item => [
                    `${item.code}-${item.branch}`,
                    item
                  ])
              ).values()
            )
            .sort((a, b) => {
              // Sort by cutoff first (descending)
              if (a.cutoff !== b.cutoff) {
                return b.cutoff - a.cutoff
              }
              // Then by power score
                return b.powerScore - a.powerScore
            })
            .slice(0, usage.maxChoices || 5) // Limit based on user's plan

            console.log('Traditional Method - Total unique results:', uniqueResults.length)

          // Add regular results to allResults
          allResults = [...allResults, ...uniqueResults]

        } catch (error) {
          console.error('Detailed error in branch queries:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch college results'
          toast.error(errorMessage)
          const errorBotMessage: Message = {
            type: 'bot',
            content: `Sorry, there was an error: ${errorMessage}. Please try adjusting your criteria or selecting different branches.`
          }
          setMessages(prev => [...prev, errorBotMessage])
          return
        }
      } else {
        // If no branches selected, proceed with original query but with cutoff filter
        console.log('Building query for cutoff range colleges...')
        let query = supabase
          .from('Cutoff')
          .select(`
            "College Code",
            "College Name",
            "Branch Name",
            "${userPreferences.category}",
            "District",
            "avgMedianSalary",
            "avgPlacementPercentage",
            "PowerScore"
          `)
          .lt(`"${userPreferences.category}"`, userPreferences.cutoff) // Only get colleges below cutoff
          .gt('PowerScore', 0)
          .order(`"${userPreferences.category}"`, { ascending: true }) // Order by cutoff ascending
          .limit(usage.maxChoices || 5) // Limit based on user's plan

        // Apply district filter if specified
        if (userPreferences.selectedDistricts.length > 0) {
          console.log('Applying district filter:', userPreferences.selectedDistricts)
          query = query.in('District', userPreferences.selectedDistricts)
        }

        // Execute the query
        console.log('Executing final query...')
        let { data: cutoffData, error } = await query

        if (error) {
          console.error('Query execution error:', error)
          throw new Error(`Database query failed: ${error.message}`)
        }

        if (!cutoffData || cutoffData.length === 0) {
          throw new Error('No colleges found below your cutoff. Please try adjusting your criteria.')
        }

        // Transform the data for display
        const regularResults = cutoffData.map(item => {
          console.log('DEBUG - Regular results raw item:', item)
          console.log('DEBUG - Regular avgMedianSalary:', item['avgMedianSalary'], 'type:', typeof item['avgMedianSalary'])
          console.log('DEBUG - Regular avgPlacementPercentage:', item['avgPlacementPercentage'], 'type:', typeof item['avgPlacementPercentage'])
          console.log('DEBUG - Regular PowerScore:', item['PowerScore'], 'type:', typeof item['PowerScore'])
          
          const transformed = {
            code: item['College Code']?.toString().trim() || '',
            name: item['College Name']?.toString().trim() || '',
            branch: item['Branch Name']?.toString().trim() || '',
            cutoff: parseFloat(item[userPreferences.category]) || 0,
            medianSalary: parseFloat(item['avgMedianSalary']) || 0,
            placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
            powerScore: parseFloat(item['PowerScore']) || 0,
            district: item['District']?.toString().trim() || '',
            category: userPreferences.category,
            isSelected: false
          }
          
          console.log('DEBUG - Regular transformed item:', transformed)
          return transformed
        })
        .sort((a, b) => {
          // Sort by cutoff first (descending)
          if (a.cutoff !== b.cutoff) {
            return b.cutoff - a.cutoff
          }
          // Then by power score
          return b.powerScore - a.powerScore
        })

        console.log('Regular results count:', regularResults.length)
        allResults = [...allResults, ...regularResults]
      }
      }

      // Remove duplicates based on college code and branch
      const uniqueAllResults = Array.from(
        new Map(
          allResults.map(item => [
            `${item.code}-${item.branch}`,
            item
          ])
        ).values()
      )

      console.log('Debug - Total unique results before sorting:', uniqueAllResults.length)
      console.log('Debug - Selected colleges in results:', uniqueAllResults.filter(item => item.isSelected).length)

      // Filter out colleges with missing placement and salary data (same as rank-based logic)
      const dataFilteredResults = uniqueAllResults.filter(result => {
        // Selected colleges should be included regardless of data availability
        if (result.isSelected) {
          return true
        }
        // Non-selected colleges should have both placement percentage and median salary data
        return result.placementPercentage > 0 && result.medianSalary > 0
      })

      console.log('Data filtered results (with placement & salary data):', dataFilteredResults.length)
      console.log('Selected colleges in results:', dataFilteredResults.filter(r => r.isSelected).length)
      console.log('Non-selected colleges in results:', dataFilteredResults.filter(r => !r.isSelected).length)

      // Sort results based on choice type
      let sortedResults
      if (userPreferences.choiceType === 'smart') {
        // For AI method: Sort by PowerScore (descending)
        sortedResults = dataFilteredResults.sort((a, b) => {
          // Selected colleges come first
          if (a.isSelected && !b.isSelected) return -1
          if (!a.isSelected && b.isSelected) return 1
          
          // Then sort by PowerScore (descending)
          return b.powerScore - a.powerScore
        })
      } else {
        // For traditional method: Sort by cutoff (descending)
        sortedResults = dataFilteredResults.sort((a, b) => {
        // Selected colleges come first
        if (a.isSelected && !b.isSelected) return -1
        if (!a.isSelected && b.isSelected) return 1
        
        // Then sort by cutoff (descending)
        return b.cutoff - a.cutoff
      })
      }

      // Limit results based on user's plan
      const maxChoices = usage.maxChoices || 5 // Default to freemium limit
      let limitedResults = sortedResults.slice(0, maxChoices)
      limitedResults = await withAspirationalReach(limitedResults, maxChoices, 'cutoff')
      
      console.log(`Limiting results to ${maxChoices} colleges based on user plan (${usage.planType})`)
      console.log(`Current results count: ${limitedResults.length}`)

      // Check if user got enough colleges based on their plan
      if (limitedResults.length < maxChoices) {
        console.log(`User only got ${limitedResults.length} colleges, need ${maxChoices}. Fetching null colleges to supplement.`)
        
        // Fetch null colleges to supplement the results
        const nullColleges = await fetchNullCutoffColleges('cutoff', userPreferences, usage)
        
        if (nullColleges.length > 0) {
          console.log(`Adding ${nullColleges.length} null colleges to supplement results`)
          
          // Combine existing results with null colleges
          const combinedResults = [...limitedResults, ...nullColleges]
          
          // Remove duplicates and limit to maxChoices
          const uniqueCombinedResults = Array.from(
            new Map(
              combinedResults.map(item => [
                `${item.code}-${item.branch}`,
                item
              ])
            ).values()
          ).slice(0, maxChoices)
          
          limitedResults = uniqueCombinedResults
          console.log(`Final results count after adding null colleges: ${limitedResults.length}`)
        }
      }

      // Group results by branches
      const groupedResults = groupCollegesByBranches(limitedResults)

      // Check if null colleges are present in the results
      const hasNullColleges = limitedResults.some(college => college.isNullCollege)
      
      // Fetch trend rate for the computed results before displaying.
      const displayResults = await enrichResultsWithTrendRate(
        userPreferences.choiceType === 'traditional' ? limitedResults : groupedResults
      )

      // Add results message to chat
      const resultsMessage: Message = {
        type: 'bot',
        content: hasNullColleges
          ? `Based on your rank and last year's TNEA + NIRF data, we've identified colleges that had seats available previously. While it may be a close call, these suggestions are smart backup options to help you explore every possible opportunity with confidence!\n\nHere are your ${userPreferences.choiceType === 'traditional' ? 'traditional' : (userPreferences.choiceMethodLabel || 'Power Score')} choice filling results:`
          : `Here are your ${userPreferences.choiceType === 'traditional' ? 'traditional' : (userPreferences.choiceMethodLabel || 'Power Score')} choice filling results:`,
        results: displayResults
      }

            setMessages(prev => [...prev, resultsMessage])
            console.log('DEBUG - Setting collegeResults for AI method:', displayResults)
            console.log('DEBUG - Sample collegeResults item:', displayResults[0])
            setCollegeResults(displayResults)
            
            // Stop AI processing loading state
            setIsAIProcessing(false)

          } catch (error) {
      console.error('Detailed error in college results:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch college results'
            toast.error(errorMessage)
            const errorBotMessage: Message = {
              type: 'bot',
        content: `Sorry, there was an error: ${errorMessage}. Please try again with different criteria.`
            }
            setMessages(prev => [...prev, errorBotMessage])
            
            // Stop AI processing loading state on error too
            setIsAIProcessing(false)
          }
        }

  const generateResultsBasedOnChoiceTypeWithColleges = async (selectedColleges: string[]) => {
    try {
      console.log('Debug - generateResultsBasedOnChoiceTypeWithColleges called with:', selectedColleges)
      
      // Check usage and apply restrictions BEFORE generating results
      if (!user?.id || !user?.email) {
        toast.error('User not authenticated. Please sign in again.')
        return
      }

      // Check current usage status
      const usageResponse = await fetch('/api/check-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id, 
          email: user.email 
        }),
      })

      if (!usageResponse.ok) {
        toast.error('Failed to check usage status. Please try again.')
        return
      }

      const usageData = await usageResponse.json()
      if (!usageData.success) {
        toast.error(usageData.error || 'Failed to check usage status.')
        return
      }

      const { usage } = usageData
      console.log('Current usage status:', usage)

      // Check if user can use the service
      if (!usage.canUse) {
        setShowUsageModal(true)
        return
      }

      // Track usage BEFORE generating results
      const newSessionId = generateUsageSessionId()
      try {
        await fetch('/api/track-usage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            sessionId: newSessionId,
            choicesGenerated: 0, // Will be updated after results are generated
            pdfDownloaded: false
          }),
        })
      } catch (error) {
        console.error('Error tracking usage:', error)
        // Don't block the user if tracking fails
      }
      
      console.log('Debug - selectedColleges length:', selectedColleges.length)
      console.log('Debug - selectedColleges type:', typeof selectedColleges)
      console.log('Debug - selectedColleges is array:', Array.isArray(selectedColleges))
      
      let allResults: any[] = []
      
      // Debug: Log selected colleges and branches
      console.log('Debug - Selected colleges (override):', selectedColleges)
      console.log('Debug - Selected branches:', userPreferences.selectedBranches)
      console.log('Debug - Selected colleges length:', selectedColleges.length)
      console.log('Debug - Selected branches length:', userPreferences.selectedBranches.length)
      
      // First, fetch selected colleges with their specific branches (irrespective of cutoff)
      if (selectedColleges.length > 0 && userPreferences.selectedBranches.length > 0) {
        console.log('Fetching selected colleges with specific branches...')
        
        try {
          // Create queries for each selected college and branch combination
          const selectedCollegeQueries = selectedColleges.map(async (collegeCode) => {
            console.log(`Debug - Processing college code: ${collegeCode}`)
            const branchQueries = userPreferences.selectedBranches.map(async (branch) => {
              const baseBranch = branch.trim()
              console.log(`Debug - Processing branch: ${baseBranch} for college: ${collegeCode}`)
              
              try {
                const queryCollegeCode = collegeCode.toUpperCase()
                console.log(`Debug - Querying with college code: "${queryCollegeCode}" and branch: "${baseBranch}"`)
                
                const { data: selectedData, error } = await supabase
                  .from('Cutoff')
                  .select(`
                    "College Code",
                    "College Name",
                    "Branch Name",
                    "BranchNo",
                    "${userPreferences.category}",
                    "District",
                    "avgMedianSalary",
                    "avgPlacementPercentage",
                    "PowerScore"
                  `)
                  .eq('College Code', queryCollegeCode)
                  .ilike('Branch Name', `%${baseBranch}%`)

                if (error) {
                  console.error('Database query error for selected college:', error)
                  return []
                }

                console.log(`Debug - Found ${selectedData?.length || 0} records for college ${queryCollegeCode} branch ${baseBranch}`)
                if (selectedData && selectedData.length > 0) {
                  console.log('Debug - Sample data:', selectedData[0])
                } else {
                  console.log('Debug - No data found for this combination')
                }

                if (!selectedData || selectedData.length === 0) {
                  return []
                }

                // Transform results and mark as selected
                return selectedData.map(item => ({
                  code: item['College Code']?.toString().trim() || '',
                  name: item['College Name']?.toString().trim() || '',
                  branch: item['Branch Name']?.toString().trim() || '',
                  branchNo: Number(item['BranchNo']) || 999,
                  cutoff: parseFloat(item[userPreferences.category]) || 0,
                  medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                  placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                  powerScore: parseFloat(item['PowerScore']) || 0,
                  district: item['District']?.toString().trim() || '',
                  category: userPreferences.category,
                  isSelected: true // Mark as selected
                }))
              } catch (error) {
                console.error(`Error processing selected college ${collegeCode} branch ${baseBranch}:`, error)
                return []
              }
            })

            const branchResults = await Promise.all(branchQueries)
            return branchResults.flat()
          })

          const selectedCollegeResults = await Promise.all(selectedCollegeQueries)
          const selectedResults = selectedCollegeResults.flat()
          
          console.log('Selected college results:', selectedResults.length)
          console.log('Debug - Selected results sample:', selectedResults.slice(0, 2))
          allResults = [...selectedResults]
        } catch (error) {
          console.error('Error fetching selected colleges:', error)
        }
      } else {
        console.log('Debug - No selected colleges or branches to process')
        console.log('Debug - Selected colleges length:', selectedColleges.length)
        console.log('Debug - Selected branches length:', userPreferences.selectedBranches.length)
      }

      // Then fetch regular cutoff-based results
      if (userPreferences.selectedBranches.length > 0) {
        console.log('Filtering by branches:', userPreferences.selectedBranches)
        
        try {
          // Create separate queries for each branch and combine results
          const branchQueries = userPreferences.selectedBranches.map(async (branch) => {
            const baseBranch = branch.trim()
            console.log('Querying for branch:', baseBranch, 'with cutoff:', userPreferences.cutoff)
            
            try {
              // First, check if this branch has any colleges within cutoff range
              const cutoffCheckQuery = await supabase
              .from('Cutoff')
                .select(`"${userPreferences.category}"`)
                .ilike('Branch Name', `%${baseBranch}%`)
                .lt(`"${userPreferences.category}"`, userPreferences.cutoff)
                .limit(1)

              // If no colleges found below cutoff, skip this branch
              if (!cutoffCheckQuery.data || cutoffCheckQuery.data.length === 0) {
                console.log(`Skipping branch ${baseBranch} as no colleges found below cutoff ${userPreferences.cutoff}`)
                return []
              }

              // For AI choices, only get colleges below cutoff
              const cutoffCollegesQuery = supabase
                .from('Cutoff')
                .select(`
                  "College Code",
                  "College Name",
                  "Branch Name",
                  "BranchNo",
                  "${userPreferences.category}",
                  "District",
                  "avgMedianSalary",
                  "avgPlacementPercentage",
                  "PowerScore"
                `)
                .ilike('Branch Name', `%${baseBranch}%`)
                .lt(`"${userPreferences.category}"`, userPreferences.cutoff)
                .gt('PowerScore', 0)
                .order(`"${userPreferences.category}"`, { ascending: true })
                .limit(usage.maxChoices || 5) // Limit based on user's plan

              // Apply district filter if specified
              if (userPreferences.selectedDistricts.length > 0) {
                console.log('Applying district filter:', userPreferences.selectedDistricts)
                cutoffCollegesQuery.in('District', userPreferences.selectedDistricts)
              }

              // Execute query
              const { data: cutoffData, error } = await cutoffCollegesQuery

              if (error) {
                console.error('Database query error:', error)
                throw new Error(`Database query failed: ${error.message}`)
              }

              if (!cutoffData || cutoffData.length === 0) {
                return [] // Return empty array instead of throwing error
              }

              // Transform results
              return cutoffData.map(item => {
                console.log('DEBUG - Raw database item:', item)
                console.log('DEBUG - avgMedianSalary:', item['avgMedianSalary'], 'type:', typeof item['avgMedianSalary'])
                console.log('DEBUG - avgPlacementPercentage:', item['avgPlacementPercentage'], 'type:', typeof item['avgPlacementPercentage'])
                console.log('DEBUG - PowerScore:', item['PowerScore'], 'type:', typeof item['PowerScore'])
                
                const transformed = {
                  code: item['College Code']?.toString().trim() || '',
                  name: item['College Name']?.toString().trim() || '',
                  branch: item['Branch Name']?.toString().trim() || '',
                  branchNo: Number(item['BranchNo']) || 999,
                  cutoff: parseFloat(item[userPreferences.category]) || 0,
                  medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                  placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                  powerScore: parseFloat(item['PowerScore']) || 0,
                  district: item['District']?.toString().trim() || '',
                  category: userPreferences.category,
                  isSelected: false
                }
                
                console.log('DEBUG - Transformed item:', transformed)
                return transformed
              })
            } catch (error) {
              console.error(`Error processing branch ${baseBranch}:`, error)
              return [] // Return empty array instead of throwing error
            }
          })

          // Execute all branch queries in parallel
          const branchResults = await Promise.all(branchQueries)
          
          // Combine and deduplicate results
          const uniqueResults = Array.from(
            new Map(
              branchResults
                .flat()
                .map(item => [
                  `${item.code}-${item.branch}`,
                  item
                ])
            ).values()
          )
          .sort((a, b) => {
            // Sort by cutoff first (descending)
            if (a.cutoff !== b.cutoff) {
              return b.cutoff - a.cutoff
            }
            // Then by power score
              return b.powerScore - a.powerScore
          })
          .slice(0, usage.maxChoices || 5) // Limit based on user's plan

          console.log('Total unique results:', uniqueResults.length)

          // Add regular results to allResults
          allResults = [...allResults, ...uniqueResults]

        } catch (error) {
          console.error('Detailed error in branch queries:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch college results'
          toast.error(errorMessage)
          const errorBotMessage: Message = {
            type: 'bot',
            content: `Sorry, there was an error: ${errorMessage}. Please try adjusting your criteria or selecting different branches.`
          }
          setMessages(prev => [...prev, errorBotMessage])
          return
        }
      } else {
        // If no branches selected, proceed with original query but with cutoff filter
        console.log('Building query for cutoff range colleges...')
        let query = supabase
          .from('Cutoff')
          .select(`
            "College Code",
            "College Name",
            "Branch Name",
            "${userPreferences.category}",
            "District",
            "avgMedianSalary",
            "avgPlacementPercentage",
            "PowerScore"
          `)
          .lt(`"${userPreferences.category}"`, userPreferences.cutoff) // Only get colleges below cutoff
          .gt('PowerScore', 0)
          .order(`"${userPreferences.category}"`, { ascending: true }) // Order by cutoff ascending
          .limit(usage.maxChoices || 5) // Limit based on user's plan

        // Apply district filter if specified
        if (userPreferences.selectedDistricts.length > 0) {
          console.log('Applying district filter:', userPreferences.selectedDistricts)
          query = query.in('District', userPreferences.selectedDistricts)
        }

        // Execute the query
        console.log('Executing final query...')
        let { data: cutoffData, error } = await query

        if (error) {
          console.error('Query execution error:', error)
          throw new Error(`Database query failed: ${error.message}`)
        }

        if (!cutoffData || cutoffData.length === 0) {
          throw new Error('No colleges found below your cutoff. Please try adjusting your criteria.')
        }

        // Transform the data for display
        const regularResults = cutoffData.map(item => {
          console.log('DEBUG - Regular results raw item:', item)
          console.log('DEBUG - Regular avgMedianSalary:', item['avgMedianSalary'], 'type:', typeof item['avgMedianSalary'])
          console.log('DEBUG - Regular avgPlacementPercentage:', item['avgPlacementPercentage'], 'type:', typeof item['avgPlacementPercentage'])
          console.log('DEBUG - Regular PowerScore:', item['PowerScore'], 'type:', typeof item['PowerScore'])
          
          const transformed = {
              code: item['College Code']?.toString().trim() || '',
              name: item['College Name']?.toString().trim() || '',
              branch: item['Branch Name']?.toString().trim() || '',
              cutoff: parseFloat(item[userPreferences.category]) || 0,
              medianSalary: parseFloat(item['avgMedianSalary']) || 0,
              placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
              powerScore: parseFloat(item['PowerScore']) || 0,
              district: item['District']?.toString().trim() || '',
              category: userPreferences.category,
          isSelected: false
          }
          
          console.log('DEBUG - Regular transformed item:', transformed)
          return transformed
        })
        .sort((a, b) => {
          // Sort by cutoff first (descending)
          if (a.cutoff !== b.cutoff) {
            return b.cutoff - a.cutoff
          }
          // Then by power score
          return b.powerScore - a.powerScore
        })

        console.log('Regular results count:', regularResults.length)
        allResults = [...allResults, ...regularResults]
      }

      // Remove duplicates and ensure selected colleges are at the top
      const uniqueAllResults = Array.from(
        new Map(
          allResults.map(item => [
            `${item.code}-${item.branch}`,
            item
          ])
        ).values()
      )

      console.log('Debug - Total unique results before sorting:', uniqueAllResults.length)
      console.log('Debug - Selected colleges in results:', uniqueAllResults.filter(item => item.isSelected).length)

      // Filter out colleges with missing placement and salary data (same as rank-based logic)
      const dataFilteredResults = uniqueAllResults.filter(result => {
        // Selected colleges should be included regardless of data availability
        if (result.isSelected) {
          return true
        }
        // Non-selected colleges should have both placement percentage and median salary data
        return result.placementPercentage > 0 && result.medianSalary > 0
      })

      console.log('Data filtered results (with placement & salary data):', dataFilteredResults.length)
      console.log('Selected colleges in results:', dataFilteredResults.filter(r => r.isSelected).length)
      console.log('Non-selected colleges in results:', dataFilteredResults.filter(r => !r.isSelected).length)

      // Sort results: selected colleges first, then preserve database order for others
      const sortedResults = dataFilteredResults.sort((a, b) => {
        // Selected colleges come first
        if (a.isSelected && !b.isSelected) return -1
        if (!a.isSelected && b.isSelected) return 1
        
        // For non-selected colleges, preserve the database order (don't re-sort by rank)
        return 0
      })

      // Limit results based on user's plan
      const maxChoices = usage.maxChoices || 5 // Default to freemium limit
      let limitedResults = sortedResults.slice(0, maxChoices)
      limitedResults = await withAspirationalReach(limitedResults, maxChoices, 'cutoff')
      
      console.log(`Limiting results to ${maxChoices} colleges based on user plan (${usage.planType})`)
      console.log(`Current results count: ${limitedResults.length}`)

      // Check if user got enough colleges based on their plan
      if (limitedResults.length < maxChoices) {
        console.log(`User only got ${limitedResults.length} colleges, need ${maxChoices}. Fetching null colleges to supplement.`)
        
        // Fetch null colleges to supplement the results
        const nullColleges = await fetchNullCutoffColleges('cutoff', userPreferences, usage)
        
        if (nullColleges.length > 0) {
          console.log(`Adding ${nullColleges.length} null colleges to supplement results`)
          
          // Combine existing results with null colleges
          const combinedResults = [...limitedResults, ...nullColleges]
          
          // Remove duplicates and limit to maxChoices
          const uniqueCombinedResults = Array.from(
            new Map(
              combinedResults.map(item => [
                `${item.code}-${item.branch}`,
                item
              ])
            ).values()
          ).slice(0, maxChoices)
          
          limitedResults = uniqueCombinedResults
          console.log(`Final results count after adding null colleges: ${limitedResults.length}`)
        }
      }

      // Group results by branches
      const groupedResults = groupCollegesByBranches(limitedResults)

      // Check if null colleges are present in the results
      const hasNullColleges = limitedResults.some(college => college.isNullCollege)
      
      // Fetch trend rate for the computed results before displaying.
      const displayResults = await enrichResultsWithTrendRate(
        userPreferences.choiceType === 'traditional' ? limitedResults : groupedResults
      )

      // Add results message to chat
      const resultsMessage: Message = {
        type: 'bot',
        content: hasNullColleges
          ? `Based on your rank and last year's TNEA + NIRF data, we've identified colleges that had seats available previously. While it may be a close call, these suggestions are smart backup options to help you explore every possible opportunity with confidence!\n\nFound ${limitedResults.length} colleges matching your criteria. ${selectedColleges.length > 0 ? 'Selected colleges are shown at the top.' : ''} Here are your top choices:`
          : `Found ${limitedResults.length} colleges matching your criteria. ${selectedColleges.length > 0 ? 'Selected colleges are shown at the top.' : ''} Here are your top choices:`,
        results: displayResults
      }

        setMessages(prev => [...prev, resultsMessage])
      setCollegeResults(displayResults)

      } catch (error) {
        console.error('Detailed error in college results:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch college results'
        toast.error(errorMessage)
        const errorBotMessage: Message = {
          type: 'bot',
          content: `Sorry, there was an error: ${errorMessage}. Please try again with different criteria.`
        }
        setMessages(prev => [...prev, errorBotMessage])
    }
  }

  const generatePDF = async () => {
    try {
      // Create PDF in portrait orientation
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      // Track usage when PDF is generated (use the same session ID as result generation)
      if (user?.id && user?.email) {
        try {
          await fetch('/api/track-usage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              sessionId: currentSessionIdRef.current, // Use the ref instead of state
              choicesGenerated: collegeResults.length,
              pdfDownloaded: true
            }),
          })
        } catch (error) {
          console.error('Error tracking usage:', error)
        }
      }
      
      // Show congratulations message after PDF generation
      setTimeout(() => {
        const congratulationsMessage: Message = {
          type: 'bot',
          content: `🎉 Congratulations! You have successfully generated ${collegeResults.length} choices for free.`
        }
        setMessages(prev => [...prev, congratulationsMessage])
        
        // Add pricing plans message only for freemium users
        if (usageData && !usageData.planType?.startsWith('premium')) {
          const pricingMessage: Message = {
            type: 'bot',
            content: 'Choose your premium plan:',
            showPricingPlans: true
          }
          setMessages(prev => [...prev, pricingMessage])
        }
        scrollToBottom()
      }, 1000)
      
      // Function to add header to any page
      const addHeader = (pageNumber: number) => {
        const pageWidth = doc.internal.pageSize.width
        const logoX = 20, logoY = 12, logoW = 24, logoH = 16

        // Add logo on the left side
        try {
          doc.addImage('/pdflogo.jpg', 'JPEG', logoX, logoY, logoW, logoH)
        } catch (error) {
          console.log('Logo not found, continuing without logo')
        }

      // Centre the header text within the space to the RIGHT of the logo so it
      // never overlaps the logo.
      const textCenter = (logoX + logoW + 4 + (pageWidth - 20)) / 2

      // Add website name as header
      doc.setTextColor(41, 128, 185)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      const websiteName = 'chooseyourcollege.com'
      doc.text(websiteName, textCenter - doc.getTextWidth(websiteName) / 2, 21)

      // Add title with improved styling
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const methodName = userPreferences.choiceMethodLabel
        || (userPreferences.choiceType === 'smart' ? 'Power Score' : 'Traditional Method')
      const title = `${methodName} Choice Filling Results`
      doc.text(title, textCenter - doc.getTextWidth(title) / 2, 30)

      // Add a line separator
      doc.setDrawColor(41, 128, 185)
      doc.setLineWidth(0.5)
      doc.line(20, 37, pageWidth - 20, 37)
      }

      // Function to add footer to any page
      const addFooter = (pageNumber: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.width
        const pageHeight = doc.internal.pageSize.height
        
        // Add footer line
        doc.setDrawColor(41, 128, 185)
        doc.setLineWidth(0.5)
        doc.line(20, pageHeight - 25, pageWidth - 20, pageHeight - 25)
        
        // Add page numbers
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        const pageText = `Page ${pageNumber} of ${totalPages}`
        const pageTextWidth = doc.getTextWidth(pageText)
        doc.text(
          pageText,
          (pageWidth - pageTextWidth) / 2,
          pageHeight - 15
        )
        
        // Add website name in footer
        doc.setTextColor(41, 128, 185)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        const footerWebsiteName = 'chooseyourcollege.com'
        doc.text(footerWebsiteName, 25, pageHeight - 15)
        
        // Add timestamp
        doc.setTextColor(100, 100, 100)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        const timestamp = new Date().toLocaleString()
        const timestampWidth = doc.getTextWidth(timestamp)
        doc.text(timestamp, pageWidth - 25 - timestampWidth, pageHeight - 15)
      }

      // Add header to first page
      addHeader(1)

      // Add user preferences in a better format
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      
      // Create a styled box for user details
      const pageWidth = doc.internal.pageSize.width
      const boxStartY = 45

      // Format preferences as before...
      const formatPreference = (label: string, value: string) => {
        const formattedLabel = label
          .split(/(?=[A-Z])/)
          .join(' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/\s+/g, ' ')

        const formattedValue = value
          .split(/(?=[A-Z])/)
          .join(' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ', ')

        return `${formattedLabel}: ${formattedValue}`
      }

      const preferences = [
        formatPreference('Name', userPreferences.name),
        formatPreference('Cutoff', userPreferences.cutoff.toString()),
        formatPreference('Category', userPreferences.category),
        formatPreference('City Preference', userPreferences.cityPreference === 'any' ? 'Any city' : 'Specific cities'),
        userPreferences.districtOption ? formatPreference('District Option', userPreferences.districtOption === 'one' ? 'Any 1 District' : 
                                                                    userPreferences.districtOption === 'two' ? 'any 2 districts' : 
                                                                    userPreferences.districtOption === 'three' ? 'any 3 districts' : userPreferences.districtOption) : '',
        userPreferences.selectedDistricts.length > 0 ? formatPreference('Selected Districts', userPreferences.selectedDistricts.join(', ')) : '',
        userPreferences.branchOption ? formatPreference('Branch Option', userPreferences.branchOption === 'cs' ? 'Computer Science & Related' : 
                                                                    userPreferences.branchOption === 'circuit' ? 'Circuit Branch & Related' :
                                                                    userPreferences.branchOption === 'specific' ? 'Specific Branches' : userPreferences.branchOption) : '',
        userPreferences.collegeOption ? formatPreference('College Option', userPreferences.collegeOption === 'cutoff' ? 'Colleges that match my Cutoff' :
                                                                      userPreferences.collegeOption === 'specific' ? `Select ${userPreferences.requiredCollegeCount || 5} specific colleges` : userPreferences.collegeOption) : '',
        userPreferences.selectedColleges.length > 0 ? formatPreference('Selected Colleges', userPreferences.selectedColleges.join(', ')) : '',
        userPreferences.choiceType ? formatPreference('Choice Type', userPreferences.choiceMethodLabel ||
                                                                    (userPreferences.choiceType === 'smart' ? 'Power Score' :
                                                                    userPreferences.choiceType === 'traditional' ? 'Traditional Method' : userPreferences.choiceType)) : ''
      ].filter(Boolean)

      // Split preferences into two columns
      const midPoint = Math.ceil(preferences.length / 2)
      const leftColumn = preferences.slice(0, midPoint)
      const rightColumn = preferences.slice(midPoint)

      // Layout constants for the details rows
      const detailFontSize = 10
      const detailLineHeight = 4.6
      const detailRowGap = 2.6
      const firstRowY = boxStartY + 18

      type DetailRow = { labelWithColon: string; valueLines: string[]; y: number; labelX: number; valueX: number }

      // Measure a column WITHOUT drawing: compute each row's wrapped value lines
      // and its y position, advancing y by the actual height used so wrapped
      // values never overlap the next row. Returns rows + the ending y.
      const measureColumn = (col: string[], labelX: number, colRightX: number) => {
        const rows: DetailRow[] = []
        let y = firstRowY
        for (const pref of col) {
          const sep = pref.indexOf(':')
          const label = sep >= 0 ? pref.slice(0, sep) : pref
          const value = (sep >= 0 ? pref.slice(sep + 1) : '').trim()
          const labelWithColon = `${label}:`
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(detailFontSize)
          const labelWidth = doc.getTextWidth(labelWithColon)
          const valueX = labelX + labelWidth + 3
          doc.setFont('helvetica', 'normal')
          const maxValueWidth = Math.max(20, colRightX - valueX)
          const valueLines = doc.splitTextToSize(value, maxValueWidth) as string[]
          rows.push({ labelWithColon, valueLines, y, labelX, valueX })
          y += Math.max(detailLineHeight, valueLines.length * detailLineHeight) + detailRowGap
        }
        return { rows, endY: y }
      }

      const leftMeasure = measureColumn(leftColumn, 25, pageWidth / 2 - 8)
      const rightMeasure = measureColumn(rightColumn, pageWidth / 2 + 5, pageWidth - 25)
      const boxEndY = Math.max(leftMeasure.endY, rightMeasure.endY) + 2

      // Draw the box background sized to fit the content
      doc.setFillColor(240, 240, 240)
      doc.rect(20, boxStartY, pageWidth - 40, boxEndY - boxStartY, 'F')

      // "User Details" label + underline
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text('User Details:', 25, boxStartY + 8)
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.2)
      doc.line(25, boxStartY + 11, pageWidth - 25, boxStartY + 11)

      // Draw a measured column: bold label, normal value (wrapped) beside it.
      const drawColumn = (measure: { rows: DetailRow[] }) => {
        for (const r of measure.rows) {
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(detailFontSize)
          doc.text(r.labelWithColon, r.labelX, r.y)
          doc.setFont('helvetica', 'normal')
          r.valueLines.forEach((line, i) => {
            doc.text(line, r.valueX, r.y + i * detailLineHeight)
          })
        }
      }
      drawColumn(leftMeasure)
      drawColumn(rightMeasure)

      // Get the results from the last message that contains results
      const resultsMessage = messages.findLast(msg => msg.results)
      if (!resultsMessage?.results) {
        throw new Error('No results found to generate PDF')
      }

      // Start Y position for the results
      let currentY = boxEndY + 25

      // Check if null colleges are included in the results
      const hasNullColleges = collegeResults.some(college => college.isNullCollege)
      
      // Add null colleges message if applicable
      if (hasNullColleges) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(11, 85, 136) // Website color #005596
        
        const message = 'Based on your rank and last year\'s TNEA + NIRF data, we\'ve identified colleges that had seats available previously. While it may be a close call, these suggestions are smart backup options to help you explore every possible opportunity with confidence!'
        
        // Split the message into multiple lines to fit the page width
        const pageWidth = doc.internal.pageSize.width
        const maxWidth = pageWidth - 40 // 20px margin on each side
        const splitText = doc.splitTextToSize(message, maxWidth)
        
        // Add each line of the message
        splitText.forEach((line: string, index: number) => {
          doc.text(line, 20, currentY + (index * 5))
        })
        
        // Move currentY down to accommodate the message (accounting for multiple lines)
        currentY += (splitText.length * 5) + 10
      }

      // Draw the trend-rate arrow inside a table cell (jsPDF's standard fonts
      // can't render Unicode arrows, so we draw them as filled triangles):
      //   green  -> up triangle (green), red -> down triangle (red),
      //   yellow -> right triangle (yellow), anything else -> a neutral dash.
      const drawTrendArrow = (colour: string, cell: any) => {
        const c = (colour || '').trim().toLowerCase()
        const cx = cell.x + cell.width / 2
        const cy = cell.y + cell.height / 2
        const s = 1.8
        if (c === 'green') {
          doc.setFillColor(22, 163, 74)
          doc.triangle(cx, cy - s, cx - s, cy + s, cx + s, cy + s, 'F')
        } else if (c === 'red') {
          doc.setFillColor(220, 38, 38)
          doc.triangle(cx, cy + s, cx - s, cy - s, cx + s, cy - s, 'F')
        } else if (c === 'yellow') {
          doc.setFillColor(234, 179, 8)
          doc.triangle(cx + s, cy, cx - s, cy - s, cx - s, cy + s, 'F')
        } else {
          doc.setDrawColor(150, 150, 150)
          doc.setLineWidth(0.4)
          doc.line(cx - s, cy, cx + s, cy)
        }
      }

      // Draw the choice-bucket colour legend above the results table.
      {
        const legendItems: Array<{ label: string; fill: [number, number, number] }> = [
          { label: 'Aspirational choices', fill: [220, 252, 231] },
          { label: 'Matching colleges', fill: [254, 249, 195] },
          { label: 'Safe choices', fill: [252, 231, 243] },
        ]
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        let legendX = 20
        for (const item of legendItems) {
          doc.setFillColor(item.fill[0], item.fill[1], item.fill[2])
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.2)
          doc.rect(legendX, currentY - 3.5, 4, 4, 'FD')
          doc.setTextColor(0, 0, 0)
          doc.text(item.label, legendX + 6, currentY)
          legendX += 6 + doc.getTextWidth(item.label) + 8
        }
        currentY += 8
      }

          if (userPreferences.choiceType === 'smart') {
        // AI Choices Format - Single table with all colleges and branches
        const groupedResults = collegeResults
        let choiceNumber = 1

        // Prepare table data - flatten all colleges and branches into a single table.
        // trendColours holds the per-row trend colour, indexed the same as tableData,
        // and is used by didDrawCell to draw the arrow in the Trend Rate column.
        const tableData: any[] = []
        const trendColours: string[] = []
        // Parallel to tableData: the college and branch each row belongs to, used
        // to colour the row by its choice bucket (aspirational/matching/safe).
        const rowColleges: any[] = []
        const rowBranches: any[] = []

        // Same order as the on-screen table: rank-based is globally rank-ascending
        // (from the student's rank upward), cutoff-based is grouped by college.
        for (const { college, branch } of flattenSmartChoices(groupedResults)) {
              {
                const currentChoice = choiceNumber
                choiceNumber++
                
                if (userPreferences.resultType === 'rank') {
              tableData.push([
                    currentChoice.toString(),
                college.name,
                college.code,
                    branch.name,
                    (branch.powerScore || 0).toString(),
                    (branch.rank || 0).toString(),
                    branch.cutoff != null ? branch.cutoff.toString() : '-',
                    '', // Trend Rate — arrow drawn via didDrawCell
                college.district || '',
                college.isSelected ? 'Yes' : 'No'
              ])
                } else {
              tableData.push([
                    currentChoice.toString(),
                college.name,
                college.code,
                    branch.name,
                    (branch.powerScore || 0).toString(),
                    '', // Trend Rate — arrow drawn via didDrawCell
                college.district || '',
                college.isSelected ? 'Yes' : 'No'
              ])
                }
                trendColours.push(branch.trendRate || '')
                rowColleges.push(college)
                rowBranches.push(branch)
          }
        }

        // Create the single table for AI choices
        autoTable(doc, {
          startY: currentY,
          head: userPreferences.resultType === 'rank'
            ? [['Choice No', 'College Name', 'College Code', 'Branch', 'PowerScore', 'Rank', 'Cutoff', 'Trend Rate', 'District', 'Selected']]
            : [['Choice No', 'College Name', 'College Code', 'Branch', 'PowerScore', 'Trend Rate', 'District', 'Selected']],
          body: tableData,
            styles: {
            fontSize: 7,
            cellPadding: 2,
              overflow: 'linebreak',
              halign: 'left',
              font: 'helvetica'
            },
            // Column widths sized to fit A4 portrait usable width (~170mm)
            columnStyles: userPreferences.resultType === 'rank'
              ? {
                0: { cellWidth: 10 },  // Choice No
                1: { cellWidth: 30 },  // College Name
                2: { cellWidth: 13 },  // College Code
                3: { cellWidth: 30 },  // Branch
                4: { cellWidth: 14 },  // PowerScore
                5: { cellWidth: 12 },  // Rank
                6: { cellWidth: 13 },  // Cutoff
                7: { cellWidth: 15, halign: 'center' },  // Trend Rate
                8: { cellWidth: 20 },  // District
                9: { cellWidth: 13 }   // Selected
              }
              : {
                0: { cellWidth: 12 },  // Choice No
                1: { cellWidth: 37 },  // College Name
                2: { cellWidth: 15 },  // College Code
                3: { cellWidth: 37 },  // Branch
                4: { cellWidth: 16 },  // PowerScore
                5: { cellWidth: 18, halign: 'center' },  // Trend Rate
                6: { cellWidth: 22 },  // District
                7: { cellWidth: 13 }   // Selected
                },
            headStyles: {
              fillColor: [11, 85, 136], // Website color #005596
              textColor: [255, 255, 255], // White text
              fontStyle: 'bold',
            fontSize: 7
            },
          margin: { left: 20, right: 20, top: 50, bottom: 30 },
            theme: 'grid',
            // Colour each row by its choice bucket (aspirational/matching/safe).
            didParseCell: (data: any) => {
              if (data.section === 'body') {
                const college = rowColleges[data.row.index]
                const branch = rowBranches[data.row.index]
                if (college) data.cell.styles.fillColor = bucketFill(getBranchBucket(college, branch))
              }
            },
            didDrawCell: (data: any) => {
              const trendCol = userPreferences.resultType === 'rank' ? 7 : 5
              if (data.section === 'body' && data.column.index === trendCol) {
                drawTrendArrow(trendColours[data.row.index] || '', data.cell)
              }
            }
          })

        // Add headers and footers to all pages after table is complete
        const totalPages = (doc as any).internal.pages.length - 1
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i)
          
          // Add header to all pages except first (already added)
          if (i > 1) {
            addHeader(i)
          }
          
          // Add footer to all pages
          addFooter(i, totalPages)
        }
          } else {
        // Traditional Cutoff Format - Simple table with all choices
        const tradResults = resultsMessage.results
        autoTable(doc, {
          startY: currentY,
          head: [['Choice No', 'College Code', 'College Name', 'Branch', userPreferences.resultType === 'rank' ? 'Rank' : 'Cutoff', 'PowerScore', 'Trend Rate']],
          body: tradResults.map((college, index) => [
              (index + 1).toString(),
              college.code,
              college.name,
              college.branch,
              userPreferences.resultType === 'rank' ?
                (college.rank !== undefined ? college.rank.toString() : (college.cutoff || 0).toString()) :
                (college.cutoff || 0).toString(),
              (college.powerScore || 0).toString(),
              '' // Trend Rate — arrow drawn via didDrawCell
          ]),
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: 'linebreak',
          halign: 'left',
          font: 'helvetica'
        },
        // Column widths sized to fit A4 portrait usable width (~170mm)
        columnStyles: {
              0: { cellWidth: 15 },  // Choice No
              1: { cellWidth: 22 },  // College Code
              2: { cellWidth: 50 },  // College Name
              3: { cellWidth: 40 },  // Branch
              4: { cellWidth: 15 },  // Rank/Cutoff
              5: { cellWidth: 16 },  // PowerScore
              6: { cellWidth: 12, halign: 'center' }   // Trend Rate
            },
        headStyles: {
            fillColor: [11, 85, 136], // Website color #005596
            textColor: [255, 255, 255], // White text
          fontStyle: 'bold',
            fontSize: 8
        },
          margin: { left: 20, right: 20, top: 50, bottom: 30 },
          theme: 'grid',
          // Colour each row by its choice bucket (aspirational/matching/safe).
          didParseCell: (data: any) => {
            if (data.section === 'body') {
              const college = tradResults[data.row.index]
              if (college) data.cell.styles.fillColor = bucketFill(getChoiceBucket(college))
            }
          },
          didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 6) {
              const college = tradResults[data.row.index]
              drawTrendArrow(college?.trendRate || '', data.cell)
            }
          }
        })

        // Add headers and footers to all pages after table is complete
      const totalPages = (doc as any).internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
          
          // Add header to all pages except first (already added)
          if (i > 1) {
            addHeader(i)
          }
          
          // Add footer to all pages
          addFooter(i, totalPages)
        }
      }

      // Save the PDF with appropriate filename
      const timestamp = new Date().toISOString().split('T')[0]
      const methodSlug = userPreferences.choiceMethodLabel === 'AI Method'
        ? 'ai-method'
        : userPreferences.choiceType === 'smart'
        ? 'power-score'
        : 'cutoff-based'
      const filename = `${methodSlug}-choices-${timestamp}.pdf`
      doc.save(filename)
      
      toast.success('PDF downloaded successfully!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF. Please try again.')
    }
  }

  // Add this function to fetch colleges
  const fetchColleges = async () => {
    try {
      // First get the total count
      const { count, error: countError } = await supabase
        .from('Cutoff')
        .select('*', { count: 'exact', head: true })

      if (countError) throw countError
      console.log('Total records in database:', count)

      // Fetch all records in chunks of 1000
      const chunkSize = 1000
      const totalChunks = Math.ceil((count || 0) / chunkSize)
      let allColleges: CollegeRecord[] = []

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = start + chunkSize - 1
        
        const { data, error } = await supabase
          .from('Cutoff')
          .select('"College Code", "College Name"')
          .order('"College Name"', { ascending: true })
          .range(start, end)

        if (error) throw error
        if (data) {
          allColleges = [...allColleges, ...data]
        }
        
        console.log(`Fetched chunk ${i + 1}/${totalChunks}: ${data?.length} records`)
      }

      console.log('Total colleges fetched:', allColleges.length)

      // Remove duplicates and format data
      const uniqueColleges = Array.from(
        new Map(
          allColleges
            .map(item => ({
              code: item['College Code']?.toString().trim().toUpperCase(),
              name: item['College Name']?.toString().trim().toUpperCase()
            }))
            .filter(item => item.code && item.name)
            .map(item => [
              item.code, // Only use college code as the key
              {
                code: item.code,
                name: item.name.split(',')[0].trim() // Only keep the main college name without address
              }
            ])
        ).values()
      )
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically

      // Log duplicates for debugging
      const duplicates = allColleges.reduce((acc, item) => {
        const key = `${item['College Code']?.toString().trim().toUpperCase()}-${item['College Name']?.toString().trim().toUpperCase()}`
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      console.log('Duplicate entries:', Object.entries(duplicates)
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => ({ key, count }))
      )

      console.log('Total unique colleges:', uniqueColleges.length)
      console.log('Sample of unique colleges:', uniqueColleges.slice(0, 5))

      setAvailableColleges(uniqueColleges)
    } catch (error) {
      console.error('Error fetching colleges:', error)
      toast.error('Failed to fetch colleges. Please try again.')
    }
  }

  // Update the groupCollegesByBranches function
  const groupCollegesByBranches = (results: any[]) => {
    console.log('DEBUG - groupCollegesByBranches input:', results.length, 'items')
    console.log('DEBUG - Sample input item:', results[0])
    
    // Group results by college code and name
    const groupedResults = results.reduce((acc: any, college) => {
      const key = `${college.code}-${college.name}`
      if (!acc[key]) {
        acc[key] = {
          code: college.code,
          name: college.name,
          district: college.district,
          isSelected: college.isSelected,
          isAspirational: false,
          branches: []
        }
      }
      // A college is aspirational if any of its branches is a reach college.
      if (college.isAspirational) acc[key].isAspirational = true
      acc[key].branches.push({
        name: college.branch,
        branchNo: college.branchNo,
        cutoff: college.cutoff,
        rank: college.rank,
        medianSalary: college.medianSalary,
        placementPercentage: college.placementPercentage,
        powerScore: college.powerScore,
        isAspirational: !!college.isAspirational,
        isSelected: !!college.isSelected,
      })
      return acc
    }, {})

    // Convert to array and sort branches within each college by BranchNo
    const finalResults = Object.values(groupedResults)
      .map((college: any) => ({
        ...college,
        branches: [...college.branches].sort((a: any, b: any) => a.branchNo - b.branchNo)
      }))
      .sort((a: any, b: any) => {
        // First sort by selected status
        if (a.isSelected !== b.isSelected) {
          return a.isSelected ? -1 : 1
        }
        
        // Then sort by highest power score branch
        const aMaxScore = Math.max(...a.branches.map((b: any) => b.powerScore))
        const bMaxScore = Math.max(...b.branches.map((b: any) => b.powerScore))
        return bMaxScore - aMaxScore
      })
    
    console.log('DEBUG - groupCollegesByBranches output:', finalResults.length, 'colleges')
    console.log('DEBUG - Sample output college:', finalResults[0])
    console.log('DEBUG - Sample output college branches:', finalResults[0]?.branches)
    
    return finalResults
  }

  const generateRankBasedResults = async () => {
    try {
      console.log('=== DEBUG: generateRankBasedResults called ===')
      
      // Check usage and apply restrictions BEFORE generating results
      if (!user?.id || !user?.email) {
        toast.error('User not authenticated. Please sign in again.')
        return
      }

      // Check current usage status
      const usageResponse = await fetch('/api/check-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id, 
          email: user.email 
        }),
      })

      if (!usageResponse.ok) {
        toast.error('Failed to check usage status. Please try again.')
        return
      }

      const usageData = await usageResponse.json()
      if (!usageData.success) {
        toast.error(usageData.error || 'Failed to check usage status.')
        return
      }

      const { usage } = usageData
      console.log('Current usage status:', usage)

      // Check if user can use the service
      if (!usage.canUse) {
        setShowUsageModal(true)
        return
      }

      // Track usage BEFORE generating results
      const newSessionId = generateUsageSessionId()
      try {
        await fetch('/api/track-usage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            sessionId: newSessionId,
            choicesGenerated: 0, // Will be updated after results are generated
            pdfDownloaded: false
          }),
        })
      } catch (error) {
        console.error('Error tracking usage:', error)
        // Don't block the user if tracking fails
      }

      console.log('userPreferences:', userPreferences)
      console.log('Choice Type:', userPreferences.choiceType)
      console.log('Selected Colleges:', userPreferences.selectedColleges)
      console.log('Selected Branches:', userPreferences.selectedBranches)
      console.log('Result Type:', userPreferences.resultType)
      
      const userRank = parseInt(formData.rank)
      console.log('User Rank:', userRank)
      console.log('Category:', userPreferences.category)
      console.log('Selected branches:', userPreferences.selectedBranches)
      console.log('Selected districts:', userPreferences.selectedDistricts)
      
      let allResults: any[] = []
      
      // First, fetch selected colleges with their specific branches (irrespective of rank)
      if (userPreferences.selectedColleges.length > 0 && userPreferences.selectedBranches.length > 0) {
        console.log('Fetching selected colleges with specific branches...')
        
        try {
          // Create queries for each selected college and branch combination
          const selectedCollegeQueries = userPreferences.selectedColleges.map(async (collegeCode) => {
            console.log(`Debug - Processing college code: ${collegeCode}`)
            const branchQueries = userPreferences.selectedBranches.map(async (branch) => {
              const baseBranch = branch.trim()
              console.log(`Debug - Processing branch: ${baseBranch} for college: ${collegeCode}`)
              
              try {
                const queryCollegeCode = collegeCode.toUpperCase()
                console.log(`Debug - Querying Rank table with college code: "${queryCollegeCode}" and branch: "${baseBranch}"`)
                
                const { data: selectedData, error } = await supabase
                  .from('Rank')
                  .select(`
                    "College Code",
                    "College Name",
                    "Branch Name",
                    "BranchNo",
                    "${userPreferences.category}",
                    "District",
                    "avgMedianSalary",
                    "avgPlacementPercentage",
                    "PowerScore"
                  `)
                  .eq('College Code', queryCollegeCode)
                  .ilike('Branch Name', `%${baseBranch}%`)

                if (error) {
                  console.error('Database query error for selected college:', error)
                  return []
                }

                console.log(`Debug - Found ${selectedData?.length || 0} records for college ${queryCollegeCode} branch ${baseBranch}`)
                if (selectedData && selectedData.length > 0) {
                  console.log('Debug - Sample data:', selectedData[0])
                } else {
                  console.log('Debug - No data found for this combination')
                }

                if (!selectedData || selectedData.length === 0) {
                  return []
                }

                // Transform results and mark as selected
                const transformedResults = selectedData.map(item => ({
                  code: item['College Code']?.toString().trim() || '',
                  name: item['College Name']?.toString().trim() || '',
                  branch: item['Branch Name']?.toString().trim() || '',
                  branchNo: Number(item['BranchNo']) || 999,
                  rank: parseFloat(item[userPreferences.category]) || 0,
                  medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                  placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                  powerScore: parseFloat(item['PowerScore']) || 0,
                  district: item['District']?.toString().trim() || '',
                  category: userPreferences.category,
                  isSelected: true
                }))

                // Filter out colleges with rank 0 only
                const filteredResults = transformedResults.filter(college => college.rank > 0)

                return filteredResults
              } catch (error) {
                console.error(`Error processing selected college ${collegeCode} branch ${baseBranch}:`, error)
                return []
              }
            })

            const branchResults = await Promise.all(branchQueries)
            return branchResults.flat()
          })

          const selectedCollegeResults = await Promise.all(selectedCollegeQueries)
          const selectedResults = selectedCollegeResults.flat()
          
          console.log('Selected college results:', selectedResults.length)
          console.log('Debug - Selected results sample:', selectedResults.slice(0, 2))
          allResults = [...selectedResults]
        } catch (error) {
          console.error('Error fetching selected colleges:', error)
        }
      }

      // NEW LOGIC: Fetch rank-based results based on choice type
      if (userPreferences.selectedBranches.length > 0) {
        console.log('Fetching rank-based results for selected branches:', userPreferences.selectedBranches)
        
        // Debug: Check if colleges above 100,000 exist for Information Technology
        try {
          const { data: debugData, error: debugError } = await supabase
            .from('Rank')
            .select(`
              "College Code",
              "College Name",
              "Branch Name",
              "${userPreferences.category}"
            `)
            .ilike('Branch Name', '%Information Technology%')
            .gt(`"${userPreferences.category}"`, '100000')
            .order(`"${userPreferences.category}"`, { ascending: false })
            .limit(10)
          
          if (debugError) {
            console.error('Debug query error:', debugError)
          } else {
            console.log('DEBUG: Colleges above 100,000 for Information Technology:', debugData?.length || 0)
            if (debugData && debugData.length > 0) {
              console.log('DEBUG: Sample colleges above 100,000:', debugData.slice(0, 5).map(item => ({
                college: item['College Name'],
                rank: item[userPreferences.category]
              })))
            }
          }
          
          // Also check the highest rank for Information Technology
          const { data: maxRankData, error: maxRankError } = await supabase
                  .from('Rank')
                    .select(`
                      "College Code",
                      "College Name",
                      "Branch Name",
              "${userPreferences.category}"
            `)
            .ilike('Branch Name', '%Information Technology%')
                  .not(`"${userPreferences.category}"`, 'is', null)
                  .not(`"${userPreferences.category}"`, 'eq', '')
            .order(`"${userPreferences.category}"`, { ascending: false })
            .limit(5)
          
          if (maxRankError) {
            console.error('Max rank query error:', maxRankError)
          } else {
            console.log('DEBUG: Highest ranks for Information Technology:', maxRankData?.map(item => ({
              college: item['College Name'],
              rank: item[userPreferences.category]
            })))
          }
          
          // Direct query to check all colleges with ranks above 100,000
          console.log('DEBUG: Direct query for colleges above 100,000...')
          const { data: directQueryData, error: directQueryError } = await supabase
            .from('Rank')
            .select(`
              "College Code",
              "College Name",
              "Branch Name",
              "${userPreferences.category}"
            `)
            .ilike('Branch Name', '%Information Technology%')
            .gt(`"${userPreferences.category}"`, '99999')
            .order(`"${userPreferences.category}"`, { ascending: false })
            .limit(20)
          
          if (directQueryError) {
            console.error('Direct query error:', directQueryError)
          } else {
            console.log('DEBUG: Direct query - Colleges above 99999:', directQueryData?.length || 0)
            if (directQueryData && directQueryData.length > 0) {
              console.log('DEBUG: Direct query results:', directQueryData.map(item => ({
                      college: item['College Name'],
                      rank: item[userPreferences.category],
                rankType: typeof item[userPreferences.category]
              })))
            }
          }
        } catch (error) {
          console.error('Debug query failed:', error)
        }
        
        try {
          // Create separate queries for each branch and combine results
          const branchQueries = userPreferences.selectedBranches.map(async (branch) => {
            const baseBranch = branch.trim()
            console.log('Querying for branch:', baseBranch, 'with rank:', userRank)
            
            try {
              // Use the simple query approach that works (same as direct query)
              console.log('DEBUG: Using simple query approach for branch:', baseBranch)
              let query = supabase
                .from('Rank')
                .select(`
                  "College Code",
                  "College Name",
                  "Branch Name",
                  "BranchNo",
                  "${userPreferences.category}",
                  "District",
                  "avgMedianSalary",
                  "avgPlacementPercentage",
                  "PowerScore"
                `)
                .not(`"${userPreferences.category}"`, 'is', null)
                .not(`"${userPreferences.category}"`, 'eq', '')
                .not(`"${userPreferences.category}"`, 'eq', 'NULL')
                .order(`"${userPreferences.category}"`, { ascending: false })
                .limit(1000)

              // Apply branch filter based on selection type
              if (userPreferences.branchOption === 'specific') {
                // For specific branches, use more flexible matching but still specific
                console.log('DEBUG: Using specific branch matching for:', baseBranch)
                
                // Try exact match first, then fallback to more specific pattern matching
                const { data: exactMatch, error: exactError } = await supabase
                  .from('Rank')
                  .select('Branch Name')
                  .eq('Branch Name', baseBranch)
                  .limit(1)
                
                if (exactMatch && exactMatch.length > 0) {
                  console.log('DEBUG: Found exact match for branch:', baseBranch)
                  query = query.eq('Branch Name', baseBranch)
                } else {
                  console.log('DEBUG: No exact match found, using specific pattern matching for:', baseBranch)
                  // Use more specific pattern matching that's still restrictive
                  query = query.ilike('Branch Name', baseBranch)
                }
              } else {
                // For other options (cs, circuit), use pattern matching
                console.log('DEBUG: Using pattern matching for branch:', baseBranch)
                query = query.ilike('Branch Name', `%${baseBranch}%`)
              }

              // Apply district filter if specified
              if (userPreferences.selectedDistricts.length > 0) {
                console.log('Applying district filter:', userPreferences.selectedDistricts)
                query = query.in('District', userPreferences.selectedDistricts)
              }

              // Execute query
              const { data: rankData, error: rankError } = await query

              if (rankError) {
                console.error('Database query error for rank colleges:', rankError)
                return []
              }

              if (!rankData || rankData.length === 0) {
                console.log(`No colleges found for branch "${baseBranch}"`)
                return []
              }

              // Filter colleges above user's rank in JavaScript
              const filteredRankData = rankData.filter(item => {
                    const rank = parseFloat(item[userPreferences.category])
                return !isNaN(rank) && rank > userRank
              })

              console.log(`Found ${filteredRankData.length} colleges above rank ${userRank} for branch "${baseBranch}" (from ${rankData.length} total)`)
              
              // Check for colleges above 100,000 in the results
              const above100k = filteredRankData.filter(item => {
                const rank = parseFloat(item[userPreferences.category])
                return rank > 100000
              })
              console.log('DEBUG: Colleges above 100,000 in results:', above100k.length)
              
              // Debug: Show some sample rank values to understand the data
              if (filteredRankData.length > 0) {
                console.log('DEBUG: Sample rank values from query:', filteredRankData.slice(0, 5).map(item => ({
                  college: item['College Name'],
                  rank: item[userPreferences.category],
                  rankType: typeof item[userPreferences.category],
                  rankParsed: parseFloat(item[userPreferences.category])
                })))
                
                // Show the highest rank values
                const sortedByRank = [...filteredRankData].sort((a, b) => {
                  const rankA = parseFloat(a[userPreferences.category])
                  const rankB = parseFloat(b[userPreferences.category])
                  return rankB - rankA
                })
                console.log('DEBUG: Top 5 highest ranks from query:', sortedByRank.slice(0, 5).map(item => ({
                  college: item['College Name'],
                  rank: item[userPreferences.category],
                  rankParsed: parseFloat(item[userPreferences.category])
                })))
              }

              // Transform results
              const transformedResults = filteredRankData.map(item => ({
                code: item['College Code']?.toString().trim() || '',
                name: item['College Name']?.toString().trim() || '',
                branch: item['Branch Name']?.toString().trim() || '',
                branchNo: Number(item['BranchNo']) || 999,
                rank: parseFloat(item[userPreferences.category]) || 0,
                medianSalary: parseFloat(item['avgMedianSalary']) || 0,
                placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
                powerScore: parseFloat(item['PowerScore']) || 0,
                district: item['District']?.toString().trim() || '',
                category: userPreferences.category,
                isSelected: false
              }))

              return transformedResults
            } catch (error) {
              console.error(`Error processing branch ${baseBranch}:`, error)
              return []
            }
          })

          const branchResults = await Promise.all(branchQueries)
          const rankResults = branchResults.flat()
          
          console.log('Rank-based results from selected branches:', rankResults.length)
          console.log('Rank-based results sample:', rankResults.slice(0, 2))
          allResults = [...allResults, ...rankResults]
        } catch (error) {
          console.error('Error fetching rank-based results:', error)
        }
      }

      // FALLBACK: Query all branches if no branches were selected
      if (userPreferences.selectedBranches.length === 0) {
        console.log('Fallback: Querying all branches for rank-based results')
        
        try {
          // Build the base query for all branches
          let query = supabase
              .from('Rank')
              .select(`
                "College Code",
                "College Name",
                "Branch Name",
                "BranchNo",
                "${userPreferences.category}",
                "District",
                "avgMedianSalary",
                "avgPlacementPercentage",
                "PowerScore"
              `)
            .gt(`"${userPreferences.category}"`, userRank.toString())  // Use string comparison
            .gt(`"${userPreferences.category}"`, '0')                 // Use string comparison
              .not(`"${userPreferences.category}"`, 'is', null)
              .not(`"${userPreferences.category}"`, 'eq', '')
              .not(`"${userPreferences.category}"`, 'eq', 'NULL')  // Exclude NULL string values
              
              // Apply district filter if specified
              if (userPreferences.selectedDistricts.length > 0) {
            console.log('Applying district filter:', userPreferences.selectedDistricts)
            query = query.in('District', userPreferences.selectedDistricts)
          }

          const { data: allRankData, error: allRankError } = await query

          if (allRankError) {
            console.error('Error querying all rank data:', allRankError)
          } else if (allRankData && allRankData.length > 0) {
            console.log(`Found ${allRankData.length} colleges with rank > ${userRank} across all branches`)
            
            const transformedResults = allRankData.map(item => ({
              code: item['College Code']?.toString().trim() || '',
              name: item['College Name']?.toString().trim() || '',
              branch: item['Branch Name']?.toString().trim() || '',
              branchNo: Number(item['BranchNo']) || 999,
              rank: parseFloat(item[userPreferences.category]) || 0,
              medianSalary: parseFloat(item['avgMedianSalary']) || 0,
              placementPercentage: parseFloat(item['avgPlacementPercentage']) || 0,
              powerScore: parseFloat(item['PowerScore']) || 0,
              district: item['District']?.toString().trim() || '',
              category: userPreferences.category,
              isSelected: false
            }))
            
            allResults = [...allResults, ...transformedResults]
          }
        } catch (error) {
          console.error('Error fetching all rank-based results:', error)
        }
      }

      // Remove duplicates based on college code and branch
      const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.code === result.code && r.branch === result.branch)
      )

      // Filter out colleges with rank 0
      const validResults = uniqueResults.filter(result => result.rank > 0)

      // For rank-based results: Additional filtering to ensure non-selected colleges are above user's rank
      const rankFilteredResults = validResults.filter(result => {
        // Selected colleges should be included regardless of rank
        if (result.isSelected) {
          return true
        }
        // Non-selected colleges are included from the student's rank upward
        // (closing rank at or worse than theirs — i.e. colleges they can get).
        return result.rank >= userRank
      })

      // Filter out colleges with missing placement and salary data (for traditional method)
      const dataFilteredResults = rankFilteredResults.filter(result => {
        // Selected colleges should be included regardless of data availability
        if (result.isSelected) {
          return true
        }
        // Non-selected colleges should have both placement percentage and median salary data
        return result.placementPercentage > 0 && result.medianSalary > 0
      })

      console.log('Total unique results:', uniqueResults.length)
      console.log('Valid results (rank > 0):', validResults.length)
      console.log('Rank filtered results (non-selected above user rank):', rankFilteredResults.length)
      console.log('Data filtered results (with placement & salary data):', dataFilteredResults.length)
      console.log('Selected colleges in results:', dataFilteredResults.filter(r => r.isSelected).length)
      console.log('Non-selected colleges in results:', dataFilteredResults.filter(r => !r.isSelected).length)

      // NEW LOGIC: Apply different sorting and limiting based on choice type
      let finalResults
      if (userPreferences.choiceType === 'smart') {
        // AI METHOD: order by rank ascending — from the student's rank to higher —
        // and take the nearest colleges up to the plan limit (PowerScore is shown
        // alongside, not used for ordering).
        const maxChoices = usage.maxChoices || 5 // Default to freemium limit
        console.log(`AI Method: Sorting by rank (from the student's rank upward) and taking top ${maxChoices} colleges`)
        let sortedResults = dataFilteredResults
          .sort((a, b) => {
          // Selected colleges come first
          if (a.isSelected && !b.isSelected) return -1
          if (!a.isSelected && b.isSelected) return 1

          // Then from their rank to higher (ascending closing rank)
          return a.rank - b.rank
        })
        
        finalResults = sortedResults.slice(0, maxChoices)
        finalResults = await withAspirationalReach(finalResults, maxChoices, 'rank')
        console.log(`AI Method - Initial results count: ${finalResults.length}`)

        // Check if user got enough colleges based on their plan
        if (finalResults.length < maxChoices) {
          console.log(`User only got ${finalResults.length} colleges, need ${maxChoices}. Fetching null colleges to supplement.`)
          
          // Fetch null colleges to supplement the results
          const nullColleges = await fetchNullCutoffColleges('rank', userPreferences, usage)
          
          if (nullColleges.length > 0) {
            console.log(`Adding ${nullColleges.length} null colleges to supplement results`)
            
            // Combine existing results with null colleges
            const combinedResults = [...finalResults, ...nullColleges]
            
            // Remove duplicates and limit to maxChoices
            const uniqueCombinedResults = Array.from(
              new Map(
                combinedResults.map(item => [
                  `${item.code}-${item.branch}`,
                  item
                ])
              ).values()
            ).slice(0, maxChoices)
            
            finalResults = uniqueCombinedResults
            console.log(`AI Method - Final results count after adding null colleges: ${finalResults.length}`)
          }
        }

        // Group results by branches for AI method
        const groupedResults = groupCollegesByBranches(finalResults)
        
        console.log('AI Method - Final results count:', finalResults.length)
        console.log('AI Method - Grouped results count:', groupedResults.length)

        // Check if null colleges are present in the results
        const hasNullColleges = finalResults.some(college => college.isNullCollege)
        
        // AI Method: enrich with the closing cutoff (from the Cutoff table) and
        // the trend rate before displaying, so results show rank + PowerScore + cutoff.
        const withCutoff = await enrichResultsWithCutoff(groupedResults)
        const displayResults = await enrichResultsWithTrendRate(withCutoff)

        // Add results message to chat
        const resultsMessage: Message = {
          type: 'bot',
          content: hasNullColleges
            ? `Based on your rank and last year's TNEA + NIRF data, we've identified colleges that had seats available previously. While it may be a close call, these suggestions are smart backup options to help you explore every possible opportunity with confidence!\n\nHere are your AI-powered rank-based choice filling results:`
            : `Here are your AI-powered rank-based choice filling results:`,
          results: displayResults
        }

        setMessages(prev => [...prev, resultsMessage])
        setCollegeResults(displayResults)
        setIsAIProcessing(false)
      } else {
        // TRADITIONAL METHOD: Sort by rank (ascending - lower ranks first) and take top colleges based on plan
        const maxChoices = usage.maxChoices || 5 // Default to freemium limit
        console.log(`Traditional Method: Sorting by rank and taking top ${maxChoices} colleges`)
        let sortedResults = dataFilteredResults
          .sort((a, b) => {
        // Selected colleges come first
        if (a.isSelected && !b.isSelected) return -1
        if (!a.isSelected && b.isSelected) return 1
        
        // Then sort by rank (ascending - lower ranks first, which are better colleges)
        return a.rank - b.rank
      })
        
        finalResults = sortedResults.slice(0, maxChoices)
        finalResults = await withAspirationalReach(finalResults, maxChoices, 'rank')
        console.log(`Traditional Method - Initial results count: ${finalResults.length}`)

        // Check if user got enough colleges based on their plan
        if (finalResults.length < maxChoices) {
          console.log(`User only got ${finalResults.length} colleges, need ${maxChoices}. Fetching null colleges to supplement.`)
          
          // Fetch null colleges to supplement the results
          const nullColleges = await fetchNullCutoffColleges('rank', userPreferences, usage)
          
          if (nullColleges.length > 0) {
            console.log(`Adding ${nullColleges.length} null colleges to supplement results`)
            
            // Combine existing results with null colleges
            const combinedResults = [...finalResults, ...nullColleges]
            
            // Remove duplicates and limit to maxChoices
            const uniqueCombinedResults = Array.from(
              new Map(
                combinedResults.map(item => [
                  `${item.code}-${item.branch}`,
                  item
                ])
              ).values()
            ).slice(0, maxChoices)
            
            finalResults = uniqueCombinedResults
            console.log(`Traditional Method - Final results count after adding null colleges: ${finalResults.length}`)
          }
        }

        console.log('Traditional Method - Final results count:', finalResults.length)

      // Check if null colleges are present in the results
      const hasNullColleges = finalResults.some(college => college.isNullCollege)
      
      // Fetch trend rate for the computed results before displaying.
      const displayResults = await enrichResultsWithTrendRate(finalResults)

      // Add results message to chat
      const resultsMessage: Message = {
        type: 'bot',
        content: hasNullColleges
          ? `Based on your rank and last year's TNEA + NIRF data, we've identified colleges that had seats available previously. While it may be a close call, these suggestions are smart backup options to help you explore every possible opportunity with confidence!\n\nHere are your traditional rank-based choice filling results:`
          : `Here are your traditional rank-based choice filling results:`,
        results: displayResults
      }

      setMessages(prev => [...prev, resultsMessage])
      setCollegeResults(displayResults)
      setIsAIProcessing(false)
      }

    } catch (error) {
      console.error('Error generating rank-based results:', error)
      toast.error('Failed to generate rank-based results. Please try again.')
    }
  }

  // Show loading while auth state is still resolving
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005596] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show signing out state
  if (isSigningOut) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005596] mx-auto"></div>
            <p className="mt-4 text-gray-600">Signing out...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        {isAIProcessing && (
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg font-semibold text-blue-700">AI is working the magic...</p>
          </div>
        )}
        {step === 'form' ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 text-[#005596]">Choice Filling</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                Fill in your details to get AI-assisted choice filling recommendations
              </p>
              
              {/* User Plan Status */}
              {usageData && (
                <div className="bg-white rounded-lg shadow-md p-4 mb-6 max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-left">
                      <p className="text-sm text-gray-600">Current Plan</p>
                      <p className="text-lg font-semibold text-[#005596]">{usageData.currentPlan}</p>
                      <p className="text-xs text-gray-500">{usageData.maxChoices} max choices</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Available Trials</p>
                      <p className="text-lg font-semibold text-green-600">
                        {usageData.planType?.startsWith('premium') ? 'Unlimited' : (usageData.availableTrials || 0)}
                      </p>
                      <p className="text-xs text-gray-500">Used: {usageData.usageCount} time(s)</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkUsage}
                      className="text-xs"
                    >
                      Refresh Plan Status
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center mb-4">
                <TrackReferrals />
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="text-[#005596] hover:bg-[#005596] hover:text-white"
                >
                  {isSigningOut ? "Signing Out..." : "Sign Out"}
                </Button>
              </div>
            </div>

            <Card>
              <form onSubmit={handleFormSubmit}>
                <CardHeader>
                  <CardTitle>Student Details</CardTitle>
                  <CardDescription>
                    {isLoadingUserData ? "Loading your data..." : 
                     isNewUser === true ? "Enter your details to get started with choice filling" :
                     isNewUser === false ? "Your details are saved and cannot be edited. Click 'Start Choice Filling' to proceed." :
                     "Loading..."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {detailsError && (
                    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {detailsError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Enter your full name"
                        required
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder="Enter 10 digit phone number"
                        maxLength={10}
                        required
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="example@email.com"
                        required
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rollNumber">Roll Number (Optional)</Label>
                      <Input
                        id="rollNumber"
                        name="rollNumber"
                        value={formData.rollNumber}
                        onChange={handleInputChange}
                        placeholder="Enter 7 digit roll number (optional)"
                        maxLength={7}
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        required
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rank">General Rank</Label>
                      <Input
                        id="rank"
                        name="rank"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.rank}
                        onChange={handleInputChange}
                        placeholder="Enter your rank (1-299999)"
                        required
                        min="1"
                        max="299999"
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="communityRank">Community Rank</Label>
                      <Input
                        id="communityRank"
                        name="communityRank"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.communityRank}
                        onChange={handleInputChange}
                        placeholder={formData.category === 'OC' ? 'Not applicable for OC' : 'Enter your community rank (1-299999)'}
                        required={formData.category !== 'OC'}
                        min="1"
                        max="299999"
                        readOnly={formData.category === 'OC' || (isNewUser === false && !!formData.communityRank)}
                        disabled={formData.category === 'OC' || (isNewUser === false && !!formData.communityRank)}
                        className={formData.category === 'OC' || (isNewUser === false && !!formData.communityRank) ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="mathsMarks">Mathematics Marks</Label>
                      <Input
                        id="mathsMarks"
                        name="mathsMarks"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.mathsMarks}
                        onChange={handleInputChange}
                        placeholder="Enter marks (35-100)"
                        required
                        min="35"
                        max="100"
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="physicsMarks">Physics Marks</Label>
                      <Input
                        id="physicsMarks"
                        name="physicsMarks"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.physicsMarks}
                        onChange={handleInputChange}
                        placeholder="Enter marks (35-100)"
                        required
                        min="35"
                        max="100"
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chemistryMarks">Chemistry Marks</Label>
                      <Input
                        id="chemistryMarks"
                        name="chemistryMarks"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.chemistryMarks}
                        onChange={handleInputChange}
                        placeholder="Enter marks (35-100)"
                        required
                        min="35"
                        max="100"
                        readOnly={isNewUser === false}
                        disabled={isNewUser === false}
                        className={isNewUser === false ? "bg-gray-50" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cutoff">Cutoff</Label>
                      <Input
                        id="cutoff"
                        name="cutoff"
                        value={formData.cutoff}
                        readOnly
                        placeholder="Cutoff will be calculated automatically"
                        className="bg-gray-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Reservation Category</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          category: value,
                          // OC has no community rank — clear any previously entered value.
                          communityRank: value === 'OC' ? '' : prev.communityRank
                        }))}
                        required
                        disabled={isNewUser === false}
                      >
                        <SelectTrigger className={isNewUser === false ? "bg-gray-50" : ""}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {reservationCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-8"
                  >
                    {isSubmitting ? "Submitting..." : "Start Choice Filling"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 text-[#005596]">AI-Assisted Choice Filling</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                Let AARVI help you make the best college choices
              </p>
              {/* Small Pricing Plan Cards */}
              <div className="flex flex-wrap gap-4 justify-center items-stretch mb-8">
                {/* Free Plan */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 w-56 flex flex-col items-center">
                  <div className="text-xs font-bold text-gray-500 mb-1">FREE</div>
                  <div className="text-xl font-bold text-[#005596]">Free</div>
                  <div className="text-sm text-gray-700 mb-2">upto 10 Choices</div>
                  <div className="text-xs text-gray-500 mb-2">Traditional · AI chat 2</div>
                  <div className="text-xs text-green-600 font-semibold">1 Free Trial</div>
                </div>
                {/* Secure Plan */}
                <div className="bg-white border border-green-200 rounded-lg shadow-sm px-4 py-3 w-56 flex flex-col items-center">
                  <div className="text-xs font-bold text-green-700 mb-1">SECURE</div>
                  <div className="text-xl font-bold text-green-700">₹299</div>
                  <div className="text-sm text-gray-700 mb-2">upto 75 Choices</div>
                  <div className="text-xs text-gray-500 mb-2">Traditional · 5 aspirational</div>
                  <div className="text-xs text-green-600 font-semibold">3 Referrals</div>
                </div>
                {/* Assured Plan */}
                <div className="bg-white border border-blue-200 rounded-lg shadow-sm px-4 py-3 w-56 flex flex-col items-center">
                  <div className="text-xs font-bold text-blue-700 mb-1">ASSURED</div>
                  <div className="text-xl font-bold text-blue-700">₹399</div>
                  <div className="text-sm text-gray-700 mb-2">upto 200 Choices</div>
                  <div className="text-xs text-gray-500 mb-2">Traditional · 15 aspirational</div>
                  <div className="text-xs text-blue-600 font-semibold">5 Referrals</div>
                </div>
                {/* Assured+ Plan */}
                <div className="bg-white border border-purple-300 rounded-lg shadow-sm px-4 py-3 w-56 flex flex-col items-center">
                  <div className="text-xs font-bold text-purple-700 mb-1">ASSURED+</div>
                  <div className="text-xl font-bold text-purple-700">₹699</div>
                  <div className="text-sm text-gray-700 mb-2">upto 300+ Choices</div>
                  <div className="text-xs text-gray-500 mb-2">AI Method · 50 aspirational</div>
                  <div className="text-xs text-purple-600 font-semibold">10 Referrals</div>
                </div>
              </div>
            </div>

            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="h-[600px] overflow-y-auto space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.showSelectedOptions
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        {message.showSelectedOptions ? (
                          // Selected Options Display
                          <div className="space-y-4">
                            <h3 className="font-medium text-lg mb-2">Your Selected Options:</h3>
                            {userPreferences.selectedDistricts.length > 0 && (
                              <div className="mb-2">
                                <p className="font-medium">Selected Districts:</p>
                                <ul className="list-disc list-inside">
                                  {userPreferences.selectedDistricts.map(district => (
                                    <li key={district}>{district}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {userPreferences.selectedBranches.length > 0 && (
                              <div className="mb-2">
                                <p className="font-medium">Selected Branches:</p>
                                <ul className="list-disc list-inside">
                                  {userPreferences.selectedBranches.map(branch => (
                                    <li key={branch}>{branch}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {userPreferences.selectedColleges.length > 0 && (
                              <div>
                                <p className="font-medium">Selected Colleges:</p>
                                <ul className="list-disc list-inside">
                                  {availableColleges
                                    .filter(college => userPreferences.selectedColleges.includes(college.code))
                                    .map(college => (
                                      <li key={college.code}>{college.name} ({college.code})</li>
                                    ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : message.showPricingPlans ? (
                          // Pricing Plans Display
                          <div className="space-y-6">
                            <p className="mb-4">{message.content}</p>
                            
                            {/* Current Plan Info */}
                            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                              <CardContent className="pt-6">
                                <div className="text-center space-y-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <Trophy className="h-6 w-6 text-green-600" />
                                    <h3 className="text-xl font-bold text-green-700">Your Current Plan</h3>
                                  </div>
                                  <div className="text-3xl font-bold text-green-600">{usageData?.maxChoices || 10} Choices</div>
                                  <p className="text-gray-600">You've successfully used your free plan!</p>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Plan Selection Cards */}
                            <div className="space-y-4">
                              <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Choose Your Plan</h3>
                                <p className="text-sm text-gray-600">Select the plan that best fits your needs</p>
                              </div>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 75 Choices Plan */}
                                <Card className="border-2 border-green-200 hover:border-green-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                                  <CardHeader className="text-center pb-4">
                                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                      <span className="text-2xl font-bold text-green-600">upto 75</span>
                                    </div>
                                    <CardTitle className="text-xl text-green-700">upto 75 Choices Plan</CardTitle>
                                    <p className="text-sm text-gray-600">Perfect for focused college selection</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {/* Referral Option */}
                                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <Users className="h-4 w-4 text-green-600" />
                                          <span className="font-semibold text-green-700">Free with Referrals</span>
                                        </div>
                                        <div className="text-2xl font-bold text-green-600 mb-1">3 Referrals</div>
                                        <p className="text-xs text-gray-600">Complete choice filling</p>
                                      </div>
                                      <Button 
                                        onClick={() => {
                                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                                          if (trackReferralsButton) {
                                            trackReferralsButton.click()
                                          }
                                        }}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        size="sm"
                                      >
                                        <Users className="h-4 w-4 mr-2" />
                                        Get Free with 3 Referrals
                                      </Button>
                                    </div>
                                    
                                    <div className="text-center">
                                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                                    </div>
                                    
                                    {/* Payment Option */}
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <IndianRupee className="h-4 w-4 text-blue-600" />
                                          <span className="font-semibold text-blue-700">Premium Access</span>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600 mb-1">₹299</div>
                                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                                      </div>
                                      <PaymentButton
                                        amount={299}
                                        planName="Secure"
                                        onSuccess={handlePaymentSuccess}
                                        onError={handlePaymentError}
                                        onClick={() => setShowPricingDialog(false)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        userId={user?.id}
                                        userEmail={user?.email}
                                      >
                                        <IndianRupee className="h-4 w-4 mr-2" />
                                        Get Premium Access
                                      </PaymentButton>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* 200 Choices Plan */}
                                <Card className="border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                                  <CardHeader className="text-center pb-4">
                                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                      <span className="text-2xl font-bold text-blue-600">upto 200</span>
                                    </div>
                                    <CardTitle className="text-xl text-blue-700">upto 200 Choices Plan</CardTitle>
                                    <p className="text-sm text-gray-600">Comprehensive college exploration</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {/* Referral Option */}
                                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <Users className="h-4 w-4 text-green-600" />
                                          <span className="font-semibold text-green-700">Free with Referrals</span>
                                        </div>
                                        <div className="text-2xl font-bold text-green-600 mb-1">5 Referrals</div>
                                        <p className="text-xs text-gray-600">Complete choice filling</p>
                                      </div>
                                      <Button 
                                        onClick={() => {
                                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                                          if (trackReferralsButton) {
                                            trackReferralsButton.click()
                                          }
                                        }}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        size="sm"
                                      >
                                        <Users className="h-4 w-4 mr-2" />
                                        Get Free with 5 Referrals
                                      </Button>
                                    </div>
                                    
                                    <div className="text-center">
                                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                                    </div>
                                    
                                    {/* Payment Option */}
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <IndianRupee className="h-4 w-4 text-blue-600" />
                                          <span className="font-semibold text-blue-700">Premium Access</span>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600 mb-1">₹399</div>
                                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                                      </div>
                                      <PaymentButton
                                        amount={399}
                                        planName="Assured"
                                        onSuccess={handlePaymentSuccess}
                                        onError={handlePaymentError}
                                        onClick={() => setShowPricingDialog(false)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        userId={user?.id}
                                        userEmail={user?.email}
                                      >
                                        <IndianRupee className="h-4 w-4 mr-2" />
                                        Get Premium Access
                                      </PaymentButton>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>

                            {/* Track Referrals Section */}
                            <Card className="border-2 border-purple-200 bg-purple-50">
                              <CardContent className="pt-6">
                                <div className="text-center space-y-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <Users className="h-5 w-5 text-purple-600" />
                                    <h3 className="text-lg font-semibold text-purple-700">Track Your Referrals</h3>
                                  </div>
                                  <p className="text-sm text-gray-600">Monitor your referral progress and earnings</p>
                                  <Button 
                                    onClick={() => {
                                      const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                                      if (trackReferralsButton) {
                                        trackReferralsButton.click()
                                      }
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    size="sm"
                                  >
                                    <Users className="h-4 w-4 mr-2" />
                                    View Referral Dashboard
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Disclaimer */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <p className="text-sm text-yellow-800 font-medium mb-1">Important Note:</p>
                                  <p className="text-xs text-yellow-700">
                                    Referrals will only be counted after your friends complete the choice filling feature. 
                                    You can track your referral progress anytime using the button above.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : message.showPricingPlans ? (
                          // Pricing Plans Display
                          <div className="space-y-6">
                            <p className="mb-4">{message.content}</p>
                            
                            {/* Current Plan Info */}
                            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                              <CardContent className="pt-6">
                                <div className="text-center space-y-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <Trophy className="h-6 w-6 text-green-600" />
                                    <h3 className="text-xl font-bold text-green-700">Your Current Plan</h3>
                                  </div>
                                  <div className="text-3xl font-bold text-green-600">{usageData?.maxChoices || 10} Choices</div>
                                  <p className="text-gray-600">You've successfully used your free plan!</p>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Plan Selection Cards */}
                            <div className="space-y-4">
                              <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Choose Your Plan</h3>
                                <p className="text-sm text-gray-600">Select the plan that best fits your needs</p>
                              </div>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 75 Choices Plan */}
                                <Card className="border-2 border-green-200 hover:border-green-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                                  <CardHeader className="text-center pb-4">
                                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                      <span className="text-2xl font-bold text-green-600">upto 75</span>
                                    </div>
                                    <CardTitle className="text-xl text-green-700">upto 75 Choices Plan</CardTitle>
                                    <p className="text-sm text-gray-600">Perfect for focused college selection</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {/* Referral Option */}
                                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <Users className="h-4 w-4 text-green-600" />
                                          <span className="font-semibold text-green-700">Free with Referrals</span>
                                        </div>
                                        <div className="text-2xl font-bold text-green-600 mb-1">3 Referrals</div>
                                        <p className="text-xs text-gray-600">Complete choice filling</p>
                                      </div>
                                      <Button 
                                        onClick={() => {
                                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                                          if (trackReferralsButton) {
                                            trackReferralsButton.click()
                                          }
                                        }}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        size="sm"
                                      >
                                        <Users className="h-4 w-4 mr-2" />
                                        Get Free with 3 Referrals
                                      </Button>
                                    </div>
                                    
                                    <div className="text-center">
                                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                                    </div>
                                    
                                    {/* Payment Option */}
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <IndianRupee className="h-4 w-4 text-blue-600" />
                                          <span className="font-semibold text-blue-700">Premium Access</span>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600 mb-1">₹399</div>
                                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                                      </div>
                                      <PaymentButton
                                        amount={399}
                                        planName="Assured"
                                        onSuccess={handlePaymentSuccess}
                                        onError={handlePaymentError}
                                        onClick={() => setShowPricingDialog(false)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        userId={user?.id}
                                        userEmail={user?.email}
                                      >
                                        <IndianRupee className="h-4 w-4 mr-2" />
                                        Get Premium Access
                                      </PaymentButton>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* 200 Choices Plan */}
                                <Card className="border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                                  <CardHeader className="text-center pb-4">
                                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                      <span className="text-2xl font-bold text-blue-600">upto 200</span>
                                    </div>
                                    <CardTitle className="text-xl text-blue-700">upto 200 Choices Plan</CardTitle>
                                    <p className="text-sm text-gray-600">Comprehensive college exploration</p>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {/* Referral Option */}
                                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <Users className="h-4 w-4 text-green-600" />
                                          <span className="font-semibold text-green-700">Free with Referrals</span>
                                        </div>
                                        <div className="text-2xl font-bold text-green-600 mb-1">5 Referrals</div>
                                        <p className="text-xs text-gray-600">Complete choice filling</p>
                                      </div>
                                      <Button 
                                        onClick={() => {
                                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                                          if (trackReferralsButton) {
                                            trackReferralsButton.click()
                                          }
                                        }}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        size="sm"
                                      >
                                        <Users className="h-4 w-4 mr-2" />
                                        Get Free with 5 Referrals
                                      </Button>
                                    </div>
                                    
                                    <div className="text-center">
                                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                                    </div>
                                    
                                    {/* Payment Option */}
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                      <div className="text-center mb-3">
                                        <div className="flex items-center justify-center gap-2 mb-2">
                                          <IndianRupee className="h-4 w-4 text-blue-600" />
                                          <span className="font-semibold text-blue-700">Premium Access</span>
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600 mb-1">₹399</div>
                                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                                      </div>
                                      <PaymentButton
                                        amount={399}
                                        planName="Assured"
                                        onSuccess={handlePaymentSuccess}
                                        onError={handlePaymentError}
                                        onClick={() => setShowPricingDialog(false)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        userId={user?.id}
                                        userEmail={user?.email}
                                      >
                                        <IndianRupee className="h-4 w-4 mr-2" />
                                        Get Premium Access
                                      </PaymentButton>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>

                            {/* Track Referrals Section */}
                            <Card className="border-2 border-purple-200 bg-purple-50">
                              <CardContent className="pt-6">
                                <div className="text-center space-y-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <Users className="h-5 w-5 text-purple-600" />
                                    <h3 className="text-lg font-semibold text-purple-700">Track Your Referrals</h3>
                                  </div>
                                  <p className="text-sm text-gray-600">Monitor your referral progress and earnings</p>
                                  <Button 
                                    onClick={() => {
                                      const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                                      if (trackReferralsButton) {
                                        trackReferralsButton.click()
                                      }
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    size="sm"
                                  >
                                    <Users className="h-4 w-4 mr-2" />
                                    View Referral Dashboard
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Disclaimer */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <p className="text-sm text-yellow-800 font-medium mb-1">Important Note:</p>
                                  <p className="text-xs text-yellow-700">
                                    Referrals will only be counted after your friends complete the choice filling feature. 
                                    You can track your referral progress anytime using the button above.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : message.results ? (
                          <div className="space-y-4">
                            <p className="mb-4">{message.content}</p>
                            {/* Colour legend for the choice buckets */}
                            <div className="flex flex-wrap gap-4 text-sm mb-2">
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
                                Aspirational choices
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block h-3 w-3 rounded-sm bg-yellow-400" />
                                Matching colleges
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block h-3 w-3 rounded-sm bg-pink-400" />
                                Safe choices
                              </span>
                            </div>
                            <div className="flex justify-end mb-2">
                              <Button onClick={generatePDF} className="flex items-center space-x-2">
                                <Download className="h-4 w-4" />
                                <span>Download Results</span>
                              </Button>
                            </div>
                            <div className="overflow-x-auto">
                              {userPreferences.choiceType === 'smart' ? (
                                // Smart display — one numbered choice per college-branch
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[80px]">Choice No</TableHead>
                                      <TableHead>College Code</TableHead>
                                      <TableHead>College Name</TableHead>
                                      <TableHead>Branch</TableHead>
                                      <TableHead>District</TableHead>
                                      <TableHead>PowerScore</TableHead>
                                      {userPreferences.resultType === 'rank' && <TableHead>Rank</TableHead>}
                                      {userPreferences.resultType === 'rank' && <TableHead>Cutoff</TableHead>}
                                      <TableHead>Trend Rate</TableHead>
                                      <TableHead>Type</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {flattenSmartChoices(collegeResults).map(({ college, branch }, index) => {
                                      const bucket = getBranchBucket(college, branch)
                                      return (
                                        <TableRow
                                          key={`${college.code}-${branch.name}-${index}`}
                                          className={bucketRowClass(bucket)}
                                        >
                                          <TableCell className="font-medium text-blue-600 dark:text-blue-400">
                                            {index + 1}
                                          </TableCell>
                                          <TableCell>{college.code}</TableCell>
                                          <TableCell className="font-medium">{college.name}</TableCell>
                                          <TableCell>{branch.name}</TableCell>
                                          <TableCell>{college.district || '-'}</TableCell>
                                          <TableCell>{branch.powerScore || 0}</TableCell>
                                          {userPreferences.resultType === 'rank' && (
                                            <TableCell>{branch.rank || 0}</TableCell>
                                          )}
                                          {userPreferences.resultType === 'rank' && (
                                            <TableCell>{branch.cutoff != null ? branch.cutoff : '-'}</TableCell>
                                          )}
                                          <TableCell>{renderTrendRate(branch.trendRate)}</TableCell>
                                          <TableCell>
                                            <span className="inline-flex flex-wrap gap-1">
                                              {bucket === 'aspirational' && (
                                                <span className="px-2 py-1 text-xs bg-green-600 text-white rounded-full">Aspirational</span>
                                              )}
                                              {bucket === 'matching' && (
                                                <span className="px-2 py-1 text-xs bg-yellow-500 text-white rounded-full">Matching</span>
                                              )}
                                              {bucket === 'safe' && (
                                                <span className="px-2 py-1 text-xs bg-pink-500 text-white rounded-full">Safe</span>
                                              )}
                                              {(branch.isSelected || college.isSelected) && (
                                                <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">Selected</span>
                                              )}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              ) : (
                                // Traditional cutoff display - original table format
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[80px]">Choice no</TableHead>
                                      <TableHead>College Code</TableHead>
                                      <TableHead>College Name</TableHead>
                                      <TableHead>Branch</TableHead>
                                      <TableHead>{userPreferences.resultType === 'rank' ? 'Rank' : 'Cutoff'}</TableHead>
                                      <TableHead>PowerScore</TableHead>
                                      <TableHead>Trend Rate</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {message.results.map((college, index) => {
                                      console.log('DEBUG - College object:', college)
                                      console.log('DEBUG - College rank:', college.rank)
                                      console.log('DEBUG - College cutoff:', college.cutoff)
                                      return (
                                      <TableRow
                                        key={`${college.code}-${index}`}
                                        className={`${bucketRowClass(getChoiceBucket(college))} ${college.isSelected ? 'font-medium' : ''}`}
                                      >
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>{index + 1}</TableCell>
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>{college.code}</TableCell>
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>
                                          {college.name}
                                          {college.isSelected && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">Selected</span>
                                          )}
                                        </TableCell>
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>{college.branch}</TableCell>
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>
                                          {userPreferences.resultType === 'rank' ?
                                            (college.rank !== undefined ? college.rank.toString() : (college.cutoff || 0).toString()) :
                                            (college.cutoff || 0).toString()}
                                        </TableCell>
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>
                                          {college.powerScore || 0}
                                        </TableCell>
                                        <TableCell className={college.isSelected ? 'font-medium' : ''}>
                                          {renderTrendRate(college.trendRate)}
                                        </TableCell>
                                      </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                            <div className="flex justify-end mt-4">
                              <Button onClick={generatePDF} className="flex items-center space-x-2">
                                <Download className="h-4 w-4" />
                                <span>Download Results</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Regular Message Content
                          <>
                            {message.content && <p className="mb-2">{message.content}</p>}
                            
                            {/* District Selection UI */}
                            {message.showDistrictSelection && (
                              <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-4">
                                {message.availableDistricts?.map((district) => (
                                  <div key={district} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`district-${district}`}
                                      checked={selectedDistricts.includes(district)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          if (selectedDistricts.length < selectionLimit) {
                                            const newSelectedDistricts = [...selectedDistricts, district]
                                            setSelectedDistricts(newSelectedDistricts)
                                            // If we've reached the limit, automatically proceed
                                            if (newSelectedDistricts.length === selectionLimit) {
                                              setIsSelectingDistricts(false)
                                              setSelectionInProgress(false)
                                              setUserPreferences(prev => ({ ...prev, selectedDistricts: newSelectedDistricts }))
                                              const nextMsg: Message = {
                                                type: 'bot',
                                                content: 'Do you have any branches in mind?',
                                                options: ['Computer Science & Related', 'Circuit Branch & Related', 'Choose specific branches that you want']
                                              }
                                              setMessages(prev => [...prev, nextMsg])
                                            }
                                          } else {
                                            toast.error(`You can only select ${selectionLimit} district(s)`)
                                          }
                                        } else {
                                          setSelectedDistricts(selectedDistricts.filter(d => d !== district))
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`district-${district}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {district}
                                    </label>
                                  </div>
                                ))}
                                <div className="text-sm text-gray-500 mt-2">
                                  Selected: {selectedDistricts.length}/{selectionLimit} districts
                                </div>
                              </div>
                            )}

                            {/* Branch Selection UI */}
                            {message.showBranchSelection && message.availableBranches && (
                              <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-4">
                                {message.availableBranches.map((branch) => (
                                  <div key={branch} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`branch-${branch}`}
                                      checked={selectedBranches.includes(branch)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedBranches([...selectedBranches, branch])
                                        } else {
                                          setSelectedBranches(selectedBranches.filter(b => b !== branch))
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`branch-${branch}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {branch}
                                    </label>
                                  </div>
                                ))}
                                <div className="text-sm text-gray-500 mt-2">
                                  Selected: {selectedBranches.length} branches
                                </div>
                                {selectedBranches.length > 0 && (
                                  <div className="mt-4 flex justify-end">
                                    <Button
                                      onClick={() => {
                                        setIsSelectingBranches(false)
                                        setSelectionInProgress(false)
                                        setUserPreferences(prev => ({ ...prev, selectedBranches }))
                                        
                                        // First add the options message
                                        const optionsMessage: Message = {
                                          type: 'bot',
                                          content: '',
                                          showSelectedOptions: true
                                        }
                                        
                                        // Then add the choice type question. Both methods are always
                                        // shown; a free-plan user picking Power Score falls back to
                                        // Traditional with an explanation.
                                        const choiceTypeMessage: Message = {
                                          type: 'bot',
                                          content: 'Which method would you like to use for your choices?',
                                          options: [...CHOICE_METHOD_OPTIONS]
                                        }
                                        
                                        // Add both messages in sequence
                                        setMessages(prev => [...prev, optionsMessage, choiceTypeMessage])
                                      }}
                                    >
                                      Done
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* College Selection UI — rendered inline, directly under its question */}
                            {message.showCollegeSelection && isSelectingColleges && (
                              <div className="mt-4 space-y-4 border rounded-md p-4">
                                <Input
                                  placeholder="Search colleges by name or code..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <div className="max-h-[300px] overflow-y-auto border rounded-md p-3">
                                  <div className="space-y-2">
                                    {availableColleges
                                      .filter(college =>
                                        college.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        college.code.toLowerCase().includes(searchQuery.toLowerCase())
                                      )
                                      .map((college) => (
                                        <div
                                          key={`${college.code}-${college.name}`}
                                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                                        >
                                          <Checkbox
                                            id={`college-${college.code}-${college.name}`}
                                            checked={selectedCollegeCodes.includes(college.code)}
                                            onCheckedChange={(checked) => {
                                              const requiredCount = userPreferences.requiredCollegeCount || 5
                                              if (checked) {
                                                if (selectedCollegeCodes.length < requiredCount) {
                                                  setSelectedCollegeCodes([...selectedCollegeCodes, college.code])
                                                  // Reached the required count -> lock in and generate.
                                                  if (selectedCollegeCodes.length + 1 === requiredCount) {
                                                    const finalSelectedColleges = [...selectedCollegeCodes, college.code]
                                                    setIsSelectingColleges(false)
                                                    setUserPreferences(prev => ({ ...prev, selectedColleges: finalSelectedColleges }))
                                                    // Echo the picked colleges into the chat, under this question.
                                                    const selectedNames = availableColleges
                                                      .filter(c => finalSelectedColleges.includes(c.code))
                                                      .map(c => `${c.name} (${c.code})`)
                                                    setMessages(prev => [...prev, {
                                                      type: 'bot',
                                                      content: `Selected colleges:\n${selectedNames.map(n => `• ${n}`).join('\n')}`
                                                    }])
                                                    setPendingResultType(userPreferences.resultType ?? 'cutoff')
                                                  }
                                                } else {
                                                  toast.error(`You can only select ${requiredCount} colleges`)
                                                }
                                              } else {
                                                setSelectedCollegeCodes(selectedCollegeCodes.filter(code => code !== college.code))
                                              }
                                            }}
                                          />
                                          <label
                                            htmlFor={`college-${college.code}-${college.name}`}
                                            className="text-sm font-medium leading-none flex-1 cursor-pointer"
                                          >
                                            <div className="flex justify-between gap-2">
                                              <span>{college.name}</span>
                                              <span className="text-gray-500">{college.code}</span>
                                            </div>
                                          </label>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-500">
                                  Selected: {selectedCollegeCodes.length}/{userPreferences.requiredCollegeCount || 5} colleges
                                </div>
                                {selectedCollegeCodes.length > 0 && (
                                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                                    <h4 className="font-medium mb-2">Currently Selected Colleges:</h4>
                                    <ul className="list-disc list-inside">
                                      {availableColleges
                                        .filter(college => selectedCollegeCodes.includes(college.code))
                                        .map(college => (
                                          <li key={college.code}>{college.name} ({college.code})</li>
                                        ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Options Buttons */}
                            {message.options && (
                              <div className="space-y-2 mt-4">
                                {message.options.map((option, optionIndex) => (
                                  <Button
                                    key={optionIndex}
                                    variant={message.type === 'user' ? 'secondary' : 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => {
                                      if (option.includes('Select') || option.includes('Choose')) {
                                        setShowSelectedOptions(false)
                                      }
                                      handleChatResponse(message, option)
                                    }}
                                  >
                                    {option}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} className="scroll-mt-4" />
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </main>
      
      {/* Confirmation Dialog for New Users */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Your Details</DialogTitle>
            <DialogDescription>
              All your details will be saved and cannot be edited again. Are you sure you want to start?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmStart} disabled={isSubmitting}>
              {isSubmitting ? "Starting..." : "Start Choice Filling"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Restriction Modal */}
      <Dialog open={showUsageModal} onOpenChange={setShowUsageModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center pb-6">
            <DialogTitle className="flex items-center justify-center gap-3 text-2xl">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Choice Filling Access
            </DialogTitle>
            <DialogDescription className="text-base bg-yellow-100 border border-yellow-300 rounded-lg p-3 font-medium text-yellow-800">
              You've used your free trial. Choose your preferred plan to continue:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Current Status Cards */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Current Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-gray-600 mb-1">Current Plan</div>
                    <div className="font-bold text-blue-600 text-lg">{usageData?.currentPlan || 'Freemium'}</div>
                  </CardContent>
                </Card>
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-gray-600 mb-1">Max Choices</div>
                    <div className="font-bold text-green-600 text-lg">{usageData?.maxChoices || 5} colleges</div>
                  </CardContent>
                </Card>
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-gray-600 mb-1">Usage Count</div>
                    <div className="font-bold text-purple-600 text-lg">{usageData?.usageCount || 0} time(s)</div>
                  </CardContent>
                </Card>
              </div>
              {(usageData?.availableTrials > 0 || usageData?.planType?.startsWith('premium')) && (
                <Card className="border-2 border-orange-200 bg-orange-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-sm text-gray-600 mb-1">Available Trials</div>
                    <div className="font-bold text-orange-600 text-lg">
                      {usageData.planType?.startsWith('premium') ? 'Unlimited' : usageData.availableTrials}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Plan Selection Cards */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Choose Your Plan</h3>
                <p className="text-sm text-gray-600">Select the plan that best fits your needs</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 75 Choices Plan */}
                <Card className="border-2 border-green-200 hover:border-green-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-green-600">upto 75</span>
                    </div>
                    <CardTitle className="text-xl text-green-700">upto 75 Choices Plan</CardTitle>
                    <p className="text-sm text-gray-600">Perfect for focused college selection</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Referral Option */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700">Free with Referrals</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mb-1">3 Referrals</div>
                        <p className="text-xs text-gray-600">Complete choice filling</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setShowUsageModal(false)
                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                          if (trackReferralsButton) {
                            trackReferralsButton.click()
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Get Free with 3 Referrals
                      </Button>
                    </div>
                    
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                    </div>
                    
                    {/* Payment Option */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <IndianRupee className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">Premium Access</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-1">₹299</div>
                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                      </div>
                      <PaymentButton
                        amount={299}
                        planName="Secure"
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onClick={() => setShowUsageModal(false)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        userId={user?.id}
                        userEmail={user?.email}
                      >
                        <IndianRupee className="h-4 w-4 mr-2" />
                        Get Premium Access
                      </PaymentButton>
                    </div>
                  </CardContent>
                </Card>

                {/* 200 Choices Plan */}
                <Card className="border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-blue-600">upto 200</span>
                    </div>
                    <CardTitle className="text-xl text-blue-700">upto 200 Choices Plan</CardTitle>
                    <p className="text-sm text-gray-600">Comprehensive college exploration</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Referral Option */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700">Free with Referrals</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mb-1">5 Referrals</div>
                        <p className="text-xs text-gray-600">Complete choice filling</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setShowUsageModal(false)
                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                          if (trackReferralsButton) {
                            trackReferralsButton.click()
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Get Free with 5 Referrals
                      </Button>
                    </div>
                    
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                    </div>
                    
                    {/* Payment Option */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <IndianRupee className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">Premium Access</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-1">₹399</div>
                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                      </div>
                      <PaymentButton
                        amount={399}
                        planName="Assured"
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onClick={() => setShowUsageModal(false)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        userId={user?.id}
                        userEmail={user?.email}
                      >
                        <IndianRupee className="h-4 w-4 mr-2" />
                        Get Premium Access
                      </PaymentButton>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Track Referrals Section */}
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-purple-700">Track Your Referrals</h3>
                  </div>
                  <p className="text-sm text-gray-600">Monitor your referral progress and earnings</p>
                  <Button 
                    onClick={() => {
                      setShowUsageModal(false)
                      const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                      if (trackReferralsButton) {
                        trackReferralsButton.click()
                      }
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    size="sm"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View Referral Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm text-yellow-800 font-medium mb-1">Important Note:</p>
                  <p className="text-xs text-yellow-700">
                    Referrals will only be counted after your friends complete the choice filling feature. 
                    You can track your referral progress anytime using the button above.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button variant="outline" onClick={() => setShowUsageModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Plans Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-[#005596]">
              🎉 Upgrade Your Plan
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              Get more choices and unlock premium features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Plan Info */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="h-6 w-6 text-green-600" />
                    <h3 className="text-xl font-bold text-green-700">Your Current Plan</h3>
                  </div>
                  <div className="text-3xl font-bold text-green-600">upto {usageData?.maxChoices || 10} Choices</div>
                  <p className="text-gray-600">You've successfully used your free plan!</p>
                </div>
              </CardContent>
            </Card>

            {/* Plan Selection Cards */}
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Choose Your Plan</h3>
                <p className="text-sm text-gray-600">Select the plan that best fits your needs</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 75 Choices Plan */}
                <Card className="border-2 border-green-200 hover:border-green-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-green-600">upto 75</span>
                    </div>
                    <CardTitle className="text-xl text-green-700">upto 75 Choices Plan</CardTitle>
                    <p className="text-sm text-gray-600">Perfect for focused college selection</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Referral Option */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700">Free with Referrals</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mb-1">3 Referrals</div>
                        <p className="text-xs text-gray-600">Complete choice filling</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setShowPricingDialog(false)
                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                          if (trackReferralsButton) {
                            trackReferralsButton.click()
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Get Free with 3 Referrals
                      </Button>
                    </div>
                    
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                    </div>
                    
                    {/* Payment Option */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <IndianRupee className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">Premium Access</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-1">₹299</div>
                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                      </div>
                      <PaymentButton
                        amount={299}
                        planName="Secure"
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onClick={() => setShowPricingDialog(false)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        userId={user?.id}
                        userEmail={user?.email}
                      >
                        <IndianRupee className="h-4 w-4 mr-2" />
                        Get Premium Access
                      </PaymentButton>
                    </div>
                  </CardContent>
                </Card>

                {/* 200 Choices Plan */}
                <Card className="border-2 border-blue-200 hover:border-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-blue-600">upto 200</span>
                    </div>
                    <CardTitle className="text-xl text-blue-700">upto 200 Choices Plan</CardTitle>
                    <p className="text-sm text-gray-600">Comprehensive college exploration</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Referral Option */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700">Free with Referrals</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 mb-1">5 Referrals</div>
                        <p className="text-xs text-gray-600">Complete choice filling</p>
                      </div>
                      <Button 
                        onClick={() => {
                          setShowPricingDialog(false)
                          const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                          if (trackReferralsButton) {
                            trackReferralsButton.click()
                          }
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Get Free with 5 Referrals
                      </Button>
                    </div>
                    
                    <div className="text-center">
                      <span className="text-sm font-bold text-gray-700 bg-white px-3 py-1 rounded-full border">OR</span>
                    </div>
                    
                    {/* Payment Option */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-center mb-3">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <IndianRupee className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">Premium Access</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-1">₹399</div>
                        <p className="text-xs text-gray-600">Unlimited access for 30 days</p>
                      </div>
                      <PaymentButton
                        amount={399}
                        planName="Assured"
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onClick={() => setShowPricingDialog(false)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        userId={user?.id}
                        userEmail={user?.email}
                      >
                        <IndianRupee className="h-4 w-4 mr-2" />
                        Get Premium Access
                      </PaymentButton>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Track Referrals Section */}
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-purple-700">Track Your Referrals</h3>
                  </div>
                  <p className="text-sm text-gray-600">Monitor your referral progress and earnings</p>
                  <Button 
                    onClick={() => {
                      setShowPricingDialog(false)
                      const trackReferralsButton = document.querySelector('[data-track-referrals]') as HTMLButtonElement
                      if (trackReferralsButton) {
                        trackReferralsButton.click()
                      }
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    size="sm"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View Referral Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-sm text-yellow-800 font-medium mb-1">Important Note:</p>
                  <p className="text-xs text-yellow-700">
                    Referrals will only be counted after your friends complete the choice filling feature. 
                    You can track your referral progress anytime using the button above.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button variant="outline" onClick={() => setShowPricingDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  )
} 

