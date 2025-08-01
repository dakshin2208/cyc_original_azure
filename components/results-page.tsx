"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, Download, Filter, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { College } from "@/lib/college-data"
import { getParameterLabel, formatValue, getDurationLabel } from "@/lib/college-data"

interface ResultsPageProps {
  query: string
  location: string
  duration: string
  selectedParameters: string[]
  isBasicSearch?: boolean
}

export function ResultsPage({
  query,
  location,
  duration,
  selectedParameters,
  isBasicSearch = false,
}: ResultsPageProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [colleges, setColleges] = useState<College[]>([])
  const [loading, setLoading] = useState(true)

  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  )

  // Fetch colleges from Supabase
  useEffect(() => {
    async function fetchColleges() {
      setLoading(true)

      try {
        let supabaseQuery = supabase.from("colleges").select(`
            *,
            student_params(*)
          `)

        // Apply filters
        if (query) {
          supabaseQuery = supabaseQuery.ilike("name", `%${query}%`)
        }

        if (location && location !== "any") {
          if (location.startsWith("city:")) {
            const city = location.replace("city:", "")
            supabaseQuery = supabaseQuery.eq("city", city.toLowerCase())
          } else if (location.startsWith("state:")) {
            const state = location.replace("state:", "")
            supabaseQuery = supabaseQuery.eq("state", state.toLowerCase())
          }
        }

        if (duration && duration !== "0-4") {
          const durationMap: Record<string, string> = {
            "0-2": "2 years",
            "0-3": "3 years",
            "0-4": "4 years",
          }
          supabaseQuery = supabaseQuery.eq("duration", durationMap[duration] || duration)
        }

        const { data, error } = await supabaseQuery

        if (error) {
          console.error("Error fetching colleges:", error)
          setColleges([])
        } else {
          // Transform data to match College interface
          const transformedData = data.map((college) => {
            const studentParams = college.student_params?.[0] || {}

            return {
              id: college.id,
              CollegeCode: college.CollegeCode || "N/A",
              collegeName: college.collegeName || "Unknown college",
              State: college.State || "Unknown state",
              District: college.District || "Unknown district",
              // Student parameters
              oc: college.oc || "N/A",
              instituteName: college.instituteName || "Unknown Institute",
              avgMedianSalary: college.avgMedianSalary || 0,
              avgPlacementPercentage: college.avgPlacementPercent || 0,
              avgPassingPercentage: college.avgPassingPercent || 0,
              avgHigherStudiesPercentage: college.avgHigherStudiesPercent || 0,
              avgScholarshipPercentage: college.avgScholarshipsPercent || 0,
              totalIntake: college.totalIntake || "N/A",
              avgSeatsFilled: college.avgSeatsFilledPercent || 0,
              avgWomenStudents: college.avgWomenStudentsPercent || 0,
              avgOutsideStudents: college.avgOutsideStudentsPercent || 0,
              IdleOutputIndex: college.IdleOutputIndexPercent || 0,
              ocCutoff: college.ocCutoff || "N/A",
              PowerScore: college.PowerScore || 0,
            };
          });

          setColleges(transformedData);
        }
      } catch (error) {
        console.error("Error:", error)
        setColleges([])
      } finally {
        setLoading(false)
      }
    }

    fetchColleges()
  }, [query, location, duration, supabase])

  // Apply search term filter
  const filteredColleges = useMemo(() => {
    return colleges.filter((college) => college.collegeName.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [colleges, searchTerm])

  // Apply sorting
  const sortedColleges = useMemo(() => {
    return [...filteredColleges].sort((a, b) => {
      if (!sortColumn) return 0

      const aValue = a[sortColumn as keyof College]
      const bValue = b[sortColumn as keyof College]

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      return 0
    })
  }, [filteredColleges, sortColumn, sortDirection])

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

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 border-b">
        <div>
          <h2 className="text-xl font-semibold">Search Results</h2>
          <p className="text-muted-foreground">Showing colleges based on your preferences</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={goBack}
            className="font-medium transition-all hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            New Search
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="px-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filters:</span>
            </div>
            {isBasicSearch ? (
              <div className="bg-muted text-xs rounded-full px-3 py-1">Basic Search</div>
            ) : (
              <>
                {location && (
                  <div className="bg-muted text-xs rounded-full px-3 py-1">
                    {location === "any"
                      ? "Any Location"
                      : location.startsWith("city:")
                        ? `City: ${location.replace("city:", "").replace(/\b\w/g, (l) => l.toUpperCase())}`
                        : `State: ${location.replace("state:", "").replace(/\b\w/g, (l) => l.toUpperCase())}`}
                  </div>
                )}
                {duration && (
                  <div className="bg-muted text-xs rounded-full px-3 py-1">Duration: {getDurationLabel(duration)}</div>
                )}
                {selectedParameters.map((param) => (
                  <div key={param} className="bg-muted text-xs rounded-full px-3 py-1">
                    {getParameterLabel(param)}
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search colleges..."
              className="w-full sm:w-[250px] pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%] cursor-pointer" onClick={() => handleSort("name")}>
                    <div className="flex items-center">
                      College Name
                      {getSortIcon("name")}
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
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedColleges.length > 0 ? (
                  sortedColleges.map((college) => (
                    <TableRow key={college.CollegeCode}>
                      <TableCell className="font-medium">{college.collegeName}</TableCell>
                      {selectedParameters.map((param) => (
                        <TableCell key={param}>{formatValue(param, college[param as keyof College])}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3 + selectedParameters.length} className="h-24 text-center">
                      No colleges found matching your search term
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
