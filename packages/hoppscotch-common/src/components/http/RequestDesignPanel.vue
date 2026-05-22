<template>
  <div class="flex flex-col h-full overflow-hidden bg-primary">
    <!-- Header: Title + Status + Edit/Preview tabs + action button -->
    <div class="border-b border-dividerLight px-4 py-3 bg-primary shrink-0">
      <div class="flex items-center gap-3">
        <!-- Title (editable in edit mode, read-only in preview) -->
        <input
          v-if="subMode === 'edit'"
          :value="apiTitle || request.name"
          class="text-lg font-bold bg-transparent outline-none flex-1 min-w-0 text-secondaryDark placeholder:text-secondaryLight"
          placeholder="接口名称"
          @input="onTitleInput"
        />
        <h1 v-else class="text-lg font-bold text-secondaryDark flex-1 min-w-0 truncate">
          {{ apiTitle || request.name || "Untitled" }}
        </h1>

        <!-- Status badge -->
        <div class="relative shrink-0">
          <StatusBadge
            :model-value="apiStatus"
            :editable="subMode === 'edit'"
            @update:model-value="onStatusChange"
          />
        </div>

        <!-- Divider -->
        <div class="w-px h-5 bg-dividerLight mx-1" />

        <!-- Edit / Preview tabs -->
        <button
          class="flex items-center gap-1 px-3 py-1 text-xs transition-colors rounded"
          :class="
            subMode === 'edit'
              ? 'bg-accentLight/15 text-accent font-semibold'
              : 'text-secondary hover:text-secondaryDark hover:bg-primaryLight'
          "
          @click="subMode = 'edit'"
        >
          <IconEdit class="w-3 h-3" />
          编辑
        </button>
        <button
          class="flex items-center gap-1 px-3 py-1 text-xs transition-colors rounded"
          :class="
            subMode === 'preview'
              ? 'bg-accentLight/15 text-accent font-semibold'
              : 'text-secondary hover:text-secondaryDark hover:bg-primaryLight'
          "
          @click="subMode = 'preview'"
        >
          <IconEye class="w-3 h-3" />
          预览
        </button>

        <!-- Action button -->
        <button
          v-if="subMode === 'edit'"
          class="px-3 py-1 text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 rounded transition-colors shrink-0"
          @click="onSave"
        >
          保存
        </button>
        <button
          v-else
          class="px-3 py-1 text-xs font-semibold text-accent bg-accentLight/15 hover:bg-accentLight/25 rounded transition-colors shrink-0"
          @click="subMode = 'edit'"
        >
          编辑
        </button>
      </div>
    </div>

    <!-- URL bar (Method + URL + 手动调试) — between title and content -->
    <div class="shrink-0">
      <HttpRequest
        v-model="tab"
        send-label="手动调试"
        @send-action="emit('switchToDebug')"
      />
    </div>

    <!-- Scrollable content area -->
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
import IconEdit from "~icons/lucide/edit-3"
import IconEye from "~icons/lucide/eye"
import StatusBadge from "./design/StatusBadge.vue"
import DesignEditView from "./design/EditView.vue"
import DesignPreviewView from "./design/PreviewView.vue"
import HttpRequest from "./Request.vue"

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
  (e: "switchToDebug"): void
  (e: "update:subMode", val: "edit" | "preview"): void
}>()

const request = useVModel(props, "modelValue", emit)
const subMode = ref<"edit" | "preview">(props.initialSubMode)

const apiTitle = computed(() => request.value.apiTitle ?? "")
const apiStatus = computed(() => (request.value.apiStatus ?? "developing") as ApiStatus)

// Persist sub-mode changes
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
  subMode.value = "preview"
}
</script>
