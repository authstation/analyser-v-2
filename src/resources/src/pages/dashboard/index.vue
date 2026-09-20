<template>
  <div class="min-vh-100 d-flex flex-column position-relative">
    <main class="flex-grow-1 p-4">
      <div class="container-fluid">

    <!-- Modules Section -->
    <div class="text-center mb-4 mt-2">
      <h4 class="fw-bold mb-1">
        <i class="bi bi-grid me-2 text-info"></i>Available Modules
      </h4>
      <p class="text-muted small mb-0">Select a module below to process, map, and extract insights from your data.</p>
    </div>

    <div class="row g-4 mt-2 justify-content-center mb-5">

      <!-- BIN Analyser -->
      <div class="col-md-4">
        <div class="card h-100 bg-surface border-custom shadow-sm hover-card position-relative">
          <div v-if="isAdmin" class="position-absolute top-0 end-0 m-2 z-3">
            <label class="module-toggle">
              <input type="checkbox" v-model="moduleStatus.module_bin_analyser" @change="toggleModule('module_bin_analyser')">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
            <div class="mb-3">
              <i class="bi bi-file-earmark-bar-graph text-info" style="font-size: 3rem;"></i>
            </div>
            <h5 class="card-title fw-bold">BIN Analyser</h5>
            <p class="card-text text-muted small">Upload and map Excel files for advanced analysis.</p>
            <router-link v-if="moduleStatus.module_bin_analyser" to="/modules/bin-analyser" class="btn btn-outline-info w-100 mt-auto">Open BIN Analyser</router-link>
            <button v-else class="btn btn-outline-secondary w-100 mt-auto" :disabled="!isAdmin" @click="isAdmin ? $router.push('/modules/bin-analyser') : null">
              <i class="bi bi-tools me-1"></i>{{ isAdmin ? 'Under Maintenance (Admin Access)' : 'Under Maintenance' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Return Data Analyser -->
      <div class="col-md-4">
        <div class="card h-100 bg-surface border-custom shadow-sm hover-card position-relative">
          <div v-if="isAdmin" class="position-absolute top-0 end-0 m-2 z-3">
            <label class="module-toggle">
              <input type="checkbox" v-model="moduleStatus.module_return_data" @change="toggleModule('module_return_data')">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
            <div class="mb-3">
              <i class="bi bi-file-earmark-ruled text-purple" style="font-size: 3rem;"></i>
            </div>
            <h5 class="card-title fw-bold">Return Data Analyser</h5>
            <p class="card-text text-muted small">Upload and analyze return data from your Excel datasets.</p>
            <router-link v-if="moduleStatus.module_return_data" to="/modules/return-data-analyser" class="btn btn-outline-purple w-100 mt-auto">Open Return Data Analyser</router-link>
            <button v-else class="btn btn-outline-secondary w-100 mt-auto" :disabled="!isAdmin" @click="isAdmin ? $router.push('/modules/return-data-analyser') : null">
              <i class="bi bi-tools me-1"></i>{{ isAdmin ? 'Under Maintenance (Admin Access)' : 'Under Maintenance' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Revenue Analyser -->
      <div class="col-md-4">
        <div class="card h-100 bg-surface border-custom shadow-sm hover-card position-relative">
          <div v-if="isAdmin" class="position-absolute top-0 end-0 m-2 z-3">
            <label class="module-toggle">
              <input type="checkbox" v-model="moduleStatus.module_revenue" @change="toggleModule('module_revenue')">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
            <div class="mb-3">
              <i class="bi bi-cash-stack text-orange" style="font-size: 3rem;"></i>
            </div>
            <h5 class="card-title fw-bold">Revenue Analyser</h5>
            <p class="card-text text-muted small">Upload and analyze revenue collection data from your datasets.</p>
            <router-link v-if="moduleStatus.module_revenue" to="/modules/revenue-analyser" class="btn btn-outline-orange w-100 mt-auto">Open Revenue Analyser</router-link>
            <button v-else class="btn btn-outline-secondary w-100 mt-auto" :disabled="!isAdmin" @click="isAdmin ? $router.push('/modules/revenue-analyser') : null">
              <i class="bi bi-tools me-1"></i>{{ isAdmin ? 'Under Maintenance (Admin Access)' : 'Under Maintenance' }}
            </button>
          </div>
        </div>
      </div>

      <!-- iBAS++ Analyser -->
      <div class="col-md-4">
        <div class="card h-100 bg-surface border-custom shadow-sm hover-card position-relative">
          <div v-if="isAdmin" class="position-absolute top-0 end-0 m-2 z-3">
            <label class="module-toggle">
              <input type="checkbox" v-model="moduleStatus.module_ibas" @change="toggleModule('module_ibas')">
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
            <div class="mb-3">
              <i class="bi bi-calculator text-success" style="font-size: 3rem;"></i>
            </div>
            <h5 class="card-title fw-bold">iBAS++ Analyser</h5>
            <p class="card-text text-muted small">Analyze VAT deductions and cross-match with iBAS++ data.</p>
            <router-link v-if="moduleStatus.module_ibas" to="/modules/ibas-analysis" class="btn btn-outline-success w-100 mt-auto">Open iBAS++ Analyser</router-link>
            <button v-else class="btn btn-outline-secondary w-100 mt-auto" :disabled="!isAdmin" @click="isAdmin ? $router.push('/modules/ibas-analysis') : null">
              <i class="bi bi-tools me-1"></i>{{ isAdmin ? 'Under Maintenance (Admin Access)' : 'Under Maintenance' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Global Settings (Admin only) -->
      <div class="col-md-4" v-if="isAdmin">
        <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
          <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
            <div class="mb-3">
              <i class="bi bi-gear-fill text-secondary" style="font-size: 3rem;"></i>
            </div>
            <h5 class="card-title fw-bold">Global Settings</h5>
            <p class="card-text text-muted small">Manage system master data and rules.</p>
            <router-link to="/admin/settings" class="btn btn-outline-secondary w-100 mt-auto">Open Settings</router-link>
          </div>
        </div>
      </div>

      <!-- Manage Subscriptions (User only) -->
      <div class="col-md-4" v-if="!isAdmin">
        <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
          <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
            <div class="mb-3">
              <i class="bi bi-briefcase text-primary" style="font-size: 3rem;"></i>
            </div>
            <h5 class="card-title fw-bold">Manage Subscriptions</h5>
            <p class="card-text text-muted small">View your approved offices or request access to new ones.</p>
            <router-link to="/my-subscriptions" class="btn btn-outline-primary w-100 mt-auto">Manage Subscriptions</router-link>
          </div>
        </div>
      </div>

    </div>

    <!-- Administration Section (Admin Only) -->
    <div v-if="isAdmin" class="mt-5">
      <div class="text-center mb-4">
        <h4 class="fw-bold mb-1">
          <i class="bi bi-shield-lock me-2 text-secondary"></i>Administration Panel
        </h4>
        <p class="text-muted small mb-0">Manage users, access controls, and system subscriptions.</p>
      </div>
      <div class="row g-4 mt-2 justify-content-center">

        <div class="col-md-4">
          <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
            <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
              <div class="mb-3">
                <i class="bi bi-people text-info" style="font-size: 3rem;"></i>
              </div>
              <h5 class="card-title fw-bold">User Management</h5>
              <p class="card-text text-muted small">Manage system users, roles and their plans.</p>
              <router-link to="/admin/users" class="btn btn-outline-info w-100 mt-auto">Manage Users</router-link>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
            <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
              <div class="mb-3">
                <i class="bi bi-tags text-warning" style="font-size: 3rem;"></i>
              </div>
              <h5 class="card-title fw-bold">Plan Management</h5>
              <p class="card-text text-muted small">Create and manage pricing plans.</p>
              <router-link to="/admin/plans" class="btn btn-outline-warning w-100 mt-auto">Manage Plans</router-link>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card h-100 bg-surface border-custom shadow-sm hover-card">
            <div class="card-body text-center p-4 d-flex flex-column justify-content-center" style="min-height: 260px;">
              <div class="mb-3">
                <i class="bi bi-shield-lock text-success" style="font-size: 3rem;"></i>
              </div>
              <h5 class="card-title fw-bold">Access Approvals</h5>
              <p class="card-text text-muted small">Manage circle access requests.</p>
              <router-link to="/admin/subscriptions" class="btn btn-outline-success w-100 mt-auto">Manage Access</router-link>
            </div>
          </div>
        </div>

      </div>
    </div>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { onMounted, reactive, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import axios from "@/plugins/axios";

useHead({ title: "Dashboard" });

const auth = useAuthStore();

// Backend role = 'admin' or 'user' (string)
const isAdmin = computed(() => {
  const role = String(auth.user?.role ?? "").toLowerCase();
  return role === "admin";
});

// Module Status
const moduleStatus = reactive<Record<string, boolean>>({
  module_bin_analyser: true,
  module_ibas: true,
  module_return_data: true,
  module_revenue: true
});

const fetchModuleStatus = async () => {
  try {
    const res = await axios.get('/api/settings/app-settings');
    const settings: Array<{ key: string; value: string }> = res.data?.data || [];
    for (const s of settings) {
      if (s.key in moduleStatus) {
        moduleStatus[s.key] = s.value === 'true';
      }
    }
  } catch (err) {
    // Keep defaults if API fails
  }
};

const toggleModule = async (key: string) => {
  try {
    await axios.put(`/api/settings/app-settings/${key}`, { value: String(moduleStatus[key]) });
  } catch (err) {
    // Revert on failure
    moduleStatus[key] = !moduleStatus[key];
  }
};

onMounted(() => {
  fetchModuleStatus();
});
</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.hover-card { 
  transition: transform 0.2s ease, box-shadow 0.2s ease; 
}
.hover-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important;
  border-color: var(--app-secondary, #6c757d) !important;
}
.module-toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}
.module-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.module-toggle .toggle-track {
  position: absolute;
  inset: 0;
  background-color: #3a3a3a;
  border-radius: 24px;
  cursor: pointer;
  transition: background-color 0.25s ease;
}
.module-toggle .toggle-track::before {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background-color: #fff;
  border-radius: 50%;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.module-toggle input:checked + .toggle-track {
  background-color: #0d6efd;
}
.module-toggle input:checked + .toggle-track::before {
  transform: translateX(20px);
}

/* Button overrides for anchor tags to ensure correct colors */
.btn-outline-info {
  color: #0dcaf0 !important;
  border-color: #0dcaf0 !important;
}
.btn-outline-info:hover {
  background-color: #0dcaf0 !important;
  color: #000 !important;
}

.btn-outline-warning {
  color: #ffc107 !important;
  border-color: #ffc107 !important;
}
.btn-outline-warning:hover {
  background-color: #ffc107 !important;
  color: #000 !important;
}

.btn-outline-purple {
  color: #a855f7 !important;
  border-color: #a855f7 !important;
}
.btn-outline-purple:hover {
  background-color: #a855f7 !important;
  color: #fff !important;
}

.btn-outline-orange {
  color: #f97316 !important;
  border-color: #f97316 !important;
}
.btn-outline-orange:hover {
  background-color: #f97316 !important;
  color: #fff !important;
}

.btn-outline-success {
  color: #198754 !important;
  border-color: #198754 !important;
}
.btn-outline-success:hover {
  background-color: #198754 !important;
  color: #fff !important;
}

.text-purple {
  color: #a855f7 !important;
}
.text-orange {
  color: #f97316 !important;
}
</style>
