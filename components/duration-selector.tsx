"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface DurationSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function DurationSelector({ value, onChange }: DurationSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1.5">
        <h3 className="text-lg font-semibold">Degree Duration</h3>
        <p className="text-sm text-muted-foreground">Select your preferred course duration</p>
      </div>

      <RadioGroup value={value} onValueChange={onChange}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-all">
            <RadioGroupItem value="0-2" id="duration-2" className="mt-1" />
            <div>
              <Label htmlFor="duration-2" className="font-medium cursor-pointer">
                2 Years
              </Label>
              <p className="text-sm text-muted-foreground mt-1">Example: MBA, MA, MSc</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-all">
            <RadioGroupItem value="0-3" id="duration-3" className="mt-1" />
            <div>
              <Label htmlFor="duration-3" className="font-medium cursor-pointer">
                3 Years
              </Label>
              <p className="text-sm text-muted-foreground mt-1">Example: BBA, BA, BSc</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-all">
            <RadioGroupItem value="0-4" id="duration-4" className="mt-1" />
            <div>
              <Label htmlFor="duration-4" className="font-medium cursor-pointer">
                4 Years
              </Label>
              <p className="text-sm text-muted-foreground mt-1">Example: BTech, BE, BArch</p>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
