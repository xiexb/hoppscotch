<template>
  <div class="flex flex-col overflow-y-auto flex-1 bg-primary">
    <!-- Area 1: Meta Info (description, tags, responsibility, base URL) -->
    <MetaInfoSection
      :request="request"
      @update:request="emit('update:request', $event)"
    />

    <!-- Area 2: Request Parameters — reuse debug mode's RequestOptions (no body tab) -->
    <HttpRequestOptions
      v-model="localRequest"
      v-model:option-tab="optionTab"
      :properties="designProperties"
      :inherited-properties="inheritedProperties"
    />

    <!-- Area 2.5: Request Body Schema (document mode: model binding + SchemaTreeEditor) -->
    <RequestBodySection
      :request="request"
      :collection-id="collectionId"
      @update:request="emit('update:request', $event)"
    />

    <!-- Area 3: Response Section -->
    <ResponseSection
      :request="request"
      :collection-id="collectionId"
      @update:request="emit('update:request', $event)"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { HoppInheritedProperty } from "~/helpers/types/HoppInheritedProperties"
import type { RESTOptionTabs } from "../RequestOptions.vue"
import MetaInfoSection from "./MetaInfoSection.vue"
import ResponseSection from "./ResponseSection.vue"
import RequestBodySection from "./RequestBodySection.vue"
import HttpRequestOptions from "../RequestOptions.vue"

const props = withDefaults(
  defineProps<{
    request: HoppRESTRequest
    inheritedProperties?: HoppInheritedProperty
    collectionId?: string
  }>(),
  {
    inheritedProperties: undefined,
    collectionId: undefined,
  }
)

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
  (e: "save"): void
}>()

// Only show auth/params/headers in design mode (body is handled by RequestBodySection)
const designProperties = ["authorization", "params", "headers"]

const optionTab = ref<RESTOptionTabs>("params")

// Bridge: RequestOptions uses v-model on the request directly,
// so we proxy changes back up to the parent
const localRequest = computed({
  get: () => props.request,
  set: (val: HoppRESTRequest) => emit("update:request", val),
})
</script>
