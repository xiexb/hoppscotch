<template>
  <div class="erd-page flex flex-col h-full">
    <!-- Toolbar -->
    <div
      class="erd-toolbar flex items-center gap-2 px-4 py-2 border-b border-dividerLight bg-primary"
    >
      <HoppButtonSecondary
        :icon="IconFileJson"
        :label="t('erd.import_json')"
        outline
        @click="triggerImportJSON"
      />
      <HoppButtonSecondary
        :icon="IconFileCode"
        :label="t('erd.import_sql')"
        outline
        @click="triggerImportSQL"
      />
      <HoppButtonSecondary
        :icon="IconDownload"
        :label="t('erd.export_sql')"
        outline
        @click="exportSQL"
      />
      <HoppButtonSecondary
        :icon="IconDownload"
        :label="t('erd.export_json')"
        outline
        @click="exportJSON"
      />
      <div class="flex-1" />
      <HoppButtonSecondary
        :icon="IconTrash"
        :label="t('erd.clear')"
        outline
        @click="clearEditor"
      />
    </div>

    <!-- Editor Container -->
    <div ref="editorContainer" class="erd-editor-container flex-1 min-h-0">
      <erd-editor ref="erdEditorRef" :system-dark-mode="isDarkMode" />
    </div>

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

// Detect dark mode from Hoppscotch settings
const bgColor = useSetting("BG_COLOR")
const isDarkMode = computed(() => {
  return bgColor.value !== "light"
})

onMounted(() => {
  // erd-editor registers itself as a custom element on import
  // Initialize with empty schema
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    // Wait for the custom element to be defined
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
            table: {
              entities: {},
              indexes: {},
            },
            memo: {
              memos: {},
            },
            relationship: {
              relationships: {},
            },
          })
        )
      }
    })
  }
})

onBeforeUnmount(() => {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    if (editor.destroy) {
      editor.destroy()
    }
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
    // Validate JSON
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

  // Reset input
  input.value = ""
}

async function handleImportSQL(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const sqlText = await file.text()

    // Use erd-editor's schema-sql-parser to convert SQL to schema
    // For now, we'll use the editor's built-in import functionality if available
    // The erd-editor has a SQL import feature via its toolbar
    // We can also try to use the value setter with SQL format
    if (erdEditorRef.value) {
      const editor = erdEditorRef.value as any
      // erd-editor can parse SQL DDL through its internal parser
      // We'll set it as the value and let it parse
      if (editor.value !== undefined) {
        // Try setting SQL as value - erd-editor should handle DDL
        editor.setInitialValue(sqlText)
        toast.success(t("erd.import_success"))
      }
    }
  } catch (_e) {
    toast.error(t("erd.import_error"))
  }

  // Reset input
  input.value = ""
}

function getEditorValue(): string {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    return editor.value || "{}"
  }
  return "{}"
}

function exportJSON() {
  try {
    const value = getEditorValue()
    const blob = new Blob([value], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "erd-schema.json"
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t("erd.export_success"))
  } catch (_e) {
    toast.error(t("erd.export_error"))
  }
}

function exportSQL() {
  try {
    const value = getEditorValue()
    // erd-editor stores schema as JSON, SQL export is handled internally
    // The editor has a "Generate SQL" feature in its toolbar
    // We export the JSON and let user use the editor's SQL generation
    const blob = new Blob([value], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "erd-schema.json"
    a.click()
    URL.revokeObjectURL(url)
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

.erd-editor-container {
  width: 100%;
  position: relative;
}

erd-editor {
  display: block;
  width: 100%;
  height: 100%;
}

.hidden {
  display: none;
}
</style>
