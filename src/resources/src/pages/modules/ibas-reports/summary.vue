<template>
  <div class="row g-4">
    <div class="col-12">
      <h3 class="fw-bold text-app mb-0">Summary</h3>
      <p class="text-muted">General summary of the iBAS++ dataset.</p>
    </div>

    <div class="col-12">
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-info"></div>
      </div>
      <div v-else class="row g-4">
        <!-- Records KPI -->
        <div class="col-md-3">
          <div class="card bg-surface border-custom h-100 shadow-sm">
            <div class="card-body text-center p-4">
              <i class="bi bi-file-earmark-text text-primary fs-1 mb-2 d-block"></i>
              <h4 class="text-app fw-bold">{{ summary.totalRecords.toLocaleString() }}</h4>
              <p class="text-muted mb-0 small">Total Records</p>
            </div>
          </div>
        </div>

        <!-- Offices KPI -->
        <div class="col-md-3">
          <div class="card bg-surface border-custom h-100 shadow-sm">
            <div class="card-body text-center p-4">
              <i class="bi bi-building text-info fs-1 mb-2 d-block"></i>
              <h4 class="text-app fw-bold">{{ summary.totalOffices.toLocaleString() }}</h4>
              <p class="text-muted mb-0 small">Unique Offices</p>
            </div>
          </div>
        </div>

        <!-- Items KPI -->
        <div class="col-md-3">
          <div class="card bg-surface border-custom h-100 shadow-sm">
            <div class="card-body text-center p-4">
              <i class="bi bi-tags text-success fs-1 mb-2 d-block"></i>
              <h4 class="text-app fw-bold">{{ summary.totalItems.toLocaleString() }}</h4>
              <p class="text-muted mb-0 small">Unique Items</p>
            </div>
          </div>
        </div>

        <!-- Date Range KPI -->
        <div class="col-md-3">
          <div class="card bg-surface border-custom h-100 shadow-sm">
            <div class="card-body text-center p-4">
              <i class="bi bi-calendar-range text-warning fs-1 mb-2 d-block"></i>
              <h5 class="text-app fw-bold mb-0" style="font-size: 0.95rem;">
                {{ summary.minDate ? new Date(summary.minDate).toLocaleDateString() : 'N/A' }} <br>
                <small class="text-muted">to</small> <br>
                {{ summary.maxDate ? new Date(summary.maxDate).toLocaleDateString() : 'N/A' }}
              </h5>
              <p class="text-muted mb-0 small mt-2">Data Timeframe</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from '@/plugins/axios';

const loading = ref(true);
const summary = ref({
  totalRecords: 0,
  totalOffices: 0,
  totalItems: 0,
  minDate: null,
  maxDate: null
});

onMounted(async () => {
  try {
    const res = await axios.get('/api/ibas/reports/summary');
    summary.value = res.data;
  } catch (error) {
    console.error('Failed to load summary report:', error);
  } finally {
    loading.value = false;
  }
});
</script>
