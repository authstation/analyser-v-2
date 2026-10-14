<template>
  <div>
    <!-- Management Action Bar / Filters -->
    <div class="card bg-surface border-custom mb-4 shadow-sm" v-if="!isReadonly">
      <div class="card-body p-3">
        <!-- ROW 1: ISSUE FROM DATE, ISSUE TO DATE (CENTERED) -->
        <div class="row g-3 justify-content-center align-items-end">
          <div class="col-12 col-sm-6 col-md-3">
            <label class="form-label small text-muted mb-1 d-block">Issue From Date</label>
            <input
              type="date"
              class="form-control bg-dark text-light border-secondary shadow-none"
              style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
              v-model="fromIssueDate"
            />
          </div>

          <div class="col-12 col-sm-6 col-md-3">
            <label class="form-label small text-muted mb-1 d-block">Issue To Date</label>
            <input
              type="date"
              class="form-control bg-dark text-light border-secondary shadow-none"
              style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
              v-model="toIssueDate"
              :min="fromIssueDate || undefined"
            />
          </div>
        </div>

        <!-- DIVIDER LINE -->
        <hr class="my-3 border-secondary" style="opacity: 0.35;" />

        <!-- ROW 2: ALL CIRCLES, ALL PS, ALL STATUSES, ALL REG. TYPES -->
        <div class="row g-3 align-items-end mb-2">
          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedCircles"
              :options="dataStore.availableCircles"
              placeholder="All Circles"
              all-label="All Circles"
              id-prefix="binlist-circle"
              size="md"
            />
          </div>

          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedPoliceStations"
              :options="dataStore.availablePoliceStations"
              placeholder="All PS"
              all-label="All PS"
              id-prefix="binlist-ps"
              size="md"
            />
          </div>

          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedStatuses"
              :options="statusOptions"
              placeholder="All Statuses"
              all-label="All Statuses"
              id-prefix="binlist-status"
              size="md"
              :searchable="false"
            />
          </div>

          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedForced"
              :options="regTypeOptions"
              placeholder="All Reg. Types"
              all-label="All Reg. Types"
              id-prefix="binlist-reg"
              size="md"
              :searchable="false"
            />
          </div>
        </div>

        <!-- ROW 3: ALL MAJOR AREAS, ALL MFG AREAS, ALL SERVICE AREAS, ACTIONS -->
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedMajorArea"
              :options="uniqueMajorAreas"
              placeholder="All Major Areas"
              all-label="All Major Areas"
              id-prefix="binlist-major"
              size="md"
            />
          </div>

          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedMfgArea"
              :options="uniqueMfgAreas"
              placeholder="All Mfg Areas"
              all-label="All Mfg Areas"
              id-prefix="binlist-mfg"
              size="md"
            />
          </div>

          <div class="col-12 col-md-3">
            <MultiSelectDropdown
              v-model="selectedServiceArea"
              :options="uniqueServiceAreas"
              placeholder="All Service Areas"
              all-label="All Service Areas"
              id-prefix="binlist-svc"
              size="md"
            />
          </div>

          <div class="col-12 col-md-3 d-flex gap-2 align-items-stretch">
            <button
              class="btn btn-outline-secondary text-light shadow-sm flex-fill d-flex align-items-center justify-content-center"
              style="cursor: pointer; height: 38px; background-color: #212529; border-color: #495057;"
              @click="resetFilters"
              :disabled="dataStore.loading"
              title="Reset Filters"
            >
              <i class="bi bi-arrow-counterclockwise fs-5"></i>
            </button>
            <button
              class="btn btn-primary shadow-sm flex-fill d-flex align-items-center justify-content-center"
              style="cursor: pointer; height: 38px;"
              @click="triggerView"
              :disabled="dataStore.loading"
              title="View List"
            >
              <i class="bi bi-eye fs-5"></i>
            </button>
            <button
              class="btn btn-success shadow-sm flex-fill d-flex align-items-center justify-content-center"
              style="cursor: pointer; height: 38px;"
              @click="downloadExcel"
              :disabled="isExporting || (!hasLoaded && !isReadonly) || dataStore.meta.total === 0"
              title="Download Excel"
            >
              <span v-if="isExporting" class="spinner-border spinner-border-sm"></span>
              <i v-else class="bi bi-download fs-5"></i>
            </button>
            <button
              class="btn btn-danger shadow-sm flex-fill d-flex align-items-center justify-content-center"
              style="cursor: pointer; height: 38px;"
              @click="confirmDelete"
              :disabled="isDeleting || dataStore.meta.total === 0 || selectedCircles.length > 1"
              :title="selectedCircles.length === 1 ? 'Delete Circle Data' : 'Delete All Data'"
            >
              <span v-if="isDeleting" class="spinner-border spinner-border-sm"></span>
              <i v-else class="bi bi-trash-fill fs-5"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="dataStore.loading" class="text-center py-5">
      <div class="spinner-border text-info mb-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Loading BIN records...</p>
    </div>

    <!-- Empty / Idle State: Placeholder before user clicks View button -->
    <div v-else-if="!hasLoaded && !isReadonly" class="text-center p-5 border border-secondary rounded flex-grow-1 d-flex flex-column justify-content-center align-items-center mb-4" style="border-style: dashed !important; background-color: rgba(33, 37, 41, 0.4); min-height: 260px;">
      <i class="bi bi-inbox text-muted" style="font-size: 3rem; opacity: 0.5;"></i>
      <p class="text-muted mt-3 mb-0">Select your desired filters and click the View button (<i class="bi bi-eye text-primary"></i>) to generate the BIN List.</p>
    </div>

    <!-- Data Table -->
    <div v-else class="card bg-surface border-custom shadow-sm">
      <div class="card-header border-custom d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
        <!-- Left Side: Title & Badge -->
        <div class="d-flex align-items-center">
          <h5 class="mb-0 fw-bold d-inline-block me-3">{{ pageTitle }}</h5>
          <span class="badge bg-white text-danger">{{ dataStore.meta.total }} Records</span>
        </div>
        
        <!-- Right Side: Search Field & Action Buttons -->
        <div class="d-flex justify-content-end align-items-center gap-2 ms-auto flex-wrap">
          <div class="input-group search-input-group search-input-group-sm" style="width: 270px;">
            <span class="input-group-text text-info"><i class="bi bi-search"></i></span>
            <input 
              type="text" 
              class="form-control text-light shadow-none" 
              placeholder="Search BIN, Entity, Mobile..." 
              v-model="searchQuery" 
              @keyup.enter="fetchList"
            >
          </div>

          <div v-if="isReadonly" class="d-flex align-items-center gap-2">
            <button class="btn btn-success btn-sm d-flex align-items-center" @click="downloadExcel" :disabled="isExporting || dataStore.meta.total === 0" style="height: 31px;">
              <span v-if="isExporting" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-file-earmark-excel-fill me-1"></i> Excel
            </button>
            <button class="btn btn-outline-secondary btn-sm d-flex align-items-center" @click="closeTab" style="height: 31px;">
              <i class="bi bi-x-lg me-1"></i> Close
            </button>
          </div>
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-dark table-striped table-hover table-bordered border-custom align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th class="ps-4 py-3" style="width: 50px;">#</th>
                <th class="py-3">Entity Name</th>
                <th class="py-3">Address</th>
                <th class="py-3">Circle</th>
                <th class="py-3">Police Station</th>
                <th class="py-3">Issue Date</th>
                <th class="py-3" v-if="!hasStatusFilter">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="dataStore.loading">
                <td colspan="7" class="text-center py-5">
                  <div class="spinner-border text-info" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="dataStore.parsedData.length === 0">
                <td colspan="7" class="text-center py-4 text-muted">No data available.</td>
              </tr>
              <tr v-else v-for="(row, index) in dataStore.parsedData" :key="row.id">
                <td class="ps-4 text-muted">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                <td>
                  <div class="fw-bold">{{ row.entityName }}</div>
                  <div class="small text-warning fw-normal mt-1">(BIN: {{ row.bin }})</div>
                </td>
                <td class="text-wrap" style="max-width: 250px;">{{ row.address }}</td>
                <td>{{ row.circle }}</td>
                <td>{{ row.policeStation }}</td>
                <td>{{ formatDate(row.binIssueDate) }}</td>
                <td v-if="!hasStatusFilter">
                  <span class="badge" :class="row.binStatus === 'Active' ? 'bg-success' : 'bg-danger'">{{ row.binStatus }}</span>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="dataStore.parsedData.length > 0">
              <tr class="table-active fw-bold">
                <td colspan="7" class="text-end pe-4">
                  Grand Total BINs: <span class="text-info fs-6">{{ dataStore.meta.total }}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <!-- Pagination -->
        <div class="d-flex justify-content-between align-items-center p-3 border-top border-custom" v-if="totalPages > 1 && !dataStore.loading">
          <span class="text-muted small">Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, dataStore.meta.total) }} of {{ dataStore.meta.total }} entries</span>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button class="page-link bg-surface  border-custom" @click="changePage(currentPage - 1)">Prev</button>
            </li>
            
            <li class="page-item" v-for="p in pageNumbers" :key="p" :class="{ active: p === currentPage, disabled: p === '...' }">
              <button class="page-link border-custom" :class="p === currentPage ? 'bg-primary  border-primary' : 'bg-surface '" @click="p !== '...' ? changePage(Number(p)) : null">{{ p }}</button>
            </li>
            
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <button class="page-link bg-surface  border-custom" @click="changePage(currentPage + 1)">Next</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from '@/plugins/axios';
import { useDataStore } from '@/stores/data';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';

const dataStore = useDataStore();
const route = useRoute();
const hasLoaded = ref(false);
const fromIssueDate = ref('');
const toIssueDate = ref('');
const selectedCircles = ref<string[]>(route.query.circle ? (route.query.circle as string).split(',') : []);
const selectedPoliceStations = ref<string[]>(
  route.query.policeStations 
    ? (route.query.policeStations as string).split(',') 
    : (route.query.ps ? (route.query.ps as string).split(',') : [])
);
const selectedStatuses = ref<string[]>(route.query.status && route.query.status !== 'All' ? (route.query.status as string).split(',') : []);
const statusOptions = ref<string[]>(['Active', 'Inactive', 'Suspended', 'Cancelled']);
const selectedForced = ref<string[]>(route.query.forcedRegistration ? (route.query.forcedRegistration as string).split(',') : []);
const regTypeOptions = ref<string[]>(['Regular', 'Forced']);
const selectedMajorArea = ref<string[]>(route.query.majorArea ? (route.query.majorArea as string).split('|||') : []);
const selectedMfgArea = ref<string[]>(route.query.manufacturingArea ? (route.query.manufacturingArea as string).split('|||') : []);
const selectedServiceArea = ref<string[]>(route.query.serviceArea ? (route.query.serviceArea as string).split('|||') : []);

const uniqueMajorAreas = computed(() => dataStore.availableMajorAreas || []);
const uniqueMfgAreasBase = computed(() => dataStore.availableMfgAreas || []);
const uniqueServiceAreasBase = computed(() => dataStore.availableServiceAreas || []);
const areaRelations = computed(() => dataStore.areaRelations || []);

const uniqueMfgAreas = computed(() => {
  if (selectedMajorArea.value.length === 0) {
    return uniqueMfgAreasBase.value;
  }
  const validMfg = new Set<string>();
  for (const rel of areaRelations.value) {
    if (!rel.major || !rel.mfg) continue;
    const majors = rel.major.split(';').map((s: string) => s.trim());
    if (majors.some((m: string) => selectedMajorArea.value.includes(m))) {
      rel.mfg
        .split(';')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .forEach((m: string) => validMfg.add(m));
    }
  }
  return Array.from(validMfg).sort();
});

const uniqueServiceAreas = computed(() => {
  if (selectedMajorArea.value.length === 0) {
    return uniqueServiceAreasBase.value;
  }
  const validService = new Set<string>();
  for (const rel of areaRelations.value) {
    if (!rel.major || !rel.service) continue;
    const majors = rel.major.split(';').map((s: string) => s.trim());
    if (majors.some((m: string) => selectedMajorArea.value.includes(m))) {
      rel.service
        .split(';')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .forEach((s: string) => validService.add(s));
    }
  }
  return Array.from(validService).sort();
});

watch(selectedMajorArea, () => {
  const validMfg = new Set(uniqueMfgAreas.value);
  selectedMfgArea.value = selectedMfgArea.value.filter(m => validMfg.has(m));

  const validService = new Set(uniqueServiceAreas.value);
  selectedServiceArea.value = selectedServiceArea.value.filter(s => validService.has(s));
}, { deep: true });

const isDeleting = ref(false);
const isExporting = ref(false);
const searchQuery = ref('');

const isReadonly = computed(() => route.query.readonly === 'true');
const hasStatusFilter = computed(() => selectedStatuses.value.length > 0 || (route.query.status && route.query.status !== 'All'));

const pageTitle = computed(() => {
  if (selectedStatuses.value.length > 0) {
    return `${selectedStatuses.value.join(', ')} BIN List`;
  }
  if (route.query.status && route.query.status !== 'All') {
    return `${route.query.status} BIN List`;
  }
  if (route.query.forcedRegistration === 'true') {
    return 'Forced Registration BIN List';
  }
  if (route.query.economicActivity) {
    return `${route.query.economicActivity} BIN List`;
  }
  return 'BIN List';
});

const closeTab = () => {
  window.close();
  setTimeout(() => {
    if (!window.closed && window.history.length > 1) {
      window.history.back();
    }
  }, 100);
};

const triggerView = () => {
  hasLoaded.value = true;
  currentPage.value = 1;
  fetchList();
};

const resetFilters = () => {
  fromIssueDate.value = '';
  toIssueDate.value = '';
  selectedCircles.value = [];
  selectedPoliceStations.value = [];
  selectedStatuses.value = [];
  selectedForced.value = [];
  selectedMajorArea.value = [];
  selectedMfgArea.value = [];
  selectedServiceArea.value = [];
  searchQuery.value = '';
  currentPage.value = 1;
  hasLoaded.value = false;
  dataStore.parsedData = [];
  dataStore.meta.total = 0;
};

const downloadExcel = async () => {
  isExporting.value = true;
  try {
    const filters: any = { ...route.query };
    if (selectedCircles.value.length > 0) filters.circle = selectedCircles.value.join(',');
    if (selectedPoliceStations.value.length > 0) filters.policeStations = selectedPoliceStations.value.join(',');
    if (selectedStatuses.value.length > 0) filters.status = selectedStatuses.value.join(',');
    if (selectedForced.value.length > 0) filters.forcedRegistration = selectedForced.value.join(',');
    if (fromIssueDate.value) filters.fromDate = fromIssueDate.value;
    if (toIssueDate.value) filters.toDate = toIssueDate.value;
    if (selectedMajorArea.value.length > 0) filters.majorArea = selectedMajorArea.value.join('|||');
    if (selectedMfgArea.value.length > 0) filters.manufacturingArea = selectedMfgArea.value.join('|||');
    if (selectedServiceArea.value.length > 0) filters.serviceArea = selectedServiceArea.value.join('|||');
    if (searchQuery.value.trim()) filters.q = searchQuery.value.trim();

    const queryParams = new URLSearchParams();
    for (const key in filters) {
      if (filters[key]) queryParams.append(key, filters[key] as string);
    }
    
    const token = localStorage.getItem('token') || '';
    const response = await axios.get(`/api/bin-analyser/export?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    const statusFilter = route.query.status;
    const reportName = statusFilter && statusFilter !== 'All' ? `${statusFilter}_BIN_List` : 'BIN_List';
    link.setAttribute('download', `${reportName}_Export.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Export failed', error);
    alert('Failed to export data');
  } finally {
    isExporting.value = false;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

const itemsPerPage = 10;
const currentPage = ref(1);

const totalPages = computed(() => dataStore.meta.totalPages);

// Create a sliding window for pagination
const pageNumbers = computed(() => {
  const current = currentPage.value;
  const total = totalPages.value;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  } else if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  } else {
    return [1, '...', current - 1, current, current + 1, '...', total];
  }
});

const fetchList = () => {
  const filters: any = { ...route.query };
  if (selectedCircles.value.length > 0) {
    filters.circle = selectedCircles.value.join(',');
  } else {
    delete filters.circle;
  }
  if (selectedPoliceStations.value.length > 0) {
    filters.policeStations = selectedPoliceStations.value;
  } else {
    delete filters.policeStations;
  }
  if (selectedStatuses.value.length > 0) {
    filters.status = selectedStatuses.value.join(',');
  } else if (!route.query.status) {
    delete filters.status;
  }
  if (selectedForced.value.length > 0) {
    filters.forcedRegistration = selectedForced.value.join(',');
  } else if (!route.query.forcedRegistration) {
    delete filters.forcedRegistration;
  }
  if (fromIssueDate.value) {
    filters.fromDate = fromIssueDate.value;
  } else {
    delete filters.fromDate;
  }
  if (toIssueDate.value) {
    filters.toDate = toIssueDate.value;
  } else {
    delete filters.toDate;
  }
  if (selectedMajorArea.value.length > 0) {
    filters.majorArea = selectedMajorArea.value.join('|||');
  } else {
    delete filters.majorArea;
  }
  if (selectedMfgArea.value.length > 0) {
    filters.manufacturingArea = selectedMfgArea.value.join('|||');
  } else {
    delete filters.manufacturingArea;
  }
  if (selectedServiceArea.value.length > 0) {
    filters.serviceArea = selectedServiceArea.value.join('|||');
  } else {
    delete filters.serviceArea;
  }
  if (searchQuery.value.trim()) {
    filters.q = searchQuery.value.trim();
  }
  if (filters.policeStations && typeof filters.policeStations === 'string') {
    filters.policeStations = filters.policeStations.split(',');
  }
  dataStore.fetchBinList(currentPage.value, itemsPerPage, filters);
};

const changePage = (p: number) => {
  if (p < 1 || p > totalPages.value) return;
  currentPage.value = p;
  fetchList();
};

watch(
  [
    fromIssueDate,
    toIssueDate,
    selectedCircles,
    selectedPoliceStations,
    selectedStatuses,
    selectedForced,
    selectedMajorArea,
    selectedMfgArea,
    selectedServiceArea
  ],
  () => {
    currentPage.value = 1;
    if (hasLoaded.value) {
      hasLoaded.value = false;
      dataStore.parsedData = [];
      dataStore.meta.total = 0;
    }
  },
  { deep: true }
);

watch(fromIssueDate, (newVal) => {
  if (newVal && toIssueDate.value && toIssueDate.value < newVal) {
    toIssueDate.value = '';
  }
});

watch(selectedCircles, (newCircles) => {
  selectedPoliceStations.value = [];
  dataStore.fetchFilters(newCircles.join(','));
}, { deep: true });

watch(searchQuery, () => {
  if (hasLoaded.value || isReadonly.value) {
    currentPage.value = 1;
    fetchList();
  }
});

onMounted(async () => {
  await dataStore.fetchFilters(selectedCircles.value.join(','));
  if (isReadonly.value) {
    hasLoaded.value = true;
    fetchList();
  }
});

const confirmDelete = async () => {
  const msg = selectedCircles.value.length === 1
    ? `Are you sure you want to delete all records for Circle: ${selectedCircles.value[0]}? This cannot be undone.`
    : `Are you sure you want to delete ALL records in the database? This cannot be undone.`;
    
  if (window.confirm(msg)) {
    isDeleting.value = true;
    try {
      
      const url = selectedCircles.value.length === 1
        ? `/api/bin-analyser/delete?circle=${encodeURIComponent(selectedCircles.value[0])}`
        : `/api/bin-analyser/delete`;
        
      const token = localStorage.getItem('token') || '';
      const res = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(res.data.message);
      
      // Refresh the list and available circles
      dataStore.fetchFilters();
      if (selectedCircles.value.length === 1) {
        selectedCircles.value = []; // Reset circle since it's deleted
      }
      currentPage.value = 1;
      fetchList();
    } catch (error: any) {
      console.error('Delete error', error);
      alert(error.response?.data?.message || error.response?.data?.error || "An error occurred while deleting data.");
    } finally {
      isDeleting.value = false;
    }
  }
};
</script>


