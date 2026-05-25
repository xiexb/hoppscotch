<template>
  <div>
    <div
      class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight hover:bg-primaryLight/50 transition-colors"
      :class="{ 'bg-purple-500/5': hasModelRef }"
      :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }"
    >
      <!-- Expand/collapse for object/array/modelRef -->
      <button
        v-if="hasExpandableContent"
        class="text-secondary transition-transform"
        :class="{ 'rotate-90': expanded }"
        @click="expanded = !expanded"
      >
        <IconChevronRight class="w-3 h-3" />
      </button>
      <span v-else class="w-3" />

      <!-- Field name -->
      <span
        v-if="hasModelRef"
        class="text-xs font-mono text-accent w-28 min-w-[60px] truncate"
      >{{ node.name }}</span>
      <input
        v-else
        :value="node.name"
        class="text-xs font-mono text-accent bg-transparent outline-none w-28 min-w-[60px]"
        placeholder="字段名"
        @input="onField('name', $event)"
      />

      <!-- Type selector -->
      <span
        v-if="hasModelRef"
        class="text-xs text-accent w-20"
      >{{ node.type }}</span>
      <select
        v-else
        :value="node.type"
        class="text-xs text-accent bg-transparent outline-none w-20"
        @change="onField('type', $event)"
      >
        <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- Example value -->
      <input
        :value="node.example ?? ''"
        class="text-xs bg-transparent outline-none w-20 min-w-[50px] text-secondaryDark placeholder:text-secondaryLight"
        placeholder="示例值"
        @input="onField('example', $event)"
      />

      <!-- Display name -->
      <span
        v-if="hasModelRef"
        class="text-xs text-secondaryDark w-24 min-w-[50px] truncate"
      >{{ node.displayName || "" }}</span>
      <input
        v-else
        :value="node.displayName"
        class="text-xs bg-transparent outline-none w-24 min-w-[50px] text-secondaryDark placeholder:text-secondaryLight"
        placeholder="中文名"
        @input="onField('displayName', $event)"
      />

      <!-- Description -->
      <input
        :value="node.description"
        class="text-xs bg-transparent outline-none flex-1 min-w-[60px] text-secondaryDark placeholder:text-secondaryLight"
        placeholder="说明"
        @input="onField('description', $event)"
      />

      <!-- ModelRef badge -->
      <span
        v-if="node.modelRef"
        class="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 shrink-0 flex items-center gap-0.5"
        :title="`引用模型: ${modelRefName}`"
      >
        <IconLink class="w-2.5 h-2.5" />
        {{ modelRefName }}
      </span>

      <!-- Override indicator -->
      <span
        v-if="isOverrideActive"
        class="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/15 text-amber-500 shrink-0"
        title="已覆盖模型字段（本地编辑不影响原模型）"
      >
        已覆盖
      </span>

      <!-- Required toggle -->
      <span
        v-if="hasModelRef"
        class="px-1.5 py-0.5 text-[10px] rounded shrink-0"
        :class="node.required ? 'bg-orange-500/15 text-orange-500' : 'bg-secondaryLight/10 text-secondaryLight'"
      >
        {{ node.required ? "必填" : "可选" }}
      </span>
      <button
        v-else
        class="px-1.5 py-0.5 text-[10px] rounded transition-colors shrink-0"
        :class="
          node.required
            ? 'bg-orange-500/15 text-orange-500'
            : 'bg-secondaryLight/10 text-secondaryLight hover:text-secondary'
        "
        :title="node.required ? '必填（点击取消）' : '非必填（点击设为必填）'"
        @click="toggleRequired"
      >
        {{ node.required ? "必填" : "可选" }}
      </button>

      <!-- Actions -->
      <div class="flex items-center gap-1 ml-1 shrink-0">
        <button
          v-if="canAddChild && !hasModelRef"
          class="text-secondaryLight hover:text-accent transition-colors"
          title="添加子字段"
          @click="addChild"
        >
          <IconPlus class="w-3 h-3" />
        </button>
        <!-- Reset override button -->
        <button
          v-if="isOverrideActive"
          class="text-secondaryLight hover:text-amber-500 transition-colors"
          title="恢复模型默认字段（丢弃本地覆盖）"
          @click="resetOverride"
        >
          <IconRefreshCw class="w-3 h-3" />
        </button>
        <!-- Clear modelRef button -->
        <button
          v-if="node.modelRef"
          class="text-secondaryLight hover:text-red-400 transition-colors"
          title="清除模型引用"
          @click="clearModelRef"
        >
          <IconUnlink class="w-3 h-3" />
        </button>
        <button
          v-if="!hasModelRef"
          class="text-secondaryLight hover:text-red-400 transition-colors"
          title="删除"
          @click="emit('delete')"
        >
          <IconTrash class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Editable modelRef children: name/type readonly, example/description editable -->
    <div
      v-if="hasModelRef && expanded && resolvedModelChildren.length > 0"
      class="border-l-2 border-purple-500/20 ml-4"
    >
      <div
        v-for="(child, index) in resolvedModelChildren"
        :key="'ref-' + index"
        class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight/50"
        :style="{ paddingLeft: `${(depth + 2) * 16 + 8}px` }"
      >
        <span class="w-3" />
        <!-- Field name (readonly, from model) -->
        <span class="text-xs font-mono text-accent w-28 min-w-[60px] truncate">{{ child.name }}</span>
        <!-- Type (readonly, from model) -->
        <span class="text-xs text-secondaryLight w-20">{{ child.type }}</span>
        <!-- Example value (editable, writes to modelOverrides) -->
        <input
          :value="getModelOverrideField(child.name, 'example') ?? child.example ?? ''"
          class="text-xs bg-transparent outline-none w-20 min-w-[50px] text-secondaryDark placeholder:text-secondaryLight"
          placeholder="示例值"
          @input="onModelOverrideField(child.name, 'example', $event)"
        />
        <!-- Display name (readonly, from model) -->
        <span class="text-xs text-secondaryDark w-24 min-w-[50px] truncate">{{ child.displayName || '' }}</span>
        <!-- Description (editable, writes to modelOverrides) -->
        <input
          :value="getModelOverrideField(child.name, 'description') ?? child.description ?? ''"
          class="text-xs bg-transparent outline-none flex-1 min-w-[60px] text-secondaryDark placeholder:text-secondaryLight"
          placeholder="说明"
          @input="onModelOverrideField(child.name, 'description', $event)"
        />
        <!-- Required badge (readonly, from model) -->
        <span
          v-if="child.required"
          class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500 shrink-0"
        >
          必填
        </span>
      </div>
    </div>

    <!-- Direct children (for object/array, or modelRef with override active) -->
    <div v-if="hasDirectChildren && expanded">
      <SchemaTreeRow
        v-for="(child, index) in node.children"
        :key="index"
        :node="child"
        :depth="depth + 1"
        @update="(updated) => updateChild(index, updated)"
        @delete="removeChild(index)"
        @add-child="() => addChildToChild(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue"
import type { HoppRESTSchemaNode } from "@hoppscotch/data"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconPlus from "~icons/lucide/plus"
import IconTrash from "~icons/lucide/trash-2"
import IconLink from "~icons/lucide/link"
import IconUnlink from "~icons/lucide/unlink"
import IconRefreshCw from "~icons/lucide/refresh-cw"


/**
 * Rich model resolver type: given a modelRef ID, returns the model's name
 * and schemaTree so the editor can expand referenced models inline.
 */
type RichModelResolver = (
  id: string
) => { name: string; schemaTree: HoppRESTSchemaNode[] } | undefined

const props = defineProps<{
  node: HoppRESTSchemaNode
  depth: number
}>()

const emit = defineEmits<{
  (e: "update", val: HoppRESTSchemaNode): void
  (e: "delete"): void
  (e: "add-child"): void
}>()

const expanded = ref(true)

const typeOptions = [
  "object",
  "string",
  "integer",
  "number",
  "boolean",
  "array",
  "file",
]

// ─── ModelRef support ─────────────────────────────────────────────

// Name-only resolver (for badge display)
const modelNameResolver = inject<((id: string) => string) | null>(
  "schemaModelResolver",
  null
)

// Rich resolver (for expand/collapse with schemaTree)
const richModelResolver = inject<RichModelResolver | null>(
  "schemaRichModelResolver",
  null
)

const hasModelRef = computed(() => !!props.node.modelRef)

const resolvedModelChildren = computed<HoppRESTSchemaNode[]>(() => {
  if (!props.node.modelRef || !richModelResolver) return []
  const resolved = richModelResolver(props.node.modelRef)
  return resolved?.schemaTree ?? []
})

const modelRefName = computed(() => {
  if (!props.node.modelRef) return ""
  if (modelNameResolver) return modelNameResolver(props.node.modelRef)
  if (richModelResolver) {
    const resolved = richModelResolver(props.node.modelRef)
    if (resolved) return resolved.name
  }
  return props.node.modelRef.substring(0, 8)
})

/**
 * Override is active when the node has a modelRef AND has modelOverrides entries.
 */
const isOverrideActive = computed(
  () =>
    !!props.node.modelRef &&
    Object.keys(props.node.modelOverrides ?? {}).length > 0
)

// ─── Expand/collapse logic ────────────────────────────────────────

const hasDirectChildren = computed(
  () =>
    (props.node.type === "object" || props.node.type === "array") &&
    (props.node.children?.length ?? 0) > 0
)

const canAddChild = computed(
  () => props.node.type === "object" || props.node.type === "array"
)

/** Whether this node has anything to expand (direct children or modelRef children) */
const hasExpandableContent = computed(
  () =>
    hasDirectChildren.value ||
    (hasModelRef.value && resolvedModelChildren.value.length > 0)
)

// ─── ModelRef actions ─────────────────────────────────────────────

function clearModelRef() {
  const updated = { ...props.node, modelRef: "", modelOverrides: {} }
  emit("update", updated)
}

/**
 * Reset the override: clear modelOverrides so the node re-resolves
 * from the referenced model's original values.
 */
function resetOverride() {
  const updated = { ...props.node, modelOverrides: {} }
  emit("update", updated)
}

// ─── Field editing ────────────────────────────────────────────────

function onField(field: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  const updated = { ...props.node, [field]: target.value }
  // If type changed to object/array, ensure children array exists
  if (
    field === "type" &&
    (target.value === "object" || target.value === "array")
  ) {
    updated.children = updated.children ?? []
  }
  emit("update", updated)
}

function toggleRequired() {
  const updated = { ...props.node, required: !props.node.required }
  emit("update", updated)
}

function addChild() {
  emit("add-child")
}

function updateChild(index: number, updated: HoppRESTSchemaNode) {
  const children = [...(props.node.children ?? [])]
  children[index] = updated
  emit("update", { ...props.node, children })
}

function removeChild(index: number) {
  const children = [...(props.node.children ?? [])]
  children.splice(index, 1)
  emit("update", { ...props.node, children })
}

function addChildToChild(index: number) {
  const children = [...(props.node.children ?? [])]
  const child = { ...children[index] }
  child.children = [
    ...(child.children ?? []),
    {
      name: "childField",
      type: "string" as const,
      mock: "",
      displayName: "",
      description: "",
      required: true,
      children: [],
      example: "",
      modelRef: "",
    },
  ]
  child.type = child.type === "array" ? "array" : "object"
  children[index] = child
  emit("update", { ...props.node, children })
}

// ─── Model override field editing ───────────────────────────────

/**
 * Get a specific override field value for a model child.
 * Returns undefined if no override exists for that field.
 */
function getModelOverrideField(
  childName: string,
  field: "example" | "description"
): string | undefined {
  return props.node.modelOverrides?.[childName]?.[field]
}

/**
 * Update a specific override field for a model child.
 * Writes directly to the parent node's modelOverrides dict,
 * which generateExampleFromSchema reads for JSON example generation.
 */
function onModelOverrideField(
  childName: string,
  field: "example" | "description",
  event: Event
) {
  const target = event.target as HTMLInputElement
  const value = target.value
  const overrides = { ...(props.node.modelOverrides ?? {}) }
  if (!overrides[childName]) overrides[childName] = {}
  overrides[childName] = { ...overrides[childName], [field]: value }
  emit("update", { ...props.node, modelOverrides: overrides })
}
</script>
