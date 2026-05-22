<template>
  <div class="rounded-lg overflow-hidden border border-dividerLight">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-3 py-1.5 bg-primaryLight border-b border-dividerLight"
    >
      <span class="text-xs text-secondary font-mono">{{ contentType }}</span>
      <div class="flex items-center gap-1">
        <button
          v-if="editable && !editing"
          class="text-secondaryLight hover:text-secondary transition-colors p-0.5 rounded"
          title="编辑"
          @click="startEditing"
        >
          <IconEdit class="w-3.5 h-3.5" />
        </button>
        <template v-if="editing">
          <button
            class="text-accent hover:text-accentDark transition-colors text-xs px-1.5 py-0.5 rounded"
            @click="saveEdit"
          >
            保存
          </button>
          <button
            class="text-secondaryLight hover:text-secondary transition-colors text-xs px-1.5 py-0.5 rounded"
            @click="cancelEdit"
          >
            取消
          </button>
        </template>
      </div>
    </div>
    <!-- Edit mode: textarea -->
    <div v-if="editing" class="relative">
      <textarea
        v-model="editBuffer"
        class="w-full text-xs font-mono bg-primaryLight text-secondaryDark outline-none resize-y min-h-[120px] p-3 border-0"
        spellcheck="false"
        placeholder='{ "key": "value" }'
      />
    </div>
    <!-- Preview mode: syntax-highlighted -->
    <div v-else class="relative">
      <pre
        class="text-xs font-mono p-3 overflow-x-auto bg-primaryLight text-secondaryDark whitespace-pre leading-relaxed max-h-[400px] overflow-y-auto"
      ><code v-html="highlightedJson" /></pre>
      <!-- Copy button -->
      <button
        class="absolute top-2 right-2 text-secondaryLight hover:text-secondary transition-colors p-1 rounded"
        title="复制"
        @click="copyJson"
      >
        <IconCopy class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import IconEdit from "~icons/lucide/edit-3"
import IconCopy from "~icons/lucide/copy"
import { useToast } from "~/composables/toast"
import { useI18n } from "~/composables/i18n"

const props = withDefaults(
  defineProps<{
    content: string
    contentType?: string
    editable?: boolean
  }>(),
  {
    contentType: "application/json",
    editable: false,
  }
)

const emit = defineEmits<{
  (e: "update:content", val: string): void
}>()

const toast = useToast()
const t = useI18n()

const editing = ref(false)
const editBuffer = ref("")

function startEditing() {
  editBuffer.value = props.content || ""
  editing.value = true
}

function saveEdit() {
  emit("update:content", editBuffer.value)
  editing.value = false
}

function cancelEdit() {
  editing.value = false
}

const highlightedJson = computed(() => {
  if (!props.content) return '<span class="text-secondaryLight">// empty</span>'
  try {
    // Parse and re-stringify for consistent formatting
    const parsed = JSON.parse(props.content)
    const formatted = JSON.stringify(parsed, null, 2)
    return syntaxHighlight(formatted)
  } catch {
    // If not valid JSON, show as-is
    return escapeHtml(props.content)
  }
})

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-green-500" // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-secondaryDark font-semibold" // key
          } else {
            cls = "text-orange-400" // string
          }
        } else if (/true|false/.test(match)) {
          cls = "text-purple-400" // boolean
        } else if (/null/.test(match)) {
          cls = "text-secondaryLight" // null
        }
        return `<span class="${cls}">${match}</span>`
      }
    )
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(props.content)
    toast.success(t("state.copied_to_clipboard") || "Copied!")
  } catch {
    // ignore
  }
}
</script>
