<template>
  <div class="flex flex-col overflow-y-auto flex-1 bg-primary">
    <!-- Method + URL row (read-only) + action buttons -->
    <div class="px-4 py-3">
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-0.5 text-xs font-mono font-semibold rounded"
          :class="methodClass"
        >
          {{ request.method }}
        </span>
        <!-- URL with prefix highlight -->
        <span class="text-sm font-mono break-all flex-1 flex items-center gap-1 flex-wrap">
          <!-- Prefix URL link icon (shown when prefix URL is active and endpoint is not a full URL) -->
          <span
            v-if="resolvedPrefixUrl && !(request.endpoint && request.endpoint.startsWith('http'))"
            v-tippy="{ theme: 'tooltip', content: `前置URL: ${resolvedPrefixUrl}` }"
            class="flex items-center text-accent shrink-0"
          >
            <icon-lucide-link class="w-3.5 h-3.5" />
          </span>
          <!-- Endpoint display -->
          <template v-if="request.endpoint && request.endpoint.startsWith('http')">
            <span class="text-secondary">{{ fullEndpoint }}</span>
          </template>
          <template v-else-if="resolvedPrefixUrl">
            <span class="text-secondary">{{ request.endpoint || '/' }}</span>
          </template>
          <template v-else>
            <span class="text-secondary">{{ fullEndpoint || '/' }}</span>
          </template>
        </span>
        <HoppButtonPrimary
          :label="t('preview_view.manual_debug')"
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
      v-if="responsibility || tags.length > 0 || description"
      class="flex items-center gap-4 px-4 py-2 text-xs text-secondaryLight border-y border-dividerLight bg-primaryLight/30 overflow-x-auto"
    >
      <span v-if="responsibility" class="shrink-0">
        <span class="text-secondaryDark font-medium">{{ t('preview_view.responsibility') }}:</span>
        {{ responsibility }}
      </span>
      <span v-if="tags.length > 0" class="shrink-0">
        <span class="text-secondaryDark font-medium">{{ t('preview_view.tags') }}:</span>
        {{ tags.join(", ") }}
      </span>
      <span v-if="description" class="truncate max-w-xs">
        <span class="text-secondaryDark font-medium">{{ t('preview_view.description') }}:</span>
        {{ description }}
      </span>
    </div>

    <!-- Area 4: Request Parameters (read-only) -->
    <div class="px-4 py-5 space-y-5">
      <!-- Section title -->
      <h3
        class="text-xs font-bold text-secondaryDark uppercase tracking-wider"
      >
        {{ t('preview_view.request_parameters') }}
      </h3>

      <!-- Authorization -->
      <div v-if="authType !== 'none' && authType !== 'inherit'">
        <div
          class="flex items-center gap-2 cursor-pointer group"
          @click="showAuth = !showAuth"
        >
          <component
            :is="showAuth ? IconChevronDown : IconChevronRight"
            class="w-3.5 h-3.5 text-secondary transition-transform"
          />
          <span
            class="text-xs font-semibold text-secondaryDark group-hover:text-primary transition-colors"
            >Authorization</span
          >
        </div>
        <div
          v-if="showAuth"
          class="mt-2 text-xs text-secondary bg-primaryLight rounded-lg p-3 ml-5 border border-dividerLight"
        >
          {{ t('preview_view.auth_description') }}
        </div>
      </div>

      <!-- Path Params -->
      <div v-if="activePathParams.length > 0">
        <h4 class="text-xs font-semibold text-secondaryDark mb-3 ml-1">
          {{ t('preview_view.path_parameters') }}
          <span class="text-secondaryLight font-normal">({{ activePathParams.length }})</span>
        </h4>
        <div class="space-y-0.5">
          <div
            v-for="(param, index) in activePathParams"
            :key="index"
            class="flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors hover:bg-primaryLight/60"
          >
            <span class="font-mono text-xs text-accent min-w-[80px]">{{
              param.key
            }}</span>
            <span
              class="text-[11px] px-1.5 py-0.5 rounded font-mono"
              :class="getTypeClass('string')"
              >string</span
            >
            <span
              class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500 font-medium"
              >{{ t('preview_view.required') }}</span
            >
            <span
              v-if="param.description"
              class="text-xs text-secondaryLight ml-auto truncate max-w-[200px]"
              >{{ param.description }}</span
            >
          </div>
        </div>
      </div>

      <!-- Headers -->
      <div v-if="activeHeaders.length > 0">
        <h4 class="text-xs font-semibold text-secondaryDark mb-3 ml-1">
          {{ t('preview_view.header_parameters') }}
          <span class="text-secondaryLight font-normal">({{ activeHeaders.length }})</span>
        </h4>
        <div class="space-y-0.5">
          <div
            v-for="(header, index) in activeHeaders"
            :key="index"
            class="rounded-md transition-colors hover:bg-primaryLight/60 py-1.5 px-2"
          >
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs text-accent min-w-[80px]">{{
                header.key
              }}</span>
              <span
                class="text-[11px] px-1.5 py-0.5 rounded font-mono"
                :class="getTypeClass('string')"
                >string</span
              >
              <span
                class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500 font-medium"
                >{{ t('preview_view.required') }}</span
              >
            </div>
            <div
              v-if="header.value"
              class="text-xs text-secondaryLight ml-4 mt-1 font-mono"
            >
              {{ t('preview_view.example') }}: {{ header.value }}
            </div>
          </div>
        </div>
      </div>

      <!-- Body (two-column layout) -->
      <div v-if="request.body.contentType">
        <h4 class="text-xs font-semibold text-secondaryDark mb-3 ml-1">
          {{ t('preview_view.body_parameters') }}
          <span class="text-secondaryLight font-normal font-mono ml-1">
            {{ request.body.contentType }}
          </span>
          <!-- Model binding badge -->
          <span
            v-if="request.bodyModelRef"
            class="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 inline-flex items-center gap-0.5"
          >
            <IconLink class="w-2.5 h-2.5" />
            {{ bodyBoundModelName }}
          </span>
        </h4>

        <!-- Use bodySchemaTree for nested display if available -->
        <div v-if="hasBodySchemaTree" class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <!-- Left: schema tree (read-only, nested) -->
          <div class="lg:col-span-3">
            <div
              class="border border-dividerLight rounded-lg overflow-hidden bg-primaryLight/20"
            >
              <div
                class="flex items-center gap-2 px-3 py-2 bg-primaryLight/40 border-b border-dividerLight"
              >
                <span class="text-xs font-semibold text-secondary"
                  >{{ t('preview_view.field_structure') }}</span
                >
              </div>
              <div class="p-1">
                <SchemaTreeReadonly
                  v-for="(node, index) in bodySchemaTreeNodes"
                  :key="index"
                  :node="node"
                  :depth="0"
                  :model-resolver="readonlyModelResolver"
                />
              </div>
            </div>
          </div>
          <!-- Right: body examples with tabs -->
          <div class="lg:col-span-2">
            <div class="relative">
              <!-- Example selector tabs -->
              <div
                v-if="previewBodyExamples.length > 1"
                class="flex items-center gap-1 overflow-x-auto mb-2 pb-1 border-b border-dividerLight"
              >
                <button
                  v-for="(ex, exIdx) in previewBodyExamples"
                  :key="exIdx"
                  class="px-2 py-0.5 text-xs rounded transition-colors shrink-0"
                  :class="
                    activeBodyExamplePreviewTab === exIdx
                      ? 'bg-accentLight/15 text-accent font-semibold'
                      : 'text-secondary hover:text-secondaryDark hover:bg-primaryLight/40'
                  "
                  @click="activeBodyExamplePreviewTab = exIdx"
                >
                  {{ ex.name }}
                </button>
              </div>
              <JsonExampleBlock
                :content="activePreviewBodyExampleBody"
                :content-type="request.body.contentType ?? 'application/json'"
              />
            </div>
          </div>
        </div>

        <!-- Fallback: flat field list when no schema tree -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <!-- Left: field list -->
          <div class="lg:col-span-3">
            <div
              class="border border-dividerLight rounded-lg overflow-hidden"
            >
              <div
                v-if="bodyFields.length > 0"
                class="divide-y divide-dividerLight"
              >
                <div
                  v-for="(param, index) in bodyFields"
                  :key="index"
                  class="flex items-center gap-3 py-2 px-3 transition-colors hover:bg-primaryLight/60"
                >
                  <span
                    class="font-mono text-xs text-accent w-32 truncate shrink-0"
                    >{{ param.key }}</span
                  >
                  <span
                    class="text-[11px] px-1.5 py-0.5 rounded font-mono shrink-0"
                    :class="getTypeClass(param.type)"
                    >{{ param.type }}</span
                  >
                  <span
                    v-if="param.required"
                    class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500 font-medium shrink-0"
                    >{{ t('preview_view.required') }}</span
                  >
                  <span
                    v-if="param.description"
                    class="text-xs text-secondaryLight ml-auto truncate"
                    >{{ param.description }}</span
                  >
                </div>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center py-8 text-secondaryLight"
              >
                <icon-lucide-inbox class="w-8 h-8 mb-2 opacity-40" />
                <span class="text-xs">{{ t('preview_view.no_fields') }}</span>
              </div>
            </div>
          </div>
          <!-- Right: body examples with tabs -->
          <div class="lg:col-span-2">
            <div class="relative">
              <!-- Example selector tabs -->
              <div
                v-if="previewBodyExamples.length > 1"
                class="flex items-center gap-1 overflow-x-auto mb-2 pb-1 border-b border-dividerLight"
              >
                <button
                  v-for="(ex, exIdx) in previewBodyExamples"
                  :key="exIdx"
                  class="px-2 py-0.5 text-xs rounded transition-colors shrink-0"
                  :class="
                    activeBodyExamplePreviewTab === exIdx
                      ? 'bg-accentLight/15 text-accent font-semibold'
                      : 'text-secondary hover:text-secondaryDark hover:bg-primaryLight/40'
                  "
                  @click="activeBodyExamplePreviewTab = exIdx"
                >
                  {{ ex.name }}
                </button>
              </div>
              <JsonExampleBlock
                :content="activePreviewBodyExampleBody"
                :content-type="request.body.contentType ?? 'application/json'"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state when no params at all -->
      <div
        v-if="!hasAnyParams"
        class="flex flex-col items-center justify-center py-10 text-secondaryLight"
      >
        <icon-lucide-file-json class="w-10 h-10 mb-3 opacity-30" />
        <span class="text-sm">{{ t('preview_view.no_parameters') }}</span>
      </div>
    </div>

    <!-- Divider -->
    <div class="border-t border-dividerLight mx-4" />

    <!-- Area 5: Response (read-only) -->
    <div class="px-4 py-5 space-y-4">
      <h3
        class="text-xs font-bold text-secondaryDark uppercase tracking-wider"
      >
        {{ t('preview_view.response') }}
      </h3>

      <!-- Response tabs (compact, color-coded by status code) -->
      <div
        v-if="responseModels.length > 0"
        class="flex items-center gap-1 overflow-x-auto pb-1"
      >
        <button
          v-for="(model, index) in responseModels"
          :key="index"
          class="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all shrink-0 border"
          :class="
            activeResponseTab === index
              ? 'border-divider font-semibold bg-primaryLight ' +
                statusTabClass(model.statusCode)
              : 'border-transparent text-secondary hover:text-secondaryDark hover:bg-primaryLight/40'
          "
          @click="activeResponseTab = index"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="statusDotClass(model.statusCode)"
          />
          <span class="font-mono">{{ model.statusCode }}</span>
          <span class="max-w-[120px] truncate">{{
            model.description || t('preview_view.response')
          }}</span>
          <IconLink
            v-if="model.rootModelRef"
            class="w-3 h-3 text-purple-500 shrink-0"
            :title="t('preview_view.bound_model')"
          />
        </button>
      </div>

      <!-- Active response body (two-column) -->
      <div v-if="currentResponse" class="space-y-4">
        <div
          class="flex items-center gap-3 text-xs text-secondary bg-primaryLight/30 rounded-lg px-3 py-2"
        >
          <span>
            {{ t('preview_view.http_status_code') }}
            <span class="font-mono font-semibold">{{
              currentResponse.statusCode
            }}</span>
          </span>
          <span class="text-secondaryLight font-mono">{{
            currentResponse.contentType
          }}</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <!-- Left: schema tree (read-only) -->
          <div class="lg:col-span-3">
            <div
              class="border border-dividerLight rounded-lg overflow-hidden bg-primaryLight/20"
            >
              <div
                class="flex items-center gap-2 px-3 py-2 bg-primaryLight/40 border-b border-dividerLight"
              >
                <span class="text-xs font-semibold text-secondary"
                  >{{ t('preview_view.data_structure') }}</span
                >
                <span
                  v-if="isBoundToModel"
                  class="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 flex items-center gap-0.5"
                >
                  <IconLink class="w-2.5 h-2.5" />
                  {{ t('preview_view.reference') }}: {{ boundModelName }}
                </span>
              </div>
              <div v-if="resolvedResponseTree.length > 0" class="p-1">
                <SchemaTreeReadonly
                  v-for="(node, index) in resolvedResponseTree"
                  :key="index"
                  :node="node"
                  :depth="0"
                  :model-resolver="readonlyModelResolver"
                />
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center py-8 text-secondaryLight"
              >
                <icon-lucide-tree-deciduous class="w-8 h-8 mb-2 opacity-40" />
                <span class="text-xs">{{ t('preview_view.no_schema') }}</span>
              </div>
            </div>
          </div>
          <!-- Right: example JSON with example selector -->
          <div class="lg:col-span-2">
            <div class="relative">
              <!-- Example selector tabs -->
              <div
                v-if="previewExamples.length > 1"
                class="flex items-center gap-1 overflow-x-auto mb-2 pb-1 border-b border-dividerLight"
              >
                <button
                  v-for="(ex, exIdx) in previewExamples"
                  :key="exIdx"
                  class="px-2 py-0.5 text-xs rounded transition-colors shrink-0"
                  :class="
                    activeExamplePreviewTab === exIdx
                      ? 'bg-accentLight/15 text-accent font-semibold'
                      : 'text-secondary hover:text-secondaryDark hover:bg-primaryLight/40'
                  "
                  @click="activeExamplePreviewTab = exIdx"
                >
                  {{ ex.name }}
                </button>
              </div>
              <JsonExampleBlock
                :content="activePreviewExampleBody"
                :content-type="currentResponse.contentType"
              />
              <span
                v-if="!hasPreviewStoredExamples && !activePreviewExampleBody"
                class="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] rounded bg-secondaryLight/20 text-secondaryLight"
              >
                {{ t('preview_view.auto_generated') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Response Headers (read-only) -->
        <div
          v-if="currentResponse.headers && currentResponse.headers.length > 0"
        >
          <div
            class="flex items-center gap-2 cursor-pointer group"
            @click="showResponseHeaders = !showResponseHeaders"
          >
            <component
              :is="showResponseHeaders ? IconChevronDown : IconChevronRight"
              class="w-3.5 h-3.5 text-secondary transition-transform"
            />
            <span
              class="text-xs font-semibold text-secondaryDark group-hover:text-primary transition-colors"
              >{{ t('preview_view.response_headers') }}</span
            >
            <span class="text-xs text-secondaryLight"
              >({{ currentResponse.headers.length }})</span
            >
          </div>
          <div v-if="showResponseHeaders" class="mt-2 ml-5">
            <div
              class="border border-dividerLight rounded-lg overflow-hidden"
            >
              <table class="w-full border-collapse text-xs">
                <thead class="bg-primaryLight/40">
                  <tr>
                    <th
                      class="text-left py-2 px-3 font-semibold text-secondaryDark w-1/3 border-b border-dividerLight"
                    >
                      Key
                    </th>
                    <th
                      class="text-left py-2 px-3 font-semibold text-secondaryDark border-b border-dividerLight"
                    >
                      {{ t('preview_view.description_column') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(header, hIdx) in currentResponse.headers"
                    :key="hIdx"
                    class="transition-colors hover:bg-primaryLight/40"
                    :class="{ 'border-t border-dividerLight': hIdx > 0 }"
                  >
                    <td class="py-2 px-3 font-mono text-accent">
                      {{ header.key }}
                    </td>
                    <td class="py-2 px-3 text-secondaryLight">
                      {{ header.description || "-" }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center py-10 text-secondaryLight"
      >
        <icon-lucide-inbox class="w-10 h-10 mb-3 opacity-30" />
        <span class="text-sm">{{ t('preview_view.no_responses') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import type {
  HoppRESTRequest,
  HoppRESTResponseModelV23,
  HoppRESTSchemaNode,
  HoppRESTBodyExample,
  EnvironmentService,
} from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { useReadonlyStream } from "@composables/stream"
import {
  currentEnvironment$,
  globalEnv$,
} from "~/newstore/environments"
import { useService } from "dioc/vue"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconSave from "~icons/lucide/save"
import IconFolderPlus from "~icons/lucide/folder-plus"
import IconLink from "~icons/lucide/link"
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
import {
  generateJsonFromSchemaTree,
  generateXmlFromSchemaTree,
} from "~/helpers/generateBodyExample"
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
const activeExamplePreviewTab = ref(0)
const activeBodyExamplePreviewTab = ref(0)

// --- Body examples preview ---

const previewBodyExamples = computed(() => {
  const stored = (props.request.bodyExamples ?? []) as HoppRESTBodyExample[]
  if (stored.length > 0) return stored
  // Virtual default: generate from schema tree
  const bodyModelRef = props.request.bodyModelRef ?? ""
  let tree: HoppRESTSchemaNode[] = []
  if (bodyModelRef) {
    const model = workspaceModelService.getModelById(bodyModelRef)
    tree = (model?.schemaTree ?? []) as HoppRESTSchemaNode[]
  } else {
    tree = (props.request.bodySchemaTree ?? []) as HoppRESTSchemaNode[]
  }
  const ct = props.request.body?.contentType
  let body = "{}"
  if (ct === "application/xml" || ct === "text/xml") {
    body = generateXmlFromSchemaTree(tree, modelResolver)
  } else if (tree.length > 0) {
    body = generateJsonFromSchemaTree(tree, modelResolver)
  }
  return [
    {
      name: t("preview_view.default_example"),
      body,
      contentType: ct || "application/json",
    },
  ] as HoppRESTBodyExample[]
})

const activePreviewBodyExampleBody = computed(() => {
  const examples = previewBodyExamples.value
  const idx = activeBodyExamplePreviewTab.value
  if (idx >= 0 && idx < examples.length) {
    return examples[idx].body
  }
  return ""
})

// --- Preview multi-example support ---
const hasPreviewStoredExamples = computed(() => {
  const model = currentResponse.value
  return (model?.examples?.length ?? 0) > 0
})

const previewExamples = computed(() => {
  const model = currentResponse.value
  const stored = (model?.examples ?? []) as Array<{ name: string; body: string }>
  if (stored.length > 0) return stored
  // Virtual default
  const tree = resolvedResponseTree.value
  const body =
    currentResponse.value?.bodyExample ||
    generateExampleFromSchema(tree, modelResolver)
  return [{ name: t("preview_view.default_example"), body }]
})

const activePreviewExampleBody = computed(() => {
  const examples = previewExamples.value
  const idx = activeExamplePreviewTab.value
  if (idx >= 0 && idx < examples.length) {
    return examples[idx].body
  }
  return ""
})

// Reset preview example tab when switching response tabs
watch(activeResponseTab, () => {
  activeExamplePreviewTab.value = 0
})

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
  () => (props.request.responseModels ?? []) as HoppRESTResponseModelV23[]
)
const currentResponse = computed(
  () => responseModels.value[activeResponseTab.value] ?? null
)

// --- Body schema tree ---
const bodySchemaTreeNodes = computed<HoppRESTSchemaNode[]>(() => {
  // If bound to a model, resolve from workspace model service
  const modelRef = props.request.bodyModelRef ?? ""
  if (modelRef) {
    const model = workspaceModelService.getModelById(modelRef)
    if (model?.schemaTree) {
      return model.schemaTree as HoppRESTSchemaNode[]
    }
    return []
  }
  // Otherwise use the inline bodySchemaTree
  const tree = props.request.bodySchemaTree
  if (Array.isArray(tree) && tree.length > 0) {
    return tree as HoppRESTSchemaNode[]
  }
  return []
})

const hasBodySchemaTree = computed(() => bodySchemaTreeNodes.value.length > 0)

const bodyBoundModelName = computed(() => {
  const refId = props.request.bodyModelRef ?? ""
  if (!refId) return ""
  const model = workspaceModelService.getModelById(refId)
  return model?.name ?? t("preview_view.unknown_model")
})

// --- Model binding computeds ---

const isBoundToModel = computed(
  () => !!(currentResponse.value?.rootModelRef ?? "")
)

const resolvedResponseTree = computed<HoppRESTSchemaNode[]>(() => {
  if (isBoundToModel.value) {
    const refId = currentResponse.value?.rootModelRef
    if (!refId) return []
    const model = workspaceModelService.getModelById(refId)
    return (model?.schemaTree ?? []) as HoppRESTSchemaNode[]
  }
  return (currentResponse.value?.bodySchemaTree ?? []) as HoppRESTSchemaNode[]
})

const boundModelName = computed(() => {
  const refId = currentResponse.value?.rootModelRef
  if (!refId) return ""
  const model = workspaceModelService.getModelById(refId)
  return model?.name ?? t("preview_view.unknown_model")
})

// --- Environment services for prefix URL resolution ---
const currentEnv = useReadonlyStream(currentEnvironment$, undefined)
const globalEnv = useReadonlyStream(globalEnv$, { variables: [], services: [] })

const environmentServices = computed<EnvironmentService[]>(() => {
  const envServices = (currentEnv.value as any)?.services ?? []
  const globalServices = (globalEnv.value as any)?.services ?? []
  const ids = new Set(envServices.map((s: EnvironmentService) => s.id))
  return [
    ...envServices,
    ...globalServices.filter((s: EnvironmentService) => !ids.has(s.id)),
  ]
})

const inheritedServiceId = computed(
  () => props.inheritedProperties?.selectedServiceId ?? null
)

/** Resolve the prefix URL: request override > inherited service > none */
const resolvedPrefixUrl = computed(() => {
  const val = props.request.inheritedBaseUrl || ""
  if (!val) {
    // No request-level override, use inherited service
    if (inheritedServiceId.value) {
      const svc = environmentServices.value.find(
        (s) => s.id === inheritedServiceId.value
      )
      return svc?.url ?? ""
    }
    return ""
  }
  // Check if it's a service ID
  const svc = environmentServices.value.find((s) => s.id === val)
  if (svc) return svc.url
  // It's a raw URL
  return val
})

const fullEndpoint = computed(() => {
  const base = resolvedPrefixUrl.value
  const endpoint = props.request.endpoint || ""
  if (endpoint.startsWith("http")) return endpoint
  if (!base) return endpoint
  // Strip trailing slash from base, join with endpoint
  const cleanBase = base.replace(/\/+$/, "")
  return cleanBase + (endpoint.startsWith("/") ? "" : "/") + endpoint
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

/**
 * Returns Tailwind CSS classes for type badges with color coding.
 * string=blue, integer=green, number=orange, boolean=purple, object/array=gray
 */
function getTypeClass(type: string): string {
  switch (type) {
    case "string":
      return "bg-blue-500/10 text-blue-500"
    case "integer":
      return "bg-green-500/10 text-green-500"
    case "number":
      return "bg-orange-500/10 text-orange-500"
    case "boolean":
      return "bg-purple-500/10 text-purple-500"
    case "object":
    case "array":
      return "bg-gray-500/10 text-gray-500"
    case "file":
      return "bg-teal-500/10 text-teal-500"
    default:
      return "bg-secondaryLight/10 text-secondaryLight"
  }
}

/**
 * Whether any request parameters exist at all (auth, path, headers, body).
 */
const hasAnyParams = computed(() => {
  return (
    (authType.value !== "none" && authType.value !== "inherit") ||
    activePathParams.value.length > 0 ||
    activeHeaders.value.length > 0 ||
    !!props.request.body.contentType
  )
})

// Parse body fields from JSON body as fallback when no schema tree
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
          required: false,
          description: "",
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
