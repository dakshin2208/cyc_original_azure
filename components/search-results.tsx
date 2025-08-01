"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ResultsPage } from "@/components/results-page"

interface SearchResultsProps {
  query: string
  location: string
  duration: string
  params: string
  isBasicSearch: boolean
}

export function SearchResults({ query, location, duration, params, isBasicSearch }: SearchResultsProps) {
  const [selectedParameters, setSelectedParameters] = useState<string[]>(params.split(",").filter(Boolean))

  // Update state when URL parameters change
  useEffect(() => {
    // Ensure we have valid parameters
    const paramArray = params ? params.split(",").filter(Boolean) : ["placement", "salary"]

    // Default to placement and salary if no parameters are provided
    setSelectedParameters(paramArray.length > 0 ? paramArray : ["placement", "salary"])
  }, [params])

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-0">
        <ResultsPage
          query={query}
          location={location}
          duration={duration}
          selectedParameters={selectedParameters}
          isBasicSearch={isBasicSearch}
        />
      </CardContent>
    </Card>
  )
}
