import { z } from "zod"

export const HoppRESTPathParams = z.array(
  z.object({
    key: z.string().catch(""),
    value: z.string().catch(""),
    active: z.boolean().catch(true),
    description: z.string().catch(""),
  })
)

export type HoppRESTPathParams = z.infer<typeof HoppRESTPathParams>
