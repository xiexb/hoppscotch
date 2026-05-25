<template>
  <div class="p-4 space-y-4">
    <!-- Section header -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-secondaryDark">返回响应</h3>
    </div>

    <!-- Status code tabs -->
    <div
      class="flex items-center gap-2 border-b border-dividerLight pb-2 overflow-x-auto"
    >
      <button
        v-for="(model, index) in responseModels"
        :key="index"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors shrink-0"
        :class="
          activeModel === index
            ? 'border-b-2 font-bold ' + statusTabClass(model.statusCode)
            : 'text-secondary hover:text-secondaryDark'
        "
        @click="activeModel = index"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="statusDotClass(model.statusCode)"
        />
        {{ model.statusCode }} {{ model.description || "响应" }}
      </button>
      <button
        class="text-secondaryLight hover:text-accent text-xs px-2 py-1 shrink-0"
        @click="addResponseModel"
      >
        +
      </button>
    </div>

    <!-- Active model content -->
    <div v-if="currentModel" class="space-y-4">
      <!-- Meta info row -->
      <div class="flex items-center gap-4 text-xs flex-wrap">
        <div class="flex items-center gap-1.5">
          <span class="text-secondary">HTTP 状态码:</span>
          <input
            :value="currentModel.statusCode"
            type="number"
            min="100"
            max="599"
            class="w-16 font-mono bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
            placeholder="200"
            @input="onMetaInput('statusCode', $event)"
          />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-secondary">名称:</span>
          <input
            :value="currentModel.description"
            class="w-32 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
            placeholder="成功"
            @input="onMetaInput('description', $event)"
          />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-secondary">内容格式:</span>
          <select
            :value="currentModel.contentType"
            class="bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
            @change="onContentTypeChange"
          >
            <option value="application/json">JSON</option>
            <option value="application/xml">XML</option>
            <option value="text/html">HTML</option>
            <option value="text/plain">Text</option>
          </select>
        </div>
        <span class="text-secondaryLight font-mono">{{
          currentModel.contentType
        }}</span>
        <button
          class="ml-auto text-secondaryLight hover:text-red-400 transition-colors"
          title="删除此响应"
          @click="confirmRemoveResponseModel(activeModel)"
        >
          <IconTrash class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Body Schema Tree -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-secondary">数据结构</span>
          <span class="text-xs text-secondaryLight font-mono">{{
            currentModel.contentType
          }}</span>
        </div>
        <SchemaTreeEditor
          :model-value="currentSchemaTree"
          @update:model-value="onSchemaTreeUpdate"
        />
      </div>

      <!-- Response Example -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-secondary">示例</span>
          <button
            class="text-xs text-accent hover:text-accentDark flex items-center gap-1"
            title="从 Schema 生成示例"
            @click="generateExample"
          >
            <IconSparkles class="w-3 h-3" />
            从 Schema 生成
          </button>
        </div>
        <JsonExampleBlock
          :content="
            currentModel.bodyExample ||
            generateExampleFromSchema(
              currentModel.bodySchemaTree,
              modelResolver
            )
          "
          :content-type="currentModel.contentType"
          :editable="true"
          @update:content="onExampleUpdate"
        />
      </div>

      <!-- Response Headers (editable) -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-secondary">响应 Headers</span>
          <button
            class="text-xs text-accent hover:text-accentDark flex items-center gap-1"
            @click="addHeader"
          >
            <IconPlus class="w-3 h-3" />
            添加
          </button>
        </div>
        <div
          v-if="currentModel.headers && currentModel.headers.length > 0"
          class="border border-dividerLight rounded overflow-hidden"
        >
          <table class="w-full text-xs">
            <thead class="bg-primaryLight">
              <tr>
                <th
                  class="text-left py-1.5 px-2 font-semibold text-secondaryDark w-1/3"
                >
                  Key
                </th>
                <th
                  class="text-left py-1.5 px-2 font-semibold text-secondaryDark"
                >
                  说明
                </th>
                <th class="w-8 py-1.5 px-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(header, hIdx) in currentModel.headers"
                :key="hIdx"
                class="border-t border-dividerLight"
              >
                <td class="py-1 px-2">
                  <input
                    :value="header.key"
                    class="w-full bg-transparent outline-none text-secondaryDark font-mono"
                    placeholder="Content-Type"
                    @input="onHeaderInput(hIdx, 'key', $event)"
                  />
                </td>
                <td class="py-1 px-2">
                  <input
                    :value="header.description"
                    class="w-full bg-transparent outline-none text-secondaryDark"
                    placeholder="响应头说明"
                    @input="onHeaderInput(hIdx, 'description', $event)"
                  />
                </td>
                <td class="py-1 px-1">
                  <button
                    class="text-secondaryLight hover:text-red-400 transition-colors"
                    @click="removeHeader(hIdx)"
                  >
                    <IconX class="w-3 h-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="text-xs text-secondaryLight py-2 text-center border border-dashed border-dividerLight rounded"
        >
          暂无响应头定义
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-xs text-secondaryLight py-8 text-center">
      暂无响应定义
      <button
        class="ml-2 text-accent hover:text-accentDark"
        @click="addResponseModel"
      >
        添加
      </button>
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
import IconTrash from "~icons/lucide/trash-2"
import IconPlus from "~icons/lucide/plus"
import IconX from "~icons/lucide/x"
import IconSparkles from "~icons/lucide/sparkles"
import SchemaTreeEditor from "./SchemaTreeEditor.vue"
import JsonExampleBlock from "./JsonExampleBlock.vue"
import {
  generateExampleFromSchema,
  statusTabClass,
  statusDotClass,
} from "./utils/schemaExample"
import type { ModelResolver } from "./utils/schemaExample"
import { WorkspaceModelService } from "~/services/workspace-model.service"

// Workspace model service for resolving modelRef
const workspaceModelService = useService(WorkspaceModelService)

/**
 * Resolver for generateExampleFromSchema: modelRef ID → schema tree
 */
const modelResolver: ModelResolver = (modelRefId: string) => {
  const model = workspaceModelService.getModelById(modelRefId)
  return model?.schemaTree as HoppRESTSchemaNode[] | undefined
}

const props = defineProps<{
  request: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

const activeModel = ref(0)

const responseModels = computed(
  () => (props.request.responseModels ?? []) as HoppRESTResponseModelV21[]
)

const currentModel = computed(
  () => responseModels.value[activeModel.value] ?? null
)

const currentSchemaTree = computed(
  () => currentModel.value?.bodySchemaTree ?? []
)

function ensureModels(): HoppRESTResponseModelV21[] {
  return [...(props.request.responseModels ?? [])] as HoppRESTResponseModelV21[]
}

function updateModel(
  index: number,
  updated: Partial<HoppRESTResponseModelV21>
) {
  const models = ensureModels()
  models[index] = { ...models[index], ...updated }
  emit("update:request", { ...props.request, responseModels: models })
}

function addResponseModel() {
  const models = ensureModels()
  models.push({
    statusCode: "200",
    description: "",
    headers: [],
    bodySchema: "",
    bodyExample: "",
    bodySchemaTree: [],
    contentType: "application/json",
  })
  emit("update:request", { ...props.request, responseModels: models })
  activeModel.value = models.length - 1
}

function confirmRemoveResponseModel(index: number) {
  const model = responseModels.value[index]
  const label = model
    ? `${model.statusCode} ${model.description || "响应"}`
    : "此响应"
  if (confirm(`确定删除响应 "${label}" 吗？`)) {
    removeResponseModel(index)
  }
}

function removeResponseModel(index: number) {
  const models = ensureModels()
  models.splice(index, 1)
  emit("update:request", { ...props.request, responseModels: models })
  if (activeModel.value >= models.length) {
    activeModel.value = Math.max(0, models.length - 1)
  }
}

function onMetaInput(field: string, event: Event) {
  const target = event.target as HTMLInputElement
  if (field === "statusCode") {
    // Validate: must be a number between 100-599
    const num = parseInt(target.value, 10)
    if (isNaN(num) || num < 100 || num > 599) {
      // Keep the raw input but don't update the model with invalid values
      return
    }
    updateModel(activeModel.value, { statusCode: String(num) })
  } else {
    updateModel(activeModel.value, { [field]: target.value })
  }
}

function onContentTypeChange(event: Event) {
  const target = event.target as HTMLSelectElement
  updateModel(activeModel.value, { contentType: target.value })
}

function onSchemaTreeUpdate(tree: HoppRESTSchemaNode[]) {
  updateModel(activeModel.value, { bodySchemaTree: tree })
}

function onExampleUpdate(val: string) {
  updateModel(activeModel.value, { bodyExample: val })
}

function generateExample() {
  const tree = currentModel.value?.bodySchemaTree
  const example = generateExampleFromSchema(tree, modelResolver)
  updateModel(activeModel.value, { bodyExample: example })
}

// --- Headers editing ---
function addHeader() {
  const headers = [...(currentModel.value?.headers ?? [])]
  headers.push({ key: "", description: "" })
  updateModel(activeModel.value, { headers })
}

function removeHeader(hIdx: number) {
  const headers = [...(currentModel.value?.headers ?? [])]
  headers.splice(hIdx, 1)
  updateModel(activeModel.value, { headers })
}

function onHeaderInput(
  hIdx: number,
  field: "key" | "description",
  event: Event
) {
  const target = event.target as HTMLInputElement
  const headers = [...(currentModel.value?.headers ?? [])]
  headers[hIdx] = { ...headers[hIdx], [field]: target.value }
  updateModel(activeModel.value, { headers })
}
</script>
