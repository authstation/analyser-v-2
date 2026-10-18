<template>
  <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.8); z-index: 1060;">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content bg-dark text-light border-secondary">
        
        <!-- Header -->
        <div class="modal-header border-secondary d-print-none">
          <div class="d-flex align-items-center gap-2">
            <h5 class="modal-title fw-bold text-light mb-0">
              <i class="bi bi-file-earmark-richtext text-danger me-2"></i>Issue Official Letter (পত্র প্রস্তুতকরণ)
            </h5>
            <span class="badge bg-secondary font-monospace">BIN: {{ entity?.bin }}</span>
          </div>
          <div class="d-flex align-items-center gap-2 ms-auto">
            <button class="btn btn-sm btn-outline-warning" @click="resetToDefault" title="Reset to admin default template">
              <i class="bi bi-arrow-counterclockwise me-1"></i> Reset to Default
            </button>
            <button class="btn btn-sm btn-outline-info" @click="saveDraft" :disabled="saving">
              <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-save me-1"></i> Save for Me
            </button>
            <button class="btn btn-sm btn-success" @click="printLetter">
              <i class="bi bi-printer me-1"></i> Print / PDF
            </button>
            <button type="button" class="btn-close btn-close-white ms-2" @click="closeModal"></button>
          </div>
        </div>

        <div class="modal-body p-4 bg-dark">
          
          <!-- Template Selection Dropdown if multiple templates -->
          <div class="row g-3 mb-3 d-print-none align-items-center bg-black p-3 rounded border border-secondary" v-if="templates.length > 1">
            <div class="col-md-3">
              <label class="small text-muted fw-bold">Select Letter Template:</label>
            </div>
            <div class="col-md-9">
              <select class="form-select form-select-sm bg-dark text-light border-secondary" v-model="selectedTemplateId" @change="onTemplateChange">
                <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.title }}</option>
              </select>
            </div>
          </div>

          <!-- Dynamic Variable Insertion Bar -->
          <div class="d-print-none">
            <VariableBar @insert="insertVariable" />
          </div>

          <!-- The Official Letter Paper (A4 Printable Area) -->
          <div class="official-paper p-4 p-sm-5 bg-white text-dark rounded shadow-sm mx-auto" style="max-width: 850px; font-family: 'SolaimanLipi', 'Kalpurush', 'Nikosh', 'Arial', sans-serif;">
            
            <!-- Government Monogram & Empty Office Info -->
            <div class="text-center mb-3">
              <img src="/logo-favicon/bd-logo.png" alt="Govt Logo" style="height: 60px; width: 60px; object-fit: contain;" class="mb-1" onerror="this.style.display='none'" />
              <div class="fw-bold fs-5 text-dark">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
              
              <!-- Editable Office Name (Blank by default) -->
              <input 
                type="text" 
                class="form-control text-center fw-bold border-0 border-bottom border-light-subtle rounded-0 p-1 letter-input" 
                placeholder="[অফিসের নাম ও বিভাগ লিখুন, যেমন: কাস্টমস, এক্সাইজ ও ভ্যাট বিভাগ, ব্রাহ্মণবাড়িয়া]" 
                v-model="letterData.officeName" 
              />
              
              <!-- Editable Address & Email (Blank by default) -->
              <input 
                type="text" 
                class="form-control text-center small text-muted border-0 border-bottom border-light-subtle rounded-0 p-1 mt-1 letter-input" 
                placeholder="[অফিসের ঠিকানা লিখুন, যেমন: বাড়ি নং- ১৩৫৭/ক, মা টাওয়ার, ব্রাহ্মণবাড়িয়া]" 
                v-model="letterData.officeAddress" 
              />
              <input 
                type="text" 
                class="form-control text-center small text-muted border-0 rounded-0 p-1 letter-input" 
                placeholder="[ইমেইল ও যোগাযোগ লিখুন, যেমন: cevc.bbariadivision@gmail.com]" 
                v-model="letterData.officeEmail" 
              />
            </div>

            <!-- File No and Date Bar -->
            <div class="d-flex justify-content-between align-items-center mb-3 mt-4 gap-3">
              <div class="d-flex align-items-center" style="flex: 1;">
                <span class="fw-bold me-2 text-nowrap">নথি নং:</span>
                <input type="text" class="form-control form-control-sm border-0 border-bottom border-secondary rounded-0 p-0 letter-input" placeholder="নথি বা স্মারক নম্বর লিখুন" v-model="letterData.fileNo" />
              </div>
              <div class="d-flex align-items-center" style="width: 250px;">
                <span class="fw-bold me-2 text-nowrap">তারিখ:</span>
                <input type="text" class="form-control form-control-sm border-0 border-bottom border-secondary rounded-0 p-0 letter-input" placeholder="তারিখ লিখুন" v-model="letterData.letterDate" />
              </div>
            </div>

            <!-- Subject & Reference -->
            <div class="mb-3">
              <div class="d-flex align-items-baseline mb-2">
                <span class="fw-bold me-2 text-nowrap">বিষয়:</span>
                <input type="text" class="form-control fw-bold border-0 border-bottom border-secondary rounded-0 p-0 letter-input" v-model="letterData.subject" placeholder="পত্রের বিষয় লিখুন" />
              </div>
              <div class="d-flex align-items-baseline">
                <span class="fw-bold me-2 text-nowrap small">সূত্র:</span>
                <input type="text" class="form-control small border-0 border-bottom border-secondary rounded-0 p-0 letter-input" v-model="letterData.reference" placeholder="সূত্র উল্লেখ করুন" />
              </div>
            </div>

            <!-- Main Body Paragraphs (Editable with dynamic values) -->
            <div class="mb-4 mt-4">
              <textarea 
                ref="letterBodyTextarea"
                rows="14" 
                class="form-control border-0 p-2 letter-body-textarea" 
                style="resize: vertical; line-height: 1.8; text-align: justify; font-size: 1rem; color: #111;"
                v-model="letterData.body"
              ></textarea>
            </div>

            <!-- Primary Signatory Block (Right Aligned) -->
            <div class="d-flex justify-content-end text-center mt-5 mb-4">
              <div style="min-width: 260px;">
                <input type="text" class="form-control text-center fw-bold border-0 border-bottom border-light-subtle rounded-0 p-1 letter-input" placeholder="[স্বাক্ষরকারীর নাম]" v-model="letterData.signatoryName" />
                <input type="text" class="form-control text-center small text-muted border-0 border-bottom border-light-subtle rounded-0 p-1 letter-input" placeholder="[পদবী, যেমন: সহকারী কমিশনার]" v-model="letterData.signatoryDesignation" />
                <input type="text" class="form-control text-center small text-muted border-0 rounded-0 p-1 letter-input" placeholder="[বিভাগ / অতিরিক্ত দায়িত্ব]" v-model="letterData.signatoryDepartment" />
              </div>
            </div>

            <!-- Recipient (Entity Details) -->
            <div class="border-top border-dark pt-3 mt-4">
              <div class="fw-bold small mb-1">প্রাপক:</div>
              <div class="d-flex align-items-baseline mb-1">
                <span class="me-2 text-nowrap">মেসার্স</span>
                <input type="text" class="form-control form-control-sm border-0 border-bottom border-light-subtle rounded-0 p-0 fw-bold letter-input" v-model="letterData.recipientName" />
              </div>
              <div class="d-flex align-items-baseline mb-1">
                <span class="me-2 text-nowrap">ঠিকানা:</span>
                <input type="text" class="form-control form-control-sm border-0 border-bottom border-light-subtle rounded-0 p-0 letter-input" v-model="letterData.recipientAddress" />
              </div>
              <div class="d-flex align-items-baseline">
                <span class="me-2 text-nowrap">নিবন্ধন নং:</span>
                <input type="text" class="form-control form-control-sm border-0 border-bottom border-light-subtle rounded-0 p-0 font-monospace letter-input" v-model="letterData.recipientBin" />
              </div>
            </div>

            <!-- Copy to / CC Section (Dynamic & Checkbox controlled) -->
            <div class="mt-4 pt-3 border-top border-dark">
              <div class="d-flex justify-content-between align-items-center mb-2 d-print-none">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="ccSwitch" v-model="letterData.includeCc">
                  <label class="form-check-label small fw-bold" for="ccSwitch">অনুলিপি অন্তর্ভুক্ত করুন (Include CC)</label>
                </div>
                <button v-if="letterData.includeCc" class="btn btn-xs btn-outline-primary py-0 px-2" @click="addCcItem">
                  <i class="bi bi-plus"></i> অনুলিপি যোগ করুন
                </button>
              </div>

              <div v-if="letterData.includeCc">
                <!-- Editable CC Header (e.g. সদয় অবগতি ও পরবর্তী কার্যার্থে) -->
                <input 
                  type="text" 
                  class="form-control fw-bold border-0 border-bottom border-light-subtle rounded-0 p-0 mb-2 letter-input" 
                  placeholder="[অনুলিপির শিরোনাম, যেমন: অনুলিপি সদয় অবগতির জন্যঃ / সদয় অবগতি ও পরবর্তী কার্যার্থেঃ]" 
                  v-model="letterData.ccHeading" 
                />

                <div v-for="(cc, idx) in letterData.ccItems" :key="idx" class="d-flex align-items-center gap-2 mb-1">
                  <span class="small font-monospace text-muted">{{ Number(idx) + 1 }}।</span>
                  <input type="text" class="form-control form-control-sm border-0 border-bottom border-light-subtle rounded-0 p-0 letter-input" v-model="letterData.ccItems[Number(idx)]" placeholder="অনুলিপি প্রাপকের নাম ও ঠিকানা লিখুন" />
                  <button type="button" class="btn btn-sm btn-link text-danger p-0 d-print-none" @click="removeCcItem(Number(idx))" title="Remove">
                    <i class="bi bi-x"></i>
                  </button>
                </div>

                <!-- Secondary Signatory for CC -->
                <div class="d-flex justify-content-end text-center mt-4">
                  <div style="min-width: 240px;">
                    <input type="text" class="form-control text-center fw-bold border-0 border-bottom border-light-subtle rounded-0 p-1 letter-input" placeholder="[স্বাক্ষরকারী]" v-model="letterData.ccSignatoryName" />
                    <input type="text" class="form-control text-center small text-muted border-0 rounded-0 p-1 letter-input" placeholder="[পদবী]" v-model="letterData.ccSignatoryDesignation" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div class="modal-footer border-secondary d-print-none">
          <button type="button" class="btn btn-secondary" @click="closeModal">Close</button>
          <button type="button" class="btn btn-success" @click="printLetter">
            <i class="bi bi-printer me-1"></i> Print / Save as PDF
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import VariableBar from "@/pages/admin/letter-templates/components/VariableBar.vue";
import axios from "@/plugins/axios";

const props = defineProps<{
  show: boolean;
  entity: any;
}>();

const emit = defineEmits<(e: "close") => void>();

const templates = ref<any[]>([]);
const selectedTemplateId = ref<number | null>(null);
const saving = ref(false);
const letterBodyTextarea = ref<HTMLTextAreaElement | null>(null);

const letterData = ref<any>({
  officeName: "",
  officeAddress: "",
  officeEmail: "",
  fileNo: "",
  letterDate: new Date().toLocaleDateString("en-GB").replace(/\//g, "."),
  subject: "",
  reference: "",
  body: "",
  signatoryName: "",
  signatoryDesignation: "",
  signatoryDepartment: "",
  recipientName: "",
  recipientAddress: "",
  recipientBin: "",
  includeCc: true,
  ccHeading: "অনুলিপি সদয় অবগতির জন্যঃ",
  ccItems: ["কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট কমিশনারেট, কুমিল্লা।"],
  ccSignatoryName: "",
  ccSignatoryDesignation: ""
});

const loadTemplates = async () => {
  try {
    const res = await axios.get("/api/letter-templates");
    templates.value = res.data?.data || [];
    if (templates.value.length > 0 && !selectedTemplateId.value) {
      selectedTemplateId.value = templates.value[0].id;
      applyTemplateData(templates.value[0]);
    }
  } catch (err) {
    console.error("Failed to load templates", err);
  }
};

const applyTemplateData = (tpl: any) => {
  if (!tpl) return;
  letterData.value.subject = tpl.subject || "";
  letterData.value.reference = tpl.reference || "";

  // Replace dynamic tags with actual entity info
  let populatedBody = tpl.bodyHtml || "";
  if (props.entity) {
    const ent = props.entity;
    populatedBody = populatedBody
      .replace(/{{entity_name}}/g, ent.name || "")
      .replace(/{{bin}}/g, ent.bin || "")
      .replace(/{{address}}/g, ent.address || "")
      .replace(/{{mobile}}/g, ent.mobile || "")
      .replace(/{{non_filed_months_count}}/g, String(ent.grandTotalMonths || "১"))
      .replace(
        /{{reg_month_year}}/g,
        ent.issueDate ? new Date(ent.issueDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "জুলাই ২০২৬"
      )
      .replace(/{{circle_name}}/g, ent.circleName || "")
      .replace(/{{police_station}}/g, ent.policeStationName || "")
      .replace(/{{district}}/g, ent.divisionName || "");
  }

  letterData.value.body = populatedBody;

  if (tpl.signatoryTitle) letterData.value.signatoryName = tpl.signatoryTitle;
  if (tpl.signatorySubtitle) letterData.value.signatoryDesignation = tpl.signatorySubtitle;
  if (tpl.ccItems && Array.isArray(tpl.ccItems)) {
    letterData.value.ccItems = [...tpl.ccItems];
  }
};

const onTemplateChange = () => {
  const tpl = templates.value.find((t) => t.id === selectedTemplateId.value);
  if (tpl) applyTemplateData(tpl);
};

const addCcItem = () => {
  letterData.value.ccItems.push("");
};

const removeCcItem = (idx: number) => {
  letterData.value.ccItems.splice(idx, 1);
};

const insertVariable = (varKey: string) => {
  const textarea = letterBodyTextarea.value;
  const tag = `{{${varKey}}}`;
  if (!textarea) {
    letterData.value.body += tag;
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const current = letterData.value.body || "";
  letterData.value.body = current.substring(0, start) + tag + current.substring(end);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }, 50);
};

const resetToDefault = () => {
  if (confirm("Reset to default template? Any custom edits will be lost.")) {
    const tpl = templates.value.find((t) => t.id === selectedTemplateId.value) || templates.value[0];
    if (tpl) applyTemplateData(tpl);
  }
};

const saveDraft = async () => {
  saving.value = true;
  try {
    await axios.post("/api/letter-templates/draft", {
      templateId: selectedTemplateId.value,
      entityBin: props.entity?.bin || null,
      customData: letterData.value
    });
    alert("Draft saved successfully for this entity!");
  } catch (err) {
    console.error("Save draft error", err);
    alert("Failed to save draft.");
  } finally {
    saving.value = false;
  }
};

const printLetter = () => {
  window.print();
};

const closeModal = () => {
  emit("close");
};

watch(
  () => props.show,
  async (newVal) => {
    if (newVal) {
      await loadTemplates();
      if (props.entity) {
        letterData.value.recipientName = props.entity.name || "";
        letterData.value.recipientAddress = [props.entity.address, props.entity.policeStationName, props.entity.divisionName]
          .filter(Boolean)
          .join(", ");
        letterData.value.recipientBin = props.entity.bin || "";

        // Check if user has an existing saved draft for this BIN
        try {
          const res = await axios.get(`/api/letter-templates/draft?bin=${encodeURIComponent(props.entity.bin)}`);
          if (res.data?.data?.customData) {
            letterData.value = { ...letterData.value, ...res.data.data.customData };
          }
        } catch {}
      }
    }
  }
);
</script>

<style scoped>
.letter-input:focus,
.letter-body-textarea:focus {
  background-color: #f8f9fa !important;
  outline: none;
  box-shadow: 0 0 0 1px #ffc107 !important;
}

@media print {
  body * {
    visibility: hidden;
  }
  .official-paper, .official-paper * {
    visibility: visible;
  }
  .official-paper {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
  .d-print-none {
    display: none !important;
  }
}
</style>
