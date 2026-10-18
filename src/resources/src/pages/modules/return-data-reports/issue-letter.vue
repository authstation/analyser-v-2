<template>
  <div class="container-fluid py-4 min-vh-100 bg-dark text-light">
    <!-- Top Action Toolbar -->
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 d-print-none border-bottom border-secondary pb-3">
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm rounded-pill px-3" @click="closeTab">
          <i class="bi bi-arrow-left me-1"></i> Close / Back
        </button>
        <span class="badge bg-secondary font-monospace" v-if="entityBin">BIN: {{ entityBin }}</span>
      </div>
      
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-primary" @click="downloadWordDoc" title="Download as Microsoft Word (.docx / .doc)">
          <i class="bi bi-file-earmark-word me-1"></i> Word Download
        </button>
        <button class="btn btn-success px-4" @click="printLetter">
          <i class="bi bi-printer me-1"></i> Print / PDF
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5 d-print-none">
      <div class="spinner-border text-danger" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-2">Loading letter and entity data...</p>
    </div>

    <div v-else class="row justify-content-center">
      <div class="col-12 col-xl-10">
        
        <!-- Template Selection Dropdown if multiple templates -->
        <div class="row g-3 mb-3 d-print-none align-items-center bg-black p-3 rounded border border-secondary" v-if="templates.length > 1">
          <div class="col-md-3">
            <label class="small text-muted fw-bold">Select Letter Template:</label>
          </div>
          <div class="col-md-9">
            <select class="form-select bg-dark text-light border-secondary" v-model="selectedTemplateId" @change="onTemplateChange">
              <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.title }}</option>
            </select>
          </div>
        </div>

        <!-- The Official Letter Paper (A4 Printable Area) -->
        <div 
          class="official-paper bg-white text-dark shadow mx-auto mb-5 position-relative" 
          style="width: 210mm; min-height: 297mm; padding: 0.6in 0.7in; font-size: 14pt; line-height: 1.5; font-family: 'NikoshBAN', 'Nikosh', sans-serif; box-sizing: border-box;"
        >
          <!-- Top Header Row: Centered Govt Header with Optional Right Logo -->
          <div class="position-relative mb-3">
            <!-- Optional Secondary Logo (Positioned right-0 top-0 in container flow) -->
            <div v-if="letterData.secondaryLogo" class="position-absolute end-0 top-0 d-flex justify-content-end" style="width: 90px;">
              <img :src="letterData.secondaryLogo" alt="Secondary Logo" style="height: 60px; max-width: 80px; object-fit: contain;" />
            </div>

            <!-- Government Monogram & Office Header (Centered) -->
            <div class="text-center" style="line-height: 1.25; padding: 0 90px;">
              <img src="/logo-favicon/bd-logo.svg" alt="Govt Logo" style="height: 60px; width: 60px; object-fit: contain;" class="mb-1 d-inline-block" />
              <div class="text-dark" style="font-size: 12pt; font-weight: normal; margin-bottom: 2px;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
              <div class="fw-bold text-dark" style="font-size: 12pt; margin-bottom: 2px;">{{ letterData.officeName || 'কাস্টমস, এক্সাইজ ও ভ্যাট বিভাগ' }}</div>
              <div class="text-dark" style="font-size: 12pt; margin-bottom: 2px;" v-if="letterData.officeAddress">{{ letterData.officeAddress }}</div>
              <div class="text-dark" style="font-size: 12pt;" v-if="letterData.officeEmail">ইমেইল: <span style="font-size: 10pt;">{{ letterData.officeEmail }}</span></div>
            </div>
          </div>

          <!-- File No (Left) and Date (Right) Alignment -->
          <div class="d-flex justify-content-between align-items-baseline mb-3" style="font-size: 12pt;">
            <div class="d-flex align-items-baseline flex-grow-1 me-3">
              <span class="fw-bold me-1 text-nowrap">নথি নং:</span>
              <span>{{ letterData.fileNo || '—' }}</span>
            </div>
            <div class="d-flex align-items-baseline justify-content-end text-nowrap" style="min-width: 220px;">
              <span class="fw-bold me-1">তারিখ :</span>
              <span>{{ letterData.letterDate }} খ্রিষ্টাব্দ</span>
            </div>
          </div>

          <!-- Subject & Reference Alignment -->
          <div class="mb-3" style="line-height: 1.5;">
            <!-- বিষয়: সবসময় বোল্ড, 12pt -->
            <div class="mb-1" style="font-size: 12pt;">
              <div class="d-flex align-items-baseline" style="font-size: 12pt;">
                <span class="fw-bold text-dark text-nowrap" style="width: 60px; min-width: 60px; display: inline-block;">বিষয়:</span>
                <div class="fw-bold text-dark flex-grow-1" style="text-align: justify; text-justify: inter-word;">
                  {{ letterData.subject }}
                </div>
              </div>
            </div>

            <!-- সূত্র: 12pt, regular -->
            <div style="font-size: 12pt;" v-if="letterData.reference">
              <div class="d-flex align-items-baseline" style="font-size: 12pt;">
                <span class="fw-bold text-dark text-nowrap" style="width: 60px; min-width: 60px; display: inline-block;">সূত্র:</span>
                <div class="text-dark flex-grow-1" style="text-align: justify; text-justify: inter-word;">
                  {{ letterData.reference }}
                </div>
              </div>
            </div>
          </div>

          <!-- Main Body Paragraphs (Indented, Fully Justified, Official Line Spacing) -->
          <div class="mb-4 mt-3">
            <div 
              class="official-body-rendered text-dark" 
              style="font-size: 12pt; line-height: 1.3; text-align: justify; text-justify: inter-word;"
            >
              <template v-for="(para, pIdx) in formattedBodyParagraphs" :key="pIdx">
                <div 
                  v-if="parseParagraph(para).prefix" 
                  class="d-flex align-items-baseline"
                  style="margin-bottom: 6px;"
                >
                  <span class="text-nowrap" style="width: 60px; min-width: 60px; display: inline-block;">{{ parseParagraph(para).prefix }}</span>
                  <div class="flex-grow-1" style="text-align: justify; text-justify: inter-word;" v-html="renderParagraphHtml(parseParagraph(para).content)"></div>
                </div>
                <div 
                  v-else 
                  style="margin-bottom: 6px; padding-left: 60px; text-align: justify; text-justify: inter-word;"
                  v-html="renderParagraphHtml(para)"
                ></div>
              </template>
            </div>
          </div>

          <!-- Primary Signatory Block (Right Aligned, Standard Spacing) -->
          <div class="d-flex justify-content-end text-center mt-3 mb-1">
            <div style="min-width: 250px; line-height: 1.25;">
              <div class="fw-bold text-dark mb-1" style="font-size: 12pt;">{{ letterData.signatoryName || '(শেখ শাহির আহমেদ)' }}</div>
              <div v-for="(line, lIdx) in (letterData.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').split('\n')" :key="lIdx" class="text-dark" style="font-size: 12pt;">
                {{ line.trim() }}
              </div>
            </div>
          </div>

          <!-- Recipient (Entity Details) - Left Aligned -->
          <div class="mt-0 mb-2 text-dark" style="line-height: 1.35; font-family: 'NikoshBAN', 'Nikosh', sans-serif;">
            <div class="fw-bold" style="font-size: 9pt;">{{ cleanRecipientName(letterData.recipientName) }}</div>
            <div style="font-size: 10pt;"><span style="font-size: 12pt;">ঠিকানা: </span>{{ letterData.recipientAddress || '—' }}</div>
            <div style="font-size: 12pt;">নিবন্ধন নং: {{ letterData.recipientBin || '—' }}</div>
          </div>

          <!-- Copy to / CC Section (Purely controlled by template CC groups) -->
          <div 
            class="cc-section-block mt-2" 
            v-if="letterData.ccGroups && letterData.ccGroups.length > 0" 
            style="font-family: 'NikoshBAN', 'Nikosh', sans-serif; break-inside: avoid; page-break-inside: avoid;"
          >
            <!-- Header File No & Date for CC Section -->
            <div class="d-flex justify-content-between align-items-baseline mb-2" style="font-size: 12pt;">
              <div>নথি নং- {{ letterData.fileNo || '—' }}</div>
              <div>তারিখ : {{ letterData.letterDate }} খ্রিষ্টাব্দ</div>
            </div>

            <!-- Group-wise Output -->
            <div v-for="(group, gIdx) in letterData.ccGroups" :key="gIdx" class="mb-2">
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

            <!-- Secondary Signatory for CC (Right Aligned) -->
            <div class="d-flex justify-content-end text-center mt-4">
              <div style="min-width: 240px; line-height: 1.25;">
                <div class="fw-bold text-dark mb-1" style="font-size: 12pt;">{{ letterData.ccSignatoryName || letterData.signatoryName || '(শেখ শাহির আহমেদ)' }}</div>
                <div v-for="(line, lIdx) in (letterData.ccSignatoryDesignation || letterData.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').split('\n')" :key="lIdx" class="text-dark" style="font-size: 12pt;">
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
import { useRoute } from "vue-router";
import axios from "@/plugins/axios";

const route = useRoute();

const entityBin = ref(String(route.query.bin || ""));
const loading = ref(false);
const templates = ref<any[]>([]);
const selectedTemplateId = ref<number | null>(null);

const entityData = ref<any>(null);

const formattedBodyParagraphs = computed(() => {
  const text = letterData.value.body || "";
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

const renderParagraphHtml = (para: string) => {
  if (!para) return "";
  // Highlight [নির্দিষ্ট তারিখ], [তারিখ লিখুন], or any [বর্গাকার বন্ধনী] text in blue without background fill
  return para.replace(
    /(\[[^\]]+\])/g,
    '<span class="text-primary fw-bold placeholder-highlight">$1</span>'
  );
};

const formatBnIndex = (index: number | string) => {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const num = Number(index) + 1;
  const numStr = num < 10 ? `0${num}` : `${num}`;
  return numStr.split("").map((d) => bnDigits[Number(d)] || d).join("") + "।";
};

const cleanRecipientName = (name: string) => {
  if (!name) return "";
  return name.trim();
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
  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "heading" in raw[0]) {
    return raw.map((g: any) => ({
      heading: g.heading || "",
      text: Array.isArray(g.items) ? g.items.join("\n") : (g.text || "")
    }));
  }
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
  ccGroups: [
    {
      heading: "অনুলিপি সদয় অবগতির জন্য:",
      text: "কমিশনার, কাস্টমস, এক্সাইজ ও ভ্যাট কমিশনারেট, কুমিল্লা।"
    }
  ],
  ccSignatoryName: "",
  ccSignatoryDesignation: ""
});

// Uses shared transliterateToBengali from utils/transliterate


const cleanZeroAddressParts = (addrStr: string) => {
  if (!addrStr) return "";
  return addrStr
    .replace(/\b(holding|shope?|shop|plot|road|house|flat|line|block|sector)\s*(?:no|number)?\s*[:.\-]?\s*0+\b[,;\s]*/gi, "")
    .replace(/\b0+\s*(?:no|number)\b[,;\s]*/gi, "")
    .replace(/^[,;\s]+|[,;\s]+$/g, "")
    .replace(/,\s*,+/g, ",")
    .trim();
};

const formatEntityAddress = (ent: any) => {
  if (!ent) return "";
  const cleanedBaseAddr = cleanZeroAddressParts(ent.address || "");
  const districtName = ent.district || "";
  const parts = [cleanedBaseAddr, ent.policeStationName, districtName].filter(Boolean);
  let addr = parts.join(", ").trim();
  if (addr && !addr.endsWith(".")) {
    addr += ".";
  }
  return addr;
};

const loadEntityData = async () => {
  if (!entityBin.value) return;
  try {
    const res = await axios.get(`/api/return-data-analyser/non-filer-list?q=${encodeURIComponent(entityBin.value)}`);
    const list = res.data?.data || [];
    const matched = list.find((item: any) => String(item.bin) === String(entityBin.value)) || list[0];
    if (matched) {
      entityData.value = matched;
      const rawName = matched.name || "";
      const rawAddress = formatEntityAddress(matched);

      letterData.value.recipientName = rawName;
      letterData.value.recipientAddress = rawAddress;
      letterData.value.recipientBin = matched.bin || entityBin.value;
    } else {
      letterData.value.recipientBin = entityBin.value;
    }
  } catch (err) {
    console.error("Failed to load entity details", err);
    letterData.value.recipientBin = entityBin.value;
  }
};

const loadTemplates = async () => {
  try {
    const res = await axios.get("/api/letter-templates");
    templates.value = res.data?.data || [];
    if (templates.value.length > 0) {
      const qTemplateId = route.query.templateId ? Number(route.query.templateId) : null;
      const targetTpl = templates.value.find((t) => t.id === qTemplateId) || templates.value[0];
      selectedTemplateId.value = targetTpl.id;
      applyTemplateData(targetTpl);
    }
  } catch (err) {
    console.error("Failed to load templates", err);
  }
};

const formatBnMonthYear = (dateStr: string | null) => {
  if (!dateStr) return "জুলাই/২০১৯";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "জুলাই/২০১৯";
  const bnMonths = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
  ];
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const mName = bnMonths[d.getMonth()];
  const yStr = String(d.getFullYear()).split("").map((ch) => bnDigits[Number(ch)] || ch).join("");
  return `${mName}/${yStr}`;
};

const toBnNumber = (num: number | string) => {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).split("").map((ch) => bnDigits[Number(ch)] || ch).join("");
};

const applyTemplateData = (tpl: any) => {
  letterData.value.subject = tpl.subject || "";
  letterData.value.reference = tpl.reference || "";
  if (tpl.officeName) letterData.value.officeName = tpl.officeName;
  if (tpl.officeAddress) letterData.value.officeAddress = tpl.officeAddress;
  if (tpl.officeEmail) letterData.value.officeEmail = tpl.officeEmail;
  if (tpl.defaultFileNo && !letterData.value.fileNo) letterData.value.fileNo = tpl.defaultFileNo;
  if (tpl.secondaryLogo) letterData.value.secondaryLogo = tpl.secondaryLogo;

  // Replace dynamic tags with actual entity info
  let populatedBody = tpl.bodyHtml || "";
  const ent = entityData.value;
  if (ent) {
    const districtName = ent.district || "";
    populatedBody = populatedBody
      .replace(/{{entity_name}}/g, letterData.value.recipientName || ent.name || "")
      .replace(/{{bin}}/g, ent.bin || "")
      .replace(/{{address}}/g, letterData.value.recipientAddress || formatEntityAddress(ent))
      .replace(/{{mobile}}/g, ent.mobile || "")
      .replace(/{{non_filed_months_count}}/g, toBnNumber(ent.grandTotalMonths || "১"))
      .replace(/{{reg_month_year}}/g, formatBnMonthYear(ent.issueDate))
      .replace(/{{circle_name}}/g, ent.circleName || "")
      .replace(/{{police_station}}/g, ent.policeStationName || "")
      .replace(/{{district}}/g, districtName);
  } else if (entityBin.value) {
    populatedBody = populatedBody.replace(/{{bin}}/g, entityBin.value);
  }

  letterData.value.body = populatedBody;

  if (tpl.signatoryTitle) letterData.value.signatoryName = tpl.signatoryTitle;
  if (tpl.signatorySubtitle) letterData.value.signatoryDesignation = tpl.signatorySubtitle;
  if (tpl.ccSignatoryTitle) letterData.value.ccSignatoryName = tpl.ccSignatoryTitle;
  if (tpl.ccSignatorySubtitle) letterData.value.ccSignatoryDesignation = tpl.ccSignatorySubtitle;
  if (tpl.ccItems) {
    letterData.value.ccGroups = normalizeCcGroups(tpl.ccItems);
  }
};

const onTemplateChange = () => {
  const tpl = templates.value.find((t) => t.id === selectedTemplateId.value);
  if (tpl) applyTemplateData(tpl);
};

const printLetter = () => {
  window.print();
};

const downloadWordDoc = () => {
  const d = letterData.value;
  const fileName = `Letter_${d.recipientBin || 'notice'}_${new Date().toISOString().slice(0, 10)}.doc`;

  // Build body HTML paragraphs
  const paragraphs = (d.body || "").split("\n\n").filter(Boolean);
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
  const sigSubLines = (d.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা')
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
          <div style="font-weight: bold; margin-bottom: 2pt; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${d.signatoryName || '(শেখ শাহির আহমেদ)'}</div>
          <div style="font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${sigSubLines}</div>
        </td>
      </tr>
    </table>
  `;

  // Recipient HTML
  const recipientHtml = `
    <div style="margin-top: 6pt; margin-bottom: 10pt; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; line-height: 1.35;">
      <div style="font-weight: bold; font-size: 9pt;">${cleanRecipientName(d.recipientName)}</div>
      <div style="font-size: 10pt;"><span style="font-size: 12pt;">ঠিকানা: </span>${d.recipientAddress || ''}</div>
      <div style="font-size: 12pt;">নিবন্ধন নং: ${d.recipientBin || ''}</div>
    </div>
  `;

  // CC Section HTML
  let ccSectionHtml = "";
  if (d.includeCc && d.ccGroups && d.ccGroups.length > 0) {
    const groupsHtml = d.ccGroups.map((g: any) => {
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

    const ccSigSubLines = (d.ccSignatoryDesignation || d.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা')
      .split("\n")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .join("<br/>");

    const ccSigHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 14pt;">
        <tr>
          <td style="width: 55%;"></td>
          <td style="width: 45%; text-align: center; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">
            <div style="font-weight: bold; margin-bottom: 2pt; font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${d.ccSignatoryName || d.signatoryName || '(শেখ শাহির আহমেদ)'}</div>
            <div style="font-size: 12pt; line-height: 1.15; mso-line-height-rule: exactly;">${ccSigSubLines}</div>
          </td>
        </tr>
      </table>
    `;

    ccSectionHtml = `
      <div style="page-break-inside: avoid; break-inside: avoid; margin-top: 10pt; font-family: 'NikoshBAN', 'Nikosh', 'SolaimanLipi', sans-serif;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 6pt;">
          <tr>
            <td style="text-align: left; font-size: 12pt;">নথি নং- ${d.fileNo || '—'}</td>
            <td style="text-align: right; font-size: 12pt;">তারিখ : ${d.letterDate} খ্রিষ্টাব্দ</td>
          </tr>
        </table>
        ${groupsHtml}
        ${ccSigHtml}
      </div>
    `;
  }

  // Reference HTML
  const referenceHtml = d.reference ? `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6pt;">
      <tr>
        <td style="width: 32pt; font-weight: bold; vertical-align: top; font-size: 11pt; padding: 0; line-height: 1.3;">সূত্র:</td>
        <td style="font-size: 11pt; text-align: justify; text-justify: inter-word; padding: 0; line-height: 1.3;">${d.reference}</td>
      </tr>
    </table>
  ` : '';

  const fullWordHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${d.subject || 'Government Letter'}</title>
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
        <div style="font-size: 12pt; font-weight: bold;">${d.officeName || 'কাস্টমস, এক্সাইজ ও ভ্যাট বিভাগ'}</div>
        ${d.officeAddress ? `<div style="font-size: 12pt;">${d.officeAddress}</div>` : ''}
        ${d.officeEmail ? `<div style="font-size: 12pt;">ইমেইল: <span style="font-size: 10pt;">${d.officeEmail}</span></div>` : ''}
      </div>

      <!-- File No and Date -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8pt;">
        <tr>
          <td style="text-align: left; font-size: 12pt;"><strong>নথি নং:</strong> ${d.fileNo || '—'}</td>
          <td style="text-align: right; font-size: 12pt;"><strong>তারিখ:</strong> ${d.letterDate} খ্রিষ্টাব্দ</td>
        </tr>
      </table>

      <!-- Subject & Reference -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 4pt;">
        <tr>
          <td style="width: 32pt; font-weight: bold; vertical-align: top; font-size: 12pt; padding: 0; line-height: 1.3;">বিষয়:</td>
          <td style="font-weight: bold; font-size: 12pt; text-align: justify; text-justify: inter-word; padding: 0; line-height: 1.3;">${d.subject || '-'}</td>
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


const closeTab = () => {
  if (window.history.length > 1) {
    window.close();
  } else {
    window.location.href = "/modules/return-data-reports/non-filer-list";
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    await loadEntityData();
    await loadTemplates();
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.letter-input::placeholder,
.letter-body-textarea::placeholder {
  color: #adb5bd !important;
  font-weight: normal !important;
  font-style: italic !important;
  opacity: 0.65;
}

.letter-input:focus,
.letter-body-textarea:focus {
  background-color: #f8f9fa !important;
  outline: none;
  box-shadow: 0 0 0 1px #ffc107 !important;
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
  .container-fluid {
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    min-height: auto !important;
  }
  .official-paper {
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
  .placeholder-highlight {
    background: transparent !important;
    border: none !important;
    color: #000 !important;
    padding: 0 !important;
  }
  .cc-section-block {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}
</style>
