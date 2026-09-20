<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    <main class="flex-grow-1" :class="isDetailsView ? 'pt-2 pb-4' : 'py-3'">
      <div class="container-fluid px-0">
        <!-- Top Row: Title, Tabs, and Back Button (All in one line) -->
        <div class="mb-4 d-flex align-items-center justify-content-between d-print-none" v-if="!isDetailsView">
          <!-- Left: Back Button -->
          <div style="min-width: 200px;">
            <router-link to="/modules/return-data-analyser" class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm">
              <i class="bi bi-arrow-left me-1"></i> Back
            </router-link>
          </div>

          <!-- Center: Navigation Tabs Component -->
          <div>
            <AppTabs :tabs="reportTabs" />
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

const reportTabs: TabItem[] = [
  {
    id: 'dashboard',
    label: 'Analytical Dashboard',
    icon: 'bi bi-speedometer2',
    to: '/modules/return-data-reports/dashboard'
  },
  {
    id: 'return-list',
    label: 'Return List',
    icon: 'bi bi-list-ul',
    to: '/modules/return-data-reports/return-list'
  },
  {
    id: 'search-by-bin',
    label: 'Search By BIN',
    icon: 'bi bi-file-earmark-text',
    to: '/modules/return-data-reports/search-by-bin'
  },
  {
    id: 'non-filer-list',
    label: 'Non Filer List',
    icon: 'bi bi-person-x',
    to: '/modules/return-data-reports/non-filer-list'
  }
];

const isDetailsView = computed(() => {
  return ['return-fy-comparison', 'return-year-comparison', 'return-entity-drilldown', 'return-entity-details-report'].includes($route.name as string) || ($route.name === 'return-search-by-bin' && $route.query.fromList === 'true');
});
</script>
