/**
 * Normalize erd-editor v3.0.0 JSON into a stable, name-sorted structure
 * suitable for semantic diff and git versioning.
 *
 * Removes: UUIDs, UI coordinates, widths, timestamps, and other non-semantic noise.
 * Sorts: tables by name, columns by name within each table, relationships by endpoint names.
 */

/** Normalized column representation */
export interface NormalizedColumn {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  autoIncrement: boolean;
  default: string;
  comment: string;
}

/** Normalized table representation */
export interface NormalizedTable {
  name: string;
  comment: string;
  columns: NormalizedColumn[];
}

/** Normalized relationship representation */
export interface NormalizedRelationship {
  type: string;
  from: string; // "table.col"
  to: string;   // "table.col"
}

/** The full normalized ERD schema */
export interface NormalizedErdSchema {
  version: string;
  generatedAt: string;
  tables: NormalizedTable[];
  relationships: NormalizedRelationship[];
}

// Column options bitmask (from erd-editor v3.0.0)
const OPTION_AUTO_INCREMENT = 1;
const OPTION_PRIMARY_KEY = 2;
// const OPTION_UNIQUE = 4; // reserved for future use
const OPTION_NOT_NULL = 8;

/**
 * Parse erd-editor v3.0.0 JSON string into a normalized, diff-friendly structure.
 *
 * @param erdJsonStr - Raw JSON string from erd-editor (v3.0.0 format)
 * @returns NormalizedErdSchema with tables/columns sorted by name, UI noise removed
 * @throws Error if JSON is invalid or not v3.0.0 format
 */
export function normalizeErdJson(erdJsonStr: string): NormalizedErdSchema {
  let parsed: any;
  try {
    parsed = JSON.parse(erdJsonStr);
  } catch {
    throw new Error('Invalid JSON: failed to parse erd-editor data');
  }

  if (parsed.version !== '3.0.0') {
    throw new Error(
      `Unsupported erd-editor version: ${parsed.version ?? 'unknown'}. Expected 3.0.0`,
    );
  }

  const collections = parsed.collections;
  if (!collections) {
    return {
      version: '3.0.0',
      generatedAt: new Date().toISOString(),
      tables: [],
      relationships: [],
    };
  }

  const tableEntities: Record<string, any> = collections.tableEntities ?? {};
  const columnEntities: Record<string, any> = collections.tableColumnEntities ?? {};
  const relationshipEntities: Record<string, any> =
    collections.relationshipEntities ?? {};

  // Build a UUID -> table name lookup for relationship resolution
  const tableIdToName: Record<string, string> = {};
  for (const [, table] of Object.entries(tableEntities)) {
    const t = table as any;
    tableIdToName[t.id] = t.name ?? '';
  }

  // Build a UUID -> column name lookup (scoped by table)
  const columnIdToInfo: Record<string, { name: string; tableName: string }> = {};
  for (const [, col] of Object.entries(columnEntities)) {
    const c = col as any;
    const tableName = tableIdToName[c.tableId] ?? '';
    columnIdToInfo[c.id] = { name: c.name ?? '', tableName };
  }

  // Normalize tables
  const tables: NormalizedTable[] = Object.values(tableEntities)
    .map((table: any) => {
      const columns: NormalizedColumn[] = (table.columnIds ?? [])
        .map((colId: string) => columnEntities[colId])
        .filter(Boolean)
        .map((col: any) => {
          const options = col.options ?? 0;
          return {
            name: col.name ?? '',
            type: col.dataType ?? '',
            pk: (options & OPTION_PRIMARY_KEY) !== 0,
            notNull: (options & OPTION_NOT_NULL) !== 0,
            autoIncrement: (options & OPTION_AUTO_INCREMENT) !== 0,
            default: col.default ?? '',
            comment: col.comment ?? '',
          };
        })
        // Sort columns by name for stable output
        .sort((a: NormalizedColumn, b: NormalizedColumn) =>
          a.name.localeCompare(b.name),
        );

      return {
        name: table.name ?? '',
        comment: table.comment ?? '',
        columns,
      };
    })
    // Sort tables by name for stable output
    .sort((a: NormalizedTable, b: NormalizedTable) =>
      a.name.localeCompare(b.name),
    );

  // Normalize relationships
  const relationships: NormalizedRelationship[] = Object.values(
    relationshipEntities,
  )
    .map((rel: any) => {
      const startTableId = rel.start?.tableId;
      const startColIds = rel.start?.columnIds ?? [];
      const endTableId = rel.end?.tableId;
      const endColIds = rel.end?.columnIds ?? [];

      const fromTableName = tableIdToName[startTableId] ?? '';
      const toTableName = tableIdToName[endTableId] ?? '';

      // Resolve column names (use first column if multi-column relationship)
      const fromColName =
        startColIds.length > 0
          ? (columnEntities[startColIds[0]]?.name ?? '')
          : '';
      const toColName =
        endColIds.length > 0
          ? (columnEntities[endColIds[0]]?.name ?? '')
          : '';

      return {
        type: rel.relationshipType ?? rel.type ?? '',
        from: fromColName ? `${fromTableName}.${fromColName}` : fromTableName,
        to: toColName ? `${toTableName}.${toColName}` : toTableName,
      };
    })
    // Sort relationships for stable output
    .sort((a: NormalizedRelationship, b: NormalizedRelationship) => {
      const fromCmp = a.from.localeCompare(b.from);
      return fromCmp !== 0 ? fromCmp : a.to.localeCompare(b.to);
    });

  return {
    version: '3.0.0',
    generatedAt: new Date().toISOString(),
    tables,
    relationships,
  };
}
