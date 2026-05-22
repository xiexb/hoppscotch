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
      <div class="flex items-center gap-4 text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-secondary">HTTP 状态码:</span>
          <input
            :value="currentModel.statusCode"
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
          @click="removeResponseModel(activeModel)"
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
        </div>
        <JsonExampleBlock
          :content="currentModel.bodyExample || ''"
          :content-type="currentModel.contentType"
          :editable="true"
          @update:content="onExampleUpdate"
        />
      </div>

      <!-- Bottom actions -->
      <div class="flex items-center gap-4">
        <button
          class="text-xs text-accent hover:text-accentDark flex items-center gap-1"
        >
          <IconPlus class="w-3 h-3" />
          添加示例
        </button>
        <button
          class="text-xs text-accent hover:text-accentDark flex items-center gap-1"
        >
          <IconPlus class="w-3 h-3" />
          添加描述
        </button>
        <button
          class="text-xs text-accent hover:text-accentDark flex items-center gap-1"
        >
          <IconPlus class="w-3 h-3" />
          Headers
        </button>
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
  HoppRESTResponseModelV20,
  HoppRESTSchemaNode,
} from "@hoppscotch/data"
import IconTrash from "~icons/lucide/trash-2"
import IconPlus from "~icons/lucide/plus"
import SchemaTreeEditor from "./SchemaTreeEditor.vue"
import JsonExampleBlock from "./JsonExampleBlock.vue"

const props = defineProps<{
  request: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

const activeModel = ref(0)

const responseModels = computed(
  () => (props.request.responseModels ?? []) as HoppRESTResponseModelV20[]
)

const currentModel = computed(
  () => responseModels.value[activeModel.value] ?? null
)

const currentSchemaTree = computed(
  () => currentModel.value?.bodySchemaTree ?? []
)

function ensureModels(): HoppRESTResponseModelV20[] {
  return [...(props.request.responseModels ?? [])] as HoppRESTResponseModelV20[]
}

function updateModel(
  index: number,
  updated: Partial<HoppRESTResponseModelV20>
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
    bodySchemaTree: null,
    contentType: "application/json",
  })
  emit("update:request", { ...props.request, responseModels: models })
  activeModel.value = models.length - 1
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
  updateModel(activeModel.value, { [field]: target.value })
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

function statusTabClass(code: string): string {
  const num = parseInt(code, 10)
  if (num >= 200 && num < 300) return "border-green-500 text-green-500"
  if (num >= 300 && num < 400) return "border-blue-500 text-blue-500"
  if (num >= 400 && num < 500) return "border-yellow-500 text-yellow-500"
  if (num >= 500) return "border-red-500 text-red-500"
  return "border-secondary text-secondary"
}

function statusDotClass(code: string): string {
  const num = parseInt(code, 10)
  if (num >= 200 && num < 300) return "bg-green-500"
  if (num >= 300 && num < 400) return "bg-blue-500"
  if (num >= 400 && num < 500) return "bg-yellow-500"
  if (num >= 500) return "bg-red-500"
  return "bg-secondary"
}
</script>
