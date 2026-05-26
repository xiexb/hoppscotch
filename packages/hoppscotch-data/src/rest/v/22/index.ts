import { z } from "zod"
import { defineVersion } from "verzod"
import { V21_SCHEMA } from "../21"
import {
  HoppRESTTestCase,
  HoppRESTTestCaseExpectations,
} from "../19"

// ─── HoppRESTTestCaseV22 ──────────────────────────────────────────
// Extended test case schema with category, tags, request overrides,
// and run metadata. The base HoppRESTTestCase (v19) only has
// id, name, description, expectations.

const HoppRESTRequestOverrideParam = z.object({
  key: z.string().catch(""),
  value: z.string().catch(""),
  active: z.boolean().catch(true),
  description: z.string().optional().catch(""),
})

const HoppRESTRequestOverrides = z.object({
  body: z.string().nullable().catch(null),
  params: z.array(HoppRESTRequestOverrideParam).catch([]),
  headers: z.array(HoppRESTRequestOverrideParam).catch([]),
  pathParams: z.array(HoppRESTRequestOverrideParam).catch([]),
})

export type HoppRESTRequestOverrides = z.infer<typeof HoppRESTRequestOverrides>

export const HoppRESTTestCaseV22 = z.object({
  id: z.string().catch(""),
  name: z.string().catch("Untitled Test Case"),
  description: z.string().catch(""),
  expectations: HoppRESTTestCaseExpectations.catch({
    statusCode: null,
    bodyContains: [],
    headerExists: [],
    jsonPath: [],
  }),
  /** Category for grouping test cases */
  category: z.string().catch(""),
  /** Tags for labeling test cases */
  tags: z.array(z.string()).catch([]),
  /** Request parameter overrides for this test case */
  requestOverrides: HoppRESTRequestOverrides.catch({
    body: null,
    params: [],
    headers: [],
    pathParams: [],
  }),
  /** Response time in ms from the last run */
  responseTime: z.number().catch(0),
  /** ISO timestamp of the last run */
  lastRunAt: z.string().catch(""),
})

export type HoppRESTTestCaseV22 = z.infer<typeof HoppRESTTestCaseV22>

// ─── V22 Schema ────────────────────────────────────────────────────
// Adds top-level request body schema tree and model reference for
// document mode, plus extended test cases with overrides and metadata.

export const V22_SCHEMA = V21_SCHEMA.extend({
  v: z.literal("22"),
  /** Schema tree for request body documentation (visual editor) */
  bodySchemaTree: z.array(z.any()).nullable().catch(null),
  /** Reference ID of a HoppWorkspaceModel bound to the request body */
  bodyModelRef: z.string().catch(""),
  /** Extended test cases with overrides and metadata */
  testCases: z.array(HoppRESTTestCaseV22).catch([]),
})

// ─── Migration helper ──────────────────────────────────────────────
// Upgrades v19 test cases to v22 by adding default values for new fields.

function migrateTestCase(
  old: z.infer<typeof HoppRESTTestCase>
): z.infer<typeof HoppRESTTestCaseV22> {
  return {
    id: old.id ?? "",
    name: old.name ?? "Untitled Test Case",
    description: old.description ?? "",
    expectations: old.expectations ?? {
      statusCode: null,
      bodyContains: [],
      headerExists: [],
      jsonPath: [],
    },
    category: "",
    tags: [],
    requestOverrides: {
      body: null,
      params: [],
      headers: [],
      pathParams: [],
    },
    responseTime: 0,
    lastRunAt: "",
  }
}

// ─── Version definition ────────────────────────────────────────────

const V22_VERSION = defineVersion({
  schema: V22_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V21_SCHEMA>) {
    return {
      ...old,
      v: "22" as const,
      bodySchemaTree: null,
      bodyModelRef: "",
      // Migrate existing test cases to v22 format with default new fields
      testCases: (old.testCases ?? []).map(migrateTestCase),
    }
  },
})

export default V22_VERSION
