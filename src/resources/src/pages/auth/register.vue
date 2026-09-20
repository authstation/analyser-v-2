<template>
  <div class="d-flex align-items-center justify-content-center min-vh-100 py-5">
    <div class="card p-4 shadow-lg transition-all w-100 mx-3" :style="{ maxWidth: selectedPlan ? '900px' : '500px' }">
      <div class="mb-4">
        <router-link to="/" class="text-decoration-none d-inline-block mb-3">
          <AppLogo icon-size="2.2rem" text-size="1.5rem" />
        </router-link>
        <h3 class="fw-bold mb-1 text-center">Create an Account</h3>
        <p class="text-muted small mb-0 text-center">Join Analyser today</p>
      </div>

      <!-- Centered Toast Notification -->
      <div v-if="toastMessage" class="position-fixed top-50 start-50 translate-middle px-4 py-3 rounded shadow-lg text-white text-center" :class="toastType === 'error' ? 'bg-danger' : 'bg-success'" style="z-index: 9999; pointer-events: none; animation: fadeIn 0.2s ease-in-out;">
        <span class="fw-bold fs-6">{{ toastMessage }}</span>
      </div>

      <form @submit.prevent="handleSignup">
        <div class="row">
          <!-- Left Column: Signup Data -->
          <div :class="selectedPlan ? 'col-md-6 pe-md-4' : 'col-12'">
            <div class="mb-3">
              <label class="form-label text-muted">Full Name</label>
              <input type="text" v-model="name" class="form-control" placeholder="John Doe" required />
            </div>
            <div class="mb-3">
              <label class="form-label text-muted">Email address</label>
              <input type="email" v-model="email" class="form-control" placeholder="name@example.com" required />
            </div>
            <div class="mb-3">
              <label class="form-label text-muted">Password</label>
              <div class="position-relative">
                <input 
                  :type="showPassword ? 'text' : 'password'" 
                  v-model="password" 
                  class="form-control pe-5" 
                  placeholder="e.g. Secret@123" 
                  required 
                />
                <button 
                  type="button" 
                  class="btn position-absolute top-50 end-0 translate-middle-y text-secondary border-0 bg-transparent p-0 pe-3 d-flex align-items-center shadow-none" 
                  style="z-index: 5; cursor: pointer;" 
                  tabindex="-1"
                  @click="showPassword = !showPassword"
                >
                  <i class="bi fs-6" :class="showPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
              <small class="text-muted d-block mt-1" style="font-size: 0.75rem;">
                Must contain at least 6 characters with uppercase (A-Z), lowercase (a-z), and a special character (!@#$...).
              </small>
            </div>
            <div class="mb-3">
              <label class="form-label text-muted">Confirm Password</label>
              <div class="position-relative">
                <input 
                  :type="showConfirmPassword ? 'text' : 'password'" 
                  v-model="confirmPassword" 
                  class="form-control pe-5" 
                  placeholder="Retype password" 
                  required 
                />
                <button 
                  type="button" 
                  class="btn position-absolute top-50 end-0 translate-middle-y text-secondary border-0 bg-transparent p-0 pe-3 d-flex align-items-center shadow-none" 
                  style="z-index: 5; cursor: pointer;" 
                  tabindex="-1"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <i class="bi fs-6" :class="showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
            </div>

            <!-- Circle Selection -->
            <div class="mb-4">
              <label class="form-label text-muted fw-bold mb-2">
                Select Office(s) 
                <span class="text-info fw-normal small" v-if="selectedPlan">
                  (Max: {{ selectedPlan.maxCircles >= 9999 ? 'Unlimited' : selectedPlan.maxCircles }})
                </span>
              </label>
              
              <MultiSelectDropdown
                v-model="circleIds"
                :options="circleOptions"
                placeholder="Choose your office(s)..."
                :show-all-option="false"
                size="md"
              />

              <small class="text-danger mt-1 d-block" v-if="circleIds.length === 0">Please select at least one office.</small>
              <small class="text-danger mt-1 d-block" v-else-if="selectedPlan && circleIds.length > selectedPlan.maxCircles">
                You can select maximum {{ selectedPlan.maxCircles }} office(s) with this plan.
              </small>
            </div>
          </div>

          <!-- Right Column: Transaction Data -->
          <div v-if="selectedPlan" class="col-md-6 ps-md-4 mt-4 mt-md-0 align-self-start custom-divider-right">
            <!-- Plan Details & Payment Instructions -->
            <div class="alert border-info shadow-sm p-3 mb-3" style="margin-top: 32px; background-color: transparent;">
              <h5 class="text-info fw-bold mb-2"><i class="bi bi-tag-fill me-2"></i>Selected Plan: {{ selectedPlan.name }}</h5>
              <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">Plan Price:</span>
                <span class="fw-medium">৳{{ selectedPlan.price }}</span>
              </div>
              <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                <span class="text-muted">bKash Charge (1.8%):</span>
                <span class="fw-medium">৳{{ Math.ceil(selectedPlan.price * 0.018) }}</span>
              </div>
              <div class="d-flex justify-content-between fw-bold fs-5 mb-3">
                <span>Total Payable:</span>
                <span class="text-warning">৳{{ selectedPlan.price + Math.ceil(selectedPlan.price * 0.018) }}</span>
              </div>
              
              <div class="p-3 rounded border text-center mb-2" style="background-color: var(--app-hover, rgba(0, 0, 0, 0.15));">
                <p class="mb-1 small text-muted">Send money via bKash to:</p>
                <h5 class="fw-bold text-success mb-0 tracking-wider">01719950891</h5>
              </div>
              <p class="small text-muted text-center mb-0 mt-2">
                After sending the money, enter the Transaction ID below.
              </p>
            </div>

            <!-- TrxID for Plans - precisely aligned with Select Office(s) -->
            <div class="mb-4">
              <label class="form-label text-muted fw-bold mb-2">bKash Transaction ID (TrxID)</label>
              <input type="text" v-model="trxId" class="form-control text-warning border-warning" placeholder="e.g. 9J4K8R2X" required />
            </div>
          </div>
        </div>

        <div class="row pt-3 border-top">
          <div class="col-md-6 d-flex justify-content-center mb-3 mb-md-0">
            <button type="submit" class="btn px-5" :class="(loading || !isFormValid) ? 'btn-secondary' : 'btn-primary'" :disabled="loading || !isFormValid">
              {{ loading ? 'Signing up...' : 'Sign Up' }}
            </button>
          </div>
          
          <div class="col-md-6 d-flex justify-content-center align-items-center">
            <span class="text-muted small me-1">Already have an account?</span>
            <router-link to="/login" class="text-warning text-decoration-none small fw-bold">Sign in</router-link>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useHead } from '@vueuse/head';
import AppLogo from '@/components/AppLogo.vue';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';
import { useAuthStore } from '@/stores/auth';
import axios from '@/plugins/axios';

useHead({ title: 'Register' });

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const circleIds = ref<number[]>([]);
const trxId = ref('');
const circles = ref<any[]>([]);
const selectedPlan = ref<any>(null);

const toastMessage = ref('');
const toastType = ref<'error' | 'success'>('error');
const loading = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const circleOptions = computed(() => {
  return circles.value.map((c: any) => ({
    label: c.name,
    value: Number(c.id)
  }));
});

const isFormValid = computed(() => {
  if (!name.value.trim() || !email.value.trim()) return false;
  if (password.value.length < 6) return false;
  if (!/[a-z]/.test(password.value)) return false;
  if (!/[A-Z]/.test(password.value)) return false;
  if (!/[^A-Za-z0-9]/.test(password.value)) return false;
  if (password.value !== confirmPassword.value) return false;
  if (circleIds.value.length === 0) return false;
  
  if (selectedPlan.value) {
    if (circleIds.value.length > selectedPlan.value.maxCircles) return false;
    if (!trxId.value.trim()) return false;
  }
  
  return true;
});

onMounted(async () => {
  try {
    const res = await axios.get('/api/settings/circles');
    if (res.data?.data && Array.isArray(res.data.data)) {
      circles.value = res.data.data;
    }
  } catch (err) {
    console.error('Failed to load circles from database:', err);
  }
  
  const planId = route.query.planId;
  
  if (planId) {
    try {
      const res = await axios.get(`/api/plans/${planId}`);
      if (res.data?.data) {
        selectedPlan.value = res.data.data;
      }
    } catch (err) {
      console.error('Failed to load plan details', err);
      triggerToast('Failed to load the selected plan. Please try again.', 'error');
    }
  }
});

const triggerToast = (msg: string, type: 'error' | 'success' = 'error', duration = 2500) => {
  toastMessage.value = msg;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, duration);
};

const handleSignup = async () => {
  if (password.value.length < 6) {
    triggerToast("Password must be at least 6 characters long", 'error');
    return;
  }
  if (!/[a-z]/.test(password.value)) {
    triggerToast("Password must contain at least one lowercase letter (a-z)", 'error');
    return;
  }
  if (!/[A-Z]/.test(password.value)) {
    triggerToast("Password must contain at least one uppercase letter (A-Z)", 'error');
    return;
  }
  if (!/[^A-Za-z0-9]/.test(password.value)) {
    triggerToast("Password must contain at least one special character (!@#$ etc.)", 'error');
    return;
  }
  if (password.value !== confirmPassword.value) {
    triggerToast("Passwords do not match", 'error');
    return;
  }

  if (circleIds.value.length === 0) {
    triggerToast("Please select at least one office.", 'error');
    return;
  }

  if (selectedPlan.value && circleIds.value.length > selectedPlan.value.maxCircles) {
    triggerToast(`You can only select up to ${selectedPlan.value.maxCircles} office(s) with this plan.`, 'error');
    return;
  }

  loading.value = true;
  try {
    const payload: any = {
      name: name.value,
      email: email.value,
      password: password.value,
      password_confirmation: confirmPassword.value,
      circleIds: circleIds.value
    };
    
    if (selectedPlan.value) {
      payload.planId = selectedPlan.value.id;
      payload.trxId = trxId.value;
    }

    await axios.post('/api/auth/register', payload);
    
    triggerToast("Account created! Redirecting...", 'success', 1800);
    setTimeout(() => {
      router.push('/login');
    }, 1800);
  } catch (err: any) {
    const errorData = err.response?.data;
    let message = 'Registration failed. Please try again.';
    if (typeof errorData?.message === 'string') {
      message = errorData.message;
    } else if (typeof errorData?.error === 'string') {
      message = errorData.error;
    } else if (errorData?.issues && Array.isArray(errorData.issues) && errorData.issues.length > 0) {
      message = errorData.issues[0].message || 'Validation error';
    } else if (errorData?.error?.issues && Array.isArray(errorData.error.issues) && errorData.error.issues.length > 0) {
      message = errorData.error.issues[0].message || 'Validation error';
    } else if (err.message) {
      message = err.message;
    }
    triggerToast(message, 'error', 3500);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.custom-divider-right {
  position: relative;
}
.custom-divider-right::before {
  content: "";
  position: absolute;
  top: 32px;
  bottom: 24px;
  left: 0;
  width: 1px;
  background-color: var(--app-border, rgba(108, 117, 125, 0.3));
}

@media (max-width: 767px) {
  .custom-divider-right::before {
    display: none;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, -60%); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}
</style>
