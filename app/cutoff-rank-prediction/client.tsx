'use client'

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Download } from "lucide-react"
import { fetchColleges } from "@/lib/college-service"
import { supabase } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { jsPDF } from "jspdf"
import autoTable from 'jspdf-autotable'
import { toast } from "react-hot-toast"

// Add type augmentation for the window object
declare global {
  interface Window {
    jsPDF: typeof jsPDF;
  }
}



const reservationCategories = [
  "OC", "BC", "BCM", "MBC", "MBCDNC", "MBCV", "SC", "SCA", "ST"
]

const districts = [
  "All Districts", "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapur", "Dindigul", "Erode", "Kallakurich", "Kancheepuram", "Kanyakumari",
  "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal",
  "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipe", "Salem", "Sivaganga",
  "Tenkasi", "Thanjavur", "TheNilgiris", "Theni", "Thirupattur", "Thoothukudi",
  "Tiruchirappalli", "Tirunelveli", "Tiruppur", "Thiruvallur", "Thiruvannamala",
  "Thiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
]

const branches = [
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
].sort((a, b) => a.localeCompare(b))

export default function CutoffRankPredictionClient() {
  const router = useRouter()
  const [colleges, setColleges] = useState<{ code: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [value, setValue] = useState("")
  const [selectedDistrict, setSelectedDistrict] = useState("")
  const [selectedCollegeCode, setSelectedCollegeCode] = useState("")
  const [selectedCollegeName, setSelectedCollegeName] = useState("")
  const [selectedBranch, setSelectedBranch] = useState("")
  const [searchType, setSearchType] = useState<"college" | "branch">("college")
  const [predictionType, setPredictionType] = useState<"cutoff" | "rank">("cutoff")
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [formData, setFormData] = useState({
    mathsMarks: "",
    physicsMarks: "",
    chemistryMarks: "",
    aadhaarNumber: "",
    studentPhone: "",
    registrationNumber: ""
  })
  const [collegeSearch, setCollegeSearch] = useState("")
  const [openCollegeSearch, setOpenCollegeSearch] = useState(false)

  useEffect(() => {
    async function loadColleges() {
      try {
        const { colleges } = await fetchColleges()
        console.log('Fetched colleges:', colleges)

        // Filter out duplicates and ensure proper code handling
        const uniqueColleges = Array.from(
          new Map(
            colleges
              .map(college => {
                // Ensure we have a valid college code
                const code = college.CollegeCode ? String(college.CollegeCode).trim() : ''
                const name = college.collegeName ? String(college.collegeName).trim() : 'Unknown College'
                
                if (!code) {
                  console.warn('College without code:', college)
                  return null
                }
                
                return [code, { code, name }] as [string, { code: string; name: string }]
              })
              .filter((entry): entry is [string, { code: string; name: string }] => entry !== null)
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
      } catch (error) {
        console.error('Error loading colleges:', error)
        setColleges([])
      }
    }
    loadColleges()
  }, [])

  const handleCollegeCodeChange = (code: string) => {
    console.log('Selected college code:', code)
    setSelectedCollegeCode(code)
    const college = colleges.find(c => String(c.code).toLowerCase() === String(code).toLowerCase())
    console.log('Found college:', college)
    if (college) {
      setSelectedCollegeName(college.name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResults([]) // Clear previous results

    try {
      // Validate inputs
      if (!selectedCategory || !value || !selectedDistrict) {
        throw new Error("Please fill in all required fields")
      }

      // Validate search type specific fields
      if (searchType === "college" && !selectedCollegeCode) {
        throw new Error("Please select a college code")
      } else if (searchType === "branch" && !selectedBranch) {
        throw new Error("Please select a branch")
      }

      // Validate value based on prediction type
      const numericValue = parseFloat(value)
      if (isNaN(numericValue)) {
        throw new Error(`Please enter a valid ${predictionType} number`)
      }

      if (predictionType === "cutoff") {
        if (numericValue < 70 || numericValue > 200) {
          throw new Error("Cutoff must be between 70 and 200")
        }
      } else {
        if (numericValue < 1 || numericValue > 150000) {
          throw new Error("Rank must be between 1 and 150000")
        }
      }

      // First, test the database connection
      const tableName = predictionType === "cutoff" ? "Cutoff" : "Rank"
      console.log('Attempting to connect to table:', tableName)
      
      // First check if the table exists
      const { data: tableInfo, error: tableError } = await supabase
        .from(tableName)
        .select('count')
        .limit(1)
        .single()

      if (tableError) {
        console.error('Table access error:', tableError)
        if (tableError.code === '42P01') {
          throw new Error(`Table "${tableName}" does not exist in the database. Please check the table name.`)
        }
        throw new Error(`Database error: ${tableError.message}`)
      }

      // Now try to get actual data with strict range filtering
      let query = supabase.from(tableName).select('*')

      if (predictionType === "cutoff") {
        const upperRange = 2
        const lowerRange = 10
        const minCutoff = Math.max(70, numericValue - lowerRange)
        const maxCutoff = Math.min(200, numericValue + upperRange)
        
        query = query
          .gte(selectedCategory, minCutoff)
          .lte(selectedCategory, maxCutoff)
      } else {
        // For rank, calculate range based on the input rank value
        // For lower ranks, use a smaller range; for higher ranks, use a larger range
        const calculateRankRange = (rank: number) => {
          if (rank <= 100) return 500;  // ±50 for ranks 1-100
          if (rank <= 1000) return 1000;  // ±100 for ranks 101-1000
          if (rank <= 10000) return 2000;  // ±500 for ranks 1001-10000
          return 3000;  // ±1000 for ranks above 10000
        }

        const range = calculateRankRange(numericValue)
        const minRank = Math.max(1, numericValue - range)
        const maxRank = Math.min(150000, numericValue + range)
        
        console.log('DEBUG - Rank Search Parameters:', {
          inputRank: numericValue,
          range,
          minRank,
          maxRank,
          selectedCategory,
          searchType,
          selectedBranch,
          selectedDistrict
        })

        // For rank, we'll get all results and filter in memory
        // because the ranks are stored as strings in the database
        query = query.not(selectedCategory, 'is', null)
      }

      // Add college code filter if searching by college
      if (searchType === "college" && selectedCollegeCode) {
        query = query.eq('College Code', selectedCollegeCode)
      }

      // Execute the query
      const { data, error } = await query

      if (error) {
        console.error('DEBUG - Query Error:', error)
        throw new Error(error.message || 'Error fetching data from database')
      }

      console.log('DEBUG - Initial Query Results:', {
        count: data?.length || 0,
        sampleValues: data?.slice(0, 5).map(r => ({
          collegeName: r['College Name'],
          branchName: r['Branch Name'],
          rankValue: r[selectedCategory]
        }))
      })

      if (data && data.length > 0) {
        // Log unique branch names in the results
        const uniqueBranches = [...new Set(data.map(item => item['Branch Name']))]
        console.log('DEBUG - Available Branches:', uniqueBranches)

        // Now filter the results in memory
        let filteredResults = data

        // Filter ranks in memory since they're stored as strings in the database
        if (predictionType === "rank") {
          const calculateRankRange = (rank: number) => {
            if (rank <= 100) return 500;
            if (rank <= 1000) return 1000;
            if (rank <= 10000) return 2000;
            return 3000;
          }

          const range = calculateRankRange(numericValue)
          const minRank = Math.max(1, numericValue - range)
          const maxRank = Math.min(150000, numericValue + range)
          
          const beforeCount = filteredResults.length
          filteredResults = filteredResults.filter(result => {
            // Convert string rank to number, handling any non-numeric characters
            const rankStr = result[selectedCategory]
            const rankValue = parseInt(rankStr.replace(/[^\d]/g, ''), 10)
            const isInRange = !isNaN(rankValue) && rankValue >= minRank && rankValue <= maxRank
            
            if (!isInRange) {
              console.log('DEBUG - Filtered Out:', {
                originalValue: rankStr,
                parsedRank: rankValue,
                minRank,
                maxRank,
                collegeName: result['College Name'],
                branchName: result['Branch Name']
              })
            } else {
              console.log('DEBUG - Kept Result:', {
                originalValue: rankStr,
                parsedRank: rankValue,
                minRank,
                maxRank,
                collegeName: result['College Name'],
                branchName: result['Branch Name']
              })
            }
            return isInRange
          })
          
          console.log('DEBUG - Rank Filtering:', {
            inputRank: numericValue,
            range,
            minRank,
            maxRank,
            beforeCount,
            afterCount: filteredResults.length,
            removed: beforeCount - filteredResults.length,
            remainingRanks: filteredResults.map(r => parseInt(r[selectedCategory].replace(/[^\d]/g, ''), 10)).sort((a, b) => a - b)
          })
        }

        // Apply branch filter if searching by branch
        if (searchType === "branch" && selectedBranch && selectedBranch !== "All Branches") {
          console.log('DEBUG - Branch Filter:', {
            selectedBranch,
            beforeCount: filteredResults.length,
            availableBranches: uniqueBranches
          })
          
          // Try to find a matching branch name
          const matchingBranch = uniqueBranches.find(branch => 
            branch.toLowerCase() === selectedBranch.toLowerCase()
          )

          if (matchingBranch) {
            console.log('DEBUG - Found Matching Branch:', matchingBranch)
            const beforeCount = filteredResults.length
            filteredResults = filteredResults.filter(result => 
              result['Branch Name'] === matchingBranch
            )
            console.log('DEBUG - After Branch Filter:', {
              beforeCount,
              afterCount: filteredResults.length,
              removed: beforeCount - filteredResults.length,
              remainingBranches: [...new Set(filteredResults.map(r => r['Branch Name']))]
            })
          } else {
            console.log('DEBUG - No Branch Match:', {
              selectedBranch,
              availableBranches: uniqueBranches
            })
            setStatusMessage(`No results found for the selected branch "${selectedBranch}". Please check the branch name.`)
            setResults([])
            return
          }
        }

        // Apply district filter
        if (selectedDistrict && selectedDistrict !== "All Districts") {
          const beforeCount = filteredResults.length
          filteredResults = filteredResults.filter(result => 
            result.District === selectedDistrict
          )
          console.log('DEBUG - District Filter:', {
            selectedDistrict,
            beforeCount,
            afterCount: filteredResults.length,
            removed: beforeCount - filteredResults.length
          })
        }

        if (filteredResults.length > 0) {
          // Sort results based on prediction type
          filteredResults.sort((a, b) => {
            if (predictionType === "rank") {
              const aRank = parseInt(a[selectedCategory].replace(/[^\d]/g, ''), 10) || 0
              const bRank = parseInt(b[selectedCategory].replace(/[^\d]/g, ''), 10) || 0
              return aRank - bRank  // For rank, lower is better (ascending)
            } else {
              const aValue = parseFloat(a[selectedCategory]) || 0
              const bValue = parseFloat(b[selectedCategory]) || 0
              return bValue - aValue  // For cutoff, higher is better (descending)
            }
          })

          console.log('DEBUG - Final Results:', {
            count: filteredResults.length,
            sampleResults: filteredResults.slice(0, 5).map(r => ({
              collegeName: r['College Name'],
              branchName: r['Branch Name'],
              rankValue: r[selectedCategory]
            }))
          })

          setResults(filteredResults)
          setStatusMessage("")
        } else {
          console.log('DEBUG - No Results After Filtering')
          setStatusMessage(`No results found for the given ${predictionType} criteria. Please try adjusting your search parameters.`)
          setResults([])
        }
      } else {
        console.log('DEBUG - No Initial Results')
        setStatusMessage(`No results found for the given ${predictionType} range. Please try adjusting your ${predictionType} value.`)
        setResults([])
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      setStatusMessage(error instanceof Error ? error.message : 'An error occurred while fetching results')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Add validation for Aadhar and Phone
    if (name === 'aadhaarNumber') {
      // Only allow numbers and limit to 12 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 12)
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }))
    } else if (name === 'studentPhone') {
      // Only allow numbers and limit to 10 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 10)
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }))
    } else if (name === 'registrationNumber') {
      // Only allow numbers and limit to 6 digits
      const numericValue = value.replace(/\D/g, '').slice(0, 6)
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }))
    } else if (name === 'mathsMarks' || name === 'physicsMarks' || name === 'chemistryMarks') {
      // Only allow numbers and limit to range 70-200
      const numericValue = value.replace(/\D/g, '')
      const numValue = parseInt(numericValue)
      if (numValue >= 70 && numValue <= 200) {
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
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  // Filter colleges based on search query
  const filteredColleges = colleges.filter(college => {
    if (!collegeSearch) return true; // Show all when search is empty
    
    const searchTerm = collegeSearch.toLowerCase();
    const collegeName = college.name.toLowerCase();
    const collegeCode = college.code.toLowerCase();
    
    // Simple includes check for both name and code
    return collegeName.includes(searchTerm) || collegeCode.includes(searchTerm);
  }).sort((a, b) => {
    // Sort results to prioritize exact matches and matches at the start of words
    const searchLower = collegeSearch.toLowerCase().trim()
    if (!searchLower) return 0

    const aNameLower = a.name.toLowerCase()
    const bNameLower = b.name.toLowerCase()
    const aCodeLower = a.code.toLowerCase()
    const bCodeLower = b.code.toLowerCase()

    // Check for exact matches first
    const aExactMatch = aNameLower === searchLower || aCodeLower === searchLower
    const bExactMatch = bNameLower === searchLower || bCodeLower === searchLower
    if (aExactMatch && !bExactMatch) return -1
    if (!aExactMatch && bExactMatch) return 1

    // Then check for matches at the start of words
    const aStartsWith = aNameLower.startsWith(searchLower) || aCodeLower.startsWith(searchLower)
    const bStartsWith = bNameLower.startsWith(searchLower) || bCodeLower.startsWith(searchLower)
    if (aStartsWith && !bStartsWith) return -1
    if (!aStartsWith && bStartsWith) return 1

    // Finally sort by name
    return aNameLower.localeCompare(bNameLower)
  })

  const generatePDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Add header
      doc.setFontSize(20);
      doc.setTextColor(11, 85, 136); // #0B5588
      doc.text('College Prediction Results', 20, 20);
      
      // Add prediction details
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Prediction Type: ${predictionType}`, 20, 35);
      doc.text(`Category: ${selectedCategory}`, 20, 45);
      doc.text(`Value: ${value}`, 20, 55);
      doc.text(`District: ${selectedDistrict}`, 20, 65);
      doc.text(`Search Type: ${searchType}`, 20, 75);
      
      if (searchType === "college" && selectedCollegeCode) {
        doc.text(`College: ${selectedCollegeCode} - ${selectedCollegeName}`, 20, 85);
      } else if (searchType === "branch" && selectedBranch) {
        doc.text(`Branch: ${selectedBranch}`, 20, 85);
      }
      
      // Add results table
      if (results.length > 0) {
        const tableData = results.map((result, index) => [
          predictionType === "rank" ? result.displayRank : '',
          result['College Name'],
          result['Branch Name'],
          result.District,
          result[selectedCategory],
          result.avgMedianSalary ? `₹${result.avgMedianSalary}` : '-',
          result.avgPlacementPercentage ? `${result.avgPlacementPercentage}%` : '-'
        ]);
        
        const headers = [
          predictionType === "rank" ? 'Rank' : '',
          'College Name',
          'Branch',
          'Location',
          `${selectedCategory} ${predictionType === "rank" ? "Rank" : "Cutoff"}`,
          'Median Salary',
          'Placement %'
        ].filter(header => header !== '');
        
        autoTable(doc, {
          head: [headers],
          body: tableData,
          startY: 100,
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          headStyles: {
            fillColor: [11, 85, 136],
            textColor: 255
          }
        });
      }
      
      // Save the PDF
      const filename = `college_prediction_${predictionType}_${selectedCategory}_${value}.pdf`;
      doc.save(filename);
      console.log('PDF saved successfully');
    } catch (error) {
      console.error('Detailed PDF generation error:', error);
      console.error('Full error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        window: typeof window !== 'undefined' ? {
          jspdf: typeof (window as any).jspdf,
          autoTable: typeof autoTable
        } : 'window not available'
      });
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-[#0B5588]">College Predictor</h1>
          <p className="text-muted-foreground mb-6">
            Enter your details to get college predictions based on {predictionType}
          </p>

          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Prediction Details</CardTitle>
                <CardDescription>Fill in your details to get college predictions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {statusMessage && (
                  <div className={`p-4 rounded-md ${
                    statusMessage.includes("No results") 
                      ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                      : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                  }`}>
                    {statusMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Prediction Type</Label>
                  <RadioGroup
                    value={predictionType}
                    onValueChange={(value) => {
                      setPredictionType(value as "cutoff" | "rank")
                      setValue("") // Clear the value when switching types
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cutoff" id="cutoff" />
                      <Label htmlFor="cutoff">Cutoff</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rank" id="rank" />
                      <Label htmlFor="rank">Rank</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Reservation Category</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                    required
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="value">
                    {predictionType === "cutoff" ? "Cutoff (70-200)" : "Rank (1-150000)"}
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    min={predictionType === "cutoff" ? 70 : 1}
                    max={predictionType === "cutoff" ? 200 : 150000}
                    step={predictionType === "cutoff" ? "0.01" : "1"}
                    required
                    placeholder={predictionType === "cutoff" ? "Enter cutoff" : "Enter rank"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={setSelectedDistrict}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Search By</Label>
                  <RadioGroup
                    value={searchType}
                    onValueChange={(value) => setSearchType(value as "college" | "branch")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="college" id="college" />
                      <Label htmlFor="college">College Wise</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="branch" id="branch" />
                      <Label htmlFor="branch">Branch Wise</Label>
                    </div>
                  </RadioGroup>
                </div>

                {searchType === "college" ? (
                    <div className="space-y-2">
                    <Label>College</Label>
                    <Popover open={openCollegeSearch} onOpenChange={setOpenCollegeSearch}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCollegeSearch}
                          className="w-full justify-between h-12"
                        >
                          <span className="truncate max-w-[calc(100%-2rem)]">
                            {selectedCollegeCode ? `${selectedCollegeCode} - ${selectedCollegeName}` : "Search for a college..."}
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Search college name or code..." 
                            value={collegeSearch}
                            onValueChange={(value) => {
                              console.log('Search value:', value); // Debug log
                              setCollegeSearch(value);
                            }}
                          />
                          <CommandEmpty>No college found. Try searching with different terms.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-auto">
                            {filteredColleges.map((college) => (
                              <CommandItem
                                key={college.code}
                                value={college.code}
                                onSelect={() => {
                                  console.log('Selected college:', college); // Debug log
                                  handleCollegeCodeChange(college.code);
                                  setOpenCollegeSearch(false);
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
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Select
                      value={selectedBranch}
                      onValueChange={setSelectedBranch}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Branches">All Branches</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Searching..." : "Get Predictions"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {results.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Prediction Results</CardTitle>
                <CardDescription>
                  {selectedBranch 
                    ? `Colleges offering ${selectedBranch} with ${selectedCategory} ${predictionType} around ${value}`
                    : `Colleges matching your ${predictionType} criteria`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2">Loading results...</span>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {predictionType === "rank" && <TableHead>Rank</TableHead>}
                          <TableHead>College Name</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>{selectedCategory} {predictionType === "rank" ? "Rank" : "Cutoff"}</TableHead>
                          <TableHead>Median Salary</TableHead>
                          <TableHead>Placement %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result, index) => (
                          <TableRow key={index}>
                            {predictionType === "rank" && (
                              <TableCell>{result.displayRank}</TableCell>
                            )}
                            <TableCell className="font-medium">{result['College Name']}</TableCell>
                            <TableCell>{result['Branch Name']}</TableCell>
                            <TableCell>{result.District}</TableCell>
                            <TableCell>{result[selectedCategory]}</TableCell>
                            <TableCell>{result.avgMedianSalary ?  `₹${result.avgMedianSalary}` : '-'}</TableCell>
                            <TableCell>{result.avgPlacementPercentage ? `${result.avgPlacementPercentage}%` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={generatePDF}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
} 