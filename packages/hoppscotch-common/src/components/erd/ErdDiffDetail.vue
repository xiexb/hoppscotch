<template>
  <div class="diff-detail-panel">
    <!-- Statistics Summary -->
    <div class="diff-detail-stats">
      <div class="diff-detail-stat-row">
        <span class="diff-detail-dot diff-detail-dot--added" />
        <span class="diff-detail-stat-label">{{ t("erd.diff.added") }}</span>
        <span class="diff-detail-stat-value">{{ stats.addedTables }} {{ t("erd.diff.tables") }}, {{ stats.addedColumns }} {{ t("erd.diff.columns") }}</span>
      </div>
      <div class="diff-detail-stat-row">
        <span class="diff-detail-dot diff-detail-dot--modified" />
        <span class="diff-detail-stat-label">{{ t("erd.diff.modified") }}</span>
        <span class="diff-detail-stat-value">{{ stats.modifiedTables }} {{ t("erd.diff.tables") }}, {{ stats.modifiedColumns }} {{ t("erd.diff.columns") }}</span>
      </div>
      <div class="diff-detail-stat-row">
        <span class="diff-detail-dot diff-detail-dot--removed" />
        <span class="diff-detail-stat-label">{{ t("erd.diff.removed") }}</span>
        <span class="diff-detail-stat-value">{{ stats.removedTables }} {{ t("erd.diff.tables") }}, {{ stats.removedColumns }} {{ t("erd.diff.columns") }}</span>
      </div>
    </div>

    <!-- Color Legend -->
    <div class="diff-detail-legend">
      <span class="diff-detail-legend-item">
        <span class="diff-detail-color-swatch" style="background-color: #22c55e" />
        {{ t("erd.diff.added") }}
      </span>
      <span class="diff-detail-legend-item">
        <span class="diff-detail-color-swatch" style="background-color: #eab308" />
        {{ t("erd.diff.modified") }}
      </span>
      <span class="diff-detail-legend-item">
        <span class="diff-detail-color-swatch" style="background-color: #6b7280" />
        {{ t("erd.diff.removed") }}
      </span>
    </div>

    <!-- Changes Tree -->
    <div class="diff-detail-tree">
      <!-- Added Tables -->
      <div
        v-for="table in diffResult.tables?.added ?? []"
        :key="'added-' + table.name"
        class="diff-detail-table diff-detail-table--added"
      >
        <div class="diff-detail-table-header" @click="toggleExpand('added-' + table.name)">
          <component
            :is="expandedTables.has('added-' + table.name) ? IconChevronDown : IconChevronRight"
            class="diff-detail-chevron"
          />
          <IconPlus class="diff-detail-icon diff-detail-icon--added" />
          <span class="diff-detail-table-name">{{ table.name }}</span>
          <span class="diff-detail-badge diff-detail-badge--added">+{{ table.columnCount }}</span>
        </div>
        <div v-if="expandedTables.has('added-' + table.name) && table.comment" class="diff-detail-comment">
          {{ table.comment }}
        </div>
      </div>

      <!-- Modified Tables -->
      <div
        v-for="mod in diffResult.tables?.modified ?? []"
        :key="'mod-' + mod.tableName"
        class="diff-detail-table diff-detail-table--modified"
      >
        <div class="diff-detail-table-header" @click="toggleExpand('mod-' + mod.tableName)">
          <component
            :is="expandedTables.has('mod-' + mod.tableName) ? IconChevronDown : IconChevronRight"
            class="diff-detail-chevron"
          />
          <IconEdit class="diff-detail-icon diff-detail-icon--modified" />
          <span class="diff-detail-table-name">{{ mod.tableName }}</span>
          <span class="diff-detail-change-count">
            {{ countColumnChanges(mod) }}
          </span>
        </div>

        <!-- Expanded: column changes -->
        <div v-if="expandedTables.has('mod-' + mod.tableName)" class="diff-detail-columns">
          <!-- Table comment change -->
          <div v-if="mod.changes?.comment" class="diff-detail-column-change">
            <span class="diff-detail-col-name">{{ t("erd.diff.comment") }}</span>
            <span class="diff-detail-col-diff">
              <span class="diff-detail-old">{{ mod.changes.comment.before || "(empty)" }}</span>
              <span class="diff-detail-arrow">→</span>
              <span class="diff-detail-new">{{ mod.changes.comment.after || "(empty)" }}</span>
            </span>
          </div>

          <!-- Added columns -->
          <div
            v-for="col in mod.changes?.columns?.added ?? []"
            :key="'col-add-' + col.name"
            class="diff-detail-column-change diff-detail-column-change--added"
          >
            <IconPlus class="diff-detail-col-icon diff-detail-icon--added" />
            <span class="diff-detail-col-name">{{ col.name }}</span>
            <span class="diff-detail-col-type">{{ col.type }}</span>
            <span v-if="col.pk" class="diff-detail-col-tag">PK</span>
            <span v-if="col.notNull" class="diff-detail-col-tag">NOT NULL</span>
          </div>

          <!-- Removed columns -->
          <div
            v-for="col in mod.changes?.columns?.removed ?? []"
            :key="'col-rm-' + col.name"
            class="diff-detail-column-change diff-detail-column-change--removed"
          >
            <IconMinus class="diff-detail-col-icon diff-detail-icon--removed" />
            <span class="diff-detail-col-name">{{ col.name }}</span>
            <span class="diff-detail-col-type">{{ col.type }}</span>
          </div>

          <!-- Modified columns -->
          <div
            v-for="col in mod.changes?.columns?.modified ?? []"
            :key="'col-mod-' + col.name"
            class="diff-detail-column-change diff-detail-column-change--modified"
          >
            <IconEdit class="diff-detail-col-icon diff-detail-icon--modified" />
            <span class="diff-detail-col-name">{{ col.name }}</span>
            <div class="diff-detail-col-changes">
              <span
                v-for="(change, idx) in col.changes"
                :key="idx"
                class="diff-detail-col-change-tag"
              >
                {{ change }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Removed Tables -->
      <div
        v-for="table in diffResult.tables?.removed ?? []"
        :key="'removed-' + table.name"
        class="diff-detail-table diff-detail-table--removed"
      >
        <div class="diff-detail-table-header" @click="toggleExpand('removed-' + table.name)">
          <component
            :is="expandedTables.has('removed-' + table.name) ? IconChevronDown : IconChevronRight"
            class="diff-detail-chevron"
          />
          <IconMinus class="diff-detail-icon diff-detail-icon--removed" />
          <span class="diff-detail-table-name diff-detail-table-name--strikethrough">{{ table.name }}</span>
          <span class="diff-detail-badge diff-detail-badge--removed">-{{ table.columnCount }}</span>
        </div>
        <div v-if="expandedTables.has('removed-' + table.name) && table.comment" class="diff-detail-comment">
          {{ table.comment }}
        </div>
      </div>

      <!-- Relationship Changes -->
      <div v-if="hasRelationshipChanges" class="diff-detail-section">
        <div class="diff-detail-section-title">{{ t("erd.diff.relationships") }}</div>
        <div
          v-for="(rel, idx) in diffResult.relationships?.added ?? []"
          :key="'rel-add-' + idx"
          class="diff-detail-column-change diff-detail-column-change--added"
        >
          <IconPlus class="diff-detail-col-icon diff-detail-icon--added" />
          <span class="diff-detail-col-name">{{ rel.from }} → {{ rel.to }}</span>
          <span class="diff-detail-col-type">{{ rel.type }}</span>
        </div>
        <div
          v-for="(rel, idx) in diffResult.relationships?.removed ?? []"
          :key="'rel-rm-' + idx"
          class="diff-detail-column-change diff-detail-column-change--removed"
        >
          <IconMinus class="diff-detail-col-icon diff-detail-icon--removed" />
          <span class="diff-detail-col-name">{{ rel.from }} → {{ rel.to }}</span>
          <span class="diff-detail-col-type">{{ rel.type }}</span>
        </div>
      </div>

      <!-- No Changes -->
      <div v-if="totalChanges === 0" class="diff-detail-empty">
        {{ t("erd.diff.no_changes") }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue"
import { useI18n } from "@composables/i18n"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconPlus from "~icons/lucide/plus"
import IconMinus from "~icons/lucide/minus"
import IconEdit from "~icons/lucide/pencil"
import type { DiffResult, TableModification } from "~/helpers/erdVersionApi"
import { computeDiffStats } from "~/helpers/erdDiff"

const props = defineProps<{
  diffResult: DiffResult
}>()

const t = useI18n()

const stats = computed(() => computeDiffStats(props.diffResult))
const totalChanges = computed(() => stats.value.totalChanges)

const hasRelationshipChanges = computed(() => {
  const rels = props.diffResult.relationships
  return (
    (rels?.added?.length ?? 0) > 0 ||
    (rels?.removed?.length ?? 0) > 0
  )
})

const expandedTables = reactive(new Set<string>())

function toggleExpand(key: string) {
  if (expandedTables.has(key)) {
    expandedTables.delete(key)
  } else {
    expandedTables.add(key)
  }
}

function countColumnChanges(mod: TableModification): string {
  const added = mod.changes?.columns?.added?.length ?? 0
  const removed = mod.changes?.columns?.removed?.length ?? 0
  const modified = mod.changes?.columns?.modified?.length ?? 0
  const total = added + removed + modified
  const commentChange = mod.changes?.comment ? 1 : 0
  return `${total + commentChange} changes`
}
</script>

<style scoped>
.diff-detail-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  font-size: 12px;
}

.diff-detail-stats {
  padding: 10px 12px;
  border-bottom: 1px solid var(--foreground, #60646c);
  opacity: 0.8;
}

.diff-detail-stat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.diff-detail-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.diff-detail-dot--added { background-color: #22c55e; }
.diff-detail-dot--modified { background-color: #eab308; }
.diff-detail-dot--removed { background-color: #6b7280; }

.diff-detail-stat-label {
  font-weight: 600;
  min-width: 50px;
  color: var(--foreground, #60646c);
}

.diff-detail-stat-value {
  color: var(--foreground, #60646c);
  opacity: 0.8;
}

.diff-detail-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--foreground, #60646c);
  opacity: 0.6;
  font-size: 11px;
}

.diff-detail-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground, #60646c);
}

.diff-detail-color-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.diff-detail-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.diff-detail-table {
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.diff-detail-table-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.diff-detail-table-header:hover {
  background-color: rgba(128, 128, 128, 0.1);
}

.diff-detail-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--foreground, #60646c);
  opacity: 0.6;
}

.diff-detail-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.diff-detail-icon--added { color: #22c55e; }
.diff-detail-icon--modified { color: #eab308; }
.diff-detail-icon--removed { color: #6b7280; }

.diff-detail-table-name {
  flex: 1;
  font-weight: 500;
  color: var(--foreground, #60646c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-detail-table-name--strikethrough {
  text-decoration: line-through;
  opacity: 0.6;
}

.diff-detail-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
}

.diff-detail-badge--added {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.diff-detail-badge--removed {
  background-color: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

.diff-detail-change-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background-color: rgba(234, 179, 8, 0.15);
  color: #eab308;
  font-weight: 600;
  flex-shrink: 0;
}

.diff-detail-comment {
  padding: 2px 12px 6px 34px;
  font-size: 11px;
  color: var(--foreground, #60646c);
  opacity: 0.6;
  font-style: italic;
}

.diff-detail-columns {
  padding: 2px 0 4px 30px;
}

.diff-detail-column-change {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 12px 3px 8px;
  font-size: 11px;
  flex-wrap: wrap;
}

.diff-detail-column-change--added {
  background-color: rgba(34, 197, 94, 0.05);
}

.diff-detail-column-change--removed {
  background-color: rgba(107, 114, 128, 0.05);
}

.diff-detail-column-change--modified {
  background-color: rgba(234, 179, 8, 0.05);
}

.diff-detail-col-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.diff-detail-col-name {
  font-family: monospace;
  font-weight: 500;
  color: var(--foreground, #60646c);
}

.diff-detail-col-type {
  font-family: monospace;
  font-size: 10px;
  color: var(--foreground, #60646c);
  opacity: 0.6;
}

.diff-detail-col-tag {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 3px;
  background-color: rgba(128, 128, 128, 0.15);
  color: var(--foreground, #60646c);
  opacity: 0.7;
}

.diff-detail-col-changes {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.diff-detail-col-change-tag {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  background-color: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.diff-detail-col-diff {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.diff-detail-old {
  font-family: monospace;
  font-size: 10px;
  color: #ef4444;
  text-decoration: line-through;
}

.diff-detail-new {
  font-family: monospace;
  font-size: 10px;
  color: #22c55e;
}

.diff-detail-arrow {
  color: var(--foreground, #60646c);
  opacity: 0.5;
  font-size: 10px;
}

.diff-detail-section {
  padding-top: 4px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
  margin-top: 4px;
}

.diff-detail-section-title {
  padding: 4px 12px;
  font-weight: 600;
  font-size: 11px;
  color: var(--foreground, #60646c);
  opacity: 0.7;
}

.diff-detail-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--foreground, #60646c);
  opacity: 0.5;
}
</style>
