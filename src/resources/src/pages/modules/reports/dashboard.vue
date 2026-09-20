<template>
  <div>
    <!-- GLOBAL FILTERS -->
    <div class="card bg-surface border-custom shadow-sm mb-4">
      <div class="card-body p-3">
        <div class="row g-3 align-items-end">
          <div class="col-md-2">
            <MultiSelectDropdown
              label="Circle"
              v-model="filters.circles"
              :options="dataStore.availableCircles"
              id-prefix="filter-circle"
            />
          </div>
          <div class="col">
            <MultiSelectDropdown
              label="Police Station"
              v-model="filters.policeStations"
              :options="dataStore.availablePoliceStations"
              id-prefix="filter-ps"
            />
          </div>
          <div class="col-md-2">
            <MultiSelectDropdown
              label="BIN Status"
              v-model="filters.statuses"
              :options="dataStore.availableStatuses"
              :searchable="false"
              id-prefix="filter-status"
            />
          </div>
          <div class="col-md-2">
            <MultiSelectDropdown
              label="Forced Registration"
              v-model="filters.forcedRegistrations"
              :options="dataStore.availableForcedRegistrations"
              :searchable="false"
              id-prefix="filter-forced"
            />
          </div>
          <div class="col-md-auto">
            <label class="form-label small text-muted mb-1">From Date</label>
            <input type="date" v-model="filters.fromDate" class="form-control form-control-sm text-light" style="max-width: 135px; height: 31px; color-scheme: dark; border: 1px solid #6c757d !important; background-color: transparent !important;">
          </div>
          <div class="col-md-auto">
            <label class="form-label small text-muted mb-1">To Date</label>
            <input type="date" v-model="filters.toDate" class="form-control form-control-sm text-light" style="max-width: 135px; height: 31px; color-scheme: dark; border: 1px solid #6c757d !important; background-color: transparent !important;">
          </div>
          <div class="col-md-auto">
            <button class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center text-light" @click="resetFilters" title="Reset Filters" style="height: 31px; width: 36px; border: 1px solid #6c757d !important;">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

        <!-- SUMMARY CARDS -->
        <div class="row row-cols-1 row-cols-md-5 g-4 mb-4">
          <div class="col">
            <div class="card bg-surface border-custom h-100 shadow-sm">
              <div class="card-body d-flex align-items-center">
                <i class="bi bi-files fs-1 text-primary me-3"></i>
                <div>
                  <h6 class="text-muted mb-1">Total BINs</h6>
                  <h3 class="mb-0 fw-bold">{{ summary.total }}</h3>
                </div>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="card bg-surface border-custom h-100 shadow-sm cursor-pointer hover-filter position-relative" @click="toggleStatus('Active')">
              <i v-if="filters.statuses.includes('Active')" class="bi bi-check-circle-fill text-success position-absolute top-0 end-0 m-2 fs-6"></i>
              <div class="card-body d-flex align-items-center">
                <i class="bi bi-check-circle fs-1 text-success me-3"></i>
                <div class="flex-grow-1">
                  <h6 class="text-muted mb-1">Active</h6>
                  <h3 class="mb-0 fw-bold">{{ summary.active }}</h3>
                  <div class="d-flex justify-content-between align-items-center mt-1">
                    <small class="text-muted" style="font-size: 0.65rem;">Click to filter</small>
                    <button class="btn btn-sm btn-outline-secondary py-0 px-2" title="View List" @click.stop="viewList({ status: 'Active' })">
                      <i class="bi bi-eye-fill"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="card bg-surface border-custom h-100 shadow-sm cursor-pointer hover-filter position-relative" @click="toggleForced('Yes')">
              <i v-if="filters.forcedRegistrations.includes('Yes')" class="bi bi-check-circle-fill text-success position-absolute top-0 end-0 m-2 fs-6"></i>
              <div class="card-body d-flex align-items-center">
                <i class="bi bi-exclamation-triangle fs-1 text-warning me-3"></i>
                <div class="flex-grow-1">
                  <h6 class="text-muted mb-1">Forced</h6>
                  <h3 class="mb-0 fw-bold text-warning">{{ summary.forced }}</h3>
                  <div class="d-flex justify-content-between align-items-center mt-1">
                    <small class="text-muted" style="font-size: 0.65rem;">Click to filter</small>
                    <button class="btn btn-sm btn-outline-secondary py-0 px-2" title="View List" @click.stop="viewList({ forcedRegistration: 'Yes' })">
                      <i class="bi bi-eye-fill"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="card bg-surface border-custom h-100 shadow-sm cursor-pointer hover-filter position-relative" @click="toggleStatus('Suspended')">
              <i v-if="filters.statuses.includes('Suspended')" class="bi bi-check-circle-fill text-success position-absolute top-0 end-0 m-2 fs-6"></i>
              <div class="card-body d-flex align-items-center">
                <i class="bi bi-x-circle fs-1 text-danger me-3"></i>
                <div class="flex-grow-1">
                  <h6 class="text-muted mb-1">Suspended</h6>
                  <h3 class="mb-0 fw-bold text-danger">{{ summary.suspended }}</h3>
                  <div class="d-flex justify-content-between align-items-center mt-1">
                    <small class="text-muted" style="font-size: 0.65rem;">Click to filter</small>
                    <button class="btn btn-sm btn-outline-secondary py-0 px-2" title="View List" @click.stop="viewList({ status: 'Suspended' })">
                      <i class="bi bi-eye-fill"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="col">
            <div class="card bg-surface border-custom h-100 shadow-sm cursor-pointer hover-filter position-relative" @click="toggleStatus('Cancelled')">
              <i v-if="filters.statuses.includes('Cancelled')" class="bi bi-check-circle-fill text-success position-absolute top-0 end-0 m-2 fs-6"></i>
              <div class="card-body d-flex align-items-center">
                <i class="bi bi-slash-circle fs-1 text-secondary me-3"></i>
                <div class="flex-grow-1">
                  <h6 class="text-muted mb-1">Cancelled</h6>
                  <h3 class="mb-0 fw-bold text-secondary">{{ summary.cancelled }}</h3>
                  <div class="d-flex justify-content-between align-items-center mt-1">
                    <small class="text-muted" style="font-size: 0.65rem;">Click to filter</small>
                    <button class="btn btn-sm btn-outline-secondary py-0 px-2" title="View List" @click.stop="viewList({ status: 'Cancelled' })">
                      <i class="bi bi-eye-fill"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CHARTS GRID -->
        <div class="row g-4 mb-4">
          <!-- Chart 1: Registration Trend -->
          <div class="col-12">
            <div class="card bg-surface border-custom shadow-sm d-flex flex-column" style="height: 350px;">
              <div class="card-header border-custom py-2 flex-shrink-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 class="mb-0 fw-bold">Registration Trend</h6>
                <select v-model="trendBy" class="form-select form-select-sm bg-surface  border-custom" style="width: auto;">
                  <option value="year">Yearly</option>
                  <option value="month">Monthly</option>
                  <option value="day">Daily</option>
                </select>
              </div>
              <div class="card-body p-3 flex-grow-1 position-relative overflow-auto" style="min-height: 0;">
                <div :style="{ minWidth: trendChartWidth, height: '100%' }">
                  <Line :data="trendChartData" :options="trendOptions" />
                </div>
              </div>
            </div>
          </div>

          <!-- Pivot Table: Comprehensive Summary -->
          <div class="col-12">
            <div class="card bg-surface border-custom shadow-sm mb-3">
              <div class="card-header border-custom py-2 flex-shrink-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 class="mb-0 fw-bold">
                  <i class="bi bi-grid-3x3-gap-fill text-warning me-2"></i> Comprehensive Summary (Top 10)
                </h6>
                <div class="d-flex gap-2 align-items-center">

                  <button class="btn btn-outline-info btn-sm" @click="viewDetails('pivot')">
                    <i class="bi bi-list-columns me-1"></i> View Details
                  </button>
                  <button class="btn btn-outline-warning btn-sm" @click="viewComparison('major')">
                    <i class="bi bi-bar-chart-fill me-1"></i> Comparison
                  </button>
                </div>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-dark table-striped table-hover table-bordered border-custom mb-0 text-center align-middle">
                    <thead class="table-dark sticky-top">
                      <tr>
                        <th class="text-start ps-3 py-3">Economic Activity</th>
                        <th class="py-3 text-warning">Total BINs</th>
                        <th class="text-muted py-3">Has Only Major Economic Activity</th>
                        <th class="text-info py-3">Manufacturing</th>
                        <th class="text-success py-3">Service</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, idx) in dashboardStats.charts.pivot" :key="idx">
                        <td class="text-start ps-3 fw-bold cursor-pointer" @click="openDrilldown(row.majorArea, 'All')">{{ row.majorArea || 'Unknown' }}</td>
                        <td class="fw-bold fs-6 cursor-pointer text-warning" @click="openDrilldown(row.majorArea, 'Total')">{{ row.total }}</td>
                        <td class="text-muted cursor-pointer" @click="openDrilldown(row.majorArea, 'Neither')">{{ row.neither }}</td>
                        <td :class="row.hasMfg > 0 ? 'text-info fw-bold cursor-pointer' : 'text-muted'" @click="row.hasMfg > 0 && openDrilldown(row.majorArea, 'Mfg')">{{ row.hasMfg }}</td>
                        <td :class="row.hasSrv > 0 ? 'text-success fw-bold cursor-pointer' : 'text-muted'" @click="row.hasSrv > 0 && openDrilldown(row.majorArea, 'Service')">{{ row.hasSrv }}</td>
                      </tr>
                      <tr v-if="!dashboardStats.charts.pivot || !dashboardStats.charts.pivot.length">
                        <td colspan="5" class="py-4 text-muted">No data available</td>
                      </tr>
                    </tbody>
                    <tfoot v-if="dashboardStats.charts.pivot && dashboardStats.charts.pivot.length" class="table-active fw-bold">
                      <tr>
                        <td class="text-start ps-3 fs-6">Grand Total:</td>
                        <td class="fs-5 text-warning border-end">{{ dashboardStats.charts.pivot.reduce((s, i) => s + Number(i.total), 0) }}</td>
                        <td class="fs-5 text-muted">{{ dashboardStats.charts.pivot.reduce((s, i) => s + Number(i.neither), 0) }}</td>
                        <td class="fs-5 text-info">{{ dashboardStats.charts.pivot.reduce((s, i) => s + Number(i.hasMfg), 0) }}</td>
                        <td class="fs-5 text-success">{{ dashboardStats.charts.pivot.reduce((s, i) => s + Number(i.hasSrv), 0) }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Chart 3: Major Area (Full Row) -->
          <div class="col-12">
            <div class="card bg-surface border-custom shadow-sm d-flex flex-column" style="height: 350px;">
              <div class="card-header border-custom py-2 flex-shrink-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 class="mb-0 fw-bold">Registrations by Major Area (Top 10)</h6>
                <div class="d-flex gap-2 align-items-center">

                  <button class="btn btn-outline-info btn-sm" @click="viewDetails('majorArea')">
                    <i class="bi bi-list-columns me-1"></i> View Details
                  </button>
                  <button class="btn btn-outline-warning btn-sm" @click="viewComparison('major')">
                    <i class="bi bi-bar-chart-fill me-1"></i> Comparison
                  </button>
                </div>
              </div>
              <div class="card-body p-3 flex-grow-1 position-relative" style="min-height: 0;">
                <Bar :data="majorAreaChartData" :options="majorAreaOptions" />
              </div>
            </div>
          </div>
          
          <!-- Chart 4: Manufacturing Area -->
          <div class="col-12">
            <div class="card bg-surface border-custom shadow-sm d-flex flex-column" style="height: 350px;">
              <div class="card-header border-custom py-2 flex-shrink-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 class="mb-0 fw-bold">By Manufacturing Area (Top 10)</h6>
                <div class="d-flex gap-2 align-items-center">

                  <button class="btn btn-outline-info btn-sm" @click="viewDetails('mfgArea')">
                    <i class="bi bi-list-columns me-1"></i> View Details
                  </button>
                  <button class="btn btn-outline-warning btn-sm" @click="viewComparison('manufacturing')">
                    <i class="bi bi-bar-chart-fill me-1"></i> Comparison
                  </button>
                </div>
              </div>
              <div class="card-body p-3 flex-grow-1 position-relative" style="min-height: 0;">
                <Bar :data="manufacturingChartData" :options="manufacturingOptions" />
              </div>
            </div>
          </div>
          
          <!-- Chart 5: Service Area -->
          <div class="col-12">
            <div class="card bg-surface border-custom shadow-sm d-flex flex-column" style="height: 350px;">
              <div class="card-header border-custom py-2 flex-shrink-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h6 class="mb-0 fw-bold">By Service Area (Top 10)</h6>
                <div class="d-flex gap-2 align-items-center">

                  <button class="btn btn-outline-info btn-sm" @click="viewDetails('srvArea')">
                    <i class="bi bi-list-columns me-1"></i> View Details
                  </button>
                  <button class="btn btn-outline-warning btn-sm" @click="viewComparison('service')">
                    <i class="bi bi-bar-chart-fill me-1"></i> Comparison
                  </button>
                </div>
              </div>
              <div class="card-body p-3 flex-grow-1 position-relative" style="min-height: 0;">
                <Bar :data="serviceChartData" :options="serviceOptions" />
              </div>
            </div>
          </div>
        </div>

    <!-- Filter Status Indicator -->
    <div class="alert alert-info py-2 d-flex justify-content-between align-items-center" v-if="filters.majorArea !== 'All' || filters.manufacturingArea !== 'All' || filters.serviceArea !== 'All'">
      <span><i class="bi bi-funnel-fill me-2"></i>Chart Filter Applied! Viewing specific data subset.</span>
      <button class="btn btn-sm btn-outline-primary" @click="clearChartFilters">Clear Filter</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDataStore } from '@/stores/data';
import axios from '@/plugins/axios';
import { Line, Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const dataStore = useDataStore();
const router = useRouter();

const trendBy = ref('year');

const filters = reactive({
  fromDate: '',
  toDate: '',
  statuses: [] as string[],
  forcedRegistrations: [] as string[],
  majorArea: 'All',
  manufacturingArea: 'All',
  serviceArea: 'All',
  year: 'All',
  circles: [] as string[],
  policeStations: [] as string[]
});

const toggleStatus = (val: string) => {
  const idx = filters.statuses.indexOf(val);
  if (idx === -1) filters.statuses.push(val);
  else filters.statuses.splice(idx, 1);
};

const toggleForced = (val: string) => {
  const idx = filters.forcedRegistrations.indexOf(val);
  if (idx === -1) filters.forcedRegistrations.push(val);
  else filters.forcedRegistrations.splice(idx, 1);
};

// Clear all chart-based filters
const clearChartFilters = () => {
  filters.statuses = [];
  filters.majorArea = 'All';
  filters.manufacturingArea = 'All';
  filters.serviceArea = 'All';
};

const resetFilters = () => {
  filters.circles = [];
  filters.policeStations = [];
  filters.statuses = [];
  filters.forcedRegistrations = [];
  filters.majorArea = 'All';
  filters.manufacturingArea = 'All';
  filters.serviceArea = 'All';
  filters.year = 'All';
  filters.fromDate = '';
  filters.toDate = '';
};

const viewList = (queryOptions: any) => {
  const query: any = { ...queryOptions };
  if (filters.statuses.length > 0 && !query.status) query.status = filters.statuses.join(',');
  if (filters.forcedRegistrations.length > 0 && !query.forcedRegistration) query.forcedRegistration = filters.forcedRegistrations.join(',');
  if (filters.circles.length > 0 && !query.circle) query.circle = filters.circles.join(',');
  if (filters.policeStations.length > 0 && !query.policeStations) query.policeStations = filters.policeStations.join(',');
  if (filters.fromDate && !query.fromDate) query.fromDate = filters.fromDate;
  if (filters.toDate && !query.toDate) query.toDate = filters.toDate;
  if (filters.year !== 'All' && !query.year) query.year = filters.year;
  if (filters.majorArea !== 'All' && !query.majorArea) query.majorArea = filters.majorArea;
  if (filters.manufacturingArea !== 'All' && !query.manufacturingArea) query.manufacturingArea = filters.manufacturingArea;
  if (filters.serviceArea !== 'All' && !query.serviceArea) query.serviceArea = filters.serviceArea;

  query.readonly = 'true';

  const url = router.resolve({ name: 'bin-list', query }).href;
  window.open(url, '_blank');
};

const viewDetails = (type: 'majorArea'|'mfgArea'|'srvArea'|'pivot') => {
  const query: any = {};
  if (filters.statuses.length > 0) query.status = filters.statuses.join(',');
  if (filters.forcedRegistrations.length > 0) query.forcedRegistration = filters.forcedRegistrations.join(',');
  if (filters.circles.length > 0) query.circle = filters.circles.join(',');
  if (filters.policeStations.length > 0) query.policeStations = filters.policeStations.join(',');
  if (filters.fromDate) query.fromDate = filters.fromDate;
  if (filters.toDate) query.toDate = filters.toDate;
  if (filters.year !== 'All') query.year = filters.year;

  const url = router.resolve({ name: 'bin-chart-details', params: { type }, query }).href;
  window.open(url, '_blank');
};

const viewComparison = (type: string) => {
  const query: any = {};
  if (filters.statuses.length > 0) query.status = filters.statuses.join(',');
  if (filters.forcedRegistrations.length > 0) query.forcedRegistration = filters.forcedRegistrations.join(',');
  if (filters.circles.length > 0) query.circle = filters.circles.join(',');
  if (filters.policeStations.length > 0) query.policeStations = filters.policeStations.join(',');
  if (filters.fromDate) query.fromDate = filters.fromDate;
  if (filters.toDate) query.toDate = filters.toDate;

  const url = router.resolve({ name: 'bin-area-comparison', params: { type }, query }).href;
  window.open(url, '_blank');
};

const openDrilldown = (majorArea: string, columnType: string) => {
  const query: any = {};
  if (filters.statuses.length > 0) query.status = filters.statuses.join(',');
  if (filters.forcedRegistrations.length > 0) query.forcedRegistration = filters.forcedRegistrations.join(',');
  if (filters.circles.length > 0) query.circle = filters.circles.join(',');
  if (filters.policeStations.length > 0) query.policeStations = filters.policeStations.join(',');
  if (filters.fromDate) query.fromDate = filters.fromDate;
  if (filters.toDate) query.toDate = filters.toDate;
  if (filters.year !== 'All') query.year = filters.year;
  query.majorArea = majorArea;
  query.columnType = columnType;

  const url = router.resolve({ name: 'bin-pivot-drilldown', query }).href;
  window.open(url, '_blank');
};

const dashboardStats = reactive({
  summary: { total: 0, active: 0, suspended: 0, cancelled: 0, forced: 0 },
  charts: {
    pivot: [] as any[],
    status: [] as any[],
    majorArea: [] as any[],
    mfgArea: [] as any[],
    srvArea: [] as any[],
    trend: [] as any[]
  }
});

const fetchDashboardStats = async () => {
  try {
    
    const queryParams = new URLSearchParams();
    if (filters.statuses.length > 0) queryParams.append('status', filters.statuses.join(','));
    if (filters.forcedRegistrations.length > 0) queryParams.append('forcedRegistration', filters.forcedRegistrations.join(','));
    if (filters.majorArea !== 'All') queryParams.append('majorArea', filters.majorArea);
    if (filters.manufacturingArea !== 'All') queryParams.append('manufacturingArea', filters.manufacturingArea);
    if (filters.serviceArea !== 'All') queryParams.append('serviceArea', filters.serviceArea);
    if (filters.fromDate) queryParams.append('fromDate', filters.fromDate);
    if (filters.toDate) queryParams.append('toDate', filters.toDate);
    if (filters.year !== 'All') queryParams.append('year', filters.year);
    if (filters.circles.length > 0) queryParams.append('circle', filters.circles.join(','));
    if (filters.policeStations.length > 0) queryParams.append('policeStations', filters.policeStations.join(','));
    if (trendBy.value) queryParams.append('trendBy', trendBy.value);

    const token = localStorage.getItem('token') || '';
    const response = await axios.get(`/api/bin-analyser/dashboard/all-stats?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data) {
      dashboardStats.summary = response.data.summary || dashboardStats.summary;
      dashboardStats.charts = response.data.charts || dashboardStats.charts;
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats', error);
  }
};

// Refetch data when filters change
watch(filters, () => {
  fetchDashboardStats();
}, { deep: true });

watch(() => filters.circles, (newCircles) => {
  dataStore.fetchFilters(newCircles.join(','));
  filters.policeStations = []; // reset selected police stations when circle changes
});

// Only refetch dashboard stats when trendBy changes
watch(trendBy, () => {
  fetchDashboardStats();
});

onMounted(() => {
  dataStore.fetchFilters();
  fetchDashboardStats();
});

const summary = computed(() => dashboardStats.summary);

// Chart Data Generators
const trendChartData = computed(() => {
  return {
    labels: dashboardStats.charts.trend.map(t => t.period),
    datasets: [{
      label: 'Registrations',
      data: dashboardStats.charts.trend.map(t => t.count),
      borderColor: '#ffc107',
      backgroundColor: 'rgba(255, 193, 7, 0.2)',
      borderWidth: 2,
      fill: true,
      tension: 0.3
    }]
  };
});

const trendChartWidth = computed(() => {
  const dataLength = dashboardStats.charts.trend.length;
  if (trendBy.value === 'month' || trendBy.value === 'day') {
    // 60px per data point, minimum 100%
    const calculatedWidth = dataLength * 60;
    return calculatedWidth > 800 ? `${calculatedWidth}px` : '100%';
  }
  return '100%';
});

const majorAreaChartData = computed(() => {
  return {
    labels: dashboardStats.charts.majorArea.map(m => {
      const pct = ((m.count / Math.max(1, dashboardStats.summary.total)) * 100).toFixed(1);
      return `${m.area} (${m.count}, ${pct}%)`;
    }),
    datasets: [{
      label: 'By Major Area',
      data: dashboardStats.charts.majorArea.map(m => m.count),
      backgroundColor: ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#0dcaf0', '#d63384', '#6f42c1', '#fd7e14', '#20c997', '#6c757d'],
      maxBarThickness: 50,
      borderRadius: 4
    }]
  };
});

const manufacturingChartData = computed(() => {
  return {
    labels: (dashboardStats.charts.mfgArea || []).map(m => {
      const pct = ((m.count / Math.max(1, dashboardStats.summary.total)) * 100).toFixed(1);
      return `${m.area} (${m.count}, ${pct}%)`;
    }),
    datasets: [{
      label: 'By Manufacturing Area',
      data: (dashboardStats.charts.mfgArea || []).map(m => m.count),
      backgroundColor: ['#6610f2', '#d63384', '#fd7e14', '#20c997', '#0dcaf0', '#198754', '#dc3545', '#ffc107', '#0d6efd', '#6c757d'],
      maxBarThickness: 50,
      borderRadius: 4
    }]
  };
});

const serviceChartData = computed(() => {
  return {
    labels: (dashboardStats.charts.srvArea || []).map(s => {
      const pct = ((s.count / Math.max(1, dashboardStats.summary.total)) * 100).toFixed(1);
      return `${s.area} (${s.count}, ${pct}%)`;
    }),
    datasets: [{
      label: 'By Service Area',
      data: (dashboardStats.charts.srvArea || []).map(s => s.count),
      backgroundColor: ['#ffc107', '#198754', '#0d6efd', '#dc3545', '#6c757d', '#6610f2', '#d63384', '#fd7e14', '#20c997', '#0dcaf0'],
      maxBarThickness: 50,
      borderRadius: 4
    }]
  };
});

// Base Chart Options
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#adb5bd' } }
  }
};

// Specific Chart Options with onClick Handlers
const trendOptions = {
  ...baseChartOptions,
  scales: { x: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } }, y: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } } }
};

const majorAreaOptions = {
  ...baseChartOptions,
  indexAxis: 'y' as const,
  onClick: (_event: any, elements: any, chart: any) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      filters.majorArea = chart.data.labels[index];
    }
  },
  scales: { x: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } }, y: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } } }
};

const manufacturingOptions = {
  ...baseChartOptions,
  indexAxis: 'y' as const,
  onClick: (_event: any, elements: any, chart: any) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      filters.manufacturingArea = chart.data.labels[index];
    }
  },
  scales: { x: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } }, y: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } } }
};

const serviceOptions = {
  ...baseChartOptions,
  indexAxis: 'y' as const,
  onClick: (_event: any, elements: any, chart: any) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      filters.serviceArea = chart.data.labels[index];
    }
  },
  scales: { x: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } }, y: { ticks: { color: '#adb5bd' }, grid: { color: '#495057' } } }
};
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.hover-filter {
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
.hover-filter:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
  border-color: #adb5bd !important;
}
</style>


