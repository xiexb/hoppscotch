<template>
  <div class="border-b border-dividerLight">
    <!-- Tab bar (reuse debug-mode style) -->
    <div class="flex items-center border-b border-dividerLight bg-primary">
      <button
        v-for="tab in paramTabs"
        :key="tab.id"
        class="px-4 py-2 text-xs transition-colors"
        :class="
          activeTab === tab.id
            ? 'border-b-2 border-accent font-bold text-accent'
            : 'text-secondary hover:text-secondaryDark'
        "
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span
          v-if="tab.count > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primaryLight text-secondaryLight"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- Params content -->
    <div class="p-4">
      <!-- Authorization -->
      <div v-if="activeTab === 'auth'" class="space-y-2">
        <div class="text-xs text-secondaryDark font-semibold mb-2">
          Authorization
        </div>
        <div class="text-xs text-secondary bg-primaryLight rounded p-2">
          {{ authDescription }}
        </div>
      </div>

      <!-- Path Params -->
      <div v-if="activeTab === 'path'" class="space-y-1">
        <div
          v-if="activePathParams.length === 0"
          class="text-xs text-secondaryLight py-4 text-center"
        >
          暂无路径参数
        </div>
        <div
          v-for="(param, index) in activePathParams"
          :key="'path-' + index"
          class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-primaryLight"
        >
          <span
            class="font-mono text-xs px-2 py-0.5 rounded bg-accentLight/20 text-accent w-32 truncate"
          >
            {{ param.key }}
          </span>
          <span class="text-xs text-secondaryLight w-16">string</span>
          <input
            :value="param.value"
            class="flex-1 text-xs bg-transparent border border-dividerLight rounded px-2 py-1 outline-none focus:border-accent text-secondaryDark"
            placeholder="值"
            @input="updatePathParam(index, 'value', $event)"
          />
          <input
            :value="param.description"
            class="flex-1 text-xs bg-transparent border border-dividerLight rounded px-2 py-1 outline-none focus:border-accent text-secondaryDark"
            placeholder="说明"
            @input="updatePathParam(index, 'description', $event)"
          />
        </div>
      </div>

      <!-- Query Params -->
      <div v-if="activeTab === 'query'" class="space-y-1">
        <div
          v-if="activeQueryParams.length === 0"
          class="text-xs text-secondaryLight py-4 text-center"
        >
          暂无查询参数
        </div>
        <div
          v-for="(param, index) in activeQueryParams"
          :key="'query-' + index"
          class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-primaryLight"
        >
          <span
            class="font-mono text-xs px-2 py-0.5 rounded bg-accentLight/20 text-accent w-32 truncate"
          >
            {{ param.key }}
          </span>
          <input
            :value="param.value"
            class="flex-1 text-xs bg-transparent border border-dividerLight rounded px-2 py-1 outline-none focus:border-accent text-secondaryDark"
            placeholder="值"
            @input="updateQueryParam(index, 'value', $event)"
          />
          <input
            :value="param.description"
            class="flex-1 text-xs bg-transparent border border-dividerLight rounded px-2 py-1 outline-none focus:border-accent text-secondaryDark"
            placeholder="说明"
            @input="updateQueryParam(index, 'description', $event)"
          />
        </div>
      </div>

      <!-- Headers -->
      <div v-if="activeTab === 'headers'" class="space-y-1">
        <div
          v-if="activeHeaders.length === 0"
          class="text-xs text-secondaryLight py-4 text-center"
        >
          暂无请求头
        </div>
        <div
          v-for="(header, index) in activeHeaders"
          :key="'header-' + index"
          class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-primaryLight"
        >
          <span
            class="font-mono text-xs px-2 py-0.5 rounded bg-accentLight/20 text-accent w-36 truncate"
          >
            {{ header.key }}
          </span>
          <input
            :value="header.value"
            class="flex-1 text-xs bg-transparent border border-dividerLight rounded px-2 py-1 outline-none focus:border-accent text-secondaryDark"
            placeholder="值"
            @input="updateHeader(index, 'value', $event)"
          />
          <input
            :value="header.description"
            class="flex-1 text-xs bg-transparent border border-dividerLight rounded px-2 py-1 outline-none focus:border-accent text-secondaryDark"
            placeholder="说明"
            @input="updateHeader(index, 'description', $event)"
          />
        </div>
      </div>

      <!-- Body -->
      <div v-if="activeTab === 'body'">
        <template v-if="request.body.contentType === null">
          <div class="text-xs text-secondaryLight py-4 text-center">
            暂无请求体
          </div>
        </template>
        <template v-else>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-semibold text-secondaryDark">Body</span>
            <span class="text-xs text-secondary font-mono">
              {{ request.body.contentType }}
            </span>
          </div>
          <textarea
            :value="bodyContent"
            class="w-full text-xs font-mono bg-primaryLight border border-dividerLight rounded p-3 text-secondaryDark outline-none focus:border-accent resize-y min-h-[120px]"
            spellcheck="false"
            @input="onBodyInput"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { HoppRESTRequest } from "@hoppscotch/data"

type ParamTab = "auth" | "path" | "query" | "headers" | "body"

const props = defineProps<{
  request: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

const activeTab = ref<ParamTab>("auth")

const activePathParams = computed(() =>
  props.request.pathParams.filter((p) => p.key !== "")
)
const activeQueryParams = computed(() =>
  props.request.params.filter((p) => p.key !== "")
)
const activeHeaders = computed(() =>
  props.request.headers.filter((h) => h.key !== "")
)

const authDescription = computed(() => {
  const auth = props.request.auth
  if (!auth || auth.authType === "inherit") return "继承父级鉴权"
  if (auth.authType === "none") return "无鉴权"
  return `${auth.authType.toUpperCase()} 鉴权`
})

const bodyContent = computed(() => {
  const body = props.request.body
  if (body.contentType === null || body.body === null) return ""
  if (typeof body.body === "string") return body.body
  if (Array.isArray(body.body)) {
    return JSON.stringify(
      Object.fromEntries(body.body.map((e) => [e.key, e.value])),
      null,
      2
    )
  }
  return ""
})

const paramTabs = computed(() => [
  { id: "auth" as ParamTab, label: "Authorization", count: 0 },
  {
    id: "path" as ParamTab,
    label: "Path 参数",
    count: activePathParams.value.length,
  },
  {
    id: "query" as ParamTab,
    label: "Query 参数",
    count: activeQueryParams.value.length,
  },
  {
    id: "headers" as ParamTab,
    label: "Headers",
    count: activeHeaders.value.length,
  },
  { id: "body" as ParamTab, label: "Body", count: 0 },
])

function updatePathParam(index: number, field: string, event: Event) {
  const target = event.target as HTMLInputElement
  const params = [...props.request.pathParams]
  params[index] = { ...params[index], [field]: target.value }
  emit("update:request", { ...props.request, pathParams: params })
}

function updateQueryParam(index: number, field: string, event: Event) {
  const target = event.target as HTMLInputElement
  const params = [...props.request.params]
  params[index] = { ...params[index], [field]: target.value }
  emit("update:request", { ...props.request, params })
}

function updateHeader(index: number, field: string, event: Event) {
  const target = event.target as HTMLInputElement
  const headers = [...props.request.headers]
  headers[index] = { ...headers[index], [field]: target.value }
  emit("update:request", { ...props.request, headers })
}

function onBodyInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  const body = { ...props.request.body, body: target.value }
  emit("update:request", { ...props.request, body })
}
</script>
