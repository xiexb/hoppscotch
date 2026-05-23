<template>
  <div>
    <div
      class="flex items-center gap-3 py-1 px-2 rounded hover:bg-primaryLight/50"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
    >
      <!-- Expand indicator for objects/arrays -->
      <button
        v-if="hasChildren"
        class="text-secondary transition-transform"
        :class="{ 'rotate-90': expanded }"
        @click="expanded = !expanded"
      >
        <IconChevronRight class="w-3 h-3" />
      </button>
      <span v-else class="w-3" />

      <!-- Field name -->
      <span class="text-xs font-mono text-accent">{{ node.name }}</span>

      <!-- Type -->
      <span class="text-xs text-secondaryLight">{{ node.type }}</span>

      <!-- Required badge -->
      <span
        v-if="node.required"
        class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500"
      >
        必填
      </span>

      <!-- Display name -->
      <span v-if="node.displayName" class="text-xs text-secondary ml-2">
        {{ node.displayName }}
      </span>

      <!-- Description -->
      <span
        v-if="node.description"
        class="text-xs text-secondaryLight ml-auto truncate max-w-[200px]"
      >
        {{ node.description }}
      </span>
    </div>

    <!-- Children -->
    <div v-if="hasChildren && expanded">
      <SchemaTreeReadonly
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import IconChevronRight from "~icons/lucide/chevron-right"

const props = defineProps<{
  node: HoppRESTSchemaNode
  depth: number
}>()

const expanded = ref(true)

const hasChildren = computed(
  () =>
    (props.node.type === "object" || props.node.type === "array") &&
    (props.node.children?.length ?? 0) > 0
)
</script>
