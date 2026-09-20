<template>
  <Pagebar title="Plan Management" />

  <!-- Error/Loading -->
  <div v-if="loading" class="text-center py-5 container-fluid mt-4">
    <div class="spinner-border text-primary" role="status"></div>
    <div class="mt-2 text-muted">Loading plans...</div>
  </div>

  <div v-else-if="error" class="alert alert-danger border-danger container-fluid mt-4">
    <i class="bi bi-exclamation-triangle me-2"></i> {{ error }}
  </div>

  <!-- Plans Table -->
  <div v-else class="card bg-surface border-custom shadow-sm flex-grow-1 overflow-hidden d-flex flex-column mx-3 mt-4 mb-5">
    <div class="card-header bg-transparent border-bottom border-custom d-flex justify-content-between align-items-center py-3 px-3">
      <button @click="$router.back()" class="btn btn-outline-secondary btn-sm">
        <i class="bi bi-arrow-left me-1"></i> Back
      </button>
        <div>
          <button @click="fetchPlans" class="btn btn-outline-info btn-sm me-2">
            <i class="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
          <button @click="showCreateModal = true" class="btn btn-primary btn-sm">
            <i class="bi bi-plus-lg me-1"></i> Create Plan
          </button>
        </div>
      </div>
      <div class="table-responsive flex-grow-1" style="overflow-y: auto;">
        <table class="table table-hover table-bordered mb-0 align-middle">
          <thead class="sticky-top" style="z-index: 10;">
            <tr>
              <th>Plan Name</th>
              <th>Price (BDT)</th>
              <th>Duration (Days)</th>
              <th>Max Circles</th>
              <th>Status</th>
              <th>Created At</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="plans.length === 0">
              <td colspan="7" class="text-center text-muted py-4">No plans found. Create one above.</td>
            </tr>
            <tr v-for="plan in plans" :key="plan.id" :class="{'text-muted': !plan.isActive}">
              <td class="fw-bold">{{ plan.name }}</td>
              <td>৳{{ plan.price }}</td>
              <td>{{ plan.durationDays }} Days</td>
              <td>
                <span v-if="plan.maxCircles >= 9999">Unlimited</span>
                <span v-else>{{ plan.maxCircles }}</span>
              </td>
              <td>
                <span v-if="plan.isActive" class="badge bg-success">Active</span>
                <span v-else class="badge bg-secondary">Frozen</span>
              </td>
              <td>{{ plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : '-' }}</td>
              <td class="text-end">
                <button v-if="plan.isActive" @click="openEditModal(plan)" class="btn btn-sm btn-outline-info me-2" title="Edit Plan">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button v-if="plan.isActive" @click="freezePlan(plan.id)" class="btn btn-sm btn-outline-warning" title="Freeze Plan">
                  <i class="bi bi-snow2"></i> Freeze
                </button>
                <span v-else class="text-muted small">Locked</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Plan Modal -->
    <div v-if="showCreateModal" class="modal-backdrop fade show" style="z-index: 1040;"></div>
    <div v-if="showCreateModal" class="modal fade show d-block" tabindex="-1" style="z-index: 1050; background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-surface border-custom shadow-lg">
          <div class="modal-header border-custom">
            <h5 class="modal-title fw-light">Create New Plan</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createPlan">
              <div class="mb-3">
                <label class="form-label text-muted small mb-1">Plan Name</label>
                <input v-model="newPlan.name" type="text" class="form-control" placeholder="e.g. Basic Plan" required>
              </div>
              <div class="mb-3">
                <label class="form-label text-muted small mb-1">Price (BDT)</label>
                <input v-model.number="newPlan.price" type="number" class="form-control" min="0" placeholder="e.g. 500" required>
              </div>
              <div class="row mb-3">
                <div class="col-6">
                  <label class="form-label text-muted small mb-1">Duration (Days)</label>
                  <input v-model.number="newPlan.durationDays" type="number" class="form-control" min="1" placeholder="30" required>
                </div>
                <div class="col-6">
                  <label class="form-label text-muted small mb-1">Max Circles</label>
                  <input v-model.number="newPlan.maxCircles" type="number" class="form-control" min="1" placeholder="1" required>
                  <small class="text-muted" style="font-size: 0.7rem;">Use 9999 for Unlimited</small>
                </div>
              </div>
              
              <div v-if="formError" class="alert alert-danger py-2 px-3 small border-danger">
                {{ formError }}
              </div>
              
              <div class="d-flex justify-content-end mt-4">
                <button type="button" class="btn btn-secondary me-2" @click="closeModal">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="creating">
                  <span v-if="creating" class="spinner-border spinner-border-sm me-1"></span>
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Plan Modal -->
    <div v-if="showEditModal" class="modal-backdrop fade show" style="z-index: 1040;"></div>
    <div v-if="showEditModal" class="modal fade show d-block" tabindex="-1" style="z-index: 1050; background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-surface border-custom shadow-lg">
          <div class="modal-header border-custom">
            <h5 class="modal-title fw-light">Edit Active Plan</h5>
            <button type="button" class="btn-close" @click="closeEditModal"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="updatePlan">
              <div class="mb-3">
                <label class="form-label text-muted small mb-1">Plan Name</label>
                <input v-model="editingPlan.name" type="text" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label text-muted small mb-1">Price (BDT)</label>
                <input v-model.number="editingPlan.price" type="number" class="form-control" min="0" required>
              </div>
              <div class="row mb-3">
                <div class="col-6">
                  <label class="form-label text-muted small mb-1">Duration (Days)</label>
                  <input v-model.number="editingPlan.durationDays" type="number" class="form-control" min="1" required>
                </div>
                <div class="col-6">
                  <label class="form-label text-muted small mb-1">Max Circles</label>
                  <input v-model.number="editingPlan.maxCircles" type="number" class="form-control" min="1" required>
                </div>
              </div>
              
              <div v-if="editFormError" class="alert alert-danger py-2 px-3 small border-danger">
                {{ editFormError }}
              </div>
              
              <div class="d-flex justify-content-end mt-4">
                <button type="button" class="btn btn-secondary me-2" @click="closeEditModal">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="savingEdit">
                  <span v-if="savingEdit" class="spinner-border spinner-border-sm me-1"></span>
                  Update Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import axios from '@/plugins/axios';

useHead({ title: 'Plan Management | Admin' });

const plans = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const showCreateModal = ref(false);
const creating = ref(false);
const formError = ref('');

const showEditModal = ref(false);
const savingEdit = ref(false);
const editFormError = ref('');

const newPlan = ref({
  name: '',
  price: 0,
  durationDays: 30,
  maxCircles: 1
});

const editingPlan = ref({
  id: 0,
  name: '',
  price: 0,
  durationDays: 30,
  maxCircles: 1
});

const fetchPlans = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/plans');
    plans.value = res.data.data ?? [];
  } catch (err: any) {
    error.value = err.response?.data?.error ?? 'Failed to load plans (Backend may not be ready)';
    // Dummy Data for Preview
    plans.value = [
      { id: 1, name: 'Basic Plan', price: 500, durationDays: 30, maxCircles: 1, isActive: true, createdAt: new Date() },
      { id: 2, name: 'Premium Plan', price: 1000, durationDays: 30, maxCircles: 9999, isActive: true, createdAt: new Date() },
      { id: 3, name: 'Old Plan', price: 200, durationDays: 15, maxCircles: 1, isActive: false, createdAt: new Date() }
    ];
  } finally {
    loading.value = false;
  }
};

const createPlan = async () => {
  formError.value = '';
  creating.value = true;
  try {
    await axios.post('/api/plans', newPlan.value);
    alert('Plan created successfully!');
    closeModal();
    fetchPlans();
  } catch (err: any) {
    formError.value = err.response?.data?.error ?? 'Failed to create plan';
  } finally {
    creating.value = false;
  }
};

const freezePlan = async (id: number) => {
  if (!confirm('Are you sure you want to freeze this plan?')) return;
  try {
    await axios.put(`/api/plans/${id}/freeze`, {});
    alert('Plan frozen successfully.');
    fetchPlans();
  } catch (err: any) {
    alert(err.response?.data?.error ?? 'Failed to freeze plan');
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  newPlan.value = { name: '', price: 0, durationDays: 30, maxCircles: 1 };
  formError.value = '';
};

const openEditModal = (plan: any) => {
  editingPlan.value = { ...plan };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingPlan.value = { id: 0, name: '', price: 0, durationDays: 30, maxCircles: 1 };
  editFormError.value = '';
};

const updatePlan = async () => {
  editFormError.value = '';
  savingEdit.value = true;
  try {
    await axios.put(`/api/plans/${editingPlan.value.id}`, editingPlan.value);
    alert('Plan updated successfully!');
    closeEditModal();
    fetchPlans();
  } catch (err: any) {
    editFormError.value = err.response?.data?.error ?? 'Failed to update plan';
  } finally {
    savingEdit.value = false;
  }
};

onMounted(fetchPlans);
</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
</style>
