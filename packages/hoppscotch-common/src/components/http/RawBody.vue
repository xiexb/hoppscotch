<template>
  <div class="flex flex-1 flex-col">
    <div
      class="sticky top-upperMobileStickyFold z-10 flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary pl-4 sm:top-upperMobileTertiaryStickyFold"
    >
      <label class="truncate font-semibold text-secondaryLight">
        {{ t("request.raw_body") }}
      </label>
      <div class="flex">
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          to="https://docs.hoppscotch.io/documentation/getting-started/rest/uploading-data"
          blank
          :title="t('app.wiki')"
          :icon="IconHelpCircle"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.clear')"
          :icon="IconTrash2"
          @click="clearContent"
        />
        <HoppButtonSecondary
          v-tippy="{ theme: 'tooltip' }"
          :title="t('state.linewrap')"
          :class="{ '!text-accent': WRAP_LINES }"
          :icon="IconWrapText"
          @click.prevent="toggleNestedSetting('WRAP_LINES', 'httpRequestBody')"
        />
        <HoppButtonSecondary
          v-if="
            [
              'application/json',
              'application/ld+json',
              'application/hal+json',
              'application/vnd.api+json',
              'application/xml',
              'text/xml',
            ].includes(body.contentType)
          "
          v-tippy="{ theme: 'tooltip' }"
          :title="t('action.prettify')"
          :icon="prettifyIcon"
          @click="prettifyRequestBody"
        />
        <!-- Example selector dropdown (JSON/XML only) -->
        <tippy
          v-if="showExampleSelector"
          interactive
          trigger="click"
          theme="popover"
          :on-shown="() => exampleTippyActions?.focus()"
        >
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('body_examples.title')"
            :icon="IconBookOpen"
          />
          <template #content="{ hide }">
            <div
              ref="exampleTippyActions"
              class="flex flex-col focus:outline-none min-w-[200px] max-h-[300px] overflow-y-auto"
              tabindex="0"
              @keyup.escape="hide()"
            >
              <!-- Default example (auto-generated) -->
              <div class="px-4 py-1.5">
                <span class="text-tiny font-bold text-secondaryLight">
                  {{ t("body_examples.default_example") }}
                </span>
              </div>
              <HoppSmartItem
                :label="t('body_examples.default_example')"
                :info-icon="selectedExampleIndex === -1 ? IconCheck : undefined"
                :active-info-icon="selectedExampleIndex === -1"
                @click="
                  () => {
                    loadDefaultExample()
                    hide()
                  }
                "
              />
              <!-- User examples -->
              <div
                v-if="bodyExamples.length > 0"
                class="px-4 py-1.5 border-t border-dividerLight mt-1"
              >
                <span class="text-tiny font-bold text-secondaryLight">
                  {{ t("body_examples.title") }}
                </span>
              </div>
              <HoppSmartItem
                v-for="(example, index) in bodyExamples"
                :key="index"
                :label="example.name || `Example ${index + 1}`"
                :info-icon="selectedExampleIndex === index ? IconCheck : undefined"
                :active-info-icon="selectedExampleIndex === index"
                @click="
                  () => {
                    loadExample(index)
                    hide()
                  }
                "
              />
              <!-- Actions -->
              <div class="border-t border-dividerLight mt-1 pt-1">
                <HoppSmartItem
                  :label="t('body_examples.add_example')"
                  :icon="IconPlus"
                  @click="
                    () => {
                      hide()
                      showAddExampleDialog()
                    }
                  "
                />
                <HoppSmartItem
                  :label="t('body_examples.manage_examples')"
                  :icon="IconSettings"
                  @click="
                    () => {
                      hide()
                      showManageModal.value = true
                    }
                  "
                />
              </div>
            </div>
          </template>
        </tippy>
        <HoppButtonSecondary
          v-if="shouldEnableAIFeatures"
          v-tippy="{ theme: 'tooltip' }"
          :title="t('ai_experiments.modify_with_ai')"
          :icon="IconSparkles"
          @click="showModifyBodyModal"
        />
        <label for="payload">
          <HoppButtonSecondary
            v-tippy="{ theme: 'tooltip' }"
            :title="t('import.title')"
            :icon="IconFilePlus"
            @click="payload?.click()"
          />
        </label>
        <input
          ref="payload"
          class="input"
          name="payload"
          type="file"
          @change="uploadPayload($event)"
        />
      </div>
    </div>
    <div class="h-full relative flex flex-col flex-1">
      <div ref="rawBodyParameters" class="absolute inset-0"></div>
    </div>

    <AiexperimentsModifyBodyModal
      v-if="isModifyBodyModalOpen"
      :current-body="codemirrorValue ?? ''"
      @close-modal="isModifyBodyModalOpen = false"
      @update-body="(updatedBody) => (codemirrorValue = updatedBody)"
    ></AiexperimentsModifyBodyModal>

    <!-- Add Example Dialog -->
    <HoppSmartModal
      v-if="showAddModal"
      dialog
      :title="t('body_examples.add_example')"
      @close="showAddModal = false"
    >
      <template #body>
        <div class="flex flex-col gap-4 p-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-secondaryDark">
              {{ t("body_examples.example_name") }}
            </label>
            <input
              v-model="newExampleName"
              class="input"
              :placeholder="t('body_examples.example_name_placeholder')"
              @keyup.enter="confirmAddExample"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <HoppButtonSecondary
            :label="t('action.cancel')"
            outline
            @click="showAddModal = false"
          />
          <HoppButtonPrimary
            :label="t('action.save')"
            :disabled="!newExampleName.trim()"
            @click="confirmAddExample"
          />
        </div>
      </template>
    </HoppSmartModal>

    <!-- Manage Examples Modal -->
    <HoppSmartModal
      v-if="showManageModal"
      dialog
      :title="t('body_examples.manage_examples')"
      @close="showManageModal = false"
    >
      <template #body>
        <div class="flex flex-col gap-2 p-4">
          <div
            v-if="bodyExamples.length === 0"
            class="text-sm text-secondaryLight text-center py-4"
          >
            {{ t("body_examples.no_examples") }}
          </div>
          <div
            v-for="(example, index) in bodyExamples"
            :key="index"
            class="flex items-center gap-2 p-2 rounded border border-dividerLight hover:bg-primaryLight/30"
          >
            <!-- Edit mode -->
            <template v-if="editingExampleIndex === index">
              <input
                v-model="editingExampleName"
                class="input flex-1 !py-1 !px-2 text-sm"
                @keyup.enter="confirmRename(index)"
              />
              <HoppButtonSecondary
                :icon="IconCheck"
                class="!px-1 !py-1"
                @click="confirmRename(index)"
              />
              <HoppButtonSecondary
                :icon="IconX"
                class="!px-1 !py-1"
                @click="editingExampleIndex = -1"
              />
            </template>
            <!-- Display mode -->
            <template v-else>
              <span class="flex-1 text-sm text-secondaryDark truncate">
                {{ example.name || `Example ${index + 1}` }}
              </span>
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('body_examples.rename')"
                :icon="IconEdit"
                class="!px-1 !py-1"
                @click="startRename(index)"
              />
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('body_examples.delete')"
                :icon="IconTrash2"
                class="!px-1 !py-1 !text-red-400 hover:!text-red-500"
                @click="deleteExample(index)"
              />
            </template>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <HoppButtonSecondary
            :label="t('action.close')"
            outline
            @click="showManageModal = false"
          />
        </div>
      </template>
    </HoppSmartModal>
  </div>
</template>

<script setup lang="ts">
import IconHelpCircle from "~icons/lucide/help-circle"
import IconWrapText from "~icons/lucide/wrap-text"
import IconTrash2 from "~icons/lucide/trash-2"
import IconFilePlus from "~icons/lucide/file-plus"
import IconWand2 from "~icons/lucide/wand-2"
import IconCheck from "~icons/lucide/check"
import IconInfo from "~icons/lucide/info"
import IconSparkles from "~icons/lucide/sparkles"
import IconBookOpen from "~icons/lucide/book-open"
import IconPlus from "~icons/lucide/plus"
import IconSettings from "~icons/lucide/settings"
import IconEdit from "~icons/lucide/edit-3"
import IconX from "~icons/lucide/x"
import { computed, reactive, Ref, ref, watch } from "vue"
import * as TO from "fp-ts/TaskOption"
import { pipe } from "fp-ts/function"
import {
  HoppRESTReqBody,
  HoppRESTBodyExample,
  HoppRESTSchemaNode,
  ValidContentTypes,
} from "@hoppscotch/data"
import { refAutoReset, useVModel } from "@vueuse/core"
import { useCodemirror } from "@composables/codemirror"
import { getEditorLangForMimeType } from "@helpers/editorutils"
import { pluckRef } from "@composables/ref"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { isJSONContentType } from "~/helpers/utils/contenttypes"
import jsoncLinter from "~/helpers/editor/linting/jsonc"
import { readFileAsText } from "~/helpers/functional/files"
import xmlFormat from "xml-formatter"
import { useNestedSetting } from "~/composables/settings"
import { toggleNestedSetting } from "~/newstore/settings"
import { useAIExperiments } from "~/composables/ai-experiments"
import { prettifyJSONC } from "~/helpers/editor/linting/jsoncPretty"
import { useReadonlyStream } from "~/composables/stream"
import { platform } from "~/platform"
import { invokeAction } from "~/helpers/actions"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { WorkspaceModelService } from "~/services/workspace-model.service"
import {
  generateJsonFromSchemaTree,
  generateXmlFromSchemaTree,
} from "~/helpers/generateBodyExample"

type PossibleContentTypes = Exclude<
  ValidContentTypes,
  "multipart/form-data" | "application/x-www-form-urlencoded"
>

type Body = HoppRESTReqBody & { contentType: PossibleContentTypes }

const props = defineProps<{
  modelValue: Body
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: Body): void
}>()

const body = useVModel(props, "modelValue", emit)

const t = useI18n()
const toast = useToast()

const payload = ref<HTMLInputElement | null>(null)

const rawParamsBody = pluckRef(body, "body")

const prettifyIcon = refAutoReset<
  typeof IconWand2 | typeof IconCheck | typeof IconInfo
>(IconWand2, 1000)

const rawInputEditorLang = computed(() =>
  getEditorLangForMimeType(body.value.contentType)
)
const langLinter = computed(() =>
  isJSONContentType(body.value.contentType) ? jsoncLinter : null
)

const WRAP_LINES = useNestedSetting("WRAP_LINES", "httpRequestBody")
const rawBodyParameters = ref<any | null>(null)

const codemirrorValue: Ref<string | undefined> =
  typeof rawParamsBody.value === "string"
    ? ref(rawParamsBody.value)
    : ref(undefined)

watch(rawParamsBody, (newVal) => {
  typeof newVal === "string"
    ? (codemirrorValue.value = newVal)
    : (codemirrorValue.value = undefined)
})

// propagate the edits from codemirror back to the body
watch(codemirrorValue, (updatedValue) => {
  if (updatedValue !== undefined && updatedValue !== rawParamsBody.value) {
    rawParamsBody.value = updatedValue
  }
})

useCodemirror(
  rawBodyParameters,
  codemirrorValue,
  reactive({
    extendedEditorConfig: {
      lineWrapping: WRAP_LINES,
      mode: rawInputEditorLang,
      placeholder: t("request.raw_body").toString(),
    },
    linter: langLinter,
    completer: null,
    environmentHighlights: true,
    predefinedVariablesHighlights: true,
  })
)

const clearContent = () => {
  rawParamsBody.value = ""
}

const uploadPayload = async (e: Event) => {
  await pipe(
    (e.target as HTMLInputElement).files?.[0],
    TO.of,
    TO.chain(TO.fromPredicate((f): f is File => f !== undefined)),
    TO.chain(readFileAsText),

    TO.matchW(
      () => toast.error(`${t("action.choose_file")}`),
      (result) => {
        rawParamsBody.value = result
        toast.success(`${t("state.file_imported")}`)
      }
    )
  )()
}

const prettifyRequestBody = () => {
  let prettifyBody = ""
  try {
    if (body.value.contentType.endsWith("json")) {
      prettifyBody = prettifyJSONC(rawParamsBody.value as string)
    } else if (
      body.value.contentType === "application/xml" ||
      body.value.contentType === "text/xml"
    ) {
      prettifyBody = prettifyXML(rawParamsBody.value as string)
    }
    rawParamsBody.value = prettifyBody
    prettifyIcon.value = IconCheck
  } catch (e) {
    console.error(e)
    prettifyIcon.value = IconInfo
    toast.error(`${t("error.json_prettify_invalid_body")}`)
  }
}

const isModifyBodyModalOpen = ref(false)

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

const showModifyBodyModal = () => {
  if (!currentUser.value) {
    invokeAction("modals.login.toggle")
    return
  }

  isModifyBodyModalOpen.value = true
}

const { shouldEnableAIFeatures } = useAIExperiments()

const prettifyXML = (xml: string) => {
  return xmlFormat(xml, {
    indentation: "  ",
    collapseContent: true,
    lineSeparator: "\n",
  })
}

// ─── Example Selector ─────────────────────────────────────────────

const tabs = useService(RESTTabService)
const workspaceModelService = useService(WorkspaceModelService)

const exampleTippyActions = ref<any | null>(null)

// Whether to show the example selector (JSON or XML content types)
const showExampleSelector = computed(() => {
  const ct = body.value.contentType
  return (
    ct === "application/json" ||
    ct === "application/ld+json" ||
    ct === "application/hal+json" ||
    ct === "application/vnd.api+json" ||
    ct === "application/xml" ||
    ct === "text/xml"
  )
})

// Access the current request's bodyExamples
const bodyExamples = computed<HoppRESTBodyExample[]>(() => {
  const tab = tabs.currentActiveTab.value
  if (!tab) return []
  const request = tab.document.request
  return (request.bodyExamples ?? []) as HoppRESTBodyExample[]
})

// Track which example is currently selected (-1 = default, 0+ = user examples)
const selectedExampleIndex = ref(-1)

// Model resolver for generating default examples from modelRef
const modelResolver = computed(() => {
  return (modelRefId: string): HoppRESTSchemaNode[] | undefined => {
    const model = workspaceModelService.getModelById(modelRefId)
    return model?.schemaTree as HoppRESTSchemaNode[] | undefined
  }
})

// Generate default example from bodySchemaTree
const defaultExampleContent = computed(() => {
  const tab = tabs.currentActiveTab.value
  if (!tab) return "{}"
  const request = tab.document.request
  const tree = request.bodySchemaTree
  const ct = body.value.contentType
  const resolver = modelResolver.value

  if (
    ct === "application/xml" ||
    ct === "text/xml"
  ) {
    return generateXmlFromSchemaTree(tree as HoppRESTSchemaNode[] | null, resolver)
  }
  return generateJsonFromSchemaTree(tree as HoppRESTSchemaNode[] | null, resolver)
})

// Load the default (auto-generated) example into editor
function loadDefaultExample() {
  selectedExampleIndex.value = -1
  rawParamsBody.value = defaultExampleContent.value
}

// Load a user-created example into editor
function loadExample(index: number) {
  const examples = bodyExamples.value
  if (index >= 0 && index < examples.length) {
    selectedExampleIndex.value = index
    rawParamsBody.value = examples[index].body
  }
}

// ─── Add Example ────────────────────────────────────────────────

const showAddModal = ref(false)
const newExampleName = ref("")

function showAddExampleDialog() {
  newExampleName.value = ""
  showAddModal.value = true
}

function confirmAddExample() {
  const name = newExampleName.value.trim()
  if (!name) return

  const tab = tabs.currentActiveTab.value
  if (!tab) return

  const request = tab.document.request
  const existing = (request.bodyExamples ?? []) as HoppRESTBodyExample[]

  // Check for duplicate name
  if (existing.some((ex) => ex.name === name)) {
    toast.error(t("body_examples.duplicate_name"))
    return
  }

  const currentContent =
    typeof rawParamsBody.value === "string" ? rawParamsBody.value : ""

  const newExample: HoppRESTBodyExample = {
    name,
    body: currentContent,
    contentType: body.value.contentType || "application/json",
  }

  const updated = [...existing, newExample]

  tab.document.request = {
    ...request,
    bodyExamples: updated,
  } as typeof request

  showAddModal.value = false
  selectedExampleIndex.value = updated.length - 1
  toast.success(t("action.save") + ": " + name)
}

// ─── Manage Examples ──────────────────────────────────────────

const showManageModal = ref(false)
const editingExampleIndex = ref(-1)
const editingExampleName = ref("")

function startRename(index: number) {
  editingExampleIndex.value = index
  editingExampleName.value = bodyExamples.value[index]?.name || ""
}

function confirmRename(index: number) {
  const name = editingExampleName.value.trim()
  if (!name) return

  const tab = tabs.currentActiveTab.value
  if (!tab) return

  const request = tab.document.request
  const existing = [...((request.bodyExamples ?? []) as HoppRESTBodyExample[])]

  // Check for duplicate name (excluding the item being renamed)
  if (existing.some((ex, i) => i !== index && ex.name === name)) {
    toast.error(t("body_examples.duplicate_name"))
    return
  }

  if (index >= 0 && index < existing.length) {
    existing[index] = { ...existing[index], name }
    tab.document.request = {
      ...request,
      bodyExamples: existing,
    } as typeof request
  }

  editingExampleIndex.value = -1
}

function deleteExample(index: number) {
  const tab = tabs.currentActiveTab.value
  if (!tab) return

  const request = tab.document.request
  const existing = [...((request.bodyExamples ?? []) as HoppRESTBodyExample[])]

  if (existing.length <= 1) return // keep at least one

  existing.splice(index, 1)

  tab.document.request = {
    ...request,
    bodyExamples: existing,
  } as typeof request

  // If the deleted example was selected, switch to first or default
  if (selectedExampleIndex.value === index) {
    if (existing.length > 0) {
      selectedExampleIndex.value = 0
      rawParamsBody.value = existing[0].body
    } else {
      selectedExampleIndex.value = -1
      rawParamsBody.value = defaultExampleContent.value
    }
  } else if (selectedExampleIndex.value > index) {
    selectedExampleIndex.value--
  }
}
</script>

<style lang="scss" scoped>
:deep(.cm-panels) {
  @apply top-upperFourthStickyFold #{!important};
}
</style>
