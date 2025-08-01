"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ResultsPage } from "@/components/results-page"
import { useState, useEffect } from "react"

interface SearchResultsWrapperProps {
  query: string
  location: string
  duration: string
  params: string
  isBasicSearch: boolean
}

export function SearchResultsWrapper({ query, location, duration, params, isBasicSearch }: SearchResultsWrapperProps) {
  const [selectedParameters, setSelectedParameters] = useState<string[]>([])

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
