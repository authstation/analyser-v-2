<template>
  <div>
    <div class="card bg-surface border-custom shadow-sm">
      <div class="card-header border-custom d-flex justify-content-between align-items-center py-3">
        <h5 class="mb-0 fw-bold ">
          <i class="bi bi-bar-chart-fill me-2 text-warning"></i> 5-Year Comparison ({{ titleText }})
        </h5>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-success btn-sm" @click="downloadExcel" :disabled="isLoading">
            <i class="bi bi-file-earmark-excel-fill me-1"></i> Download Excel
          </button>
          <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
            <i class="bi bi-x-lg me-1"></i> Close
          </button>
        </div>
      </div>
      
      <div class="card-body p-0">
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-info" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-dark table-striped table-hover table-bordered border-custom mb-0">
            <thead class="table-dark text-center align-middle sticky-top">
              <tr>
                <th class="text-start ps-4 py-3" rowspan="2">{{ titleText }}</th>
                <th class="py-3 text-warning border-end" rowspan="2">Total BINs</th>
                <th v-for="fy in comparisonFys" :key="fy" colspan="2" class="py-2 border-bottom-0">{{ fy }}</th>
              </tr>
              <tr>
                <template v-for="fy in comparisonFys" :key="'sub_'+fy">
                  <th class="fw-normal text-muted small">Registrations</th>
                  <th class="fw-normal text-muted small">Trend</th>
                </template>
              </tr>
            </thead>
            <tbody class="text-center align-middle">
              <tr v-for="(row, rIdx) in comparisonData" :key="rIdx">
                <td class="text-start ps-4 fw-bold text-info" style="cursor: pointer;" @click="openChart(row)" title="Click to view 5-year trend chart">
                  <div class="d-inline-flex align-items-center">
                    <span class="text-decoration-underline" style="text-underline-offset: 4px; text-decoration-style: dashed; text-decoration-color: rgba(13,202,240,0.5);">
                      {{ row.area || 'Unknown' }}
                    </span>
                    <i class="bi bi-graph-up-arrow ms-2 small"></i>
                  </div>
                </td>
                <td class="text-warning fw-bold border-end fs-5">{{ row.totalBins || 0 }}</td>
                <template v-for="(fy, idx) in comparisonFys" :key="'col_'+fy">
                  <td class="fs-6">{{ row[fy] || 0 }}</td>
                  <td :class="getTrendClass(getTrend(row, fy, idx))">{{ getTrend(row, fy, idx) }}</td>
                </template>
              </tr>
              <tr v-if="!comparisonData.length">
                <td :colspan="2 + (comparisonFys.length * 2)" class="text-center py-4 text-muted">No data available for the selected filters.</td>
              </tr>
            </tbody>
            <tfoot v-if="comparisonData.length > 0" class="table-dark text-center align-middle">
              <tr>
                <th class="text-start ps-4 py-3 fs-5 ">Grand Total</th>
                <th class="text-warning fs-4 border-end">{{ grandTotalBins }}</th>
                <template v-for="(fy, idx) in comparisonFys" :key="'foot_'+fy">
                  <th class="fs-5 ">{{ getFyTotal(fy) }}</th>
                  <th :class="getTrendClass(getFyTrendTotal(fy, idx))">{{ getFyTrendTotal(fy, idx) }}</th>
                </template>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Chart Modal -->
    <div v-if="showChartModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.7);">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-surface border-custom shadow-lg">
          <div class="modal-header border-custom py-3">
            <h5 class="modal-title  fw-bold">
              <i class="bi bi-graph-up text-info me-2"></i>10-Year Trend: {{ selectedAreaName }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showChartModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <!-- Loading Spinner -->
            <div v-if="isChartLoading" class="text-center py-5">
              <div class="spinner-border text-info" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <div class="mt-2 text-muted small">Loading 10-year trend data...</div>
            </div>
            
            <div v-else style="height: 350px;">
              <Line :data="chartData" :options="chartOptions" />
            </div>
          </div>
          <div class="modal-footer border-custom py-2">
            <button type="button" class="btn btn-outline-secondary" @click="showChartModal = false">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import axios from '@/plugins/axios';
import * as XLSX from 'xlsx';
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const route = useRoute();
const isLoading = ref(true);
const comparisonFys = ref<string[]>([]);
const comparisonData = ref<any[]>([]);

const typeParam = computed(() => route.params.type as string);

const titleText = computed(() => {
  if (typeParam.value === 'manufacturing') return 'Manufacturing Area';
  if (typeParam.value === 'service') return 'Service Area';
  return 'Economic Activity';
});

onMounted(async () => {
  await fetchComparisonData();
});

const fetchComparisonData = async () => {
  isLoading.value = true;
  try {
    
    const queryParams = new URLSearchParams();
    
    // Pass along query parameters
    const queryFields = ['status', 'forcedRegistration', 'circle', 'policeStations', 'fromDate', 'toDate'];
    queryFields.forEach(field => {
      if (route.query[field]) {
        queryParams.append(field, route.query[field] as string);
      }
    });

    const response = await axios.get(`/api/bin-analyser/dashboard/comparison/${typeParam.value}?${queryParams.toString()}`);
    
    comparisonFys.value = response.data.fys || [];
    comparisonData.value = response.data.data || [];
  } catch (error) {
    console.error('Failed to load comparison data', error);
  } finally {
    isLoading.value = false;
  }
};

const getTrend = (row: any, currentFy: string, idx: number) => {
  if (idx === 0) return '-';
  const prevFy = comparisonFys.value[idx - 1];
  const currentVal = row[currentFy] || 0;
  const prevVal = row[prevFy] || 0;
  
  if (prevVal === 0 && currentVal === 0) return '-';
  if (prevVal === 0) return '+100%';
  
  const diff = currentVal - prevVal;
  const percentage = Math.round((diff / prevVal) * 100);
  return percentage > 0 ? `+${percentage}%` : `${percentage}%`;
};

const grandTotalBins = computed(() => {
  return comparisonData.value.reduce((sum: number, row: any) => sum + (row.totalBins || 0), 0);
});

const getFyTotal = (fy: string) => {
  return comparisonData.value.reduce((sum: number, row: any) => sum + (row[fy] || 0), 0);
};

const getFyTrendTotal = (currentFy: string, idx: number) => {
  if (idx === 0) return '-';
  const prevFy = comparisonFys.value[idx - 1];
  const currentVal = getFyTotal(currentFy);
  const prevVal = getFyTotal(prevFy);
  
  if (prevVal === 0 && currentVal === 0) return '-';
  if (prevVal === 0) return '+100%';
  
  const diff = currentVal - prevVal;
  const percentage = Math.round((diff / prevVal) * 100);
  return percentage > 0 ? `+${percentage}%` : `${percentage}%`;
};

// Chart Modal Logic
const showChartModal = ref(false);
const isChartLoading = ref(false);
const selectedAreaName = ref('');
const chartData = ref<any>({ labels: [], datasets: [] });

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: { color: '#a0a0a0' }
    },
    tooltip: {
      backgroundColor: 'rgba(0,0,0,0.8)',
      titleColor: '#fff',
      bodyColor: '#fff'
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(255,255,255,0.1)' },
      ticks: { color: '#a0a0a0' }
    },
    x: {
      grid: { display: false },
      ticks: { color: '#a0a0a0' }
    }
  }
};

const openChart = async (row: any) => {
  selectedAreaName.value = row.area || 'Unknown';
  showChartModal.value = true;
  isChartLoading.value = true;
  
  try {
    const filtersToPass: any = { ...route.query };
    
    // Ensure we filter down to this specific area's name depending on what table we're looking at
    if (typeParam.value === 'manufacturing') filtersToPass.manufacturingArea = selectedAreaName.value;
    else if (typeParam.value === 'service') filtersToPass.serviceArea = selectedAreaName.value;
    else filtersToPass.majorArea = selectedAreaName.value;

    // Use the reliable all-stats API which defaults to 10-years trend (calendar year)
    
    const res = await axios.get(`/api/bin-analyser/dashboard/all-stats`, { 
      params: filtersToPass
    });
    const trendData = res.data.charts?.trend || [];

    chartData.value = {
      labels: trendData.map((t: any) => t.period),
      datasets: [{
        label: 'Registrations',
        data: trendData.map((t: any) => t.count),
        borderColor: '#0dcaf0',
        backgroundColor: 'rgba(13, 202, 240, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#0dcaf0',
        pointBorderColor: '#000',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    };
  } catch (error: any) {
    console.error("Failed to load 10-year trend", error);
  } finally {
    isChartLoading.value = false;
  }
};

const getTrendClass = (trendStr: string) => {
  if (trendStr.startsWith('+')) return 'text-success fw-bold';
  if (trendStr.startsWith('-') && trendStr !== '-') return 'text-danger fw-bold';
  return 'text-muted';
};

const closeTab = () => {
  window.close();
};

  const downloadExcel = () => {
  try {
    const ws_data: any[][] = [];
    
    // Header Row
    const headerRow = [titleText.value, 'Total BINs'];
    comparisonFys.value.forEach(fy => {
      headerRow.push(`${fy} Registrations`, `${fy} Trend`);
    });
    ws_data.push(headerRow);

    // Data Rows
    comparisonData.value.forEach((row: any) => {
      const dataRow = [row.area || 'Unknown', row.totalBins || 0];
      comparisonFys.value.forEach((fy, idx) => {
        dataRow.push(row[fy] || 0, getTrend(row, fy, idx));
      });
      ws_data.push(dataRow);
    });
    
    // Add Grand Total Row
    if (comparisonData.value.length > 0) {
      const footerRow = ['Grand Total', grandTotalBins.value];
      comparisonFys.value.forEach((fy, idx) => {
        footerRow.push(getFyTotal(fy), getFyTrendTotal(fy, idx));
      });
      ws_data.push(footerRow);
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(ws_data);
    
    // Set column widths
    const cols = [{ wch: 45 }, { wch: 15 }];
    comparisonFys.value.forEach(() => {
      cols.push({ wch: 20 }, { wch: 15 });
    });
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparison');
    
    XLSX.writeFile(workbook, `5yr_comparison_${typeParam.value}.xlsx`);
  } catch (error) {
    console.error('Failed to export comparison data', error);
  }
};
</script>


