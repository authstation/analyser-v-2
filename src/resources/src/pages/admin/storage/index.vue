<template>
  <div class="container-fluid py-4">
    <!-- Header with Back Button -->
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
      <div>
        <div class="mb-2">
          <router-link to="/dashboard" class="btn btn-outline-secondary btn-sm rounded-pill px-3">
            <i class="bi bi-arrow-left me-1"></i> Back to Dashboard
          </router-link>
        </div>
        <h3 class="fw-bold text-light mb-1">
          <i class="bi bi-hdd-network text-warning me-2"></i>Storage & Database Backup Management
        </h3>
        <p class="text-muted small mb-0">Monitor total database volume, per-user storage consumption, and download or restore SQL backups.</p>
      </div>
      <div class="d-flex gap-2 align-items-end">
        <button class="btn btn-outline-warning" @click="fetchOverview" :disabled="loading">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
        <button class="btn btn-primary" @click="downloadBackupFile" :disabled="downloading">
          <span v-if="downloading" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
          <i v-else class="bi bi-cloud-arrow-down-fill me-1"></i>
          {{ downloading ? 'Generating...' : 'Download Full SQL Backup' }}
        </button>
        <button class="btn btn-outline-danger" @click="openRestoreModal">
          <i class="bi bi-cloud-arrow-up-fill me-1"></i> Restore Backup
        </button>
      </div>
    </div>

    <!-- Storage Overview Metrics -->
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="card bg-surface border-custom h-100 shadow-sm p-4">
          <div class="d-flex align-items-center">
            <div class="p-3 rounded bg-warning-subtle text-warning me-3">
              <i class="bi bi-database-fill" style="font-size: 2rem;"></i>
            </div>
            <div>
              <div class="text-muted small text-uppercase fw-bold">Total Database Size</div>
              <h2 class="fw-bold text-light mb-0">{{ overviewData?.database?.prettySize || '0 MB' }}</h2>
              <div class="text-muted small mt-1">PostgreSQL Active Storage Volume</div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card bg-surface border-custom h-100 shadow-sm p-4">
          <div class="d-flex align-items-center">
            <div class="p-3 rounded bg-info-subtle text-info me-3">
              <i class="bi bi-people-fill" style="font-size: 2rem;"></i>
            </div>
            <div>
              <div class="text-muted small text-uppercase fw-bold">Active Users</div>
              <h2 class="fw-bold text-light mb-0">{{ overviewData?.users?.length || 0 }}</h2>
              <div class="text-muted small mt-1">Users with uploaded datasets</div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card bg-surface border-custom h-100 shadow-sm p-4">
          <div class="d-flex align-items-center">
            <div class="p-3 rounded bg-success-subtle text-success me-3">
              <i class="bi bi-table" style="font-size: 2rem;"></i>
            </div>
            <div>
              <div class="text-muted small text-uppercase fw-bold">Primary Table (Return Data)</div>
              <h2 class="fw-bold text-light mb-0">{{ getTableSize('return_data') }}</h2>
              <div class="text-muted small mt-1">VAT return dataset volume</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Per-User Storage Usage Table (Sorted Top to Bottom with Pagination) -->
    <div class="card bg-surface border-custom shadow-sm mb-4">
      <div class="card-header bg-dark border-secondary py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 class="fw-bold text-light mb-0">
          <i class="bi bi-person-lines-fill text-warning me-2"></i>User Storage Usage (Top to Bottom)
        </h5>
        <div class="position-relative" style="width: 260px;">
          <input 
            type="text" 
            class="form-control form-control-sm bg-dark text-light border-secondary" 
            placeholder="Search by name or email..." 
            v-model="userSearchQuery" 
          />
        </div>
      </div>

      <div class="card-body p-0 table-responsive">
        <table class="table table-dark table-hover align-middle mb-0">
          <thead>
            <tr>
              <th style="width: 50px;" class="text-center">#</th>
              <th>User Details</th>
              <th class="text-center">Role</th>
              <th class="text-center">Return Records</th>
              <th class="text-center">BIN Records</th>
              <th class="text-center">Total Records</th>
              <th class="text-end pe-4">Estimated Storage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="text-center py-4 text-muted">
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>Loading storage metrics...
              </td>
            </tr>
            <tr v-else-if="paginatedUsers.length === 0">
              <td colspan="7" class="text-center py-4 text-muted">No user records found.</td>
            </tr>
            <tr v-for="(user, idx) in paginatedUsers" :key="user.userId">
              <td class="text-center text-muted">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
              <td>
                <div class="fw-bold text-light">{{ user.name }}</div>
                <div class="small text-muted">{{ user.email }}</div>
              </td>
              <td class="text-center">
                <span class="badge text-uppercase" :class="user.role === 'admin' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle'">
                  {{ user.role }}
                </span>
              </td>
              <td class="text-center font-monospace">{{ user.returnRecords.toLocaleString() }}</td>
              <td class="text-center font-monospace">{{ user.binRecords.toLocaleString() }}</td>
              <td class="text-center font-monospace fw-bold text-info">{{ user.totalRecords.toLocaleString() }}</td>
              <td class="text-end pe-4 font-monospace fw-bold text-warning">{{ user.prettySize }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer (10 items per page) -->
      <div class="card-footer bg-dark border-secondary py-2 d-flex justify-content-between align-items-center" v-if="totalPages > 1 && !loading">
        <div class="text-muted small">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredUsers.length) }} of {{ filteredUsers.length }} users
        </div>
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <button class="page-link bg-dark text-light border-secondary" @click="changePage(currentPage - 1)">Prev</button>
          </li>
          <li class="page-item" v-for="p in totalPages" :key="p" :class="{ active: p === currentPage }">
            <button 
              class="page-link border-secondary" 
              :class="p === currentPage ? 'bg-warning text-dark border-warning fw-bold' : 'bg-dark text-light'" 
              @click="changePage(p)"
            >
              {{ p }}
            </button>
          </li>
          <li class="page-item" :class="{ disabled: currentPage === totalPages }">
            <button class="page-link bg-dark text-light border-secondary" @click="changePage(currentPage + 1)">Next</button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Restore SQL Backup Modal -->
    <div v-if="showRestoreModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.75);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-light border-secondary">
          <div class="modal-header border-secondary">
            <h5 class="modal-title fw-bold text-danger">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>Database Restore
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="closeRestoreModal"></button>
          </div>
          <div class="modal-body p-4">
            <div class="alert alert-warning text-dark small mb-3">
              <i class="bi bi-info-circle-fill me-1"></i>
              <strong>Warning:</strong> Restoring a backup will overwrite current database records. Please select a valid <code>.sql</code> backup file.
            </div>
            
            <div class="mb-3">
              <label class="form-label small text-muted">Upload SQL Backup File (.sql)</label>
              <input type="file" accept=".sql" class="form-control bg-secondary text-light border-0" @change="onFileSelected" />
            </div>

            <div v-if="restoring" class="text-center py-3">
              <div class="spinner-border text-danger" role="status"></div>
              <div class="text-muted small mt-2">Restoring database in progress... Please do not close this window.</div>
            </div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-secondary" @click="closeRestoreModal" :disabled="restoring">Cancel</button>
            <button type="button" class="btn btn-danger" @click="executeRestore" :disabled="!selectedFile || restoring">
              Execute Restore
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import axios from "@/plugins/axios";

const loading = ref(false);
const downloading = ref(false);
const restoring = ref(false);
const showRestoreModal = ref(false);
const selectedFile = ref<File | null>(null);

const overviewData = ref<any>(null);
const userSearchQuery = ref("");
const currentPage = ref(1);
const pageSize = ref(10);

const fetchOverview = async () => {
  loading.value = true;
  try {
    const res = await axios.get("/api/storage-management/overview");
    overviewData.value = res.data;
  } catch (error) {
    console.error("Failed to load storage overview:", error);
  } finally {
    loading.value = false;
  }
};

const getTableSize = (tableName: string) => {
  if (!overviewData.value?.tables) return "-";
  const table = overviewData.value.tables.find((t: any) => t.tableName === tableName);
  return table ? table.prettySize : "-";
};

const filteredUsers = computed(() => {
  const users = overviewData.value?.users || [];
  if (!userSearchQuery.value.trim()) return users;
  const q = userSearchQuery.value.toLowerCase().trim();
  return users.filter((u: any) => (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q)));
});

const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / pageSize.value) || 1;
});

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredUsers.value.slice(start, start + pageSize.value);
});

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const downloadBackupFile = async () => {
  downloading.value = true;
  try {
    const res = await axios.get("/api/storage-management/backup/download", {
      responseType: "blob"
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `analyser_db_backup_${dateStr}.sql`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Backup download failed:", error);
    alert("Failed to download database backup file.");
  } finally {
    downloading.value = false;
  }
};

const openRestoreModal = () => {
  selectedFile.value = null;
  showRestoreModal.value = true;
};

const closeRestoreModal = () => {
  if (!restoring.value) {
    showRestoreModal.value = false;
  }
};

const onFileSelected = (event: any) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
  }
};

const executeRestore = async () => {
  if (!selectedFile.value) return;
  if (!confirm("Are you sure you want to restore this backup file to database?")) return;

  restoring.value = true;
  try {
    const formData = new FormData();
    formData.append("file", selectedFile.value);

    await axios.post("/api/storage-management/backup/restore", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });

    alert("Database restored successfully!");
    showRestoreModal.value = false;
    await fetchOverview();
  } catch (error) {
    console.error("Restore failed:", error);
    alert("Database restore failed. Please verify the SQL file format.");
  } finally {
    restoring.value = false;
  }
};

onMounted(() => {
  fetchOverview();
});
</script>

<style scoped>
.bg-surface {
  background-color: #1e2227;
}
.border-custom {
  border-color: #2d3239 !important;
}
</style>
