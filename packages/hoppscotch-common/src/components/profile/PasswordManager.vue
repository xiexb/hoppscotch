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
        :label="hasPassword ? t('auth.change_password') : t('auth.set_password')"
        type="submit"
        @click="openModal"
      />
    </div>

    <HoppSmartModal
      v-if="showPasswordModal"
      dialog
      :title="hasPassword ? t('auth.change_password') : t('auth.set_password')"
      styles="sm:max-w-md"
      @close="closeModal"
    >
      <template #body>
        <form class="flex flex-col space-y-4" @submit.prevent="submitPassword">
          <!-- 修改密码模式：显示旧密码 -->
          <HoppSmartInput
            v-if="hasPassword"
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
            :label="t('auth.password')"
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
          <p
            v-if="confirmPassword.length > 0 && newPassword !== confirmPassword"
            class="text-tiny text-red-500"
          >
            {{ t("error.password_mismatch") }}
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
            :label="hasPassword ? t('auth.change_password') : t('auth.set_password')"
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
import { computed, onMounted, ref } from "vue"

import { useI18n } from "@composables/i18n"
import { useToast } from "@composables/toast"

import { platform } from "~/platform"

import * as E from "fp-ts/Either"

const t = useI18n()
const toast = useToast()

const showPasswordModal = ref(false)
const hasPassword = ref(false)
const oldPassword = ref("")
const newPassword = ref("")
const confirmPassword = ref("")
const isSubmitting = ref(false)

const hasPasswordSupport = computed(() => {
  return !!platform.auth.setPassword || !!platform.auth.changePassword
})

const isFormValid = computed(() => {
  if (hasPassword.value) {
    // 修改密码：需要旧密码 + 新密码≥8位 + 确认匹配
    return (
      oldPassword.value.length > 0 &&
      newPassword.value.length >= 8 &&
      newPassword.value === confirmPassword.value
    )
  }
  // 设置密码：新密码≥8位 + 确认匹配
  return (
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value
  )
})

const openModal = () => {
  showPasswordModal.value = true
}

const closeModal = () => {
  showPasswordModal.value = false
  oldPassword.value = ""
  newPassword.value = ""
  confirmPassword.value = ""
}

onMounted(async () => {
  if (platform.auth.getPasswordStatus) {
    try {
      const status = await platform.auth.getPasswordStatus()
      hasPassword.value = status.hasPassword
    } catch {
      hasPassword.value = false
    }
  }
})

const submitPassword = async () => {
  if (!isFormValid.value) return

  if (newPassword.value !== confirmPassword.value) {
    toast.error(`${t("error.password_mismatch")}`)
    return
  }

  isSubmitting.value = true

  try {
    if (hasPassword.value) {
      // 修改密码
      if (!platform.auth.changePassword) return
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
    } else {
      // 首次设置密码
      if (!platform.auth.setPassword) return
      const res = await platform.auth.setPassword(newPassword.value)

      if (E.isRight(res)) {
        toast.success(`${t("auth.password_set_success")}`)
        hasPassword.value = true
        closeModal()
      } else {
        const errorMsg = res.left
        if (errorMsg === "auth/password_too_short") {
          toast.error(`${t("error.password_too_short")}`)
        } else if (errorMsg === "auth/password_already_set") {
          hasPassword.value = true
          toast.info(`${t("auth.password_already_set")}`)
          closeModal()
        } else {
          toast.error(`${t("error.something_went_wrong")}`)
        }
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
