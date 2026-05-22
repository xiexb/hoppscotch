<template>
  <div class="flex flex-col h-full overflow-hidden bg-primary">
    <!-- Sub-mode toggle: Edit / Preview -->
    <div class="flex items-center border-b border-dividerLight px-4 bg-primary shrink-0">
      <button
        class="flex items-center gap-1.5 px-4 py-2 text-xs transition-colors"
        :class="
          subMode === 'edit'
            ? 'border-b-2 border-accent font-bold text-accent'
            : 'text-secondary hover:text-secondaryDark'
        "
        @click="subMode = 'edit'"
      >
        <IconEdit class="svg-icons w-3.5 h-3.5" />
        编辑
      </button>
      <button
        class="flex items-center gap-1.5 px-4 py-2 text-xs transition-colors"
        :class="
          subMode === 'preview'
            ? 'border-b-2 border-accent font-bold text-accent'
            : 'text-secondary hover:text-secondaryDark'
        "
        @click="subMode = 'preview'"
      >
        <IconEye class="svg-icons w-3.5 h-3.5" />
        预览
      </button>

      <!-- Save button (only in edit mode) -->
      <div v-if="subMode === 'edit'" class="ml-auto flex items-center gap-2">
        <button
          class="px-4 py-1.5 text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 rounded-md transition-colors"
          @click="onSave"
        >
          保存
        </button>
      </div>
    </div>

    <!-- Edit View -->
    <DesignEditView
      v-if="subMode === 'edit'"
      :request="request"
      :inherited-properties="inheritedProperties"
      @update:request="onRequestUpdate"
      @save="onSave"
      @debug="emit('switchToDebug')"
    />

    <!-- Preview View -->
    <DesignPreviewView
      v-if="subMode === 'preview'"
      :request="request"
      @debug="emit('switchToDebug')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useVModel } from "@vueuse/core"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import IconEdit from "~icons/lucide/edit-3"
import IconEye from "~icons/lucide/eye"
import DesignEditView from "./design/EditView.vue"
import DesignPreviewView from "./design/PreviewView.vue"

const props = withDefaults(
  defineProps<{
    modelValue: HoppRESTRequest
    inheritedProperties?: HoppInheritedProperty
  }>(),
  {
    inheritedProperties: undefined,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTRequest): void
  (e: "switchToDebug"): void
}>()

const request = useVModel(props, "modelValue", emit)
const subMode = ref<"edit" | "preview">("edit")

function onRequestUpdate(updated: HoppRESTRequest) {
  request.value = updated
}

function onSave() {
  subMode.value = "preview"
}
</script>
