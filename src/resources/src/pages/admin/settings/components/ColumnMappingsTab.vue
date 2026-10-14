<template>
  <div class="p-4 d-flex flex-column h-100">
    <div class="d-flex justify-content-between mb-3">
      <h5 class="mb-0 fw-bold">Column Mappings</h5>
      <div>
        <button v-if="!isEditing" class="btn btn-warning btn-sm" @click="isEditing = true">
          <i class="bi bi-pencil me-1"></i> Edit Mappings
        </button>
        <button v-if="isEditing" class="btn btn-primary btn-sm me-2" @click="saveMappings" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
          {{ saving ? 'Saving...' : 'Save Mappings' }}
        </button>
        <button v-if="isEditing" class="btn btn-secondary btn-sm" @click="isEditing = false">Cancel</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-4 text-muted">Loading mappings...</div>
    <div v-else class="flex-grow-1" style="overflow-y: auto; overflow-x: hidden;">
      
      <div class="alert bg-secondary bg-opacity-10 border border-secondary text-light d-flex align-items-center mb-4 rounded-3 shadow-sm">
        <i class="bi bi-info-circle me-3 fs-5 text-warning"></i>
        <small class="text-muted">Define the exact "Excel Header Name" that corresponds to each Database Column for each module.</small>
      </div>

      <!-- BIN Analyser Mappings -->
      <h6 class="fw-bold text-white border-bottom border-secondary pb-2 mb-3">BIN Analyser Mappings</h6>
      <div class="table-responsive mb-4">
        <table class="table table-bordered border-custom align-middle mb-0">
          <thead class="table-active">
            <tr>
              <th style="width: 40%;">Database Field (Target)</th>
              <th style="width: 60%;">Excel Column Header (Source)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="col in binDbColumnsList" :key="col.key">
              <td>
                <div class="fw-bold">{{ col.label }}</div>
                <div class="text-muted small">Key: <code>{{ col.key }}</code></div>
              </td>
              <td>
                <input 
                  type="text" 
                  v-model="(binMappings as any)[col.key]" 
                  class="form-control form-control-sm border-custom" 
                  :class="{ 'text-muted border-0 bg-transparent fw-bold px-0': !isEditing }"
                  :placeholder="`e.g. ${col.label}`"
                  :readonly="!isEditing"
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Return Analyser Mappings -->
      <h6 class="fw-bold text-white border-bottom border-secondary pb-2 mb-3 mt-4">Return Analyser Mappings</h6>
      <div class="table-responsive mb-4">
        <table class="table table-bordered border-custom align-middle mb-0">
          <thead class="table-active">
            <tr>
              <th style="width: 40%;">Database Field (Target)</th>
              <th style="width: 60%;">Excel Column Header (Source)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="col in returnDbColumnsList" :key="col.key">
              <td>
                <div class="fw-bold">{{ col.label }}</div>
                <div class="text-muted small">Key: <code>{{ col.key }}</code></div>
              </td>
              <td>
                <input 
                  type="text" 
                  v-model="(returnMappings as any)[col.key]" 
                  class="form-control form-control-sm border-custom" 
                  :class="{ 'text-muted border-0 bg-transparent fw-bold px-0': !isEditing }"
                  :placeholder="`e.g. ${col.label}`"
                  :readonly="!isEditing"
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- iBAS++ Mappings -->
      <h6 class="fw-bold text-white border-bottom border-secondary pb-2 mb-3 mt-4">iBAS++ Analyser Mappings</h6>
      <div class="table-responsive mb-4">
        <table class="table table-bordered border-custom align-middle mb-0">
          <thead class="table-active">
            <tr>
              <th style="width: 40%;">Database Field (Target)</th>
              <th style="width: 60%;">Excel Column Header (Source)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="col in ibasDbColumnsList" :key="col.key">
              <td>
                <div class="fw-bold">{{ col.label }}</div>
                <div class="text-muted small">Key: <code>{{ col.key }}</code></div>
              </td>
              <td>
                <input 
                  type="text" 
                  v-model="(ibasMappings as any)[col.key]" 
                  class="form-control form-control-sm border-custom" 
                  :class="{ 'text-muted border-0 bg-transparent fw-bold px-0': !isEditing }"
                  :placeholder="`e.g. ${col.label}`"
                  :readonly="!isEditing"
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from '@/plugins/axios';

const isEditing = ref(false);
const saving = ref(false);
const loading = ref(false);

const binDbColumnsList = [
  { key: 'bin_issue_date', label: 'BIN Issue Date' },
  { key: 'division', label: 'Division' },
  { key: 'circle', label: 'Circle' },
  { key: 'bin', label: 'BIN' },
  { key: 'entity_name', label: 'Name' },
  { key: 'address', label: 'Factory / Business Operation Address' },
  { key: 'police_station', label: 'Police Station' },
  { key: 'mobile', label: 'Mobile Number' },
  { key: 'email', label: 'Email' },
  { key: 'hq_address', label: 'Registered HQ Address' },
  { key: 'forced_registration', label: 'Forced Registration' },
  { key: 'major_area', label: 'Major Area of Economic Activity' },
  { key: 'manufacturing_area', label: 'Areas of Manufacturing' },
  { key: 'service_area', label: 'Areas of Service' },
  { key: 'bin_status', label: 'BIN Status' },
  { key: 'e_tin', label: 'e-TIN' }
];

const returnDbColumnsList = [
  { key: 'division', label: 'Division' },
  { key: 'circle', label: 'Circle' },
  { key: 'bin', label: 'BIN' },
  { key: 'submission_id', label: 'Submission ID' },
  { key: 'tax_period', label: 'Tax Period' },
  { key: 'has_activities', label: 'Any activities in this Tax Period?' },
  { key: 'total_sales_value', label: 'Total Sales Value' },
  { key: 'total_payable_vat', label: 'Total Payable (VAT)' },
  { key: 'total_payable_sd', label: 'Total Payable (SD)' },
  { key: 'total_input_tax_credit_value', label: 'Total Input Tax Credit (Value)' },
  { key: 'total_input_tax_credit_vat', label: 'Total Input Tax Credit (VAT)' },
  { key: 'increasing_adjustment', label: 'Increasing Adjustment' },
  { key: 'decreasing_adjustment', label: 'Decreasing Adjustment' },
  { key: 'net_payable_vat', label: 'Net Payable (VAT)' },
  { key: 'net_payable_sd', label: 'Net Payable (SD)' },
  { key: 'fine_penalty', label: 'Fine/Penalty for Non-submission Return' },
  { key: 'deposited_vat', label: 'Deposited (VAT)' },
  { key: 'deposited_sd', label: 'Deposited (SD)' },
  { key: 'closing_balance_vat', label: 'Closing Balance (VAT)' },
  { key: 'closing_balance_sd', label: 'Closing Balance (SD)' },
  { key: 'vds_increasing', label: 'VDS (Increasing)' },
  { key: 'vds_decreasing', label: 'VDS (Decreasing)' },
  { key: 'advanced_tax_paid', label: 'Advanced Tax Paid' },
  { key: 'submission_date', label: 'Submission Date' },
  { key: 'last_amendment_date', label: 'Last Amendment Date' }
];

const ibasDbColumnsList = [
  { key: 'office', label: 'Office' },
  { key: 'item', label: 'Item Name' },
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Expenditure' }
];

const binMappings = ref<Record<string, string>>({});
const returnMappings = ref<Record<string, string>>({});
const ibasMappings = ref<Record<string, string>>({});

const fetchMappings = async () => {
  loading.value = true;
  try {
    const resBin = await axios.get('/api/settings/mappings?module=bin');
    const dbMappingsBin = resBin.data?.data;
    const currentMapBin: Record<string, string> = {};
    if (Array.isArray(dbMappingsBin) && dbMappingsBin.length > 0) {
      binDbColumnsList.forEach(col => {
        const match = dbMappingsBin.find((m: any) => m.dbColumn === col.key);
        currentMapBin[col.key] = match ? match.excelHeader : col.label;
      });
    } else {
      binDbColumnsList.forEach(col => currentMapBin[col.key] = col.label);
    }
    binMappings.value = currentMapBin;
  } catch {
    binDbColumnsList.forEach(col => binMappings.value[col.key] = col.label);
  }

  try {
    const resReturn = await axios.get('/api/settings/mappings?module=return');
    const dbMappingsReturn = resReturn.data?.data;
    const currentMapReturn: Record<string, string> = {};
    if (Array.isArray(dbMappingsReturn) && dbMappingsReturn.length > 0) {
      returnDbColumnsList.forEach(col => {
        const match = dbMappingsReturn.find((m: any) => m.dbColumn === col.key);
        currentMapReturn[col.key] = match ? match.excelHeader : col.label;
      });
    } else {
      returnDbColumnsList.forEach(col => currentMapReturn[col.key] = col.label);
    }
    returnMappings.value = currentMapReturn;
  } catch {
    returnDbColumnsList.forEach(col => returnMappings.value[col.key] = col.label);
  }

  try {
    const resIbas = await axios.get('/api/settings/mappings?module=ibas');
    const dbMappingsIbas = resIbas.data?.data;
    const currentMapIbas: Record<string, string> = {};
    if (Array.isArray(dbMappingsIbas) && dbMappingsIbas.length > 0) {
      ibasDbColumnsList.forEach(col => {
        const match = dbMappingsIbas.find((m: any) => m.dbColumn === col.key);
        currentMapIbas[col.key] = match ? match.excelHeader : col.label;
      });
    } else {
      ibasDbColumnsList.forEach(col => currentMapIbas[col.key] = col.label);
    }
    ibasMappings.value = currentMapIbas;
  } catch {
    ibasDbColumnsList.forEach(col => ibasMappings.value[col.key] = col.label);
  }
  
  loading.value = false;
};

const saveMappings = async () => {
  saving.value = true;
  try {
    await axios.post('/api/settings/mappings?module=bin', { mappings: binMappings.value });
    await axios.post('/api/settings/mappings?module=return', { mappings: returnMappings.value });
    await axios.post('/api/settings/mappings?module=ibas', { mappings: ibasMappings.value });
    alert('Mappings saved successfully!');
    isEditing.value = false;
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to save mappings');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchMappings();
});
</script>

<style scoped>
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
</style>
