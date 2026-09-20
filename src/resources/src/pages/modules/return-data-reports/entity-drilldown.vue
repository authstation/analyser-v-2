<template>
  <div class="py-2">
    <!-- TOP HEADER & FILTERS -->
    <div class="card bg-dark border-secondary shadow-sm mb-3">
      <!-- Title & Main Actions Row -->
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
        <div class="d-flex align-items-center flex-wrap gap-2">
          <button class="btn btn-outline-secondary btn-sm me-1" @click="goBack" title="Back">
            <i class="bi bi-arrow-left me-1"></i> Back
          </button>
          <h5 class="mb-0 fw-bold text-light d-flex align-items-center">
            <i class="bi bi-buildings text-info me-2"></i>
            {{ pageTitle }}
          </h5>
          <span v-if="appliedFilterText" class="badge bg-dark border border-secondary px-2 py-1 text-muted small">
            {{ appliedFilterText }}
          </span>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-info btn-sm" @click="openDetailsReport" :disabled="isLoading || !selectedBin" title="Open Detailed 5-Year Audit & Revenue Report in New Tab">
            <i class="bi bi-file-earmark-medical me-1"></i> View Details
          </button>
          <button class="btn btn-danger btn-sm" @click="printReport" :disabled="isLoading || entities.length === 0">
            <i class="bi bi-printer me-1"></i> Print / PDF
          </button>
          <button class="btn btn-success btn-sm" @click="downloadExcelAll" :disabled="isLoading || entities.length === 0">
            <i class="bi bi-file-earmark-excel-fill me-1"></i> Export Entities
          </button>
          <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <!-- 3 Economic Area Filter Row -->
      <div class="card-body px-3 py-2 bg-dark border-top border-secondary">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md">
            <MultiSelectDropdown
              v-model="selectedMajorArea"
              :options="uniqueMajorAreas"
              placeholder="Major Economic Area"
              all-label="All Major Areas"
              id-prefix="filter-major"
              size="sm"
              @change="onMajorAreaChange"
            />
          </div>

          <div class="col-12 col-md">
            <MultiSelectDropdown
              v-model="selectedMfgArea"
              :options="uniqueMfgAreas"
              placeholder="Manufacturing Area"
              all-label="All Manufacturing Areas"
              id-prefix="filter-mfg"
              size="sm"
              @change="onAreaFilterChange"
            />
          </div>

          <div class="col-12 col-md">
            <MultiSelectDropdown
              v-model="selectedServiceArea"
              :options="uniqueServiceAreas"
              placeholder="Service Area"
              all-label="All Service Areas"
              id-prefix="filter-service"
              size="sm"
              @change="onAreaFilterChange"
            />
          </div>

          <div class="col-auto">
            <button
              class="btn btn-sm btn-outline-secondary shadow-none"
              @click="resetAreaFilters"
              :disabled="isLoading || (selectedMajorArea.length === 0 && selectedMfgArea.length === 0 && selectedServiceArea.length === 0)"
              title="Reset Area Filters"
              style="height: 31px; width: 34px; display: flex; align-items: center; justify-content: center;"
            >
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN BODY: LEFT (ENTITIES LIST) + RIGHT (TRENDS & BAR CHART) -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-info" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="mt-2 text-muted small">Loading institutions data...</div>
    </div>

    <div v-else-if="entities.length === 0" class="card bg-dark border-secondary p-5 text-center text-muted">
      <i class="bi bi-inbox fs-1 mb-2"></i>
      <h5>No institutions found for this category and filter criteria.</h5>
      <p class="small">Try adjusting the economic area or circle filters.</p>
      <div>
        <button class="btn btn-primary btn-sm rounded-pill px-3 me-2" @click="resetAreaFilters">
          <i class="bi bi-arrow-clockwise me-1"></i> Reset Area Filters
        </button>
        <button class="btn btn-outline-secondary btn-sm rounded-pill px-3" @click="goBack">
          <i class="bi bi-arrow-left me-1"></i> Back to Dashboard
        </button>
      </div>
    </div>

    <div v-else class="row g-3">
      <!-- LEFT COLUMN: ENTITY LIST (4 Cols on LG, 12 on MD) -->
      <div class="col-12 col-lg-5 col-xl-4">
        <div class="card bg-dark border-secondary h-100 shadow-sm d-flex flex-column" style="min-height: 700px;">
          <div class="card-header border-secondary py-2">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="fw-bold text-light small">
                <i class="bi bi-card-list me-1 text-info"></i> Matching Institutions
              </span>
              <span class="badge bg-secondary rounded-pill">{{ filteredEntities.length }} / {{ entities.length }}</span>
            </div>
            <!-- Search Box -->
            <div class="input-group search-input-group">
              <span class="input-group-text bg-surface text-info">
                <i class="bi bi-search"></i>
              </span>
              <input
                type="text"
                class="form-control bg-surface text-light shadow-none"
                placeholder="Search BIN, Name, Address..."
                v-model="searchQuery"
                @input="currentPage = 1"
              />
              <button
                v-if="searchQuery"
                class="btn btn-sm text-secondary bg-transparent border-0 px-2 shadow-none"
                type="button"
                @click="searchQuery = ''; currentPage = 1"
                title="Clear Search"
              >
                <i class="bi bi-x-circle-fill"></i>
              </button>
            </div>
          </div>

          <!-- Entity List Items: Clean Name & Address only -->
          <div class="card-body p-0 flex-grow-1 overflow-auto" style="max-height: 620px;">
            <div class="list-group list-group-flush">
              <button
                v-for="item in paginatedEntities"
                :key="item.bin"
                type="button"
                class="list-group-item list-group-item-action bg-dark text-light border-secondary p-2.5 px-3 entity-item"
                :class="{ 'active-entity': selectedBin === item.bin }"
                @click="selectEntity(item.bin)"
              >
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="fw-bold text-truncate me-2" :class="selectedBin === item.bin ? 'text-warning' : 'text-info'">
                    {{ item.entityName }}
                  </span>
                  <span class="badge bg-dark border border-secondary text-light small flex-shrink-0">
                    {{ item.submissionCount }} Returns
                  </span>
                </div>

                <div class="small text-muted text-truncate">
                  <i class="bi bi-geo-alt me-1 text-secondary"></i> {{ item.address || 'Address N/A' }}
                </div>
              </button>
            </div>
          </div>

          <!-- Pagination Footer -->
          <div class="card-footer border-secondary py-2 d-flex justify-content-between align-items-center" v-if="totalPages > 1">
            <span class="small text-muted">
              {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, filteredEntities.length) }} of {{ filteredEntities.length }}
            </span>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" :disabled="currentPage === 1" @click="currentPage--">
                <i class="bi bi-chevron-left"></i>
              </button>
              <button class="btn btn-outline-secondary" disabled>
                {{ currentPage }} / {{ totalPages }}
              </button>
              <button class="btn btn-outline-secondary" :disabled="currentPage === totalPages" @click="currentPage++">
                <i class="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: SELECTED INSTITUTION DETAILS, TREND BAR CHART & TABLE (8 Cols on LG) -->
      <div class="col-12 col-lg-7 col-xl-8">
        <!-- Selected Institution Profile Summary Card -->
        <div class="card bg-dark border-secondary shadow-sm mb-3" v-if="selectedEntityInfo">
          <div class="card-body p-3">
            <div class="row g-2 align-items-center">
              <div class="col-12 col-md-6">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <h5 class="fw-bold text-info mb-0 text-truncate">{{ selectedEntityInfo.entityName }}</h5>
                  <span v-if="selectedEntityInfo.forcedRegistration === 'Yes'" class="badge bg-danger small">Forced</span>
                </div>
                <div class="text-muted small mb-1">
                  <i class="bi bi-geo-alt-fill text-danger me-1"></i> {{ selectedEntityInfo.address }}
                </div>
                <div class="small text-secondary">
                  <div class="mb-1"><i class="bi bi-upc-scan text-warning me-1"></i> BIN: <strong class="text-light font-monospace">{{ selectedEntityInfo.bin }}</strong></div>
                  <div><i class="bi bi-telephone text-success me-1"></i> Mobile: <strong class="text-light">{{ selectedEntityInfo.mobile || 'N/A' }}</strong></div>
                </div>
              </div>

              <div class="col-12 col-md-6 border-start-md border-secondary ps-md-3">
                <div class="small mb-1">
                  <span class="text-secondary">Major Economic Area:</span>
                  <strong class="text-warning ms-1">{{ selectedEntityInfo.majorArea || 'None' }}</strong>
                </div>
                <div class="small mb-1">
                  <span class="text-secondary">Manufacturing Area:</span>
                  <strong class="text-info ms-1">{{ selectedEntityInfo.mfgArea || 'None' }}</strong>
                </div>
                <div class="small mb-1">
                  <span class="text-secondary">Service Area:</span>
                  <strong class="text-success ms-1">{{ selectedEntityInfo.serviceArea || 'None' }}</strong>
                </div>
                <div class="small">
                  <span class="text-secondary">Circle:</span>
                  <span class="text-light ms-1">{{ selectedEntityInfo.circleName || 'N/A' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Return Filing & Compliance Summary in One Single Row -->
          <div class="card-footer bg-dark border-top border-secondary border-opacity-75 py-2 px-3">
            <div class="d-flex align-items-center justify-content-between flex-nowrap overflow-auto gap-2">
              <div class="d-flex align-items-center flex-nowrap gap-2 flex-shrink-0">
                <span class="text-warning small fw-bold">
                  <i class="bi bi-clock-history me-1 text-warning"></i> Filing Status:
                </span>
                <span v-if="complianceInfo.binIssueDate && complianceInfo.binIssueDate !== 'N/A'" class="status-box px-2 py-1 text-muted small" title="BIN Registration Date">
                  Reg: <span class="text-light ms-1 font-monospace">{{ complianceInfo.binIssueDate }}</span>
                </span>
              </div>
              <div class="d-flex align-items-center flex-nowrap gap-1.5 flex-shrink-0">
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Total Due:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.totalDue }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Total Filed:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.totalSubmitted }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Activity Yes:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.activityYes }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Activity No:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.activityNo }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Non-Filed:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.nonFiled }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Trend Graph & Data Card -->
        <div class="card bg-dark border-secondary shadow-sm">
          <!-- Controls Header -->
          <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
            <!-- Period Breakdown Toggle: Monthly vs Yearly -->
            <div class="btn-group btn-group-sm" role="group">
              <button
                type="button"
                class="btn fw-bold"
                :class="viewPeriodMode === 'monthly' ? 'btn-info text-dark' : 'btn-outline-secondary text-light'"
                @click="viewPeriodMode = 'monthly'"
              >
                <i class="bi bi-calendar-month me-1"></i> Monthly
              </button>
              <button
                type="button"
                class="btn fw-bold"
                :class="viewPeriodMode === 'yearly' ? 'btn-info text-dark' : 'btn-outline-secondary text-light'"
                @click="viewPeriodMode = 'yearly'"
              >
                <i class="bi bi-calendar-range me-1"></i> Yearly
              </button>
            </div>

            <!-- Metric Filter Selection -->
            <div class="d-flex align-items-center gap-2">
              <label class="form-label text-muted small mb-0 d-none d-sm-inline">Metric:</label>
              <select class="form-select form-select-sm bg-dark text-light border-secondary fw-bold" v-model="selectedMetric">
                <option value="all">📊 All (Combined Comparison Chart)</option>
                <option value="totalPayableVat">💵 Total Payable VAT</option>
                <option value="totalInputTaxCreditVat">🔄 Rebate / Input Tax Credit</option>
                <option value="decreasingAdjustment">📉 Decreasing Adjustment</option>
                <option value="netPayableVat">⚖️ Net Payable VAT</option>
                <option value="depositedVat">🏦 Deposited VAT</option>
              </select>
              <button class="btn btn-outline-success btn-sm" @click="downloadExcelEntityHistory" :disabled="isTrendLoading || activeTrendData.length === 0" title="Download Trend Data as Excel">
                <i class="bi bi-download"></i>
              </button>
            </div>
          </div>

          <div class="card-body p-3">
            <!-- Trend Loading Spinner -->
            <div v-if="isTrendLoading" class="text-center py-5">
              <div class="spinner-border text-info" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <div class="mt-2 text-muted small">Loading historical return analytics...</div>
            </div>

            <div v-else-if="activeTrendData.length === 0" class="text-center py-5 text-muted">
              <i class="bi bi-bar-chart-line fs-2 mb-2"></i>
              <p class="mb-0">No historical return records found for this institution.</p>
            </div>

            <div v-else>
              <!-- Dynamic Chart: Line for Individual Metric, Bar for All Combined -->
              <div class="chart-scroll-wrapper mb-4 overflow-auto border border-secondary border-opacity-25 rounded p-2 bg-dark">
                <div :style="chartContainerStyle">
                  <Line v-if="selectedMetric !== 'all'" :data="chartData" :options="chartOptions" />
                  <Bar v-else :data="chartData" :options="chartOptions" />
                </div>
              </div>

              <!-- Summary Data Table -->
              <div class="table-responsive border border-secondary rounded">
                <table class="table table-dark table-striped table-hover table-bordered border-secondary mb-0 align-middle small text-center">
                  <thead class="table-dark align-middle">
                    <tr>
                      <th class="ps-3 text-start py-2">
                        {{ viewPeriodMode === 'monthly' ? 'Tax Period' : 'Fiscal Year' }}
                      </th>
                      <th class="py-2">Activity</th>
                      <th class="text-end py-2">Payable VAT</th>
                      <th class="text-end py-2">Rebate / ITC</th>
                      <th class="text-end py-2">Decreasing Adj</th>
                      <th class="text-end py-2">Net Payable VAT</th>
                      <th class="text-end pe-3 py-2">Deposited VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in activeTrendData" :key="idx">
                      <td class="ps-3 text-start fw-bold text-info">
                        {{ row.periodLabel || row.period || row.fiscalYear }}
                      </td>
                      <td>
                        <span class="badge" :class="row.hasActivities === 'Yes' ? 'bg-success' : 'bg-secondary'">
                          {{ row.hasActivities || (row.submissionCount ? `${row.submissionCount} Returns` : 'No') }}
                        </span>
                      </td>
                      <td class="text-end font-monospace" :class="selectedMetric === 'totalPayableVat' || selectedMetric === 'all' ? 'text-warning fw-bold' : 'text-light'">
                        {{ (row.totalPayableVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      </td>
                      <td class="text-end font-monospace" :class="selectedMetric === 'totalInputTaxCreditVat' || selectedMetric === 'all' ? 'text-info fw-bold' : 'text-light'">
                        {{ (row.totalInputTaxCreditVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      </td>
                      <td class="text-end font-monospace" :class="selectedMetric === 'decreasingAdjustment' || selectedMetric === 'all' ? 'text-secondary fw-bold' : 'text-light'">
                        {{ (row.decreasingAdjustment || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      </td>
                      <td class="text-end font-monospace" :class="selectedMetric === 'netPayableVat' || selectedMetric === 'all' ? 'text-danger fw-bold' : 'text-light'">
                        {{ (row.netPayableVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      </td>
                      <td class="text-end pe-3 font-monospace" :class="selectedMetric === 'depositedVat' || selectedMetric === 'all' ? 'text-success fw-bold' : 'text-light'">
                        {{ (row.depositedVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot class="table-dark fw-bold text-center border-top border-2 border-secondary">
                    <tr>
                      <td class="ps-3 text-start text-info">Total</td>
                      <td class="text-muted">{{ activeTrendData.length }} Periods</td>
                      <td class="text-end text-warning font-monospace">{{ totalSumPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                      <td class="text-end text-info font-monospace">{{ totalSumRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                      <td class="text-end text-secondary font-monospace">{{ totalSumDecreasing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                      <td class="text-end text-danger font-monospace">{{ totalSumNetPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                      <td class="text-end pe-3 text-success font-monospace">{{ totalSumDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '@/plugins/axios';
import * as XLSX from 'xlsx';
import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';
import { Bar, Line } from 'vue-chartjs';
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
const router = useRouter();

// State
const isLoading = ref(true);
const isTrendLoading = ref(false);
const entities = ref<any[]>([]);
const searchQuery = ref('');
const selectedBin = ref<string>('');
const monthlyTrends = ref<any[]>([]);
const yearlyTrends = ref<any[]>([]);
const selectedEntityInfo = ref<any>(null);

const openDetailsReport = () => {
  const bin = selectedBin.value || selectedEntityInfo.value?.bin;
  if (!bin) return;
  const routeData = router.resolve({
    name: 'return-entity-details-report',
    query: { bin }
  });
  window.open(routeData.href, '_blank');
};

// Dynamic Return Filing & Compliance Info
const complianceInfo = computed(() => {
  const entity = selectedEntityInfo.value;
  const list = monthlyTrends.value || [];
  const issueDate = entity?.binIssueDate || 'N/A';
  const totalSubmitted = list.length || (entity?.submissionCount ? Number(entity.submissionCount) : 0);
  const activityYes = list.filter((m: any) => m.hasActivities === 'Yes').length;
  const activityNo = list.filter((m: any) => m.hasActivities === 'No' || !m.hasActivities).length;

  let totalDue = totalSubmitted;
  if (issueDate && issueDate !== 'N/A') {
    const [issueYear, issueMonth] = issueDate.split('-').map(Number);
    let latestYear = 2026;
    let latestMonth = 8;
    if (list.length > 0) {
      const last = list[list.length - 1];
      if (last.period) {
        const [y, m] = last.period.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          latestYear = y;
          latestMonth = m;
        }
      }
    }
    if (!isNaN(issueYear) && !isNaN(issueMonth)) {
      const diffMonths = (latestYear - issueYear) * 12 + (latestMonth - issueMonth) + 1;
      totalDue = Math.max(diffMonths, totalSubmitted, 1);
    }
  }

  const nonFiled = Math.max(0, totalDue - totalSubmitted);

  return {
    binIssueDate: issueDate,
    totalDue,
    totalSubmitted,
    activityYes,
    activityNo,
    nonFiled
  };
});

// Area Filters State
const selectedMajorArea = ref<string[]>([]);
const selectedMfgArea = ref<string[]>([]);
const selectedServiceArea = ref<string[]>([]);
const uniqueMajorAreas = ref<string[]>([]);
const uniqueMfgAreasBase = ref<string[]>([]);
const uniqueServiceAreasBase = ref<string[]>([]);
const areaRelations = ref<{ major: string; mfg: string | null; service: string | null }[]>([]);

// Controls
const viewPeriodMode = ref<'monthly' | 'yearly'>('monthly');
const selectedMetric = ref<string>('all');

// Pagination
const currentPage = ref(1);
const itemsPerPage = 10;

// Query parameters
const classificationType = computed(() => (route.query.classificationType as string) || 'activity');
const categoryValue = computed(() => (route.query.categoryValue as string) || '');
const fromDate = computed(() => (route.query.fromDate as string) || '');
const toDate = computed(() => (route.query.toDate as string) || '');
const circleId = computed(() => (route.query.circleId as string) || '');

// Computed Headers & Labels
const pageTitle = computed(() => {
  if (classificationType.value === 'registration') {
    return 'Registration Type Drilldown';
  }
  return 'Economic Activity Drilldown';
});

const categoryBadgeText = computed(() => {
  if (classificationType.value === 'registration') {
    return `Forced: ${categoryValue.value || 'All'}`;
  }
  return `Activity: ${categoryValue.value || 'All'}`;
});

const appliedFilterText = computed(() => {
  const parts: string[] = [];
  if (fromDate.value && toDate.value) parts.push(`${fromDate.value} to ${toDate.value}`);
  if (circleId.value) parts.push(`Circle Filtered`);
  return parts.join(' | ');
});

// Dependent Area Options: Major Area -> Mfg Area & Service Area
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

// Filtered and Paginated Entities
const filteredEntities = computed(() => {
  if (!searchQuery.value.trim()) return entities.value;
  const q = searchQuery.value.toLowerCase().trim();
  return entities.value.filter((e: any) =>
    (e.bin && e.bin.toLowerCase().includes(q)) ||
    (e.entityName && e.entityName.toLowerCase().includes(q)) ||
    (e.address && e.address.toLowerCase().includes(q)) ||
    (e.majorArea && e.majorArea.toLowerCase().includes(q)) ||
    (e.mobile && e.mobile.toLowerCase().includes(q))
  );
});

const totalPages = computed(() => Math.ceil(filteredEntities.value.length / itemsPerPage) || 1);

const paginatedEntities = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredEntities.value.slice(start, start + itemsPerPage);
});

const activeTrendData = computed(() => {
  return viewPeriodMode.value === 'monthly' ? monthlyTrends.value : yearlyTrends.value;
});

// Totals for table footer
const totalSumPayable = computed(() => activeTrendData.value.reduce((s, r) => s + (Number(r.totalPayableVat) || 0), 0));
const totalSumRebate = computed(() => activeTrendData.value.reduce((s, r) => s + (Number(r.totalInputTaxCreditVat) || 0), 0));
const totalSumDecreasing = computed(() => activeTrendData.value.reduce((s, r) => s + (Number(r.decreasingAdjustment) || 0), 0));
const totalSumNetPayable = computed(() => activeTrendData.value.reduce((s, r) => s + (Number(r.netPayableVat) || 0), 0));
const totalSumDeposited = computed(() => activeTrendData.value.reduce((s, r) => s + (Number(r.depositedVat) || 0), 0));

// Navigation & Actions
const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/modules/return-data-reports/dashboard');
  }
};

const closeTab = () => {
  window.close();
  setTimeout(() => {
    if (!window.closed) goBack();
  }, 150);
};

const printReport = () => {
  window.print();
};

const onMajorAreaChange = () => {
  const validMfg = new Set(uniqueMfgAreas.value);
  selectedMfgArea.value = selectedMfgArea.value.filter(m => validMfg.has(m));

  const validService = new Set(uniqueServiceAreas.value);
  selectedServiceArea.value = selectedServiceArea.value.filter(s => validService.has(s));

  currentPage.value = 1;
  fetchEntities();
};

const onAreaFilterChange = () => {
  currentPage.value = 1;
  fetchEntities();
};

const resetAreaFilters = () => {
  selectedMajorArea.value = [];
  selectedMfgArea.value = [];
  selectedServiceArea.value = [];
  currentPage.value = 1;
  fetchEntities();
};

// Fetch Entities List
const fetchEntities = async () => {
  isLoading.value = true;
  try {
    const params = new URLSearchParams();
    ['classificationType', 'categoryValue', 'fromDate', 'toDate', 'circleId', 'policeStationId'].forEach(key => {
      if (route.query[key]) {
        params.append(key, String(route.query[key]));
      }
    });

    if (selectedMajorArea.value.length > 0) params.append('majorArea', selectedMajorArea.value.join(','));
    if (selectedMfgArea.value.length > 0) params.append('mfgArea', selectedMfgArea.value.join(','));
    if (selectedServiceArea.value.length > 0) params.append('serviceArea', selectedServiceArea.value.join(','));

    const res = await axios.get(`/api/return-data-analyser/drilldown-entities?${params.toString()}`);
    entities.value = res.data?.data || [];

    // Populate area filter options strictly from institutions matching this drilldown context
    if (res.data?.areaOptions && uniqueMajorAreas.value.length === 0 && uniqueMfgAreasBase.value.length === 0 && uniqueServiceAreasBase.value.length === 0) {
      uniqueMajorAreas.value = res.data.areaOptions.majorAreas || [];
      uniqueMfgAreasBase.value = res.data.areaOptions.mfgAreas || [];
      uniqueServiceAreasBase.value = res.data.areaOptions.serviceAreas || [];
      areaRelations.value = res.data.areaOptions.areaRelations || [];
    }

    if (entities.value.length > 0) {
      // If previous selectedBin is still in the filtered list, keep it, else select the first entity
      const exists = entities.value.some((e: any) => e.bin === selectedBin.value);
      if (!exists || !selectedBin.value) {
        selectEntity(entities.value[0].bin);
      }
    } else {
      selectedBin.value = '';
      selectedEntityInfo.value = null;
      monthlyTrends.value = [];
      yearlyTrends.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch entities:', error);
  } finally {
    isLoading.value = false;
  }
};

// Select Entity & Fetch Trends
const selectEntity = async (bin: string) => {
  selectedBin.value = bin;
  const match = entities.value.find((e: any) => e.bin === bin);
  if (match) selectedEntityInfo.value = match;

  isTrendLoading.value = true;
  try {
    const res = await axios.get(`/api/return-data-analyser/entity-trends?bin=${bin}`);
    const data = res.data?.data;
    if (data) {
      if (data.entity) selectedEntityInfo.value = data.entity;
      monthlyTrends.value = data.monthly || [];
      yearlyTrends.value = data.yearly || [];
    }
  } catch (error) {
    console.error('Failed to fetch entity trends:', error);
  } finally {
    isTrendLoading.value = false;
  }
};

// Chart.js Configuration
const chartData = computed(() => {
  const dataList = activeTrendData.value;
  if (!dataList.length) return { labels: [], datasets: [] };

  if (selectedMetric.value === 'all') {
    // Single month / single period breakdown: put metrics directly on the X-axis for a clean breakdown
    if (dataList.length === 1) {
      const single = dataList[0];
      return {
        labels: ['Total Payable VAT', 'Rebate / ITC', 'Decreasing Adj', 'Net Payable VAT', 'Deposited VAT'],
        datasets: [
          {
            label: single.periodLabel || single.period || single.fiscalYear,
            backgroundColor: [
              'rgba(245, 158, 11, 0.85)',
              'rgba(6, 182, 212, 0.85)',
              'rgba(148, 163, 184, 0.85)',
              'rgba(239, 68, 68, 0.85)',
              'rgba(16, 185, 129, 0.85)'
            ],
            borderColor: [
              '#f59e0b',
              '#06b6d4',
              '#94a3b8',
              '#ef4444',
              '#10b981'
            ],
            borderWidth: 1.5,
            borderRadius: 6,
            maxBarThickness: 56,
            data: [
              single.totalPayableVat || 0,
              single.totalInputTaxCreditVat || 0,
              single.decreasingAdjustment || 0,
              single.netPayableVat || 0,
              single.depositedVat || 0
            ]
          }
        ]
      };
    }

    // Multi-month/year view: Grouped Bar Chart
    const labels = dataList.map((d: any) => d.periodLabel || d.period || d.fiscalYear);
    return {
      labels,
      datasets: [
        {
          label: 'Total Payable VAT',
          backgroundColor: '#f59e0b',
          borderColor: '#f59e0b',
          borderRadius: 4,
          maxBarThickness: 24,
          data: dataList.map((d: any) => d.totalPayableVat || 0)
        },
        {
          label: 'Rebate / ITC',
          backgroundColor: '#06b6d4',
          borderColor: '#06b6d4',
          borderRadius: 4,
          maxBarThickness: 24,
          data: dataList.map((d: any) => d.totalInputTaxCreditVat || 0)
        },
        {
          label: 'Decreasing Adj',
          backgroundColor: '#94a3b8',
          borderColor: '#94a3b8',
          borderRadius: 4,
          maxBarThickness: 24,
          data: dataList.map((d: any) => d.decreasingAdjustment || 0)
        },
        {
          label: 'Net Payable VAT',
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          borderRadius: 4,
          maxBarThickness: 24,
          data: dataList.map((d: any) => d.netPayableVat || 0)
        },
        {
          label: 'Deposited VAT',
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderRadius: 4,
          maxBarThickness: 24,
          data: dataList.map((d: any) => d.depositedVat || 0)
        }
      ]
    };
  }

  // Single Metric Selected across all periods -> Smooth Line Graph with Fill
  const labels = dataList.map((d: any) => d.periodLabel || d.period || d.fiscalYear);
  const metricConfigs: Record<string, { label: string; bg: string; border: string; point: string }> = {
    totalPayableVat: { label: 'Total Payable VAT', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', point: '#f59e0b' },
    totalInputTaxCreditVat: { label: 'Rebate / Input Tax Credit', bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', point: '#06b6d4' },
    decreasingAdjustment: { label: 'Decreasing Adjustment', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', point: '#94a3b8' },
    netPayableVat: { label: 'Net Payable VAT', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', point: '#ef4444' },
    depositedVat: { label: 'Deposited VAT', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', point: '#10b981' }
  };

  const currentConfig = metricConfigs[selectedMetric.value] || { label: 'Amount', bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', point: '#06b6d4' };

  return {
    labels,
    datasets: [
      {
        label: currentConfig.label,
        data: dataList.map((d: any) => d[selectedMetric.value] || 0),
        borderColor: currentConfig.border,
        backgroundColor: currentConfig.bg,
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: currentConfig.point,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
        pointRadius: dataList.length === 1 ? 6 : 4.5,
        pointHoverRadius: 7
      }
    ]
  };
});

const chartContainerStyle = computed(() => {
  const count = activeTrendData.value.length;
  if (count <= 6) {
    return { width: '100%', minWidth: '100%', height: '320px', position: 'relative' as const };
  }
  const perPoint = selectedMetric.value === 'all' ? 95 : 55;
  const calculatedWidth = count * perPoint;
  return {
    width: `${calculatedWidth}px`,
    minWidth: '100%',
    height: '320px',
    position: 'relative' as const
  };
});

const chartOptions = computed(() => {
  const isSingleAll = activeTrendData.value.length === 1 && selectedMetric.value === 'all';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !isSingleAll,
        position: 'top' as const,
        labels: {
          color: '#adb5bd',
          font: { size: 12, family: 'Inter, sans-serif' },
          boxWidth: 14,
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f9fafb',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y || 0;
            const datasetLabel = isSingleAll ? context.label : context.dataset.label;
            return ` ${datasetLabel}: ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#adb5bd', font: { size: 12 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: {
          color: '#adb5bd',
          callback: (value: any) => {
            if (Math.abs(value) >= 10000000) return (value / 10000000).toFixed(1) + ' Cr';
            if (Math.abs(value) >= 100000) return (value / 100000).toFixed(1) + ' L';
            if (Math.abs(value) >= 1000) return (value / 1000).toFixed(0) + ' k';
            return value;
          }
        }
      }
    }
  };
});

// Excel Export Functions
const downloadExcelAll = () => {
  if (!entities.value.length) return;
  const rows = entities.value.map((e: any, index: number) => ({
    'Sl': index + 1,
    'BIN': e.bin,
    'Entity Name': e.entityName,
    'Address': e.address,
    'Major Area': e.majorArea,
    'Mfg Area': e.mfgArea,
    'Service Area': e.serviceArea,
    'Mobile': e.mobile,
    'Circle': e.circleName,
    'Forced Reg': e.forcedRegistration,
    'Returns Filed': e.submissionCount,
    'Total Payable VAT': e.totalPayableVat,
    'Total Rebate': e.totalRebateVat,
    'Total Decreasing Adj': e.totalDecreasingAdjustment,
    'Total Net Payable': e.totalNetPayableVat,
    'Total Deposited VAT': e.totalDepositedVat
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Institutions');
  const filename = `Institutions_${classificationType.value}_${categoryValue.value || 'all'}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

const downloadExcelEntityHistory = () => {
  if (!activeTrendData.value.length || !selectedEntityInfo.value) return;
  const rows = activeTrendData.value.map((r: any, index: number) => ({
    'Sl': index + 1,
    'Period': r.periodLabel || r.period || r.fiscalYear,
    'Activities': r.hasActivities || 'N/A',
    'Total Sales Value': r.totalSalesValue || 0,
    'Total Payable VAT': r.totalPayableVat || 0,
    'Rebate / ITC': r.totalInputTaxCreditVat || 0,
    'Decreasing Adjustment': r.decreasingAdjustment || 0,
    'Increasing Adjustment': r.increasingAdjustment || 0,
    'Net Payable VAT': r.netPayableVat || 0,
    'Deposited VAT': r.depositedVat || 0,
    'Closing Balance': r.closingBalanceVat || 0,
    'Submission Date': r.submissionDate || 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trend_History');
  const filename = `Trend_${selectedEntityInfo.value.bin}_${viewPeriodMode.value}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

onMounted(async () => {
  // Initialize area filters from query if present
  if (route.query.majorArea) {
    selectedMajorArea.value = String(route.query.majorArea).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (route.query.mfgArea) {
    selectedMfgArea.value = String(route.query.mfgArea).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (route.query.serviceArea) {
    selectedServiceArea.value = String(route.query.serviceArea).split(',').map(s => s.trim()).filter(Boolean);
  }

  await fetchEntities();
});
</script>

<style scoped>
.search-input-group {
  border: 1px solid #495057 !important;
  border-radius: 0.375rem !important;
  overflow: hidden;
  height: 36px;
  background-color: var(--app-surface, #1a1d21) !important;
  transition: all 0.2s ease-in-out;
}

.search-input-group:hover,
.search-input-group:focus-within {
  border-color: #0dcaf0 !important;
  box-shadow: 0 0 0 0.15rem rgba(13, 202, 240, 0.2) !important;
}

.search-input-group .input-group-text {
  border: none !important;
  border-right: 1px solid #374151 !important;
  border-radius: 0 !important;
  padding: 0.25rem 0.65rem !important;
  background-color: transparent !important;
}

.search-input-group .form-control {
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0.25rem 0.65rem !important;
  background-color: transparent !important;
  font-size: 0.85rem;
}

.entity-item {
  cursor: pointer;
  transition: all 0.2s ease;
}
.entity-item:hover {
  background-color: #212529 !important;
  border-left: 3px solid #0dcaf0 !important;
}
.active-entity {
  background-color: #232a35 !important;
  border-left: 4px solid #0dcaf0 !important;
}

.status-box {
  background-color: #1a1d21;
  border: 1px solid #495057;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  user-select: none;
  pointer-events: none;
  line-height: 1.2;
}

/* Sleek thin scrollbars */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb {
  background: #495057;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #6c757d;
}

.chart-scroll-wrapper,
.table-responsive,
.overflow-auto {
  scrollbar-width: thin;
  scrollbar-color: #495057 rgba(0, 0, 0, 0.15);
}

@media (min-width: 768px) {
  .border-start-md {
    border-left: 1px solid #374151 !important;
  }
}
</style>
