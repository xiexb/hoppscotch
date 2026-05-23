<template>
  <table
    class="w-full border-collapse text-sm border border-dividerLight rounded"
  >
    <thead class="bg-divider/20">
      <tr>
        <th
          class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs w-1/3"
        >
          {{ t("documentation.key") }}
        </th>
        <th
          class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs w-1/3"
        >
          {{
            hasDescriptionColumn
              ? t("documentation.value")
              : t("documentation.value")
          }}
        </th>
        <th
          v-if="hasDescriptionColumn"
          class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs"
        >
          说明
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(header, headerIndex) in headers"
        :key="headerIndex"
        class="border-t border-divider"
      >
        <td class="py-2 px-3 text-xs font-mono text-accent">
          {{ header.key }}
        </td>
        <td class="py-2 px-3 text-secondaryLight text-xs">
          {{ header.value || header.description || "-" }}
        </td>
        <td
          v-if="hasDescriptionColumn"
          class="py-2 px-3 text-secondaryLight text-xs"
        >
          {{ header.description && header.value ? header.description : "" }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts" setup>
import { computed } from "vue"
import { useI18n } from "~/composables/i18n"

interface ResponseHeader {
  key: string
  value?: string
  description?: string
}

const t = useI18n()

const props = defineProps<{
  headers: ResponseHeader[]
}>()

/**
 * Show a separate description column when headers have both value and description.
 * Design-mode headers (from responseModels) have { key, description } only —
 * the description IS the display content, no separate description column needed.
 * Legacy headers (from responses) have { key, value } — same.
 * Only when BOTH value and description exist (future use) do we show the extra column.
 */
const hasDescriptionColumn = computed(() => {
  return props.headers.some(
    (h) => h.value && h.description && h.value !== h.description
  )
})
</script>
