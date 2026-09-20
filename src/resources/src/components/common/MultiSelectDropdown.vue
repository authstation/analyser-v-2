<template>
  <div class="dropdown position-relative" ref="dropdownContainer" :style="width ? { width } : {}">
    <label v-if="label" class="form-label small text-muted mb-1">{{ label }}</label>
    <button
      class="form-control text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center shadow-none"
      :class="[size === 'sm' ? 'form-control-sm' : '', isOpen ? 'show' : '']"
      :style="size === 'sm' ? { height: '31px' } : { height: '38px' }"
      type="button"
      :aria-expanded="isOpen"
      :disabled="disabled"
      @click="toggleDropdown"
    >
      <span class="text-truncate">{{ buttonText }}</span>
    </button>
    <div 
      class="dropdown-menu w-100 p-2 shadow border" 
      :class="{ show: isOpen }"
      @click.stop
      style="min-width: 250px; position: absolute; top: 100%; left: 0; margin-top: 4px; z-index: 1080;"
    >
      <input
        v-if="searchable"
        type="text"
        class="form-control form-control-sm mb-2 shadow-none"
        :placeholder="searchPlaceholder"
        v-model="searchText"
      >
      <div :style="{ maxHeight, overflowY: 'auto' }">
        <div v-if="showAllOption" class="form-check mb-1 ms-3">
          <input
            class="form-check-input"
            type="checkbox"
            :id="allId"
            :checked="modelValue.length === 0"
            @change="handleSelectAll"
          >
          <label class="form-check-label" :for="allId">{{ allLabel }}</label>
        </div>
        <div
          class="form-check mb-1 ms-3"
          v-for="item in filteredOptions"
          :key="String(item.value)"
        >
          <input
            class="form-check-input"
            type="checkbox"
            :value="item.value"
            :id="getItemId(item.value)"
            :checked="modelValue.includes(item.value)"
            @change="handleToggle(item.value)"
          >
          <label class="form-check-label" :for="getItemId(item.value)">{{ item.label }}</label>
        </div>
        <div v-if="filteredOptions.length === 0" class="text-muted small px-3 py-1">
          No options found
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

export interface DropdownOption {
  label: string;
  value: string | number;
}

interface Props {
  modelValue: (string | number)[];
  options: (string | number | DropdownOption)[];
  placeholder?: string;
  allLabel?: string;
  label?: string;
  idPrefix?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  maxHeight?: string;
  width?: string;
  showAllOption?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  options: () => [],
  placeholder: 'All',
  allLabel: 'All',
  idPrefix: () => 'msd-' + Math.random().toString(36).substring(2, 7),
  searchable: true,
  searchPlaceholder: 'Type to search...',
  size: 'sm',
  disabled: false,
  maxHeight: '200px',
  showAllOption: true,
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: (string | number)[]): void;
  (e: 'change', val: (string | number)[]): void;
}>();

const isOpen = ref(false);
const dropdownContainer = ref<HTMLElement | null>(null);
const searchText = ref('');

const allId = computed(() => `${props.idPrefix}-all`);

const getItemId = (val: string | number) => {
  return `${props.idPrefix}-${String(val).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
};

const toggleDropdown = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownContainer.value && !dropdownContainer.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const normalizedOptions = computed<DropdownOption[]>(() => {
  return props.options.map(opt => {
    if (typeof opt === 'object' && opt !== null && 'label' in opt && 'value' in opt) {
      return opt as DropdownOption;
    }
    return { label: String(opt), value: opt };
  });
});

const filteredOptions = computed<DropdownOption[]>(() => {
  if (!searchText.value.trim()) return normalizedOptions.value;
  const term = searchText.value.toLowerCase().trim();
  return normalizedOptions.value.filter(opt =>
    opt.label.toLowerCase().includes(term)
  );
});

const buttonText = computed(() => {
  if (props.modelValue.length === 0) {
    return props.showAllOption ? (props.allLabel || props.placeholder) : props.placeholder;
  }
  if (props.modelValue.length === 1) {
    const found = normalizedOptions.value.find(o => o.value === props.modelValue[0]);
    return found ? found.label : `${props.modelValue.length} Selected`;
  }
  return `${props.modelValue.length} Selected`;
});

const handleSelectAll = () => {
  emit('update:modelValue', []);
  emit('change', []);
};

const handleToggle = (val: string | number) => {
  const current = [...props.modelValue];
  const idx = current.indexOf(val);
  if (idx > -1) {
    current.splice(idx, 1);
  } else {
    current.push(val);
  }
  emit('update:modelValue', current);
  emit('change', current);
};
</script>

<style scoped>
.dropdown-menu {
  z-index: 1080 !important;
  background-color: var(--app-surface, #fff) !important;
}
.form-check-input {
  cursor: pointer;
}
.form-check-label {
  cursor: pointer;
}
</style>
