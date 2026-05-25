<template>
  <div>
    <div
      class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight hover:bg-primaryLight/50 transition-colors"
      :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }"
    >
      <!-- Expand/collapse for object/array/modelRef -->
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
      <button
        v-if="node.modelRef"
        class="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/15 text-purple-500 shrink-0 flex items-center gap-0.5"
        :title="`引用模型: ${modelRefName}（点击清除）`"
        @click="clearModelRef"
      >
        <IconLink class="w-2.5 h-2.5" />
        {{ modelRefName }}
      </button>

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
        <button
          class="text-secondaryLight hover:text-red-400 transition-colors"
          title="删除"
          @click="emit('delete')"
        >
          <IconTrash class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Direct children (for object/array with their own children) -->
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

    <!-- Resolved modelRef children (editable overrides) -->
    <div v-if="hasModelRefChildren && expanded">
      <div
        v-for="(child, index) in resolvedModelChildren"
        :key="'ref-' + index"
        class="flex items-center gap-1.5 py-1.5 px-2 border-b border-dividerLight transition-colors"
        :class="isOverridden(child.name) ? 'bg-blue-500/5' : 'hover:bg-primaryLight/50'"
        :style="{ paddingLeft: `${(depth + 2) * 16 + 8}px` }"
      >
        <!-- No expand for model children (leaf display) -->
        <span class="w-3" />

        <!-- Field name (read-only from model) -->
        <span class="text-xs font-mono text-accent w-28 min-w-[60px] truncate">
          {{ child.name }}
        </span>

        <!-- Type (read-only from model) -->
        <span class="text-xs text-accent w-20 opacity-60">{{ child.type }}</span>

        <!-- Example value (editable override) -->
        <input
          :value="getOverrideExample(child)"
          class="text-xs bg-transparent outline-none w-20 min-w-[50px] text-secondaryDark placeholder:text-secondaryLight"
          :class="{ 'text-blue-600 font-medium': isOverridden(child.name) }"
          :placeholder="child.example || '示例值'"
          @input="onOverrideField(child.name, 'example', $event)"
        />

        <!-- Display name (read-only from model) -->
        <span class="text-xs text-secondaryDark w-24 min-w-[50px] truncate opacity-60">
          {{ child.displayName || '' }}
        </span>

        <!-- Description (editable override) -->
        <input
          :value="getOverrideDescription(child)"
          class="text-xs bg-transparent outline-none flex-1 min-w-[60px] text-secondaryDark placeholder:text-secondaryLight"
          :class="{ 'text-blue-600 font-medium': isOverridden(child.name) }"
          :placeholder="child.description || '说明'"
          @input="onOverrideField(child.name, 'description', $event)"
        />

        <!-- Override indicator -->
        <span
          v-if="isOverridden(child.name)"
          class="px-1 py-0.5 text-[9px] rounded bg-blue-500/15 text-blue-500 shrink-0"
          title="已覆盖模型默认值"
        >
          覆盖
        </span>

        <!-- Required badge (read-only from model) -->
        <span
          class="px-1.5 py-0.5 text-[10px] rounded shrink-0"
          :class="child.required ? 'bg-orange-500/15 text-orange-500' : 'bg-secondaryLight/10 text-secondaryLight'"
        >
          {{ child.required ? '必填' : '可选' }}
        </span>

        <!-- Clear override button -->
        <button
          v-if="isOverridden(child.name)"
          class="text-secondaryLight hover:text-blue-500 transition-colors shrink-0"
          title="清除覆盖"
          @click="clearOverride(child.name)"
        >
          <IconX class="w-3 h-3" />
        </button>
        <span v-else class="w-3 shrink-0" />
      </div>
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
import IconX from "~icons/lucide/x"

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

// ─── Model resolver (name only, for badge display) ─────────────────
const modelResolver = inject<((id: string) => string) | null>(
  "schemaModelResolver",
  null
)

// ─── Rich model resolver (name + schemaTree, for expand/collapse) ───
const richModelResolver = inject<
  ((id: string) => { name: string; schemaTree: HoppRESTSchemaNode[] } | undefined) | null
>("schemaRichModelResolver", null)

// ─── Computed: resolved model children ─────────────────────────────
const resolvedModelChildren = computed<HoppRESTSchemaNode[]>(() => {
  if (!props.node.modelRef || !richModelResolver) return []
  const resolved = richModelResolver(props.node.modelRef)
  return resolved?.schemaTree ?? []
})

const hasDirectChildren = computed(
  () =>
    (props.node.type === "object" || props.node.type === "array") &&
    (props.node.children?.length ?? 0) > 0
)

const hasModelRefChildren = computed(
  () => !!props.node.modelRef && resolvedModelChildren.value.length > 0
)

const hasChildren = computed(
  () => hasDirectChildren.value || hasModelRefChildren.value
)

const canAddChild = computed(
  () => props.node.type === "object" || props.node.type === "array"
)

const modelRefName = computed(() => {
  if (!props.node.modelRef) return ""
  if (modelResolver) return modelResolver(props.node.modelRef)
  if (richModelResolver) {
    const resolved = richModelResolver(props.node.modelRef)
    if (resolved) return resolved.name
  }
  return props.node.modelRef.substring(0, 8)
})

function clearModelRef() {
  const updated = { ...props.node, modelRef: "", modelOverrides: {} }
  emit("update", updated)
}

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
      modelOverrides: {},
    },
  ]
  child.type = child.type === "array" ? "array" : "object"
  children[index] = child
  emit("update", { ...props.node, children })
}

// ─── Override editing for modelRef children ────────────────────────

/**
 * Get the effective example value for a modelRef child:
 * override value if set, otherwise the model's default.
 */
function getOverrideExample(child: HoppRESTSchemaNode): string {
  const overrides = props.node.modelOverrides ?? {}
  const override = overrides[child.name]
  if (override?.example !== undefined && override.example !== "") {
    return override.example
  }
  return child.example ?? ""
}

/**
 * Get the effective description value for a modelRef child:
 * override value if set, otherwise the model's default.
 */
function getOverrideDescription(child: HoppRESTSchemaNode): string {
  const overrides = props.node.modelOverrides ?? {}
  const override = overrides[child.name]
  if (override?.description !== undefined && override.description !== "") {
    return override.description
  }
  return child.description ?? ""
}

/**
 * Check if a modelRef child has any override values.
 */
function isOverridden(childName: string): boolean {
  const overrides = props.node.modelOverrides ?? {}
  const override = overrides[childName]
  if (!override) return false
  return !!(override.example || override.description)
}

/**
 * Handle editing an override field on a modelRef child.
 * Updates the parent node's modelOverrides record.
 */
function onOverrideField(childName: string, field: "example" | "description", event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value

  const overrides = { ...(props.node.modelOverrides ?? {}) }
  overrides[childName] = {
    ...(overrides[childName] ?? {}),
    [field]: value,
  }

  // Clean up empty overrides
  if (!overrides[childName].example && !overrides[childName].description) {
    delete overrides[childName]
  }

  emit("update", { ...props.node, modelOverrides: overrides })
}

/**
 * Clear all overrides for a specific modelRef child.
 */
function clearOverride(childName: string) {
  const overrides = { ...(props.node.modelOverrides ?? {}) }
  delete overrides[childName]
  emit("update", { ...props.node, modelOverrides: overrides })
}
</script>
