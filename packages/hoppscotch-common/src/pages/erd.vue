<template>
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
  background-color: #1a1a1a; /* Dark mode toolbar background */
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

  /* Use appropriate colors based on theme */
  fill: #8b8b8b;

  &:hover {
    fill: #ffffff;
  }

  &--danger:hover {
    fill: #f87171;
  }
}

/* Light mode adjustments */
:root[data-theme="light"] .erd-toolbar-menu {
  fill: #60646c;

  &:hover {
    fill: #1c2024;
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
</style>
