<template>
  <div class="group">
    <!-- Model row -->
    <div
      class="flex items-center gap-2 py-2.5 cursor-pointer hover:bg-primaryLight/50 transition-colors"
      :class="rowClass"
      @click="$emit('toggleExpand')"
    >
      <!-- Expand icon -->
      <IconChevronRight
        class="w-3.5 h-3.5 text-secondaryLight shrink-0 transition-transform"
        :class="{ 'rotate-90': isExpanded }"
      />
      <!-- Model info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-secondaryDark truncate">
            {{ model.name }}
          </span>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium shrink-0"
          >
            {{ model.schemaTree?.length ?? 0 }}
            {{ t("models_panel.fields") }}
          </span>
        </div>
        <div
          v-if="model.description"
          class="text-[11px] text-secondaryLight truncate mt-0.5"
        >
          {{ model.description }}
        </div>
      </div>
      <!-- Actions -->
      <div
        class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          v-tippy="{
            theme: 'tooltip',
            content: t('models_panel.edit'),
          }"
          class="p-1.5 text-secondaryLight hover:text-accent transition-colors rounded"
          @click.stop="$emit('edit')"
        >
          <IconEdit class="w-3.5 h-3.5" />
        </button>
        <button
          v-tippy="{
            theme: 'tooltip',
            content: t('models_panel.delete'),
          }"
          class="p-1.5 text-secondaryLight hover:text-red-400 transition-colors rounded"
          @click.stop="$emit('delete')"
        >
          <IconTrash class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Expanded schema preview -->
    <div
      v-if="isExpanded"
      class="px-4 py-2 bg-primaryLight/30 border-t border-dividerLight"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-[11px] font-semibold text-secondary">
          {{ t("models_panel.schema_preview") }}
        </span>
        <span class="text-[10px] text-secondaryLight">
          {{ t("models_panel.updated_at") }}
          {{ formatTime(model.updatedAt) }}
        </span>
      </div>
      <div v-if="model.schemaTree && model.schemaTree.length > 0">
        <SchemaTreeReadonly
          v-for="(node, nIdx) in model.schemaTree"
          :key="nIdx"
          :node="node"
          :depth="0"
          :model-resolver="modelResolver"
        />
      </div>
      <div v-else class="text-[11px] text-secondaryLight py-2 text-center">
        {{ t("models_panel.no_fields") }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HoppWorkspaceModel } from "@hoppscotch/data"
import type { ReadonlyModelResolver } from "~/components/http/design/SchemaTreeReadonly.vue"
import SchemaTreeReadonly from "~/components/http/design/SchemaTreeReadonly.vue"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconEdit from "~icons/lucide/pencil"
import IconTrash from "~icons/lucide/trash-2"
import { useI18n } from "@composables/i18n"

defineProps<{
  model: HoppWorkspaceModel
  isExpanded: boolean
  rowClass: string
  modelResolver: ReadonlyModelResolver
}>()

defineEmits<{
  (e: "toggleExpand"): void
  (e: "edit"): void
  (e: "delete"): void
}>()

const t = useI18n()

function formatTime(iso: string): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t("models_panel.time_just_now")
    if (diffMin < 60)
      return t("models_panel.time_minutes_ago", { n: diffMin })
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return t("models_panel.time_hours_ago", { n: diffHr })
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return t("models_panel.time_days_ago", { n: diffDay })
    return d.toLocaleDateString()
  } catch {
    return "—"
  }
}
</script>
