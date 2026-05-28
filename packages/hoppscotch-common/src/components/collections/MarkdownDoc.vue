<template>
  <div class="flex flex-col h-full">
    <!-- Header: doc name + edit/preview toggle + delete -->
    <div
      class="flex items-center gap-2 px-4 py-2 border-b border-dividerLight bg-primary"
    >
      <!-- Document name -->
      <input
        v-if="isEditingName"
        ref="nameInputRef"
        :value="docName"
        class="flex-1 bg-transparent text-sm font-semibold text-secondaryDark outline-none border-b border-accent"
        @blur="finishEditName"
        @input="onNameInput"
        @keyup.enter="finishEditName"
      />
      <span
        v-else
        class="flex-1 text-sm font-semibold text-secondaryDark truncate cursor-pointer hover:text-accent"
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
        class="!px-2 !py-1"
        @click="isPreview = false"
      />
      <HoppButtonSecondary
        v-else
        :label="t('collection.preview_doc')"
        :icon="IconEye"
        class="!px-2 !py-1"
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
  --md-bk-color: transparent !important;
  border: none !important;
}

:deep(.md-editor-dark) {
  --md-bk-color: #18181b !important;
}

:deep(.md-editor-preview-wrapper) {
  padding: 16px !important;
}
</style>
