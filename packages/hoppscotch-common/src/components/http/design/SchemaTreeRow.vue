<template>
  <div>
    <div
      class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight hover:bg-primaryLight/50 transition-colors"
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
      <input
        :value="node.name"
        class="text-xs font-mono text-accent bg-transparent outline-none w-28 min-w-[60px]"
        placeholder="字段名"
        @input="onField('name', $event)"
      />

      <!-- Type selector -->
      <select
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
      <input
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
      <button
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
          v-if="canAddChild"
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
          class="text-secondaryLight hover:text-red-400 transition-colors"
          title="删除"
          @click="emit('delete')"
        >
          <IconTrash class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- ModelRef override toolbar: shown when expanded, modelRef set, no override yet -->
    <div
      v-if="hasModelRef && expanded && !isOverrideActive && resolvedModelChildren.length > 0"
      class="flex items-center gap-2 py-1 px-4 border-b border-dividerLight bg-purple-500/5"
      :style="{ paddingLeft: `${(depth + 2) * 16 + 8}px` }"
    >
      <span class="text-[10px] text-secondaryLight">
        展示模型 <strong class="text-purple-500">{{ modelRefName }}</strong> 的 {{ resolvedModelChildren.length }} 个字段（只读预览）
      </span>
      <button
        class="text-[10px] text-accent hover:text-accentDark flex items-center gap-0.5 transition-colors"
        @click="materializeOverride"
      >
        <IconEdit class="w-2.5 h-2.5" />
        编辑覆盖
      </button>
    </div>

    <!-- Resolved modelRef children (read-only preview when no override) -->
    <div
      v-if="hasModelRef && expanded && !isOverrideActive && resolvedModelChildren.length > 0"
      class="border-l-2 border-purple-500/20 ml-4"
    >
      <div
        v-for="(child, index) in resolvedModelChildren"
        :key="'ref-' + index"
        class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight/50 opacity-70"
        :style="{ paddingLeft: `${(depth + 2) * 16 + 8}px` }"
      >
        <span class="w-3" />
        <span class="text-xs font-mono text-accent">{{ child.name }}</span>
        <span class="text-xs text-secondaryLight">{{ child.type }}</span>
        <span
          v-if="child.example"
          class="text-xs text-secondaryDark font-mono bg-primaryLight px-1.5 py-0.5 rounded"
        >
          {{ child.example }}
        </span>
        <span
          v-if="child.required"
          class="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/15 text-orange-500"
        >
          必填
        </span>
        <span
          v-if="child.description"
          class="text-xs text-secondaryLight ml-auto truncate max-w-[200px]"
        >
          {{ child.description }}
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
import IconEdit from "~icons/lucide/pencil"

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
 * Override is active when the node has a modelRef AND has local children
 * that override the model's fields.
 */
const isOverrideActive = computed(
  () => !!props.node.modelRef && (props.node.children?.length ?? 0) > 0
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

/** Whether this node has anything to expand (direct children, modelRef children, or override) */
const hasExpandableContent = computed(
  () =>
    hasDirectChildren.value ||
    (hasModelRef.value && resolvedModelChildren.value.length > 0) ||
    isOverrideActive.value
)

// ─── ModelRef actions ─────────────────────────────────────────────

function clearModelRef() {
  const updated = { ...props.node, modelRef: "" }
  emit("update", updated)
}

/**
 * Materialize the model's schemaTree into this node's children,
 * creating a local editable override.
 */
function materializeOverride() {
  const cloned = deepCloneNodes(resolvedModelChildren.value)
  const updated = { ...props.node, children: cloned }
  emit("update", updated)
  expanded.value = true
}

/**
 * Reset the override: clear local children so the node re-resolves
 * from the referenced model.
 */
function resetOverride() {
  const updated = { ...props.node, children: [] }
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

// ─── Utilities ────────────────────────────────────────────────────

/**
 * Deep clone an array of schema nodes so the override is independent
 * from the model's original data.
 */
function deepCloneNodes(nodes: HoppRESTSchemaNode[]): HoppRESTSchemaNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? deepCloneNodes(node.children) : [],
  }))
}
</script>
