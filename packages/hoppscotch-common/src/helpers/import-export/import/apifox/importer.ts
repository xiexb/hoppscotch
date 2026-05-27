import {
  Environment,
  EnvironmentService,
  generateUniqueRefId,
  HoppCollection,
  HoppRESTAuth,
  HoppRESTHeader,
  HoppRESTParam,
  HoppRESTPathParam,
  HoppRESTReqBody,
  HoppRESTRequest,
  makeCollection,
  makeRESTRequest,
  ValidContentTypes,
} from "@hoppscotch/data"
import type {
  HoppRESTResponseModelV21,
  HoppRESTTestCaseV22,
} from "@hoppscotch/data"
import * as A from "fp-ts/Array"
import * as O from "fp-ts/Option"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { safeParseJSON } from "~/helpers/functional/json"
import { IMPORTER_INVALID_FILE_FORMAT } from ".."
import type { RefMap } from "./jsonSchemaToSchemaNode"
import type { ApifoxProject } from "./types"

/**
 * Apifox JSON format types (internal to importer)
 */
type ApifoxServer = {
  name: string
  id: string
  moduleId?: number
}

type ApifoxEnvironment = {
  name: string
  baseUrl?: string
  baseUrls?: Record<string, string>
  variables?: Array<{
    name: string
    value?: string
    initialValue?: string
    description?: string
  }>
}

type ApifoxGlobalVariable = {
  id?: string
  variables?: Array<{
    name: string
    value?: string
    initialValue?: string
    description?: string
    isBindInitial?: boolean
    isSync?: boolean
  }>
}

type ApifoxApiCollection = {
  name: string
  id?: number
  items: ApifoxApiCollectionItem[]
}

type ApifoxApiCollectionItem = {
  name: string
  id?: number
  items?: ApifoxApiCollectionItem[]
  api?: ApifoxApi
}

type ApifoxApi = {
  id: string
  method: string
  path: string
  description?: string
  parameters?: {
    path?: ApifoxParameter[]
    query?: ApifoxParameter[]
    header?: ApifoxParameter[]
  }
  requestBody?: ApifoxRequestBody
  responses?: ApifoxResponse[]
  auth?: ApifoxAuth
  tags?: string[]
  status?: string
  serverId?: string
  moduleId?: number
  cases?: ApifoxCase[]
}

type ApifoxCase = {
  id: number | string
  type?: string
  name: string
  responseId?: string
  parameters?: {
    query?: Array<{ name: string; value?: string; enable?: boolean }>
    path?: Array<{ name: string; value?: string; enable?: boolean }>
    header?: Array<{
      name?: string
      relatedName?: string
      value?: string
      enable?: boolean
    }>
    cookie?: unknown[]
  }
  requestBody?: {
    parameters?: Array<{
      name: string
      value?: string
      enable?: boolean
      type?: string
    }>
    data?: string
    generateMode?: string
  }
}

type ApifoxParameter = {
  name: string
  type?: string
  required?: boolean
  description?: string
  example?: string
  enable?: boolean
}

type ApifoxRequestBody = {
  type: string
  parameters?: ApifoxParameter[]
  jsonSchema?: any
  raw?: string
}

type ApifoxResponse = {
  id?: string
  code?: number
  name?: string
  jsonSchema?: any
  contentType?: string
}

type ApifoxAuth = {
  type?: string
  bearer?: {
    token?: string
  }
  basic?: {
    username?: string
    password?: string
  }
}

type ApifoxRequestCollection = {
  name: string
  children?: ApifoxRequestCollection[]
  items?: ApifoxRequestItem[]
}

type ApifoxRequestItem = {
  id?: number
  name: string
  method: string
  path: string
  requestBody?: ApifoxRequestBody
  parameters?: any
  auth?: ApifoxAuth
}

/**
 * Replace Apifox {{var}} with Hoppscotch <<var>>
 */
const replaceApifoxVarTemplating = (value: unknown): string => {
  const str = typeof value === "string" ? value : String(value ?? "")
  return str.replace(/{{\s*/g, "<<").replace(/\s*}}/g, ">>")
}

/**
 * Convert Apifox auth to HoppRESTAuth
 */
const getHoppAuth = (auth?: ApifoxAuth): HoppRESTAuth => {
  if (!auth || !auth.type || auth.type === "noauth") {
    return { authType: "inherit", authActive: true }
  }

  if (auth.type === "bearer" && auth.bearer) {
    return {
      authType: "bearer",
      authActive: true,
      token: replaceApifoxVarTemplating(auth.bearer.token ?? ""),
    }
  }

  if (auth.type === "basic" && auth.basic) {
    return {
      authType: "basic",
      authActive: true,
      username: replaceApifoxVarTemplating(auth.basic.username ?? ""),
      password: replaceApifoxVarTemplating(auth.basic.password ?? ""),
    }
  }

  return { authType: "inherit", authActive: true }
}

/**
 * Convert Apifox query parameters to HoppRESTParam
 */
const getHoppParams = (params?: ApifoxParameter[]): HoppRESTParam[] => {
  if (!params) return []
  return params.map((p) => ({
    key: replaceApifoxVarTemplating(p.name),
    value: replaceApifoxVarTemplating(p.example ?? ""),
    active: p.enable !== false,
    description: p.description ?? "",
  }))
}

/**
 * Convert Apifox path parameters to HoppRESTPathParam
 */
const getHoppPathParams = (params?: ApifoxParameter[]): HoppRESTPathParam[] => {
  if (!params) return []
  return params.map((p) => ({
    key: replaceApifoxVarTemplating(p.name),
    value: replaceApifoxVarTemplating(p.example ?? ""),
    active: p.enable !== false,
    description: p.description ?? "",
  }))
}

/**
 * Convert Apifox headers to HoppRESTHeader
 */
const getHoppHeaders = (params?: ApifoxParameter[]): HoppRESTHeader[] => {
  if (!params) return []
  return params.map((p) => ({
    key: replaceApifoxVarTemplating(p.name),
    value: replaceApifoxVarTemplating(p.example ?? ""),
    active: p.enable !== false,
    description: p.description ?? "",
  }))
}

/**
 * Convert Apifox request body to HoppRESTReqBody
 */
const getHoppBody = (body?: ApifoxRequestBody): HoppRESTReqBody => {
  if (!body || body.type === "none") {
    return { contentType: null, body: null }
  }

  const contentType = body.type as ValidContentTypes

  if (contentType === "application/json") {
    // Generate JSON from schema or parameters
    let jsonBody = ""
    if (body.jsonSchema) {
      try {
        const obj = generateJsonFromSchema(body.jsonSchema)
        jsonBody = JSON.stringify(obj, null, 2)
      } catch (e) {
        jsonBody = "{}"
      }
    } else if (body.parameters && body.parameters.length > 0) {
      const obj: Record<string, any> = {}
      body.parameters.forEach((p) => {
        obj[p.name] = p.example ?? ""
      })
      jsonBody = JSON.stringify(obj, null, 2)
    }
    return { contentType, body: jsonBody }
  }

  if (contentType === "multipart/form-data") {
    const params = (body.parameters ?? []).map((p) => ({
      key: replaceApifoxVarTemplating(p.name),
      value: replaceApifoxVarTemplating(p.example ?? ""),
      active: p.enable !== false,
      isFile: false as const,
    }))
    return { contentType, body: params }
  }

  if (contentType === "application/x-www-form-urlencoded") {
    // Body is a string in "key: value\nkey2: value2" bulk format
    const bodyStr = (body.parameters ?? [])
      .map(
        (p) =>
          `${replaceApifoxVarTemplating(p.name)}: ${replaceApifoxVarTemplating(p.example ?? "")}`
      )
      .join("\n")
    return { contentType, body: bodyStr }
  }

  if (contentType === "text/plain") {
    return { contentType, body: body.raw ?? "" }
  }

  return { contentType: null, body: null }
}

/**
 * Generate a sample JSON object from JSON Schema
 */
const generateJsonFromSchema = (schema: any): any => {
  if (!schema) return {}

  if (schema.type === "object" && schema.properties) {
    const obj: Record<string, any> = {}
    const keys = schema["x-apifox-orders"] ?? Object.keys(schema.properties)
    keys.forEach((key: string) => {
      const prop = schema.properties[key]
      if (prop) {
        obj[key] = generateJsonFromSchema(prop)
      }
    })
    return obj
  }

  if (schema.type === "array") {
    const item = schema.items ? generateJsonFromSchema(schema.items) : null
    return [item]
  }

  if (schema.type === "string") return schema.example ?? ""
  if (schema.type === "integer" || schema.type === "number")
    return schema.example ?? 0
  if (schema.type === "boolean") return schema.example ?? false

  return schema.example ?? ""
}

/**
 * Extract all $ref strings from a JSON Schema tree.
 */
const collectRefsInSchema = (schema: unknown): string[] => {
  const refs: string[] = []

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const obj = node as Record<string, unknown>
    if (typeof obj.$ref === "string") refs.push(obj.$ref)
    for (const value of Object.values(obj)) walk(value)
  }

  walk(schema)
  return refs
}

/**
 * Normalize Apifox contentType strings to standard MIME types.
 * Apifox sometimes uses shorthand like "json" instead of "application/json".
 */
const normalizeContentType = (ct?: string): string => {
  if (!ct) return "application/json"
  const ctMap: Record<string, string> = {
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
    text: "text/plain",
    binary: "application/octet-stream",
  }
  return ctMap[ct] ?? ct
}

/**
 * Build HoppRESTResponseModelV21[] from Apifox responses using refMap.
 */
const buildResponseModels = (
  responses: ApifoxResponse[] | undefined,
  refMap: RefMap | undefined
): HoppRESTResponseModelV21[] => {
  if (!responses || responses.length === 0 || !refMap) return []

  const result: HoppRESTResponseModelV21[] = []

  for (const resp of responses) {
    if (!resp.jsonSchema) continue

    const refs = collectRefsInSchema(resp.jsonSchema)
    const modelIds = refs
      .map((r) => refMap.get(r))
      .filter((id): id is string => !!id)

    if (modelIds.length === 0) continue

    result.push({
      statusCode: String(resp.code ?? 200),
      description: resp.name ?? "",
      headers: [],
      bodySchema: "",
      bodyExample: "",
      bodySchemaTree: null,
      contentType: normalizeContentType(resp.contentType),
      rootModelRef: modelIds[0],
    })
  }

  return result
}

/**
 * Convert Apifox cases[] to HoppRESTTestCaseV22[]
 */
const convertApifoxCases = (
  cases: ApifoxCase[] | undefined,
  responses?: ApifoxResponse[]
): HoppRESTTestCaseV22[] => {
  if (!cases || cases.length === 0) return []

  // Build responseId → statusCode map
  const responseStatusMap = new Map<string, number>()
  if (responses) {
    for (const r of responses) {
      if (r.id && r.code) {
        responseStatusMap.set(String(r.id), r.code)
      }
    }
  }

  return cases
    .filter((c) => c.type === "DEBUG_CASE" || c.type === "AUTO_TEST_CASE")
    .map((c) => {
      const id = generateUniqueRefId("tc")

      // Build requestOverrides
      const bodyOverride: string | null =
        c.requestBody?.data
          ? c.requestBody.data.replace(/\r\n/g, "\n")
          : null

      const pathParams =
        c.parameters?.path
          ?.filter((p) => p.enable !== false)
          .map((p) => ({
            key: p.name,
            value: p.value || "",
            active: true,
          })) ?? []

      const queryParams =
        c.parameters?.query
          ?.filter((p) => p.enable !== false)
          .map((p) => ({
            key: p.name,
            value: p.value || "",
            active: true,
          })) ?? []

      const headerOverrides =
        c.parameters?.header
          ?.filter((h) => h.enable !== false)
          .map((h) => ({
            key: h.name || h.relatedName || "",
            value: h.value || "",
            active: true,
          })) ?? []

      // Infer expected status from linked response
      let expectedStatus: number | null = null
      if (c.responseId) {
        const status = responseStatusMap.get(String(c.responseId))
        if (status) expectedStatus = status
      }

      return {
        id,
        name: c.name || `Case ${c.id}`,
        description: "",
        category: "",
        tags: [] as string[],
        expectations: {
          statusCode: expectedStatus,
          bodyContains: [] as string[],
          headerExists: [] as string[],
          jsonPath: [] as Array<{
            path: string
            value: string
            operator: string
          }>,
        },
        requestOverrides: {
          body: bodyOverride,
          params: queryParams,
          headers: headerOverrides,
          pathParams: pathParams,
        },
        responseTime: 0,
        lastRunAt: "",
      } as HoppRESTTestCaseV22
    })
}

/**
 * Convert Apifox API to HoppRESTRequest
 */
const getHoppRequest = (
  item: ApifoxApiCollectionItem,
  baseUrl: string = "",
  refMap?: RefMap
): HoppRESTRequest => {
  const api = item.api!
  const endpoint = api.path.startsWith("http")
    ? api.path
    : `${baseUrl}${api.path}`

  return makeRESTRequest({
    name: item.name,
    endpoint: replaceApifoxVarTemplating(endpoint),
    method: api.method.toUpperCase(),
    headers: getHoppHeaders(api.parameters?.header),
    params: getHoppParams(api.parameters?.query),
    pathParams: getHoppPathParams(api.parameters?.path),
    auth: getHoppAuth(api.auth),
    body: getHoppBody(api.requestBody),
    requestVariables: [],
    responses: {},
    preRequestScript: "",
    testScript: "",
    description: api.description ?? null,
    responseModels: buildResponseModels(api.responses, refMap),
    testCases: convertApifoxCases(api.cases, api.responses),
    apiTitle: item.name,
    apiStatus: mapApifoxStatus(api.status),
    tags: api.tags ?? [],
    responsibility: "",
    inheritedBaseUrl: baseUrl,
  })
}

/**
 * Map Apifox status to HoppRESTApiStatus
 */
const mapApifoxStatus = (
  status?: string
): "designing" | "developing" | "testing" | "published" | "deprecated" => {
  if (!status) return "developing"
  const statusMap: Record<
    string,
    "designing" | "developing" | "testing" | "published" | "deprecated"
  > = {
    designing: "designing",
    developing: "developing",
    testing: "testing",
    released: "published",
    published: "published",
    deprecated: "deprecated",
  }
  return statusMap[status] ?? "developing"
}

/**
 * Convert Apifox request item (from requestCollection) to HoppRESTRequest
 */
const getHoppRequestFromRequestItem = (
  item: ApifoxRequestItem,
  baseUrl: string = ""
): HoppRESTRequest => {
  const endpoint = item.path.startsWith("http")
    ? item.path
    : `${baseUrl}${item.path}`

  return makeRESTRequest({
    name: item.name,
    endpoint: replaceApifoxVarTemplating(endpoint),
    method: item.method.toUpperCase(),
    headers: [],
    params: [],
    pathParams: [],
    auth: getHoppAuth(item.auth),
    body: getHoppBody(item.requestBody),
    requestVariables: [],
    responses: {},
    preRequestScript: "",
    testScript: "",
    description: null,
    responseModels: [],
    testCases: [],
    apiTitle: item.name,
    apiStatus: "developing",
    tags: [],
    responsibility: "",
    inheritedBaseUrl: baseUrl,
  })
}

/**
 * Recursively convert Apifox API collection tree to HoppCollection
 */
const getHoppCollection = (
  node: ApifoxApiCollectionItem,
  baseUrl: string,
  refMap?: RefMap
): HoppCollection => {
  const folders: HoppCollection[] = []
  const requests: HoppRESTRequest[] = []

  if (node.items) {
    node.items.forEach((item) => {
      try {
        if (item.api) {
          // This is an API endpoint
          requests.push(getHoppRequest(item, baseUrl, refMap))
        } else if (item.items) {
          // This is a folder
          folders.push(getHoppCollection(item, baseUrl, refMap))
        }
      } catch (e) {
        console.error(
          `[Apifox Import] Failed to import item "${item.name}":`,
          e instanceof Error ? e.message : String(e)
        )
      }
    })
  }

  return makeCollection({
    name: node.name,
    folders,
    requests,
    auth: { authType: "inherit", authActive: true },
    headers: [],
    variables: [],
    description: null,
    preRequestScript: "",
    testScript: "",
  })
}

/**
 * Convert Apifox request collection to HoppCollection
 */
const getHoppRequestCollection = (
  node: ApifoxRequestCollection,
  baseUrl: string
): HoppCollection => {
  const folders: HoppCollection[] = []
  const requests: HoppRESTRequest[] = []

  if (node.children) {
    node.children.forEach((child) => {
      folders.push(getHoppRequestCollection(child, baseUrl))
    })
  }

  if (node.items) {
    node.items.forEach((item) => {
      requests.push(getHoppRequestFromRequestItem(item, baseUrl))
    })
  }

  return makeCollection({
    name: node.name,
    folders,
    requests,
    auth: { authType: "inherit", authActive: true },
    headers: [],
    variables: [],
    description: null,
    preRequestScript: "",
    testScript: "",
  })
}

/**
 * Extract base URL from Apifox environments or project settings
 */
const extractBaseUrl = (data: ApifoxProject): string => {
  // Try environments first
  const environments = data.environments as ApifoxEnvironment[] | undefined
  if (environments && environments.length > 0) {
    const env = environments[0]
    if (env.baseUrl) return env.baseUrl
    if (env.baseUrls) {
      const firstUrl = Object.values(env.baseUrls).find((url) => url)
      if (firstUrl) return firstUrl
    }
  }

  // Try project settings servers
  const servers = (data.projectSetting as Record<string, unknown> | undefined)
    ?.servers as ApifoxServer[] | undefined
  if (servers && servers.length > 0) {
    // Return empty string as servers don't have URLs in the sample
    return ""
  }

  return ""
}

/**
 * Convert Apifox environments to Hoppscotch environments (v3 with services).
 *
 * Maps baseUrls → services[], variables → variables[].
 * Uses projectSetting.servers for service name resolution.
 */
export function importEnvironments(
  environments: ApifoxEnvironment[] | undefined,
  servers?: ApifoxServer[],
  globalVariables?: ApifoxGlobalVariable[]
): Environment[] {
  if (!environments || environments.length === 0) return []

  // Build server ID → name map
  const serverIdToName = new Map<string, string>()
  if (servers) {
    for (const s of servers) {
      if (s.id) serverIdToName.set(String(s.id), s.name)
    }
  }

  // Flatten globalVariables into a single list of key-value pairs
  const globalVars: Array<{ key: string; initialValue: string; currentValue: string }> = []
  if (globalVariables && globalVariables.length > 0) {
    for (const gv of globalVariables) {
      if (gv.variables) {
        for (const v of gv.variables) {
          if (v.name) {
            const val = v.value || v.initialValue || ""
            globalVars.push({
              key: v.name,
              initialValue: val,
              currentValue: val,
            })
          }
        }
      }
    }
  }

  return environments.map((env) => {
    const id = generateUniqueRefId("env")

    // Build env-specific variables
    const envVars = (env.variables ?? [])
      .filter((v) => v.name)
      .map((v) => {
        const val = v.value || v.initialValue || ""
        return {
          key: v.name,
          initialValue: val,
          currentValue: val,
          secret: false,
        }
      })

    // Merge global variables as prefix, env variables take priority on name conflict
    const envVarKeys = new Set(envVars.map((v) => v.key))
    const mergedVars = [
      ...globalVars
        .filter((gv) => !envVarKeys.has(gv.key))
        .map((gv) => ({ key: gv.key, initialValue: gv.initialValue, currentValue: gv.currentValue, secret: false })),
      ...envVars,
    ]

    // Build services from baseUrls
    const services: EnvironmentService[] = []
    if (env.baseUrls) {
      for (const [serverId, url] of Object.entries(env.baseUrls)) {
        if (!url) continue
        services.push({
          id: generateUniqueRefId("svc"),
          name: serverIdToName.get(serverId) || `Service ${serverId}`,
          url,
        })
      }
    }

    // If no baseUrls but has baseUrl, create a default service
    if (services.length === 0 && env.baseUrl) {
      services.push({
        id: generateUniqueRefId("svc"),
        name: "Default",
        url: env.baseUrl,
      })
    }

    return {
      id,
      v: 3 as const,
      name: env.name || "Imported",
      variables: mergedVars,
      services,
    }
  })
}

/**
 * Build a mapping from Apifox serverId → Hoppscotch service ID
 * for setting selectedServiceId on collections.
 */
export function buildServerToServiceMap(
  environments: ApifoxEnvironment[] | undefined,
  importedEnvs: Environment[]
): Map<string, string> {
  const map = new Map<string, string>()
  if (!environments || environments.length === 0 || importedEnvs.length === 0)
    return map

  const firstApifoxEnv = environments[0]
  const firstImportedEnv = importedEnvs[0]

  if (firstApifoxEnv.baseUrls) {
    for (const [serverId, url] of Object.entries(firstApifoxEnv.baseUrls)) {
      if (!url) continue
      const svc = firstImportedEnv.services.find((s) => s.url === url)
      if (svc) map.set(serverId, svc.id)
    }
  }

  return map
}

/**
 * Main Apifox importer function
 */
export const hoppApifoxImporter = (content: string[], refMap?: RefMap) =>
  pipe(
    content,
    A.traverse(O.Applicative)((str) => safeParseJSON(str, true)),
    O.chain((parsedData) => {
      // safeParseJSON(str, true) wraps each result in an array,
      // and A.traverse collects them — so parsedData is [[obj1], [obj2], ...].
      // Flatten one level to get [obj1, obj2, ...].
      const rawArray = Array.isArray(parsedData) ? parsedData : [parsedData]
      const dataArray = rawArray.flat().filter(
        (d): d is Record<string, unknown> =>
          d !== null && typeof d === "object" && !Array.isArray(d)
      )

      const collections: HoppCollection[] = []

      dataArray.forEach((data) => {
        const apifoxData = data as unknown as ApifoxProject
        const baseUrl = extractBaseUrl(apifoxData)

        // Import apiCollection (API definitions)
        const apiCollections = apifoxData.apiCollection as
          | ApifoxApiCollection[]
          | undefined
        if (apiCollections && apiCollections.length > 0) {
          apiCollections.forEach((apiColl) => {
            try {
              const rootCollection: ApifoxApiCollectionItem = {
                name: apiColl.name,
                items: apiColl.items,
              }
              collections.push(
                getHoppCollection(rootCollection, baseUrl, refMap)
              )
            } catch (e) {
              console.error(
                `[Apifox Import] Failed to import apiCollection "${apiColl.name}":`,
                e
              )
            }
          })
        }

        // Import requestCollection (saved requests)
        const requestCollections = apifoxData.requestCollection as
          | ApifoxRequestCollection[]
          | undefined
        if (requestCollections && requestCollections.length > 0) {
          requestCollections.forEach((reqColl) => {
            try {
              collections.push(getHoppRequestCollection(reqColl, baseUrl))
            } catch (e) {
              console.error(
                `[Apifox Import] Failed to import requestCollection "${reqColl.name}":`,
                e
              )
            }
          })
        }
      })

      return collections.length > 0 ? O.some(collections) : O.none
    }),
    TE.fromOption(() => IMPORTER_INVALID_FILE_FORMAT)
  )
