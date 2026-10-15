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
            :checked="isAllSelected"
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
            :checked="isItemChecked(item.value)"
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
import { ref, computed, onMounted, onBeforeUnmount, watch, toRaw } from 'vue';

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

// The app's filter contract uses an empty array to mean "All / no filter", so an
// empty `modelValue` normally renders as "All selected". This flag lets us tell an
// *explicitly cleared* selection (user unchecked "All") apart from that canonical
// "All" value. It is reset whenever the parent assigns a new array.
const explicitlyCleared = ref(false);
let lastEmittedValue: (string | number)[] | null = null;

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

const allOptionValues = computed<(string | number)[]>(() =>
  normalizedOptions.value.map(opt => opt.value)
);

const allValuesSelected = computed(() => {
  const values = allOptionValues.value;
  return values.length > 0 && values.every(v => props.modelValue.includes(v));
});

// "All" is the canonical selection when the model is empty. When `showAllOption`
// is disabled (e.g. the register form), an empty model simply means "nothing
// selected" and no "All" row is rendered, so the canonical rule does not apply.
const isAllSelected = computed(() => {
  if (!props.showAllOption) return allValuesSelected.value;
  if (explicitlyCleared.value && props.modelValue.length === 0) return false;
  return props.modelValue.length === 0 || allValuesSelected.value;
});

const isItemChecked = (val: string | number) => {
  // While "All" is active every option is shown as checked, even though the
  // model itself stays empty.
  if (props.showAllOption && props.modelValue.length === 0) {
    return !explicitlyCleared.value;
  }
  return props.modelValue.includes(val);
};

const emitValue = (val: (string | number)[]) => {
  lastEmittedValue = val;
  emit('update:modelValue', val);
  emit('change', val);
};

// Any value assigned by the parent (other than the one we just emitted) is an
// external change, so drop the "explicitly cleared" state. `toRaw` unwraps Vue's
// reactive proxy, so an array we emitted is still recognised as our own value
// after the parent stores it in a reactive ref.
watch(
  () => props.modelValue,
  val => {
    if (toRaw(val) !== lastEmittedValue) explicitlyCleared.value = false;
  }
);

const buttonText = computed(() => {
  if (props.modelValue.length === 0 || (props.showAllOption && isAllSelected.value)) {
    return props.showAllOption ? (props.allLabel || props.placeholder) : props.placeholder;
  }
  if (props.modelValue.length === 1) {
    const found = normalizedOptions.value.find(o => o.value === props.modelValue[0]);
    return found ? found.label : `${props.modelValue.length} Selected`;
  }
  return `${props.modelValue.length} Selected`;
});

const handleSelectAll = () => {
  // Toggling "All" off clears the selection; toggling it on selects everything.
  // Both are emitted as the canonical empty array so backend filters keep working.
  explicitlyCleared.value = isAllSelected.value;
  emitValue([]);
};

const handleToggle = (val: string | number) => {
  const wasCleared = explicitlyCleared.value;
  explicitlyCleared.value = false;

  const allValues = allOptionValues.value;
  let next: (string | number)[];

  if (props.showAllOption && props.modelValue.length === 0 && !wasCleared) {
    // Model is the canonical "All", so materialize the full list minus the
    // item that was just unchecked (the remaining items stay checked).
    next = allValues.filter(v => v !== val);
  } else if (props.modelValue.length === 0) {
    // Model is explicitly empty ("none", or `showAllOption` is off), so start a
    // fresh selection with the clicked item.
    next = [val];
  } else {
    next = [...props.modelValue];
    const idx = next.indexOf(val);
    if (idx > -1) next.splice(idx, 1);
    else next.push(val);
  }

  if (next.length === 0) {
    // Nothing left selected: keep the empty payload but render "none" instead of "All".
    explicitlyCleared.value = true;
    emitValue([]);
    return;
  }

  // Collapse a full selection back to the canonical "All" value ([]).
  // Only valid when "All" is an option; otherwise an empty array means "none".
  if (props.showAllOption && allValues.length > 0 && allValues.every(v => next.includes(v))) {
    next = [];
  }

  emitValue(next);
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
