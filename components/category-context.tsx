"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { UserCategory } from "@/components/user-category-selector"

interface CategoryContextType {
  category: UserCategory
  setCategory: (category: UserCategory) => void
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<UserCategory>("student")

  return <CategoryContext.Provider value={{ category, setCategory }}>{children}</CategoryContext.Provider>
}

export function useCategory() {
  const context = useContext(CategoryContext)
  if (context === undefined) {
    throw new Error("useCategory must be used within a CategoryProvider")
  }
  return context
}
