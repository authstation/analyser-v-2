<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3">
      <h5 class="mb-0 fw-bold">Offices & Areas (iBAS++)</h5>
      <div>
        <button class="btn btn-warning btn-sm me-2" @click="startAddNewOffice">
          <i class="bi bi-plus-circle me-1"></i> Add New Office
        </button>
        <button class="btn btn-info btn-sm" @click="fetchOffices">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>
    </div>
    <div class="table-responsive flex-grow-1">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top">
          <tr>
            <th>ID</th>
            <th>Office Name</th>
            <th>Area Name</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Add New Office Row -->
          <tr v-if="isAddingNewOffice" class="table-active">
            <td>-</td>
            <td>
              <input type="text" v-model="newOfficeData.officeName" class="form-control form-control-sm border-custom" placeholder="e.g. UAO- Upazilla Accounts Office">
            </td>
            <td>
              <input type="text" v-model="newOfficeData.areaName" class="form-control form-control-sm border-custom" placeholder="e.g. Bancharampur">
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-success me-1" @click="saveNewOffice"><i class="bi bi-check2"></i></button>
              <button class="btn btn-sm btn-secondary" @click="isAddingNewOffice = false"><i class="bi bi-x"></i></button>
            </td>
          </tr>

          <tr v-if="loading"><td colspan="4" class="text-center py-3">Loading offices...</td></tr>
          <tr v-else-if="officesIbas.length === 0 && !isAddingNewOffice"><td colspan="4" class="text-center py-3 text-muted">No offices found. Add some to get started.</td></tr>
          
          <tr v-else v-for="office in officesIbas" :key="office.id">
            <td>{{ office.id }}</td>
            <td>
              <span v-if="!office.isEditing">{{ office.officeName }}</span>
              <input v-else type="text" v-model="office.editOfficeName" class="form-control form-control-sm border-custom">
            </td>
            <td>
              <span v-if="!office.isEditing" class="badge bg-secondary">{{ office.areaName }}</span>
              <input v-else type="text" v-model="office.editAreaName" class="form-control form-control-sm border-custom">
            </td>
            <td class="text-end">
              <div v-if="!office.isEditing">
                <button class="btn btn-sm btn-outline-info me-1" @click="startEditOffice(office)">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteOffice(office.id)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <div v-else>
                <button class="btn btn-sm btn-success me-1" @click="saveEditOffice(office)">
                  <i class="bi bi-check2"></i>
                </button>
                <button class="btn btn-sm btn-secondary" @click="office.isEditing = false">
                  <i class="bi bi-x"></i>
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
import axios from '@/plugins/axios';

const officesIbas = ref<any[]>([]);
const loading = ref(false);
const isAddingNewOffice = ref(false);
const newOfficeData = ref({ officeName: '', areaName: '' });

const fetchOffices = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/ibas/offices');
    officesIbas.value = res.data.map((o: any) => ({
      ...o,
      isEditing: false,
      editOfficeName: o.officeName,
      editAreaName: o.areaName
    }));
  } catch {
    officesIbas.value = [];
  } finally {
    loading.value = false;
  }
};

const startAddNewOffice = () => {
  isAddingNewOffice.value = true;
  newOfficeData.value = { officeName: '', areaName: '' };
};

const saveNewOffice = async () => {
  if (!newOfficeData.value.officeName || !newOfficeData.value.areaName) return;
  try {
    await axios.post('/api/settings/ibas/offices', newOfficeData.value);
    alert('Office added!');
    isAddingNewOffice.value = false;
    fetchOffices();
  } catch {
    alert('Failed to add office');
  }
};

const startEditOffice = (office: any) => {
  office.isEditing = true;
  office.editOfficeName = office.officeName;
  office.editAreaName = office.areaName;
};

const saveEditOffice = async (office: any) => {
  try {
    await axios.put(`/api/settings/ibas/offices/${office.id}`, {
      officeName: office.editOfficeName,
      areaName: office.editAreaName
    });
    alert('Office updated!');
    office.isEditing = false;
    fetchOffices();
  } catch {
    alert('Failed to update office');
  }
};

const deleteOffice = async (id: number) => {
  if (!confirm('Delete this office?')) return;
  try {
    await axios.delete(`/api/settings/ibas/offices/${id}`);
    alert('Office deleted!');
    fetchOffices();
  } catch {
    alert('Failed to delete office');
  }
};

onMounted(() => {
  fetchOffices();
});
</script>

<style scoped>
.border-custom {
  border-color: var(--app-border, #dee2e6);
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
