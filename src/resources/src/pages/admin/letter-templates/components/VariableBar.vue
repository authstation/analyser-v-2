<template>
  <div class="card bg-dark border-secondary p-3 mb-3">
    <div class="small fw-bold text-uppercase text-muted mb-2 d-flex align-items-center">
      <i class="bi bi-cursor-fill text-warning me-1"></i> Click to Insert Dynamic Variable:
    </div>
    <div class="d-flex flex-wrap gap-2">
      <button 
        type="button" 
        class="btn btn-sm btn-outline-warning text-nowrap py-1 px-2 variable-btn" 
        v-for="item in variables" 
        :key="item.key"
        @click="$emit('insert', item.key)"
        :title="item.desc"
      >
        <span class="fw-bold font-monospace text-warning">+&#123;&#123;{{ item.key }}&#125;&#125;</span>
        <span class="text-light ms-1 small">({{ item.label }})</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: "insert", variable: string): void;
}>();

const variables = [
  { key: "entity_name", label: "Company Name", desc: "প্রতিষ্ঠানের নাম" },
  { key: "bin", label: "BIN", desc: "১৩ বা ৯ ডিজিটের বিআইএন নম্বর" },
  { key: "address", label: "Address", desc: "প্রতিষ্ঠানটির ঠিকানা" },
  { key: "mobile", label: "Mobile", desc: "মোবাইল নম্বর" },
  { key: "reg_month_year", label: "Reg. Tax Period", desc: "নিবন্ধন গ্রহণের মাস ও বছর" },
  { key: "non_filed_months_count", label: "Non-Filed Count", desc: "অদাখিলকৃত কর মেয়াদের সংখ্যা" },
  { key: "circle_name", label: "Circle Name", desc: "সার্কেলের নাম" },
  { key: "police_station", label: "Police Station", desc: "থানা" },
  { key: "district", label: "District", desc: "জেলা" }
];
</script>

<style scoped>
.variable-btn {
  font-size: 0.8rem;
  border-color: #495057;
  background: #1e2227;
  transition: all 0.15s ease-in-out;
}
.variable-btn:hover {
  background: #2a3038;
  border-color: #ffc107;
  transform: translateY(-1px);
}
</style>
