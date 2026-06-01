/**
 * ERD Table Collapse Feature v2
 *
 * Strategy: modify the editor's JSON data model (columnIds) to show/hide columns,
 * so the erd-editor's internal layout engine recalculates everything including
 * relationship SVG line positions.
 *
 * When collapsed: table shows name + comment + relationship columns only.
 * When expanded: all columns are shown.
 * Relationship lines always connect correctly because the model drives the layout.
 * Card width auto-adapts with a configurable max-width.
 */

// ---- Shadow DOM access ----
const capturedShadowRoots = new WeakMap<Element, ShadowRoot>()

const originalAttachShadow = Element.prototype.attachShadow
Element.prototype.attachShadow = function (init: ShadowRootInit) {
  const root = originalAttachShadow.call(this, init)
  if (this.tagName?.toLowerCase() === "erd-editor") {
    capturedShadowRoots.set(this, root)
  }
  return root
}

// ---- CSS injected into shadow DOM ----
const COLLAPSE_CSS = `
/* Per-table collapse/expand button */
.erd-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s ease;
  fill: var(--active);
  margin-right: 2px;
}
.erd-collapse-btn:hover { opacity: 1; }
.erd-collapse-btn svg { width: 12px; height: 12px; }

/* Visual indicator for collapsed tables */
.table[data-collapsed="true"] > div:first-child > div:first-child {
  opacity: 0.6;
}

/* Max-width constraint for table cards */
.table {
  max-width: 450px !important;
}
`

// ---- SVG icons ----
const ICON_COLLAPSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
const ICON_EXPAND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`

// ---- State tracking ----
// Stores original columnIds per table when collapsed
const originalColumnIds = new Map<string, string[]>()
// Set of currently collapsed table IDs
const collapsedTables = new Set<string>()

// ---- Editor value helpers ----

function getEditorValue(editorEl: Element): any {
  try {
    const val = (editorEl as any).value
    return val ? JSON.parse(val) : null
  } catch {
    return null
  }
}

function setEditorValue(editorEl: Element, json: any) {
  try {
    ;(editorEl as any).value = JSON.stringify(json)
  } catch {
    // ignore
  }
}

/**
 * Get all column IDs that participate in relationships for a given table.
 */
function getRelationshipColumnIds(
  schema: any,
  tableId: string
): Set<string> {
  const relColumnIds = new Set<string>()
  if (!schema?.collections?.relationshipEntities) return relColumnIds

  const rels = Object.values(schema.collections.relationshipEntities) as any[]
  for (const rel of rels) {
    if (!rel) continue
    // Check start side
    if (rel.start?.tableId === tableId && Array.isArray(rel.start.columnIds)) {
      for (const cid of rel.start.columnIds) relColumnIds.add(cid)
    }
    // Check end side
    if (rel.end?.tableId === tableId && Array.isArray(rel.end.columnIds)) {
      for (const cid of rel.end.columnIds) relColumnIds.add(cid)
    }
  }
  return relColumnIds
}

// ---- Core collapse/expand logic ----

function collapseTableModel(editorEl: Element, tableId: string): boolean {
  const schema = getEditorValue(editorEl)
  if (!schema?.collections?.tableEntities?.[tableId]) return false

  const table = schema.collections.tableEntities[tableId]
  const allColumnIds: string[] = table.columnIds || []
  if (allColumnIds.length === 0) return false

  // Find relationship columns
  const relColIds = getRelationshipColumnIds(schema, tableId)

  // If all columns are relationship columns (or none are), collapse hides all
  const visibleCols = allColumnIds.filter((cid: string) => relColIds.has(cid))
  const hiddenCount = allColumnIds.length - visibleCols.length

  // If no columns to hide, still mark as collapsed (show header only)
  if (hiddenCount === 0 && relColIds.size === 0) {
    // No relationships - collapse to header only (hide all columns)
    originalColumnIds.set(tableId, [...allColumnIds])
    table.columnIds = []
  } else {
    // Store original, set to relationship columns only
    originalColumnIds.set(tableId, [...allColumnIds])
    table.columnIds = visibleCols
  }

  collapsedTables.add(tableId)
  setEditorValue(editorEl, schema)
  return true
}

function expandTableModel(editorEl: Element, tableId: string): boolean {
  const stored = originalColumnIds.get(tableId)
  if (!stored) return false

  const schema = getEditorValue(editorEl)
  if (!schema?.collections?.tableEntities?.[tableId]) return false

  schema.collections.tableEntities[tableId].columnIds = stored
  originalColumnIds.delete(tableId)
  collapsedTables.delete(tableId)
  setEditorValue(editorEl, schema)
  return true
}

// ---- Public API ----

export function getShadowRoot(editorEl: Element): ShadowRoot | null {
  return capturedShadowRoots.get(editorEl) ?? null
}

export function injectCollapseCSS(shadowRoot: ShadowRoot) {
  if (shadowRoot.querySelector("#erd-collapse-styles")) return
  const style = document.createElement("style")
  style.id = "erd-collapse-styles"
  style.textContent = COLLAPSE_CSS
  shadowRoot.appendChild(style)
}

function findAllTables(shadowRoot: ShadowRoot): Element[] {
  return Array.from(shadowRoot.querySelectorAll(".table[data-id]"))
}

/**
 * Inject the collapse/expand button into a table card header.
 */
function injectCollapseButton(tableEl: Element, editorEl: Element) {
  const tableId = tableEl.getAttribute("data-id")
  if (!tableId) return
  if (tableEl.querySelector(".erd-collapse-btn")) return

  const headerChildren = tableEl.firstElementChild?.children
  if (!headerChildren || headerChildren.length < 2) return

  // Find the button container (div with plus/xmark icons, not color bar or input area)
  let buttonArea: Element | null = null
  for (let i = 0; i < headerChildren.length; i++) {
    const child = headerChildren[i] as Element
    if (
      !child.classList.contains("table-header-color") &&
      !child.querySelector(".input-padding") &&
      !child.querySelector("[data-type]") &&
      child.children.length > 0
    ) {
      buttonArea = child
      break
    }
  }
  if (!buttonArea) return

  const btn = document.createElement("div")
  btn.className = "erd-collapse-btn"
  btn.title = "Collapse/Expand"
  btn.innerHTML = collapsedTables.has(tableId) ? ICON_EXPAND : ICON_COLLAPSE
  btn.addEventListener("click", (e) => {
    e.stopPropagation()
    toggleTableCollapse(editorEl, tableId, btn)
  })

  buttonArea.insertBefore(btn, buttonArea.firstChild)
}

function toggleTableCollapse(
  editorEl: Element,
  tableId: string,
  btn: Element
) {
  if (collapsedTables.has(tableId)) {
    if (expandTableModel(editorEl, tableId)) {
      btn.innerHTML = ICON_COLLAPSE
    }
  } else {
    if (collapseTableModel(editorEl, tableId)) {
      btn.innerHTML = ICON_EXPAND
    }
  }
}

/**
 * Collapse all tables.
 */
export function collapseAllTables(editorEl: Element) {
  const schema = getEditorValue(editorEl)
  if (!schema?.collections?.tableEntities) return

  const tableIds = Object.keys(schema.collections.tableEntities)
  for (const tid of tableIds) {
    if (!collapsedTables.has(tid)) {
      collapseTableModel(editorEl, tid)
    }
  }
}

/**
 * Expand all tables.
 */
export function expandAllTables(editorEl: Element) {
  const ids = [...collapsedTables]
  for (const tid of ids) {
    expandTableModel(editorEl, tid)
  }
}

/**
 * Check if all tables are collapsed.
 */
export function areAllTablesCollapsed(editorEl: Element): boolean {
  const schema = getEditorValue(editorEl)
  if (!schema?.collections?.tableEntities) return false
  const tableIds = Object.keys(schema.collections.tableEntities)
  if (tableIds.length === 0) return false
  return tableIds.every((tid) => collapsedTables.has(tid))
}

/**
 * Initialize the collapse feature for an erd-editor element.
 * Sets up MutationObserver to inject buttons into table cards as they appear.
 * Returns a cleanup function.
 */
export function initCollapseFeature(editorEl: Element): () => void {
  const shadowRoot = getShadowRoot(editorEl)
  if (!shadowRoot) {
    console.warn("[erd-collapse] Could not access shadow root")
    return () => {}
  }

  injectCollapseCSS(shadowRoot)

  const processExisting = () => {
    const tables = findAllTables(shadowRoot)
    tables.forEach((table) => injectCollapseButton(table, editorEl))
  }

  const observer = new MutationObserver(() => {
    processExisting()
  })

  observer.observe(shadowRoot, {
    childList: true,
    subtree: true,
  })

  // Initial + delayed processing
  processExisting()
  const timer1 = setTimeout(processExisting, 500)
  const timer2 = setTimeout(processExisting, 1500)

  return () => {
    observer.disconnect()
    clearTimeout(timer1)
    clearTimeout(timer2)
  }
}
