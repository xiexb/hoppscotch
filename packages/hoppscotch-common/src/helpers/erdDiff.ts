/**
 * erdDiff.ts — Merge two erd-editor JSON versions with color annotations
 * for visual diff display in the erd-editor canvas.
 *
 * Color scheme:
 *   - Green  (#22c55e): added tables
 *   - Yellow (#eab308): modified tables
 *   - Gray   (#6b7280): deleted tables
 *   - Empty  (""):      unchanged tables
 *
 * Note: erd-editor columns don't have independent color properties.
 * Column-level differences are displayed in the ErdDiffDetail panel.
 */

import type { DiffResult } from "./erdVersionApi"

// ─── Color constants ──────────────────────────────────────────────

const COLOR_ADDED = "#22c55e"
const COLOR_MODIFIED = "#eab308"
const COLOR_REMOVED = "#6b7280"
const COLOR_UNCHANGED = ""

// ─── Types for parsed erd-editor JSON ─────────────────────────────

interface ErdEditorJson {
  $schema?: string
  version?: string
  settings?: Record<string, unknown>
  doc?: {
    tableIds?: string[]
    relationshipIds?: string[]
    indexIds?: string[]
    memoIds?: string[]
  }
  collections?: {
    tableEntities?: Record<string, any>
    tableColumnEntities?: Record<string, any>
    relationshipEntities?: Record<string, any>
    indexEntities?: Record<string, any>
    indexColumnEntities?: Record<string, any>
    memoEntities?: Record<string, any>
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function safeParse(json: string): ErdEditorJson {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

/**
 * Build a mapping from table name → table entity for quick lookup.
 */
function buildTableNameMap(
  tableEntities: Record<string, any>,
): Map<string, { id: string; entity: any }> {
  const map = new Map<string, { id: string; entity: any }>()
  for (const [id, table] of Object.entries(tableEntities)) {
    const name = (table.name || "").toLowerCase()
    if (name) {
      map.set(name, { id, entity: table })
    }
  }
  return map
}

/**
 * Collect all columnIds belonging to a table, including those
 * referenced in seqColumnIds.
 */
function getTableColumnIds(table: any): string[] {
  if (Array.isArray(table.columnIds)) return [...table.columnIds]
  if (Array.isArray(table.seqColumnIds)) return [...table.seqColumnIds]
  return []
}

/**
 * Compute the rightmost X position of existing tables so removed
 * tables can be placed to the right without overlapping.
 */
function getMaxRightX(tableEntities: Record<string, any>): number {
  let maxRight = 0
  for (const table of Object.values(tableEntities)) {
    const x = table.ui?.x ?? 0
    const width = table.ui?.widthName
      ? Math.max(250, table.ui.widthName + 100)
      : 250
    maxRight = Math.max(maxRight, x + width)
  }
  return maxRight + 80 // 80px gap
}

// ─── Main function ────────────────────────────────────────────────

/**
 * Merge two erd-editor JSON versions into a single annotated JSON
 * suitable for visual diff display.
 *
 * @param oldErdJson - The older version's erd-editor JSON string
 * @param newErdJson - The newer version's erd-editor JSON string
 * @param diffResult - The DiffResult from the backend API
 * @returns Merged erd-editor JSON string with ui.color annotations
 */
export function mergeVersionsForDisplay(
  oldErdJson: string,
  newErdJson: string,
  diffResult: DiffResult,
): string {
  const oldParsed = safeParse(oldErdJson)
  const newParsed = safeParse(newErdJson)

  const oldTables = oldParsed.collections?.tableEntities ?? {}
  const newTables = newParsed.collections?.tableEntities ?? {}
  const oldColumns = oldParsed.collections?.tableColumnEntities ?? {}
  const newColumns = newParsed.collections?.tableColumnEntities ?? {}

  const oldNameMap = buildTableNameMap(oldTables)
  const newNameMap = buildTableNameMap(newTables)

  // Build sets for quick lookup
  const addedNames = new Set(
    (diffResult.tables?.added ?? []).map((t) => t.name.toLowerCase()),
  )
  const removedNames = new Set(
    (diffResult.tables?.removed ?? []).map((t) => t.name.toLowerCase()),
  )
  const modifiedNames = new Set(
    (diffResult.tables?.modified ?? []).map((t) => t.tableName.toLowerCase()),
  )

  // ─── Build merged table entities ────────────────────────────────

  const mergedTableEntities: Record<string, any> = {}
  const mergedColumnEntities: Record<string, any> = {}
  const mergedTableIds: string[] = []
  let removedXOffset = 0

  // 1. Process tables from the NEW version (added, modified, unchanged)
  for (const [id, table] of Object.entries(newTables)) {
    const name = (table.name || "").toLowerCase()
    let color = COLOR_UNCHANGED

    if (addedNames.has(name)) {
      color = COLOR_ADDED
    } else if (modifiedNames.has(name)) {
      color = COLOR_MODIFIED
    }

    const annotatedTable = {
      ...table,
      ui: {
        ...(table.ui || {}),
        color,
      },
    }

    mergedTableEntities[id] = annotatedTable
    mergedTableIds.push(id)

    // Copy column entities for this table
    const columnIds = getTableColumnIds(table)
    for (const colId of columnIds) {
      if (newColumns[colId]) {
        mergedColumnEntities[colId] = { ...newColumns[colId] }
      }
    }
  }

  // 2. Process REMOVED tables from the OLD version
  // Place them to the right of the canvas to avoid overlap
  const baseRightX = getMaxRightX(mergedTableEntities)

  for (const name of removedNames) {
    const oldEntry = oldNameMap.get(name)
    if (!oldEntry) continue

    const { id: oldId, entity: oldTable } = oldEntry

    // Generate a unique ID to avoid collision with new version entities
    const removedId = `__removed_${oldId}`

    const annotatedTable = {
      ...oldTable,
      id: removedId,
      ui: {
        ...(oldTable.ui || {}),
        x: baseRightX + removedXOffset,
        y: oldTable.ui?.y ?? 100,
        color: COLOR_REMOVED,
      },
    }

    mergedTableEntities[removedId] = annotatedTable
    mergedTableIds.push(removedId)
    removedXOffset += 300 // space between removed tables

    // Copy column entities for removed table (with prefixed IDs)
    const columnIds = getTableColumnIds(oldTable)
    const newColumnIds: string[] = []
    for (const colId of columnIds) {
      if (oldColumns[colId]) {
        const removedColId = `__removed_${colId}`
        mergedColumnEntities[removedColId] = {
          ...oldColumns[colId],
          id: removedColId,
          tableId: removedId,
        }
        newColumnIds.push(removedColId)
      }
    }
    // Update the table's columnIds to use the new prefixed IDs
    annotatedTable.columnIds = newColumnIds
    annotatedTable.seqColumnIds = newColumnIds
  }

  // 3. Build merged JSON — start from the new version as the base
  const merged: ErdEditorJson = {
    $schema: newParsed.$schema || oldParsed.$schema,
    version: newParsed.version || oldParsed.version || "3.0.0",
    settings: newParsed.settings || oldParsed.settings || {},
    doc: {
      tableIds: mergedTableIds,
      relationshipIds: newParsed.doc?.relationshipIds ?? [],
      indexIds: newParsed.doc?.indexIds ?? [],
      memoIds: newParsed.doc?.memoIds ?? [],
    },
    collections: {
      tableEntities: mergedTableEntities,
      tableColumnEntities: mergedColumnEntities,
      relationshipEntities: newParsed.collections?.relationshipEntities ?? {},
      indexEntities: newParsed.collections?.indexEntities ?? {},
      indexColumnEntities:
        newParsed.collections?.indexColumnEntities ?? {},
      memoEntities: newParsed.collections?.memoEntities ?? {},
    },
  }

  return JSON.stringify(merged)
}

/**
 * Compute diff statistics from a DiffResult for display purposes.
 */
export function computeDiffStats(diffResult: DiffResult): {
  addedTables: number
  addedColumns: number
  modifiedTables: number
  modifiedColumns: number
  removedTables: number
  removedColumns: number
  totalChanges: number
} {
  const summary = diffResult.summary ?? {
    tablesAdded: 0,
    tablesRemoved: 0,
    tablesModified: 0,
    columnsAdded: 0,
    columnsRemoved: 0,
    columnsModified: 0,
    totalChanges: 0,
  }

  return {
    addedTables: summary.tablesAdded,
    addedColumns: summary.columnsAdded,
    modifiedTables: summary.tablesModified,
    modifiedColumns: summary.columnsModified,
    removedTables: summary.tablesRemoved,
    removedColumns: summary.columnsRemoved,
    totalChanges: summary.totalChanges,
  }
}
