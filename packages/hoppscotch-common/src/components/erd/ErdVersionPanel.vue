<template>
  <div class="flex flex-col h-full bg-primary text-secondary">
    <!-- Save Version Form -->
    <div class="flex flex-col gap-2 p-3 border-b border-dividerLight">
      <input
        v-model="commitMessage"
        type="text"
        :placeholder="t('erd.version.commit_msg_placeholder')"
        class="input flex-1 bg-primaryLight border border-dividerLight rounded px-3 py-1.5 text-sm text-secondaryDark outline-none focus:border-accent"
      />
      <HoppButtonPrimary
        :label="t('erd.version.save')"
        :loading="saving"
        :disabled="saving"
        class="w-full"
        @click="handleSave"
      />
    </div>

    <!-- Version History List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center p-6">
        <span class="text-secondaryLight text-sm">{{ t("loading") }}</span>
      </div>
      <div v-else-if="versions.length === 0" class="flex items-center justify-center p-6">
        <span class="text-secondaryLight text-sm">{{ t("erd.version.no_versions") }}</span>
      </div>
      <div v-else class="flex flex-col">
        <div
          v-for="entry in versions"
          :key="entry.hash"
          class="flex flex-col gap-1 p-3 border-b border-dividerLight hover:bg-primaryLight cursor-pointer transition-colors"
          :class="{ 'bg-primaryLight': selectedRefs.includes(entry.shortHash) }"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="font-mono text-xs text-accent shrink-0">{{ entry.shortHash }}</span>
              <span class="text-sm text-secondaryDark truncate">{{ entry.message }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-2">
              <button
                class="p-1 rounded hover:bg-primaryDark text-secondaryLight hover:text-secondaryDark transition-colors"
                :title="t('erd.version.restore')"
                @click.stop="handleRestore(entry)"
              >
                <IconRotateCcw class="h-3.5 w-3.5" />
              </button>
              <button
                class="p-1 rounded transition-colors"
                :class="selectedRefs.includes(entry.shortHash) ? 'bg-accent/20 text-accent' : 'hover:bg-primaryDark text-secondaryLight hover:text-secondaryDark'"
                :title="t('erd.version.compare')"
                @click.stop="toggleCompareSelection(entry)"
              >
                <IconGitCompare class="h-3.5 w-3.5" />
              </button>
              <button
                class="p-1 rounded hover:bg-red-500/20 text-secondaryLight hover:text-red-400 transition-colors"
                :title="t('erd.version.delete')"
                @click.stop="handleDelete(entry)"
              >
                <IconTrash class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-3 text-xs text-secondaryLight">
            <span>{{ formatDate(entry.date) }}</span>
            <span v-if="entry.stats">
              {{ entry.stats.filesChanged }} files,
              <span class="text-green-500">+{{ entry.stats.insertions }}</span>
              <span class="text-red-400">-{{ entry.stats.deletions }}</span>
            </span>
            <span v-if="entry.tags.length > 0" class="text-accent">
              {{ entry.tags.join(", ") }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Compare Bar (shown when 2 versions selected) -->
    <div
      v-if="selectedRefs.length === 2"
      class="flex items-center justify-between p-3 border-t border-divider bg-primaryLight"
    >
      <span class="text-sm text-secondaryDark">
        {{ selectedRefs[0] }} ↔ {{ selectedRefs[1] }}
      </span>
      <HoppButtonSecondary
        :label="t('erd.version.compare_btn')"
        :icon="IconGitCompare"
        class="!px-3 !py-1"
        @click="handleCompare"
      />
    </div>

    <!-- Remote Configuration (collapsible) -->
    <div class="border-t border-dividerLight">
      <button
        class="flex items-center w-full p-3 text-sm text-secondaryDark hover:bg-primaryLight transition-colors"
        @click="remoteExpanded = !remoteExpanded"
      >
        <component
          :is="remoteExpanded ? IconChevronDown : IconChevronRight"
          class="h-4 w-4 mr-2 shrink-0"
        />
        <IconCloud class="h-4 w-4 mr-2 shrink-0" />
        <span>{{ t("erd.version.remote") }}</span>
        <span
          v-if="remoteStatus.configured"
          class="ml-auto text-xs text-green-500"
        >
          ✓
        </span>
      </button>
      <div v-if="remoteExpanded" class="flex flex-col gap-2 px-3 pb-3">
        <input
          v-model="remoteUrl"
          type="text"
          :placeholder="'git@github.com:org/repo.git'"
          class="input flex-1 bg-primaryLight border border-dividerLight rounded px-3 py-1.5 text-sm text-secondaryDark outline-none focus:border-accent"
        />
        <div class="flex items-center gap-2">
          <select
            v-model="remoteName"
            class="bg-primaryLight border border-dividerLight rounded px-2 py-1.5 text-sm text-secondaryDark outline-none"
          >
            <option value="origin">origin</option>
          </select>
          <HoppButtonSecondary
            :label="t('erd.version.save_remote')"
            :loading="savingRemote"
            :disabled="savingRemote || !remoteUrl"
            class="!px-3 !py-1 flex-1"
            @click="handleSaveRemote"
          />
        </div>
        <div v-if="remoteStatus.configured" class="flex items-center gap-2">
          <HoppButtonPrimary
            :label="t('erd.version.push')"
            :loading="pushing"
            :disabled="pushing"
            class="flex-1"
            @click="handlePush"
          />
          <span
            v-if="remoteStatus.aheadOfRemote > 0"
            class="text-xs text-orange-400"
          >
            ↑{{ remoteStatus.aheadOfRemote }}
          </span>
        </div>
        <div v-if="remoteStatus.lastPushError" class="text-xs text-red-400">
          {{ remoteStatus.lastPushError }}
        </div>
        <div v-if="remoteStatus.lastPushAt" class="text-xs text-secondaryLight">
          {{ t("erd.version.last_push") }}: {{ formatDate(remoteStatus.lastPushAt) }}
        </div>
      </div>
    </div>

    <!-- Export Button -->
    <div class="border-t border-dividerLight p-3">
      <HoppButtonSecondary
        :label="t('erd.version.export')"
        :icon="IconDownload"
        :loading="exporting"
        :disabled="exporting"
        class="w-full"
        @click="handleExport"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"
import IconRotateCcw from "~icons/lucide/rotate-ccw"
import IconGitCompare from "~icons/lucide/git-compare"
import IconTrash from "~icons/lucide/trash"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconCloud from "~icons/lucide/cloud"
import IconDownload from "~icons/lucide/download"
import {
  type VersionLogEntry,
  type RemoteConfig,
  commitVersion,
  getVersionLog,
  restoreVersion,
  deleteVersion,
  getRemote,
  setRemote,
  pushToRemote,
  exportArchive,
} from "~/helpers/erdVersionApi"

// ─── Props & Emits ───────────────────────────────────────────────

const props = defineProps<{
  teamId: string
  collectionId: string
  currentErdJson: string
}>()

const emit = defineEmits<{
  (e: "restore", erdJson: string): void
  (e: "compare", from: string, to: string): void
  (e: "saved"): void
}>()

// ─── Composables ─────────────────────────────────────────────────

const t = useI18n()
const toast = useToast()

// ─── State ───────────────────────────────────────────────────────

const versions = ref<VersionLogEntry[]>([])
const loading = ref(false)
const saving = ref(false)
const commitMessage = ref("")
const selectedRefs = ref<string[]>([])

const remoteExpanded = ref(false)
const remoteUrl = ref("")
const remoteName = ref("origin")
const remoteStatus = ref<RemoteConfig>({
  remoteUrl: null,
  configured: false,
  lastPushAt: null,
  lastPushError: null,
  aheadOfRemote: 0,
})
const savingRemote = ref(false)
const pushing = ref(false)
const exporting = ref(false)

// ─── Methods ─────────────────────────────────────────────────────

async function fetchVersions() {
  loading.value = true
  try {
    versions.value = await getVersionLog(props.teamId, props.collectionId)
  } catch (err: any) {
    // 404 or repo not found is normal for new collections
    if (err?.response?.status !== 404 && err?.response?.status !== 400) {
      toast.error(t("erd.version.load_error"))
    }
    versions.value = []
  } finally {
    loading.value = false
  }
}

async function fetchRemoteStatus() {
  try {
    remoteStatus.value = await getRemote(props.teamId, props.collectionId)
    if (remoteStatus.value.remoteUrl) {
      remoteUrl.value = remoteStatus.value.remoteUrl
    }
  } catch {
    // Remote may not be configured, that's fine
  }
}

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    await commitVersion(
      props.teamId,
      props.collectionId,
      props.currentErdJson,
      commitMessage.value || undefined,
    )
    commitMessage.value = ""
    toast.success(t("erd.version.save_success"))
    emit("saved")
    await fetchVersions()
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t("erd.version.save_error"))
  } finally {
    saving.value = false
  }
}

async function handleRestore(entry: VersionLogEntry) {
  try {
    const result = await restoreVersion(
      props.teamId,
      props.collectionId,
      entry.shortHash,
    )
    emit("restore", result.erdJson)
    toast.success(t("erd.version.restore_success"))
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t("erd.version.restore_error"))
  }
}

function toggleCompareSelection(entry: VersionLogEntry) {
  const idx = selectedRefs.value.indexOf(entry.shortHash)
  if (idx >= 0) {
    selectedRefs.value.splice(idx, 1)
  } else if (selectedRefs.value.length < 2) {
    selectedRefs.value.push(entry.shortHash)
  } else {
    // Replace the first selection
    selectedRefs.value[0] = selectedRefs.value[1]
    selectedRefs.value[1] = entry.shortHash
  }
}

function handleCompare() {
  if (selectedRefs.value.length === 2) {
    emit("compare", selectedRefs.value[0], selectedRefs.value[1])
    selectedRefs.value = []
  }
}

async function handleDelete(entry: VersionLogEntry) {
  if (!confirm(t("erd.version.confirm_delete"))) return
  try {
    await deleteVersion(props.teamId, props.collectionId, entry.shortHash)
    toast.success(t("erd.version.delete_success"))
    await fetchVersions()
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t("erd.version.delete_error"))
  }
}

async function handleSaveRemote() {
  if (savingRemote.value || !remoteUrl.value) return
  savingRemote.value = true
  try {
    await setRemote(props.teamId, props.collectionId, {
      url: remoteUrl.value,
      name: remoteName.value || undefined,
    })
    toast.success(t("erd.version.remote_saved"))
    await fetchRemoteStatus()
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t("erd.version.remote_error"))
  } finally {
    savingRemote.value = false
  }
}

async function handlePush() {
  if (pushing.value) return
  pushing.value = true
  try {
    const result = await pushToRemote(props.teamId, props.collectionId)
    if (result.pushed) {
      toast.success(t("erd.version.push_success"))
    } else {
      toast.info(t("erd.version.push_nothing"))
    }
    await fetchRemoteStatus()
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t("erd.version.push_error"))
  } finally {
    pushing.value = false
  }
}

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await exportArchive(props.teamId, props.collectionId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `erd-version-${props.collectionId}.tar.gz`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t("erd.version.export_success"))
  } catch (err: any) {
    toast.error(err?.response?.data?.message || t("erd.version.export_error"))
  } finally {
    exporting.value = false
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────

onMounted(() => {
  fetchVersions()
  fetchRemoteStatus()
})
</script>

<style scoped>
.input::placeholder {
  @apply text-secondaryLight;
}
</style>
