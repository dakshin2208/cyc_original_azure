import { supabase } from "./supabase"

export type College = {
  CollegeCode: string
  collegeName: string
  ocCutoff: number
  avgMedianSalary: number
  avgPlacementPercentage: number
  avgPassingPercentage: number
  avgHigherStudiesPercentage: number
  avgScholarshipPercentage: number
  totalIntake: number
  avgSeatsFilled: number
  avgWomenStudents: number
  avgOutsideStudents: number
  IdleOutputIndex: number
  PowerScore: number
}

// Helper functions for formatting and display
export const getParameterLabel = (param: string): string => {
  const labels: { [key: string]: string } = {
    collegeName: "College Name",
    ocCutoff: "OC Cutoff",
    avgMedianSalary: "Average Median Salary",
    avgPlacementPercentage: "Average Placement %",
    avgPassingPercentage: "Average Passing %",
    avgHigherStudiesPercentage: "Higher Studies %",
    avgScholarshipPercentage: "Scholarship %",
    totalIntake: "Total Intake",
    avgSeatsFilled: "Average Seats Filled",
    avgWomenStudents: "Women Students %",
    avgOutsideStudents: "Outside Students %",
    IdleOutputIndex: "Idle Output Index",
    PowerScore: "Power Score"
  }
  return labels[param] || param
}

// Update the formatValue function to better handle missing data
export function formatValue(param: string, value: any): string {
  // Handle undefined, null, or empty values
  if (value === undefined || value === null || value === "") {
    return "-"
  }

  // Convert value to string if it's not already
  const strValue = String(value).trim()

  // If the string is empty after trimming, return a dash
  if (strValue === "") {
    return "-"
  }

  return strValue
}

export function getDurationLabel(durationValue: string): string {
  return durationValue
}

// Process college data from Supabase
function processCollegeData(data: any[]): College[] {
  console.log("Processing college data from Supabase, count:", data.length)

  // Process the data to add flags for special colleges
  return data.map((college) => ({
    ...college,
    isPSGCollege: college.instituteName?.includes("PSG College of Technology [IR-E-C-37013]") || false,
    isPSGITAR:
      college.instituteName?.includes("PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH [IR-E-C-50605]") || false,
    isVSBCollege: college.collegeName?.includes("V S B College of Engineering Technical Campus") || false,
    isAdithyaInstitute:
      college.collegeName?.toLowerCase().includes("adithya institute") ||
      college.instituteName?.toLowerCase().includes("adithya institute") ||
      false,
  }))
}


