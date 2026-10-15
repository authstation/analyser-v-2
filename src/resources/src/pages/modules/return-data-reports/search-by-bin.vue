<template>
  <div class="h-100 d-flex flex-column text-light">
    
    <!-- Filter Bar / Controls -->
    <div class="card bg-dark border-secondary mb-4 shadow-sm d-print-none">
      <div class="card-body p-3 d-flex align-items-center gap-3 flex-wrap">
        
        <button v-if="route.query.fromList" class="btn btn-outline-secondary text-light px-3 shadow-sm" @click="handleBack" title="Back to List">
          <i class="bi bi-arrow-left me-1"></i> Back
        </button>

        <!-- Autocomplete Search -->
        <div class="position-relative" style="max-width: 400px; flex-grow: 1;">
          <div class="input-group search-input-group">
            <span class="input-group-text text-info" role="button" style="cursor: pointer;" title="Search" @click="handleEnterSearch"><i class="bi bi-search"></i></span>
            <input 
              type="text" 
              class="form-control text-light shadow-none" 
              placeholder="Search by BIN, Name, Mobile, or TIN..." 
              v-model="searchQuery"
              @input="onSearchInput"
              @focus="onFocus"
              @blur="handleBlur"
              @keyup.enter="handleEnterSearch"
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
          <ul class="dropdown-menu dropdown-menu-dark w-100 shadow position-absolute mt-1" :class="{ show: showDropdown && searchQuery.trim().length >= minSuggestLength }" style="max-height: 300px; overflow-y: auto; z-index: 1050;">
            <li v-for="item in suggestions" :key="item.bin">
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
            <li v-if="suggestLoading">
              <span class="dropdown-item text-muted"><span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Searching...</span>
            </li>
            <li v-else-if="suggestions.length === 0 && suggestionsLoaded">
              <span class="dropdown-item text-muted">No matches found.</span>
            </li>
          </ul>
        </div>
        
        <div class="d-flex gap-2 ms-auto">
          <button class="btn btn-primary px-3" @click="handleRefresh" :disabled="loading">
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
        Loading report...
      </div>
    </div>

    <!-- Report Content -->
    <div v-else class="reports-container flex-grow-1 overflow-auto">
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
                  <td class="text-center">{{ row.firstMonth || '-' }}</td>
                  <td class="text-center">{{ row.totalMonths === 1 ? '-' : (row.lastMonth || '-') }}</td>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '@/plugins/axios';

const route = useRoute();
const router = useRouter();

const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: 'return-non-filer-list' });
  }
};
const loading = ref(false);
const searchQuery = ref('');
const showDropdown = ref(false);
const selectedReport = ref<any | null>(null);

// Autocomplete suggestions are fetched on demand (debounced) and never
// preloaded, so opening the tab keeps the screen idle with no spinner.
const suggestions = ref<any[]>([]);
const suggestLoading = ref(false);
const suggestionsLoaded = ref(false);
const minSuggestLength = 3;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const fetchReport = async (binOverride?: string) => {
  const targetBin = (binOverride || searchQuery.value || '').trim();
  if (!targetBin) return;

  loading.value = true;
  showDropdown.value = false;
  try {
    const res = await axios.get('/api/return-data-analyser/non-filer-list?q=' + encodeURIComponent(targetBin));
    if (res.data.data && res.data.data.length > 0) {
      // Find exact BIN match if multiple returned
      const exact = res.data.data.find((item: any) => item.bin === targetBin);
      selectedReport.value = exact || res.data.data[0];
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

const fetchSuggestions = async (term: string) => {
  suggestLoading.value = true;
  try {
    const res = await axios.get('/api/return-data-analyser/non-filer-list?q=' + encodeURIComponent(term));
    // Ignore stale responses if the query changed while this request was in flight.
    if (searchQuery.value.trim() !== term) return;
    suggestions.value = (res.data.data || []).slice(0, 50);
    suggestionsLoaded.value = true;
  } catch (error) {
    console.error(error);
    if (searchQuery.value.trim() === term) {
      suggestions.value = [];
      suggestionsLoaded.value = true;
    }
  } finally {
    if (searchQuery.value.trim() === term) suggestLoading.value = false;
  }
};

const onSearchInput = () => {
  showDropdown.value = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  const term = searchQuery.value.trim();
  if (term.length < minSuggestLength) {
    suggestions.value = [];
    suggestionsLoaded.value = false;
    suggestLoading.value = false;
    return;
  }
  debounceTimer = setTimeout(() => fetchSuggestions(term), 300);
};

const onFocus = () => {
  showDropdown.value = true;
  // Refresh suggestions on focus so the dropdown never shows stale results.
  if (searchQuery.value.trim().length >= minSuggestLength) onSearchInput();
};

const selectReport = (report: any) => {
  searchQuery.value = report.bin;
  showDropdown.value = false;
  fetchReport(report.bin);
};

// Enter (or the search icon / Refresh) performs an explicit search for the
// current query rather than relying on any preloaded data.
const handleEnterSearch = () => {
  showDropdown.value = false;
  const term = searchQuery.value.trim();
  if (term) fetchReport(term);
};

const handleRefresh = () => {
  const term = searchQuery.value.trim();
  if (term) fetchReport(term);
  else if (selectedReport.value) fetchReport(selectedReport.value.bin);
};

const clearSearch = () => {
  searchQuery.value = '';
  selectedReport.value = null;
  showDropdown.value = false;
  suggestions.value = [];
  suggestionsLoaded.value = false;
};

const handleBlur = () => {
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
};

const penaltyBreakdown = computed(() => {
  if (!selectedReport.value) return [];
  if (selectedReport.value.penaltyBreakdown && selectedReport.value.penaltyBreakdown.length > 0) {
    return selectedReport.value.penaltyBreakdown.map((row: any) => ({
      ...row,
      lastMonth: row.totalMonths <= 1 ? '-' : row.lastMonth
    }));
  }
  const unfiled = selectedReport.value.grandTotalMonths || selectedReport.value.nonFiledMonths || 0;
  
  let fMonth = selectedReport.value.firstMonth || '-';
  let lMonth = selectedReport.value.lastMonth || '-';
  let rate = 10000;
  let rulePeriodStr = '01.07.2019 to 31.03.2024';

  if (selectedReport.value.issueDate) {
    const d = new Date(selectedReport.value.issueDate);
    if (!isNaN(d.getTime())) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      fMonth = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (unfiled > 1) {
        const lastD = new Date(d.getFullYear(), d.getMonth() + unfiled - 1, 1);
        lMonth = `${monthNames[lastD.getMonth()]} ${lastD.getFullYear()}`;
      } else {
        lMonth = '-';
      }
      const ym = d.getFullYear() * 100 + (d.getMonth() + 1);
      if (ym >= 202507) {
        rate = 2000;
        rulePeriodStr = '01.07.2025 to Present';
      } else if (ym >= 202404) {
        rate = 5000;
        rulePeriodStr = '01.04.2024 to 30.06.2025';
      }
    }
  }

  return [
    {
      ruleAmount: rate,
      rulePeriodStr,
      totalMonths: unfiled,
      firstMonth: fMonth,
      lastMonth: unfiled <= 1 ? '-' : lMonth,
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
  // No background preload: the screen stays idle until the user searches.
  // If a BIN was passed via the URL (e.g. from Return List), fetch it directly.
  if (route.query.bin) {
    const bin = route.query.bin as string;
    searchQuery.value = bin;
    await fetchReport(bin);
  }
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
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
