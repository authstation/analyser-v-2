<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
      <div>
        <div class="mb-2">
          <router-link to="/dashboard" class="btn btn-outline-secondary btn-sm rounded-pill px-3">
            <i class="bi bi-arrow-left me-1"></i> Back to Dashboard
          </router-link>
        </div>
        <h3 class="fw-bold text-light mb-1">
          <i class="bi bi-file-earmark-richtext text-danger me-2"></i>Letter Templates Management
        </h3>
        <p class="text-muted small mb-0">Create, edit, and organize official letter and notice templates.</p>
      </div>
      <div>
        <button class="btn btn-primary" @click="openCreateModal">
          <i class="bi bi-plus-circle me-1"></i> Create New Template
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-danger" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <!-- Template List Cards -->
    <div v-else class="row g-4">
      <div v-if="templates.length === 0" class="col-12 text-center py-5 text-muted">
        No letter templates found. Create one above.
      </div>
      <div class="col-md-6 col-lg-4" v-for="tpl in templates" :key="tpl.id">
        <div class="card bg-surface border-custom h-100 shadow-sm hover-card">
          <div class="card-body d-flex flex-column p-4">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 text-uppercase">
                {{ tpl.category || 'NOTICE' }}
              </span>
              <div class="d-flex gap-1">
                <span v-if="!tpl.userId" class="badge bg-info-subtle text-info border border-info-subtle">
                  <i class="bi bi-globe me-1"></i>Official / Global
                </span>
                <span v-else class="badge bg-warning-subtle text-warning border border-warning-subtle">
                  <i class="bi bi-person-fill me-1"></i>My Template
                </span>
                <span class="badge" :class="tpl.isActive ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle'">
                  {{ tpl.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>
            <h5 class="fw-bold text-light mb-2">{{ tpl.title }}</h5>
            <p class="text-muted small mb-3 flex-grow-1" style="line-height: 1.5;">{{ tpl.description || 'No description provided.' }}</p>
            
            <div class="border-top border-secondary pt-3 mt-auto">
              <div class="small text-muted mb-2 text-truncate">
                <strong>Subject:</strong> {{ tpl.subject || '-' }}
              </div>
              <div class="d-flex gap-2">
                <button v-if="canEditTemplate(tpl)" class="btn btn-sm btn-outline-info flex-grow-1" @click="openEditModal(tpl)">
                  <i class="bi bi-pencil-square me-1"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-warning flex-grow-1" @click="cloneTemplate(tpl)" title="Add copy to my profile to customize office & signatories">
                  <i class="bi bi-copy me-1"></i> Clone to My Profile
                </button>
                <button class="btn btn-sm btn-outline-secondary" @click="openPreviewModal(tpl)" title="Preview">
                  <i class="bi bi-eye"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Preview / Interactive Edit -->
    <div v-if="showModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.75);">
      <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark text-light border-secondary">
          <div class="modal-header border-secondary">
            <h5 class="modal-title fw-bold">
              <i class="bi bi-file-earmark-text text-danger me-2"></i>{{ isEditing ? (currentForm.id ? 'Edit Letter Template' : 'Create New Letter Template') : 'Template Preview' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
          </div>
          <div class="modal-body p-4">
            <!-- Edit Mode -->
            <div v-if="isEditing">
              <div class="row g-3 mb-3">
                <div class="col-md-8">
                  <label class="form-label small text-muted">Template Title <span class="text-danger">*</span></label>
                  <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. প্রদেয় ভ্যাট পরিশোধপূর্বক রিটার্ন দাখিলকরণ পত্র" v-model="currentForm.title" />
                </div>
                <div class="col-md-4">
                  <label class="form-label small text-muted">Category Slug</label>
                  <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. non-filer-notice" v-model="currentForm.category" />
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label small text-muted">Description / Summary</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="Short description for admin library" v-model="currentForm.description" />
              </div>

              <div class="mb-3">
                <label class="form-label small text-muted">বিষয়</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. প্রদেয় ভ্যাট পরিশোধপূর্বক রিটার্ন দাখিলকরণ।" v-model="currentForm.subject" />
              </div>

              <div class="mb-3">
                <label class="form-label small text-muted">সূত্র</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. মূল্য সংযোজন কর ও সম্পূরক শুল্ক অধ্যাদেশ..." v-model="currentForm.reference" />
              </div>

              <!-- Click to insert Dynamic Variable -->
              <VariableBar @insert="insertVariableIntoBody" />

              <div class="mb-3">
                <label class="form-label small text-muted d-flex justify-content-between align-items-center">
                  <span>Letter Body / Paragraphs <span class="text-danger">*</span></span>
                  <span class="text-muted" style="font-size: 0.75rem;">(Click above buttons to insert variables at cursor)</span>
                </label>
                <textarea 
                  ref="bodyTextareaRef"
                  rows="13" 
                  class="form-control form-dark-input text-white border-secondary body-editor" 
                  style="line-height: 1.8; font-size: 0.95rem; text-align: justify;"
                  placeholder="Type letter body here..."
                  v-model="currentForm.bodyHtml"
                ></textarea>
              </div>

              <!-- Default CC Items -->
              <div class="card bg-black border-secondary p-3 mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="small fw-bold text-muted text-uppercase">Default CC Items (অনুলিপি তালিকা)</span>
                  <button type="button" class="btn btn-xs btn-outline-info py-0 px-2" @click="addCcRow">
                    <i class="bi bi-plus-lg me-1"></i> Add CC Row
                  </button>
                </div>
                <div v-for="(cc, cIdx) in currentForm.ccItems" :key="cIdx" class="d-flex gap-2 mb-2">
                  <input type="text" class="form-control form-control-sm form-dark-input text-white border-secondary" v-model="currentForm.ccItems[cIdx]" placeholder="e.g. সদয় অবগতির জন্যঃ কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট..." />
                  <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" @click="removeCcRow(Number(cIdx))">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
                <div v-if="!currentForm.ccItems || currentForm.ccItems.length === 0" class="text-muted small fst-italic">
                  No default CC rows. Click 'Add CC Row' if needed.
                </div>
              </div>
            </div>

            <!-- Preview Mode (Official Letter Layout Preview) -->
            <div v-else class="official-preview p-4 bg-white text-dark rounded shadow-sm" style="font-family: 'SolaimanLipi', 'Kalpurush', 'Nikosh', sans-serif;">
              <div class="text-center mb-4 border-bottom pb-3">
                <img src="/logo-favicon/bd-logo.png" alt="Govt Logo" style="height: 60px; width: 60px; object-fit: contain;" class="mb-1" onerror="this.style.display='none'" />
                <div class="fw-bold fs-5 text-dark">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
                <div class="fw-bold text-dark fs-6 mt-1">{{ activeTemplate?.officeName || '[দপ্তরের নাম ও বিভাগ]' }}</div>
                <div class="text-dark small" v-if="activeTemplate?.officeAddress">{{ activeTemplate?.officeAddress }}</div>
                <div class="text-dark small" v-if="activeTemplate?.officeEmail">ইমেইল: {{ activeTemplate?.officeEmail }}</div>
              </div>

              <div class="d-flex justify-content-between align-items-baseline mb-3 small">
                <div><strong>নথি নং:</strong> {{ activeTemplate?.defaultFileNo || '—' }}</div>
                <div><strong>তারিখ:</strong> {{ new Date().toLocaleDateString("en-GB").replace(/\//g, ".") }} খ্রিষ্টাব্দ</div>
              </div>

              <div class="mb-3">
                <div class="fw-bold mb-1">বিষয়: {{ activeTemplate?.subject || '-' }}</div>
                <div class="text-muted small" v-if="activeTemplate?.reference"><strong>সূত্র:</strong> {{ activeTemplate?.reference }}</div>
              </div>

              <div class="body-content my-4" style="white-space: pre-wrap; line-height: 1.8; text-align: justify;">
                {{ activeTemplate?.bodyHtml }}
              </div>

              <div class="d-flex justify-content-end text-center my-4">
                <div style="min-width: 200px;">
                  <div class="fw-bold">[স্বাক্ষরকারীর নাম]</div>
                  <div class="small text-muted">[পদবী ও বিভাগীয় কর্মকর্তা]</div>
                </div>
              </div>

              <div class="border-top pt-3 mt-4">
                <div class="fw-bold small mb-1">প্রাপক:</div>
                <div class="small">&#123;&#123;entity_name&#125;&#125;</div>
                <div class="small">ঠিকানা: &#123;&#123;address&#125;&#125;</div>
                <div class="small">নিবন্ধন নং: &#123;&#123;bin&#125;&#125;</div>
              </div>

              <div v-if="activeTemplate?.ccItems && activeTemplate.ccItems.length > 0" class="border-top pt-3 mt-3">
                <div class="fw-bold small mb-1">অনুলিপিঃ</div>
                <ol class="small mb-0 ps-3">
                  <li v-for="(cc, i) in activeTemplate.ccItems" :key="i">{{ cc }}</li>
                </ol>
              </div>
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-secondary" @click="closeModal">Close</button>
            <button v-if="isEditing" type="button" class="btn btn-primary" @click="saveTemplate" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              {{ saving ? 'Saving...' : 'Save Template' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import axios from "@/plugins/axios";
import VariableBar from "./components/VariableBar.vue";

const router = useRouter();

const templates = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const showModal = ref(false);
const isEditing = ref(false);
const activeTemplate = ref<any>(null);
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null);

const currentForm = ref<any>({
  id: null,
  title: "",
  category: "non-filer-notice",
  subject: "",
  reference: "",
  bodyHtml: "",
  description: "",
  ccItems: []
});

const loadTemplates = async () => {
  loading.value = true;
  try {
    const res = await axios.get("/api/letter-templates");
    templates.value = res.data?.data || [];
  } catch (err) {
    console.error("Failed to load letter templates:", err);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  const routeData = router.resolve({
    name: "admin-letter-templates-create"
  });
  window.open(routeData.href, "_blank");
};

const openEditModal = (tpl: any) => {
  const routeData = router.resolve({
    name: "admin-letter-templates-edit",
    params: { id: tpl.id }
  });
  window.open(routeData.href, "_blank");
};

const openPreviewModal = (tpl: any) => {
  const routeData = router.resolve({
    name: "admin-letter-templates-edit",
    params: { id: tpl.id },
    query: { preview: "true" }
  });
  window.open(routeData.href, "_blank");
};

import { authUser } from "@/composables/useAuth";

const canEditTemplate = (tpl: any) => {
  // If user is admin, can edit all. If normal user, can edit their own customized templates
  if (authUser.value?.role?.name === "admin" || authUser.value?.role?.name === "superadmin") {
    return true;
  }
  return Boolean(tpl.userId && tpl.userId === authUser.value?.id);
};

const cloneTemplate = (tpl: any) => {
  const routeData = router.resolve({
    name: "admin-letter-templates-create",
    query: { cloneFrom: tpl.id }
  });
  window.open(routeData.href, "_blank");
};

const closeModal = () => {
  showModal.value = false;
};

const addCcRow = () => {
  if (!Array.isArray(currentForm.value.ccItems)) {
    currentForm.value.ccItems = [];
  }
  currentForm.value.ccItems.push("");
};

const removeCcRow = (idx: number) => {
  currentForm.value.ccItems.splice(idx, 1);
};

const insertVariableIntoBody = (varKey: string) => {
  const textarea = bodyTextareaRef.value;
  const tag = `{{${varKey}}}`;
  if (!textarea) {
    currentForm.value.bodyHtml += tag;
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentText = currentForm.value.bodyHtml || "";
  currentForm.value.bodyHtml = currentText.substring(0, start) + tag + currentText.substring(end);

  // Reposition cursor right after inserted tag
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }, 50);
};

const saveTemplate = async () => {
  if (!currentForm.value.title.trim()) {
    alert("Please enter a template title.");
    return;
  }
  if (!currentForm.value.bodyHtml.trim()) {
    alert("Please enter the letter body content.");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: currentForm.value.title,
      category: currentForm.value.category || "non-filer-notice",
      subject: currentForm.value.subject,
      reference: currentForm.value.reference,
      bodyHtml: currentForm.value.bodyHtml,
      description: currentForm.value.description,
      ccItems: currentForm.value.ccItems.filter((s: string) => s?.trim())
    };

    if (currentForm.value.id) {
      await axios.put(`/api/letter-templates/${currentForm.value.id}`, payload);
    } else {
      await axios.post("/api/letter-templates", payload);
    }
    showModal.value = false;
    await loadTemplates();
  } catch (err) {
    console.error("Failed to save template:", err);
    alert("Failed to save template.");
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadTemplates();
});
</script>

<style scoped>
.bg-surface {
  background-color: #1e2227;
}
.border-custom {
  border-color: #2d3239 !important;
}
.hover-card {
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.hover-card:hover {
  transform: translateY(-3px);
  border-color: #dc3545 !important;
}
.form-dark-input {
  background-color: #121519 !important;
  color: #ffffff !important;
}
.form-dark-input:focus {
  background-color: #181c22 !important;
  color: #ffffff !important;
  border-color: #dc3545 !important;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
}
.body-editor {
  font-family: 'SolaimanLipi', 'Kalpurush', 'Nikosh', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  color: #ffffff !important;
  text-align: justify !important;
  text-justify: inter-word !important;
}
</style>
