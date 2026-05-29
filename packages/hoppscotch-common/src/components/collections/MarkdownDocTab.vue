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
import { TeamCollectionsService } from "~/services/team-collection.service"
import { updateTeamCollection } from "~/helpers/backend/mutations/TeamCollection"
import { parseCollectionData, CollectionDataProps } from "~/helpers/backend/helpers"
import { pipe } from "fp-ts/function"
import * as TE from "fp-ts/TaskEither"
import { GQLError } from "~/helpers/backend/GQLClient"
import { useToast } from "~/composables/toast"
import { useI18n } from "~/composables/i18n"

const props = defineProps<{
  modelValue: HoppTab<HoppMarkdownDocDocument>
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppTab<HoppMarkdownDocDocument>): void
}>()

const tab = useVModel(props, "modelValue", emit)
const tabs = useService(RESTTabService)
const teamCollectionService = useService(TeamCollectionsService)
const toast = useToast()
const t = useI18n()

const collections = useReadonlyStream(restCollections$, [])

/**
 * Check if the collectionPath is a team collection ID (non-numeric)
 * vs a my-collection path (numeric indices like "0/1")
 */
function isTeamCollectionPath(path: string): boolean {
  return !path.split("/").every((seg) => !isNaN(parseInt(seg)))
}

/**
 * Find a TeamCollection by ID in the tree
 */
function findTeamCollByID(tree: any[], id: string): any | null {
  for (const coll of tree) {
    if (coll.id === id) return coll
    if (coll.children) {
      const found = findTeamCollByID(coll.children, id)
      if (found) return found
    }
  }
  return null
}

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

  const docIdx = tab.value.document.docIndex

  if (isTeamCollectionPath(pathStr)) {
    // Team collection: update via GraphQL mutation
    const teamColl = findTeamCollByID(
      teamCollectionService.collections.value,
      pathStr
    )
    if (!teamColl) return

    const existingData = parseCollectionData(teamColl.data ?? null)
    const docs = [...(existingData.markdownDocs ?? [])]
    if (docs[docIdx]) {
      docs[docIdx] = {
        ...docs[docIdx],
        name: tab.value.document.name,
        content: tab.value.document.content,
      }
      const updatedData: CollectionDataProps = {
        ...existingData,
        markdownDocs: docs,
      }
      pipe(
        updateTeamCollection(teamColl.id, updatedData),
        TE.match(
          (err: GQLError<string>) => {
            console.error("Failed to save markdown doc:", err)
          },
          () => {}
        )
      )()
    }
    tab.value.document.isDirty = false
    return
  }

  // My collections branch
  const pathIndices = pathStr.split("/").map((x) => parseInt(x))

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

  const docIdx = tab.value.document.docIndex

  if (isTeamCollectionPath(pathStr)) {
    // Team collection: delete via GraphQL mutation
    const teamColl = findTeamCollByID(
      teamCollectionService.collections.value,
      pathStr
    )
    if (!teamColl) {
      tabs.closeTab(tab.value.id)
      return
    }

    const existingData = parseCollectionData(teamColl.data ?? null)
    const docs = [...(existingData.markdownDocs ?? [])]
    docs.splice(docIdx, 1)
    const updatedData: CollectionDataProps = {
      ...existingData,
      markdownDocs: docs,
    }
    pipe(
      updateTeamCollection(teamColl.id, updatedData),
      TE.match(
        (err: GQLError<string>) => {
          console.error("Failed to delete markdown doc:", err)
        },
        () => {}
      )
    )()
    tabs.closeTab(tab.value.id)
    return
  }

  // My collections branch
  const pathIndices = pathStr.split("/").map((x) => parseInt(x))

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
