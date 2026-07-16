'use client'

import { useMemo, useState } from 'react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Search, ShieldCheck, AlertTriangle, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TRANSPARENCY_ROWS,
  TRANSPARENCY_COUNTS,
  type Transparency,
} from './transparency-data'

type FilterKey = 'all' | Transparency

const STATUS = {
  Transparent: {
    label: 'Transparent',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-800 border-green-200',
    icon: ShieldCheck,
    hint: 'Has published its NIRF data on its website.',
    pdf: [220, 252, 231] as [number, number, number],
  },
  Suspicious: {
    label: 'Suspicious',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertTriangle,
    hint: 'Applied to NIRF but has not published the data on its website.',
    pdf: [254, 249, 195] as [number, number, number],
  },
  Avoid: {
    label: 'Avoid',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-800 border-red-200',
    icon: Ban,
    hint: 'No record of applying to NIRF.',
    pdf: [254, 226, 226] as [number, number, number],
  },
} as const

export default function DataTransparencyPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TRANSPARENCY_ROWS.filter((r) => {
      if (filter !== 'all' && r.t !== filter) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q) || String(r.code).toLowerCase().includes(q)
    })
  }, [query, filter])

  const handleDownloadPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.setTextColor(11, 85, 136)
    doc.text('Data Transparency — TN Engineering Colleges', 14, 16)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(
      `Transparent: ${TRANSPARENCY_COUNTS.Transparent}   Suspicious: ${TRANSPARENCY_COUNTS.Suspicious}   Avoid: ${TRANSPARENCY_COUNTS.Avoid}`,
      14,
      22,
    )

    autoTable(doc, {
      startY: 26,
      head: [['College Code', 'College Name', 'Data Transparency']],
      body: rows.map((r) => [r.code, r.name, STATUS[r.t].label]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [11, 85, 136] },
      columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 34 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const t = rows[data.row.index]?.t
          if (t) data.cell.styles.fillColor = STATUS[t].pdf
        }
      },
    })

    // Book-purchase footer (clickable Amazon + Flipkart) on every page
    const AMAZON_URL = 'https://www.amazon.in/How-Not-Choose-Your-College-ebook/dp/B0GZ2PS4GF'
    const FLIPKART_URL = 'https://www.flipkart.com/not-choose-your-college/p/itm4b166c915391d'
    const pageCount = doc.getNumberOfPages()
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      const prefix = 'How Not to Choose Your College  ·  Buy on '
      const sep = '  ·  '
      doc.setTextColor(90)
      const wPrefix = doc.getTextWidth(prefix)
      doc.setTextColor(41, 128, 185)
      const wAmazon = doc.getTextWidth('Amazon')
      doc.setTextColor(90)
      const wSep = doc.getTextWidth(sep)
      doc.setTextColor(41, 128, 185)
      const wFlipkart = doc.getTextWidth('Flipkart')
      const total = wPrefix + wAmazon + wSep + wFlipkart
      let x = (pw - total) / 2
      const y = ph - 8
      doc.setTextColor(90)
      doc.text(prefix, x, y)
      x += wPrefix
      doc.setTextColor(41, 128, 185)
      doc.textWithLink('Amazon', x, y, { url: AMAZON_URL })
      x += wAmazon
      doc.setTextColor(90)
      doc.text(sep, x, y)
      x += wSep
      doc.setTextColor(41, 128, 185)
      doc.textWithLink('Flipkart', x, y, { url: FLIPKART_URL })
    }

    doc.save('data-transparency.pdf')
  }

  const filterButtons: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: TRANSPARENCY_ROWS.length },
    { key: 'Transparent', label: 'Transparent', count: TRANSPARENCY_COUNTS.Transparent },
    { key: 'Suspicious', label: 'Suspicious', count: TRANSPARENCY_COUNTS.Suspicious },
    { key: 'Avoid', label: 'Avoid', count: TRANSPARENCY_COUNTS.Avoid },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 text-[#005596]">Data Transparency</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A single, colour-coded list of Tamil Nadu engineering colleges by how openly they
              publish their NIRF data. Search, filter, and download the full list as one PDF.
            </p>
          </div>

          {/* Legend */}
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            {(['Transparent', 'Suspicious', 'Avoid'] as const).map((t) => {
              const s = STATUS[t]
              const Icon = s.icon
              return (
                <div key={t} className={cn('rounded-lg border p-4', s.badge)}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold">
                      {s.label} ({TRANSPARENCY_COUNTS[t]})
                    </span>
                  </div>
                  <p className="text-xs opacity-90">{s.hint}</p>
                </div>
              )
            })}
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by college name or code..."
                className="pl-9"
              />
            </div>
            <Button className="bg-[#005596] hover:bg-[#094670] shrink-0" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {filterButtons.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  filter === f.key
                    ? 'border-[#005596] bg-[#005596] text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[#005596]/40',
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-32">College Code</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">College Name</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 w-44">Data Transparency</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const s = STATUS[r.t]
                    return (
                      <tr key={`${r.code}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.code}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.name}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              s.badge,
                            )}
                          >
                            <span className={cn('h-2 w-2 rounded-full', s.dot)} />
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                        No colleges match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">
            Showing {rows.length} of {TRANSPARENCY_ROWS.length} colleges.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
