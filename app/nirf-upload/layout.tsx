import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "NIRF Upload - ChooseYourCollege.com",
  description: "Submit your college's NIRF data to be included in our database",
}

export default function AddCollegeDataLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
