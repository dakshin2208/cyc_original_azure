'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Loader2, ArrowRight, Download, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../contexts/AuthContext"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// Tamil Nadu reservation categories. These MUST match the values stored in
// rank_list.COMMUNITY and the category columns present in the "Rank" table.
const COMMUNITIES = ["OC", "BC", "BCM", "MBC", "MBCDNC", "MBCV", "SC", "SCA", "ST"]

// Rank-based match (this year): college by OC closing rank, with its OC closing cutoff.
interface CollegeResult {
  collegeCode: string
  collegeName: string
  branchName: string
  district: string
  ocRank: number
  closingCutoff: number | null
}

// Cutoff-based match (last year): college by the student's community closing cutoff.
interface CutoffResult {
  collegeCode: string
  collegeName: string
  branchName: string
  district: string
  closingCutoff: number
}

// Parse a rank value that may be stored as a string ("1,234") or a number.
function toRankNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/[^\d]/g, "")
  if (!digits) return null
  const n = parseInt(digits, 10)
  return isNaN(n) ? null : n
}

// Parse a cutoff mark that may be stored as a string ("195.5") or a number.
function toCutoffNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = parseFloat(String(value).replace(/[^\d.]/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function RankPredictorClient() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [generalRank, setGeneralRank] = useState("")
  const [community, setCommunity] = useState("")
  const [communityRank, setCommunityRank] = useState("")
  const [cutoff, setCutoff] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [results, setResults] = useState<CollegeResult[] | null>(null)
  const [cutoffResults, setCutoffResults] = useState<CutoffResult[] | null>(null)

  // ---- Require login: send unauthenticated users to /login ----
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  // Persist the submitted form details via the server-side API route. Best-effort:
  // any failure is logged but never surfaced to the user or blocks the results.
  async function storeSubmission(payload: {
    name: string
    phone: string
    generalRank: number
    community: string
    communityRank: number
    cutoff: number
  }) {
    try {
      await fetch("/api/rank-predictor-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
        }),
      })
    } catch (err) {
      console.error("Failed to store rank predictor submission:", err)
    }
  }

  // Fetch every row from the "Rank" table, paging past Supabase's 1000-row cap.
  async function fetchAllRankRows() {
    const pageSize = 1000
    let from = 0
    const rows: any[] = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("Rank")
        .select("*")
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message || "Failed to fetch college data")
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return rows
  }

  // Fetch every row from the "Cutoff" table (last year's closing cutoffs),
  // paging past Supabase's 1000-row cap.
  async function fetchAllCutoffRows() {
    const pageSize = 1000
    let from = 0
    const rows: any[] = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("Cutoff")
        .select("*")
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message || "Failed to fetch cutoff data")
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return rows
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage("")
    setResults(null)
    setCutoffResults(null)

    // ---- Basic field validation ----
    if (!name.trim()) return setErrorMessage("Please enter your name.")
    if (!/^\d{10}$/.test(phone)) return setErrorMessage("Please enter a valid 10-digit phone number.")
    if (!community) return setErrorMessage("Please select your community.")

    const generalRankNum = toRankNumber(generalRank)
    const communityRankNum = toRankNumber(communityRank)
    if (generalRankNum === null || generalRankNum < 1) return setErrorMessage("Please enter a valid general rank.")
    if (communityRankNum === null || communityRankNum < 1) return setErrorMessage("Please enter a valid community rank.")

    const cutoffNum = parseFloat(cutoff)
    if (!Number.isFinite(cutoffNum) || cutoffNum < 0 || cutoffNum > 200) {
      return setErrorMessage("Please enter a valid cutoff (0–200).")
    }

    setIsLoading(true)
    try {
      // ---- Step 1: validate the details against rank_list ----
      // All three of general rank, community and community rank must match a
      // single stored row. Filter by GENERAL RANK server-side (a narrow, uncapped
      // filter) so we never rely on Supabase's 1000-row page cap, then confirm
      // community and community rank in memory (robust to number/string storage).
      const { data: matches, error: validationError } = await supabase
        .from("rank_list")
        .select("*")
        .eq("GENERAL RANK", generalRankNum)

      if (validationError) {
        throw new Error(validationError.message || "Could not verify your details. Please try again.")
      }

      // All four details must match a single stored row: general rank (already
      // filtered server-side), community, community rank and the cutoff
      // (rank_list."AGGREGATE MARK").
      const matchedRow = (matches || []).find((row) => {
        const storedCommunity = String(row["COMMUNITY"] ?? "").trim().toUpperCase()
        if (storedCommunity !== community.toUpperCase()) return false

        const storedCommunityRank = toRankNumber(row["COMMUNITY RANK"])
        if (storedCommunityRank !== communityRankNum) return false

        const storedAggregate = toCutoffNumber(row["AGGREGATE MARK"])
        return storedAggregate !== null && Math.abs(storedAggregate - cutoffNum) <= 0.01
      })

      if (!matchedRow) {
        setErrorMessage(
          "We are connected to the TNEA portal data — only correct data will fetch the results. Please enter your correct data.",
        )
        setIsLoading(false)
        return
      }

      // Details are valid — store the submission in the database. Storage failures
      // must not break the user flow, so this is best-effort.
      void storeSubmission({
        name,
        phone: `+91${phone}`,
        generalRank: generalRankNum,
        community,
        communityRank: communityRankNum,
        cutoff: cutoffNum,
      })

      // ---- Step 2: fetch colleges for the given (general) rank ----
      // The general rank is matched against the "OC" column of the Rank table.
      const rankRows = await fetchAllRankRows()

      // Keep one representative branch-row per college — the branch whose OC
      // closing rank is nearest to the user's general rank.
      const bestByCollege = new Map<string, { row: any; oc: number }>()
      for (const row of rankRows) {
        const oc = toRankNumber(row["OC"])
        if (oc === null) continue
        const code = String(row["College Code"] ?? row["College Name"] ?? "").trim()
        if (!code) continue
        const existing = bestByCollege.get(code)
        if (!existing || Math.abs(oc - generalRankNum) < Math.abs(existing.oc - generalRankNum)) {
          bestByCollege.set(code, { row, oc })
        }
      }

      const reps = Array.from(bestByCollege.values())

      // "Above" the rank -> colleges with an OC closing rank better (<=) than the
      // user's rank; nearest first. Includes an exact match if present.
      const aboveList = reps
        .filter((r) => r.oc <= generalRankNum)
        .sort((a, b) => b.oc - a.oc)

      // "Below" the rank -> colleges with an OC closing rank larger than the
      // user's rank (safer choices); nearest first.
      const belowList = reps
        .filter((r) => r.oc > generalRankNum)
        .sort((a, b) => a.oc - b.oc)

      // Aim for 3 above + 2 below. If either side is short, back-fill from the
      // other side so we still return a total of 5 colleges when possible.
      const picked = [...aboveList.slice(0, 3), ...belowList.slice(0, 2)]
      if (picked.length < 5) {
        const leftovers = [...aboveList.slice(3), ...belowList.slice(2)].sort(
          (a, b) => Math.abs(a.oc - generalRankNum) - Math.abs(b.oc - generalRankNum),
        )
        for (const r of leftovers) {
          if (picked.length >= 5) break
          picked.push(r)
        }
      }

      // Order the rank picks best-first (used later when merging).
      picked.sort((a, b) => a.oc - b.oc)

      // ---- Step 3: cutoff-based colleges (last year's cutoff data) ----
      // Match the entered cutoff against the STUDENT'S COMMUNITY closing cutoff
      // in the Cutoff table (e.g. a BC student vs the "BC" column). Higher cutoff
      // = better: "above" = closing cutoff >= the student's (reach), "below" =
      // closing cutoff < the student's (safer). Aim for 2 above + 3 below (an
      // exact match falls into the "above" set).
      const cutoffRows = await fetchAllCutoffRows()
      const bestByCollegeCut = new Map<string, { row: any; cut: number }>()
      for (const row of cutoffRows) {
        const cut = toCutoffNumber(row[community])
        if (cut === null) continue
        const code = String(row["College Code"] ?? row["College Name"] ?? "").trim()
        if (!code) continue
        const existing = bestByCollegeCut.get(code)
        if (!existing || Math.abs(cut - cutoffNum) < Math.abs(existing.cut - cutoffNum)) {
          bestByCollegeCut.set(code, { row, cut })
        }
      }
      const cutReps = Array.from(bestByCollegeCut.values())
      const cutAbove = cutReps.filter((r) => r.cut >= cutoffNum).sort((a, b) => a.cut - b.cut)
      const cutBelow = cutReps.filter((r) => r.cut < cutoffNum).sort((a, b) => b.cut - a.cut)
      const cutPicked = [...cutAbove.slice(0, 2), ...cutBelow.slice(0, 3)]
      if (cutPicked.length < 5) {
        const leftovers = [...cutAbove.slice(2), ...cutBelow.slice(3)].sort(
          (a, b) => Math.abs(a.cut - cutoffNum) - Math.abs(b.cut - cutoffNum),
        )
        for (const r of leftovers) {
          if (cutPicked.length >= 5) break
          cutPicked.push(r)
        }
      }
      // Look up each college-branch's OC closing cutoff (from the Cutoff table)
      // so the rank-based "this year" table can show cutoff alongside OC rank.
      const norm = (s: unknown) => String(s ?? "").trim().toLowerCase()
      const ocCutoffByKey = new Map<string, number>()
      for (const row of cutoffRows) {
        const oc = toCutoffNumber(row["OC"])
        const code = String(row["College Code"] ?? "").trim()
        const branch = norm(row["Branch Name"])
        if (oc !== null && code && branch) ocCutoffByKey.set(`${code}||${branch}`, oc)
      }

      // Two independent lists, shown side by side for comparison.
      const chosen: CollegeResult[] = picked
        .sort((a, b) => a.oc - b.oc)
        .map((r) => {
          const code = String(r.row["College Code"] ?? "").trim()
          const branch = String(r.row["Branch Name"] ?? "").trim()
          return {
            collegeCode: code,
            collegeName: String(r.row["College Name"] ?? "").trim(),
            branchName: branch,
            district: String(r.row["District"] ?? "").trim(),
            ocRank: r.oc,
            closingCutoff: ocCutoffByKey.get(`${code}||${norm(branch)}`) ?? null,
          }
        })

      const cutChosen: CutoffResult[] = cutPicked
        .sort((a, b) => b.cut - a.cut)
        .map((r) => ({
          collegeCode: String(r.row["College Code"] ?? "").trim(),
          collegeName: String(r.row["College Name"] ?? "").trim(),
          branchName: String(r.row["Branch Name"] ?? "").trim(),
          district: String(r.row["District"] ?? "").trim(),
          closingCutoff: r.cut,
        }))

      setResults(chosen)
      setCutoffResults(cutChosen)
      if (chosen.length === 0 && cutChosen.length === 0) {
        setErrorMessage("No colleges found for the given rank or cutoff.")
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Build a PDF of the results, styled like the other exports on the site
  // (logo + chooseyourcollege.com header, blue separators, footer with page
  // numbers and timestamp).
  function generatePDF() {
    if ((!results || results.length === 0) && (!cutoffResults || cutoffResults.length === 0)) return

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height

    const addHeader = () => {
      // Logo on the left
      try {
        doc.addImage("/pdflogo.jpg", "JPEG", 15, 12, 26, 17)
      } catch (e) {
        // Logo missing — continue without it
      }

      // Website name
      doc.setTextColor(41, 128, 185)
      doc.setFontSize(24)
      doc.setFont("helvetica", "bold")
      const websiteName = "chooseyourcollege.com"
      const nameWidth = doc.getTextWidth(websiteName)
      doc.text(websiteName, (pageWidth - nameWidth) / 2, 22)

      // Title
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(15)
      doc.setFont("helvetica", "bold")
      const title = "College Predictor Results"
      const titleWidth = doc.getTextWidth(title)
      doc.text(title, (pageWidth - titleWidth) / 2, 31)

      // Separator line
      doc.setDrawColor(41, 128, 185)
      doc.setLineWidth(0.5)
      doc.line(15, 35, pageWidth - 15, 35)
    }

    const addFooter = (pageNumber: number, totalPages: number) => {
      doc.setDrawColor(41, 128, 185)
      doc.setLineWidth(0.5)
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20)

      doc.setTextColor(41, 128, 185)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("chooseyourcollege.com", 15, pageHeight - 12)

      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const pageText = `Page ${pageNumber} of ${totalPages}`
      const pageTextWidth = doc.getTextWidth(pageText)
      doc.text(pageText, (pageWidth - pageTextWidth) / 2, pageHeight - 12)

      doc.setFontSize(8)
      const stamp = new Date().toLocaleString()
      const stampWidth = doc.getTextWidth(stamp)
      doc.text(stamp, pageWidth - 15 - stampWidth, pageHeight - 12)
    }

    addHeader()

    // Applicant details line
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Name: ${name}`, 15, 44)
    doc.text(`Phone: +91${phone}`, pageWidth - 15 - doc.getTextWidth(`Phone: +91${phone}`), 44)
    doc.text(
      `General Rank: ${generalRank}    Community: ${community}    Community Rank: ${communityRank}`,
      15,
      50,
    )

    // Two tables, one below the other.
    const commonStyles = { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" as const, halign: "left" as const, font: "helvetica" }
    const commonCols = {
      0: { cellWidth: 9 },
      1: { cellWidth: 15 },
      2: { cellWidth: 60 },
      3: { cellWidth: 40 },
      4: { cellWidth: 24 },
      5: { cellWidth: 32 },
    }
    const commonHead = {
      fillColor: [11, 85, 136] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      fontSize: 8,
    }

    let y = 56
    const sectionTitle = (text: string) => {
      doc.setTextColor(11, 85, 136)
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      const lines = doc.splitTextToSize(text, pageWidth - 30) as string[]
      lines.forEach((line, i) => doc.text(line, 15, y + i * 4.5))
      y += lines.length * 4.5 + 1
    }

    // Table 1 — previous year (cutoff-based)
    sectionTitle("College's that the students got for their Rank in the previous year")
    autoTable(doc, {
      startY: y,
      head: [["#", "Code", "College", "Branch", "District", "Closing Cutoff"]],
      body: (cutoffResults ?? []).map((r, i) => [
        (i + 1).toString(),
        r.collegeCode || "-",
        r.collegeName || "-",
        r.branchName || "-",
        r.district || "-",
        r.closingCutoff.toString(),
      ]),
      styles: commonStyles,
      columnStyles: commonCols,
      headStyles: commonHead,
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 15, right: 15, top: 40, bottom: 25 },
      theme: "grid",
    })
    y = (doc as any).lastAutoTable.finalY + 10

    // Table 2 — this year (rank-based), with OC closing cutoff alongside the rank
    sectionTitle("College's that you might get for your Rank this year")
    autoTable(doc, {
      startY: y,
      head: [["#", "Code", "College", "Branch", "District", "OC Closing Rank", "OC Closing Cutoff"]],
      body: (results ?? []).map((r, i) => [
        (i + 1).toString(),
        r.collegeCode || "-",
        r.collegeName || "-",
        r.branchName || "-",
        r.district || "-",
        r.ocRank.toString(),
        r.closingCutoff != null ? r.closingCutoff.toString() : "-",
      ]),
      styles: commonStyles,
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 14 },
        2: { cellWidth: 52 },
        3: { cellWidth: 36 },
        4: { cellWidth: 22 },
        5: { cellWidth: 24 },
        6: { cellWidth: 24 },
      },
      headStyles: commonHead,
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 15, right: 15, top: 40, bottom: 25 },
      theme: "grid",
    })

    // Header + footer on every page
    const totalPages = (doc as any).internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      if (i > 1) addHeader()
      addFooter(i, totalPages)
    }

    const timestamp = new Date().toISOString().split("T")[0]
    doc.save(`college-predictor-results-${timestamp}.pdf`)
  }

  // While auth is resolving (or redirecting an unauthenticated user), show a loader
  // instead of the form.
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#005596]" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-[#005596]">College Predictor</h1>
          <p className="text-muted-foreground mb-6">
            Enter your details to validate your rank and get the colleges that match it.
          </p>

          {/* Anti-spam notice */}
          <div className="mb-6 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              To prevent spam and misuse, we collect and validate only genuine student data. Please
              enter your real details — your rank and community are verified against official records
              before any results are shown.
            </span>
          </div>

          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>Fill in your details and click “Get Colleges”.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {errorMessage && (
                  <div className="p-4 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {errorMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className="rounded-l-none"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="generalRank">General Rank</Label>
                  <Input
                    id="generalRank"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter your general rank"
                    value={generalRank}
                    onChange={(e) => setGeneralRank(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="community">Community</Label>
                  <Select value={community} onValueChange={setCommunity}>
                    <SelectTrigger id="community">
                      <SelectValue placeholder="Select your community" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMUNITIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="communityRank">Community Rank</Label>
                  <Input
                    id="communityRank"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter your community rank"
                    value={communityRank}
                    onChange={(e) => setCommunityRank(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cutoff">Cutoff</Label>
                  <Input
                    id="cutoff"
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter your cutoff (0–200)"
                    value={cutoff}
                    onChange={(e) => setCutoff(e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Get Colleges
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {(results || cutoffResults) && (
            <div className="mt-8 space-y-6">
              {/* Table 1 — Last Year (cutoff-based) */}
              <Card>
                <CardHeader>
                  <CardTitle>College&apos;s that the students got for their Rank in the previous year</CardTitle>
                  <CardDescription>
                    Based on last year&apos;s {community} closing cutoff, for your cutoff ({cutoff}).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>College</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>Closing Cutoff</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(cutoffResults ?? []).map((r, index) => (
                          <TableRow key={`cut-${r.collegeCode}-${index}`}>
                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                            <TableCell>{r.collegeCode || "-"}</TableCell>
                            <TableCell className="font-medium">{r.collegeName || "-"}</TableCell>
                            <TableCell>{r.branchName || "-"}</TableCell>
                            <TableCell>{r.district || "-"}</TableCell>
                            <TableCell>{r.closingCutoff}</TableCell>
                          </TableRow>
                        ))}
                        {(cutoffResults?.length ?? 0) === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No colleges found for this cutoff.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Table 2 — This Year (rank-based) */}
              <Card>
                <CardHeader>
                  <CardTitle>College&apos;s that you might get for your Rank this year</CardTitle>
                  <CardDescription>
                    Based on your general rank ({generalRank}) and OC closing ranks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>College</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>OC Closing Rank</TableHead>
                          <TableHead>OC Closing Cutoff</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(results ?? []).map((r, index) => (
                          <TableRow key={`rank-${r.collegeCode}-${index}`}>
                            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                            <TableCell>{r.collegeCode || "-"}</TableCell>
                            <TableCell className="font-medium">{r.collegeName || "-"}</TableCell>
                            <TableCell>{r.branchName || "-"}</TableCell>
                            <TableCell>{r.district || "-"}</TableCell>
                            <TableCell>{r.ocRank}</TableCell>
                            <TableCell>{r.closingCutoff != null ? r.closingCutoff : "-"}</TableCell>
                          </TableRow>
                        ))}
                        {(results?.length ?? 0) === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              No colleges found for this rank.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Download the results as a PDF */}
              <div className="flex justify-end">
                <Button variant="outline" onClick={generatePDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>

              {/* CTA to Choice Filling */}
              <div className="flex flex-col items-center gap-3 rounded-md border bg-muted/40 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
                <p className="text-sm text-muted-foreground">
                  If you want to know more colleges that you&apos;ll get for your rank and cutoff,
                  you can find them using Choice Filling.
                </p>
                <Button onClick={() => router.push("/choice-filling")}>
                  Go to Choice Filling
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
