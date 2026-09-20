<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    <main class="flex-grow-1" :class="isDetailsView ? 'pt-2 pb-4' : 'py-3'">
      <div class="container-fluid px-0">
        
        <!-- Top Row: Back Button and Navigation Tabs -->
        <div class="mb-4 d-flex align-items-center justify-content-between d-print-none" v-if="!isDetailsView">
          <!-- Left: Back Button -->
          <div style="min-width: 200px;">
            <router-link to="/modules/bin-analyser" class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm">
              <i class="bi bi-arrow-left me-1"></i> Back
            </router-link>
          </div>

          <!-- Center: Navigation Tabs Component -->
          <div>
            <AppTabs :tabs="binReportTabs" />
          </div>

          <!-- Right: Spacer for balance -->
          <div style="min-width: 200px;"></div>
        </div>

        <!-- Render Specific Report Content -->
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppTabs, { type TabItem } from '@/components/AppTabs.vue';

const $route = useRoute();

const binReportTabs: TabItem[] = [
  {
    id: 'dashboard',
    label: 'Analytical Dashboard',
    icon: 'bi bi-speedometer2',
    to: '/modules/reports/dashboard'
  },
  {
    id: 'bin-list',
    label: 'BIN List',
    icon: 'bi bi-list-columns-reverse',
    to: '/modules/reports/bin-list'
  },
  {
    id: 'duplicate-entities',
    label: 'Duplicate Entities',
    icon: 'bi bi-files',
    to: '/modules/reports/duplicate-entities'
  },
  {
    id: 'search-entity',
    label: 'Search Entity',
    icon: 'bi bi-search',
    to: '/modules/reports/search-entity'
  }
];

const isDetailsView = computed(() => {
  return $route.path.includes('/chart-details') || 
         $route.path.includes('/comparison') || 
         ($route.path.includes('/bin-list') && $route.query.readonly === 'true');
});
</script>
