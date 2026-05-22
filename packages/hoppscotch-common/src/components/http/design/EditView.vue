<template>
  <div class="flex flex-col overflow-y-auto flex-1 bg-primary">
    <!-- Area 1: Title bar (editable name + status + Method + URL + debug button) -->
    <div class="border-b border-dividerLight p-4 space-y-3 shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <input
            :value="apiTitle || request.name"
            class="text-xl font-bold bg-transparent outline-none flex-1 min-w-0 text-secondaryDark placeholder:text-secondaryLight"
            placeholder="接口名称"
            @input="onTitleInput"
          />
          <div class="relative shrink-0">
            <StatusBadge
              :model-value="apiStatus"
              :editable="true"
              @update:model-value="onStatusChange"
            />
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 ml-4">
          <button
            class="px-4 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
            @click="emit('debug')"
          >
            手动调试
          </button>
        </div>
      </div>

      <!-- Method + URL row (read-only display) -->
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 text-xs font-mono font-semibold rounded shrink-0"
          :class="methodClass"
        >
          {{ request.method }}
        </span>
        <span class="text-sm text-secondary font-mono break-all">
          {{ fullEndpoint }}
        </span>
      </div>
    </div>

    <!-- Area 2: Meta Info (description, tags, responsibility, base URL) -->
    <MetaInfoSection
      :request="request"
      @update:request="emit('update:request', $event)"
    />

    <!-- Area 3: Request Parameters — reuse debug mode's RequestOptions exactly -->
    <HttpRequestOptions
      v-model="localRequest"
      v-model:option-tab="optionTab"
      :properties="designProperties"
      :inherited-properties="inheritedProperties"
    />

    <!-- Area 4: Response Section -->
    <ResponseSection
      :request="request"
      @update:request="emit('update:request', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import type { ApiStatus } from "./StatusBadge.vue"
import type { RESTOptionTabs } from "../RequestOptions.vue"
import StatusBadge from "./StatusBadge.vue"
import MetaInfoSection from "./MetaInfoSection.vue"
import ResponseSection from "./ResponseSection.vue"
import HttpRequestOptions from "../RequestOptions.vue"

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
  (e: "save"): void
  (e: "debug"): void
}>()

// Only show auth/params/body/headers in design mode (no scripts, no variables)
const designProperties = ["authorization", "params", "bodyParams", "headers"]

const optionTab = ref<RESTOptionTabs>("params")

const apiTitle = computed(() => props.request.apiTitle ?? "")
const apiStatus = computed(() => (props.request.apiStatus ?? "developing") as ApiStatus)

const fullEndpoint = computed(() => {
  const base = props.request.inheritedBaseUrl || ""
  const endpoint = props.request.endpoint || ""
  if (endpoint.startsWith("http")) return endpoint
  return base + endpoint
})

const methodClass = computed(() => {
  switch (props.request.method) {
    case "GET": return "bg-green-500/20 text-green-500"
    case "POST": return "bg-orange-500/20 text-orange-500"
    case "PUT": return "bg-yellow-500/20 text-yellow-500"
    case "DELETE": return "bg-red-500/20 text-red-500"
    case "PATCH": return "bg-teal-500/20 text-teal-500"
    default: return "bg-secondaryLight/20 text-secondaryLight"
  }
})

// Bridge: RequestOptions uses v-model on the request directly,
// so we proxy changes back up to the parent
const localRequest = computed({
  get: () => props.request,
  set: (val: HoppRESTRequest) => emit("update:request", val),
})

function onTitleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit("update:request", { ...props.request, apiTitle: target.value })
}

function onStatusChange(val: ApiStatus) {
  emit("update:request", { ...props.request, apiStatus: val })
}
</script>
