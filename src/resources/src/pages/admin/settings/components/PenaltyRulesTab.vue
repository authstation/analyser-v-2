<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3">
      <h5 class="mb-0 fw-bold">Penalty Rules</h5>
      <button class="btn btn-primary btn-sm" @click="openModal()">
        <i class="bi bi-plus-lg me-1"></i> Add Rule
      </button>
    </div>
    <div class="table-responsive flex-grow-1">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top">
          <tr>
            <th>ID</th>
            <th>Penalty Amount (TK)</th>
            <th>Effective Date</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="text-center py-3">Loading rules...</td></tr>
          <tr v-else-if="penalties.length === 0"><td colspan="4" class="text-center py-3">No penalty rules found.</td></tr>
          <tr v-else v-for="p in penalties" :key="p.id">
            <td>{{ p.id }}</td>
            <td class="fw-bold text-info">{{ Number(p.amount).toLocaleString() }} TK</td>
            <td>{{ new Date(p.effectiveDate).toLocaleDateString() }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-warning me-2" @click="openModal(p)"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" @click="deletePenalty(p.id)"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Penalty Modal -->
    <div class="modal fade" id="penaltyModal" tabindex="-1" ref="modalRef">
      <div class="modal-dialog">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">{{ editData.id ? 'Edit' : 'Add' }} Penalty Rule</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label text-info">Penalty Amount (TK)</label>
              <input type="number" class="form-control border-custom" v-model="editData.amount" placeholder="e.g. 10000">
            </div>
            <div class="mb-3">
              <label class="form-label text-info">Effective Date</label>
              <input type="date" class="form-control border-custom" v-model="editData.effectiveDate">
            </div>
          </div>
          <div class="modal-footer border-custom">
            <button class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" @click="savePenalty" :disabled="saving">Save</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import axios from '@/plugins/axios';
import * as bootstrap from 'bootstrap';

const loading = ref(false);
const saving = ref(false);
const penalties = ref<any[]>([]);
const modalRef = ref<HTMLElement | null>(null);
let modalInst: bootstrap.Modal | null = null;

const editData = reactive({ id: null as number | null, amount: '' as number | string, effectiveDate: '' });

const fetchPenalties = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/penalties');
    penalties.value = res.data.data ?? [];
  } catch {
    penalties.value = [
      { id: 1, amount: 10000, effectiveDate: new Date().toISOString() }
    ];
  } finally {
    loading.value = false;
  }
};

const openModal = (p?: any) => {
  if (p) {
    editData.id = p.id;
    editData.amount = p.amount;
    editData.effectiveDate = new Date(p.effectiveDate).toISOString().split('T')[0];
  } else {
    editData.id = null;
    editData.amount = '';
    editData.effectiveDate = '';
  }
  modalInst?.show();
};

const closeModal = () => modalInst?.hide();

const savePenalty = async () => {
  if (!editData.amount || !editData.effectiveDate) return;
  saving.value = true;
  try {
    const payload = { amount: Number(editData.amount), effectiveDate: editData.effectiveDate };
    if (editData.id) {
      await axios.put(`/api/settings/penalties/${editData.id}`, payload);
    } else {
      await axios.post('/api/settings/penalties', payload);
    }
    alert('Saved successfully');
    closeModal();
    fetchPenalties();
  } catch {
    alert('Failed to save');
  } finally {
    saving.value = false;
  }
};

const deletePenalty = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await axios.delete(`/api/settings/penalties/${id}`);
    alert('Deleted');
    fetchPenalties();
  } catch {
    alert('Failed to delete');
  }
};

onMounted(() => {
  fetchPenalties();
  if (modalRef.value) modalInst = new bootstrap.Modal(modalRef.value);
});
</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.btn-outline-warning {
  color: #ffc107 !important;
  border-color: #ffc107 !important;
}
.btn-outline-warning:hover {
  background-color: #ffc107 !important;
  color: #000 !important;
}
.btn-outline-danger {
  color: #dc3545 !important;
  border-color: #dc3545 !important;
}
.btn-outline-danger:hover {
  background-color: #dc3545 !important;
  color: #fff !important;
}
</style>
