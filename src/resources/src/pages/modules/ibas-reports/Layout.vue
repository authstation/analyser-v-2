<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    <main class="flex-grow-1 py-3">
      <div class="container-fluid px-0">
        
        <!-- Top Row: Back Button and Navigation Tabs -->
        <div class="mb-4 d-flex align-items-center justify-content-between d-print-none px-3">
          <!-- Left: Back Button -->
          <div style="min-width: 200px;">
            <router-link to="/modules/ibas-analysis" class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm">
              <i class="bi bi-arrow-left me-1"></i> Back to Analyser
            </router-link>
          </div>

          <!-- Center: Navigation Tabs Component -->
          <div>
            <AppTabs :tabs="ibasReportTabs" />
          </div>

          <!-- Right: Spacer for balance -->
          <div style="min-width: 200px;"></div>
        </div>

        <!-- Render Specific Report Content -->
        <div class="px-3">
          <router-view />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import AppTabs, { type TabItem } from '@/components/AppTabs.vue';

const ibasReportTabs: TabItem[] = [
  {
    id: 'dashboard',
    label: 'Analytical Dashboard',
    icon: 'bi bi-speedometer2',
    to: '/modules/ibas-reports/dashboard'
  },
  {
    id: 'by-office',
    label: 'VDS By Office',
    icon: 'bi bi-building',
    to: '/modules/ibas-reports/by-office'
  },
  {
    id: 'by-item',
    label: 'VDS By Item',
    icon: 'bi bi-tags',
    to: '/modules/ibas-reports/by-item'
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: 'bi bi-journal-text',
    to: '/modules/ibas-reports/summary'
  },
  {
    id: 'comparison',
    label: 'Comparison',
    icon: 'bi bi-bar-chart-steps',
    to: '/modules/ibas-reports/comparison'
  }
];
</script>
