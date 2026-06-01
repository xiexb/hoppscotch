/**
 * PostgreSQL SQL to erd-editor JSON converter
 *
 * Handles PG-specific syntax that @dineug/erd-editor's built-in parser misses:
 * - COMMENT ON TABLE / COMMENT ON COLUMN statements
 * - Multi-word data types (DOUBLE PRECISION, TIMESTAMP WITH TIME ZONE, etc.)
 * - SERIAL/BIGSERIAL as auto-increment
 * - PG-style quoted identifiers ("columnName")
 */

// erd-editor column options bitmask
const ColumnOption = {
  primaryKey: 1,
  notNull: 2,
  unique: 4,
  autoIncrement: 8,
} as const;

interface ParsedColumn {
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  autoIncrement: boolean;
}

interface ParsedTable {
  name: string;
  comment: string;
  columns: ParsedColumn[];
  primaryKeys: string[];
  uniques: string[];
}

interface ParsedForeignKey {
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
}

// Multi-word PG data types that the tokenizer splits incorrectly
const MULTI_WORD_TYPES = [
  "DOUBLE PRECISION",
  "CHARACTER VARYING",
  "BIT VARYING",
  "TIMESTAMP WITH TIME ZONE",
  "TIMESTAMP WITHOUT TIME ZONE",
  "TIME WITH TIME ZONE",
  "TIME WITHOUT TIME ZONE",
];

// SERIAL types that imply auto-increment
const SERIAL_TYPES = [
  "SERIAL",
  "SERIAL2",
  "SERIAL4",
  "SERIAL8",
  "BIGSERIAL",
  "SMALLSERIAL",
];

// All known PG single-word data types
const PG_SINGLE_TYPES = new Set([
  "BIGINT",
  "BIGSERIAL",
  "BIT",
  "BOOL",
  "BOOLEAN",
  "BOX",
  "BYTEA",
  "CHAR",
  "CHARACTER",
  "CIDR",
  "CIRCLE",
  "DATE",
  "DECIMAL",
  "DOUBLE",
  "FLOAT4",
  "FLOAT8",
  "INET",
  "INT",
  "INT2",
  "INT4",
  "INT8",
  "INTEGER",
  "INTERVAL",
  "JSON",
  "JSONB",
  "LINE",
  "LSEG",
  "MACADDR",
  "MACADDR8",
  "MONEY",
  "NUMERIC",
  "PATH",
  "PG_LSN",
  "POINT",
  "POLYGON",
  "REAL",
  "SERIAL",
  "SERIAL2",
  "SERIAL4",
  "SERIAL8",
  "SMALLINT",
  "SMALLSERIAL",
  "TEXT",
  "TIME",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "TIMETZ",
  "TSQUERY",
  "TSVECTOR",
  "TXID_SNAPSHOT",
  "UUID",
  "VARBIT",
  "VARCHAR",
  "XML",
]);

function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith("`") && s.endsWith("`"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function removeComments(sql: string): string {
  // Remove single-line comments
  let result = sql.replace(/--[^\n]*/g, "");
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

/**
 * Split SQL into statements, respecting quoted strings and parentheses.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === "(" && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
    } else if (ch === ")" && !inSingleQuote && !inDoubleQuote) {
      parenDepth--;
    } else if (ch === ";" && !inSingleQuote && !inDoubleQuote && parenDepth <= 0) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      continue;
    }

    current += ch;
  }

  const last = current.trim();
  if (last) statements.push(last);

  return statements;
}

/**
 * Parse a column definition from a CREATE TABLE statement.
 * Handles multi-word data types and PG-specific syntax.
 */
function parseColumnDef(def: string): ParsedColumn {
  const col: ParsedColumn = {
    name: "",
    dataType: "",
    default: "",
    comment: "",
    primaryKey: false,
    notNull: false,
    unique: false,
    autoIncrement: false,
  };

  // Extract column name (first token, possibly quoted)
  const trimmed = def.trim();
  let pos = 0;

  if (trimmed[0] === '"') {
    const endQuote = trimmed.indexOf('"', 1);
    if (endQuote > 0) {
      col.name = trimmed.slice(1, endQuote);
      pos = endQuote + 1;
    }
  } else {
    const spaceIdx = trimmed.search(/\s/);
    if (spaceIdx > 0) {
      col.name = trimmed.slice(0, spaceIdx);
      pos = spaceIdx;
    } else {
      col.name = trimmed;
      return col;
    }
  }

  // Rest of the definition after column name
  const rest = trimmed.slice(pos).trim();

  // Try to match multi-word data types first
  const restUpper = rest.toUpperCase();
  let matchedType = "";
  let typeEndPos = 0;

  for (const mwt of MULTI_WORD_TYPES) {
    if (restUpper.startsWith(mwt)) {
      matchedType = mwt;
      typeEndPos = mwt.length;
      break;
    }
  }

  if (matchedType) {
    col.dataType = matchedType;
    // Check for size specifier like (10)
    const afterType = rest.slice(typeEndPos).trim();
    if (afterType.startsWith("(")) {
      const closeParen = afterType.indexOf(")");
      if (closeParen > 0) {
        col.dataType += afterType.slice(0, closeParen + 1);
        typeEndPos = rest.length - afterType.length + closeParen + 1;
      }
    }
    parseColumnConstraints(rest.slice(typeEndPos).trim(), col);
  } else {
    // Single-word data type
    const tokens = tokenizeColumnRest(rest);
    if (tokens.length > 0) {
      let dataType = tokens[0];
      const dataTypeUpper = dataType.toUpperCase();

      // Check if it's a known PG type
      if (PG_SINGLE_TYPES.has(dataTypeUpper)) {
        col.dataType = dataType;
      } else {
        // Custom type (e.g., user-defined enum), keep it
        col.dataType = dataType;
      }

      // Check for size specifier
      if (tokens.length > 1 && tokens[1].startsWith("(")) {
        // Size might be split: "VARCHAR" "(" "255" ")"
        let sizePart = "";
        let constraintStart = 1;
        for (let i = 1; i < tokens.length; i++) {
          sizePart += tokens[i];
          constraintStart = i + 1;
          if (tokens[i].includes(")")) break;
        }
        col.dataType += sizePart;
        parseColumnConstraints(
          tokens.slice(constraintStart).join(" "),
          col
        );
      } else {
        parseColumnConstraints(tokens.slice(1).join(" "), col);
      }
    }
  }

  // Check if serial type
  if (SERIAL_TYPES.includes(col.dataType.toUpperCase().split("(")[0])) {
    col.autoIncrement = true;
    col.notNull = true;
  }

  return col;
}

function tokenizeColumnRest(s: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inParen = 0;

  for (const ch of s) {
    if (ch === "(") {
      inParen++;
      current += ch;
    } else if (ch === ")") {
      inParen--;
      current += ch;
    } else if (/\s/.test(ch) && inParen === 0) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseColumnConstraints(constraintStr: string, col: ParsedColumn): void {
  const upper = constraintStr.toUpperCase();

  if (upper.includes("PRIMARY KEY")) {
    col.primaryKey = true;
    col.notNull = true;
  }
  if (upper.includes("NOT NULL")) {
    col.notNull = true;
  }
  if (upper.includes("UNIQUE")) {
    col.unique = true;
  }
  if (
    upper.includes("SERIAL") ||
    upper.includes("GENERATED") ||
    upper.includes("AUTO_INCREMENT")
  ) {
    col.autoIncrement = true;
    col.notNull = true;
  }

  // Extract DEFAULT value
  const defaultMatch = constraintStr.match(
    /DEFAULT\s+('(?:[^'\\]|\\.)*'|\S+(?:\([^)]*\))?)/i
  );
  if (defaultMatch) {
    col.default = stripQuotes(defaultMatch[1]);
  }

  // Extract inline COMMENT (MySQL style, sometimes in PG dumps)
  const commentMatch = constraintStr.match(/COMMENT\s+'((?:[^'\\]|\\.)*)'/i);
  if (commentMatch) {
    col.comment = commentMatch[1];
  }
}

/**
 * Parse a CREATE TABLE statement.
 */
function parseCreateTable(stmt: string): ParsedTable | null {
  // Match: CREATE TABLE [IF NOT EXISTS] [schema.]tableName (...)
  const match = stmt.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([^"(.\s]+)"?\."?)?"?([^"(\s]+)"?\s*\(/i
  );
  if (!match) return null;

  const tableName = stripQuotes(match[2] || match[1]);

  // Extract the content between the outermost parentheses
  const openParen = stmt.indexOf("(");
  const closeParen = findMatchingParen(stmt, openParen);
  if (closeParen < 0) return null;

  const body = stmt.slice(openParen + 1, closeParen);

  // Split column definitions by comma, respecting parentheses and quotes
  const colDefs = splitByComma(body);

  const table: ParsedTable = {
    name: tableName,
    comment: "",
    columns: [],
    primaryKeys: [],
    uniques: [],
  };

  for (const def of colDefs) {
    const trimmedDef = def.trim();
    const upperDef = trimmedDef.toUpperCase();

    // Skip table-level constraints
    if (
      upperDef.startsWith("CONSTRAINT") ||
      upperDef.startsWith("CHECK") ||
      upperDef.startsWith("FOREIGN KEY") ||
      upperDef.startsWith("EXCLUDE")
    ) {
      // But extract PRIMARY KEY columns
      if (upperDef.includes("PRIMARY KEY")) {
        const pkMatch = trimmedDef.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const cols = pkMatch[1].split(",").map((c) => stripQuotes(c.trim()));
          table.primaryKeys.push(...cols);
        }
      }
      if (upperDef.includes("UNIQUE")) {
        const uqMatch = trimmedDef.match(/UNIQUE\s*\(([^)]+)\)/i);
        if (uqMatch) {
          const cols = uqMatch[1].split(",").map((c) => stripQuotes(c.trim()));
          table.uniques.push(...cols);
        }
      }
      continue;
    }

    if (upperDef.startsWith("PRIMARY KEY")) {
      const pkMatch = trimmedDef.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(",").map((c) => stripQuotes(c.trim()));
        table.primaryKeys.push(...cols);
      }
      continue;
    }

    if (upperDef.startsWith("UNIQUE")) {
      const uqMatch = trimmedDef.match(/UNIQUE\s*\(([^)]+)\)/i);
      if (uqMatch) {
        const cols = uqMatch[1].split(",").map((c) => stripQuotes(c.trim()));
        table.uniques.push(...cols);
      }
      continue;
    }

    const col = parseColumnDef(trimmedDef);
    if (col.name) {
      table.columns.push(col);
    }
  }

  // Apply table-level PRIMARY KEY and UNIQUE constraints
  for (const pkCol of table.primaryKeys) {
    const col = table.columns.find(
      (c) => c.name.toUpperCase() === pkCol.toUpperCase()
    );
    if (col) {
      col.primaryKey = true;
      col.notNull = true;
    }
  }
  for (const uqCol of table.uniques) {
    const col = table.columns.find(
      (c) => c.name.toUpperCase() === uqCol.toUpperCase()
    );
    if (col) {
      col.unique = true;
    }
  }

  // Extract table comment from MySQL-style: ) COMMENT 'xxx'
  const afterClose = stmt.slice(closeParen + 1).trim();
  const tableCommentMatch = afterClose.match(/COMMENT\s*=?\s*'((?:[^'\\]|\\.)*)'/i);
  if (tableCommentMatch) {
    table.comment = tableCommentMatch[1];
  }

  return table;
}

function findMatchingParen(s: string, openPos: number): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = openPos; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function splitByComma(s: string): string[] {
  const parts: string[] = [];
  let current = "";
  let parenDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === "(" && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
    } else if (ch === ")" && !inSingleQuote && !inDoubleQuote) {
      parenDepth--;
    } else if (ch === "," && !inSingleQuote && !inDoubleQuote && parenDepth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Parse COMMENT ON statements.
 */
function parseCommentOn(stmt: string): {
  type: "table" | "column";
  tableName: string;
  columnName?: string;
  comment: string;
} | null {
  // COMMENT ON TABLE tableName IS 'xxx'
  const tableMatch = stmt.match(
    /COMMENT\s+ON\s+TABLE\s+"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s+IS\s+'((?:[^'\\]|\\'|'')*)'/i
  );
  if (tableMatch) {
    return {
      type: "table",
      tableName: stripQuotes(tableMatch[2] || tableMatch[1]),
      comment: tableMatch[3].replace(/''/g, "'"),
    };
  }

  // COMMENT ON COLUMN tableName.columnName IS 'xxx'
  const colMatch = stmt.match(
    /COMMENT\s+ON\s+COLUMN\s+"?([^".\s]+)"?(?:\."?([^".\s]+)"?)?\.\"?([^"\s]+)\"?\s+IS\s+'((?:[^'\\]|\\'|'')*)'/i
  );
  if (colMatch) {
    return {
      type: "column",
      tableName: stripQuotes(colMatch[2] || colMatch[1]),
      columnName: stripQuotes(colMatch[3]),
      comment: colMatch[4].replace(/''/g, "'"),
    };
  }

  return null;
}

/**
 * Parse ALTER TABLE ADD PRIMARY KEY
 */
function parseAlterTablePK(
  stmt: string
): { tableName: string; columns: string[] } | null {
  const match = stmt.match(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s+ADD\s+(?:CONSTRAINT\s+\S+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i
  );
  if (match) {
    return {
      tableName: stripQuotes(match[2] || match[1]),
      columns: match[3].split(",").map((c) => stripQuotes(c.trim())),
    };
  }
  return null;
}

/**
 * Parse ALTER TABLE ADD FOREIGN KEY
 */
function parseAlterTableFK(stmt: string): ParsedForeignKey | null {
  const match = stmt.match(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s+ADD\s+(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+"?([^".\s]+)"?(?:\."?([^"\s]+)"?)?\s*\(([^)]+)\)/i
  );
  if (match) {
    return {
      fromTable: stripQuotes(match[2] || match[1]),
      fromColumns: match[3].split(",").map((c) => stripQuotes(c.trim())),
      toTable: stripQuotes(match[5] || match[4]),
      toColumns: match[6].split(",").map((c) => stripQuotes(c.trim())),
    };
  }
  return null;
}

// Generate a simple unique ID
let idCounter = 0;
function genId(): string {
  return `pg_${Date.now()}_${++idCounter}`;
}

function now(): number {
  return Date.now();
}

/**
 * Convert parsed PG SQL to erd-editor JSON format.
 */
export function parsePgSqlToErdJson(sql: string): string {
  const cleaned = removeComments(sql);
  const statements = splitStatements(cleaned);

  const tables: ParsedTable[] = [];
  const tableMap = new Map<string, ParsedTable>();
  const foreignKeys: ParsedForeignKey[] = [];
  const commentTable = new Map<string, string>();
  const commentColumn = new Map<string, string>();

  // First pass: parse all statements
  for (const stmt of statements) {
    const upper = stmt.trim().toUpperCase();

    if (upper.startsWith("CREATE TABLE")) {
      const table = parseCreateTable(stmt);
      if (table) {
        tables.push(table);
        tableMap.set(table.name.toUpperCase(), table);
      }
      continue;
    }

    if (upper.startsWith("COMMENT ON")) {
      const comment = parseCommentOn(stmt);
      if (comment) {
        if (comment.type === "table") {
          commentTable.set(comment.tableName.toUpperCase(), comment.comment);
        } else if (comment.columnName) {
          const key = `${comment.tableName.toUpperCase()}.${comment.columnName.toUpperCase()}`;
          commentColumn.set(key, comment.comment);
        }
      }
      continue;
    }

    if (upper.startsWith("ALTER TABLE")) {
      const pk = parseAlterTablePK(stmt);
      if (pk) {
        const table = tableMap.get(pk.tableName.toUpperCase());
        if (table) {
          for (const colName of pk.columns) {
            const col = table.columns.find(
              (c) => c.name.toUpperCase() === colName.toUpperCase()
            );
            if (col) {
              col.primaryKey = true;
              col.notNull = true;
            }
          }
        }
      }

      const fk = parseAlterTableFK(stmt);
      if (fk) {
        foreignKeys.push(fk);
      }
    }
  }

  // Apply comments
  for (const table of tables) {
    const tc = commentTable.get(table.name.toUpperCase());
    if (tc && !table.comment) {
      table.comment = tc;
    }
    for (const col of table.columns) {
      const key = `${table.name.toUpperCase()}.${col.name.toUpperCase()}`;
      const cc = commentColumn.get(key);
      if (cc && !col.comment) {
        col.comment = cc;
      }
    }
  }

  // Build erd-editor JSON
  const tableEntities: Record<string, any> = {};
  const tableColumnEntities: Record<string, any> = {};
  const relationshipEntities: Record<string, any> = {};
  const indexEntities: Record<string, any> = {};
  const indexColumnEntities: Record<string, any> = {};

  const tableIds: string[] = [];
  const relationshipIds: string[] = [];
  const indexIds: string[] = [];

  const tableIdMap = new Map<string, string>();
  const columnIdMap = new Map<string, string>(); // tableName.colName -> columnId

  // Layout: arrange tables in a grid
  const COLS_PER_ROW = 4;
  const TABLE_WIDTH = 300;
  const TABLE_HEIGHT = 250;
  const GAP_X = 100;
  const GAP_Y = 80;

  tables.forEach((table, tableIdx) => {
    const tableId = genId();
    tableIdMap.set(table.name.toUpperCase(), tableId);
    tableIds.push(tableId);

    const colIds: string[] = [];
    const seqColIds: string[] = [];

    let maxNameWidth = 60;
    let maxCommentWidth = 60;
    let maxDataTypeWidth = 60;
    let maxDefaultWidth = 60;

    for (const col of table.columns) {
      const colId = genId();
      colIds.push(colId);
      seqColIds.push(colId);
      columnIdMap.set(
        `${table.name.toUpperCase()}.${col.name.toUpperCase()}`,
        colId
      );

      // Calculate options bitmask
      let options = 0;
      if (col.primaryKey) options |= ColumnOption.primaryKey;
      if (col.notNull) options |= ColumnOption.notNull;
      if (col.unique) options |= ColumnOption.unique;
      if (col.autoIncrement) options |= ColumnOption.autoIncrement;

      const ts = now();
      tableColumnEntities[colId] = {
        id: colId,
        tableId: tableId,
        name: col.name,
        comment: col.comment,
        dataType: col.dataType,
        default: col.default,
        options: options,
        ui: {
          keys: 0,
          widthName: Math.max(60, col.name.length * 8),
          widthComment: Math.max(60, col.comment.length * 8),
          widthDataType: Math.max(60, col.dataType.length * 8),
          widthDefault: Math.max(60, col.default.length * 8),
        },
        meta: { updateAt: ts, createAt: ts },
      };

      maxNameWidth = Math.max(maxNameWidth, col.name.length * 8);
      maxCommentWidth = Math.max(maxCommentWidth, col.comment.length * 8);
      maxDataTypeWidth = Math.max(maxDataTypeWidth, col.dataType.length * 8);
      maxDefaultWidth = Math.max(maxDefaultWidth, col.default.length * 8);
    }

    const row = Math.floor(tableIdx / COLS_PER_ROW);
    const col = tableIdx % COLS_PER_ROW;

    const ts = now();
    tableEntities[tableId] = {
      id: tableId,
      name: table.name,
      comment: table.comment,
      columnIds: colIds,
      seqColumnIds: seqColIds,
      ui: {
        x: 100 + col * (TABLE_WIDTH + GAP_X),
        y: 100 + row * (TABLE_HEIGHT + GAP_Y),
        zIndex: 2 + tableIdx,
        widthName: maxNameWidth,
        widthComment: maxCommentWidth,
        color: "",
      },
      meta: { updateAt: ts, createAt: ts },
    };
  });

  // Build relationships from foreign keys
  for (const fk of foreignKeys) {
    const startTableId = tableIdMap.get(fk.fromTable.toUpperCase());
    const endTableId = tableIdMap.get(fk.toTable.toUpperCase());
    if (!startTableId || !endTableId) continue;

    const startColumnIds: string[] = [];
    const endColumnIds: string[] = [];

    for (const colName of fk.fromColumns) {
      const colId = columnIdMap.get(
        `${fk.fromTable.toUpperCase()}.${colName.toUpperCase()}`
      );
      if (colId) startColumnIds.push(colId);
    }

    for (const colName of fk.toColumns) {
      const colId = columnIdMap.get(
        `${fk.toTable.toUpperCase()}.${colName.toUpperCase()}`
      );
      if (colId) endColumnIds.push(colId);
    }

    if (startColumnIds.length === 0 || endColumnIds.length === 0) continue;

    const relId = genId();
    relationshipIds.push(relId);

    const ts = now();
    relationshipEntities[relId] = {
      id: relId,
      identification: false,
      relationshipType: 4, // ZeroN
      startRelationshipType: 2, // dash
      start: {
        tableId: startTableId,
        columnIds: startColumnIds,
        x: 0,
        y: 0,
        direction: 8, // bottom
      },
      end: {
        tableId: endTableId,
        columnIds: endColumnIds,
        x: 0,
        y: 0,
        direction: 8, // bottom
      },
      meta: { updateAt: ts, createAt: ts },
    };
  }

  const result = {
    $schema:
      "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",
    version: "3.0.0",
    canvas: {
      version: "3.3.0",
      width: 2000,
      height: 2000,
      scrollTop: 0,
      scrollLeft: 0,
      zoomLevel: 1,
      show: {
        tableProperties: false,
        columnTypes: true,
        columnConstraints: true,
        columnComments: true,
        relationshipDataType: false,
        relationshipCardinality: true,
        columnUnique: false,
        columnNotNull: true,
        columnDefault: false,
        columnAutoIncrement: false,
      },
      database: "PostgreSQL",
      databaseName: "",
      setting: {
        relationshipDataTypeSync: true,
        relationshipOptimization: false,
        columnOrder: [
          "columnName",
          "columnDefault",
          "columnNotNull",
          "columnUnique",
          "columnAutoIncrement",
          "columnComment",
          "columnType",
        ],
      },
      pluginSerializationMap: {},
    },
    table: {
      entities: tableEntities,
      indexes: indexEntities,
    },
    memo: { memos: {} },
    relationship: { relationships: relationshipEntities },
    doc: {
      tableIds: tableIds,
      relationshipIds: relationshipIds,
      indexIds: indexIds,
      memoIds: [],
    },
    collections: {
      tableEntities: tableEntities,
      tableColumnEntities: tableColumnEntities,
      relationshipEntities: relationshipEntities,
      indexEntities: indexEntities,
      indexColumnEntities: indexColumnEntities,
      memoEntities: {},
    },
  };

  return JSON.stringify(result);
}

/**
 * Detect if SQL is PostgreSQL syntax.
 */
export function isPgSql(sql: string): boolean {
  const upper = sql.toUpperCase();
  return (
    upper.includes("COMMENT ON TABLE") ||
    upper.includes("COMMENT ON COLUMN") ||
    upper.includes("BIGSERIAL") ||
    upper.includes("SMALLSERIAL") ||
    upper.includes("TIMESTAMP WITH TIME ZONE") ||
    upper.includes("TIMESTAMP WITHOUT TIME ZONE") ||
    upper.includes("CHARACTER VARYING") ||
    upper.includes("DOUBLE PRECISION") ||
    upper.includes("GENERATED ALWAYS AS IDENTITY") ||
    upper.includes("GENERATED BY DEFAULT AS IDENTITY")
  );
}
