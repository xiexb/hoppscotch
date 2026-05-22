import { HoppRESTRequest } from "@hoppscotch/data"
import { Component } from "vue"
import { KernelInterceptorError } from "~/services/kernel-interceptor.service"
import { RelayRequest } from "@hoppscotch/kernel"

export type HoppRESTResponseHeader = { key: string; value: string }

/**
 * Represents the actual HTTP request that was sent over the wire.
 * Captured from the kernel RelayRequest before dispatch.
 */
export type ActualSentRequest = {
  method: string
  url: string
  headers: {
    /** User-defined headers (manually added in Headers tab) */
    user: [string, string][]
    /** System-generated headers (auth + body computed by Hoppscotch) */
    system: [string, string][]
  }
  /** Query params as key-value tuples (filterActiveParams returns array, not Record) */
  params: [string, string][]
  body: string | null
  bodyMediaType: string | null
}

/**
 * Normalize params from RelayRequest (which may be Record or array of tuples at runtime)
 * into a consistent [string, string][] format.
 */
function normalizeParams(
  params: Record<string, string> | undefined
): [string, string][] {
  if (!params) return []
  // Runtime: filterActiveParams returns [string, string][], but TypeScript types it as Record
  if (Array.isArray(params)) return params as unknown as [string, string][]
  return Object.entries(params).filter(([k]) => k !== "")
}

/**
 * Converts a RelayRequest to an ActualSentRequest for display purposes.
 * Extracts readable body content from the kernel ContentType format.
 * Headers are categorized into user-defined and system-generated groups.
 */
export function relayRequestToActualSent(
  req: RelayRequest,
  userHeaders: [string, string][] = [],
  systemHeaders: [string, string][] = []
): ActualSentRequest {
  let body: string | null = null
  let bodyMediaType: string | null = null

  if (req.content) {
    bodyMediaType = req.content.mediaType ?? null
    switch (req.content.kind) {
      case "text":
      case "xml":
      case "urlencoded":
        body = req.content.content
        break
      case "json":
        body =
          typeof req.content.content === "string"
            ? req.content.content
            : JSON.stringify(req.content.content, null, 2)
        break
      case "form":
      case "multipart":
        try {
          const entries: string[] = []
          req.content.content.forEach(
            (value: FormDataEntryValue, key: string) => {
              entries.push(`${key}: ${value}`)
            }
          )
          body = entries.join("\n")
        } catch {
          body = "[FormData]"
        }
        break
      case "binary":
        body = `[Binary ${req.content.content.length} bytes]`
        break
      case "stream":
        body = "[Stream]"
        break
      default:
        body = null
    }
  }

  return {
    method: req.method,
    url: req.url,
    headers: {
      user: userHeaders,
      system: systemHeaders,
    },
    params: normalizeParams(req.params),
    body,
    bodyMediaType,
  }
}

export type HoppRESTSuccessResponse = {
  type: "success"
  headers: HoppRESTResponseHeader[]
  body: ArrayBuffer
  statusCode: number
  statusText: string
  meta: {
    responseSize: number // in bytes
    responseDuration: number // in millis
  }
  req: HoppRESTRequest
  actualSentRequest?: ActualSentRequest
}

export type HoppRESTFailureResponse = {
  type: "failure"
  headers: HoppRESTResponseHeader[]
  body: ArrayBuffer
  statusCode: number
  statusText: string
  meta: {
    responseSize: number // in bytes
    responseDuration: number // in millis
  }
  req: HoppRESTRequest
  actualSentRequest?: ActualSentRequest
}

export type HoppRESTFailureNetwork = {
  type: "network_fail"
  error: unknown
  req: HoppRESTRequest
}

export type HoppRESTFailureScript = {
  type: "script_fail"
  error: Error
}

export type HoppRESTErrorExtension = {
  type: "extension_error"
  error: string
  component: Component
  req: HoppRESTRequest
}

export type HoppRESTErrorInterceptor = {
  type: "interceptor_error"
  error: KernelInterceptorError
  req: HoppRESTRequest
}

export type HoppRESTLoadingResponse = {
  type: "loading"
  req: HoppRESTRequest
}

export type HoppRESTResponse =
  | HoppRESTLoadingResponse
  | HoppRESTSuccessResponse
  | HoppRESTFailureResponse
  | HoppRESTFailureNetwork
  | HoppRESTFailureScript
  | HoppRESTFailureExtension
  | HoppRESTFailureInterceptor
