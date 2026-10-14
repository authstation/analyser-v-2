<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3 align-items-center">
      <div class="d-flex align-items-center gap-3">
        <h5 class="mb-0 fw-bold">Standardized Item Mappings</h5>
        <select class="form-select form-select-sm border-custom" style="width: 150px;" v-model="selectedModule" @change="fetchItemMappings">
          <option value="ibas">iBAS++ Module</option>
        </select>
      </div>
      <div>
        <button class="btn btn-warning btn-sm me-2" @click="startAddNewItem">
          <i class="bi bi-plus-circle me-1"></i> Add New Mapping
        </button>
        <button class="btn btn-info btn-sm" @click="fetchItemMappings">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>
    </div>
    <div class="table-responsive flex-grow-1">
      <table class="table table-hover table-bordered mb-0 align-middle">
        <thead class="sticky-top">
          <tr>
            <th>ID</th>
            <th>Original Item Name (In Excel)</th>
            <th>Standard Common Item</th>
            <th>Status</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Add New Item Row -->
          <tr v-if="isAddingNewItem" class="table-active">
            <td>-</td>
            <td>
              <input type="text" v-model="newItem.itemName" class="form-control form-control-sm border-custom" placeholder="e.g. Stationary & Supplies">
            </td>
            <td>
              <input type="text" v-model="newItem.commonItem" list="commonItemsList" class="form-control form-control-sm border-custom" placeholder="e.g. Stationery">
            </td>
            <td>
              <select v-model="newItem.status" class="form-select form-select-sm border-custom">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-success me-1" @click="saveNewItem"><i class="bi bi-check2"></i></button>
              <button class="btn btn-sm btn-secondary" @click="isAddingNewItem = false"><i class="bi bi-x"></i></button>
            </td>
          </tr>

          <tr v-if="loading"><td colspan="5" class="text-center py-3">Loading item mappings...</td></tr>
          <tr v-else-if="itemMappings.length === 0 && !isAddingNewItem"><td colspan="5" class="text-center py-3 text-muted">No item mappings found. Add one to get started.</td></tr>
          
          <tr v-else v-for="mapping in itemMappings" :key="mapping.id">
            <td>{{ mapping.id }}</td>
            <td>
              <span v-if="!mapping.isEditing">{{ mapping.itemName }}</span>
              <input v-else type="text" v-model="mapping.editItemName" class="form-control form-control-sm border-custom">
            </td>
            <td>
              <span v-if="!mapping.isEditing" class="badge bg-secondary">{{ mapping.commonItem }}</span>
              <input v-else type="text" v-model="mapping.editCommonItem" list="commonItemsList" class="form-control form-control-sm border-custom">
            </td>
            <td>
              <span v-if="!mapping.isEditing" class="badge" :class="mapping.status === 'approved' ? 'bg-success' : 'bg-warning'">
                {{ mapping.status }}
              </span>
              <select v-else v-model="mapping.editStatus" class="form-select form-select-sm border-custom">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            </td>
            <td class="text-end">
              <div v-if="!mapping.isEditing">
                <button class="btn btn-sm btn-outline-info me-1" @click="startEditItem(mapping)">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteItemMapping(mapping.id)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <div v-else>
                <button class="btn btn-sm btn-success me-1" @click="saveEditItem(mapping)">
                  <i class="bi bi-check2"></i>
                </button>
                <button class="btn btn-sm btn-secondary" @click="mapping.isEditing = false">
                  <i class="bi bi-x"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <datalist id="commonItemsList">
        <option v-for="item in commonItemOptions" :key="item" :value="item"></option>
      </datalist>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from '@/plugins/axios';

const itemMappings = ref<any[]>([]);
const loading = ref(false);
const isAddingNewItem = ref(false);
const selectedModule = ref('ibas');
const newItem = ref({ itemName: '', commonItem: '', status: 'approved' });
const commonItemOptions = ref(['Entertainment', 'Travel', 'Stationery', 'Honorarium', 'Fuel', 'Maintenance', 'Training']);

const fetchItemMappings = async () => {
  loading.value = true;
  try {
    const res = await axios.get(`/api/settings/item-mappings?module=${selectedModule.value}`);
    itemMappings.value = res.data.map((m: any) => ({
      ...m,
      isEditing: false,
      editItemName: m.itemName,
      editCommonItem: m.commonItem,
      editStatus: m.status
    }));
  } catch {
    itemMappings.value = [];
  } finally {
    loading.value = false;
  }
};

const startAddNewItem = () => {
  isAddingNewItem.value = true;
  newItem.value = { itemName: '', commonItem: '', status: 'approved' };
};

const saveNewItem = async () => {
  if (!newItem.value.itemName || !newItem.value.commonItem) return;
  try {
    await axios.post('/api/settings/item-mappings', {
      moduleName: selectedModule.value,
      ...newItem.value
    });
    alert('Item Mapping added!');
    isAddingNewItem.value = false;
    fetchItemMappings();
  } catch {
    alert('Failed to add item mapping');
  }
};

const startEditItem = (mapping: any) => {
  mapping.isEditing = true;
  mapping.editItemName = mapping.itemName;
  mapping.editCommonItem = mapping.commonItem;
  mapping.editStatus = mapping.status;
};

const saveEditItem = async (mapping: any) => {
  try {
    await axios.put(`/api/settings/item-mappings/${mapping.id}`, {
      itemName: mapping.editItemName,
      commonItem: mapping.editCommonItem,
      status: mapping.editStatus
    });
    alert('Item Mapping updated!');
    mapping.isEditing = false;
    fetchItemMappings();
  } catch {
    alert('Failed to update item mapping');
  }
};

const deleteItemMapping = async (id: number) => {
  if (!confirm('Delete this mapping?')) return;
  try {
    await axios.delete(`/api/settings/item-mappings/${id}`);
    alert('Item Mapping deleted!');
    fetchItemMappings();
  } catch {
    alert('Failed to delete item mapping');
  }
};

onMounted(() => {
  fetchItemMappings();
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
