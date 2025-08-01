"use client"

import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin } from "lucide-react"

interface LocationSelectorProps {
  value: string
  onChange: (value: string) => void
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

export function LocationSelector({ value, onChange }: LocationSelectorProps) {
  const [locationType, setLocationType] = useState<"any" | "city" | "state" | "district">(
    value === "any"
      ? "any"
      : value.startsWith("city:")
        ? "city"
        : value.startsWith("state:")
          ? "state"
          : value.startsWith("district:")
            ? "district"
            : "any",
  )

  const [cityInput, setCityInput] = useState(value.startsWith("city:") ? value.replace("city:", "") : "")
  const [stateInput] = useState("Tamilnadu") // Fixed as Tamilnadu
  const [districtInput, setDistrictInput] = useState(
    value.startsWith("district:") ? value.replace("district:", "") : "All Districts",
  )

  const handleLocationTypeChange = (type: "any" | "city" | "state" | "district") => {
    setLocationType(type)

    if (type === "any") {
      onChange("any")
    } else if (type === "city" && cityInput) {
      onChange(`city:${cityInput}`)
    } else if (type === "state") {
      onChange(`state:${stateInput}`)
    } else if (type === "district") {
      onChange(`district:${districtInput}`)
    }
  }

  const handleCityChange = (city: string) => {
    setCityInput(city)
    if (city) {
      onChange(`city:${city}`)
    }
  }

  const handleDistrictChange = (district: string) => {
    setDistrictInput(district)
    if (district) {
      onChange(`district:${district}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1.5">
        <h3 className="text-lg font-semibold">Location</h3>
        <p className="text-sm text-muted-foreground">Select your preferred location</p>
      </div>

      <RadioGroup value={locationType} onValueChange={(value) => handleLocationTypeChange(value as any)}>
        <div className="flex flex-col space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="any" id="any-selector" />
            <Label htmlFor="any-selector" className="cursor-pointer">
              Any Location
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="district" id="district-selector" />
            <Label htmlFor="district-selector" className="cursor-pointer">
              Tamil Nadu District
            </Label>
            {locationType === "district" && (
              <div className="relative flex-1 ml-2">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Select value={districtInput} onValueChange={handleDistrictChange}>
                  <SelectTrigger className="pl-9">
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
            )}
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="city" id="city-selector" />
            <Label htmlFor="city-selector" className="cursor-pointer">
              City
            </Label>
            {locationType === "city" && (
              <div className="relative flex-1 ml-2">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter city name"
                  className="pl-9"
                  value={cityInput}
                  onChange={(e) => handleCityChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="state" id="state-selector" />
            <Label htmlFor="state-selector" className="cursor-pointer">
              State
            </Label>
            {locationType === "state" && (
              <div className="relative flex-1 ml-2">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="text" className="pl-9 bg-muted" value={stateInput} disabled={true} />
              </div>
            )}
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
