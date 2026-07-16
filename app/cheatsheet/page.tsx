'use client'

import { useRef } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Download, Printer, FileText } from 'lucide-react'

type Sheet = {
  id: string
  title: string
  description: string
  path: string
  filename: string
}

const SHEETS: Sheet[] = [
  {
    id: 'scorecards',
    title: 'Scorecards (Parts A–D)',
    description:
      'Score any college in under 10 minutes — parent & student scorecards, branch scorecard, and the final combined score.',
    path: '/cheatsheet/Engineering_Cheat_Sheet_Pages1-2.pdf',
    filename: 'CYC-Engineering-Cheat-Sheet-Scorecards.pdf',
  },
  {
    id: 'numbers',
    title: 'The Numbers Behind the Decision',
    description:
      'Fees-to-justified-salary, monthly take-home reality check, and the education loan reality check.',
    path: '/cheatsheet/Engineering_Cheat_Sheet_Page3_Rupee.pdf',
    filename: 'CYC-Engineering-Cheat-Sheet-Numbers.pdf',
  },
]

export default function CheatsheetPage() {
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  const handleDownload = (path: string, filename: string) => {
    const link = document.createElement('a')
    link.href = path
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = (sheet: Sheet) => {
    const iframe = iframeRefs.current[sheet.id]
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        return
      } catch {
        // fall through to new tab
      }
    }
    window.open(sheet.path, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#005596]/10 mb-4">
              <FileText className="h-7 w-7 text-[#005596]" />
            </div>
            <h1 className="text-4xl font-bold mb-3 text-[#005596]">
              Engineering College Cheat Sheet
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your quick reference guide for engineering college admissions. View each sheet below,
              download a copy, or print it for offline use.
            </p>
          </div>

          <div className="space-y-10">
            {SHEETS.map((sheet) => (
              <section key={sheet.id}>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#005596]">{sheet.title}</h2>
                    <p className="text-sm text-gray-600 max-w-2xl">{sheet.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 shrink-0 print:hidden">
                    <Button
                      className="bg-[#005596] hover:bg-[#094670]"
                      onClick={() => handleDownload(sheet.path, sheet.filename)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button variant="outline" onClick={() => handlePrint(sheet)}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white print:border-0 print:shadow-none">
                  <iframe
                    ref={(el) => {
                      iframeRefs.current[sheet.id] = el
                    }}
                    src={`${sheet.path}#toolbar=0&navpanes=0`}
                    title={sheet.title}
                    className="w-full h-[min(80vh,900px)] min-h-[480px] border-0"
                  />
                </div>

                <p className="text-center text-sm text-gray-500 mt-3 print:hidden">
                  If the preview does not load, use{' '}
                  <button
                    type="button"
                    onClick={() => handleDownload(sheet.path, sheet.filename)}
                    className="text-[#005596] hover:underline font-medium"
                  >
                    Download
                  </button>{' '}
                  to open the file on your device.
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
