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
      <h3 class="fw-bold text-light mb-2">
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
      <div class="spinner-border text-success mb-3" style="width: 4rem; height: 4rem;" role="status">
        <span class="visually-hidden">Saving...</span>
      </div>
      <h3 class="fw-bold text-light mb-2">
        Saving to Database... {{ saveProgress }}%
      </h3>
      <div class="progress w-50 mt-3" style="height: 10px; background-color: #333;">
        <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" :style="{ width: saveProgress + '%' }"></div>
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

        <div class="row g-4 mt-2 justify-content-center">
          <!-- Upload File Card -->
          <div class="col-md-4">
            <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
              <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                <div class="mb-3">
                  <i class="bi bi-cloud-arrow-up text-info" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold">Upload File</h5>
                <p class="card-text text-muted small">Upload your BIN Data in Excel format to begin the analysis process.</p>
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
                  <span class="position-relative z-index-1">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                    <span v-if="!loading">Choose Excel File</span>
                    <span v-else>Processing...</span>
                  </span>
                </button>
              </div>
            </div>
          </div>



          <!-- Reports Card -->
          <div class="col-md-4">
            <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
              <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                <div class="mb-3">
                  <i class="bi bi-pie-chart text-success" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold">Reports</h5>
                <p class="card-text text-muted small">View insights and generated reports from your analysed data.</p>
                <router-link to="/modules/reports" class="btn btn-outline-success w-100 mt-auto">View Reports</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Preview Modal -->
    <div 
      class="modal fade" 
      id="previewModal" 
      tabindex="-1" 
      aria-labelledby="previewModalLabel" 
      aria-hidden="true"
      ref="previewModalRef"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content bg-surface border-custom shadow-lg">
          <div class="modal-header border-custom">
            <h5 class="modal-title" id="previewModalLabel">Data Preview ({{ parsedData.length }} rows)</h5>
            <button type="button" class="btn-close" @click="closeModal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="table-responsive">
                  <table class="table table-hover table-bordered align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
                    <thead>
                      <tr>
                        <th class="text-center" style="width: 50px;">#</th>
                        <th>BIN Issue Date</th>
                        <th>Division</th>
                        <th>Circle</th>
                        <th>BIN</th>
                        <th>Entity Name</th>
                        <th>Address</th>
                        <th>Police Station</th>
                        <th>Mobile</th>
                        <th>Email</th>
                        <th>HQ Address</th>
                        <th>Forced Reg.</th>
                        <th>Econ Activity</th>
                        <th>Manufacturing</th>
                        <th>Service</th>
                        <th>BIN Status</th>
                        <th>e-TIN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, index) in parsedData.slice(0, 50)" :key="row.tempId || index">
                        <td class="text-center text-muted">{{ index + 1 }}</td>
                        <td>{{ formatDateDisplay(row.binIssueDate) || '-' }}</td>
                        <td><span class="badge bg-info text-dark">{{ row.division || '-' }}</span></td>
                        <td><span class="badge bg-secondary">{{ row.circle || '-' }}</span></td>
                        <td class="fw-bold text-warning">{{ row.bin || '-' }}</td>
                        <td class="fw-bold">{{ row.entityName || '-' }}</td>
                        <td><span class="d-inline-block text-truncate" style="max-width: 150px;" :title="row.address">{{ row.address || '-' }}</span></td>
                        <td>{{ row.policeStation || '-' }}</td>
                        <td>{{ row.mobile || '-' }}</td>
                        <td>{{ row.email || '-' }}</td>
                        <td><span class="d-inline-block text-truncate" style="max-width: 150px;" :title="row.hqAddress">{{ row.hqAddress || '-' }}</span></td>
                        <td>{{ row.forcedRegistration || '-' }}</td>
                        <td><span class="d-inline-block text-truncate" style="max-width: 100px;" :title="row.majorAreaOfEconomicActivity">{{ row.majorAreaOfEconomicActivity || '-' }}</span></td>
                        <td><span class="d-inline-block text-truncate" style="max-width: 100px;" :title="row.areasOfManufacturing">{{ row.areasOfManufacturing || '-' }}</span></td>
                        <td><span class="d-inline-block text-truncate" style="max-width: 100px;" :title="row.areasOfService">{{ row.areasOfService || '-' }}</span></td>
                        <td><span class="badge" :class="row.binStatus === 'Active' ? 'bg-success' : 'bg-danger'">{{ row.binStatus || '-' }}</span></td>
                        <td>{{ row.eTin || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
            </div>
            <p v-if="parsedData.length > 50" class="text-muted small mt-2">
              Showing first 50 rows of {{ parsedData.length }} total rows.
            </p>
          </div>
          <div class="modal-footer border-custom">
            <button type="button" class="btn btn-secondary" @click="closeModal">Cancel</button>
            <button type="button" class="btn btn-primary" @click="saveToDatabase" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              {{ saving ? 'Saving...' : 'Save to Database' }}
            </button>
          </div>
        </div>
      </div>
    </div>



    <!-- Missing Data Modal -->
    <div 
      class="modal fade" 
      id="missingDataModal" 
      tabindex="-1" 
      aria-hidden="true"
      ref="missingDataModalRef"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-surface border-custom shadow-lg">
          <div class="modal-header border-custom">
            <h5 class="modal-title fw-bold text-warning">
              <i class="bi bi-exclamation-triangle-fill me-2"></i> Missing Master Data
            </h5>
          </div>
          <div class="modal-body">
            <p class="text-muted">
              The following Divisions or Circles found in your file do not exist in the system. 
              You can automatically create them now to proceed with saving.
            </p>

            <div v-if="missingDivisions.length > 0" class="mb-3">
              <h6 class="fw-bold text-info border-bottom border-custom pb-1">Divisions to Create</h6>
              <ul class="list-unstyled mb-0">
                <li v-for="div in missingDivisions" :key="div">
                  <i class="bi bi-plus-circle text-success me-2"></i> {{ div }}
                </li>
              </ul>
            </div>

            <div v-if="missingCircles.length > 0">
              <h6 class="fw-bold text-info border-bottom border-custom pb-1">Circles to Create</h6>
              <ul class="list-unstyled mb-0">
                <li v-for="c in missingCircles" :key="c.name + c.division">
                  <i class="bi bi-plus-circle text-success me-2"></i> 
                  {{ c.name }} <span class="text-muted small ms-1">(Div: {{ c.division }})</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="modal-footer border-custom">
            <button type="button" class="btn btn-outline-secondary" @click="closeMissingDataModal" :disabled="creatingMissing">Cancel</button>
            <button type="button" class="btn btn-primary" @click="autoCreateMissingData" :disabled="creatingMissing">
              <span v-if="creatingMissing" class="spinner-border spinner-border-sm me-2"></span>
              {{ creatingMissing ? 'Creating & Saving...' : 'Auto Create & Retry Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import axios from '@/plugins/axios';
import * as bootstrap from 'bootstrap';
import { authUser } from '@/composables/useAuth';

useHead({ title: 'BIN Analyser | Analyser' });

const isAdmin = computed(() => {
  // Temporary bypass for previewing
  return true;
  // if (!authUser.value) return false;
  // const r = authUser.value.role?.name?.toLowerCase();
  // return r === 'admin' || r === 'super-admin' || r === 'superadmin';
});

let modalInstance: bootstrap.Modal | null = null;
let missingDataModalInst: bootstrap.Modal | null = null;

const fileInput = ref<HTMLInputElement | null>(null);
const previewModalRef = ref<HTMLElement | null>(null);
const missingDataModalRef = ref<HTMLElement | null>(null);

const loading = ref(false);
const processingProgress = ref(0);
let progressInterval: any = null;
const saving = ref(false);
const creatingMissing = ref(false);

const isSaving = ref(false);
const saveProgress = ref(0);
const totalSaved = ref(0);
const currentChunkIndex = ref(0);

const missingDivisions = ref<string[]>([]);
const missingCircles = ref<{ name: string; division: string }[]>([]);

const parsedData = ref<any[]>([]);

const formatDateDisplay = (val: any) => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const parts = val.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return val;
};

const activeTab = ref('mapping');

// --- Column Mapping State ---
const dbColumnsList = [
  { key: 'binIssueDate', label: 'BIN Issue Date' },
  { key: 'division', label: 'Division' },
  { key: 'circle', label: 'Circle' },
  { key: 'bin', label: 'BIN' },
  { key: 'entityName', label: 'Entity Name' },
  { key: 'address', label: 'Address' },
  { key: 'policeStation', label: 'Police Station' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'hqAddress', label: 'HQ Address' },
  { key: 'forcedRegistration', label: 'Forced Registration' },
  { key: 'majorAreaOfEconomicActivity', label: 'Major Area of Economic Activity' },
  { key: 'areasOfManufacturing', label: 'Areas of Manufacturing' },
  { key: 'areasOfService', label: 'Areas of Service' },
  { key: 'binStatus', label: 'BIN Status' },
  { key: 'eTin', label: 'e-TIN' }
];

const mappings = ref<Record<string, string>>({});

onMounted(() => {
  if (previewModalRef.value) {
    modalInstance = new bootstrap.Modal(previewModalRef.value, { backdrop: 'static', keyboard: false });
  }
  if (missingDataModalRef.value) {
    missingDataModalInst = new bootstrap.Modal(missingDataModalRef.value, { backdrop: 'static', keyboard: false });
  }
});


const triggerFileInput = () => fileInput.value?.click();

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
    const response = await axios.post('/api/bin-analyser/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    processingProgress.value = 100;
    setTimeout(() => {
      parsedData.value = response.data.data;
      modalInstance?.show();
    }, 800);
  } catch (error) {
    alert('Failed to upload or parse the file. Ensure it is a valid format.');
  } finally {
    setTimeout(() => {
      loading.value = false;
      clearInterval(progressInterval);
      if (fileInput.value) fileInput.value.value = '';
    }, 1000);
  }
};

const closeModal = () => {
  modalInstance?.hide();
  parsedData.value = [];
};

const closeMissingDataModal = () => missingDataModalInst?.hide();

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
      
      const response = await axios.post('/api/bin-analyser/save', { data: chunk });
      totalSaved.value += response.data.insertedRows;
      saveProgress.value = Math.round((Math.min(i + chunkSize, total) / total) * 100);
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    alert(`Success: Data saved successfully.`);
    closeModal();
    saveProgress.value = 0;
    totalSaved.value = 0;
    currentChunkIndex.value = 0;
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.missingDivisions) {
      missingDivisions.value = error.response.data.missingDivisions;
      missingCircles.value = error.response.data.missingCircles;
      missingDataModalInst?.show();
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
    for (const divName of missingDivisions.value) {
      await axios.post('/api/settings/divisions', { name: divName });
    }
    const divRes = await axios.get('/api/settings/divisions');
    const allDivs = divRes.data.data;

    for (const c of missingCircles.value) {
      const parentDiv = allDivs.find((d: any) => d.name.toLowerCase() === c.division.toLowerCase());
      if (parentDiv) {
        await axios.post('/api/settings/circles', { name: c.name, divisionId: parentDiv.id });
      }
    }

    alert('Successfully created missing master data!');
    closeMissingDataModal();
    await saveToDatabase(currentChunkIndex.value);
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to auto-create master data.');
  } finally {
    creatingMissing.value = false;
  }
};
</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.hover-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
  border-color: var(--app-secondary, #6c757d) !important;
}

/* Button overrides for anchor tags to ensure correct colors */
.btn-outline-info {
  color: #0dcaf0 !important;
  border-color: #0dcaf0 !important;
}
.btn-outline-info:hover {
  background-color: #0dcaf0 !important;
  color: #000 !important;
}
.btn-outline-warning {
  color: #ffc107 !important;
  border-color: #ffc107 !important;
}
.btn-outline-warning:hover {
  background-color: #ffc107 !important;
  color: #000 !important;
}
.btn-outline-success {
  color: #198754 !important;
  border-color: #198754 !important;
}
.btn-outline-success:hover {
  background-color: #198754 !important;
  color: #fff !important;
}
</style>
