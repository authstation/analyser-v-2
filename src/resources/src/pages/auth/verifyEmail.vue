<template>
  <div class="container position-absolute start-50 top-50 translate-middle">
    <div class="auth col-12 col-sm-9 col-md-7 col-lg-5 col-xl-4 mx-auto py-3">
      <div class="card card-body border-0">
        <div class="d-block mb-3 text-center">
          <AppLogo icon-size="2.5rem" text-size="1.8rem" stacked />
        </div>
        <h4 class="text-center">Email Verification</h4>
        <p
          v-if="message"
          class="text-center alert py-2 mt-2"
          :class="isError ? 'alert-danger text-danger' : 'alert-success text-success'">
          {{ message }}
        </p>
        <div class="text-center mt-2">
          <router-link to="/login">
            <span>Back to login</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "@/components/Button.vue";
import AppLogo from "@/components/AppLogo.vue";
import { useGum } from "@/plugins/gum";

useHead({ title: "Verify Email" });

const route = useRoute();

const email = String(route.query.email || "").trim();
const token = String(route.query.token || "").trim();
const message = ref("Verifying your email...");
const isError = ref(false);

const { post } = useGum();

const verify = async () => {
  if (!email || !token) {
    isError.value = true;
    message.value = "Invalid verification link. Please request a new one.";
    return;
  }

  await post(
    "/api/auth/verify-email",
    { email, token },
    {
      onSuccess: () => {
        isError.value = false;
        message.value = "Email verified successfully. You can now login.";
      },
      onError: (_errors, error) => {
        isError.value = true;
        message.value = error instanceof Error ? error.message : "Failed to verify email";
      }
    }
  );
};

void verify();
</script>

<style lang="scss" scoped></style>
