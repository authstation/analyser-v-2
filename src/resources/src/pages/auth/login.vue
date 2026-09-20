<template>
  <!-- Floating Toast Notification -->
  <div 
    v-if="toastMessage" 
    class="position-fixed top-0 start-50 translate-middle-x mt-4 px-4 py-3 rounded-3 shadow-lg text-white d-flex align-items-center gap-3 toast-slide" 
    :class="toastType === 'error' ? 'bg-danger' : 'bg-success'" 
    style="z-index: 9999; min-width: 340px; max-width: 90vw;"
  >
    <i :class="toastType === 'error' ? 'bi bi-exclamation-octagon-fill fs-4' : 'bi bi-check-circle-fill fs-4'"></i>
    <div class="flex-grow-1">
      <div class="fw-bold small">{{ toastType === 'error' ? 'Login Failed' : 'Success' }}</div>
      <div class="small opacity-90">{{ toastMessage }}</div>
    </div>
    <button type="button" class="btn-close btn-close-white ms-auto" aria-label="Close" @click="toastMessage = ''"></button>
  </div>

  <div class="container position-absolute start-50 top-50 translate-middle">
    <div class="auth col-12 col-sm-9 col-md-7 col-lg-5 col-xl-4 mx-auto py-3">
      <div class="card card-body border-0">
        <div class="d-block mb-3 text-center">
          <AppLogo icon-size="2.5rem" text-size="1.8rem" stacked />
        </div>
        <form @submit.prevent="onSubmit">
          <div class="mb-4">
            <Input
              id="email"
              v-model="form.data.email"
              type="email"
              label="email"
              placeholder="Enter your email..."
              :err="form.errors.email"
              focus
              must />
          </div>
          <div class="mb-4">
            <input-password-toggle
              id="password"
              v-model="form.data.password"
              label="password"
              placeholder="Enter your password..."
              :err="form.errors.password"
              must />
          </div>
          <div class="mb-4 d-flex align-items-center justify-content-between">
            <Checkbox id="remember-me" v-model="form.data.remember" label="Remember me" />
            <router-link to="/forget-password" class="text-decoration-none mb-1">Forget Password?</router-link>
          </div>
          <button type="submit" class="btn btn-primary w-100" :disabled="processing">
            <span>Login</span>
            <i class="bi bi-box-arrow-in-right ms-2"></i>
          </button>
          <div class="text-center mt-3">
            <span class="text-muted">Don't have an account?</span>
            <router-link to="/plans" class="ms-1 text-decoration-none">Register</router-link>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { ref } from "vue";
import { useRouter } from "vue-router";
import Checkbox from "@/components/Checkbox.vue";
import Input from "@/components/Input.vue";
import InputPasswordToggle from "@/components/InputPasswordToggle.vue";
import AppLogo from "@/components/AppLogo.vue";
import { useGumForm } from "@/plugins/gum";
import { useAuthStore } from "@/stores/auth";

useHead({ title: "Login" });

const router = useRouter();
const auth = useAuthStore();

const toastMessage = ref("");
const toastType = ref<"error" | "success">("error");
let toastTimer: any = null;

const triggerToast = (msg: string, type: "error" | "success" = "error", duration = 4000) => {
  toastMessage.value = msg;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = "";
  }, duration);
};

const formatErrorMessage = (error: any): string => {
  if (!error) return "Login failed. Please try again.";

  const responseData = error.response?.data;
  
  if (responseData) {
    if (typeof responseData.message === "string") {
      if (responseData.message.startsWith("{") && responseData.message.includes('"name": "ZodError"')) {
        try {
          const parsed = JSON.parse(responseData.message);
          if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
            const first = parsed.issues[0];
            if (first.path?.includes("password")) return "Please enter your password.";
            if (first.path?.includes("email")) return "Please enter a valid email address.";
            return first.message || "Invalid input.";
          }
        } catch {}
      }
      return responseData.message;
    }
    
    if (Array.isArray(responseData.issues) && responseData.issues.length > 0) {
      const first = responseData.issues[0];
      if (first.path?.includes("password")) return "Please enter your password.";
      if (first.path?.includes("email")) return "Please enter a valid email address.";
      return first.message || "Invalid input.";
    }

    if (typeof responseData.error === "string") {
      return responseData.error;
    }
  }

  if (typeof error.message === "string") {
    if (error.message.startsWith("{") && error.message.includes('"name": "ZodError"')) {
      try {
        const parsed = JSON.parse(error.message);
        if (Array.isArray(parsed.issues) && parsed.issues.length > 0) {
          const first = parsed.issues[0];
          if (first.path?.includes("password")) return "Please enter your password.";
          if (first.path?.includes("email")) return "Please enter a valid email address.";
          return first.message || "Invalid input.";
        }
      } catch {}
    }
    if (error.message.includes("401")) return "Invalid email or password.";
    if (error.message.includes("403")) return "Access denied. Please check your account status.";
    return error.message;
  }

  return "Unable to login. Please check your credentials.";
};

const form = useGumForm({
  email: "",
  password: "",
  remember: false
});

const processing = form.processing;

const onSubmit = async () => {
  const email = String(form.data.email || "").trim();
  const password = form.data.password;

  if (!email) {
    triggerToast("Please enter your email address.", "error");
    return;
  }
  if (!password) {
    triggerToast("Please enter your password.", "error");
    return;
  }

  await form.post(
    "/api/auth/login",
    {
      email,
      password,
      remember: !!form.data.remember
    },
    {
      onSuccess: async () => {
        auth.initialized = false;
        await auth.bootstrap();
        form.reset("password");
        const redirect = (router.currentRoute.value.query.redirect as string) || "/dashboard";
        await router.push(redirect);
      },
      onError: (_errors, error: any) => {
        const msg = formatErrorMessage(error);
        triggerToast(msg, "error");
        form.reset("password");
      }
    }
  );
};
</script>

<style lang="scss" scoped>
.toast-slide {
  animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
