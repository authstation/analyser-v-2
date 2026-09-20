<template>
  <div class="overflow-x-auto" style="scrollbar-width: none; -ms-overflow-style: none;">
    <div class="border border-secondary rounded-3 p-1 shadow-sm d-inline-flex gap-1 text-nowrap" style="background-color: transparent;">
      <template v-for="tab in tabs" :key="tab.id">
        <!-- Route Link Tab -->
        <router-link 
          v-if="tab.to"
          :to="tab.to" 
          class="btn btn-sm rounded-2 px-3 py-1 fw-semibold transition-all border-0"
          :class="isActiveRoute(tab.to) ? 'bg-secondary shadow text-dark' : 'btn-link text-muted text-decoration-none'"
        >
          <i v-if="tab.icon" :class="tab.icon + ' me-2'"></i>{{ tab.label }}
        </router-link>

        <!-- Button Tab (State Based) -->
        <button 
          v-else
          class="btn btn-sm rounded-2 px-3 py-1 fw-semibold transition-all border-0"
          :class="modelValue === tab.id ? 'bg-secondary shadow text-dark' : 'btn-link text-muted text-decoration-none'"
          @click="handleTabClick(tab)"
        >
          <i v-if="tab.icon" :class="tab.icon + ' me-2'"></i>{{ tab.label }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  to?: string;
  onClick?: () => void;
}

const props = defineProps<{
  tabs: TabItem[];
  modelValue?: string;
}>();

const emit = defineEmits(['update:modelValue']);

const $route = useRoute();

const isActiveRoute = (to: string) => {
  return $route.path.includes(to);
};

const handleTabClick = (tab: TabItem) => {
  emit('update:modelValue', tab.id);
  if (tab.onClick) {
    tab.onClick();
  }
};
</script>

<style scoped>
.btn-link:hover:not(.bg-secondary) {
  color: #ffc107 !important;
}
</style>
