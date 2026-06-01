<template>
  <div class="relative h-full erd-tab-page">
    <!-- Toolbar overlay -->
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
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue"
import { useVModel } from "@vueuse/core"
import { HoppTab } from "~/services/tab"
import { HoppErdDiagramDocument } from "~/helpers/rest/document"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import {
  restCollections$,
  editRESTCollection,
  editRESTFolder,
  navigateToFolderWithIndexPath,
} from "~/newstore/collections"
import { useReadonlyStream } from "~/composables/stream"
import { TeamCollectionsService } from "~/services/team-collection.service"
import { updateTeamCollection } from "~/helpers/backend/mutations/TeamCollection"
import { parseCollectionData, CollectionDataProps } from "~/helpers/backend/helpers"
import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { GQLError } from "~/helpers/backend/GQLClient"
import { useToast } from "~/composables/toast"
import { useI18n } from "~/composables/i18n"
import { useSetting } from "~/composables/settings"
import IconFileJson from "~icons/lucide/file-json"
import IconFileCode from "~icons/lucide/file-code"
import IconDownload from "~icons/lucide/download"
import IconSave from "~icons/lucide/save"
import IconMinimize2 from "~icons/lucide/minimize-2"
import IconMaximize2 from "~icons/lucide/maximize-2"
import { parsePgSqlToErdJson, isPgSql } from "~/helpers/erdPgSqlParser"
// Must be imported BEFORE erd-editor to patch attachShadow
import {
  initCollapseFeature,
  collapseAllTables,
  expandAllTables,
} from "~/helpers/erdCollapse"
import "@dineug/erd-editor"

const props = defineProps<{
  modelValue: HoppTab<HoppErdDiagramDocument>
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppTab<HoppErdDiagramDocument>): void
}>()

const tab = useVModel(props, "modelValue", emit)
const tabs = useService(RESTTabService)
const teamCollectionService = useService(TeamCollectionsService)
const toast = useToast()
const t = useI18n()

const collections = useReadonlyStream(restCollections$, [])

const erdEditorRef = ref<HTMLElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)
const sqlFileInput = ref<HTMLInputElement | null>(null)

const bgColor = useSetting("BG_COLOR")
const isDarkMode = computed(() => bgColor.value !== "light")

// Collapse feature state
const allCollapsed = ref(false)
let collapseCleanup: (() => void) | null = null

const defaultSchema = JSON.stringify({
  $schema: "https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json",
  version: "3.0.0",
  settings: {
    width: 2000, height: 2000, scrollTop: 0, scrollLeft: 0, zoomLevel: 1,
    show: 423, database: 16, databaseName: "",
    canvasType: "ERD", language: 1, tableNameCase: 4, columnNameCase: 2,
    bracketType: 1, relationshipDataTypeSync: true, relationshipOptimization: false,
    columnOrder: [1, 2, 4, 8, 16, 32, 64], maxWidthComment: -1, ignoreSaveSettings: 0,
  },
  doc: { tableIds: [], relationshipIds: [], indexIds: [], memoIds: [] },
  collections: {
    tableEntities: {}, tableColumnEntities: {}, relationshipEntities: {},
    indexEntities: {}, indexColumnEntities: {}, memoEntities: {},
  },
})

onMounted(() => {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    customElements.whenDefined("erd-editor").then(() => {
      const schemaToLoad = tab.value.document.schema || defaultSchema
      editor.value = schemaToLoad

      // Initialize collapse feature
      if (erdEditorRef.value) {
        collapseCleanup = initCollapseFeature(erdEditorRef.value)
      }
    })

    // Set up auto-save via input event
    erdEditorRef.value.addEventListener("input", () => {
      const val = editor.value
      if (val && val !== tab.value.document.schema) {
        tab.value.document.schema = val
        tab.value.document.isDirty = true
        debouncedSave()
      }
    })
  }
})

onBeforeUnmount(() => {
  if (collapseCleanup) {
    collapseCleanup()
    collapseCleanup = null
  }
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    if (editor.destroy) editor.destroy()
  }
})

let saveTimeout: ReturnType<typeof setTimeout> | null = null

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveToCollection()
  }, 1000)
}

function isTeamCollectionPath(path: string): boolean {
  return !path.split("/").every((seg) => !isNaN(parseInt(seg)))
}

function findTeamCollByID(tree: any[], id: string): any | null {
  for (const coll of tree) {
    if (coll.id === id) return coll
    if (coll.children) {
      const found = findTeamCollByID(coll.children, id)
      if (found) return found
    }
  }
  return null
}

function saveToCollection() {
  const pathStr = tab.value.document.collectionPath
  if (!pathStr && pathStr !== "0") return

  const docIdx = tab.value.document.docIndex

  if (isTeamCollectionPath(pathStr)) {
    const teamColl = findTeamCollByID(
      teamCollectionService.collections.value,
      pathStr
    )
    if (!teamColl) return

    const existingData = parseCollectionData(teamColl.data ?? null)
    const diagrams = [...(existingData.erdDiagrams ?? [])]
    if (diagrams[docIdx]) {
      diagrams[docIdx] = {
        ...diagrams[docIdx],
        name: tab.value.document.name,
        schema: tab.value.document.schema,
      }
      const updatedData: CollectionDataProps = {
        ...existingData,
        erdDiagrams: diagrams,
      }
      pipe(
        updateTeamCollection(teamColl.id, updatedData),
        TE.match(
          (err: GQLError<string>) => {
            console.error("Failed to save ERD diagram:", err)
          },
          () => {}
        )
      )()
    }
    tab.value.document.isDirty = false
    return
  }

  // My collections
  const pathIndices = pathStr.split("/").map((x) => parseInt(x))

  if (pathIndices.length === 1) {
    const collIdx = pathIndices[0]
    const coll = collections.value[collIdx]
    if (!coll || !coll.erdDiagrams) return
    const diagrams = [...coll.erdDiagrams]
    if (diagrams[docIdx]) {
      diagrams[docIdx] = {
        ...diagrams[docIdx],
        name: tab.value.document.name,
        schema: tab.value.document.schema,
      }
      editRESTCollection(collIdx, { erdDiagrams: diagrams })
    }
  } else {
    const folder = navigateToFolderWithIndexPath(
      collections.value,
      pathIndices
    )
    if (!folder || !folder.erdDiagrams) return
    const diagrams = [...folder.erdDiagrams]
    if (diagrams[docIdx]) {
      diagrams[docIdx] = {
        ...diagrams[docIdx],
        name: tab.value.document.name,
        schema: tab.value.document.schema,
      }
      editRESTFolder(pathStr, { erdDiagrams: diagrams })
    }
  }

  tab.value.document.isDirty = false
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
      editor.value = text
      tab.value.document.schema = text
      tab.value.document.isDirty = true
      saveToCollection()
      toast.success(t("erd.import_success"))
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

      if (isPgSql(sqlText)) {
        try {
          const erdJson = parsePgSqlToErdJson(sqlText)
          editor.value = erdJson
          tab.value.document.schema = erdJson
          tab.value.document.isDirty = true
          saveToCollection()
          toast.success(t("erd.import_success"))
        } catch (pgErr) {
          console.error("PG SQL parse error:", pgErr)
          if (editor.setSchemaSQL) {
            editor.setSchemaSQL(sqlText)
            tab.value.document.isDirty = true
            toast.success(t("erd.import_success"))
          }
        }
      } else {
        if (editor.setSchemaSQL) {
          editor.setSchemaSQL(sqlText)
          tab.value.document.isDirty = true
          toast.success(t("erd.import_success"))
        }
      }
    }
  } catch (_e) {
    toast.error(t("erd.import_error"))
  }
  input.value = ""
}

function manualSave() {
  if (erdEditorRef.value) {
    const editor = erdEditorRef.value as any
    const val = editor.value
    if (val) {
      tab.value.document.schema = val
      tab.value.document.isDirty = true
    }
  }
  saveToCollection()
  toast.success(t("erd.save_success"))
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
    downloadFile(getEditorValue(), `${tab.value.document.name || "erd"}.json`, "application/json")
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
        downloadFile(sql, `${tab.value.document.name || "erd"}.sql`, "text/sql")
        toast.success(t("erd.export_success_note"))
      }
    }
  } catch (_e) {
    toast.error(t("erd.export_error"))
  }
}
</script>

<style lang="scss" scoped>
.erd-tab-page {
  height: 100%;
}

erd-editor {
  display: block;
  width: 100%;
  height: 100%;
}

.erd-tab-page {
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
