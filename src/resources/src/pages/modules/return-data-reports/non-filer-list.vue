<template>
  <div class="h-100 d-flex flex-column text-light">
    <!-- Filter Section (No Card Wrapper) -->
    <div class="mb-4 d-print-none" style="position: relative; z-index: 1050;">
      <div class="row g-2 align-items-end">
        <!-- 1. BIN Issue From Date -->
        <div class="col-12 col-md-3">
          <label class="form-label small text-muted mb-1 d-block">Issue From Date</label>
          <input
            type="date"
            class="form-control bg-dark text-light border-secondary shadow-none"
            style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
            v-model="fromIssueDate"
          />
        </div>

        <!-- 2. BIN Issue To Date -->
        <div class="col-12 col-md-3">
          <label class="form-label small text-muted mb-1 d-block">Issue To Date</label>
          <input
            type="date"
            class="form-control bg-dark text-light border-secondary shadow-none"
            style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
            v-model="toIssueDate"
            :min="fromIssueDate || undefined"
          />
        </div>

        <!-- 3. From Tax Period -->
        <div class="col-12 col-md-3">
          <label class="form-label small text-muted mb-1 d-block">From Tax Period</label>
          <input
            type="month"
            class="form-control bg-dark text-light border-secondary shadow-none"
            style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
            v-model="fromTaxPeriod"
          />
        </div>

        <!-- 4. To Tax Period -->
        <div class="col-12 col-md-3">
          <label class="form-label small text-muted mb-1 d-block">To Tax Period</label>
          <input
            type="month"
            class="form-control bg-dark text-light border-secondary shadow-none"
            style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
            v-model="toTaxPeriod"
            :min="fromTaxPeriod || undefined"
          />
        </div>

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

    <!-- Empty / Idle State: Placeholder before user clicks View button -->
    <div v-else-if="!hasLoaded" class="text-center p-5 border border-secondary rounded flex-grow-1 d-flex flex-column justify-content-center align-items-center" style="border-style: dashed !important; background-color: rgba(33, 37, 41, 0.4); min-height: 260px;">
      <i class="bi bi-inbox text-muted" style="font-size: 3rem; opacity: 0.5;"></i>
      <p class="text-muted mt-3 mb-0">Select your desired filters and click the View button (<i class="bi bi-eye text-primary"></i>) to generate the Non-Filer List.</p>
    </div>

    <!-- Results View: Rendered after clicking View button -->
    <template v-else-if="hasLoaded">
      <!-- Summary Breakdown Card (English, Above Non-Filer Table) -->
      <div v-if="summaryData.length > 0" class="card bg-dark border-secondary shadow-sm mb-4">
        <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 bg-dark">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-bar-chart-steps text-info"></i>
            <span class="fw-bold text-light">Non-Filer Status Breakdown</span>
            <span class="badge bg-secondary text-light ms-1">{{ summaryData.length }} {{ summaryData.length === 1 ? 'Month' : 'Months' }}</span>
          </div>
        </div>
        <div class="card-body p-0 table-responsive" style="max-height: 280px;">
          <table class="table table-dark table-bordered align-middle mb-0 custom-summary-table">
            <thead class="table-dark sticky-top text-nowrap">
              <tr class="text-center">
                <th class="text-start ps-3" style="min-width: 160px;">Issue Month</th>
                <th style="min-width: 140px;">Active BINs</th>
                <th style="min-width: 170px;" class="text-success">Returns Filed (Filer)</th>
                <th style="min-width: 190px;" class="text-warning">Never Filed (Non-Filer)</th>
                <th style="min-width: 140px;" class="text-danger">Non-Filer Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in summaryData" :key="item.monthKey" class="text-center">
                <td class="text-start ps-3 fw-bold text-light">{{ item.month }}</td>
                <td class="font-monospace text-light">{{ item.activeBins.toLocaleString() }}</td>
                <td class="font-monospace text-success fw-bold">{{ item.filers.toLocaleString() }}</td>
                <td class="font-monospace text-warning fw-bold">{{ item.nonFilers.toLocaleString() }}</td>
                <td class="font-monospace text-danger fw-bold">{{ item.nonFilerRate }}</td>
              </tr>
            </tbody>
            <tfoot v-if="totalSummaryData" class="table-dark sticky-bottom border-top border-secondary">
              <tr class="text-center fw-bold bg-secondary bg-opacity-25">
                <td class="text-start ps-3 text-info fw-bold">{{ totalSummaryData.month }}</td>
                <td class="font-monospace text-light fw-bold">{{ totalSummaryData.activeBins.toLocaleString() }}</td>
                <td class="font-monospace text-success fw-bold">{{ totalSummaryData.filers.toLocaleString() }}</td>
                <td class="font-monospace text-warning fw-bold">{{ totalSummaryData.nonFilers.toLocaleString() }}</td>
                <td class="font-monospace text-danger fw-bold">{{ totalSummaryData.nonFilerRate }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Data Table Card -->
      <div class="card bg-dark border-secondary shadow-sm flex-grow-1 overflow-hidden d-flex flex-column">
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2 d-print-none bg-dark">
        <div class="d-flex align-items-center flex-wrap gap-2">
          <h5 class="mb-0 fw-bold text-light me-2">Non Filer List</h5>
          <span class="badge bg-white text-danger">{{ filteredList.length }} Records</span>
          <span v-if="selectedBins.length > 0" class="badge bg-warning text-dark fw-bold">
            {{ selectedBins.length }} Selected
          </span>
        </div>
        
        <!-- Center/Right: Template Selector & Batch Actions -->
        <div class="d-flex align-items-center gap-2 flex-wrap ms-auto">
          <!-- Template Selector Dropdown -->
          <div class="d-flex align-items-center gap-1">
            <label class="small text-muted fw-bold text-nowrap d-none d-md-inline">Letter Template:</label>
            <select 
              class="form-select form-select-sm bg-dark text-light border-secondary shadow-none" 
              style="width: 250px; height: 34px;"
              v-model="selectedTemplateId"
              title="Select Letter Template to Issue"
            >
              <option v-for="t in letterTemplatesList" :key="t.id" :value="t.id">
                {{ t.title }} {{ t.userId ? '(My Template)' : '(Official)' }}
              </option>
            </select>
          </div>

          <!-- Batch Print Button -->
          <button 
            class="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-none"
            style="height: 34px;"
            :disabled="effectiveBatchEntities.length === 0 || !activeSelectedTemplate"
            @click="openBatchPrintModal"
            title="Batch print sequential official letters for selected or all filers"
          >
            <i class="bi bi-printer-fill"></i>
            <span class="d-none d-sm-inline">Batch Print</span>
            <span class="badge bg-black bg-opacity-50 text-white rounded-pill ms-1">{{ effectiveBatchEntities.length }}</span>
          </button>

          <!-- Search Field on Table Header -->
          <SearchInput
            v-model="searchQuery"
            placeholder="Search BIN, Entity, Mobile..."
            width="220px"
          />
        </div>
      </div>
      
      <div class="card-body p-0 table-responsive flex-grow-1" id="printableArea">
        <table class="table table-dark table-bordered align-middle mb-0 custom-table">
          <thead class="table-dark sticky-top text-nowrap">
            <tr>
              <th style="width: 40px;" class="text-center">
                <input 
                  type="checkbox" 
                  class="form-check-input cursor-pointer" 
                  :checked="isAllPageSelected" 
                  :indeterminate.prop="isSomePageSelected"
                  @change="toggleSelectAllPage"
                  title="Select / Unselect this page"
                />
              </th>
              <th style="width: 45px;" class="text-center">#</th>
              <th>Entity Details</th>
              <th class="text-center" style="width: 130px;">Mobile</th>
              <th class="text-center">Eligible</th>
              <th class="text-center">Submitted</th>
              <th class="text-center text-warning fw-bold">Non-Filed</th>
              <th>Economic Activity</th>
              <th style="width: 100px;" class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paginatedList.length === 0">
              <td colspan="9" class="text-center py-4 text-muted">No non-filer entities found.</td>
            </tr>
            <tr v-for="(row, idx) in paginatedList" :key="row.bin">
              <td class="text-center">
                <input 
                  type="checkbox" 
                  class="form-check-input cursor-pointer" 
                  :value="row.bin" 
                  v-model="selectedBins"
                />
              </td>
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
                <div class="d-flex justify-content-center gap-1">
                  <button
                    class="btn btn-sm btn-outline-warning py-0 px-2"
                    @click="viewPenaltyReport(row.bin)"
                    title="View Non-Filer Penalty Report"
                  >
                    <i class="bi bi-file-earmark-text me-1"></i> Report
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger py-0 px-2"
                    @click="openIssueLetterModal(row)"
                    title="Issue Official Letter / Notice"
                  >
                    <i class="bi bi-envelope-paper me-1"></i> Letter
                  </button>
                </div>
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
  </template>

    <!-- Batch Letter Print Modal -->
    <BatchLetterPrintModal
      :show="showBatchPrintModal"
      :template="activeSelectedTemplate"
      :entities="effectiveBatchEntities"
      @close="showBatchPrintModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import MultiSelectDropdown from "@/components/common/MultiSelectDropdown.vue";
import SearchInput from "@/components/common/SearchInput.vue";
import BatchLetterPrintModal from "./components/BatchLetterPrintModal.vue";
import axios from "@/plugins/axios";

const router = useRouter();

const NON_FILER_STATE_KEY = "analyser_non_filer_state";

const getStoredState = () => {
  try {
    const raw = sessionStorage.getItem(NON_FILER_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const savedState = getStoredState();
const isInitialMount = ref(true);

const loading = ref(false);
const hasLoaded = ref(savedState?.hasLoaded || false);
const listData = ref<any[]>(savedState?.listData || []);
const summaryData = ref<any[]>(savedState?.summaryData || []);
const totalSummaryData = ref<any>(savedState?.totalSummaryData || null);
const searchQuery = ref(savedState?.searchQuery || "");
const currentPage = ref(savedState?.currentPage || 1);
const pageSize = ref(10);

// Letter templates & Batch Print state
const letterTemplatesList = ref<any[]>([]);
const selectedTemplateId = ref<number | null>(null);
const selectedBins = ref<string[]>([]);
const showBatchPrintModal = ref(false);

const activeSelectedTemplate = computed(() => {
  return letterTemplatesList.value.find((t) => t.id === selectedTemplateId.value) || null;
});

const isAllPageSelected = computed(() => {
  if (paginatedList.value.length === 0) return false;
  return paginatedList.value.every((row: any) => selectedBins.value.includes(row.bin));
});

const isSomePageSelected = computed(() => {
  if (isAllPageSelected.value) return false;
  return paginatedList.value.some((row: any) => selectedBins.value.includes(row.bin));
});

const toggleSelectAllPage = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  const pageBins = paginatedList.value.map((r: any) => r.bin);
  if (checked) {
    const set = new Set([...selectedBins.value, ...pageBins]);
    selectedBins.value = Array.from(set);
  } else {
    selectedBins.value = selectedBins.value.filter((b) => !pageBins.includes(b));
  }
};

const effectiveBatchEntities = computed(() => {
  if (selectedBins.value.length > 0) {
    return listData.value.filter((row: any) => selectedBins.value.includes(row.bin));
  }
  // If none explicitly selected, use all filtered list
  return filteredList.value;
});

const openBatchPrintModal = () => {
  if (effectiveBatchEntities.value.length === 0 || !activeSelectedTemplate.value) return;
  showBatchPrintModal.value = true;
};

const loadLetterTemplates = async () => {
  try {
    const res = await axios.get("/api/letter-templates");
    letterTemplatesList.value = res.data?.data || [];
    if (letterTemplatesList.value.length > 0 && !selectedTemplateId.value) {
      selectedTemplateId.value = letterTemplatesList.value[0].id;
    }
  } catch (err) {
    console.error("Failed to load letter templates:", err);
  }
};

// Open Issue Letter page in a new browser tab
const openIssueLetterModal = (row: any) => {
  const query: Record<string, any> = { bin: row.bin };
  if (selectedTemplateId.value) {
    query.templateId = selectedTemplateId.value;
  }
  const routeData = router.resolve({
    name: "return-issue-letter",
    query
  });
  window.open(routeData.href, "_blank");
};

// Filter selections (restored from saved session if available)
const fromIssueDate = ref(savedState?.fromIssueDate || "");
const toIssueDate = ref(savedState?.toIssueDate || "");
const fromTaxPeriod = ref(savedState?.fromTaxPeriod || "");
const toTaxPeriod = ref(savedState?.toTaxPeriod || "");
const selectedCircle = ref<string[]>(savedState?.selectedCircle || []);
const selectedPoliceStation = ref<string[]>(savedState?.selectedPoliceStation || []);
const selectedStatus = ref<string[]>(savedState?.selectedStatus || []);
const selectedForced = ref<string[]>(savedState?.selectedForced || []);
const selectedMajorArea = ref<string[]>(savedState?.selectedMajorArea || []);
const selectedMfgArea = ref<string[]>(savedState?.selectedMfgArea || []);
const selectedServiceArea = ref<string[]>(savedState?.selectedServiceArea || []);

// Filter options
const uniqueCircles = ref<string[]>([]);
const uniquePoliceStations = ref<string[]>([]);
const uniqueStatuses = ref<string[]>(["Active", "Inactive", "Suspended", "Cancelled"]);
const regTypeOptions = ref<string[]>(["Regular", "Forced"]);
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
    if (!rel.major || !rel.mfg) continue;
    const majors = rel.major.split(";").map((s) => s.trim());
    if (majors.some((m) => selectedMajorArea.value.includes(m))) {
      rel.mfg
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((m) => validMfg.add(m));
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
    if (!rel.major || !rel.service) continue;
    const majors = rel.major.split(";").map((s) => s.trim());
    if (majors.some((m) => selectedMajorArea.value.includes(m))) {
      rel.service
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => validService.add(s));
    }
  }
  return Array.from(validService).sort();
});

watch(
  selectedMajorArea,
  () => {
    const validMfg = new Set(uniqueMfgAreas.value);
    selectedMfgArea.value = selectedMfgArea.value.filter((m) => validMfg.has(m));

    const validService = new Set(uniqueServiceAreas.value);
    selectedServiceArea.value = selectedServiceArea.value.filter((s) => validService.has(s));
  },
  { deep: true }
);

// 1. From Issue Date watcher: if fromIssueDate > toIssueDate, reset toIssueDate
watch(fromIssueDate, (newVal) => {
  if (newVal && toIssueDate.value && toIssueDate.value < newVal) {
    toIssueDate.value = "";
  }
});

// Watch Issue Dates to dynamically refresh area dropdowns
watch([fromIssueDate, toIssueDate], () => {
  if (!isInitialMount.value) {
    fetchFilterOptions();
  }
});

// 2. From Tax Period watcher: if fromTaxPeriod > toTaxPeriod, reset toTaxPeriod
watch(fromTaxPeriod, (newVal) => {
  if (newVal && toTaxPeriod.value && toTaxPeriod.value < newVal) {
    toTaxPeriod.value = "";
  }
});

// 3. Whenever any filter condition changes, hide the list so the user must click the View button
watch(
  [
    fromIssueDate,
    toIssueDate,
    fromTaxPeriod,
    toTaxPeriod,
    selectedCircle,
    selectedPoliceStation,
    selectedStatus,
    selectedForced,
    selectedMajorArea,
    selectedMfgArea,
    selectedServiceArea
  ],
  () => {
    if (!isInitialMount.value) {
      hasLoaded.value = false;
      listData.value = [];
      summaryData.value = [];
      totalSummaryData.value = null;
      try {
        sessionStorage.removeItem(NON_FILER_STATE_KEY);
      } catch (e) {}
    }
  },
  { deep: true }
);

const filteredList = computed(() => {
  let result = listData.value;
  if (searchQuery.value.trim()) {
    const clean = (str: any) =>
      String(str || "")
        .replace(/[-_ ]/g, "")
        .toLowerCase();
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
  if (current - delta > 2) range.unshift("...");
  if (current + delta < total - 1) range.push("...");
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
    const params = new URLSearchParams();
    if (fromIssueDate.value) params.append("fromIssueDate", fromIssueDate.value);
    if (toIssueDate.value) params.append("toIssueDate", toIssueDate.value);
    if (selectedCircle.value.length > 0) params.append("circle", selectedCircle.value.join(","));

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const res = await axios.get(`/api/return-data-analyser/filter-options${queryStr}`);
    if (res.data) {
      const data = res.data.data || res.data;
      if (!fromIssueDate.value && !toIssueDate.value) {
        uniqueCircles.value = (data.circles || []).map((c: any) => (typeof c === "string" ? c : c.name)).filter(Boolean);
        uniquePoliceStations.value = (data.policeStations || []).map((p: any) => (typeof p === "string" ? p : p.name)).filter(Boolean);
        if (data.statuses && data.statuses.length > 0) {
          uniqueStatuses.value = data.statuses;
        }
      }
      uniqueMajorAreas.value = data.majorAreas || [];
      uniqueMfgAreasBase.value = data.mfgAreas || [];
      uniqueServiceAreasBase.value = data.serviceAreas || [];
      areaRelations.value = data.areaRelations || [];

      // Prune selected major areas if they are no longer in uniqueMajorAreas
      const validMajorSet = new Set(uniqueMajorAreas.value);
      selectedMajorArea.value = selectedMajorArea.value.filter((m) => validMajorSet.has(m));
    }
  } catch (error) {
    console.error("Failed to load filter options", error);
  }
};

const saveStateToStorage = () => {
  try {
    const state = {
      fromIssueDate: fromIssueDate.value,
      toIssueDate: toIssueDate.value,
      fromTaxPeriod: fromTaxPeriod.value,
      toTaxPeriod: toTaxPeriod.value,
      selectedCircle: selectedCircle.value,
      selectedPoliceStation: selectedPoliceStation.value,
      selectedStatus: selectedStatus.value,
      selectedForced: selectedForced.value,
      selectedMajorArea: selectedMajorArea.value,
      selectedMfgArea: selectedMfgArea.value,
      selectedServiceArea: selectedServiceArea.value,
      searchQuery: searchQuery.value,
      currentPage: currentPage.value,
      hasLoaded: hasLoaded.value,
      listData: listData.value,
      summaryData: summaryData.value,
      totalSummaryData: totalSummaryData.value
    };
    sessionStorage.setItem(NON_FILER_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state to sessionStorage", e);
  }
};

const fetchNonFilerList = async () => {
  loading.value = true;
  currentPage.value = 1;
  try {
    const params = new URLSearchParams();
    if (fromIssueDate.value) params.append("fromIssueDate", fromIssueDate.value);
    if (toIssueDate.value) params.append("toIssueDate", toIssueDate.value);
    if (fromTaxPeriod.value) params.append("fromTaxPeriod", fromTaxPeriod.value);
    if (toTaxPeriod.value) params.append("toTaxPeriod", toTaxPeriod.value);
    if (selectedCircle.value.length > 0) params.append("circle", selectedCircle.value.join(","));
    if (selectedPoliceStation.value.length > 0) params.append("ps", selectedPoliceStation.value.join(","));
    if (selectedStatus.value.length > 0) params.append("status", selectedStatus.value.join(","));
    if (selectedForced.value.length > 0) params.append("reg", selectedForced.value.join(","));
    if (selectedMajorArea.value.length > 0) params.append("major", selectedMajorArea.value.join("|||"));

    if (selectedMfgArea.value.length > 0) {
      params.append("mfg", selectedMfgArea.value.join("|||"));
    }

    if (selectedServiceArea.value.length > 0) {
      params.append("service", selectedServiceArea.value.join("|||"));
    }

    const res = await axios.get(`/api/return-data-analyser/non-filer-list?${params.toString()}`);
    listData.value = res.data?.data || res.data || [];
    summaryData.value = res.data?.summary || [];
    totalSummaryData.value = res.data?.totalSummary || null;
    hasLoaded.value = true;
    saveStateToStorage();
  } catch (error) {
    console.error("Failed to load non filer list", error);
    listData.value = [];
    summaryData.value = [];
    totalSummaryData.value = null;
    hasLoaded.value = true;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  fromIssueDate.value = "";
  toIssueDate.value = "";
  fromTaxPeriod.value = "";
  toTaxPeriod.value = "";
  selectedCircle.value = [];
  selectedPoliceStation.value = [];
  selectedStatus.value = [];
  selectedForced.value = [];
  selectedMajorArea.value = [];
  selectedMfgArea.value = [];
  selectedServiceArea.value = [];
  searchQuery.value = "";
  listData.value = [];
  summaryData.value = [];
  totalSummaryData.value = null;
  hasLoaded.value = false;
  try {
    sessionStorage.removeItem(NON_FILER_STATE_KEY);
  } catch (e) {}
};

const viewPenaltyReport = (bin: string) => {
  const query: Record<string, string> = { bin, fromList: "true" };
  if (fromIssueDate.value) query.fromIssueDate = fromIssueDate.value;
  if (toIssueDate.value) query.toIssueDate = toIssueDate.value;
  if (fromTaxPeriod.value) query.fromTaxPeriod = fromTaxPeriod.value;
  if (toTaxPeriod.value) query.toTaxPeriod = toTaxPeriod.value;
  router.push({
    name: "return-search-by-bin",
    query
  });
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatEconomicActivity = (row: any) => {
  const activities: string[] = [];
  if (row.majorArea && String(row.majorArea).trim()) {
    activities.push(String(row.majorArea).trim());
  }
  if (row.manufacturingArea && String(row.manufacturingArea).trim()) {
    activities.push(String(row.manufacturingArea).trim());
  }
  if (row.serviceArea && String(row.serviceArea).trim()) {
    activities.push(String(row.serviceArea).trim());
  }
  return activities.length > 0 ? activities.join(", ") : "";
};

const downloadExcel = () => {
  const data = filteredList.value;
  if (data.length === 0) return;

  const headers = [
    "SL",
    "BIN",
    "Entity Name",
    "Address",
    "Economic Activity",
    "Mobile",
    "Circle",
    "Police Station",
    "Status",
    "BIN Issue Date",
    "Eligible",
    "Submitted Returns",
    "Non-Filed"
  ];

  const csvContent = [
    headers.join(","),
    ...data.map((row, idx) => {
      const bin = `"=""${row.bin || ""}"""`;
      const name = `"${(row.name || "").replace(/"/g, '""')}"`;

      // Combine "Address, Police Station, District"
      const addrParts: string[] = [];
      if (row.address && row.address !== "N/A" && row.address !== "-") {
        addrParts.push(row.address.trim());
      }
      if (row.policeStationName && row.policeStationName !== "N/A") {
        addrParts.push(row.policeStationName.trim());
      }
      if (row.divisionName && row.divisionName !== "N/A") {
        addrParts.push(row.divisionName.trim());
      }
      const fullAddressStr = addrParts.join(", ");
      const address = `"${fullAddressStr.replace(/"/g, '""')}"`;

      const economicActivity = `"${formatEconomicActivity(row).replace(/"/g, '""')}"`;
      const mobile = `"=""${row.mobile && row.mobile !== "-" ? row.mobile : ""}"""`;
      const circle = `"${(row.circleName || "").replace(/"/g, '""')}"`;
      const ps = `"${(row.policeStationName || "").replace(/"/g, '""')}"`;
      const status = `"${(row.binStatus || "").replace(/"/g, '""')}"`;
      const issueDate = `"${formatDate(row.issueDate)}"`;
      const due = row.totalDueMonths || 0;
      const submitted = row.submittedCount || 0;
      const unfiled = row.grandTotalMonths || 0;
      return `${idx + 1},${bin},${name},${address},${economicActivity},${mobile},${circle},${ps},${status},${issueDate},${due},${submitted},${unfiled}`;
    })
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const dateStr = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `Non_Filer_List_${dateStr}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

onMounted(async () => {
  await Promise.all([fetchFilterOptions(), loadLetterTemplates()]);
  setTimeout(() => {
    isInitialMount.value = false;
  }, 100);
});
</script>

<style scoped>
/* Summary Table Styling */
.custom-summary-table th {
  background-color: #1a1e21 !important;
  color: #adb5bd;
  font-weight: 600;
  font-size: 0.82rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-color: #373b3e;
}
.custom-summary-table td {
  border-color: #2c3034;
  font-size: 0.9rem;
}
.custom-summary-table tfoot td {
  background-color: #212529 !important;
  border-top: 2px solid #495057 !important;
  font-size: 0.92rem;
}

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
