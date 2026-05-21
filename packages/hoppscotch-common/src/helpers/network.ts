import * as TE from "fp-ts/TaskEither"
import { BehaviorSubject, Observable } from "rxjs"
import { cloneDeep } from "lodash-es"
import {
  HoppRESTResponse,
  relayRequestToActualSent,
} from "./types/HoppRESTResponse"
import { EffectiveHoppRESTRequest } from "./utils/EffectiveURL"
import { getService } from "~/modules/dioc"
import { KernelInterceptorService } from "~/services/kernel-interceptor.service"
import { RESTRequest, RESTResponse } from "~/helpers/kernel/rest"
import { RelayError } from "@hoppscotch/kernel"

export type NetworkStrategy = (
  req: EffectiveHoppRESTRequest
) => TE.TaskEither<RelayError, HoppRESTResponse>

export function createRESTNetworkRequestStream(
  request: EffectiveHoppRESTRequest
): [Observable<HoppRESTResponse>, () => void] {
  const response = new BehaviorSubject<HoppRESTResponse>({
    type: "loading",
    req: request,
  })

  const req = cloneDeep(request)

  const execResult = RESTRequest.toRequest(req).then((kernelRequest) => {
    if (!kernelRequest) {
      response.next({
        type: "network_fail",
        req,
        error: new Error("Failed to create kernel request"),
      })
      response.complete()
      return null
    }

    // Capture the actual sent request data before dispatch
    const actualSent = relayRequestToActualSent(kernelRequest)

    const result = service.execute(kernelRequest)

    result.response.then(async (res) => {
      if (res._tag === "Right") {
        const processedRes = await RESTResponse.toResponse(res.right, req)

        if (processedRes.type === "success") {
          // Attach the actual sent request data to the response
          response.next({
            ...processedRes,
            actualSentRequest: actualSent,
          })
        } else {
          // For transform_error responses, also attach actual sent request
          response.next({
            type: "network_fail",
            req,
            error: processedRes.error,
          })
        }
      } else {
        response.next({
          type: "interceptor_error",
          req,
          error: res.left,
        })
      }
      response.complete()
    })

    return result
  })

  const service = getService(KernelInterceptorService)

  return [
    response,
    async () => {
      try {
        const result = await execResult
        if (result) await result.cancel()
      } catch (_error) {
        // Ignore cancel errors - request may have already completed
        // This is expected behavior and not an actual error
      }
    },
  ]
}
