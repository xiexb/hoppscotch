<template>
  <div class="erd-page relative h-full">
    <!-- Floating icon toolbar over erd-editor -->
    <div class="erd-icon-toolbar">
      <button
        :title="t('erd.import_json')"
        class="toolbar-icon-btn"
        @click="triggerImportJSON"
      >
        <IconFileJson class="toolbar-icon" />
      </button>
      <button
        :title="t('erd.import_sql')"
        class="toolbar-icon-btn"
        @click="triggerImportSQL"
      >
        <IconFileCode class="toolbar-icon" />
      </button>
      <div class="toolbar-divider" />
      <button
        :title="t('erd.export_json')"
        class="toolbar-icon-btn"
        @click="exportJSON"
      >
        <IconFileJson class="toolbar-icon" />
        <IconDownload class="toolbar-icon-badge" />
      </button>
      <button
        :title="t('erd.export_sql')"
        class="toolbar-icon-btn"
        @click="exportSQL"
      >
        <IconFileCode class="toolbar-icon" />
        <IconDownload class="toolbar-icon-badge" />
      </button>
      <div class="toolbar-divider" />
      <button
        :title="t('erd.clear')"
        class="toolbar-icon-btn toolbar-icon-btn--danger"
        @click="clearEditor"
      >
        <IconTrash class="toolbar-icon" />
      </button>
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
import "@dineug/erd-editor"

const t = useI18n()
const toast = useToast()

const erdEditorRef = ref<HTMLElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)
const sqlFileInput = ref<HTMLInputElement | null>(null)

const bgColor = useSetting("BG_COLOR")
const isDarkMode = computed(() => bgColor.value !== "light")

onMounted(() => {
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
      if (editor.setInitialValue) {
        editor.setInitialValue(sqlText)
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
    const value = getEditorValue()
    downloadFile(value, "erd-schema.json", "application/json")
    toast.success(t("erd.export_success_note"))
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
.erd-page {
  height: 100%;
}

erd-editor {
  display: block;
  width: 100%;
  height: 100%;
}

/* Floating toolbar: positioned over erd-editor's top-right area */
.erd-icon-toolbar {
  position: absolute;
  top: 6px;
  right: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 4px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.toolbar-icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  &:active {
    background: rgba(255, 255, 255, 0.2);
  }

  &--danger:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #f87171;
  }
}

.toolbar-icon {
  width: 16px;
  height: 16px;
}

.toolbar-icon-badge {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 10px;
  height: 10px;
  opacity: 0.6;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: rgba(255, 255, 255, 0.15);
}

.hidden {
  display: none;
}
</style>
