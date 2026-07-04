/**
 * @module components/chat/lib/__tests__/markdown.test
 * Safe markdown parser — inline + block AST, href sanitization, no raw HTML.
 */

import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown, sanitizeHref } from '../markdown'

describe('parseInline', () => {
  it('parses plain text', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }])
  })

  it('parses bold, italic, and inline code', () => {
    expect(parseInline('**b**')).toEqual([{ type: 'bold', children: [{ type: 'text', value: 'b' }] }])
    expect(parseInline('*i*')).toEqual([{ type: 'italic', children: [{ type: 'text', value: 'i' }] }])
    expect(parseInline('`c`')).toEqual([{ type: 'code', value: 'c' }])
  })

  it('parses a link with a safe href', () => {
    expect(parseInline('[docs](https://x.com)')).toEqual([
      { type: 'link', href: 'https://x.com', children: [{ type: 'text', value: 'docs' }] },
    ])
  })

  it('sanitizes an unsafe href to "#"', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('#')
    const [node] = parseInline('[x](javascript:alert(1))')
    expect(node).toMatchObject({ type: 'link', href: '#' })
  })

  it('mixes text and marks', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', children: [{ type: 'text', value: 'b' }] },
      { type: 'text', value: ' c' },
    ])
  })

  it('treats raw HTML as literal text (no interpretation)', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([
      { type: 'text', value: '<script>alert(1)</script>' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('returns [] for empty input', () => {
    expect(parseMarkdown('')).toEqual([])
  })

  it('parses headings and paragraphs', () => {
    const blocks = parseMarkdown('# Title\n\nA paragraph here.')
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({ type: 'paragraph' })
  })

  it('parses unordered and ordered lists', () => {
    const first = parseMarkdown('- one\n- two')[0]
    expect(first.type).toBe('list')
    if (first.type === 'list') {
      expect(first.ordered).toBe(false)
      expect(first.items).toHaveLength(2)
    }
    const ordered = parseMarkdown('1. a\n2. b')[0]
    expect(ordered).toMatchObject({ type: 'list', ordered: true })
  })

  it('parses a fenced code block with a language', () => {
    const blocks = parseMarkdown('```ts\nconst x = 1\n```')
    expect(blocks[0]).toEqual({ type: 'code', value: 'const x = 1', lang: 'ts' })
  })

  it('joins consecutive paragraph lines', () => {
    const blocks = parseMarkdown('line one\nline two')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'paragraph' })
  })
})
