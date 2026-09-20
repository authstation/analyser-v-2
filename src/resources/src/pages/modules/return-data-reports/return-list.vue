<template>
  <div>
    <!-- Management Action Bar -->
    <div class="card bg-dark border-secondary mb-4 shadow-sm">
      <div class="card-body d-flex flex-wrap align-items-end gap-3 p-3">
        <AreaFilterBar
          v-model:circle-ids="filters.circleIds"
          v-model:police-station-ids="filters.policeStationIds"
          v-model:from-date="filters.fromDate"
          v-model:to-date="filters.toDate"
          :circles="searchOptions.circles"
          :police-stations="searchOptions.policeStations"
          id-prefix="rl"
          container-class="d-flex flex-wrap align-items-end gap-3 flex-grow-1"
          item-class="flex-grow-1"
          date-col-class="col-md-2"
          @change="fetchList"
        />

        <div>
          <button class="btn btn-danger me-2 shadow-sm" @click="confirmDeleteAll" :disabled="isDeleting || totalRecords === 0">
            <span v-if="isDeleting" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-trash-fill me-2"></i>
            Delete All Data
          </button>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card bg-dark border-secondary shadow-sm">
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
        <!-- Left Side: Title & Badge -->
        <div class="d-flex align-items-center">
          <h5 class="mb-0 fw-bold d-inline-block me-3">Return List</h5>
          <span class="badge bg-white text-danger">{{ totalRecords }} Records</span>
        </div>
        
        <!-- Right Side: Search Field -->
        <div class="d-flex justify-content-end align-items-center ms-auto">
          <SearchInput
            v-model="searchQuery"
            placeholder="Search BIN, Entity..."
            width="260px"
            @search="fetchList"
          />
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-dark table-striped table-hover table-bordered border-secondary align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th class="ps-4 py-3" style="width: 50px;">#</th>
                <th class="py-3">Entity Name</th>
                <th class="py-3">Address</th>
                <th class="py-3">Circle</th>
                <th class="py-3">Police Station</th>
                <th class="py-3">Tax Period</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="text-center py-5">
                  <div class="spinner-border text-info" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="tableData.length === 0">
                <td colspan="6" class="text-center py-4 text-muted">No data available.</td>
              </tr>
              <tr v-else v-for="(row, index) in tableData" :key="row.id">
                <td class="ps-4 text-muted">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                <td>
                  <div class="fw-bold">{{ row.entityName || 'Unknown Entity' }}</div>
                  <div class="small text-warning fw-normal mt-1">(BIN: {{ row.bin }})</div>
                </td>
                <td class="text-wrap" style="max-width: 250px;">{{ row.address || '-' }}</td>
                <td>{{ row.circleName || '-' }}</td>
                <td>{{ row.policeStation || '-' }}</td>
                <td>{{ row.taxPeriodStr || '-' }}</td>
              </tr>
            </tbody>
            <tfoot v-if="tableData.length > 0">
              <tr class="table-active fw-bold">
                <td colspan="6" class="text-end pe-4">
                  Grand Total Returns: <span class="text-info fs-6">{{ totalRecords }}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <!-- Pagination -->
        <div class="d-flex justify-content-between align-items-center p-3 border-top border-secondary" v-if="totalPages > 1 && !loading">
          <span class="text-muted small">Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, totalRecords) }} of {{ totalRecords }} entries</span>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button class="page-link bg-dark text-light border-secondary" @click="changePage(currentPage - 1)">Prev</button>
            </li>
            
            <li class="page-item" v-for="p in pageNumbers" :key="p" :class="{ active: p === currentPage, disabled: p === '...' }">
              <button class="page-link border-secondary" :class="p === currentPage ? 'bg-primary text-light border-primary' : 'bg-dark text-light'" @click="p !== '...' ? changePage(Number(p)) : null">{{ p }}</button>
            </li>
            
            <li class="page-item" :class="{ disabled: currentPage === totalPages }">
              <button class="page-link bg-dark text-light border-secondary" @click="changePage(currentPage + 1)">Next</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import axios from '@/plugins/axios';

import AreaFilterBar from '@/components/common/AreaFilterBar.vue';
import SearchInput from '@/components/common/SearchInput.vue';



const getPrevMonthString = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
};

const prevMonth = getPrevMonthString();

const filters = ref({
  circleIds: [] as number[],
  policeStationIds: [] as number[],
  fromDate: prevMonth,
  toDate: prevMonth
});

const isDeleting = ref(false);
const searchQuery = ref('');
const loading = ref(false);

const tableData = ref<any[]>([]);
const totalRecords = ref(0);
const totalPages = ref(1);
const itemsPerPage = 10;
const currentPage = ref(1);

const searchOptions = ref<any>({ circles: [], policeStations: [] });

const fetchSearchOptions = async () => {
  const token = localStorage.getItem('token');
  try {
    const cRes = await axios.get('/api/settings/circles', { headers: { Authorization: `Bearer ${token}` } });
    searchOptions.value.circles = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);
  } catch (err) {
    console.error('Failed to load circles:', err);
  }

  try {
    const pRes = await axios.get('/api/settings/police-stations', { headers: { Authorization: `Bearer ${token}` } });
    searchOptions.value.policeStations = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data || []);
  } catch (err) {
    console.error('Failed to load police stations:', err);
  }
};


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

const fetchList = async () => {
  if (filters.value.fromDate && filters.value.toDate && filters.value.fromDate > filters.value.toDate) {
    alert("From Period cannot be later than To Period.");
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams({
      page: String(currentPage.value),
      limit: String(itemsPerPage)
    });

    if (filters.value.circleIds.length > 0) queryParams.append('circleId', filters.value.circleIds.join(','));
    if (filters.value.policeStationIds.length > 0) queryParams.append('policeStationId', filters.value.policeStationIds.join(','));
    if (filters.value.fromDate) queryParams.append('fromDate', filters.value.fromDate);
    if (filters.value.toDate) queryParams.append('toDate', filters.value.toDate);
    if (searchQuery.value.trim()) queryParams.append('search', searchQuery.value.trim());

    const res = await axios.get(`/api/return-data-analyser/list?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.data) {
      tableData.value = res.data.data || [];
      totalRecords.value = res.data.total || 0;
      totalPages.value = res.data.totalPages || 1;
    }
  } catch (error) {
    console.error('Failed to fetch Return list', error);
    tableData.value = [];
  } finally {
    loading.value = false;
  }
};

const changePage = (p: number) => {
  if (p < 1 || p > totalPages.value) return;
  currentPage.value = p;
  fetchList();
};

watch(() => filters.value.circleIds, () => {
  filters.value.policeStationIds = [];
  currentPage.value = 1;
  fetchList();
}, { deep: true });

watch(() => filters.value.policeStationIds, () => {
  currentPage.value = 1;
  fetchList();
}, { deep: true });

watch(searchQuery, () => {
  currentPage.value = 1;
  fetchList();
});

onMounted(() => {
  fetchSearchOptions();
  fetchList();
});

const confirmDeleteAll = async () => {
  if (window.confirm("Are you sure you want to delete ALL return data? This cannot be undone.")) {
    isDeleting.value = true;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`/api/return-data-analyser/delete-all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message || 'All Return Data Deleted');
      currentPage.value = 1;
      fetchList();
    } catch (error: any) {
      console.error('Delete error', error);
      alert(error.response?.data?.error || "An error occurred while deleting data.");
    } finally {
      isDeleting.value = false;
    }
  }
};
</script>
