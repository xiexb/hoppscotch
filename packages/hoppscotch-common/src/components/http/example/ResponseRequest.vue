<template>
  <div
    class="sticky top-0 z-20 flex-none flex-shrink-0 bg-primary p-4 sm:flex sm:flex-shrink-0 sm:space-x-2"
  >
    <div
      class="min-w-[12rem] flex flex-1 whitespace-nowrap rounded border border-divider"
    >
      <div class="relative flex">
        <label for="method">
          <tippy
            interactive
            trigger="click"
            theme="popover"
            :on-shown="() => methodTippyActions.focus()"
          >
            <HoppSmartSelectWrapper>
              <input
                id="method"
                class="flex w-26 cursor-pointer rounded-l bg-primaryLight px-4 py-2 font-semibold text-secondaryDark transition"
                :value="tab.document.response.originalRequest.method"
                :readonly="!isCustomMethod"
                :placeholder="`${t('request.method')}`"
                @input="onSelectMethod($event)"
              />
            </HoppSmartSelectWrapper>
            <template #content="{ hide }">
              <div
                ref="methodTippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  v-for="(method, index) in methods"
                  :key="`method-${index}`"
                  :label="method"
                  :style="{
                    color: getMethodLabelColor(method),
                  }"
                  @click="
                    () => {
                      updateMethod(method)
                      hide()
                    }
                  "
                />
              </div>
            </template>
          </tippy>
        </label>
      </div>
      <div
        class="flex flex-1 whitespace-nowrap rounded-r border-l border-divider bg-primaryLight transition"
      >
        <!-- Prefix URL indicator (🔗 icon, clickable to change service) -->
        <tippy
          v-if="resolvedPrefixUrl && !isEndpointFullUrl"
          interactive
          trigger="click"
          theme="popover"
        >
          <span
            v-tippy="{ theme: 'tooltip', content: `前置URL: ${resolvedPrefixUrl}` }"
            class="flex items-center px-2 text-accent shrink-0 cursor-pointer"
          >
            <icon-lucide-link class="w-4 h-4" />
          </span>
          <template #content="{ hide }">
            <div class="flex flex-col focus:outline-none" tabindex="0" @keyup.escape="hide()">
              <div class="text-xs text-secondaryLight px-2 py-1 font-semibold">前置URL (环境服务)</div>
              <HoppSmartItem
                v-for="svc in environmentServices"
                :key="svc.id"
                :label="svc.name || svc.url"
                :info="svc.url"
                :icon="currentSelectedServiceId === svc.id ? IconCheck : IconLink"
                @click="() => { selectService(svc.id); hide() }"
              />
              <hr v-if="environmentServices.length" />
              <HoppSmartItem
                label="无前置URL"
                :icon="IconX"
                @click="() => { clearService(); hide() }"
              />
            </div>
          </template>
        </tippy>
        <SmartEnvInput
          v-model="tab.document.response.originalRequest.endpoint"
          :placeholder="`${t('request.url_placeholder')}`"
          :auto-complete-env="true"
          :inspection-results="tabResults"
        />
      </div>
    </div>
    <div class="mt-2 flex sm:mt-0 items-stretch space-x-2">
      <HoppButtonPrimary
        id="send"
        v-tippy="{ theme: 'tooltip', delay: [500, 20], allowHTML: true }"
        title="Try"
        label="Try"
        class="min-w-[5rem]"
        @click="tryExampleResponse"
      />
      <HoppButtonSecondary
        id="save"
        v-tippy="{ theme: 'tooltip', delay: [500, 20], allowHTML: true }"
        :title="t('action.save')"
        :label="t('action.save')"
        :icon="IconSave"
        :loading="isSaving"
        :disabled="!tab.document.isDirty || isSaving"
        class="min-w-[5rem]"
        @click="saveExample"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useVModel } from "@vueuse/core"
import { computed, ref } from "vue"
import { useReadonlyStream } from "@composables/stream"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { useService } from "dioc/vue"
import { InspectionService } from "~/services/inspection"
import { HoppTab } from "~/services/tab"
import { HoppSavedExampleDocument } from "~/helpers/rest/document"
import { RESTTabService } from "~/services/tab/rest"
import { getMethodLabelColor } from "~/helpers/rest/labelColoring"
import { HoppRESTRequest } from "@hoppscotch/data"
import type { EnvironmentService } from "@hoppscotch/data"
import {
  currentEnvironment$,
  globalEnv$,
} from "~/newstore/environments"
import IconCheck from "~icons/lucide/check"
import IconLink from "~icons/lucide/link"
import IconX from "~icons/lucide/x"
import {
  editRESTRequest,
  navigateToFolderWithIndexPath,
  restCollectionStore,
} from "~/newstore/collections"
import { useToast } from "@composables/toast"
import { cloneDeep } from "lodash-es"
import { getSingleRequest } from "~/helpers/teams/TeamRequest"
import { updateTeamRequest } from "~/helpers/backend/mutations/TeamRequest"
import * as E from "fp-ts/Either"
import * as TE from "fp-ts/TaskEither"
import IconSave from "~icons/lucide/save"

// Promise wrapper for fp-ts TaskEither
const taskToPromise = <E, A>(task: TE.TaskEither<E, A>): Promise<A> =>
  task().then((result) => {
    if (E.isLeft(result)) throw result.left
    return result.right
  })

const t = useI18n()
const toast = useToast()

const methods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "CONNECT",
  "TRACE",
  "CUSTOM",
]

const props = defineProps<{ modelValue: HoppTab<HoppSavedExampleDocument> }>()
const emit = defineEmits(["update:modelValue"])

const tabs = useService(RESTTabService)

const tab = useVModel(props, "modelValue", emit)

// --- Prefix URL resolution (environment services + inheritance) ---
const currentEnv = useReadonlyStream(currentEnvironment$, undefined)
const globalEnvStore = useReadonlyStream(globalEnv$, { variables: [], services: [] })

const environmentServices = computed<EnvironmentService[]>(() => {
  const envServices = (currentEnv.value as any)?.services ?? []
  const globalServices = (globalEnvStore.value as any)?.services ?? []
  const ids = new Set(envServices.map((s: EnvironmentService) => s.id))
  return [
    ...envServices,
    ...globalServices.filter((s: EnvironmentService) => !ids.has(s.id)),
  ]
})

/** Resolved prefix URL from inherited service */
const resolvedPrefixUrl = computed(() => {
  const inheritedProps = tab.value.document.inheritedProperties
  const svcId = inheritedProps?.selectedServiceId
  if (svcId) {
    const svc = environmentServices.value.find((s) => s.id === svcId)
    return svc?.url ?? ""
  }
  return ""
})

/** Whether the endpoint is already a full URL (prefix URL won't apply) */
const isEndpointFullUrl = computed(() => {
  const endpoint = tab.value.document.response.originalRequest.endpoint || ""
  return /^https?:\/\//i.test(endpoint)
})

/** Currently selected service ID from inheritedProperties */
const currentSelectedServiceId = computed(() => {
  return tab.value.document.inheritedProperties?.selectedServiceId ?? null
})

/** Select a service to use as prefix URL */
const selectService = (svcId: string) => {
  if (!tab.value.document.inheritedProperties) {
    tab.value.document.inheritedProperties = {} as any
  }
  tab.value.document.inheritedProperties!.selectedServiceId = svcId
}

/** Clear the selected service (remove prefix URL) */
const clearService = () => {
  if (tab.value.document.inheritedProperties) {
    tab.value.document.inheritedProperties.selectedServiceId = undefined
  }
}

const isSaving = ref(false)

const newMethod = computed(() => {
  return tab.value.document.response.originalRequest.method
})

const tryExampleResponse = () => {
  const {
    endpoint,
    method,
    auth,
    body,
    headers,
    name,
    params,
    requestVariables,
    pathParams,
  } = tab.value.document.response.originalRequest

  tabs.createNewTab({
    isDirty: false,
    type: "request",
    request: {
      ...getDefaultRESTRequest(),
      endpoint,
      method,
      auth,
      body,
      headers,
      name,
      params,
      requestVariables,
      pathParams: pathParams ?? [],
    },
    inheritedProperties: tab.value.document.inheritedProperties,
  })
}

const saveExample = async () => {
  const saveCtx = tab.value.document.saveContext
  if (!saveCtx) {
    toast.error(t("error.something_went_wrong"))
    return
  }

  const responseName = tab.value.document.response.name
  if (!responseName) {
    toast.error(t("error.something_went_wrong"))
    return
  }

  isSaving.value = true

  try {
    if (saveCtx.originLocation === "user-collection") {
      saveUserCollectionExample(saveCtx, responseName)
    } else {
      await saveTeamCollectionExample(saveCtx, responseName)
    }

    tab.value.document.isDirty = false
    toast.success(t("response.saved"))
  } catch (e) {
    console.error("Failed to save example:", e)
    toast.error(t("error.something_went_wrong"))
  } finally {
    isSaving.value = false
  }
}

const saveUserCollectionExample = (
  saveCtx: { folderPath: string; requestIndex?: number },
  responseName: string
) => {
  const { folderPath, requestIndex } = saveCtx
  if (requestIndex === undefined || requestIndex === null) {
    throw new Error("requestIndex is required for user-collection save")
  }

  // Read the parent request from the collection store
  const indexPaths = folderPath.split("/").map((x) => parseInt(x))
  const folder = navigateToFolderWithIndexPath(
    restCollectionStore.value.state,
    indexPaths
  )
  if (!folder) {
    throw new Error("Folder not found")
  }

  const request = cloneDeep(folder.requests[requestIndex]) as HoppRESTRequest
  if (!request) {
    throw new Error("Request not found")
  }

  // Update the response's originalRequest with the current edited one
  if (request.responses && request.responses[responseName]) {
    request.responses[responseName] = {
      ...request.responses[responseName],
      originalRequest: cloneDeep(
        tab.value.document.response.originalRequest
      ),
    }
  } else {
    throw new Error(`Response "${responseName}" not found in request`)
  }

  editRESTRequest(folderPath, requestIndex, request)
}

const saveTeamCollectionExample = async (
  saveCtx: { requestID: string },
  responseName: string
) => {
  const { requestID } = saveCtx

  // Fetch the request from the backend
  const queryResult = await taskToPromise(getSingleRequest(requestID))
  const reqData = queryResult.request
  if (!reqData) {
    throw new Error("Request not found in team collections")
  }

  // Parse the request data (it comes as a JSON string)
  const request: HoppRESTRequest =
    typeof reqData.request === "string"
      ? JSON.parse(reqData.request)
      : (reqData.request as unknown as HoppRESTRequest)

  // Update the response's originalRequest
  if (request.responses && request.responses[responseName]) {
    request.responses[responseName] = {
      ...request.responses[responseName],
      originalRequest: cloneDeep(
        tab.value.document.response.originalRequest
      ),
    }
  } else {
    throw new Error(`Response "${responseName}" not found in request`)
  }

  // Save back to the backend
  await taskToPromise(
    updateTeamRequest(requestID, {
      request: JSON.stringify(request),
      title: request.name,
    })
  )
}

// Template refs
const methodTippyActions = ref<any | null>(null)

const inspectionService = useService(InspectionService)

const updateMethod = (method: string) => {
  tab.value.document.response.originalRequest.method = method
}

const onSelectMethod = (e: Event | any) => {
  updateMethod(e.target.value)
}

const isCustomMethod = computed(() => {
  return (
    tab.value.document.response.originalRequest.method === "CUSTOM" ||
    !methods.includes(newMethod.value)
  )
})

const tabResults = inspectionService.getResultViewFor(tabs.currentTabID.value)
</script>
