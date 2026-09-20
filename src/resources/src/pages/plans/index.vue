<template>
  <div class="plans-page min-vh-100 d-flex flex-column justify-content-between position-relative">
    <!-- Navbar / Header -->
    <header class="w-100 px-3 px-md-5 py-3 d-flex justify-content-between align-items-center plans-header border-bottom">
      <div class="d-flex align-items-center">
        <router-link to="/" class="text-decoration-none">
          <AppLogo icon-size="1.5rem" text-size="1.1rem" />
        </router-link>
      </div>
      <div class="d-flex align-items-center gap-3">
        <!-- Theme Toggle Button -->
        <button 
          type="button" 
          title="Toggle Theme" 
          class="btn p-0 border-0 shadow-none theme-toggle-btn d-flex align-items-center justify-content-center" 
          aria-label="Toggle Theme" 
          @click="ui.cycleTheme"
        >
          <i :class="ui.themeIcon" class="fs-5"></i>
        </button>

        <template v-if="auth.isAuthenticated">
          <router-link to="/dashboard" class="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold shadow-sm d-flex align-items-center gap-1">
            <i class="bi bi-speedometer2"></i>
            <span>Dashboard</span>
          </router-link>
        </template>
        <template v-else>
          <router-link to="/login" class="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1 fw-semibold text-app">
            Login
          </router-link>
        </template>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container text-center my-auto py-5" id="plans">
      <div class="mb-5">
        <h1 class="display-5 fw-bold mb-3 page-title">Choose the right plan for you</h1>
        <p class="lead text-muted mx-auto" style="max-width: 600px;">
          Get advanced insights into BIN, Entities, and Area data.
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="my-5 py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading plans...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="alert alert-danger mx-auto my-4 text-center" style="max-width: 500px;">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      </div>

      <!-- Pricing Plans Grid -->
      <div v-else class="row justify-content-center g-4">
        <div 
          v-for="plan in displayedPlans" 
          :key="plan.id" 
          class="col-12 col-md-6 col-lg-4 col-xl-3"
        >
          <div class="card h-100 pricing-card shadow-sm">
            <div class="card-body d-flex flex-column p-4 text-start">
              <h4 class="card-title fw-bold text-info mb-3 text-truncate">{{ plan.name }}</h4>
              
              <div class="price-box mb-4">
                <span class="fs-5 fw-bold price-amount align-top mt-1">৳</span><span class="fs-3 fw-bold price-amount">{{ plan.price }}</span>
                <span class="text-muted small ms-1" v-if="plan.durationDays">/ {{ plan.durationDays }} Days</span>
              </div>

              <ul class="list-unstyled mb-4 flex-grow-1 feature-list">
                <li class="mb-2 d-flex align-items-center">
                  <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                  <span>Duration: <strong>{{ plan.durationDays }} Days</strong></span>
                </li>
                <li class="mb-2 d-flex align-items-center">
                  <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                  <span>Max Circles: <strong>{{ plan.maxCircles >= 9999 ? 'Unlimited' : plan.maxCircles }}</strong></span>
                </li>
                <li class="mb-2 d-flex align-items-center">
                  <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                  <span>Access to All Modules</span>
                </li>
                <li class="mb-2 d-flex align-items-center">
                  <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                  <span>Interactive Reports</span>
                </li>
              </ul>

              <template v-if="auth.isAuthenticated">
                <router-link to="/my-subscriptions" class="btn btn-outline-info w-100 fw-bold mt-auto rounded-3 py-2">
                  Choose Plan
                </router-link>
              </template>
              <template v-else>
                <router-link :to="`/register?planId=${plan.id}`" class="btn btn-outline-info w-100 fw-bold mt-auto rounded-3 py-2">
                  Choose Plan
                </router-link>
              </template>
            </div>
          </div>
        </div>

        <!-- Empty state fallback -->
        <div v-if="displayedPlans.length === 0" class="col-12 text-muted mt-5">
          <h5>No pricing plans are currently available.</h5>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="w-100 py-3 text-center text-muted small plans-footer border-top">
      <div class="container">
        <span>© {{ new Date().getFullYear() }} Analyser. All rights reserved.</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useHead } from '@vueuse/head';
import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';
import { useAdminUiStore } from '@/stores/admin-ui';
import axios from '@/plugins/axios';

useHead({
  title: 'Choose Plan | Analyser',
  meta: [
    { name: 'description', content: 'Choose the right plan for you - Analyser Platform' }
  ]
});

const auth = useAuthStore();
const ui = useAdminUiStore();

const plans = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const fetchPlans = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/plans');
    const data = res.data.data || res.data || [];
    plans.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('Failed to load plans:', err);
    error.value = 'Failed to load pricing plans. Please try again later.';
  } finally {
    loading.value = false;
  }
};

const displayedPlans = computed(() => {
  if (!plans.value || plans.value.length === 0) {
    return [
      { id: 1, name: 'Basic Plan', price: 500, durationDays: 30, maxCircles: 1, isActive: true },
      { id: 2, name: 'Standard Plan', price: 1000, durationDays: 30, maxCircles: 3, isActive: true },
      { id: 3, name: 'Premium Plan', price: 2000, durationDays: 30, maxCircles: 9999, isActive: true }
    ];
  }
  const activeOnly = plans.value.filter((p: any) => p.isActive !== false);
  const list = activeOnly.length > 0 ? activeOnly : plans.value;
  return [...list].sort((a: any, b: any) => a.price - b.price);
});

onMounted(() => {
  ui.initTheme();
  fetchPlans();
});
</script>

<style scoped lang="scss">
.plans-page {
  background-color: var(--app-bg, #0b0f19);
  color: var(--app-text, #f8f9fa);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.plans-header {
  background-color: var(--app-surface, #212529);
  border-color: var(--app-border, rgba(255, 255, 255, 0.12)) !important;
}

.plans-footer {
  background-color: var(--app-surface, #212529);
  border-color: var(--app-border, rgba(255, 255, 255, 0.12)) !important;
}

.page-title {
  color: var(--app-text, #ffffff);
}

.text-app {
  color: var(--app-text, inherit) !important;
  border-color: var(--app-border, #6c757d) !important;

  &:hover {
    background-color: var(--app-hover, rgba(255, 255, 255, 0.1));
    color: var(--app-text, #ffffff) !important;
  }
}

.theme-toggle-btn {
  color: var(--app-text, #f8f9fa);
  transition: transform 0.15s ease, opacity 0.15s ease;

  &:hover {
    transform: scale(1.1);
    opacity: 0.85;
  }
}

.pricing-card {
  background-color: var(--app-surface, #212529);
  border: 2px solid var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  border-radius: 0.85rem;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  &:hover {
    transform: translateY(-8px);
    border-color: #0dcaf0 !important;
    box-shadow: 0 1rem 2.5rem rgba(13, 202, 240, 0.18) !important;
  }
}

.price-amount {
  color: var(--app-text, #ffffff);
}

.feature-list li {
  font-size: 0.92rem;
  color: var(--app-text, #e9ecef);
}
</style>
