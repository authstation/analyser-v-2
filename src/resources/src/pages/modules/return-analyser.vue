<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    
    <!-- System Toast Component -->
    <Toast ref="toastRef" />

    <!-- Full-screen Loading Overlay -->
    <ProgressOverlay v-if="loading" label="Processing File..." :progress="processingProgress" color="info">
      Please wait while we parse your Excel file.<br>
      For large files (thousands of rows), this may take a few moments. Do not close or refresh this page.
    </ProgressOverlay>

    <!-- Full-screen Saving Overlay -->
    <ProgressOverlay v-if="isSaving" label="Saving to Database..." :progress="saveProgress" color="primary">
      Please wait while we save your data.<br>
      Do not close or refresh this page.
    </ProgressOverlay>

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
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h5 class="modal-title mb-0 me-2">Data Processing Preview</h5>
              <!-- Tab Switches -->
              <div class="btn-group btn-group-sm">
                <button 
                  type="button" 
                  class="btn" 
                  :class="activeModalTab === 'matched' ? 'btn-primary' : 'btn-outline-secondary text-light'" 
                  @click="activeModalTab = 'matched'"
                >
                  <i class="bi bi-check-circle me-1"></i> Matched Returns ({{ parsedData.length }})
                </button>
                <button 
                  v-if="unmatchedList.length > 0"
                  type="button" 
                  class="btn" 
                  :class="activeModalTab === 'unmatched' ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning'" 
                  @click="activeModalTab = 'unmatched'"
                >
                  <i class="bi bi-exclamation-triangle-fill me-1"></i> Skipped / Missing BINs ({{ unmatchedList.length }})
                </button>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="closeModal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <!-- Filtered BIN Info Alert -->
            <div v-if="unmatchedRowsCount > 0" class="alert alert-warning py-2 px-3 mb-3 small d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div class="d-flex align-items-center">
                <i class="bi bi-info-circle-fill fs-5 me-2 flex-shrink-0 text-warning"></i>
                <div>
                  আপলোডকৃত ফাইলের <strong>{{ unmatchedRowsCount }}টি রিটার্ন ({{ unmatchedBinsCount || uniqueUnmatchedBinsCount }}টি অনিবন্ধিত বিন)</strong> ফিল্টার করে বাদ দেওয়া হয়েছে, কারণ এগুলো মাস্টার বিন ডেটাতে নিবন্ধিত নেই।
                </div>
              </div>
              <div class="d-flex gap-2">
                <button 
                  type="button" 
                  class="btn btn-sm" 
                  :class="activeModalTab === 'unmatched' ? 'btn-dark text-warning' : 'btn-outline-dark'" 
                  @click="activeModalTab = activeModalTab === 'unmatched' ? 'matched' : 'unmatched'"
                >
                  <i class="bi bi-list-ul me-1"></i> {{ activeModalTab === 'unmatched' ? 'ম্যাচ হওয়া রিটার্ন দেখুন' : 'বাদ পড়া তালিকা দেখুন' }}
                </button>
                <button 
                  type="button" 
                  class="btn btn-sm btn-dark text-warning d-flex align-items-center shadow-sm" 
                  @click="downloadUnmatchedCsv"
                  title="Download Skipped BINs as CSV"
                >
                  <i class="bi bi-download me-1"></i> ডাউনলোড তালিকা
                </button>
              </div>
            </div>

            <!-- Tab 1: Matched Returns Table -->
            <div v-if="activeModalTab === 'matched'" class="table-responsive">
              <table class="table table-striped table-bordered text-nowrap" style="font-size: 0.85rem;">
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

            <!-- Tab 2: Skipped / Unmatched Returns Table -->
            <div v-else-if="activeModalTab === 'unmatched'">
              <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge bg-warning text-dark fs-6">{{ unmatchedList.length }} Skipped Records</span>
                  <span class="badge bg-secondary fs-6">{{ uniqueUnmatchedBinsCount }} Unique Unregistered BINs</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <input 
                    type="text" 
                    v-model="unmatchedSearchQuery" 
                    class="form-control form-control-sm bg-dark text-light border-secondary" 
                    placeholder="Search skipped BIN, name, circle..." 
                    style="width: 250px;"
                  />
                  <button 
                    type="button" 
                    class="btn btn-warning btn-sm text-dark fw-bold d-flex align-items-center shadow-sm text-nowrap" 
                    @click="downloadUnmatchedCsv"
                  >
                    <i class="bi bi-download me-1"></i> Download Skipped BINs (.csv)
                  </button>
                </div>
              </div>

              <div class="table-responsive">
                <table class="table table-dark table-striped table-bordered text-nowrap align-middle" style="font-size: 0.85rem;">
                  <thead class="table-dark">
                    <tr class="text-center">
                      <th style="width: 50px;">#</th>
                      <th class="text-start ps-3">BIN</th>
                      <th class="text-start ps-3">Entity / Taxpayer Name</th>
                      <th>Submission ID</th>
                      <th>Tax Period</th>
                      <th>Circle</th>
                      <th>Division</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="paginatedUnmatchedList.length === 0">
                      <td colspan="8" class="text-center py-4 text-muted">No skipped records found matching your search.</td>
                    </tr>
                    <tr v-for="(row, idx) in paginatedUnmatchedList" :key="idx" class="text-center">
                      <td class="text-muted">{{ (unmatchedCurrentPage - 1) * unmatchedPageSize + idx + 1 }}</td>
                      <td class="text-start ps-3 font-monospace text-warning fw-bold">{{ row.bin }}</td>
                      <td class="text-start ps-3 text-light">{{ row.name || '-' }}</td>
                      <td class="font-monospace text-muted">{{ row.submissionId || '-' }}</td>
                      <td><span class="badge bg-secondary">{{ row.taxPeriod || '-' }}</span></td>
                      <td>{{ row.circle || '-' }}</td>
                      <td>{{ row.division || '-' }}</td>
                      <td>
                        <span class="badge bg-danger bg-opacity-25 text-danger border border-danger">
                          <i class="bi bi-x-circle me-1"></i>{{ row.reason }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div v-if="unmatchedTotalPages > 1" class="d-flex justify-content-between align-items-center mt-3">
                <div class="text-muted small">
                  Showing {{ (unmatchedCurrentPage - 1) * unmatchedPageSize + 1 }} to {{ Math.min(unmatchedCurrentPage * unmatchedPageSize, filteredUnmatchedList.length) }} of {{ filteredUnmatchedList.length }} entries
                </div>
                <ul class="pagination pagination-sm mb-0">
                  <li class="page-item" :class="{ disabled: unmatchedCurrentPage === 1 }">
                    <button class="page-link bg-dark text-light border-secondary" @click="unmatchedCurrentPage--">Prev</button>
                  </li>
                  <li class="page-item disabled">
                    <span class="page-link bg-dark text-light border-secondary">Page {{ unmatchedCurrentPage }} of {{ unmatchedTotalPages }}</span>
                  </li>
                  <li class="page-item" :class="{ disabled: unmatchedCurrentPage === unmatchedTotalPages }">
                    <button class="page-link bg-dark text-light border-secondary" @click="unmatchedCurrentPage++">Next</button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="modal-footer border-custom justify-content-between">
            <div class="text-muted small">
              <span v-if="activeModalTab === 'matched'">
                <i class="bi bi-info-circle me-1"></i> Data will be validated during saving.
              </span>
              <span v-else class="text-warning">
                <i class="bi bi-exclamation-triangle me-1"></i> These returns cannot be saved because their BINs are not in the master database.
              </span>
            </div>
            <div class="d-flex gap-2">
              <button 
                v-if="unmatchedList.length > 0"
                type="button" 
                class="btn btn-outline-warning btn-sm" 
                @click="downloadUnmatchedCsv"
              >
                <i class="bi bi-download me-1"></i> Download Skipped List
              </button>
              <button type="button" class="btn btn-secondary" @click="closeModal" :disabled="saving">Cancel</button>
              <button type="button" class="btn btn-success" @click="saveToDatabase" :disabled="saving || parsedData.length === 0">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                Save Matched Data ({{ parsedData.length }})
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
import { returnDataApi, settingsApi } from '@/services/api/index.js';
import { useAuthStore } from '@/stores/auth';
import { Modal } from 'bootstrap';
import Pagebar from '@/components/Pagebar.vue';
import { formatDateDisplay } from '@/utils/format';
import ProgressOverlay from '@/components/ProgressOverlay.vue';
import Toast from '@/components/Toast.vue';

const authStore = useAuthStore();


// --- File Upload State ---
const fileInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const processingProgress = ref(0);
let progressInterval: any = null;

// --- Data State ---
const parsedData = ref<any[]>([]);
const unmatchedRowsCount = ref(0);
const unmatchedBinsCount = ref(0);
const totalFileRows = ref(0);
const isSaving = ref(false);
const saving = ref(false);
const saveProgress = ref(0);
const totalSaved = ref(0);
const currentChunkIndex = ref(0);

// --- Skipped / Unmatched Data State ---
const unmatchedList = ref<any[]>([]);
const activeModalTab = ref<'matched' | 'unmatched'>('matched');
const unmatchedSearchQuery = ref('');
const unmatchedCurrentPage = ref(1);
const unmatchedPageSize = ref(15);

const filteredUnmatchedList = computed(() => {
  if (!unmatchedSearchQuery.value.trim()) return unmatchedList.value;
  const q = unmatchedSearchQuery.value.toLowerCase().trim();
  return unmatchedList.value.filter((r) => 
    String(r.bin || '').toLowerCase().includes(q) ||
    String(r.name || '').toLowerCase().includes(q) ||
    String(r.circle || '').toLowerCase().includes(q) ||
    String(r.division || '').toLowerCase().includes(q) ||
    String(r.submissionId || '').toLowerCase().includes(q)
  );
});

const paginatedUnmatchedList = computed(() => {
  const start = (unmatchedCurrentPage.value - 1) * unmatchedPageSize.value;
  return filteredUnmatchedList.value.slice(start, start + unmatchedPageSize.value);
});

const unmatchedTotalPages = computed(() => {
  return Math.ceil(filteredUnmatchedList.value.length / unmatchedPageSize.value) || 1;
});

const uniqueUnmatchedBinsCount = computed(() => {
  return new Set(unmatchedList.value.map(r => r.bin).filter(b => b && b !== 'N/A')).size;
});

const downloadUnmatchedCsv = () => {
  if (unmatchedList.value.length === 0) return;

  const headers = [
    "SL",
    "BIN",
    "Entity Name",
    "Tax Period",
    "Submission ID",
    "Circle",
    "Division",
    "Skip Reason"
  ];

  const csvRows = unmatchedList.value.map((r, idx) => {
    const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
    const binFormatted = `"=""${r.bin || ''}"""`;
    return [
      idx + 1,
      binFormatted,
      escape(r.name || '-'),
      escape(r.taxPeriod || '-'),
      escape(r.submissionId || '-'),
      escape(r.circle || '-'),
      escape(r.division || '-'),
      escape(r.reason || 'BIN not in Master Database')
    ].join(",");
  });

  const csvContent = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `Skipped_Unmatched_BINs_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

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
    const response = await returnDataApi.parse(formData);
    
    processingProgress.value = 100;
    setTimeout(() => {
      parsedData.value = response.data || [];
      unmatchedRowsCount.value = response.unmatchedRows || 0;
      unmatchedBinsCount.value = response.unmatchedBins || 0;
      unmatchedList.value = response.unmatchedList || [];
      totalFileRows.value = response.totalRows || (parsedData.value.length + unmatchedRowsCount.value);
      activeModalTab.value = parsedData.value.length > 0 ? 'matched' : 'unmatched';
      unmatchedCurrentPage.value = 1;
      unmatchedSearchQuery.value = '';
      if (previewModalInst) {
        previewModalInst.show();
      }
    }, 800);

  } catch (error: any) {
    console.error('File Upload Error:', error);
    const errData = error.response?.data;
    if (errData?.unmatchedList && errData.unmatchedList.length > 0) {
      parsedData.value = [];
      unmatchedList.value = errData.unmatchedList;
      unmatchedRowsCount.value = errData.unmatchedRows || errData.unmatchedList.length;
      unmatchedBinsCount.value = errData.unmatchedBins || 0;
      activeModalTab.value = 'unmatched';
      unmatchedCurrentPage.value = 1;
      unmatchedSearchQuery.value = '';
      if (previewModalInst) {
        previewModalInst.show();
      }
    }
    const errorMsg = errData?.error || error.message || 'Failed to upload or parse the file.';
    showToast(errorMsg, 'danger');
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
  unmatchedRowsCount.value = 0;
  unmatchedBinsCount.value = 0;
  totalFileRows.value = 0;
};

const closeMissingDataModal = () => {
  if (missingDataModalInst) missingDataModalInst.hide();
};

// --- Toast Component Ref ---
const toastRef = ref<any>(null);

const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' | 'error' = 'success') => {
  const bg = type === 'error' ? 'danger' : type;
  toastRef.value?.toastme(message, bg);
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
      
      const response = await returnDataApi.save(chunk);
      
      totalSaved.value += response.insertedRows;
      saveProgress.value = Math.round((Math.min(i + chunkSize, total) / total) * 100);
    }

    const savedCount = totalSaved.value || total;
    closeModal();
    isSaving.value = false;
    saving.value = false;
    saveProgress.value = 0;
    totalSaved.value = 0;
    currentChunkIndex.value = 0;

    showToast(`ডাটা সফলভাবে সংরক্ষণ করা হয়েছে (${savedCount}টি রেকর্ড)!`, 'success');
  } catch (error: any) {
    isSaving.value = false;
    saving.value = false;
    if (error.response?.status === 400 && error.response?.data?.missingDivisions) {
      missingDivisions.value = error.response.data.missingDivisions;
      missingCircles.value = error.response.data.missingCircles;
      if (missingDataModalInst) {
        missingDataModalInst.show();
      }
    } else {
      showToast(error.response?.data?.error || 'Failed to save data to database.', 'danger');
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
      await settingsApi.createDivision({ name: divName });
    }

    const divRes = await settingsApi.getDivisions();
    const allDivs = divRes.data;

    // Create Circles
    for (const c of missingCircles.value) {
      const parentDiv = allDivs.find((d: any) => d.name.toLowerCase() === c.division.toLowerCase());
      if (parentDiv) {
        await settingsApi.createCircle({ 
          name: c.name, 
          divisionId: parentDiv.id 
        });
      }
    }

    showToast('Successfully created missing master data!', 'success');
    closeMissingDataModal();
    
    // Retry Save from the chunk that failed
    await saveToDatabase(currentChunkIndex.value);

  } catch (error: any) {
    showToast(error.response?.data?.error || 'Failed to auto-create master data.', 'danger');
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



