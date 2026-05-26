import { z } from "zod"
import { defineVersion } from "verzod"
import { V2_SCHEMA } from "./2"

/**
 * Service/base URL entry for environment-level service management.
 * Each service has a unique id, a display name, and a base URL.
 */
export const EnvironmentServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
})

export type EnvironmentService = z.infer<typeof EnvironmentServiceSchema>

export const V3_SCHEMA = V2_SCHEMA.extend({
  v: z.literal(3),
  services: z.array(EnvironmentServiceSchema).catch([]),
})

export default defineVersion({
  initial: false,
  schema: V3_SCHEMA,
  up(old: z.infer<typeof V2_SCHEMA>) {
    const result: z.infer<typeof V3_SCHEMA> = {
      ...old,
      v: 3,
      services: [],
    }

    return result
  },
})
