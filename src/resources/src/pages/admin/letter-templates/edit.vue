<template>
  <div class="container-fluid py-4 min-vh-100 bg-dark text-light letter-page-wrapper">
    <!-- Action Toolbar (Hidden when printing) -->
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3 d-print-none">
      <div>
        <button class="btn btn-outline-secondary btn-sm rounded-pill px-3" @click="goBack">
          <i class="bi bi-arrow-left me-1"></i> Back to Templates
        </button>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button type="button" class="btn btn-outline-warning" @click="resetToAdminDefault" title="এডমিনের মূল সেটাপে রিসেট করুন">
          <i class="bi bi-arrow-counterclockwise me-1"></i> রিসেট টু ডিফল্ট (Reset to Default)
        </button>
        <button class="btn btn-outline-secondary" @click="previewMode = !previewMode">
          <i :class="previewMode ? 'bi bi-pencil-square' : 'bi bi-eye'" class="me-1"></i>
          {{ previewMode ? 'Back to Editor' : 'Live Preview' }}
        </button>
        <button v-if="previewMode" class="btn btn-primary" @click="downloadWordDoc" title="Download as Microsoft Word (.doc)">
          <i class="bi bi-file-earmark-word me-1"></i> Word Download
        </button>
        <button v-if="previewMode" class="btn btn-success" @click="printTemplate" title="Print Letter / Save as PDF">
          <i class="bi bi-printer me-1"></i> Print / PDF
        </button>
        <button class="btn btn-primary px-4" @click="saveTemplate" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-check-circle me-1"></i> Save Template
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-danger" role="status"></div>
      <p class="text-muted mt-2">Loading template details...</p>
    </div>

    <div v-else class="row justify-content-center">
      <div class="col-12 col-xl-10">

        <!-- Editor Mode -->
        <div v-if="!previewMode" class="card bg-surface border-custom p-4 shadow-sm">
          <div class="row g-3 mb-3">
            <div class="col-md-8">
              <label class="form-label small text-muted">Template Title <span class="text-danger">*</span></label>
              <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. প্রদেয় ভ্যাট পরিশোধপূর্বক রিটার্ন দাখিলকরণ পত্র" v-model="form.title" />
            </div>
            <div class="col-md-4">
              <label class="form-label small text-muted">Category Slug</label>
              <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. non-filer-notice" v-model="form.category" />
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small text-muted">Description / Summary</label>
            <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="Short description for admin library" v-model="form.description" />
          </div>

          <!-- Office Pad Header Block -->
          <div class="card bg-surface border-custom p-3 mb-3">
            <div class="small fw-bold text-muted text-uppercase mb-2">
              <i class="bi bi-building me-1 text-warning"></i> দপ্তরের তথ্য (Office Header)
            </div>
            <div class="row g-2 mb-2">
              <div class="col-md-6">
                <label class="form-label small text-muted">দপ্তরের নাম ও বিভাগ</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. কাস্টমস, এক্সাইজ ও ভ্যাট বিভাগ, ব্রাহ্মণবাড়িয়া" v-model="form.officeName" />
              </div>
              <div class="col-md-6">
                <label class="form-label small text-muted">দপ্তরের ঠিকানা</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. বাড়ি নং- ১৩৫৭/ক, মা টাওয়ার, ব্রাহ্মণবাড়িয়া" v-model="form.officeAddress" />
              </div>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-md-6">
                <label class="form-label small text-muted">ইমেইল / যোগাযোগ</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. cevc.bbariadivision@gmail.com" v-model="form.officeEmail" />
              </div>
              <div class="col-md-6">
                <label class="form-label small text-muted">ডিফল্ট নথি নং (ঐচ্ছিক)</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. ০৮.০১.১২০০.০৬৮..." v-model="form.defaultFileNo" />
              </div>
            </div>

            <!-- Optional Secondary Logo (Right Side Logo) - 2 Columns: File Upload & URL -->
            <div class="border-top border-secondary pt-3 mt-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small fw-bold text-muted text-uppercase">
                  <i class="bi bi-image me-1 text-info"></i> অপশনাল লোগো (প্যাডের ডান পাশে বসবে)
                </span>
                <button 
                  v-if="form.secondaryLogo" 
                  type="button" 
                  class="btn btn-xs btn-outline-danger py-0 px-2" 
                  @click="clearSecondaryLogo"
                >
                  <i class="bi bi-trash me-1"></i> লোগো মুছুন
                </button>
              </div>

              <div class="row g-2 align-items-center">
                <!-- Column 1: Direct File Upload -->
                <div class="col-md-6">
                  <label class="form-label small text-muted mb-1">
                    ১. কম্পিউটার থেকে ফাইল আপলোড করুন
                    <span v-if="logoSource === 'url'" class="badge bg-secondary ms-1">ফ্রিজ করা আছে</span>
                  </label>
                  <input 
                    ref="logoFileInputRef"
                    type="file" 
                    class="form-control form-control-sm form-dark-input text-white border-secondary" 
                    accept="image/png, image/jpeg, image/svg+xml, image/webp" 
                    :disabled="logoSource === 'url'"
                    @change="handleSecondaryLogoUpload" 
                  />
                </div>

                <!-- Column 2: Image URL -->
                <div class="col-md-6">
                  <label class="form-label small text-muted mb-1">
                    ২. অথবা সরাসরি ছবির লিংক (URL) দিন
                    <span v-if="logoSource === 'file'" class="badge bg-secondary ms-1">ফ্রিজ করা আছে</span>
                  </label>
                  <input 
                    type="text" 
                    class="form-control form-control-sm form-dark-input text-white border-secondary" 
                    placeholder="https://example.com/logo.png" 
                    v-model="logoUrlInput" 
                    :disabled="logoSource === 'file'"
                    @input="handleLogoUrlInput"
                  />
                </div>
              </div>

              <!-- Preview Thumbnail if logo present -->
              <div v-if="form.secondaryLogo" class="d-flex align-items-center gap-2 mt-2 p-2 bg-dark rounded border border-secondary">
                <div class="bg-white p-1 rounded d-flex align-items-center justify-content-center" style="height: 48px; width: 48px;">
                  <img :src="form.secondaryLogo" alt="Secondary Logo" style="max-height: 40px; max-width: 40px; object-fit: contain;" />
                </div>
                <div class="small text-muted flex-grow-1">
                  লোগো সফলভাবে লোড হয়েছে। চিঠির প্যাডের উপরের ডান কোণায় প্রদর্শিত হবে।
                </div>
              </div>

              <div class="form-text text-muted" style="font-size: 0.75rem;">
                যেকোনো একটি পদ্ধতি ব্যবহার করুন (ফাইল আপলোড করলে URL ফিল্ড ফ্রিজ হবে, আর URL দিলে ফাইল ফিল্ড ফ্রিজ হবে)।
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small text-muted">বিষয়</label>
            <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. প্রদেয় ভ্যাট পরিশোধপূর্বক রিটার্ন দাখিলকরণ।" v-model="form.subject" />
          </div>

          <div class="mb-3">
            <label class="form-label small text-muted">সূত্র</label>
            <input type="text" class="form-control form-dark-input text-white border-secondary" placeholder="e.g. মূল্য সংযোজন কর ও সম্পূরক শুল্ক অধ্যাদেশ..." v-model="form.reference" />
          </div>

          <!-- Click to insert Dynamic Variable -->
          <div class="mb-3">
            <VariableBar @insert="insertVariableIntoBody" />
          </div>

          <div class="mb-4">
            <label class="form-label small text-muted d-flex justify-content-between align-items-center">
              <span>Letter Body / Paragraphs <span class="text-danger">*</span></span>
              <span class="text-muted" style="font-size: 0.75rem;">(Click above variable buttons to insert dynamic tokens at cursor)</span>
            </label>
            <textarea 
              ref="bodyTextareaRef"
              rows="15" 
              class="form-control form-dark-input text-white border-secondary body-editor font-bangla-letter" 
              :style="{ lineHeight: '1.5', fontSize: '1.25rem', textAlign: 'justify', textJustify: 'inter-word', fontFamily: selectedFont }"
              placeholder="Type letter body here..."
              v-model="form.bodyHtml"
            ></textarea>
          </div>

          <!-- Default Letter Signatory (স্বাক্ষরকারী) -->
          <div class="card bg-surface border-custom p-3 mb-3">
            <span class="small fw-bold text-muted text-uppercase mb-2 d-block">Default Signatory (মূল পত্রের স্বাক্ষরকারী)</span>
            <div class="row g-2">
              <div class="col-md-6">
                <label class="form-label small text-muted">স্বাক্ষরকারীর নাম</label>
                <input type="text" class="form-control form-dark-input text-white border-secondary" v-model="form.signatoryTitle" placeholder="e.g. (শেখ শাহির আহমেদ)" />
              </div>
              <div class="col-md-6">
                <label class="form-label small text-muted">পদবী ও বিভাগ (একাধিক পদবী নতুন লাইনে লিখুন)</label>
                <textarea rows="3" class="form-control form-dark-input text-white border-secondary" v-model="form.signatorySubtitle" placeholder="e.g. সহকারী কমিশনার&#10;ও&#10;বিভাগীয় কর্মকর্তা"></textarea>
              </div>
            </div>
          </div>

          <!-- Default CC Groups & CC Signatory -->
          <div class="card bg-surface border-custom p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <span class="small fw-bold text-muted text-uppercase d-block">Default CC Groups & Recipients (অনুলিপির তালিকা)</span>
                <span class="text-muted" style="font-size: 0.75rem;">বিভিন্ন উদ্দেশ্যে আলাদা গ্রুপ তৈরি করুন (যেমন: সদয় অবগতির জন্য / কার্যার্থে)। ক্রমিক নম্বর স্বয়ংক্রিয়ভাবে বসবে।</span>
              </div>
              <button type="button" class="btn btn-sm btn-outline-info py-1 px-3" @click="addCcGroup">
                <i class="bi bi-folder-plus me-1"></i> Add CC Group
              </button>
            </div>

            <!-- List of CC Groups -->
            <div v-for="(group, gIdx) in form.ccGroups" :key="gIdx" class="card bg-dark border-secondary p-3 mb-3">
              <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small text-info fw-bold mb-0">গ্রুপের শিরোনাম</label>
                  <button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" style="font-size: 0.8rem;" @click="removeCcGroup(Number(gIdx))" title="Remove Entire Group">
                    <i class="bi bi-trash me-1"></i> গ্রুপ মুছুন
                  </button>
                </div>
                <input 
                  type="text" 
                  class="form-control form-dark-input text-white border-secondary" 
                  v-model="group.heading" 
                  placeholder="e.g. অনুলিপি সদয় অবগতির জন্য: / অনুলিপি অবগতি ও প্রয়োজনীয় কার্যার্থে:" 
                />
              </div>

              <!-- Recipients in this group (Textarea for multiple lines) -->
              <div class="mt-2 ps-2 border-start border-2 border-info">
                <label class="form-label small text-muted mb-1">
                  এই গ্রুপের প্রাপক তালিকা (Enter দিয়ে প্রতিটি প্রাপক নিচে নিচে লিখুন, চিঠিতে ০১, ০২ স্বয়ংক্রিয়ভাবে বসবে)
                </label>
                <textarea 
                  rows="4" 
                  class="form-control form-dark-input text-white border-secondary font-bangla-letter" 
                  style="line-height: 1.4; font-size: 1.05rem;"
                  v-model="group.text"
                  placeholder="e.g. কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট কমিশনারেট, কুমিল্লা।&#10;যুগ্ম কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট কমিশনারেট, কুমিল্লা।"
                ></textarea>
              </div>
            </div>

            <div v-if="!form.ccGroups || form.ccGroups.length === 0" class="text-muted small fst-italic mb-2 p-2 bg-dark rounded border border-secondary text-center">
              কোনো অনুলিপি গ্রুপ যোগ করা হয়নি। অনুলিপি প্রয়োজন হলে 'Add CC Group' বাটনে ক্লিক করুন।
            </div>

            <!-- CC Signatory Inputs (Only shown if at least one CC group exists) -->
            <div v-if="form.ccGroups && form.ccGroups.length > 0" class="border-top border-secondary pt-3 mt-3">
              <span class="small fw-bold text-muted text-uppercase mb-2 d-block">CC Signatory (অনুলিপির স্বাক্ষরকারী - অপশনাল)</span>
              <div class="row g-2">
                <div class="col-md-6">
                  <label class="form-label small text-muted">অনুলিপির স্বাক্ষরকারীর নাম (খালি রাখলে মূল স্বাক্ষরকারী বসবে)</label>
                  <input type="text" class="form-control form-dark-input text-white border-secondary" v-model="form.ccSignatoryTitle" placeholder="e.g. (শেখ শাহির আহমেদ)" />
                </div>
                <div class="col-md-6">
                  <label class="form-label small text-muted">পদবী ও বিভাগ (একাধিক পদবী নতুন লাইনে লিখুন)</label>
                  <textarea rows="3" class="form-control form-dark-input text-white border-secondary" v-model="form.ccSignatorySubtitle" placeholder="e.g. সহকারী কমিশনার&#10;ও&#10;বিভাগীয় কর্মকর্তা"></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Preview Mode (Official Letter Layout - Exact A4 Sheet) -->
        <div 
          v-else 
          class="official-preview bg-white text-dark shadow mx-auto mb-5 position-relative" 
          style="width: 210mm; min-height: 297mm; padding: 0.6in 0.7in; font-size: 12pt; line-height: 1.4; font-family: 'NikoshBAN', 'Nikosh', sans-serif; box-sizing: border-box;"
        >
          <!-- Top Header Row: Centered Govt Header with Optional Right Logo -->
          <div class="position-relative mb-3">
            <!-- Optional Secondary Logo (Positioned right-0 top-0 in container flow) -->
            <div v-if="form.secondaryLogo" class="position-absolute end-0 top-0 d-flex justify-content-end" style="width: 90px;">
              <img :src="form.secondaryLogo" alt="Secondary Logo" style="height: 60px; max-width: 80px; object-fit: contain;" />
            </div>

            <!-- Government Monogram & Office Header (Centered) -->
            <div class="text-center" style="line-height: 1.25; padding: 0 90px;">
              <img src="/logo-favicon/bd-logo.svg" alt="Govt Logo" style="height: 60px; width: 60px; object-fit: contain;" class="mb-1 d-inline-block" />
              <div class="text-dark" style="font-size: 12pt; font-weight: normal; margin-bottom: 2px;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
              <div class="text-dark fw-bold" style="font-size: 12pt; margin-bottom: 2px;">{{ form.officeName || '[দপ্তরের নাম ও বিভাগ]' }}</div>
              <div class="text-dark" style="font-size: 12pt; margin-bottom: 2px;" v-if="form.officeAddress">{{ form.officeAddress }}</div>
              <div class="text-dark" style="font-size: 12pt;" v-if="form.officeEmail">ইমেইল: {{ form.officeEmail }}</div>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-baseline mb-3" style="font-size: 12pt;">
            <div><strong>নথি নং:</strong> {{ form.defaultFileNo || '—' }}</div>
            <div><strong>তারিখ:</strong> {{ new Date().toLocaleDateString("en-GB").replace(/\//g, ".") }} খ্রিষ্টাব্দ</div>
          </div>

          <div class="mb-2" style="line-height: 1.35;">
            <!-- বিষয়: সবসময় বোল্ড, 12pt -->
            <div class="d-flex align-items-baseline mb-1" style="font-size: 12pt;">
              <span class="fw-bold text-nowrap" style="width: 50px; min-width: 50px; display: inline-block;">বিষয়:</span>
              <div class="fw-bold text-dark flex-grow-1" style="font-size: 12pt; text-align: justify; text-justify: inter-word;">
                {{ form.subject || '-' }}
              </div>
            </div>
            <!-- সূত্র: 12pt -->
            <div class="d-flex align-items-baseline" style="font-size: 12pt;" v-if="form.reference">
              <span class="fw-bold text-dark text-nowrap" style="width: 50px; min-width: 50px; display: inline-block;">সূত্র:</span>
              <div class="text-dark flex-grow-1" style="font-size: 12pt; text-align: justify; text-justify: inter-word;">
                {{ form.reference }}
              </div>
            </div>
          </div>

          <div class="body-content my-2" style="font-size: 12pt; line-height: 1.3; text-align: justify; text-justify: inter-word;">
            <template v-for="(para, pIdx) in previewParagraphs" :key="pIdx">
              <div 
                v-if="parseParagraph(para).prefix" 
                class="d-flex align-items-baseline"
                style="margin-bottom: 5px;"
              >
                <span class="text-nowrap" style="width: 50px; min-width: 50px; display: inline-block;">{{ parseParagraph(para).prefix }}</span>
                <div class="flex-grow-1" style="text-align: justify; text-justify: inter-word;" v-html="renderParaHtml(parseParagraph(para).content)"></div>
              </div>
              <div 
                v-else 
                style="margin-bottom: 5px; padding-left: 50px; text-align: justify; text-justify: inter-word;"
                v-html="renderParaHtml(para)"
              ></div>
            </template>
          </div>

          <!-- Primary Signatory Block (Right Aligned, multi-line designation) -->
          <div class="d-flex justify-content-end text-center mt-3 mb-1">
            <div style="min-width: 240px; line-height: 1.25;">
              <div class="fw-bold mb-1" style="font-size: 12pt;">{{ form.signatoryTitle || '(শেখ শাহির আহমেদ)' }}</div>
              <div v-for="(line, lIdx) in (form.signatorySubtitle || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').split('\n')" :key="lIdx" class="text-dark" style="font-size: 12pt;">
                {{ line.trim() }}
              </div>
            </div>
          </div>

          <!-- Recipient -->
          <div class="mt-0 mb-2 text-dark" style="line-height: 1.35; font-family: 'NikoshBAN', 'Nikosh', sans-serif;">
            <div class="fw-bold" style="font-size: 9pt;">মেসার্স &#123;&#123;entity_name&#125;&#125;</div>
            <div style="font-size: 10pt;">ঠিকানা: &#123;&#123;address&#125;&#125;</div>
            <div style="font-size: 10pt;">নিবন্ধন নং: &#123;&#123;bin&#125;&#125;</div>
          </div>

          <!-- CC Section & CC Signatory (Group-based rendering) -->
          <div 
            v-if="form.ccGroups && form.ccGroups.length > 0" 
            class="cc-section-block mt-2" 
            style="font-family: 'NikoshBAN', 'Nikosh', sans-serif; break-inside: avoid; page-break-inside: avoid;"
          >
            <!-- Header File No & Date for CC Section -->
            <div class="d-flex justify-content-between align-items-baseline mb-2" style="font-size: 12pt;">
              <div>নথি নং- {{ form.defaultFileNo || '—' }}</div>
              <div>তারিখ : {{ new Date().toLocaleDateString("en-GB").replace(/\//g, ".") }} খ্রিষ্টাব্দ</div>
            </div>

            <!-- CC Groups Iteration -->
            <div v-for="(group, gIdx) in form.ccGroups" :key="gIdx" class="mb-2">
              <div class="fw-bold mb-1" style="font-size: 12pt;">
                <u>{{ group.heading }}</u>
              </div>
              <div 
                v-for="(item, iIdx) in getGroupItems(group)" 
                :key="iIdx" 
                class="d-flex align-items-baseline"
                style="font-size: 12pt; line-height: 1.3; margin-bottom: 3px;"
              >
                <span class="text-nowrap" style="width: 35px; min-width: 35px; display: inline-block;">{{ formatBnIndex(iIdx) }}</span>
                <div class="flex-grow-1" style="text-align: justify; text-justify: inter-word;">
                  {{ item }}
                </div>
              </div>
            </div>

            <!-- CC Signatory (Right Aligned) -->
            <div class="d-flex justify-content-end text-center mt-4">
              <div style="min-width: 240px; line-height: 1.25;">
                <div class="fw-bold mb-1" style="font-size: 12pt;">{{ form.ccSignatoryTitle || form.signatoryTitle || '(শেখ শাহির আহমেদ)' }}</div>
                <div v-for="(line, lIdx) in (form.ccSignatorySubtitle || form.signatorySubtitle || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').split('\n')" :key="lIdx" class="text-dark" style="font-size: 12pt;">
                  {{ line.trim() }}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "@/plugins/axios";
import VariableBar from "./components/VariableBar.vue";

const route = useRoute();
const router = useRouter();

const templateId = computed(() => (route.params.id ? Number(route.params.id) : null));
const isNew = computed(() => !templateId.value);

const loading = ref(false);
const saving = ref(false);
const previewMode = ref(false);
const selectedFont = ref<string>("'NikoshBAN', 'Nikosh', sans-serif");
const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null);

const formatBnIndex = (index: number | string) => {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const num = Number(index) + 1;
  const numStr = num < 10 ? `0${num}` : `${num}`;
  return numStr.split("").map((d) => bnDigits[Number(d)] || d).join("") + "।";
};

const form = ref<any>({
  id: null,
  title: "",
  category: "non-filer-notice",
  officeName: "",
  officeAddress: "",
  officeEmail: "",
  defaultFileNo: "",
  secondaryLogo: "",
  subject: "",
  reference: "",
  bodyHtml: "",
  description: "",
  signatoryTitle: "(শেখ শাহির আহমেদ)",
  signatorySubtitle: "সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা",
  ccSignatoryTitle: "",
  ccSignatorySubtitle: "",
  ccGroups: [
    {
      heading: "অনুলিপি সদয় অবগতির জন্য:",
      items: ["কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট কমিশনারেট, কুমিল্লা।"]
    }
  ]
});

const logoFileInputRef = ref<HTMLInputElement | null>(null);
const logoUrlInput = ref<string>("");
const logoSource = ref<"file" | "url" | "none">("none");

const handleSecondaryLogoUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) {
    if (logoSource.value === "file") {
      clearSecondaryLogo();
    }
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    form.value.secondaryLogo = event.target?.result as string;
    logoSource.value = "file";
    logoUrlInput.value = "";
  };
  reader.readAsDataURL(file);
};

const handleLogoUrlInput = () => {
  const url = logoUrlInput.value.trim();
  if (url) {
    form.value.secondaryLogo = url;
    logoSource.value = "url";
    if (logoFileInputRef.value) {
      logoFileInputRef.value.value = "";
    }
  } else {
    form.value.secondaryLogo = "";
    logoSource.value = "none";
  }
};

const clearSecondaryLogo = () => {
  form.value.secondaryLogo = "";
  logoSource.value = "none";
  logoUrlInput.value = "";
  if (logoFileInputRef.value) {
    logoFileInputRef.value.value = "";
  }
};

const previewParagraphs = computed(() => {
  const text = form.value.bodyHtml || "";
  return text
    .split(/\n+/)
    .map((p: string) => p.trim())
    .filter(Boolean);
});

const parseParagraph = (para: string) => {
  if (!para) return { prefix: "", content: "" };
  // Check if paragraph starts with a number (Bengali or English), e.g. "০২।", "২।", "02.", "2."
  const match = para.match(/^([০-৯0-9]+\s*[।.)\-]\s*)(.*)$/s);
  if (match) {
    return {
      prefix: match[1].trim(),
      content: match[2].trim()
    };
  }
  return {
    prefix: "",
    content: para
  };
};

const renderParaHtml = (para: string) => {
  if (!para) return "";
  return para.replace(
    /(\[[^\]]+\])/g,
    '<span class="text-primary fw-bold">$1</span>'
  );
};

const getGroupItems = (group: any): string[] => {
  if (group.text !== undefined) {
    return group.text
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(group.items)) {
    return group.items.map((s: string) => String(s || "").trim()).filter(Boolean);
  }
  return [];
};

const normalizeCcGroups = (raw: any): any[] => {
  if (!raw || !Array.isArray(raw)) return [];
  // If already in structured group format [{ heading, items }]
  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "heading" in raw[0]) {
    return raw.map((g: any) => ({
      heading: g.heading || "",
      text: Array.isArray(g.items) ? g.items.join("\n") : (g.text || "")
    }));
  }
  // If legacy flat strings e.g. ["কমিশনার..."]
  if (raw.length > 0 && typeof raw[0] === "string") {
    return [
      {
        heading: "অনুলিপি সদয় অবগতির জন্য:",
        text: raw.filter(Boolean).join("\n")
      }
    ];
  }
  return [];
};

const loadTemplate = async () => {
  if (route.query.preview === "true") {
    previewMode.value = true;
  }
  const sourceId = route.query.cloneFrom ? Number(route.query.cloneFrom) : templateId.value;
  if (!sourceId && isNew.value) return;
  loading.value = true;
  try {
    const res = await axios.get(`/api/letter-templates/${sourceId}`);
    if (res.data?.data) {
      const data = res.data.data;
      const isCloning = Boolean(route.query.cloneFrom);
      form.value = {
        id: isCloning ? null : data.id,
        title: isCloning ? `${data.title} (আমার কাস্টমাইজড)` : (data.title || ""),
        category: data.category || "non-filer-notice",
        officeName: data.officeName || "",
        officeAddress: data.officeAddress || "",
        officeEmail: data.officeEmail || "",
        defaultFileNo: data.defaultFileNo || "",
        secondaryLogo: data.secondaryLogo || "",
        subject: data.subject || "",
        reference: data.reference || "",
        bodyHtml: data.bodyHtml || "",
        description: data.description || "",
        signatoryTitle: data.signatoryTitle || "(শেখ শাহির আহমেদ)",
        signatorySubtitle: data.signatorySubtitle || "সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা",
        ccSignatoryTitle: data.ccSignatoryTitle || "",
        ccSignatorySubtitle: data.ccSignatorySubtitle || "",
        ccGroups: normalizeCcGroups(data.ccItems)
      };

      if (data.secondaryLogo) {
        if (data.secondaryLogo.startsWith("http://") || data.secondaryLogo.startsWith("https://")) {
          logoSource.value = "url";
          logoUrlInput.value = data.secondaryLogo;
        } else {
          logoSource.value = "file";
        }
      } else {
        logoSource.value = "none";
        logoUrlInput.value = "";
      }
    }
  } catch (err) {
    console.error("Failed to load template", err);
    alert("Template not found.");
    router.push("/admin/letter-templates");
  } finally {
    loading.value = false;
  }
};

const resetToAdminDefault = async () => {
  if (!confirm("আপনি কি নিশ্চিত যে এই টেমপ্লেটের সকল তথ্য রিসেট করে এডমিনের মূল ডিফল্ট সেটাপে ফেরত নিতে চান?")) {
    return;
  }
  loading.value = true;
  try {
    const res = await axios.get("/api/letter-templates");
    const list = res.data?.data || [];
    // Find the base admin default template (userId is null or first created template)
    const adminDefault = list.find((t: any) => !t.userId) || list[list.length - 1] || list[0];
    if (!adminDefault) {
      alert("এডমিনের কোনো মূল ডিফল্ট টেমপ্লেট পাওয়া যায়নি।");
      return;
    }

    form.value.officeName = adminDefault.officeName || "";
    form.value.officeAddress = adminDefault.officeAddress || "";
    form.value.officeEmail = adminDefault.officeEmail || "";
    form.value.defaultFileNo = adminDefault.defaultFileNo || "";
    form.value.secondaryLogo = adminDefault.secondaryLogo || "";
    form.value.subject = adminDefault.subject || "";
    form.value.reference = adminDefault.reference || "";
    form.value.bodyHtml = adminDefault.bodyHtml || "";
    form.value.signatoryTitle = adminDefault.signatoryTitle || "(শেখ শাহির আহমেদ)";
    form.value.signatorySubtitle = adminDefault.signatorySubtitle || "সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা";
    form.value.ccSignatoryTitle = adminDefault.ccSignatoryTitle || "";
    form.value.ccSignatorySubtitle = adminDefault.ccSignatorySubtitle || "";
    form.value.ccGroups = normalizeCcGroups(adminDefault.ccItems);

    if (adminDefault.secondaryLogo) {
      if (adminDefault.secondaryLogo.startsWith("http://") || adminDefault.secondaryLogo.startsWith("https://")) {
        logoSource.value = "url";
        logoUrlInput.value = adminDefault.secondaryLogo;
      } else {
        logoSource.value = "file";
      }
    } else {
      logoSource.value = "none";
      logoUrlInput.value = "";
    }

    alert("এডমিনের মূল সেটাপ সফলভাবে রিস্টোর করা হয়েছে। প্রয়োজনমতো পরিবর্তন করে 'Save Template' এ ক্লিক করুন।");
  } catch (err) {
    console.error("Failed to reset to admin default", err);
    alert("এডমিনের মূল সেটাপ লোড করতে ব্যর্থ হয়েছে।");
  } finally {
    loading.value = false;
  }
};

const insertVariableIntoBody = (varKey: string) => {
  const textarea = bodyTextareaRef.value;
  const tag = `{{${varKey}}}`;
  if (!textarea) {
    form.value.bodyHtml += tag;
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = form.value.bodyHtml;
  form.value.bodyHtml = text.substring(0, start) + tag + text.substring(end);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + tag.length, start + tag.length);
  }, 50);
};

const addCcGroup = () => {
  if (!form.value.ccGroups) form.value.ccGroups = [];
  form.value.ccGroups.push({
    heading: "অনুলিপি সদয় অবগতির জন্য:",
    text: ""
  });
};

const removeCcGroup = (gIdx: number) => {
  form.value.ccGroups.splice(gIdx, 1);
};

const saveTemplate = async () => {
  if (!form.value.title.trim()) {
    alert("Please provide a Template Title.");
    return;
  }
  if (!form.value.bodyHtml.trim()) {
    alert("Please provide Letter Body content.");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      title: form.value.title,
      category: form.value.category,
      officeName: form.value.officeName,
      officeAddress: form.value.officeAddress,
      officeEmail: form.value.officeEmail,
      defaultFileNo: form.value.defaultFileNo,
      secondaryLogo: form.value.secondaryLogo || null,
      subject: form.value.subject,
      reference: form.value.reference,
      bodyHtml: form.value.bodyHtml,
      description: form.value.description,
      signatoryTitle: form.value.signatoryTitle || null,
      signatorySubtitle: form.value.signatorySubtitle || null,
      ccSignatoryTitle: form.value.ccSignatoryTitle || null,
      ccSignatorySubtitle: form.value.ccSignatorySubtitle || null,
      ccItems: form.value.ccGroups.map((g: any) => ({
        heading: g.heading,
        items: getGroupItems(g)
      }))
    };

    console.log("Saving letter template payload:", payload);
    if (form.value.id) {
      await axios.put(`/api/letter-templates/${form.value.id}`, payload);
    } else {
      await axios.post("/api/letter-templates", payload);
    }
    alert("Template saved successfully!");
    router.push("/admin/letter-templates");
  } catch (err: any) {
    console.error("Failed to save template:", err);
    const msg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to save template.";
    alert("Error: " + JSON.stringify(msg));
  } finally {
    saving.value = false;
  }
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/admin/letter-templates");
  }
};

const printTemplate = () => {
  window.print();
};

const downloadWordDoc = () => {
  const f = form.value;
  const fileName = `Template_${f.id || 'draft'}_${new Date().toISOString().slice(0, 10)}.doc`;

  // Build body HTML paragraphs
  const paragraphs = (f.bodyHtml || "").split("\n\n").filter(Boolean);
  const bodyParasHtml = paragraphs.map((p: string) => {
    const parsed = parseParagraph(p);
    if (parsed.prefix) {
      return `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 5pt;">
          <tr>
            <td style="width: 32pt; vertical-align: top; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; padding: 0; line-height: 1.3;">
              ${parsed.prefix}
            </td>
            <td style="text-align: justify; text-justify: inter-word; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; padding: 0; line-height: 1.3;">
              ${parsed.content}
            </td>
          </tr>
        </table>
      `;
    }
    return `
      <p style="margin-left: 32pt; margin-bottom: 5pt; text-align: justify; text-justify: inter-word; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; line-height: 1.3;">
        ${p}
      </p>
    `;
  }).join("");

  // Signatory subtitle lines (tight line spacing)
  const sigSubLines = (f.signatorySubtitle || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা')
    .split("\n")
    .map((s: string) => s.trim())
    .filter(Boolean)
    .join("<br/>");

  // Primary Signatory HTML
  const primarySigHtml = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 14pt; margin-bottom: 4pt;">
      <tr>
        <td style="width: 55%;"></td>
        <td style="width: 45%; text-align: center; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">
          <div style="font-weight: bold; margin-bottom: 2pt; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${f.signatoryTitle || '(শেখ শাহির আহমেদ)'}</div>
          <div style="font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${sigSubLines}</div>
        </td>
      </tr>
    </table>
  `;

  // Recipient HTML
  const recipientHtml = `
    <div style="margin-top: 6pt; margin-bottom: 10pt; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; line-height: 1.35;">
      <div style="font-weight: bold; font-size: 9pt;">মেসার্স {{entity_name}}</div>
      <div style="font-size: 10pt;">ঠিকানা: {{address}}</div>
      <div style="font-size: 10pt;">নিবন্ধন নং: {{bin}}</div>
    </div>
  `;

  // CC Section HTML
  let ccSectionHtml = "";
  if (f.ccGroups && f.ccGroups.length > 0) {
    const groupsHtml = f.ccGroups.map((g: any) => {
      const items = getGroupItems(g);
      const itemsHtml = items.map((it: string, idx: number) => `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 3pt;">
          <tr>
            <td style="width: 25pt; vertical-align: top; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; line-height: 1.3;">
              ${formatBnIndex(idx)}
            </td>
            <td style="text-align: justify; text-justify: inter-word; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; line-height: 1.3;">
              ${it}
            </td>
          </tr>
        </table>
      `).join("");

      return `
        <div style="margin-bottom: 6pt;">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2pt; font-size: 12pt;">${g.heading}</div>
          ${itemsHtml}
        </div>
      `;
    }).join("");

    const ccSigSubLines = (f.ccSignatorySubtitle || f.signatorySubtitle || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা')
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .join("<br/>");

    const ccSigHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 14pt;">
        <tr>
          <td style="width: 55%;"></td>
          <td style="width: 45%; text-align: center; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">
            <div style="font-weight: bold; margin-bottom: 2pt; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${f.ccSignatoryTitle || f.signatoryTitle || '(শেখ শাহির আহমেদ)'}</div>
            <div style="font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${ccSigSubLines}</div>
          </td>
        </tr>
      </table>
    `;

    ccSectionHtml = `
      <div style="page-break-inside: avoid; break-inside: avoid; margin-top: 10pt; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 6pt;">
          <tr>
            <td style="text-align: left; font-size: 12pt;">নথি নং- ${f.defaultFileNo || '—'}</td>
            <td style="text-align: right; font-size: 12pt;">তারিখ : ${new Date().toLocaleDateString("en-GB").replace(/\//g, ".")} খ্রিষ্টাব্দ</td>
          </tr>
        </table>
        ${groupsHtml}
        ${ccSigHtml}
      </div>
    `;
  }

  // Reference HTML
  const referenceHtml = f.reference ? `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6pt;">
      <tr>
        <td style="width: 32pt; font-weight: bold; vertical-align: top; font-size: 11pt; padding: 0; line-height: 1.3;">সূত্র:</td>
        <td style="font-size: 11pt; text-align: justify; text-justify: inter-word; padding: 0; line-height: 1.3;">${f.reference}</td>
      </tr>
    </table>
  ` : '';

  const fullWordHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${f.subject || 'Government Letter'}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: 210mm 297mm; /* A4 */
          margin: 0.6in 0.7in 0.6in 0.7in;
          mso-page-orientation: portrait;
        }
        body {
          font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', 'Kalpurush', sans-serif;
          font-size: 12pt;
          line-height: 1.25;
          color: #000000;
          mso-line-height-rule: exactly;
        }
        p, div, td {
          margin: 0;
          padding: 0;
          font-size: 12pt;
          mso-line-height-rule: exactly;
        }
        .signatory-line {
          margin: 0 !important;
          padding: 0 !important;
          font-size: 12pt !important;
          line-height: 1.15 !important;
          mso-line-height-rule: exactly;
        }
      </style>
    </head>
    <body>
      <!-- Office Header -->
      <div style="text-align: center; line-height: 1.25; margin-bottom: 10pt;">
        <div style="font-size: 12pt;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
        <div style="font-size: 12pt; font-weight: bold;">${f.officeName || '[দপ্তরের নাম ও বিভাগ]'}</div>
        ${f.officeAddress ? `<div style="font-size: 12pt;">${f.officeAddress}</div>` : ''}
        ${f.officeEmail ? `<div style="font-size: 12pt;">ইমেইল: ${f.officeEmail}</div>` : ''}
      </div>

      <!-- File No and Date -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8pt;">
        <tr>
          <td style="text-align: left; font-size: 12pt;"><strong>নথি নং:</strong> ${f.defaultFileNo || '—'}</td>
          <td style="text-align: right; font-size: 12pt;"><strong>তারিখ:</strong> ${new Date().toLocaleDateString("en-GB").replace(/\//g, ".")} খ্রিষ্টাব্দ</td>
        </tr>
      </table>

      <!-- Subject & Reference -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 4pt;">
        <tr>
          <td style="width: 32pt; font-weight: bold; vertical-align: top; font-size: 12pt; padding: 0; line-height: 1.3;">বিষয়:</td>
          <td style="font-weight: bold; font-size: 12pt; text-align: justify; text-justify: inter-word; padding: 0; line-height: 1.3;">${f.subject || '-'}</td>
        </tr>
      </table>
      ${referenceHtml}

      <!-- Body Content -->
      <div style="margin-top: 8pt; margin-bottom: 8pt; font-size: 12pt;">
        ${bodyParasHtml}
      </div>

      <!-- Primary Signatory -->
      ${primarySigHtml}

      <!-- Recipient -->
      ${recipientHtml}

      <!-- CC Section -->
      ${ccSectionHtml}
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + fullWordHtml], {
    type: "application/msword;charset=utf-8"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

onMounted(() => {
  loadTemplate();
});
</script>

<style scoped>
.bg-surface {
  background-color: #1e2227;
}
.border-custom {
  border-color: #2d3239 !important;
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
  color: #ffffff !important;
  text-align: justify !important;
  text-justify: inter-word !important;
}

.form-dark-input::placeholder,
.body-editor::placeholder {
  color: #6c757d !important;
  font-style: italic !important;
  opacity: 0.6 !important;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 0.6in 0.7in 0.6in 0.7in;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .d-print-none {
    display: none !important;
  }
  .letter-page-wrapper {
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: auto !important;
  }
  .official-preview {
    position: static !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    border: none !important;
  }
  .cc-section-block {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}
</style>
