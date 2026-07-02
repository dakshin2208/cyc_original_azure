"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Upload, FileText } from "lucide-react"
import { submitCollegeData } from "../actions/submit-college-data"
import { fetchColleges } from "@/lib/college-service"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search } from "lucide-react"

export default function AddCollegeDataPage() {
  const [collegeName, setCollegeName] = useState("")
  const [nirfCode, setNirfCode] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [isDragging, setIsDragging] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [personName, setPersonName] = useState("")
  const [colleges, setColleges] = useState<{ code: string; name: string }[]>([])
  const [emailId, setEmailId] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [contactNumber, setContactNumber] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [collegeSearch, setCollegeSearch] = useState("")
  const [openCollegeSearch, setOpenCollegeSearch] = useState(false)

  useEffect(() => {
    async function loadColleges() {
      try {
        setIsLoading(true)
        console.log('Fetching colleges...')
        const result = await fetchColleges()
        console.log('Raw fetch result:', result)
        
        if (result && result.colleges && result.colleges.length > 0) {
          console.log('First college sample:', result.colleges[0])
          console.log('Available properties:', Object.keys(result.colleges[0]))
          
          // Only show colleges that DON'T already have NIRF data — those are the
          // ones users can submit data for. Colleges already linked to a NIRF code
          // (nirf_id present) are excluded from the list.
          const collegesNeedingData = result.colleges.filter(
            college => !(college as any).nirf_id,
          )

          // Map the colleges with proper property names and deduplicate based on code
          const uniqueColleges = Array.from(
            new Map(
              collegesNeedingData.map(college => [
                String(college.CollegeCode), // Use code as key for deduplication
                {
                  code: String(college.CollegeCode),
              name: college.collegeName || college.instituteName || 'Unknown College'
            }
              ])
            ).values()
          )
          
          // Sort colleges by code in ascending order
          uniqueColleges.sort((a, b) => {
            // Convert codes to numbers for proper numerical sorting
            const codeA = parseInt(a.code) || 0
            const codeB = parseInt(b.code) || 0
            return codeA - codeB
          })
          
          console.log('Sorted unique colleges:', uniqueColleges)
          setColleges(uniqueColleges)
        } else {
          console.log('No colleges found in result')
          setColleges([])
        }
      } catch (error) {
        console.error('Error loading colleges:', error)
        setColleges([])
      } finally {
        setIsLoading(false)
      }
    }
    loadColleges()
  }, [])

  const handleCollegeCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value
    console.log('Selected college code:', selectedCode)
    console.log('Available colleges:', colleges)
    
    setNirfCode(selectedCode)
    
    if (!selectedCode) {
      setCollegeName("")
      return
    }
    
    // Convert both to strings for comparison
    const college = colleges.find(c => String(c.code) === String(selectedCode))
    console.log('Found college:', college)
    
    if (college) {
      setCollegeName(college.name)
    } else {
      setCollegeName("")
      console.error('College not found for code:', selectedCode)
    }
  }

  useEffect(() => {
    if (nirfCode) {
      const selectedCollege = colleges.find(college => college.code === nirfCode)
      if (selectedCollege) {
        setCollegeName(selectedCollege.name)
      }
    } else {
      setCollegeName("")
    }
  }, [nirfCode, colleges])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB in bytes
      if (selectedFile.size > maxSize) {
        setSubmitStatus("error")
        setStatusMessage("File size exceeds 10MB limit. Please upload a smaller file.")
        return
      }

      setFile(selectedFile)
      setFileName(selectedFile.name)

      // Clear any previous error messages
      if (submitStatus === "error") {
        setSubmitStatus("idle")
        setStatusMessage("")
      }
    } else {
      setFile(null)
      setFileName("")
    }
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]

      // Check if file is a PDF
      if (droppedFile.type !== "application/pdf" && !droppedFile.name.endsWith(".pdf")) {
        setSubmitStatus("error")
        setStatusMessage("Please upload a PDF file")
        return
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB in bytes
      if (droppedFile.size > maxSize) {
        setSubmitStatus("error")
        setStatusMessage("File size exceeds 10MB limit. Please upload a smaller file.")
        return
      }

      setFile(droppedFile)
      setFileName(droppedFile.name)

      // Clear any previous error messages
      if (submitStatus === "error") {
        setSubmitStatus("idle")
        setStatusMessage("")
      }
    }
  }

  const handleContactNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers and limit to 10 digits
    if (/^\d*$/.test(value) && value.length <= 10) {
      setContactNumber(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus("idle")
    setStatusMessage("")

    try {
      // Validate form
      if (!collegeName?.trim() || !nirfCode || !websiteUrl?.trim() || !file || !personName?.trim() || !emailId?.trim() || !contactNumber?.trim()) {
        setSubmitStatus("error")
        setStatusMessage("All fields are required")
        setIsSubmitting(false)
        return
      }

      // Create FormData object
      const formData = new FormData()
      formData.append("collegeName", collegeName)
      formData.append("nirfCode", String(nirfCode))
      formData.append("websiteUrl", websiteUrl)
      formData.append("file", file)
      formData.append("personName", personName)
      formData.append("emailId", emailId)
      formData.append("contactNumber", contactNumber)

      // Submit data using server action
      const result = await submitCollegeData(formData)

      if (result.success) {
        setSubmitStatus("success")
        setStatusMessage(result.message)

        // Reset form after successful submission
        setCollegeName("")
        setNirfCode("")
        setWebsiteUrl("")
        setFile(null)
        setFileName("")
        setPersonName("")
        setEmailId("")
        setContactNumber("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        setSubmitStatus("error")
        setStatusMessage(result.message)
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      setSubmitStatus("error")
      setStatusMessage("Failed to submit data. Please try again later.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter colleges based on search query
  const filteredColleges = colleges.filter(college => {
    if (!collegeSearch) return true
    
    const searchTerm = collegeSearch.toLowerCase()
    const collegeName = college.name.toLowerCase()
    const collegeCode = college.code.toLowerCase()
    return collegeName.includes(searchTerm) || collegeCode.includes(searchTerm)
  })

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-[#0B5588]">Add College Data</h1>
          <p className="text-muted-foreground mb-6">Submit your college's NIRF data to be included in our database</p>

          {submitStatus === "success" && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-300 rounded-lg p-4 mb-6 flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">{statusMessage}</p>
                <p className="text-sm mt-1">
                  Thank you for submitting your college data. Our team will review it shortly.
                </p>
              </div>
            </div>
          )}

          {submitStatus === "error" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Submission Error</p>
                <p className="text-sm mt-1">{statusMessage}</p>
              </div>
            </div>
          )}

          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>College Information</CardTitle>
                <CardDescription>Please provide accurate information about your college and NIRF data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="nirfCode">College Code</Label>
                  <Popover open={openCollegeSearch} onOpenChange={setOpenCollegeSearch}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCollegeSearch}
                        className="w-full justify-between h-12"
                    disabled={isLoading}
                  >
                        <span className="truncate max-w-[calc(100%-2rem)]">
                          {nirfCode 
                            ? `${nirfCode} - ${collegeName}`
                            : "Search for a college..."}
                        </span>
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search college name or code..." 
                          value={collegeSearch}
                          onValueChange={setCollegeSearch}
                         
                        />
                        <CommandEmpty>No college found. Try searching with different terms.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                          {filteredColleges.map((college) => (
                            <CommandItem
                              key={college.code}
                              value={college.code}
                              onSelect={() => {
                                handleCollegeCodeChange({ target: { value: college.code } } as any)
                                setOpenCollegeSearch(false)
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
                  {isLoading && <p className="text-sm text-muted-foreground">Loading colleges...</p>}
                  <p className="text-sm text-gray-500">Search by college name or code</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collegeName">College Name</Label>
                  <Input
                    id="collegeName"
                    type="text"
                    value={collegeName}
                    readOnly
                    placeholder="College name will appear here after selecting college code"
                    required
                    className="truncate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">College Website URL</Label>
                  <Input
                    id="websiteUrl"
                    type="url"
                    placeholder="https://www.example.edu (URL to the page containing your NIRF data)"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personName">Name of the Person</Label>
                  <Input
                    id="personName"
                    type="text"
                    placeholder="Enter your name"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailId">Email ID</Label>
                  <Input
                    id="emailId"
                    type="email"
                    placeholder="Enter your email ID"
                    value={emailId}
                    onChange={(e) => setEmailId(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    type="tel"
                    placeholder="Enter 10 digit mobile number"
                    value={contactNumber}
                    onChange={handleContactNumberChange}
                    maxLength={10}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nirfData">NIRF Data (PDF)</Label>
                  <div
                    className={`border rounded-md p-4 transition-colors ${
                      isDragging
                        ? "border-primary border-dashed bg-primary/10"
                        : file
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/40"
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      // Show file preview when a file is selected
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 p-2 bg-primary/10 rounded-md">
                          <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Change File
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFile(null)
                                setFileName("")
                                if (fileInputRef.current) fileInputRef.current.value = ""
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Show upload prompt when no file is selected
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Upload NIRF data PDF</p>
                          <p className="text-xs text-muted-foreground mt-1">Drag and drop or click to browse</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Browse Files
                        </Button>
                      </div>
                    )}
                    <input
                      type="file"
                      id="nirfData"
                      ref={fileInputRef}
                      className="sr-only"
                      onChange={handleFileChange}
                      accept=".pdf,application/pdf"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload the PDF file containing your college's NIRF data (max 10MB)
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? "Submitting..." : "Submit College Data"}
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
