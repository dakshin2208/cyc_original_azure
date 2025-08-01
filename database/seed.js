import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Create Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// Sample data for colleges - you can add your own data here
const collegeData = []

// Function to seed the database
async function seedDatabase() {
  console.log("Starting database seeding...")

  if (collegeData.length === 0) {
    console.log("No college data to seed. Add your data to the collegeData array.")
    return
  }

  for (const college of collegeData) {
    // Insert college
    const { data: collegeData, error: collegeError } = await supabase
      .from("colleges")
      .insert({
        name: college.name,
        location: college.location,
        city: college.city,
        state: college.state,
        duration: college.duration,
      })
      .select()
      .single()

    if (collegeError) {
      console.error(`Error inserting college ${college.name}:`, collegeError)
      continue
    }

    console.log(`Inserted college: ${college.name} with ID: ${collegeData.id}`)

    // Insert student parameters
    const { error: studentError } = await supabase.from("student_params").insert({
      college_id: collegeData.id,
      placement: college.student_params.placement,
      salary: college.student_params.salary,
      students: college.student_params.students,
      female: college.student_params.female,
      male: college.student_params.male,
      scholarship: college.student_params.scholarship,
      phd: college.student_params.phd,
      expenses: college.student_params.expenses,
      projects: college.student_params.projects,
    })

    if (studentError) {
      console.error(`Error inserting student params for ${college.name}:`, studentError)
    } else {
      console.log(`Inserted student params for college: ${college.name}`)
    }
  }

  console.log("Database seeding completed!")
}

// Run the seed function
seedDatabase()
  .catch((error) => {
    console.error("Error seeding database:", error)
  })
  .finally(() => {
    console.log("Seed process finished")
    process.exit(0)
  })
