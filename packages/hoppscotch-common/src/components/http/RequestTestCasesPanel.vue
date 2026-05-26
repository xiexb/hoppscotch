<template>
  <div class="flex flex-col overflow-y-auto flex-1">
    <!-- Toolbar -->
    <div
      class="flex items-center justify-between px-4 py-2 border-b border-dividerLight"
    >
      <div class="flex items-center gap-2">
        <HoppButtonSecondary
          :label="t('request_mode.testcases.add')"
          :icon="'icon-lucide-plus'"
          @click="addTestCase"
        />
        <HoppButtonSecondary
          v-if="testCases.length > 0"
          :label="t('request_mode.testcases.run_all')"
          :icon="'icon-lucide-play'"
          @click="runAllTestCases"
        />
        <!-- Category Filter -->
        <select
          v-if="availableCategories.length > 0"
          v-model="categoryFilter"
          class="text-xs bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
        >
          <option value="">
            {{ t("request_mode.testcases.all_categories") }}
          </option>
          <option
            v-for="cat in availableCategories"
            :key="cat"
            :value="cat"
          >
            {{ cat }}
          </option>
        </select>
      </div>
      <span v-if="testCases.length > 0" class="text-xs text-secondary">
        {{ testCases.length }} {{ t("request_mode.testcases.count") }}
      </span>
    </div>

    <!-- Empty State -->
    <div
      v-if="filteredTestCases.length === 0"
      class="flex flex-col items-center justify-center flex-1 p-8 text-secondaryLight"
    >
      <IconTestTubes class="svg-icons w-12 h-12 mb-3 opacity-50" />
      <p class="text-sm">{{ t("request_mode.testcases.empty") }}</p>
      <button
        class="mt-3 text-xs text-accent hover:text-accentDark"
        @click="addTestCase"
      >
        + {{ t("request_mode.testcases.add_first") }}
      </button>
    </div>

    <!-- Test Case List -->
    <div
      v-for="(testCase, index) in filteredTestCases"
      :key="testCase.id"
      class="border-b border-dividerLight"
    >
      <!-- Test Case Header -->
      <div
        class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-primaryLight transition-colors"
        @click="toggleExpand(testCase.id)"
      >
        <component
          :is="
            expandedCases.has(testCase.id) ? IconChevronDown : IconChevronRight
          "
          class="svg-icons text-secondary w-4 h-4"
        />
        <!-- Test Result Indicator -->
        <span v-if="testCaseResults[testCase.id]" class="flex items-center">
          <IconCheckCircle
            v-if="testCaseResults[testCase.id]?.status === 'pass'"
            class="svg-icons w-4 h-4 text-green-500"
          />
          <IconXCircle v-else class="svg-icons w-4 h-4 text-red-500" />
        </span>
        <!-- Category Badge -->
        <span
          v-if="testCase.category"
          class="text-xs px-1.5 py-0.5 rounded bg-accentLight/15 text-accent font-medium"
        >
          {{ testCase.category }}
        </span>
        <span class="flex-1 text-sm text-secondaryDark truncate">
          {{ testCase.name }}
        </span>
        <!-- Tags -->
        <span
          v-for="tag in (testCase.tags ?? [])"
          :key="tag"
          class="text-xs px-1 py-0.5 rounded bg-primaryLight text-secondary"
        >
          {{ tag }}
        </span>
        <!-- Response time -->
        <span
          v-if="testCase.lastRunAt"
          class="text-xs text-secondary mr-1"
        >
          {{ testCase.responseTime }}ms
        </span>
        <span class="text-xs text-secondary">
          {{ assertionCount(testCase) }}
          {{ t("request_mode.testcases.assertions") }}
        </span>
        <!-- Run Single -->
        <button
          :disabled="runningCases.has(testCase.id)"
          class="text-secondary hover:text-accent transition-colors disabled:opacity-40"
          @click.stop="runSingleTestCase(testCase)"
        >
          <IconPlay class="svg-icons w-3.5 h-3.5" />
        </button>
        <!-- Delete -->
        <button
          class="text-secondary hover:text-red-400 transition-colors"
          @click.stop="removeTestCase(testCases.findIndex((tc) => tc.id === testCase.id))"
        >
          <IconTrash2 class="svg-icons w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Test Case Editor (Expanded) -->
      <div v-if="expandedCases.has(testCase.id)" class="px-4 pb-4 space-y-3">
        <!-- Name -->
        <div>
          <label class="text-xs font-semibold text-secondary mb-1 block">
            {{ t("request_mode.testcases.name") }}
          </label>
          <input
            v-model="testCase.name"
            class="text-sm w-full bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="text-xs font-semibold text-secondary mb-1 block">
            {{ t("request_mode.testcases.description") }}
          </label>
          <textarea
            v-model="testCase.description"
            class="text-xs w-full bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent resize-y"
            rows="2"
          ></textarea>
        </div>

        <!-- Category -->
        <div>
          <label class="text-xs font-semibold text-secondary mb-1 block">
            {{ t("request_mode.testcases.category") }}
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model="testCase.category"
              class="text-xs flex-1 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
              :placeholder="t('request_mode.testcases.category_placeholder')"
              @input="onCategoryUpdate(testCase)"
            />
          </div>
        </div>

        <!-- Tags -->
        <div>
          <label class="text-xs font-semibold text-secondary mb-1 block">
            {{ t("request_mode.testcases.tags") }}
          </label>
          <div class="flex flex-wrap gap-1 mb-1">
            <span
              v-for="(tag, tIndex) in (testCase.tags ?? [])"
              :key="tIndex"
              class="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-primaryLight text-secondary"
            >
              {{ tag }}
              <button
                class="hover:text-red-400"
                @click="(testCase.tags ?? []).splice(tIndex, 1)"
              >
                <IconX class="svg-icons w-3 h-3" />
              </button>
            </span>
            <input
              v-model="tagInputs[testCase.id]"
              class="text-xs w-24 bg-transparent border border-dividerLight rounded px-2 py-0.5 text-secondaryDark outline-none focus:border-accent"
              :placeholder="'+tag'"
              @keydown.enter.prevent="addTag(testCase)"
              @keydown.comma.prevent="addTag(testCase)"
            />
          </div>
        </div>

        <!-- Request Overrides Section -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold text-secondaryDark">
            {{ t("request_mode.testcases.request_overrides") }}
          </h4>

          <!-- Override Body -->
          <div class="flex items-center gap-2">
            <HoppSmartToggle
              :on="testCase.requestOverrides.body !== null"
              @change="
                testCase.requestOverrides.body =
                  testCase.requestOverrides.body === null ? '' : null
              "
            />
            <label class="text-xs text-secondaryDark flex-shrink-0">
              {{ t("request_mode.testcases.override_body") }}
            </label>
            <input
              v-if="testCase.requestOverrides.body !== null"
              v-model="testCase.requestOverrides.body"
              class="text-xs flex-1 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
              :placeholder='{\"test\": true}'
            />
          </div>
        </div>

        <!-- Assertions Section -->
        <div class="space-y-2">
          <h4 class="text-xs font-semibold text-secondaryDark">
            {{ t("request_mode.testcases.assertions") }}
          </h4>

          <!-- Status Code Assertion -->
          <div class="flex items-center gap-2">
            <HoppSmartToggle
              :on="testCase.expectations.statusCode !== null"
              @change="
                testCase.expectations.statusCode =
                  testCase.expectations.statusCode === null ? 200 : null
              "
            />
            <label class="text-xs text-secondaryDark flex-shrink-0">
              {{ t("request_mode.testcases.expect_status") }}
            </label>
            <input
              v-if="testCase.expectations.statusCode !== null"
              v-model.number="testCase.expectations.statusCode"
              type="number"
              class="text-xs w-20 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
            />
          </div>

          <!-- Body Contains Assertions -->
          <div>
            <div class="flex items-center gap-2 mb-1">
              <label class="text-xs text-secondaryDark">
                {{ t("request_mode.testcases.expect_body_contains") }}
              </label>
            </div>
            <div
              v-for="(text, bIndex) in testCase.expectations.bodyContains"
              :key="bIndex"
              class="flex items-center gap-1 mb-1"
            >
              <input
                v-model="testCase.expectations.bodyContains[bIndex]"
                class="text-xs flex-1 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
                :placeholder="'Text...'"
              />
              <button
                class="text-secondary hover:text-red-400"
                @click="testCase.expectations.bodyContains.splice(bIndex, 1)"
              >
                <IconX class="svg-icons w-3 h-3" />
              </button>
            </div>
            <button
              class="text-xs text-accent hover:text-accentDark"
              @click="testCase.expectations.bodyContains.push('')"
            >
              + {{ t("request_mode.testcases.add_body_contains") }}
            </button>
          </div>

          <!-- Header Exists Assertions -->
          <div>
            <div class="flex items-center gap-2 mb-1">
              <label class="text-xs text-secondaryDark">
                {{ t("request_mode.testcases.expect_header_exists") }}
              </label>
            </div>
            <div
              v-for="(header, hIndex) in testCase.expectations.headerExists"
              :key="hIndex"
              class="flex items-center gap-1 mb-1"
            >
              <input
                v-model="testCase.expectations.headerExists[hIndex]"
                class="text-xs flex-1 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
                :placeholder="'Header name...'"
              />
              <button
                class="text-secondary hover:text-red-400"
                @click="testCase.expectations.headerExists.splice(hIndex, 1)"
              >
                <IconX class="svg-icons w-3 h-3" />
              </button>
            </div>
            <button
              class="text-xs text-accent hover:text-accentDark"
              @click="testCase.expectations.headerExists.push('')"
            >
              + {{ t("request_mode.testcases.add_header_exists") }}
            </button>
          </div>

          <!-- JSON Path Assertions -->
          <div>
            <div class="flex items-center gap-2 mb-1">
              <label class="text-xs text-secondaryDark">
                {{ t("request_mode.testcases.expect_json_path") }}
              </label>
            </div>
            <div
              v-for="(jp, jpIndex) in testCase.expectations.jsonPath"
              :key="jpIndex"
              class="flex items-center gap-1 mb-1"
            >
              <input
                v-model="jp.path"
                class="text-xs w-32 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
                :placeholder="'$.data.id'"
              />
              <select
                v-model="jp.operator"
                class="text-xs bg-transparent border border-dividerLight rounded px-1 py-1 text-secondaryDark outline-none focus:border-accent"
              >
                <option value="eq">=</option>
                <option value="neq">!=</option>
                <option value="contains">contains</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
              <input
                v-model="jp.value"
                class="text-xs flex-1 bg-transparent border border-dividerLight rounded px-2 py-1 text-secondaryDark outline-none focus:border-accent"
                :placeholder="'expected value'"
              />
              <button
                class="text-secondary hover:text-red-400"
                @click="testCase.expectations.jsonPath.splice(jpIndex, 1)"
              >
                <IconX class="svg-icons w-3 h-3" />
              </button>
            </div>
            <button
              class="text-xs text-accent hover:text-accentDark"
              @click="
                testCase.expectations.jsonPath.push({
                  path: '',
                  value: '',
                  operator: 'eq',
                })
              "
            >
              + {{ t("request_mode.testcases.add_json_path") }}
            </button>
          </div>
        </div>

        <!-- Test Result Display -->
        <div
          v-if="testCaseResults[testCase.id]"
          class="rounded border border-dividerLight p-2"
        >
          <div
            class="flex items-center gap-1 text-xs font-semibold mb-1"
            :class="
              testCaseResults[testCase.id]?.status === 'pass'
                ? 'text-green-500'
                : 'text-red-500'
            "
          >
            <component
              :is="
                testCaseResults[testCase.id]?.status === 'pass'
                  ? IconCheckCircle
                  : IconXCircle
              "
              class="svg-icons w-4 h-4"
            />
            {{
              testCaseResults[testCase.id]?.status === "pass" ? "PASS" : "FAIL"
            }}
            <span
              v-if="testCase.responseTime > 0"
              class="text-secondary font-normal ml-2"
            >
              {{ testCase.responseTime }}ms
            </span>
          </div>
          <div
            v-for="(detail, dIndex) in testCaseResults[testCase.id]?.details"
            :key="dIndex"
            class="text-xs py-0.5 flex items-center gap-1"
          >
            <component
              :is="detail.pass ? IconCheck : IconX"
              class="svg-icons w-3 h-3"
              :class="detail.pass ? 'text-green-500' : 'text-red-500'"
            />
            <span
              class="text-secondaryDark"
              :class="{ 'line-through opacity-60': !detail.pass }"
            >
              {{ detail.message }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@composables/i18n"
import { useVModel } from "@vueuse/core"
import { cloneDeep } from "lodash-es"
import * as E from "fp-ts/Either"
import type { HoppRESTRequest } from "@hoppscotch/data"
import type { HoppRESTTestCaseV22 as HoppRESTTestCase } from "@hoppscotch/data"
import { generateUniqueRefId } from "@hoppscotch/data"
import { runRESTRequest$ } from "~/helpers/RequestRunner"
import { HoppTab } from "~/services/tab"
import { HoppRequestDocument } from "~/helpers/rest/document"
import type { HoppRESTSuccessResponse, HoppRESTFailureResponse } from "~/helpers/types/HoppRESTResponse"
import IconChevronDown from "~icons/lucide/chevron-down"
import IconChevronRight from "~icons/lucide/chevron-right"
import IconCheckCircle from "~icons/lucide/check-circle"
import IconXCircle from "~icons/lucide/x-circle"
import IconCheck from "~icons/lucide/check"
import IconX from "~icons/lucide/x"
import IconTestTubes from "~icons/lucide/test-tubes"
import IconPlay from "~icons/lucide/play"
import IconTrash2 from "~icons/lucide/trash-2"

const props = defineProps<{
  modelValue: HoppRESTRequest
  tab: HoppTab<HoppRequestDocument>
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTRequest): void
  (e: "update:tab", val: HoppTab<HoppRequestDocument>): void
}>()

const request = useVModel(props, "modelValue", emit)
const tab = useVModel(props, "tab", emit)
const t = useI18n()

const expandedCases = ref<Set<string>>(new Set())
const runningCases = ref<Set<string>>(new Set())
const categoryFilter = ref("")
const tagInputs = ref<Record<string, string>>({})

const testCaseResults = ref<
  Record<
    string,
    {
      status: "pass" | "fail"
      details: Array<{ pass: boolean; message: string }>
    }
  >
>({})

const testCases = computed(() => request.value.testCases ?? [])

const availableCategories = computed(() => {
  const categories = new Set<string>()
  for (const tc of testCases.value) {
    if (tc.category) categories.add(tc.category)
  }
  return Array.from(categories).sort()
})

const filteredTestCases = computed(() => {
  if (!categoryFilter.value) return testCases.value
  return testCases.value.filter((tc) => tc.category === categoryFilter.value)
})

function toggleExpand(id: string) {
  if (expandedCases.value.has(id)) {
    expandedCases.value.delete(id)
  } else {
    expandedCases.value.add(id)
  }
  expandedCases.value = new Set(expandedCases.value)
}

function onCategoryUpdate(tc: HoppRESTTestCase) {
  // Force reactivity for category filter update
}

function addTag(tc: HoppRESTTestCase) {
  const input = tagInputs.value[tc.id]
  if (!input || !input.trim()) return
  if (!tc.tags) tc.tags = []
  const tag = input.trim().replace(/,/g, "")
  if (!tc.tags.includes(tag)) {
    tc.tags.push(tag)
  }
  tagInputs.value[tc.id] = ""
}

function addTestCase() {
  if (!request.value.testCases) {
    request.value.testCases = []
  }
  const newCase: HoppRESTTestCase = {
    id: generateUniqueRefId("tc"),
    name: `Test Case ${request.value.testCases.length + 1}`,
    description: "",
    expectations: {
      statusCode: 200,
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
  request.value.testCases.push(newCase)
  expandedCases.value.add(newCase.id)
  expandedCases.value = new Set(expandedCases.value)
}

function removeTestCase(index: number) {
  // We're using the unfiltered testCases array index for deletion
  if (index >= 0 && index < testCases.value.length) {
    testCases.value.splice(index, 1)
  }
}

function assertionCount(testCase: HoppRESTTestCase): number {
  let count = 0
  if (testCase.expectations.statusCode !== null) count++
  count += testCase.expectations.bodyContains.filter((s) => s !== "").length
  count += testCase.expectations.headerExists.filter((s) => s !== "").length
  count += testCase.expectations.jsonPath.filter((j) => j.path !== "").length
  return count
}

/**
 * Evaluate a JSON path expression against a parsed JSON object.
 * Supports simple dot-notation paths like $.data.id, $.items[0].name.
 */
function evaluateJSONPath(obj: unknown, path: string): unknown {
  if (!path.startsWith("$.")) return undefined
  const parts = path.slice(2).split(/\./)
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    // Check for array index notation e.g. items[0]
    const match = part.match(/^(\w+)\[(\d+)\]$/)
    if (match) {
      const [, key, indexStr] = match
      const arr = (current as Record<string, unknown>)[key]
      if (!Array.isArray(arr)) return undefined
      current = arr[parseInt(indexStr, 10)]
    } else if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Evaluate a single assertion against the actual response data.
 */
function evaluateAssertion(
  assertionType: string,
  expected: unknown,
  actual: unknown,
  operator?: string
): { pass: boolean; message: string } {
  switch (assertionType) {
    case "statusCode": {
      const exp = expected as number
      const act = actual as number
      const pass = act === exp
      return {
        pass,
        message: `${t("request_mode.testcases.expect_status")}: Expected ${exp}, Actual ${act}`,
      }
    }
    case "bodyContains": {
      const expStr = expected as string
      const actStr = actual as string
      const pass = actStr.includes(expStr)
      return {
        pass,
        message: `${t("request_mode.testcases.expect_body_contains")}: Expected to contain "${expStr}"${pass ? "" : ` (not found in response body)`}`,
      }
    }
    case "headerExists": {
      const headerName = expected as string
      const actHeaders = actual as Array<{ key: string; value: string }>
      const found = actHeaders.some(
        (h) => h.key.toLowerCase() === headerName.toLowerCase()
      )
      return {
        pass: found,
        message: `${t("request_mode.testcases.expect_header_exists")}: Expected header "${headerName}"${found ? " (found)" : " (not found)"}`,
      }
    }
    case "jsonPath": {
      const expVal = expected as string
      const actVal = actual as string
      const op = operator ?? "eq"
      let pass = false
      let opSymbol = "="
      switch (op) {
        case "eq":
          pass = String(actVal) === String(expVal)
          opSymbol = "="
          break
        case "neq":
          pass = String(actVal) !== String(expVal)
          opSymbol = "!="
          break
        case "contains":
          pass = String(actVal).includes(String(expVal))
          opSymbol = "contains"
          break
        case "gt": {
          const numAct = parseFloat(String(actVal))
          const numExp = parseFloat(String(expVal))
          pass = !isNaN(numAct) && !isNaN(numExp) && numAct > numExp
          opSymbol = ">"
          break
        }
        case "lt": {
          const numAct = parseFloat(String(actVal))
          const numExp = parseFloat(String(expVal))
          pass = !isNaN(numAct) && !isNaN(numExp) && numAct < numExp
          opSymbol = "<"
          break
        }
      }
      return {
        pass,
        message: `JSON Path: Expected ${expVal} ${opSymbol} ${actVal} (${pass ? "PASS" : "FAIL"})`,
      }
    }
    default:
      return { pass: true, message: `Unknown assertion: ${assertionType}` }
  }
}

/**
 * Decode response body ArrayBuffer to string.
 */
function decodeBody(body: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8").decode(body).replaceAll("\x00", "")
  } catch {
    return ""
  }
}

/**
 * Try to parse response body as JSON.
 */
function tryParseJSON(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

/**
 * Run a single test case by executing the real request and checking assertions.
 */
async function runSingleTestCase(testCase: HoppRESTTestCase) {
  runningCases.value.add(testCase.id)
  runningCases.value = new Set(runningCases.value)

  const details: Array<{ pass: boolean; message: string }> = []

  try {
    // Clone the request so overrides don't mutate the shared request object
    const requestCopy = cloneDeep(request.value)

    // Apply request overrides to the clone before running
    const overrides = testCase.requestOverrides
    if (overrides) {
      // Apply body override
      if (overrides.body !== null) {
        requestCopy.body = {
          contentType: "application/json",
          body: overrides.body,
        }
      }
      // Apply params override
      if (overrides.params && overrides.params.length > 0) {
        for (const p of overrides.params) {
          if (p.active && p.key) {
            const existing = requestCopy.params.find(
              (ep: any) => ep.key === p.key
            )
            if (existing) {
              existing.value = p.value
            } else {
              requestCopy.params.push({
                key: p.key,
                value: p.value,
                active: true,
                description: "",
              })
            }
          }
        }
      }
      // Apply headers override
      if (overrides.headers && overrides.headers.length > 0) {
        for (const h of overrides.headers) {
          if (h.active && h.key) {
            const existing = requestCopy.headers.find(
              (eh: any) => eh.key === h.key
            )
            if (existing) {
              existing.value = h.value
            } else {
              requestCopy.headers.push({
                key: h.key,
                value: h.value,
                active: true,
                description: "",
              })
            }
          }
        }
      }
      // Apply path params override
      if (overrides.pathParams && overrides.pathParams.length > 0) {
        for (const pp of overrides.pathParams) {
          if (pp.active && pp.key) {
            const existing = requestCopy.pathParams.find(
              (epp: any) => epp.key === pp.key
            )
            if (existing) {
              existing.value = pp.value
            } else {
              requestCopy.pathParams.push({
                key: pp.key,
                value: pp.value,
                active: true,
              })
            }
          }
        }
      }
    }

    // Temporarily swap the tab's request with our override copy
    const originalRequest = tab.value.document.request
    tab.value.document.request = requestCopy

    try {
      // Execute the real request
      const startTime = performance.now()
      const [cancel, streamPromise] = runRESTRequest$(tab as any)
      const streamResult = await streamPromise

      if (E.isLeft(streamResult)) {
        details.push({
          pass: false,
          message: `Script error: ${streamResult.left}`,
        })
        testCaseResults.value[testCase.id] = {
          status: "fail",
          details,
        }
        return
      }
  
      // Subscribe to the response stream and collect the first terminal response
      const response = await new Promise<HoppRESTSuccessResponse | HoppRESTFailureResponse | null>((resolve) => {
        const subscription = streamResult.right.subscribe({
          next: (res: any) => {
            if (res.type === "success" || res.type === "failure") {
              resolve(res)
              subscription.unsubscribe()
            }
          },
          error: () => {
            resolve(null)
            subscription.unsubscribe()
          },
          complete: () => {
            cancel()
            resolve(null)
          },
        })
      })
  
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)
  
      testCase.responseTime = responseTime
      testCase.lastRunAt = new Date().toISOString()
  
      if (!response) {
        details.push({
          pass: false,
          message: "No response received",
        })
        testCaseResults.value[testCase.id] = {
          status: "fail",
          details,
        }
        return
      }
  
      // Check status code assertion
      if (testCase.expectations.statusCode !== null) {
        details.push(
          evaluateAssertion(
            "statusCode",
            testCase.expectations.statusCode,
            response.statusCode
          )
        )
      }
  
      const bodyStr = decodeBody(response.body)
      const parsedJson = tryParseJSON(bodyStr)
  
      // Check body contains assertions
      for (const text of testCase.expectations.bodyContains) {
        if (text) {
          details.push(
            evaluateAssertion("bodyContains", text, bodyStr)
          )
        }
      }
  
      // Check header exists assertions
      for (const header of testCase.expectations.headerExists) {
        if (header) {
          details.push(
            evaluateAssertion("headerExists", header, response.headers)
          )
        }
      }
  
      // Check JSON path assertions
      for (const jp of testCase.expectations.jsonPath) {
        if (jp.path) {
          const actualValue = parsedJson
            ? evaluateJSONPath(parsedJson, jp.path)
            : undefined
          details.push(
            evaluateAssertion(
              "jsonPath",
              jp.value,
              actualValue ?? "(not found)",
              jp.operator
            )
          )
        }
      }
  
      testCaseResults.value[testCase.id] = {
        status: details.every((d) => d.pass) ? "pass" : "fail",
        details,
      }
    } finally {
      // Always restore the original request to prevent side effects
      tab.value.document.request = originalRequest
    }
  } catch (err) {
    details.push({
      pass: false,
      message: `Runtime error: ${String(err)}`,
    })
    testCaseResults.value[testCase.id] = {
      status: "fail",
      details,
    }
  } finally {
    runningCases.value.delete(testCase.id)
    runningCases.value = new Set(runningCases.value)
    testCaseResults.value = { ...testCaseResults.value }
  }
}

async function runAllTestCases() {
  for (const testCase of testCases.value) {
    await runSingleTestCase(testCase)
  }
}
</script>
