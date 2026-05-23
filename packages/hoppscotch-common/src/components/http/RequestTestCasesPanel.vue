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
      </div>
      <span v-if="testCases.length > 0" class="text-xs text-secondary">
        {{ testCases.length }} {{ t("request_mode.testcases.count") }}
      </span>
    </div>

    <!-- Empty State -->
    <div
      v-if="testCases.length === 0"
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
      v-for="(testCase, index) in testCases"
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
        <span class="flex-1 text-sm text-secondaryDark truncate">
          {{ testCase.name }}
        </span>
        <span class="text-xs text-secondary">
          {{ assertionCount(testCase) }}
          {{ t("request_mode.testcases.assertions") }}
        </span>
        <!-- Run Single -->
        <button
          class="text-secondary hover:text-accent transition-colors"
          @click.stop="runSingleTestCase(testCase)"
        >
          <IconPlay class="svg-icons w-3.5 h-3.5" />
        </button>
        <!-- Delete -->
        <button
          class="text-secondary hover:text-red-400 transition-colors"
          @click.stop="removeTestCase(index)"
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
            <span class="text-secondaryDark">{{ detail.message }}</span>
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
import type { HoppRESTRequest, HoppRESTTestCase } from "@hoppscotch/data"
import { generateUniqueRefId } from "@hoppscotch/data"
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
}>()

const emit = defineEmits<{
  (e: "update:modelValue", val: HoppRESTRequest): void
}>()

const request = useVModel(props, "modelValue", emit)
const t = useI18n()

const expandedCases = ref<Set<string>>(new Set())
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

function toggleExpand(id: string) {
  if (expandedCases.value.has(id)) {
    expandedCases.value.delete(id)
  } else {
    expandedCases.value.add(id)
  }
  expandedCases.value = new Set(expandedCases.value)
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
  }
  request.value.testCases.push(newCase)
  expandedCases.value.add(newCase.id)
  expandedCases.value = new Set(expandedCases.value)
}

function removeTestCase(index: number) {
  request.value.testCases?.splice(index, 1)
}

function assertionCount(testCase: HoppRESTTestCase): number {
  let count = 0
  if (testCase.expectations.statusCode !== null) count++
  count += testCase.expectations.bodyContains.filter((s) => s !== "").length
  count += testCase.expectations.headerExists.filter((s) => s !== "").length
  count += testCase.expectations.jsonPath.filter((j) => j.path !== "").length
  return count
}

// TODO(Phase 2): Replace placeholder runner with actual request execution.
// runSingleTestCase should send the real request via runRESTRequest$ and check
// the live response against testCase.expectations. Currently all assertions
// pass unconditionally — this is for UI scaffolding only.
function runSingleTestCase(testCase: HoppRESTTestCase) {
  // For now, we validate the assertions structure
  // The actual request execution would require access to runRESTRequest$
  const details: Array<{ pass: boolean; message: string }> = []

  // Check status code
  if (testCase.expectations.statusCode !== null) {
    details.push({
      pass: true, // placeholder — actual check requires live response
      message: `${t("request_mode.testcases.expect_status")}: ${testCase.expectations.statusCode}`,
    })
  }

  // Check body contains
  for (const text of testCase.expectations.bodyContains) {
    if (text) {
      details.push({
        pass: true,
        message: `${t("request_mode.testcases.expect_body_contains")}: "${text}"`,
      })
    }
  }

  // Check header exists
  for (const header of testCase.expectations.headerExists) {
    if (header) {
      details.push({
        pass: true,
        message: `${t("request_mode.testcases.expect_header_exists")}: "${header}"`,
      })
    }
  }

  // Check json path
  for (const jp of testCase.expectations.jsonPath) {
    if (jp.path) {
      const opSymbol =
        jp.operator === "eq"
          ? "="
          : jp.operator === "neq"
            ? "!="
            : jp.operator === "contains"
              ? "contains"
              : jp.operator === "gt"
                ? ">"
                : "<"
      details.push({
        pass: true,
        message: `JSON ${jp.path} ${opSymbol} ${jp.value}`,
      })
    }
  }

  testCaseResults.value[testCase.id] = {
    status: details.every((d) => d.pass) ? "pass" : "fail",
    details,
  }
  // Force reactivity
  testCaseResults.value = { ...testCaseResults.value }
}

function runAllTestCases() {
  for (const testCase of testCases.value) {
    runSingleTestCase(testCase)
  }
}
</script>
