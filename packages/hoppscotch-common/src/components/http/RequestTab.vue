<template>
  <!-- Debug mode: split pane layout with response panel -->
  <AppPaneLayout
    v-if="currentMode === 'debug'"
    layout-id="rest-primary"
  >
    <template #primary>
      <HttpRequestModeTabs
        :model-value="currentMode"
        @update:model-value="onModeChange"
      />
      <HttpRequest v-model="tab" />
      <HttpRequestOptions
        v-model="tab.document.request"
        v-model:option-tab="tab.document.optionTabPreference"
        v-model:inherited-properties="tab.document.inheritedProperties"
      />
    </template>
    <template #secondary>
      <HttpResponse
        v-model:document="tab.document"
        :tab-id="tab.id"
        :is-embed="false"
      />
    </template>
  </AppPaneLayout>

  <!-- Non-debug modes: no split pane, full content area -->
  <div v-else class="flex flex-col h-full overflow-hidden">
    <HttpRequestModeTabs
      :model-value="currentMode"
      @update:model-value="onModeChange"
    />
    <HttpRequestDesignPanel
      v-if="currentMode === 'design'"
      v-model="tab.document.request"
      @switch-to-debug="currentMode = 'debug'"
    />
    <HttpRequestTestCasesPanel
      v-if="currentMode === 'testcases'"
      v-model="tab.document.request"
    />
  </div>
</template>

<script setup lang="ts">
import { watch, ref } from "vue"
import { useVModel } from "@vueuse/core"
import { cloneDeep } from "lodash-es"
import { isEqualHoppRESTRequest } from "@hoppscotch/data"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument } from "~/helpers/rest/document"
import type { RequestMode } from "./RequestModeTabs.vue"

const props = defineProps<{ modelValue: HoppTab<HoppRequestDocument> }>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppTab<HoppRequestDocument>): void
}>()

const tab = useVModel(props, "modelValue", emit)

const currentMode = ref<RequestMode>(
  tab.value.document.modePreference ?? "debug"
)

watch(currentMode, (newMode) => {
  tab.value.document.modePreference = newMode
})

function onModeChange(newMode: RequestMode) {
  currentMode.value = newMode
}

// TODO: Come up with a better dirty check
let oldRequest = cloneDeep(tab.value.document.request)
watch(
  () => tab.value.document.request,
  (updatedValue) => {
    if (
      !tab.value.document.isDirty &&
      !isEqualHoppRESTRequest(oldRequest, updatedValue)
    ) {
      tab.value.document.isDirty = true
    }

    oldRequest = cloneDeep(updatedValue)
  },
  { deep: true }
)
</script>
