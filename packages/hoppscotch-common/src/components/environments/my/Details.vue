<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t(`environment.${action}`)"
    styles="sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[80vw]"
    @close="hideModal"
  >
    <template #body>
      <div class="flex flex-col">
        <HoppSmartInput
          v-model="editingName"
          placeholder=" "
          :label="t('action.label')"
          input-styles="floating-input"
          :disabled="editingEnvironmentIndex === 'Global'"
          @submit="saveEnvironment"
        />

        <div class="my-4 flex flex-col border border-divider rounded">
          <div
            v-if="evnExpandError"
            class="mb-2 w-full overflow-auto whitespace-normal rounded bg-primaryLight px-4 py-2 font-mono text-red-400"
          >
            {{ t("environment.nested_overflow") }}
          </div>
          <HoppSmartTabs v-model="selectedEnvOption" render-inactive-tabs>
            <template #actions>
              <div class="flex flex-1 items-center justify-between">
                <HoppButtonSecondary
                  v-tippy="{ theme: 'tooltip' }"
                  to="https://docs.hoppscotch.io/documentation/features/environments"
                  blank
                  :title="t('app.wiki')"
                  :icon="IconHelpCircle"
                />
                <template v-if="selectedEnvOption !== 'services'">
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :title="t('action.clear_all')"
                    :icon="clearIcon"
                    @click="clearContent()"
                  />
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :icon="IconPlus"
                    :title="t('add.new')"
                    @click="addEnvironmentVariable"
                  />
                  <tippy
                    ref="options"
                    interactive
                    trigger="click"
                    theme="popover"
                    :on-shown="() => tippyActions!.focus()"
                  >
                    <HoppButtonSecondary
                      v-tippy="{ theme: 'tooltip' }"
                      :title="t('action.more')"
                      :icon="IconMoreVertical"
                    />
                    <template #content="{ hide }">
                      <div
                        ref="tippyActions"
                        class="flex flex-col focus:outline-none"
                        tabindex="0"
                        role="menu"
                        @keyup.escape="hide()"
                      >
                        <HoppSmartItem
                          v-tippy="{ theme: 'tooltip' }"
                          :icon="IconCopyLeft"
                          :label="
                            t('environment.replace_all_initial_with_current')
                          "
                          @click="
                            () => {
                              vars.forEach((v) => {
                                v.env.initialValue = v.env.currentValue
                              })
                              hide()
                            }
                          "
                        />
                        <HoppSmartItem
                          v-tippy="{ theme: 'tooltip' }"
                          :icon="IconCopyRight"
                          :label="
                            t('environment.replace_all_current_with_initial')
                          "
                          @click="
                            () => {
                              vars.forEach((v) => {
                                v.env.currentValue = v.env.initialValue
                              })
                              hide()
                            }
                          "
                        />
                      </div>
                    </template>
                  </tippy>
                </template>
                <template v-else>
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :icon="IconPlus"
                    :title="t('environment.add_service')"
                    @click="addService"
                  />
                </template>
              </div>
            </template>

            <HoppSmartTab
              v-for="tab in tabsData"
              :id="tab.id"
              :key="tab.id"
              :label="tab.label"
            >
              <div class="divide-y divide-dividerLight">
                <HoppSmartPlaceholder
                  v-if="tab.variables.length === 0"
                  :src="`/images/states/${colorMode.value}/blockchain.svg`"
                  :alt="tab.emptyStateLabel"
                  :text="tab.emptyStateLabel"
                >
                  <template #body>
                    <HoppButtonSecondary
                      :label="`${t('add.new')}`"
                      filled
                      :icon="IconPlus"
                      @click="addEnvironmentVariable"
                    />
                  </template>
                </HoppSmartPlaceholder>

                <template v-else>
                  <div
                    v-for="({ id, env }, index) in tab.variables"
                    :key="`${tab.id}-${id}-${index}`"
                    class="flex divide-x divide-dividerLight"
                  >
                    <input
                      v-model="env.key"
                      v-focus
                      class="flex flex-1 bg-transparent px-4 py-2 text-secondaryDark"
                      :placeholder="`${t('count.variable', {
                        count: index + 1,
                      })}`"
                      :name="'variable' + index"
                    />
                    <div class="flex items-center flex-1">
                      <SmartEnvInput
                        v-model="env.initialValue"
                        :placeholder="`${t('count.initialValue', { count: index + 1 })}`"
                        :envs="liveEnvs"
                        :name="'initialValue' + index"
                        :secret="tab.isSecret"
                        :select-text-on-mount="
                          env.key ? env.key === editingVariableName : false
                        "
                        :auto-complete-env="true"
                      />
                      <HoppButtonSecondary
                        v-tippy="{ theme: 'tooltip' }"
                        :title="t('environment.replace_initial_with_current')"
                        :icon="IconCopyLeft"
                        @click="
                          () => {
                            env.initialValue = env.currentValue
                          }
                        "
                      />
                    </div>

                    <div class="flex items-center flex-1">
                      <SmartEnvInput
                        v-model="env.currentValue"
                        :placeholder="`${t('count.currentValue', { count: index + 1 })}`"
                        :envs="liveEnvs"
                        :name="'currentValue' + index"
                        :secret="tab.isSecret"
                        :select-text-on-mount="
                          env.key ? env.key === editingVariableName : false
                        "
                        :auto-complete-env="true"
                      />
                      <HoppButtonSecondary
                        v-tippy="{ theme: 'tooltip' }"
                        :title="t('environment.replace_current_with_initial')"
                        :icon="IconCopyRight"
                        @click="
                          () => {
                            env.currentValue = env.initialValue
                          }
                        "
                      />
                    </div>

                    <div class="flex">
                      <HoppButtonSecondary
                        id="variable"
                        v-tippy="{ theme: 'tooltip' }"
                        :title="t('action.remove')"
                        :icon="IconTrash"
                        color="red"
                        @click="removeEnvironmentVariable(id)"
                      />
                    </div>
                  </div>
                </template>
              </div>
            </HoppSmartTab>

            <HoppSmartTab
              id="services"
              :label="t('environment.services')"
            >
              <div class="divide-y divide-dividerLight">
                <HoppSmartPlaceholder
                  v-if="services.length === 0"
                  :src="`/images/states/${colorMode.value}/blockchain.svg`"
                  :alt="t('environment.no_services')"
                  :text="t('environment.no_services')"
                >
                  <template #body>
                    <HoppButtonSecondary
                      :label="`${t('environment.add_service')}`"
                      filled
                      :icon="IconPlus"
                      @click="addService"
                    />
                  </template>
                </HoppSmartPlaceholder>

                <template v-else>
                  <div
                    v-for="(service, index) in services"
                    :key="service.id"
                    class="flex divide-x divide-dividerLight"
                  >
                    <input
                      v-model="service.name"
                      v-focus
                      class="flex flex-1 bg-transparent px-4 py-2 text-secondaryDark"
                      :placeholder="`${t('environment.service_name')}`"
                      :name="'service_name_' + index"
                    />
                    <SmartEnvInput
                      v-model="service.url"
                      class="flex flex-1"
                      :placeholder="`${t('environment.service_url')}`"
                      :envs="liveEnvs"
                      :name="'service_url_' + index"
                      :auto-complete-env="true"
                    />
                    <div class="flex">
                      <HoppButtonSecondary
                        v-tippy="{ theme: 'tooltip' }"
                        :title="t('action.remove')"
                        :icon="IconTrash"
                        color="red"
                        @click="removeService(service.id)"
                      />
                    </div>
                  </div>
                </template>
              </div>
            </HoppSmartTab>
          </HoppSmartTabs>
        </div>
      </div>
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="`${t('action.save')}`"
          outline
          @click="saveEnvironment"
        />
        <HoppButtonSecondary
          :label="`${t('action.cancel')}`"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { useI18n } from "@composables/i18n"
import { useReadonlyStream } from "@composables/stream"
import { useColorMode } from "@composables/theming"
import { useToast } from "@composables/toast"
import {
  Environment,
  EnvironmentService,
  GlobalEnvironment,
  parseTemplateStringE,
} from "@hoppscotch/data"
import { refAutoReset } from "@vueuse/core"
import { useService } from "dioc/vue"
import * as A from "fp-ts/Array"
import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"
import { flow, pipe } from "fp-ts/function"
import { ComputedRef, computed, ref, watch } from "vue"
import { uniqueID } from "~/helpers/utils/uniqueID"
import {
  createEnvironment,
  environments$,
  environmentsStore,
  getEnvironment,
  getGlobalVariables,
  globalEnv$,
  setGlobalEnvVariables,
  setSelectedEnvironmentIndex,
  updateEnvironment,
} from "~/newstore/environments"
import { platform } from "~/platform"
import { CurrentValueService } from "~/services/current-environment-value.service"
import { SecretEnvironmentService } from "~/services/secret-environment.service"
import IconDone from "~icons/lucide/check"
import IconHelpCircle from "~icons/lucide/help-circle"
import IconPlus from "~icons/lucide/plus"
import IconTrash from "~icons/lucide/trash"
import IconTrash2 from "~icons/lucide/trash-2"
import IconCopyRight from "~icons/lucide/clipboard-paste"
import IconCopyLeft from "~icons/lucide/clipboard-copy"
import IconMoreVertical from "~icons/lucide/more-vertical"
import { TippyComponent } from "vue-tippy"

type EnvironmentVariable = {
  id: number
  env: Environment["variables"][number]
}

const t = useI18n()
const toast = useToast()
const colorMode = useColorMode()

const props = withDefaults(
  defineProps<{
    show: boolean
    action: "edit" | "new"
    editingEnvironmentIndex?: number | "Global" | null
    editingVariableName?: string | null
    isSecretOptionSelected?: boolean
    envVars?: () => Environment["variables"]
  }>(),
  {
    show: false,
    action: "edit",
    editingEnvironmentIndex: null,
    editingVariableName: null,
    isSecretOptionSelected: false,
    envVars: () => [],
  }
)

const emit = defineEmits<{
  (e: "hide-modal"): void
}>()

const idTicker = ref(0)

const tabsData: ComputedRef<
  {
    id: string
    label: string
    emptyStateLabel: string
    isSecret: boolean
    variables: EnvironmentVariable[]
  }[]
> = computed(() => {
  return [
    {
      id: "variables",
      label: t("environment.variables"),
      emptyStateLabel: t("empty.environments"),
      isSecret: false,
      variables: nonSecretVars.value,
    },
    {
      id: "secret",
      label: t("environment.secrets"),
      emptyStateLabel: t("empty.secret_environments"),
      isSecret: true,
      variables: secretVars.value,
    },
  ]
})

const options = ref<TippyComponent | null>(null)
const tippyActions = ref<HTMLDivElement | null>(null)

const editingName = ref<string | null>(null)
const editingID = ref<string>("")
const vars = ref<EnvironmentVariable[]>([
  {
    id: idTicker.value++,
    env: { key: "", currentValue: "", initialValue: "", secret: false },
  },
])

const services = ref<EnvironmentService[]>([
  { id: uniqueID(), name: "", url: "" },
])

const secretEnvironmentService = useService(SecretEnvironmentService)
const currentEnvironmentValueService = useService(CurrentValueService)

const secretVars = computed(() =>
  pipe(
    vars.value,
    A.filter((e) => e.env.secret)
  )
)

const nonSecretVars = computed(() =>
  pipe(
    vars.value,
    A.filter((e) => !e.env.secret)
  )
)

const clearIcon = refAutoReset<typeof IconTrash2 | typeof IconDone>(
  IconTrash2,
  1000
)

const globalEnv = useReadonlyStream(globalEnv$, {} as GlobalEnvironment)

type SelectedEnv = "variables" | "secret" | "services"

const selectedEnvOption = ref<SelectedEnv>("variables")

const workingEnv = computed(() => {
  if (props.editingEnvironmentIndex === "Global") {
    const vars =
      props.editingVariableName === "Global"
        ? props.envVars()
        : getGlobalVariables()
    return {
      name: "Global",
      variables: vars,
    } as Environment
  } else if (props.action === "new") {
    return {
      id: uniqueID(),
      name: "",
      variables: props.envVars(),
    }
  } else if (props.editingEnvironmentIndex !== null) {
    return getEnvironment({
      type: "MY_ENV",
      index: props.editingEnvironmentIndex,
    })
  }
  return null
})

const envList = useReadonlyStream(environments$, []) || props.envVars()

const evnExpandError = computed(() => {
  const variables = pipe(
    vars.value,
    A.map((e) => e.env)
  )

  return pipe(
    variables,
    A.exists(({ currentValue }) =>
      E.isLeft(parseTemplateStringE(currentValue, variables))
    )
  )
})

const liveEnvs = computed(() => {
  if (evnExpandError.value) {
    return []
  }

  if (props.editingEnvironmentIndex === "Global") {
    return [
      ...vars.value.map((x) => ({ ...x.env, sourceEnv: editingName.value! })),
    ]
  }
  return [
    ...vars.value.map((x) => ({ ...x.env, sourceEnv: editingName.value! })),
    ...globalEnv.value.variables.map((x) => ({ ...x, sourceEnv: "Global" })),
  ]
})

const workingEnvID = computed(() => {
  const activeEnv = workingEnv.value

  if (activeEnv && "id" in activeEnv) {
    return activeEnv.id
  }

  return uniqueID()
})

const getCurrentValue = (id: string | "Global", varIndex: number) => {
  const env = workingEnv.value?.variables[varIndex]
  if (env?.secret) {
    return secretEnvironmentService.getSecretEnvironmentVariable(id, varIndex)
      ?.value
  }
  return currentEnvironmentValueService.getEnvironmentVariable(id, varIndex)
    ?.currentValue
}

const getInitialValue = (id: string | "Global", varIndex: number) => {
  const env = workingEnv.value?.variables[varIndex]
  if (env?.secret) {
    return secretEnvironmentService.getSecretEnvironmentVariable(id, varIndex)
      ?.initialValue
  }
  return env?.initialValue
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      editingName.value = workingEnv.value?.name ?? null
      selectedEnvOption.value = props.isSecretOptionSelected
        ? "secret"
        : "variables"

      if (props.editingEnvironmentIndex !== "Global") {
        editingID.value = workingEnvID.value
      }
      vars.value = pipe(
        workingEnv.value?.variables ?? [],
        A.mapWithIndex((index, e) => ({
          id: idTicker.value++,
          env: {
            key: e.key,
            currentValue:
              getCurrentValue(
                props.editingEnvironmentIndex === "Global"
                  ? "Global"
                  : workingEnvID.value,
                index
              ) ?? e.currentValue,
            initialValue:
              getInitialValue(
                props.editingEnvironmentIndex === "Global"
                  ? "Global"
                  : workingEnvID.value,
                index
              ) ?? e.initialValue,
            secret: e.secret,
          },
        }))
      )
      // Load services from working environment
      const loadedServices = (workingEnv.value as any)?.services ?? []
      services.value =
        loadedServices.length > 0
          ? loadedServices.map((s: any) => ({
              id: s.id || uniqueID(),
              name: s.name || "",
              url: s.url || "",
            }))
          : [{ id: uniqueID(), name: "", url: "" }]
    }
  }
)

const clearContent = () => {
  vars.value = vars.value.filter((e) =>
    selectedEnvOption.value === "secret" ? !e.env.secret : e.env.secret
  )

  clearIcon.value = IconDone
  toast.success(`${t("state.cleared")}`)
}

const addEnvironmentVariable = () => {
  vars.value.push({
    id: idTicker.value++,
    env: {
      key: "",
      currentValue: "",
      initialValue: "",
      secret: selectedEnvOption.value === "secret",
    },
  })
}

const removeEnvironmentVariable = (id: number) => {
  const index = vars.value.findIndex((e) => e.id === id)
  if (index !== -1) {
    vars.value.splice(index, 1)
  }
}

const addService = () => {
  services.value.push({
    id: uniqueID(),
    name: "",
    url: "",
  })
}

const removeService = (id: string) => {
  const index = services.value.findIndex((s) => s.id === id)
  if (index !== -1) {
    services.value.splice(index, 1)
  }
}

const saveEnvironment = () => {
  if (!editingName.value) {
    toast.error(`${t("environment.invalid_name")}`)
    return
  }

  if (editingName.value.trim().length === 0) {
    toast.error(`${t("environment.short_name")}`)
    return
  }

  const filteredVariables = pipe(
    vars.value,
    A.filterMap(
      flow(
        O.fromPredicate((e) => e.env.key !== ""),
        O.map((e) => e.env)
      )
    )
  )

  const secretVariables = pipe(
    filteredVariables,
    A.filterMapWithIndex((i, e) =>
      e.secret
        ? O.some({
            key: e.key,
            value: e.currentValue,
            varIndex: i,
            initialValue: e.initialValue,
          })
        : O.none
    )
  )

  const nonSecretVariables = pipe(
    filteredVariables,
    A.filterMapWithIndex((i, e) =>
      !e.secret
        ? O.some({
            key: e.key,
            currentValue: e.currentValue,
            varIndex: i,
            isSecret: e.secret ?? false,
          })
        : O.none
    )
  )

  if (secretVariables.length > 0) {
    if (editingID.value) {
      secretEnvironmentService.addSecretEnvironment(
        editingID.value,
        secretVariables
      )
    } else if (props.editingEnvironmentIndex === "Global") {
      secretEnvironmentService.addSecretEnvironment("Global", secretVariables)
    }
  }
  if (nonSecretVariables.length > 0) {
    if (editingID.value) {
      currentEnvironmentValueService.addEnvironment(
        editingID.value,
        nonSecretVariables
      )
    } else if (props.editingEnvironmentIndex === "Global") {
      currentEnvironmentValueService.addEnvironment(
        "Global",
        nonSecretVariables
      )
    }
  }

  const variables = pipe(
    filteredVariables,
    A.map((e) => ({
      key: e.key,
      secret: e.secret,
      initialValue: e.secret ? "" : e.initialValue,
      currentValue: "",
    }))
  )

  const filteredServices = services.value.filter(
    (s) => s.name !== "" && s.url !== ""
  )

  const environmentUpdated: Environment = {
    v: 3,
    id: uniqueID(),
    name: editingName.value,
    variables,
    services: filteredServices,
  }

  if (props.action === "new") {
    // Creating a new environment
    createEnvironment(
      editingName.value,
      environmentUpdated.variables,
      editingID.value
    )
    setSelectedEnvironmentIndex({
      type: "MY_ENV",
      index: envList.value.length - 1,
    })
    toast.success(`${t("environment.created")}`)

    platform.analytics?.logEvent({
      type: "HOPP_CREATE_ENVIRONMENT",
      workspaceType: "personal",
    })
  } else if (props.editingEnvironmentIndex === "Global") {
    // Editing the Global environment
    setGlobalEnvVariables(environmentUpdated)
    toast.success(`${t("environment.updated")}`)
  } else if (props.editingEnvironmentIndex !== null) {
    const envID =
      environmentsStore.value.environments[props.editingEnvironmentIndex].id

    // Editing an environment
    updateEnvironment(
      props.editingEnvironmentIndex,
      envID
        ? {
            ...environmentUpdated,
            id: envID,
          }
        : {
            ...environmentUpdated,
          }
    )
    toast.success(`${t("environment.updated")}`)
  }

  hideModal()
}

const hideModal = () => {
  editingName.value = null
  selectedEnvOption.value = "variables"
  emit("hide-modal")
}
</script>
