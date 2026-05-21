import { defineVersion } from "verzod"
import { z } from "zod"
import { V6_SCHEMA } from "./6"
import { HoppRESTPathParams } from "../../../rest/v/18/params"

export const V7_SCHEMA = V6_SCHEMA.extend({
  v: z.literal("7"),
  pathParams: HoppRESTPathParams,
})

export default defineVersion({
  initial: false,
  schema: V7_SCHEMA,
  up(old: z.infer<typeof V6_SCHEMA>) {
    return {
      ...old,
      v: "7" as const,
      pathParams: [],
    }
  },
})
