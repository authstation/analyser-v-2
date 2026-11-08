<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    
    <!-- Top Row for Back Button -->
    <div class="p-4 pb-0 text-start">
      <router-link to="/dashboard" class="btn btn-primary btn-sm rounded-3 px-3 d-inline-flex align-items-center shadow-sm">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
    </div>

    <!-- Main Content -->
    <main class="flex-grow-1 p-4">
      <div class="container">
        <div class="row g-4 mt-2 justify-content-center">
          
          <!-- Upload File Card -->
          <div class="col-md-4">
            <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
              <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                <div class="mb-3">
                  <i class="bi bi-cloud-arrow-up text-success" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold text-app">Upload iBAS++ Data</h5>
                <p class="card-text text-muted small mb-3">Select office and upload your iBAS++ (VDS) report in Excel format.</p>
                
                <div class="mb-3 text-start position-relative">
                  <div class="input-group">
                    <span class="input-group-text bg-surface border-custom text-info"><i class="bi bi-search"></i></span>
                    <input 
                      type="text" 
                      class="form-control bg-surface border-custom text-app shadow-none" 
                      placeholder="Type Office Name..."
                      v-model="officeSearchText"
                      @focus="isOfficeDropdownOpen = true"
                    >
                  </div>
                  <ul 
                    class="dropdown-menu dropdown-menu-dark w-100 shadow-lg border-custom position-absolute mt-1" 
                    :class="{ show: isOfficeDropdownOpen }" 
                    style="z-index: 1050; max-height: 250px; overflow-y: auto; background-color: var(--app-surface, #212529);"
                  >
                    <li v-for="office in filteredOffices" :key="office.id">
                      <button 
                        class="dropdown-item py-2" 
                        @mousedown.prevent="selectOffice(office)" 
                        :class="{ 'active bg-success text-white': selectedOffice === office.id }"
                      >
                        {{ office.officeName }} 
                        <span class="small" :class="selectedOffice === office.id ? 'text-light' : 'text-muted'">({{ office.areaName }})</span>
                      </button>
                    </li>
                    <li v-if="filteredOffices.length === 0">
                      <span class="dropdown-item text-muted">No matching offices</span>
                    </li>
                  </ul>
                  <!-- Backdrop to close dropdown -->
                  <div v-if="isOfficeDropdownOpen" class="position-fixed top-0 start-0 w-100 h-100" style="z-index: 1040;" @click="isOfficeDropdownOpen = false"></div>
                </div>

                <input 
                  type="file" 
                  ref="fileInput" 
                  @change="handleFileUpload" 
                  accept=".xlsx, .xls, .csv" 
                  class="d-none" 
                  :disabled="!selectedOffice || isUploading"
                />
                <button 
                  class="btn btn-outline-success w-100 mt-auto" 
                  @click="triggerFileInput"
                  :disabled="!selectedOffice || isUploading"
                >
                  <span v-if="isUploading" class="spinner-border spinner-border-sm me-2"></span>
                  {{ isUploading ? 'Processing...' : 'Choose Excel File' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Reports Card -->
          <div class="col-md-4">
            <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
              <div class="card-body text-center p-4 d-flex flex-column justify-content-center">
                <div class="mb-3">
                  <i class="bi bi-pie-chart text-info" style="font-size: 3rem;"></i>
                </div>
                <h5 class="card-title fw-bold text-app">Reports</h5>
                <p class="card-text text-muted small mb-4">View generated reports and analytical insights from your iBAS++ data.</p>
                <router-link to="/modules/ibas-reports/dashboard" class="btn btn-outline-info w-100 mt-auto">View Reports</router-link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>

    <!-- Preview Modal -->
    <div class="modal fade" id="ibasPreviewModal" tabindex="-1" aria-hidden="true" ref="previewModalRef">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title text-app"><i class="bi bi-file-earmark-check text-info me-2"></i> Data Preview & Validation</h5>
            <button type="button" class="btn-close btn-close-white" @click="closePreviewModal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0">
            <!-- Tabs -->
            <ul class="nav nav-tabs nav-tabs-custom border-custom px-3 pt-2">
              <li class="nav-item">
                <a class="nav-link cursor-pointer" :class="{ active: previewTab === 'valid' }" @click.prevent="previewTab = 'valid'" href="#">
                  <i class="bi bi-check-circle text-success me-1"></i> Valid Records 
                  <span class="badge bg-success ms-1">{{ validRecords.length }}</span>
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link cursor-pointer" :class="{ active: previewTab === 'unknown' }" @click.prevent="previewTab = 'unknown'" href="#">
                  <i class="bi bi-exclamation-triangle text-warning me-1"></i> Unknown Items
                  <span class="badge bg-warning text-dark ms-1">{{ unknownItems.length }}</span>
                </a>
              </li>
            </ul>

            <div class="p-3">
              <!-- Valid Records -->
              <div v-if="previewTab === 'valid'">
                <div v-if="validRecords.length === 0" class="alert alert-warning border-warning">
                  No valid records found or all rows have missing required columns.
                </div>
                <div v-else class="table-responsive" style="max-height: 400px;">
                  <table class="table table-hover table-sm align-middle mb-0">
                    <thead class="bg-surface border-bottom border-custom sticky-top">
                      <tr class="text-muted">
                        <th class="text-center" style="width: 50px;">#</th>
                        <th class="text-center" style="width: 110px;">Date</th>
                        <th class="text-start">Item</th>
                        <th class="text-start">Office</th>
                        <th class="text-end" style="width: 120px;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(record, index) in paginatedValidRecords" :key="index">
                        <td class="text-center text-muted">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                        <td class="text-center text-app">{{ new Date(record.date).toLocaleDateString('en-GB') }}</td>
                        <td class="text-start text-app">{{ record.item }}</td>
                        <td class="text-start text-app">{{ record.office }}</td>
                        <td class="text-end font-monospace text-app fw-bold">{{ record.amount.toLocaleString() }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <!-- Pagination -->
                <div v-if="totalPages > 1" class="d-flex justify-content-between align-items-center mt-3 px-2">
                  <div class="text-muted small">
                    Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} to {{ Math.min(currentPage * itemsPerPage, validRecords.length) }} of {{ validRecords.length }} records
                  </div>
                  <ul class="pagination pagination-sm mb-0">
                    <li class="page-item" :class="{ disabled: currentPage === 1 }">
                      <a class="page-link" href="#" @click.prevent="currentPage > 1 && currentPage--">Previous</a>
                    </li>
                    <li class="page-item disabled">
                      <span class="page-link">Page {{ currentPage }} of {{ totalPages }}</span>
                    </li>
                    <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                      <a class="page-link" href="#" @click.prevent="currentPage < totalPages && currentPage++">Next</a>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Unknown Items -->
              <div v-if="previewTab === 'unknown'">
                <div v-if="unknownItems.length === 0" class="alert alert-success border-success">
                  All items are mapped! No unknown items found.
                </div>
                <div v-else>
                  <div class="alert alert-warning border-warning d-flex align-items-center mb-3">
                    <i class="bi bi-info-circle-fill me-3 fs-5"></i>
                    <small>These items are not mapped in the system. You must request the Admin to map them before they can be saved.</small>
                  </div>
                  <ul class="list-group list-group-flush border border-custom rounded">
                    <li v-for="item in unknownItems" :key="item" class="list-group-item bg-surface text-app border-custom">
                      <i class="bi bi-question-circle text-warning me-2"></i> {{ item }}
                    </li>
                  </ul>
                  <div class="text-end mt-3">
                    <button class="btn btn-warning" @click="requestMappings" :disabled="requestingMappings">
                      <span v-if="requestingMappings" class="spinner-border spinner-border-sm me-1"></span>
                      Request Admin to Map Items
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer border-custom justify-content-between">
            <div class="w-50">
              <div v-if="isSaving" class="progress mb-1" style="height: 10px;">
                <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" :style="{ width: saveProgress + '%' }"></div>
              </div>
              <small v-if="isSaving" class="text-muted">{{ totalSaved }} / {{ validRecords.length }} records saved...</small>
            </div>
            <div>
              <button type="button" class="btn btn-secondary me-2" @click="closePreviewModal" :disabled="isSaving">Close</button>
              <button 
                type="button" 
                class="btn btn-success" 
                @click="saveValidRecords" 
                :disabled="validRecords.length === 0 || isSaving || unknownItems.length > 0"
              >
                <i class="bi bi-cloud-arrow-up me-1"></i> Save to Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Modal } from 'bootstrap';
import { useAuthStore } from '@/stores/auth';
import axios from '@/plugins/axios';

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.user?.role === 'admin');

const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const isOfficeDropdownOpen = ref(false);
const officeSearchText = ref('');
const selectedOffice = ref<number | null>(null);
const offices = ref<any[]>([]);

// Pagination State
const currentPage = ref(1);
const itemsPerPage = 8;

// Preview Modal State
const previewModalRef = ref<HTMLElement | null>(null);
let previewModalInst: Modal | null = null;
const previewTab = ref<'valid' | 'unknown'>('valid');
const validRecords = ref<any[]>([]);
const unknownItems = ref<string[]>([]);
const isSaving = ref(false);
const saveProgress = ref(0);
const totalSaved = ref(0);
const requestingMappings = ref(false);

const filteredOffices = computed(() => {
  if (!officeSearchText.value.trim()) return offices.value;
  const q = officeSearchText.value.toLowerCase();
  return offices.value.filter(
    (o: any) =>
      (o.officeName && o.officeName.toLowerCase().includes(q)) ||
      (o.areaName && o.areaName.toLowerCase().includes(q))
  );
});

const selectOffice = (office: any) => {
  selectedOffice.value = office.id;
  officeSearchText.value = `${office.officeName} (${office.areaName})`;
  isOfficeDropdownOpen.value = false;
};

const totalPages = computed(() => Math.ceil(validRecords.value.length / itemsPerPage) || 1);
const paginatedValidRecords = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return validRecords.value.slice(start, start + itemsPerPage);
});

const triggerFileInput = () => {
  if (fileInput.value) fileInput.value.click();
};

const fetchOffices = async () => {
  try {
    const res = await axios.get('/api/ibas/offices');
    offices.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error('Failed to fetch offices:', error);
  }
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  isUploading.value = true;
  try {
    const res = await axios.post('/api/ibas/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    validRecords.value = res.data.validRecords || [];
    unknownItems.value = res.data.unknownItems || [];
    previewTab.value = unknownItems.value.length > 0 ? 'unknown' : 'valid';
    currentPage.value = 1;
    
    if (previewModalInst) previewModalInst.show();
    if (fileInput.value) fileInput.value.value = '';
  } catch (error: any) {
    console.error('File parsing failed:', error);
    alert(error.response?.data?.error || 'Failed to parse file');
  } finally {
    isUploading.value = false;
  }
};

const closePreviewModal = () => {
  previewModalInst?.hide();
};

const saveValidRecords = async () => {
  if (validRecords.value.length === 0) return;
  if (unknownItems.value.length > 0) {
    alert('Please resolve unknown items before saving.');
    return;
  }

  isSaving.value = true;
  saveProgress.value = 0;
  totalSaved.value = 0;

  const chunkSize = 1000;
  for (let i = 0; i < validRecords.value.length; i += chunkSize) {
    const chunk = validRecords.value.slice(i, i + chunkSize);
    try {
      const res = await axios.post('/api/ibas/save', { records: chunk, officeId: selectedOffice.value });
      totalSaved.value += res.data.savedCount || 0;
      saveProgress.value = Math.round(((i + chunk.length) / validRecords.value.length) * 100);
    } catch (err: any) {
      console.error('Error saving chunk', err);
      alert('Error saving data: ' + (err.response?.data?.error || err.message));
      isSaving.value = false;
      return;
    }
  }

  isSaving.value = false;
  const count = totalSaved.value;
  closePreviewModal();
  if (count > 0) {
    alert(`Success: ${count} records saved to database successfully.`);
  } else {
    alert('Notice: No records were saved to the database.');
  }
};

const requestMappings = async () => {
  if (unknownItems.value.length === 0) return;
  requestingMappings.value = true;
  try {
    await axios.post('/api/ibas/request-mapping', { items: unknownItems.value });
    alert('Requested Admin to map items successfully.');
  } catch (error: any) {
    console.error('Failed to request mappings:', error);
    alert('Failed to request mappings.');
  } finally {
    requestingMappings.value = false;
  }
};

onMounted(() => {
  fetchOffices();
  if (previewModalRef.value) {
    previewModalInst = new Modal(previewModalRef.value, { backdrop: 'static', keyboard: false });
  }
});
</script>

<style scoped>
.hover-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.2) !important;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
