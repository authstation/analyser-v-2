<template>
  <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.85); z-index: 1060;">
    <div class="modal-dialog modal-fullscreen">
      <div class="modal-content bg-dark text-light border-0">
        
        <!-- Header (Screen only) -->
        <div class="modal-header border-secondary d-print-none bg-black py-2 px-3">
          <div class="d-flex align-items-center gap-2">
            <h5 class="modal-title fw-bold text-light mb-0">
              <i class="bi bi-printer text-success me-2"></i>বাল্ক পত্র প্রিন্ট (একটানা প্রিন্ট ও তৈরি)
            </h5>
            <span class="badge bg-secondary font-monospace">{{ preparedLetters.length }} টি প্রতিষ্ঠান</span>
            <span class="badge bg-primary" v-if="selectedTemplate">{{ selectedTemplate.title }}</span>
          </div>

          <div class="d-flex align-items-center gap-2 ms-auto">
            <span v-if="generating" class="text-warning small me-2">
              <span class="spinner-border spinner-border-sm me-1"></span>নাম ও ঠিকানা বাংলায় অনুবাদ হচ্ছে... ({{ progressCount }}/{{ entities.length }})
            </span>
            <button class="btn btn-sm btn-outline-info" @click="downloadWordDoc" :disabled="generating || preparedLetters.length === 0" title="Download all letters into single Word document">
              <i class="bi bi-file-earmark-word me-1"></i> Word ডাউনলোড
            </button>
            <button class="btn btn-sm btn-success px-3" @click="printLetters" :disabled="generating || preparedLetters.length === 0">
              <i class="bi bi-printer-fill me-1"></i> প্রিন্ট / PDF সংরক্ষণ
            </button>
            <button type="button" class="btn-close btn-close-white ms-2" @click="close"></button>
          </div>
        </div>

        <!-- Scrollable Modal Body for Preview & Print -->
        <div class="modal-body p-4 bg-dark overflow-auto">
          <!-- Generation Spinner -->
          <div v-if="generating && preparedLetters.length === 0" class="text-center py-5 d-print-none">
            <div class="spinner-border text-info mb-3" style="width: 3rem; height: 3rem;" role="status"></div>
            <h5 class="text-light">চিঠি প্রস্তুত করা হচ্ছে...</h5>
            <p class="text-muted">প্রতিষ্ঠানসমূহের নাম ও ঠিকানা বাংলায় ফোনেটিক রূপান্তর করা হচ্ছে ({{ progressCount }}/{{ entities.length }})</p>
          </div>

          <!-- Letters List (Sequential A4 Sheets) -->
          <div v-else class="batch-letters-container">
            <div 
              v-for="(letter, lIdx) in preparedLetters" 
              :key="letter.recipientBin" 
              class="official-paper bg-white text-dark shadow mx-auto mb-5 position-relative single-letter-sheet"
              style="width: 210mm; min-height: 297mm; padding: 0.6in 0.7in; font-size: 14pt; line-height: 1.5; font-family: 'NikoshBAN', 'Nikosh', sans-serif; box-sizing: border-box;"
            >
              <!-- Top Header Row: Centered Govt Header with Optional Right Logo -->
              <div class="position-relative mb-3">
                <div v-if="letter.secondaryLogo" class="position-absolute end-0 top-0 d-flex justify-content-end" style="width: 90px;">
                  <img :src="letter.secondaryLogo" alt="Secondary Logo" style="height: 60px; max-width: 80px; object-fit: contain;" />
                </div>

                <div class="text-center" style="line-height: 1.25; padding: 0 90px;">
                  <img src="/logo-favicon/bd-logo.svg" alt="Govt Logo" style="height: 60px; width: 60px; object-fit: contain;" class="mb-1 d-inline-block" />
                  <div class="text-dark" style="font-size: 12pt; font-weight: normal; margin-bottom: 2px;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
                  <div class="fw-bold text-dark" style="font-size: 12pt; margin-bottom: 2px;">{{ letter.officeName || 'কাস্টমস, এক্সাইজ ও ভ্যাট বিভাগ' }}</div>
                  <div class="text-dark" style="font-size: 12pt; margin-bottom: 2px;" v-if="letter.officeAddress">{{ letter.officeAddress }}</div>
                  <div class="text-dark" style="font-size: 12pt;" v-if="letter.officeEmail">ইমেইল: <span style="font-size: 10pt;">{{ letter.officeEmail }}</span></div>
                </div>
              </div>

              <!-- File No (Left) and Date (Right) Alignment -->
              <div class="d-flex justify-content-between align-items-baseline mb-3" style="font-size: 12pt;">
                <div class="d-flex align-items-baseline flex-grow-1 me-3">
                  <span class="fw-bold me-1 text-nowrap">নথি নং:</span>
                  <span>{{ letter.fileNo || '—' }}</span>
                </div>
                <div class="d-flex align-items-baseline justify-content-end text-nowrap" style="min-width: 220px;">
                  <span class="fw-bold me-1">তারিখ :</span>
                  <span>{{ letter.letterDate }} খ্রিষ্টাব্দ</span>
                </div>
              </div>

              <!-- Subject & Reference Alignment -->
              <div class="mb-3" style="line-height: 1.5;">
                <div class="mb-1 d-flex align-items-baseline" style="font-size: 12pt;">
                  <span class="fw-bold text-dark text-nowrap" style="width: 60px; min-width: 60px; display: inline-block;">বিষয়:</span>
                  <div class="fw-bold text-dark flex-grow-1" style="text-align: justify; text-justify: inter-word;">
                    {{ letter.subject }}
                  </div>
                </div>
                <div style="font-size: 12pt;" v-if="letter.reference" class="d-flex align-items-baseline">
                  <span class="fw-bold text-dark text-nowrap" style="width: 60px; min-width: 60px; display: inline-block;">সূত্র:</span>
                  <div class="text-dark flex-grow-1" style="text-align: justify; text-justify: inter-word;">
                    {{ letter.reference }}
                  </div>
                </div>
              </div>

              <!-- Main Body Paragraphs (Indented, Fully Justified) -->
              <div class="mb-4 mt-3 official-body-rendered text-dark" style="font-size: 12pt; line-height: 1.3; text-align: justify; text-justify: inter-word;">
                <template v-for="(para, pIdx) in getBodyParagraphs(letter.body)" :key="pIdx">
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

              <!-- Primary Signatory Block (Right Aligned) -->
              <div class="d-flex justify-content-end text-center mt-3 mb-1">
                <div style="min-width: 250px; line-height: 1.25;">
                  <div class="fw-bold text-dark mb-1" style="font-size: 12pt;">{{ letter.signatoryName || '(শেখ শাহির আহমেদ)' }}</div>
                  <div v-for="(line, lIdx) in (letter.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').split('\n')" :key="lIdx" class="text-dark" style="font-size: 12pt;">
                    {{ line.trim() }}
                  </div>
                </div>
              </div>

              <!-- Recipient (Entity Details) - Left Aligned -->
              <div class="mt-0 mb-2 text-dark" style="line-height: 1.35; font-family: 'NikoshBAN', 'Nikosh', sans-serif;">
                <div class="fw-bold" style="font-size: 9pt;">{{ cleanRecipientName(letter.recipientName) }}</div>
                <div style="font-size: 10pt;"><span style="font-size: 12pt;">ঠিকানা: </span>{{ letter.recipientAddress || '—' }}</div>
                <div style="font-size: 12pt;">নিবন্ধন নং: {{ letter.recipientBin || '—' }}</div>
              </div>

              <!-- Copy to / CC Section -->
              <div 
                class="cc-section-block mt-2" 
                v-if="letter.includeCc && letter.ccGroups && letter.ccGroups.length > 0" 
                style="font-family: 'NikoshBAN', 'Nikosh', sans-serif; break-inside: avoid; page-break-inside: avoid;"
              >
                <div class="d-flex justify-content-between align-items-baseline mb-2" style="font-size: 12pt;">
                  <div>নথি নং- {{ letter.fileNo || '—' }}</div>
                  <div>তারিখ : {{ letter.letterDate }} খ্রিষ্টাব্দ</div>
                </div>

                <div v-for="(group, gIdx) in letter.ccGroups" :key="gIdx" class="mb-2">
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

                <!-- Secondary Signatory for CC -->
                <div class="d-flex justify-content-end text-center mt-3">
                  <div style="min-width: 240px; line-height: 1.25;">
                    <div class="fw-bold text-dark mb-1" style="font-size: 12pt;">{{ letter.ccSignatoryName || letter.signatoryName || '(শেখ শাহির আহমেদ)' }}</div>
                    <div v-for="(line, lIdx) in (letter.ccSignatoryDesignation || letter.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').split('\n')" :key="lIdx" class="text-dark" style="font-size: 12pt;">
                      {{ line.trim() }}
                    </div>
                  </div>
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
import { ref, watch } from "vue";
import { transliterateToBengali } from "@/utils/transliterate";

const props = defineProps<{
  show: boolean;
  template: any;
  entities: any[];
}>();

const emit = defineEmits(["close"]);

const generating = ref(false);
const progressCount = ref(0);
const preparedLetters = ref<any[]>([]);
const selectedTemplate = ref<any>(null);

const close = () => {
  emit("close");
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

const getBodyParagraphs = (body: string) => {
  return (body || "")
    .split(/\n+/)
    .map((p: string) => p.trim())
    .filter(Boolean);
};

const parseParagraph = (para: string) => {
  if (!para) return { prefix: "", content: "" };
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
  return para.replace(
    /(\[[^\]]+\])/g,
    '<span class="text-primary fw-bold placeholder-highlight">$1</span>'
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

const prepareBatchLetters = async () => {
  if (!props.template || !props.entities || props.entities.length === 0) {
    preparedLetters.value = [];
    return;
  }
  generating.value = true;
  progressCount.value = 0;
  selectedTemplate.value = props.template;
  const tpl = props.template;

  const results: any[] = [];
  const currentDate = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");

  const cleanZeroAddressParts = (addrStr: string) => {
    if (!addrStr) return "";
    return addrStr
      .replace(/\b(holding|shope?|shop|plot|road|house|flat|line|block|sector)\s*(?:no|number)?\s*[:.\-]?\s*0+\b[,;\s]*/gi, "")
      .replace(/\b0+\s*(?:no|number)\b[,;\s]*/gi, "")
      .replace(/^[,;\s]+|[,;\s]+$/g, "")
      .replace(/,\s*,+/g, ",")
      .trim();
  };

  for (let i = 0; i < props.entities.length; i++) {
    const ent = props.entities[i];
    progressCount.value = i + 1;

    // Use original English name and address with District directly from database
    const rawName = ent.name || "";
    const cleanedBaseAddr = cleanZeroAddressParts(ent.address || "");
    const districtName = ent.district || ent.divisionName?.replace(/\s*division\s*/i, "").trim() || "";
    const parts = [cleanedBaseAddr, ent.policeStationName, districtName].filter(Boolean);
    let rawAddress = parts.join(", ").trim();
    if (rawAddress && !rawAddress.endsWith(".")) {
      rawAddress += ".";
    }

    // Dynamic variable replacements
    let populatedBody = tpl.bodyHtml || "";
    populatedBody = populatedBody
      .replace(/{{entity_name}}/g, rawName)
      .replace(/{{bin}}/g, ent.bin || "")
      .replace(/{{address}}/g, rawAddress)
      .replace(/{{mobile}}/g, ent.mobile || "")
      .replace(/{{non_filed_months_count}}/g, toBnNumber(ent.grandTotalMonths || "১"))
      .replace(/{{reg_month_year}}/g, formatBnMonthYear(ent.issueDate))
      .replace(/{{circle_name}}/g, ent.circleName || "")
      .replace(/{{police_station}}/g, ent.policeStationName || "")
      .replace(/{{district}}/g, districtName);

    const ccGroups = tpl.ccItems ? normalizeCcGroups(tpl.ccItems) : [];

    results.push({
      officeName: tpl.officeName || "",
      officeAddress: tpl.officeAddress || "",
      officeEmail: tpl.officeEmail || "",
      fileNo: tpl.defaultFileNo || "",
      letterDate: currentDate,
      secondaryLogo: tpl.secondaryLogo || "",
      subject: tpl.subject || "",
      reference: tpl.reference || "",
      body: populatedBody,
      signatoryName: tpl.signatoryTitle || "(শেখ শাহির আহমেদ)",
      signatoryDesignation: tpl.signatorySubtitle || "সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা",
      recipientName: rawName,
      recipientAddress: rawAddress,
      recipientBin: ent.bin || "",
      includeCc: Boolean(ccGroups.length > 0),
      ccGroups,
      ccSignatoryName: tpl.ccSignatoryTitle || "",
      ccSignatoryDesignation: tpl.ccSignatorySubtitle || ""
    });
  }

  preparedLetters.value = results;
  generating.value = false;
};

watch(
  () => [props.show, props.template, props.entities],
  ([newShow]) => {
    if (newShow) {
      prepareBatchLetters();
    }
  },
  { immediate: true }
);

const printLetters = () => {
  window.print();
};

const downloadWordDoc = () => {
  if (preparedLetters.value.length === 0) return;

  const htmlHead = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Batch Official Letters</title>
      <style>
        @page {
          size: 21.0cm 29.7cm;
          margin: 0.6in 0.7in 0.6in 0.7in;
          mso-page-orientation: portrait;
        }
        body {
          font-family: 'NikoshBAN', 'Nikosh', 'Kalpurush', 'SolaimanLipi', Arial, sans-serif;
          font-size: 12pt;
          line-height: 1.35;
          color: #000000;
        }
        .page-break {
          page-break-after: always;
          mso-special-character: line-break;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6px;
        }
        td {
          vertical-align: top;
          padding: 0;
          font-size: 12pt;
        }
        p {
          margin: 0 0 6px 0;
          text-align: justify;
          text-justify: inter-word;
        }
        .bold { font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
  `;

  let bodyContent = "";

  preparedLetters.value.forEach((l, idx) => {
    const isLast = idx === preparedLetters.value.length - 1;

    const paras = getBodyParagraphs(l.body).map((p) => {
      const parsed = parseParagraph(p);
      if (parsed.prefix) {
        return `
          <table style="width: 100%; margin-bottom: 6px;">
            <tr>
              <td style="width: 50pt; font-size: 12pt;">${parsed.prefix}</td>
              <td style="font-size: 12pt; text-align: justify;">${parsed.content}</td>
            </tr>
          </table>
        `;
      }
      return `<p style="padding-left: 50pt; text-align: justify;">${p}</p>`;
    }).join("");

    let ccContent = "";
    if (l.includeCc && l.ccGroups && l.ccGroups.length > 0) {
      ccContent = `
        <div style="margin-top: 15pt; page-break-inside: avoid;">
          <table style="width: 100%; margin-bottom: 6pt;">
            <tr>
              <td>নথি নং- ${l.fileNo || '—'}</td>
              <td class="text-right">তারিখ : ${l.letterDate} খ্রিষ্টাব্দ</td>
            </tr>
          </table>
          ${l.ccGroups.map((g: any) => `
            <div style="margin-bottom: 6pt;">
              <p class="bold" style="text-decoration: underline;">${g.heading}</p>
              ${getGroupItems(g).map((item: string, iIdx: number) => `
                <table style="width: 100%; margin-bottom: 3pt;">
                  <tr>
                    <td style="width: 30pt;">${formatBnIndex(iIdx)}</td>
                    <td style="text-align: justify;">${item}</td>
                  </tr>
                </table>
              `).join("")}
            </div>
          `).join("")}
          <table style="width: 100%; margin-top: 15pt;">
            <tr>
              <td style="width: 60%;"></td>
              <td class="text-center" style="width: 40%; line-height: 1.25;">
                <div class="bold mb-1">${l.ccSignatoryName || l.signatoryName || '(শেখ শাহির আহমেদ)'}</div>
                <div>${(l.ccSignatoryDesignation || l.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').replace(/\n/g, '<br/>')}</div>
              </td>
            </tr>
          </table>
        </div>
      `;
    }

    bodyContent += `
      <div class="letter-sheet ${!isLast ? 'page-break' : ''}">
        <div class="text-center" style="line-height: 1.25; margin-bottom: 12pt;">
          <div style="font-size: 12pt;">গণপ্রজাতন্ত্রী বাংলাদেশ সরকার</div>
          <div class="bold" style="font-size: 12pt;">${l.officeName || 'কাস্টমস, এক্সাইজ ও ভ্যাট বিভাগ'}</div>
          ${l.officeAddress ? `<div style="font-size: 12pt;">${l.officeAddress}</div>` : ''}
          ${l.officeEmail ? `<div style="font-size: 12pt;">ইমেইল: <span style="font-size: 10pt;">${l.officeEmail}</span></div>` : ''}
        </div>

        <table style="width: 100%; margin-bottom: 10pt;">
          <tr>
            <td><span class="bold">নথি নং:</span> ${l.fileNo || '—'}</td>
            <td class="text-right"><span class="bold">তারিখ :</span> ${l.letterDate} খ্রিষ্টাব্দ</td>
          </tr>
        </table>

        <table style="width: 100%; margin-bottom: 6pt;">
          <tr>
            <td style="width: 50pt;" class="bold">বিষয়:</td>
            <td class="bold" style="text-align: justify;">${l.subject}</td>
          </tr>
        </table>

        ${l.reference ? `
          <table style="width: 100%; margin-bottom: 12pt;">
            <tr>
              <td style="width: 50pt;" class="bold">সূত্র:</td>
              <td style="text-align: justify;">${l.reference}</td>
            </tr>
          </table>
        ` : ''}

        ${paras}

        <table style="width: 100%; margin-top: 20pt; margin-bottom: 15pt;">
          <tr>
            <td style="width: 60%;"></td>
            <td class="text-center" style="width: 40%; line-height: 1.25;">
              <div class="bold mb-1">${l.signatoryName || '(শেখ শাহির আহমেদ)'}</div>
              <div>${(l.signatoryDesignation || 'সহকারী কমিশনার\nও\nবিভাগীয় কর্মকর্তা').replace(/\n/g, '<br/>')}</div>
            </td>
          </tr>
        </table>

        <div style="margin-bottom: 15pt; line-height: 1.35;">
          <div class="bold" style="font-size: 9pt;">${cleanRecipientName(l.recipientName)}</div>
          <div style="font-size: 10pt;"><span style="font-size: 12pt;">ঠিকানা: </span>${l.recipientAddress}</div>
          <div style="font-size: 12pt;">নিবন্ধন নং: ${l.recipientBin}</div>
        </div>

        ${ccContent}
      </div>
    `;
  });

  const fullHtml = `${htmlHead}${bodyContent}</body></html>`;
  const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Batch_Letters_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.batch-letters-container {
  display: flex;
  flex-direction: column;
  align-items: center;
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
  .d-print-none,
  .modal-header,
  .modal-backdrop {
    display: none !important;
  }
  .modal {
    position: static !important;
    display: block !important;
    background: transparent !important;
    overflow: visible !important;
  }
  .modal-dialog {
    margin: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
  }
  .modal-content {
    background: transparent !important;
    border: none !important;
  }
  .modal-body {
    padding: 0 !important;
    background: transparent !important;
    overflow: visible !important;
  }
  .single-letter-sheet {
    page-break-after: always !important;
    break-after: page !important;
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
    color: #000 !important;
  }
}
</style>
