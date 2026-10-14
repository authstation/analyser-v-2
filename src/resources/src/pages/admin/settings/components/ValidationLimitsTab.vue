<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3">
      <h5 class="mb-0 fw-bold">Validation Limits & Patterns</h5>
      <div>
        <button v-if="!isEditing" class="btn btn-warning btn-sm" @click="isEditing = true">
          <i class="bi bi-pencil me-1"></i> Edit Settings
        </button>
        <button v-if="isEditing" class="btn btn-primary btn-sm me-2" @click="saveAllSettings" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
        <button v-if="isEditing" class="btn btn-secondary btn-sm" @click="cancelEdit">Cancel</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-4 text-muted">Loading settings...</div>
    <div v-else class="flex-grow-1" style="overflow-y: auto; overflow-x: hidden;">
      <!-- Common Validation -->
      <h6 class="fw-bold text-info border-bottom border-custom pb-2 mb-3">Common Validation Settings (BIN, Return)</h6>
      <div class="row g-3 mb-4">
        <div class="col-md-6" v-for="s in settingsByGroup.common" :key="s.key">
          <div class="d-flex flex-column h-100">
            <label class="form-label text-muted small mb-2">{{ s.description || s.key }}</label>
            <div class="input-group mt-auto">
              <input 
                type="text" 
                class="form-control border-custom" 
                :class="{ 'text-muted border-0 bg-transparent fw-bold px-2': !isEditing }"
                v-model="s.editValue"
                :readonly="!isEditing"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- iBAS++ Validation -->
      <h6 class="fw-bold text-success border-bottom border-custom pb-2 mb-3">iBAS++ Validation</h6>
      <div class="row g-3 mb-4">
        <div class="col-md-6" v-for="s in settingsByGroup.ibas" :key="s.key">
          <div class="d-flex flex-column h-100">
            <label class="form-label text-muted small mb-2">{{ s.description || s.key }}</label>
            <div class="input-group mt-auto">
              <input 
                type="text" 
                class="form-control border-custom" 
                :class="{ 'text-muted border-0 bg-transparent fw-bold px-2': !isEditing }"
                v-model="s.editValue"
                :readonly="!isEditing"
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from '@/plugins/axios';

const loading = ref(false);
const saving = ref(false);
const isEditing = ref(false);
const appSettingsList = ref<any[]>([]);

const settingsByGroup = computed(() => {
  const commonKeys = ['bin_format_regex', 'bin_format_description', 'common_date_format', 'common_max_file_size_mb', 'common_max_file_rows'];
  const ibasKeys = ['ibas_date_format', 'ibas_max_file_size_mb', 'ibas_max_file_rows'];
  return {
    common: appSettingsList.value.filter(s => commonKeys.includes(s.key)),
    ibas:   appSettingsList.value.filter(s => ibasKeys.includes(s.key)),
  };
});

const fetchAppSettings = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/app-settings');
    appSettingsList.value = res.data.data.map((s: any) => ({ ...s, editValue: s.value }));
  } catch {
    appSettingsList.value = [
      { key: 'bin_format_regex',       value: '^[0-9]{9}-[0-9]{4}$',  editValue: '^[0-9]{9}-[0-9]{4}$',  description: 'Regex pattern for BIN validation (default: 000000000-0000)' },
      { key: 'bin_format_description', value: '000000000-0000 (9 digits, dash, 4 digits)', editValue: '000000000-0000 (9 digits, dash, 4 digits)', description: 'Human-readable BIN format shown in error messages' },
      { key: 'common_date_format',     value: 'DD/MM/YYYY',           editValue: 'DD/MM/YYYY',           description: 'Date format for Excel uploads (DD/MM/YYYY or MM/DD/YYYY)' },
      { key: 'ibas_date_format',       value: 'DD/MM/YYYY',           editValue: 'DD/MM/YYYY',           description: 'Date format for Excel uploads (DD/MM/YYYY or MM/DD/YYYY)' },
      { key: 'common_max_file_size_mb',       value: '2',                    editValue: '2',                    description: 'Maximum Excel upload size in MB (Common)' },
      { key: 'common_max_file_rows',          value: '10000',                editValue: '10000',                description: 'Maximum number of rows allowed in uploaded Excel file (Common)' },
      { key: 'ibas_max_file_size_mb',         value: '5',                    editValue: '5',                    description: 'Maximum Excel upload size in MB (iBAS++)' },
      { key: 'ibas_max_file_rows',            value: '50000',                editValue: '50000',                description: 'Maximum number of rows allowed in uploaded Excel file (iBAS++)' },
    ];
  } finally {
    loading.value = false;
  }
};

const cancelEdit = () => {
  appSettingsList.value.forEach(s => s.editValue = s.value);
  isEditing.value = false;
};

const saveAllSettings = async () => {
  saving.value = true;
  try {
    for (const s of appSettingsList.value) {
      if (s.value !== s.editValue) {
        await axios.put(`/api/settings/app-settings/${s.key}`, { value: s.editValue });
        s.value = s.editValue;
      }
    }
    alert('All settings saved successfully!');
    isEditing.value = false;
  } catch (err: any) {
    alert(err.response?.data?.error || 'Failed to save settings');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchAppSettings();
});
</script>

<style scoped>
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
</style>
