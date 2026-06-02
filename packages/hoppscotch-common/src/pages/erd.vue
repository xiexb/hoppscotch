<template>
  <div class="erd-page-wrapper">
    <AppPaneLayout layout-id="erd">
      <template #primary>
        <!-- Diff Mode View -->
        <div v-if="diffMode" class="erd-page relative h-full">
          <ErdDiffView
            :team-id="teamId"
            :collection-id="collectionId"
            :from-ref="diffFrom"
            :to-ref="diffTo"
            @close="exitDiffMode"
          />
        </div>

        <!-- Normal Editor View -->
        <div v-else class="erd-page relative h-full">
          <!-- Toolbar overlay: matches erd-editor toolbar style -->
          <div class="erd-toolbar-overlay">
            <div
              class="erd-toolbar-menu"
              :title="t('erd.import_json')"
              @click="triggerImportJSON"
            >
              <IconFileJson class="erd-toolbar-icon" />
            </div>
            <div
              class="erd-toolbar-menu"
              :title="t('erd.import_sql')"
              @click="triggerImportSQL"
            >
              <IconFileCode class="erd-toolbar-icon" />
            </div>
            <div class="erd-toolbar-vertical" />
            <div
              class="erd-toolbar-menu"
              :title="t('erd.export_json')"
              @click="exportJSON"
            >
              <IconFileJson class="erd-toolbar-icon" />
              <IconDownload class="erd-toolbar-badge" />
            </div>
            <div
              class="erd-toolbar-menu"
              :title="t('erd.export_sql')"
              @click="exportSQL"
            >
              <IconFileCode class="erd-toolbar-icon" />
              <IconDownload class="erd-toolbar-badge" />
            </div>
            <div
              class="erd-toolbar-menu erd-toolbar-menu--save"
              :title="t('erd.save')"
              @click="manualSave"
            >
              <IconSave class="erd-toolbar-icon" />
            </div>
            <div class="erd-toolbar-vertical" />
            <div
              class="erd-toolbar-menu"
              :title="allCollapsed ? t('erd.expand_all') : t('erd.collapse_all')"
              @click="toggleCollapseAll"
            >
              <component
                :is="allCollapsed ? IconMaximize2 : IconMinimize2"
                class="erd-toolbar-icon"
              />
            </div>
            <div
              class="erd-toolbar-menu"
              :class="{ 'erd-toolbar-menu--active': showVersionPanel }"
              :title="t('erd.version.title')"
              @click="toggleVersionPanel"
            >
              <IconHistory class="erd-toolbar-icon" />
            </div>
            <div
              class="erd-toolbar-menu erd-toolbar-menu--danger"
              :title="t('erd.clear')"
              @click="clearEditor"
            >
              <IconTrash class="erd-toolbar-icon" />
            </div>
          </div>

          <!-- erd-editor -->
          <erd-editor ref="erdEditorRef" :system-dark-mode="isDarkMode" />

          <!-- Hidden file inputs -->
          <input
            ref="jsonFileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleImportJSON"
          />
          <input
            ref="sqlFileInput"
            type="file"
            accept=".sql,.txt"
            class="hidden"
            @change="handleImportSQL"
          />

          <!-- Version Panel Drawer (right-side overlay) -->
          <Transition name="slide-right">
            <div v-if="showVersionPanel" class="erd-version-drawer">
              <div class="erd-version-drawer-header">
                <span class="erd-version-drawer-title">{{ t("erd.version.title") }}</span>
                <button
                  class="erd-version-drawer-close"
                  :title="t('action.close')"
                  @click="showVersionPanel = false"
                >
                  <IconX class="h-4 w-4" />
                </button>
              </div>
              <div class="erd-version-drawer-body">
                <ErdVersionPanel
                  :team-id="teamId"
                  :collection-id="collectionId"
                  :current-erd-json="getEditorValue()"
                  @restore="handleVersionRestore"
                  @compare="handleVersionCompare"
                  @saved="handleVersionSaved"
                />
              </div>
            </div>
          </Transition>

          <!-- Sidebar toggle button (bottom-right) -->
          <button
            class="erd-sidebar-toggle"
            :title="showSidebar ? t('erd.hide_sidebar') : t('erd.show_sidebar')"
            @click="toggleSidebar"
          >
            <component
              :is="showSidebar ? IconPanelLeftClose : IconPanelLeftOpen"
              class="erd-sidebar-toggle-icon"
            />
          </button>
        </div>
      </template>
      <template v-if="showSidebar" #sidebar>
        <Collections />
      </template>
    </AppPaneLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from "vue"
import { useRoute } from "vue-router"
import { useI18n } from "@composables/i18n"
import { useSetting } from "@composables/settings"
import { useToast } from "@composables/toast"
import { parsePgSqlToErdJson, isPgSql } from "@helpers/erdPgSqlParser"
import IconFileJson from "~icons/lucide/file-json"
import IconFileCode from "~icons/lucide/file-code"
import IconDownload from "~icons/lucide/download"
import IconTrash from "~icons/lucide/trash-2"
import IconSave from "~icons/lucide/save"
import IconPanelLeftClose from "~icons/lucide/panel-left-close"
import IconPanelLeftOpen from "~icons/lucide/panel-left-open"
import IconMinimize2 from "~icons/lucide/minimize-2"
import IconMaximize2 from "~icons/lucide/maximize-2"
import IconHistory from "~icons/lucide/history"
import IconX from "~icons/lucide/x"
import { commitVersion } from "@helpers/erdVersionApi"
import ErdVersionPanel from "@components/erd/ErdVersionPanel.vue"
import ErdDiffView from "@components/erd/ErdDiffView.vue"
// Must be imported BEFORE erd-editor to patch attachShadow
import {
  initCollapseFeature,
  collapseAllTables,
  expandAllTables,
} from "@helpers/erdCollapse"
import "@dineug/erd-editor"

const t = useI18n()
const toast = useToast()
const route = useRoute()

// Collection context from route query params
const teamId = computed(() => (route.query.teamId as string) || "")
const collectionId = computed(() => (route.query.collectionId as string) || "")
const hasCollectionContext = computed(() => !!teamId.value && !!collectionId.value)

// Version panel state
const showVersionPanel = ref(false)

// Auto-enter diff mode if query params are present
const initialDiffFrom = (route.query.diffFrom as string) || ""
const initialDiffTo = (route.query.diffTo as string) || ""
const diffMode = ref(!!(initialDiffFrom && initialDiffTo))
const diffFrom = ref(initialDiffFrom)
const diffTo = ref(initialDiffTo)

const erdEditorRef = ref<HTMLElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)
const sqlFileInput = ref<HTMLInputElement | null>(null)

const bgColor = useSetting("BG_COLOR")
const isDarkMode = computed(() => bgColor.value !== "light")

// localStorage keys
const ERD_SIDEBAR_KEY = "erd-sidebar-visible"
const ERD_DATA_KEY = "erd-editor-data"
const showSidebar = ref<boolean>(true)

// Auto-save timer
let saveTimer: ReturnType<typeof setInterval> | null = null

// Collapse feature state
const allCollapsed = ref(false)
let collapseCleanup: (() => void) | null = null

function getEditor(): any {
  return erdEditorRef.value as any
}

function getEditorValue(): string {
  const editor = getEditor()
  if (editor) return editor.value || "{}"
  return "{}"
}

function setEditorValue(json: string) {
  const editor = getEditor()
  if (editor) {
    editor.value = json
  }
}

// Save editor state to localStorage (debounced via interval)
function saveToStorage() {
  try {
    const val = getEditorValue()
    const parsed = JSON.parse(val)
    // Only save if there's actual content (tables exist)
    const hasContent =
      parsed.collections?.tableEntities &&
      Object.keys(parsed.collections.tableEntities).length > 0
    if (hasContent) {
      localStorage.setItem(ERD_DATA_KEY, val)
    }
  } catch (_e) {
    // ignore save errors
  }
}

// Restore editor state from localStorage
function restoreFromStorage(): boolean {
  try {
    const saved = localStorage.getItem(ERD_DATA_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      const hasContent =
        parsed.collections?.tableEntities &&
        Object.keys(parsed.collections.tableEntities).length > 0
      if (hasContent) {
        setEditorValue(saved)
        return true
      }
    }
  } catch (_e) {
    // ignore restore errors
  }
  return false
}

onMounted(() => {
  // Restore sidebar visibility
  const stored = localStorage.getItem(ERD_SIDEBAR_KEY)
  if (stored !== null) {
    showSidebar.value = stored === "true"
  }

  if (erdEditorRef.value) {
    customElements.whenDefined("erd-editor").then(() => {
      // Try to restore saved data
      const restored = restoreFromStorage()

      if (!restored) {
        // Set empty initial state with PostgreSQL as default database
        const editor = getEditor()
        if (editor) {
          editor.value = JSON.stringify({
            $schema:
              "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",
            version: "3.0.0",
            settings: {
              width: 2000,
              height: 2000,
              scrollTop: 0,
              scrollLeft: 0,
              zoomLevel: 1,
              show: 423,
              database: 16,
              databaseName: "",
              canvasType: "ERD",
              language: 1,
              tableNameCase: 4,
              columnNameCase: 2,
              bracketType: 1,
              relationshipDataTypeSync: true,
              relationshipOptimization: false,
              columnOrder: [1, 2, 4, 8, 16, 32, 64],
              maxWidthComment: -1,
              ignoreSaveSettings: 0,
            },
            doc: {
              tableIds: [],
              relationshipIds: [],
              indexIds: [],
              memoIds: [],
            },
            collections: {
              tableEntities: {},
              tableColumnEntities: {},
              relationshipEntities: {},
              indexEntities: {},
              indexColumnEntities: {},
              memoEntities: {},
            },
          })
        }
      }

      // Auto-save every 3 seconds
      saveTimer = setInterval(saveToStorage, 3000)

      // Initialize collapse feature
      if (erdEditorRef.value) {
        collapseCleanup = initCollapseFeature(erdEditorRef.value)
      }
    })
  }

  // Save on page unload
  window.addEventListener("beforeunload", saveToStorage)
})

onBeforeUnmount(() => {
  // Save before leaving
  saveToStorage()
  if (saveTimer) {
    clearInterval(saveTimer)
    saveTimer = null
  }
  if (collapseCleanup) {
    collapseCleanup()
    collapseCleanup = null
  }
  window.removeEventListener("beforeunload", saveToStorage)
  if (erdEditorRef.value) {
    const editor = getEditor()
    if (editor?.destroy) editor.destroy()
  }
})

function toggleSidebar() {
  showSidebar.value = !showSidebar.value
  localStorage.setItem(ERD_SIDEBAR_KEY, String(showSidebar.value))
}

function toggleCollapseAll() {
  if (!erdEditorRef.value) return

  if (allCollapsed.value) {
    expandAllTables(erdEditorRef.value)
    allCollapsed.value = false
  } else {
    collapseAllTables(erdEditorRef.value)
    allCollapsed.value = true
  }
}

function triggerImportJSON() {
  jsonFileInput.value?.click()
}

function triggerImportSQL() {
  sqlFileInput.value?.click()
}

async function handleImportJSON(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    JSON.parse(text) // validate JSON
    setEditorValue(text)
    toast.success(t("erd.import_success"))
    // Save after import
    setTimeout(saveToStorage, 500)
  } catch (_e) {
    toast.error(t("erd.import_error"))
  }
  input.value = ""
}

async function handleImportSQL(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const sqlText = await file.text()
    const editor = getEditor()

    if (isPgSql(sqlText)) {
      // PostgreSQL: use our custom parser → set via value property
      try {
        const erdJson = parsePgSqlToErdJson(sqlText)
        setEditorValue(erdJson)
        toast.success(t("erd.import_success"))
        setTimeout(saveToStorage, 500)
      } catch (pgErr) {
        console.error("PG SQL parse error:", pgErr)
        // Fallback to built-in
        if (editor?.setSchemaSQL) {
          editor.setSchemaSQL(sqlText)
          toast.success(t("erd.import_success"))
          setTimeout(saveToStorage, 500)
        }
      }
    } else {
      // Non-PG SQL: use built-in parser
      if (editor?.setSchemaSQL) {
        editor.setSchemaSQL(sqlText)
        toast.success(t("erd.import_success"))
        setTimeout(saveToStorage, 500)
      }
    }
  } catch (_e) {
    toast.error(t("erd.import_error"))
  }
  input.value = ""
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportJSON() {
  try {
    downloadFile(getEditorValue(), "erd-schema.json", "application/json")
    toast.success(t("erd.export_success"))
  } catch (_e) {
    toast.error(t("erd.export_error"))
  }
}

function exportSQL() {
  try {
    const editor = getEditor()
    if (editor?.getSchemaSQL) {
      const sql = editor.getSchemaSQL()
      downloadFile(sql, "erd-schema.sql", "text/sql")
      toast.success(t("erd.export_success_note"))
    }
  } catch (_e) {
    toast.error(t("erd.export_error"))
  }
}

function manualSave() {
  saveToStorage()
  toast.success(t("erd.save_success"))

  // Auto-commit when collection context is available
  if (hasCollectionContext.value) {
    const erdJson = getEditorValue()
    commitVersion(teamId.value, collectionId.value, erdJson).catch((err: any) => {
      console.warn("Auto-commit failed:", err)
      toast.error(t("erd.version.auto_commit_error"))
    })
  }
}

function clearEditor() {
  const editor = getEditor()
  if (editor?.clear) {
    editor.clear()
    toast.success(t("erd.clear_success"))
    // Clear saved data too
    localStorage.removeItem(ERD_DATA_KEY)
  }
}

// ─── Version Panel Event Handlers ────────────────────────────────

function toggleVersionPanel() {
  showVersionPanel.value = !showVersionPanel.value
}

function handleVersionRestore(erdJson: string) {
  setEditorValue(erdJson)
  toast.success(t("erd.version.restore_success"))
  // Save restored data to localStorage
  setTimeout(saveToStorage, 500)
}

function handleVersionCompare(from: string, to: string) {
  diffFrom.value = from
  diffTo.value = to
  diffMode.value = true
  // Close version panel when entering diff mode
  showVersionPanel.value = false
}

function exitDiffMode() {
  diffMode.value = false
  diffFrom.value = ""
  diffTo.value = ""
}

function handleVersionSaved() {
  // Version list is refreshed internally by ErdVersionPanel
}
</script>

<style lang="scss" scoped>
.erd-page-wrapper {
  height: 100%;
}

.erd-page {
  height: 100%;
}

erd-editor {
  display: block;
  width: 100%;
  height: 100%;
}

.erd-page {
  --toolbar-background: #fcfcfd;
  --foreground: #60646c;
  --active: #1c2024;

  :root.dark & {
    --toolbar-background: #1a1a1a;
    --foreground: #8b8b8b;
    --active: #ffffff;
  }
}

.erd-toolbar-overlay {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 15px;
  pointer-events: none;
  background-color: var(--toolbar-background);
}

.erd-toolbar-menu {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 5px;
  cursor: pointer;
  pointer-events: auto;
  transition: fill 0.15s ease;
  fill: var(--foreground);

  &:hover {
    fill: var(--active);
  }

  &--danger:hover {
    fill: #f87171;
  }
}

.erd-toolbar-icon {
  width: 16px;
  height: 16px;
}

.erd-toolbar-badge {
  position: absolute;
  bottom: 4px;
  right: 0px;
  width: 9px;
  height: 9px;
  opacity: 0.7;
}

.erd-toolbar-vertical {
  width: 10px;
  height: 100%;
}

.hidden {
  display: none;
}

.erd-sidebar-toggle {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--foreground, #60646c);
  background-color: var(--toolbar-background, #fcfcfd);
  cursor: pointer;
  opacity: 0.7;
  transition:
    opacity 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  &:hover {
    opacity: 1;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  }
}

.erd-sidebar-toggle-icon {
  width: 18px;
  height: 18px;
  color: var(--foreground, #60646c);
}

.erd-toolbar-menu--active {
  fill: var(--active);
  background-color: rgba(128, 128, 128, 0.15);
  border-radius: 3px;
}

.erd-version-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  max-width: 90%;
  z-index: 25;
  display: flex;
  flex-direction: column;
  background-color: var(--toolbar-background, #fcfcfd);
  border-left: 1px solid var(--foreground, #60646c);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
}

.erd-version-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--foreground, #60646c);
  opacity: 0.8;
  flex-shrink: 0;
}

.erd-version-drawer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground, #60646c);
}

.erd-version-drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--foreground, #60646c);
  border-radius: 4px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: rgba(128, 128, 128, 0.2);
  }
}

.erd-version-drawer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Slide transition for the drawer */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
