'use client'

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchColleges } from "@/lib/college-service"
import { useToast } from "@/components/ui/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search } from "lucide-react"

export default function CollegeManagementSeatClient() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [colleges, setColleges] = useState<{ id: string; code: string; name: string }[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [collegeSearch, setCollegeSearch] = useState<{ [key: number]: string }>({})
  const [openCollegeSearch, setOpenCollegeSearch] = useState<{ [key: number]: boolean }>({})

  // Form state
  const [formData, setFormData] = useState({
    studentName: "",
    aadhaarNumber: "",
    registrationNumber: "",
    dateOfBirth: "",
    studentPhone: "",
    studentEmail: "",
    fatherName: "",
    fatherOccupation: "",
    fatherIncome: "",
    fatherPhone: "",
    fatherEmail: "",
    mathsMarks: "",
    physicsMarks: "",
    chemistryMarks: "",
    totalMarks: "",
    collegePreference1: "",
    collegePreference2: "",
    collegePreference3: "",
    collegeName1: "",
    collegeName2: "",
    collegeName3: "",
    branchPreference1: "",
    branchPreference2: "",
    branchPreference3: ""
  })

  // Load colleges and branches on component mount
  useEffect(() => {
    async function loadData() {
      const { colleges } = await fetchColleges()
      // Filter out duplicates based on college code and create unique identifiers
      const uniqueColleges = Array.from(
        new Map(colleges.map(college => [college.CollegeCode, college])).values()
      ).map((college, index) => ({
        id: `${college.CollegeCode}-${index}`,
        code: college.CollegeCode,
        name: college.collegeName
      }))

      // Sort colleges by code in ascending order
      uniqueColleges.sort((a, b) => {
        // Convert codes to strings and compare
        const codeA = String(a.code).toLowerCase()
        const codeB = String(b.code).toLowerCase()
        return codeA.localeCompare(codeB)
      })

      setColleges(uniqueColleges)
      
      // Set branches list
      setBranches([
        "Artificial Intelligence and Data Science",
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
        "Medical Electronics Engg.",
        "Mechanical Engineering",
        "Mechanical (Manufacturing)",
        "Mechanical Engg. (SS)",
        "Mechatronics (SS)",
        "Mechanical Engineering (Sandwich)",
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
        "Computer science and Technology",
        "Textile Technology (SS)",
        "Textile Technology"
      ].sort((a, b) => a.localeCompare(b)))
    }
    loadData()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Add validation for Aadhar and Phone
    if (name === 'aadhaarNumber') {
      // Only allow numbers and limit to exactly 12 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 12)
      if (numericValue.length <= 12) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }))
      }
    } else if (name === 'studentPhone' || name === 'fatherPhone') {
      // Only allow numbers and limit to exactly 10 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 10)
      if (numericValue.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: numericValue
        }))
      }
    } else if (name === 'registrationNumber') {
      // Only allow numbers and limit to exactly 6 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 6)
      if (numericValue.length <= 6) {
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

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setShowSuccess(false)

    // Validate exact lengths
    if (formData.aadhaarNumber.length !== 12) {
      toast({
        title: "Invalid Aadhaar Number",
        description: "Aadhaar number must be exactly 12 digits",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (formData.studentPhone.length !== 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be exactly 10 digits",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (formData.registrationNumber.length !== 6) {
      toast({
        title: "Invalid Registration Number",
        description: "Registration number must be exactly 6 digits",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      console.log('Submitting form data:', formData)
      const response = await fetch('/api/submit-management-seat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit form')
      }

      // Show success message
      setShowSuccess(true)
      toast({
        title: "Success!",
        description: "Your application has been submitted successfully.",
        duration: 5000,
      })

      // Reset form
      setFormData({
        studentName: "",
        aadhaarNumber: "",
        registrationNumber: "",
        dateOfBirth: "",
        studentPhone: "",
        studentEmail: "",
        fatherName: "",
        fatherOccupation: "",
        fatherIncome: "",
        fatherPhone: "",
        fatherEmail: "",
        mathsMarks: "",
        physicsMarks: "",
        chemistryMarks: "",
        totalMarks: "",
        collegePreference1: "",
        collegePreference2: "",
        collegePreference3: "",
        collegeName1: "",
        collegeName2: "",
        collegeName3: "",
        branchPreference1: "",
        branchPreference2: "",
        branchPreference3: ""
      })

      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Form submission error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit form. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter colleges based on search query
  const getFilteredColleges = (preferenceNum: number) => {
    const searchTerm = (collegeSearch[preferenceNum] || '').trim()
    if (!searchTerm) return colleges

    // Check if search term is a number (college code)
    const isNumericSearch = /^\d+$/.test(searchTerm)
    const searchTermLower = searchTerm.toLowerCase()

    return colleges.filter(college => {
      const collegeName = String(college.name || '').trim().toLowerCase()
      const collegeCode = String(college.code || '').trim()

      if (isNumericSearch) {
        // If searching with numbers, only match college codes
        return collegeCode.includes(searchTerm)
      } else {
        // If searching with text, match college names
        // Split search term into words for more accurate matching
        const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0)
        return searchWords.every(word => collegeName.includes(word))
      }
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-[#0B5588]">College Management Seat Application</h1>
          <p className="text-muted-foreground mb-6">
            Fill in your details to apply for management seat
          </p>

          {showSuccess && (
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
                    <p>Your management seat application has been submitted. We will contact you soon with further details.</p>
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
                    <Label htmlFor="aadhaarNumber">Aadhaar Number</Label>
                    <Input
                      id="aadhaarNumber"
                      name="aadhaarNumber"
                      value={formData.aadhaarNumber}
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
                      placeholder="Enter 6 digit registration number"
                      maxLength={6}
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
                      type="tel"
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

                <div className="space-y-6">
                  <h3 className="text-xl font-semibold">Parent Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fatherName">Father's Name</Label>
                    <Input
                      id="fatherName"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleInputChange}
                        placeholder="Enter father's full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fatherOccupation">Father's Occupation</Label>
                    <Input
                      id="fatherOccupation"
                      name="fatherOccupation"
                      value={formData.fatherOccupation}
                      onChange={handleInputChange}
                        placeholder="Enter father's occupation"
                      required
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
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fatherPhone">Father's Phone Number</Label>
                    <Input
                      id="fatherPhone"
                      name="fatherPhone"
                      type="tel"
                      value={formData.fatherPhone}
                      onChange={handleInputChange}
                        placeholder="Enter 10 digit phone number"
                        maxLength={10}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fatherEmail">Father's Email</Label>
                    <Input
                      id="fatherEmail"
                      name="fatherEmail"
                      type="email"
                      value={formData.fatherEmail}
                      onChange={handleInputChange}
                        placeholder="example@email.com"
                      required
                    />
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>

                <div className="space-y-6">
                  <h3 className="text-xl font-semibold">Academic Information</h3>
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
                </div>

                <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>

                <CardTitle className="mt-8">College Preferences</CardTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="space-y-2">
                      <Label>College Preference {num}</Label>
                      <Popover 
                        open={openCollegeSearch[num]} 
                        onOpenChange={(open) => setOpenCollegeSearch(prev => ({ ...prev, [num]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openCollegeSearch[num]}
                            className="w-full justify-between h-12"
                          >
                            <span className="truncate">
                              {formData[`collegePreference${num}` as keyof typeof formData] 
                                ? `${formData[`collegePreference${num}` as keyof typeof formData]} - ${formData[`collegeName${num}` as keyof typeof formData]}`
                                : `Search for college ${num}...`}
                            </span>
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Search college name or code..." 
                              value={collegeSearch[num] || ''}
                              onValueChange={(value) => {
                                setCollegeSearch(prev => ({ ...prev, [num]: value }))
                              }}
                            />
                            <CommandEmpty>No college found. Try searching with different terms.</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-auto">
                              {getFilteredColleges(num).map((college) => (
                                <CommandItem
                                  key={college.code}
                                  value={college.code}
                                  onSelect={() => {
                                    handleSelectChange(`collegePreference${num}`, college.code)
                                    setFormData(prev => ({
                                      ...prev,
                                      [`collegeName${num}`]: college.name
                                    }))
                                    setOpenCollegeSearch(prev => ({ ...prev, [num]: false }))
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{college.name}</span>
                                    <span className="text-sm text-gray-500">Code: {college.code}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-sm text-gray-500">Search by college name or code</p>
                    </div>
                  ))}

                  {[1, 2, 3].map((num) => (
                    <div key={num} className="space-y-2">
                      <Label htmlFor={`branchPreference${num}`}>Branch Preference {num}</Label>
                      <Select
                        value={formData[`branchPreference${num}` as keyof typeof formData]}
                        onValueChange={(value) => handleSelectChange(`branchPreference${num}`, value)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select branch ${num}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch} value={branch}>
                              {branch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
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