<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3">
      <h5 class="mb-0 fw-bold">Divisions</h5>
      <button class="btn btn-primary btn-sm" @click="openModal()">
        <i class="bi bi-plus-lg me-1"></i> Add Division
      </button>
    </div>
    <div class="table-responsive flex-grow-1">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top">
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="3" class="text-center py-3">Loading...</td></tr>
          <tr v-else-if="divisions.length === 0"><td colspan="3" class="text-center py-3">No divisions found.</td></tr>
          <tr v-else v-for="d in divisions" :key="d.id">
            <td>{{ d.id }}</td>
            <td>{{ d.name }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-warning me-2" @click="openModal(d)"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" @click="deleteDivision(d.id)"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Division Modal -->
    <div class="modal fade" id="divModal" tabindex="-1" ref="modalRef">
      <div class="modal-dialog">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">{{ editData.id ? 'Edit' : 'Add' }} Division</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label">Name</label>
            <input type="text" class="form-control border-custom" v-model="editData.name" placeholder="e.g. Dhaka">
          </div>
          <div class="modal-footer border-custom">
            <button class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" @click="saveDivision" :disabled="saving">Save</button>
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
const divisions = ref<any[]>([]);
const modalRef = ref<HTMLElement | null>(null);
let modalInst: bootstrap.Modal | null = null;

const editData = reactive({ id: null as number | null, name: '' });

const fetchDivisions = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/divisions');
    divisions.value = res.data.data ?? [];
  } catch {
    divisions.value = [
      { id: 1, name: 'Dhaka' },
      { id: 2, name: 'Chattogram' }
    ];
  } finally {
    loading.value = false;
  }
};

const openModal = (d?: any) => {
  if (d) {
    editData.id = d.id;
    editData.name = d.name;
  } else {
    editData.id = null;
    editData.name = '';
  }
  modalInst?.show();
};

const closeModal = () => modalInst?.hide();

const saveDivision = async () => {
  if (!editData.name) return;
  saving.value = true;
  try {
    const payload = { name: editData.name };
    if (editData.id) {
      await axios.put(`/api/settings/divisions/${editData.id}`, payload);
    } else {
      await axios.post('/api/settings/divisions', payload);
    }
    alert('Saved successfully');
    closeModal();
    fetchDivisions();
  } catch {
    alert('Failed to save');
  } finally {
    saving.value = false;
  }
};

const deleteDivision = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await axios.delete(`/api/settings/divisions/${id}`);
    alert('Deleted');
    fetchDivisions();
  } catch {
    alert('Failed to delete');
  }
};

onMounted(() => {
  fetchDivisions();
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
