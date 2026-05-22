<template>
  <div class="rounded-lg overflow-hidden border border-dividerLight">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1.5 bg-primaryLight border-b border-dividerLight">
      <span class="text-xs text-secondary font-mono">{{ contentType }}</span>
      <button
        v-if="editable"
        class="text-secondaryLight hover:text-secondary transition-colors"
        @click="emit('edit')"
      >
        <IconEdit class="w-3.5 h-3.5" />
      </button>
    </div>
    <!-- Code block -->
    <div class="relative">
      <pre
        class="text-xs font-mono p-3 overflow-x-auto bg-primaryLight text-secondaryDark whitespace-pre leading-relaxed"
      ><code v-html="highlightedJson" /></pre>
      <!-- Copy button -->
      <button
        class="absolute top-2 right-2 text-secondaryLight hover:text-secondary transition-colors p-1 rounded"
        @click="copyJson"
      >
        <IconCopy class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
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
  (e: "edit"): void
}>()

const toast = useToast()
const t = useI18n()

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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
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
