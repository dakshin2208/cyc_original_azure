import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface ParametersStepProps {
  selectedParameters: string[]
  setSelectedParameters: (parameters: string[]) => void
}

export function ParametersStep({ selectedParameters, setSelectedParameters }: ParametersStepProps) {
  const parameters = [
    { id: "placement", label: "Placement Percentage" },
    { id: "salary", label: "Median Salary" },
    { id: "students", label: "Total Student Strength" },
    { id: "female", label: "Female Strength" },
    { id: "male", label: "Male Strength" },
    { id: "scholarship", label: "Scholarship Availability" },
    { id: "phd", label: "PhD Strength" },
    { id: "expenses", label: "Overall Expenses" },
    { id: "projects", label: "Project Opportunities" },
    { id: "PowerScore", label: "Power Score" },
  ]

  const handleParameterChange = (checked: boolean, parameter: string) => {
    if (checked) {
      if (selectedParameters.length < 2) {
        setSelectedParameters([...selectedParameters, parameter])
      }
    } else {
      setSelectedParameters(selectedParameters.filter((p) => p !== parameter))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Select Parameters</h2>
        <p className="text-muted-foreground mb-2">Choose two important parameters to compare colleges</p>

        {selectedParameters.length === 2 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>You've selected 2 parameters. Uncheck one to change your selection.</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {parameters.map((parameter) => (
          <div key={parameter.id} className="flex items-center space-x-3 space-y-0">
            <Checkbox
              id={parameter.id}
              checked={selectedParameters.includes(parameter.id)}
              onCheckedChange={(checked) => handleParameterChange(checked as boolean, parameter.id)}
              disabled={selectedParameters.length === 2 && !selectedParameters.includes(parameter.id)}
            />
            <Label htmlFor={parameter.id} className="text-base font-normal">
              {parameter.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  )
}
