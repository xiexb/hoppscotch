<template>
  <div class="relative inline-block status-badge-wrapper">
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full select-none"
      :class="[badgeClass, editable ? 'cursor-pointer' : 'cursor-default']"
      @click="toggleDropdown"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="dotClass" />
      {{ label }}
      <IconChevronDown v-if="editable" class="w-3 h-3 opacity-60" />
    </span>

    <!-- Dropdown -->
    <div
      v-if="showDropdown"
      class="absolute z-50 mt-1 py-1 rounded-md border border-divider bg-popover shadow-lg min-w-[140px] left-0"
    >
      <button
        v-for="option in statusOptions"
        :key="option.value"
        class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-primaryLight transition-colors"
        :class="modelValue === option.value ? 'font-bold' : ''"
        @click.stop="selectStatus(option.value)"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="getDotClass(option.value)"
        />
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue"
import IconChevronDown from "~icons/lucide/chevron-down"

export type ApiStatus =
  | "designing"
  | "developing"
  | "testing"
  | "published"
  | "about_to_deprecate"
  | "deprecated"

const props = withDefaults(
  defineProps<{
    modelValue: ApiStatus
    editable?: boolean
  }>(),
  { editable: false }
)

const emit = defineEmits<{
  (e: "update:modelValue", val: ApiStatus): void
}>()

const showDropdown = ref(false)

const statusOptions: { value: ApiStatus; label: string; color: string }[] = [
  { value: "designing", label: "设计中", color: "gray" },
  { value: "developing", label: "调试中", color: "blue" },
  { value: "testing", label: "测试中", color: "yellow" },
  { value: "published", label: "发布", color: "green" },
  { value: "about_to_deprecate", label: "将废弃", color: "orange" },
  { value: "deprecated", label: "已废弃", color: "red" },
]

const currentOption = computed(
  () =>
    statusOptions.find((o) => o.value === props.modelValue) ?? statusOptions[1]
)

const label = computed(() => currentOption.value.label)

const badgeClass = computed(() => {
  switch (currentOption.value.color) {
    case "gray":
      return "bg-secondaryLight/20 text-secondary"
    case "blue":
      return "bg-blue-500/15 text-blue-500"
    case "yellow":
      return "bg-yellow-500/15 text-yellow-600"
    case "green":
      return "bg-green-500/15 text-green-500"
    case "orange":
      return "bg-orange-500/15 text-orange-500"
    case "red":
      return "bg-red-500/15 text-red-500"
    default:
      return "bg-secondaryLight/20 text-secondary"
  }
})

const dotClass = computed(() => getDotClass(props.modelValue))

function getDotClass(status: ApiStatus): string {
  switch (status) {
    case "designing":
      return "bg-secondary"
    case "developing":
      return "bg-blue-500"
    case "testing":
      return "bg-yellow-500"
    case "published":
      return "bg-green-500"
    case "about_to_deprecate":
      return "bg-orange-500"
    case "deprecated":
      return "bg-red-500"
    default:
      return "bg-secondary"
  }
}

function toggleDropdown() {
  if (!props.editable) return
  showDropdown.value = !showDropdown.value
}

function selectStatus(val: ApiStatus) {
  emit("update:modelValue", val)
  showDropdown.value = false
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest(".status-badge-wrapper")) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside)
})
</script>
