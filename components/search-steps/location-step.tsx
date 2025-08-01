"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"

interface LocationStepProps {
  location: string
  setLocation: (location: string) => void
}

// List of Tamil Nadu districts
const tamilNaduDistricts = [
  "All Districts",
  "Ariyalur",
  "Chengalpattu",
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Kallakurichi",
  "Kancheepuram",
  "Kanyakumari",
  "Karur",
  "Krishnagiri",
  "Madurai",
  "Mayiladuthurai",
  "Nagapattinam",
  "Namakkal",
  "Perambalur",
  "Pudukkottai",
  "Ramanathapuram",
  "Ranipet",
  "Salem",
  "Sivaganga",
  "Tenkasi",
  "Thanjavur",
  "The Nilgiris",
  "Theni",
  "Thirupattur",
  "Thoothukudi",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tiruppur",
  "Thiruvallur",
  "Thiruvannamalai",
  "Thiruvarur",
  "Vellore",
  "Viluppuram",
  "Virudhunagar",
]

export function LocationStep({ location, setLocation }: LocationStepProps) {
  const [locationType, setLocationType] = useState<"city" | "state" | "district" | "any">(
    location === "any"
      ? "any"
      : location.startsWith("city:")
        ? "city"
        : location.startsWith("state:")
          ? "state"
          : location.startsWith("district:")
            ? "district"
            : "any",
  )

  const [cityValue, setCityValue] = useState(location.startsWith("city:") ? location.replace("city:", "") : "")
  const [stateValue] = useState("Tamilnadu") // Fixed as Tamilnadu
  const [districtValue, setDistrictValue] = useState(
    location.startsWith("district:") ? location.replace("district:", "") : "All Districts",
  )

  // Update the LocationStep component to properly handle reset
  useEffect(() => {
    // Reset internal state when location is reset from parent
    if (location === "") {
      setLocationType("any")
      setCityValue("")
      setDistrictValue("All Districts")
    }
  }, [location])

  const handleLocationTypeChange = (value: "city" | "state" | "district" | "any") => {
    setLocationType(value)
    if (value === "any") {
      setLocation("any")
    } else if (value === "city" && cityValue) {
      setLocation(`city:${cityValue}`)
    } else if (value === "state") {
      setLocation(`state:${stateValue}`)
    } else if (value === "district") {
      setLocation(`district:${districtValue}`)
    } else {
      setLocation("")
    }
  }

  const handleCityChange = (value: string) => {
    setCityValue(value)
    if (value) {
      setLocation(`city:${value}`)
    } else {
      setLocation("")
    }
  }

  const handleDistrictChange = (value: string) => {
    setDistrictValue(value)
    if (value) {
      setLocation(`district:${value}`)
    } else {
      setLocation("")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Location</h2>
        <p className="text-muted-foreground mb-6">Choose a location preference for your college search</p>
      </div>

      <RadioGroup value={locationType} onValueChange={handleLocationTypeChange} className="grid gap-4">
        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="any" id="any" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="any" className="text-base">
              Any Location
            </Label>
            <p className="text-sm text-muted-foreground">Show colleges from all locations</p>
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="district" id="district" />
          <div className="grid gap-1.5 leading-none w-full">
            <Label htmlFor="district" className="text-base">
              Tamil Nadu District
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Search for colleges in a specific district of Tamil Nadu
            </p>
            <Select value={districtValue} onValueChange={handleDistrictChange} disabled={locationType !== "district"}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a district" />
              </SelectTrigger>
              <SelectContent>
                {tamilNaduDistricts.map((district) => (
                  <SelectItem key={district} value={district}>
                    {district}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="city" id="city" />
          <div className="grid gap-1.5 leading-none w-full">
            <Label htmlFor="city" className="text-base">
              City
            </Label>
            <p className="text-sm text-muted-foreground mb-2">Search for colleges in a specific city</p>
            <Input
              type="text"
              placeholder="Enter city name"
              value={cityValue}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={locationType !== "city"}
              className="max-w-md"
            />
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="state" id="state" />
          <div className="grid gap-1.5 leading-none w-full">
            <Label htmlFor="state" className="text-base">
              State
            </Label>
            <p className="text-sm text-muted-foreground mb-2">Search for colleges in Tamil Nadu</p>
            <Input type="text" value={stateValue} disabled={true} className="max-w-md bg-muted" />
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
