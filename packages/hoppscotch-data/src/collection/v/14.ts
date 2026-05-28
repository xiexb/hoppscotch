import { defineVersion, entityRefUptoVersion } from "verzod"
import { z } from "zod"

import { HoppCollection } from ".."
import { v13_baseCollectionSchema, V13_SCHEMA } from "./13"

export const MarkdownDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
})

export type MarkdownDoc = z.infer<typeof MarkdownDocSchema>

export const v14_baseCollectionSchema = v13_baseCollectionSchema.extend({
  v: z.literal(14),
  markdownDocs: z.array(MarkdownDocSchema).catch([]),
})

type Input = z.input<typeof v14_baseCollectionSchema> & {
  folders: Input[]
}

type Output = z.output<typeof v14_baseCollectionSchema> & {
  folders: Output[]
}

export const V14_SCHEMA = v14_baseCollectionSchema.extend({
  folders: z.lazy(() => z.array(entityRefUptoVersion(HoppCollection, 14))),
}) as z.ZodType<Output, z.ZodTypeDef, Input>

export default defineVersion({
  initial: false,
  schema: V14_SCHEMA,
  up(old: z.infer<typeof V13_SCHEMA>) {
    const result: z.infer<typeof V14_SCHEMA> = {
      ...old,
      v: 14 as const,
      markdownDocs: [],
      folders: old.folders.map((folder) => {
        const result = HoppCollection.safeParseUpToVersion(folder, 14)

        if (result.type !== "ok") {
          throw new Error("Failed to migrate child collections")
        }

        return result.value
      }),
    }

    return result
  },
})
