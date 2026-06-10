'use client'

import { useRef, useState } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Printer, Building2, FileText, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const DOCUMENTS = [
  {
    id: 'tn-engineering',
    label: 'Total Tamil Nadu Engineering Colleges',
    shortLabel: 'TN Engineering Colleges',
    description: 'Complete list of engineering colleges in Tamil Nadu.',
    path: '/nirf-apply-data/total-tn-engineering-colleges.pdf',
    downloadName: 'Total-TN-Engineering-Colleges.pdf',
    icon: Building2,
  },
  {
    id: 'nirf-participated',
    label: 'Total Colleges Participated in NIRF',
    shortLabel: 'NIRF Participated Colleges',
    description: 'Tamil Nadu colleges that have participated in NIRF rankings.',
    path: '/nirf-apply-data/total-nirf-participated-tn-colleges.pdf',
    downloadName: 'Total-NIRF-Participated-TN-Colleges.pdf',
    icon: FileText,
  },
  {
    id: 'nirf-on-website',
    label: 'Colleges with NIRF Data on Their Websites',
    shortLabel: 'NIRF Data on Website',
    description: 'Colleges that publish NIRF data on their official websites.',
    path: '/nirf-apply-data/total-colleges-nirf-data-on-website.pdf',
    downloadName: 'Colleges-with-NIRF-Data-on-Website.pdf',
    icon: Globe,
  },
] as const

type DocumentId = (typeof DOCUMENTS)[number]['id']

export default function NirfApplyDataPage() {
  const [activeId, setActiveId] = useState<DocumentId | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const activeDoc = DOCUMENTS.find((d) => d.id === activeId)

  const handleDownload = (path: string, filename: string) => {
    const link = document.createElement('a')
    link.href = path
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (!activeDoc) return
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        return
      } catch {
        // fall through
      }
    }
    window.open(activeDoc.path, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 text-[#0B5588]">NIRF Apply Data</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Browse official college lists for Tamil Nadu. Select a report below to view, download,
              or print. Every page includes the ChooseYourCollege logo and branding.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            {DOCUMENTS.map((doc) => {
              const Icon = doc.icon
              const isActive = activeId === doc.id
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveId(doc.id)}
                  className={cn(
                    'text-left rounded-lg border-2 p-4 transition-all hover:shadow-md',
                    isActive
                      ? 'border-[#0B5588] bg-[#0B5588]/5 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#0B5588]/40'
                  )}
                >
                  <Icon
                    className={cn('h-8 w-8 mb-3', isActive ? 'text-[#0B5588]' : 'text-gray-500')}
                  />
                  <p className="font-semibold text-[#0B5588] text-sm leading-snug mb-1">
                    {doc.shortLabel}
                  </p>
                  <p className="text-xs text-gray-500">{doc.description}</p>
                </button>
              )
            })}
          </div>

          {!activeDoc ? (
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <CardTitle className="text-[#0B5588]">Select a report</CardTitle>
                <CardDescription>
                  Choose one of the three buttons above to preview the PDF here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl text-[#0B5588]">{activeDoc.label}</CardTitle>
                  <CardDescription>{activeDoc.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-[#0B5588] hover:bg-[#094670]"
                    onClick={() => handleDownload(activeDoc.path, activeDoc.downloadName)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <iframe
                    ref={iframeRef}
                    key={activeDoc.id}
                    src={`${activeDoc.path}#toolbar=0&navpanes=0`}
                    title={activeDoc.label}
                    className="w-full h-[min(75vh,800px)] min-h-[420px] border-0"
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-3">
                  Preview not loading?{' '}
                  <button
                    type="button"
                    onClick={() => handleDownload(activeDoc.path, activeDoc.downloadName)}
                    className="text-[#0B5588] hover:underline font-medium"
                  >
                    Download the PDF
                  </button>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
