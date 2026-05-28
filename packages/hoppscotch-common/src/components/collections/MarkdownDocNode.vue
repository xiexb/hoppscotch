<template>
  <div class="flex flex-col">
    <div
      class="h-1 w-full transition"
      :class="[{ 'bg-accentDark': isReorderable }]"
    ></div>
    <div
      class="group flex items-center cursor-pointer"
      @click="openDoc"
      @contextmenu.prevent="options?.tippy?.show()"
    >
      <div
        class="pointer-events-auto flex min-w-0 flex-1 items-center justify-center"
      >
        <span
          class="pointer-events-none flex w-8 items-center justify-start truncate px-0.5"
        >
          <component
            :is="IconFileText"
            class="svg-icons text-secondaryLight"
          />
        </span>
        <span
          class="pointer-events-none flex min-w-0 flex-1 items-center py-2 pr-2 transition group-hover:text-secondaryDark"
        >
          <span class="truncate" :class="{ 'text-accent': isActive }">
            {{ doc.name || t("collection.markdown_doc") }}
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
      :title="t('collection.rename_doc')"
      @close="showRenameModal = false"
    >
      <template #body>
        <HoppSmartInput
          v-model="newName"
          :placeholder="t('collection.doc_name_placeholder')"
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
import { HoppMarkdownDocDocument } from "~/helpers/rest/document"
import IconFileText from "~icons/lucide/file-text"
import IconMoreVertical from "~icons/lucide/more-vertical"
import IconEdit from "~icons/lucide/edit"
import IconTrash2 from "~icons/lucide/trash-2"

const t = useI18n()
const tabs = useService(RESTTabService)

const props = defineProps<{
  doc: {
    id: string
    name: string
    content: string
  }
  docIndex: number
  collectionPath: string
  isActive?: boolean
}>()

const emit = defineEmits<{
  (e: "delete-doc", payload: { collectionPath: string; docIndex: number }): void
  (
    e: "rename-doc",
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

function openDoc() {
  // Check if this doc is already open in a tab
  const existingTabs = tabs.getTabs()
  for (const t of existingTabs) {
    if (
      t.document.type === "markdown-doc" &&
      t.document.docId === props.doc.id &&
      t.document.collectionPath === props.collectionPath
    ) {
      tabs.setActiveTab(t.id)
      return
    }
  }

  // Open in a new tab
  const doc: HoppMarkdownDocDocument = {
    type: "markdown-doc",
    docId: props.doc.id,
    name: props.doc.name,
    content: props.doc.content,
    isDirty: false,
    collectionPath: props.collectionPath,
    docIndex: props.docIndex,
  }

  const tab = tabs.createNewTab(doc)
  tabs.setActiveTab(tab.id)
}

function confirmDelete() {
  if (window.confirm(t("collection.delete_doc_confirm"))) {
    emit("delete-doc", {
      collectionPath: props.collectionPath,
      docIndex: props.docIndex,
    })
  }
}

function doRename() {
  const name = newName.value.trim()
  if (!name) return
  emit("rename-doc", {
    collectionPath: props.collectionPath,
    docIndex: props.docIndex,
    newName: name,
  })
  showRenameModal.value = false
  newName.value = ""
}
</script>
