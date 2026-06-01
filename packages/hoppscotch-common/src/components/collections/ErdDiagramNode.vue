<template>
  <div class="flex flex-col">
    <div
      class="h-1 w-full transition"
      :class="[{ 'bg-accentDark': isReorderable }]"
    ></div>
    <div
      class="group flex items-center cursor-pointer"
      @click="openDiagram"
      @contextmenu.prevent="options?.tippy?.show()"
    >
      <div
        class="pointer-events-auto flex min-w-0 flex-1 items-center justify-center"
      >
        <span
          class="pointer-events-none flex w-8 items-center justify-start truncate px-0.5"
        >
          <component
            :is="IconDatabase"
            class="svg-icons text-secondaryLight"
          />
        </span>
        <span
          class="pointer-events-none flex min-w-0 flex-1 items-center py-2 pr-2 transition group-hover:text-secondaryDark"
        >
          <span class="truncate" :class="{ 'text-accent': isActive }">
            {{ diagram.name || t("collection.erd_diagram") }}
          </span>
        </span>
      </div>
      <div class="flex">
        <span>
          <tippy
            ref="options"
            interactive
            trigger="click"
            theme="popover"
            :on-shown="() => tippyActions!.focus()"
          >
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :title="t('action.more')"
              :icon="IconMoreVertical"
            />
            <template #content="{ hide }">
              <div
                ref="tippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.r="renameAction?.$el.click()"
                @keyup.delete="deleteAction?.$el.click()"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  ref="renameAction"
                  :icon="IconEdit"
                  :label="t('action.rename')"
                  :shortcut="['R']"
                  @click="
                    () => {
                      showRenameModal = true
                      hide()
                    }
                  "
                />
                <HoppSmartItem
                  ref="deleteAction"
                  :icon="IconTrash2"
                  :label="t('action.delete')"
                  :shortcut="['⌫']"
                  @click="
                    () => {
                      confirmDelete()
                      hide()
                    }
                  "
                />
              </div>
            </template>
          </tippy>
        </span>
      </div>
    </div>

    <!-- Rename Modal -->
    <HoppSmartModal
      v-if="showRenameModal"
      dialog
      :title="t('collection.rename_erd_diagram')"
      @close="showRenameModal = false"
    >
      <template #body>
        <HoppSmartInput
          v-model="newName"
          :placeholder="t('collection.erd_diagram_name_placeholder')"
          styles="w-full"
          @submit="doRename"
        />
      </template>
      <template #footer>
        <span class="flex space-x-2 justify-end">
          <HoppButtonSecondary
            :label="t('action.cancel')"
            outline
            filled
            @click="showRenameModal = false"
          />
          <HoppButtonPrimary
            :label="t('action.save')"
            outline
            @click="doRename"
          />
        </span>
      </template>
    </HoppSmartModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { TippyComponent } from "vue-tippy"
import { useI18n } from "~/composables/i18n"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import { HoppErdDiagramDocument } from "~/helpers/rest/document"
import IconDatabase from "~icons/lucide/database"
import IconMoreVertical from "~icons/lucide/more-vertical"
import IconEdit from "~icons/lucide/edit"
import IconTrash2 from "~icons/lucide/trash-2"

const t = useI18n()
const tabs = useService(RESTTabService)

const props = defineProps<{
  diagram: {
    id: string
    name: string
    schema: string
  }
  docIndex: number
  collectionPath: string
  isActive?: boolean
}>()

const emit = defineEmits<{
  (e: "delete-diagram", payload: { collectionPath: string; docIndex: number }): void
  (
    e: "rename-diagram",
    payload: { collectionPath: string; docIndex: number; newName: string }
  ): void
}>()

const options = ref<TippyComponent | null>(null)
const tippyActions = ref<HTMLDivElement | null>(null)
const renameAction = ref<HTMLButtonElement | null>(null)
const deleteAction = ref<HTMLButtonElement | null>(null)

const showRenameModal = ref(false)
const newName = ref("")

const isReorderable = computed(() => false)

function openDiagram() {
  // Check if this diagram is already open in a tab
  const existingTabs = tabs.getTabs()
  for (const t of existingTabs) {
    if (
      t.document.type === "erd-diagram" &&
      t.document.docId === props.diagram.id &&
      t.document.collectionPath === props.collectionPath
    ) {
      tabs.setActiveTab(t.id)
      return
    }
  }

  // Open in a new tab
  const doc: HoppErdDiagramDocument = {
    type: "erd-diagram",
    docId: props.diagram.id,
    name: props.diagram.name,
    schema: props.diagram.schema,
    isDirty: false,
    collectionPath: props.collectionPath,
    docIndex: props.docIndex,
  }

  const tab = tabs.createNewTab(doc)
  tabs.setActiveTab(tab.id)
}

function confirmDelete() {
  if (window.confirm(t("collection.delete_erd_diagram_confirm"))) {
    emit("delete-diagram", {
      collectionPath: props.collectionPath,
      docIndex: props.docIndex,
    })
  }
}

function doRename() {
  const name = newName.value.trim()
  if (!name) return
  emit("rename-diagram", {
    collectionPath: props.collectionPath,
    docIndex: props.docIndex,
    newName: name,
  })
  showRenameModal.value = false
  newName.value = ""
}
</script>
