import { PathString } from "react-hook-form"
import { supabase } from "./supabase"

export interface College {
  id: number
  CollegeCode: string
  collegeName: string
  State: string
  District: string
  ocCutoff: number
  instituteName: string
  avgMedianSalary: string
  avgPlacementPercentage: string
  avgPassingPercentage: string
  avgHigherStudiesPercentage: string
  avgScholarshipPercentage: string
  totalIntake: number
  avgSeatsFilled: string
  avgWomenStudents: string
  avgOutsideStudents: string
  IdleOutputIndex: string // Changed from avgNONGraduated
  PowerScore: string
}

// Fallback college data
const fallbackColleges: College[] = [
  {
    id: 1,
    CollegeCode: "1234",
    collegeName: "PSG College of Technology",
    State: "tamil nadu",
    District:"coimbatore",
    ocCutoff: 199,
    instituteName: "PSG College of Technology [IR-E-C-37013]",
    avgMedianSalary: "₹ 683,336.00",
    avgPlacementPercentage: "74%",
    avgPassingPercentage: "93%",
    avgHigherStudiesPercentage: "8%",
    avgScholarshipPercentage: "20%",
    totalIntake: 3648,
    avgSeatsFilled: "107%",
    avgWomenStudents: "36%",
    avgOutsideStudents: "4%",
    IdleOutputIndex: "18%", // Changed from avgNONGraduated
    PowerScore: "18%", // Changed from avgNONGraduated
  },
  {
    id: 2,
    CollegeCode: "IR-E-C-50605",
    collegeName: "PSG Institute of Technology and Applied Research Neelambur Coimbatore 641062",
    State: "tamil nadu",
    District:"coimbatore",
    ocCutoff: 0,
    instituteName: "PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH [IR-E-C-50605]",
    avgMedianSalary: "₹ 550,000",
    avgPlacementPercentage: "90%",
    avgPassingPercentage: "93%",
    avgHigherStudiesPercentage: "15%",
    avgScholarshipPercentage: "30%",
    totalIntake: 1800,
    avgSeatsFilled: "95%",
    avgWomenStudents: "38%",
    avgOutsideStudents: "12%",
    IdleOutputIndex: "5%", // Changed from avgNONGraduated
    PowerScore: "18%", // Changed from avgNONGraduated
  },
  // Other fallback colleges would be here
]

// Helper functions for special college identification
export function isPSGCollege(college: College): boolean {
  return college.instituteName?.includes("PSG College of Technology [IR-E-C-37013]") || false
}

export function isPSGITAR(college: College): boolean {
  return college.instituteName?.includes("PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH [IR-E-C-50605]") || false
}

export function isVSBCollege(college: College): boolean {
  return college.collegeName?.includes("V S B College of Engineering Technical Campus") || false
}

export function isAdithyaInstitute(college: College): boolean {
  return (
    college.collegeName?.toLowerCase().includes("adithya institute") ||
    college.instituteName?.toLowerCase().includes("adithya institute") ||
    false
  )
}

// Update the processCollegeData function to ensure instituteName is always available
function processCollegeData(data: any[]): College[] {
  console.log("Processing college data from Supabase, count:", data.length)

  // Process the data to add flags for special colleges and extract codes
  return data.map((college) => {
    // Log the entire college object for debugging
    console.log("Processing college:", college)
    console.log("Available fields:", Object.keys(college))

    // Extract college code - ONLY from the "College Code" column
    let code: string = ""

    // Try the exact column name "College Code"
    if (college["College Code"] !== undefined) {
      code = college["College Code"]
      console.log("Found code in 'College Code' column:", code)
    }

    // If not found, try alternative capitalizations
    if (!code && college["COLLEGE CODE"] !== undefined) {
      code = college["COLLEGE CODE"]
      console.log("Found code in 'COLLEGE CODE' column:", code)
    }

    if (!code && college["college code"] !== undefined) {
      code = college["college code"]
      console.log("Found code in 'college code' column:", code)
    }

    if (!code && college["collegeCode"] !== undefined) {
      code = college["collegeCode"]
      console.log("Found code in 'collegeCode' column:", code)
    }

    // If still no code, use a placeholder
    if (!code) {
      code = "IR-NO-CODE"
      console.log("No college code found in 'College Code' column, using placeholder")
    }

    // Ensure college name and institute name are always available
    // Try all possible field names for college name
    let collegeName: string = ""
    if (college.collegeName && college.collegeName !== "null") collegeName = college.collegeName
    else if (college.name && college.name !== "null") collegeName = college.name
    else if (college["College Name"] && college["College Name"] !== "null") collegeName = college["College Name"]
    else if (college["COLLEGE NAME"] && college["COLLEGE NAME"] !== "null") collegeName = college["COLLEGE NAME"]

    // Try all possible field names for institute name
    let instituteName: string = ""
    if (college.instituteName && college.instituteName !== "null") instituteName = college.instituteName
    else if (college["Institute Name"] && college["Institute Name"] !== "null")
      instituteName = college["Institute Name"]
    else if (college["INSTITUTE NAME"] && college["INSTITUTE NAME"] !== "null")
      instituteName = college["INSTITUTE NAME"]
    else if (college["institute_name"] && college["institute_name"] !== "null")
      instituteName = college["institute_name"]

    // If instituteName is still null, use collegeName as fallback
    if ((!instituteName || instituteName === "null") && collegeName && collegeName !== "null") {
      instituteName = collegeName
      console.log("Using collegeName as fallback for instituteName:", instituteName)
    }

    // If collegeName is still null, use instituteName as fallback
    if ((!collegeName || collegeName === "null") && instituteName && instituteName !== "null") {
      collegeName = instituteName
      console.log("Using instituteName as fallback for collegeName:", collegeName)
    }

    // If both are still null or "null", create a placeholder
    if (!collegeName || collegeName === "null" || !instituteName || instituteName === "null") {
      const placeholder = `College #${college.id || "Unknown"}`
      if (!collegeName || collegeName === "null") {
        collegeName = placeholder
        console.log("Using placeholder for collegeName:", collegeName)
      }
      if (!instituteName || instituteName === "null") {
        instituteName = placeholder
        console.log("Using placeholder for instituteName:", instituteName)
      }
    }

    // Log the final values for debugging
    console.log("Final collegeName:", collegeName)
    console.log("Final instituteName:", instituteName)

    // Handle the field name change from avgGraduationOutcomes to avgNONGraduated
    const IdleOutputIndex = college.IdleOutputIndex || college.avgGraduationOutcomes || "";

    return {
      ...college,
      code,
      collegeName,
      instituteName,
      IdleOutputIndex,
      isPSGCollege: instituteName.includes("PSG College of Technology [IR-E-C-37013]") || false,
      isPSGITAR: instituteName.includes("PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH [IR-E-C-50605]") || false,
      isVSBCollege: collegeName.includes("V S B College of Engineering Technical Campus") || false,
      isAdithyaInstitute:
        collegeName.toLowerCase().includes("adithya institute") ||
        instituteName.toLowerCase().includes("adithya institute") ||
        false,
    }
  })
}

// Process fallback data
function processFallbackData(): College[] {
  console.warn("⚠️ USING FALLBACK DATA: Unable to fetch from Supabase")

  return fallbackColleges.map((college) => ({
    ...college,
    isPSGCollege: isPSGCollege(college),
    isPSGITAR: isPSGITAR(college),
    isVSBCollege: isVSBCollege(college),
    isAdithyaInstitute: isAdithyaInstitute(college),
  }))
}

// Main function to fetch colleges
export async function fetchColleges(): Promise<{
  colleges: College[]
  error: string | null
  usingFallback: boolean
}> {
  try {
    console.log("🔄 Attempting to fetch colleges from Supabase...")

    // Check if Supabase URL and key are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("❌ Supabase credentials are missing")
      return {
        colleges: processFallbackData(),
        error: "Supabase credentials are missing. Check your environment variables.",
        usingFallback: true,
      }
    }

    // First try a simple query to test the connection
    const testQuery = await supabase.from("colleges").select("count")

    if (testQuery.error) {
      console.error("❌ Test query failed:", testQuery.error.message)
      return {
        colleges: processFallbackData(),
        error: `Connection test failed: ${testQuery.error.message}`,
        usingFallback: true,
      }
    }

    console.log("✅ Test query successful, fetching full data...")

    // Now fetch the actual data
    const { data, error } = await supabase.from("colleges").select("*")

    // Handle errors
    if (error) {
      console.error("❌ Error fetching colleges:", error.message)
      return {
        colleges: processFallbackData(),
        error: `Failed to fetch colleges: ${error.message}`,
        usingFallback: true,
      }
    }

    // Handle empty data
    if (!data || data.length === 0) {
      console.warn("⚠️ No colleges found in the database")
      return {
        colleges: processFallbackData(),
        error: "No colleges found in the database. The table might be empty.",
        usingFallback: true,
      }
    }

    // Success!
    console.log("✅ Successfully fetched", data.length, "colleges from Supabase")
    console.log("Sample college:", data[0])

    return {
      colleges: processCollegeData(data),
      error: null,
      usingFallback: false,
    }
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("❌ Exception while fetching colleges:", errorMessage)

    return {
      colleges: processFallbackData(),
      error: `Exception: ${errorMessage}`,
      usingFallback: true,
    }
  }
}

// Helper functions for formatting and display
export function getParameterLabel(param: string): string {
  const paramMap: Record<string, string> = {
    collegeName: "College Name",
    oc: "OC",
    instituteName: "Institute Name",
    avgMedianSalary: "Avg. Median Salary",
    avgPlacementPercentage: "Avg. Placement %",
    avgPassingPercentage: "Avg. Passing %",
    avgHigherStudiesPercentage: "Avg. Higher Studies %",
    avgScholarshipPercentage: "Avg. Scholarships %",
    totalIntake: "Total Intake",
    avgSeatsFilled: "Avg. Seats Filled %",
    avgWomenStudents: "Avg. Women Students %",
    avgOutsideStudents: "Avg. Outside Students %",
    IdleOutputIndex: "Idle Output Index (IOI%)", // Changed from avgNONGraduated
  }
  return paramMap[param] || param
}

export function formatValue(param: string, value: any): string {
  if (value === undefined || value === null || value === "") {
    return "-"
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "" || trimmed === "N/A") {
      return "-"
    }
    return trimmed
  }

  if (typeof value === "number") {
    return value.toLocaleString()
  }

  return String(value)
}

export function getDurationLabel(durationValue: string): string {
  return durationValue
}
