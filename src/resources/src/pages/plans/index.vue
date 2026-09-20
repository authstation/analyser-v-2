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
                <button 
                  v-if="userProfile?.planId === plan.id && userProfile?.paymentStatus === 'approved'" 
                  class="btn btn-secondary w-100 fw-bold mt-auto rounded-3 py-2" 
                  disabled
                >
                  <i class="bi bi-check-circle-fill me-1"></i> Current Plan
                </button>
                <button 
                  v-else 
                  @click="openUpgradeModal(plan)" 
                  class="btn btn-outline-info w-100 fw-bold mt-auto rounded-3 py-2"
                >
                  <i class="bi bi-arrow-up-circle-fill me-1"></i> Choose / Upgrade
                </button>
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

    <!-- Plan Upgrade Modal -->
    <div v-if="selectedUpgradePlan" class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 z-3 bg-black bg-opacity-75">
      <div class="card bg-surface border-custom shadow-lg text-start w-100" style="max-width: 480px;">
        <div class="card-header bg-transparent border-bottom border-custom d-flex justify-content-between align-items-center py-3">
          <h5 class="mb-0 fw-bold text-info">
            <i class="bi bi-rocket-takeoff-fill me-2"></i>Upgrade to {{ selectedUpgradePlan.name }}
          </h5>
          <button type="button" class="btn-close btn-close-white" @click="selectedUpgradePlan = null"></button>
        </div>
        <div class="card-body p-4">
          <!-- Price & Charge Summary -->
          <div class="card bg-black bg-opacity-25 border border-custom p-3 mb-3">
            <div class="d-flex justify-content-between mb-1">
              <span class="text-muted small">Plan Price:</span>
              <span class="fw-medium text-light small">৳{{ selectedUpgradePlan.price }}</span>
            </div>
            <div class="d-flex justify-content-between mb-2 pb-1 border-bottom border-custom">
              <span class="text-muted small">bKash Charge (1.8%):</span>
              <span class="fw-medium text-light small">৳{{ Math.ceil(selectedUpgradePlan.price * 0.018) }}</span>
            </div>
            <div class="d-flex justify-content-between fw-bold mb-2">
              <span>Total Payable:</span>
              <span class="text-warning fs-5">৳{{ selectedUpgradePlan.price + Math.ceil(selectedUpgradePlan.price * 0.018) }}</span>
            </div>

            <!-- bKash Send Money Instruction Box -->
            <div class="p-2 rounded border border-custom text-center mb-1 bg-surface">
              <p class="mb-0 text-xs text-muted">Send money via bKash to:</p>
              <h5 class="fw-bold text-success mb-0 tracking-wider font-monospace">01719950891</h5>
            </div>
            <div class="text-xs text-muted text-center mt-1">
              After sending payment, enter the bKash Transaction ID (TrxID) below.
            </div>
          </div>

          <!-- Note about billing cycle (Method 1) -->
          <div class="alert alert-info py-2 px-3 small mb-3 d-flex align-items-center">
            <i class="bi bi-info-circle-fill me-2 fs-5 flex-shrink-0"></i>
            <div>Your new <strong>{{ selectedUpgradePlan.durationDays || 30 }}-day</strong> plan cycle will activate once administration verifies this payment.</div>
          </div>

          <form @submit.prevent="submitUpgrade">
            <div class="mb-3">
              <label class="form-label text-muted small fw-bold">bKash Transaction ID (TrxID) *</label>
              <input 
                type="text" 
                v-model="upgradeTrxId" 
                class="form-control text-warning border-warning" 
                placeholder="e.g. 9J4K8R2X" 
                required 
              />
            </div>

            <div v-if="upgradeError" class="alert alert-danger py-2 small mb-3">
              <i class="bi bi-exclamation-triangle-fill me-1"></i> {{ upgradeError }}
            </div>

            <div class="d-flex justify-content-end gap-2 pt-2 border-top border-custom">
              <button type="button" class="btn btn-sm btn-secondary" @click="selectedUpgradePlan = null" :disabled="submittingUpgrade">
                Cancel
              </button>
              <button type="submit" class="btn btn-sm btn-primary px-4 fw-bold" :disabled="submittingUpgrade || !upgradeTrxId.trim()">
                <span v-if="submittingUpgrade" class="spinner-border spinner-border-sm me-1" role="status"></span>
                {{ submittingUpgrade ? 'Submitting...' : 'Submit Upgrade Request' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Centered Toast Notification -->
    <div v-if="toastMessage" class="position-fixed top-50 start-50 translate-middle px-4 py-3 rounded shadow-lg text-white text-center z-3" :class="toastType === 'error' ? 'bg-danger' : 'bg-success'" style="pointer-events: none;">
      <span class="fw-bold fs-6">{{ toastMessage }}</span>
    </div>

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
import { useRouter } from 'vue-router';
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

const router = useRouter();
const auth = useAuthStore();
const ui = useAdminUiStore();

const plans = ref<any[]>([]);
const userProfile = ref<any>(null);
const loading = ref(true);
const error = ref('');

const selectedUpgradePlan = ref<any>(null);
const upgradeTrxId = ref('');
const submittingUpgrade = ref(false);
const upgradeError = ref('');

const toastMessage = ref('');
const toastType = ref<'error' | 'success'>('success');

const triggerToast = (msg: string, type: 'error' | 'success' = 'success', duration = 3000) => {
  toastMessage.value = msg;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, duration);
};

const fetchPlans = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/plans');
    const data = res.data.data || res.data || [];
    plans.value = Array.isArray(data) ? data : [];

    if (auth.isAuthenticated) {
      try {
        const profileRes = await axios.get('/api/subscriptions/my');
        if (profileRes.data?.data) {
          userProfile.value = profileRes.data.data[0] || {};
        }
        const meRes = await axios.get('/api/auth/me');
        if (meRes.data?.data) {
          userProfile.value = { ...userProfile.value, ...meRes.data.data };
        }
      } catch (err) {
        console.warn('Could not fetch user profile on plans page:', err);
      }
    }
  } catch (err: any) {
    console.error('Failed to load plans:', err);
    error.value = 'Failed to load pricing plans. Please try again later.';
  } finally {
    loading.value = false;
  }
};

const openUpgradeModal = (plan: any) => {
  selectedUpgradePlan.value = plan;
  upgradeTrxId.value = '';
  upgradeError.value = '';
};

const submitUpgrade = async () => {
  if (!upgradeTrxId.value.trim() || !selectedUpgradePlan.value) return;

  submittingUpgrade.value = true;
  upgradeError.value = '';
  try {
    const res = await axios.post('/api/plans/upgrade', {
      planId: selectedUpgradePlan.value.id,
      trxId: upgradeTrxId.value.trim(),
    });

    selectedUpgradePlan.value = null;
    triggerToast(res.data?.message || 'Upgrade request submitted successfully! Redirecting to subscriptions...', 'success', 2500);
    setTimeout(() => {
      router.push('/my-subscriptions');
    }, 2000);
  } catch (err: any) {
    upgradeError.value = err.response?.data?.message || err.response?.data?.error || 'Failed to submit upgrade request. Please try again.';
  } finally {
    submittingUpgrade.value = false;
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
