<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3">
      <h5 class="mb-0 fw-bold">Circles</h5>
      <button class="btn btn-primary btn-sm" @click="openModal()">
        <i class="bi bi-plus-lg me-1"></i> Add Circle
      </button>
    </div>
    <div class="table-responsive flex-grow-1">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top">
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Division</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="4" class="text-center py-3">Loading...</td></tr>
          <tr v-else-if="circles.length === 0"><td colspan="4" class="text-center py-3">No circles found.</td></tr>
          <tr v-else v-for="c in circles" :key="c.id">
            <td>{{ c.id }}</td>
            <td>{{ c.name }}</td>
            <td>{{ c.divisionName || divisions.find(d => d.id === c.divisionId)?.name }}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-warning me-2" @click="openModal(c)"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" @click="deleteCircle(c.id)"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Circle Modal -->
    <div class="modal fade" id="circleModal" tabindex="-1" ref="modalRef">
      <div class="modal-dialog">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">{{ editData.id ? 'Edit' : 'Add' }} Circle</h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Name</label>
              <input type="text" class="form-control border-custom" v-model="editData.name" placeholder="e.g. Circle-1">
            </div>
            <div class="mb-3">
              <label class="form-label">Division</label>
              <select class="form-select border-custom" v-model="editData.divisionId">
                <option value="" disabled>Select Division</option>
                <option v-for="d in divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>
          </div>
          <div class="modal-footer border-custom">
            <button class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" @click="saveCircle" :disabled="saving">Save</button>
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
const circles = ref<any[]>([]);
const divisions = ref<any[]>([]);
const modalRef = ref<HTMLElement | null>(null);
let modalInst: bootstrap.Modal | null = null;

const editData = reactive({ id: null as number | null, name: '', divisionId: '' as number | string });

const fetchDivisions = async () => {
  try {
    const res = await axios.get('/api/settings/divisions');
    divisions.value = res.data.data ?? [];
  } catch {
    divisions.value = [];
  }
};

const fetchCircles = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/circles');
    circles.value = res.data.data ?? [];
  } catch {
    circles.value = [
      { id: 1, name: 'Dhaka North', divisionId: 1 },
      { id: 2, name: 'Agrabad', divisionId: 2 }
    ];
  } finally {
    loading.value = false;
  }
};

const openModal = (c?: any) => {
  if (c) {
    editData.id = c.id;
    editData.name = c.name;
    editData.divisionId = c.divisionId;
  } else {
    editData.id = null;
    editData.name = '';
    editData.divisionId = '';
  }
  modalInst?.show();
};

const closeModal = () => modalInst?.hide();

const saveCircle = async () => {
  if (!editData.name || !editData.divisionId) return;
  saving.value = true;
  try {
    const payload = { name: editData.name, divisionId: Number(editData.divisionId) };
    if (editData.id) {
      await axios.put(`/api/settings/circles/${editData.id}`, payload);
    } else {
      await axios.post('/api/settings/circles', payload);
    }
    alert('Saved successfully');
    closeModal();
    fetchCircles();
  } catch {
    alert('Failed to save');
  } finally {
    saving.value = false;
  }
};

const deleteCircle = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await axios.delete(`/api/settings/circles/${id}`);
    alert('Deleted');
    fetchCircles();
  } catch {
    alert('Failed to delete');
  }
};

onMounted(() => {
  fetchDivisions();
  fetchCircles();
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
