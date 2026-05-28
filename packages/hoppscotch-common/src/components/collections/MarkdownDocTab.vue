<template>
  <div class="flex flex-col h-full">
    <CollectionsMarkdownDoc
      :doc-id="tab.document.docId"
      :doc-name="tab.document.name"
      :doc-content="tab.document.content"
      :collection-path="tab.document.collectionPath"
      :doc-index="tab.document.docIndex"
      @update:doc-name="onNameUpdate"
      @update:doc-content="onContentUpdate"
      @delete="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { useVModel } from "@vueuse/core"
import { HoppTab } from "~/services/tab"
import { HoppMarkdownDocDocument } from "~/helpers/rest/document"
import { useService } from "dioc/vue"
import { RESTTabService } from "~/services/tab/rest"
import {
  restCollections$,
  editRESTCollection,
  editRESTFolder,
} from "~/newstore/collections"
import { navigateToFolderWithIndexPath } from "~/newstore/collections"
import { useReadonlyStream } from "~/composables/stream"

const props = defineProps<{
  modelValue: HoppTab<HoppMarkdownDocDocument>
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppTab<HoppMarkdownDocDocument>): void
}>()

const tab = useVModel(props, "modelValue", emit)
const tabs = useService(RESTTabService)

const collections = useReadonlyStream(restCollections$, [])

function onNameUpdate(name: string) {
  tab.value.document.name = name
  tab.value.document.isDirty = true
  saveToCollection()
}

function onContentUpdate(content: string) {
  tab.value.document.content = content
  tab.value.document.isDirty = true
  saveToCollection()
}

function saveToCollection() {
  const pathStr = tab.value.document.collectionPath
  if (!pathStr && pathStr !== "0") return

  const pathIndices = pathStr.split("/").map((x) => parseInt(x))
  const docIdx = tab.value.document.docIndex

  if (pathIndices.length === 1) {
    // Root collection
    const collIdx = pathIndices[0]
    const coll = collections.value[collIdx]
    if (!coll || !coll.markdownDocs) return
    const docs = [...coll.markdownDocs]
    if (docs[docIdx]) {
      docs[docIdx] = {
        ...docs[docIdx],
        name: tab.value.document.name,
        content: tab.value.document.content,
      }
      editRESTCollection(collIdx, { markdownDocs: docs })
    }
  } else {
    // Nested folder
    const folder = navigateToFolderWithIndexPath(
      collections.value,
      pathIndices
    )
    if (!folder || !folder.markdownDocs) return
    const docs = [...folder.markdownDocs]
    if (docs[docIdx]) {
      docs[docIdx] = {
        ...docs[docIdx],
        name: tab.value.document.name,
        content: tab.value.document.content,
      }
      editRESTFolder(pathStr, { markdownDocs: docs })
    }
  }

  tab.value.document.isDirty = false
}

function onDelete() {
  const pathStr = tab.value.document.collectionPath
  if (!pathStr && pathStr !== "0") return

  const pathIndices = pathStr.split("/").map((x) => parseInt(x))
  const docIdx = tab.value.document.docIndex

  if (pathIndices.length === 1) {
    const collIdx = pathIndices[0]
    const coll = collections.value[collIdx]
    if (!coll || !coll.markdownDocs) return
    const docs = [...coll.markdownDocs]
    docs.splice(docIdx, 1)
    editRESTCollection(collIdx, { markdownDocs: docs })
  } else {
    const folder = navigateToFolderWithIndexPath(
      collections.value,
      pathIndices
    )
    if (!folder || !folder.markdownDocs) return
    const docs = [...folder.markdownDocs]
    docs.splice(docIdx, 1)
    editRESTFolder(pathStr, { markdownDocs: docs })
  }

  tabs.closeTab(tab.value.id)
}
</script>
