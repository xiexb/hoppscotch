<template>
  <HoppSmartTabs
    v-model="selectedOptionTab"
    styles="sticky overflow-x-auto flex-shrink-0 bg-primary top-upperMobilePrimaryStickyFold sm:top-upperPrimaryStickyFold z-10"
  >
    <HoppSmartTab
      v-if="properties?.includes('params') ?? true"
      :id="'params'"
      :label="`${t('tab.parameters')}`"
      :info="`${newActiveParamsCount}`"
    >
      <HttpParameters v-model="request.params" :envs="envs" />
      <div v-if="hasPathParams" class="flex flex-col">
        <div
          class="flex flex-shrink-0 items-center justify-between overflow-x-auto border-t border-dividerLight bg-primary pl-4 pr-2"
        >
          <label class="truncate py-2 font-semibold text-secondaryLight">
            {{ t("request.path_parameter_list") }}
          </label>
          <div class="flex">
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('action.clear_all')"
              :icon="IconTrash2"
              @click="clearPathParams"
            />
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('add.new')"
              :icon="IconPlus"
              @click="addPathParam"
            />
          </div>
        </div>
        <HttpPathParams v-model="request.pathParams" :envs="envs" hide-header />
      </div>
    </HoppSmartTab>
    <HoppSmartTab
      v-if="properties?.includes('bodyParams') ?? true"
      :id="'bodyParams'"
      :label="`${t('tab.body')}`"
      :indicator="isBodyFilled"
    >
      <HttpBody
        v-model:headers="request.headers"
        v-model:body="request.body"
        :envs="envs"
        @change-tab="changeOptionTab"
      />
    </HoppSmartTab>
    <HoppSmartTab
      v-if="properties?.includes('headers') ?? true"
      :id="'headers'"
      :label="`${t('tab.headers')}`"
      :info="`${newActiveHeadersCount}`"
    >
      <HttpHeaders
        v-model="request"
        :inherited-properties="inheritedProperties"
        :envs="envs"
        @change-tab="changeOptionTab"
      />
    </HoppSmartTab>
    <HoppSmartTab
      v-if="properties?.includes('authorization') ?? true"
      :id="'authorization'"
      :label="`${t('tab.authorization')}`"
    >
      <HttpAuthorization
        v-model="request.auth"
        :inherited-properties="inheritedProperties"
        :envs="envs"
      />
    </HoppSmartTab>
    <HoppSmartTab
      v-if="showPreRequestScriptTab"
      :id="'preRequestScript'"
      :label="`${t('tab.pre_request_script')}`"
      :indicator="
        ('preRequestScript' in request &&
          hasActualScript(request.preRequestScript)) ||
        hasInheritedPreRequestScripts
      "
    >
      <HttpPreRequestScript
        v-if="'preRequestScript' in request"
        v-model="request.preRequestScript"
        :is-active="selectedOptionTab === 'preRequestScript'"
        :inherited-properties="inheritedProperties"
      />
    </HoppSmartTab>
    <HoppSmartTab
      v-if="showTestsTab"
      :id="'tests'"
      :label="`${t('tab.post_request_script')}`"
      :indicator="
        ('testScript' in request && hasActualScript(request.testScript)) ||
        hasInheritedTestScripts
      "
    >
      <HttpTests
        v-if="'testScript' in request"
        v-model="request.testScript"
        :is-active="selectedOptionTab === 'tests'"
        :inherited-properties="inheritedProperties"
      />
    </HoppSmartTab>
    <HoppSmartTab
      v-if="properties?.includes('requestVariables') ?? true"
      :id="'requestVariables'"
      :label="`${t('tab.variables')}`"
      :info="`${newActiveRequestVariablesCount}`"
      :align-last="true"
    >
      <HttpRequestVariables v-model="request.requestVariables" />
    </HoppSmartTab>
  </HoppSmartTabs>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import {
  HoppRESTRequest,
  HoppRESTResponseOriginalRequest,
} from "@hoppscotch/data"
import { useVModel } from "@vueuse/core"
import { computed } from "vue"

import { defineActionHandler } from "~/helpers/actions"
import { hasActualScript } from "@hoppscotch/js-sandbox/scripting"
import { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import { AggregateEnvironment } from "~/newstore/environments"
import HttpPathParams from "./PathParams.vue"
import IconTrash2 from "~icons/lucide/trash-2"
import IconPlus from "~icons/lucide/plus"

const _VALID_OPTION_TABS = [
  "params",
  "bodyParams",
  "headers",
  "authorization",
  "preRequestScript",
  "tests",
  "requestVariables",
] as const

export type RESTOptionTabs = (typeof _VALID_OPTION_TABS)[number]

const t = useI18n()

// v-model integration with props and emit
const props = withDefaults(
  defineProps<{
    modelValue: HoppRESTRequest | HoppRESTResponseOriginalRequest
    optionTab: RESTOptionTabs
    properties?: string[]
    inheritedProperties?: HoppInheritedProperty
    envs?: AggregateEnvironment[]
  }>(),
  {
    optionTab: "params",
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: HoppRESTRequest): void
  (e: "update:optionTab", value: RESTOptionTabs): void
}>()

const request = useVModel(props, "modelValue", emit)
const selectedOptionTabRaw = useVModel(props, "optionTab", emit)

// Ensure selectedOptionTab always has a valid string value.
// When optionTabPreference is undefined (e.g. restored from old localStorage
// data that lacked this field), useVModel returns undefined, which breaks
// HoppSmartTabs because it does strict === comparison with tab IDs.
// Also handle legacy 'pathParams' tab value (now merged into 'params').
const selectedOptionTab = computed({
  get: () => {
    const val = selectedOptionTabRaw.value
    if (!val || val === "pathParams") return "params" as RESTOptionTabs
    return val
  },
  set: (val: RESTOptionTabs) => {
    selectedOptionTabRaw.value = val
  },
})

const showPreRequestScriptTab = computed(() => {
  return (
    props.properties?.includes("preRequestScript") ??
    "preRequestScript" in request.value
  )
})

const showTestsTab = computed(() => {
  return props.properties?.includes("tests") ?? "testScript" in request.value
})

const changeOptionTab = (e: RESTOptionTabs) => {
  selectedOptionTab.value = e
}

const newActiveParamsCount = computed(() => {
  const paramsCount = request.value.params.filter(
    (x) => x.active && (x.key || x.value)
  ).length

  const pathParamsCount = (request.value.pathParams ?? []).filter(
    (x) => x.active && (x.key || x.value)
  ).length

  const total = paramsCount + pathParamsCount
  return total ? total : null
})

const hasPathParams = computed(() => {
  return (request.value.pathParams ?? []).length > 0
})

const clearPathParams = () => {
  request.value.pathParams = []
}

const addPathParam = () => {
  const current = request.value.pathParams ?? []
  request.value.pathParams = [
    ...current,
    { key: "", value: "", active: true, description: "" },
  ]
}

const newActiveHeadersCount = computed(() => {
  const count = request.value.headers.filter(
    (x) => x.active && (x.key || x.value)
  ).length

  return count ? count : null
})

const newActiveRequestVariablesCount = computed(() => {
  const count = request.value.requestVariables.filter(
    (x) => x.active && (x.key || x.value)
  ).length
  return count ? count : null
})

const isBodyFilled = computed(() => {
  return Boolean(request.value.body.body && request.value.body.body.length > 0)
})

const hasInheritedPreRequestScripts = computed(() => {
  return (
    props.inheritedProperties?.scripts?.some((script) =>
      hasActualScript(script.preRequestScript)
    ) ?? false
  )
})

const hasInheritedTestScripts = computed(() => {
  return (
    props.inheritedProperties?.scripts?.some((script) =>
      hasActualScript(script.testScript)
    ) ?? false
  )
})

defineActionHandler("request.open-tab", ({ tab }) => {
  selectedOptionTab.value = tab as RESTOptionTabs
})
</script>
