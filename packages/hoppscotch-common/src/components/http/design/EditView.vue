<template>
  <div class="flex flex-col overflow-y-auto flex-1 bg-primary">
    <!-- Area 2: Meta Info (title, status, description, tags, responsibility) -->
    <MetaInfoSection
      :request="request"
      @update:request="emit('update:request', $event)"
    />

    <!-- Area 3: Request Parameters (tab-based, matches debug mode style) -->
    <RequestParamsSection
      :request="request"
      @update:request="emit('update:request', $event)"
    />

    <!-- Area 4: Response Section (status code tabs + schema tree + example) -->
    <ResponseSection
      :request="request"
      @update:request="emit('update:request', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { HoppRESTRequest } from "@hoppscotch/data"
import MetaInfoSection from "./MetaInfoSection.vue"
import RequestParamsSection from "./RequestParamsSection.vue"
import ResponseSection from "./ResponseSection.vue"

defineProps<{
  request: HoppRESTRequest
}>()

const emit = defineEmits<{
  (e: "update:request", val: HoppRESTRequest): void
  (e: "save"): void
}>()
</script>
