/**
 * PostgreSQL SQL to erd-editor v3.0.0 JSON converter
 *
 * Handles PG-specific syntax that @dineug/erd-editor's built-in parser misses:
 * - COMMENT ON TABLE / COMMENT ON COLUMN statements
 * - Multi-word data types (DOUBLE PRECISION, TIMESTAMP WITH TIME ZONE, etc.)
 * - SERIAL/BIGSERIAL as auto-increment
 * - PG-style quoted identifiers ("columnName")
 *
 * Output format matches erd-editor v3.0.0 schema:
 * { $schema, version, settings, doc, collections }
 */

// Column options bitmask (erd-editor v3.0.0)
const OPT_AUTO_INCREMENT = 1
const OPT_PRIMARY_KEY = 2
const OPT_UNIQUE = 4
const OPT_NOT_NULL = 8

// Database enum (erd-editor v3.0.0)
const DB_POSTGRESQL = 16

// Show bitmask
const SHOW_TABLE_COMMENT = 1
const SHOW_COLUMN_COMMENT = 2
const SHOW_COLUMN_DATA_TYPE = 4
const SHOW_COLUMN_PRIMARY_KEY = 32
const SHOW_COLUMN_NOT_NULL = 128
const SHOW_RELATIONSHIP = 256
const SHOW_ALL =
  SHOW_TABLE_COMMENT |
  SHOW_COLUMN_COMMENT |
  SHOW_COLUMN_DATA_TYPE |
  SHOW_COLUMN_PRIMARY_KEY |
  SHOW_COLUMN_NOT_NULL |
  SHOW_RELATIONSHIP // = 423

// Column order enum values
const COL_ORDER = [1, 2, 4, 8, 16, 32, 64]

interface ParsedColumn {
  name: string
  dataType: string
  default: string
  comment: string
  primaryKey: boolean
  notNull: boolean
  unique: boolean
  autoIncrement: boolean
}

interface ParsedTable {
  name: string
  comment: string
  columns: ParsedColumn[]
  primaryKeys: string[]
  uniques: string[]
}

interface ParsedForeignKey {
  fromTable: string
  fromColumns: string[]
  toTable: string
  toColumns: string[]
}

const MULTI_WORD_TYPES = [
  "TIMESTAMP WITH TIME ZONE",
  "TIMESTAMP WITHOUT TIME ZONE",
  "TIME WITH TIME ZONE",
  "TIME WITHOUT TIME ZONE",
  "DOUBLE PRECISION",
  "CHARACTER VARYING",
  "BIT VARYING",
]

const SERIAL_TYPES = new Set([
  "SERIAL",
  "SERIAL2",
  "SERIAL4",
  "SERIAL8",
  "BIGSERIAL",
  "SMALLSERIAL",
])

const PG_SINGLE_TYPES = new Set([
  "BIGINT", "BIT", "BOOL", "BOOLEAN", "BOX", "BYTEA", "CHAR", "CHARACTER",
  "CIDR", "CIRCLE", "DATE", "DECIMAL", "DOUBLE", "FLOAT4", "FLOAT8", "INET",
  "INT", "INT2", "INT4", "INT8", "INTEGER", "INTERVAL", "JSON", "JSONB",
  "LINE", "LSEG", "MACADDR", "MACADDR8", "MONEY", "NUMERIC", "PATH",
  "PG_LSN", "POINT", "POLYGON", "REAL", "SMALLINT", "TEXT", "TIME",
  "TIMESTAMP", "TIMESTAMPTZ", "TIMETZ", "TSQUERY", "TSVECTOR",
  "TXID_SNAPSHOT", "UUID", "VARBIT", "VARCHAR", "XML",
])

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith("`") && s.endsWith("`"))
  ) {
    return s.slice(1, -1)
  }
  return s
}

function removeComments(sql: string): string {
  let result = sql.replace(/--[^\n]*/g, "")
  result = result.replace(/\/\*[\s\S]*?\*\//g, "")
  return result
}

function splitStatements(sql: string): string[] {
  const stmts: string[] = []
  let cur = ""
  let inSQ = false
  let inDQ = false
  let depth = 0
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'" && !inDQ) inSQ = !inSQ
    else if (ch === '"' && !inSQ) inDQ = !inDQ
    else if (ch === "(" && !inSQ && !inDQ) depth++
    else if (ch === ")" && !inSQ && !inDQ) depth--
    else if (ch === ";" && !inSQ && !inDQ && depth <= 0) {
      const s = cur.trim()
      if (s) stmts.push(s)
      cur = ""
      continue
    }
    cur += ch
  }
  const last = cur.trim()
  if (last) stmts.push(last)
  return stmts
}

function splitByComma(s: string): string[] {
  const parts: string[] = []
  let cur = ""
  let depth = 0
  let inSQ = false
  let inDQ = false
  for (const ch of s) {
    if (ch === "'" && !inDQ) inSQ = !inSQ
    else if (ch === '"' && !inSQ) inDQ = !inDQ
    else if (ch === "(" && !inSQ && !inDQ) depth++
    else if (ch === ")" && !inSQ && !inDQ) depth--
    else if (ch === "," && !inSQ && !inDQ && depth === 0) {
      parts.push(cur.trim())
      cur = ""
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function findMatchingParen(s: string, openPos: number): number {
  let depth = 0
  let inSQ = false
  let inDQ = false
  for (let i = openPos; i < s.length; i++) {
    const ch = s[i]
    if (ch === "'" && !inDQ) inSQ = !inSQ
    else if (ch === '"' && !inSQ) inDQ = !inDQ
    else if (!inSQ && !inDQ) {
      if (ch === "(") depth++
      else if (ch === ")") { depth--; if (depth === 0) return i }
    }
  }
  return -1
}

function parseColumnDef(def: string): ParsedColumn {
  const col: ParsedColumn = {
    name: "", dataType: "", default: "", comment: "",
    primaryKey: false, notNull: false, unique: false, autoIncrement: false,
  }

  const trimmed = def.trim()
  let pos = 0

  // Extract column name
  if (trimmed[0] === '"') {
    const end = trimmed.indexOf('"', 1)
    if (end > 0) { col.name = trimmed.slice(1, end); pos = end + 1 }
  } else {
    const sp = trimmed.search(/\s/)
    if (sp > 0) { col.name = trimmed.slice(0, sp); pos = sp }
    else { col.name = trimmed; return col }
  }

  const rest = trimmed.slice(pos).trim()
  const restUpper = rest.toUpperCase()

  // Try multi-word data types
  let matched = false
  for (const mwt of MULTI_WORD_TYPES) {
    if (restUpper.startsWith(mwt)) {
      col.dataType = mwt
      let afterPos = mwt.length
      const after = rest.slice(afterPos).trim()
      if (after.startsWith("(")) {
        const cp = after.indexOf(")")
        if (cp > 0) { col.dataType += after.slice(0, cp + 1); afterPos = rest.length - after.length + cp + 1 }
      }
      parseConstraints(rest.slice(afterPos).trim(), col)
      matched = true
      break
    }
  }

  if (!matched) {
    // Single-word type
    const tokens = tokenizeRest(rest)
    if (tokens.length > 0) {
      const dtUpper = tokens[0].toUpperCase()
      col.dataType = tokens[0]
      let ci = 1
      // Check for size: "VARCHAR" "(" "255" ")" or "VARCHAR(255)"
      if (tokens.length > 1 && tokens[1].startsWith("(")) {
        let sp = ""
        for (let i = 1; i < tokens.length; i++) {
          sp += tokens[i]; ci = i + 1
          if (tokens[i].includes(")")) break
        }
        col.dataType += sp
      } else if (tokens[0].includes("(")) {
        // Already has size like "VARCHAR(255)"
      }
      parseConstraints(tokens.slice(ci).join(" "), col)
    }
  }

  // SERIAL types → autoIncrement
  if (SERIAL_TYPES.has(col.dataType.toUpperCase().split("(")[0])) {
    col.autoIncrement = true
    col.notNull = true
  }

  return col
}

function tokenizeRest(s: string): string[] {
  const tokens: string[] = []
  let cur = ""
  let depth = 0
  for (const ch of s) {
    if (ch === "(") { depth++; cur += ch }
    else if (ch === ")") { depth--; cur += ch }
    else if (/\s/.test(ch) && depth === 0) {
      if (cur) { tokens.push(cur); cur = "" }
    } else cur += ch
  }
  if (cur) tokens.push(cur)
  return tokens
}

function parseConstraints(s: string, col: ParsedColumn) {
  const u = s.toUpperCase()
  if (u.includes("PRIMARY KEY")) { col.primaryKey = true; col.notNull = true }
  if (u.includes("NOT NULL")) col.notNull = true
  if (u.includes("UNIQUE")) col.unique = true
  if (u.includes("GENERATED") || u.includes("AUTO_INCREMENT")) {
    col.autoIncrement = true; col.notNull = true
  }
  const dm = s.match(/DEFAULT\s+('(?:[^'\\]|\\.)*'|\S+(?:\([^)]*\))?)/i)
  if (dm) col.default = stripQuotes(dm[1])
  const cm = s.match(/COMMENT\s+'((?:[^'\\]|\\.)*)'/i)
  if (cm) col.comment = cm[1]
}

function parseCreateTable(stmt: string): ParsedTable | null {
  const m = stmt.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([^"(.\s]+)"?\."?)?"?([^"(\s]+)"?\s*\(/i
  )
  if (!m) return null
  const tableName = stripQuotes(m[2] || m[1])
  const op = stmt.indexOf("(")
  const cp = findMatchingParen(stmt, op)
  if (cp < 0) return null
  const body = stmt.slice(op + 1, cp)
  const defs = splitByComma(body)

  const table: ParsedTable = {
    name: tableName, comment: "", columns: [], primaryKeys: [], uniques: [],
  }

  for (const d of defs) {
    const td = d.trim()
    const ud = td.toUpperCase()
    if (ud.startsWith("CONSTRAINT") || ud.startsWith("CHECK") ||
        ud.startsWith("FOREIGN KEY") || ud.startsWith("EXCLUDE")) {
      extractPKUK(td, table)
      continue
    }
    if (ud.startsWith("PRIMARY KEY")) {
      const pm = td.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
      if (pm) table.primaryKeys.push(...pm[1].split(",").map(c => stripQuotes(c.trim())))
      continue
    }
    if (ud.startsWith("UNIQUE")) {
      const um = td.match(/UNIQUE\s*\(([^)]+)\)/i)
      if (um) table.uniques.push(...um[1].split(",").map(c => stripQuotes(c.trim())))
      continue
    }
    const col = parseColumnDef(td)
    if (col.name) table.columns.push(col)
  }

  // Apply table-level PK/UK
  for (const pk of table.primaryKeys) {
    const c = table.columns.find(c => c.name.toUpperCase() === pk.toUpperCase())
    if (c) { c.primaryKey = true; c.notNull = true }
  }
  for (const uk of table.uniques) {
    const c = table.columns.find(c => c.name.toUpperCase() === uk.toUpperCase())
    if (c) c.unique = true
  }

  // MySQL-style table comment
  const after = stmt.slice(cp + 1).trim()
  const tcm = after.match(/COMMENT\s*=?\s*'((?:[^'\\]|\\.)*)'/i)
  if (tcm) table.comment = tcm[1]

  return table
}

function extractPKUK(td: string, table: ParsedTable) {
  const u = td.toUpperCase()
  if (u.includes("PRIMARY KEY")) {
    const m = td.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
    if (m) table.primaryKeys.push(...m[1].split(",").map(c => stripQuotes(c.trim())))
  }
  if (u.includes("UNIQUE") && !u.includes("PRIMARY")) {
    const m = td.match(/UNIQUE\s*\(([^)]+)\)/i)
    if (m) table.uniques.push(...m[1].split(",").map(c => stripQuotes(c.trim())))
  }
}

function parseCommentOn(stmt: string): { type: "table" | "column"; tableName: string; columnName?: string; comment: string } | null {
  const tm = stmt.match(
    /COMMENT\s+ON\s+TABLE\s+"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s+IS\s+'((?:[^'\\]|\\'|'')*)'/i
  )
  if (tm) return { type: "table", tableName: stripQuotes(tm[2] || tm[1]), comment: tm[3].replace(/''/g, "'") }

  const cm = stmt.match(
    /COMMENT\s+ON\s+COLUMN\s+"?([^".\s]+)"?(?:\."?([^".\s]+)"?)?\.\"?([^"\s]+)\"?\s+IS\s+'((?:[^'\\]|\\'|'')*)'/i
  )
  if (cm) return { type: "column", tableName: stripQuotes(cm[2] || cm[1]), columnName: stripQuotes(cm[3]), comment: cm[4].replace(/''/g, "'") }

  return null
}

function parseAlterPK(stmt: string): { tableName: string; columns: string[] } | null {
  const m = stmt.match(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s+ADD\s+(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i
  )
  if (m) return { tableName: stripQuotes(m[2] || m[1]), columns: m[3].split(",").map(c => stripQuotes(c.trim())) }
  return null
}

function parseAlterFK(stmt: string): ParsedForeignKey | null {
  const m = stmt.match(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s+ADD\s+(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s*\(([^)]+)\)/i
  )
  if (m) return {
    fromTable: stripQuotes(m[2] || m[1]),
    fromColumns: m[3].split(",").map(c => stripQuotes(c.trim())),
    toTable: stripQuotes(m[5] || m[4]),
    toColumns: m[6].split(",").map(c => stripQuotes(c.trim())),
  }
  return null
}

let _idC = 0
function gid(): string { return `pg${Date.now().toString(36)}${(++_idC).toString(36)}` }

/**
 * Convert PostgreSQL SQL to erd-editor v3.0.0 JSON format.
 */
export function parsePgSqlToErdJson(sql: string): string {
  const cleaned = removeComments(sql)
  const stmts = splitStatements(cleaned)

  const tables: ParsedTable[] = []
  const tableMap = new Map<string, ParsedTable>()
  const fks: ParsedForeignKey[] = []
  const tblComments = new Map<string, string>()
  const colComments = new Map<string, string>()

  for (const s of stmts) {
    const u = s.trim().toUpperCase()
    if (u.startsWith("CREATE TABLE")) {
      const t = parseCreateTable(s)
      if (t) { tables.push(t); tableMap.set(t.name.toUpperCase(), t) }
    } else if (u.startsWith("COMMENT ON")) {
      const c = parseCommentOn(s)
      if (c) {
        if (c.type === "table") tblComments.set(c.tableName.toUpperCase(), c.comment)
        else if (c.columnName) colComments.set(`${c.tableName.toUpperCase()}.${c.columnName.toUpperCase()}`, c.comment)
      }
    } else if (u.startsWith("ALTER TABLE")) {
      const pk = parseAlterPK(s)
      if (pk) {
        const t = tableMap.get(pk.tableName.toUpperCase())
        if (t) for (const cn of pk.columns) {
          const c = t.columns.find(c => c.name.toUpperCase() === cn.toUpperCase())
          if (c) { c.primaryKey = true; c.notNull = true }
        }
      }
      const fk = parseAlterFK(s)
      if (fk) fks.push(fk)
    }
  }

  // Apply comments
  for (const t of tables) {
    const tc = tblComments.get(t.name.toUpperCase())
    if (tc && !t.comment) t.comment = tc
    for (const c of t.columns) {
      const cc = colComments.get(`${t.name.toUpperCase()}.${c.name.toUpperCase()}`)
      if (cc && !c.comment) c.comment = cc
    }
  }

  // Build v3.0.0 JSON
  const tableEntities: Record<string, any> = {}
  const tableColumnEntities: Record<string, any> = {}
  const relationshipEntities: Record<string, any> = {}

  const tableIds: string[] = []
  const relationshipIds: string[] = []
  const tblIdMap = new Map<string, string>()
  const colIdMap = new Map<string, string>()

  const COLS = 4, TW = 300, TH = 250, GX = 100, GY = 80
  const ts = Date.now()

  tables.forEach((table, ti) => {
    const tid = gid()
    tblIdMap.set(table.name.toUpperCase(), tid)
    tableIds.push(tid)

    const colIds: string[] = []
    let mwN = 60, mwC = 60, mwD = 60, mwDf = 60

    for (const c of table.columns) {
      const cid = gid()
      colIds.push(cid)
      colIdMap.set(`${table.name.toUpperCase()}.${c.name.toUpperCase()}`, cid)

      let opts = 0
      if (c.autoIncrement) opts |= OPT_AUTO_INCREMENT
      if (c.primaryKey) opts |= OPT_PRIMARY_KEY
      if (c.unique) opts |= OPT_UNIQUE
      if (c.notNull) opts |= OPT_NOT_NULL

      const keys = c.primaryKey ? 1 : 0

      tableColumnEntities[cid] = {
        id: cid, tableId: tid, name: c.name, comment: c.comment,
        dataType: c.dataType, default: c.default, options: opts,
        ui: {
          keys,
          widthName: Math.max(60, c.name.length * 8),
          widthComment: Math.max(60, c.comment.length * 8),
          widthDataType: Math.max(60, c.dataType.length * 8),
          widthDefault: Math.max(60, c.default.length * 8),
        },
        meta: { updateAt: ts, createAt: ts },
      }
      mwN = Math.max(mwN, c.name.length * 8)
      mwC = Math.max(mwC, c.comment.length * 8)
      mwD = Math.max(mwD, c.dataType.length * 8)
      mwDf = Math.max(mwDf, c.default.length * 8)
    }

    const row = Math.floor(ti / COLS), col = ti % COLS
    tableEntities[tid] = {
      id: tid, name: table.name, comment: table.comment,
      columnIds: colIds, seqColumnIds: [...colIds],
      ui: {
        x: 100 + col * (TW + GX), y: 100 + row * (TH + GY),
        zIndex: 2 + ti, widthName: mwN, widthComment: mwC, color: "",
      },
      meta: { updateAt: ts, createAt: ts },
    }
  })

  // Relationships
  for (const fk of fks) {
    const stId = tblIdMap.get(fk.fromTable.toUpperCase())
    const enId = tblIdMap.get(fk.toTable.toUpperCase())
    if (!stId || !enId) continue
    const sColIds = fk.fromColumns.map(n => colIdMap.get(`${fk.fromTable.toUpperCase()}.${n.toUpperCase()}`)).filter(Boolean)
    const eColIds = fk.toColumns.map(n => colIdMap.get(`${fk.toTable.toUpperCase()}.${n.toUpperCase()}`)).filter(Boolean)
    if (!sColIds.length || !eColIds.length) continue
    const rid = gid()
    relationshipIds.push(rid)
    relationshipEntities[rid] = {
      id: rid, identification: false, relationshipType: 4,
      startRelationshipType: 2,
      start: { tableId: stId, columnIds: sColIds, x: 0, y: 0, direction: 8 },
      end: { tableId: enId, columnIds: eColIds, x: 0, y: 0, direction: 8 },
      meta: { updateAt: ts, createAt: ts },
    }
  }

  return JSON.stringify({
    $schema: "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",
    version: "3.0.0",
    settings: {
      width: 2000, height: 2000, scrollTop: 0, scrollLeft: 0, zoomLevel: 1,
      show: SHOW_ALL,
      database: DB_POSTGRESQL,
      databaseName: "",
      canvasType: "ERD",
      language: 1,
      tableNameCase: 4,
      columnNameCase: 2,
      bracketType: 1,
      relationshipDataTypeSync: true,
      relationshipOptimization: false,
      columnOrder: COL_ORDER,
      maxWidthComment: -1,
      ignoreSaveSettings: 0,
    },
    doc: {
      tableIds,
      relationshipIds,
      indexIds: [],
      memoIds: [],
    },
    collections: {
      tableEntities,
      tableColumnEntities,
      relationshipEntities,
      indexEntities: {},
      indexColumnEntities: {},
      memoEntities: {},
    },
  })
}

/**
 * Detect if SQL is PostgreSQL syntax.
 */
export function isPgSql(sql: string): boolean {
  const u = sql.toUpperCase()
  return (
    u.includes("COMMENT ON TABLE") ||
    u.includes("COMMENT ON COLUMN") ||
    u.includes("BIGSERIAL") ||
    u.includes("SMALLSERIAL") ||
    u.includes("TIMESTAMP WITH") ||
    u.includes("TIMESTAMP WITHOUT") ||
    u.includes("CHARACTER VARYING") ||
    u.includes("DOUBLE PRECISION") ||
    u.includes("GENERATED ALWAYS AS IDENTITY") ||
    u.includes("GENERATED BY DEFAULT AS IDENTITY") ||
    u.includes("SERIAL") && !u.includes("AUTO_INCREMENT")
  )
}
