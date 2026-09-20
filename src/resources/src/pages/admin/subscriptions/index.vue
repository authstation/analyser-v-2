<template>
  <Pagebar title="Office Access Approvals" />

  <!-- Error/Loading -->
  <div v-if="loading" class="text-center py-5 container-fluid mt-4">
    <div class="spinner-border text-primary" role="status"></div>
    <div class="mt-2 text-muted">Loading subscriptions...</div>
  </div>

  <div v-else-if="error" class="alert alert-danger border-danger container-fluid mt-4 mx-3">
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <i class="bi bi-exclamation-triangle me-2"></i> {{ error }}
      </div>
      <button @click="fetchSubscriptions" class="btn btn-sm btn-outline-danger">
        <i class="bi bi-arrow-clockwise me-1"></i> Retry
      </button>
    </div>
  </div>

  <!-- Subscriptions Table -->
  <div v-else class="card bg-surface border-custom shadow-sm flex-grow-1 overflow-hidden d-flex flex-column mx-3 mt-4 mb-5">
    <div class="card-header bg-transparent border-bottom border-custom d-flex justify-content-between align-items-center py-3 px-3">
      <button @click="$router.back()" class="btn btn-outline-secondary btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Back
      </button>
      <button @click="fetchSubscriptions" class="btn btn-outline-info btn-sm">
        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
      </button>
    </div>

    <div class="table-responsive flex-grow-1" style="overflow-y: auto;">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top" style="z-index: 10;">
          <tr>
            <th>User Name</th>
            <th>Email</th>
            <th>Requested Office</th>
            <th>Access Type</th>
            <th>Status</th>
            <th>Requested On</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="subscriptions.length === 0">
            <td colspan="7" class="text-center text-muted py-4">No subscriptions found.</td>
          </tr>
          <tr v-for="sub in subscriptions" :key="sub.id">
            <td class="fw-bold">{{ sub.userName || 'N/A' }}</td>
            <td>{{ sub.userEmail }}</td>
            <td>{{ sub.circleName || 'N/A' }}</td>
            <td>
              <div v-if="sub.isAddon">
                <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1 mb-1">
                  <i class="bi bi-tag-fill me-1"></i> ৳{{ sub.addonPrice || 300 }} Single Add-on
                </span>
                <div v-if="sub.trxId" class="small text-muted font-monospace">
                  <span class="text-info">{{ sub.paymentMethod || 'Trx' }}:</span> {{ sub.trxId }}
                </div>
              </div>
              <div v-else>
                <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1">
                  <i class="bi bi-shield-check me-1"></i> Plan Quota
                </span>
              </div>
            </td>
            <td>
              <span :class="['badge py-1 px-2', statusClass(sub.status)]">
                {{ formatStatus(sub.status) }}
              </span>
            </td>
            <td>{{ sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '-' }}</td>
            <td class="text-end">
              <!-- Pending Request: Approve / Reject -->
              <div v-if="sub.status === 'pending'" class="btn-group btn-group-sm">
                <button @click="updateStatus(sub.id, 'approved')" class="btn btn-success" title="Approve">
                  <i class="bi bi-check-lg me-1"></i> Approve
                </button>
                <button @click="updateStatus(sub.id, 'rejected')" class="btn btn-danger" title="Reject">
                  <i class="bi bi-x-lg me-1"></i> Reject
                </button>
              </div>

              <!-- Approved or Inactive: Modern Toggle Switch -->
              <div v-else-if="sub.status === 'approved' || sub.status === 'inactive'" class="d-inline-flex align-items-center justify-content-end">
                <label class="custom-toggle" :title="sub.status === 'approved' ? 'Click to make Inactive' : 'Click to make Active'">
                  <input 
                    type="checkbox" 
                    :id="'toggle-' + sub.id" 
                    :checked="sub.status === 'approved'" 
                    @change="toggleStatus(sub, $event)"
                  >
                  <span class="toggle-track"></span>
                </label>
              </div>

              <!-- Rejected: Option to Approve -->
              <div v-else-if="sub.status === 'rejected'" class="btn-group btn-group-sm">
                <button @click="updateStatus(sub.id, 'approved')" class="btn btn-outline-success" title="Approve">
                  <i class="bi bi-check-circle me-1"></i> Approve
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import axios from '@/plugins/axios';

useHead({ title: 'Manage Subscriptions | Admin' });

const subscriptions = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const formatStatus = (s: string) => {
  if (s === 'approved') return 'Active';
  if (s === 'inactive') return 'Inactive';
  if (s === 'pending') return 'Pending';
  if (s === 'rejected') return 'Rejected';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

const statusClass = (s: string) => ({
  approved: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25',
  inactive: 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25',
  rejected: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25',
  pending: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'
}[s] ?? 'bg-secondary');

const fetchSubscriptions = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/subscriptions/admin/all');
    const data = res.data?.data ?? res.data ?? [];
    subscriptions.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('Fetch subscriptions error:', err);
    error.value = err.response?.data?.message ?? err.response?.data?.error ?? err.message ?? 'Failed to load subscriptions';
    subscriptions.value = [];
  } finally {
    loading.value = false;
  }
};

const updateStatus = async (id: number, status: string) => {
  try {
    await axios.post('/api/subscriptions/admin/status', { id, status });
    await fetchSubscriptions();
  } catch (err: any) {
    alert(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to update status');
  }
};

const toggleStatus = async (sub: any, event: Event) => {
  const target = event.target as HTMLInputElement;
  const isChecked = target.checked;
  const nextStatus = isChecked ? 'approved' : 'inactive';
  sub.status = nextStatus;
  try {
    await axios.post('/api/subscriptions/admin/status', { id: sub.id, status: nextStatus });
  } catch (err: any) {
    sub.status = isChecked ? 'inactive' : 'approved';
    target.checked = !isChecked;
    alert(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to update status');
  }
};

onMounted(fetchSubscriptions);
</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.cursor-pointer {
  cursor: pointer;
}

/* Custom Modern Toggle Switch */
.custom-toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  margin: 0;
  vertical-align: middle;
}
.custom-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.custom-toggle .toggle-track {
  position: absolute;
  inset: 0;
  background-color: #495057;
  border-radius: 24px;
  cursor: pointer;
  transition: background-color 0.25s ease, border-color 0.25s ease;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.custom-toggle .toggle-track::before {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  left: 2px;
  top: 2px;
  background-color: #ffffff;
  border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.custom-toggle input:checked + .toggle-track {
  background-color: #198754;
  border-color: #198754;
}
.custom-toggle input:checked + .toggle-track::before {
  transform: translateX(20px);
}
</style>
