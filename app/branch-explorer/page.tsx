'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from '@supabase/supabase-js'
import { fetchColleges } from "@/lib/college-service"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Gift, Building2, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false
    }
  }
)

export default function BranchExplorer() {
  const router = useRouter()
  const [colleges, setColleges] = useState<{ code: string; name: string }[]>([])
  const [selectedCollegeCode, setSelectedCollegeCode] = useState("")
  const [selectedCollegeName, setSelectedCollegeName] = useState("")
  const [collegeBranches, setCollegeBranches] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("OC")
  const [openCollegeSearch, setOpenCollegeSearch] = useState(false)
  const [collegeSearch, setCollegeSearch] = useState("")

  const reservationCategories = [
    "OC", "BC", "BCM", "MBC", "SC", "SCA", "ST"
  ]

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
          const codeA = parseInt(a.code) || 0
          const codeB = parseInt(b.code) || 0
          return codeA - codeB
        })

        console.log('Sorted unique colleges:', uniqueColleges)
        setColleges(uniqueColleges)
      } catch (error) {
        console.error('Error loading colleges:', error)
        setColleges([])
        setError('Failed to load colleges. Please try again later.')
      }
    }
    loadColleges()
  }, [])

  const handleCollegeCodeChange = async (code: string) => {
    console.log('Selected college code:', code)
    setSelectedCollegeCode(code)
    setSelectedCollegeName("")
    setCollegeBranches([])
    setError("")
    
    const college = colleges.find(c => String(c.code).toLowerCase() === String(code).toLowerCase())
    if (college) {
      setSelectedCollegeName(college.name)
      
      // Fetch branches for the selected college
      setIsLoading(true)
      try {
        // Fetch cutoff data
        const { data: cutoffData, error: cutoffError } = await supabase
          .from('Cutoff')
          .select('*')
          .eq('College Code', code)

        if (cutoffError) {
          console.error('Error fetching cutoff data:', cutoffError)
          throw new Error('Failed to fetch college cutoff data')
        }

        // Fetch rank data
        const { data: rankData, error: rankError } = await supabase
          .from('Rank')
          .select('*')
          .eq('College Code', code)

        if (rankError) {
          console.error('Error fetching rank data:', rankError)
          throw new Error('Failed to fetch college rank data')
        }

        if (cutoffData && cutoffData.length > 0) {
          // Create a map of rank data for quick lookup
          const rankMap = new Map(
            rankData?.map(item => [
              item['Branch Name'],
              {
                OC: item['OC'] || 'N/A',
                BC: item['BC'] || 'N/A',
                BCM: item['BCM'] || 'N/A',
                MBC: item['MBC'] || 'N/A',
                SC: item['SC'] || 'N/A',
                SCA: item['SCA'] || 'N/A',
                ST: item['ST'] || 'N/A'
              }
            ]) || []
          )

          // Get unique branches with their details
          const uniqueBranches = Array.from(
            new Map(
              cutoffData.map(item => [
                item['Branch Name'],
                {
                  branchName: item['Branch Name'],
                  branchCode: item['Branch Code'],
                  totalIntake: item.totalIntake || 'N/A',
                  avgSeatsFilled: item.avgSeatsFilled || 'N/A',
                  avgMedianSalary: item.avgMedianSalary || 'N/A',
                  avgPlacementPercentage: item.avgPlacementPercentage || 'N/A',
                  cutoffData: {
                    OC: item['OC'] || 'N/A',
                    BC: item['BC'] || 'N/A',
                    BCM: item['BCM'] || 'N/A',
                    MBC: item['MBC'] || 'N/A',
                    SC: item['SC'] || 'N/A',
                    SCA: item['SCA'] || 'N/A',
                    ST: item['ST'] || 'N/A'
                  },
                  rankData: rankMap.get(item['Branch Name']) || {
                    OC: 'N/A',
                    BC: 'N/A',
                    BCM: 'N/A',
                    MBC: 'N/A',
                    SC: 'N/A',
                    SCA: 'N/A',
                    ST: 'N/A'
                  }
                }
              ])
            ).values()
          )

          // Sort branches alphabetically
          uniqueBranches.sort((a, b) => a.branchName.localeCompare(b.branchName))
          setCollegeBranches(uniqueBranches)
        } else {
          setCollegeBranches([])
          setError('No branches found for this college')
        }
      } catch (error) {
        console.error('Error:', error)
        setCollegeBranches([])
        setError('Failed to load branches. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleScholarshipClaim = (collegeCode: string, branchCode: string, branchName: string) => {
    router.push(`/college-scholarship-seat?collegeCode=${collegeCode}&branchCode=${branchCode}&branchName=${encodeURIComponent(branchName)}`)
  }

  const handleManagementSeatClaim = (collegeCode: string, branchCode: string, branchName: string) => {
    router.push(`/college-management-seat?collegeCode=${collegeCode}&branchCode=${branchCode}&branchName=${encodeURIComponent(branchName)}`)
  }

  const filteredColleges = colleges.filter((college) => {
    const searchTerm = collegeSearch.toLowerCase()
    return (
      college.name.toLowerCase().includes(searchTerm) ||
      college.code.toLowerCase().includes(searchTerm)
    )
  })

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-[#0B5588]">Branch Explorer</h1>
        <p className="text-muted-foreground mb-6">
          Explore branches offered by colleges
        </p>

        <Card>
          <CardHeader>
            <CardTitle>College Selection</CardTitle>
            <CardDescription>Select a college to view its branches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="collegeCode">College</Label>
              <Popover open={openCollegeSearch} onOpenChange={setOpenCollegeSearch}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCollegeSearch}
                    className="w-full justify-between h-12"
                  >
                    <span className="truncate max-w-[calc(100%-2rem)]">
                      {selectedCollegeCode 
                        ? `${selectedCollegeCode} - ${selectedCollegeName}`
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
                            handleCollegeCodeChange(college.code)
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
              <p className="text-sm text-gray-500">Search by college name or code</p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading branches...</span>
              </div>
            ) : collegeBranches.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch Code</TableHead>
                      <TableHead>Branch Name</TableHead>
                      <TableHead className="text-right">
                        <div className="flex justify-end items-center">
                          <Select
                            value={selectedCategory}
                            onValueChange={setSelectedCategory}
                          >
                            <SelectTrigger className="h-6 w-[60px]">
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
                      </TableHead>
                      <TableHead className="text-left">
                        <div className="flex justify-start items-center">
                          <span>{selectedCategory} Cutoff</span>
                        </div>
                      </TableHead>
                      <TableHead>{selectedCategory} Rank</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collegeBranches.map((branch, index) => (
                      <TableRow key={index}>
                        <TableCell>{branch.branchCode}</TableCell>
                        <TableCell className="font-medium">{branch.branchName}</TableCell>
                        <TableCell></TableCell>
                        <TableCell>{branch.cutoffData[selectedCategory]}</TableCell>
                        <TableCell>{branch.rankData[selectedCategory]}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => handleScholarshipClaim(selectedCollegeCode, branch.branchCode, branch.branchName)}
                            >
                              <Gift className="h-4 w-4" />
                              Scholarship/Free Seat
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => handleManagementSeatClaim(selectedCollegeCode, branch.branchCode, branch.branchName)}
                            >
                              <Building2 className="h-4 w-4" />
                              Management Seat
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : selectedCollegeCode && !error ? (
              <div className="text-center p-4 text-muted-foreground">
                No branches found for this college
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 