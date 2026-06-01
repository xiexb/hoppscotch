/**
 * Generate a descriptive commit message from a DiffResult.
 *
 * For small changes (<10 total), produces a detailed message like:
 *   "erd: add 2 tables, modify users.email type, remove legacy_orders"
 *
 * For large changes (10+ total), simplifies to:
 *   "erd: auto-save 2026-06-01 15:30 (X tables, Y columns changed)"
 */

import { DiffResult } from './erd-diff.util';

/** Threshold: above this many total changes, use simplified message */
const DETAIL_THRESHOLD = 10;

/**
 * Generate a commit message describing the ERD changes.
 *
 * @param diff - DiffResult from diffNormalizedErd()
 * @returns A human-readable commit message string
 */
export function generateCommitMessage(diff: DiffResult): string {
  const { summary, tables, relationships } = diff;

  // No changes
  if (summary.totalChanges === 0) {
    return 'erd: no changes';
  }

  // Large change set — use simplified format
  if (summary.totalChanges >= DETAIL_THRESHOLD) {
    const now = new Date();
    const dateStr = formatDate(now);
    const tableDesc =
      summary.tablesAdded + summary.tablesRemoved + summary.tablesModified;
    const colDesc =
      summary.columnsAdded + summary.columnsRemoved + summary.columnsModified;
    return `erd: auto-save ${dateStr} (${tableDesc} tables, ${colDesc} columns changed)`;
  }

  // Small change set — detailed format
  const parts: string[] = [];

  // Added tables
  if (summary.tablesAdded > 0) {
    const names = tables.added.map((t) => t.name).join(', ');
    parts.push(
      summary.tablesAdded === 1
        ? `add table ${names}`
        : `add ${summary.tablesAdded} tables (${names})`,
    );
  }

  // Removed tables
  if (summary.tablesRemoved > 0) {
    const names = tables.removed.map((t) => t.name).join(', ');
    parts.push(
      summary.tablesRemoved === 1
        ? `remove table ${names}`
        : `remove ${summary.tablesRemoved} tables (${names})`,
    );
  }

  // Modified tables — describe first few column-level changes
  for (const mod of tables.modified) {
    const colChanges: string[] = [];

    if (mod.changes.comment) {
      colChanges.push('comment');
    }
    for (const col of mod.changes.columns.added) {
      colChanges.push(`+${col.name}`);
    }
    for (const col of mod.changes.columns.removed) {
      colChanges.push(`-${col.name}`);
    }
    for (const col of mod.changes.columns.modified) {
      colChanges.push(`${col.name} ${col.changes.join('/')}`);
    }

    if (colChanges.length > 0) {
      parts.push(`modify ${mod.tableName}: ${colChanges.join(', ')}`);
    }
  }

  // Relationship changes
  if (relationships.added.length > 0) {
    parts.push(`add ${relationships.added.length} relationships`);
  }
  if (relationships.removed.length > 0) {
    parts.push(`remove ${relationships.removed.length} relationships`);
  }

  if (parts.length === 0) {
    return 'erd: minor changes';
  }

  return `erd: ${parts.join(', ')}`;
}

/** Format date as "YYYY-MM-DD HH:mm" */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}`;
}
