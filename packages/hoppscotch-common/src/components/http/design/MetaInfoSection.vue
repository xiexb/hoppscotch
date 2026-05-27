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

      <!-- Prefix URL (前置 URL) -->
      <div class="space-y-1">
        <label class="text-xs font-semibold text-secondary">前置 URL</label>

        <!-- Inherited service indicator (read-only) -->
        <div
          v-if="inheritedServiceName && !hasRequestOverride"
          class="flex items-center gap-1.5 text-xs text-secondaryLight px-2 py-1 bg-accentLight/10 rounded"
        >
          <icon-lucide-link class="w-3 h-3 shrink-0" />
          <span class="truncate">
            继承: <strong class="text-secondaryDark">{{ inheritedServiceName }}</strong>
            <span class="text-secondaryLight ml-1">({{ inheritedServiceUrl }})</span>
          </span>
        </div>

        <!-- Service selector dropdown -->
        <select
          :value="selectedOption"
          class="w-full text-xs bg-transparent border border-dividerLight rounded px-2 py-1.5 text-secondaryDark outline-none focus:border-accent"
          @change="onServiceSelect($event)"
        >
          <option value="__inherit__">
            继承父级{{ inheritedServiceName ? ` (${inheritedServiceName})` : '' }}
          </option>
          <optgroup
            v-if="environmentServices.length > 0"
            :label="`当前环境服务 (${environmentServices.length})`"
          >
            <option
              v-for="svc in environmentServices"
              :key="svc.id"
              :value="svc.id"
            >
              {{ svc.name }} — {{ svc.url }}
            </option>
          </optgroup>
          <option v-if="environmentServices.length === 0" disabled>
            （当前环境未配置服务）
          </option>
        </select>

        <!-- Resolved URL preview -->
        <div
          v-if="resolvedUrl && !isFullUrl"
          class="flex items-center gap-1 text-[10px] text-secondaryLight mt-0.5 px-1"
        >
          <icon-lucide-arrow-right class="w-3 h-3 shrink-0" />
          <span class="truncate font-mono">
            <span class="text-accent">{{ resolvedUrl.replace(/\/+$/, '') }}</span>{{ (request.endpoint || '').startsWith('/') ? '' : '/' }}{{ request.endpoint || '...' }}
          </span>
        </div>
        <div
          v-else-if="isFullUrl"
          class="flex items-center gap-1 text-[10px] text-secondaryLight mt-0.5 px-1"
        >
          <icon-lucide-info class="w-3 h-3 shrink-0" />
          <span class="truncate font-mono">endpoint 已是完整 URL，前置 URL 不生效</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { EnvironmentService } from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { useReadonlyStream } from "@composables/stream"
import {
  currentEnvironment$,
  globalEnv$,
} from "~/newstore/environments"
import DocumentationMarkdownEditor from "~/components/collections/documentation/MarkdownEditor.vue"
import TagInput from "./TagInput.vue"

const props = withDefaults(
  defineProps<{
    request: HoppRESTRequest
    inheritedProperties?: HoppInheritedProperty
  }>(),
  {
    inheritedProperties: undefined,
  }
)

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

// --- Environment services from store ---
const currentEnv = useReadonlyStream(currentEnvironment$, undefined)
const globalEnv = useReadonlyStream(globalEnv$, { variables: [], services: [] })

const environmentServices = computed<EnvironmentService[]>(() => {
  const envServices = (currentEnv.value as any)?.services ?? []
  const globalServices = (globalEnv.value as any)?.services ?? []
  // Merge: current env services take priority, then global
  const ids = new Set(envServices.map((s: EnvironmentService) => s.id))
  return [
    ...envServices,
    ...globalServices.filter((s: EnvironmentService) => !ids.has(s.id)),
  ]
})

// --- Inherited service from collection hierarchy ---
const inheritedServiceId = computed(
  () => props.inheritedProperties?.selectedServiceId ?? null
)

const inheritedService = computed(() => {
  if (!inheritedServiceId.value) return null
  return (
    environmentServices.value.find((s) => s.id === inheritedServiceId.value) ??
    null
  )
})

const inheritedServiceName = computed(
  () => inheritedService.value?.name ?? ""
)

const inheritedServiceUrl = computed(
  () => inheritedService.value?.url ?? ""
)

// --- Request-level override ---
// inheritedBaseUrl stores either:
//   "" (empty) = inherit from parent
//   a service ID = override with specific service
//   a raw URL string (starts with http) = custom URL
const inheritedBaseUrl = computed(
  () => props.request.inheritedBaseUrl ?? ""
)

const hasRequestOverride = computed(() => {
  const val = inheritedBaseUrl.value
  return val !== "" && val !== "__inherit__"
})

// --- Select value ---
const selectedOption = computed(() => {
  const val = inheritedBaseUrl.value
  if (!val || val === "__inherit__") return "__inherit__"
  // Check if it matches a service ID
  if (environmentServices.value.some((s) => s.id === val)) return val
  // Fallback: treat as inherit if it doesn't match any service
  return "__inherit__"
})

// --- Resolved URL ---
const resolvedUrl = computed(() => {
  const val = inheritedBaseUrl.value
  if (!val || val === "__inherit__") {
    // Use inherited service URL
    return inheritedServiceUrl.value || ""
  }
  // Check if it's a service ID
  const svc = environmentServices.value.find((s) => s.id === val)
  if (svc) return svc.url
  // It's a raw URL
  return val
})

/** Whether the endpoint is already a full URL (prefix URL won't apply) */
const isFullUrl = computed(() => {
  const endpoint = props.request.endpoint || ""
  return /^https?:\/\//i.test(endpoint)
})

// --- Computed fields ---
const tags = computed(() => props.request.tags ?? [])
const responsibility = computed(() => props.request.responsibility ?? "")

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

function onServiceSelect(event: Event) {
  const target = event.target as HTMLSelectElement
  const val = target.value

  if (val === "__inherit__") {
    updateField("inheritedBaseUrl", "")
  } else {
    // Service ID selected
    updateField("inheritedBaseUrl", val)
  }
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
