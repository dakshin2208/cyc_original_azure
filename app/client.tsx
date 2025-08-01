'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CategoryProvider } from "@/components/category-context"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function HomeClient() {
  const router = useRouter()

  // State for location
  const [district, setDistrict] = useState("Coimbatore")
  const duration = "Engineering"

  // List of Tamil Nadu districts
  const tamilNaduDistricts = [
    "All Districts",
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kancheepuram",
    "Kanyakumari",
    "Karur",
    "Krishnagiri",
    "Madurai",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Salem",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "The Nilgiris",
    "Theni",
    "Thirupattur",
    "Thoothukudi",
    "Tiruchirappalli",
    "Tirunelveli",
    "Tiruppur",
    "Thiruvallur",
    "Thiruvannamalai",
    "Thiruvarur",
    "Vellore",
    "Viluppuram",
    "Virudhunagar",
  ]

  const [parameters, setParameters] = useState({
    avgMedianSalary: true,
    avgPlacementPercentage: true,
    avgPassingPercentage: false,
    avgHigherStudiesPercentage: false,
    avgScholarshipPercentage: false,
    totalIntake: false,
    avgSeatsFilled: false,
    avgWomenStudents: false,
    avgOutsideStudents: false,
    IdleOutputIndex: false,
    ocCutoff: false,
    PowerScore: true,
  })

  // Count selected parameters
  const selectedCount = Object.values(parameters).filter(Boolean).length

  const handleParameterChange = (param: keyof typeof parameters) => {
    // If parameter is already selected, allow deselecting
    if (parameters[param]) {
      setParameters((prev) => ({
        ...prev,
        [param]: false,
      }))
      return
    }

    // If two parameters are already selected, don't allow selecting more
    if (selectedCount >= 2) {
      return
    }

    // Otherwise, select the parameter
    setParameters((prev) => ({
      ...prev,
      [param]: true,
    }))
  }

  const handleSearch = () => {
    const selectedParams = Object.entries(parameters)
      .filter(([_, isSelected]) => isSelected)
      .map(([param]) => param)
      .join(",")

    const params = new URLSearchParams()
    params.append("location", `district:${district}`)
    params.append("duration", duration)
    params.append("params", selectedParams)

    router.push(`/results?${params.toString()}`)
  }

  return (
    <CategoryProvider>
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <Header />
        <main className="flex-1 flex flex-col items-center p-4 md:p-8">
          <div className="w-full max-w-3xl mx-auto space-y-8 pt-12">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0B5588]">ChooseYourCollege.com</h1>
              <p className="text-gray-400 text-lg">Find the perfect college based on your preferences</p>
              <p className="text-gray-500 text-sm mt-4">
              If your college data is missing or wrong, please click on add college data & update it.
              </p>
            </div>

            <div className="space-y-8 mt-12">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-lg font-medium">State</Label>
                  <div className="h-12 px-4 flex items-center bg-muted border border-input rounded-md">Tamilnadu</div>
                  <p className="text-sm text-gray-500">State is fixed to Tamilnadu</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-lg font-medium">District</Label>
                  <Select value={district} onValueChange={setDistrict}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select a district" />
                    </SelectTrigger>
                    <SelectContent>
                      {tamilNaduDistricts.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">Select a district in Tamilnadu</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-lg font-medium">Duration</Label>
                <div className="h-12 px-4 flex items-center bg-muted border border-input rounded-md">{duration}</div>
                <p className="text-sm text-gray-500">Default program set to Engineering</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Search Parameters</h3>
                  <span className="text-sm text-gray-400">Select up to 2 parameters</span>
                </div>

                {selectedCount === 2 && (
                  <Alert variant="custom">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You've selected 2 parameters. Uncheck one to change your selection.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgMedianSalary"
                      checked={parameters.avgMedianSalary}
                      onCheckedChange={() => handleParameterChange("avgMedianSalary")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgMedianSalary}
                    />
                    <div>
                      <Label
                        htmlFor="avgMedianSalary"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgMedianSalary ? "text-gray-500" : ""}`}
                      >
                        Median Salary
                      </Label>
                      <p className="text-sm text-gray-400">Last 3 years median salary</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgPlacementPercentage"
                      checked={parameters.avgPlacementPercentage}
                      onCheckedChange={() => handleParameterChange("avgPlacementPercentage")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgPlacementPercentage}
                    />
                    <div>
                      <Label
                        htmlFor="avgPlacementPercentage"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgPlacementPercentage ? "text-gray-500" : ""}`}
                      >
                        Placement %
                      </Label>
                      <p className="text-sm text-gray-400">Last 3 years placement percentage</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgPassingPercentage"
                      checked={parameters.avgPassingPercentage}
                      onCheckedChange={() => handleParameterChange("avgPassingPercentage")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgPassingPercentage}
                    />
                    <div>
                      <Label
                        htmlFor="avgPassingPercentage"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgPassingPercentage ? "text-gray-500" : ""}`}
                      >
                        Passing %
                      </Label>
                      <p className="text-sm text-gray-400">Last 3 years passing percentage</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgHigherStudiesPercentage"
                      checked={parameters.avgHigherStudiesPercentage}
                      onCheckedChange={() => handleParameterChange("avgHigherStudiesPercentage")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgHigherStudiesPercentage}
                    />
                    <div>
                      <Label
                        htmlFor="avgHigherStudiesPercentage"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgHigherStudiesPercentage ? "text-gray-500" : ""}`}
                      >
                        Higher Studies %
                      </Label>
                      <p className="text-sm text-gray-400">Last 3 years students who went to higher studies</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgScholarshipPercentage"
                      checked={parameters.avgScholarshipPercentage}
                      onCheckedChange={() => handleParameterChange("avgScholarshipPercentage")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgScholarshipPercentage}
                    />
                    <div>
                      <Label
                        htmlFor="avgScholarshipPercentage"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgScholarshipPercentage ? "text-gray-500" : ""}`}
                      >
                        Scholarships %
                      </Label>
                      <p className="text-sm text-gray-400">Last 3 years students who received scholarships</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="totalIntake"
                      checked={parameters.totalIntake}
                      onCheckedChange={() => handleParameterChange("totalIntake")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.totalIntake}
                    />
                    <div>
                      <Label
                        htmlFor="totalIntake"
                        className={`font-medium ${selectedCount >= 2 && !parameters.totalIntake ? "text-gray-500" : ""}`}
                      >
                        Total Intake
                      </Label>
                      <p className="text-sm text-gray-400">Total sanctioned intake of last 4 years</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgSeatsFilled"
                      checked={parameters.avgSeatsFilled}
                      onCheckedChange={() => handleParameterChange("avgSeatsFilled")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgSeatsFilled}
                    />
                    <div>
                      <Label
                        htmlFor="avgSeatsFilled"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgSeatsFilled ? "text-gray-500" : ""}`}
                      >
                        Seats Filled %
                      </Label>
                      <p className="text-sm text-gray-400">percentage of students admitted vs intake approved</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgWomenStudents"
                      checked={parameters.avgWomenStudents}
                      onCheckedChange={() => handleParameterChange("avgWomenStudents")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgWomenStudents}
                    />
                    <div>
                      <Label
                        htmlFor="avgWomenStudents"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgWomenStudents ? "text-gray-500" : ""}`}
                      >
                        Female Students %
                      </Label>
                      <p className="text-sm text-gray-400">Percentage of female students studying</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="avgOutsideStudents"
                      checked={parameters.avgOutsideStudents}
                      onCheckedChange={() => handleParameterChange("avgOutsideStudents")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.avgOutsideStudents}
                    />
                    <div>
                      <Label
                        htmlFor="avgOutsideStudents"
                        className={`font-medium ${selectedCount >= 2 && !parameters.avgOutsideStudents ? "text-gray-500" : ""}`}
                      >
                        Outside Students %
                      </Label>
                      <p className="text-sm text-gray-400">Percentage of students from outside states & country</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="IdleOutputIndex"
                      checked={parameters.IdleOutputIndex}
                      onCheckedChange={() => handleParameterChange("IdleOutputIndex")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.IdleOutputIndex}
                    />
                    <div>
                      <Label
                        htmlFor="IdleOutputIndex"
                        className={`font-medium ${selectedCount >= 2 && !parameters.IdleOutputIndex ? "text-gray-500" : ""}`}
                      >
                        IOI (IdleOutputIndex) %
                      </Label>
                      <p className="text-sm text-gray-400">Percentage of students who do nothing after studying in this college(No job, No higher studies)</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="ocCutoff"
                      checked={parameters.ocCutoff}
                      onCheckedChange={() => handleParameterChange("ocCutoff")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.ocCutoff}
                    />
                    <div>
                      <Label
                        htmlFor="ocCutoff"
                        className={`font-medium ${selectedCount >= 2 && !parameters.ocCutoff ? "text-gray-500" : ""}`}
                      >
                        OC CSE Cutoff
                      </Label>
                      <p className="text-sm text-gray-400">Last year OC, CSE cutoff for comparision</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="PowerScore"
                      checked={parameters.PowerScore}
                      onCheckedChange={() => handleParameterChange("PowerScore")}
                      className="mt-1"
                      disabled={selectedCount >= 2 && !parameters.PowerScore}
                    />
                    <div>
                      <Label
                        htmlFor="PowerScore"
                        className={`font-medium ${selectedCount >= 2 && !parameters.PowerScore ? "text-gray-500" : ""}`}
                      >
                        Power Score
                      </Label>
                      <p className="text-sm text-gray-400">Overall college performance score based on multiple parameters</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSearch}
                className="w-full h-12 text-lg"
                disabled={selectedCount === 0}
              >
                Search Colleges
              </Button>
            </div>

            <div className="w-full max-w-3xl mx-auto space-y-8 mt-16 mb-12">
              <div className="border-t-2 border-gray-300 dark:border-gray-700 my-12"></div>
              <h2 className="text-3xl font-bold text-center mb-8 text-[#0B5588]">Frequently Asked Questions</h2>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="data-source">
                  <AccordionTrigger className="text-base font-medium">
                    From where did you get this data?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    The data presented on this site is extracted from publicly available NIRF (National Institutional Ranking Framework) reports published by the Government of India. It is government-approved and openly accessible.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="website-purpose">
                  <AccordionTrigger className="text-base font-medium">
                    What is the purpose of this website?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    This platform helps students make informed decisions about college selection by providing comprehensive data on various parameters like placement rates, median salary, and academic performance. We aim to simplify the college selection process with data-driven insights.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="college-data-visibility">
                  <AccordionTrigger className="text-base font-medium">
                    Why are all colleges data not visible?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    Only 320 odd colleges out of 431 colleges in Tamil Nadu have ever applied for NIRF. So the ones who've not applied - we don't have the data. Some colleges have applied for NIRF but didn't follow the norms of updating the data on their website. So we have not updated them. If you find any college data is missing, you can inform the management to add college data and we will update it.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="data-accuracy">
                  <AccordionTrigger className="text-base font-medium">
                    How accurate is the data?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    Our data is sourced directly from official NIRF reports and is updated annually. While we strive for accuracy, we recommend cross-verifying critical information with the respective institutions.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="filtering-system">
                  <AccordionTrigger className="text-base font-medium">
                    How does the filtering system work?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    You can select up to two parameters to filter colleges based on your priorities. The system will rank colleges according to your selected criteria, helping you find institutions that best match your preferences.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contribute">
                  <AccordionTrigger className="text-base font-medium">
                    Can I contribute or update college information?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    Yes! If you notice any missing or incorrect data, you can use the "Add College Data" feature to submit updates. We review all submissions to maintain data quality.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cutoff-prediction">
                  <AccordionTrigger className="text-base font-medium">
                    How can I predict my chances of getting into a college?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    You can use our cutoff rank prediction feature to estimate your chances of admission based on previous years' data. This tool considers factors like your rank, category, and the college's historical cutoff trends.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="scholarship-info">
                  <AccordionTrigger className="text-base font-medium">
                    How do I find information about scholarships?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    Each college's profile includes information about scholarship percentages and opportunities. You can also filter colleges based on their scholarship offerings to find institutions that best match your financial needs.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="placement-data">
                  <AccordionTrigger className="text-base font-medium">
                    What placement information is available?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    We provide detailed placement statistics including median salary, placement percentage, and the number of companies visiting. This data is averaged over the last three years to give you a comprehensive view of the college's placement record.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="higher-studies">
                  <AccordionTrigger className="text-base font-medium">
                    How can I find colleges with good higher studies opportunities?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    You can filter colleges based on their higher studies percentage, which shows how many students pursue further education after graduation. This helps you identify institutions that provide strong academic foundations for advanced studies.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="data-updates">
                  <AccordionTrigger className="text-base font-medium">
                    How often is the data updated?
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    Our data is updated annually based on the latest NIRF reports. Additionally, we regularly update specific information like cutoff ranks and placement statistics as new data becomes available from the institutions.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </CategoryProvider>
  )
} 