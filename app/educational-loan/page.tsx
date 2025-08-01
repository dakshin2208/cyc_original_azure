"use client"

import React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Upload, FileText, User, Users, CreditCard, ArrowRight, X } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/app/contexts/AuthContext"
import { useRouter } from "next/navigation"

interface FormData {
  studentName: string
  studentEmail: string
  studentContact: string
  admissionLetter: File | null
  feeStructure: File | null
  marksheet10th: File | null
  marksheet12th: File | null
  studentPhoto: File | null
  studentAddressProof: File | null
  parentName: string
  parentEmail: string
  parentContact: string
  parentAlternativeContact: string
  incomeProof: File | null
  bankStatementType: 'bankStatement' | 'salarySlips' | ''
  bankStatementFiles: File[]
  parentAddressProof: File | null
  utilityBill: File | null
  panCard: File | null
}

interface InitialFormData {
  studentName: string
  studentEmail: string
  studentContact: string
  parentName: string
  parentEmail: string
  parentContact: string
}

type ApplicationStep = 'initial' | 'confirmation' | 'documents' | 'completed'

export default function EducationalLoanPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<ApplicationStep>('initial')
  const [applicationNumber, setApplicationNumber] = useState<string>('')
  
  // Add refs to maintain focus
  const studentNameRef = useRef<HTMLInputElement>(null)
  const studentContactRef = useRef<HTMLInputElement>(null)
  const parentNameRef = useRef<HTMLInputElement>(null)
  const parentEmailRef = useRef<HTMLInputElement>(null)
  const parentContactRef = useRef<HTMLInputElement>(null)
  
  const [initialFormData, setInitialFormData] = useState<InitialFormData>({
    studentName: "",
    studentEmail: "",
    studentContact: "",
    parentName: "",
    parentEmail: "",
    parentContact: ""
  })

  const [formData, setFormData] = useState<FormData>({
    studentName: "",
    studentEmail: "",
    studentContact: "",
    admissionLetter: null,
    feeStructure: null,
    marksheet10th: null,
    marksheet12th: null,
    studentPhoto: null,
    studentAddressProof: null,
    parentName: "",
    parentEmail: "",
    parentContact: "",
    parentAlternativeContact: "",
    incomeProof: null,
    bankStatementType: '',
    bankStatementFiles: [],
    parentAddressProof: null,
    utilityBill: null,
    panCard: null
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [isLoadingExisting, setIsLoadingExisting] = useState(false)

  // Auto-fill student email when user is logged in
  useEffect(() => {
    if (user?.email) {
      console.log('Auto-filling student email:', user.email)
      setInitialFormData(prev => ({
        ...prev,
        studentEmail: user.email
      }))
      setFormData(prev => ({
        ...prev,
        studentEmail: user.email
      }))
    }
  }, [user?.email])

  // Clear data when user logs out
  useEffect(() => {
    if (!user) {
      console.log('User logged out, clearing educational loan data')
      // Clear all form data and localStorage when user logs out
      setInitialFormData({
        studentName: "",
        studentEmail: "",
        studentContact: "",
        parentName: "",
        parentEmail: "",
        parentContact: ""
      })
      setFormData({
        studentName: "",
        studentEmail: "",
        studentContact: "",
        admissionLetter: null,
        feeStructure: null,
        marksheet10th: null,
        marksheet12th: null,
        studentPhoto: null,
        studentAddressProof: null,
        parentName: "",
        parentEmail: "",
        parentContact: "",
        parentAlternativeContact: "",
        incomeProof: null,
        bankStatementType: '',
        bankStatementFiles: [],
        parentAddressProof: null,
        utilityBill: null,
        panCard: null
      })
      setApplicationNumber("")
      setCurrentStep('initial')
      localStorage.removeItem('educationalLoanInitial')
    }
  }, [user])

  // Check for existing application on page load
  useEffect(() => {
    const checkExistingApplication = async () => {
      // Only check if user is logged in
      if (!user?.email) {
        console.log('No user email, setting to initial step')
        setCurrentStep('initial')
        return
      }

      console.log('Checking existing application for user:', user.email)
      setIsLoadingExisting(true)
      
      try {
        // Check localStorage first (but only if it matches current user)
        const savedData = localStorage.getItem('educationalLoanInitial')
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData)
            console.log('Found localStorage data:', parsed)
            // Only use localStorage data if it matches current user's email
            if (parsed.data?.studentEmail === user.email && parsed.applicationNumber && parsed.data) {
              console.log('Using localStorage data for user')
              setApplicationNumber(parsed.applicationNumber)
              setInitialFormData(parsed.data)
              setCurrentStep('confirmation')
              setIsLoadingExisting(false)
              return
            } else {
              console.log('localStorage data does not match current user, clearing')
              // Clear localStorage if it doesn't match current user
              localStorage.removeItem('educationalLoanInitial')
            }
          } catch (error) {
            console.error('Error parsing saved data:', error)
            localStorage.removeItem('educationalLoanInitial')
          }
        }

        // Check with API using user's email
        try {
          console.log('Checking application status for email:', user.email)
          const response = await fetch('/api/check-educational-loan-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ studentEmail: user.email }),
          })

          const result = await response.json()
          console.log('API response:', result)

          if (response.ok && (result.hasInitialApplication || result.hasCompletedApplication)) {
            // Found existing application
            console.log('Found existing application:', result)
            setApplicationNumber(result.applicationNumber)
            
            if (result.hasInitialApplication && result.data) {
              setInitialFormData(result.data)
              
              // Save to localStorage for future use
              localStorage.setItem('educationalLoanInitial', JSON.stringify({
                applicationNumber: result.applicationNumber,
                data: result.data
              }))
              
              setCurrentStep('confirmation')
              toast.info("Found your incomplete application. You can continue from where you left off.")
            } else if (result.hasCompletedApplication) {
              setCurrentStep('completed')
              toast.success("Your application is already complete!")
            }
          } else {
            console.log('No existing application found')
            // No existing application found, start with initial form
            setCurrentStep('initial')
          }
        } catch (error) {
          console.error('Error checking application status:', error)
          // Fallback to initial form if API fails
          setCurrentStep('initial')
        }
      } catch (error) {
        console.error('Error in checkExistingApplication:', error)
        setCurrentStep('initial')
      } finally {
        setIsLoadingExisting(false)
      }
    }

    checkExistingApplication()
  }, [user?.email])

  const handleInitialInputChange = useCallback((field: keyof InitialFormData, value: string) => {
    setInitialFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Create stable input handlers that don't cause re-renders
  const handleStudentNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialFormData(prev => ({ ...prev, studentName: e.target.value }))
  }, [])

  const handleStudentContactChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialFormData(prev => ({ ...prev, studentContact: e.target.value }))
  }, [])

  const handleParentNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialFormData(prev => ({ ...prev, parentName: e.target.value }))
  }, [])

  const handleParentEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialFormData(prev => ({ ...prev, parentEmail: e.target.value }))
  }, [])

  const handleParentContactChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialFormData(prev => ({ ...prev, parentContact: e.target.value }))
  }, [])

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleBankStatementTypeChange = useCallback((type: 'bankStatement' | 'salarySlips') => {
    setFormData(prev => ({ 
      ...prev, 
      bankStatementType: type,
      bankStatementFiles: [] // Clear files when type changes
    }))
  }, [])

  const handleBankStatementFilesChange = useCallback((files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files)
      const maxSize = 10 * 1024 * 1024 // 10MB per file
      
      // Check file sizes and duplicates
      const validFiles = fileArray.filter(file => {
        if (file.size > maxSize) {
          toast.error(`File ${file.name} exceeds 10MB limit`)
          return false
        }
        return true
      })
      
      // Append new files to existing ones
      setFormData(prev => {
        const existingFiles = prev.bankStatementFiles
        const newFiles = validFiles.filter(newFile => 
          !existingFiles.some(existingFile => 
            existingFile.name === newFile.name && existingFile.size === newFile.size
          )
        )
        
        if (newFiles.length < validFiles.length) {
          toast.info("Some files were already uploaded and skipped")
        }
        
        return { 
          ...prev, 
          bankStatementFiles: [...existingFiles, ...newFiles]
        }
      })
    }
  }, [])

  const removeBankStatementFile = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      bankStatementFiles: prev.bankStatementFiles.filter((_, i) => i !== index)
    }))
  }, [])

  const handleFileChange = useCallback((field: keyof FormData, file: File | null) => {
    if (file) {
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error(`File size exceeds 10MB limit for ${field}`)
        return
      }
    }
    setFormData(prev => ({ ...prev, [field]: file }))
  }, [])

  const validateInitialForm = (): boolean => {
    const requiredFields = ['studentName', 'studentEmail', 'studentContact', 'parentName', 'parentEmail', 'parentContact']

    for (const field of requiredFields) {
      if (!initialFormData[field as keyof InitialFormData]) {
        toast.error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
        return false
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(initialFormData.studentEmail)) {
      toast.error("Please enter a valid student email address")
      return false
    }
    if (!emailRegex.test(initialFormData.parentEmail)) {
      toast.error("Please enter a valid parent email address")
      return false
    }

    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(initialFormData.studentContact)) {
      toast.error("Please enter a valid 10-digit student contact number")
      return false
    }
    if (!phoneRegex.test(initialFormData.parentContact)) {
      toast.error("Please enter a valid 10-digit parent contact number")
      return false
    }

    return true
  }

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateInitialForm()) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/submit-educational-loan-initial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initialFormData),
      })

      const result = await response.json()

      if (response.ok) {
        setApplicationNumber(result.applicationNumber)
        
        // Save to localStorage
        localStorage.setItem('educationalLoanInitial', JSON.stringify({
          applicationNumber: result.applicationNumber,
          data: result.data
        }))
        
        setCurrentStep('confirmation')
        toast.success("Initial application submitted successfully!")
      } else {
        toast.error(result.error || "Failed to submit initial application")
      }
    } catch (error) {
      console.error("Error submitting initial application:", error)
      toast.error("An error occurred while submitting the application")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteApplication = () => {
    // Pre-fill the main form with initial data
    setFormData(prev => ({
      ...prev,
      studentName: initialFormData.studentName,
      studentEmail: initialFormData.studentEmail,
      studentContact: initialFormData.studentContact,
      parentName: initialFormData.parentName,
      parentEmail: initialFormData.parentEmail,
      parentContact: initialFormData.parentContact
    }))
    setCurrentStep('documents')
  }

  const validateForm = (): boolean => {
    console.log('Starting form validation...')
    console.log('Form data:', formData)
    
    const requiredFields = ['studentName', 'studentEmail', 'studentContact', 'parentName', 'parentEmail', 'parentContact']
    const requiredFiles = ['admissionLetter', 'feeStructure', 'marksheet10th', 'marksheet12th', 'studentPhoto', 'studentAddressProof', 'incomeProof', 'parentAddressProof', 'utilityBill', 'panCard']

    // Validate required text fields
    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        console.log(`Validation failed: Missing field ${field}`)
        toast.error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
        return false
      }
    }

    // Validate bank statement type and files
    if (!formData.bankStatementType) {
      console.log('Validation failed: Missing bank statement type')
      toast.error("Please select document type (Bank Statement or Salary Slips)")
      return false
    }

    if (formData.bankStatementFiles.length === 0) {
      console.log('Validation failed: No bank statement files uploaded')
      toast.error(`Please upload ${formData.bankStatementType === 'bankStatement' ? 'bank statements' : 'salary slips'}`)
      return false
    }

    // Validate required files
    for (const fileField of requiredFiles) {
      if (!formData[fileField as keyof FormData]) {
        console.log(`Validation failed: Missing file ${fileField}`)
        toast.error(`Please upload ${fileField.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
        return false
      }
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.studentEmail)) {
      console.log('Validation failed: Invalid student email format')
      toast.error("Please enter a valid student email address")
      return false
    }
    if (!emailRegex.test(formData.parentEmail)) {
      console.log('Validation failed: Invalid parent email format')
      toast.error("Please enter a valid parent email address")
      return false
    }

    // Validate phone formats
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(formData.studentContact)) {
      console.log('Validation failed: Invalid student contact format')
      toast.error("Please enter a valid 10-digit student contact number")
      return false
    }
    if (!phoneRegex.test(formData.parentContact)) {
      console.log('Validation failed: Invalid parent contact format')
      toast.error("Please enter a valid 10-digit parent contact number")
      return false
    }

    console.log('Form validation passed successfully!')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitStatus("idle")
    setStatusMessage("")

    try {
      const formDataToSend = new FormData()
      
      // Add all regular form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'bankStatementType' || key === 'bankStatementFiles') {
          // Skip these, handle separately
          return
        }
        if (value instanceof File) {
          formDataToSend.append(key, value)
        } else if (typeof value === 'string') {
          formDataToSend.append(key, value)
        }
      })

      // Add bank statement type
      formDataToSend.append('bankStatementType', formData.bankStatementType)
      
      // Add bank statement files
      formData.bankStatementFiles.forEach((file, index) => {
        formDataToSend.append(`bankStatementFile_${index}`, file)
      })
      formDataToSend.append('bankStatementFileCount', formData.bankStatementFiles.length.toString())

      const response = await fetch('/api/submit-educational-loan', {
        method: 'POST',
        body: formDataToSend,
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitStatus("success")
        setStatusMessage("Educational loan application submitted successfully!")
        toast.success("Application submitted successfully!")
        
        // Set current step to complete so form doesn't show again
        setCurrentStep('completed')
        
        // Clear localStorage after successful completion
        localStorage.removeItem('educationalLoanInitial')
        
        setFormData({
          studentName: "", studentEmail: "", studentContact: "",
          admissionLetter: null, feeStructure: null, marksheet10th: null,
          marksheet12th: null, studentPhoto: null, studentAddressProof: null,
          parentName: "", parentEmail: "", parentContact: "",
          parentAlternativeContact: "", incomeProof: null, bankStatementType: '',
          bankStatementFiles: [], parentAddressProof: null, utilityBill: null,
          panCard: null
        })
      } else {
        setSubmitStatus("error")
        setStatusMessage(result.error || "Failed to submit application")
        toast.error(result.error || "Failed to submit application")
      }
    } catch (error) {
      console.error("Error submitting application:", error)
      setSubmitStatus("error")
      setStatusMessage("An error occurred while submitting the application")
      toast.error("An error occurred while submitting the application")
    } finally {
      setIsSubmitting(false)
    }
  }

  const FileUploadField = ({ field, label, description, accept = "*/*" }: { 
    field: keyof FormData
    label: string
    description?: string
    accept?: string 
  }) => (
    <div className="space-y-3">
      <div>
        <Label htmlFor={field} className="text-sm font-semibold text-gray-700">{label}</Label>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <div className="relative">
        <Input
          id={field}
          type="file"
          accept={accept}
          onChange={(e) => handleFileChange(field, e.target.files?.[0] || null)}
          className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0B5588] file:text-white hover:file:bg-[#0B5588]/90"
        />
        {formData[field] && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Uploaded</span>
          </div>
        )}
      </div>
    </div>
  )

  const BankStatementUploadField = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold text-gray-700">Bank Statement/Salary Slips *</Label>
        <p className="text-sm text-gray-500 mt-1">Bank statements (6 months) or salary slips (3 months)</p>
      </div>
      
      {/* Document Type Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-700">Select Document Type:</Label>
        <div className="flex space-x-6">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="bankStatement"
              name="bankStatementType"
              value="bankStatement"
              checked={formData.bankStatementType === 'bankStatement'}
              onChange={() => handleBankStatementTypeChange('bankStatement')}
              className="w-4 h-4 text-[#0B5588] border-gray-300 focus:ring-[#0B5588]"
            />
            <Label htmlFor="bankStatement" className="text-sm text-gray-700">
              Bank Statement (6 months)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="salarySlips"
              name="bankStatementType"
              value="salarySlips"
              checked={formData.bankStatementType === 'salarySlips'}
              onChange={() => handleBankStatementTypeChange('salarySlips')}
              className="w-4 h-4 text-[#0B5588] border-gray-300 focus:ring-[#0B5588]"
            />
            <Label htmlFor="salarySlips" className="text-sm text-gray-700">
              Salary Slips (3 months)
            </Label>
          </div>
        </div>
      </div>

      {/* File Upload */}
      {formData.bankStatementType && (
        <div className="space-y-3">
          <div className="relative">
            <Input
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={(e) => handleBankStatementFilesChange(e.target.files)}
              className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0B5588] file:text-white hover:file:bg-[#0B5588]/90"
              placeholder={`Upload ${formData.bankStatementType === 'bankStatement' ? 'bank statements' : 'salary slips'} (multiple files allowed)`}
            />
          </div>
          
          {/* Uploaded Files List */}
          {formData.bankStatementFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Uploaded Files:</Label>
              <div className="space-y-2">
                {formData.bankStatementFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBankStatementFile(index)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full w-fit">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">
                  {formData.bankStatementFiles.length} file{formData.bankStatementFiles.length !== 1 ? 's' : ''} uploaded
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Initial Form Component
  const InitialForm = () => {
    // Use refs for uncontrolled inputs to prevent focus loss
    const studentNameRef = useRef<HTMLInputElement>(null)
    const studentEmailRef = useRef<HTMLInputElement>(null)
    const studentContactRef = useRef<HTMLInputElement>(null)
    const parentNameRef = useRef<HTMLInputElement>(null)
    const parentEmailRef = useRef<HTMLInputElement>(null)
    const parentContactRef = useRef<HTMLInputElement>(null)

    // Handle form submission by reading values from refs
    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      
      // Read values from refs
      const formData = {
        studentName: studentNameRef.current?.value || '',
        studentEmail: studentEmailRef.current?.value || '',
        studentContact: studentContactRef.current?.value || '',
        parentName: parentNameRef.current?.value || '',
        parentEmail: parentEmailRef.current?.value || '',
        parentContact: parentContactRef.current?.value || ''
      }

      // Update state with form data
      setInitialFormData(formData)
      
      // Call the original submit handler
      handleInitialSubmit(e)
    }

    // Set initial values when component mounts or when initialFormData changes
    useEffect(() => {
      if (studentNameRef.current) studentNameRef.current.value = initialFormData.studentName
      if (studentEmailRef.current) studentEmailRef.current.value = initialFormData.studentEmail
      if (studentContactRef.current) studentContactRef.current.value = initialFormData.studentContact
      if (parentNameRef.current) parentNameRef.current.value = initialFormData.parentName
      if (parentEmailRef.current) parentEmailRef.current.value = initialFormData.parentEmail
      if (parentContactRef.current) parentContactRef.current.value = initialFormData.parentContact
    }, [initialFormData])

    return (
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Student Details */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-[#0B5588] to-blue-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-3 text-xl font-semibold">
                <div className="p-2 bg-white/20 rounded-lg">
                  <User className="h-6 w-6" />
                </div>
                <span>Student Information</span>
              </CardTitle>
              <CardDescription className="text-blue-100">
                Please provide your basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentName" className="text-sm font-semibold text-gray-700">
                    Full Name *
                  </Label>
                  <Input
                    ref={studentNameRef}
                    id="studentName"
                    defaultValue={initialFormData.studentName}
                    placeholder="Enter your full name"
                    className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentEmail" className="text-sm font-semibold text-gray-700">
                    Email Address * (Auto-filled from your login)
                  </Label>
                  <Input
                    ref={studentEmailRef}
                    id="studentEmail"
                    type="email"
                    defaultValue={initialFormData.studentEmail}
                    placeholder="student@example.com"
                    className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588] bg-gray-50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentContact" className="text-sm font-semibold text-gray-700">
                    Contact Number *
                  </Label>
                  <Input
                    ref={studentContactRef}
                    id="studentContact"
                    defaultValue={initialFormData.studentContact}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parent Details */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-[#0B5588] to-blue-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-3 text-xl font-semibold">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <span>Parent Information</span>
              </CardTitle>
              <CardDescription className="text-blue-100">
                Please provide parent basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parentName" className="text-sm font-semibold text-gray-700">
                    Full Name *
                  </Label>
                  <Input
                    ref={parentNameRef}
                    id="parentName"
                    defaultValue={initialFormData.parentName}
                    placeholder="Enter parent's full name"
                    className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentEmail" className="text-sm font-semibold text-gray-700">
                    Email Address *
                  </Label>
                  <Input
                    ref={parentEmailRef}
                    id="parentEmail"
                    type="email"
                    defaultValue={initialFormData.parentEmail}
                    placeholder="parent@example.com"
                    className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentContact" className="text-sm font-semibold text-gray-700">
                    Contact Number *
                  </Label>
                  <Input
                    ref={parentContactRef}
                    id="parentContact"
                    defaultValue={initialFormData.parentContact}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center">
                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="h-14 px-12 text-lg font-semibold bg-gradient-to-r from-[#0B5588] to-blue-700 hover:from-[#0B5588]/90 hover:to-blue-700/90 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <FileText className="h-6 w-6" />
                      <span>Submit Initial Application</span>
                    </div>
                  )}
                </Button>
                <p className="text-sm text-gray-500 mt-3">
                  This will create your application number. You can complete the full application later.
                </p>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    )
  }

  // Confirmation Component
  const ConfirmationStep = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Submitted Successfully!</h2>
              <p className="text-gray-600 mb-4">Your initial application has been submitted. Here are your details:</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Application Number</p>
                <p className="text-2xl font-bold text-[#0B5588]">{applicationNumber}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Student Details</h3>
                  <p className="text-sm text-gray-600">Name: {initialFormData.studentName}</p>
                  <p className="text-sm text-gray-600">Email: {initialFormData.studentEmail}</p>
                  <p className="text-sm text-gray-600">Phone: {initialFormData.studentContact}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Parent Details</h3>
                  <p className="text-sm text-gray-600">Name: {initialFormData.parentName}</p>
                  <p className="text-sm text-gray-600">Email: {initialFormData.parentEmail}</p>
                  <p className="text-sm text-gray-600">Phone: {initialFormData.parentContact}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={handleCompleteApplication}
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-[#0B5588] to-blue-700 hover:from-[#0B5588]/90 hover:to-blue-700/90 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center space-x-3">
                  <ArrowRight className="h-6 w-6" />
                  <span>Complete Application with Documents</span>
                </div>
              </Button>
              <p className="text-sm text-gray-500">
                You can complete the full application with all required documents now or later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Completion Component
  const CompletionStep = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Application Completed Successfully!</h2>
              <p className="text-lg text-gray-600 mb-6">Your educational loan application has been submitted and is under review.</p>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 space-y-4 border border-green-200">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Application Status</p>
                <p className="text-xl font-bold text-green-600">SUBMITTED</p>
              </div>
              
              <div className="space-y-3 text-left">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">All required documents uploaded</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">Application submitted to our team</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">You will receive updates via email</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={() => router.push('/choice-filling')}
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-[#0B5588] to-blue-700 hover:from-[#0B5588]/90 hover:to-blue-700/90 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center space-x-3">
                  <ArrowRight className="h-6 w-6" />
                  <span>Continue to Choice Filling</span>
                </div>
              </Button>
              <p className="text-sm text-gray-500">
                Thank you for choosing our educational loan service. We'll contact you soon!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Incomplete Application Component
  const IncompleteApplicationStep = () => (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mx-auto">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Incomplete Application Found</h2>
              <p className="text-gray-600 mb-4">You have an incomplete educational loan application. Please complete it with all required documents.</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Application Number</p>
                <p className="text-2xl font-bold text-[#0B5588]">{applicationNumber}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Student Details</h3>
                  <p className="text-sm text-gray-600">Name: {initialFormData.studentName}</p>
                  <p className="text-sm text-gray-600">Email: {initialFormData.studentEmail}</p>
                  <p className="text-sm text-gray-600">Phone: {initialFormData.studentContact}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-2">Parent Details</h3>
                  <p className="text-sm text-gray-600">Name: {initialFormData.parentName}</p>
                  <p className="text-sm text-gray-600">Email: {initialFormData.parentEmail}</p>
                  <p className="text-sm text-gray-600">Phone: {initialFormData.parentContact}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={handleCompleteApplication}
                className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-[#0B5588] to-blue-700 hover:from-[#0B5588]/90 hover:to-blue-700/90 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center space-x-3">
                  <ArrowRight className="h-6 w-6" />
                  <span>Complete Application with Documents</span>
                </div>
              </Button>
              <p className="text-sm text-gray-500">
                Complete your application by uploading all required documents.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Show loading state while checking for existing applications
  if (isLoadingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Header />
        <main className="container mx-auto px-4 py-8 sm:py-12 lg:py-16">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
                Educational Loan Application
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
                Checking for existing applications...
              </p>
            </div>
            
            <div className="flex justify-center items-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B5588]"></div>
                <p className="text-gray-600">Loading your application data...</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Authentication check - redirect to login if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <Header />
        <main className="container mx-auto px-4 py-8 sm:py-12 lg:py-16">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Login Required
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                You need to be logged in to access the educational loan application. 
                Please login to continue with your application.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-[#0B5588] to-blue-700 hover:from-[#0B5588]/90 hover:to-blue-700/90 text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => router.push('/login')}
              >
                <User className="mr-3 h-6 w-6" />
                Login to Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-[#0B5588] text-[#0B5588] hover:bg-[#0B5588] hover:text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => router.push('/choice-filling')}
              >
                <ArrowRight className="mr-3 h-6 w-6" />
                Go to Choice Filling
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#0B5588] rounded-full mb-4 sm:mb-6">
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0B5588] mb-3 sm:mb-4 tracking-tight px-4">
              Educational Loan Application
            </h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed px-4">
              {currentStep === 'initial' && "Start your educational loan application by providing basic information. You can complete the full application with documents later."}
              {currentStep === 'confirmation' && "Your initial application has been submitted. Complete the full application with all required documents."}
              {currentStep === 'documents' && "Complete your educational loan application by providing all required details and uploading necessary documents."}
              {currentStep === 'completed' && "Your educational loan application has been successfully submitted and is under review."}
            </p>
          </div>

          {/* Render appropriate step */}
          {currentStep === 'initial' && <InitialForm />}
          {currentStep === 'confirmation' && <ConfirmationStep />}
          {currentStep === 'documents' && (
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {/* Student Details Section */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-[#0B5588] to-blue-700 text-white rounded-t-lg">
                <CardTitle className="flex items-center space-x-2 sm:space-x-3 text-lg sm:text-xl font-semibold">
                  <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg">
                    <User className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <span>Student Information</span>
                </CardTitle>
                <CardDescription className="text-blue-100 text-sm sm:text-base">
                  Please provide all the required student information and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                {/* Personal Information */}
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="studentName" className="text-sm font-semibold text-gray-700">
                        Full Name *
                      </Label>
                      <Input
                        id="studentName"
                        value={formData.studentName}
                        onChange={(e) => handleInputChange('studentName', e.target.value)}
                        placeholder="Enter student's full name"
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="studentEmail" className="text-sm font-semibold text-gray-700">
                        Email Address * (Auto-filled from your login)
                      </Label>
                      <Input
                        id="studentEmail"
                        type="email"
                        value={formData.studentEmail}
                        onChange={(e) => handleInputChange('studentEmail', e.target.value)}
                        placeholder="student@example.com"
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588] bg-gray-50"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="studentContact" className="text-sm font-semibold text-gray-700">
                        Contact Number *
                      </Label>
                      <Input
                        id="studentContact"
                        value={formData.studentContact}
                        onChange={(e) => handleInputChange('studentContact', e.target.value)}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    Required Documents
                  </h3>
                  <div className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FileUploadField
                        field="admissionLetter"
                        label="Admission Letter *"
                        description="Admission letter or offer letter from your college/university"
                        accept=".pdf,.doc,.docx"
                      />
                      <FileUploadField
                        field="feeStructure"
                        label="Fee Structure *"
                        description="Complete fee structure document from your institution"
                        accept=".pdf,.doc,.docx"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FileUploadField
                        field="marksheet10th"
                        label="10th Marksheet *"
                        description="Your 10th standard marksheet"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <FileUploadField
                        field="marksheet12th"
                        label="12th Marksheet *"
                        description="Your 12th standard marksheet"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <FileUploadField
                        field="studentPhoto"
                        label="Passport Size Photo *"
                        description="Recent passport size photograph in JPEG format"
                        accept=".jpg,.jpeg,.png"
                      />
                      <FileUploadField
                        field="studentAddressProof"
                        label="Address Proof *"
                        description="Aadhaar card or school ID card as address proof"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parent Details Section */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-[#0B5588] to-blue-700 text-white rounded-t-lg">
                <CardTitle className="flex items-center space-x-2 sm:space-x-3 text-lg sm:text-xl font-semibold">
                  <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <span>Parent Information</span>
                </CardTitle>
                <CardDescription className="text-blue-100 text-sm sm:text-base">
                  Please provide all the required parent information and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                {/* Personal Information */}
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    Personal Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="parentName" className="text-sm font-semibold text-gray-700">
                        Full Name *
                      </Label>
                      <Input
                        id="parentName"
                        value={formData.parentName}
                        onChange={(e) => handleInputChange('parentName', e.target.value)}
                        placeholder="Enter parent's full name"
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="parentEmail" className="text-sm font-semibold text-gray-700">
                        Email Address *
                      </Label>
                      <Input
                        id="parentEmail"
                        type="email"
                        value={formData.parentEmail}
                        onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                        placeholder="parent@example.com"
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="parentContact" className="text-sm font-semibold text-gray-700">
                        Contact Number *
                      </Label>
                      <Input
                        id="parentContact"
                        value={formData.parentContact}
                        onChange={(e) => handleInputChange('parentContact', e.target.value)}
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="parentAlternativeContact" className="text-sm font-semibold text-gray-700">
                        Alternative Contact Number
                      </Label>
                      <Input
                        id="parentAlternativeContact"
                        value={formData.parentAlternativeContact}
                        onChange={(e) => handleInputChange('parentAlternativeContact', e.target.value)}
                        placeholder="Alternative contact number (optional)"
                        maxLength={10}
                        className="h-10 sm:h-12 text-base border-gray-300 focus:border-[#0B5588] focus:ring-[#0B5588]"
                      />
                    </div>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    Financial & Address Documents
                  </h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FileUploadField
                        field="incomeProof"
                        label="Income Proof *"
                        description="ITR or Form 16 for the last 2 years"
                        accept=".pdf,.doc,.docx"
                      />
                      <BankStatementUploadField />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FileUploadField
                        field="parentAddressProof"
                        label="Aadhaar Card *"
                        description="Parent's Aadhaar card"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <FileUploadField
                        field="utilityBill"
                        label="Utility Bill *"
                        description="Recent electricity/water/telephone bill"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <FileUploadField
                        field="panCard"
                        label="PAN Card *"
                        description="Parent's PAN card"
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Section */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="flex flex-col space-y-6">
                  {submitStatus === "success" && (
                    <div className="flex items-center space-x-3 text-green-700 bg-green-50 p-6 rounded-xl border border-green-200">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <h4 className="font-semibold text-green-800">Application Submitted Successfully!</h4>
                        <p className="text-green-700">{statusMessage}</p>
                      </div>
                    </div>
                  )}
                  {submitStatus === "error" && (
                    <div className="flex items-center space-x-3 text-red-700 bg-red-50 p-6 rounded-xl border border-red-200">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                      <div>
                        <h4 className="font-semibold text-red-800">Submission Error</h4>
                        <p className="text-red-700">{statusMessage}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="h-14 px-12 text-lg font-semibold bg-gradient-to-r from-[#0B5588] to-blue-700 hover:from-[#0B5588]/90 hover:to-blue-700/90 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center space-x-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          <span>Processing Application...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <FileText className="h-6 w-6" />
                          <span>Submit Application</span>
                        </div>
                      )}
                    </Button>
                    <p className="text-sm text-gray-500 mt-3">
                      By submitting this application, you agree to our terms and conditions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
          )}
          {currentStep === 'completed' && <CompletionStep />}
        </div>
      </main>
      
      <Footer />
    </div>
  )
} 