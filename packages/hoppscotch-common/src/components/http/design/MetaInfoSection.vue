<template>
  <div class="border-b border-dividerLight p-4 space-y-4">
    <!-- Markdown Description -->
    <div class="desc-editor">
      <DocumentationMarkdownEditor
        v-model="description"
        placeholder="接口说明，支持 Markdown 渲染"
      />
    </div>

    <!-- Three-column metadata -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- Responsibility -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-secondary">责任人</label>
        <input
          :value="responsibility"
          class="w-full text-xs bg-transparent border border-dividerLight rounded px-2 py-1.5 text-secondaryDark outline-none focus:border-accent"
          placeholder="负责人姓名"
          @input="onInput('responsibility', $event)"
        />
      </div>

      <!-- Tags -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-secondary">标签</label>
        <div class="border border-dividerLight rounded px-2 py-1">
          <TagInput
            :model-value="tags"
            placeholder="回车添加标签"
            @update:model-value="onTagsChange"
          />
        </div>
      </div>

      <!-- Inherited Base URL -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-secondary">前置 URL</label>
        <select
          :value="inheritedBaseUrl"
          class="w-full text-xs bg-transparent border border-dividerLight rounded px-2 py-1.5 text-secondaryDark outline-none focus:border-accent"
          @change="onSelect('inheritedBaseUrl', $event)"
        >
          <option value="">继承父级（推荐）</option>
          <option value="__custom__">自定义...</option>
        </select>
        <input
          v-if="showCustomUrl"
          :value="customBaseUrl"
          class="w-full text-xs bg-transparent border border-dividerLight rounded px-2 py-1.5 text-secondaryDark outline-none focus:border-accent mt-1"
          placeholder="https://api.example.com"
          @input="onCustomUrlInput"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { HoppRESTRequest } from "@hoppscotch/data"
import DocumentationMarkdownEditor from "~/components/collections/documentation/MarkdownEditor.vue"
import TagInput from "./TagInput.vue"

const props = defineProps<{
  request: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

const showCustomUrl = ref(false)
const customBaseUrl = ref("")

const tags = computed(() => props.request.tags ?? [])
const responsibility = computed(() => props.request.responsibility ?? "")
const inheritedBaseUrl = computed(() => props.request.inheritedBaseUrl ?? "")

const description = computed({
  get: () => props.request.description ?? "",
  set: (val: string) => {
    emit("update:request", { ...props.request, description: val })
  },
})

function updateField(field: string, value: unknown) {
  emit("update:request", { ...props.request, [field]: value })
}

function onInput(field: string, event: Event) {
  const target = event.target as HTMLInputElement
  updateField(field, target.value)
}

function onSelect(field: string, event: Event) {
  const target = event.target as HTMLSelectElement
  if (target.value === "__custom__") {
    showCustomUrl.value = true
    customBaseUrl.value = inheritedBaseUrl.value
  } else {
    showCustomUrl.value = false
    updateField(field, target.value)
  }
}

function onCustomUrlInput(event: Event) {
  const target = event.target as HTMLInputElement
  customBaseUrl.value = target.value
  updateField("inheritedBaseUrl", target.value)
}

function onTagsChange(val: string[]) {
  updateField("tags", val)
}
</script>

<style scoped>
.desc-editor :deep(.min-h-52) {
  min-height: 80px !important;
  padding: 0.5rem 0.75rem !important;
}
.desc-editor :deep(textarea) {
  min-height: 80px !important;
}
</style>
