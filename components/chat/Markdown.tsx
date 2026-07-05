/**
 * @module components/chat/Markdown
 *
 * Renders the safe markdown AST to React elements. It uses ONLY React children
 * (never `dangerouslySetInnerHTML`), so all text is auto-escaped and no HTML from
 * the model can execute. Links open in a new tab with `rel="noopener noreferrer"`
 * and pre-sanitized hrefs.
 */

import { Fragment, type ReactNode } from 'react'
import { parseMarkdown, type BlockNode, type InlineNode } from './lib/markdown'

function renderInline(nodes: readonly InlineNode[], keyPrefix: string): ReactNode {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>
      case 'bold':
        return <strong key={key}>{renderInline(node.children, key)}</strong>
      case 'italic':
        return <em key={key}>{renderInline(node.children, key)}</em>
      case 'code':
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {node.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {renderInline(node.children, key)}
          </a>
        )
      default:
        return null
    }
  })
}

function renderBlock(block: BlockNode, key: string): ReactNode {
  switch (block.type) {
    case 'heading': {
      const cls = 'font-semibold text-foreground mt-2 first:mt-0'
      const children = renderInline(block.children, key)
      if (block.level <= 2) return <h3 key={key} className={`${cls} text-base`}>{children}</h3>
      if (block.level === 3) return <h4 key={key} className={`${cls} text-sm`}>{children}</h4>
      return <h5 key={key} className={`${cls} text-sm`}>{children}</h5>
    }
    case 'paragraph':
      return <p key={key} className="leading-relaxed [&:not(:first-child)]:mt-2">{renderInline(block.children, key)}</p>
    case 'code':
      return (
        <pre key={key} className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs first:mt-0">
          <code className="font-mono">{block.value}</code>
        </pre>
      )
    case 'list':
      return block.ordered ? (
        <ol key={key} className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">
          {block.items.map((item, i) => (
            <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="mt-2 list-disc space-y-1 pl-5 first:mt-0">
          {block.items.map((item, i) => (
            <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

/** Render a markdown string safely. */
export function Markdown({ content }: { readonly content: string }) {
  const blocks = parseMarkdown(content)
  return (
    <div className="text-sm text-foreground">
      {blocks.map((block, i) => renderBlock(block, `b-${i}`))}
    </div>
  )
}
