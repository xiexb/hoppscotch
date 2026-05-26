<template>
  <div class="flex flex-col flex-1">
    <!-- Table header -->
    <div
      class="grid grid-cols-[1fr_120px_1fr_1fr_40px] gap-2 items-center px-4 py-2 border-b border-dividerLight bg-primaryLight/30 text-xs font-semibold text-secondaryLight"
    >
      <span>{{ t("request_body_schema.param_name") }}</span>
      <span>{{ t("request_body_schema.param_type") }}</span>
      <span>{{ t("request_body_schema.param_example") }}</span>
      <span>{{ t("request_body_schema.param_description") }}</span>
      <span></span>
    </div>

    <!-- Table rows -->
    <div class="flex flex-col">
      <div
        v-for="(param, index) in localParams"
        :key="index"
        class="grid grid-cols-[1fr_120px_1fr_1fr_40px] gap-2 items-center px-4 py-1.5 border-b border-dividerLight hover:bg-primaryLight/20 transition-colors"
      >
        <!-- Parameter name -->
        <input
          :value="param.key"
          class="bg-transparent border-0 outline-none text-sm text-secondaryDark placeholder:text-secondaryLight px-2 py-1 rounded focus:bg-primaryLight"
          :placeholder="t('request_body_schema.param_name_ph')"
          @input="updateParam(index, 'key', ($event.target as HTMLInputElement).value)"
        />

        <!-- Type dropdown -->
        <select
          :value="param.type"
          class="bg-transparent border border-dividerLight rounded text-sm text-secondaryDark px-2 py-1 outline-none focus:border-accent cursor-pointer"
          @change="updateParam(index, 'type', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <!-- Example value -->
        <input
          :value="param.example"
          class="bg-transparent border-0 outline-none text-sm text-secondaryDark placeholder:text-secondaryLight px-2 py-1 rounded focus:bg-primaryLight"
          :placeholder="t('request_body_schema.param_example_ph')"
          @input="updateParam(index, 'example', ($event.target as HTMLInputElement).value)"
        />

        <!-- Description -->
        <input
          :value="param.description"
          class="bg-transparent border-0 outline-none text-sm text-secondaryDark placeholder:text-secondaryLight px-2 py-1 rounded focus:bg-primaryLight"
          :placeholder="t('request_body_schema.param_desc_ph')"
          @input="updateParam(index, 'description', ($event.target as HTMLInputElement).value)"
        />

        <!-- Delete button -->
        <button
          class="flex items-center justify-center w-8 h-8 rounded text-secondaryLight hover:text-red-400 hover:bg-red-500/10 transition-colors"
          @click="removeParam(index)"
        >
          <IconTrash class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Add row button -->
    <div class="flex items-center px-4 py-2 border-t border-dividerLight">
      <HoppButtonSecondary
        :label="t('request_body_schema.add_param')"
        :icon="IconPlus"
        class="!px-2 !py-1"
        @click="addParam"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@composables/i18n"
import IconTrash from "~icons/lucide/trash-2"
import IconPlus from "~icons/lucide/plus"

export type DesignFormParam = {
  key: string
  type: string
  example: string
  description: string
}

const t = useI18n()

const props = defineProps<{
  params: DesignFormParam[]
  isFormData: boolean
}>()

const emit = defineEmits<{
  (e: "update:params", val: DesignFormParam[]): void
}>()

const localParams = computed(() => props.params)

const typeOptions = computed(() => {
  const base = [
    { value: "string", label: "string" },
    { value: "integer", label: "integer" },
    { value: "number", label: "number" },
    { value: "boolean", label: "boolean" },
  ]
  if (props.isFormData) {
    base.push({ value: "file", label: "file" })
  }
  return base
})

function updateParam(index: number, field: keyof DesignFormParam, value: string) {
  const updated = [...localParams.value]
  updated[index] = { ...updated[index], [field]: value }
  emit("update:params", updated)
}

function addParam() {
  const updated = [
    ...localParams.value,
    { key: "", type: "string", example: "", description: "" } as DesignFormParam,
  ]
  emit("update:params", updated)
}

function removeParam(index: number) {
  const updated = localParams.value.filter((_, i) => i !== index)
  emit("update:params", updated)
}
</script>
