"use client"

import { useState, useEffect } from "react"
import { College, getParameterLabel } from "../../lib/college-data"
import { supabase } from "../../lib/supabase"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { Input } from "../../components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover"
import { Search } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Label } from "../../components/ui/label"

export default function CompareColleges() {
  const [colleges, setColleges] = useState<College[]>([])
  const [selectedCollege1, setSelectedCollege1] = useState<College | null>(null)
  const [selectedCollege2, setSelectedCollege2] = useState<College | null>(null)
  const [loading, setLoading] = useState(true)
  const [collegeSearch, setCollegeSearch] = useState<{ [key: number]: string }>({})
  const [openCollegeSearch, setOpenCollegeSearch] = useState<{ [key: number]: boolean }>({})

  useEffect(() => {
    loadColleges()
  }, [])

  const loadColleges = async () => {
    try {
      const { data, error } = await supabase
        .from("colleges")
        .select("*")
        .order("CollegeCode")

      if (error) throw error

      if (data) {
        // Deduplicate colleges based on CollegeCode
        const uniqueColleges = data.reduce((acc: College[], current: College) => {
          const exists = acc.find(college => college.CollegeCode === current.CollegeCode)
          if (!exists) {
            acc.push(current)
          }
          return acc
        }, [])
        
        setColleges(uniqueColleges)
      }
    } catch (error) {
      console.error("Error loading colleges:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCollege1Select = (code: string) => {
    const college = colleges.find((c) => c.CollegeCode === code)
    setSelectedCollege1(college || null)
  }

  const handleCollege2Select = (code: string) => {
    const college = colleges.find((c) => c.CollegeCode === code)
    setSelectedCollege2(college || null)
  }

  const parameters = [
    "collegeName",
    "ocCutoff",
    "avgMedianSalary",
    "avgPlacementPercentage",
    "avgPassingPercentage",
    "avgHigherStudiesPercentage",
    "avgScholarshipPercentage",
    "totalIntake",
    "avgSeatsFilled",
    "avgWomenStudents",
    "avgOutsideStudents",
    "IdleOutputIndex",
  ]

  // Filter colleges based on search query
  const getFilteredColleges = (collegeNum: number) => {
    const searchTerm = (collegeSearch[collegeNum] || '').trim()
    if (!searchTerm) return colleges

    // Check if search term is a number (college code)
    const isNumericSearch = /^\d+$/.test(searchTerm)
    const searchTermLower = searchTerm.toLowerCase()

    return colleges.filter(college => {
      const collegeName = String(college.collegeName || '').trim().toLowerCase()
      const collegeCode = String(college.CollegeCode || '').trim()

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
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-[#0B5588]">Compare Colleges</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
        {/* College 1 Selection */}
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold">Option 1</h2>
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">College</Label>
            <Popover 
              open={openCollegeSearch[1]} 
              onOpenChange={(open) => setOpenCollegeSearch(prev => ({ ...prev, [1]: open }))}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCollegeSearch[1]}
                  className="w-full justify-between h-10 sm:h-12 text-sm sm:text-base"
                >
                  <span className="truncate">
                    {selectedCollege1 
                      ? `${selectedCollege1.CollegeCode} - ${selectedCollege1.collegeName}`
                      : "Search for college..."}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Search college name or code..." 
                    value={collegeSearch[1] || ''}
                    onValueChange={(value) => {
                      setCollegeSearch(prev => ({ ...prev, [1]: value }))
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>No college found. Try searching with different terms.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {getFilteredColleges(1).map((college) => (
                        <CommandItem
                          key={String(college.CollegeCode ?? '')}
                          value={String(college.CollegeCode ?? '')}
                          onSelect={() => {
                            handleCollege1Select(college.CollegeCode)
                            setOpenCollegeSearch(prev => ({ ...prev, [1]: false }))
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-sm sm:text-base">{college.collegeName}</span>
                            <span className="text-xs sm:text-sm text-gray-500">Code: {college.CollegeCode}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs sm:text-sm text-gray-500">Search by college name or code</p>
          </div>
        </div>

        {/* College 2 Selection */}
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold">Option 2</h2>
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">College</Label>
            <Popover 
              open={openCollegeSearch[2]} 
              onOpenChange={(open) => setOpenCollegeSearch(prev => ({ ...prev, [2]: open }))}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCollegeSearch[2]}
                  className="w-full justify-between h-10 sm:h-12 text-sm sm:text-base"
                >
                  <span className="truncate">
                    {selectedCollege2 
                      ? `${selectedCollege2.CollegeCode} - ${selectedCollege2.collegeName}`
                      : "Search for college..."}
                  </span>
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Search college name or code..." 
                    value={collegeSearch[2] || ''}
                    onValueChange={(value) => {
                      setCollegeSearch(prev => ({ ...prev, [2]: value }))
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>No college found. Try searching with different terms.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                      {getFilteredColleges(2).map((college) => (
                        <CommandItem
                          key={String(college.CollegeCode ?? '')}
                          value={String(college.CollegeCode ?? '')}
                          onSelect={() => {
                            handleCollege2Select(college.CollegeCode)
                            setOpenCollegeSearch(prev => ({ ...prev, [2]: false }))
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-sm sm:text-base">{college.collegeName}</span>
                            <span className="text-xs sm:text-sm text-gray-500">Code: {college.CollegeCode}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs sm:text-sm text-gray-500">Search by college name or code</p>
          </div>
        </div>
      </div>

      {/* Comparison Table - Only show when both colleges are selected */}
      {selectedCollege1 && selectedCollege2 && (
        <div className="mt-6 sm:mt-8 overflow-x-auto">
          <Table className="border-collapse border border-gray-300 min-w-full">
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead className="border border-gray-300 px-2 sm:px-4 py-2 text-left font-semibold text-xs sm:text-sm">Parameter</TableHead>
                <TableHead className="border border-gray-300 px-2 sm:px-4 py-2 text-left font-semibold text-xs sm:text-sm">{selectedCollege1.collegeName}</TableHead>
                <TableHead className="border border-gray-300 px-2 sm:px-4 py-2 text-left font-semibold text-xs sm:text-sm">{selectedCollege2.collegeName}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parameters.map((param) => (
                <TableRow key={param} className="hover:bg-gray-50">
                  <TableCell className="border border-gray-300 px-2 sm:px-4 py-2 font-medium text-xs sm:text-sm">{getParameterLabel(param)}</TableCell>
                  <TableCell className="border border-gray-300 px-2 sm:px-4 py-2 text-xs sm:text-sm">{selectedCollege1[param as keyof College] || "N/A"}</TableCell>
                  <TableCell className="border border-gray-300 px-2 sm:px-4 py-2 text-xs sm:text-sm">{selectedCollege2[param as keyof College] || "N/A"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}