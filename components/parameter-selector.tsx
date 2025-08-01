"use client"
import { Info, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ParameterSelectorProps {
  selectedParameters: string[]
  onChangeAction: (parameters: string[]) => void
}

export function ParameterSelector({ selectedParameters, onChangeAction }: ParameterSelectorProps) {
  // Define parameters based on user category
  const parameters = {
    student: [
      { id: "placement", label: "Placement Percentage", description: "Percentage of students placed in jobs" },
      { id: "salary", label: "Median Salary", description: "Median salary offered to students" },
      { id: "students", label: "Total Student Strength", description: "Total number of students enrolled" },
      { id: "female", label: "Female Strength", description: "Number of female students" },
      { id: "male", label: "Male Strength", description: "Number of male students" },
      { id: "scholarship", label: "Scholarship Availability", description: "Availability of scholarships for students" },
      { id: "phd", label: "PhD Strength", description: "Number of PhD students enrolled" },
      { id: "expenses", label: "Overall Expenses", description: "Total expenses for the program" },
      { id: "projects", label: "Project Opportunities", description: "Opportunities for student projects" },
      { id: "IdleOutputIndex", label: "Idle Output Index (IOI%)", description: "Idle Output Index percentage" },
      { id: "PowerScore", label: "Power Score", description: "Overall college performance score based on multiple parameters" },
    ],
  }

  const toggleParameter = (parameterId: string) => {
    if (selectedParameters.includes(parameterId)) {
      // Allow deselecting
      onChangeAction(selectedParameters.filter((id) => id !== parameterId))
    } else if (selectedParameters.length < 2) {
      // Allow selecting if less than 2 parameters are selected
      onChangeAction([...selectedParameters, parameterId])
    }
    // Do nothing if trying to select a third parameter
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Important Parameters</h3>
          <p className="text-sm text-muted-foreground">Select up to 2 parameters that matter to you</p>
        </div>
        <span className="text-sm text-gray-400">{selectedParameters.length}/2 selected</span>
      </div>

      {selectedParameters.length === 2 && (
        <Alert variant="custom">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You've selected 2 parameters. Uncheck one to change your selection.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {parameters.student.map((param) => {
          const isSelected = selectedParameters.includes(param.id)
          const isDisabled = selectedParameters.length >= 2 && !isSelected

          return (
            <div
              key={param.id}
              className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                isDisabled
                  ? "border-gray-700 bg-gray-900 opacity-50 cursor-not-allowed"
                  : isSelected
                    ? "border-primary bg-primary/5 cursor-pointer"
                    : "border-border hover:border-primary/50 cursor-pointer"
              }`}
              onClick={() => !isDisabled && toggleParameter(param.id)}
            >
              <div className="flex items-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center mr-2 ${
                    isSelected ? "bg-primary" : "bg-muted"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className={isDisabled ? "text-gray-500" : ""}>{param.label}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Info className="h-4 w-4" />
                      <span className="sr-only">Info</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{param.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )
        })}
      </div>
    </div>
  )
}