<template>
  <!-- main start -->
  <div class="main w-100 min-vh-100 d-flex flex-column" :class="{ 'no-transition': disableTransition, 'dashboard-page-bg': isSurfaceBg }">
    <Header
      :is-scrolled="headerScrolled"
      :theme-mode="themeMode"
      :on-logout="logout"
      :on-toggle-theme="ui.cycleTheme" />
    <div class="content-wrapper container-xxl px-3 px-sm-4 flex-grow-1">
      <!-- content start -->
      <div class="content pt-3">
        <router-view />
      </div>
      <!-- content end -->
      <Footer />
    </div>
  </div>
  <!-- main end -->
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onBeforeUnmount, onMounted, provide, reactive, ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import Footer from "@/layouts/Layout/Footer.vue";
import Header from "@/layouts/Layout/Header.vue";
import { useAdminUiStore } from "@/stores/admin-ui";
import { useAuthStore } from "@/stores/auth";

const ui = useAdminUiStore();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { themeMode } = storeToRefs(ui);
const headerScrolled = ref(false);
const disableTransition = ref(true);

const isSurfaceBg = computed(() => {
  const p = route.path;
  return (
    p === "/" ||
    p === "/dashboard" ||
    p === "/modules/bin-analyser" ||
    p === "/modules/return-data-analyser" ||
    p.startsWith("/modules/revenue-analyser") ||
    p.startsWith("/modules/ibas-analysis")
  );
});

const featureButtons = reactive<
  Array<{
    id: symbol;
    icon?: string;
    label: string;
    title: string;
    attrs?: Record<string, string>;
    onClick: () => void;
  }>
>([]);
provide("featureButtons", featureButtons);

async function logout() {
  await auth.logout();
  await router.push("/login");
}

function onScroll() {
  const y = window.scrollY;
  if (y > 20) {
    headerScrolled.value = true;
  } else if (y < 5) {
    headerScrolled.value = false;
  }
}

onMounted(() => {
  ui.initTheme();

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Force reflow then enable transitions on next frame
  void document.body.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      disableTransition.value = false;
    });
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  ui.cleanupTheme();
});
</script>

<style scoped>
.main.dashboard-page-bg {
  background-color: var(--app-surface, #212529) !important;
}
</style>

