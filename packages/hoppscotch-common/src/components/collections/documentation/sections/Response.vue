<template>
  <div v-if="hasResponseExamples" class="max-w-2xl space-y-2">
    <h2
      class="text-sm font-semibold text-secondaryDark flex items-end px-4 p-2 border-b border-divider"
    >
      {{ t("documentation.response.title") }}
    </h2>

    <div
      v-if="responseExamples && responseExamples.length > 0"
      class="border border-divider"
    >
      <HoppSmartTabs
        v-model="selectedResponseTab"
        styles="sticky overflow-x-auto flex-shrink-0 z-10 bg-primary "
      >
        <HoppSmartTab
          v-for="(example, index) in responseExamples"
          :id="`response-${index}`"
          :key="index"
          :label="responseTabLabel(example)"
          class="flex h-full w-full flex-1 flex-col"
        >
          <div class="rounded-md overflow-hidden my-4">
            <div class="px-4 py-2 border-b border-divider">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-sm text-secondary">
                    {{ example.name || "Untitled" }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    v-if="example.statusCode"
                    class="px-1 py-.5 text-tiny rounded"
                    :class="statusCodeBadgeClass(example.statusCode)"
                  >
                    {{ example.statusCode }} -
                    {{ getStatusCodeReasonPhrase(example.statusCode) }}
                  </span>
                  <HoppSmartItem
                    :icon="IconCopy"
                    :title="t('documentation.response.copy')"
                    @click="copyResponseExample(example)"
                  />
                </div>
              </div>
            </div>

            <!-- Two-column layout when bodySchemaTree is present -->
            <div
              v-if="example.bodySchemaTree && example.bodySchemaTree.length > 0"
              class="p-4"
            >
              <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <!-- Left: schema tree (60%) -->
                <div class="lg:col-span-3 space-y-1">
                  <div
                    class="text-xs font-semibold text-secondaryDark mb-2 flex items-center justify-between"
                  >
                    <span>{{
                      t("documentation.response.schema") || "Schema"
                    }}</span>
                    <span class="text-secondaryLight font-mono">{{
                      example.contentType
                    }}</span>
                  </div>
                  <SchemaTreeReadonly
                    v-for="(node, nodeIdx) in example.bodySchemaTree"
                    :key="nodeIdx"
                    :node="node"
                    :depth="0"
                    :model-resolver="readonlyModelResolver"
                  />
                </div>
                <!-- Right: JSON example (40%) -->
                <div class="lg:col-span-2">
                  <JsonExampleBlock
                    :content="
                      example.body ||
                      generateExampleFromSchema(
                        example.bodySchemaTree,
                        modelResolver
                      )
                    "
                    :content-type="example.contentType"
                  />
                </div>
              </div>
            </div>

            <!-- Fallback: body/headers tabs when bodySchemaTree is absent -->
            <div v-else>
              <HoppSmartTabs
                v-model="selectedContentTabs[index]"
                styles="sticky overflow-x-auto flex-shrink-0 z-10 bg-primary"
              >
                <HoppSmartTab
                  v-if="example.body"
                  id="body"
                  :label="t('documentation.response.body')"
                  class="flex h-full w-full flex-1 flex-col"
                >
                  <div class="p-4">
                    <div v-if="isJsonResponse(example)">
                      <pre
                        class="bg-primaryLight p-3 rounded my-2 overflow-auto max-h-64 text-sm font-mono text-secondaryLight"
                        >{{ formatJSON(example.body) }}</pre
                      >
                    </div>
                    <div v-else>
                      <pre
                        class="bg-primaryLight p-3 rounded my-2 overflow-auto max-h-64 text-sm font-mono text-secondaryLight"
                        >{{ example.body }}</pre
                      >
                    </div>
                  </div>
                </HoppSmartTab>

                <HoppSmartTab
                  v-if="example.headers && example.headers.length > 0"
                  id="headers"
                  :label="t('documentation.response.headers')"
                  :info="`${example.headers.length}`"
                  class="flex h-full w-full flex-1 flex-col"
                >
                  <div class="p-4">
                    <ResponseHeadersTable :headers="example.headers" />
                  </div>
                </HoppSmartTab>
              </HoppSmartTabs>
            </div>

            <!-- Headers table shown below when bodySchemaTree is present and headers exist -->
            <div
              v-if="
                example.bodySchemaTree &&
                example.bodySchemaTree.length > 0 &&
                example.headers &&
                example.headers.length > 0
              "
              class="px-4 pb-4"
            >
              <div
                class="text-xs font-semibold text-secondaryDark mb-2 mt-2 flex items-center gap-2 cursor-pointer"
                @click="toggleHeaders(index)"
              >
                <component
                  :is="
                    expandedHeaders[index] ? IconChevronDown : IconChevronRight
                  "
                  class="w-3.5 h-3.5 text-secondary"
                />
                {{ t("documentation.response.headers") }}
                <span class="text-secondaryLight"
                  >({{ example.headers.length }})</span
                >
              </div>
              <div v-if="expandedHeaders[index]">
                <ResponseHeadersTable :headers="example.headers" />
              </div>
            </div>
          </div>
        </HoppSmartTab>
      </HoppSmartTabs>
    </div>

    <div v-else class="text-center py-8 text-secondaryLight">
      <icon-lucide-file-text class="mx-auto mb-2" size="24" />
      <p class="text-sm">{{ t("documentation.response.no_examples") }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, reactive } from "vue"
import IconCopy from "~icons/lucide/copy"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import { useService } from "dioc/vue"
import { useToast } from "~/composables/toast"
import { getStatusCodeReasonPhrase } from "~/helpers/utils/statusCodes"
import { useI18n } from "~/composables/i18n"
import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import SchemaTreeReadonly from "~/components/http/design/SchemaTreeReadonly.vue"
import type { ReadonlyModelResolver } from "~/components/http/design/SchemaTreeReadonly.vue"
import JsonExampleBlock from "~/components/http/design/JsonExampleBlock.vue"
import {
  generateExampleFromSchema,
  statusCodeBadgeClass,
} from "~/components/http/design/utils/schemaExample"
import type { ModelResolver } from "~/components/http/design/utils/schemaExample"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import ResponseHeadersTable from "./ResponseHeadersTable.vue"

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

/**
 * Response headers can come from two sources:
 * 1. Design mode (responseModels): { key, description } — key is header name, description is explanation
 * 2. Legacy responses: { key, value } — key is header name, value is actual value
 *
 * We normalize both to a common interface for display.
 */
export interface ResponseHeader {
  key: string
  /** For design-mode headers, this is the description. For legacy, this is the value. */
  value?: string
  /** Design-mode header description (optional, only from responseModels) */
  description?: string
}

interface ResponseExample {
  name?: string
  statusCode?: number
  headers?: ResponseHeader[]
  body?: string
  contentType?: string
  bodySchemaTree?: any[] | null
}

const props = defineProps<{
  responseExamples?: ResponseExample[] | null
}>()

const toast = useToast()
const selectedResponseTab = ref<string>("response-0")
const selectedContentTabs = ref<Record<number, string>>({})
const expandedHeaders = reactive<Record<number, boolean>>({})

function toggleHeaders(index: number) {
  expandedHeaders[index] = !expandedHeaders[index]
}

// Initialize tabs when responseExamples change
watch(
  () => props.responseExamples,
  (newExamples) => {
    if (newExamples && newExamples.length > 0) {
      // Set default response tab to the first example
      selectedResponseTab.value = "response-0"

      // Initialize content tabs for each response example
      const newSelectedTabs: Record<number, string> = {}
      newExamples.forEach((example, index) => {
        // Default to "body" tab if body exists, otherwise "headers"
        newSelectedTabs[index] = example.body ? "body" : "headers"
      })
      selectedContentTabs.value = newSelectedTabs
    }
  },
  { immediate: true }
)

const hasResponseExamples = computed(() => {
  return props.responseExamples && props.responseExamples.length > 0
})

/**
 * Generate a tab label showing status code and reason phrase
 */
function responseTabLabel(example: ResponseExample): string {
  if (example.statusCode) {
    const phrase = getStatusCodeReasonPhrase(example.statusCode)
    return phrase
      ? `${example.statusCode} ${phrase}`
      : String(example.statusCode)
  }
  return "Response"
}

/**
 * Check if the response is JSON based on content type or body structure
 */
function isJsonResponse(example: ResponseExample): boolean {
  if (example.contentType?.includes("application/json")) {
    return true
  }

  // Try to parse as JSON to determine if it's valid JSON
  try {
    JSON.parse(example.body || "")
    return true
  } catch (_e) {
    return false
  }
}

/**
 * Format JSON string for display
 */
function formatJSON(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString || "{}")
    return JSON.stringify(parsed, null, 2)
  } catch (_e) {
    return jsonString || ""
  }
}

/**
 * Copy response example to clipboard
 */
async function copyResponseExample(example: ResponseExample): Promise<void> {
  try {
    const responseText = example.body || ""
    await navigator.clipboard.writeText(responseText)
    toast.success(t("documentation.response.example_copied"))
  } catch (err) {
    console.error("Failed to copy response example: ", err)
    toast.error(t("documentation.response.example_copy_failed"))
  }
}
</script>
