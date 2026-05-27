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
          :title="t('json_example_block.edit')"
          @click="startEditing"
        >
          <IconEdit class="w-3.5 h-3.5" />
        </button>
        <template v-if="editing">
          <button
            class="text-accent hover:text-accentDark transition-colors text-xs px-1.5 py-0.5 rounded"
            @click="saveEdit"
          >
            {{ t("json_example_block.save") }}
          </button>
          <button
            class="text-secondaryLight hover:text-secondary transition-colors text-xs px-1.5 py-0.5 rounded"
            @click="cancelEdit"
          >
            {{ t("json_example_block.cancel") }}
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
      ><!-- v-html is safe here: syntaxHighlight() escapes &, <, > before wrapping tokens in <span> tags --><code v-html="highlightedJson" /></pre>
      <!-- Toolbar: copy + beautify (beautify only in edit mode) -->
      <div class="absolute top-2 right-2 flex items-center gap-1">
        <button
          v-if="editable"
          class="text-secondaryLight hover:text-accent transition-colors p-1 rounded"
          :title="t('json_example_block.beautify')"
          @click="beautifyContent"
        >
          <IconSparkles class="w-3.5 h-3.5" />
        </button>
        <button
          class="text-secondaryLight hover:text-secondary transition-colors p-1 rounded"
          :title="t('json_example_block.copy')"
          @click="copyJson"
        >
          <IconCopy class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import IconEdit from "~icons/lucide/edit-3"
import IconCopy from "~icons/lucide/copy"
import IconSparkles from "~icons/lucide/sparkles"
import { useToast } from "~/composables/toast"
import { useI18n } from "@composables/i18n"

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

function beautifyContent() {
  if (!props.content) return
  const ct = props.contentType || "application/json"

  if (ct === "application/json" || ct === "text/json") {
    try {
      const parsed = JSON.parse(props.content)
      const formatted = JSON.stringify(parsed, null, 2)
      emit("update:content", formatted)
      toast.success(t("json_example_block.beautified") || "Formatted!")
    } catch {
      toast.error(t("json_example_block.invalid_json") || "Invalid JSON, cannot format")
    }
  } else if (ct === "application/xml" || ct === "text/xml") {
    const formatted = beautifyXml(props.content)
    emit("update:content", formatted)
    toast.success(t("json_example_block.beautified") || "Formatted!")
  } else {
    toast.error(t("json_example_block.unsupported_format") || "Format not supported for beautify")
  }
}

/**
 * Basic XML beautifier: adds newlines and indentation.
 */
function beautifyXml(xml: string): string {
  // Normalize whitespace between tags
  let formatted = xml
    .replace(/>\s*</g, ">\n<")
    .replace(/\n\s*\n/g, "\n")
    .trim()

  const lines = formatted.split("\n")
  let indent = 0
  const result: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Decrease indent for closing tags
    if (trimmed.startsWith("</")) {
      indent = Math.max(0, indent - 1)
    }

    result.push("  ".repeat(indent) + trimmed)

    // Increase indent for opening tags (not self-closing, not closing)
    if (
      trimmed.startsWith("<") &&
      !trimmed.startsWith("</") &&
      !trimmed.endsWith("/>") &&
      !trimmed.startsWith("<?")
    ) {
      indent++
    }
  }

  return result.join("\n")
}
</script>
