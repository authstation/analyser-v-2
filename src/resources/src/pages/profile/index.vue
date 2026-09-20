<template>
  <Pagebar title="My Profile" />

  <!-- Floating Toast Notification -->
  <div 
    v-if="toastMessage" 
    class="position-fixed top-0 start-50 translate-middle-x mt-4 px-4 py-3 rounded-3 shadow-lg text-white d-flex align-items-center gap-3 toast-slide" 
    :class="toastType === 'error' ? 'bg-danger' : 'bg-success'" 
    style="z-index: 9999; min-width: 340px; max-width: 90vw;"
  >
    <i :class="toastType === 'error' ? 'bi bi-exclamation-octagon-fill fs-4' : 'bi bi-check-circle-fill fs-4'"></i>
    <div class="flex-grow-1">
      <div class="fw-bold small">{{ toastType === 'error' ? 'Failed' : 'Success' }}</div>
      <div class="small opacity-90">{{ toastMessage }}</div>
    </div>
    <button type="button" class="btn-close btn-close-white ms-auto" aria-label="Close" @click="toastMessage = ''"></button>
  </div>

  <div class="container-fluid mt-4 mb-5">
    <div class="row">
      <!-- Left Column: Plan Details & Profile Settings -->
      <div class="col-md-5 mb-4">
        <!-- Plan Details -->
        <div class="card p-4 shadow-sm border-custom bg-surface mb-4" v-if="profile.planName">
          <h4 class="mb-4 fw-light border-bottom border-custom pb-2">Plan Details</h4>
          <div class="mb-2">
            <span class="text-muted">Current Plan:</span>
            <span class="badge bg-success ms-2">{{ profile.planName }}</span>
          </div>
          <div class="mb-2">
            <span class="text-muted">Payment Status:</span>
            <span class="badge ms-2" :class="{
              'bg-success': profile.paymentStatus === 'approved',
              'bg-warning text-dark': profile.paymentStatus === 'pending',
              'bg-danger': profile.paymentStatus === 'rejected',
              'bg-secondary': !profile.paymentStatus
            }">{{ (profile.paymentStatus || 'None').toUpperCase() }}</span>
          </div>
          <div class="mb-2" v-if="profile.trxId">
            <span class="text-muted">bKash / TrxID:</span>
            <span class="text-warning fw-bold ms-2">{{ profile.trxId }}</span>
          </div>
          <div class="mb-2" v-if="profile.planStartDate">
            <span class="text-muted">Expires On:</span>
            <span class="ms-2 fw-bold">{{ calculateExpiry(profile.planStartDate, profile.planDurationDays) }}</span>
          </div>
          <div class="mb-2">
            <span class="text-muted">Joined Date:</span>
            <span class="ms-2">{{ profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-' }}</span>
          </div>
        </div>

        <!-- Profile Settings -->
        <div class="card p-4 shadow-sm border-custom bg-surface">
          <h4 class="mb-4 fw-light border-bottom border-custom pb-2">Profile Settings</h4>
          <form @submit.prevent="updateProfile" autocomplete="off">
            <div class="mb-3">
              <label class="form-label text-muted">Email address</label>
              <input type="email" v-model="profile.email" class="form-control" disabled />
            </div>
            <div class="mb-3">
              <label class="form-label">Full Name</label>
              <input type="text" v-model="profile.name" class="form-control" placeholder="Enter your full name" autocomplete="off" />
            </div>
            <hr class="border-custom my-4">
            <h5 class="fw-light mb-3">Change Password</h5>
            <div class="mb-3">
              <label class="form-label">New Password</label>
              <input type="password" v-model="passwords.new" class="form-control" placeholder="Minimum 6 characters" autocomplete="new-password" />
            </div>
            <div class="mb-4">
              <label class="form-label">Confirm Password</label>
              <input type="password" v-model="passwords.confirm" class="form-control" placeholder="Retype new password" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="loading">
              <i class="bi bi-save me-1"></i> {{ loading ? 'Saving...' : 'Save Changes' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Right Column: Subscriptions -->
      <div class="col-md-7 mb-4">
        <div class="card p-4 shadow-sm border-custom bg-surface h-100">
          <h4 class="mb-4 fw-light border-bottom border-custom pb-2">Office Subscriptions</h4>

          <h6 class="text-muted mb-3">Your Offices</h6>
          <div v-if="subscriptions.length === 0" class="alert alert-secondary border-custom">
            No subscriptions found.
          </div>
          <div v-else class="list-group mb-4">
            <div v-for="sub in subscriptions" :key="sub.id"
                 class="list-group-item bg-surface border-custom d-flex justify-content-between align-items-center">
              <div>
                <i class="bi bi-building me-2 text-info"></i>
                <span class="fw-bold">{{ sub.circleName || 'Unknown Office' }}</span>
              </div>
              <span :class="['badge', getStatusClass(sub.status)]">
                {{ sub.status ? sub.status.charAt(0).toUpperCase() + sub.status.slice(1) : '' }}
              </span>
            </div>
          </div>

          <hr class="border-custom mb-4">

          <!-- Request New Subscription (User only) -->
          <div v-if="!isAdmin">
            <h6 class="text-muted mb-3">Request Access to a New Office</h6>
            <form @submit.prevent="requestSubscription" class="d-flex flex-column gap-3">
              <div class="position-relative" ref="profileDropdownRef">
                <div 
                  class="form-control d-flex justify-content-between align-items-center bg-surface border-custom user-select-none cursor-pointer py-2"
                  :class="{ 'border-primary ring-focus': dropdownOpen }"
                  @click="toggleDropdown"
                  role="button"
                  tabindex="0"
                >
                  <div class="d-flex align-items-center text-truncate pe-2">
                    <i class="bi bi-building me-2 text-info opacity-75"></i>
                    <span v-if="selectedCircle" class="fw-semibold text-truncate">
                      {{ selectedCircle.name }}
                      <small v-if="selectedCircle.divisionName" class="text-muted ms-1">({{ selectedCircle.divisionName }})</small>
                    </span>
                    <span v-else class="text-muted">-- Choose an office / circle --</span>
                  </div>
                  <div class="d-flex align-items-center gap-1 text-muted">
                    <i v-if="selectedCircleId" class="bi bi-x-circle-fill text-secondary me-1 hover-opacity cursor-pointer" title="Clear" @click.stop="clearSelection"></i>
                    <i class="bi" :class="dropdownOpen ? 'bi-chevron-up text-primary' : 'bi-chevron-down'"></i>
                  </div>
                </div>

                <!-- Dropdown Menu / Popup -->
                <div 
                  v-if="dropdownOpen" 
                  class="position-absolute start-0 end-0 bg-surface border border-custom rounded-3 shadow-lg mt-1 p-2 z-3 custom-dropdown-menu"
                  @click.stop
                >
                  <div class="px-1 pb-2">
                    <input 
                      ref="searchInputRef"
                      type="text" 
                      v-model="searchQuery" 
                      class="form-control form-control-sm bg-surface border-custom shadow-none" 
                      placeholder="Type to search..."
                      @keydown.esc="dropdownOpen = false"
                    />
                  </div>

                  <div class="dropdown-list-scroll" style="max-height: 220px; overflow-y: auto;">
                    <div v-if="filteredCircles.length === 0" class="text-center py-3 text-muted small">
                      <i class="bi bi-slash-circle d-block fs-5 mb-1 opacity-50"></i>
                      No offices match "{{ searchQuery }}"
                    </div>

                    <div 
                      v-for="c in filteredCircles" 
                      :key="c.id"
                      class="dropdown-circle-item d-flex justify-content-between align-items-center px-2 py-2 rounded-2 mb-1 cursor-pointer"
                      :class="{
                        'active-item bg-primary text-white': selectedCircleId === String(c.id),
                        'opacity-60 disabled-item': isAlreadySubscribed(Number(c.id))
                      }"
                      @click="handleSelectCircle(c)"
                    >
                      <div class="text-truncate pe-2">
                        <div class="fw-semibold text-truncate small" :class="selectedCircleId === String(c.id) ? 'text-white' : ''">{{ c.name }}</div>
                        <div class="text-xs text-truncate" :class="selectedCircleId === String(c.id) ? 'text-white text-opacity-75' : 'text-muted'">
                          {{ c.divisionName || 'Circle Office' }}
                        </div>
                      </div>
                      <div class="flex-shrink-0 ms-2">
                        <span v-if="isAlreadySubscribed(Number(c.id))" class="badge bg-secondary bg-opacity-25 text-muted text-xs">
                          Requested
                        </span>
                        <i v-else-if="selectedCircleId === String(c.id)" class="bi bi-check-lg text-white"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" class="btn btn-primary py-2 fw-semibold d-flex align-items-center justify-content-center gap-2" :disabled="requestingSub || !selectedCircleId">
                <span v-if="requestingSub" class="spinner-border spinner-border-sm"></span>
                <i v-else class="bi bi-send-plus"></i>
                <span>{{ requestingSub ? 'Submitting...' : 'Submit Request' }}</span>
              </button>
            </form>
          </div>
          <div v-else class="alert alert-info py-2 border-custom">
            As an Admin, you have unrestricted access to all offices.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import axios from '@/plugins/axios';
import { authUser } from '@/composables/useAuth';

useHead({ title: 'My Profile | Analyser' });

const isAdmin = computed(() => {
  if (!authUser.value) return false;
  const roleVal = authUser.value.role;
  const r = (typeof roleVal === 'string' ? roleVal : roleVal?.name || '').toLowerCase();
  return r === 'admin' || r === 'super-admin' || r === 'superadmin';
});

const profile = ref<any>({
  email: '',
  name: '',
  planName: '',
  planStartDate: '',
  planDurationDays: 0,
  trxId: '',
  paymentStatus: '',
  createdAt: ''
});

const passwords = ref({ new: '', confirm: '' });
const loading = ref(false);
const subscriptions = ref<any[]>([]);
const availableCircles = ref<any[]>([]);
const selectedCircleId = ref('');
const requestingSub = ref(false);
const dropdownOpen = ref(false);
const searchQuery = ref('');
const profileDropdownRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const selectedCircle = computed(() => {
  return availableCircles.value.find(c => String(c.id) === String(selectedCircleId.value)) || null;
});

const subscribedCircleIds = computed(() => {
  return new Set(subscriptions.value.map(s => Number(s.circleId)));
});

const isAlreadySubscribed = (circleId: number) => {
  return subscribedCircleIds.value.has(circleId);
};

const filteredCircles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return availableCircles.value;
  return availableCircles.value.filter((c: any) => {
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const divMatch = (c.divisionName || '').toLowerCase().includes(q);
    return nameMatch || divMatch;
  });
});

const toggleDropdown = async () => {
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    await nextTick();
    searchInputRef.value?.focus();
  }
};

const handleSelectCircle = (c: any) => {
  if (isAlreadySubscribed(Number(c.id))) return;
  selectedCircleId.value = String(c.id);
  dropdownOpen.value = false;
  searchQuery.value = '';
};

const clearSelection = () => {
  selectedCircleId.value = '';
  searchQuery.value = '';
};

const handleGlobalClick = (e: MouseEvent) => {
  if (profileDropdownRef.value && !profileDropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false;
  }
};

const calculateExpiry = (start: string, duration: number) => {
  if (!start || !duration) return '-';
  const d = new Date(start);
  d.setDate(d.getDate() + Number(duration));
  return d.toLocaleDateString();
};

const getStatusClass = (status: string) => ({
  approved: 'bg-success', rejected: 'bg-danger', pending: 'bg-warning text-dark', inactive: 'bg-secondary'
}[status] ?? 'bg-secondary');

const fetchProfile = async () => {
  try {
    const res = await axios.get('/api/auth/me');
    const data = res.data?.data || res.data;
    if (data) Object.assign(profile.value, data);
  } catch (err: any) {
    console.error('Fetch profile error:', err);
  }
};

const fetchSubscriptions = async () => {
  try {
    const res = await axios.get('/api/subscriptions/my');
    subscriptions.value = res.data?.data ?? res.data ?? [];
  } catch (err: any) {
    console.error('Fetch subscriptions error:', err);
  }
};

const fetchCircles = async () => {
  try {
    const res = await axios.get('/api/settings/circles');
    availableCircles.value = res.data?.data ?? res.data ?? [];
  } catch (err: any) {
    console.error('Fetch circles error:', err);
  }
};

const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
let toastTimer: any = null;

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = message;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 4000);
};

const updateProfile = async () => {
  if (passwords.value.new && passwords.value.new !== passwords.value.confirm) {
    showToast('Passwords do not match!', 'error');
    return;
  }
  loading.value = true;
  try {
    await axios.put('/api/profile', { name: profile.value.name, password: passwords.value.new || undefined });
    showToast('Profile updated successfully!', 'success');
    passwords.value = { new: '', confirm: '' };
  } catch (err: any) {
    showToast(err.response?.data?.error || 'Failed to update profile', 'error');
  } finally {
    loading.value = false;
  }
};

const requestSubscription = async () => {
  if (!selectedCircleId.value) return;
  requestingSub.value = true;
  try {
    const res = await axios.post('/api/subscriptions/request', { circleId: Number(selectedCircleId.value) });
    showToast(res.data?.message || 'Subscription requested successfully!', 'success');
    selectedCircleId.value = '';
    await fetchSubscriptions();
  } catch (err: any) {
    showToast(err.response?.data?.error || err.response?.data?.message || 'Failed to request subscription', 'error');
  } finally {
    requestingSub.value = false;
  }
};

onMounted(() => {
  fetchProfile();
  fetchSubscriptions();
  fetchCircles();
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.toast-slide {
  animation: slideDownToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideDownToast {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.cursor-pointer {
  cursor: pointer;
}
.hover-opacity:hover {
  opacity: 0.75;
}
.text-xs {
  font-size: 0.75rem;
}
.ring-focus {
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}
.dropdown-circle-item {
  transition: background-color 0.15s ease;
}
.dropdown-circle-item:not(.disabled-item):not(.active-item):hover {
  background-color: var(--app-hover, rgba(255, 255, 255, 0.08));
}
.dropdown-circle-item.disabled-item {
  cursor: not-allowed;
}
.custom-dropdown-menu {
  background-color: var(--app-surface, #212529) !important;
  border-color: var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35) !important;
  animation: fadeInDown 0.15s ease-out;
}
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.dropdown-list-scroll::-webkit-scrollbar {
  width: 5px;
}
.dropdown-list-scroll::-webkit-scrollbar-thumb {
  background: var(--app-border, rgba(255, 255, 255, 0.2));
  border-radius: 4px;
}
</style>
