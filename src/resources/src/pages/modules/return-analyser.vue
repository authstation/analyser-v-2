<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    
    <!-- Full-screen Loading Overlay -->
    <div 
      v-if="loading" 
      class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" 
      style="background: rgba(0, 0, 0, 0.85); z-index: 9999; backdrop-filter: blur(4px);"
    >
      <div class="spinner-border text-info mb-3" style="width: 4rem; height: 4rem;" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <h3 class="fw-bold  mb-2">
        Processing File... {{ processingProgress }}%
      </h3>
      <div class="progress w-50 mt-3" style="height: 10px; background-color: #333;">
        <div class="progress-bar bg-info progress-bar-striped progress-bar-animated" :style="{ width: processingProgress + '%' }"></div>
      </div>
      <p class="text-muted text-center mt-3 w-50">
        Please wait while we parse your Excel file. <br>
        For large files (thousands of rows), this may take a few moments. Do not close or refresh this page.
      </p>
    </div>

    <!-- Full-screen Saving Overlay -->
    <div 
      v-if="isSaving" 
      class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" 
      style="background: rgba(0, 0, 0, 0.85); z-index: 9999; backdrop-filter: blur(4px);"
    >
      <div class="spinner-border text-primary mb-3" style="width: 4rem; height: 4rem;" role="status">
        <span class="visually-hidden">Saving...</span>
      </div>
      <h3 class="fw-bold  mb-2">
        Saving to Database... {{ saveProgress }}%
      </h3>
      <div class="progress w-50 mt-3" style="height: 10px; background-color: #333;">
        <div class="progress-bar bg-primary progress-bar-striped progress-bar-animated" :style="{ width: saveProgress + '%' }"></div>
      </div>
      <p class="text-muted text-center mt-3 w-50">
        Please wait while we save your data. <br>
        Do not close or refresh this page.
      </p>
    </div>

    <!-- Main Content -->
    <main class="flex-grow-1 p-4">
      <div class="container-fluid">
        <!-- Consistent Top Row for Back Button -->
        <div class="mb-4 text-start">
          <router-link to="/dashboard" class="btn btn-primary btn-sm rounded-3 px-3 d-inline-flex align-items-center shadow-sm">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
        </div>

        <!-- Main Actions Row (hidden if showing dashboard) -->
        <div class="row g-4 mt-2 justify-content-center">
          
          <!-- Upload File Card -->
          <div class="col-md-4">
            <div class="card h-100 bg-surface  border-custom shadow-sm ">
              <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                <div class="mb-3">
                  <i class="bi bi-cloud-arrow-up text-info" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold">Upload File</h5>
                <p class="card-text text-muted small">Upload your Return Data in Excel format to begin the analysis process.</p>
                <input 
                  type="file" 
                  ref="fileInput" 
                  @change="handleFileUpload" 
                  accept=".xlsx, .xls" 
                  class="d-none" 
                />
                <button 
                  class="btn btn-outline-info w-100 mt-auto position-relative overflow-hidden" 
                  @click="triggerFileInput"
                  :disabled="loading"
                >
                  <div 
                    v-if="loading && processingProgress > 0 && processingProgress < 100" 
                    class="progress position-absolute top-0 start-0 w-100 h-100 opacity-25" 
                    style="border-radius: 0;"
                  >
                    <div class="progress-bar bg-info" :style="{ width: processingProgress + '%' }"></div>
                  </div>
                  <span class="position-relative z-index-1">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                    <span v-if="!loading">Choose Excel File</span>
                    <span v-else-if="processingProgress > 0 && processingProgress < 100">Uploading... {{ processingProgress }}%</span>
                    <span v-else>Processing...</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Reports Card -->
          <div class="col-md-4">
            <div class="card h-100 bg-surface  border-custom shadow-sm ">
              <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                <div class="mb-3">
                  <i class="bi bi-pie-chart text-success" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold">Reports</h5>
                <p class="card-text text-muted small">View insights and generated reports from your analysed data.</p>
                <router-link to="/modules/return-data-reports" class="btn btn-outline-success w-100 mt-auto">View Reports</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Preview Modal -->
    <div class="modal fade" id="previewModal" tabindex="-1" aria-hidden="true" ref="previewModalRef">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content bg-surface  border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">Data Preview ({{ parsedData.length }} rows)</h5>
            <button type="button" class="btn-close btn-close-white" @click="closeModal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="table-responsive">
              <table class="table  table-striped table-bordered text-nowrap" style="font-size: 0.85rem;">
                <thead>
                  <tr>
                    <th v-for="col in dbColumnsList" :key="col.key">{{ col.label }}</th>
                    <th class="text-warning">Raw JSON (Unmapped)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in parsedData.slice(0, 10)" :key="row.tempId || idx">
                    <td v-for="col in dbColumnsList" :key="col.key">
                      <span v-if="row[col.key]" class="">{{ formatDateDisplay(row[col.key]) }}</span>
                      <span v-else class="text-danger opacity-50">Empty</span>
                    </td>
                    <td class="text-muted text-truncate" style="max-width: 200px;" :title="row.rawJson">
                      {{ row.rawJson }}
                    </td>
                  </tr>
                  <tr v-if="parsedData.length > 10">
                    <td :colspan="dbColumnsList.length + 1" class="text-center text-muted fst-italic">
                      ...and {{ parsedData.length - 10 }} more rows hidden for performance.
                    </td>
                  </tr>
                  <tr v-if="parsedData.length === 0">
                    <td :colspan="dbColumnsList.length + 1" class="text-center py-4 text-danger fw-bold">
                      No valid data could be mapped! Check your column mappings.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer border-custom justify-content-between">
            <div class="text-muted small">
              <i class="bi bi-info-circle me-1"></i> Data will be validated during saving.
            </div>
            <div>
              <button type="button" class="btn btn-secondary me-2" @click="closeModal" :disabled="saving">Cancel</button>
              <button type="button" class="btn btn-success" @click="saveToDatabase" :disabled="saving || parsedData.length === 0">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                Save to Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Missing Data Modal -->
    <div class="modal fade" id="missingDataModal" tabindex="-1" aria-hidden="true" ref="missingDataModalRef">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-surface  border-custom">
          <div class="modal-header border-danger">
            <h5 class="modal-title text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Missing Master Data</h5>
            <button type="button" class="btn-close btn-close-white" @click="closeMissingDataModal"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted">The uploaded data contains Divisions or Circles that do not exist in the database.</p>
            <div v-if="missingDivisions.length > 0" class="mb-3">
              <strong class="text-danger">Missing Divisions:</strong>
              <ul class="mb-0  small">
                <li v-for="d in missingDivisions" :key="d">{{ d }}</li>
              </ul>
            </div>
            <div v-if="missingCircles.length > 0">
              <strong class="text-danger">Missing Circles:</strong>
              <ul class="mb-0  small">
                <li v-for="c in missingCircles" :key="c.name">{{ c.name }} (in {{ c.division }})</li>
              </ul>
            </div>
            <p class="mt-3 text-info small mb-0">Would you like to automatically create them and continue saving?</p>
          </div>
          <div class="modal-footer border-custom">
            <button type="button" class="btn btn-secondary" @click="closeMissingDataModal">Cancel</button>
            <button type="button" class="btn btn-danger" @click="autoCreateMissingData" :disabled="creatingMissing">
              <span v-if="creatingMissing" class="spinner-border spinner-border-sm me-2"></span>
              Yes, Create & Continue
            </button>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, onBeforeUnmount, nextTick } from 'vue';
import axios from '@/plugins/axios';
import { useAuthStore } from '@/stores/auth';
import { Modal } from 'bootstrap';
import Pagebar from '@/components/Pagebar.vue';

const authStore = useAuthStore();

const formatDateDisplay = (val: any) => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const parts = val.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return val;
};

// --- File Upload State ---
const fileInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const processingProgress = ref(0);
let progressInterval: any = null;

// --- Data State ---
const parsedData = ref<any[]>([]);
const isSaving = ref(false);
const saving = ref(false);
const saveProgress = ref(0);
const totalSaved = ref(0);
const currentChunkIndex = ref(0);

// --- Missing Data State ---
const missingDivisions = ref<string[]>([]);
const missingCircles = ref<{name: string, division: string}[]>([]);
const creatingMissing = ref(false);

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  processingProgress.value = 0;
  loading.value = true;
  
  progressInterval = setInterval(() => {
    if (processingProgress.value < 95) {
      const remaining = 95 - processingProgress.value;
      const step = Math.max(1, Math.floor(remaining / 5));
      processingProgress.value += step;
    }
  }, 500);

  try {
    const response = await axios.post('/api/return-data/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    processingProgress.value = 100;
    setTimeout(() => {
      parsedData.value = response.data.data;
      if (previewModalInst) {
        previewModalInst.show();
      }
    }, 800);

  } catch (error) {
    console.error('File Upload Error:', error);
    alert('Failed to upload or parse the file.');
  } finally {
    setTimeout(() => {
      loading.value = false;
      clearInterval(progressInterval);
      if (fileInput.value) fileInput.value.value = '';
    }, 1000);
  }
};

// --- Column Mapping State ---
// You can add your target fields here later
const dbColumnsList = ref<Array<{ key: string, label: string }>>([
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
]);

// --- Modal Logic ---
const previewModalRef = ref<HTMLElement | null>(null);
let previewModalInst: Modal | null = null;

const missingDataModalRef = ref<HTMLElement | null>(null);
let missingDataModalInst: Modal | null = null;

onMounted(() => {
  if (previewModalRef.value) {
    previewModalInst = new Modal(previewModalRef.value, { backdrop: 'static', keyboard: false });
  }
  if (missingDataModalRef.value) {
    missingDataModalInst = new Modal(missingDataModalRef.value, { backdrop: 'static', keyboard: false });
  }
});

const closeModal = () => {
  if (previewModalInst) previewModalInst.hide();
  parsedData.value = [];
};

const closeMissingDataModal = () => {
  if (missingDataModalInst) missingDataModalInst.hide();
};

const saveToDatabase = async (startIndex: number | Event = 0) => {
  const actualStartIndex = typeof startIndex === 'number' ? startIndex : 0;
  saving.value = true;
  isSaving.value = true;
  currentChunkIndex.value = actualStartIndex;
  
  try {
    
    const chunkSize = 1000;
    const total = parsedData.value.length;
    
    for (let i = actualStartIndex; i < total; i += chunkSize) {
      currentChunkIndex.value = i;
      const chunk = parsedData.value.slice(i, i + chunkSize);
      
      const response = await axios.post('/api/return-data/save', {
        data: chunk
      });
      
      totalSaved.value += response.data.insertedRows;
      saveProgress.value = Math.round((Math.min(i + chunkSize, total) / total) * 100);
    }

    alert(`Success: Data saved successfully.`);
    closeModal();
    saveProgress.value = 0;
    totalSaved.value = 0;
    currentChunkIndex.value = 0;
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.missingDivisions) {
      missingDivisions.value = error.response.data.missingDivisions;
      missingCircles.value = error.response.data.missingCircles;
      if (missingDataModalInst) {
        missingDataModalInst.show();
      }
    } else {
      alert(error.response?.data?.error || 'Failed to save data to database.');
    }
  } finally {
    saving.value = false;
    isSaving.value = false;
  }
};

const autoCreateMissingData = async () => {
  creatingMissing.value = true;
  try {
    
    
    // Create Divisions first
    for (const divName of missingDivisions.value) {
      await axios.post('/api/settings/divisions', { name: divName });
    }

    const divRes = await axios.get('/api/settings/divisions');
    const allDivs = divRes.data.data;

    // Create Circles
    for (const c of missingCircles.value) {
      const parentDiv = allDivs.find((d: any) => d.name.toLowerCase() === c.division.toLowerCase());
      if (parentDiv) {
        await axios.post('/api/settings/circles', { 
          name: c.name, 
          divisionId: parentDiv.id 
        });
      }
    }

    alert('Successfully created missing master data!');
    closeMissingDataModal();
    
    // Retry Save from the chunk that failed
    await saveToDatabase(currentChunkIndex.value);

  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to auto-create master data.');
  } finally {
    creatingMissing.value = false;
  }
};

</script>

<style scoped>
.hover-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.3) !important;
  border-color: #6c757d !important;
}
</style>



