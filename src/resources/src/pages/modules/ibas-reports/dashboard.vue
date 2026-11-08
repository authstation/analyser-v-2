<template>
  <div class="row g-4">
    <div class="col-12">
      <h3 class="fw-bold text-app mb-0">Analytical Dashboard</h3>
      <p class="text-muted">High level overview of iBAS++ VDS data.</p>
    </div>

    <!-- KPI Cards -->
    <div class="col-md-6 col-lg-4">
      <div class="card bg-surface border-custom h-100 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="text-muted mb-0">Total VDS Deducted</h6>
            <i class="bi bi-cash-coin fs-4 text-success"></i>
          </div>
          <h3 class="fw-bold text-app">{{ loading ? '...' : formatCurrency(dashboardData.totalVds) }}</h3>
        </div>
      </div>
    </div>

    <!-- Trend Chart / Table -->
    <div class="col-12 mt-4">
      <div class="card bg-surface border-custom h-100 shadow-sm">
        <div class="card-header bg-transparent border-custom">
          <h6 class="fw-bold text-app mb-0">VDS Collection Trend</h6>
        </div>
        <div class="card-body">
          <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-info"></div>
          </div>
          <div v-else-if="!dashboardData.trend || dashboardData.trend.length === 0" class="text-center py-5 text-muted">
            No data available for trend
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover table-sm align-middle mb-0">
              <thead>
                <tr class="text-muted border-bottom border-custom">
                  <th>Month</th>
                  <th class="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in dashboardData.trend" :key="t.month">
                  <td class="text-app fw-semibold">{{ t.month }}</td>
                  <td class="text-end text-app font-monospace fw-bold">{{ formatCurrency(t.total) }}</td>
                </tr>
              </tbody>
            </table>
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
const dashboardData = ref({
  totalVds: 0,
  trend: [] as any[]
});

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(val || 0);
};

onMounted(async () => {
  try {
    const res = await axios.get('/api/ibas/reports/dashboard');
    dashboardData.value = res.data;
  } catch (error) {
    console.error('Failed to load dashboard report:', error);
  } finally {
    loading.value = false;
  }
});
</script>
