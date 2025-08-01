"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { UserCategorySelector } from "@/components/user-category-selector"
import { LocationSelector } from "@/components/location-selector"
import { DurationSelector } from "@/components/duration-selector"
import { ParameterSelector } from "@/components/parameter-selector"
import type { UserCategory } from "@/components/user-category-selector"

interface SearchFormProps {
  initialQuery?: string
  initialCategory?: UserCategory
  initialLocation?: string
  initialDuration?: string
  initialParameters?: string[]
  onSearchAction: (data: {
    query: string
    category: UserCategory
    location: string
    duration: string
    parameters: string[]
    isBasic: boolean
  }) => void
}

export function SearchForm({
  initialQuery = "",
  initialCategory = "student",
  initialLocation = "any",
  initialDuration = "0-4",
  initialParameters = ["placement", "salary"],
  onSearchAction,
}: SearchFormProps) {
  const [query, setQuery] = useState(initialQuery)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [category, setCategory] = useState<UserCategory>(initialCategory)
  const [location, setLocation] = useState(initialLocation)
  const [duration, setDuration] = useState(initialDuration)
  const [selectedParameters, setSelectedParameters] = useState<string[]>(initialParameters)

  const handleBasicSearch = () => {
    onSearchAction({
      query,
      category,
      location: "any",
      duration: "0-4",
      parameters: ["placement", "salary"],
      isBasic: true,
    })
  }

  const handleAdvancedSearch = () => {
    onSearchAction({
      query,
      category,
      location,
      duration,
      parameters: selectedParameters,
      isBasic: false,
    })
  }
  
  return (
    <div className="space-y-6 bg-card p-6 rounded-lg border shadow-sm">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for colleges, courses, or keywords..."
            className="pl-10 h-12"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (showAdvanced) {
                  handleAdvancedSearch()
                } else {
                  handleBasicSearch()
                }
              }
            }}
          />
        </div>

        <div className="flex justify-between items-center">
          <Button variant="link" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm font-medium">
            {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
          </Button>

          <Button onClick={handleBasicSearch} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Search
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <div className="space-y-6 pt-4 border-t">
          <UserCategorySelector value={category} onChange={setCategory} />

          <LocationSelector value={location} onChange={setLocation} />

          <DurationSelector value={duration} onChange={setDuration} />

          <ParameterSelector selectedParameters={selectedParameters} onChangeAction={setSelectedParameters} />

          <div className="flex justify-end">
            <Button onClick={handleAdvancedSearch} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Search with Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
