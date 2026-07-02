"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
  X,
  Info,
  AlertCircle,
  RefreshCw,
  Database,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  fetchColleges,
  getParameterLabel,
  formatValue,
  isPSGCollege,
  isPSGITAR,
  isVSBCollege,
  isAdithyaInstitute,
  type College,
} from "@/lib/college-service"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import * as React from "react"

interface ResultsTableProps {
  query?: string
  location: string
  duration: string
  selectedParameters: string[]
  isBasicSearch?: boolean
  loading?: boolean
}

// Define filter ranges for all possible parameters
interface FilterRanges {
  avgMedianSalary: [number, number]
  avgPlacementPercentage: [number, number]
  avgPassingPercentage: [number, number]
  avgHigherStudiesPercentage: [number, number]
  avgScholarshipPercentage: [number, number]
  totalIntake: [number, number]
  avgSeatsFilled: [number, number]
  avgWomenStudents: [number, number]
  avgOutsideStudents: [number, number]
  IdleOutputIndex: [number, number]
  PowerScore: [number, number]
}

// Define active filter settings
interface ActiveFilterSettings {
  avgMedianSalary: [number, number]
  avgPlacementPercentage: [number, number]
  avgPassingPercentage: [number, number]
  avgHigherStudiesPercentage: [number, number]
  avgScholarshipPercentage: [number, number]
  totalIntake: [number, number]
  avgSeatsFilled: [number, number]
  avgWomenStudents: [number, number]
  avgOutsideStudents: [number, number]
  IdleOutputIndex: [number, number]
  PowerScore: [number, number]
}

// Helper function to extract numeric value from percentage or currency string
function extractNumericValue(value: string): number {
  if (!value || typeof value !== "string") return 0

  // Special case for Adithya Institute
  if (value.includes("167,333.33")) {
    console.log("Found Adithya Institute salary value:", value)
    return 167333.33
  }

  try {
    // Remove currency symbols, commas, and spaces
    const cleanedValue = value.replace(/[₹$,\s]/g, "")

    // Parse the cleaned value as a float
    const numValue = Number.parseFloat(cleanedValue)

    // Return 0 if the result is NaN
    return isNaN(numValue) ? 0 : numValue
  } catch (error) {
    console.error("Error parsing numeric value:", value, error)
    return 0
  }
}

// Helper function to check if a college has data for a specific parameter
function hasDataForParameter(college: College, param: string): boolean {
  const value = college[param as keyof College]
  if (value === undefined || value === null) return false
  if (typeof value === "string") {
    if (value.trim() === "") return false
    if (value.trim() === "-") return false
    if (value.trim() === "N/A") return false
    // Extract numeric value for percentage and currency fields
    if (param.includes("avg") || param.includes("Percentage") || param.includes("Salary")) {
      return extractNumericValue(value) > 0
    }
  }
  if (typeof value === "number" && value === 0) return false
  return true
}

// Helper function to calculate a "data completeness" score for a college
function getDataCompletenessScore(college: College, parameters: string[]): number {
  return parameters.reduce((score, param) => {
    return score + (hasDataForParameter(college, param) ? 1 : 0)
  }, 0)
}

// Helper function to check if a college has complete data for all selected parameters
function hasCompleteData(college: College, parameters: string[]): boolean {
  return parameters.every((param) => hasDataForParameter(college, param))
}

// Function to deduplicate colleges
function deduplicateColleges(colleges: College[]): College[] {
  // Create a map to track colleges by name
  const collegeMap = new Map<string, College>()

  // First pass: add all non-Adithya colleges to the map
  colleges.forEach((college) => {
    if (!isAdithyaInstitute(college)) {
      collegeMap.set(college.collegeName.toLowerCase(), college)
    }
  })

  // Find the Adithya Institute entry (if any)
  const adithyaEntries = colleges.filter((college) => isAdithyaInstitute(college))

  // If we have Adithya entries, add only the first one
  if (adithyaEntries.length > 0) {
    console.log(`Deduplication: Found ${adithyaEntries.length} Adithya Institute entries`)
    collegeMap.set("adithya institute", adithyaEntries[0])
  }

  // Convert the map back to an array
  return Array.from(collegeMap.values())
}

export function ResultsTable({
  query = "",
  location,
  duration,
  selectedParameters,
  isBasicSearch = false,
  loading: initialLoading = false,
}: ResultsTableProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [colleges, setColleges] = useState<College[]>([])
  const [loading, setLoading] = useState(initialLoading)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [prioritizeCompleteData, setPrioritizeCompleteData] = useState(true)
  const [usingFallbackData, setUsingFallbackData] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [envVars, setEnvVars] = useState({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set",
    supabaseKeyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const collegesPerPage = 10

  // Store the full range of values for each parameter
  const [dataRanges, setDataRanges] = useState<FilterRanges>({
    avgMedianSalary: [0, 1000000],
    avgPlacementPercentage: [0, 100],
    avgPassingPercentage: [0, 100],
    avgHigherStudiesPercentage: [0, 100],
    avgScholarshipPercentage: [0, 100],
    totalIntake: [0, 5000],
    avgSeatsFilled: [0, 100],
    avgWomenStudents: [0, 100],
    avgOutsideStudents: [0, 100],
    IdleOutputIndex: [0, 100],
    PowerScore: [0, 100],
  })

  // Store the current filter settings
  const [filterSettings, setFilterSettings] = useState<ActiveFilterSettings>({
    avgMedianSalary: [0, 1000000],
    avgPlacementPercentage: [0, 100],
    avgPassingPercentage: [0, 100],
    avgHigherStudiesPercentage: [0, 100],
    avgScholarshipPercentage: [0, 100],
    totalIntake: [0, 5000],
    avgSeatsFilled: [0, 100],
    avgWomenStudents: [0, 100],
    avgOutsideStudents: [0, 100],
    IdleOutputIndex: [0, 100],
    PowerScore: [0, 100],
  })

  // Track which filters are active
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  // Parse location for filtering
  const [locationType, locationValue] = useMemo(() => {
    if (!location || location === "any") {
      return ["any", ""]
    }

    if (location.startsWith("city:")) {
      return ["city", location.replace("city:", "")]
    }

    if (location.startsWith("state:")) {
      return ["state", location.replace("state:", "")]
    }

    if (location.startsWith("district:")) {
      return ["district", location.replace("district:", "")]
    }

    return ["any", ""]
  }, [location])

  // Function to load college data
  const loadCollegeData = async () => {
    console.log("🔄 ResultsTable: Starting to fetch college data...")
    console.log("Location filter:", locationType, locationValue)
    
    setLoading(true)
    setFetchError(null)

    try {
      const result = await fetchColleges()
      console.log("📊 College data result:", {
        count: result.colleges.length,
        usingFallback: result.usingFallback,
        error: result.error,
        sampleCollege: result.colleges[0]
      })
      
      if (result.colleges.length > 0) {
        console.log("✅ Successfully loaded", result.colleges.length, "colleges")
        console.log("Sample college data:", result.colleges[0])
      } else {
        console.warn("⚠️ No colleges loaded")
      }

      // Set the colleges
      let collegeData = result.colleges

      // Set error and fallback status
      setFetchError(result.error)
      setUsingFallbackData(result.usingFallback)

      if (collegeData.length === 0) {
        console.error("❌ No college data was fetched")
        setFetchError("No college data was found. Please check your database.")
        setUsingFallbackData(true)
        setLoading(false)
        return
      }

      // Deduplicate colleges immediately after fetching
      collegeData = deduplicateColleges(collegeData)
      console.log("ResultsTable: Colleges after deduplication:", collegeData.length)

      // Check for special colleges
      const psgCollege = collegeData.find(isPSGCollege)
      const psgITAR = collegeData.find(isPSGITAR)
      const vsbCollege = collegeData.find(isVSBCollege)

      console.log("Special colleges found:", {
        "PSG College of Technology": !!psgCollege,
        "PSG ITAR": !!psgITAR,
        "VSB College": !!vsbCollege,
      })

      setColleges(collegeData)

      // Calculate data ranges from the actual data
      if (collegeData.length > 0) {
        // Helper function to get min and max values for percentage fields
        const getPercentageRange = (key: keyof College): [number, number] => {
          const values = collegeData
            .map((c) => {
              const val = c[key as keyof College] as string
              return extractNumericValue(val)
            })
            .filter((v) => !isNaN(v) && v > 0)

          if (values.length === 0) return [0, 100]
          return [Math.min(...values), Math.max(...values)]
        }

        // Helper function to get min and max values for salary
        const getSalaryRange = (): [number, number] => {
          const values = collegeData
            .map((c) => {
              const val = c.avgMedianSalary as string
              return extractNumericValue(val)
            })
            .filter((v) => !isNaN(v) && v > 0)

          if (values.length === 0) return [0, 1000000]
          return [Math.min(...values), Math.max(...values)]
        }

        // Helper function to get min and max values for intake
        const getIntakeRange = (): [number, number] => {
          const values = collegeData.map((c) => c.totalIntake).filter((v) => !isNaN(v) && v > 0)

          if (values.length === 0) return [0, 5000]
          return [Math.min(...values), Math.max(...values)]
        }

        // Update data ranges based on actual data
        const newRanges: FilterRanges = {
          avgMedianSalary: getSalaryRange(),
          avgPlacementPercentage: getPercentageRange("avgPlacementPercentage"),
          avgPassingPercentage: getPercentageRange("avgPassingPercentage"),
          avgHigherStudiesPercentage: getPercentageRange("avgHigherStudiesPercentage"),
          avgScholarshipPercentage: getPercentageRange("avgScholarshipPercentage"),
          totalIntake: getIntakeRange(),
          avgSeatsFilled: getPercentageRange("avgSeatsFilled"),
          avgWomenStudents: getPercentageRange("avgWomenStudents"),
          avgOutsideStudents: getPercentageRange("avgOutsideStudents"),
          IdleOutputIndex: getPercentageRange("IdleOutputIndex"),
          PowerScore: getPercentageRange("PowerScore"),
        }

        setDataRanges(newRanges)

        // Initialize filter settings to the full range of data
        setFilterSettings({
          avgMedianSalary: [...newRanges.avgMedianSalary],
          avgPlacementPercentage: [...newRanges.avgPlacementPercentage],
          avgPassingPercentage: [...newRanges.avgPassingPercentage],
          avgHigherStudiesPercentage: [...newRanges.avgHigherStudiesPercentage],
          avgScholarshipPercentage: [...newRanges.avgScholarshipPercentage],
          totalIntake: [...newRanges.totalIntake],
          avgSeatsFilled: [...newRanges.avgSeatsFilled],
          avgWomenStudents: [...newRanges.avgWomenStudents],
          avgOutsideStudents: [...newRanges.avgOutsideStudents],
          IdleOutputIndex: [...newRanges.IdleOutputIndex],
          PowerScore: [...newRanges.PowerScore],
        })
      }
    } catch (error) {
      console.error("❌ Exception loading colleges:", error)
      setFetchError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  // Fetch college data from Supabase
  useEffect(() => {
    loadCollegeData()
  }, [])

  // Colleges in the selected location (search-independent) — bounds the set we
  // compute new parameters for, so we don't recompute on every keystroke.
  // Apply search term and active filters
  const filteredColleges = useMemo(() => {
    // First filter by search term
    let filtered = colleges.filter(
      (college) =>
        college.collegeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        college.instituteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (college.CollegeCode && String(college.CollegeCode).toLowerCase().includes(searchTerm.toLowerCase())),
    )

    // Apply location filter if provided
    if (locationType !== "any" && locationValue) {
      console.log(`Filtering by ${locationType}: ${locationValue}`)

      if (locationType === "state") {
        filtered = filtered.filter((college) => {
          const stateMatch =
            college.State?.toLowerCase() === locationValue.toLowerCase() ||
            college.collegeName.toLowerCase().includes(locationValue.toLowerCase()) ||
            college.instituteName.toLowerCase().includes(locationValue.toLowerCase()) 
          return stateMatch
        })
      } else if (locationType === "district") {
        if (locationValue === "All Districts") {
          // If "All Districts" is selected, don't filter by district
          console.log("All Districts selected, not filtering by district")
        } else {
          console.log(`🔍 District filtering: Looking for "${locationValue}" in ${filtered.length} colleges`)
          console.log(`🔍 Sample college districts:`, filtered.slice(0, 3).map(c => c.District))
          
          filtered = filtered.filter((college) => {
            const districtMatch =
              college.District?.toLowerCase() === locationValue.toLowerCase() ||
              college.collegeName.toLowerCase().includes(locationValue.toLowerCase()) ||
              college.instituteName.toLowerCase().includes(locationValue.toLowerCase())
            
            if (districtMatch) {
              console.log(`✅ Found match: ${college.collegeName} (District: ${college.District})`)
            }
            
            return districtMatch
          })
        }
      }

      console.log(`After location filtering: ${filtered.length} colleges`)
    }

    // Apply all active filters
    if (activeFilters.includes("avgMedianSalary")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgMedianSalary)
        return value >= filterSettings.avgMedianSalary[0] && value <= filterSettings.avgMedianSalary[1]
      })
    }

    if (activeFilters.includes("avgPlacementPercentage")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgPlacementPercentage)
        return value >= filterSettings.avgPlacementPercentage[0] && value <= filterSettings.avgPlacementPercentage[1]
      })
    }

    if (activeFilters.includes("avgPassingPercentage")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgPassingPercentage)
        return value >= filterSettings.avgPassingPercentage[0] && value <= filterSettings.avgPassingPercentage[1]
      })
    }

    if (activeFilters.includes("avgHigherStudiesPercentage")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgHigherStudiesPercentage)
        return (
          value >= filterSettings.avgHigherStudiesPercentage[0] && value <= filterSettings.avgHigherStudiesPercentage[1]
        )
      })
    }

    if (activeFilters.includes("avgScholarshipPercentage")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgScholarshipPercentage)
        return (
          value >= filterSettings.avgScholarshipPercentage[0] && value <= filterSettings.avgScholarshipPercentage[1]
        )
      })
    }

    if (activeFilters.includes("totalIntake")) {
      filtered = filtered.filter(
        (college) =>
          college.totalIntake >= filterSettings.totalIntake[0] && college.totalIntake <= filterSettings.totalIntake[1],
      )
    }

    if (activeFilters.includes("avgSeatsFilled")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgSeatsFilled)
        return value >= filterSettings.avgSeatsFilled[0] && value <= filterSettings.avgSeatsFilled[1]
      })
    }

    if (activeFilters.includes("avgWomenStudents")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgWomenStudents)
        return value >= filterSettings.avgWomenStudents[0] && value <= filterSettings.avgWomenStudents[1]
      })
    }

    if (activeFilters.includes("avgOutsideStudents")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.avgOutsideStudents)
        return value >= filterSettings.avgOutsideStudents[0] && value <= filterSettings.avgOutsideStudents[1]
      })
    }

    if (activeFilters.includes("IdleOutputIndex")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.IdleOutputIndex);
        return value >= filterSettings.IdleOutputIndex[0] && value <= filterSettings.IdleOutputIndex[1];
      })
    }

    if (activeFilters.includes("PowerScore")) {
      filtered = filtered.filter((college) => {
        const value = extractNumericValue(college.PowerScore);
        return value >= filterSettings.PowerScore[0] && value <= filterSettings.PowerScore[1];
      })
    }

    // Deduplicate the filtered colleges
    filtered = deduplicateColleges(filtered)

    return filtered
  }, [colleges, searchTerm, locationType, locationValue, filterSettings, activeFilters])

  // Apply sorting and prioritize colleges with data for the selected parameters
  const sortedColleges = useMemo(() => {
    // First, calculate a data completeness score for each college
    const collegesWithScores = filteredColleges.map((college) => ({
      college,
      score: getDataCompletenessScore(college, selectedParameters),
      hasComplete: hasCompleteData(college, selectedParameters),
      isVSB: isVSBCollege(college),
      isPSG: isPSGCollege(college),
      isPSGITAR: isPSGITAR(college),
      isAdithya: isAdithyaInstitute(college),
    }))

    // Deduplicate Adithya Institute entries before sorting
    const adithyaBeforeSorting = collegesWithScores.filter((item) => item.isAdithya)

    if (adithyaBeforeSorting.length > 1) {
      // Keep only the first Adithya entry
      const adithyaToKeep = adithyaBeforeSorting[0]

      // Filter out all Adithya entries
      const collegesWithoutAdithya = collegesWithScores.filter((item) => !item.isAdithya)

      // Add back the one to keep
      collegesWithoutAdithya.push(adithyaToKeep)

      // Update our collegesWithScores array
      collegesWithScores.length = 0
      collegesWithScores.push(...collegesWithoutAdithya)
    }

    let sortedResult

    // Sort by the specified column if provided
    if (sortColumn) {
      sortedResult = collegesWithScores
        .sort((a, b) => {
          // First sort by data completeness if prioritizeCompleteData is enabled
          if (prioritizeCompleteData) {
            // First, check if one has complete data and the other doesn't
            if (a.hasComplete !== b.hasComplete) {
              return a.hasComplete ? -1 : 1
            }

            // If both have incomplete data, VSB college comes first
            if (!a.hasComplete && !b.hasComplete) {
              if (a.isVSB) return -1
              if (b.isVSB) return 1
            }

            // If both have complete data, VSB college comes last in the complete data section
            if (a.hasComplete && b.hasComplete) {
              if (a.isVSB) return 1
              if (b.isVSB) return -1
            }
          }

          // Special case for Adithya Institute - always sort it consistently
          if (a.isAdithya && !b.isAdithya) {
            return 1 // Always put Adithya after other colleges
          }
          if (!a.isAdithya && b.isAdithya) {
            return -1 // Always put other colleges before Adithya
          }

          // Then sort by the specified column
          const aCollege = a.college
          const bCollege = b.college

          // For numeric columns that are stored as strings with special characters
          if (
            [
              "avgMedianSalary",
              "avgPlacementPercentage",
              "avgPassingPercentage",
              "avgHigherStudiesPercentage",
              "avgScholarshipPercentage",
              "avgSeatsFilled",
              "avgWomenStudents",
              "avgOutsideStudents",
              "IdleOutputIndex",
            ].includes(sortColumn)
          ) {
            const aValue = extractNumericValue(aCollege[sortColumn as keyof College] as string)
            const bValue = extractNumericValue(bCollege[sortColumn as keyof College] as string)

            // If both values are 0 (likely missing data), maintain the data completeness order
            if (aValue === 0 && bValue === 0) return 0

            // If one value is 0 (likely missing data), prioritize the college with data
            if (aValue === 0) return 1
            if (bValue === 0) return -1

            return sortDirection === "asc" ? aValue - bValue : bValue - aValue
          }

          // For regular numeric columns
          if (sortColumn === "totalIntake" || sortColumn === "oc") {
            const aValue = aCollege[sortColumn as keyof College] as number
            const bValue = bCollege[sortColumn as keyof College] as number

            // If both values are 0 (likely missing data), maintain the data completeness order
            if (aValue === 0 && bValue === 0) return 0

            // If one value is 0 (likely missing data), prioritize the college with data
            if (aValue === 0) return 1
            if (bValue === 0) return -1

            return sortDirection === "asc" ? aValue - bValue : bValue - aValue
          }

          // For string columns
          const aValue = String(aCollege[sortColumn as keyof College] || "")
          const bValue = String(bCollege[sortColumn as keyof College] || "")

          // If both values are empty, maintain the data completeness order
          if (!aValue && !bValue) return 0

          // If one value is empty, prioritize the college with data
          if (!aValue) return 1
          if (!bValue) return -1

          return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
        })
        .map((item) => ({
          ...item.college,
          hasCompleteData: item.hasComplete,
          isVSBCollege: item.isVSB,
          isPSGCollege: item.isPSG,
          isPSGITAR: item.isPSG,
          isAdithyaInstitute: item.isAdithya,
        }))
    } else {
      // If no sort column is specified, just sort by data completeness
      sortedResult = collegesWithScores
        .sort((a, b) => {
          // First, colleges with complete data (except VSB)
          if (a.hasComplete && !a.isVSB && (!b.hasComplete || b.isVSB)) {
            return -1
          }
          if (b.hasComplete && !b.isVSB && (!a.hasComplete || a.isVSB)) {
            return 1
          }

          // Then VSB college
          if (a.isVSB) return -1
          if (b.isVSB) return 1

          // Special case for Adithya Institute - always sort it consistently
          if (a.isAdithya && !b.isAdithya) {
            return 1 // Always put Adithya after other colleges
          }
          if (!a.isAdithya && b.isAdithya) {
            return -1 // Always put other colleges before Adithya
          }

          // Then sort remaining colleges by data completeness score
          return b.score - a.score
        })
        .map((item) => ({
          ...item.college,
          hasCompleteData: item.hasComplete,
          isVSBCollege: item.isVSB,
          isPSGCollege: item.isPSG,
          isPSGITAR: item.isPSG,
          isAdithyaInstitute: item.isAdithya,
        }))
    }

    // If we have more than one Adithya Institute, keep only the first one
    const adithyaAfterSorting = sortedResult.filter(isAdithyaInstitute)

    if (adithyaAfterSorting.length > 1) {
      // Keep only the first Adithya entry
      const adithyaToKeep = adithyaAfterSorting[0]

      // Filter out all Adithya entries
      const collegesWithoutAdithya = sortedResult.filter((college) => !isAdithyaInstitute(college))

      // Add back the one to keep
      collegesWithoutAdithya.push(adithyaToKeep)

      // Update our sortedResult array
      sortedResult = collegesWithoutAdithya
    }

    return sortedResult
  }, [filteredColleges, sortColumn, sortDirection, selectedParameters, prioritizeCompleteData])

  // Calculate pagination values
  const totalPages = Math.ceil(sortedColleges.length / collegesPerPage)
  const indexOfLastCollege = currentPage * collegesPerPage
  const indexOfFirstCollege = indexOfLastCollege - collegesPerPage
  const currentColleges = sortedColleges.slice(indexOfFirstCollege, indexOfLastCollege)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, locationType, locationValue, filterSettings, activeFilters, sortColumn, sortDirection])

  // Pagination functions
  const goToPage = (page: number) => {
    setCurrentPage(page)
  }

  const goToFirstPage = () => {
    setCurrentPage(1)
  }

  const goToLastPage = () => {
    setCurrentPage(totalPages)
  }

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const goBack = () => {
    router.push("/")
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  // Toggle a filter on/off
  const toggleFilter = (filter: string) => {
    if (activeFilters.includes(filter)) {
      setActiveFilters(activeFilters.filter((f) => f !== filter))
    } else {
      setActiveFilters([...activeFilters, filter])
    }
  }

  // Update filter settings
  const handleFilterChange = (filter: string, values: [number, number]) => {
    setFilterSettings((prev) => ({
      ...prev,
      [filter]: values,
    }))

    if (!activeFilters.includes(filter)) {
      setActiveFilters([...activeFilters, filter])
    }
  }

  // Reset all filters
  const clearAllFilters = () => {
    setActiveFilters([])
  }

  // Remove a specific filter
  const removeFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter((f) => f !== filter))
  }

  // Reset a specific filter to its full range
  const resetFilter = (filter: string) => {
    setFilterSettings((prev) => ({
      ...prev,
      [filter]: [...dataRanges[filter as keyof FilterRanges]],
    }))
  }

  // Format filter value for display
  const formatFilterValue = (filter: string, value: number): string => {
    if (filter === "avgMedianSalary") {
      return `₹${value.toLocaleString()}`
    }
    if (
      filter.includes("Percentage") ||
      filter.includes("Filled") ||
      filter.includes("Students") ||
      filter.includes("Outcomes")
    ) {
      return `${value}%`
    }
    return value.toLocaleString()
  }

  // Count colleges with complete data
  const completeDataCount = sortedColleges.filter((college) => college.hasCompleteData).length

  // Function to retry data fetching
  const handleRetryFetch = () => {
    loadCollegeData()
  }

  // Format location for display
  const getLocationDisplay = () => {
    if (locationType === "any") return "Any Location"
    if (locationType === "city") return `City: ${locationValue}`
    if (locationType === "state") return `State: ${locationValue}`
    if (locationType === "district") return `District: ${locationValue}`
    return location
  }

  return (
    <div className="space-y-6 w-full bg-background text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b border-input">
        <div>
          <h2 className="text-xl font-semibold">Search Results</h2>
          <p className="text-gray-400">Showing colleges based on your preferences</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            className="font-medium border-gray-700 text-black dark:text-white hover:bg-gray-800 hover:text-white"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            New Search
          </Button>
          {usingFallbackData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFetch}
              className="font-medium border-yellow-500 text-yellow-500 hover:bg-yellow-500/20"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Fetch
            </Button>
          )}
        </div>
      </div>

      {usingFallbackData && (
        <div className="mx-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Using fallback data</p>
          </div>
          <div className="mt-1 text-sm text-gray-400">
            <p>Unable to fetch data from the 'colleges' table. This could be due to:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Connection issues with Supabase</li>
              <li>Permission issues (check your Row Level Security policies)</li>
              <li>The 'colleges' table exists but is empty</li>
              <li>Missing required fields in the table structure</li>
            </ul>

            <div className="mt-3 p-3 bg-gray-800 rounded-md font-mono text-xs">
              <p className="text-white font-medium mb-1">Environment Variables:</p>
              <p className="text-gray-300">NEXT_PUBLIC_SUPABASE_URL: {envVars.supabaseUrl}</p>
              <p className="text-gray-300">
                NEXT_PUBLIC_SUPABASE_ANON_KEY: {envVars.supabaseKeyExists ? "Set ✓" : "Not set ✗"}
              </p>
            </div>

            {fetchError && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-500">
                <p className="font-medium">Error details:</p>
                <p className="font-mono text-xs">{fetchError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6 mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Filter className="h-4 w-4" />
              <span>Filters:</span>
            </div>
            {location && location !== "any" && (
              <div className="bg-muted text-xs rounded-full px-3 py-1">{getLocationDisplay()}</div>
            )}
            {selectedParameters.map((param) => (
              <div key={param} className="bg-muted text-xs rounded-full px-3 py-1">
                {getParameterLabel(param)}
              </div>
            ))}

            {/* Active filter badges */}
            {activeFilters.map((filter) => (
              <Badge
                key={filter}
                variant="outline"
                className="bg-primary/20 text-primary border-primary flex items-center gap-1"
              >
                {filter === "avgMedianSalary" &&
                  `Salary: ${formatFilterValue("avgMedianSalary", filterSettings.avgMedianSalary[0])} - ${formatFilterValue("avgMedianSalary", filterSettings.avgMedianSalary[1])}`}
                {filter === "avgPlacementPercentage" &&
                  `Placement: ${formatFilterValue("avgPlacementPercentage", filterSettings.avgPlacementPercentage[0])} - ${formatFilterValue("avgPlacementPercentage", filterSettings.avgPlacementPercentage[1])}`}
                {filter === "avgPassingPercentage" &&
                  `Passing: ${formatFilterValue("avgPassingPercentage", filterSettings.avgPassingPercentage[0])} - ${formatFilterValue("avgPassingPercentage", filterSettings.avgPassingPercentage[1])}`}
                {filter === "avgHigherStudiesPercentage" &&
                  `Higher Studies: ${formatFilterValue("avgHigherStudiesPercentage", filterSettings.avgHigherStudiesPercentage[0])} - ${formatFilterValue("avgHigherStudiesPercentage", filterSettings.avgHigherStudiesPercentage[1])}`}
                {filter === "avgScholarshipPercentage" &&
                  `Scholarships: ${formatFilterValue("avgScholarshipPercentage", filterSettings.avgScholarshipPercentage[0])} - ${formatFilterValue("avgScholarshipPercentage", filterSettings.avgScholarshipPercentage[1])}`}
                {filter === "totalIntake" &&
                  `Intake: ${formatFilterValue("totalIntake", filterSettings.totalIntake[0])} - ${formatFilterValue("totalIntake", filterSettings.totalIntake[1])}`}
                {filter === "avgSeatsFilled" &&
                  `Seats Filled: ${formatFilterValue("avgSeatsFilled", filterSettings.avgSeatsFilled[0])} - ${formatFilterValue("avgSeatsFilled", filterSettings.avgSeatsFilled[1])}`}
                {filter === "avgWomenStudents" &&
                  `Women: ${formatFilterValue("avgWomenStudents", filterSettings.avgWomenStudents[0])} - ${formatFilterValue("avgWomenStudents", filterSettings.avgWomenStudents[1])}`}
                {filter === "avgOutsideStudents" &&
                  `Outside: ${formatFilterValue("avgOutsideStudents", filterSettings.avgOutsideStudents[0])} - ${formatFilterValue("avgOutsideStudents", filterSettings.avgOutsideStudents[1])}`}
                {filter === "IdleOutputIndex" &&
                  `NON-Graduated: ${formatFilterValue("IdleOutputIndex", filterSettings.IdleOutputIndex[0])} - ${formatFilterValue("IdleOutputIndex", filterSettings.IdleOutputIndex[1])}`}
                {filter === "PowerScore" &&
                  `Power Score: ${formatFilterValue("PowerScore", filterSettings.PowerScore[0])} - ${formatFilterValue("PowerScore", filterSettings.PowerScore[1])}`}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter(filter)} />
              </Badge>
            ))}

            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 text-xs text-gray-400 hover:text-white"
              >
                Clear all
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search colleges..."
                className="w-full sm:w-[250px] pl-8 bg-muted border-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`border-input hover:bg-muted ${activeFilters.length > 0 ? "text-primary" : ""}`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-background border-input overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Results</SheetTitle>
                  <SheetDescription className="text-gray-400">
                    Set custom ranges to filter colleges based on your requirements.
                  </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-8">
                  {/* Prioritize colleges with complete data toggle */}
                  <div className="flex flex-col space-y-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="prioritize-complete-data" className="text-base font-medium">
                          Prioritize colleges with complete data
                        </Label>
                        <p className="text-sm text-gray-400 mt-1">
                          Show colleges with data for all selected parameters at the top
                        </p>
                      </div>
                      <Switch
                        id="prioritize-complete-data"
                        checked={prioritizeCompleteData}
                        onCheckedChange={setPrioritizeCompleteData}
                      />
                    </div>
                  </div>

                  {/* Filters for different parameters */}
                  {/* (Keeping this section brief for clarity) */}
                </div>

                <SheetFooter>
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      className="w-full border-gray-700 text-white hover:bg-gray-800"
                      onClick={clearAllFilters}
                    >
                      Reset All Filters
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button className="w-full bg-white text-black hover:bg-gray-200">Apply Filters</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Data completeness info */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-gray-400">
            Showing {sortedColleges.length} colleges ({completeDataCount} with complete data)
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Colleges with incomplete data are shown with a gray background</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : sortedColleges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No College Data Found</h3>
            <p className="text-gray-400 max-w-md">
              {locationType !== "any"
                ? `No colleges found in ${getLocationDisplay()}. Try broadening your search criteria.`
                : "Unable to fetch college data from the database. Please check your Supabase connection and ensure the 'colleges' table exists with data."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFetch}
              className="mt-4 font-medium border-yellow-500 text-yellow-500 hover:bg-yellow-500/20"
            >
              <Database className="mr-2 h-4 w-4" />
              Test Database Connection
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-gray-800">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-input">
                  <TableHead className="w-[15%] cursor-pointer" onClick={() => handleSort("code")}>
                    <div className="flex items-center">
                      College Code
                      {getSortIcon("CollegeCode")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[35%] cursor-pointer" onClick={() => handleSort("instituteName")}>
                    <div className="flex items-center">
                      Institution Name
                      {getSortIcon("instituteName")}
                    </div>
                  </TableHead>
                  {selectedParameters.map((param) => (
                    <TableHead key={param} className="cursor-pointer" onClick={() => handleSort(param)}>
                      <div className="flex items-center">
                        {getParameterLabel(param)}
                        {getSortIcon(param)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentColleges.map((college) => (
                  <React.Fragment key={college.id}>
                    <TableRow
                      className={`border-input hover:bg-muted/50 ${!college.hasCompleteData ? "bg-gray-100 dark:bg-gray-800/30" : ""}`}
                    >
                      <TableCell className="font-medium text-black dark:text-white">
                      {college.CollegeCode ||
                          college.CollegeCode ||
                          college.CollegeCode ||
                          college["CollegeCode"] ||
                          "CollegeCode"}
                      </TableCell>
                      <TableCell
                        className={`font-medium ${
                          college.isVSBCollege ? "text-red-600 dark:text-red-500" : "text-black dark:text-white"
                        }`}
                      >
                        {/* Ensure we always display something for the institution name */}
                        {(college.instituteName || college.collegeName || `College #${college.id || "Unknown"}`) !==
                        "null"
                          ? college.instituteName || college.collegeName || `College #${college.id || "Unknown"}`
                          : `College #${college.id || "Unknown"}`}
                        {(!college.hasCompleteData || college.isVSBCollege) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="inline-block ml-2 h-4 w-4 text-yellow-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                {college.isVSBCollege
                                  ? "Data looks suspicious - double check before joining"
                                  : "No Publicly available data, join at your own risk!!!"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      {selectedParameters.map((param) => (
                        <TableCell key={param} className="text-black dark:text-white">
                          {formatValue(param, college[param as keyof College])}
                        </TableCell>
                      ))}
                    </TableRow>
                    {college.isVSBCollege ? (
                      <TableRow className="border-0">
                        <TableCell
                          colSpan={2 + selectedParameters.length}
                          className="py-0 pt-0 pb-2 text-red-600 dark:text-red-500 text-sm font-medium"
                        >
                          Data Looks suspicious - double check before joining
                        </TableCell>
                      </TableRow>
                    ) : (
                      !college.hasCompleteData && (
                        <TableRow className="border-0">
                          <TableCell
                            colSpan={2 + selectedParameters.length}
                            className="py-0 pt-0 pb-2 text-red-600 dark:text-red-500 text-sm font-medium"
                          >
                            No Publicly available data, join at your own risk
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                <div className="flex-1 flex justify-between sm:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="border-gray-700"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="border-gray-700"
                  >
                    Next
                  </Button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      Showing <span className="font-medium">{indexOfFirstCollege + 1}</span> to{" "}
                      <span className="font-medium">{Math.min(indexOfLastCollege, sortedColleges.length)}</span> of{" "}
                      <span className="font-medium">{sortedColleges.length}</span> colleges
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={goToFirstPage}
                        disabled={currentPage === 1}
                        className="rounded-l-md border-gray-700"
                      >
                        <span className="sr-only">First page</span>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="border-gray-700"
                      >
                        <span className="sr-only">Previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber: number

                        // Calculate which page numbers to show
                        if (totalPages <= 5) {
                          // If we have 5 or fewer pages, show all
                          pageNumber = i + 1
                        } else if (currentPage <= 3) {
                          // If we're near the start, show 1-5
                          pageNumber = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          // If we're near the end, show last 5
                          pageNumber = totalPages - 4 + i
                        } else {
                          // Otherwise show current page and 2 on each side
                          pageNumber = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="icon"
                            onClick={() => goToPage(pageNumber)}
                            className={`border-gray-700 ${
                              currentPage === pageNumber ? "bg-primary text-primary-foreground" : ""
                            }`}
                          >
                            {pageNumber}
                          </Button>
                        )
                      })}

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="border-gray-700"
                      >
                        <span className="sr-only">Next page</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={goToLastPage}
                        disabled={currentPage === totalPages}
                        className="rounded-r-md border-gray-700"
                      >
                        <span className="sr-only">Last page</span>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
