"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserCategorySelector, type UserCategory } from "@/components/user-category-selector"
import { LocationSelector } from "@/components/location-selector"
import { DurationSelector } from "@/components/duration-selector"
import { ParameterSelector } from "@/components/parameter-selector"

interface AdvancedSearchProps {
  initialCategory?: UserCategory
  initialLocation?: string
  initialDuration?: string
  initialParameters?: string[]
  onSearch: (data: {
    category: UserCategory
    location: string
    duration: string
    parameters: string[]
  }) => void
}

interface ParameterSelectorProps {
  selectedParameters: string[]
  onParametersChange: (parameters: string[]) => void
}

export function AdvancedSearch({
  initialCategory = "student",
  initialLocation = "any",
  initialDuration = "0-4",
  initialParameters = ["placement", "salary"],
  onSearch,
}: AdvancedSearchProps) {
  const [category, setCategory] = useState<UserCategory>(initialCategory)
  const [location, setLocation] = useState(initialLocation)
  const [duration, setDuration] = useState(initialDuration)
  const [selectedParameters, setSelectedParameters] = useState<string[]>(initialParameters)

  const handleSearch = () => {
    onSearch({
      category,
      location,
      duration,
      parameters: selectedParameters,
    })
  }

  return (
    <div className="space-y-6">
      <UserCategorySelector value={category} onChange={setCategory} />

      <LocationSelector value={location} onChange={setLocation} />

      <DurationSelector value={duration} onChange={setDuration} />

      <ParameterSelector 
        selectedParameters={selectedParameters} 
        onChangeAction={setSelectedParameters} 
      />

      <div className="flex justify-end">
        <Button onClick={handleSearch} className="bg-primary text-primary-foreground hover:bg-primary/90">
          Apply Filters
        </Button>
      </div>
    </div>
  )
}
