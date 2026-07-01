/**
 * Rewrites the cheat-sheet footer line: drops "— Engineering Edition" and turns the
 * book title into a "Buy … on Amazon · Flipkart" link (clickable). One footer line only.
 *
 * The original footer is baked into the page, so we read its position with
 * `pdftotext -bbox`, cover it, and redraw a clean footer at the same baseline.
 *
 * Run: node scripts/stamp-cheatsheet-pdfs.mjs   (requires poppler's pdftotext)
 */
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { drawCenteredSegments, AMAZON_URL, FLIPKART_URL } from './pdf-book-footer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dir = path.join(root, 'public/cheatsheet')
const sourceDir = path.join(dir, 'source')

const FILES = [
  'Engineering_Cheat_Sheet_Pages1-2.pdf',
  'Engineering_Cheat_Sheet_Page3_Rupee.pdf',
]

const BOOK_TITLE = 'How Not to Choose Your College'

/** Parse `pdftotext -bbox` XHTML → per-page { height, words:[{text,xMin,yMin,xMax,yMax}] }. */
function getWordBoxesPerPage(pdfPath) {
  const xml = execFileSync('pdftotext', ['-bbox', pdfPath, '-'], { encoding: 'utf8' })
  const pages = []
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g
  let pm
  while ((pm = pageRe.exec(xml))) {
    const height = parseFloat(pm[2])
    const words = []
    const wordRe = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g
    let wm
    while ((wm = wordRe.exec(pm[3]))) {
      words.push({
        xMin: parseFloat(wm[1]),
        yMin: parseFloat(wm[2]),
        xMax: parseFloat(wm[3]),
        yMax: parseFloat(wm[4]),
        text: wm[5],
      })
    }
    pages.push({ height, words })
  }
  return pages
}

async function stamp(file) {
  const srcPath = path.join(sourceDir, file)
  const boxesPerPage = getWordBoxesPerPage(srcPath)

  const doc = await PDFDocument.load(fs.readFileSync(srcPath))
  const fonts = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  const pages = doc.getPages()

  pages.forEach((page, i) => {
    const info = boxesPerPage[i]
    if (!info || info.words.length === 0) return
    const { width } = page.getSize()
    const pageHeight = info.height

    // Footer line = the bottom-most row of words.
    const maxYMax = Math.max(...info.words.map((w) => w.yMax))
    const footerWords = info.words.filter((w) => w.yMax >= maxYMax - 2)
    const yMin = Math.min(...footerWords.map((w) => w.yMin))
    const yMax = Math.max(...footerWords.map((w) => w.yMax))
    const size = Math.max(5.5, yMax - yMin) // match the footer's size

    // Page number = word following "Page".
    const pageIdx = footerWords.findIndex((w) => /^Page$/i.test(w.text))
    const pageNum =
      pageIdx >= 0 && footerWords[pageIdx + 1] ? footerWords[pageIdx + 1].text : String(i + 1)

    // Cover the original footer text row with white.
    page.drawRectangle({
      x: 15,
      y: pageHeight - yMax - 2.5,
      width: width - 30,
      height: yMax - yMin + 5,
      color: rgb(1, 1, 1),
    })

    // Redraw a clean footer (no "Engineering Edition"; title becomes the buy link).
    const baseline = pageHeight - yMax + size * 0.2
    drawCenteredSegments(page, doc, fonts, width, baseline, size, [
      { text: `chooseyourcollege.com   ·   Page ${pageNum}   ·   Buy  `, font: 'normal', color: 'gray' },
      { text: BOOK_TITLE, font: 'bold', color: 'brand', url: AMAZON_URL },
      { text: '   on   ', font: 'normal', color: 'gray' },
      { text: 'Amazon', font: 'bold', color: 'brand', url: AMAZON_URL },
      { text: '   ·   ', font: 'normal', color: 'gray' },
      { text: 'Flipkart', font: 'bold', color: 'brand', url: FLIPKART_URL },
    ])
  })

  const bytes = await doc.save()
  fs.writeFileSync(path.join(dir, file), bytes)
  console.log(`✓ ${file} (${pages.length} pages)`)
}

async function main() {
  for (const file of FILES) await stamp(file)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
