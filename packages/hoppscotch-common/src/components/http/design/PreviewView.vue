<template>
  <div class="flex flex-col overflow-y-auto flex-1 bg-primary">
    <!-- Meta info row -->
    <div class="flex items-center gap-4 px-4 py-2 text-xs text-secondaryLight border-b border-dividerLight overflow-x-auto">
      <span v-if="responsibility">负责人: {{ responsibility }}</span>
      <span v-if="tags.length > 0">标签: {{ tags.join(", ") }}</span>
      <span v-if="description" class="truncate max-w-xs">说明: {{ description }}</span>
    </div>

    <!-- Area 4: Request Parameters (read-only) -->
    <div class="border-b border-dividerLight p-4 space-y-4">
      <!-- Authorization -->
      <div v-if="authType !== 'none' && authType !== 'inherit'">
        <div
          class="flex items-center gap-2 cursor-pointer"
          @click="showAuth = !showAuth"
        >
          <component :is="showAuth ? IconChevronDown : IconChevronRight" class="w-3.5 h-3.5 text-secondary" />
          <span class="text-xs font-semibold text-secondaryDark">Authorization</span>
        </div>
        <div v-if="showAuth" class="mt-2 text-xs text-secondary bg-primaryLight rounded p-2">
          在 Header 添加参数 Authorization，其值为 Bearer 之后拼接 Token
        </div>
      </div>

      <!-- Path Params -->
      <div v-if="activePathParams.length > 0">
        <h4 class="text-xs font-semibold text-secondaryDark mb-2">Path 参数</h4>
        <div class="space-y-1">
          <div
            v-for="(param, index) in activePathParams"
            :key="index"
            class="flex items-center gap-3 py-1"
          >
            <span class="font-mono text-xs text-accent">{{ param.key }}</span>
            <span class="text-xs text-secondaryLight">string</span>
            <span class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500">必填</span>
            <span v-if="param.description" class="text-xs text-secondaryLight ml-2">{{ param.description }}</span>
          </div>
        </div>
      </div>

      <!-- Headers -->
      <div v-if="activeHeaders.length > 0">
        <h4 class="text-xs font-semibold text-secondaryDark mb-2">Header 参数</h4>
        <div class="space-y-2">
          <div
            v-for="(header, index) in activeHeaders"
            :key="index"
            class="py-1"
          >
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs text-accent">{{ header.key }}</span>
              <span class="text-xs text-secondaryLight">string</span>
              <span class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500">必填</span>
            </div>
            <div v-if="header.value" class="text-xs text-secondaryLight ml-4 mt-0.5">
              示例: {{ header.value }}
            </div>
          </div>
        </div>
      </div>

      <!-- Body (two-column layout) -->
      <div v-if="request.body.contentType">
        <h4 class="text-xs font-semibold text-secondaryDark mb-2">
          Body 参数
          <span class="text-secondaryLight font-normal font-mono ml-1">
            {{ request.body.contentType }}
          </span>
        </h4>
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <!-- Left: field list (60%) -->
          <div class="lg:col-span-3 space-y-1">
            <div
              v-for="(param, index) in bodyFields"
              :key="index"
              class="flex items-center gap-3 py-1 px-2 rounded hover:bg-primaryLight"
            >
              <span class="font-mono text-xs text-accent w-32 truncate">{{ param.key }}</span>
              <span class="text-xs text-secondaryLight w-20">{{ param.type }}</span>
              <span class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500">必填</span>
            </div>
            <div v-if="bodyFields.length === 0" class="text-xs text-secondaryLight py-2">
              暂无字段定义
            </div>
          </div>
          <!-- Right: JSON example (40%) -->
          <div class="lg:col-span-2">
            <JsonExampleBlock
              :content="bodyExampleJson"
              :content-type="request.body.contentType ?? 'application/json'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Area 5: Response (read-only) -->
    <div class="p-4 space-y-4">
      <h3 class="text-sm font-semibold text-secondaryDark">返回响应</h3>

      <!-- Response tabs -->
      <div v-if="responseModels.length > 0" class="flex items-center gap-2 border-b border-dividerLight pb-2 overflow-x-auto">
        <button
          v-for="(model, index) in responseModels"
          :key="index"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors shrink-0"
          :class="
            activeResponseTab === index
              ? 'border-b-2 border-green-500 font-bold text-green-500'
              : 'text-secondary hover:text-secondaryDark'
          "
          @click="activeResponseTab = index"
        >
          {{ model.statusCode }} {{ model.description || "响应" }}
        </button>
      </div>

      <!-- Active response body (two-column) -->
      <div v-if="currentResponse" class="space-y-2">
        <div class="text-xs text-secondary">
          HTTP 状态码: {{ currentResponse.statusCode }}
          <span class="text-secondaryLight font-mono ml-2">{{ currentResponse.contentType }}</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <!-- Left: schema tree (read-only) -->
          <div class="lg:col-span-3 space-y-1">
            <template v-if="currentResponse.bodySchemaTree && currentResponse.bodySchemaTree.length > 0">
              <SchemaTreeReadonly
                v-for="(node, index) in currentResponse.bodySchemaTree"
                :key="index"
                :node="node"
                :depth="0"
              />
            </template>
            <div v-else class="text-xs text-secondaryLight py-2">
              暂无数据结构定义
            </div>
          </div>
          <!-- Right: example JSON -->
          <div class="lg:col-span-2">
            <JsonExampleBlock
              :content="currentResponse.bodyExample || generateExampleFromSchema(currentResponse.bodySchemaTree)"
              :content-type="currentResponse.contentType"
            />
          </div>
        </div>
      </div>

      <div v-else class="text-xs text-secondaryLight py-4 text-center">
        暂无响应定义
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { HoppRESTRequest, HoppRESTResponseModelV20, HoppRESTSchemaNode } from "@hoppscotch/data"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import JsonExampleBlock from "./JsonExampleBlock.vue"
import SchemaTreeReadonly from "./SchemaTreeReadonly.vue"

const props = defineProps<{
  request: HoppRESTRequest
}>()

const showAuth = ref(false)
const activeResponseTab = ref(0)

const tags = computed(() => props.request.tags ?? [])
const responsibility = computed(() => props.request.responsibility ?? "")
const description = computed(() => props.request.description ?? "")
const authType = computed(() => props.request.auth?.authType ?? "inherit")

const activePathParams = computed(() =>
  props.request.pathParams.filter((p) => p.key !== "")
)
const activeHeaders = computed(() =>
  props.request.headers.filter((h) => h.key !== "")
)

const responseModels = computed(
  () => (props.request.responseModels ?? []) as HoppRESTResponseModelV20[]
)
const currentResponse = computed(() => responseModels.value[activeResponseTab.value] ?? null)

// Parse body fields from JSON body or from bodySchemaTree
const bodyFields = computed(() => {
  const body = props.request.body
  if (body.contentType === null || body.body === null) return []
  if (typeof body.body === "string") {
    try {
      const parsed = JSON.parse(body.body)
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed).map(([key, value]) => ({
          key,
          type: Array.isArray(value) ? "array" : typeof value,
          value,
        }))
      }
    } catch {
      // not valid JSON
    }
  }
  return []
})

const bodyExampleJson = computed(() => {
  const body = props.request.body
  if (body.contentType === null || body.body === null) return "{}"
  if (typeof body.body === "string") return body.body
  return "{}"
})

function generateExampleFromSchema(tree: HoppRESTSchemaNode[] | null | undefined): string {
  if (!tree || tree.length === 0) return "{}"
  const obj: Record<string, unknown> = {}
  for (const node of tree) {
    obj[node.name || "field"] = generateNodeExample(node)
  }
  return JSON.stringify(obj, null, 2)
}

function generateNodeExample(node: HoppRESTSchemaNode): unknown {
  switch (node.type) {
    case "string":
      return node.mock || "string"
    case "integer":
      return 0
    case "number":
      return 0.0
    case "boolean":
      return true
    case "array":
      if (node.children && node.children.length > 0) {
        return [generateNodeExample(node.children[0])]
      }
      return []
    case "object":
      if (node.children && node.children.length > 0) {
        const obj: Record<string, unknown> = {}
        for (const child of node.children) {
          obj[child.name || "field"] = generateNodeExample(child)
        }
        return obj
      }
      return {}
    default:
      return null
  }
}
</script>
