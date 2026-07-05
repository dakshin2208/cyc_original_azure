/**
 * @module components/chat/lib/markdown
 *
 * A tiny, SAFE markdown parser producing a plain AST (no HTML, no `dangerouslySet-
 * InnerHTML`). It covers the subset an assistant answer uses: headings, paragraphs,
 * fenced code, bullet/numbered lists, and inline bold / italic / code / links.
 * Raw HTML is never interpreted — it becomes literal text (React escapes it at
 * render). Link hrefs are sanitized (only http/https/mailto/relative/anchor).
 * Pure and deterministic → node-testable.
 */

/** Inline AST nodes. */
export type InlineNode =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'bold'; readonly children: readonly InlineNode[] }
  | { readonly type: 'italic'; readonly children: readonly InlineNode[] }
  | { readonly type: 'code'; readonly value: string }
  | { readonly type: 'link'; readonly href: string; readonly children: readonly InlineNode[] }

/** Block AST nodes. */
export type BlockNode =
  | { readonly type: 'paragraph'; readonly children: readonly InlineNode[] }
  | { readonly type: 'heading'; readonly level: number; readonly children: readonly InlineNode[] }
  | { readonly type: 'code'; readonly value: string; readonly lang: string | null }
  | { readonly type: 'list'; readonly ordered: boolean; readonly items: readonly (readonly InlineNode[])[] }

const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i

/** Sanitize a link href; unsafe schemes (e.g. `javascript:`) collapse to `#`. */
export function sanitizeHref(href: string): string {
  const trimmed = href.trim()
  return SAFE_HREF.test(trimmed) ? trimmed : '#'
}

const text = (value: string): InlineNode => ({ type: 'text', value })

/** Parse an inline text run into inline nodes. */
export function parseInline(input: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let rest = input
  // Earliest-match tokenizer over a small delimiter set.
  const token = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/
  while (rest.length > 0) {
    const m = token.exec(rest)
    if (!m || m.index === undefined) {
      nodes.push(text(rest))
      break
    }
    if (m.index > 0) nodes.push(text(rest.slice(0, m.index)))
    const matched = m[0]
    if (matched.startsWith('`')) {
      nodes.push({ type: 'code', value: matched.slice(1, -1) })
    } else if (matched.startsWith('**')) {
      nodes.push({ type: 'bold', children: parseInline(matched.slice(2, -2)) })
    } else if (matched.startsWith('*')) {
      nodes.push({ type: 'italic', children: parseInline(matched.slice(1, -1)) })
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(matched)
      if (linkMatch) {
        nodes.push({ type: 'link', href: sanitizeHref(linkMatch[2]), children: parseInline(linkMatch[1]) })
      } else {
        nodes.push(text(matched))
      }
    }
    rest = rest.slice(m.index + matched.length)
  }
  return nodes
}

const HEADING = /^(#{1,6})\s+(.*)$/
const UNORDERED = /^[-*]\s+(.*)$/
const ORDERED = /^\d+\.\s+(.*)$/
const FENCE = /^```(\w*)\s*$/

/** Parse a markdown string into a block AST. */
export function parseMarkdown(source: string): BlockNode[] {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: BlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i += 1
      continue
    }

    // Fenced code block.
    const fence = FENCE.exec(line)
    if (fence) {
      const lang = fence[1] || null
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1 // consume closing fence (or EOF)
      blocks.push({ type: 'code', value: body.join('\n'), lang })
      continue
    }

    // Heading.
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) })
      i += 1
      continue
    }

    // List (consecutive bullet or numbered lines).
    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line)
      const items: InlineNode[][] = []
      while (i < lines.length) {
        const m = (ordered ? ORDERED : UNORDERED).exec(lines[i])
        if (!m) break
        items.push(parseInline(m[1]))
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Paragraph (consecutive plain lines).
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !HEADING.test(lines[i]) &&
      !UNORDERED.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !FENCE.test(lines[i])
    ) {
      para.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) })
  }

  return blocks
}
