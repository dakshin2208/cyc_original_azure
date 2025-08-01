"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ResultsTable } from "@/components/results-table"
import type { UserCategory } from "@/components/user-category-selector"

interface SearchResultsClientProps {
  query: string
  category: string
  location: string
  duration: string
  params: string
  isBasicSearch: boolean
}

export function SearchResultsClient({
  query,
  category,
  location,
  duration,
  params,
  isBasicSearch,
}: SearchResultsClientProps) {
  const [selectedParameters, setSelectedParameters] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ensure we have valid parameters
    const paramArray = params ? params.split(",").filter(Boolean) : []

    // Set parameters based on category if none are provided
    let defaultParams: string[] = []
    if (category === "student") {
      defaultParams = ["placement", "salary"]
    } else if (category === "staff") {
      defaultParams = ["staffSpend", "phdStaffRatio"]
    } else if (category === "corporate") {
      defaultParams = ["placementRate", "consultancyProjects"]
    } else {
      // Default to student parameters if category is invalid
      defaultParams = ["placement", "salary"]
    }

    setSelectedParameters(paramArray.length > 0 ? paramArray : defaultParams)

    // Simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [params, category])

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <ResultsTable
          query={query}
          location={location}
          duration={duration}
          selectedParameters={selectedParameters} // Passed OC Cutoff to ResultsTable
          isBasicSearch={isBasicSearch}
          loading={loading}
        />
      </CardContent>
    </Card>
  )
}
