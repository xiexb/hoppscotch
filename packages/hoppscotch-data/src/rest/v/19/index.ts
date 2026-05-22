import { z } from "zod"
import { defineVersion } from "verzod"
import { V18_SCHEMA } from "../18"

// Response model for API documentation (design mode)
export const HoppRESTResponseModel = z.object({
  statusCode: z.string().catch("200"),
  description: z.string().catch(""),
  headers: z
    .array(
      z.object({
        key: z.string().catch(""),
        description: z.string().catch(""),
      })
    )
    .catch([]),
  bodySchema: z.string().catch(""),
  bodyExample: z.string().catch(""),
})

export type HoppRESTResponseModel = z.infer<typeof HoppRESTResponseModel>

// JSON Path assertion operator
export const HoppRESTAssertionOperator = z.enum([
  "eq",
  "neq",
  "contains",
  "gt",
  "lt",
])

export type HoppRESTAssertionOperator = z.infer<
  typeof HoppRESTAssertionOperator
>

// JSON Path assertion
export const HoppRESTJSONPathAssertion = z.object({
  path: z.string().catch(""),
  value: z.string().catch(""),
  operator: HoppRESTAssertionOperator.catch("eq"),
})

export type HoppRESTJSONPathAssertion = z.infer<
  typeof HoppRESTJSONPathAssertion
>

// Test case expectations
export const HoppRESTTestCaseExpectations = z.object({
  statusCode: z.number().nullable().catch(null),
  bodyContains: z.array(z.string()).catch([]),
  headerExists: z.array(z.string()).catch([]),
  jsonPath: z.array(HoppRESTJSONPathAssertion).catch([]),
})

export type HoppRESTTestCaseExpectations = z.infer<
  typeof HoppRESTTestCaseExpectations
>

// Structured test case for an API
export const HoppRESTTestCase = z.object({
  id: z.string().catch(""),
  name: z.string().catch("Untitled Test Case"),
  description: z.string().catch(""),
  expectations: HoppRESTTestCaseExpectations.catch({
    statusCode: null,
    bodyContains: [],
    headerExists: [],
    jsonPath: [],
  }),
})

export type HoppRESTTestCase = z.infer<typeof HoppRESTTestCase>

export const V19_SCHEMA = V18_SCHEMA.extend({
  v: z.literal("19"),
  responseModels: z.array(HoppRESTResponseModel).catch([]),
  testCases: z.array(HoppRESTTestCase).catch([]),
})

const V19_VERSION = defineVersion({
  schema: V19_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V18_SCHEMA>) {
    return {
      ...old,
      v: "19" as const,
      responseModels: [],
      testCases: [],
    }
  },
})

export default V19_VERSION
