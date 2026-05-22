<template>
  <div class="flex flex-col overflow-auto">
    <!-- Header bar (not sticky) -->
    <div
      class="flex flex-shrink-0 items-center justify-between overflow-x-auto border-b border-dividerLight bg-primary px-4 py-1.5"
    >
      <span class="text-sm font-semibold text-secondaryLight">
        {{ t("response.actual_request") }}
      </span>
      <HoppButtonSecondary
        v-tippy="{ theme: 'tooltip' }"
        :title="t('action.copy')"
        :icon="copyIcon"
        @click="copyRequest"
      />
    </div>

    <div class="flex-1 divide-y divide-dividerLight">
      <!-- Request URL -->
      <div class="p-4">
        <div class="text-sm font-semibold text-secondaryLight mb-2">
          {{ t("request.url") }}:
        </div>
        <div class="pl-3 border-l-2 border-dividerLight">
          <span
            class="inline-block rounded px-2 py-0.5 text-xs font-bold mb-2"
            :class="methodColorClass"
          >
            {{ actualRequest.method }}
          </span>
          <div class="font-mono text-sm break-all text-secondary">
            {{ fullURL }}
          </div>
          <!-- Unresolved template warning -->
          <div
            v-if="hasUnresolvedTemplates"
            class="mt-2 text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1"
          >
            ⚠ {{ warningText }}
          </div>
        </div>
      </div>

      <!-- Header List -->
      <div class="p-4">
        <div class="text-sm font-semibold text-secondaryLight mb-2">
          {{ t("request.header_list") }}:
        </div>

        <!-- No headers at all -->
        <div
          v-if="
            userHeaderEntries.length === 0 && systemHeaderEntries.length === 0
          "
          class="text-secondary italic text-xs"
        >
          {{ t("state.none") }}
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-dividerLight">
                <th
                  class="text-left px-3 py-1.5 font-semibold text-secondaryLight w-2/5"
                >
                  Name
                </th>
                <th
                  class="text-left px-3 py-1.5 font-semibold text-secondaryLight"
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- User-defined headers (expanded) -->
              <tr
                v-for="(entry, index) in userHeaderEntries"
                :key="'uh-' + index"
                class="border-b border-dividerLight"
              >
                <td
                  class="px-3 py-1 font-mono break-all text-secondaryDark text-xs"
                >
                  {{ entry[0] }}
                </td>
                <td
                  class="px-3 py-1 font-mono break-all text-secondary text-xs"
                >
                  {{ entry[1] }}
                </td>
              </tr>

              <!-- System headers (collapsible) -->
              <template v-if="systemHeaderEntries.length > 0">
                <!-- Collapsed: summary row -->
                <tr
                  v-if="!systemHeadersExpanded"
                  class="border-b border-dividerLight cursor-pointer hover:bg-primaryLight"
                  @click="systemHeadersExpanded = true"
                >
                  <td colspan="2" class="px-3 py-1.5 text-xs">
                    <span class="text-secondaryLight flex items-center gap-1">
                      <icon-lucide-chevron-right class="w-3 h-3 inline-block" />
                      System Headers ({{ systemHeaderEntries.length }})
                    </span>
                  </td>
                </tr>

                <!-- Expanded: system header rows -->
                <template v-else>
                  <tr
                    class="border-b border-dividerLight cursor-pointer hover:bg-primaryLight"
                    @click="systemHeadersExpanded = false"
                  >
                    <td colspan="2" class="px-3 py-1.5 text-xs">
                      <span class="text-secondaryLight flex items-center gap-1">
                        <icon-lucide-chevron-down
                          class="w-3 h-3 inline-block"
                        />
                        System Headers ({{ systemHeaderEntries.length }})
                      </span>
                    </td>
                  </tr>
                  <tr
                    v-for="(entry, index) in systemHeaderEntries"
                    :key="'sh-' + index"
                    class="border-b border-dividerLight bg-primaryLight/50"
                  >
                    <td
                      class="px-3 py-1 font-mono break-all text-secondaryLight text-xs"
                    >
                      {{ entry[0] }}
                    </td>
                    <td
                      class="px-3 py-1 font-mono break-all text-secondary text-xs"
                    >
                      {{ entry[1] }}
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Body -->
      <div v-if="hasBody" class="p-4">
        <div class="text-sm font-semibold text-secondaryLight mb-2">
          {{ t("request.body") }}:
          <span
            v-if="actualRequest.bodyMediaType"
            class="text-secondary font-normal text-xs ml-1"
          >
            ({{ actualRequest.bodyMediaType }})
          </span>
        </div>
        <pre
          class="whitespace-pre-wrap break-all font-mono text-xs text-secondary p-3 border border-dividerLight rounded bg-primaryLight overflow-auto max-h-96"
          >{{ bodyDisplay }}</pre
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconCopy from "~icons/lucide/copy"
import IconCheck from "~icons/lucide/check"
import { refAutoReset } from "@vueuse/core"
import { copyToClipboard } from "~/helpers/utils/clipboard"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import { computed, ref } from "vue"
import type { ActualSentRequest } from "~/helpers/types/HoppRESTResponse"

const t = useI18n()
const toast = useToast()

const props = defineProps<{
  actualRequest: ActualSentRequest
}>()

const copyIcon = refAutoReset<typeof IconCopy | typeof IconCheck>(
  IconCopy,
  1000
)

/** Environment variable template: <<variable>> */
const ENV_TEMPLATE_RE = /<<[^>]*>>/g
/** Path parameter template: {variable} */
const PATH_PARAM_RE = /\{[^}]+\}/g

/** Check if a string contains unresolved templates */
const hasTemplate = (s: string): boolean =>
  ENV_TEMPLATE_RE.test(s) || PATH_PARAM_RE.test(s)

const userHeaderEntries = computed(() => {
  return props.actualRequest.headers.user
})

const systemHeaderEntries = computed(() => {
  const entries = [...props.actualRequest.headers.system]
  const hostIdx = entries.findIndex(([k]) => k.toLowerCase() === "host")
  if (hostIdx > 0) {
    const [hostEntry] = entries.splice(hostIdx, 1)
    entries.unshift(hostEntry)
  }
  return entries
})

const systemHeadersExpanded = ref(false)

const hasBody = computed(
  () => props.actualRequest.body !== null && props.actualRequest.body !== ""
)

/** Build full URL with query parameters appended from param tuples */
const fullURL = computed(() => {
  let url = props.actualRequest.url
  const params = props.actualRequest.params
  if (params.length > 0) {
    const qs = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&")
    url += (url.includes("?") ? "&" : "?") + qs
  }
  return url
})

const hasUnresolvedTemplates = computed(() => {
  if (hasTemplate(props.actualRequest.url)) return true
  for (const [k, v] of props.actualRequest.params) {
    if (hasTemplate(k) || hasTemplate(v)) return true
  }
  for (const [k, v] of userHeaderEntries.value) {
    if (hasTemplate(k) || hasTemplate(v)) return true
  }
  for (const [k, v] of systemHeaderEntries.value) {
    if (hasTemplate(k) || hasTemplate(v)) return true
  }
  if (props.actualRequest.body && hasTemplate(props.actualRequest.body))
    return true
  return false
})

const warningText = computed(() => {
  return "Unresolved templates detected: <<variable>> = environment variable, {variable} = path parameter. Configure before sending."
})

const methodColorClass = computed(() => {
  const m = props.actualRequest.method.toUpperCase()
  if (m === "GET") return "bg-green-500/20 text-green-500"
  if (m === "POST") return "bg-yellow-500/20 text-yellow-500"
  if (m === "PUT") return "bg-blue-500/20 text-blue-500"
  if (m === "PATCH") return "bg-orange-500/20 text-orange-500"
  if (m === "DELETE") return "bg-red-500/20 text-red-500"
  return "bg-purple-500/20 text-purple-500"
})

const bodyDisplay = computed(() => {
  if (!props.actualRequest.body) return ""
  if (
    props.actualRequest.bodyMediaType &&
    props.actualRequest.bodyMediaType.includes("json")
  ) {
    try {
      return JSON.stringify(JSON.parse(props.actualRequest.body), null, 2)
    } catch {
      /* return as-is */
    }
  }
  return props.actualRequest.body
})

const copyRequest = () => {
  const lines: string[] = []
  lines.push(`${props.actualRequest.method} ${props.actualRequest.url}`)
  if (props.actualRequest.params.length > 0) {
    const qs = props.actualRequest.params.map(([k, v]) => `${k}=${v}`).join("&")
    lines[0] += `?${qs}`
  }
  const allHeaders = [...userHeaderEntries.value, ...systemHeaderEntries.value]
  if (allHeaders.length > 0) {
    lines.push("")
    for (const [key, value] of allHeaders) {
      lines.push(`${key}: ${value}`)
    }
  }
  if (hasBody.value && props.actualRequest.body) {
    lines.push("")
    lines.push(props.actualRequest.body)
  }
  copyToClipboard(lines.join("\n"))
  copyIcon.value = IconCheck
  toast.success(`${t("state.copied_to_clipboard")}`)
}
</script>
