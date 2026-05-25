<template>
  <div class="flex flex-col overflow-y-auto flex-1 bg-primary">
    <!-- Method + URL row (read-only) + action buttons -->
    <div class="border-b border-dividerLight px-4 py-3">
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 text-xs font-mono font-semibold rounded"
          :class="methodClass"
        >
          {{ request.method }}
        </span>
        <span class="text-sm text-secondary font-mono break-all flex-1">
          {{ fullEndpoint }}
        </span>
        <HoppButtonPrimary
          :label="'手动调试'"
          class="shrink-0"
          @click="emit('switchToDebug')"
        />
        <!-- Save button group: same style as edit mode's Request.vue -->
        <span class="flex rounded border border-divider transition shrink-0">
          <HoppButtonSecondary
            :label="t('request.save')"
            filled
            :icon="IconSave"
            class="flex-1 rounded rounded-r-none"
            @click="onSave"
          />
          <span class="flex">
            <tippy interactive trigger="click" theme="popover">
              <HoppButtonSecondary
                :title="t('app.options')"
                :icon="IconChevronDown"
                filled
                class="rounded rounded-l-none"
              />
              <template #content="{ hide }">
                <div
                  class="flex flex-col focus:outline-none"
                  tabindex="0"
                  @keyup.escape="hide()"
                >
                  <HoppSmartItem
                    :label="t('request.save_as')"
                    :icon="IconFolderPlus"
                    @click="
                      () => {
                        onSaveAs()
                        hide()
                      }
                    "
                  />
                </div>
              </template>
            </tippy>
          </span>
        </span>
      </div>
    </div>

    <!-- Meta info row -->
    <div
      class="flex items-center gap-4 px-4 py-2 text-xs text-secondaryLight border-b border-dividerLight overflow-x-auto"
    >
      <span v-if="responsibility">负责人: {{ responsibility }}</span>
      <span v-if="tags.length > 0">标签: {{ tags.join(", ") }}</span>
      <span v-if="description" class="truncate max-w-xs"
        >说明: {{ description }}</span
      >
    </div>

    <!-- Area 4: Request Parameters (read-only) -->
    <div class="border-b border-dividerLight p-4 space-y-4">
      <!-- Authorization -->
      <div v-if="authType !== 'none' && authType !== 'inherit'">
        <div
          class="flex items-center gap-2 cursor-pointer"
          @click="showAuth = !showAuth"
        >
          <component
            :is="showAuth ? IconChevronDown : IconChevronRight"
            class="w-3.5 h-3.5 text-secondary"
          />
          <span class="text-xs font-semibold text-secondaryDark"
            >Authorization</span
          >
        </div>
        <div
          v-if="showAuth"
          class="mt-2 text-xs text-secondary bg-primaryLight rounded p-2"
        >
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
            <span
              class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500"
              >必填</span
            >
            <span
              v-if="param.description"
              class="text-xs text-secondaryLight ml-2"
              >{{ param.description }}</span
            >
          </div>
        </div>
      </div>

      <!-- Headers -->
      <div v-if="activeHeaders.length > 0">
        <h4 class="text-xs font-semibold text-secondaryDark mb-2">
          Header 参数
        </h4>
        <div class="space-y-2">
          <div
            v-for="(header, index) in activeHeaders"
            :key="index"
            class="py-1"
          >
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs text-accent">{{
                header.key
              }}</span>
              <span class="text-xs text-secondaryLight">string</span>
              <span
                class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500"
                >必填</span
              >
            </div>
            <div
              v-if="header.value"
              class="text-xs text-secondaryLight ml-4 mt-0.5"
            >
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
              <span class="font-mono text-xs text-accent w-32 truncate">{{
                param.key
              }}</span>
              <span class="text-xs text-secondaryLight w-20">{{
                param.type
              }}</span>
              <span
                class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500"
                >必填</span
              >
            </div>
            <div
              v-if="bodyFields.length === 0"
              class="text-xs text-secondaryLight py-2"
            >
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

      <!-- Response tabs (color-coded by status code) -->
      <div
        v-if="responseModels.length > 0"
        class="flex items-center gap-2 border-b border-dividerLight pb-2 overflow-x-auto"
      >
        <button
          v-for="(model, index) in responseModels"
          :key="index"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors shrink-0"
          :class="
            activeResponseTab === index
              ? 'border-b-2 font-bold ' + statusTabClass(model.statusCode)
              : 'text-secondary hover:text-secondaryDark'
          "
          @click="activeResponseTab = index"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="statusDotClass(model.statusCode)"
          />
          {{ model.statusCode }} {{ model.description || "响应" }}
        </button>
      </div>

      <!-- Active response body (two-column) -->
      <div v-if="currentResponse" class="space-y-3">
        <div class="text-xs text-secondary">
          HTTP 状态码:
          <span class="font-mono">{{ currentResponse.statusCode }}</span>
          <span class="text-secondaryLight font-mono ml-2">{{
            currentResponse.contentType
          }}</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <!-- Left: schema tree (read-only) -->
          <div class="lg:col-span-3 space-y-1">
            <template
              v-if="
                currentResponse.bodySchemaTree &&
                currentResponse.bodySchemaTree.length > 0
              "
            >
              <SchemaTreeReadonly
                v-for="(node, index) in currentResponse.bodySchemaTree"
                :key="index"
                :node="node"
                :depth="0"
                :model-resolver="readonlyModelResolver"
              />
            </template>
            <div v-else class="text-xs text-secondaryLight py-2">
              暂无数据结构定义
            </div>
          </div>
          <!-- Right: example JSON -->
          <div class="lg:col-span-2">
            <div class="relative">
              <JsonExampleBlock
                :content="
                  currentResponse.bodyExample ||
                  generateExampleFromSchema(
                    currentResponse.bodySchemaTree,
                    modelResolver
                  )
                "
                :content-type="currentResponse.contentType"
              />
              <span
                v-if="!currentResponse.bodyExample"
                class="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] rounded bg-secondaryLight/20 text-secondaryLight"
              >
                自动生成
              </span>
            </div>
          </div>
        </div>

        <!-- Response Headers (read-only) -->
        <div
          v-if="currentResponse.headers && currentResponse.headers.length > 0"
        >
          <div
            class="flex items-center gap-2 cursor-pointer"
            @click="showResponseHeaders = !showResponseHeaders"
          >
            <component
              :is="showResponseHeaders ? IconChevronDown : IconChevronRight"
              class="w-3.5 h-3.5 text-secondary"
            />
            <span class="text-xs font-semibold text-secondaryDark"
              >响应 Headers</span
            >
            <span class="text-xs text-secondaryLight"
              >({{ currentResponse.headers.length }})</span
            >
          </div>
          <div v-if="showResponseHeaders" class="mt-2">
            <table
              class="w-full border-collapse text-xs border border-dividerLight rounded"
            >
              <thead class="bg-primaryLight">
                <tr>
                  <th
                    class="text-left py-1.5 px-3 font-semibold text-secondaryDark w-1/3"
                  >
                    Key
                  </th>
                  <th
                    class="text-left py-1.5 px-3 font-semibold text-secondaryDark"
                  >
                    说明
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(header, hIdx) in currentResponse.headers"
                  :key="hIdx"
                  class="border-t border-dividerLight"
                >
                  <td class="py-1.5 px-3 font-mono text-accent">
                    {{ header.key }}
                  </td>
                  <td class="py-1.5 px-3 text-secondaryLight">
                    {{ header.description || "-" }}
                  </td>
                </tr>
              </tbody>
            </table>
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
import type {
  HoppRESTRequest,
  HoppRESTResponseModelV21,
  HoppRESTSchemaNode,
} from "@hoppscotch/data"
import { useService } from "dioc/vue"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconSave from "~icons/lucide/save"
import IconFolderPlus from "~icons/lucide/folder-plus"
import JsonExampleBlock from "./JsonExampleBlock.vue"
import SchemaTreeReadonly from "./SchemaTreeReadonly.vue"
import type { ReadonlyModelResolver } from "./SchemaTreeReadonly.vue"
import { useI18n } from "@composables/i18n"
import { invokeAction } from "~/helpers/actions"
import {
  generateExampleFromSchema,
  statusTabClass,
  statusDotClass,
} from "./utils/schemaExample"
import type { ModelResolver } from "./utils/schemaExample"
import { WorkspaceModelService } from "~/services/workspace-model.service"

const t = useI18n()

// Workspace model service for resolving modelRef
const workspaceModelService = useService(WorkspaceModelService)

/**
 * Resolver for generateExampleFromSchema: modelRef ID → schema tree
 */
const modelResolver: ModelResolver = (modelRefId: string) => {
  const model = workspaceModelService.getModelById(modelRefId)
  return model?.schemaTree as HoppRESTSchemaNode[] | undefined
}

/**
 * Resolver for SchemaTreeReadonly: modelRef ID → { name, schemaTree }
 */
const readonlyModelResolver: ReadonlyModelResolver = (modelRefId: string) => {
  const model = workspaceModelService.getModelById(modelRefId)
  if (!model) return undefined
  return {
    name: model.name,
    schemaTree: (model.schemaTree ?? []) as HoppRESTSchemaNode[],
  }
}

const props = defineProps<{
  request: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "switchToDebug"): void
}>()

function onSave() {
  invokeAction("request-response.save")
}

function onSaveAs() {
  invokeAction("request.save-as")
}

const showAuth = ref(false)
const showResponseHeaders = ref(true)
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
  () => (props.request.responseModels ?? []) as HoppRESTResponseModelV21[]
)
const currentResponse = computed(
  () => responseModels.value[activeResponseTab.value] ?? null
)

const fullEndpoint = computed(() => {
  const base = props.request.inheritedBaseUrl || ""
  const endpoint = props.request.endpoint || ""
  if (endpoint.startsWith("http")) return endpoint
  return base + endpoint
})

const methodClass = computed(() => {
  switch (props.request.method) {
    case "GET":
      return "bg-green-500/20 text-green-500"
    case "POST":
      return "bg-orange-500/20 text-orange-500"
    case "PUT":
      return "bg-yellow-500/20 text-yellow-500"
    case "DELETE":
      return "bg-red-500/20 text-red-500"
    case "PATCH":
      return "bg-teal-500/20 text-teal-500"
    default:
      return "bg-secondaryLight/20 text-secondaryLight"
  }
})

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
</script>
