<template>
  <div class="app-logo d-flex align-items-center gap-2" style="cursor: pointer;" :class="{ 'flex-column text-center': stacked }">
    <!-- Analyzer Image Icon Container -->
    <div 
      class="d-flex align-items-center justify-content-center overflow-hidden logo-icon-wrap" 
      :style="{ width: `calc(${iconSize} * 1.6)`, height: `calc(${iconSize} * 1.6)` }"
    >
      <img src="@/assets/images/analyser-icon.jpg" alt="Analyser Icon" class="w-100 h-100 object-fit-contain logo-img" />
    </div>

    <!-- Text Container -->
    <div class="d-flex flex-column justify-content-center logo-text-group" :class="{ 'align-items-center': stacked, 'align-items-start': !stacked }">
      <span class="fw-bolder lh-1 logo-brand" :style="{ fontSize: `calc(${textSize} * 1.15)` }">
        ANALYSER
      </span>
      <span class="fw-semibold text-uppercase logo-tagline" :style="{ fontSize: `calc(${textSize} * 0.48)`, letterSpacing: '1px', marginTop: '3px' }">
        INTELLIGENT DATA INSIGHTS
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  iconSize?: string;
  textSize?: string;
  stacked?: boolean;
}>(), {
  iconSize: '1.5rem',
  textSize: '1.1rem',
  stacked: false
});
</script>

<style scoped lang="scss">
.logo-brand {
  color: var(--app-text, #ffffff);
  transition: color 0.2s ease;
}

.logo-tagline {
  color: var(--app-text-muted, #9aa0a6);
  transition: color 0.2s ease;
}

.logo-icon-wrap {
  border-radius: 8px;
}

.theme-dark .logo-img,
body.theme-dark .logo-img {
  filter: grayscale(1) contrast(50) invert(1) brightness(1.5);
  transform: scale(1.4);
  mix-blend-mode: screen;
}

.theme-light .logo-img,
body.theme-light .logo-img {
  filter: contrast(120%);
  transform: scale(1.2);
  mix-blend-mode: multiply;
}


</style>
