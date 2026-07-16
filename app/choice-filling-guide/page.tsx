'use client'

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Download, ArrowUp, ArrowDown, ArrowRight } from "lucide-react"
import { jsPDF } from "jspdf"

// Single source of truth for the guide content — rendered both on-screen and
// into the downloadable PDF.
const GUIDE_SECTIONS: { title: string; points: string[] }[] = [
  {
    title: '1. Getting Started',
    points: [
      'Log in to your chooseyourcollege.com account.',
      'Open "Choice Filling" from the menu to meet AARVI, your personal AI assistant.',
      'AARVI guides you step by step to build the perfect choice list.',
    ],
  },
  {
    title: '2. Enter Your Details',
    points: [
      'Fill in your full name, phone number, email and date of birth.',
      'Enter your Mathematics, Physics and Chemistry marks — your Cutoff is calculated automatically (Maths + Physics/2 + Chemistry/2).',
      'Enter your General Rank and your Community Rank.',
      'Select your Reservation Category (OC, BC, BCM, MBC, MBCDNC, MBCV, SC, SCA, ST).',
      'OC candidates do not have a community rank — leave that field blank.',
      'Important: your General Rank, Category and Community Rank must match the official records before you can continue. If they do not match, re-check and re-enter your details.',
    ],
  },
  {
    title: "3. Answer AARVI's Questions",
    points: [
      'City preference: choose any city, or pick specific cities / districts.',
      'Branch option: Computer Science & Related, Circuit Branches, or specific branches.',
      'College option: colleges that match your cutoff, or hand-pick specific "aspirational" colleges (available on paid plans).',
      'Finally, choose how your results are generated: Cutoff based or AI Based.',
    ],
  },
  {
    title: '5. Download Your Results',
    points: [
      'Use the "Download Results" button at the top or bottom of your results to save them as a PDF.',
      'The PDF includes your details, the colour-coded choice list and the trend-rate arrows.',
    ],
  },
  {
    title: '6. Tips for Better Choice Filling',
    points: [
      'Fill as many choices as your plan allows to maximise your chances.',
      'Order your list: aspirational (reach) colleges first, then matching, then safe colleges as backups.',
      'Upgrade your plan for more choices and to hand-pick specific aspirational colleges.',
    ],
  },
]

const COLOUR_LEGEND: { colour: string; label: string; desc: string }[] = [
  { colour: 'green', label: 'Aspirational choices', desc: 'Colleges you specifically picked — your reach options.' },
  { colour: 'yellow', label: 'Matching colleges', desc: 'Colleges whose rank/cutoff exactly matches yours.' },
  { colour: 'pink', label: 'Safe choices', desc: 'Backup colleges that are comfortably within your reach.' },
]

const TREND_LEGEND: { dir: 'up' | 'down' | 'right'; colour: string; label: string }[] = [
  { dir: 'up', colour: 'green', label: 'Upward trend' },
  { dir: 'down', colour: 'red', label: 'Downward trend' },
  { dir: 'right', colour: 'yellow', label: 'Stable trend' },
]

export default function ChoiceFillingGuidePage() {
  const generateGuidePDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const marginX = 20
    const contentBottom = pageHeight - 28

    const addHeader = () => {
      const logoX = 20, logoY = 12, logoW = 24, logoH = 16
      try {
        doc.addImage('/pdflogo.jpg', 'JPEG', logoX, logoY, logoW, logoH)
      } catch (e) {
        // Logo missing — continue without it
      }
      const textCenter = (logoX + logoW + 4 + (pageWidth - 20)) / 2

      doc.setTextColor(41, 128, 185)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      const site = 'chooseyourcollege.com'
      doc.text(site, textCenter - doc.getTextWidth(site) / 2, 21)

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const title = 'Choice Filling Guide'
      doc.text(title, textCenter - doc.getTextWidth(title) / 2, 30)

      doc.setDrawColor(41, 128, 185)
      doc.setLineWidth(0.5)
      doc.line(marginX, 37, pageWidth - marginX, 37)
    }

    const addFooter = (pageNumber: number, totalPages: number) => {
      doc.setDrawColor(41, 128, 185)
      doc.setLineWidth(0.5)
      doc.line(marginX, pageHeight - 20, pageWidth - marginX, pageHeight - 20)

      doc.setTextColor(41, 128, 185)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('chooseyourcollege.com', marginX, pageHeight - 12)

      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const pageText = `Page ${pageNumber} of ${totalPages}`
      doc.text(pageText, (pageWidth - doc.getTextWidth(pageText)) / 2, pageHeight - 12)

      const stamp = new Date().toLocaleDateString()
      doc.text(stamp, pageWidth - marginX - doc.getTextWidth(stamp), pageHeight - 12)
    }

    addHeader()
    let y = 48

    const ensureSpace = (needed: number) => {
      if (y + needed > contentBottom) {
        doc.addPage()
        addHeader()
        y = 48
      }
    }

    // Intro line
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    const intro = 'A quick step-by-step guide to filling your choices with confidence.'
    doc.text(intro, marginX, y)
    y += 8

    const drawSectionTitle = (title: string) => {
      ensureSpace(12)
      doc.setTextColor(11, 85, 136)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(title, marginX, y)
      y += 6
    }

    const drawBullet = (text: string) => {
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(text, pageWidth - marginX * 2 - 5) as string[]
      ensureSpace(lines.length * 5 + 1)
      doc.text('•', marginX, y)
      lines.forEach((line, i) => doc.text(line, marginX + 5, y + i * 5))
      y += lines.length * 5 + 1.5
    }

    GUIDE_SECTIONS.forEach((section, idx) => {
      drawSectionTitle(section.title)
      section.points.forEach(drawBullet)
      y += 3

      // Insert the "Read Your Results" section (with colour + trend legends) in
      // its numbered position, between sections 3 and 5.
      if (idx === 2) {
        drawSectionTitle('4. Read Your Results')
        drawBullet('Each college in your results is colour-coded so you can see its type at a glance:')

        COLOUR_LEGEND.forEach((item) => {
          ensureSpace(7)
          const fill: [number, number, number] =
            item.colour === 'green' ? [220, 252, 231] :
            item.colour === 'yellow' ? [254, 249, 195] : [252, 231, 243]
          doc.setFillColor(fill[0], fill[1], fill[2])
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.2)
          doc.rect(marginX + 3, y - 3.2, 4, 4, 'FD')
          doc.setTextColor(30, 30, 30)
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(item.label, marginX + 10, y)
          doc.setFont('helvetica', 'normal')
          const lw = doc.getTextWidth(item.label)
          doc.text(`— ${item.desc}`, marginX + 12 + lw, y)
          y += 6
        })

        y += 2
        drawBullet('The Trend Rate arrow shows how each college-branch is trending for your category:')
        TREND_LEGEND.forEach((item) => {
          ensureSpace(7)
          const rgb: [number, number, number] =
            item.colour === 'green' ? [22, 163, 74] :
            item.colour === 'red' ? [220, 38, 38] : [234, 179, 8]
          const cx = marginX + 5, cy = y - 1.2, s = 1.8
          doc.setFillColor(rgb[0], rgb[1], rgb[2])
          if (item.dir === 'up') doc.triangle(cx, cy - s, cx - s, cy + s, cx + s, cy + s, 'F')
          else if (item.dir === 'down') doc.triangle(cx, cy + s, cx - s, cy - s, cx + s, cy - s, 'F')
          else doc.triangle(cx + s, cy, cx - s, cy - s, cx - s, cy + s, 'F')
          doc.setTextColor(30, 30, 30)
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.text(item.label, marginX + 10, y)
          y += 6
        })
        y += 3
      }
    })

    // Footers on all pages
    const totalPages = (doc as any).internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      addFooter(i, totalPages)
    }

    doc.save('choice-filling-guide.pdf')
  }

  const swatchClass = (colour: string) =>
    colour === 'green' ? 'bg-green-400' : colour === 'yellow' ? 'bg-yellow-400' : 'bg-pink-400'

  const TrendIcon = ({ dir, colour }: { dir: 'up' | 'down' | 'right'; colour: string }) => {
    const cls =
      colour === 'green' ? 'text-green-600' : colour === 'red' ? 'text-red-600' : 'text-yellow-500'
    if (dir === 'up') return <ArrowUp className={`h-5 w-5 ${cls}`} />
    if (dir === 'down') return <ArrowDown className={`h-5 w-5 ${cls}`} />
    return <ArrowRight className={`h-5 w-5 ${cls}`} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#005596]">Choice Filling Guide</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              A quick step-by-step guide to filling your choices with confidence.
            </p>
          </div>
          <Button onClick={generateGuidePDF} className="flex items-center space-x-2 shrink-0">
            <Download className="h-4 w-4" />
            <span>Download Guide (PDF)</span>
          </Button>
        </div>

        <div className="space-y-6">
          {GUIDE_SECTIONS.slice(0, 3).map((section) => (
            <GuideCard key={section.title} title={section.title} points={section.points} />
          ))}

          {/* Section 4 — Read Your Results, with legends */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-[#005596] mb-3">4. Read Your Results</h2>
            <p className="text-gray-700 dark:text-gray-200 mb-3">
              Each college in your results is colour-coded so you can see its type at a glance:
            </p>
            <ul className="space-y-2 mb-4">
              {COLOUR_LEGEND.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <span className={`inline-block h-4 w-4 rounded-sm mt-0.5 ${swatchClass(item.colour)}`} />
                  <span className="text-gray-700 dark:text-gray-200">
                    <span className="font-semibold">{item.label}</span> — {item.desc}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-gray-700 dark:text-gray-200 mb-3">
              The Trend Rate arrow shows how each college-branch is trending for your category:
            </p>
            <ul className="space-y-2">
              {TREND_LEGEND.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <TrendIcon dir={item.dir} colour={item.colour} />
                  <span className="text-gray-700 dark:text-gray-200">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {GUIDE_SECTIONS.slice(3).map((section) => (
            <GuideCard key={section.title} title={section.title} points={section.points} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function GuideCard({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-lg font-semibold text-[#005596] mb-3">{title}</h2>
      <ul className="space-y-2 list-disc list-inside">
        {points.map((p, i) => (
          <li key={i} className="text-gray-700 dark:text-gray-200">{p}</li>
        ))}
      </ul>
    </div>
  )
}
