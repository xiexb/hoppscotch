<template>
  <div>
    <div
      class="flex items-center gap-3 py-1 px-2 rounded hover:bg-primaryLight/50"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
    >
      <!-- Expand indicator for objects/arrays/modelRef -->
      <button
        v-if="hasExpandableChildren"
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

      <!-- Example value -->
      <span
        v-if="node.example"
        class="text-xs text-secondaryDark font-mono bg-primaryLight px-1.5 py-0.5 rounded"
      >
        {{ node.example }}
      </span>

      <!-- Required badge -->
      <span
        v-if="node.required"
        class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500"
      >
        必填
      </span>

      <!-- ModelRef badge -->
      <span
        v-if="node.modelRef"
        class="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 flex items-center gap-0.5 shrink-0"
      >
        <IconLink class="w-2.5 h-2.5" />
        {{ modelRefName }}
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

    <!-- Children (for object/array with direct children) -->
    <div v-if="hasDirectChildren && expanded">
      <SchemaTreeReadonly
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        :depth="depth + 1"
        :model-resolver="modelResolver"
      />
    </div>

    <!-- Resolved modelRef children -->
    <div v-if="hasModelRefChildren && expanded">
      <SchemaTreeReadonly
        v-for="(child, index) in resolvedModelChildren"
        :key="'ref-' + index"
        :node="child"
        :depth="depth + 1"
        :model-resolver="modelResolver"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconLink from "~icons/lucide/link"

/**
 * Optional resolver for modelRef nodes. Given a model ID, returns the model's
 * name and schema tree so the readonly view can expand referenced models inline.
 */
export type ReadonlyModelResolver = (
  modelRefId: string
) => { name: string; schemaTree: HoppRESTSchemaNode[] } | undefined

const props = defineProps<{
  node: HoppRESTSchemaNode
  depth: number
  modelResolver?: ReadonlyModelResolver
}>()

// modelRef nodes default to collapsed to reduce visual noise;
// direct object/array children default to expanded
const expanded = ref(!props.node.modelRef)

const hasDirectChildren = computed(
  () =>
    (props.node.type === "object" || props.node.type === "array") &&
    (props.node.children?.length ?? 0) > 0
)

const resolvedModelChildren = computed<HoppRESTSchemaNode[]>(() => {
  if (!props.node.modelRef || !props.modelResolver) return []
  const resolved = props.modelResolver(props.node.modelRef)
  return resolved?.schemaTree ?? []
})

const hasModelRefChildren = computed(
  () => !!props.node.modelRef && resolvedModelChildren.value.length > 0
)

const hasExpandableChildren = computed(
  () => hasDirectChildren.value || hasModelRefChildren.value
)

const modelRefName = computed(() => {
  if (!props.node.modelRef) return ""
  if (props.modelResolver) {
    const resolved = props.modelResolver(props.node.modelRef)
    if (resolved) return resolved.name
  }
  return props.node.modelRef.substring(0, 8)
})
</script>
