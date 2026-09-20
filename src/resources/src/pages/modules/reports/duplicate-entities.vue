<template>
  <div class="card bg-surface border-custom shadow-sm mb-4">
    <div class="card-body p-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1 fw-bold text-secondary d-flex align-items-center">
            <i class="bi bi-files text-primary me-2"></i> Duplicate Entities
          </h4>
        </div>
        <div class="d-flex align-items-center gap-3">
          <!-- Circle Filter -->
          <div style="min-width: 200px; max-width: 250px;">
            <MultiSelectDropdown
              v-model="searchCircles"
              :options="dataStore.availableCircles"
              all-label="All Circles"
              placeholder="All Circles"
              id-prefix="dup-circle"
            />
          </div>
          
          <!-- Police Station Filter -->
          <div style="min-width: 200px; max-width: 250px;">
            <MultiSelectDropdown
              v-model="searchPoliceStations"
              :options="dataStore.availablePoliceStations"
              all-label="All Police Stations"
              placeholder="All Police Stations"
              id-prefix="dup-ps"
            />
          </div>

          <button @click="runAnalysis" class="btn btn-sm btn-primary text-nowrap d-flex align-items-center gap-1" :disabled="isAnalyzing" style="height: 31px;">
            <span v-if="isAnalyzing" class="spinner-border spinner-border-sm me-1"></span>
            <i v-else class="bi bi-play-fill me-1"></i>
            {{ isAnalyzing ? 'Analyzing...' : 'Run Analysis' }}
          </button>

          <button 
            v-if="hasRun && duplicateGroups.length > 0" 
            class="btn btn-outline-success btn-sm text-nowrap d-flex align-items-center gap-1" 
            @click="downloadExcel" 
            style="height: 31px;"
          >
            <i class="bi bi-download me-1"></i> Excel
          </button>
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
        <div v-if="duplicateGroups.length === 0" class="alert bg-success bg-opacity-10 text-success border border-success border-opacity-25 text-center p-4">
          <i class="bi bi-check-circle-fill fs-3 mb-2 d-block"></i>
          <strong>Excellent!</strong> No duplicate entities found in the dataset.
        </div>
        <div v-else>
          <div class="d-flex justify-content-start mb-3">
            <span class="badge bg-danger px-3 py-2 fs-6">
              Found {{ duplicateGroups.length }} Duplicate Groups
            </span>
          </div>

          <!-- Groups -->
          <div v-for="(group, gIdx) in duplicateGroups" :key="gIdx" class="card bg-surface border-custom mb-4 shadow-sm">
            <div class="card-header bg-surface border-custom text-white fw-normal py-2 d-flex align-items-center">
              <span>Cluster #{{ gIdx + 1 }}</span>
              <span class="badge bg-danger ms-2">{{ group.length }} matches</span>
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
                    <tr v-for="(item, iIdx) in group" :key="item.id" class="align-middle" @click="goToSearchEntity(item.bin)" style="cursor: pointer;" title="Click to view full details">
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
import * as XLSX from 'xlsx';

import MultiSelectDropdown from '@/components/common/MultiSelectDropdown.vue';

const dataStore = useDataStore();
const router = useRouter();

const isAnalyzing = ref(false);
const hasRun = ref(false);
const duplicateGroups = ref<any[][]>([]);
const progressPercent = ref(0);
let progressInterval: any = null;

const searchCircles = ref<string[]>([]);
const searchPoliceStations = ref<string[]>([]);

onMounted(() => {
  dataStore.fetchFilters();
});

watch(searchCircles, (newCircles) => {
  dataStore.fetchFilters(newCircles.join(','));
  searchPoliceStations.value = [];
});


// Download to Excel
const downloadExcel = () => {
  if (duplicateGroups.value.length === 0) return;
  
  const exportData: any[] = [];
  
  duplicateGroups.value.forEach((group, index) => {
    group.forEach((item: any) => {
      exportData.push({
        'Group ID': `Cluster ${index + 1}`,
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
    { wch: 12 }, // Group ID
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
  
  XLSX.writeFile(workbook, 'Duplicate_Entities_Report.xlsx');
};

const runAnalysis = async () => {
  isAnalyzing.value = true;
  hasRun.value = false;
  duplicateGroups.value = [];
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
    if (searchCircles.value.length > 0) queryParams.append('circle', searchCircles.value.join(','));
    if (searchPoliceStations.value.length > 0) queryParams.append('policeStations', searchPoliceStations.value.join(','));
    const token = localStorage.getItem('token') || '';
    const response = await axios.get(`/api/bin-analyser/duplicates?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // API returns array of { id, items, reason }
    if (response.data && response.data.data) {
      duplicateGroups.value = response.data.data.map((cluster: any) => cluster.items);
    }
    
    progressPercent.value = 100;
    setTimeout(() => {
      hasRun.value = true;
      isAnalyzing.value = false;
    }, 400); // short delay to show 100%
  } catch (error) {
    console.error('Failed to run duplicate analysis', error);
    isAnalyzing.value = false;
  } finally {
    clearInterval(progressInterval);
  }
};

const goToSearchEntity = (bin: string) => {
  if (!bin) return;
  const routeData = router.resolve({ name: 'SearchEntity', query: { q: bin } });
  window.open(routeData.href, '_blank');
};
</script>

<style scoped>
.border-dashed {
  border-style: dashed !important;
  border-width: 2px !important;
}
</style>


