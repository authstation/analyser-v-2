<template>
  <div
    class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center"
    style="background: rgba(0, 0, 0, 0.85); z-index: 9999; backdrop-filter: blur(4px);"
  >
    <div class="spinner-border mb-3" :class="spinnerColorClass" style="width: 4rem; height: 4rem;" role="status">
      <span class="visually-hidden">{{ label }}</span>
    </div>
    <h3 class="fw-bold text-light mb-2">{{ label }} {{ progress }}%</h3>
    <div class="progress w-50 mt-3" style="height: 10px; background-color: #333;">
      <div class="progress-bar progress-bar-striped progress-bar-animated" :class="barColorClass" :style="{ width: progress + '%' }"></div>
    </div>
    <p class="text-muted text-center mt-3 w-50">
      <slot>Please wait. Do not close or refresh this page.</slot>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  label: string;
  progress: number;
  color?: "info" | "success" | "primary" | "warning" | "danger";
}>(), {
  color: "info",
});

const spinnerColorClass = computed(() => "text-" + props.color);
const barColorClass = computed(() => "bg-" + props.color);
</script>