<template>
  <div
    class="input-group search-input-group"
    :class="[size === 'sm' ? 'search-input-group-sm' : '']"
    :style="{ width: width || '270px' }"
  >
    <span class="input-group-text text-info">
      <i class="bi bi-search"></i>
    </span>
    <input
      type="text"
      class="form-control text-light shadow-none"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keyup.enter="$emit('search')"
    />
    <button
      v-if="clearable && modelValue"
      class="btn btn-link text-muted p-0 pe-2 text-decoration-none shadow-none"
      type="button"
      @click="$emit('update:modelValue', ''); $emit('clear')"
      title="Clear"
    >
      <i class="bi bi-x-lg small"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string;
  placeholder?: string;
  width?: string;
  size?: 'sm' | 'md';
  clearable?: boolean;
}>(), {
  modelValue: '',
  placeholder: 'Search BIN, Entity, Mobile...',
  width: '270px',
  size: 'sm',
  clearable: false
});

defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'search'): void;
  (e: 'clear'): void;
}>();
</script>
