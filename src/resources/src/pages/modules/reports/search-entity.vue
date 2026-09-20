<template>
  <div class="card bg-surface border-custom shadow-sm mb-4">
    <!-- View: Search and List -->
    <div v-if="!selectedEntity" class="card-body p-4">
      <!-- Search Inputs -->
      <div class="row g-3 mb-4 align-items-center">
        <!-- Search input -->
        <div class="col-md-5">
          <div class="input-group search-input-group">
            <span class="input-group-text bg-surface text-info"><i class="bi bi-search"></i></span>
            <input 
              type="text" 
              class="form-control bg-surface text-light shadow-none" 
              placeholder="Enter BIN or Entity Name..." 
              v-model="searchQuery"
            >
          </div>
        </div>

        <!-- Circle Dropdown -->
        <div class="col-md-3">
          <MultiSelectDropdown
            v-model="searchCircles"
            :options="dataStore.availableCircles"
            all-label="All Circles"
            placeholder="All Circles"
            id-prefix="search-circle"
            size="md"
          />
        </div>

        <!-- Police Station Dropdown -->
        <div class="col-md-3">
          <MultiSelectDropdown
            v-model="searchPoliceStations"
            :options="dataStore.availablePoliceStations"
            all-label="All Police Stations"
            placeholder="All Police Stations"
            id-prefix="search-ps"
            size="md"
          />
        </div>

        <!-- Reset / Reload Button -->
        <div class="col-md-1">
          <button 
            class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center" 
            @click="clearSearch" 
            :disabled="!searchQuery && searchCircles.length === 0 && searchPoliceStations.length === 0"
            style="height: 38px;"
            title="Reset Filters"
          >
            <i class="bi bi-arrow-clockwise fs-5"></i>
          </button>
        </div>
      </div>

      <!-- State: No Data / Idle (Always visible when nothing searched) -->
      <div v-if="searchResults.length === 0 && !searchQuery && searchCircles.length === 0 && searchPoliceStations.length === 0" class="text-center p-5 border border-secondary border-dashed rounded">
        <i class="bi bi-inbox text-muted" style="font-size: 3rem; opacity: 0.5;"></i>
        <p class="text-muted mt-3 mb-0">No data loaded. Please upload an Excel file from the BIN Analyser dashboard.</p>
      </div>

      <!-- State: Search with No Matches -->
      <div v-else-if="searchResults.length === 0 && !loading" class="text-center p-5 border border-secondary border-dashed rounded">
        <i class="bi bi-emoji-frown text-muted" style="font-size: 3rem; opacity: 0.5;"></i>
        <p class="text-muted mt-3 mb-0">No matching entities found for the given criteria.</p>
      </div>

      <!-- Search Results Table -->
      <div v-else-if="searchResults.length > 0" class="table-responsive">
        <table class="table table-dark table-striped table-hover table-bordered border-custom align-middle mb-0 text-nowrap" style="font-size: 0.88rem;">
          <thead>
            <tr>
              <th class="ps-3 py-3">Entity Name</th>
              <th class="py-3">Address</th>
              <th class="py-3">Mobile</th>
              <th class="py-3">BIN Issue Date</th>
              <th class="py-3">Reg. Type</th>
              <th class="py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedResults" :key="item.bin">
              <td class="fw-bold">{{ item.entityName || '-' }}</td>
              <td><span class="d-inline-block text-truncate" style="max-width: 250px;" :title="item.address">{{ item.address || '-' }}</span></td>
              <td>{{ item.mobile || '-' }}</td>
              <td>{{ formatDate(item.binIssueDate) || '-' }}</td>
              <td>
                <span class="badge" :class="item.forcedRegistration === 'Yes' ? 'bg-warning text-dark' : 'bg-secondary'">
                  {{ item.forcedRegistration === 'Yes' ? 'Forced' : 'Regular' }}
                </span>
              </td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-info rounded-pill px-3" @click="viewDetails(item)">
                  <i class="bi bi-eye me-1"></i> View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="d-flex justify-content-between align-items-center mt-3">
          <small class="text-muted">Showing {{ ((currentPage - 1) * 15) + (searchResults.length > 0 ? 1 : 0) }} to {{ Math.min(currentPage * 15, searchResults.length) }} of {{ searchResults.length }} result(s)</small>
          <nav v-if="totalPages > 1">
            <ul class="pagination pagination-sm mb-0">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <a class="page-link" href="#" @click.prevent="currentPage--">Previous</a>
              </li>
              <li class="page-item disabled">
                <span class="page-link">Page {{ currentPage }} of {{ totalPages }}</span>
              </li>
              <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                <a class="page-link" href="#" @click.prevent="currentPage++">Next</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <!-- View: Entity Details (Printable) -->
    <div v-else class="card-body p-0">
      <!-- Toolbar (Hidden in Print) -->
      <div class="d-flex justify-content-between align-items-center p-3 border-bottom border-custom d-print-none bg-surface">
        <button class="btn btn-outline-secondary btn-sm" @click="selectedEntity = null">
          <i class="bi bi-arrow-left me-1"></i> Back to Search
        </button>
        <button class="btn btn-danger btn-sm" @click="printReport">
          <i class="bi bi-printer me-1"></i> Print / PDF
        </button>
      </div>

      <!-- Printable Report Area -->
      <div class="print-area p-5 bg-surface" id="printableReport">
        
        <!-- Report Header -->
        <div class="text-center mb-5 border-bottom border-custom pb-3">
          <h2 class="fw-bold mb-1 text-uppercase">Entity Registration Report</h2>
          <p class="text-muted mb-0">BIN Analyser System</p>
        </div>

        <!-- Report Content -->
        <div class="row g-4">
          <div class="col-12">
            <div class="p-3 border border-custom rounded shadow-sm bg-transparent">
              <h4 class="fw-bold text-info mb-0">{{ selectedEntity.entityName || 'N/A' }}</h4>
              <p class="text-muted mb-0">BIN: <strong class="text-warning">{{ selectedEntity.bin || 'N/A' }}</strong></p>
            </div>
          </div>

          <div class="col-md-6">
            <table class="table table-borderless table-sm mb-0 report-table bg-transparent">
              <tbody class="bg-transparent">
                <tr>
                  <th style="width: 150px;" class="text-muted">
                    <div class="d-flex justify-content-between"><span>Address</span> <span>:</span></div>
                  </th>
                  <td class="fw-bold px-3">{{ selectedEntity.address || '-' }}</td>
                </tr>
                <tr>
                  <th class="text-muted">
                    <div class="d-flex justify-content-between"><span>Mobile</span> <span>:</span></div>
                  </th>
                  <td class="fw-bold px-3">{{ selectedEntity.mobile || '-' }}</td>
                </tr>
                <tr>
                  <th class="text-muted">
                    <div class="d-flex justify-content-between"><span>Email</span> <span>:</span></div>
                  </th>
                  <td class="fw-bold px-3">{{ selectedEntity.email || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="col-md-6">
            <table class="table table-borderless table-sm mb-0 report-table bg-transparent">
              <tbody class="bg-transparent">
                <tr>
                  <th style="width: 170px;" class="text-muted">
                    <div class="d-flex justify-content-between"><span>BIN Issue Date</span> <span>:</span></div>
                  </th>
                  <td class="px-3">
                    <span class="fw-bold">{{ formatDate(selectedEntity.binIssueDate) || '-' }}</span>
                    <br>
                    <small class="text-danger fw-bold" v-if="selectedEntity.binIssueDate">
                      ({{ calculateTimeElapsed(selectedEntity.binIssueDate) }})
                    </small>
                  </td>
                </tr>
                <tr>
                  <th class="text-muted">
                    <div class="d-flex justify-content-between"><span>Registration Type</span> <span>:</span></div>
                  </th>
                  <td class="fw-bold px-3">
                    {{ selectedEntity.forcedRegistration === 'Yes' ? 'Forced' : 'Regular' }}
                  </td>
                </tr>
                <tr>
                  <th class="text-muted">
                    <div class="d-flex justify-content-between"><span>BIN Status</span> <span>:</span></div>
                  </th>
                  <td class="fw-bold text-uppercase px-3" :class="statusColorClass(selectedEntity.binStatus)">
                    {{ selectedEntity.binStatus || 'Unknown' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="col-12 mt-4">
            <h5 class="fw-bold border-bottom border-custom pb-2 mb-3">Economic Activities</h5>
            <table class="table table-dark table-bordered border-custom table-sm">
              <thead class="table-active">
                <tr>
                  <th>Major Area</th>
                  <th>Area of Manufacturing</th>
                  <th>Area of Service</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="fw-bold">{{ selectedEntity.majorAreaOfEconomicActivity || '-' }}</td>
                  <td>{{ selectedEntity.areasOfManufacturing && selectedEntity.areasOfManufacturing !== 'None' ? selectedEntity.areasOfManufacturing : '-' }}</td>
                  <td>{{ selectedEntity.areasOfService && selectedEntity.areasOfService !== 'None' ? selectedEntity.areasOfService : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-5 pt-3 border-top text-center text-muted small">
          Generated by BIN Analyser &bull; {{ new Date().toLocaleString() }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import axios from '@/plugins/axios';
import { useDataStore } from '@/stores/data';
import { useRoute } from 'vue-router';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';

const dataStore = useDataStore();
const route = useRoute();

const searchQuery = ref('');
const searchCircles = ref<string[]>([]);
const searchPoliceStations = ref<string[]>([]);

const searchResults = ref<any[]>([]);
const selectedEntity = ref<any | null>(null);
const loading = ref(false);

const autoOpenBin = ref('');
const currentPage = ref(1);
const itemsPerPage = 15;

const totalPages = computed(() => Math.ceil(searchResults.value.length / itemsPerPage));
const paginatedResults = computed(() => searchResults.value.slice((currentPage.value - 1) * itemsPerPage, currentPage.value * itemsPerPage));

onMounted(async () => {
  await dataStore.fetchFilters();
  if (route.query.q) {
    autoOpenBin.value = route.query.q as string;
    searchQuery.value = route.query.q as string;
  }
});

watch(searchCircles, (newCircles) => {
  dataStore.fetchFilters(newCircles.join(','));
  searchPoliceStations.value = [];
});

let searchTimeout: ReturnType<typeof setTimeout>;

const clearSearch = () => {
  searchQuery.value = '';
  searchCircles.value = [];
  searchPoliceStations.value = [];
  searchResults.value = [];
};

watch([searchQuery, searchCircles, searchPoliceStations], ([q, circles, ps]) => {
  if (!q.trim() && circles.length === 0 && ps.length === 0) {
    searchResults.value = [];
    return;
  }
  
  clearTimeout(searchTimeout);
  loading.value = true;
  
  searchTimeout = setTimeout(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.append('q', q.trim());
      if (circles.length > 0) params.append('circle', circles.join(','));
      if (ps.length > 0) params.append('policeStations', ps.join(','));
      
      const response = await axios.get(`/api/bin-analyser/search?${params.toString()}`);
      searchResults.value = response.data.data || [];
      currentPage.value = 1; // Reset to page 1 on new search
      
      // Auto-open if redirected from duplicate entities
      if (autoOpenBin.value) {
        const match = searchResults.value.find(r => r.bin === autoOpenBin.value);
        if (match) {
          viewDetails(match);
        }
        autoOpenBin.value = ''; // clear it so it doesn't auto-open again on subsequent searches
      }
    } catch (e) {
      console.error('Search failed', e);
      searchResults.value = [];
      currentPage.value = 1;
    } finally {
      loading.value = false;
    }
  }, 300); // 300ms debounce
});

const viewDetails = (entity: any) => {
  selectedEntity.value = entity;
};

const printReport = () => {
  window.print();
};

const calculateTimeElapsed = (dateStr: string) => {
  if (!dateStr) return '';
  const issueDate = new Date(dateStr);
  const now = new Date();
  
  let years = now.getFullYear() - issueDate.getFullYear();
  let months = now.getMonth() - issueDate.getMonth();
  let days = now.getDate() - issueDate.getDate();
  
  if (days < 0) {
    months--;
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += lastMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return `${years} Years, ${months} Months, ${days} Days ago`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusColorClass = (status: string) => {
  if (!status) return 'text-secondary';
  const s = status.toLowerCase();
  if (s.includes('active')) return 'text-success';
  if (s.includes('cancel')) return 'text-danger';
  if (s.includes('suspend')) return 'text-warning';
  return 'text-secondary';
};
</script>

<style scoped>
.border-dashed {
  border-style: dashed !important;
  border-width: 2px !important;
}

/* Print Styles (Force Light Mode for Printing/Viewing) */
@media print {
  body {
    background-color: #ffffff !important;
  }
  
  .print-area {
    padding: 0 !important;
    background-color: #ffffff !important;
    color: #000000 !important;
  }

  .print-area table, 
  .print-area th, 
  .print-area td {
    background-color: transparent !important;
    color: #000000 !important;
    border-color: #dee2e6 !important;
  }
  .print-area .table-dark {
    --bs-table-bg: transparent !important;
    --bs-table-color: #000000 !important;
    --bs-table-border-color: #dee2e6 !important;
    background-color: transparent !important;
    color: #000000 !important;
  }
  .print-area .text-muted {
    color: #6c757d !important;
  }
  .print-area .text-info {
    color: #0d6efd !important;
  }
  .print-area .text-warning {
    color: #000000 !important;
  }
  .print-area .text-danger {
    color: #dc3545 !important;
  }
  .print-area .bg-surface {
    background-color: #f8f9fa !important;
    border-color: #dee2e6 !important;
  }
  .print-area .table-active,
  .print-area .table-active th {
    background-color: #f8f9fa !important;
    color: #000000 !important;
  }

  .card {
    border: none !important;
    box-shadow: none !important;
  }
}

/* Screen Styles for Report */
.report-table,
.report-table tr,
.report-table th,
.report-table td,
.report-table tbody {
  background-color: transparent !important;
}

.search-input-group {
  border: 1px solid #6c757d !important;
  border-radius: 0.375rem !important;
  overflow: hidden;
  height: 38px;
  background-color: var(--app-surface, #212529) !important;
}

.search-input-group:hover,
.search-input-group:focus-within {
  border-color: #adb5bd !important;
  box-shadow: none !important;
}

.search-input-group .input-group-text {
  border: none !important;
  border-right: 1px solid #6c757d !important;
  border-radius: 0 !important;
  padding: 0.375rem 0.85rem !important;
  background-color: transparent !important;
}

.search-input-group .form-control {
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0.375rem 0.75rem !important;
  background-color: transparent !important;
}
</style>
