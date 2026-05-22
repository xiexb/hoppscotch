<template>
  <div class="flex flex-col h-full overflow-hidden bg-primary">
    <!-- Header: Title + Status + mode indicator + action button -->
    <div class="border-b border-dividerLight px-4 py-3 bg-primary shrink-0">
      <div class="flex items-center gap-3">
        <!-- Title + Status badge (inline, status right after title) -->
        <div class="flex items-center gap-2 min-w-0">
          <input
            v-if="subMode === 'edit'"
            :value="apiTitle || request.name"
            :size="Math.max((apiTitle || request.name || '接口名称').length, 4)"
            class="text-lg font-bold bg-transparent outline-none border-0 p-0 m-0 max-w-[20rem] leading-none text-secondaryDark placeholder:text-secondaryLight"
            placeholder="接口名称"
            @input="onTitleInput"
          />
          <h1
            v-else
            class="text-lg font-bold text-secondaryDark truncate m-0 p-0 leading-none"
          >
            {{ apiTitle || request.name || "Untitled" }}
          </h1>

          <StatusBadge
            :model-value="apiStatus"
            :editable="subMode === 'edit'"
            @update:model-value="onStatusChange"
          />
        </div>

        <div class="flex-1" />

        <!-- Divider -->
        <div class="w-px h-5 bg-dividerLight" />

        <!-- Mode indicator -->
        <span
          class="text-xs font-medium px-2 py-0.5 rounded shrink-0"
          :class="
            subMode === 'edit'
              ? 'bg-accentLight/15 text-accent'
              : 'bg-secondaryLight/15 text-secondary'
          "
        >
          {{ subMode === "edit" ? "编辑模式" : "预览模式" }}
        </span>

        <!-- Action button -->
        <HoppButtonPrimary
          v-if="subMode === 'edit'"
          :label="'预览'"
          class="shrink-0"
          @click="subMode = 'preview'"
        />
        <HoppButtonSecondary
          v-else
          :label="'编辑'"
          class="shrink-0"
          @click="subMode = 'edit'"
        />
      </div>
    </div>

    <!-- URL bar (only in edit mode) -->
    <div v-if="subMode === 'edit'" class="shrink-0">
      <HttpRequest
        v-model="tabModel"
        send-label="手动调试"
        @send-action="emit('switchToDebug')"
      />
    </div>

    <!-- Content area -->
    <DesignEditView
      v-if="subMode === 'edit'"
      :request="request"
      :inherited-properties="inheritedProperties"
      @update:request="onRequestUpdate"
      @save="onSave"
    />

    <DesignPreviewView
      v-if="subMode === 'preview'"
      :request="request"
      @switch-to-debug="emit('switchToDebug')"
      @save="onSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"
import { useVModel } from "@vueuse/core"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import type { HoppTab } from "~/services/tab"
import type { HoppRequestDocument } from "~/helpers/rest/document"
import type { ApiStatus } from "./design/StatusBadge.vue"
import StatusBadge from "./design/StatusBadge.vue"
import DesignEditView from "./design/EditView.vue"
import DesignPreviewView from "./design/PreviewView.vue"
import HttpRequest from "./Request.vue"
import { invokeAction } from "~/helpers/actions"

const props = withDefaults(
  defineProps<{
    modelValue: HoppRESTRequest
    tab: HoppTab<HoppRequestDocument>
    inheritedProperties?: HoppInheritedProperty
    initialSubMode?: "edit" | "preview"
  }>(),
  {
    inheritedProperties: undefined,
    initialSubMode: "preview",
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTRequest): void
  (e: "update:tab", val: HoppTab<HoppRequestDocument>): void
  (e: "switchToDebug"): void
  (e: "update:subMode", val: "edit" | "preview"): void
}>()

const request = useVModel(props, "modelValue", emit)
const tabModel = useVModel(props, "tab", emit)
const subMode = ref<"edit" | "preview">(props.initialSubMode)

const apiTitle = computed(() => request.value.apiTitle ?? "")
const apiStatus = computed(
  () => (request.value.apiStatus ?? "developing") as ApiStatus
)

watch(subMode, (val) => {
  emit("update:subMode", val)
})

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

function onSave() {
  invokeAction("request-response.save")
}
</script>
