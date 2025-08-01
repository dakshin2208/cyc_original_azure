"use client"

import { GraduationCap } from "lucide-react"
import { useCategory } from "@/components/category-context"

// Update the UserCategory type to only include "student"
export type UserCategory = "student"

// Update the component to only show the student option and handle missing onChange
export function UserCategorySelector({
  value,
  onChange,
}: {
  value?: UserCategory
  onChange?: (value: UserCategory) => void
}) {
  // Use the context to handle the case when onChange is not provided
  const { category, setCategory } = useCategory()

  // Use the provided value or fall back to context
  const currentValue = value ?? category

  // Handle the click with a fallback to context if onChange is not provided
  const handleClick = () => {
    if (typeof onChange === "function") {
      onChange("student")
    } else {
      // Use the context as fallback
      setCategory("student")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1.5">
        <h3 className="text-lg font-semibold">I am a</h3>
        <p className="text-sm text-muted-foreground">Select your category</p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div
          className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all ${
            currentValue === "student"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/50 hover:bg-primary/5"
          }`}
          onClick={handleClick}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">Student/Parent</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">Looking for colleges for myself or my child</p>
        </div>
      </div>
    </div>
  )
}
