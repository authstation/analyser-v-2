<template>
  <div class="py-2">
    <div class="card bg-dark border-secondary shadow-sm">
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
        <div class="d-flex align-items-center flex-wrap gap-2">
          <h5 class="mb-0 fw-bold text-light d-flex align-items-center me-2">
            <i class="bi bi-calendar3-range text-info me-2"></i>
            FY Comparison
          </h5>
          <div class="d-flex align-items-center gap-1">
            <label class="text-muted small mb-0 me-1">Fiscal Year:</label>
            <select class="form-select form-select-sm bg-dark text-warning border-secondary fw-bold" style="width: 145px;" v-model="selectedFy" @change="onFyChange">
              <option v-for="fy in availableFys" :key="fy" :value="fy">{{ fy }}</option>
            </select>
          </div>
          <span v-if="appliedFilterText" class="badge bg-secondary px-2 py-1 small ms-1">
            {{ appliedFilterText }}
          </span>
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="btn-group btn-group-sm me-2" v-if="comparisonData">
            <button class="btn" :class="activeView === 'table' ? 'btn-info' : 'btn-outline-secondary'" @click="activeView = 'table'">
              <i class="bi bi-table me-1"></i> Table View
            </button>
            <button class="btn" :class="activeView === 'chart' ? 'btn-info' : 'btn-outline-secondary'" @click="activeView = 'chart'">
              <i class="bi bi-bar-chart-fill me-1"></i> Chart View
            </button>
          </div>
          <button class="btn btn-success btn-sm" @click="downloadExcel" :disabled="isLoading || !comparisonData">
            <i class="bi bi-file-earmark-excel-fill me-1"></i> Download Excel
          </button>
          <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
            <i class="bi bi-x-lg me-1"></i> Close
          </button>
        </div>
      </div>

      <div class="card-body p-0">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-5">
          <div class="spinner-border text-info" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <div class="mt-2 text-muted small">Loading FY comparison data...</div>
        </div>

        <div v-else-if="comparisonData">

          <!-- Table View -->
          <div v-if="activeView === 'table'" class="table-responsive">
            <!-- Submission Rate Table (Standard) -->
            <table v-if="displayMetric !== 'activity'" class="table table-dark table-striped table-hover table-bordered border-secondary align-middle text-center mb-0">
              <thead class="table-dark sticky-top">
                <tr class="align-middle">
                  <th rowspan="2" class="text-start ps-4 align-middle py-3" style="min-width: 120px;">Month</th>
                  <th colspan="3" class="text-info border-end border-secondary align-middle py-2">
                    {{ comparisonData.previousFy }} (Previous FY)
                  </th>
                  <th colspan="3" class="text-warning border-end border-secondary align-middle py-2">
                    {{ comparisonData.currentFy }} (Current FY)
                  </th>
                  <th rowspan="2" class="align-middle py-2 text-wrap" style="width: 100px; line-height: 1.3;">Eligible Growth (%)</th>
                  <th colspan="2" class="align-middle py-2 border-start border-secondary text-info">Submission Growth (%)</th>
                </tr>
                <tr class="small text-muted align-middle">
                  <th class="align-middle py-2 px-2">Eligible</th>
                  <th class="align-middle py-2 px-2">Submissions</th>
                  <th class="border-end border-secondary align-middle py-2 px-2">Submission Rate (%)</th>
                  <th class="align-middle py-2 px-2">Eligible</th>
                  <th class="align-middle py-2 px-2">Submissions</th>
                  <th class="border-end border-secondary align-middle py-2 px-2">Submission Rate (%)</th>
                  <th class="border-start border-secondary align-middle py-2 text-nowrap px-2">vs Prev Year (YoY %)</th>
                  <th class="align-middle py-2 text-nowrap px-2">vs Prev Month (MoM %)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, index) in comparisonData.months" :key="index" :class="{ 'table-active border-info border-2': m.isCurrentReportMonth }">
                  <td class="text-start ps-4 fw-bold">
                    {{ m.monthName }}
                  </td>

                  <!-- Previous FY: Eligible, Submissions, Submission Rate (%) -->
                  <td class="text-light">
                    {{ shouldShowEligible(m, 'previous', index) && m.previous.eligible > 0 ? Number(m.previous.eligible).toLocaleString() : '-' }}
                  </td>
                  <td :class="m.previous.hasData ? 'text-light' : 'text-muted'">
                    {{ m.previous.hasData ? m.previous.returns?.toLocaleString() : '-' }}
                  </td>
                  <td class="border-end border-secondary">
                    <span v-if="m.previous.hasData && m.previous.percentage !== null" 
                          class="badge fw-bold px-3 py-1"
                          :style="{ backgroundColor: getRateColor(m.previous.percentage), color: '#ffffff' }">
                      {{ m.previous.percentage }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>

                  <!-- Current FY: Eligible, Submissions, Submission Rate (%) -->
                  <td class="text-light">
                    {{ shouldShowEligible(m, 'current', index) && m.current.eligible > 0 ? Number(m.current.eligible).toLocaleString() : '-' }}
                  </td>
                  <td :class="m.current.hasData ? 'text-light fw-bold' : 'text-muted'">
                    {{ m.current.hasData ? m.current.returns?.toLocaleString() : '-' }}
                  </td>
                  <td class="border-end border-secondary">
                    <span v-if="m.current.hasData && m.current.percentage !== null" 
                          class="badge fw-bold px-3 py-1"
                          :style="{ backgroundColor: getRateColor(m.current.percentage), color: '#ffffff' }">
                      {{ m.current.percentage }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>

                  <!-- Eligible Growth -->
                  <td>
                    <span v-if="shouldShowEligible(m, 'previous', index) && shouldShowEligible(m, 'current', index) && m.previous.eligible > 0 && m.current.eligible !== m.previous.eligible"
                          :class="m.current.eligible > m.previous.eligible ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ m.current.eligible > m.previous.eligible ? '+' : '' }}{{ (((m.current.eligible - m.previous.eligible) / m.previous.eligible) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>

                  <!-- Submission Growth (vs Prev Year - YoY) -->
                  <td class="border-start border-secondary">
                    <span v-if="getYoYGrowth(m) !== null"
                          :class="getYoYGrowth(m)! > 0 ? 'text-success fw-bold' : getYoYGrowth(m)! < 0 ? 'text-danger fw-bold' : 'text-muted'">
                      {{ getYoYGrowth(m)! > 0 ? '+' : '' }}{{ getYoYGrowth(m)!.toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>

                  <!-- Submission Growth (vs Prev Month - MoM) -->
                  <td>
                    <span v-if="getMoMGrowth(index) !== null"
                          :class="getMoMGrowth(index)! > 0 ? 'text-success fw-bold' : getMoMGrowth(index)! < 0 ? 'text-danger fw-bold' : 'text-muted'">
                      {{ getMoMGrowth(index)! > 0 ? '+' : '' }}{{ getMoMGrowth(index)!.toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-dark text-center fw-bold">
                <tr>
                  <td class="text-start ps-4 py-3">Total / Overall</td>
                  <td class="text-light">{{ Number(totalPreviousEligible).toLocaleString() }}</td>
                  <td class="text-light">{{ comparisonData.totals.previousReturns ? Number(comparisonData.totals.previousReturns).toLocaleString() : '-' }}</td>
                  <td class="border-end border-secondary">
                    <span class="badge fw-bold px-3 py-1" :style="{ backgroundColor: getRateColor(previousOverallRate), color: '#ffffff' }">
                      {{ previousOverallRate }}
                    </span>
                  </td>
                  <td class="text-light">{{ Number(totalCurrentEligible).toLocaleString() }}</td>
                  <td class="text-light">{{ comparisonData.totals.currentReturns ? Number(comparisonData.totals.currentReturns).toLocaleString() : '-' }}</td>
                  <td class="border-end border-secondary">
                    <span class="badge fw-bold px-3 py-1" :style="{ backgroundColor: getRateColor(currentOverallRate), color: '#ffffff' }">
                      {{ currentOverallRate }}
                    </span>
                  </td>
                  <!-- Total Eligible Growth -->
                  <td>
                    <span v-if="totalPreviousEligible > 0 && totalCurrentEligible !== totalPreviousEligible"
                          :class="totalCurrentEligible > totalPreviousEligible ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ totalCurrentEligible > totalPreviousEligible ? '+' : '' }}{{ (((totalCurrentEligible - totalPreviousEligible) / totalPreviousEligible) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  
                  <!-- Total Submission Growth (YoY %) -->
                  <td class="border-start border-secondary">
                    <span v-if="comparisonData.totals.previousReturns > 0 && comparisonData.totals.currentReturns !== comparisonData.totals.previousReturns"
                          :class="comparisonData.totals.currentReturns > comparisonData.totals.previousReturns ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ comparisonData.totals.currentReturns > comparisonData.totals.previousReturns ? '+' : '' }}{{ (((comparisonData.totals.currentReturns - comparisonData.totals.previousReturns) / comparisonData.totals.previousReturns) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>

                  <!-- Total Submission Growth (MoM %) -->
                  <td class="text-muted">-</td>
                </tr>
              </tfoot>
            </table>

            <!-- Activity Table -->
            <table v-if="displayMetric === 'activity'" class="table table-dark table-striped table-hover table-bordered border-secondary align-middle text-center mb-0">
              <thead class="table-dark sticky-top">
                <tr class="align-middle">
                  <th rowspan="2" class="text-start ps-4 align-middle py-3" style="min-width: 120px;">Month</th>
                  <th colspan="2" class="text-info border-end border-secondary align-middle py-2">
                    {{ comparisonData.previousFy }} (Previous FY)
                  </th>
                  <th colspan="2" class="text-warning border-end border-secondary align-middle py-2">
                    {{ comparisonData.currentFy }} (Current FY)
                  </th>
                  <th colspan="2" class="align-middle py-2">Growth (%)</th>
                </tr>
                <tr class="small text-muted align-middle">
                  <th class="align-middle py-2 px-2">Activity: Yes</th>
                  <th class="border-end border-secondary align-middle py-2 px-2">Activity: No</th>
                  <th class="align-middle py-2 px-2">Activity: Yes</th>
                  <th class="border-end border-secondary align-middle py-2 px-2">Activity: No</th>
                  <th class="align-middle py-2 px-2">Growth (Yes %)</th>
                  <th class="align-middle py-2 px-2">Growth (No %)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, index) in comparisonData.months" :key="index" :class="{ 'table-active border-info border-2': m.isCurrentReportMonth }">
                  <td class="text-start ps-4 fw-bold">
                    {{ m.monthName }}
                  </td>

                  <td :class="m.previous.hasData ? 'text-light' : 'text-muted'">
                    {{ m.previous.hasData ? m.previous.activityYes?.toLocaleString() : '-' }}
                  </td>
                  <td :class="m.previous.hasData ? 'text-light border-end border-secondary' : 'text-muted border-end border-secondary'">
                    {{ m.previous.hasData ? m.previous.activityNo?.toLocaleString() : '-' }}
                  </td>

                  <td :class="m.current.hasData ? 'text-light' : 'text-muted'">
                    {{ m.current.hasData ? m.current.activityYes?.toLocaleString() : '-' }}
                  </td>
                  <td :class="m.current.hasData ? 'text-light border-end border-secondary' : 'text-muted border-end border-secondary'">
                    {{ m.current.hasData ? m.current.activityNo?.toLocaleString() : '-' }}
                  </td>

                  <td>
                    <span v-if="m.previous.hasData && m.current.hasData && m.previous.activityYes > 0 && m.current.activityYes !== m.previous.activityYes"
                          :class="m.current.activityYes > m.previous.activityYes ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ m.current.activityYes > m.previous.activityYes ? '+' : '' }}{{ (((m.current.activityYes - m.previous.activityYes) / m.previous.activityYes) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span v-if="m.previous.hasData && m.current.hasData && m.previous.activityNo > 0 && m.current.activityNo !== m.previous.activityNo"
                          :class="m.current.activityNo > m.previous.activityNo ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ m.current.activityNo > m.previous.activityNo ? '+' : '' }}{{ (((m.current.activityNo - m.previous.activityNo) / m.previous.activityNo) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                </tr>
              </tbody>
              <tfoot class="table-dark text-center fw-bold">
                <tr>
                  <td class="text-start ps-4 py-3">Total / Overall</td>
                  <td class="text-light">{{ Number(totalPreviousActivityYes).toLocaleString() }}</td>
                  <td class="text-light border-end border-secondary">{{ Number(totalPreviousActivityNo).toLocaleString() }}</td>
                  <td class="text-light">{{ Number(totalCurrentActivityYes).toLocaleString() }}</td>
                  <td class="text-light border-end border-secondary">{{ Number(totalCurrentActivityNo).toLocaleString() }}</td>
                  <td>
                    <span v-if="totalPreviousActivityYes > 0 && totalCurrentActivityYes !== totalPreviousActivityYes"
                          :class="totalCurrentActivityYes > totalPreviousActivityYes ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ totalCurrentActivityYes > totalPreviousActivityYes ? '+' : '' }}{{ (((totalCurrentActivityYes - totalPreviousActivityYes) / totalPreviousActivityYes) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                  <td>
                    <span v-if="totalPreviousActivityNo > 0 && totalCurrentActivityNo !== totalPreviousActivityNo"
                          :class="totalCurrentActivityNo > totalPreviousActivityNo ? 'text-success fw-bold' : 'text-danger fw-bold'">
                      {{ totalCurrentActivityNo > totalPreviousActivityNo ? '+' : '' }}{{ (((totalCurrentActivityNo - totalPreviousActivityNo) / totalPreviousActivityNo) * 100).toFixed(2) }}%
                    </span>
                    <span v-else class="text-muted">-</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Chart View -->
          <div v-else class="p-4" style="height: 450px;">
            <Bar :data="chartData" :options="chartOptions" />
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
  if (rate === null || rate === undefined) return 'transparent';
  const numRate = Number(rate);
  const hue = Math.min(120, Math.max(0, (numRate / 100) * 120));
  return `hsl(${hue}, 80%, 35%)`;
};
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
import { Bar } from 'vue-chartjs';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const route = useRoute();


const isLoading = ref(true);
const comparisonData = ref<any>(null);
const activeView = ref<'table' | 'chart'>('table');
const displayMetric = computed(() => route.query.metric as string | undefined);

// Fiscal Year Options
const currentYear = new Date().getFullYear();
const availableFys = ref<string[]>([]);
for (let y = currentYear + 1; y >= 2019; y--) {
  availableFys.value.push(`${y}-${(y + 1).toString().slice(-2)}`);
}

const getInitialFy = () => {
  if (route.query.fy) {
    const parts = String(route.query.fy).split('-');
    if (parts[0]) {
      const y = parseInt(parts[0]);
      return `${y}-${(y + 1).toString().slice(-2)}`;
    }
  }
  const period = (route.query.toDate as string) || (route.query.fromDate as string) || '';
  if (period && period.includes('-')) {
    const [yStr, mStr] = period.split('-');
    const y = parseInt(yStr);
    const m = parseInt(mStr);
    const startYear = m >= 7 ? y : y - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  }
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
};

const selectedFy = ref(getInitialFy());

const onFyChange = () => {
  fetchComparisonData();
};

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

const fetchComparisonData = async () => {
  isLoading.value = true;
  try {
    const token = localStorage.getItem('token');
    const queryParams = new URLSearchParams();
    ['circleId', 'policeStationId', 'fromDate', 'toDate', 'metric', 'forcedRegistration'].forEach(key => {
      if (route.query[key]) {
        queryParams.append(key, String(route.query[key]));
      }
    });
    if (selectedFy.value) {
      queryParams.set('fy', selectedFy.value);
    }

    const res = await axios.get(`/api/return-data-analyser/fy-comparison?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    comparisonData.value = res.data.data;
  } catch (error: any) {
    console.error('Failed to load FY comparison data:', error);
    alert(error.response?.data?.error || 'Failed to load FY comparison data');
  } finally {
    isLoading.value = false;
  }
};

const getYoYGrowth = (m: any): number | null => {
  if (m?.previous?.hasData && m?.current?.hasData && m.previous.returns > 0) {
    const diff = m.current.returns - m.previous.returns;
    return (diff / m.previous.returns) * 100;
  }
  return null;
};

const getMoMGrowth = (index: number | string): number | null => {
  if (!comparisonData.value?.months) return null;
  const idx = Number(index);
  const currMonth = comparisonData.value.months[idx];
  if (!currMonth?.current?.hasData || currMonth.current.returns === undefined) return null;

  let prevMonthReturns: number | null = null;
  if (idx > 0) {
    const prevM = comparisonData.value.months[idx - 1];
    if (prevM?.current?.hasData && prevM.current.returns > 0) {
      prevMonthReturns = prevM.current.returns;
    }
  } else {
    // July: compare with June of Previous FY (months[11].previous)
    const prevJune = comparisonData.value.months[11];
    if (prevJune?.previous?.hasData && prevJune.previous.returns > 0) {
      prevMonthReturns = prevJune.previous.returns;
    }
  }

  if (prevMonthReturns !== null && prevMonthReturns > 0) {
    const diff = currMonth.current.returns - prevMonthReturns;
    return (diff / prevMonthReturns) * 100;
  }
  return null;
};

const shouldShowEligible = (m: any, type: 'previous' | 'current', index: number | string) => {
  if (m[type].hasData) return true;
  if (!comparisonData.value) return false;
  
  const fyStr = type === 'previous' ? comparisonData.value.previousFy : comparisonData.value.currentFy;
  if (!fyStr) return false;
  
  const idx = Number(index);
  const startYear = parseInt(fyStr.split('-')[0]);
  const year = idx < 6 ? startYear : startYear + 1;
  const month = idx < 6 ? 7 + idx : idx - 5;
  const dateStr = `${year}-${String(month).padStart(2, '0')}`;
  
  const now = new Date();
  const currentRealDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  return dateStr < currentRealDateStr;
};

const totalPreviousEligible = computed(() => {
  if (!comparisonData.value?.months) return 0;
  return comparisonData.value.months.reduce((acc: number, m: any, index: number) => {
    return acc + (shouldShowEligible(m, 'previous', index) ? (m.previous.eligible || 0) : 0);
  }, 0);
});

const totalCurrentEligible = computed(() => {
  if (!comparisonData.value?.months) return 0;
  return comparisonData.value.months.reduce((acc: number, m: any, index: number) => {
    return acc + (shouldShowEligible(m, 'current', index) ? (m.current.eligible || 0) : 0);
  }, 0);
});

const previousOverallRate = computed(() => {
  if (!comparisonData.value?.months) return '-';
  const ret = comparisonData.value.totals.previousReturns || 0;
  const el = totalPreviousEligible.value;
  if (el === 0) return '-';
  return ((ret / el) * 100).toFixed(2) + '%';
});

const currentOverallRate = computed(() => {
  if (totalCurrentEligible.value === 0 || !comparisonData.value?.totals) return '-';
  const ret = comparisonData.value.totals.currentReturns || 0;
  return ((ret / totalCurrentEligible.value) * 100).toFixed(2) + '%';
});

// Metric Totals
const totalPreviousActivityYes = computed(() => comparisonData.value?.months?.reduce((acc: number, m: any) => acc + (m.previous.activityYes || 0), 0) || 0);
const totalPreviousActivityNo = computed(() => comparisonData.value?.months?.reduce((acc: number, m: any) => acc + (m.previous.activityNo || 0), 0) || 0);
const totalCurrentActivityYes = computed(() => comparisonData.value?.months?.reduce((acc: number, m: any) => acc + (m.current.activityYes || 0), 0) || 0);
const totalCurrentActivityNo = computed(() => comparisonData.value?.months?.reduce((acc: number, m: any) => acc + (m.current.activityNo || 0), 0) || 0);

const chartData = computed(() => {
  if (!comparisonData.value) return { labels: [], datasets: [] };
  const labels = comparisonData.value.months.map((m: any) => m.monthName);
  const prevRates = comparisonData.value.months.map((m: any) => m.previous.percentage);
  const currRates = comparisonData.value.months.map((m: any) => m.current.percentage);

  return {
    labels,
    datasets: [
      {
        label: `${comparisonData.value.previousFy} Submission Rate (%)`,
        data: prevRates,
        backgroundColor: 'rgba(108, 117, 125, 0.65)',
        borderColor: '#6c757d',
        borderWidth: 1
      },
      {
        label: `${comparisonData.value.currentFy} Submission Rate (%)`,
        data: currRates,
        backgroundColor: 'rgba(13, 202, 240, 0.75)',
        borderColor: '#0dcaf0',
        borderWidth: 1
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
          if (val === null || val === undefined) return `${context.dataset.label}: No data`;
          return `${context.dataset.label}: ${val}%`;
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
      beginAtZero: true,
      ticks: {
        color: '#adb5bd',
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
    const prevFy = comparisonData.value.previousFy;
    const currFy = comparisonData.value.currentFy;

    if (displayMetric.value === 'activity') {
      ws_data.push([
        'Month',
        `${prevFy} Activity: Yes`,
        `${prevFy} Activity: No`,
        `${currFy} Activity: Yes`,
        `${currFy} Activity: No`,
        'Growth (Yes %)',
        'Growth (No %)'
      ]);

      comparisonData.value.months.forEach((m: any) => {
        let yesGrowth = '';
        if (m.previous.hasData && m.current.hasData && m.previous.activityYes > 0 && m.current.activityYes !== m.previous.activityYes) {
          const d = (((m.current.activityYes - m.previous.activityYes) / m.previous.activityYes) * 100).toFixed(2);
          yesGrowth = Number(d) >= 0 ? `+${d}%` : `${d}%`;
        } else if (m.previous.hasData && m.current.hasData && m.previous.activityYes > 0) {
          yesGrowth = '-';
        }

        let noGrowth = '';
        if (m.previous.hasData && m.current.hasData && m.previous.activityNo > 0 && m.current.activityNo !== m.previous.activityNo) {
          const d = (((m.current.activityNo - m.previous.activityNo) / m.previous.activityNo) * 100).toFixed(2);
          noGrowth = Number(d) >= 0 ? `+${d}%` : `${d}%`;
        } else if (m.previous.hasData && m.current.hasData && m.previous.activityNo > 0) {
          noGrowth = '-';
        }

        ws_data.push([
          m.monthName,
          m.previous.hasData ? m.previous.activityYes : '',
          m.previous.hasData ? m.previous.activityNo : '',
          m.current.hasData ? m.current.activityYes : '',
          m.current.hasData ? m.current.activityNo : '',
          yesGrowth,
          noGrowth
        ]);
      });

      let yesGrowthTotal = '';
      if (totalPreviousActivityYes.value > 0 && totalCurrentActivityYes.value !== totalPreviousActivityYes.value) {
        const d = (((totalCurrentActivityYes.value - totalPreviousActivityYes.value) / totalPreviousActivityYes.value) * 100).toFixed(2);
        yesGrowthTotal = Number(d) >= 0 ? `+${d}%` : `${d}%`;
      } else if (totalPreviousActivityYes.value > 0) {
        yesGrowthTotal = '-';
      }

      let noGrowthTotal = '';
      if (totalPreviousActivityNo.value > 0 && totalCurrentActivityNo.value !== totalPreviousActivityNo.value) {
        const d = (((totalCurrentActivityNo.value - totalPreviousActivityNo.value) / totalPreviousActivityNo.value) * 100).toFixed(2);
        noGrowthTotal = Number(d) >= 0 ? `+${d}%` : `${d}%`;
      } else if (totalPreviousActivityNo.value > 0) {
        noGrowthTotal = '-';
      }

      ws_data.push([
        'Total / Overall',
        totalPreviousActivityYes.value,
        totalPreviousActivityNo.value,
        totalCurrentActivityYes.value,
        totalCurrentActivityNo.value,
        yesGrowthTotal,
        noGrowthTotal
      ]);
      
    } else {
      // Standard Submission Rate Table
      ws_data.push([
        'Month',
        `${prevFy} Eligible`,
        `${prevFy} Submissions`,
        `${prevFy} Submission Rate (%)`,
        `${currFy} Eligible`,
        `${currFy} Submissions`,
        `${currFy} Submission Rate (%)`,
        'Eligible Growth (%)',
        'Submission Growth vs Prev Year (YoY %)',
        'Submission Growth vs Prev Month (MoM %)'
      ]);

      // Data rows
      comparisonData.value.months.forEach((m: any, index: number) => {
        const prevRate = m.previous.hasData && m.previous.percentage !== null ? `${m.previous.percentage}%` : '';
        const currRate = m.current.hasData && m.current.percentage !== null ? `${m.current.percentage}%` : '';
        
        let yoyGrowth = '';
        const yoy = getYoYGrowth(m);
        if (yoy !== null) {
          yoyGrowth = yoy >= 0 ? `+${yoy.toFixed(2)}%` : `${yoy.toFixed(2)}%`;
        } else if (m.previous.hasData && m.current.hasData && m.previous.returns > 0) {
          yoyGrowth = '-';
        }

        let momGrowth = '';
        const mom = getMoMGrowth(index);
        if (mom !== null) {
          momGrowth = mom >= 0 ? `+${mom.toFixed(2)}%` : `${mom.toFixed(2)}%`;
        }

        let eligibleGrowth = '';
        if (shouldShowEligible(m, 'previous', index) && shouldShowEligible(m, 'current', index) && m.previous.eligible > 0 && m.current.eligible !== m.previous.eligible) {
          const d = (((m.current.eligible - m.previous.eligible) / m.previous.eligible) * 100).toFixed(2);
          eligibleGrowth = Number(d) >= 0 ? `+${d}%` : `${d}%`;
        } else if (shouldShowEligible(m, 'previous', index) && shouldShowEligible(m, 'current', index) && m.previous.eligible > 0) {
          eligibleGrowth = '-';
        }
        
        ws_data.push([
          m.monthName,
          shouldShowEligible(m, 'previous', index) ? m.previous.eligible : '',
          m.previous.hasData ? m.previous.returns : '',
          prevRate,
          shouldShowEligible(m, 'current', index) ? m.current.eligible : '',
          m.current.hasData ? m.current.returns : '',
          currRate,
          eligibleGrowth,
          yoyGrowth,
          momGrowth
        ]);
      });

      let yoyGrowthTotal = '';
      if (comparisonData.value.totals.previousReturns > 0 && comparisonData.value.totals.currentReturns !== comparisonData.value.totals.previousReturns) {
        const d = (((comparisonData.value.totals.currentReturns - comparisonData.value.totals.previousReturns) / comparisonData.value.totals.previousReturns) * 100).toFixed(2);
        yoyGrowthTotal = Number(d) >= 0 ? `+${d}%` : `${d}%`;
      } else if (comparisonData.value.totals.previousReturns > 0) {
        yoyGrowthTotal = '-';
      }
      
      let eligibleGrowthTotal = '';
      if (totalPreviousEligible.value > 0 && totalCurrentEligible.value !== totalPreviousEligible.value) {
        const d = (((totalCurrentEligible.value - totalPreviousEligible.value) / totalPreviousEligible.value) * 100).toFixed(2);
        eligibleGrowthTotal = Number(d) >= 0 ? `+${d}%` : `${d}%`;
      } else if (totalPreviousEligible.value > 0) {
        eligibleGrowthTotal = '-';
      }
      
      ws_data.push([
        'Total / Overall',
        totalPreviousEligible.value,
        comparisonData.value.totals.previousReturns,
        previousOverallRate.value,
        totalCurrentEligible.value,
        comparisonData.value.totals.currentReturns,
        currentOverallRate.value,
        eligibleGrowthTotal,
        yoyGrowthTotal,
        '-'
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(ws_data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FY Comparison');
    XLSX.writeFile(workbook, `Return_FY_Comparison_${prevFy}_vs_${currFy}.xlsx`);
    alert('Excel downloaded successfully');
  } catch (error) {
    console.error('Failed to export excel:', error);
    alert('Failed to export excel');
  }
};

onMounted(() => {
  fetchComparisonData();
});
</script>

<style scoped>
.table-active {
  background-color: rgba(13, 202, 240, 0.1) !important;
}
</style>
