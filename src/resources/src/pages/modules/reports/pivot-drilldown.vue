<template>
  <div class="pivot-drilldown-container bg-surface  min-vh-100 d-flex flex-column">
    <!-- Header -->
    <div class="header-container sticky-top bg-surface border-bottom border-custom shadow-sm px-4 py-3 d-flex justify-content-between align-items-center">
      <div>
        <h5 class="mb-1 text-info">
          <i class="bi bi-list-columns-reverse me-2"></i>Registration Details
        </h5>
        <div class="text-muted small">
          Economic Activity: <span class="fw-bold ">{{ majorArea || 'All' }}</span> 
          <span class="mx-2">|</span>
          Category: <span class="fw-bold ">{{ getCategoryName(columnType) }}</span>
        </div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-danger btn-sm d-flex align-items-center gap-1 me-2" @click="printReport" :disabled="!tableData.length || isLoading">
          <i class="bi bi-printer"></i> Print / PDF
        </button>
        <button class="btn btn-success btn-sm d-flex align-items-center gap-1" @click="downloadExcel" :disabled="!tableData.length || isLoading || isDownloading">
          <span v-if="isDownloading" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-file-earmark-excel"></i> Download Excel
        </button>
        <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
          <i class="bi bi-x-lg"></i> Close
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="content-container flex-grow-1 p-4 overflow-auto">
      <div v-if="isLoading" class="d-flex justify-content-center align-items-center h-100">
        <div class="spinner-border text-info" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <div v-else-if="error" class="alert alert-danger text-center">
        {{ error }}
      </div>

      <div v-else class="card bg-surface border-custom shadow-sm">
        <div class="card-header border-custom py-2">
          <h6 class="mb-0 fw-bold">Institutions List <span class="badge bg-secondary ms-2">{{ tableData.length }}</span></h6>
        </div>
        <div class="card-body p-0 table-responsive">
          <table class="table table-dark table-striped table-hover table-bordered border-custom mb-0 align-middle">
            <thead class="table-dark sticky-top">
              <tr>
                <th class="ps-3 py-3" style="width: 6%;">Sl</th>
                <th class="py-3" style="width: 40%;">Name, Address, BIN</th>
                <th class="py-3" style="width: 15%;">Mobile</th>
                <th class="py-3" style="width: 39%;">Area Breakdown</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in (isPrinting ? tableData : paginatedData)" :key="row.id || index">
                <td class="ps-3 text-center text-muted fw-bold">{{ isPrinting ? index + 1 : (currentPage - 1) * itemsPerPage + index + 1 }}</td>
                <td>
                  <div class="fw-bold text-info">{{ row.name || 'Unknown' }}</div>
                  <div class="small text-muted mb-1"><i class="bi bi-geo-alt me-1"></i>{{ row.address || 'N/A' }}</div>
                  <div class="text-warning small fw-bold mt-1"><i class="bi bi-upc-scan me-1"></i>{{ row.bin }}</div>
                </td>
                <td class="align-middle">
                  <div class="" v-if="row.mobile"><i class="bi bi-telephone text-muted me-1"></i>{{ row.mobile }}</div>
                  <div class="text-muted small" v-else>N/A</div>
                </td>
                <td>
                  <div class="mb-1">
                    <span class="text-muted small">Major Area:</span> 
                    <span class="ms-2 fw-bold ">{{ row.majorArea || 'None' }}</span>
                  </div>
                  <div class="mb-1">
                    <span class="text-muted small">Mfg Area:</span> 
                    <span class="ms-2 text-warning">{{ row.mfgArea || 'None' }}</span>
                  </div>
                  <div>
                    <span class="text-muted small">Service Area:</span> 
                    <span class="ms-2 text-success">{{ row.srvArea || 'None' }}</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!paginatedData.length">
                <td colspan="4" class="text-center py-4 text-muted">No data available</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Controls -->
        <div class="card-footer border-custom d-flex justify-content-between align-items-center py-2" v-if="totalPages > 1">
          <div class="text-muted small">
            Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to 
            {{ Math.min(currentPage * itemsPerPage, tableData.length) }} of {{ tableData.length }} entries
          </div>
          <nav aria-label="Page navigation">
            <ul class="pagination pagination-sm mb-0 bg-surface">
              <li class="page-item" :class="{ disabled: currentPage === 1 }">
                <a class="page-link bg-surface border-custom " href="#" @click.prevent="prevPage">&laquo;</a>
              </li>
              <li class="page-item" v-for="page in visiblePages" :key="page" :class="{ active: currentPage === page }">
                <a class="page-link border-custom" 
                   :class="currentPage === page ? 'bg-info border-info text-dark fw-bold' : 'bg-surface '" 
                   href="#" @click.prevent="goToPage(page)">{{ page }}</a>
              </li>
              <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                <a class="page-link bg-surface border-custom " href="#" @click.prevent="nextPage">&raquo;</a>
              </li>
            </ul>
          </nav>
        </div>
        
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from '@/plugins/axios';


const route = useRoute();
const isLoading = ref(true);
const error = ref('');
const tableData = ref<any[]>([]);

const majorArea = ref(route.query.majorArea as string || '');
const columnType = ref(route.query.columnType as string || '');

// Pagination logic
const currentPage = ref(1);
const itemsPerPage = ref(5);

const totalPages = computed(() => Math.ceil(tableData.value.length / itemsPerPage.value));
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return tableData.value.slice(start, start + itemsPerPage.value);
});

const visiblePages = computed(() => {
  const pages: number[] = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages.value, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  return pages;
});

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--;
};
const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++;
};
const goToPage = (page: number) => {
  currentPage.value = page;
};

const getCategoryName = (type: string) => {
  switch (type) {
    case 'total': return 'Total BINs';
    case 'neither': return 'Has Only Major Economic Activity';
    case 'mfg': return 'Manufacturing';
    case 'srv': return 'Service';
    default: return type;
  }
};

const fetchData = async () => {
  isLoading.value = true;
  error.value = '';
  
  try {
    
    const queryParams = new URLSearchParams();
    
    // Pass along standard filters from the route
    const queryFields = ['status', 'forcedRegistration', 'circle', 'policeStations', 'fromDate', 'toDate', 'year'];
    queryFields.forEach(field => {
      if (route.query[field]) {
        queryParams.append(field, route.query[field] as string);
      }
    });
    
    // Add drilldown specific parameters
    if (majorArea.value) queryParams.append('majorArea', majorArea.value);
    if (columnType.value) queryParams.append('columnType', columnType.value);

    const token = localStorage.getItem('token') || '';
    const response = await axios.get(`/api/bin-analyser/dashboard/drilldown/pivot?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    tableData.value = response.data.data || [];
  } catch (err: any) {
    console.error('Failed to load drilldown data:', err);
    error.value = 'Failed to load data. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

const closeTab = () => {
  window.close();
};

const isPrinting = ref(false);

const printReport = async () => {
  isPrinting.value = true;
  await nextTick(); // Wait for Vue to render all rows in the DOM
  
  // Use a slight timeout to allow browser to calculate layout
  setTimeout(() => {
    window.print();
    isPrinting.value = false;
  }, 300);
};

const isDownloading = ref(false);

const downloadExcel = async () => {
  if (!tableData.value.length || isDownloading.value) return;
  isDownloading.value = true;
  try {
    
    const queryParams = new URLSearchParams();
    const queryFields = ['status', 'forcedRegistration', 'circle', 'policeStations', 'fromDate', 'toDate', 'year'];
    queryFields.forEach(field => {
      if (route.query[field]) {
        queryParams.append(field, route.query[field] as string);
      }
    });
    if (majorArea.value) queryParams.append('majorArea', majorArea.value);
    if (columnType.value) queryParams.append('columnType', columnType.value);

    const token = localStorage.getItem('token') || '';
    const response = await axios.get(`/api/bin-analyser/dashboard/drilldown/pivot/export?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });

    const fileName = `Registrations_${majorArea.value || 'All'}_${columnType.value || 'Data'}.xlsx`.replace(/\s+/g, '_');
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download excel:', err);
  } finally {
    isDownloading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.pivot-drilldown-container {
  overflow: hidden;
}
.header-container {
  z-index: 1000;
}
.content-container {
  overflow-y: auto;
}

@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
  body {
    background-color: #ffffff !important;
  }
  .pivot-drilldown-container, .card, .card-body, .content-container {
    background-color: #ffffff !important;
    color: #000 !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .header-container .btn,
  .card-footer,
  .spinner-border {
    display: none !important;
  }
  .table {
    border-collapse: collapse !important;
    border: 1px solid #000 !important;
    color: #000 !important;
    width: 100% !important;
  }
  .table th, .table td, .table thead th, .table tbody td, .table-bordered > :not(caption) > * > * {
    background-color: transparent !important;
    color: #000 !important;
    border: 1px solid #000 !important;
  }
  .table-striped > tbody > tr:nth-of-type(odd) > * {
    background-color: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
  }
  .table-dark th, .table-dark td {
    background-color: #f8f9fa !important;
    color: #000 !important;
    border: 1px solid #000 !important;
  }
  .badge {
    color: #000 !important;
    border: 1px solid #dee2e6;
    background-color: transparent !important;
  }
  .text-info, .text-warning, .text-success, .text-muted {
    color: #000 !important;
  }
}
</style>


