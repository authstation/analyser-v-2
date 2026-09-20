<template>
  <div class="py-2">
    <div class="card bg-dark border-secondary shadow-sm">
      <!-- Header -->
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
        <div class="d-flex align-items-center flex-wrap gap-2">
          <h5 class="mb-0 fw-bold text-light d-flex align-items-center me-2">
            <i class="bi bi-graph-up text-info me-2"></i>
            Year Comparison
          </h5>
          <span v-if="comparisonData?.months?.length" class="text-secondary fs-6">
            <i class="bi bi-calendar-range me-1"></i> {{ last12MonthsLabel }}
          </span>
          <span v-if="appliedFilterText" class="badge bg-dark border border-secondary px-2 py-1 small">
            {{ appliedFilterText }}
          </span>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-success btn-sm" @click="downloadExcel" :disabled="isLoading || !comparisonData">
            <i class="bi bi-file-earmark-excel-fill me-1"></i> Download Excel
          </button>
          <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
            <i class="bi bi-x-lg me-1"></i> Close
          </button>
        </div>
      </div>

      <div class="card-body p-4">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-info" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <div class="mt-2 text-muted small">Loading 12-Month Comparison Graph...</div>
        </div>

        <div v-else-if="comparisonData">
          <!-- KPI Summary Cards for Rate / Submissions -->
          <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-5 g-3 mb-4">
            <div class="col">
              <div class="card bg-dark border-secondary text-center p-3 h-100">
                <div class="text-muted small">Total Eligible Entities</div>
                <div class="fs-3 fw-bold text-info mt-1">{{ latestMonth?.eligible?.toLocaleString() || latestMonth?.eligible || '-' }}</div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark border-secondary text-center p-3 h-100">
                <div class="text-muted small">Total Expected Returns</div>
                <div class="fs-3 fw-bold text-primary mt-1">{{ totalExpectedReturns.toLocaleString() }}</div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark border-secondary text-center p-3 h-100">
                <div class="text-muted small">Total Submissions</div>
                <div class="fs-3 fw-bold text-light mt-1">{{ comparisonData.totalSubmissions?.toLocaleString() || comparisonData.totalSubmissions }}</div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark border-secondary text-center p-3 h-100">
                <div class="text-muted small">Overall Submission Rate</div>
                <div class="fs-3 fw-bold text-success mt-1">{{ overallRate }}</div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark border-secondary text-center p-3 h-100">
                <div class="text-muted small">{{ latestMonth?.monthLabel || '-' }}</div>
                <div class="fs-3 fw-bold text-warning mt-1">{{ latestMonth?.submissionRate !== null ? latestMonth.submissionRate + '%' : '-' }}</div>
              </div>
            </div>
          </div>

          <!-- 12-Month Graph -->
          <div class="card bg-dark border-secondary mb-4">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
              <span class="fw-bold text-light small">
                <i class="bi bi-graph-up text-info me-1"></i>
                12-Month Submission Rate & Submissions Trend
              </span>
            </div>
            <div class="card-body p-3" style="height: 380px;">
              <Line :data="chartData" :options="chartOptions" />
            </div>
          </div>

          <!-- Monthly Data Table -->
          <div class="table-responsive">
            <!-- Standard Submission Rate Table -->
            <table v-if="displayMetric !== 'activity'" class="table table-dark table-striped table-hover table-bordered border-secondary align-middle text-center mb-0">
              <thead class="table-dark sticky-top">
                <tr>
                  <th class="text-start ps-4 py-3">Month</th>
                  <th>Eligible Entities</th>
                  <th>Submissions</th>
                  <th>Submission Rate (%)</th>
                  <th>Monthly Growth</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in comparisonData.months" :key="m.period || m.monthLabel" :class="{ 'table-active border-info border-2': m.isCurrentMonth }">
                  <td class="text-start ps-4 fw-bold">
                    {{ m.monthName ? `${m.monthName} (${m.monthLabel})` : m.monthLabel }}
                  </td>
                  <td class="text-light">
                    {{ m.eligible > 0 ? m.eligible.toLocaleString() : '-' }}
                  </td>
                  <td :class="m.hasData ? 'text-light fw-bold' : 'text-muted'">
                    {{ m.hasData ? m.submissions?.toLocaleString() : '-' }}
                  </td>
                  <td>
                    <span v-if="m.hasData && m.submissionRate !== null" 
                          class="badge fw-bold px-3 py-1"
                          :style="{ backgroundColor: getRateColor(m.submissionRate), color: '#ffffff' }">
                      {{ m.submissionRate }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span v-if="m.monthlyGrowth !== null && m.monthlyGrowth !== undefined"
                          class="fw-bold small"
                          :class="m.monthlyGrowth > 0 ? 'text-success' : m.monthlyGrowth < 0 ? 'text-danger' : 'text-muted'">
                      <i :class="m.monthlyGrowth > 0 ? 'bi bi-arrow-up-short' : m.monthlyGrowth < 0 ? 'bi bi-arrow-down-short' : 'bi bi-dash'"></i>
                      {{ m.monthlyGrowth > 0 ? '+' : '' }}{{ m.monthlyGrowth }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-dark border-secondary fw-bold">
                <tr>
                  <td class="text-start ps-4">Total / Expected (12 Months)</td>
                  <td class="text-primary">{{ totalExpectedReturns.toLocaleString() }}</td>
                  <td class="text-light">{{ comparisonData.totalSubmissions?.toLocaleString() || comparisonData.totalSubmissions }}</td>
                  <td>
                    <span class="badge fw-bold px-3 py-1"
                          :style="{ backgroundColor: getRateColor(overallRate), color: '#ffffff' }">
                      {{ overallRate }}
                    </span>
                  </td>
                  <td class="text-muted">-</td>
                </tr>
              </tfoot>
            </table>

            <!-- Activity Table -->
            <table v-if="displayMetric === 'activity'" class="table table-dark table-striped table-hover table-bordered border-secondary align-middle text-center mb-0">
              <thead class="table-dark sticky-top">
                <tr>
                  <th class="text-start ps-4 py-3">Month</th>
                  <th>Activity: Yes</th>
                  <th>Activity: No</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in comparisonData.months" :key="m.period || m.monthLabel" :class="{ 'table-active border-info border-2': m.isCurrentMonth }">
                  <td class="text-start ps-4 fw-bold">
                    {{ m.monthName ? `${m.monthName} (${m.monthLabel})` : m.monthLabel }}
                    <span v-if="m.isCurrentMonth" class="badge bg-info text-dark ms-2" style="font-size: 0.72rem;">Current</span>
                  </td>
                  <td :class="m.hasData ? 'text-light fw-bold' : 'text-muted'">
                    {{ m.hasData ? m.activityYes?.toLocaleString() : '-' }}
                  </td>
                  <td :class="m.hasData ? 'text-light' : 'text-muted'">
                    {{ m.hasData ? m.activityNo?.toLocaleString() : '-' }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-dark text-center fw-bold">
                <tr>
                  <td class="text-start ps-4 py-3">Total (Last 12 Months)</td>
                  <td class="text-light">{{ totalActivityYes.toLocaleString() }}</td>
                  <td class="text-light">{{ totalActivityNo.toLocaleString() }}</td>
                </tr>
              </tfoot>
            </table>


          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from '@/plugins/axios';
import * as XLSX from 'xlsx';


const getRateColor = (rate: number | string) => {
  if (rate === null || rate === undefined || rate === '-') return 'transparent';
  // Parse numeric part (e.g., '15.64%' -> 15.64)
  const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(numRate)) return 'transparent';
  
  // Map rate (0-100) to hue (0-120), where 0 is Red and 120 is Green
  const hue = Math.min(120, Math.max(0, (numRate / 100) * 120));
  return `hsl(${hue}, 80%, 35%)`;
};
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const route = useRoute();


const isLoading = ref(true);
const comparisonData = ref<any>(null);
const displayMetric = computed(() => route.query.metric as string | undefined);

const appliedFilterText = computed(() => {
  const parts: string[] = [];
  if (route.query.circleId) parts.push(`Circle Filtered`);
  if (route.query.policeStationId) parts.push(`PS Filtered`);
  return parts.join(' | ');
});

const closeTab = () => {
  window.close();
  setTimeout(() => {
    if (!window.closed) {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/modules/return-analyser';
      }
    }
  }, 150);
};

const fetchYearComparisonData = async () => {
  isLoading.value = true;
  try {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams();
    ['circleId', 'policeStationId', 'fromDate', 'toDate', 'metric', 'forcedRegistration'].forEach(key => {
      if (route.query[key]) {
        queryParams.append(key, String(route.query[key]));
      }
    });

    const res = await axios.get(`/api/return-data-analyser/year-comparison?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    comparisonData.value = res.data.data;
  } catch (error: any) {
    console.error('Failed to load Year comparison data:', error);
    alert(error.response?.data?.error || 'Failed to load Year comparison data');
  } finally {
    isLoading.value = false;
  }
};

const last12MonthsLabel = computed(() => {
  if (!comparisonData.value?.months?.length) return 'Last 12 Months';
  const first = comparisonData.value.months[0]?.monthLabel;
  const last = comparisonData.value.months[comparisonData.value.months.length - 1]?.monthLabel;
  if (first && last) {
    return `Last 12 Months (From ${first} to ${last})`;
  }
  return 'Last 12 Months';
});

const latestMonth = computed(() => {
  if (!comparisonData.value?.months?.length) return null;
  return comparisonData.value.months[comparisonData.value.months.length - 1];
});

const totalExpectedReturns = computed(() => {
  if (comparisonData.value?.totalExpectedReturns !== undefined) {
    return comparisonData.value.totalExpectedReturns;
  }
  if (!comparisonData.value?.months?.length) return 0;
  return comparisonData.value.months.reduce((acc: number, m: any) => acc + (m.eligible || 0), 0);
});

const totalActivityYes = computed(() => {
  if (!comparisonData.value?.months?.length) return 0;
  return comparisonData.value.months.reduce((acc: number, m: any) => acc + (m.activityYes || 0), 0);
});

const totalActivityNo = computed(() => {
  if (!comparisonData.value?.months?.length) return 0;
  return comparisonData.value.months.reduce((acc: number, m: any) => acc + (m.activityNo || 0), 0);
});

const overallRate = computed(() => {
  if (!comparisonData.value?.totalSubmissions || !totalExpectedReturns.value) return '-';
  return ((comparisonData.value.totalSubmissions / totalExpectedReturns.value) * 100).toFixed(2) + '%';
});

// removed averageActiveRatio

const chartData = computed<any>(() => {
  if (!comparisonData.value?.months) return { labels: [], datasets: [] };
  const labels = comparisonData.value.months.map((m: any) => m.monthLabel);

  return {
    labels,
    datasets: [
      {
        label: 'Submission Rate (%)',
        data: comparisonData.value.months.map((m: any) => m.hasData ? m.submissionRate : null),
        borderColor: '#ffc107',
        backgroundColor: 'rgba(255, 193, 7, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#ffc107',
        pointBorderColor: '#000',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { color: '#adb5bd' }
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const val = context.parsed.y;
          if (val === null || val === undefined) return `No data`;
          const monthData = comparisonData.value.months[context.dataIndex];
          return [
            `Submission Rate: ${val}%`,
            `Submissions: ${monthData.submissions?.toLocaleString()}`
          ];
        }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#adb5bd' },
      grid: { color: 'rgba(255, 255, 255, 0.05)' }
    },
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      beginAtZero: true,
      title: {
        display: true,
        text: 'Rate (%)',
        color: '#ffc107'
      },
      ticks: {
        color: '#ffc107',
        callback: (val: any) => `${val}%`
      },
      grid: { color: 'rgba(255, 255, 255, 0.08)' }
    }
  }
}));

const downloadExcel = () => {
  if (!comparisonData.value) return;
  try {
    const ws_data: any[][] = [];
    if (displayMetric.value === 'activity') {
      ws_data.push(['Month', 'Period', 'Activity: Yes', 'Activity: No']);
      comparisonData.value.months.forEach((m: any) => {
        ws_data.push([
          m.monthName,
          m.monthLabel,
          m.hasData ? m.activityYes : '',
          m.hasData ? m.activityNo : ''
        ]);
      });
      ws_data.push([
        'Total (Last 12 Months)',
        '',
        comparisonData.value.months.reduce((acc: number, m: any) => acc + (m.activityYes || 0), 0),
        comparisonData.value.months.reduce((acc: number, m: any) => acc + (m.activityNo || 0), 0)
      ]);
    } else {
      ws_data.push(['Month', 'Period', 'Eligible Entities', 'Submissions', 'Submission Rate (%)']);
      comparisonData.value.months.forEach((m: any) => {
        ws_data.push([
          m.monthName || m.monthLabel,
          m.monthLabel,
          m.eligible ?? 0,
          m.hasData ? (m.submissions ?? 0) : 0,
          m.hasData && m.submissionRate !== null ? `${m.submissionRate}%` : '0%'
        ]);
      });
      ws_data.push([
        'Total (Last 12 Months)',
        '',
        totalExpectedReturns.value,
        comparisonData.value.totalSubmissions,
        overallRate.value
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(ws_data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '12-Month Comparison');
    const filenamePeriod = comparisonData.value?.targetPeriod || 'Latest';
    XLSX.writeFile(workbook, `Return_12_Month_Comparison_${filenamePeriod}.xlsx`);
    alert('Excel downloaded successfully');
  } catch (error) {
    console.error('Failed to export excel:', error);
    alert('Failed to export excel');
  }
};

onMounted(() => {
  fetchYearComparisonData();
});
</script>

<style scoped>
.table-active {
  background-color: rgba(13, 202, 240, 0.1) !important;
}
</style>
