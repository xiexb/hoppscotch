<template>
  <div class="flex min-h-screen flex-col items-center justify-between">
    <!-- Success state -->
    <div
      v-if="state === 'success'"
      class="flex flex-1 flex-col items-center justify-center px-4"
    >
      <icon-lucide-check-circle class="h-12 w-12 text-green-500" />
      <h1 class="heading mt-4">{{ t("auth.password_reset_success") }}</h1>
      <p class="mt-2 text-center text-secondaryLight">
        {{ t("auth.password_reset_success_description") }}
      </p>
      <HoppButtonPrimary
        :label="t('auth.login')"
        class="mt-8"
        to="/"
      />
    </div>

    <!-- Error state -->
    <div
      v-else-if="state === 'error'"
      class="flex flex-1 flex-col items-center justify-center px-4"
    >
      <icon-lucide-x-circle class="h-12 w-12 text-red-500" />
      <h1 class="heading mt-4">{{ t("error.something_went_wrong") }}</h1>
      <p class="mt-2 text-center text-secondaryLight">
        {{ errorMessage }}
      </p>
      <HoppButtonPrimary
        :label="t('auth.login')"
        class="mt-8"
        to="/"
      />
    </div>

    <!-- No token state -->
    <div
      v-else-if="!token"
      class="flex flex-1 flex-col items-center justify-center px-4"
    >
      <icon-lucide-x-circle class="h-12 w-12 text-red-500" />
      <h1 class="heading mt-4">{{ t("error.reset_token_invalid") }}</h1>
      <p class="mt-2 text-center text-secondaryLight">
        {{ t("error.reset_token_invalid_description") }}
      </p>
      <HoppButtonPrimary
        :label="t('auth.login')"
        class="mt-8"
        to="/"
      />
    </div>

    <!-- Reset form -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center px-4"
    >
      <div class="w-full max-w-sm">
        <h1 class="heading text-center">{{ t("auth.reset_password") }}</h1>
        <p class="mt-2 mb-8 text-center text-secondaryLight">
          {{ t("auth.reset_password_description") }}
        </p>

        <form class="flex flex-col space-y-4" @submit.prevent="submitReset">
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

          <HoppButtonPrimary
            :loading="state === 'loading'"
            :disabled="!isFormValid"
            type="submit"
            :label="t('auth.reset_password')"
          />
        </form>
      </div>
    </div>

    <footer class="p-4">
      <HoppButtonSecondary
        class="!font-bold tracking-wide !text-secondaryDark"
        label="HOPPSCOTCH"
        to="/"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from "vue"

import { useI18n } from "@hoppscotch/common/composables/i18n"
import { useToast } from "@hoppscotch/common/composables/toast"
import { initializeApp } from "@hoppscotch/common/helpers/app"
import { platform } from "@hoppscotch/common/platform"

const t = useI18n()
const toast = useToast()

onBeforeMount(() => {
  initializeApp()
})

type ResetState = "initial" | "loading" | "success" | "error"

const state = ref<ResetState>("initial")
const token = ref("")
const newPassword = ref("")
const confirmPassword = ref("")
const errorMessage = ref("")

const isFormValid = computed(() => {
  return (
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value
  )
})

// Extract token from URL query params
onBeforeMount(() => {
  const url = new URL(window.location.href)
  token.value = url.searchParams.get("token") || ""
})

const submitReset = async () => {
  if (!platform.auth.verifyPasswordReset) return
  if (!isFormValid.value) return

  if (newPassword.value !== confirmPassword.value) {
    toast.error(`${t("error.password_mismatch")}`)
    return
  }

  state.value = "loading"

  try {
    await platform.auth.verifyPasswordReset(token.value, newPassword.value)
    state.value = "success"
  } catch (e: any) {
    console.error(e)
    const msg = e.response?.data?.message || e.message || ""
    if (msg === "auth/reset_token_expired") {
      errorMessage.value = t("error.reset_token_expired")
    } else if (msg === "auth/reset_token_invalid") {
      errorMessage.value = t("error.reset_token_invalid")
    } else if (msg === "auth/password_too_short") {
      errorMessage.value = t("error.password_too_short")
    } else {
      errorMessage.value = t("error.something_went_wrong")
    }
    state.value = "error"
  }
}
</script>

<route lang="yaml">
meta:
  layout: empty
</route>
