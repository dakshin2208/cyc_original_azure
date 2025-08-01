import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Add College Data - ChooseYourCollege.com",
  description: "Submit your college's NIRF data to be included in our database",
}

export default function AddCollegeDataLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
