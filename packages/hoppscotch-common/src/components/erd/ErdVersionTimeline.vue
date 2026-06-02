<template>
  <div
    v-if="displayEntries.length > 0"
    class="timeline-wrapper border-b border-dividerLight"
  >
    <div class="flex items-center px-3 pt-2 pb-1">
      <span class="text-xs font-medium text-secondaryLight">
        {{ t("erd.version.tag.timeline") }}
      </span>
      <span class="ml-auto text-xs text-secondaryLight">
        {{ displayEntries.length }}/{{ entries.length }}
      </span>
    </div>
    <div
      class="timeline-scroll flex items-center px-3 pb-3 overflow-x-auto"
      :style="{ minHeight: '56px' }"
    >
      <template v-for="(entry, idx) in displayEntries" :key="entry.hash">
        <!-- Node column -->
        <div
          class="timeline-node flex flex-col items-center shrink-0 cursor-pointer"
          @click="$emit('select', entry)"
        >
          <!-- Tag labels above -->
          <div
            v-if="(entry.tags ?? []).length > 0"
            class="flex flex-col items-center mb-0.5"
          >
            <span
              v-for="tag in (entry.tags ?? [])"
              :key="tag"
              class="text-accent truncate"
              :style="{ maxWidth: '32px', fontSize: '9px', lineHeight: '11px', textAlign: 'center' }"
              :title="tag"
            >
              {{ tag }}
            </span>
          </div>
          <!-- Dot -->
          <div
            class="rounded-full transition-transform hover:scale-125"
            :class="dotClasses(entry)"
            :title="entry.message + ' — ' + formatShortDate(entry.date)"
          />
        </div>
        <!-- Connector line to next -->
        <div
          v-if="idx < displayEntries.length - 1"
          class="shrink-0 bg-dividerLight"
          :style="{ width: '14px', height: '2px' }"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@composables/i18n"
import type { VersionLogEntry } from "~/helpers/erdVersionApi"

const MAX_TIMELINE_NODES = 30

const props = defineProps<{
  entries: VersionLogEntry[]
  selectedRefs: string[]
}>()

defineEmits<{
  (e: "select", entry: VersionLogEntry): void
}>()

const t = useI18n()

const displayEntries = computed(() =>
  props.entries.slice(0, MAX_TIMELINE_NODES),
)

function dotClasses(entry: VersionLogEntry): string[] {
  const isSelected = props.selectedRefs.includes(entry.shortHash)
  const hasTag = (entry.tags ?? []).length > 0
  const classes: string[] = []

  if (isSelected) {
    classes.push("bg-accent ring-2 ring-accent/40")
    classes.push("w-3 h-3")
  } else if (hasTag) {
    classes.push("bg-accent/70")
    classes.push("w-2.5 h-2.5")
  } else {
    classes.push("bg-secondaryLight/50")
    classes.push("w-1.5 h-1.5")
  }

  return classes
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.timeline-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.3) transparent;
}

.timeline-scroll::-webkit-scrollbar {
  height: 4px;
}

.timeline-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.timeline-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
}
</style>
