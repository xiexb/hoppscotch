/**
 * Structural diff between two normalized ERD schemas.
 *
 * Matching strategy (name-based, per erd-editor UUID instability):
 * - Tables matched by `table.name`
 * - Columns matched by `column.name` within matched tables
 * - Relationships matched by `(type, from, to)` tuple
 */

import {
  NormalizedErdSchema,
  NormalizedTable,
  NormalizedColumn,
  NormalizedRelationship,
} from './erd-normalize.util';

/** A single column-level change */
export interface ColumnChange {
  name: string;
  /** Previous column definition (null if added) */
  before: NormalizedColumn | null;
  /** Current column definition (null if removed) */
  after: NormalizedColumn | null;
  /** Which properties changed */
  changes: string[];
}

/** Changes within a single table */
export interface TableModification {
  tableName: string;
  changes: {
    comment?: { before: string; after: string };
    columns: {
      added: NormalizedColumn[];
      removed: NormalizedColumn[];
      modified: ColumnChange[];
    };
  };
}

/** Summary table reference (for added/removed tables) */
export interface TableSummary {
  name: string;
  comment: string;
  columnCount: number;
}

/** Relationship change */
export interface RelationshipChange {
  type: string;
  from: string;
  to: string;
}

/** Full diff result */
export interface DiffResult {
  tables: {
    added: TableSummary[];
    removed: TableSummary[];
    modified: TableModification[];
  };
  relationships: {
    added: RelationshipChange[];
    removed: RelationshipChange[];
  };
  summary: {
    tablesAdded: number;
    tablesRemoved: number;
    tablesModified: number;
    columnsAdded: number;
    columnsRemoved: number;
    columnsModified: number;
    totalChanges: number;
  };
}

/**
 * Compute a structural diff between two normalized ERD schemas.
 *
 * @param before - The base version (e.g. previous commit)
 * @param after - The target version (e.g. current state)
 * @returns DiffResult describing all additions, removals, and modifications
 */
export function diffNormalizedErd(
  before: NormalizedErdSchema,
  after: NormalizedErdSchema,
): DiffResult {
  const beforeTableMap = new Map<string, NormalizedTable>();
  for (const t of before.tables) {
    beforeTableMap.set(t.name, t);
  }

  const afterTableMap = new Map<string, NormalizedTable>();
  for (const t of after.tables) {
    afterTableMap.set(t.name, t);
  }

  // Tables added in after
  const added: TableSummary[] = [];
  for (const t of after.tables) {
    if (!beforeTableMap.has(t.name)) {
      added.push({ name: t.name, comment: t.comment, columnCount: t.columns.length });
    }
  }

  // Tables removed from before
  const removed: TableSummary[] = [];
  for (const t of before.tables) {
    if (!afterTableMap.has(t.name)) {
      removed.push({ name: t.name, comment: t.comment, columnCount: t.columns.length });
    }
  }

  // Tables modified (exist in both)
  const modified: TableModification[] = [];
  for (const afterTable of after.tables) {
    const beforeTable = beforeTableMap.get(afterTable.name);
    if (!beforeTable) continue; // already handled as "added"

    const mod = diffTable(beforeTable, afterTable);
    if (mod) {
      modified.push(mod);
    }
  }

  // Relationship diff
  const { added: relAdded, removed: relRemoved } = diffRelationships(
    before.relationships,
    after.relationships,
  );

  // Compute summary counts
  let columnsAdded = 0;
  let columnsRemoved = 0;
  let columnsModified = 0;

  for (const m of modified) {
    columnsAdded += m.changes.columns.added.length;
    columnsRemoved += m.changes.columns.removed.length;
    columnsModified += m.changes.columns.modified.length;
  }
  // Also count columns in fully added/removed tables
  for (const t of added) columnsAdded += t.columnCount;
  for (const t of removed) columnsRemoved += t.columnCount;

  const totalChanges =
    added.length +
    removed.length +
    modified.length +
    relAdded.length +
    relRemoved.length +
    columnsAdded +
    columnsRemoved +
    columnsModified;

  return {
    tables: { added, removed, modified },
    relationships: { added: relAdded, removed: relRemoved },
    summary: {
      tablesAdded: added.length,
      tablesRemoved: removed.length,
      tablesModified: modified.length,
      columnsAdded,
      columnsRemoved,
      columnsModified,
      totalChanges,
    },
  };
}

/**
 * Diff a single table that exists in both versions.
 * Returns null if no changes detected.
 */
function diffTable(
  before: NormalizedTable,
  after: NormalizedTable,
): TableModification | null {
  const beforeColMap = new Map<string, NormalizedColumn>();
  for (const c of before.columns) {
    beforeColMap.set(c.name, c);
  }

  const afterColMap = new Map<string, NormalizedColumn>();
  for (const c of after.columns) {
    afterColMap.set(c.name, c);
  }

  // Added columns
  const colsAdded: NormalizedColumn[] = [];
  for (const c of after.columns) {
    if (!beforeColMap.has(c.name)) {
      colsAdded.push(c);
    }
  }

  // Removed columns
  const colsRemoved: NormalizedColumn[] = [];
  for (const c of before.columns) {
    if (!afterColMap.has(c.name)) {
      colsRemoved.push(c);
    }
  }

  // Modified columns
  const colsModified: ColumnChange[] = [];
  for (const afterCol of after.columns) {
    const beforeCol = beforeColMap.get(afterCol.name);
    if (!beforeCol) continue;

    const changes = diffColumnProperties(beforeCol, afterCol);
    if (changes.length > 0) {
      colsModified.push({
        name: afterCol.name,
        before: beforeCol,
        after: afterCol,
        changes,
      });
    }
  }

  // Comment change
  const commentChanged = before.comment !== after.comment;

  // No changes at all
  if (
    colsAdded.length === 0 &&
    colsRemoved.length === 0 &&
    colsModified.length === 0 &&
    !commentChanged
  ) {
    return null;
  }

  return {
    tableName: after.name,
    changes: {
      ...(commentChanged
        ? { comment: { before: before.comment, after: after.comment } }
        : {}),
      columns: {
        added: colsAdded,
        removed: colsRemoved,
        modified: colsModified,
      },
    },
  };
}

/** Compare two columns and return list of changed property names */
function diffColumnProperties(
  before: NormalizedColumn,
  after: NormalizedColumn,
): string[] {
  const changes: string[] = [];
  const props: (keyof NormalizedColumn)[] = [
    'type',
    'pk',
    'notNull',
    'unique',
    'autoIncrement',
    'default',
    'comment',
  ];
  for (const prop of props) {
    if (before[prop] !== after[prop]) {
      changes.push(prop);
    }
  }
  return changes;
}

/** Diff relationships between two versions */
function diffRelationships(
  before: NormalizedRelationship[],
  after: NormalizedRelationship[],
): { added: RelationshipChange[]; removed: RelationshipChange[] } {
  const key = (r: NormalizedRelationship) => `${r.type}|${r.from}|${r.to}`;

  const beforeSet = new Set(before.map(key));
  const afterSet = new Set(after.map(key));

  const added: RelationshipChange[] = after
    .filter((r) => !beforeSet.has(key(r)))
    .map((r) => ({ type: r.type, from: r.from, to: r.to }));

  const removed: RelationshipChange[] = before
    .filter((r) => !afterSet.has(key(r)))
    .map((r) => ({ type: r.type, from: r.from, to: r.to }));

  return { added, removed };
}
