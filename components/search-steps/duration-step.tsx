"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface DurationStepProps {
  duration: string
  setDuration: (duration: string) => void
}

export function DurationStep({ duration, setDuration }: DurationStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Degree Duration</h2>
        <p className="text-muted-foreground mb-6">Choose the duration of the degree program you're interested in</p>
      </div>

      <RadioGroup value={duration} onValueChange={setDuration} className="grid gap-4">
        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="0-2" id="duration-0-2" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="duration-0-2" className="text-base">
              0-2 Years
            </Label>
            <p className="text-sm text-muted-foreground">Certificate, Associate, and short-term programs</p>
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="0-3" id="duration-0-3" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="duration-0-3" className="text-base">
              0-3 Years
            </Label>
            <p className="text-sm text-muted-foreground">Includes Bachelor's programs and advanced diplomas</p>
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0">
          <RadioGroupItem value="0-4" id="duration-0-4" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="duration-0-4" className="text-base">
              0-4 Years
            </Label>
            <p className="text-sm text-muted-foreground">Includes all undergraduate and some graduate programs</p>
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
