<template>
  <div class="erd-page-wrapper">
    <AppPaneLayout layout-id="erd">
      <template #primary>
        <div class="erd-page relative h-full">
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
            <div class="erd-toolbar-vertical" />
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
import { useI18n } from "@composables/i18n"
import { useSetting } from "@composables/settings"
import { useToast } from "@composables/toast"
import IconFileJson from "~icons/lucide/file-json"
import IconFileCode from "~icons/lucide/file-code"
import IconDownload from "~icons/lucide/download"
import IconTrash from "~icons/lucide/trash-2"
import IconPanelLeftClose from "~icons/lucide/panel-left-close"
import IconPanelLeftOpen from "~icons/lucide/panel-left-open"
import "@dineug/erd-editor"

const t = useI18n()
const toast = useToast()

const erdEditorRef = ref<HTMLElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)
const sqlFileInput = ref<HTMLInputElement | null>(null)

const bgColor = useSetting("BG_COLOR")
const isDarkMode = computed(() => bgColor.value !== "light")

// Sidebar visibility state with localStorage persistence
const ERD_SIDEBAR_KEY = "erd-sidebar-visible"
const showSidebar = ref<boolean>(true)

onMounted(() => {
  // Restore sidebar visibility from localStorage
  const stored = localStorage.getItem(ERD_SIDEBAR_KEY)
  if (stored !== null) {
    showSidebar.value = stored === "true"
  }

  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    customElements.whenDefined("erd-editor").then(() => {
      if (editor.setInitialValue) {
        editor.setInitialValue(
          JSON.stringify({
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
              database: "MySQL",
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
            table: { entities: {}, indexes: {} },
            memo: { memos: {} },
            relationship: { relationships: {} },
          })
        )
      }
    })
  }
})

onBeforeUnmount(() => {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    if (editor.destroy) editor.destroy()
  }
})

function toggleSidebar() {
  showSidebar.value = !showSidebar.value
  localStorage.setItem(ERD_SIDEBAR_KEY, String(showSidebar.value))
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
    JSON.parse(text)
    if (erdEditorRef.value) {
      const editor = erdEditorRef.value as any
      if (editor.setInitialValue) {
        editor.setInitialValue(text)
        toast.success(t("erd.import_success"))
      }
    }
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
    if (erdEditorRef.value) {
      const editor = erdEditorRef.value as any
      if (editor.setSchemaSQL) {
        editor.setSchemaSQL(sqlText)
        toast.success(t("erd.import_success"))
      }
    }
  } catch (_e) {
    toast.error(t("erd.import_error"))
  }
  input.value = ""
}

function getEditorValue(): string {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    return editor.value || "{}"
  }
  return "{}"
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
    if (erdEditorRef.value) {
      const editor = erdEditorRef.value as any
      if (editor.getSchemaSQL) {
        const sql = editor.getSchemaSQL()
        downloadFile(sql, "erd-schema.sql", "text/sql")
        toast.success(t("erd.export_success_note"))
      }
    }
  } catch (_e) {
    toast.error(t("erd.export_error"))
  }
}

function clearEditor() {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    if (editor.clear) {
      editor.clear()
      toast.success(t("erd.clear_success"))
    }
  }
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

/* Define CSS variables at page level so both our toolbar and erd-editor use the same values */
.erd-page {
  /* Light theme defaults (matching erd-editor's light theme) */
  --toolbar-background: #fcfcfd;
  --foreground: #60646c;
  --active: #1c2024;

  /* Dark theme override */
  :root.dark & {
    --toolbar-background: #1a1a1a;
    --foreground: #8b8b8b;
    --active: #ffffff;
  }
}

/* Toolbar overlay: matches erd-editor's built-in toolbar style */
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

/* Sidebar toggle button (bottom-right) */
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
  transition: opacity 0.2s ease, box-shadow 0.2s ease;
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
</style>
