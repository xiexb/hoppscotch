import { defineVersion, entityRefUptoVersion } from "verzod"
import { z } from "zod"

import { HoppCollection } from ".."
import { v14_baseCollectionSchema, V14_SCHEMA } from "./14"

export const ErdDiagramSchema = z.object({
  id: z.string(),
  name: z.string(),
  schema: z.string(),
})

export type ErdDiagram = z.infer<typeof ErdDiagramSchema>

export const v15_baseCollectionSchema = v14_baseCollectionSchema.extend({
  v: z.literal(15),
  erdDiagrams: z.array(ErdDiagramSchema).catch([]),
})

type Input = z.input<typeof v15_baseCollectionSchema> & {
  folders: Input[]
}

type Output = z.output<typeof v15_baseCollectionSchema> & {
  folders: Output[]
}

export const V15_SCHEMA = v15_baseCollectionSchema.extend({
  folders: z.lazy(() => z.array(entityRefUptoVersion(HoppCollection, 15))),
}) as z.ZodType<Output, z.ZodTypeDef, Input>

export default defineVersion({
  initial: false,
  schema: V15_SCHEMA,
  up(old: z.infer<typeof V14_SCHEMA>) {
    const result: z.infer<typeof V15_SCHEMA> = {
      ...old,
      v: 15 as const,
      erdDiagrams: [],
      folders: old.folders.map((folder) => {
        const result = HoppCollection.safeParseUpToVersion(folder, 15)

        if (result.type !== "ok") {
          throw new Error("Failed to migrate child collections")
        }

        return result.value
      }),
    }

    return result
  },
})
