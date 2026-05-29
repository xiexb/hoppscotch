<template>
  <AppPaneLayout layout-id="rest-primary">
    <template #primary>
      <HttpExampleResponseRequest v-model="tab" />
      <HttpRequestOptions
        v-model="originalRequestModel"
        v-model:option-tab="optionTab"
        :properties="['params', 'bodyParams', 'headers', 'authorization']"
      />
    </template>
    <template #secondary>
      <HttpExampleResponse v-model:document="tab.document" :is-embed="false" />
    </template>
  </AppPaneLayout>
</template>

<script setup lang="ts">
import { watch, computed } from "vue"
import { useVModel } from "@vueuse/core"
import { cloneDeep } from "lodash-es"
import { HoppTab } from "~/services/tab"
import { HoppSavedExampleDocument } from "~/helpers/rest/document"
import { isEqual } from "lodash-es"
import { HoppRESTResponseOriginalRequest } from "@hoppscotch/data"
import HttpRequestOptions from "~/components/http/RequestOptions.vue"
import type { RESTOptionTabs } from "~/components/http/RequestOptions.vue"

const props = defineProps<{ modelValue: HoppTab<HoppSavedExampleDocument> }>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppTab<HoppSavedExampleDocument>): void
}>()

const tab = useVModel(props, "modelValue", emit)

// Option tab preference (local, not persisted for example tabs)
const optionTab = computed({
  get: () => (tab.value.document as any).optionTabPreference as RESTOptionTabs ?? "params" as RESTOptionTabs,
  set: (val: RESTOptionTabs) => {
    ;(tab.value.document as any).optionTabPreference = val
  },
})

// Bridge: originalRequest is HoppRESTResponseOriginalRequest,
// RequestOptions accepts HoppRESTRequest | HoppRESTResponseOriginalRequest
const originalRequestModel = computed({
  get: () => tab.value.document.response.originalRequest,
  set: (val: HoppRESTResponseOriginalRequest) => {
    tab.value.document.response.originalRequest = val
  },
})

// TODO: Come up with a better dirty check
let oldResponse = cloneDeep(tab.value.document.response)
watch(
  () => tab.value.document.response,
  (updatedValue) => {
    if (!tab.value.document.isDirty && !isEqual(oldResponse, updatedValue)) {
      tab.value.document.isDirty = true
    }

    oldResponse = cloneDeep(updatedValue)
  },
  { deep: true }
)
</script>
