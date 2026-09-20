<template>
  <Pagebar title="User Management" />

  <!-- Error/Loading -->
  <div v-if="loading" class="text-center py-5 container-fluid mt-4">
    <div class="spinner-border text-primary" role="status"></div>
    <div class="mt-2 text-muted">Loading users...</div>
  </div>

  <div v-else-if="error" class="alert alert-danger border-danger container-fluid mt-4 mx-3">
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <i class="bi bi-exclamation-triangle me-2"></i> {{ error }}
      </div>
      <button @click="fetchUsers" class="btn btn-sm btn-outline-danger">
        <i class="bi bi-arrow-clockwise me-1"></i> Retry
      </button>
    </div>
  </div>

  <!-- Users Table -->
  <div v-else class="card bg-surface border-custom shadow-sm flex-grow-1 overflow-hidden d-flex flex-column mx-3 mt-4 mb-5">
    <div class="card-header bg-transparent border-bottom border-custom d-flex justify-content-between align-items-center py-3 px-3">
      <button @click="$router.back()" class="btn btn-outline-secondary btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Back
      </button>
      <button @click="fetchUsers" class="btn btn-outline-info btn-sm">
        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
      </button>
    </div>

    <div class="table-responsive flex-grow-1" style="overflow-y: auto;">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top" style="z-index: 10;">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Current Plan</th>
            <th>bKash / TrxID</th>
            <th>Status</th>
            <th>Plan Expires On</th>
            <th>Joined Date</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="8" class="text-center text-muted py-4">No users found.</td>
          </tr>
          <tr v-for="user in users" :key="user.id">
            <td class="fw-bold">{{ user.name || 'N/A' }}</td>
            <td>
              <div>{{ user.email }}</div>
              <span :class="['badge mt-1', user.role === 'admin' ? 'bg-danger' : 'bg-primary']" style="font-size: 0.65rem;">
                {{ user.role?.toUpperCase() || 'USER' }}
              </span>
            </td>
            <td>
              <div v-if="user.planId">
                <span class="badge bg-success mb-1">{{ user.planName }}</span>
                <div class="small text-muted">৳{{ user.planPrice }} (Max {{ user.planDurationDays }} Days)</div>
              </div>
              <span v-else class="text-muted small">No Active Plan</span>
            </td>
            <td>
              <span v-if="user.trxId" class="fw-bold text-warning">{{ user.trxId }}</span>
              <span v-else class="text-muted small">-</span>
            </td>
            <td>
              <span :class="['badge py-1 px-2', statusClass(user.paymentStatus)]">
                {{ formatStatus(user.paymentStatus) }}
              </span>
            </td>
            <td>
              <span v-if="user.planStartDate && user.planDurationDays">
                {{ getExpiryDate(user.planStartDate, user.planDurationDays) }}
              </span>
              <span v-else class="text-muted">-</span>
            </td>
            <td>{{ user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' }}</td>
            <td class="text-end">
              <template v-if="user.role !== 'admin'">
                <!-- Pending Payment / Subscription -->
                <div v-if="user.paymentStatus === 'pending'" class="btn-group btn-group-sm">
                  <button @click="updatePaymentStatus(user.id, 'approved')" class="btn btn-success" title="Approve">
                    <i class="bi bi-check-lg me-1"></i> Approve
                  </button>
                  <button @click="updatePaymentStatus(user.id, 'rejected')" class="btn btn-danger" title="Reject">
                    <i class="bi bi-x-lg me-1"></i> Reject
                  </button>
                </div>

                <!-- Approved / Inactive: Modern Toggle Switch -->
                <div v-else-if="user.paymentStatus === 'approved' || user.paymentStatus === 'inactive'" class="d-inline-flex align-items-center justify-content-end gap-2">
                  <label class="custom-toggle" :title="user.paymentStatus === 'approved' ? 'Click to make Inactive' : 'Click to make Active'">
                    <input 
                      type="checkbox" 
                      :id="'user-toggle-' + user.id" 
                      :checked="user.paymentStatus === 'approved'" 
                      @change="toggleUserStatus(user, $event)"
                    >
                    <span class="toggle-track"></span>
                  </label>
                </div>

                <!-- Rejected: Option to Approve -->
                <div v-else-if="user.paymentStatus === 'rejected'" class="btn-group btn-group-sm">
                  <button @click="updatePaymentStatus(user.id, 'approved')" class="btn btn-outline-success" title="Approve">
                    <i class="bi bi-check-circle me-1"></i> Approve
                  </button>
                </div>

                <span v-else class="text-muted small">-</span>
              </template>
              <span v-else class="text-muted small">Protected (Admin)</span>
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

useHead({ title: 'User Management | Admin' });

const users = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const formatStatus = (s: string) => {
  if (s === 'approved') return 'Active';
  if (s === 'inactive') return 'Inactive';
  if (s === 'pending') return 'Pending';
  if (s === 'rejected') return 'Rejected';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'None';
};

const statusClass = (s: string) => ({
  approved: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25',
  inactive: 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25',
  rejected: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25',
  pending: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'
}[s] ?? 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25');

const getExpiryDate = (start: string, days: number) => {
  const d = new Date(start);
  d.setDate(d.getDate() + Number(days));
  return d.toLocaleDateString();
};

const fetchUsers = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/users');
    const data = res.data?.data ?? res.data ?? [];
    users.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('Fetch users error:', err);
    error.value = err.response?.data?.message ?? err.response?.data?.error ?? err.message ?? 'Failed to load users';
    users.value = [];
  } finally {
    loading.value = false;
  }
};

const updatePaymentStatus = async (userId: number, status: string) => {
  try {
    await axios.put(`/api/users/${userId}`, { paymentStatus: status });
    await fetchUsers();
  } catch (err: any) {
    alert(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to update status');
  }
};

const toggleUserStatus = async (user: any, event: Event) => {
  const target = event.target as HTMLInputElement;
  const isChecked = target.checked;
  const nextStatus = isChecked ? 'approved' : 'inactive';
  user.paymentStatus = nextStatus;
  try {
    await axios.put(`/api/users/${user.id}`, { paymentStatus: nextStatus });
  } catch (err: any) {
    user.paymentStatus = isChecked ? 'inactive' : 'approved';
    target.checked = !isChecked;
    alert(err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to update status');
  }
};

onMounted(fetchUsers);
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
