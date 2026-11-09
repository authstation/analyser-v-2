<template>
  <div class="card bg-surface border-custom shadow-sm mb-4">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 class="mb-1 fw-bold text-secondary d-flex align-items-center">
            <i class="bi bi-files text-primary me-2"></i> Duplicate Entities
          </h4>
        </div>
      </div>

      <!-- Comprehensive Filters matching BIN List style -->
      <div class="card bg-surface border-custom mb-4 shadow-sm">
        <div class="card-body p-3">
          <!-- ROW 1: ISSUE FROM DATE, ISSUE TO DATE, ANALYSIS TYPE -->
          <div class="row g-3 align-items-end mb-2">
            <div class="col-12 col-md-4">
              <label class="form-label small text-muted mb-1 d-block">Analysis Type</label>
              <select v-model="analysisType" class="form-select form-select-sm bg-dark text-white border-secondary" style="height: 38px;">
                <option value="true_duplicate">🎯 True Duplicates (Similar Name)</option>
                <option value="same_tin">👤 Same Owner (Group by e-TIN)</option>
                <option value="same_mobile">📱 Shared Contact (Group by Mobile)</option>
              </select>
            </div>

            <div class="col-12 col-sm-6 col-md-4">
              <label class="form-label small text-muted mb-1 d-block">Issue From Date</label>
              <input
                type="date"
                class="form-control bg-dark text-light border-secondary shadow-none"
                style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
                v-model="fromIssueDate"
              />
            </div>

            <div class="col-12 col-sm-6 col-md-4">
              <label class="form-label small text-muted mb-1 d-block">Issue To Date</label>
              <input
                type="date"
                class="form-control bg-dark text-light border-secondary shadow-none"
                style="height: 38px; color-scheme: dark; background-color: #2b3035 !important; border-color: #495057;"
                v-model="toIssueDate"
                :min="fromIssueDate || undefined"
              />
            </div>
          </div>

          <!-- DIVIDER LINE -->
          <hr class="my-3 border-secondary" style="opacity: 0.35;" />

          <!-- ROW 2: ALL CIRCLES, ALL PS, ALL STATUSES, ALL REG. TYPES -->
          <div class="row g-3 align-items-end mb-2">
            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchCircles"
                :options="dataStore.availableCircles"
                placeholder="All Circles"
                all-label="All Circles"
                id-prefix="dup-circle"
                size="md"
              />
            </div>

            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchPoliceStations"
                :options="dataStore.availablePoliceStations"
                placeholder="All PS"
                all-label="All PS"
                id-prefix="dup-ps"
                size="md"
              />
            </div>

            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchStatuses"
                :options="statusOptions"
                placeholder="All Statuses"
                all-label="All Statuses"
                id-prefix="dup-status"
                size="md"
                :searchable="false"
              />
            </div>

            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchForced"
                :options="regTypeOptions"
                placeholder="All Reg. Types"
                all-label="All Reg. Types"
                id-prefix="dup-reg"
                size="md"
                :searchable="false"
              />
            </div>
          </div>

          <!-- ROW 3: ALL MAJOR AREAS, ALL MFG AREAS, ALL SERVICE AREAS, ACTIONS -->
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchMajorAreas"
                :options="uniqueMajorAreas"
                placeholder="All Major Areas"
                all-label="All Major Areas"
                id-prefix="dup-major"
                size="md"
              />
            </div>

            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchMfgAreas"
                :options="uniqueMfgAreas"
                placeholder="All Mfg Areas"
                all-label="All Mfg Areas"
                id-prefix="dup-mfg"
                size="md"
              />
            </div>

            <div class="col-12 col-md-3">
              <MultiSelectDropdown
                v-model="searchServiceAreas"
                :options="uniqueServiceAreas"
                placeholder="All Service Areas"
                all-label="All Service Areas"
                id-prefix="dup-svc"
                size="md"
              />
            </div>

            <div class="col-12 col-md-3 d-flex gap-2 align-items-stretch">
              <button
                class="btn btn-outline-secondary text-light shadow-sm flex-fill d-flex align-items-center justify-content-center"
                style="cursor: pointer; height: 38px; background-color: #212529; border-color: #495057;"
                @click="resetFilters"
                title="Reset Filters"
              >
                <i class="bi bi-arrow-counterclockwise fs-5"></i>
              </button>
              <button
                class="btn btn-primary shadow-sm flex-fill d-flex align-items-center justify-content-center gap-1"
                style="cursor: pointer; height: 38px;"
                @click="runAnalysis"
                :disabled="isAnalyzing"
                title="Run Analysis"
              >
                <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-play-fill fs-5"></i>
                <span class="d-none d-sm-inline">{{ isAnalyzing ? 'Analyzing...' : 'Run Analysis' }}</span>
              </button>
              <button
                v-if="hasRun && duplicateClusters.length > 0"
                class="btn btn-success shadow-sm flex-fill d-flex align-items-center justify-content-center gap-1"
                style="cursor: pointer; height: 38px;"
                @click="downloadExcel"
                title="Download Excel"
              >
                <i class="bi bi-download me-1"></i> Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- State: Analyzing (Full Page Overlay matching file upload style) -->
      <div 
        v-if="isAnalyzing" 
        class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center" 
        style="background: rgba(0, 0, 0, 0.85); z-index: 9999; backdrop-filter: blur(4px);"
      >
        <div class="spinner-border text-primary mb-3" style="width: 4rem; height: 4rem;" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <h3 class="fw-bold text-light mb-2">
          Analyzing Data... {{ progressPercent }}%
        </h3>
        <div class="progress w-50 mt-3" style="height: 10px; background-color: #333;">
          <div class="progress-bar bg-primary progress-bar-striped progress-bar-animated" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p class="text-muted text-center mt-3 w-50">
          Please wait while we find duplicate entities using database clustering. <br>
          For large datasets, this may take a few moments. Do not close or refresh this page.
        </p>
      </div>

      <!-- State: Results -->
      <div v-else-if="hasRun">
        <div v-if="duplicateClusters.length === 0" class="alert bg-success bg-opacity-10 text-success border border-success border-opacity-25 text-center p-4">
          <i class="bi bi-check-circle-fill fs-3 mb-2 d-block"></i>
          <strong>Excellent!</strong> No matching entities found for this analysis criteria.
        </div>
        <div v-else>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="badge" :class="analysisType === 'true_duplicate' ? 'bg-danger' : 'bg-primary'" style="padding: 0.6rem 1rem; font-size: 0.9rem;">
              <i class="bi me-1" :class="analysisType === 'true_duplicate' ? 'bi-exclamation-triangle-fill' : 'bi-people-fill'"></i>
              Found {{ duplicateClusters.length }} {{ analysisType === 'true_duplicate' ? 'Potential Duplicate Clusters' : 'Groups' }}
            </span>
            <small class="text-muted">
              Showing results for: 
              <span class="text-warning fw-semibold">
                {{ analysisType === 'true_duplicate' ? 'True Duplicates (Same TIN & Similar Name)' : (analysisType === 'same_tin' ? 'Same Owner (Grouped by e-TIN)' : 'Shared Contact (Grouped by Mobile)') }}
              </span>
            </small>
          </div>

          <!-- Groups -->
          <div v-for="(cluster, gIdx) in duplicateClusters" :key="cluster.id || gIdx" class="card bg-surface border-custom mb-4 shadow-sm">
            <div class="card-header bg-surface border-custom text-white fw-normal py-2 d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <span class="fw-bold">{{ cluster.reason || `Cluster #${gIdx + 1}` }}</span>
                <span class="badge" :class="analysisType === 'true_duplicate' ? 'bg-danger' : 'bg-info'">
                  {{ cluster.items.length }} matches
                </span>
              </div>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-dark table-hover table-bordered border-custom mb-0 text-nowrap" style="font-size: 0.85rem; table-layout: fixed;">
                  <thead class="table-dark bg-dark">
                    <tr class="fw-normal text-white">
                      <th class="fw-normal text-white" style="width: 4%">#</th>
                      <th class="fw-normal text-white" style="width: 11%">BIN</th>
                      <th class="fw-normal text-white" style="width: 10%">e-TIN</th>
                      <th class="fw-normal text-white" style="width: 18%">Entity Name</th>
                      <th class="fw-normal text-white" style="width: 10%">Mobile</th>
                      <th class="fw-normal text-white" style="width: 19%">Address</th>
                      <th class="fw-normal text-white" style="width: 14%">Major Area</th>
                      <th class="fw-normal text-white text-center" style="width: 7%">Reg. Type</th>
                      <th class="fw-normal text-white text-center" style="width: 7%">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, iIdx) in cluster.items" :key="item.id" class="align-middle" @click="goToSearchEntity(item.bin)" style="cursor: pointer;" title="Click to view full details">
                      <td class="text-muted">{{ iIdx + 1 }}</td>
                      <td class="fw-bold text-warning">{{ item.bin || '-' }}</td>
                      <td class="text-info">{{ item.eTin || '-' }}</td>
                      <td class="fw-bold text-truncate" style="max-width: 150px;" :title="item.entityName">{{ item.entityName || '-' }}</td>
                      <td>{{ item.mobile || '-' }}</td>
                      <td class="text-truncate" style="max-width: 180px;" :title="item.address">{{ item.address || '-' }}</td>
                      <td class="text-truncate text-muted" style="max-width: 140px;" :title="item.majorAreaOfEconomicActivity">{{ item.majorAreaOfEconomicActivity || '-' }}</td>
                      <td class="text-center">
                        <span class="badge" :class="item.forcedRegistration === 'Yes' ? 'bg-danger bg-opacity-75' : 'bg-primary bg-opacity-75'">
                          {{ item.forcedRegistration === 'Yes' ? 'Forced' : 'Regular' }}
                        </span>
                      </td>
                      <td class="text-center">
                        <span class="badge" :class="item.binStatus === 'Active' ? 'bg-success bg-opacity-75' : 'bg-secondary bg-opacity-75'">
                          {{ item.binStatus || 'Unknown' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <!-- State: Initial loaded -->
      <div v-else class="text-center p-5 border border-custom border-dashed rounded">
        <i class="bi bi-cpu text-muted" style="font-size: 3rem; opacity: 0.5;"></i>
        <p class="text-muted mt-3 mb-0">Dataset loaded with {{ dataStore.meta.total }} records.</p>
        <p class="text-muted">Click "Run Analysis" to start the duplicate detection process.</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useDataStore } from '@/stores/data';
import { useRouter } from 'vue-router';
import axios from '@/plugins/axios';
import { loadXLSX } from '@/utils/xlsx';

import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';

const dataStore = useDataStore();
const router = useRouter();

const isAnalyzing = ref(false);
const hasRun = ref(false);
const duplicateClusters = ref<any[]>([]);
const progressPercent = ref(0);
let progressInterval: any = null;

const analysisType = ref<'true_duplicate' | 'same_tin' | 'same_mobile'>('true_duplicate');
const fromIssueDate = ref('');
const toIssueDate = ref('');
const searchCircles = ref<(string | number)[]>([]);
const searchPoliceStations = ref<string[]>([]);
const searchStatuses = ref<string[]>(['Active']);
const statusOptions = ref<string[]>(['Active', 'Suspended']);
const searchForced = ref<string[]>([]);
const regTypeOptions = ref<string[]>(['Regular', 'Forced']);
const searchMajorAreas = ref<string[]>([]);
const searchMfgAreas = ref<string[]>([]);
const searchServiceAreas = ref<string[]>([]);

const uniqueMajorAreas = computed(() => dataStore.availableMajorAreas || []);
const uniqueMfgAreasBase = computed(() => dataStore.availableMfgAreas || []);
const uniqueServiceAreasBase = computed(() => dataStore.availableServiceAreas || []);
const areaRelations = computed(() => dataStore.areaRelations || []);

const uniqueMfgAreas = computed(() => {
  if (searchMajorAreas.value.length === 0) {
    return uniqueMfgAreasBase.value;
  }
  const validMfg = new Set<string>();
  for (const rel of areaRelations.value) {
    if (!rel.major || !rel.mfg) continue;
    const majors = rel.major.split(';').map((s: string) => s.trim());
    if (majors.some((m: string) => searchMajorAreas.value.includes(m))) {
      rel.mfg
        .split(';')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .forEach((m: string) => validMfg.add(m));
    }
  }
  return Array.from(validMfg).sort();
});

const uniqueServiceAreas = computed(() => {
  if (searchMajorAreas.value.length === 0) {
    return uniqueServiceAreasBase.value;
  }
  const validService = new Set<string>();
  for (const rel of areaRelations.value) {
    if (!rel.major || !rel.service) continue;
    const majors = rel.major.split(';').map((s: string) => s.trim());
    if (majors.some((m: string) => searchMajorAreas.value.includes(m))) {
      rel.service
        .split(';')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .forEach((s: string) => validService.add(s));
    }
  }
  return Array.from(validService).sort();
});

watch(searchMajorAreas, () => {
  const validMfg = new Set(uniqueMfgAreas.value);
  searchMfgAreas.value = searchMfgAreas.value.filter(m => validMfg.has(m));

  const validService = new Set(uniqueServiceAreas.value);
  searchServiceAreas.value = searchServiceAreas.value.filter(s => validService.has(s));
}, { deep: true });

const resetFilters = () => {
  analysisType.value = 'true_duplicate';
  fromIssueDate.value = '';
  toIssueDate.value = '';
  searchCircles.value = [];
  searchPoliceStations.value = [];
  searchStatuses.value = ['Active'];
  searchForced.value = [];
  searchMajorAreas.value = [];
  searchMfgAreas.value = [];
  searchServiceAreas.value = [];
};

onMounted(() => {
  dataStore.fetchFilters();
});

watch(searchCircles, (newCircles) => {
  dataStore.fetchFilters(newCircles.join(','));
  searchPoliceStations.value = [];
});

// Download to Excel
const downloadExcel = async () => {
  if (duplicateClusters.value.length === 0) return;
  const XLSX = await loadXLSX();
  
  const exportData: any[] = [];
  
  duplicateClusters.value.forEach((cluster, index) => {
    cluster.items.forEach((item: any) => {
      exportData.push({
        'Cluster / Reason': cluster.reason || `Cluster ${index + 1}`,
        'BIN': item.bin || '',
        'e-TIN': item.eTin || '',
        'Entity Name': item.entityName || '',
        'Mobile Number': item.mobile || '',
        'Address': item.address || '',
        'Major Area': item.majorAreaOfEconomicActivity || '',
        'Reg. Type': item.forcedRegistration === 'Yes' ? 'Forced' : 'Regular',
        'Status': item.binStatus || ''
      });
    });
    // Empty row separator
    exportData.push({});
  });
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Duplicate Entities');
  
  const wscols = [
    { wch: 35 }, // Cluster / Reason
    { wch: 18 }, // BIN
    { wch: 15 }, // e-TIN
    { wch: 40 }, // Name
    { wch: 15 }, // Mobile
    { wch: 60 }, // Address
    { wch: 30 }, // Major Area
    { wch: 12 }, // Reg. Type
    { wch: 12 }  // Status
  ];
  worksheet['!cols'] = wscols;
  
  XLSX.writeFile(workbook, `Entities_Analysis_${analysisType.value}.xlsx`);
};

const runAnalysis = async () => {
  isAnalyzing.value = true;
  hasRun.value = false;
  duplicateClusters.value = [];
  progressPercent.value = 0;

  // Simulate progress
  progressInterval = setInterval(() => {
    if (progressPercent.value < 95) {
      progressPercent.value += Math.floor(Math.random() * 15) + 5;
      if (progressPercent.value > 95) progressPercent.value = 95;
    }
  }, 300);

  try {
    const queryParams = new URLSearchParams();
    queryParams.append('type', analysisType.value);
    if (fromIssueDate.value) queryParams.append('fromIssueDate', fromIssueDate.value);
    if (toIssueDate.value) queryParams.append('toIssueDate', toIssueDate.value);
    if (searchCircles.value.length > 0) queryParams.append('circle', searchCircles.value.join(','));
    if (searchPoliceStations.value.length > 0) queryParams.append('policeStations', searchPoliceStations.value.join(','));
    if (searchStatuses.value.length > 0) queryParams.append('status', searchStatuses.value.join(','));
    if (searchForced.value.length > 0) queryParams.append('forcedRegistration', searchForced.value.join(','));
    if (searchMajorAreas.value.length > 0) queryParams.append('majorArea', searchMajorAreas.value.join('|||'));
    if (searchMfgAreas.value.length > 0) queryParams.append('manufacturingArea', searchMfgAreas.value.join('|||'));
    if (searchServiceAreas.value.length > 0) queryParams.append('serviceArea', searchServiceAreas.value.join('|||'));
    
    const response = await axios.get(`/api/bin-analyser/duplicates?${queryParams.toString()}`);
    
    if (response.data && response.data.data) {
      duplicateClusters.value = response.data.data;
    }
    
    progressPercent.value = 100;
    setTimeout(() => {
      hasRun.value = true;
      isAnalyzing.value = false;
    }, 400);
  } catch (error) {
    console.error('Failed to run duplicate analysis', error);
    isAnalyzing.value = false;
  } finally {
    clearInterval(progressInterval);
  }
};

const goToSearchEntity = (bin: string) => {
  if (!bin) return;
  const routeData = router.resolve({ name: 'bin-search-entity', query: { q: bin } });
  window.open(routeData.href, '_blank');
};
</script>

<style scoped>
.border-dashed {
  border-style: dashed !important;
  border-width: 2px !important;
}
</style>


