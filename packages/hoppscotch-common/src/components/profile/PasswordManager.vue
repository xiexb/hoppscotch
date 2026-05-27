<template>
  <section v-if="hasPasswordSupport" class="p-4">
    <h4 class="font-semibold text-secondaryDark">
      {{ t("settings.password") }}
    </h4>
    <div class="my-1 text-secondaryLight">
      {{ t("settings.password_description") }}
    </div>
    <div class="py-4">
      <HoppButtonSecondary
        filled
        outline
        :label="t('auth.change_password')"
        type="submit"
        @click="showPasswordModal = true"
      />
    </div>

    <HoppSmartModal
      v-if="showPasswordModal"
      dialog
      :title="t('auth.change_password')"
      styles="sm:max-w-md"
      @close="closeModal"
    >
      <template #body>
        <form class="flex flex-col space-y-4" @submit.prevent="submitPassword">
          <HoppSmartInput
            v-model="oldPassword"
            type="password"
            placeholder=" "
            :label="t('auth.old_password')"
            input-styles="floating-input"
          />
          <HoppSmartInput
            v-model="newPassword"
            type="password"
            placeholder=" "
            :label="t('auth.new_password')"
            input-styles="floating-input"
          />
          <HoppSmartInput
            v-model="confirmPassword"
            type="password"
            placeholder=" "
            :label="t('auth.confirm_password')"
            input-styles="floating-input"
          />
          <p
            v-if="newPassword.length > 0 && newPassword.length < 8"
            class="text-tiny text-red-500"
          >
            {{ t("auth.password_min_length") }}
          </p>
        </form>
      </template>
      <template #footer>
        <div class="flex flex-1 justify-between">
          <HoppButtonSecondary
            :label="t('action.cancel')"
            outline
            @click="closeModal"
          />
          <HoppButtonPrimary
            :label="t('auth.change_password')"
            :loading="isSubmitting"
            :disabled="!isFormValid"
            @click="submitPassword"
          />
        </div>
      </template>
    </HoppSmartModal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"

import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"

import { platform } from "~/platform"

import * as E from "fp-ts/Either"

const t = useI18n()
const toast = useToast()

const showPasswordModal = ref(false)
const oldPassword = ref("")
const newPassword = ref("")
const confirmPassword = ref("")
const isSubmitting = ref(false)

const hasPasswordSupport = computed(() => {
  return !!platform.auth.changePassword
})

const isFormValid = computed(() => {
  return (
    oldPassword.value.length > 0 &&
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value
  )
})

const closeModal = () => {
  showPasswordModal.value = false
  oldPassword.value = ""
  newPassword.value = ""
  confirmPassword.value = ""
}

const submitPassword = async () => {
  if (!platform.auth.changePassword) return
  if (!isFormValid.value) return

  if (newPassword.value !== confirmPassword.value) {
    toast.error(`${t("error.password_mismatch")}`)
    return
  }

  isSubmitting.value = true

  try {
    const res = await platform.auth.changePassword(
      oldPassword.value,
      newPassword.value
    )

    if (E.isRight(res)) {
      toast.success(`${t("auth.password_change_success")}`)
      closeModal()
    } else {
      const errorMsg = res.left
      if (errorMsg === "auth/invalid_old_password") {
        toast.error(`${t("error.invalid_old_password")}`)
      } else if (errorMsg === "auth/password_too_short") {
        toast.error(`${t("error.password_too_short")}`)
      } else {
        toast.error(`${t("error.something_went_wrong")}`)
      }
    }
  } catch (e: any) {
    console.error(e)
    toast.error(`${t("error.something_went_wrong")}`)
  } finally {
    isSubmitting.value = false
  }
}
</script>
