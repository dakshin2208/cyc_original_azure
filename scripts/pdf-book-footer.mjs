/**
 * Shared helper: draws the "buy the book" links (clickable Amazon + Flipkart)
 * on a single line. Used by the cheatsheet and NIRF stamping scripts so the links
 * blend into the footer that is already on the page instead of adding a new one.
 */
import { PDFName, PDFString, rgb } from 'pdf-lib'

export const AMAZON_URL =
  'https://www.amazon.in/How-Not-Choose-Your-College-ebook/dp/B0GZ2PS4GF'
export const FLIPKART_URL =
  'https://www.flipkart.com/not-choose-your-college/p/itm4b166c915391d'

const BRAND = rgb(41 / 255, 128 / 255, 185 / 255)
const GRAY = rgb(90 / 255, 90 / 255, 90 / 255)

/** Add a clickable URI link annotation over a rectangle on a page. */
function addLinkAnnotation(page, doc, x, y, w, h, url) {
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + w, y + h],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  })
  const ref = doc.context.register(annot)
  let annots = page.node.get(PDFName.of('Annots'))
  if (!annots) {
    annots = doc.context.obj([])
    page.node.set(PDFName.of('Annots'), annots)
  }
  annots.push(ref)
}

/**
 * Draw an arbitrary list of segments centered on one line at baseline `y`.
 * Each segment: { text, font: 'normal'|'bold', color: 'gray'|'brand', url? }.
 * Segments with a `url` get an underline + clickable link annotation.
 */
export function drawCenteredSegments(page, doc, fonts, width, y, size, segments) {
  const fontFor = (f) => (f === 'bold' ? fonts.bold : fonts.normal)
  const colorFor = (c) => (c === 'brand' ? BRAND : GRAY)
  const total = segments.reduce(
    (s, seg) => s + fontFor(seg.font).widthOfTextAtSize(seg.text, size),
    0,
  )
  let x = (width - total) / 2
  for (const seg of segments) {
    const font = fontFor(seg.font)
    const color = colorFor(seg.color)
    const w = font.widthOfTextAtSize(seg.text, size)
    page.drawText(seg.text, { x, y, size, font, color })
    if (seg.url) {
      page.drawLine({ start: { x, y: y - 1.2 }, end: { x: x + w, y: y - 1.2 }, thickness: 0.4, color })
      addLinkAnnotation(page, doc, x, y - 2, w, size + 3, seg.url)
    }
    x += w
  }
}

/** Segments that make up the book-links string. `prefix` defaults to " · Buy the book on ". */
function bookSegments(fonts, prefix) {
  const { normal, bold } = fonts
  return [
    { text: prefix, font: normal, color: GRAY },
    { text: 'Amazon', font: bold, color: BRAND, url: AMAZON_URL },
    { text: '  ·  ', font: normal, color: GRAY },
    { text: 'Flipkart', font: bold, color: BRAND, url: FLIPKART_URL },
  ]
}

/** Total width of the book-links string at a given size. */
export function bookLinksWidth(fonts, size, prefix = '  ·  Buy the book on  ') {
  return bookSegments(fonts, prefix).reduce(
    (sum, s) => sum + s.font.widthOfTextAtSize(s.text, size),
    0,
  )
}

/**
 * Draw the book links starting at `startX`, baseline `y`. Linked words get an
 * underline + clickable annotation. Returns the ending x.
 */
export function drawBookLinks(page, doc, fonts, startX, y, size, prefix = '  ·  Buy the book on  ') {
  let x = startX
  for (const seg of bookSegments(fonts, prefix)) {
    const w = seg.font.widthOfTextAtSize(seg.text, size)
    page.drawText(seg.text, { x, y, size, font: seg.font, color: seg.color })
    if (seg.url) {
      page.drawLine({
        start: { x, y: y - 1.5 },
        end: { x: x + w, y: y - 1.5 },
        thickness: 0.5,
        color: seg.color,
      })
      addLinkAnnotation(page, doc, x, y - 2, w, size + 3, seg.url)
    }
    x += w
  }
  return x
}
