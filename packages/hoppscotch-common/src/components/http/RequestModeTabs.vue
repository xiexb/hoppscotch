<template>
  <div class="flex items-center border-b border-dividerLight bg-primary">
    <button
      v-for="mode in modes"
      :key="mode.id"
      class="flex items-center gap-1.5 px-4 py-2 text-xs transition-colors"
      :class="
        modelValue === mode.id
          ? 'border-b-2 border-accentLight font-bold text-accent'
          : 'text-secondary hover:text-secondaryDark'
      "
      @click="emit('update:modelValue', mode.id)"
    >
      <component :is="mode.icon" class="svg-icons" />
      {{ mode.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import IconFileText from "~icons/lucide/file-text"
import IconPlay from "~icons/lucide/play"
import IconCheckCircle from "~icons/lucide/check-circle"

export type RequestMode = "debug" | "design" | "testcases"

const props = defineProps<{
  modelValue: RequestMode
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: RequestMode): void
}>()

const t = useI18n()

const modes: { id: RequestMode; label: string; icon: typeof IconFileText }[] = [
  { id: "design", label: t("request_mode.design_tab"), icon: IconFileText },
  { id: "debug", label: t("request_mode.debug"), icon: IconPlay },
  {
    id: "testcases",
    label: t("request_mode.testcases_tab"),
    icon: IconCheckCircle,
  },
]
</script>
