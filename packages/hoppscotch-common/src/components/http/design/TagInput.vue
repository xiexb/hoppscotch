<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="(tag, index) in modelValue"
      :key="index"
      class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-accentLight/15 text-accent"
    >
      {{ tag }}
      <button
        class="hover:text-red-400 transition-colors"
        @click="removeTag(index)"
      >
        <IconX class="w-3 h-3" />
      </button>
    </span>
    <input
      v-model="inputValue"
      class="text-xs bg-transparent outline-none min-w-[80px] flex-1 py-0.5 text-secondaryDark placeholder:text-secondaryLight"
      :placeholder="modelValue.length === 0 ? placeholder : ''"
      @keydown.enter.prevent="addTag"
      @keydown.tab.prevent="addTag"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import IconX from "~icons/lucide/x"

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder?: string
  }>(),
  { placeholder: "输入标签后回车添加" }
)

const emit = defineEmits<{
  (e: "update:modelValue", val: string[]): void
}>()

const inputValue = ref("")

function addTag() {
  const val = inputValue.value.trim()
  if (!val) return
  if (props.modelValue.includes(val)) {
    inputValue.value = ""
    return
  }
  emit("update:modelValue", [...props.modelValue, val])
  inputValue.value = ""
}

function removeTag(index: number) {
  const newTags = [...props.modelValue]
  newTags.splice(index, 1)
  emit("update:modelValue", newTags)
}
</script>
