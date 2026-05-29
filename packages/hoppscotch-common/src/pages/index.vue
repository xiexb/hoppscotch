<template>
  <div>
    <AppPaneLayout layout-id="http">
      <template #primary>
        <HoppSmartWindows
          v-if="currentTabID"
          :id="'rest_windows'"
          v-model="currentTabID"
          @remove-tab="removeTab"
          @add-tab="addNewTab"
          @sort="sortTabs"
        >
          <HoppSmartWindow
            v-for="tab in activeTabs"
            :id="tab.id"
            :key="tab.id"
            :label="getTabName(tab)"
            :is-removable="activeTabs.length > 1"
            :close-visibility="'hover'"
          >
            <template v-if="tab.document.type === 'request'" #tabhead>
              <HttpTabHead
                :tab="tab"
                :is-removable="activeTabs.length > 1"
                @open-rename-modal="openReqRenameModal(tab.id)"
                @close-tab="removeTab(tab.id)"
                @close-other-tabs="closeOtherTabsAction(tab.id)"
                @duplicate-tab="duplicateTab(tab.id)"
                @share-tab-request="shareTabRequest(tab.id)"
              />
            </template>
            <template #suffix>
              <span
                v-if="tab.document.isDirty"
                class="flex w-4 items-center justify-center text-secondary group-hover:hidden"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="1.2em"
                  height="1.2em"
                  class="h-1.5 w-1.5"
                >
                  <circle cx="12" cy="12" r="12" fill="currentColor"></circle>
                </svg>
              </span>
            </template>
            <HttpExampleResponseTab
              v-if="tab.document.type === 'example-response'"
              :model-value="tab"
              @update:model-value="onTabUpdate"
            />
            <!-- Render TabContents -->
            <HttpTestRunner
              v-if="tab.document.type === 'test-runner'"
              :model-value="tab"
              @update:model-value="onTabUpdate"
            />
            <!-- When document.type === 'request' the tab type is HoppTab<HoppRequestDocument>-->
            <HttpRequestTab
              v-if="tab.document.type === 'request'"
              :model-value="tab"
              @update:model-value="onTabUpdate"
            />
            <CollectionsMarkdownDocTab
              v-if="tab.document.type === 'markdown-doc'"
              :model-value="tab"
              @update:model-value="onTabUpdate"
            />
            <!-- END Render TabContents -->
          </HoppSmartWindow>
          <template #actions>
            <div class="flex h-full items-center">
              <tippy
                trigger="click"
                interactive
                theme="popover"
              >
                <button
                  v-tippy="{ theme: 'tooltip', content: t('tab.more_options') }"
                  class="flex h-full items-center justify-center px-2 text-secondary hover:text-secondaryDark focus:outline-none"
                >
                  <component :is="IconMoreHorizontal" class="h-4 w-4" />
                </button>
                <template #content="{ hide }">
                  <div class="flex flex-col focus:outline-none" tabindex="0" @keyup.escape="hide()">
                    <HoppSmartItem
                      :icon="IconXSquare"
                      :label="t('tab.close_all')"
                      @click="() => { closeAllTabs(); hide() }"
                    />
                    <HoppSmartItem
                      :icon="IconXCircle"
                      :label="t('tab.close_others')"
                      @click="() => { closeOtherTabsAction(currentTabID); hide() }"
                    />
                  </div>
                </template>
              </tippy>
              <EnvironmentsSelector class="h-full" />
            </div>
          </template>
        </HoppSmartWindows>
      </template>
      <template #sidebar>
        <HttpSidebar />
      </template>
    </AppPaneLayout>
    <CollectionsEditRequest
      v-model="reqName"
      :request-context="requestToRename"
      :show="showRenamingReqNameModal"
      @submit="renameReqName"
      @hide-modal="showRenamingReqNameModal = false"
    />
    <HoppSmartConfirmModal
      :show="confirmingCloseAllTabs"
      :confirm="t('modal.close_unsaved_tab')"
      :title="t('confirm.close_unsaved_tabs', { count: unsavedTabsCount })"
      @hide-modal="confirmingCloseAllTabs = false"
      @resolve="onResolveConfirmCloseAllTabs"
    />
    <HoppSmartModal
      v-if="showDirtyTabPrompt"
      dialog
      role="dialog"
      aria-modal="true"
      :title="t('modal.close_unsaved_tab')"
      @close="onDirtyTabCancel"
    >
      <template #body>
        <div class="flex flex-col items-center space-y-2 text-center">
          <p class="text-secondaryLight text-sm">
            {{ currentDirtyTabProgress }}
          </p>
          <p>
            {{ t("confirm.save_unsaved_tab_named", { name: currentDirtyTabName }) }}
          </p>
        </div>
      </template>
      <template #footer>
        <span class="flex space-x-2">
          <HoppButtonPrimary
            v-focus
            :label="t('action.save')"
            outline
            @click="onDirtyTabSave"
          />
          <HoppButtonSecondary
            :label="t('action.dont_save')"
            outline
            @click="onDirtyTabDontSave"
          />
          <HoppButtonSecondary
            :label="t('action.cancel')"
            filled
            outline
            @click="onDirtyTabCancel"
          />
        </span>
      </template>
    </HoppSmartModal>
    <HoppSmartModal
      v-if="confirmingCloseForTabID !== null"
      dialog
      role="dialog"
      aria-modal="true"
      :title="t('modal.close_unsaved_tab')"
      @close="confirmingCloseForTabID = null"
    >
      <template #body>
        <div class="text-center">
          {{ t("confirm.save_unsaved_tab") }}
        </div>
      </template>
      <template #footer>
        <span class="flex space-x-2">
          <HoppButtonPrimary
            v-focus
            :label="t?.('action.yes')"
            outline
            @click="onResolveConfirmSaveTab"
          />
          <HoppButtonSecondary
            :label="t?.('action.no')"
            filled
            outline
            @click="onCloseConfirmSaveTab"
          />
        </span>
      </template>
    </HoppSmartModal>
    <CollectionsSaveRequest
      v-if="savingRequest"
      mode="rest"
      :show="savingRequest"
      @hide-modal="onSaveModalClose"
    />
    <AppContextMenu
      v-if="contextMenu.show"
      :show="contextMenu.show"
      :position="contextMenu.position"
      :text="contextMenu.text"
      @hide-modal="contextMenu.show = false"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from "vue"
import { generateUniqueRefId, safelyExtractRESTRequest } from "@hoppscotch/data"
import { translateExtURLParams } from "~/helpers/RESTExtURLParams"
import { useRoute } from "vue-router"
import { useI18n } from "@composables/i18n"
import { getDefaultRESTRequest } from "~/helpers/rest/default"
import { defineActionHandler, invokeAction } from "~/helpers/actions"
import { platform } from "~/platform"
import { useReadonlyStream } from "~/composables/stream"
import { useService } from "dioc/vue"
import { InspectionService } from "~/services/inspection"
import { RequestInspectorService } from "~/services/inspection/inspectors/request.inspector"
import { EnvironmentInspectorService } from "~/services/inspection/inspectors/environment.inspector"
import { ResponseInspectorService } from "~/services/inspection/inspectors/response.inspector"
import { ScriptingInterceptorInspectorService } from "~/services/inspection/inspectors/scripting-interceptor.inspector"
import { cloneDeep } from "lodash-es"
import IconMoreHorizontal from "~icons/lucide/more-horizontal"
import IconXSquare from "~icons/lucide/x-square"
import IconXCircle from "~icons/lucide/x-circle"
import { RESTTabService } from "~/services/tab/rest"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument, HoppTabDocument } from "~/helpers/rest/document"
import { ScrollService } from "~/services/scroll.service"

const scrollService = useService(ScrollService)

const savingRequest = ref(false)
const confirmingCloseForTabID = ref<string | null>(null)
const confirmingCloseAllTabs = ref(false)
const showRenamingReqNameModal = ref(false)
const reqName = ref<string>("")
const unsavedTabsCount = ref(0)
const exceptedTabID = ref<string | null>(null)
const renameTabID = ref<string | null>(null)

// Sequential dirty-tab save prompt state
const dirtyTabsQueue = ref<string[]>([])
const currentDirtyTabIndex = ref(0)
type CloseOperation = "closeAll" | { type: "closeOthers"; exceptTabID: string }
const pendingCloseOperation = ref<CloseOperation | null>(null)

const t = useI18n()

const tabs = useService(RESTTabService)

const currentTabID = tabs.currentTabID

const currentUser = useReadonlyStream(
  platform.auth.getCurrentUserStream(),
  platform.auth.getCurrentUser()
)

type PopupDetails = {
  show: boolean
  position: {
    top: number
    left: number
  }
  text: string | null
}

const contextMenu = ref<PopupDetails>({
  show: false,
  position: {
    top: 0,
    left: 0,
  },
  text: null,
})

const activeTabs = tabs.getActiveTabs()

function bindRequestToURLParams() {
  const route = useRoute()
  // Get URL parameters and set that as the request
  onMounted(() => {
    const query = route.query
    // If query params are empty, or contains code or error param (these are from Oauth Redirect)
    // We skip URL params parsing
    if (Object.keys(query).length === 0 || query.code || query.error) return

    if (tabs.currentActiveTab.value.document.type !== "request") return

    const request = tabs.currentActiveTab.value.document.request

    tabs.currentActiveTab.value.document.request = safelyExtractRESTRequest(
      translateExtURLParams(query, request),
      getDefaultRESTRequest()
    )
  })
}

const onTabUpdate = (tab: HoppTab<HoppRequestDocument>) => {
  tabs.updateTab(tab)
}

const addNewTab = () => {
  const tab = tabs.createNewTab({
    type: "request",
    request: getDefaultRESTRequest(),
    isDirty: false,
  })

  tabs.setActiveTab(tab.id)
}
const sortTabs = (e: { oldIndex: number; newIndex: number }) => {
  tabs.updateTabOrdering(e.oldIndex, e.newIndex)
}

const getTabName = (tab: HoppTab<HoppTabDocument>) => {
  if (tab.document.type === "request") {
    return tab.document.request?.name ?? "Untitled"
  } else if (tab.document.type === "test-runner") {
    return tab.document.collection?.name ?? "Test Runner"
  } else if (tab.document.type === "example-response") {
    return tab.document.response?.name ?? "Example Response"
  } else if (tab.document.type === "markdown-doc") {
    return tab.document.name ?? "Untitled Doc"
  }

  return "Unnamed tab"
}

const inspectionService = useService(InspectionService)

const removeTab = (tabID: string) => {
  const tabState = tabs.getTabRef(tabID).value

  if (tabState.document.isDirty) {
    confirmingCloseForTabID.value = tabID
  } else {
    scrollService.cleanupScrollForTab(tabState.id)
    tabs.closeTab(tabState.id)
    inspectionService.deleteTabInspectorResult(tabState.id)
  }
}

const closeOtherTabsAction = (tabID: string) => {
  const allTabs = tabs.getTabs()
  const dirtyTabsToClose = allTabs.filter(
    (tab) => tab.id !== tabID && tab.document.isDirty
  )

  if (dirtyTabsToClose.length > 0) {
    startSequentialSavePrompt(
      dirtyTabsToClose.map((t) => t.id),
      { type: "closeOthers", exceptTabID: tabID }
    )
  } else {
    scrollService.cleanupAllScroll(tabID)
    tabs.closeOtherTabs(tabID)
  }
}

const closeAllTabs = () => {
  const allTabs = tabs.getTabs()
  const dirtyTabs = allTabs.filter((tab) => tab.document.isDirty)

  if (dirtyTabs.length > 0) {
    startSequentialSavePrompt(
      dirtyTabs.map((t) => t.id),
      "closeAll"
    )
  } else {
    // Create a fresh tab and close all others
    const newTab = tabs.createNewTab({
      type: "request",
      request: getDefaultRESTRequest(),
      isDirty: false,
    })
    scrollService.cleanupAllScroll(newTab.id)
    tabs.closeOtherTabs(newTab.id)
  }
}

// Sequential dirty-tab save prompt
const showDirtyTabPrompt = computed(() => {
  return (
    pendingCloseOperation.value !== null &&
    currentDirtyTabIndex.value < dirtyTabsQueue.value.length &&
    !savingRequest.value // hide prompt modal while save dialog is open
  )
})

const currentDirtyTabName = computed(() => {
  const tabID = dirtyTabsQueue.value[currentDirtyTabIndex.value]
  if (!tabID) return ""
  try {
    const tab = tabs.getTabRef(tabID).value
    if (tab.document.type === "request") {
      return tab.document.request.name || "Untitled"
    }
    return "Untitled"
  } catch {
    return "Untitled"
  }
})

const currentDirtyTabProgress = computed(() => {
  return `${currentDirtyTabIndex.value + 1} / ${dirtyTabsQueue.value.length}`
})

const startSequentialSavePrompt = (
  dirtyTabIDs: string[],
  operation: CloseOperation
) => {
  dirtyTabsQueue.value = dirtyTabIDs
  currentDirtyTabIndex.value = 0
  pendingCloseOperation.value = operation
}

const onDirtyTabSave = () => {
  const tabID = dirtyTabsQueue.value[currentDirtyTabIndex.value]
  if (!tabID) return

  // Switch to this tab so user can see the content before deciding
  tabs.setActiveTab(tabID)

  // Always open the save dialog - let user decide
  savingRequest.value = true
  // onSaveModalClose -> onSaveModalCloseForBatch will advance to next
}

const onDirtyTabDontSave = () => {
  const tabID = dirtyTabsQueue.value[currentDirtyTabIndex.value]
  if (!tabID) return

  // Mark as not dirty so it can be closed without prompt
  try {
    const tab = tabs.getTabRef(tabID).value
    tab.document.isDirty = false
    tabs.updateTab(tab)
  } catch {
    // tab might have been closed already
  }
  advanceToNextDirtyTab()
}

const onDirtyTabCancel = () => {
  // Abort the entire operation
  pendingCloseOperation.value = null
  dirtyTabsQueue.value = []
  currentDirtyTabIndex.value = 0
}

const advanceToNextDirtyTab = () => {
  currentDirtyTabIndex.value++
  if (currentDirtyTabIndex.value >= dirtyTabsQueue.value.length) {
    // All dirty tabs processed, execute the close operation
    executeCloseOperation()
  }
}

const executeCloseOperation = () => {
  const operation = pendingCloseOperation.value
  pendingCloseOperation.value = null
  dirtyTabsQueue.value = []
  currentDirtyTabIndex.value = 0

  if (!operation) return

  if (operation === "closeAll") {
    const newTab = tabs.createNewTab({
      type: "request",
      request: getDefaultRESTRequest(),
      isDirty: false,
    })
    scrollService.cleanupAllScroll(newTab.id)
    tabs.closeOtherTabs(newTab.id)
  } else if (operation.type === "closeOthers") {
    scrollService.cleanupAllScroll(operation.exceptTabID)
    tabs.closeOtherTabs(operation.exceptTabID)
  }
}

// Called when the save dialog closes during batch processing
const onSaveModalCloseForBatch = () => {
  savingRequest.value = false
  if (showDirtyTabPrompt.value) {
    // Mark current tab as not dirty (it was saved or the save was cancelled)
    const tabID = dirtyTabsQueue.value[currentDirtyTabIndex.value]
    if (tabID) {
      try {
        const tab = tabs.getTabRef(tabID).value
        tab.document.isDirty = false
        tabs.updateTab(tab)
      } catch {
        // ignore
      }
    }
    advanceToNextDirtyTab()
  }
}

const duplicateTab = (tabID: string) => {
  const tab = tabs.getTabRef(tabID)
  if (tab.value && tab.value.document.type === "request") {
    const newTab = tabs.createNewTab({
      type: "request",
      request: {
        ...cloneDeep(tab.value.document.request),
        _ref_id: generateUniqueRefId("req"),
      },
      isDirty: true,
    })
    tabs.setActiveTab(newTab.id)
  }
}

const onResolveConfirmCloseAllTabs = () => {
  if (exceptedTabID.value) {
    // Close others mode: keep the excepted tab
    scrollService.cleanupAllScroll(exceptedTabID.value)
    tabs.closeOtherTabs(exceptedTabID.value)
  } else {
    // Close all mode: create a fresh tab and close everything else
    const newTab = tabs.createNewTab({
      type: "request",
      request: getDefaultRESTRequest(),
      isDirty: false,
    })
    scrollService.cleanupAllScroll(newTab.id)
    tabs.closeOtherTabs(newTab.id)
  }
  confirmingCloseAllTabs.value = false
}

const requestToRename = computed(() => {
  if (!renameTabID.value) return null
  const tab = tabs.getTabRef(renameTabID.value)

  return tab.value.document.type === "request"
    ? tab.value.document.request
    : null
})

const openReqRenameModal = (tabID?: string) => {
  if (tabID) {
    const tab = tabs.getTabRef(tabID)

    if (tab.value.document.type !== "request") return

    reqName.value = tab.value.document.request.name
    renameTabID.value = tabID
  } else {
    const { id, document } = tabs.currentActiveTab.value

    if (document.type !== "request") return

    reqName.value = document.request.name
    renameTabID.value = id
  }
  showRenamingReqNameModal.value = true
}

const renameReqName = () => {
  const tab = tabs.getTabRef(renameTabID.value ?? currentTabID.value)
  if (tab.value && tab.value.document.type === "request") {
    tab.value.document.request.name = reqName.value
    tabs.updateTab(tab.value)
  }
  showRenamingReqNameModal.value = false
}

/**
 * This function is closed when the confirm tab is closed by some means (even saving triggers close)
 */
const onCloseConfirmSaveTab = () => {
  if (!savingRequest.value && confirmingCloseForTabID.value) {
    tabs.closeTab(confirmingCloseForTabID.value)
    inspectionService.deleteTabInspectorResult(confirmingCloseForTabID.value)
    confirmingCloseForTabID.value = null
  }
}

/**
 * Called when the user confirms they want to save the tab
 */
const onResolveConfirmSaveTab = () => {
  if (tabs.currentActiveTab.value.document.saveContext) {
    invokeAction("request-response.save")

    if (confirmingCloseForTabID.value) {
      tabs.closeTab(confirmingCloseForTabID.value)
      confirmingCloseForTabID.value = null
    }
  } else {
    savingRequest.value = true
  }
}

/**
 * Called when the Save Request modal is done and is closed
 */
const onSaveModalClose = () => {
  savingRequest.value = false
  if (showDirtyTabPrompt.value) {
    // Batch processing mode - advance to next dirty tab
    onSaveModalCloseForBatch()
  } else if (confirmingCloseForTabID.value) {
    tabs.closeTab(confirmingCloseForTabID.value)
    confirmingCloseForTabID.value = null
  }
}

const shareTabRequest = (tabID: string) => {
  const tab = tabs.getTabRef(tabID)
  if (tab.value && tab.value.document.type === "request") {
    if (currentUser.value) {
      invokeAction("share.request", {
        request: tab.value.document.request,
      })
    } else {
      invokeAction("modals.login.toggle")
    }
  }
}

defineActionHandler("contextmenu.open", ({ position, text }) => {
  if (text) {
    contextMenu.value = {
      show: true,
      position,
      text,
    }
  } else {
    contextMenu.value = {
      show: false,
      position,
      text,
    }
  }
})

bindRequestToURLParams()

defineActionHandler("rest.request.open", ({ doc }) => {
  tabs.createNewTab(doc)
})

defineActionHandler("request.rename", () => {
  if (tabs.currentActiveTab.value.document.type === "request")
    openReqRenameModal(tabs.currentActiveTab.value.id)
})

defineActionHandler("tab.duplicate-tab", ({ tabID }) => {
  duplicateTab(tabID ?? currentTabID.value)
})

defineActionHandler("tab.close-current", () => {
  removeTab(currentTabID.value)
})

defineActionHandler("tab.close-other", () => {
  tabs.closeOtherTabs(currentTabID.value)
})

defineActionHandler("tab.open-new", addNewTab)

defineActionHandler("tab.next", () => {
  tabs.goToNextTab()
})

defineActionHandler("tab.prev", () => {
  tabs.goToPreviousTab()
})

defineActionHandler("tab.switch-to-first", () => {
  tabs.goToFirstTab()
})

defineActionHandler("tab.switch-to-last", () => {
  tabs.goToLastTab()
})

defineActionHandler("tab.reopen-closed", () => {
  tabs.reopenClosedTab()
})

defineActionHandler("tab.mru-switch", () => {
  tabs.goToMRUTab()
})

defineActionHandler("tab.mru-switch-reverse", () => {
  tabs.goToPreviousMRUTab()
})

useService(RequestInspectorService)
useService(EnvironmentInspectorService)
useService(ResponseInspectorService)
useService(ScriptingInterceptorInspectorService)

for (const inspectorDef of platform.additionalInspectors ?? []) {
  useService(inspectorDef.service)
}
</script>
