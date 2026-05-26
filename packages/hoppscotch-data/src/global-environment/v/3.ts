import { z } from "zod"
import { defineVersion } from "verzod"
import { V2_SCHEMA } from "./2"
import { EnvironmentServiceSchema } from "../../environment/v/3"

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
