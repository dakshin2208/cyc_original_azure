/**
 * @module lib/ai/tools/registry
 *
 * The generic Tool Registry (Commit 3). It maps a tool NAME to a {@link Tool} and
 * dispatches by name — nothing more. `execute` contains NO tool-specific branches
 * (no `if name === 'recommend'`); adding a capability is a `register(...)` call, not
 * an orchestration change. Unknown tool → null (the caller falls back).
 */

import type { Tool, ToolResult } from './tool'
import { recommendationTools } from './recommendation-tools'
import { profileTools } from './profile-tools'

/** A name → tool dispatcher. Register, discover, resolve, execute. */
export interface ToolRegistry {
  /** Register (or replace) a tool. Returns `this` to chain. */
  register(tool: Tool): ToolRegistry
  has(name: string): boolean
  /** The registered tool names (discovery). */
  list(): readonly string[]
  get(name: string): Tool | undefined
  /** Resolve the tool by name and run it. Unknown name → null. NO name conditionals. */
  execute(name: string, args: Record<string, unknown>): ToolResult | null
}

/** Create an empty registry. */
export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>()
  const registry: ToolRegistry = {
    register(tool) {
      tools.set(tool.name, tool)
      return registry
    },
    has: (name) => tools.has(name),
    list: () => [...tools.keys()],
    get: (name) => tools.get(name),
    execute: (name, args) => {
      const tool = tools.get(name)
      return tool ? tool.execute(args) : null
    },
  }
  return registry
}

/** The default registry: every first-wave capability, wrapping existing components. */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = createToolRegistry()
  for (const tool of [...recommendationTools, ...profileTools]) registry.register(tool)
  return registry
}
