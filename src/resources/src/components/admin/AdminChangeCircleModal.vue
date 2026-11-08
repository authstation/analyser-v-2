<template>
  <div v-if="isOpen" class="modal-backdrop-custom d-flex align-items-center justify-content-center" @click.self="close">
    <div class="modal-card bg-surface border border-custom rounded-3 shadow-lg p-4" style="width: 500px; max-width: 95vw;" @click.stop>
      <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-custom">
        <h6 class="mb-0 fw-bold d-flex align-items-center text-primary">
          <i class="bi bi-arrow-left-right me-2 fs-5"></i>
          <span>Change / Assign Office</span>
        </h6>
        <button type="button" class="btn-close btn-close-white" @click="close"></button>
      </div>

      <!-- Target User Info -->
      <div class="mb-3 p-2 rounded-2 bg-dark bg-opacity-25 border border-custom">
        <div class="small text-muted">User:</div>
        <div class="fw-bold">{{ userName }} <span class="small text-muted fw-normal">({{ userEmail }})</span></div>
      </div>

      <!-- Current Office -->
      <div class="mb-3" v-if="currentCircleName">
        <label class="form-label text-muted small fw-semibold">Current Office</label>
        <div class="form-control bg-surface border-custom d-flex align-items-center text-light opacity-75">
          <i class="bi bi-building me-2 text-info"></i>
          <span class="fw-bold">{{ currentCircleName }}</span>
        </div>
      </div>

      <!-- Select New Target Office -->
      <div class="mb-4 position-relative" ref="dropdownRef">
        <label class="form-label text-muted small fw-semibold">Select Target Office</label>
        
        <div 
          class="form-control d-flex justify-content-between align-items-center bg-surface border-custom user-select-none cursor-pointer py-2"
          :class="{ 'border-primary ring-focus': isDropdownOpen }"
          @click="isDropdownOpen = !isDropdownOpen"
          role="button"
          tabindex="0"
        >
          <div class="d-flex align-items-center text-truncate pe-2">
            <i class="bi bi-building-add me-2 text-success opacity-75"></i>
            <span v-if="selectedCircle" class="fw-semibold text-truncate">
              {{ selectedCircle.name }}
              <small v-if="selectedCircle.divisionName" class="text-muted ms-1">({{ selectedCircle.divisionName }})</small>
            </span>
            <span v-else class="text-muted">-- Choose an office --</span>
          </div>
          <i class="bi" :class="isDropdownOpen ? 'bi-chevron-up text-primary' : 'bi-chevron-down text-muted'"></i>
        </div>

        <div 
          v-if="isDropdownOpen" 
          class="position-absolute start-0 end-0 bg-surface border border-custom rounded-3 shadow-lg mt-1 p-2 z-3 custom-dropdown-menu"
          @click.stop
        >
          <div class="px-1 pb-2">
            <input 
              type="text" 
              class="form-control form-control-sm bg-surface border-custom text-light shadow-none" 
              placeholder="Type to search offices..."
              v-model="searchQuery"
              autofocus
            >
          </div>

          <div class="overflow-y-auto dropdown-list-scroll px-1" style="max-height: 220px;">
            <div 
              v-for="c in filteredCircles" 
              :key="c.id"
              class="dropdown-circle-item d-flex justify-content-between align-items-center px-2 py-2 rounded-2 mb-1 cursor-pointer"
              :class="{ 'active-item bg-primary text-white': targetCircleId === c.id }"
              @click="selectCircle(c.id)"
            >
              <div class="text-truncate pe-2">
                <div class="fw-semibold text-truncate small" :class="targetCircleId === c.id ? 'text-white' : ''">{{ c.name }}</div>
                <div class="text-xs text-truncate" :class="targetCircleId === c.id ? 'text-white text-opacity-75' : 'text-muted'">
                  {{ c.divisionName || 'Circle Office' }}
                </div>
              </div>
              <i v-if="targetCircleId === c.id" class="bi bi-check-lg text-white"></i>
            </div>
            <div v-if="filteredCircles.length === 0" class="text-muted text-center py-3 small">
              No offices match your search
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex justify-content-end gap-2 pt-2 border-top border-custom">
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="close" :disabled="submitting">
          Cancel
        </button>
        <button type="button" class="btn btn-sm btn-primary d-flex align-items-center gap-1" @click="confirm" :disabled="submitting || !targetCircleId">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-check-circle-fill me-1"></i>
          <span>{{ submitting ? 'Updating...' : 'Confirm Update' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import axios from '@/plugins/axios';

const props = defineProps<{
  isOpen: boolean;
  userId: number;
  userName: string;
  userEmail: string;
  currentCircleId?: number | null;
  currentCircleName?: string | null;
  subscriptionId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

const circles = ref<any[]>([]);
const targetCircleId = ref<number | null>(null);
const searchQuery = ref('');
const isDropdownOpen = ref(false);
const submitting = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const fetchCircles = async () => {
  if (circles.value.length > 0) return;
  try {
    const res = await axios.get('/api/settings/circles');
    const list = res.data?.data ?? res.data ?? [];
    circles.value = Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to load circles:', err);
  }
};

watch(() => props.isOpen, (open) => {
  if (open) {
    targetCircleId.value = null;
    searchQuery.value = '';
    isDropdownOpen.value = false;
    fetchCircles();
  }
});

const selectedCircle = computed(() => {
  return circles.value.find(c => c.id === targetCircleId.value) || null;
});

const filteredCircles = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return circles.value;
  return circles.value.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const divMatch = (c.divisionName || '').toLowerCase().includes(q);
    return nameMatch || divMatch;
  });
});

const selectCircle = (id: number) => {
  targetCircleId.value = id;
  isDropdownOpen.value = false;
  searchQuery.value = '';
};

const close = () => {
  if (submitting.value) return;
  emit('close');
};

const confirm = async () => {
  if (!targetCircleId.value) return;
  submitting.value = true;
  try {
    const payload: any = {
      userId: props.userId,
      toCircleId: targetCircleId.value
    };
    if (props.currentCircleId) {
      payload.fromCircleId = props.currentCircleId;
    }
    if (props.subscriptionId) {
      payload.subscriptionId = props.subscriptionId;
    }
    const res = await axios.post('/api/subscriptions/change-circle', payload);
    emit('success', res.data);
    close();
  } catch (err: any) {
    const msg = err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to update office';
    alert(msg);
  } finally {
    submitting.value = false;
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1070;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.bg-surface {
  background-color: var(--app-surface, #212529);
}
.border-custom {
  border-color: var(--app-border, rgba(255, 255, 255, 0.15));
}
.cursor-pointer {
  cursor: pointer;
}
.ring-focus {
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}
.dropdown-circle-item {
  transition: background-color 0.15s ease;
}
.dropdown-circle-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}
.custom-dropdown-menu {
  background-color: var(--app-surface, #212529) !important;
  border-color: var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
}
.text-xs {
  font-size: 0.75rem;
}
.dropdown-list-scroll::-webkit-scrollbar {
  width: 5px;
}
.dropdown-list-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
</style>
