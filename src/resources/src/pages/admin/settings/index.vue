<template>
  <Pagebar title="Global Settings" />

  <main class="flex-grow-1 p-4">
    <div class="container-fluid mb-5">
      <!-- Top Row: Back Button and Navigation Tabs -->
      <div class="mb-4 d-flex align-items-center">
        <!-- Left: Back Button -->
        <div class="me-3">
          <router-link to="/dashboard" class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm text-nowrap">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
        </div>

        <!-- Center: Navigation Tabs Component -->
        <div class="flex-grow-1 overflow-hidden">
          <AppTabs :tabs="settingTabs" v-model="activeTab" />
        </div>
      </div>

      <div class="card bg-surface border-custom shadow-sm flex-grow-1 overflow-hidden d-flex flex-column">
        <!-- 1. Divisions Tab -->
        <DivisionSettingsTab v-if="activeTab === 'divisions'" />

        <!-- 2. Circles Tab -->
        <CircleSettingsTab v-if="activeTab === 'circles'" />

        <!-- 3. Penalties Tab -->
        <PenaltyRulesTab v-if="activeTab === 'penalties'" />

        <!-- 4. Security / Validation Limits Tab -->
        <ValidationLimitsTab v-if="activeTab === 'security'" />

        <!-- 5. Column Mappings Tab -->
        <ColumnMappingsTab v-if="activeTab === 'mappings'" />

        <!-- 6. Standardized Item Mappings Tab -->
        <ItemMappingsTab v-if="activeTab === 'item_mapping'" />

        <!-- 7. Offices & Areas Tab -->
        <IbasOfficesTab v-if="activeTab === 'offices'" />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import AppTabs from '@/components/AppTabs.vue';
import DivisionSettingsTab from './components/DivisionSettingsTab.vue';
import CircleSettingsTab from './components/CircleSettingsTab.vue';
import PenaltyRulesTab from './components/PenaltyRulesTab.vue';
import ValidationLimitsTab from './components/ValidationLimitsTab.vue';
import ColumnMappingsTab from './components/ColumnMappingsTab.vue';
import ItemMappingsTab from './components/ItemMappingsTab.vue';
import IbasOfficesTab from './components/IbasOfficesTab.vue';

useHead({ title: 'Global Settings | Admin' });

const activeTab = ref('divisions');

const settingTabs = computed(() => [
  { id: 'divisions', label: 'Divisions', icon: 'bi-map' },
  { id: 'circles', label: 'Circles', icon: 'bi-geo-alt' },
  { id: 'penalties', label: 'Fines', icon: 'bi-exclamation-triangle' },
  { id: 'security', label: 'Limits', icon: 'bi-shield-lock' },
  { id: 'mappings', label: 'Column Mappings', icon: 'bi-layout-text-window-reverse' },
  { id: 'item_mapping', label: 'Item Mappings', icon: 'bi-diagram-3' },
  { id: 'offices', label: 'Offices & Areas', icon: 'bi-building' }
]);
</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
</style>
