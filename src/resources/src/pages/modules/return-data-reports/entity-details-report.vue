<template>
  <div class="entity-details-report-page text-light py-2">
    <!-- TOP CONTROLS BAR (Hidden in Print) -->
    <div class="card bg-dark border-secondary shadow-sm mb-3 no-print overflow-hidden rounded">
      <!-- Title & Close Row -->
      <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
        <div class="d-flex align-items-center flex-wrap gap-2">
          <button class="btn btn-outline-secondary btn-sm me-1" @click="goBack" title="Back">
            <i class="bi bi-arrow-left me-1"></i> Back
          </button>
          <h5 class="mb-0 fw-bold text-light d-flex align-items-center">
            <i class="bi bi-file-earmark-medical text-info me-2"></i>
            Detailed Entity Audit & 5-Year Revenue Report
          </h5>
          <span v-if="entityInfo?.bin" class="badge bg-dark border border-secondary font-monospace text-warning ms-1">
            BIN: {{ entityInfo.bin }}
          </span>
        </div>

        <div>
          <button class="btn btn-outline-secondary btn-sm" @click="closeTab">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <!-- Tax Period Range Filter & Actions Row -->
      <div class="card-body px-3 py-2 bg-dark border-top border-secondary rounded-bottom">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <!-- Left: Tax Period Range -->
          <div class="d-flex align-items-center flex-wrap gap-2">
            <span class="text-secondary small fw-bold me-1">
              <i class="bi bi-calendar3 text-info me-1"></i> Tax Period Range:
            </span>
            <input
              type="month"
              class="form-control form-control-sm bg-surface text-light border-secondary font-monospace"
              v-model="fromPeriod"
              style="width: 145px; height: 32px;"
              title="From Tax Period (YYYY-MM)"
            />
            <span class="text-muted small">to</span>
            <input
              type="month"
              class="form-control form-control-sm bg-surface text-light border-secondary font-monospace"
              v-model="toPeriod"
              style="width: 145px; height: 32px;"
              title="To Tax Period (YYYY-MM)"
            />
            <button
              class="btn btn-sm btn-outline-secondary shadow-none d-flex align-items-center justify-content-center"
              @click="resetToDefaultRange"
              title="Reset to 5-Year Range"
              style="height: 32px; width: 34px;"
            >
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>

          <!-- Right: Print and Export Buttons -->
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-danger btn-sm" @click="triggerPrint" :disabled="isLoading || !entityInfo">
              <i class="bi bi-printer me-1"></i> Print / PDF
            </button>
            <button class="btn btn-success btn-sm" @click="exportToExcel" :disabled="isLoading || !entityInfo">
              <i class="bi bi-file-earmark-excel-fill me-1"></i> Export Excel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- LOADING STATE -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-info" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="mt-2 text-muted small">Loading detailed entity audit and 5-year revenue data...</div>
    </div>

    <!-- ERROR STATE -->
    <div v-else-if="!entityInfo" class="card bg-dark border-secondary p-5 text-center text-muted">
      <i class="bi bi-exclamation-triangle fs-1 text-warning mb-2"></i>
      <h5>Unable to load entity details</h5>
      <p class="small">The requested BIN was not found or an error occurred.</p>
      <div>
        <button class="btn btn-outline-secondary btn-sm rounded-pill px-3" @click="goBack">
          <i class="bi bi-arrow-left me-1"></i> Go Back
        </button>
      </div>
    </div>

    <!-- MAIN REPORT CONTAINER -->
    <div v-else class="report-content-container">

      <!-- ========================================================= -->
      <!-- PART 1: PRINT PAGE 1 (LANDSCAPE SUMMARY) - REGISTRATION, FILING & FINDINGS -->
      <!-- ========================================================= -->
      <div class="print-page-summary">
        
        <!-- Official Document Title Header (For Print Only) -->
        <div class="d-none d-print-block report-header text-center pb-2 mb-2 border-bottom border-secondary border-opacity-75">
          <h4 class="fw-bold text-dark mb-1 report-main-title">
            DETAILED ENTITY AUDIT & 5-YEAR REVENUE REPORT
          </h4>
          <div class="text-muted small">
            National Board of Revenue (NBR) &bull; Value Added Tax (VAT) Management System
          </div>
          <div class="text-secondary small mt-1">
            Generated On: <span class="text-dark font-monospace">{{ currentTimestamp }}</span>
          </div>
        </div>

        <!-- Section 1 & 2: Entity Profile & Filing Status Summary Card (Exact Drilldown Design) -->
        <div class="card bg-dark border-secondary shadow-sm mb-3 entity-profile-card">
          <div class="card-body p-3">
            <div class="row g-2 align-items-center">
              <!-- Left: Entity Name, Address, BIN, Contact -->
              <div class="col-6">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <h5 class="fw-bold text-info mb-0 text-truncate">{{ entityInfo.entityName }}</h5>
                  <span v-if="entityInfo.forcedRegistration === 'Yes'" class="badge bg-danger small">Forced</span>
                </div>
                <div class="text-muted small mb-1">
                  <i class="bi bi-geo-alt-fill text-danger me-1"></i> {{ entityInfo.address || 'Address N/A' }}
                </div>
                <div class="small text-secondary">
                  <div class="mb-1">
                    <i class="bi bi-upc-scan text-warning me-1"></i> BIN: <strong class="text-light font-monospace">{{ entityInfo.bin }}</strong>
                  </div>
                  <div>
                    <i class="bi bi-telephone text-success me-1"></i> Mobile: <strong class="text-light">{{ entityInfo.mobile || 'N/A' }}</strong>
                    <span v-if="entityInfo.email" class="ms-2">| Email: <strong class="text-light">{{ entityInfo.email }}</strong></span>
                  </div>
                </div>
              </div>

              <!-- Right: Economic Classification & Circle/Division -->
              <div class="col-6 border-start border-secondary ps-3">
                <div class="small mb-1">
                  <span class="text-secondary">Major Economic Area:</span>
                  <strong class="text-warning ms-1">{{ entityInfo.majorArea || 'None' }}</strong>
                </div>
                <div class="small mb-1">
                  <span class="text-secondary">Manufacturing Area:</span>
                  <strong class="text-info ms-1">{{ entityInfo.mfgArea || 'None' }}</strong>
                </div>
                <div class="small mb-1">
                  <span class="text-secondary">Service Area:</span>
                  <strong class="text-success ms-1">{{ entityInfo.serviceArea || 'None' }}</strong>
                </div>
                <div class="small">
                  <span class="text-secondary">Circle & Division:</span>
                  <span class="text-light ms-1">{{ entityInfo.circleName || 'N/A' }} &bull; {{ entityInfo.divisionName || 'N/A' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Filing Status Summary Strip Footer -->
          <div class="card-footer bg-dark border-top border-secondary border-opacity-75 py-2 px-3">
            <div class="d-flex align-items-center justify-content-between flex-nowrap overflow-auto gap-2">
              <div class="d-flex align-items-center flex-nowrap gap-2 flex-shrink-0">
                <span class="text-warning small fw-bold">
                  <i class="bi bi-clock-history me-1 text-warning"></i> Filing Status:
                </span>
                <span v-if="entityInfo.binIssueDate && entityInfo.binIssueDate !== 'N/A'" class="status-box px-2 py-1 text-muted small" title="BIN Registration Date">
                  Reg: <span class="text-light ms-1 font-monospace">{{ entityInfo.binIssueDate }}</span>
                </span>
              </div>
              <div class="d-flex align-items-center flex-nowrap gap-1.5 flex-shrink-0">
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Total Due:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.totalDue }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Total Filed:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.totalSubmitted }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Activity Yes:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.activityYes }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Activity No:</span>
                  <span class="text-light fw-bold">{{ complianceInfo.activityNo }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Non-Filed:</span>
                  <span class="text-danger fw-bold">{{ complianceInfo.nonFiled }}</span>
                </div>
                <div class="status-box px-2 py-1 small font-monospace">
                  <span class="text-muted me-1">Compliance:</span>
                  <span class="text-success fw-bold">{{ complianceInfo.complianceRate }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Key Audit Findings & Compliance Observations (Row-Based) -->
        <div class="card bg-dark border-secondary shadow-sm mb-3 audit-findings-card">
          <div class="card-header bg-dark border-secondary py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span class="fw-bold text-warning small">
              <i class="bi bi-clipboard2-pulse me-1"></i> 3. KEY AUDIT FINDINGS & COMPLIANCE OBSERVATIONS
            </span>
            <span class="badge" :class="auditFindings.length === 0 ? 'bg-success' : 'bg-danger'">
              {{ auditFindings.length }} Finding(s) Identified
            </span>
          </div>
          <div class="card-body p-0">
            <div v-if="auditFindings.length === 0" class="text-center py-3 text-success small">
              <i class="bi bi-check-circle-fill fs-4 d-block mb-1"></i>
              No critical audit risk factors or non-compliance anomalies detected for this entity.
            </div>
            <div v-else class="table-responsive">
              <table class="table table-dark table-bordered border-secondary table-sm mb-0 align-middle">
                <thead class="table-dark small text-center">
                  <tr>
                    <th style="width: 4%;" class="text-center">#</th>
                    <th style="width: 14%;" class="text-start">Category</th>
                    <th style="width: 24%;" class="text-start">Finding / Issue</th>
                    <th style="width: 32%;" class="text-start">Observed Fact & Data Details</th>
                    <th style="width: 26%;" class="text-start">Audit & Legal Implication</th>
                  </tr>
                </thead>
                <tbody class="small">
                  <tr v-for="f in auditFindings" :key="'finding-' + f.sl">
                    <td class="text-center font-monospace fw-bold text-muted">{{ f.sl }}</td>
                    <td>
                      <span class="badge" :class="f.badgeClass">{{ f.category }}</span>
                    </td>
                    <td class="fw-semibold text-light text-start">{{ f.title }}</td>
                    <td class="text-light-50 text-justify">{{ f.observation }}</td>
                    <td class="text-warning-emphasis text-justify">{{ f.impact }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="p-2 border-top border-secondary text-muted text-justify" style="font-size: 0.75rem;">
              * Automated finding logic evaluates forced registration flags, return filing continuity, sales-to-rebate proportions, and treasury settlement under the VAT & SD Act 2012.
            </div>
          </div>
        </div>

      </div>

      <!-- ========================================================= -->
      <!-- PART 2: PRINT PAGE 2+ (LANDSCAPE) - 20-COLUMN FINANCIAL TABLE -->
      <!-- ========================================================= -->
      <div class="print-page-landscape">
        <!-- Section Header -->
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <span class="fw-bold text-info fs-6">
            <i class="bi bi-table me-1"></i> 4. HISTORICAL MONTHLY FINANCIAL & REVENUE DATA (BY FISCAL YEAR)
          </span>
          <span class="text-muted small">
            All monetary figures are in BDT &bull; Future or unfiled months are marked blank (-)
          </span>
        </div>

        <!-- Loop through selected Fiscal Years: each as independent Card with Header & Scrollbar -->
        <div
          v-for="fyGroup in filteredGrid"
          :key="fyGroup.fiscalYear.key"
          class="card bg-dark border-secondary shadow-sm mb-4 fy-table-card"
        >
          <!-- Fiscal Year Card Header -->
          <div class="card-header bg-dark border-secondary py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-calendar2-range text-info fs-5"></i>
              <span class="fw-bold text-light fs-6">{{ fyGroup.fiscalYear.label }}</span>
              <span class="badge bg-secondary text-light fw-normal" v-if="fyGroup.months && fyGroup.months.length > 0">
                {{ fyGroup.months[0].monthName }} {{ fyGroup.months[0].year }} &ndash; {{ fyGroup.months[fyGroup.months.length - 1].monthName }} {{ fyGroup.months[fyGroup.months.length - 1].year }}
              </span>
            </div>
            <div class="d-flex align-items-center gap-2 small">
              <span class="text-muted">Filtered Months: <strong class="text-light">{{ fyGroup.months.length }}</strong></span>
              <span class="text-secondary">|</span>
              <span class="text-muted">Total Sales: <strong class="text-warning font-monospace">{{ formatVal(fyGroup.subtotal.totalSalesValue) }}</strong></span>
            </div>
          </div>

          <!-- Card Body with its own Scrollable Table -->
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-dark table-bordered border-secondary table-sm table-hover mb-0 financial-table align-middle text-center">
                <thead class="table-dark align-middle">
                  <tr class="table-header-group">
                    <th rowspan="2" class="sticky-col col-sl">Sl</th>
                    <th rowspan="2" class="sticky-col col-period">Tax Period</th>
                    <th rowspan="2" class="col-act">Activity</th>
                    <th colspan="3" class="header-group-sales text-center">Sales & Output Tax</th>
                    <th colspan="2" class="header-group-purchase text-center">Purchase & Rebate</th>
                    <th colspan="7" class="header-group-adj text-center">Adjustments & Advance Tax</th>
                    <th colspan="3" class="header-group-vat text-center">VAT Settlement</th>
                    <th colspan="3" class="header-group-sd text-center">SD Settlement</th>
                  </tr>
                  <tr class="table-header-sub">
                    <!-- Sales & Output Tax -->
                    <th class="col-num">Sales Value</th>
                    <th class="col-num">Payable VAT</th>
                    <th class="col-num">Payable SD</th>
                    <!-- Purchase & Rebate -->
                    <th class="col-num">Purchase Value</th>
                    <th class="col-num">Rebate</th>
                    <!-- Adjustments -->
                    <th class="col-num">Inc. Adj.</th>
                    <th class="col-num">Dec. Adj.</th>
                    <th class="col-num">VDS Inc</th>
                    <th class="col-num">VDS Dec</th>
                    <th class="col-num">AT</th>
                    <th class="col-num">Fines</th>
                    <th class="col-num">Total Adj</th>
                    <!-- VAT Settlement -->
                    <th class="col-num">Net Payable VAT</th>
                    <th class="col-num">Deposited VAT</th>
                    <th class="col-num">Closing Balance VAT</th>
                    <!-- SD Settlement -->
                    <th class="col-num">Net Payable SD</th>
                    <th class="col-num">Deposited SD</th>
                    <th class="col-num">Closing Balance SD</th>
                  </tr>
                </thead>

                <tbody>
                  <!-- Months Rows for this Fiscal Year -->
                  <tr
                    v-for="(row, rIdx) in fyGroup.months"
                    :key="row.period"
                    class="month-row"
                    :class="{ 'future-row opacity-50': row.isFuture, 'no-data-row': !row.hasData && !row.isFuture }"
                  >
                    <td class="font-monospace col-sl">{{ Number(rIdx) + 1 }}</td>
                    <td class="text-start fw-semibold font-monospace col-period" :class="row.hasData ? 'text-light' : 'text-muted'">
                      {{ row.monthName }} {{ row.year }}
                    </td>
                    <td class="col-act">
                      <span v-if="row.hasData" :class="row.hasActivities === 'Yes' ? 'badge bg-success small' : 'badge bg-secondary small'">
                        {{ row.hasActivities }}
                      </span>
                      <span v-else class="text-muted">-</span>
                    </td>

                    <!-- Sales & Output Tax -->
                    <td class="text-end font-monospace">{{ formatVal(row.totalSalesValue) }}</td>
                    <td class="text-end font-monospace" :class="row.totalPayableVat > 0 ? 'text-warning' : ''">{{ formatVal(row.totalPayableVat) }}</td>
                    <td class="text-end font-monospace" :class="row.totalPayableSd > 0 ? 'text-warning' : ''">{{ formatVal(row.totalPayableSd) }}</td>

                    <!-- Purchase & Rebate -->
                    <td class="text-end font-monospace">{{ formatVal(row.totalInputTaxValue) }}</td>
                    <td class="text-end font-monospace" :class="row.totalInputTaxCreditVat > 0 ? 'text-info' : ''">{{ formatVal(row.totalInputTaxCreditVat) }}</td>

                    <!-- Adjustments -->
                    <td class="text-end font-monospace">{{ formatVal(row.increasingAdjustment) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(row.decreasingAdjustment) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(row.vdsIncreasing) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(row.vdsDecreasing) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(row.advancedTaxPaid) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(row.finePenalty) }}</td>
                    <td class="text-end font-monospace text-secondary fw-semibold">{{ formatVal(row.totalAdjustments) }}</td>

                    <!-- VAT Settlement -->
                    <td class="text-end font-monospace fw-bold" :class="row.netPayableVat > 0 ? 'text-danger' : 'text-light'">{{ formatVal(row.netPayableVat) }}</td>
                    <td class="text-end font-monospace fw-bold text-success">{{ formatVal(row.depositedVat) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(row.closingBalanceVat) }}</td>

                    <!-- SD Settlement -->
                    <td class="text-end font-monospace fw-bold" :class="row.netPayableSd > 0 ? 'text-danger' : 'text-light'">{{ formatVal(row.netPayableSd) }}</td>
                    <td class="text-end font-monospace fw-bold text-success">{{ formatVal(row.depositedSd) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(row.closingBalanceSd) }}</td>
                  </tr>
                </tbody>

                <!-- Fiscal Year Subtotal Footer -->
                <tfoot class="table-dark align-middle border-top border-secondary">
                  <tr class="subtotal-row fw-bold bg-dark text-warning">
                    <td colspan="3" class="text-start ps-3 py-1.5 text-info">
                      Subtotal ({{ fyGroup.fiscalYear.label }}):
                    </td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.totalSalesValue) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.totalPayableVat) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.totalPayableSd) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.totalInputTaxValue) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.totalInputTaxCreditVat) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.increasingAdjustment) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.decreasingAdjustment) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.vdsIncreasing) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.vdsDecreasing) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.advancedTaxPaid) }}</td>
                    <td class="text-end font-monospace">{{ formatVal(fyGroup.subtotal.finePenalty) }}</td>
                    <td class="text-end font-monospace text-secondary">{{ formatVal(fyGroup.subtotal.totalAdjustments) }}</td>
                    <td class="text-end font-monospace text-danger">{{ formatVal(fyGroup.subtotal.netPayableVat) }}</td>
                    <td class="text-end font-monospace text-success">{{ formatVal(fyGroup.subtotal.depositedVat) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(fyGroup.subtotal.closingBalanceVat) }}</td>
                    <td class="text-end font-monospace text-danger">{{ formatVal(fyGroup.subtotal.netPayableSd) }}</td>
                    <td class="text-end font-monospace text-success">{{ formatVal(fyGroup.subtotal.depositedSd) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(fyGroup.subtotal.closingBalanceSd) }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Section 5: Grand Totals Summary Card -->
        <div class="card bg-dark border-warning shadow-sm mb-4 grand-total-card">
          <div class="card-header bg-dark border-warning py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span class="fw-bold text-warning fs-6">
              <i class="bi bi-calculator me-2"></i> 5. GRAND TOTAL SUMMARY (ALL SELECTED PERIODS)
            </span>
            <span class="text-muted small">
              Cumulative aggregate across all filtered fiscal years
            </span>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-dark table-bordered border-secondary table-sm mb-0 financial-table align-middle text-center">
                <thead class="table-dark align-middle">
                  <tr class="table-header-group">
                    <th rowspan="2" class="sticky-col col-sl">#</th>
                    <th rowspan="2" class="sticky-col col-period">Summary Period</th>
                    <th rowspan="2" class="col-act">Status</th>
                    <th colspan="3" class="header-group-sales text-center">Sales & Output Tax</th>
                    <th colspan="2" class="header-group-purchase text-center">Purchase & Rebate</th>
                    <th colspan="7" class="header-group-adj text-center">Adjustments & Advance Tax</th>
                    <th colspan="3" class="header-group-vat text-center">VAT Settlement</th>
                    <th colspan="3" class="header-group-sd text-center">SD Settlement</th>
                  </tr>
                  <tr class="table-header-sub">
                    <th class="col-num">Sales Value</th>
                    <th class="col-num">Payable VAT</th>
                    <th class="col-num">Payable SD</th>
                    <th class="col-num">Purchase Value</th>
                    <th class="col-num">Rebate</th>
                    <th class="col-num">Inc. Adj.</th>
                    <th class="col-num">Dec. Adj.</th>
                    <th class="col-num">VDS Inc</th>
                    <th class="col-num">VDS Dec</th>
                    <th class="col-num">AT</th>
                    <th class="col-num">Fines</th>
                    <th class="col-num">Total Adj</th>
                    <th class="col-num">Net Payable VAT</th>
                    <th class="col-num">Deposited VAT</th>
                    <th class="col-num">Closing Balance VAT</th>
                    <th class="col-num">Net Payable SD</th>
                    <th class="col-num">Deposited SD</th>
                    <th class="col-num">Closing Balance SD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="grand-total-row fw-bold text-light bg-darker">
                    <td colspan="3" class="text-start ps-3 py-2 text-warning fs-6">
                      CUMULATIVE GRAND TOTAL:
                    </td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.totalSalesValue) }}</td>
                    <td class="text-end font-monospace text-warning">{{ formatVal(computedGrandTotal.totalPayableVat) }}</td>
                    <td class="text-end font-monospace text-warning">{{ formatVal(computedGrandTotal.totalPayableSd) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.totalInputTaxValue) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(computedGrandTotal.totalInputTaxCreditVat) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.increasingAdjustment) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.decreasingAdjustment) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.vdsIncreasing) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.vdsDecreasing) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.advancedTaxPaid) }}</td>
                    <td class="text-end font-monospace text-light">{{ formatVal(computedGrandTotal.finePenalty) }}</td>
                    <td class="text-end font-monospace text-secondary">{{ formatVal(computedGrandTotal.totalAdjustments) }}</td>
                    <td class="text-end font-monospace text-danger">{{ formatVal(computedGrandTotal.netPayableVat) }}</td>
                    <td class="text-end font-monospace text-success">{{ formatVal(computedGrandTotal.depositedVat) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(computedGrandTotal.closingBalanceVat) }}</td>
                    <td class="text-end font-monospace text-danger">{{ formatVal(computedGrandTotal.netPayableSd) }}</td>
                    <td class="text-end font-monospace text-success">{{ formatVal(computedGrandTotal.depositedSd) }}</td>
                    <td class="text-end font-monospace text-info">{{ formatVal(computedGrandTotal.closingBalanceSd) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from '@/plugins/axios';
import * as XLSX from 'xlsx';

const route = useRoute();
const router = useRouter();

// State
const isLoading = ref(true);
const entityInfo = ref<any>(null);
const complianceInfo = ref<any>({});
const allFiscalYears = ref<any[]>([]);
const fromPeriod = ref<string>('2022-07');
const toPeriod = ref<string>('2027-06');
const gridData = ref<any[]>([]);
const grandTotalData = ref<any>({});
const discrepancies = ref<any[]>([]);

const currentTimestamp = computed(() => {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 19);
});

// Format numeric cells
const formatVal = (v: any) => {
  if (v === null || v === undefined) return '-';
  const num = Number(v);
  if (isNaN(num)) return '-';
  if (num === 0) return '0.00';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Filtered Grid based on selected Month-Year range (fromPeriod to toPeriod)
const filteredGrid = computed(() => {
  if (!gridData.value || gridData.value.length === 0) return [];
  const from = fromPeriod.value || '1900-01';
  const to = toPeriod.value || '2099-12';

  const result: any[] = [];
  for (const g of gridData.value) {
    const validMonths = g.months.filter((m: any) => m.period >= from && m.period <= to);
    if (validMonths.length > 0) {
      const subtotal = {
        totalSalesValue: 0,
        totalPayableVat: 0,
        totalPayableSd: 0,
        totalInputTaxValue: 0,
        totalInputTaxCreditVat: 0,
        increasingAdjustment: 0,
        decreasingAdjustment: 0,
        vdsIncreasing: 0,
        vdsDecreasing: 0,
        advancedTaxPaid: 0,
        finePenalty: 0,
        totalAdjustments: 0,
        netPayableVat: 0,
        depositedVat: 0,
        closingBalanceVat: 0,
        netPayableSd: 0,
        depositedSd: 0,
        closingBalanceSd: 0
      };

      for (const m of validMonths) {
        if (m.hasData) {
          subtotal.totalSalesValue += m.totalSalesValue || 0;
          subtotal.totalPayableVat += m.totalPayableVat || 0;
          subtotal.totalPayableSd += m.totalPayableSd || 0;
          subtotal.totalInputTaxValue += m.totalInputTaxValue || 0;
          subtotal.totalInputTaxCreditVat += m.totalInputTaxCreditVat || 0;
          subtotal.increasingAdjustment += m.increasingAdjustment || 0;
          subtotal.decreasingAdjustment += m.decreasingAdjustment || 0;
          subtotal.vdsIncreasing += m.vdsIncreasing || 0;
          subtotal.vdsDecreasing += m.vdsDecreasing || 0;
          subtotal.advancedTaxPaid += m.advancedTaxPaid || 0;
          subtotal.finePenalty += m.finePenalty || 0;
          subtotal.totalAdjustments += m.totalAdjustments || 0;
          subtotal.netPayableVat += m.netPayableVat || 0;
          subtotal.depositedVat += m.depositedVat || 0;
          subtotal.closingBalanceVat = m.closingBalanceVat || 0;
          subtotal.netPayableSd += m.netPayableSd || 0;
          subtotal.depositedSd += m.depositedSd || 0;
          subtotal.closingBalanceSd = m.closingBalanceSd || 0;
        }
      }

      result.push({
        fiscalYear: g.fiscalYear,
        months: validMonths,
        subtotal
      });
    }
  }
  return result;
});

// Recompute Grand Total for selected Month-Year range
const computedGrandTotal = computed(() => {
  const tot = {
    totalSalesValue: 0,
    totalPayableVat: 0,
    totalPayableSd: 0,
    totalInputTaxValue: 0,
    totalInputTaxCreditVat: 0,
    increasingAdjustment: 0,
    decreasingAdjustment: 0,
    vdsIncreasing: 0,
    vdsDecreasing: 0,
    advancedTaxPaid: 0,
    finePenalty: 0,
    totalAdjustments: 0,
    netPayableVat: 0,
    depositedVat: 0,
    closingBalanceVat: 0,
    netPayableSd: 0,
    depositedSd: 0,
    closingBalanceSd: 0
  };

  for (const g of filteredGrid.value) {
    tot.totalSalesValue += g.subtotal.totalSalesValue;
    tot.totalPayableVat += g.subtotal.totalPayableVat;
    tot.totalPayableSd += g.subtotal.totalPayableSd;
    tot.totalInputTaxValue += g.subtotal.totalInputTaxValue;
    tot.totalInputTaxCreditVat += g.subtotal.totalInputTaxCreditVat;
    tot.increasingAdjustment += g.subtotal.increasingAdjustment;
    tot.decreasingAdjustment += g.subtotal.decreasingAdjustment;
    tot.vdsIncreasing += g.subtotal.vdsIncreasing;
    tot.vdsDecreasing += g.subtotal.vdsDecreasing;
    tot.advancedTaxPaid += g.subtotal.advancedTaxPaid;
    tot.finePenalty += g.subtotal.finePenalty;
    tot.totalAdjustments += g.subtotal.totalAdjustments;
    tot.netPayableVat += g.subtotal.netPayableVat;
    tot.depositedVat += g.subtotal.depositedVat;
    tot.closingBalanceVat = g.subtotal.closingBalanceVat;
    tot.netPayableSd += g.subtotal.netPayableSd;
    tot.depositedSd += g.subtotal.depositedSd;
    tot.closingBalanceSd = g.subtotal.closingBalanceSd;
  }
  return tot;
});

// Dynamic Row-Based Audit Findings & Risk Observations
const auditFindings = computed(() => {
  const list: { sl: number; category: string; badgeClass: string; title: string; observation: string; impact: string }[] = [];
  let counter = 1;

  // 1. Forced Registration
  if (entityInfo.value?.forcedRegistration === 'Yes') {
    list.push({
      sl: counter++,
      category: 'Registration',
      badgeClass: 'bg-danger text-light',
      title: 'Forced Registration',
      observation: `The entity was registered mandatorily by VAT authorities on ${entityInfo.value.binIssueDate || 'N/A'} under ${entityInfo.value.circleName || 'N/A'}, ${entityInfo.value.divisionName || 'N/A'}.`,
      impact: 'Indicates historical reluctance to register voluntarily; heightened audit scrutiny required.'
    });
  }

  // 2. Non-Filing / Return Compliance
  if (complianceInfo.value && Number(complianceInfo.value.nonFiled) > 0) {
    const nonFiledCount = Number(complianceInfo.value.nonFiled);
    const nonFiledPeriods = (discrepancies.value || [])
      .filter((d: any) => d.type === 'Non-Filed Return')
      .map((d: any) => d.period)
      .join(', ');

    list.push({
      sl: counter++,
      category: 'Filing Compliance',
      badgeClass: 'bg-danger text-light',
      title: `Severe Non-Filing (${nonFiledCount} Months Unsubmitted)`,
      observation: `Out of ${complianceInfo.value.totalDue} due tax periods, the entity failed to file returns for ${nonFiledCount} periods (Compliance Rate: ${complianceInfo.value.complianceRate}%). Unfiled periods: ${nonFiledPeriods || 'Multiple months'}.`,
      impact: 'Section 85 of VAT & SD Act 2012 non-compliance penalty applies for each unfiled tax period.'
    });
  }

  // 3. Sales Volume vs Frequency (Single Month Spike)
  const activeMonths: any[] = [];
  for (const g of filteredGrid.value) {
    for (const m of g.months) {
      if (m.hasData && m.totalSalesValue > 0) {
        activeMonths.push(m);
      }
    }
  }
  if (activeMonths.length === 1 && Number(complianceInfo.value?.nonFiled) >= 2) {
    const singleMonth = activeMonths[0];
    list.push({
      sl: counter++,
      category: 'Sales Pattern',
      badgeClass: 'bg-warning text-dark',
      title: 'Abnormal Single-Month Volume',
      observation: `After remaining unfiled/dormant for months, sudden high sales turnover of BDT ${formatVal(singleMonth.totalSalesValue)} declared in a single return (${singleMonth.monthName} ${singleMonth.year}).`,
      impact: 'Potential suppressed sales in preceding unfiled months or artificial bunching of business revenue.'
    });
  }

  // 4. Input Tax Rebate vs Sales Ratio
  const totSales = computedGrandTotal.value.totalSalesValue || 0;
  const totInputVal = computedGrandTotal.value.totalInputTaxValue || 0;
  const totItc = computedGrandTotal.value.totalInputTaxCreditVat || 0;
  const totPayableVat = computedGrandTotal.value.totalPayableVat || 0;
  const totDepositedVat = computedGrandTotal.value.depositedVat || 0;

  if (totSales > 0 && totInputVal > 0) {
    const purchaseRatio = ((totInputVal / totSales) * 100).toFixed(1);
    if (Number(purchaseRatio) > 85) {
      list.push({
        sl: counter++,
        category: 'Rebate & ITC',
        badgeClass: 'bg-info text-dark',
        title: `High Input Purchase Ratio (${purchaseRatio}% of Sales)`,
        observation: `Total purchases of BDT ${formatVal(totInputVal)} claimed against sales of BDT ${formatVal(totSales)}, yielding BDT ${formatVal(totItc)} in input tax rebate.`,
        impact: 'Mushak-6.3 tax invoices for input purchases and supplier compliance require physical audit verification.'
      });
    }
  }

  // 5. Zero Treasury Deposit with Net Negative / Closing Balance
  if (totSales > 0 && totDepositedVat === 0) {
    list.push({
      sl: counter++,
      category: 'Treasury Deposit',
      badgeClass: 'bg-danger text-light',
      title: 'Zero Treasury Deposit',
      observation: `Despite declaring gross sales of BDT ${formatVal(totSales)} and output VAT of BDT ${formatVal(totPayableVat)}, government treasury deposit is BDT 0.00 due to full ITC offset and closing balance carry-forward of BDT ${formatVal(computedGrandTotal.value.closingBalanceVat)}.`,
      impact: 'No direct cash revenue contributed to national exchequer; rebate authenticity is critical.'
    });
  }

  // 6. Treasury Shortfalls from discrepancies
  const shortfalls = (discrepancies.value || []).filter((d: any) => d.type && d.type.includes('Shortfall'));
  for (const sf of shortfalls) {
    list.push({
      sl: counter++,
      category: 'Treasury Shortfall',
      badgeClass: 'bg-danger text-light',
      title: sf.type,
      observation: `${sf.period}: ${sf.description}`,
      impact: 'Direct revenue loss; demand notice with penalty and 2% monthly interest applicable under Section 127.'
    });
  }

  // 7. Activity status inconsistency
  const actInconsistencies = (discrepancies.value || []).filter((d: any) => d.type === 'Activity Status Inconsistency');
  for (const act of actInconsistencies) {
    list.push({
      sl: counter++,
      category: 'Activity Declaration',
      badgeClass: 'bg-warning text-dark',
      title: 'Zero Return Activity Inconsistency',
      observation: `${act.period}: ${act.description}`,
      impact: 'Misstatement of commercial business activity in VAT-9.1 statutory return.'
    });
  }

  return list;
});

const resetToDefaultRange = () => {
  if (gridData.value && gridData.value.length > 0) {
    const firstFy = gridData.value[0];
    const lastFy = gridData.value[gridData.value.length - 1];
    fromPeriod.value = `${firstFy.fiscalYear.startYear}-07`;
    toPeriod.value = `${lastFy.fiscalYear.endYear}-06`;
  }
};

const fetchReportData = async () => {
  const bin = route.query.bin as string;
  if (!bin) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  try {
    const res = await axios.get(`/api/return-data-analyser/entity-details-report?bin=${encodeURIComponent(bin)}`);
    const data = res.data?.data;
    if (data) {
      entityInfo.value = data.entity;
      complianceInfo.value = data.compliance || {};
      allFiscalYears.value = data.fiscalYears || [];
      gridData.value = data.grid || [];
      grandTotalData.value = data.grandTotal || {};
      discrepancies.value = data.discrepancies || [];

      if (data.grid && data.grid.length > 0) {
        const firstFy = data.grid[0];
        const lastFy = data.grid[data.grid.length - 1];
        fromPeriod.value = `${firstFy.fiscalYear.startYear}-07`;
        toPeriod.value = `${lastFy.fiscalYear.endYear}-06`;
      }
    }
  } catch (error) {
    console.error('Failed to fetch entity details report:', error);
  } finally {
    isLoading.value = false;
  }
};

const triggerPrint = () => {
  window.print();
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    window.close();
  }
};

const closeTab = () => {
  window.close();
};

const exportToExcel = () => {
  if (!entityInfo.value) return;

  const rows: any[] = [];
  for (const g of filteredGrid.value) {
    for (const m of g.months) {
      rows.push({
        'FY': g.fiscalYear.label,
        'Sl': m.sl,
        'Tax Period': `${m.monthName} ${m.year}`,
        'Activity': m.hasActivities,
        'Total Sales Value': m.totalSalesValue ?? '',
        'Total Payable VAT': m.totalPayableVat ?? '',
        'Total Payable SD': m.totalPayableSd ?? '',
        'Total Input Tax Value': m.totalInputTaxValue ?? '',
        'Total Input Tax Credit (ITC)': m.totalInputTaxCreditVat ?? '',
        'Increasing Adj': m.increasingAdjustment ?? '',
        'Decreasing Adj': m.decreasingAdjustment ?? '',
        'VDS Increasing': m.vdsIncreasing ?? '',
        'VDS Decreasing': m.vdsDecreasing ?? '',
        'Advance Tax Paid': m.advancedTaxPaid ?? '',
        'Fine & Penalty': m.finePenalty ?? '',
        'Total Adjustments': m.totalAdjustments ?? '',
        'Net Payable VAT': m.netPayableVat ?? '',
        'Deposited VAT': m.depositedVat ?? '',
        'Closing Balance VAT': m.closingBalanceVat ?? '',
        'Net Payable SD': m.netPayableSd ?? '',
        'Deposited SD': m.depositedSd ?? '',
        'Closing Balance SD': m.closingBalanceSd ?? '',
        'Submission Date': m.submissionDate ?? ''
      });
    }
    // Subtotal
    rows.push({
      'FY': g.fiscalYear.label + ' Subtotal',
      'Sl': '',
      'Tax Period': 'SUBTOTAL',
      'Activity': '',
      'Total Sales Value': g.subtotal.totalSalesValue,
      'Total Payable VAT': g.subtotal.totalPayableVat,
      'Total Payable SD': g.subtotal.totalPayableSd,
      'Total Input Tax Value': g.subtotal.totalInputTaxValue,
      'Total Input Tax Credit (ITC)': g.subtotal.totalInputTaxCreditVat,
      'Increasing Adj': g.subtotal.increasingAdjustment,
      'Decreasing Adj': g.subtotal.decreasingAdjustment,
      'VDS Increasing': g.subtotal.vdsIncreasing,
      'VDS Decreasing': g.subtotal.vdsDecreasing,
      'Advance Tax Paid': g.subtotal.advancedTaxPaid,
      'Fine & Penalty': g.subtotal.finePenalty,
      'Total Adjustments': g.subtotal.totalAdjustments,
      'Net Payable VAT': g.subtotal.netPayableVat,
      'Deposited VAT': g.subtotal.depositedVat,
      'Closing Balance VAT': g.subtotal.closingBalanceVat,
      'Net Payable SD': g.subtotal.netPayableSd,
      'Deposited SD': g.subtotal.depositedSd,
      'Closing Balance SD': g.subtotal.closingBalanceSd,
      'Submission Date': ''
    });
  }

  // Grand Total
  rows.push({
    'FY': 'GRAND TOTAL',
    'Sl': '',
    'Tax Period': 'TOTAL',
    'Activity': '',
    'Total Sales Value': computedGrandTotal.value.totalSalesValue,
    'Total Payable VAT': computedGrandTotal.value.totalPayableVat,
    'Total Payable SD': computedGrandTotal.value.totalPayableSd,
    'Total Input Tax Value': computedGrandTotal.value.totalInputTaxValue,
    'Total Input Tax Credit (ITC)': computedGrandTotal.value.totalInputTaxCreditVat,
    'Increasing Adj': computedGrandTotal.value.increasingAdjustment,
    'Decreasing Adj': computedGrandTotal.value.decreasingAdjustment,
    'VDS Increasing': computedGrandTotal.value.vdsIncreasing,
    'VDS Decreasing': computedGrandTotal.value.vdsDecreasing,
    'Advance Tax Paid': computedGrandTotal.value.advancedTaxPaid,
    'Fine & Penalty': computedGrandTotal.value.finePenalty,
    'Total Adjustments': computedGrandTotal.value.totalAdjustments,
    'Net Payable VAT': computedGrandTotal.value.netPayableVat,
    'Deposited VAT': computedGrandTotal.value.depositedVat,
    'Closing Balance VAT': computedGrandTotal.value.closingBalanceVat,
    'Net Payable SD': computedGrandTotal.value.netPayableSd,
    'Deposited SD': computedGrandTotal.value.depositedSd,
    'Closing Balance SD': computedGrandTotal.value.closingBalanceSd,
    'Submission Date': ''
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '5Year_Revenue_Report');
  const filename = `Entity_Audit_Report_${entityInfo.value.bin}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

onMounted(() => {
  fetchReportData();
});
</script>

<style scoped>
.text-justify {
  text-align: justify !important;
  text-justify: inter-word !important;
}

.cursor-pointer {
  cursor: pointer;
}

.bg-surface {
  background-color: #1a1d21 !important;
}

.bg-darker {
  background-color: #121518 !important;
}

.status-box {
  background-color: #1a1d21;
  border: 1px solid #495057;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  user-select: none;
  pointer-events: none;
  line-height: 1.2;
}

.stat-box {
  min-height: 65px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.fy-header-row td {
  background-color: #18202a !important;
  color: #ffffff !important;
  font-size: 0.82rem;
}

.subtotal-row td {
  background-color: #1c2128 !important;
  color: #e2e8f0 !important;
}

.grand-total-row td {
  background-color: #13171c !important;
}

.financial-table th,
.financial-table td {
  padding: 0.35rem 0.45rem;
  font-size: 0.78rem;
  white-space: nowrap;
}

.financial-table th {
  font-weight: 600;
  letter-spacing: 0.2px;
}

.col-sl {
  width: 35px;
}

.col-period {
  min-width: 110px;
}

.col-act {
  width: 70px;
}

.col-num {
  min-width: 95px;
}

/* Header Group Colors */
.header-group-sales {
  background-color: #2c2416 !important;
  color: #ffc107 !important;
  border-bottom: 2px solid #ffc107 !important;
}

.header-group-purchase {
  background-color: #16262e !important;
  color: #0dcaf0 !important;
  border-bottom: 2px solid #0dcaf0 !important;
}

.header-group-adj {
  background-color: #212529 !important;
  color: #adb5bd !important;
  border-bottom: 2px solid #6c757d !important;
}

.header-group-vat {
  background-color: #2c1818 !important;
  color: #ea868f !important;
  border-bottom: 2px solid #dc3545 !important;
}

.header-group-sd {
  background-color: #18281f !important;
  color: #75b798 !important;
  border-bottom: 2px solid #198754 !important;
}

/* Custom Thin Scrollbars */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.15);
}
::-webkit-scrollbar-thumb {
  background: #495057;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #6c757d;
}

@media (min-width: 768px) {
  .border-start-md {
    border-left: 1px solid #374151 !important;
  }
}

/* ========================================================= */
/* MULTI-PAGE PRINT STYLES (A4 Margin: 0.6cm)                */
/* Page 1: Portrait (Registration & Compliance Summary)      */
/* Page 2+: Landscape (20-Column Financial Revenue Table)    */
/* ========================================================= */
@media print {
  @page {
    size: A4 landscape;
    margin: 0.6cm;
  }

  html,
  body,
  .entity-details-report-page {
    background-color: #ffffff !important;
    color: #000000 !important;
    padding: 0 !important;
    margin: 0 !important;
    display: block !important;
    width: 100% !important;
  }

  .no-print,
  .d-print-none {
    display: none !important;
  }

  .report-header {
    padding-top: 0 !important;
    margin-bottom: 8px !important;
    border-bottom: 1px solid #777777 !important;
  }

  .report-main-title {
    font-size: 14pt !important;
    color: #000000 !important;
  }

  .print-page-summary {
    display: block !important;
    width: 100% !important;
    page-break-after: always !important;
    break-after: page !important;
  }

  .print-page-landscape {
    display: block !important;
    width: 100% !important;
    page-break-before: always !important;
    break-before: page !important;
  }

  /* Section 1 & 2: Entity Profile Card in Print */
  .entity-profile-card {
    background-color: #ffffff !important;
    color: #000000 !important;
    border: 1px solid #777777 !important;
    border-radius: 6px !important;
    margin-bottom: 10px !important;
    page-break-inside: avoid;
    break-inside: avoid;
    font-size: 10pt !important;
  }

  .entity-profile-card .card-body {
    padding: 8px 14px !important;
    background-color: #ffffff !important;
    font-size: 10pt !important;
  }

  .entity-profile-card h5 {
    color: #000000 !important;
    font-size: 14pt !important;
    font-weight: bold !important;
  }

  .entity-profile-card .small {
    font-size: 10pt !important;
  }

  .entity-profile-card .badge.bg-danger {
    background-color: #dc3545 !important;
    color: #ffffff !important;
    border: none !important;
    font-size: 8.5pt !important;
  }

  .entity-profile-card .border-start {
    border-left: 1px solid #bbbbbb !important;
    padding-left: 15px !important;
  }

  .entity-profile-card .text-secondary,
  .entity-profile-card .text-muted {
    color: #444444 !important;
  }

  .entity-profile-card .text-light {
    color: #000000 !important;
    font-weight: 600 !important;
  }

  .entity-profile-card .text-warning,
  .entity-profile-card .text-info,
  .entity-profile-card .text-success {
    color: #000000 !important;
    font-weight: bold !important;
  }

  /* Filing Status Strip in Print */
  .entity-profile-card .card-footer {
    background-color: #f8f9fa !important;
    color: #000000 !important;
    border-top: 1px solid #999999 !important;
    padding: 5px 12px !important;
  }

  .status-box {
    background-color: #ffffff !important;
    border: 1px solid #888888 !important;
    color: #000000 !important;
    border-radius: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    padding: 3px 8px !important;
    font-size: 10pt !important;
    margin-right: 4px !important;
  }

  .status-box .text-muted {
    color: #333333 !important;
    font-weight: normal !important;
  }

  .status-box .text-light,
  .status-box .text-danger,
  .status-box .text-success {
    color: #000000 !important;
    font-weight: bold !important;
  }

  /* Section 3: Audit Findings Table in Print */
  .audit-findings-card {
    background-color: #ffffff !important;
    border: 1px solid #777777 !important;
    border-radius: 6px !important;
    margin-bottom: 10px !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .audit-findings-card .card-header {
    background-color: #f1f3f5 !important;
    color: #000000 !important;
    border-bottom: 1px solid #777777 !important;
    font-weight: bold !important;
    padding: 6px 12px !important;
    font-size: 11pt !important;
  }

  .audit-findings-card table {
    width: 100% !important;
    border-collapse: collapse !important;
    table-layout: fixed !important;
    background-color: #ffffff !important;
  }

  .audit-findings-card th,
  .audit-findings-card td {
    border: 1px solid #888888 !important;
    background-color: #ffffff !important;
    color: #000000 !important;
    padding: 5px 8px !important;
    font-size: 10pt !important;
    line-height: 1.35 !important;
  }

  .audit-findings-card thead th {
    background-color: #e9ecef !important;
    font-weight: bold !important;
    color: #000000 !important;
  }

  .audit-findings-card .badge {
    border: 1px solid #444444 !important;
    color: #000000 !important;
    background-color: #f1f3f5 !important;
    font-size: 8.5pt !important;
    padding: 2.5px 6px !important;
    border-radius: 3px !important;
  }

  .audit-findings-card .text-light,
  .audit-findings-card .text-light-50,
  .audit-findings-card .text-warning-emphasis,
  .audit-findings-card .text-muted {
    color: #000000 !important;
  }

  /* Section 4 & 5: Landscape 20-Column Financial Tables in Print */
  .fy-table-card,
  .grand-total-card {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 12px !important;
    background-color: #ffffff !important;
    border: 1px solid #777777 !important;
  }

  .fy-table-card .card-header,
  .grand-total-card .card-header {
    background-color: #f1f3f5 !important;
    color: #000000 !important;
    border-bottom: 1px solid #777777 !important;
    padding: 4px 8px !important;
    font-size: 10pt !important;
    font-weight: bold !important;
  }

  .table-responsive {
    overflow: visible !important;
    display: block !important;
    width: 100% !important;
  }

  .financial-table {
    width: 100% !important;
    font-size: 10pt !important;
    color: #000000 !important;
    border-collapse: collapse !important;
    table-layout: auto !important;
  }

  .financial-table th,
  .financial-table td {
    padding: 2.5px 3px !important;
    border: 1px solid #888888 !important;
    color: #000000 !important;
    background-color: #ffffff !important;
    white-space: nowrap !important;
    font-size: 10pt !important;
    line-height: 1.25 !important;
  }

  .financial-table thead th {
    background-color: #e9ecef !important;
    color: #000000 !important;
    font-weight: bold !important;
    font-size: 10pt !important;
  }

  .header-group-sales,
  .header-group-purchase,
  .header-group-adj,
  .header-group-vat,
  .header-group-sd {
    background-color: #dee2e6 !important;
    color: #000000 !important;
    font-weight: bold !important;
    border-bottom: 1.5px solid #000000 !important;
  }

  .fy-header-row td {
    background-color: #dee2e6 !important;
    font-weight: bold !important;
    color: #000000 !important;
  }

  .subtotal-row td,
  .grand-total-row td {
    background-color: #f1f3f5 !important;
    font-weight: bold !important;
    color: #000000 !important;
  }
}
</style>
