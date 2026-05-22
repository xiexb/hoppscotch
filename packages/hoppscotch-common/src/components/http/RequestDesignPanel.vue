<template>
  <div class="flex flex-col h-full overflow-hidden bg-primary">
    <!-- Header: Title + Status badge -->
    <div class="border-b border-dividerLight px-4 py-3 bg-primary shrink-0">
      <div class="flex items-center gap-3">
        <!-- Title (always editable) -->
        <input
          :value="apiTitle || request.name"
          class="text-lg font-bold bg-transparent outline-none flex-1 min-w-0 text-secondaryDark placeholder:text-secondaryLight"
          placeholder="接口名称"
          @input="onTitleInput"
        />

        <!-- Status badge (always editable) -->
        <div class="relative shrink-0">
          <StatusBadge
            :model-value="apiStatus"
            :editable="true"
            @update:model-value="onStatusChange"
          />
        </div>
      </div>
    </div>

    <!-- URL bar (Method + URL + 手动调试) -->
    <div class="shrink-0">
      <HttpRequest
        v-model="tabModel"
        send-label="手动调试"
        @send-action="emit('switchToDebug')"
      />
    </div>

    <!-- Edit content area (always shown) -->
    <DesignEditView
      :request="request"
      :inherited-properties="inheritedProperties"
      @update:request="onRequestUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useVModel } from "@vueuse/core"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import type { HoppTab } from "~/services/tab"
import type { HoppRequestDocument } from "~/helpers/rest/document"
import type { ApiStatus } from "./design/StatusBadge.vue"
import StatusBadge from "./design/StatusBadge.vue"
import DesignEditView from "./design/EditView.vue"
import HttpRequest from "./Request.vue"

const props = withDefaults(
  defineProps<{
    modelValue: HoppRESTRequest
    tab: HoppTab<HoppRequestDocument>
    inheritedProperties?: HoppInheritedProperty
  }>(),
  {
    inheritedProperties: undefined,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTRequest): void
  (e: "update:tab", val: HoppTab<HoppRequestDocument>): void
  (e: "switchToDebug"): void
}>()

const request = useVModel(props, "modelValue", emit)
const tabModel = useVModel(props, "tab", emit)

const apiTitle = computed(() => request.value.apiTitle ?? "")
const apiStatus = computed(
  () => (request.value.apiStatus ?? "developing") as ApiStatus
)

function onRequestUpdate(updated: HoppRESTRequest) {
  request.value = updated
}

function onTitleInput(event: Event) {
  const target = event.target as HTMLInputElement
  request.value = { ...request.value, apiTitle: target.value }
}

function onStatusChange(val: ApiStatus) {
  request.value = { ...request.value, apiStatus: val }
}
</script>
