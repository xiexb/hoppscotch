import { z } from "zod"
import { defineVersion } from "verzod"
import { V17_SCHEMA } from "../17"
import { HoppRESTPathParams } from "./params"

export { HoppRESTPathParams } from "./params"

export const V18_SCHEMA = V17_SCHEMA.extend({
  v: z.literal("18"),
  pathParams: HoppRESTPathParams,
})

const V18_VERSION = defineVersion({
  schema: V18_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V17_SCHEMA>) {
    return {
      ...old,
      v: "18" as const,
      pathParams: [],
    }
  },
})

export default V18_VERSION
