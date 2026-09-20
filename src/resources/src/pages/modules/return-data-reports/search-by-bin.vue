<template>
  <div class="h-100 d-flex flex-column text-light">
    
    <!-- Filter Bar / Controls -->
    <div class="card bg-dark border-secondary mb-4 shadow-sm d-print-none">
      <div class="card-body p-3 d-flex align-items-center gap-3 flex-wrap">
        
        <button v-if="route.query.fromList" class="btn btn-outline-secondary text-light px-3 shadow-sm" @click="router.push({ name: 'return-non-filer-list' })" title="Back to List">
          <i class="bi bi-arrow-left me-1"></i> Back
        </button>

        <!-- Autocomplete Search -->
        <div class="position-relative" style="max-width: 400px; flex-grow: 1;">
          <div class="input-group search-input-group">
            <span class="input-group-text text-info"><i class="bi bi-search"></i></span>
            <input 
              type="text" 
              class="form-control text-light shadow-none" 
              placeholder="Search by BIN, Name, Mobile, or TIN..." 
              v-model="searchQuery"
              @focus="showDropdown = true"
              @blur="handleBlur"
              @keyup.enter="selectFirstMatch"
            >
            <button 
              v-if="searchQuery" 
              class="btn btn-link text-muted p-0 pe-3 text-decoration-none shadow-none" 
              type="button" 
              @click="clearSearch"
              title="Clear"
            >
              <i class="bi bi-x-lg small"></i>
            </button>
          </div>

          <!-- Dropdown List -->
          <ul class="dropdown-menu dropdown-menu-dark w-100 shadow position-absolute mt-1" :class="{ show: showDropdown && searchQuery.length > 0 }" style="max-height: 300px; overflow-y: auto; z-index: 1050;">
            <li v-for="item in searchResults" :key="item.bin">
              <a class="dropdown-item py-2 border-bottom border-secondary text-wrap" href="#" @mousedown.prevent="selectReport(item)">
                <div class="fw-bold text-light mb-1">{{ item.entityName || item.name || 'Unknown Entity' }}</div>
                <div class="text-muted small mb-1" style="font-size: 0.8rem; line-height: 1.2;">
                  <i class="bi bi-geo-alt-fill text-secondary me-1"></i>{{ item.address || 'Address not available' }}
                </div>
                <div class="small text-warning">
                  BIN: {{ item.bin }} 
                  <span class="text-info ms-3" v-if="item.mobile">
                    <i class="bi bi-telephone-fill ms-1 me-1"></i>{{ item.mobile }}
                  </span>
                </div>
              </a>
            </li>
            <li v-if="searchResults.length === 0">
              <span class="dropdown-item text-muted">No matches found.</span>
            </li>
          </ul>
        </div>
        
        <div class="d-flex gap-2 ms-auto">
          <button class="btn btn-primary px-3" @click="fetchReport()" :disabled="loading">
            <i class="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
          <button class="btn btn-outline-light px-3" @click="printReport" :disabled="loading || !selectedReport">
            <i class="bi bi-printer me-1"></i> Print
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!selectedReport" class="text-center py-5">
      <i class="bi bi-search text-muted" style="font-size: 3rem;"></i>
      <p class="mt-3 text-muted">Search for an entity by BIN, Name, or Mobile to view its non-filer penalty report.</p>
      <div v-if="loading" class="mt-2 text-info small">
        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        Syncing data in background...
      </div>
    </div>

    <!-- Report Content -->
    <div v-else class="reports-container flex-grow-1 overflow-auto pe-2">
      <div class="card bg-dark text-light border-secondary mb-5 printable-card">
        <div class="card-body p-4 p-print-0">
          
          <!-- Professional Report Header -->
          <div class="text-center mb-4 pb-3 border-bottom border-secondary report-header">
            <h3 class="fw-bold text-uppercase mb-1 text-light" style="letter-spacing: 1px;">Non-Filer Penalty Calculation</h3>
            <p class="text-muted mb-1 small">Value Added Tax (VAT) and Supplementary Duty Act, 2012</p>
            <div class="text-muted small fst-italic">Report Generated: {{ new Date().toLocaleString('en-GB') }}</div>
          </div>
          
          <!-- Entity Header -->
          <div class="mb-4">
            <div class="d-flex mb-2">
              <span class="fw-bold me-3" style="min-width: 140px;">BIN</span>
              <span class="fw-bold">: {{ selectedReport.bin }}</span>
            </div>

            <div class="d-flex mb-2 text-warning">
              <span class="fw-bold me-3" style="min-width: 140px;">Issue Date</span>
              <span class="fw-bold">
                : {{ formatDate(selectedReport.issueDate || selectedReport.binIssueDate) || '-' }}
                <span class="text-secondary ms-2 fst-italic" v-if="selectedReport.issueDate || selectedReport.binIssueDate" style="font-size: 0.9em;">
                  ({{ calculateTimeAgo(selectedReport.issueDate || selectedReport.binIssueDate) }})
                </span>
              </span>
            </div>
            
            <div class="d-flex mb-2">
              <span class="fw-bold me-3" style="min-width: 140px;">Name</span>
              <span>: {{ selectedReport.name || selectedReport.entityName || 'N/A' }}</span>
            </div>
            
            <div class="d-flex mb-2">
              <span class="fw-bold me-3" style="min-width: 140px;">Address</span>
              <span>: {{ selectedReport.address || 'N/A' }}</span>
            </div>
            
            <div class="d-flex mb-2">
              <span class="fw-bold me-3" style="min-width: 140px;">Mobile</span>
              <span class="fw-bold">: {{ selectedReport.mobile || 'N/A' }}</span>
            </div>
            
            <div class="d-flex mb-3 text-warning">
              <span class="fw-bold me-3" style="min-width: 140px;">Economic Activity</span>
              <span class="d-flex flex-wrap">
                <span class="me-2">:</span>
                <span>{{ [selectedReport.majorArea, selectedReport.manufacturingArea, selectedReport.serviceArea].filter(Boolean).join(' / ') || 'N/A' }}</span>
              </span>
            </div>
          </div>

          <!-- Penalty Table -->
          <div class="table-responsive mt-4">
            <table class="table table-bordered border-secondary table-dark table-sm mb-0 align-middle penalty-table">
              <thead class="align-middle">
                <tr>
                  <th style="width: 5%;" class="text-center">SL</th>
                  <th style="width: 40%;" class="text-start">Penalty Rate (Period)</th>
                  <th style="width: 12%;" class="text-center">Total Months</th>
                  <th style="width: 13%;" class="text-center">First Month</th>
                  <th style="width: 13%;" class="text-center">Last Month</th>
                  <th style="width: 17%;" class="text-end pe-2">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in penaltyBreakdown" :key="idx">
                  <td class="text-center">{{ Number(idx) + 1 }}</td>
                  <td class="text-start">
                    {{ row.ruleAmount }}/- ({{ row.rulePeriodStr }})
                  </td>
                  <td class="text-center">{{ row.totalMonths }}</td>
                  <td class="text-center">{{ row.firstMonth }}</td>
                  <td class="text-center">{{ row.totalMonths === 1 ? '' : row.lastMonth }}</td>
                  <td class="text-end pe-2">{{ row.totalAmount ? row.totalAmount.toLocaleString() : '0' }}</td>
                </tr>
                <!-- Footer / Grand Total -->
                <tr class="grand-total-row">
                  <td colspan="2" class="text-start fw-bold" style="padding-left: 50px;">Grand Total =</td>
                  <td class="text-center fw-bold">{{ grandTotalMonths }}</td>
                  <td colspan="2"></td>
                  <td class="text-end fw-bold pe-2">{{ grandTotalAmount.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '@/plugins/axios';

const route = useRoute();
const router = useRouter();
const reports = ref<any[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const showDropdown = ref(false);
const selectedReport = ref<any | null>(null);

const searchResults = computed(() => {
  if (!searchQuery.value) return [];
  const clean = (str: any) => String(str || '').replace(/[-_ ]/g, '').toLowerCase();
  const q = clean(searchQuery.value);
  
  return reports.value.filter(r => 
    clean(r.bin).includes(q) || 
    clean(r.entityName || r.name).includes(q) ||
    clean(r.mobile).includes(q) ||
    clean(r.eTin).includes(q)
  ).slice(0, 50);
});

const selectReport = (report: any) => {
  searchQuery.value = report.bin;
  showDropdown.value = false;
  fetchReport(report.bin);
};

const selectFirstMatch = () => {
  if (searchResults.value.length > 0) {
    selectReport(searchResults.value[0]);
  }
};

const clearSearch = () => {
  searchQuery.value = '';
  selectedReport.value = null;
  showDropdown.value = false;
};

const handleBlur = () => {
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
};

const fetchSearchOptions = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/return-data-analyser/non-filer-list');
    reports.value = res.data.data || [];
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const fetchReport = async (binOverride?: string) => {
  const targetBin = binOverride || (selectedReport.value ? selectedReport.value.bin : searchQuery.value);
  if (!targetBin) return;

  loading.value = true;
  try {
    const res = await axios.get('/api/return-data-analyser/non-filer-list?q=' + encodeURIComponent(targetBin));
    if (res.data.data && res.data.data.length > 0) {
      selectedReport.value = res.data.data[0];
    } else {
      alert('No non-filer record found for this BIN');
      selectedReport.value = null;
    }
  } catch (error) {
    console.error(error);
    alert('Failed to load report');
  } finally {
    loading.value = false;
  }
};

const penaltyBreakdown = computed(() => {
  if (!selectedReport.value) return [];
  if (selectedReport.value.penaltyBreakdown) return selectedReport.value.penaltyBreakdown;
  const unfiled = selectedReport.value.grandTotalMonths || selectedReport.value.nonFiledMonths || 0;
  const rate = 10000;
  return [
    {
      ruleAmount: rate,
      rulePeriodStr: 'Per Non-Filed Tax Period',
      totalMonths: unfiled,
      firstMonth: '-',
      lastMonth: '-',
      totalAmount: unfiled * rate
    }
  ];
});

const grandTotalMonths = computed(() => {
  if (!selectedReport.value) return 0;
  return selectedReport.value.grandTotalMonths || selectedReport.value.nonFiledMonths || 0;
});

const grandTotalAmount = computed(() => {
  return penaltyBreakdown.value.reduce((acc: number, r: any) => acc + (r.totalAmount || 0), 0);
});

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const calculateTimeAgo = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  let days = now.getDate() - d.getDate();
  
  if (days < 0) {
    months--;
    const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += previousMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  
  if (parts.length === 0) return 'Today';
  return parts.join(', ') + ' ago';
};

const printReport = () => {
  window.print();
};

onMounted(async () => {
  await fetchSearchOptions();
  if (route.query.bin) {
    const bin = route.query.bin as string;
    searchQuery.value = bin;
    await fetchReport(bin);
  }
});
</script>

<style scoped>
.penalty-table th {
  background-color: #2c3034 !important;
  color: #fff;
}
.penalty-table td, .penalty-table th {
  border-color: #495057;
}

@media print {
  @page {
    size: A4;
    margin: 1.5cm;
  }
  body * {
    visibility: hidden;
  }
  .printable-card, .printable-card * {
    visibility: visible;
  }
  .printable-card {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: white !important;
    color: black !important;
  }
  .text-warning, .text-danger, .text-info, .text-muted, .text-secondary, .text-light, .fw-bold {
    color: black !important;
  }
  
  .report-header {
    border-bottom: 2px solid black !important;
  }

  .penalty-table {
    border-color: black !important;
  }
  .penalty-table td, .penalty-table th {
    border-color: black !important;
    background: transparent !important;
    color: black !important;
  }
}
</style>
