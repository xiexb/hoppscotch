<template>
  <div class="p-4 space-y-4">
    <!-- Section header -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-secondaryDark">
        {{ t("request_body_schema.title") }}
      </h3>
      <!-- Content type indicator -->
      <span
        v-if="request.body.contentType"
        class="text-xs text-secondaryLight font-mono"
      >
        {{ request.body.contentType }}
      </span>
    </div>

    <!-- Body Schema Tree -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-secondary">{{
            t("request_body_schema.structure")
          }}</span>
          <!-- Bound state: show badge + detach button -->
          <template v-if="isBoundToModel">
            <span
              class="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 flex items-center gap-0.5"
            >
              <IconLink class="w-2.5 h-2.5" />
              {{ boundModelName }}
            </span>
            <button
              class="text-[10px] text-secondaryLight hover:text-red-400 transition-colors flex items-center gap-0.5"
              @click="detachModel"
            >
              <IconUnlink class="w-2.5 h-2.5" />
              {{ t("request_body_schema.unbind") }}
            </button>
          </template>
        </div>
        <div class="flex items-center gap-2">
          <!-- Unbound state: show model picker -->
          <div v-if="!isBoundToModel" ref="modelPickerRef" class="relative">
            <button
              v-if="availableModels.length > 0"
              class="text-xs text-secondaryLight hover:text-purple-500 transition-colors flex items-center gap-1"
              @click="showModelPicker = !showModelPicker"
            >
              <IconLink class="w-3 h-3" />
              {{ t("request_body_schema.bind_model") }}
            </button>
            <!-- Model picker dropdown -->
            <div
              v-if="showModelPicker"
              class="absolute right-0 top-full mt-1 z-50 bg-popover border border-divider rounded shadow-lg min-w-[180px] max-h-[240px] overflow-y-auto"
            >
              <button
                v-for="model in availableModels"
                :key="model.id"
                class="w-full text-left px-3 py-2 text-xs hover:bg-primaryLight transition-colors flex flex-col"
                @click="bindToModel(model.id)"
              >
                <span class="text-accent font-medium">{{ model.name }}</span>
                <span
                  v-if="model.description"
                  class="text-secondaryLight text-[10px] truncate"
                  >{{ model.description }}</span
                >
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bound: read-only schema tree -->
      <template v-if="isBoundToModel">
        <div
          v-if="resolvedModelTree.length > 0"
          class="border border-dividerLight rounded p-2 bg-primaryLight/30"
        >
          <SchemaTreeReadonly
            v-for="(node, index) in resolvedModelTree"
            :key="index"
            :node="node"
            :depth="0"
            :model-resolver="readonlyModelResolver"
          />
        </div>
        <div
          v-else
          class="text-xs text-secondaryLight py-4 text-center border border-dashed border-dividerLight rounded"
        >
          {{ t("request_body_schema.no_fields") }}
        </div>
      </template>

      <!-- Unbound: editable schema tree -->
      <SchemaTreeEditor
        v-else
        :model-value="currentSchemaTree"
        :collection-id="collectionId"
        @update:model-value="onSchemaTreeUpdate"
      />
    </div>

    <!-- ─── Examples Section ──────────────────────────────────── -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-secondary">
          {{ t("body_examples.title") }}
        </span>
        <div class="flex items-center gap-2">
          <button
            class="text-xs text-secondaryLight hover:text-accent transition-colors flex items-center gap-1"
            @click="addNewExample"
          >
            <IconPlus class="w-3 h-3" />
            {{ t("body_examples.add_example") }}
          </button>
        </div>
      </div>

      <div class="space-y-3">
        <!-- Default example (read-only, auto-generated) -->
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-secondaryLight font-medium">
              {{ t("body_examples.default_example") }}
            </span>
            <span
              class="px-1 py-0.5 text-[10px] rounded bg-secondaryLight/15 text-secondaryLight"
            >
              auto
            </span>
          </div>
          <JsonExampleBlock
            :content="defaultExampleContent"
            :content-type="request.body.contentType || 'application/json'"
            :editable="false"
          />
        </div>

        <!-- User-created examples -->
        <div
          v-for="(example, index) in bodyExamples"
          :key="index"
        >
          <div class="flex items-center gap-2 mb-1">
            <!-- Rename mode -->
            <template v-if="renamingIndex === index">
              <input
                v-model="renamingName"
                class="bg-transparent border border-dividerLight rounded text-xs text-secondaryDark px-2 py-0.5 outline-none focus:border-accent flex-1"
                @keyup.enter="confirmRenameExample(index)"
                @keyup.escape="renamingIndex = -1"
              />
              <button
                class="text-xs text-accent hover:text-accentDark transition-colors"
                @click="confirmRenameExample(index)"
              >
                <IconCheck class="w-3.5 h-3.5" />
              </button>
              <button
                class="text-xs text-secondaryLight hover:text-secondary transition-colors"
                @click="renamingIndex = -1"
              >
                <IconX class="w-3.5 h-3.5" />
              </button>
            </template>
            <!-- Display mode -->
            <template v-else>
              <span class="text-xs text-secondaryDark font-medium flex-1 truncate">
                {{ example.name || `Example ${index + 1}` }}
              </span>
              <button
                v-tippy="{ theme: 'tooltip' }"
                :title="t('body_examples.rename')"
                class="text-secondaryLight hover:text-secondary transition-colors p-0.5 rounded"
                @click="startRenameExample(index)"
              >
                <IconEdit class="w-3 h-3" />
              </button>
              <button
                v-tippy="{ theme: 'tooltip' }"
                :title="t('body_examples.delete')"
                class="text-secondaryLight hover:text-red-400 transition-colors p-0.5 rounded"
                @click="deleteExample(index)"
              >
                <IconTrash class="w-3 h-3" />
              </button>
            </template>
          </div>
          <JsonExampleBlock
            :content="example.body"
            :content-type="example.contentType || request.body.contentType || 'application/json'"
            :editable="true"
            @update:content="(val) => updateExampleBody(index, val)"
          />
        </div>

        <!-- Empty state -->
        <div
          v-if="bodyExamples.length === 0"
          class="text-xs text-secondaryLight py-2 text-center border border-dashed border-dividerLight rounded"
        >
          {{ t("body_examples.no_examples") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import type {
  HoppRESTRequest,
  HoppRESTSchemaNode,
  HoppRESTBodyExample,
} from "@hoppscotch/data"
import { useService } from "dioc/vue"
import { useI18n } from "@composables/i18n"
import IconLink from "~icons/lucide/link"
import IconUnlink from "~icons/lucide/unlink"
import IconPlus from "~icons/lucide/plus"
import IconCheck from "~icons/lucide/check"
import IconX from "~icons/lucide/x"
import IconEdit from "~icons/lucide/edit-3"
import IconTrash from "~icons/lucide/trash-2"
import SchemaTreeEditor from "./SchemaTreeEditor.vue"
import SchemaTreeReadonly from "./SchemaTreeReadonly.vue"
import type { ReadonlyModelResolver } from "./SchemaTreeReadonly.vue"
import JsonExampleBlock from "./JsonExampleBlock.vue"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import {
  generateJsonFromSchemaTree,
  generateXmlFromSchemaTree,
} from "~/helpers/generateBodyExample"

const t = useI18n()

// Workspace model service for resolving modelRef
const workspaceModelService = useService(WorkspaceModelService)

const props = defineProps<{
  request: HoppRESTRequest
  collectionId?: string
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

// Available models for root-level binding — filtered by collection context
const availableModels = computed(() => {
  if (props.collectionId) {
    return workspaceModelService.getModelsForCollection(props.collectionId)
  }
  // No collection context — show only public models
  return workspaceModelService.models.value.filter(
    (m) => (m.visibility ?? "public") === "public"
  )
})

// Model picker state
const showModelPicker = ref(false)
const modelPickerRef = ref<HTMLElement | null>(null)

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

const currentSchemaTree = computed<HoppRESTSchemaNode[]>(
  () => (props.request.bodySchemaTree ?? []) as HoppRESTSchemaNode[]
)

// --- Model binding computeds ---

const isBoundToModel = computed(
  () => !!(props.request.bodyModelRef ?? "")
)

const resolvedModelTree = computed<HoppRESTSchemaNode[]>(() => {
  const refId = props.request.bodyModelRef
  if (!refId) return []
  const model = workspaceModelService.getModelById(refId)
  return (model?.schemaTree ?? []) as HoppRESTSchemaNode[]
})

const boundModelName = computed(() => {
  const refId = props.request.bodyModelRef
  if (!refId) return ""
  const model = workspaceModelService.getModelById(refId)
  return model?.name ?? t("request_body_schema.unknown_model")
})

// Close picker when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (
    modelPickerRef.value &&
    !modelPickerRef.value.contains(event.target as Node)
  ) {
    showModelPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside)
})

function updateRequest(updated: Partial<HoppRESTRequest>) {
  emit("update:request", { ...props.request, ...updated } as HoppRESTRequest)
}

function onSchemaTreeUpdate(tree: HoppRESTSchemaNode[]) {
  updateRequest({ bodySchemaTree: tree } as Partial<HoppRESTRequest>)
}

// --- Model binding methods ---

/**
 * Bind the request body schema to a workspace model.
 * Clears bodySchemaTree since it's now resolved from the model.
 */
function bindToModel(modelId: string) {
  updateRequest({
    bodyModelRef: modelId,
    bodySchemaTree: null,
  } as Partial<HoppRESTRequest>)
  showModelPicker.value = false
}

/**
 * Detach from the bound model.
 * Deep-copies the resolved model tree into bodySchemaTree so the user
 * can freely edit the snapshot without affecting the original model.
 */
function detachModel() {
  const snapshot = JSON.parse(
    JSON.stringify(resolvedModelTree.value)
  ) as HoppRESTSchemaNode[]
  updateRequest({
    bodyModelRef: "",
    bodySchemaTree: snapshot,
  } as Partial<HoppRESTRequest>)
}

// ─── Examples ──────────────────────────────────────────────────

const bodyExamples = computed<HoppRESTBodyExample[]>(
  () => (props.request.bodyExamples ?? []) as HoppRESTBodyExample[]
)

// Model resolver for default example generation
const modelResolver = (modelRefId: string) => {
  const model = workspaceModelService.getModelById(modelRefId)
  return model?.schemaTree as any
}

// Generate default example from bodySchemaTree
const defaultExampleContent = computed(() => {
  const tree = isBoundToModel.value
    ? resolvedModelTree.value
    : ((props.request.bodySchemaTree ?? []) as HoppRESTSchemaNode[])
  const ct = props.request.body?.contentType

  if (ct === "application/xml" || ct === "text/xml") {
    return generateXmlFromSchemaTree(
      (tree || []) as HoppRESTSchemaNode[],
      modelResolver
    )
  }
  return generateJsonFromSchemaTree(
    (tree || []) as HoppRESTSchemaNode[],
    modelResolver
  )
})

// Add new example with current default content
function addNewExample() {
  const existing = bodyExamples.value
  const newExample: HoppRESTBodyExample = {
    name: `Example ${existing.length + 1}`,
    body: defaultExampleContent.value,
    contentType: props.request.body?.contentType || "application/json",
  }
  updateRequest({
    bodyExamples: [...existing, newExample],
  } as Partial<HoppRESTRequest>)
}

// Update example body content
function updateExampleBody(index: number, content: string) {
  const existing = [...bodyExamples.value]
  if (index >= 0 && index < existing.length) {
    existing[index] = { ...existing[index], body: content }
    updateRequest({
      bodyExamples: existing,
    } as Partial<HoppRESTRequest>)
  }
}

// Delete example
function deleteExample(index: number) {
  const existing = [...bodyExamples.value]
  existing.splice(index, 1)
  updateRequest({
    bodyExamples: existing,
  } as Partial<HoppRESTRequest>)
}

// Rename example
const renamingIndex = ref(-1)
const renamingName = ref("")

function startRenameExample(index: number) {
  renamingIndex.value = index
  renamingName.value = bodyExamples.value[index]?.name || ""
}

function confirmRenameExample(index: number) {
  const name = renamingName.value.trim()
  if (!name) {
    renamingIndex.value = -1
    return
  }
  const existing = [...bodyExamples.value]
  if (index >= 0 && index < existing.length) {
    existing[index] = { ...existing[index], name }
    updateRequest({
      bodyExamples: existing,
    } as Partial<HoppRESTRequest>)
  }
  renamingIndex.value = -1
}
</script>
