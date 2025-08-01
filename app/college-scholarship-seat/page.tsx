"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function CollegeScholarshipSeatPage() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const districts = [
    "All Districts",
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
    "Dharmapur", "Dindigul", "Erode", "Kallakurich", "Kancheepuram", "Kanyakumari",
    "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal",
    "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipe", "Salem", "Sivaganga",
    "Tenkasi", "Thanjavur", "TheNilgiris", "Theni", "Thirupattur", "Thoothukudi",
    "Tiruchirappalli", "Tirunelveli", "Tiruppur", "Thiruvallur", "Thiruvannamala",
    "Thiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
  ]

  // Form state
  const [formData, setFormData] = useState({
    studentName: "",
    studentAadhaar: "",
    registrationNumber: "",
    dateOfBirth: "",
    studentPhone: "",
    studentEmail: "",
    fatherName: "",
    fatherIncome: "",
    fatherPhone: "",
    motherName: "",
    motherIncome: "",
    motherPhone: "",
    mathsMarks: "",
    physicsMarks: "",
    chemistryMarks: "",
    totalMarks: "",
    cityPreferences: [] as string[],
    isFirstGraduate: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Add validation for Aadhar and Phone
    if (name === 'studentAadhaar') {
      // Only allow numbers and limit to exactly 12 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 12)
      if (numericValue.length <= 12) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }))
      }
    } else if (name === 'studentPhone'|| name === 'motherPhone' || name === 'fatherPhone') {
      // Only allow numbers and limit to exactly 10 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 10)
      if (numericValue.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }))
      }
    } else if (name === 'registrationNumber') {
      // Only allow numbers and limit to exactly 7 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 7)
      if (numericValue.length <= 7) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }))
      }
    } else if (name === 'mathsMarks' || name === 'physicsMarks' || name === 'chemistryMarks') {
      // Allow direct text input but enforce 70-200 range
      const numericValue = value.replace(/\D/g, '')
      
      // Always update the display value
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: numericValue
        }
        
        // Calculate cutoff if all marks are present
        const maths = parseFloat(newData.mathsMarks) || 0
        const physics = parseFloat(newData.physicsMarks) || 0
        const chemistry = parseFloat(newData.chemistryMarks) || 0
        
        // Only calculate if all values are within range
        if (maths >= 35 && maths <= 100 && 
            physics >= 35 && physics <= 100 && 
            chemistry >= 35 && chemistry <= 100) {
          const cutoff = (maths) + (physics * 0.5) + (chemistry * 0.5)
          newData.totalMarks = cutoff.toFixed(2)
        } else {
          newData.totalMarks = ''
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

  const handleSelectChange = (value: string) => {
    setFormData(prev => {
      const currentCities = prev.cityPreferences
      const newCity = value
      
      // Handle "All Districts" selection
      if (newCity === "All Districts") {
        // If "All Districts" is already selected, clear all selections
        if (currentCities.includes("All Districts")) {
          return {
            ...prev,
            cityPreferences: []
          }
        }
        // Otherwise, select all districts
        return {
          ...prev,
          cityPreferences: ["All Districts"]
        }
      }
      
      // If "All Districts" is currently selected, remove it when selecting a specific district
      if (currentCities.includes("All Districts")) {
        return {
          ...prev,
          cityPreferences: [newCity]
        }
      }
      
      // Normal selection/deselection logic
      const updatedCities = currentCities.includes(newCity)
        ? currentCities.filter(city => city !== newCity)
        : [...currentCities, newCity]
      
      return {
        ...prev,
        cityPreferences: updatedCities
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Create a copy of formData with only non-empty values
    const submitData = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0
        return value !== "" && value !== null && value !== undefined
      })
    )

    try {
      const response = await fetch('/api/submit-scholarship-seat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit application')
      }

      // Track successful form submission
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'form_submission', {
          'event_category': 'Scholarship Seat',
          'event_label': 'Application Submitted'
        })
      }

      setSuccess(true)
      toast({
        title: "Application Submitted Successfully!",
        description: "Your scholarship seat application has been submitted. We will contact you soon with further details.",
        duration: 5000,
      })

      // Reset form
      setFormData({
        studentName: "",
        studentAadhaar: "",
        registrationNumber: "",
        dateOfBirth: "",
        studentPhone: "",
        studentEmail: "",
        fatherName: "",
        fatherIncome: "",
        fatherPhone: "",
        motherName: "",
        motherIncome: "",
        motherPhone: "",
        mathsMarks: "",
        physicsMarks: "",
        chemistryMarks: "",
        totalMarks: "",
        cityPreferences: [],
        isFirstGraduate: ""
      })

      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit application. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
      
      // Track form submission error
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'form_error', {
          'event_category': 'Scholarship Seat',
          'event_label': err instanceof Error ? err.message : 'Unknown error'
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold mb-2 text-[#0B5588]">Scholarships & Free Seat Application</h1>
            <p className="text-muted-foreground mb-6">
              Fill in your details to apply for free/scholarship seat
            </p>
          </div>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Application Submitted Successfully!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your scholarship seat application has been submitted. We will contact you soon with further details.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Student Information</CardTitle>
                <CardDescription>Please provide accurate information about the student</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label>Are you a first graduate in your family?</Label>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="firstGraduateYes"
                          name="isFirstGraduate"
                          value="Yes"
                          checked={formData.isFirstGraduate === "Yes"}
                          onChange={handleInputChange}
                          required
                          className="h-4 w-4 text-primary"
                        />
                        <Label htmlFor="firstGraduateYes" className="cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="firstGraduateNo"
                          name="isFirstGraduate"
                          value="No"
                          checked={formData.isFirstGraduate === "No"}
                          onChange={handleInputChange}
                          required
                          className="h-4 w-4 text-primary"
                        />
                        <Label htmlFor="firstGraduateNo" className="cursor-pointer">No</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="studentName">Student Name</Label>
                    <Input
                      id="studentName"
                      name="studentName"
                      value={formData.studentName}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="studentAadhaar">Student Aadhaar Number</Label>
                    <Input
                      id="studentAadhaar"
                      name="studentAadhaar"
                      value={formData.studentAadhaar}
                      onChange={handleInputChange}
                      placeholder="Enter 12 digit Aadhaar number"
                      maxLength={12}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">12th Registration Number</Label>
                    <Input
                      id="registrationNumber"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleInputChange}
                      placeholder="Enter 7 digit registration number"
                      maxLength={7}
                      required
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
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="studentPhone">Student Phone Number</Label>
                    <Input
                      id="studentPhone"
                      name="studentPhone"
                      value={formData.studentPhone}
                      onChange={handleInputChange}
                      placeholder="Enter 10 digit phone number"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="studentEmail">Student Email</Label>
                    <Input
                      id="studentEmail"
                      name="studentEmail"
                      type="email"
                      value={formData.studentEmail}
                      onChange={handleInputChange}
                      placeholder="example@email.com"
                      required
                    />
                  </div>
                </div>
                <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>

                <CardTitle className="mt-8">Father's Information</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fatherName">Father's Name</Label>
                    <Input
                      id="fatherName"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleInputChange}
                      placeholder="Enter father's full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fatherIncome">Father's Annual Income</Label>
                    <Input
                      id="fatherIncome"
                      name="fatherIncome"
                      type="number"
                      value={formData.fatherIncome}
                      onChange={handleInputChange}
                      placeholder="Enter annual income in rupees"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fatherPhone">Father's Phone Number</Label>
                    <Input
                      id="fatherPhone"
                      name="fatherPhone"
                      value={formData.fatherPhone}
                      onChange={handleInputChange}
                      placeholder="Enter 10 digit phone number"
                      maxLength={10}
                    />
                  </div>
                </div>
                <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>

                <CardTitle className="mt-8">Mother's Information</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="motherName">Mother's Name</Label>
                    <Input
                      id="motherName"
                      name="motherName"
                      value={formData.motherName}
                      onChange={handleInputChange}
                      placeholder="Enter mother's full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motherIncome">Mother's Annual Income</Label>
                    <Input
                      id="motherIncome"
                      name="motherIncome"
                      type="number"
                      value={formData.motherIncome}
                      onChange={handleInputChange}
                      placeholder="Enter annual income in rupees"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motherPhone">Mother's Phone Number</Label>
                    <Input
                      id="motherPhone"
                      name="motherPhone"
                      value={formData.motherPhone}
                      onChange={handleInputChange}
                      placeholder="Enter 10 digit phone number"
                      maxLength={10}
                    />
                  </div>
                </div>
                <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>
                <CardTitle className="mt-8">Academic Information</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="mathsMarks">Mathematics Marks</Label>
                    <Input
                      id="mathsMarks"
                      name="mathsMarks"
                      value={formData.mathsMarks}
                      onChange={handleInputChange}
                      placeholder="Enter marks (35-100)"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physicsMarks">Physics Marks</Label>
                    <Input
                      id="physicsMarks"
                      name="physicsMarks"
                      value={formData.physicsMarks}
                      onChange={handleInputChange}
                      placeholder="Enter marks (35-100)"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chemistryMarks">Chemistry Marks</Label>
                    <Input
                      id="chemistryMarks"
                      name="chemistryMarks"
                      value={formData.chemistryMarks}
                      onChange={handleInputChange}
                      placeholder="Enter marks (35-100)"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalMarks">Cutoff</Label>
                    <Input
                      id="totalMarks"
                      name="totalMarks"
                      value={formData.totalMarks}
                      readOnly
                      placeholder="Cutoff will be calculated automatically"
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              
                  <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>

                  
                  <CardTitle className="mt-8">City Preferences</CardTitle>
                  <div>
                    <Select
                      value=""
                      onValueChange={handleSelectChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select preferred cities" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem 
                            key={district} 
                            value={district}
                            className={formData.cityPreferences.includes(district) ? "bg-gray-100" : ""}
                          >
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.cityPreferences.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm text-muted-foreground mb-2">Selected cities:</div>
                        <div className="flex flex-wrap gap-2">
                          {formData.cityPreferences.map((city) => (
                            <div 
                              key={city}
                              className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
                            >
                              {city}
                              <button
                                type="button"
                                onClick={() => handleSelectChange(city)}
                                className="hover:text-destructive"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
} 