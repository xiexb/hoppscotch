<template>
  <div class="flex flex-1 flex-col">
    <!-- Content Type Selector (horizontal buttons) -->
    <div
      class="sticky top-upperMobileSecondaryStickyFold z-10 flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-dividerLight bg-primary px-4 py-2 sm:top-upperSecondaryStickyFold"
    >
      <label class="truncate font-semibold text-secondaryLight mr-2 flex-shrink-0">
        {{ t("request.content_type") }}
      </label>
      <button
        v-for="ct in contentTypes"
        :key="ct.value"
        class="flex-shrink-0 rounded px-3 py-1 text-xs transition-colors"
        :class="
          selectedType === ct.value
            ? 'bg-accent text-white font-semibold'
            : 'bg-primaryLight text-secondary hover:bg-primaryDark'
        "
        @click="selectContentType(ct.value)"
      >
        {{ ct.label }}
      </button>
    </div>

    <!-- Content Area -->
    <div class="flex-1">
      <!-- none: nothing -->
      <template v-if="selectedType === 'none'">
        <!-- empty -->
      </template>

      <!-- JSON / XML: model picker + SchemaTreeEditor -->
      <RequestBodySection
        v-else-if="selectedType === 'application/json' || selectedType === 'application/xml'"
        :request="request"
        :collection-id="collectionId"
        @update:request="onRequestUpdate"
      />

      <!-- form-data / x-www-form-urlencoded: parameter table -->
      <DesignBodyParams
        v-else-if="
          selectedType === 'multipart/form-data' ||
          selectedType === 'application/x-www-form-urlencoded'
        "
        :params="formParams"
        :is-form-data="selectedType === 'multipart/form-data'"
        @update:params="onFormParamsUpdate"
      />

      <!-- Text: raw text editor -->
      <div v-else-if="selectedType === 'text/plain'" class="p-4">
        <textarea
          :value="rawBodyText"
          class="w-full min-h-[200px] bg-transparent border border-dividerLight rounded p-3 text-sm text-secondaryDark font-mono outline-none focus:border-accent resize-y"
          :placeholder="t('request_body_schema.text_placeholder')"
          @input="onRawTextUpdate(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>

      <!-- Binary: file upload -->
      <div v-else-if="selectedType === 'application/octet-stream'" class="p-4">
        <HttpBodyBinary v-model="bodyRef" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import type { HoppRESTRequest, HoppRESTReqBody } from "@hoppscotch/data"
import { useI18n } from "@composables/i18n"
import RequestBodySection from "./RequestBodySection.vue"
import DesignBodyParams from "./DesignBodyParams.vue"
import HttpBodyBinary from "../BodyBinary.vue"

const t = useI18n()

const props = defineProps<{
  request: HoppRESTRequest
  collectionId?: string
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
}>()

// Content type options
const contentTypes = [
  { value: "none", label: "none" },
  { value: "multipart/form-data", label: "form-data" },
  { value: "application/x-www-form-urlencoded", label: "x-www-form-urlencoded" },
  { value: "application/json", label: "JSON" },
  { value: "application/xml", label: "XML" },
  { value: "text/plain", label: "Text" },
  { value: "application/octet-stream", label: "Binary" },
]

// Derive selected type from request.body.contentType
const selectedType = computed(() => {
  const ct = props.request.body?.contentType
  if (!ct || ct === "null") return "none"
  return ct
})

// Body ref for binary component
const bodyRef = computed({
  get: () => props.request.body,
  set: (val: HoppRESTReqBody) => {
    emit("update:request", {
      ...props.request,
      body: val,
    } as HoppRESTRequest)
  },
})

function selectContentType(value: string) {
  const newBody: HoppRESTReqBody = { ...props.request.body }
  if (value === "none") {
    newBody.contentType = null as any
    // Keep body content for round-trip but set null for none
  } else {
    newBody.contentType = value as any
  }
  emit("update:request", {
    ...props.request,
    body: newBody,
  } as HoppRESTRequest)
}

function onRequestUpdate(updated: HoppRESTRequest) {
  emit("update:request", updated)
}

// --- form-data / x-www params ---

type FormParam = {
  key: string
  type: string
  example: string
  description: string
}

const formParams = computed<FormParam[]>(() => {
  try {
    const raw = props.request.body?.body
    if (typeof raw === "string" && raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // not JSON, return empty
  }
  return []
})

function onFormParamsUpdate(params: FormParam[]) {
  const newBody: HoppRESTReqBody = {
    ...props.request.body,
    body: JSON.stringify(params, null, 2),
  }
  emit("update:request", {
    ...props.request,
    body: newBody,
  } as HoppRESTRequest)
}

// --- Text raw body ---

const rawBodyText = computed(() => {
  if (typeof props.request.body?.body === "string") {
    return props.request.body.body
  }
  return ""
})

function onRawTextUpdate(value: string) {
  const newBody: HoppRESTReqBody = {
    ...props.request.body,
    body: value,
  }
  emit("update:request", {
    ...props.request,
    body: newBody,
  } as HoppRESTRequest)
}
</script>
