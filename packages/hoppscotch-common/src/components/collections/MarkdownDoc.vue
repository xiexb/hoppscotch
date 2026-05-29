<template>
  <div class="flex flex-col h-full">
    <!-- Header: doc name + edit/preview toggle + delete -->
    <div
      class="flex items-center gap-3 px-4 py-2.5 border-b border-dividerLight bg-primary"
    >
      <!-- Document name -->
      <input
        v-if="isEditingName"
        ref="nameInputRef"
        :value="docName"
        class="flex-1 bg-transparent text-sm font-semibold text-secondaryDark outline-none border-b border-accent py-0.5"
        @blur="finishEditName"
        @input="onNameInput"
        @keyup.enter="finishEditName"
      />
      <span
        v-else
        class="flex-1 text-sm font-semibold text-secondaryDark truncate cursor-pointer hover:text-accent transition-colors"
        :title="docName"
        @dblclick="startEditName"
      >
        {{ docName || t("collection.markdown_doc_name") }}
      </span>

      <!-- Edit/Preview toggle -->
      <HoppButtonSecondary
        v-if="isPreview"
        :label="t('collection.edit_doc')"
        :icon="IconEdit"
        class="!px-2.5 !py-1"
        @click="isPreview = false"
      />
      <HoppButtonSecondary
        v-else
        :label="t('collection.preview_doc')"
        :icon="IconEye"
        class="!px-2.5 !py-1"
        @click="isPreview = true"
      />

      <!-- Delete -->
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.delete')"
        :icon="IconTrash"
        class="!px-2 !py-1 !text-red-500 hover:!text-red-400"
        @click="confirmDelete"
      />
    </div>

    <!-- Editor / Preview area -->
    <div class="flex-1 overflow-auto">
      <MdEditor
        v-if="!isPreview"
        v-model="content"
        :theme="isDark ? 'dark' : 'light'"
        :language="locale === 'cn' ? 'zh-CN' : 'en-US'"
        style="height: 100%"
        :toolbars-exclude="['github']"
        @on-save="onContentSave"
      />
      <MdPreview
        v-else
        :model-value="content"
        :theme="isDark ? 'dark' : 'light'"
        :language="locale === 'cn' ? 'zh-CN' : 'en-US'"
        style="height: 100%"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue"
import { MdEditor, MdPreview } from "md-editor-v3"
import "md-editor-v3/lib/style.css"
import IconEdit from "~icons/lucide/edit"
import IconEye from "~icons/lucide/eye"
import IconTrash from "~icons/lucide/trash"
import { useI18n } from "~/composables/i18n"
import { useSetting } from "~/composables/settings"

const t = useI18n()

const props = defineProps<{
  docId: string
  docName: string
  docContent: string
  collectionPath: string
  docIndex: number
}>()

const emit = defineEmits<{
  (e: "update:docName", value: string): void
  (e: "update:docContent", value: string): void
  (e: "delete"): void
}>()

// Dark theme detection
const bgColor = useSetting("BG_COLOR")
const isDark = computed(() => {
  if (bgColor.value === "dark" || bgColor.value === "black") return true
  if (bgColor.value === "system") {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    )
  }
  return false
})

// Locale detection
const locale = computed(() => {
  return t("locale") === "简体中文" ? "cn" : "en"
})

// State
const isPreview = ref(false)
const isEditingName = ref(false)
const nameInputRef = ref<HTMLInputElement | null>(null)
const content = ref(props.docContent)

// Sync content from parent
watch(
  () => props.docContent,
  (val) => {
    if (val !== content.value) {
      content.value = val
    }
  }
)

// Auto-save content on change (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(content, (val) => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    emit("update:docContent", val)
  }, 500)
})

function onContentSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  emit("update:docContent", content.value)
}

// Name editing
function startEditName() {
  isEditingName.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

function finishEditName() {
  isEditingName.value = false
  const inputVal = nameInputRef.value?.value?.trim()
  if (inputVal && inputVal !== props.docName) {
    emit("update:docName", inputVal)
  }
}

function onNameInput(e: Event) {
  // Just let the input update naturally
}

// Delete
function confirmDelete() {
  if (window.confirm(t("collection.delete_doc_confirm"))) {
    emit("delete")
  }
}
</script>

<style scoped>
/* Override md-editor-v3 styles to match Hoppscotch theme */
:deep(.md-editor) {
  --md-bk-color: var(--primary-color) !important;
  --md-bk-color-outstand: var(--primary-dark-color) !important;
  --md-bk-hover-color: var(--primary-light-color) !important;
  --md-border-color: var(--divider-color) !important;
  --md-border-hover-color: var(--divider-dark-color) !important;
  --md-color: var(--secondary-color) !important;
  --md-hover-color: var(--secondary-dark-color) !important;
  border: none !important;
}

:deep(.md-editor-dark) {
  --md-bk-color: var(--primary-color) !important;
  --md-bk-color-outstand: var(--primary-dark-color) !important;
  --md-bk-hover-color: var(--primary-light-color) !important;
  --md-border-color: var(--divider-color) !important;
  --md-border-hover-color: var(--divider-dark-color) !important;
  --md-color: var(--secondary-color) !important;
  --md-hover-color: var(--secondary-dark-color) !important;
}

/* Toolbar */
:deep(.md-editor-toolbar-wrapper) {
  background-color: var(--primary-color);
  border-bottom: 1px solid var(--divider-color) !important;
}

:deep(.md-editor-toolbar-item) {
  color: var(--secondary-color) !important;
  transition: color 0.15s ease;
}

:deep(.md-editor-toolbar-item:hover) {
  color: var(--accent-color) !important;
  background-color: var(--primary-light-color) !important;
}

:deep(.md-editor-toolbar-item svg) {
  fill: currentColor !important;
}

/* Dropdown menus - follow theme */
:deep(.md-editor-dropdown) {
  background-color: var(--primary-color) !important;
  border: 1px solid var(--divider-color) !important;
  border-radius: 6px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18) !important;
}

:deep(.md-editor-menu) {
  background-color: var(--primary-color) !important;
  border: none !important;
}

:deep(.md-editor-menu-item) {
  color: var(--secondary-color) !important;
}

:deep(.md-editor-menu-item:hover) {
  background-color: var(--primary-light-color) !important;
  color: var(--accent-color) !important;
}

/* Modal dialogs */
:deep(.md-editor-modal) {
  background-color: var(--primary-color) !important;
  border: 1px solid var(--divider-color) !important;
  border-radius: 8px !important;
}

:deep(.md-editor-modal-header) {
  color: var(--secondary-dark-color) !important;
  border-bottom: 1px solid var(--divider-color) !important;
}

/* Editor area */
:deep(.md-editor-content) {
  background-color: var(--primary-color) !important;
}

:deep(.md-editor-wrapper) {
  background-color: var(--primary-color) !important;
}

/* Preview area - typography */
:deep(.md-editor-preview-wrapper) {
  padding: 20px 24px !important;
  background-color: var(--primary-color) !important;
}

:deep(.md-editor-preview) {
  color: var(--secondary-dark-color) !important;
  line-height: 1.7 !important;
}

/* Headings */
:deep(.md-editor-preview h1) {
  font-size: 1.75rem !important;
  font-weight: 700 !important;
  margin-top: 1.5rem !important;
  margin-bottom: 0.75rem !important;
  padding-bottom: 0.5rem !important;
  border-bottom: 1px solid var(--divider-color) !important;
  color: var(--secondary-dark-color) !important;
}

:deep(.md-editor-preview h2) {
  font-size: 1.4rem !important;
  font-weight: 600 !important;
  margin-top: 1.25rem !important;
  margin-bottom: 0.6rem !important;
  padding-bottom: 0.35rem !important;
  border-bottom: 1px solid var(--divider-light-color) !important;
  color: var(--secondary-dark-color) !important;
}

:deep(.md-editor-preview h3) {
  font-size: 1.15rem !important;
  font-weight: 600 !important;
  margin-top: 1rem !important;
  margin-bottom: 0.5rem !important;
  color: var(--secondary-dark-color) !important;
}

:deep(.md-editor-preview h4),
:deep(.md-editor-preview h5),
:deep(.md-editor-preview h6) {
  font-size: 1rem !important;
  font-weight: 600 !important;
  margin-top: 0.75rem !important;
  margin-bottom: 0.4rem !important;
  color: var(--secondary-color) !important;
}

/* Code blocks */
:deep(.md-editor-preview pre) {
  background-color: var(--primary-dark-color) !important;
  border: 1px solid var(--divider-color) !important;
  border-radius: 6px !important;
  padding: 1rem !important;
  margin: 0.75rem 0 !important;
  overflow-x: auto !important;
}

:deep(.md-editor-preview code) {
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace !important;
  font-size: 0.875rem !important;
}

:deep(.md-editor-preview p > code),
:deep(.md-editor-preview li > code),
:deep(.md-editor-preview td > code) {
  background-color: var(--primary-dark-color) !important;
  border: 1px solid var(--divider-color) !important;
  border-radius: 3px !important;
  padding: 0.15rem 0.35rem !important;
  color: var(--accent-color) !important;
}

/* Tables */
:deep(.md-editor-preview table) {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 0.75rem 0 !important;
  border: 1px solid var(--divider-color) !important;
  border-radius: 6px !important;
  overflow: hidden !important;
}

:deep(.md-editor-preview thead) {
  background-color: var(--primary-dark-color) !important;
}

:deep(.md-editor-preview th) {
  font-weight: 600 !important;
  text-align: left !important;
  padding: 0.6rem 0.8rem !important;
  border: 1px solid var(--divider-color) !important;
  color: var(--secondary-dark-color) !important;
}

:deep(.md-editor-preview td) {
  padding: 0.5rem 0.8rem !important;
  border: 1px solid var(--divider-color) !important;
  color: var(--secondary-color) !important;
}

:deep(.md-editor-preview tbody tr:hover) {
  background-color: var(--primary-light-color) !important;
}

/* Blockquotes */
:deep(.md-editor-preview blockquote) {
  border-left: 4px solid var(--accent-color) !important;
  background-color: var(--primary-light-color) !important;
  margin: 0.75rem 0 !important;
  padding: 0.75rem 1rem !important;
  border-radius: 0 6px 6px 0 !important;
  color: var(--secondary-color) !important;
}

:deep(.md-editor-preview blockquote p) {
  margin: 0.25rem 0 !important;
}

/* Links */
:deep(.md-editor-preview a) {
  color: var(--accent-color) !important;
  text-decoration: none !important;
  border-bottom: 1px solid transparent !important;
  transition: border-color 0.15s ease !important;
}

:deep(.md-editor-preview a:hover) {
  border-bottom-color: var(--accent-color) !important;
}

/* Lists */
:deep(.md-editor-preview ul),
:deep(.md-editor-preview ol) {
  padding-left: 1.5rem !important;
  margin: 0.5rem 0 !important;
}

:deep(.md-editor-preview li) {
  margin: 0.25rem 0 !important;
  line-height: 1.6 !important;
}

/* Horizontal rule */
:deep(.md-editor-preview hr) {
  border: none !important;
  border-top: 1px solid var(--divider-color) !important;
  margin: 1.5rem 0 !important;
}

/* Images */
:deep(.md-editor-preview img) {
  max-width: 100% !important;
  border-radius: 6px !important;
  border: 1px solid var(--divider-color) !important;
}

/* Table shape picker */
:deep(.md-editor-table-shape) {
  background-color: var(--primary-color) !important;
  border: 1px solid var(--divider-color) !important;
}

/* Input fields in modals */
:deep(.md-editor-input) {
  background-color: var(--primary-light-color) !important;
  border: 1px solid var(--divider-color) !important;
  color: var(--secondary-dark-color) !important;
  border-radius: 4px !important;
}

:deep(.md-editor-input:focus) {
  border-color: var(--accent-color) !important;
}

/* Buttons in modals */
:deep(.md-editor-btn) {
  background-color: var(--primary-light-color) !important;
  border: 1px solid var(--divider-color) !important;
  color: var(--secondary-color) !important;
  border-radius: 4px !important;
  transition: all 0.15s ease !important;
}

:deep(.md-editor-btn:hover) {
  background-color: var(--primary-dark-color) !important;
  color: var(--accent-color) !important;
}

/* Footer */
:deep(.md-editor-footer) {
  border-top: 1px solid var(--divider-color) !important;
  color: var(--secondary-color) !important;
  background-color: var(--primary-color) !important;
}

/* Catalog sidebar */
:deep(.md-editor-catalog-editor) {
  background-color: var(--primary-color) !important;
  border-inline-start: 1px solid var(--divider-color) !important;
}

/* Scrollbar styling */
:deep(.md-editor-content::-webkit-scrollbar),
:deep(.md-editor-preview::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(.md-editor-content::-webkit-scrollbar-thumb),
:deep(.md-editor-preview::-webkit-scrollbar-thumb) {
  background-color: var(--divider-dark-color);
  border-radius: 3px;
}

:deep(.md-editor-content::-webkit-scrollbar-track),
:deep(.md-editor-preview::-webkit-scrollbar-track) {
  background-color: transparent;
}
</style>
