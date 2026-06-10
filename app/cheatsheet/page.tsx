'use client'

import { useRef } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Download, Printer, FileText } from 'lucide-react'

const PDF_PATH = '/cheatsheet/engineering-college-cheat-sheet.pdf'
const PDF_FILENAME = 'CYC-Engineering-College-Cheat-Sheet.pdf'

export default function CheatsheetPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = PDF_PATH
    link.download = PDF_FILENAME
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        return
      } catch {
        // fall through to new tab
      }
    }
    window.open(PDF_PATH, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0B5588]/10 mb-4">
              <FileText className="h-7 w-7 text-[#0B5588]" />
            </div>
            <h1 className="text-4xl font-bold mb-3 text-[#0B5588]">
              Engineering College Cheat Sheet
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your quick reference guide for engineering college admissions. View below, download a
              copy, or print it for offline use.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-6 print:hidden">
            <Button
              onClick={handleDownload}
              className="bg-[#0B5588] hover:bg-[#094670]"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white print:border-0 print:shadow-none">
            <iframe
              ref={iframeRef}
              src={`${PDF_PATH}#toolbar=0&navpanes=0`}
              title="CYC Engineering College Cheat Sheet"
              className="w-full h-[min(80vh,900px)] min-h-[480px] border-0 print:h-screen print:min-h-0"
            />
          </div>

          <p className="text-center text-sm text-gray-500 mt-4 print:hidden">
            If the preview does not load, use{' '}
            <button
              type="button"
              onClick={handleDownload}
              className="text-[#0B5588] hover:underline font-medium"
            >
              Download PDF
            </button>{' '}
            to open the file on your device.
          </p>
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
