<template>
  <HoppSmartModal
    v-if="show"
    dialog
    :title="t('folder.edit')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col space-y-4">
        <HoppSmartInput
          v-model="editingName"
          placeholder=" "
          :label="t('action.label')"
          input-styles="floating-input"
          @submit="editFolder"
        />
        <div class="flex flex-col space-y-2 px-2">
          <label class="font-semibold text-secondaryDark text-sm">
            {{ t("environment.select_service") }}
          </label>
          <select
            v-model="selectedServiceId"
            class="input rounded border border-divider bg-primary px-3 py-2 text-secondaryDark focus:border-dividerDark focus:outline-none"
          >
            <option value="">
              {{ t("action.none") }}
            </option>
            <option
              v-for="svc in services"
              :key="svc.id"
              :value="svc.id"
            >
              {{ svc.name }} ({{ svc.url }})
            </option>
          </select>
          <p
            v-if="services.length === 0"
            class="text-xs text-secondaryLight"
          >
            {{ t("environment.service_url_description") }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <span class="flex space-x-2">
        <HoppButtonPrimary
          :label="t('action.save')"
          :loading="loadingState"
          outline
          @click="editFolder"
        />
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
      </span>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"

const t = useI18n()
const toast = useToast()

const props = withDefaults(
  defineProps<{
    show: boolean
    loadingState: boolean
    editingFolderName: string
    selectedServiceId?: string | null
    services?: { id: string; name: string; url: string }[]
  }>(),
  {
    show: false,
    loadingState: false,
    editingFolderName: "",
    selectedServiceId: null,
    services: () => [],
  }
)

const emit = defineEmits<{
  (e: "submit", name: string, selectedServiceId: string | null): void
  (e: "hide-modal"): void
}>()

const editingName = ref("")
const selectedServiceId = ref<string | null>(null)

watch(
  () => props.editingFolderName,
  (newName) => {
    editingName.value = newName
  }
)

watch(
  () => props.show,
  (show) => {
    if (show) {
      selectedServiceId.value = props.selectedServiceId ?? null
    }
  }
)

const editFolder = () => {
  if (props.loadingState) {
    return
  }

  if (editingName.value.trim() === "") {
    toast.error(t("folder.invalid_name"))
    return
  }

  emit("submit", editingName.value, selectedServiceId.value)
}

const hideModal = () => {
  editingName.value = ""
  emit("hide-modal")
}
</script>
