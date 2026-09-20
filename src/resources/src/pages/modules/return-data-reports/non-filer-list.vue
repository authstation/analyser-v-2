<template>
  <div class="h-100 d-flex flex-column text-light">
    <!-- Filter Section (No Card Wrapper) -->
    <div class="mb-4 d-print-none" style="position: relative; z-index: 1050;">
      <div class="row g-2">
        <div class="col-12 col-md-3">
          <MultiSelectDropdown
            v-model="selectedCircle"
            :options="uniqueCircles"
            placeholder="All Circles"
            all-label="All Circles"
            id-prefix="nfl-circle"
            size="md"
          />
        </div>
        
        <div class="col-12 col-md-3">
          <MultiSelectDropdown
            v-model="selectedPoliceStation"
            :options="uniquePoliceStations"
            placeholder="All PS"
            all-label="All PS"
            id-prefix="nfl-ps"
            size="md"
          />
        </div>
        
        <div class="col-12 col-md-3">
          <MultiSelectDropdown
            v-model="selectedStatus"
            :options="uniqueStatuses"
            placeholder="All Statuses"
            all-label="All Statuses"
            id-prefix="nfl-status"
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
            id-prefix="nfl-reg"
            size="md"
            :searchable="false"
          />
        </div>

        <div class="col-12 col-md-3">
          <MultiSelectDropdown
            v-model="selectedMajorArea"
            :options="uniqueMajorAreas"
            placeholder="All Major Areas"
            all-label="All Major Areas"
            id-prefix="nfl-major"
            size="md"
          />
        </div>
        
        <div class="col-12 col-md-3">
          <MultiSelectDropdown
            v-model="selectedMfgArea"
            :options="uniqueMfgAreas"
            placeholder="All Mfg Areas"
            all-label="All Mfg Areas"
            id-prefix="nfl-mfg"
            size="md"
          />
        </div>

        <div class="col-12 col-md-3">
          <MultiSelectDropdown
            v-model="selectedServiceArea"
            :options="uniqueServiceAreas"
            placeholder="All Service Areas"
            all-label="All Service Areas"
            id-prefix="nfl-svc"
            size="md"
          />
        </div>

        <div class="col-12 col-md-3 d-flex gap-2 align-items-stretch">
          <button
            class="btn btn-outline-secondary text-light shadow-sm flex-fill d-flex align-items-center justify-content-center"
            style="cursor: pointer; height: 38px; background-color: #212529; border-color: #495057;"
            @click="resetFilters"
            :disabled="loading"
            title="Reset Filters"
          >
            <i class="bi bi-arrow-counterclockwise fs-5"></i>
          </button>
          <button
            class="btn btn-primary shadow-sm flex-fill d-flex align-items-center justify-content-center"
            style="cursor: pointer; height: 38px;"
            @click="fetchNonFilerList"
            :disabled="loading"
            title="View List"
          >
            <i class="bi bi-eye fs-5"></i>
          </button>
          <button
            class="btn btn-success shadow-sm flex-fill d-flex align-items-center justify-content-center"
            style="cursor: pointer; height: 38px;"
            @click="downloadExcel"
            :class="{'opacity-50': loading || filteredList.length === 0}"
            title="Download Excel"
          >
            <i class="bi bi-download fs-5"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-info mb-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 text-muted">Calculating and loading non-filer records...</p>
    </div>

    <!-- Data Table Card -->
    <div v-else class="card bg-dark border-secondary shadow-sm flex-grow-1 overflow-hidden d-flex flex-column">
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-3 flex-wrap gap-2 d-print-none">
        <div class="d-flex align-items-center">
          <h5 class="mb-0 fw-bold text-light me-3">Non Filer List</h5>
          <span class="badge bg-white text-danger">{{ filteredList.length }} Records</span>
        </div>
        
        <!-- Search Field on Table Header -->
        <div class="d-flex justify-content-end align-items-center ms-auto">
          <SearchInput
            v-model="searchQuery"
            placeholder="Search BIN, Entity, Mobile..."
            width="270px"
          />
        </div>
      </div>
      
      <div class="card-body p-0 table-responsive flex-grow-1" id="printableArea">
        <table class="table table-dark table-bordered align-middle mb-0 custom-table">
          <thead class="table-dark sticky-top text-nowrap">
            <tr>
              <th style="width: 50px;" class="text-center">#</th>
              <th>Entity Details</th>
              <th class="text-center" style="width: 130px;">Mobile</th>
              <th class="text-center">Due Months</th>
              <th class="text-center">Submitted</th>
              <th class="text-center text-warning fw-bold">Unfiled Months</th>
              <th>Economic Activity</th>
              <th style="width: 100px;" class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginatedList.length === 0">
              <td colspan="8" class="text-center py-4 text-muted">No non-filer entities found.</td>
            </tr>
            <tr v-for="(row, idx) in paginatedList" :key="row.bin">
              <td class="text-center text-muted">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
              <td>
                <div class="fw-bold text-info">{{ row.name || 'N/A' }}</div>
                <div class="small text-muted fw-normal mt-1 text-wrap" style="max-width: 380px;">{{ row.address || '-' }}</div>
                <div class="small text-warning fw-normal mt-1 font-monospace">(BIN: {{ row.bin }})</div>
              </td>
              <td class="text-center font-monospace">{{ row.mobile || '-' }}</td>
              <td class="text-center">{{ row.totalDueMonths }}</td>
              <td class="text-center text-success fw-bold">{{ row.submittedCount }}</td>
              <td class="text-center text-warning fw-bold">{{ row.grandTotalMonths }}</td>
              <td class="text-wrap" style="max-width: 250px;">
                <div v-if="row.majorArea" class="small text-info mb-1">{{ row.majorArea }}</div>
                <div v-if="row.manufacturingArea" class="small text-muted mb-1">{{ row.manufacturingArea }}</div>
                <div v-if="row.serviceArea" class="small text-muted">{{ row.serviceArea }}</div>
                <div v-if="!row.majorArea && !row.manufacturingArea && !row.serviceArea">-</div>
              </td>
              <td class="text-center">
                <button
                  class="btn btn-sm btn-outline-warning py-0 px-2"
                  @click="viewPenaltyReport(row.bin)"
                  title="View Non-Filer Penalty Report"
                >
                  <i class="bi bi-file-earmark-text me-1"></i> Report
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="card-footer bg-dark border-secondary py-2 d-flex justify-content-between align-items-center d-print-none" v-if="totalPages > 1 && !loading">
        <div class="text-muted small">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredList.length) }} of {{ filteredList.length }} entries
        </div>
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <button class="page-link bg-dark text-light border-secondary" @click="changePage(currentPage - 1)">Prev</button>
          </li>
          
          <li class="page-item" v-for="p in pageNumbers" :key="p" :class="{ active: p === currentPage, disabled: p === '...' }">
            <button
              class="page-link border-secondary"
              :class="p === currentPage ? 'bg-primary text-light border-primary' : 'bg-dark text-light'"
              @click="p !== '...' ? changePage(Number(p)) : null"
            >
              {{ p }}
            </button>
          </li>
          
          <li class="page-item" :class="{ disabled: currentPage === totalPages }">
            <button class="page-link bg-dark text-light border-secondary" @click="changePage(currentPage + 1)">Next</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from '@/plugins/axios';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';
import SearchInput from '@/components/common/SearchInput.vue';

const router = useRouter();

const loading = ref(false);
const listData = ref<any[]>([]);
const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

// Filter selections
const selectedCircle = ref<string[]>([]);
const selectedPoliceStation = ref<string[]>([]);
const selectedStatus = ref<string[]>([]);
const selectedForced = ref<string[]>([]);
const selectedMajorArea = ref<string[]>([]);
const selectedMfgArea = ref<string[]>([]);
const selectedServiceArea = ref<string[]>([]);

// Filter options
const uniqueCircles = ref<string[]>([]);
const uniquePoliceStations = ref<string[]>([]);
const uniqueStatuses = ref<string[]>(['Active', 'Inactive', 'Suspended', 'Cancelled']);
const regTypeOptions = ref<string[]>(['Regular', 'Forced']);
const uniqueMajorAreas = ref<string[]>([]);
const uniqueMfgAreasBase = ref<string[]>([]);
const uniqueServiceAreasBase = ref<string[]>([]);
const areaRelations = ref<{ major: string; mfg: string | null; service: string | null }[]>([]);

const uniqueMfgAreas = computed(() => {
  if (selectedMajorArea.value.length === 0) {
    return uniqueMfgAreasBase.value;
  }
  const validMfg = new Set<string>();
  for (const rel of areaRelations.value) {
    if (rel.major && selectedMajorArea.value.includes(rel.major) && rel.mfg) {
      validMfg.add(rel.mfg);
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
    if (rel.major && selectedMajorArea.value.includes(rel.major) && rel.service) {
      validService.add(rel.service);
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

const filteredList = computed(() => {
  let result = listData.value;
  if (searchQuery.value.trim()) {
    const clean = (str: any) => String(str || '').replace(/[-_ ]/g, '').toLowerCase();
    const q = clean(searchQuery.value);
    result = result.filter((row: any) => {
      return (
        clean(row.bin).includes(q) ||
        clean(row.name).includes(q) ||
        clean(row.mobile).includes(q) ||
        clean(row.circleName).includes(q) ||
        clean(row.policeStationName).includes(q) ||
        clean(row.majorArea).includes(q)
      );
    });
  }
  return result;
});

const totalPages = computed(() => {
  return Math.ceil(filteredList.value.length / pageSize.value) || 1;
});

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredList.value.slice(start, start + pageSize.value);
});

const pageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const delta = 2;
  const range: (number | string)[] = [];
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  if (current - delta > 2) range.unshift('...');
  if (current + delta < total - 1) range.push('...');
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
});

const changePage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p;
  }
};

const fetchFilterOptions = async () => {
  try {
    const res = await axios.get('/api/return-data-analyser/filter-options');
    if (res.data) {
      const data = res.data.data || res.data;
      uniqueCircles.value = (data.circles || []).map((c: any) => typeof c === 'string' ? c : c.name).filter(Boolean);
      uniquePoliceStations.value = (data.policeStations || []).map((p: any) => typeof p === 'string' ? p : p.name).filter(Boolean);
      if (data.statuses && data.statuses.length > 0) {
        uniqueStatuses.value = data.statuses;
      }
      uniqueMajorAreas.value = data.majorAreas || [];
      uniqueMfgAreasBase.value = data.mfgAreas || [];
      uniqueServiceAreasBase.value = data.serviceAreas || [];
      areaRelations.value = data.areaRelations || [];
    }
  } catch (error) {
    console.error('Failed to load filter options', error);
  }
};

const fetchNonFilerList = async () => {
  loading.value = true;
  currentPage.value = 1;
  try {
    const params = new URLSearchParams();
    if (selectedCircle.value.length > 0) params.append('circle', selectedCircle.value.join(','));
    if (selectedPoliceStation.value.length > 0) params.append('ps', selectedPoliceStation.value.join(','));
    if (selectedStatus.value.length > 0) params.append('status', selectedStatus.value.join(','));
    if (selectedForced.value.length > 0) params.append('reg', selectedForced.value.join(','));
    if (selectedMajorArea.value.length > 0) params.append('major', selectedMajorArea.value.join(','));
    if (selectedMfgArea.value.length > 0) params.append('mfg', selectedMfgArea.value.join(','));
    if (selectedServiceArea.value.length > 0) params.append('service', selectedServiceArea.value.join(','));

    const res = await axios.get(`/api/return-data-analyser/non-filer-list?${params.toString()}`);
    listData.value = res.data?.data || res.data || [];
  } catch (error) {
    console.error('Failed to load non filer list', error);
    listData.value = [];
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  selectedCircle.value = [];
  selectedPoliceStation.value = [];
  selectedStatus.value = [];
  selectedForced.value = [];
  selectedMajorArea.value = [];
  selectedMfgArea.value = [];
  selectedServiceArea.value = [];
  searchQuery.value = '';
  fetchNonFilerList();
};

const viewPenaltyReport = (bin: string) => {
  router.push({
    name: 'return-search-by-bin',
    query: { bin, fromList: 'true' }
  });
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const downloadExcel = () => {
  const data = filteredList.value;
  if (data.length === 0) return;

  const headers = ['SL', 'BIN', 'Entity Name', 'Circle', 'Police Station', 'Status', 'BIN Issue Date', 'Total Due Months', 'Submitted Returns', 'Unfiled Months'];
  
  const csvContent = [
    headers.join(','),
    ...data.map((row, idx) => {
      const bin = `"=""${row.bin || ''}"""`;
      const name = `"${(row.name || '').replace(/"/g, '""')}"`;
      const circle = `"${(row.circleName || '').replace(/"/g, '""')}"`;
      const ps = `"${(row.policeStationName || '').replace(/"/g, '""')}"`;
      const status = `"${(row.binStatus || '').replace(/"/g, '""')}"`;
      const issueDate = `"${formatDate(row.issueDate)}"`;
      const due = row.totalDueMonths || 0;
      const submitted = row.submittedCount || 0;
      const unfiled = row.grandTotalMonths || 0;
      return `${idx + 1},${bin},${name},${circle},${ps},${status},${issueDate},${due},${submitted},${unfiled}`;
    })
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Non_Filer_List_${dateStr}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

onMounted(async () => {
  await fetchFilterOptions();
  await fetchNonFilerList();
});
</script>

<style scoped>
.custom-table th,
.custom-table td {
  vertical-align: middle;
}

/* Custom hover — replaces Bootstrap table-hover entirely */
.custom-table tbody tr > * {
  transition: background-color 0.1s ease;
}
.custom-table tbody tr:hover > * {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: inherit !important;
}

/* Override Bootstrap active/click state — prevent white flash */
.custom-table tbody tr:active > *,
.custom-table tbody tr > td:active,
.custom-table tbody tr > td:focus {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: inherit !important;
}

/* Nullify Bootstrap table active CSS variable */
.custom-table {
  --bs-table-active-bg: transparent;
  --bs-table-active-color: inherit;
  --bs-table-hover-bg: rgba(255, 255, 255, 0.06);
  --bs-table-hover-color: inherit;
}
</style>
