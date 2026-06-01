<template>
  <div class="erd-diff-wrapper">
    <!-- Top status bar -->
    <div class="erd-diff-statusbar">
      <div class="erd-diff-statusbar-left">
        <IconGitCompare class="erd-diff-statusbar-icon" />
        <span class="erd-diff-statusbar-text">
          {{ t("erd.diff.comparing") }}:
          <span class="erd-diff-hash">{{ fromRef }}</span>
          <span class="erd-diff-arrow">→</span>
          <span class="erd-diff-hash">{{ toRef }}</span>
        </span>
        <span v-if="stats" class="erd-diff-statusbar-stats">
          <span class="erd-diff-stat erd-diff-stat--added">🟢{{ t("erd.diff.added_short", { n: stats.addedTables }) }}</span>
          <span class="erd-diff-stat erd-diff-stat--modified">🟡{{ t("erd.diff.modified_short", { n: stats.modifiedTables }) }}</span>
          <span class="erd-diff-stat erd-diff-stat--removed">⚪{{ t("erd.diff.removed_short", { n: stats.removedTables }) }}</span>
        </span>
      </div>
      <button class="erd-diff-close-btn" @click="emit('close')">
        <IconX class="h-4 w-4" />
        <span>{{ t("erd.diff.exit") }}</span>
      </button>
    </div>

    <!-- Main content: erd-editor (readonly) + DiffDetail panel -->
    <div class="erd-diff-body">
      <!-- erd-editor with readonly overlay -->
      <div class="erd-diff-canvas">
        <erd-editor ref="diffEditorRef" :system-dark-mode="isDarkMode" />
        <!-- Readonly overlay: blocks all pointer events on erd-editor -->
        <div class="erd-diff-readonly-overlay" />
        <!-- Loading overlay -->
        <div v-if="loading" class="erd-diff-loading">
          <span class="erd-diff-loading-text">{{ t("loading") }}</span>
        </div>
      </div>

      <!-- DiffDetail side panel -->
      <div class="erd-diff-detail">
        <ErdDiffDetail v-if="diffResult" :diff-result="diffResult" />
        <div v-else-if="!loading" class="erd-diff-detail-empty">
          {{ t("erd.diff.no_changes") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue"
import { useI18n } from "@composables/i18n"
import { useSetting } from "@composables/settings"
import { useToast } from "@composables/toast"
import IconGitCompare from "~icons/lucide/git-compare"
import IconX from "~icons/lucide/x"
import {
  type DiffResult,
  getVersion,
  getDiff,
} from "~/helpers/erdVersionApi"
import { mergeVersionsForDisplay, computeDiffStats } from "~/helpers/erdDiff"
import ErdDiffDetail from "./ErdDiffDetail.vue"
// Must be imported BEFORE erd-editor to patch attachShadow
import "@dineug/erd-editor"

const props = defineProps<{
  teamId: string
  collectionId: string
  fromRef: string
  toRef: string
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const t = useI18n()
const toast = useToast()

const bgColor = useSetting("BG_COLOR")
const isDarkMode = computed(() => bgColor.value !== "light")

const diffEditorRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const diffResult = ref<DiffResult | null>(null)

const stats = computed(() => {
  if (!diffResult.value) return null
  return computeDiffStats(diffResult.value)
})

function getDiffEditor(): any {
  return diffEditorRef.value as any
}

async function loadDiffData() {
  loading.value = true
  try {
    // Fetch both versions' ERD JSON and the diff result in parallel
    const [fromVersion, toVersion, diff] = await Promise.all([
      getVersion(props.teamId, props.collectionId, props.fromRef),
      getVersion(props.teamId, props.collectionId, props.toRef),
      getDiff(props.teamId, props.collectionId, props.fromRef, props.toRef),
    ])

    diffResult.value = diff

    // Generate merged JSON with color annotations
    const mergedJson = mergeVersionsForDisplay(
      fromVersion.erdJson,
      toVersion.erdJson,
      diff,
    )

    // Wait for erd-editor to be defined, then load the merged JSON
    await customElements.whenDefined("erd-editor")
    const editor = getDiffEditor()
    if (editor) {
      editor.value = mergedJson
    }
  } catch (err: any) {
    console.error("Failed to load diff data:", err)
    toast.error(t("erd.diff.load_error"))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDiffData()
})

onBeforeUnmount(() => {
  if (diffEditorRef.value) {
    const editor = getDiffEditor()
    if (editor?.destroy) editor.destroy()
  }
})

// Reload if refs change
watch(
  () => [props.fromRef, props.toRef],
  () => {
    if (props.fromRef && props.toRef) {
      loadDiffData()
    }
  },
)
</script>

<style lang="scss" scoped>
.erd-diff-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.erd-diff-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: var(--toolbar-background, #fcfcfd);
  border-bottom: 1px solid var(--foreground, #60646c);
  opacity: 0.9;
  flex-shrink: 0;
  z-index: 10;
}

.erd-diff-statusbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.erd-diff-statusbar-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--foreground, #60646c);
}

.erd-diff-statusbar-text {
  font-size: 12px;
  color: var(--foreground, #60646c);
  white-space: nowrap;
}

.erd-diff-hash {
  font-family: monospace;
  font-weight: 600;
  color: var(--active, #1c2024);
  background-color: rgba(128, 128, 128, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
}

.erd-diff-arrow {
  margin: 0 2px;
  opacity: 0.5;
}

.erd-diff-statusbar-stats {
  display: flex;
  gap: 8px;
  margin-left: 12px;
  font-size: 11px;
}

.erd-diff-stat {
  white-space: nowrap;
}

.erd-diff-close-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--foreground, #60646c);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--foreground, #60646c);
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: rgba(128, 128, 128, 0.15);
  }
}

.erd-diff-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.erd-diff-canvas {
  flex: 1;
  position: relative;
  min-width: 0;

  erd-editor {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.erd-diff-readonly-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  pointer-events: auto;
  cursor: default;
  /* Transparent but blocks all pointer events from reaching erd-editor */
}

.erd-diff-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.3);
}

.erd-diff-loading-text {
  font-size: 13px;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 6px 16px;
  border-radius: 6px;
}

.erd-diff-detail {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--foreground, #60646c);
  background-color: var(--toolbar-background, #fcfcfd);
  overflow-y: auto;
}

.erd-diff-detail-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--foreground, #60646c);
  opacity: 0.5;
}

/* Page-level theme variables (inherited from erd.vue) */
.erd-diff-wrapper {
  --toolbar-background: #fcfcfd;
  --foreground: #60646c;
  --active: #1c2024;

  :root.dark & {
    --toolbar-background: #1a1a1a;
    --foreground: #8b8b8b;
    --active: #ffffff;
  }
}
</style>
