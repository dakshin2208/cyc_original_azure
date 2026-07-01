/**
 * Stamps NIRF list PDFs with chooseyourcollege.com header/footer (matches choice-filling PDF style).
 * Run: node scripts/stamp-nirf-pdfs.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { drawBookLinks, bookLinksWidth } from './pdf-book-footer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const sourceDir = path.join(root, 'public/nirf-apply-data/source')
const outDir = path.join(root, 'public/nirf-apply-data')
const logoPath = path.join(root, 'public/pdflogo.jpg')

const BRAND_RGB = rgb(41 / 255, 128 / 255, 185 / 255)
const GRAY_RGB = rgb(100 / 255, 100 / 255, 100 / 255)
const WEBSITE = 'chooseyourcollege.com'
const HEADER_HEIGHT = 52
const FOOTER_HEIGHT = 32

const FILES = [
  {
    source: 'total-tn-engineering-colleges.pdf',
    output: 'total-tn-engineering-colleges.pdf',
    title: 'Total TN Engineering Colleges',
    skipFirstPage: true,
  },
  {
    source: 'total-nirf-participated-tn-colleges.pdf',
    output: 'total-nirf-participated-tn-colleges.pdf',
    title: 'Total NIRF Participated TN Colleges',
  },
  {
    source: 'total-colleges-nirf-data-on-website.pdf',
    output: 'total-colleges-nirf-data-on-website.pdf',
    title: 'Colleges with NIRF Data on Website',
  },
]

async function stampPdf(sourceFile, outputFile, docTitle, options = {}) {
  const { skipFirstPage = false } = options
  const sourceBytes = fs.readFileSync(path.join(sourceDir, sourceFile))
  const sourceDoc = await PDFDocument.load(sourceBytes)
  const logoBytes = fs.readFileSync(logoPath)
  const logoImage = await sourceDoc.embedJpg(logoBytes)

  const outDoc = await PDFDocument.create()
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold)
  const fontNormal = await outDoc.embedFont(StandardFonts.Helvetica)
  const sourcePageCount = sourceDoc.getPageCount()
  const startIndex = skipFirstPage ? 1 : 0
  const outputPageCount = sourcePageCount - startIndex

  for (let i = startIndex; i < sourcePageCount; i++) {
    const outputPageNum = i - startIndex + 1
    const srcPage = sourceDoc.getPage(i)
    const { width, height } = srcPage.getSize()
    const embedded = await outDoc.embedPage(srcPage)
    const page = outDoc.addPage([width, height])

    const contentHeight = height - HEADER_HEIGHT - FOOTER_HEIGHT
    page.drawPage(embedded, {
      x: 0,
      y: FOOTER_HEIGHT,
      width,
      height: contentHeight,
    })

    // Logo (top-left)
    const logoW = 30
    const logoH = 20
    page.drawImage(logoImage, {
      x: 20,
      y: height - 20 - logoH,
      width: logoW,
      height: logoH,
    })

    // Website name (centered)
    const siteSize = 22
    const siteWidth = fontBold.widthOfTextAtSize(WEBSITE, siteSize)
    page.drawText(WEBSITE, {
      x: (width - siteWidth) / 2,
      y: height - 28,
      size: siteSize,
      font: fontBold,
      color: BRAND_RGB,
    })

    // Document title (smaller, centered below site name)
    const titleSize = 11
    const titleWidth = fontBold.widthOfTextAtSize(docTitle, titleSize)
    page.drawText(docTitle, {
      x: (width - titleWidth) / 2,
      y: height - 42,
      size: titleSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // Header separator line
    page.drawLine({
      start: { x: 20, y: height - HEADER_HEIGHT + 4 },
      end: { x: width - 20, y: height - HEADER_HEIGHT + 4 },
      thickness: 0.5,
      color: BRAND_RGB,
    })

    // Footer separator line
    page.drawLine({
      start: { x: 20, y: FOOTER_HEIGHT - 4 },
      end: { x: width - 20, y: FOOTER_HEIGHT - 4 },
      thickness: 0.5,
      color: BRAND_RGB,
    })

    // Footer: website (left)
    page.drawText(WEBSITE, {
      x: 25,
      y: 14,
      size: 12,
      font: fontBold,
      color: BRAND_RGB,
    })

    // Footer: book-purchase links (clickable Amazon + Flipkart), centered on the same row
    const fonts = { normal: fontNormal, bold: fontBold }
    const bookPrefix = 'Buy the book on  '
    const bookWidth = bookLinksWidth(fonts, 9, bookPrefix)
    drawBookLinks(page, outDoc, fonts, (width - bookWidth) / 2, 14, 9, bookPrefix)

    // Footer: page numbers (right)
    const pageText = `Page ${outputPageNum} of ${outputPageCount}`
    const pageTextWidth = fontNormal.widthOfTextAtSize(pageText, 10)
    page.drawText(pageText, {
      x: width - 25 - pageTextWidth,
      y: 14,
      size: 10,
      font: fontNormal,
      color: GRAY_RGB,
    })
  }

  const pdfBytes = await outDoc.save()
  fs.writeFileSync(path.join(outDir, outputFile), pdfBytes)
  console.log(`✓ ${outputFile} (${outputPageCount} pages)`)
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  for (const file of FILES) {
    await stampPdf(file.source, file.output, file.title, {
      skipFirstPage: file.skipFirstPage ?? false,
    })
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
