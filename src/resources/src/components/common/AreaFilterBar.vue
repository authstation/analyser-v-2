<template>
  <div :class="containerClass">
    <!-- Circle Dropdown -->
    <div :class="itemClass" style="min-width: 200px;">
      <label class="form-label text-muted small fw-bold mb-1">
        <i class="bi bi-funnel-fill me-1"></i>Filter by Circle
      </label>
      <div class="dropdown">
        <button
          :class="['form-control bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center', compact ? 'form-control-sm' : '']"
          type="button"
          v-bs-dropdown
          data-bs-toggle="dropdown"
          data-bs-auto-close="outside"
          aria-expanded="false"
        >
          <span class="text-truncate">{{ circleIds.length > 0 ? circleIds.length + ' Selected' : 'All Circles' }}</span>
        </button>
        <div class="dropdown-menu dropdown-menu-dark bg-dark w-100 p-2 border-secondary shadow" @click.stop>
          <input
            type="text"
            class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none"
            :placeholder="circleFocus ? '' : 'Type to search...'"
            @focus="circleFocus = true"
            @blur="circleFocus = false"
            v-model="circleFilterText"
          >
          <div style="max-height: 200px; overflow-y: auto;">
            <div class="form-check mb-1 ms-3">
              <input
                class="form-check-input"
                type="checkbox"
                :id="idPrefix + '-circle-all'"
                :checked="circleIds.length === 0"
                @change="selectAllCircles"
              >
              <label class="form-check-label" :for="idPrefix + '-circle-all'">All Circles</label>
            </div>
            <div class="form-check mb-1 ms-3" v-for="c in filteredCircles" :key="c.id">
              <input
                class="form-check-input"
                type="checkbox"
                :value="c.id"
                :id="idPrefix + '-circle-' + c.id"
                :checked="circleIds.includes(Number(c.id))"
                @change="toggleCircle(Number(c.id))"
              >
              <label class="form-check-label" :for="idPrefix + '-circle-' + c.id">{{ c.name }}</label>
            </div>
            <div v-if="filteredCircles.length === 0" class="text-muted small px-3 py-1">No circles found</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Police Station Dropdown -->
    <div :class="itemClass" style="min-width: 200px;">
      <label class="form-label text-muted small fw-bold mb-1">
        <i class="bi bi-building me-1"></i>Filter by Police Station
      </label>
      <div class="dropdown">
        <button
          :class="['form-control bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center', compact ? 'form-control-sm' : '']"
          type="button"
          v-bs-dropdown
          data-bs-toggle="dropdown"
          data-bs-auto-close="outside"
          aria-expanded="false"
        >
          <span class="text-truncate">{{ selectedPsCount > 0 ? selectedPsCount + ' Selected' : 'All Police Stations' }}</span>
        </button>
        <div class="dropdown-menu dropdown-menu-dark bg-dark p-2 border-secondary shadow w-100" @click.stop>
          <input
            type="text"
            class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none"
            :placeholder="psFocus ? '' : 'Type to search...'"
            @focus="psFocus = true"
            @blur="psFocus = false"
            v-model="psFilterText"
          >
          <div style="max-height: 200px; overflow-y: auto;">
            <div class="form-check mb-1 ms-3">
              <input
                class="form-check-input"
                type="checkbox"
                :id="idPrefix + '-ps-all'"
                :checked="policeStationIds.length === 0"
                @change="selectAllPs"
              >
              <label class="form-check-label" :for="idPrefix + '-ps-all'">All Police Stations</label>
            </div>
            <div class="form-check mb-1 ms-3" v-for="ps in displayedPoliceStations" :key="ps.name">
              <input
                class="form-check-input"
                type="checkbox"
                :id="idPrefix + '-ps-' + ps.name"
                :checked="isPsChecked(ps)"
                @change="togglePsSelection(ps)"
              >
              <label class="form-check-label" :for="idPrefix + '-ps-' + ps.name">{{ ps.name }}</label>
            </div>
            <div v-if="displayedPoliceStations.length === 0" class="text-muted small px-3 py-1">No stations found</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Date Pickers (Optional) -->
    <template v-if="showDateRange">
      <div :class="dateColClass" style="min-width: 140px;">
        <label class="form-label small text-muted fw-bold mb-1">From Tax Period</label>
        <input
          type="month"
          :class="['form-control bg-dark text-light border-secondary', compact ? 'form-control-sm' : '']"
          :value="fromDate"
          @change="onFromDateChange(($event.target as HTMLInputElement).value)"
        >
      </div>

      <div :class="dateColClass" style="min-width: 140px;">
        <label class="form-label small text-muted fw-bold mb-1">To Tax Period</label>
        <input
          type="month"
          :class="['form-control bg-dark text-light border-secondary', compact ? 'form-control-sm' : '']"
          :value="toDate"
          @change="onToDateChange(($event.target as HTMLInputElement).value)"
        >
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

interface DisplayedPs {
  name: string;
  ids: number[];
}

const props = withDefaults(
  defineProps<{
    circleIds?: number[];
    policeStationIds?: number[];
    fromDate?: string;
    toDate?: string;
    circles?: any[];
    policeStations?: any[];
    compact?: boolean;
    showDateRange?: boolean;
    idPrefix?: string;
    containerClass?: string;
    itemClass?: string;
    dateColClass?: string;
  }>(),
  {
    circleIds: () => [],
    policeStationIds: () => [],
    fromDate: '',
    toDate: '',
    circles: undefined,
    policeStations: undefined,
    compact: false,
    showDateRange: true,
    idPrefix: 'afb',
    containerClass: '',
    itemClass: '',
    dateColClass: '',
  }
);

const emit = defineEmits<{
  (e: 'update:circleIds', value: number[]): void;
  (e: 'update:policeStationIds', value: number[]): void;
  (e: 'update:fromDate', value: string): void;
  (e: 'update:toDate', value: string): void;
  (e: 'change'): void;
}>();

const localCircles = ref<any[]>([]);
const localPoliceStations = ref<any[]>([]);

const circleFilterText = ref('');
const circleFocus = ref(false);
const psFilterText = ref('');
const psFocus = ref(false);

const activeCircles = computed(() => {
  return props.circles !== undefined ? props.circles : localCircles.value;
});

const activePoliceStations = computed(() => {
  return props.policeStations !== undefined ? props.policeStations : localPoliceStations.value;
});

onMounted(async () => {
  if (props.circles === undefined || props.policeStations === undefined) {
    const token = localStorage.getItem('token');
    try {
      if (props.circles === undefined) {
        const cRes = await axios.get('/api/settings/circles', {
          headers: { Authorization: `Bearer ${token}` },
        });
        localCircles.value = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);
      }
      if (props.policeStations === undefined) {
        const pRes = await axios.get('/api/settings/police-stations', {
          headers: { Authorization: `Bearer ${token}` },
        });
        localPoliceStations.value = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data || []);
      }
    } catch (err) {
      console.error('Failed to load area filter master data:', err);
    }
  }
});

const filteredCircles = computed(() => {
  const list = activeCircles.value || [];
  if (!circleFilterText.value.trim()) return list;
  const t = circleFilterText.value.toLowerCase().trim();
  return list.filter((c: any) => c.name && c.name.toLowerCase().includes(t));
});

const displayedPoliceStations = computed<DisplayedPs[]>(() => {
  const list = activePoliceStations.value || [];
  let matching = list;

  if (props.circleIds.length > 0) {
    const selectedCircleIds = props.circleIds.map(Number);
    matching = list.filter((ps: any) =>
      selectedCircleIds.includes(Number(ps.circleId)) || selectedCircleIds.includes(Number(ps.circle_id))
    );
  }

  if (psFilterText.value.trim()) {
    const search = psFilterText.value.toLowerCase().trim();
    matching = matching.filter((ps: any) => ps.name && ps.name.toLowerCase().includes(search));
  }

  const map = new Map<string, number[]>();
  matching.forEach((ps: any) => {
    if (!ps.name) return;
    const name = ps.name.trim();
    if (!map.has(name)) {
      map.set(name, []);
    }
    const arr = map.get(name)!;
    const id = Number(ps.id);
    if (!isNaN(id) && !arr.includes(id)) {
      arr.push(id);
    }
  });

  return Array.from(map.entries())
    .map(([name, ids]) => ({ name, ids }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectAllCircles = () => {
  emit('update:circleIds', []);
  emit('change');
};

const toggleCircle = (circleId: number) => {
  let updated: number[];
  if (props.circleIds.includes(circleId)) {
    updated = props.circleIds.filter((id) => id !== circleId);
  } else {
    updated = [...props.circleIds, circleId];
  }
  emit('update:circleIds', updated);
  emit('change');
};

const isPsChecked = (ps: DisplayedPs) => {
  return ps.ids.length > 0 && ps.ids.some((id) => props.policeStationIds.includes(id));
};

const selectAllPs = () => {
  emit('update:policeStationIds', []);
  emit('change');
};

const togglePsSelection = (ps: DisplayedPs) => {
  const checked = isPsChecked(ps);
  let updated: number[];
  if (checked) {
    updated = props.policeStationIds.filter((id) => !ps.ids.includes(id));
  } else {
    const toAdd = ps.ids.filter((id) => !props.policeStationIds.includes(id));
    updated = [...props.policeStationIds, ...toAdd];
  }
  emit('update:policeStationIds', updated);
  emit('change');
};

const selectedPsCount = computed(() => {
  const allList = activePoliceStations.value || [];
  const selected = new Set<string>();
  allList.forEach((ps: any) => {
    if (props.policeStationIds.includes(Number(ps.id))) {
      selected.add(ps.name.trim());
    }
  });
  return selected.size;
});

const onFromDateChange = (val: string) => {
  emit('update:fromDate', val);
  if (props.toDate && val > props.toDate) {
    emit('update:toDate', val);
  }
  emit('change');
};

const onToDateChange = (val: string) => {
  emit('update:toDate', val);
  if (props.fromDate && val < props.fromDate) {
    emit('update:fromDate', val);
  }
  emit('change');
};
</script>
