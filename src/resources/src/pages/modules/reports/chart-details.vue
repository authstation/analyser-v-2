<template>
  <div>
    <!-- Action Toolbar (Hidden in Print) -->
    <div class="d-flex justify-content-between align-items-center mb-3 d-print-none">
      <h4 class="fw-bold mb-0 ">
        <i class="bi bi-card-list text-info me-2"></i> Registration Details
      </h4>
      <div class="d-flex gap-2">
        <button class="btn btn-danger btn-sm" @click="printReport" :disabled="isLoading">
          <i class="bi bi-printer me-1"></i> Print / PDF
        </button>
        <button class="btn btn-success btn-sm" @click="downloadExcel" :disabled="isLoading">
          <i class="bi bi-file-earmark-excel-fill me-1"></i> Download Excel
        </button>
        <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
          <i class="bi bi-x-lg me-1"></i> Close
        </button>
      </div>
    </div>

    <!-- Main Card -->
    <div class="card bg-surface border-custom shadow-sm">
      <div class="card-header border-custom d-flex justify-content-between align-items-center py-3">
        <h5 class="mb-0 fw-bold ">
          {{ titleText }} <span v-if="query.majorArea" class="text-warning">({{ query.majorArea }})</span>
        </h5>
      </div>
      
      <div class="card-body p-0">
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-info" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div v-else class="table-responsive">
          <!-- Combined View for Pivot Summary -->
          <div v-if="type === 'pivotSummary'">
            <h6 class="bg-surface text-info p-2 ps-4 mb-0 border-bottom border-custom">Manufacturing Breakdown</h6>
            <table class="table table-dark table-striped table-hover table-bordered border-custom mb-4 report-table">
              <thead class="table-dark align-middle">
                <tr>
                  <th class="ps-4 py-2">Manufacturing Area</th>
                  <th class="text-end pe-4 py-2">Total Registrations</th>
                  <th class="text-end pe-4 py-2">% of Total</th>
                </tr>
              </thead>
              <tbody class="align-middle">
                <tr v-for="(item, index) in mfgData" :key="index">
                  <td class="ps-4">{{ item.area || 'Unknown' }}</td>
                  <td class="text-end pe-4 fw-bold text-info">{{ item.count }}</td>
                  <td class="text-end pe-4 text-muted">{{ getPercentage(item.count, mfgData) }}</td>
                </tr>
                <tr v-if="!mfgData.length">
                  <td colspan="3" class="text-center py-4 text-muted">No manufacturing data available.</td>
                </tr>
              </tbody>
              <tfoot v-if="mfgData.length > 0" class="table-dark align-middle">
                <tr>
                  <th class="ps-4 py-2 text-end ">Manufacturing Total:</th>
                  <th class="text-warning border-end text-end pe-4">{{ getSubTotal(mfgData) }}</th>
                  <th class="text-warning text-end pe-4">100%</th>
                </tr>
              </tfoot>
            </table>

            <h6 class="bg-surface text-success p-2 ps-4 mb-0 border-bottom border-custom border-top">Service Breakdown</h6>
            <table class="table table-dark table-striped table-hover table-bordered border-custom mb-0 report-table">
              <thead class="table-dark align-middle">
                <tr>
                  <th class="ps-4 py-2">Service Area</th>
                  <th class="text-end pe-4 py-2">Total Registrations</th>
                  <th class="text-end pe-4 py-2">% of Total</th>
                </tr>
              </thead>
              <tbody class="align-middle">
                <tr v-for="(item, index) in srvData" :key="index">
                  <td class="ps-4">{{ item.area || 'Unknown' }}</td>
                  <td class="text-end pe-4 fw-bold text-success">{{ item.count }}</td>
                  <td class="text-end pe-4 text-muted">{{ getPercentage(item.count, srvData) }}</td>
                </tr>
                <tr v-if="!srvData.length">
                  <td colspan="3" class="text-center py-4 text-muted">No service data available.</td>
                </tr>
              </tbody>
              <tfoot v-if="srvData.length > 0" class="table-dark align-middle">
                <tr>
                  <th class="ps-4 py-2 text-end ">Service Total:</th>
                  <th class="text-warning border-end text-end pe-4">{{ getSubTotal(srvData) }}</th>
                  <th class="text-warning text-end pe-4">100%</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Pivot Matrix View -->
          <table v-else-if="type === 'pivot'" class="table table-dark table-striped table-hover table-bordered border-custom mb-0 report-table">
            <thead class="table-dark align-middle sticky-top">
              <tr>
                <th class="text-start ps-4 py-3">Economic Activity</th>
                <th class="text-end pe-4 py-3 text-warning">Total BINs</th>
                <th class="text-end pe-4 py-3 text-muted">Major Economic Activity</th>
                <th class="text-end pe-4 py-3 text-info">Manufacturing</th>
                <th class="text-end pe-4 py-3 text-success">Service</th>
              </tr>
            </thead>
            <tbody class="align-middle">
              <tr v-for="(row, index) in tableData" :key="index">
                <td class="text-start ps-4 fw-bold">{{ row.majorArea || 'Unknown' }}</td>
                <td class="text-end pe-4 fw-bold fs-6">
                  <a href="#" @click.prevent="openDrilldown(row.majorArea || 'Unknown', 'total', row.total)" class="text-warning text-decoration-none hover-underline cursor-pointer" :class="{'pe-none': row.total == 0}">{{ row.total }}</a>
                </td>
                <td class="text-end pe-4 text-muted">
                  <a href="#" @click.prevent="openDrilldown(row.majorArea || 'Unknown', 'neither', row.neither)" class="text-muted text-decoration-none hover-underline cursor-pointer" :class="{'pe-none': row.neither == 0}">{{ row.neither }}</a>
                </td>
                <td :class="['text-end pe-4', row.hasMfg > 0 ? 'text-info fw-bold' : 'text-muted']">
                  <a href="#" @click.prevent="openDrilldown(row.majorArea || 'Unknown', 'mfg', row.hasMfg)" class="text-decoration-none hover-underline cursor-pointer" :class="row.hasMfg > 0 ? 'text-info' : 'text-muted pe-none'">{{ row.hasMfg }}</a>
                </td>
                <td :class="['text-end pe-4', row.hasSrv > 0 ? 'text-success fw-bold' : 'text-muted']">
                  <a href="#" @click.prevent="openDrilldown(row.majorArea || 'Unknown', 'srv', row.hasSrv)" class="text-decoration-none hover-underline cursor-pointer" :class="row.hasSrv > 0 ? 'text-success' : 'text-muted pe-none'">{{ row.hasSrv }}</a>
                </td>
              </tr>
              <tr v-if="!tableData.length">
                <td colspan="5" class="text-center py-4 text-muted">No data available for the selected filters.</td>
              </tr>
            </tbody>
            <tfoot v-if="tableData.length > 0" class="table-dark align-middle fw-bold">
              <tr>
                <th class="ps-4 py-3 fs-5  text-end">Grand Total:</th>
                <th class="text-warning fs-4 border-end text-end pe-4">{{ tableData.reduce((s, i) => s + Number(i.total), 0) }}</th>
                <th class="text-muted fs-4 text-end pe-4">{{ tableData.reduce((s, i) => s + Number(i.neither), 0) }}</th>
                <th class="text-info fs-4 text-end pe-4">{{ tableData.reduce((s, i) => s + Number(i.hasMfg), 0) }}</th>
                <th class="text-success fs-4 text-end pe-4">{{ tableData.reduce((s, i) => s + Number(i.hasSrv), 0) }}</th>
              </tr>
            </tfoot>
          </table>

          <!-- Standard View -->
          <table v-else class="table table-dark table-striped table-hover table-bordered border-custom mb-0 report-table">
            <thead class="table-dark align-middle sticky-top">
              <tr>
                <th class="ps-4 py-3">{{ titleText }}</th>
                <th class="text-end pe-4 py-3">Total Registrations</th>
                <th class="text-end pe-4 py-3">% of Total</th>
              </tr>
            </thead>
            <tbody class="align-middle">
              <tr v-for="(item, index) in tableData" :key="index">
                <td class="ps-4">{{ item.area || 'Unknown' }}</td>
                <td class="text-end pe-4 fw-bold text-info">{{ item.count }}</td>
                <td class="text-end pe-4 text-muted">{{ getPercentage(item.count, tableData) }}</td>
              </tr>
              <tr v-if="!tableData.length">
                <td colspan="3" class="text-center py-4 text-muted">No data available for the selected filters.</td>
              </tr>
            </tbody>
            <tfoot v-if="tableData.length > 0" class="table-dark align-middle">
              <tr>
                <th class="ps-4 py-3 fs-5  text-end">Grand Total:</th>
                <th class="text-warning fs-4 border-end text-end pe-4">{{ grandTotal }}</th>
                <th class="text-warning fs-4 text-end pe-4">100%</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Print Footer (Only visible when printing) -->
    <div class="d-none d-print-block mt-5 pt-3 border-top text-center text-muted small">
      Generated by BIN Analyser &bull; {{ new Date().toLocaleString() }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '@/plugins/axios';
import * as XLSX from 'xlsx';

const route = useRoute();
const router = useRouter();
const type = route.params.type as string; // 'majorArea', 'mfgArea', 'srvArea'
const query = route.query;

const titleText = computed(() => {
  if (type === 'mfgArea') return 'Manufacturing Area Registrations';
  if (type === 'srvArea') return 'Service Area Registrations';
  if (type === 'pivotSummary') return 'Comprehensive Sub-Area Breakdown';
  if (type === 'pivot') return 'Comprehensive Summary';
  return 'Major Area Registrations';
});

const isLoading = ref(true);
const tableData = ref<any[]>([]);
const mfgData = ref<any[]>([]);
const srvData = ref<any[]>([]);

const getSubTotal = (arr: any[]) => {
  return arr.reduce((sum, item) => sum + Number(item.count || 0), 0);
};

const grandTotal = computed(() => getSubTotal(tableData.value));

const getPercentage = (count: number | string, dataArr: any[]) => {
  const total = getSubTotal(dataArr);
  if (total === 0) return '0%';
  return ((Number(count) / total) * 100).toFixed(2) + '%';
};

const openDrilldown = (majorArea: string, columnType: string, count: number) => {
  if (count === 0) return;
  const routeParams = new URLSearchParams();
  const queryFields = ['status', 'forcedRegistration', 'circle', 'policeStations', 'fromDate', 'toDate', 'year'];
  queryFields.forEach(field => {
    if (route.query[field]) {
      routeParams.append(field, route.query[field] as string);
    }
  });
  routeParams.append('majorArea', majorArea);
  routeParams.append('columnType', columnType);
  
  const url = router.resolve({
    path: '/modules/reports/pivot-drilldown',
    query: Object.fromEntries(routeParams.entries())
  }).href;
  
  window.open(url, '_blank');
};

const closeTab = () => {
  window.close();
};

const printReport = () => {
  window.print();
};

const downloadExcel = () => {
  try {
    const ws_data: any[][] = [];
    let cols: any[] = [];

    if (type === 'pivotSummary') {
      ws_data.push(['Manufacturing Area', 'Total Registrations', '% of Total']);
      mfgData.value.forEach((item: any) => {
        ws_data.push([item.area || 'Unknown', item.count, getPercentage(item.count, mfgData.value)]);
      });
      ws_data.push(['Manufacturing Total', getSubTotal(mfgData.value), '100%']);
      ws_data.push([]);
      
      ws_data.push(['Service Area', 'Total Registrations', '% of Total']);
      srvData.value.forEach((item: any) => {
        ws_data.push([item.area || 'Unknown', item.count, getPercentage(item.count, srvData.value)]);
      });
      ws_data.push(['Service Total', getSubTotal(srvData.value), '100%']);
      cols = [{ wch: 45 }, { wch: 20 }, { wch: 15 }];
    } else if (type === 'pivot') {
      ws_data.push([titleText.value]);
      ws_data.push(['Economic Activity', 'Total BINs', 'Major Economic Activity', 'Manufacturing', 'Service']);
      tableData.value.forEach((item: any) => {
        ws_data.push([item.majorArea || 'Unknown', item.total, item.neither, item.hasMfg, item.hasSrv]);
      });
      ws_data.push([
        'Grand Total', 
        tableData.value.reduce((s, i) => s + Number(i.total), 0),
        tableData.value.reduce((s, i) => s + Number(i.neither), 0),
        tableData.value.reduce((s, i) => s + Number(i.hasMfg), 0),
        tableData.value.reduce((s, i) => s + Number(i.hasSrv), 0)
      ]);
      cols = [{ wch: 45 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
    } else {
      ws_data.push([titleText.value, 'Total Registrations', '% of Total']);
      tableData.value.forEach((item: any) => {
        ws_data.push([item.area || 'Unknown', item.count, getPercentage(item.count, tableData.value)]);
      });
      ws_data.push(['Grand Total', grandTotal.value, '100%']);
      cols = [{ wch: 45 }, { wch: 20 }, { wch: 15 }];
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(ws_data);
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Details');
    
    XLSX.writeFile(workbook, `${type}_registrations_details.xlsx`);
  } catch (error) {
    console.error('Failed to export data', error);
  }
};

const fetchData = async () => {
  isLoading.value = true;
  try {
    
    const queryParams = new URLSearchParams();
    
    // Pass along any filters from the query string
    Object.keys(query).forEach(key => {
      if (query[key]) {
        queryParams.append(key, query[key] as string);
      }
    });

    // Request full data instead of top 10 limit
    queryParams.append('fullDetails', 'true');

    const token = localStorage.getItem('token') || '';
    const response = await axios.get(`/api/bin-analyser/dashboard/all-stats?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data && response.data.charts) {
      if (type === 'majorArea') {
        tableData.value = response.data.charts.majorArea || [];
      } else if (type === 'mfgArea') {
        tableData.value = response.data.charts.mfgArea || [];
      } else if (type === 'srvArea') {
        tableData.value = response.data.charts.srvArea || [];
      } else if (type === 'pivot') {
        tableData.value = response.data.charts.pivot || [];
      } else if (type === 'pivotSummary') {
        mfgData.value = response.data.charts.mfgArea || [];
        srvData.value = response.data.charts.srvArea || [];
      }
    }
  } catch (error) {
    console.error('Failed to fetch details data', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
/* Force light mode during print */
@media print {
  body {
    background-color: #ffffff !important;
  }
  .card {
    border: none !important;
    box-shadow: none !important;
    background-color: #ffffff !important;
  }
  .card-header {
    background-color: #ffffff !important;
    border-color: #dee2e6 !important;
  }
  .card-header h5 {
    color: #000000 !important;
  }
  
  .report-table,
  .report-table th,
  .report-table td,
  .report-table tr {
    background-color: transparent !important;
    box-shadow: none !important;
    color: #000000 !important;
    border-color: #dee2e6 !important;
  }
  .report-table th.table-dark {
    background-color: #f8f9fa !important;
    color: #000000 !important;
  }
  .text-info {
    color: #0d6efd !important; /* switch cyan to standard blue for print */
  }
  .text-warning {
    color: #000000 !important;
  }
  .text-muted {
    color: #6c757d !important;
  }
}
</style>


