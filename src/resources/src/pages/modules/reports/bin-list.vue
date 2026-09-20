<template>
  <div>
    <!-- Management Action Bar -->
    <div class="card bg-surface border-custom mb-4 shadow-sm" v-if="!isReadonly">
      <div class="card-body d-flex flex-wrap align-items-center gap-3 p-3">
        <div style="flex: 1; min-width: 200px;">
          <MultiSelectDropdown
            v-model="selectedCircles"
            :options="dataStore.availableCircles"
            all-label="All Circles"
            placeholder="All Circles"
            id-prefix="binlist-circle"
          />
        </div>

        <div style="flex: 1; min-width: 200px;">
          <MultiSelectDropdown
            v-model="selectedPoliceStations"
            :options="dataStore.availablePoliceStations"
            all-label="All Police Stations"
            placeholder="All Police Stations"
            id-prefix="binlist-ps"
          />
        </div>

        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-success d-flex align-items-center shadow-sm" @click="downloadExcel" :disabled="isExporting || dataStore.meta.total === 0" style="height: 31px;">
            <span v-if="isExporting" class="spinner-border spinner-border-sm me-1"></span>
            <i v-else class="bi bi-file-earmark-excel-fill me-1"></i> Excel
          </button>
          <button class="btn btn-sm btn-danger d-flex align-items-center shadow-sm" @click="confirmDelete" :disabled="isDeleting || dataStore.meta.total === 0 || selectedCircles.length > 1" style="height: 31px;">
            <span v-if="isDeleting" class="spinner-border spinner-border-sm me-1"></span>
            <i v-else class="bi bi-trash-fill me-1"></i>
            Delete {{ selectedCircles.length === 1 ? 'Circle' : 'All' }} Data
          </button>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card bg-surface border-custom shadow-sm">
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
const selectedCircles = ref<string[]>(route.query.circle ? (route.query.circle as string).split(',') : []);
const selectedPoliceStations = ref<string[]>(
  route.query.policeStations 
    ? (route.query.policeStations as string).split(',') 
    : (route.query.ps ? (route.query.ps as string).split(',') : [])
);
const isDeleting = ref(false);
const isExporting = ref(false);
const searchQuery = ref('');

const isReadonly = computed(() => route.query.readonly === 'true');
const hasStatusFilter = computed(() => route.query.status && route.query.status !== 'All');

const pageTitle = computed(() => {
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

const downloadExcel = async () => {
  isExporting.value = true;
  try {
    
    const filters: any = { ...route.query };
    if (selectedCircles.value.length > 0) {
      filters.circle = selectedCircles.value.join(',');
    }
    if (selectedPoliceStations.value.length > 0) {
      filters.policeStations = selectedPoliceStations.value.join(',');
    }
    if (searchQuery.value.trim()) {
      filters.q = searchQuery.value.trim();
    }
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

watch(selectedCircles, (newCircles) => {
  selectedPoliceStations.value = [];
  dataStore.fetchFilters(newCircles.join(','));
  currentPage.value = 1;
  fetchList();
}, { deep: true });

watch(selectedPoliceStations, () => {
  currentPage.value = 1;
  fetchList();
}, { deep: true });

watch(searchQuery, () => {
  currentPage.value = 1;
  fetchList();
});

onMounted(() => {
  dataStore.fetchFilters(selectedCircles.value.join(','));
  fetchList();
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
    } catch (error) {
      console.error('Delete error', error);
      alert("An error occurred while deleting data.");
    } finally {
      isDeleting.value = false;
    }
  }
};
</script>


