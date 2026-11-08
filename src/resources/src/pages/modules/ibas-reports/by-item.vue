<template>
  <div class="row g-4">
    <div class="col-12">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h3 class="fw-bold text-app mb-0">VDS Report By Item</h3>
          <p class="text-muted">Total VDS deducted grouped by items.</p>
        </div>
        <button class="btn btn-outline-info btn-sm" @click="fetchData" :disabled="loading">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>
    </div>

    <div class="col-12">
      <div class="card bg-surface border-custom shadow-sm">
        <div class="card-body p-0">
          <div v-if="loading" class="text-center py-5">
            <div class="spinner-border text-info"></div>
          </div>
          <div v-else-if="records.length === 0" class="text-center py-5 text-muted">
            No data available.
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover table-sm align-middle mb-0">
              <thead class="bg-surface border-bottom border-custom">
                <tr class="text-muted">
                  <th class="text-center" style="width: 60px;">#</th>
                  <th>Item Name</th>
                  <th class="text-end">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(record, index) in records" :key="index">
                  <td class="text-center text-muted">{{ index + 1 }}</td>
                  <td class="text-app fw-medium">{{ record.item }}</td>
                  <td class="text-end font-monospace text-app fw-bold">{{ formatCurrency(record.total) }}</td>
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
const records = ref<any[]>([]);

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(val || 0);
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/ibas/reports/by-item');
    records.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.error('Failed to load by-item report:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>
