import axios from "axios"
import { platform } from "~/platform"

// ─── Types (matching backend interfaces) ─────────────────────────

export interface CommitResult {
  commitHash: string
  shortHash: string
  message: string
  timestamp: string
  stats: {
    filesChanged: number
    insertions: number
    deletions: number
  }
}

export interface VersionLogEntry {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  stats: {
    filesChanged: number
    insertions: number
    deletions: number
  } | null
  tags: string[]
}

export interface VersionStats {
  tables: number
  columns: number
  relationships: number
}

export interface RemoteConfig {
  remoteUrl: string | null
  configured: boolean
  lastPushAt: string | null
  lastPushError: string | null
  aheadOfRemote: number
}

export interface DiffResult {
  tables: {
    added: TableSummary[]
    removed: TableSummary[]
    modified: TableModification[]
  }
  relationships: {
    added: RelationshipChange[]
    removed: RelationshipChange[]
  }
  summary: {
    tablesAdded: number
    tablesRemoved: number
    tablesModified: number
    columnsAdded: number
    columnsRemoved: number
    columnsModified: number
    totalChanges: number
  }
}

export interface TableSummary {
  name: string
  comment: string
  columnCount: number
}

export interface TableModification {
  tableName: string
  changes: {
    comment?: { before: string; after: string }
    columns: {
      added: NormalizedColumn[]
      removed: NormalizedColumn[]
      modified: ColumnChange[]
    }
  }
}

export interface NormalizedColumn {
  name: string
  type: string
  default: string | null
  comment: string | null
  pk: boolean
  notNull: boolean
  unique: boolean
  autoIncrement: boolean
}

export interface ColumnChange {
  name: string
  before: NormalizedColumn | null
  after: NormalizedColumn | null
  changes: string[]
}

export interface RelationshipChange {
  type: string
  from: string
  to: string
}

export interface TagInfo {
  tagName: string
  commitHash: string
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────

const getBaseUrl = () => import.meta.env.VITE_BACKEND_API_URL

const getAxiosConfig = async () => {
  await platform.auth.waitProbableLoginToConfirm()
  return platform.auth.axiosPlatformConfig?.() ?? {}
}

const buildParams = (teamId: string, collectionId: string, extra?: Record<string, unknown>) => ({
  teamId,
  collectionId,
  ...extra,
})

// ─── API Functions ───────────────────────────────────────────────

/**
 * Commit a new ERD version.
 */
export async function commitVersion(
  teamId: string,
  collectionId: string,
  erdJson: string,
  message?: string,
  force?: boolean,
): Promise<CommitResult> {
  const config = await getAxiosConfig()
  const res = await axios.post(
    `${getBaseUrl()}/erd-version/commit`,
    { erdJson, message, force },
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Get the version history log.
 */
export async function getVersionLog(
  teamId: string,
  collectionId: string,
  limit = 50,
): Promise<VersionLogEntry[]> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/log`,
    { ...config, params: buildParams(teamId, collectionId, { limit }) },
  )
  return res.data
}

/**
 * Get a specific version\'s ERD JSON and commit info.
 */
export async function getVersion(
  teamId: string,
  collectionId: string,
  ref: string,
): Promise<{ erdJson: string; commit: { hash: string; message: string; date: string } }> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/${encodeURIComponent(ref)}`,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Compute structural diff between two versions.
 */
export async function getDiff(
  teamId: string,
  collectionId: string,
  from?: string,
  to?: string,
): Promise<DiffResult> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/diff`,
    { ...config, params: buildParams(teamId, collectionId, { from, to }) },
  )
  return res.data
}

/**
 * Restore (retrieve) a specific version\'s ERD JSON.
 */
export async function restoreVersion(
  teamId: string,
  collectionId: string,
  ref: string,
): Promise<{ erdJson: string }> {
  const config = await getAxiosConfig()
  const res = await axios.post(
    `${getBaseUrl()}/erd-version/restore/${encodeURIComponent(ref)}`,
    {},
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Delete (revert) a specific version.
 */
export async function deleteVersion(
  teamId: string,
  collectionId: string,
  ref: string,
): Promise<{ success: boolean; revertHash: string }> {
  const config = await getAxiosConfig()
  const res = await axios.delete(
    `${getBaseUrl()}/erd-version/commit/${encodeURIComponent(ref)}`,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Get version stats (table/column/relationship counts).
 */
export async function getVersionStats(
  teamId: string,
  collectionId: string,
  ref: string,
): Promise<VersionStats> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/stats/${encodeURIComponent(ref)}`,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Get remote repository configuration and push status.
 */
export async function getRemote(
  teamId: string,
  collectionId: string,
): Promise<RemoteConfig> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/remote`,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Configure remote repository.
 */
export async function setRemote(
  teamId: string,
  collectionId: string,
  config_: { url: string; name?: string; branch?: string },
): Promise<{ success: boolean; remoteUrl: string }> {
  const config = await getAxiosConfig()
  const res = await axios.put(
    `${getBaseUrl()}/erd-version/remote`,
    config_,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Trigger a manual push to the configured remote.
 */
export async function pushToRemote(
  teamId: string,
  collectionId: string,
): Promise<{ success: boolean; pushed: boolean }> {
  const config = await getAxiosConfig()
  const res = await axios.post(
    `${getBaseUrl()}/erd-version/push`,
    {},
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Export the version repo as a .tar.gz archive (returns Blob).
 */
export async function exportArchive(
  teamId: string,
  collectionId: string,
): Promise<Blob> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/export`,
    {
      ...config,
      params: buildParams(teamId, collectionId),
      responseType: "blob",
    },
  )
  return res.data
}

// ─── Tag Management ──────────────────────────────────────────────

/**
 * Create a new tag pointing to a specific version ref.
 */
export async function createTag(
  teamId: string,
  collectionId: string,
  tagName: string,
  ref: string,
): Promise<TagInfo> {
  const config = await getAxiosConfig()
  const res = await axios.post(
    `${getBaseUrl()}/erd-version/tag`,
    { tagName, ref },
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * Delete a tag by name.
 */
export async function deleteTag(
  teamId: string,
  collectionId: string,
  tagName: string,
): Promise<{ success: boolean }> {
  const config = await getAxiosConfig()
  const res = await axios.delete(
    `${getBaseUrl()}/erd-version/tag/${encodeURIComponent(tagName)}`,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}

/**
 * List all tags for a collection.
 */
export async function listTags(
  teamId: string,
  collectionId: string,
): Promise<TagInfo[]> {
  const config = await getAxiosConfig()
  const res = await axios.get(
    `${getBaseUrl()}/erd-version/tags`,
    { ...config, params: buildParams(teamId, collectionId) },
  )
  return res.data
}
