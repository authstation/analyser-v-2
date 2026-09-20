<template>
  <div>
    <!-- GLOBAL FILTERS -->
    <div class="card bg-dark border-secondary shadow-sm mb-4">
      <div class="card-body p-3">
        <!-- TOP ROW: CIRCLE, POLICE STATION, DATE RANGE + RESET -->
        <div class="row g-3 align-items-end mb-2">
          <!-- Col 1: Circle -->
          <div class="col-12 col-md-4">
            <label class="form-label text-muted small fw-bold mb-1">
              <i class="bi bi-funnel-fill me-1"></i>Filter by Circle
            </label>
            <div class="dropdown">
              <button
                class="form-control form-control-sm bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center"
                type="button"
                v-bs-dropdown
                data-bs-toggle="dropdown"
                data-bs-auto-close="outside"
                aria-expanded="false"
              >
                <span class="text-truncate">{{ filters.circleIds.length > 0 ? filters.circleIds.length + ' Selected' : 'All Circles' }}</span>
              </button>
              <div class="dropdown-menu dropdown-menu-dark bg-dark w-100 p-2 border-secondary shadow" @click.stop style="min-width: 250px;">
                <input
                  type="text"
                  class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none"
                  placeholder="Type to search..."
                  v-model="circleFilterText"
                >
                <div style="max-height: 200px; overflow-y: auto;">
                  <div class="form-check mb-1 ms-3">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      id="rad-circle-all"
                      :checked="filters.circleIds.length === 0"
                      @change="selectAllCircles"
                    >
                    <label class="form-check-label" for="rad-circle-all">All Circles</label>
                  </div>
                  <div class="form-check mb-1 ms-3" v-for="c in filteredCircles" :key="c.id">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      :value="c.id"
                      :id="'rad-circle-' + c.id"
                      :checked="filters.circleIds.includes(Number(c.id))"
                      @change="toggleCircle(Number(c.id))"
                    >
                    <label class="form-check-label" :for="'rad-circle-' + c.id">{{ c.name }}</label>
                  </div>
                  <div v-if="filteredCircles.length === 0" class="text-muted small px-3 py-1">No circles found</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Col 2: Police Station -->
          <div class="col-12 col-md-4">
            <label class="form-label text-muted small fw-bold mb-1">
              <i class="bi bi-building me-1"></i>Filter by Police Station
            </label>
            <div class="dropdown">
              <button
                class="form-control form-control-sm bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center"
                type="button"
                v-bs-dropdown
                data-bs-toggle="dropdown"
                data-bs-auto-close="outside"
                aria-expanded="false"
              >
                <span class="text-truncate">{{ selectedPsCount > 0 ? selectedPsCount + ' Selected' : 'All Police Stations' }}</span>
              </button>
              <div class="dropdown-menu dropdown-menu-dark bg-dark p-2 border-secondary shadow w-100" @click.stop style="min-width: 250px;">
                <input
                  type="text"
                  class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none"
                  placeholder="Type to search..."
                  v-model="psFilterText"
                >
                <div style="max-height: 200px; overflow-y: auto;">
                  <div class="form-check mb-1 ms-3">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      id="rad-ps-all"
                      :checked="filters.policeStationIds.length === 0"
                      @change="selectAllPs"
                    >
                    <label class="form-check-label" for="rad-ps-all">All Police Stations</label>
                  </div>
                  <div class="form-check mb-1 ms-3" v-for="ps in displayedPoliceStations" :key="ps.name">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      :id="'rad-ps-' + ps.name"
                      :checked="isPsChecked(ps)"
                      @change="togglePsSelection(ps)"
                    >
                    <label class="form-check-label" :for="'rad-ps-' + ps.name">{{ ps.name }}</label>
                  </div>
                  <div v-if="displayedPoliceStations.length === 0" class="text-muted small px-3 py-1">No stations found</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Col 3: From Date, To Date & Reset Button -->
          <div class="col-12 col-md-4">
            <div class="d-flex align-items-end gap-2">
              <div class="flex-grow-1" style="min-width: 0;">
                <label class="form-label small text-muted fw-bold mb-1 text-nowrap">From Tax Period</label>
                <input
                  type="month"
                  class="form-control form-control-sm bg-dark text-light border-secondary"
                  v-model="filters.fromDate"
                  @change="fetchAnalytics"
                >
              </div>
              <div class="flex-grow-1" style="min-width: 0;">
                <label class="form-label small text-muted fw-bold mb-1 text-nowrap">To Tax Period</label>
                <input
                  type="month"
                  class="form-control form-control-sm bg-dark text-light border-secondary"
                  v-model="filters.toDate"
                  @change="fetchAnalytics"
                >
              </div>
              <div class="flex-shrink-0">
                <button
                  class="btn btn-sm btn-info shadow-sm"
                  @click="resetAllFilters"
                  :disabled="loading"
                  title="Reset All Filters"
                  style="display: flex; align-items: center; justify-content: center; height: 31px; width: 34px;"
                >
                  <i class="bi bi-arrow-clockwise" :class="{ 'spin': loading }"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- BOTTOM ROW: AREA FILTERS -->
        <div class="row g-3 align-items-end">
          <div class="col-12 col-md-4">
            <div class="dropdown">
              <button class="form-control form-control-sm bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center" type="button" v-bs-dropdown data-bs-toggle="dropdown" aria-expanded="false" data-bs-auto-close="outside">
                <span class="text-truncate">{{ selectedMajorArea.length === 0 ? 'All Major Areas' : selectedMajorArea.length === 1 ? selectedMajorArea[0] : `${selectedMajorArea.length} Major Areas Selected` }}</span>
              </button>
              <div class="dropdown-menu dropdown-menu-dark bg-dark w-100 p-2 border-secondary shadow" style="min-width: 250px;">
                <input type="text" class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none" placeholder="Search major area..." v-model="majorFilterText">
                <div style="max-height: 200px; overflow-y: auto;">
                  <a class="dropdown-item d-flex align-items-center gap-2" href="#" @click.prevent="selectedMajorArea = []">
                    <input class="form-check-input mt-0" type="checkbox" :checked="selectedMajorArea.length === 0" style="pointer-events: none;">
                    <span>All Major Areas</span>
                  </a>
                  <a class="dropdown-item d-flex align-items-center gap-2" href="#" v-for="act in filteredMajorList" :key="act" @click.prevent="toggleFilter(selectedMajorArea, act)">
                    <input class="form-check-input mt-0" type="checkbox" :checked="selectedMajorArea.includes(act)" style="pointer-events: none;">
                    <span>{{ act }}</span>
                  </a>
                  <div v-if="filteredMajorList.length === 0" class="text-muted small px-3 py-1">No major areas found</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-md-4">
            <div class="dropdown">
              <button class="form-control form-control-sm bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center" type="button" v-bs-dropdown data-bs-toggle="dropdown" aria-expanded="false" data-bs-auto-close="outside">
                <span class="text-truncate">{{ selectedMfgArea.length === 0 ? 'All Mfg Areas' : selectedMfgArea.length === 1 ? selectedMfgArea[0] : `${selectedMfgArea.length} Mfg Areas Selected` }}</span>
              </button>
              <div class="dropdown-menu dropdown-menu-dark bg-dark w-100 p-2 border-secondary shadow" style="min-width: 250px;">
                <input type="text" class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none" placeholder="Search mfg area..." v-model="mfgFilterText">
                <div style="max-height: 200px; overflow-y: auto;">
                  <a class="dropdown-item d-flex align-items-center gap-2" href="#" @click.prevent="selectedMfgArea = []">
                    <input class="form-check-input mt-0" type="checkbox" :checked="selectedMfgArea.length === 0" style="pointer-events: none;">
                    <span>All Mfg Areas</span>
                  </a>
                  <a class="dropdown-item d-flex align-items-center gap-2" href="#" v-for="act in filteredMfgList" :key="act" @click.prevent="toggleFilter(selectedMfgArea, act)">
                    <input class="form-check-input mt-0" type="checkbox" :checked="selectedMfgArea.includes(act)" style="pointer-events: none;">
                    <span>{{ act }}</span>
                  </a>
                  <div v-if="filteredMfgList.length === 0" class="text-muted small px-3 py-1">No mfg areas found</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-md-4">
            <div class="dropdown">
              <button class="form-control form-control-sm bg-dark text-light border-secondary text-start dropdown-toggle w-100 d-flex justify-content-between align-items-center" type="button" v-bs-dropdown data-bs-toggle="dropdown" aria-expanded="false" data-bs-auto-close="outside">
                <span class="text-truncate">{{ selectedServiceArea.length === 0 ? 'All Service Areas' : selectedServiceArea.length === 1 ? selectedServiceArea[0] : `${selectedServiceArea.length} Service Areas Selected` }}</span>
              </button>
              <div class="dropdown-menu dropdown-menu-dark bg-dark w-100 p-2 border-secondary shadow" style="min-width: 250px;">
                <input type="text" class="form-control form-control-sm mb-2 bg-dark text-light border-secondary shadow-none" placeholder="Search service area..." v-model="serviceFilterText">
                <div style="max-height: 200px; overflow-y: auto;">
                  <a class="dropdown-item d-flex align-items-center gap-2" href="#" @click.prevent="selectedServiceArea = []">
                    <input class="form-check-input mt-0" type="checkbox" :checked="selectedServiceArea.length === 0" style="pointer-events: none;">
                    <span>All Service Areas</span>
                  </a>
                  <a class="dropdown-item d-flex align-items-center gap-2" href="#" v-for="act in filteredServiceList" :key="act" @click.prevent="toggleFilter(selectedServiceArea, act)">
                    <input class="form-check-input mt-0" type="checkbox" :checked="selectedServiceArea.includes(act)" style="pointer-events: none;">
                    <span>{{ act }}</span>
                  </a>
                  <div v-if="filteredServiceList.length === 0" class="text-muted small px-3 py-1">No service areas found</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-info" role="status"></div>
      <p class="mt-2 text-muted">Loading Analytics...</p>
    </div>

    <div v-else-if="!analyticsData" class="text-center py-5 text-muted">
      No data available to display.
    </div>

    <div v-else>
      <!-- Top Metrics Row -->
      <div class="row g-4 mb-4 align-items-stretch">
        <!-- Top Primary Metric -->
        <div class="col-md-6">
          <div class="card bg-dark border-info shadow-sm h-100 d-flex flex-column">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
              <div class="d-flex align-items-center">
                <span class="fw-bold small text-info"><i class="bi bi-pie-chart-fill me-1"></i> Return Submission Rate</span>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-info btn-sm shadow-sm d-flex align-items-center" @click="openComparisonTab" title="View 24-Month Fiscal Year Comparison in New Tab">
                  <i class="bi bi-box-arrow-up-right me-1"></i> FY Comparison
                </button>
                <button class="btn btn-outline-success btn-sm shadow-sm d-flex align-items-center" @click="openYearComparisonTab" title="View Last 12 Months Comparison & Graph in New Tab">
                  <i class="bi bi-graph-up me-1"></i> Year Comparison
                </button>
              </div>
            </div>
            <div class="card-body text-center p-4 d-flex flex-column justify-content-center flex-grow-1">
              <h2 class="display-5 fw-bold text-info mb-0">
                {{ analyticsData.submissionPercentage }}%
              </h2>
              <p class="text-muted mb-0 fs-5 mt-2">of Return-Eligible Entities have Submitted eVAT Return</p>
              <div class="small text-secondary mt-1">
                ({{ analyticsData.totalReturnBins }} out of {{ analyticsData.totalRegBins }} Return-Eligible Entities)
              </div>
            </div>
          </div>
        </div>

        <!-- Return count by Activity / Registration Type -->
        <div class="col-md-6">
          <div class="card bg-dark border-secondary h-100 d-flex flex-column">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center py-2 flex-wrap gap-2">
              <div class="d-flex align-items-center">
                <select v-model="selectedClassification" class="form-select form-select-sm bg-dark border-secondary fw-bold" style="width: auto; cursor: pointer; color: #fd7e14;">
                  <option value="activity" style="color: #fd7e14;">Has Economic Activity</option>
                  <option value="registration" style="color: #fd7e14;">Registration Type</option>
                </select>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-info btn-sm shadow-sm d-flex align-items-center" @click="openDynamicComparisonTab" title="View 24-Month Fiscal Year Comparison in New Tab">
                  <i class="bi bi-box-arrow-up-right me-1"></i> FY Comparison
                </button>
                <button class="btn btn-outline-success btn-sm shadow-sm d-flex align-items-center" @click="openDynamicYearComparisonTab" title="View Last 12 Months Comparison & Graph in New Tab">
                  <i class="bi bi-graph-up me-1"></i> Year Comparison
                </button>
              </div>
            </div>
            <div class="card-body p-0 d-flex flex-column justify-content-center flex-grow-1">
              <!-- When Has Economic Activity is selected -->
              <ul v-if="selectedClassification === 'activity'" class="list-group list-group-flush rounded-bottom flex-grow-1 d-flex flex-column justify-content-center">
                <li
                  v-for="(item, idx) in sortedActivityList"
                  :key="'act-' + idx"
                  class="list-group-item list-group-item-action bg-dark text-light border-secondary d-flex justify-content-between align-items-center py-3 category-clickable-row"
                  @click="openEntityDrilldown('activity', item.activity)"
                  style="cursor: pointer;"
                  title="Click to view institutions & trend analytics"
                >
                  <span class="d-flex align-items-center">
                    <i class="bi bi-activity me-2 text-info"></i>
                    <span class="fw-semibold">Activity: {{ item.activity }}</span>
                    <i class="bi bi-box-arrow-up-right ms-2 text-muted small hover-show-icon"></i>
                  </span>
                  <span class="badge bg-light text-dark fw-bold rounded-pill px-3 py-2 fs-6 shadow-sm">
                    {{ item.count?.toLocaleString() || item.count }} Returns
                  </span>
                </li>
                <li v-if="sortedActivityList.length === 0" class="list-group-item bg-dark text-muted border-secondary text-center py-4">No activity data</li>
              </ul>

              <!-- When Registration Type is selected -->
              <ul v-else class="list-group list-group-flush rounded-bottom flex-grow-1 d-flex flex-column justify-content-center">
                <li
                  v-for="(item, idx) in sortedRegistrationList"
                  :key="'reg-' + idx"
                  class="list-group-item list-group-item-action bg-dark text-light border-secondary d-flex justify-content-between align-items-center py-3 category-clickable-row"
                  @click="openEntityDrilldown('registration', item.forced_registration)"
                  style="cursor: pointer;"
                  title="Click to view institutions & trend analytics"
                >
                  <span class="d-flex align-items-center">
                    <i class="bi bi-shield-check me-2 text-warning"></i>
                    <span class="fw-semibold">Forced Registration: {{ item.forced_registration }}</span>
                    <i class="bi bi-box-arrow-up-right ms-2 text-muted small hover-show-icon"></i>
                  </span>
                  <span class="badge bg-light text-dark fw-bold rounded-pill px-3 py-2 fs-6 shadow-sm">
                    {{ item.count?.toLocaleString() || item.count }} Returns
                  </span>
                </li>
                <li v-if="sortedRegistrationList.length === 0" class="list-group-item bg-dark text-muted border-secondary text-center py-4">No registration data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Newly Issued BINs Stats -->
      <div v-if="analyticsData?.newBins" class="card bg-dark border-secondary mb-4 shadow-sm">
        <div class="card-header border-secondary text-light fw-bold fs-6">
          <i class="bi bi-plus-circle me-2 text-info"></i> Newly Issued BINs in Selected Period
        </div>
        <div class="card-body p-3">
          <div class="row g-3">
            <div class="col">
              <div class="card bg-dark border-info h-100 shadow-sm">
                <div class="card-body text-center p-3">
                  <h6 class="text-info fw-bold mb-2" style="font-size: 0.8rem;">🆕 New BINs Issued</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.newBins.total?.toLocaleString() }}</h3>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark border-success h-100 shadow-sm">
                <div class="card-body text-center p-3">
                  <h6 class="text-success fw-bold mb-2" style="font-size: 0.8rem;">✅ Return Filed</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.newBins.filed?.toLocaleString() }}</h3>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark h-100 shadow-sm" style="border-color: #4caf50 !important; border-width: 1px; border-style: solid;">
                <div class="card-body text-center p-3">
                  <h6 class="fw-bold mb-2" style="color: #81c784; font-size: 0.8rem;">📊 Activity: Yes</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.newBins.activityYes?.toLocaleString() }}</h3>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark h-100 shadow-sm" style="border-color: #ff9800 !important; border-width: 1px; border-style: solid;">
                <div class="card-body text-center p-3">
                  <h6 class="fw-bold mb-2" style="color: #ffb74d; font-size: 0.8rem;">🚫 Activity: No</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.newBins.activityNo?.toLocaleString() }}</h3>
                </div>
              </div>
            </div>
            <div class="col">
              <div class="card bg-dark border-danger h-100 shadow-sm">
                <div class="card-body text-center p-3">
                  <h6 class="text-danger fw-bold mb-2" style="font-size: 0.8rem;">❌ Not Filed</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.newBins.notFiled?.toLocaleString() }}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Risk Category Cards -->
      <div v-if="analyticsData?.riskBreakdown" class="card bg-dark border-secondary mb-4 shadow-sm">
        <div class="card-header border-secondary text-light fw-bold fs-6 d-flex justify-content-between align-items-center">
          <div><i class="bi bi-shield-exclamation me-2 text-warning"></i> Risk Category Assessment</div>
          <div style="width: 150px;">
            <select class="form-select form-select-sm bg-dark text-light border-secondary mb-0 shadow-sm" v-model="filters.topLimit" @change="fetchAnalytics">
              <option value="All">All Entities</option>
              <option value="Top 10">Top 10</option>
              <option value="Top 20">Top 20</option>
              <option value="Top 50">Top 50</option>
              <option value="Top 100">Top 100</option>
              <option value="Top 200">Top 200</option>
              <option value="Top 500">Top 500</option>
              <option value="Top 1000">Top 1000</option>
            </select>
          </div>
        </div>
        <div class="card-body p-3">
          <div class="row g-3">
            <div class="col-md-4">
              <div class="card bg-dark border-danger h-100 shadow-sm">
                <div class="card-body text-center p-3">
                  <h6 class="text-danger fw-bold mb-2">🔴 High Risk (>= 30)</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.riskBreakdown.high }}</h3>
                  <small class="text-muted">Entities</small>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card bg-dark h-100 shadow-sm" style="border-color: #fd7e14 !important; border-width: 1px; border-style: solid;">
                <div class="card-body text-center p-3">
                  <h6 class="fw-bold mb-2" style="color: #fd7e14;">🟠 Risky (15-29)</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.riskBreakdown.risky }}</h3>
                  <small class="text-muted">Entities</small>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card bg-dark border-warning h-100 shadow-sm">
                <div class="card-body text-center p-3">
                  <h6 class="text-warning fw-bold mb-2">🟡 Low Risk (1-14)</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.riskBreakdown.low }}</h3>
                  <small class="text-muted">Entities</small>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card bg-dark border-success h-100 shadow-sm">
                <div class="card-body text-center p-3">
                  <h6 class="text-success fw-bold mb-2">🟢 Safe (0)</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.riskBreakdown.safe }}</h3>
                  <small class="text-muted">Entities</small>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card bg-dark h-100 shadow-sm" style="border-color: #9c27b0 !important; border-width: 1px; border-style: solid;">
                <div class="card-body text-center p-3">
                  <h6 class="fw-bold mb-2" style="color: #e1bee7;">📈 Risk Increased</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.riskBreakdown.newlyRisky !== undefined ? analyticsData.riskBreakdown.newlyRisky : 0 }}</h3>
                  <small class="text-muted">Entities</small>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="card bg-dark h-100 shadow-sm" style="border-color: #00bcd4 !important; border-width: 1px; border-style: solid;">
                <div class="card-body text-center p-3">
                  <h6 class="fw-bold mb-2" style="color: #b2ebf2;">📉 Risk Reduced</h6>
                  <h3 class="display-6 fw-bold text-light mb-0">{{ analyticsData.riskBreakdown.improving !== undefined ? analyticsData.riskBreakdown.improving : 0 }}</h3>
                  <small class="text-muted">Entities</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Analysis Parameters List -->
      <div class="card bg-dark border-secondary">
        <div class="card-header border-secondary text-light fw-bold fs-5">
          Detailed Analysis Parameters
        </div>
        <div class="card-body p-0">
          <ul class="list-group list-group-flush rounded-bottom">
            <li v-for="(metric, idx) in metricsList" :key="idx" 
                class="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center hover-list-item py-3">
              <div class="d-flex align-items-center">
                <span class="me-3 fs-5 fw-bold text-muted flex-shrink-0 text-nowrap" style="min-width: 42px;">{{ idx + 1 }}.</span>
                <div>
                  <div class="fw-bold d-flex align-items-center flex-wrap" style="font-size: 1.05rem; color: #e0e0e0;">
                    <span>{{ metric.title }}</span>
                    <span v-if="metric.stars" class="ms-2 d-inline-flex gap-1 align-items-center">
                      <i v-for="s in metric.stars" :key="s" class="bi bi-star-fill text-warning" style="font-size: 0.85rem;"></i>
                    </span>
                  </div>
                  <div class="text-muted small mt-1">{{ metric.description }}</div>
                </div>
              </div>
              <div class="fs-4 fw-bold text-info text-end" style="min-width: 100px;">
                {{ metric.value }} <span class="fs-6 text-muted fw-normal">Entities</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from '@/plugins/axios';

import AreaFilterBar from '@/components/common/AreaFilterBar.vue';

const router = useRouter();



const loading = ref(true);
const analyticsData = ref<any>(null);

const getPrevMonthString = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
};

const prevMonth = getPrevMonthString();

const filters = ref({
  circleIds: [] as number[],
  policeStationIds: [] as number[],
  fromDate: prevMonth,
  toDate: prevMonth,
  topLimit: 'All'
});

const circles = ref<any[]>([]);
const policeStations = ref<any[]>([]);

interface DisplayedPs {
  name: string;
  ids: number[];
}

const circleFilterText = ref('');
const psFilterText = ref('');

const filteredCircles = computed(() => {
  const list = circles.value || [];
  if (!circleFilterText.value.trim()) return list;
  const t = circleFilterText.value.toLowerCase().trim();
  return list.filter((c: any) => c.name && c.name.toLowerCase().includes(t));
});

const displayedPoliceStations = computed<DisplayedPs[]>(() => {
  const list = policeStations.value || [];
  let matching = list;

  if (filters.value.circleIds.length > 0) {
    const selectedCircleIds = filters.value.circleIds.map(Number);
    matching = list.filter((ps: any) =>
      selectedCircleIds.includes(Number(ps.circleId)) || selectedCircleIds.includes(Number(ps.circle_id))
    );
  }

  if (psFilterText.value.trim()) {
    const search = psFilterText.value.toLowerCase().trim();
    matching = matching.filter((ps: any) => ps.name && ps.name.toLowerCase().includes(search));
  }

  const map = new Map<string, number[]>();
  matching.forEach((ps: any) => {
    if (!ps.name) return;
    const name = ps.name.trim();
    if (!map.has(name)) {
      map.set(name, []);
    }
    const arr = map.get(name)!;
    const id = Number(ps.id);
    if (!isNaN(id) && !arr.includes(id)) {
      arr.push(id);
    }
  });

  return Array.from(map.entries())
    .map(([name, ids]) => ({ name, ids }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectAllCircles = () => {
  filters.value.circleIds = [];
  fetchAnalytics();
};

const toggleCircle = (circleId: number) => {
  let updated: number[];
  if (filters.value.circleIds.includes(circleId)) {
    updated = filters.value.circleIds.filter((id) => id !== circleId);
  } else {
    updated = [...filters.value.circleIds, circleId];
  }
  filters.value.circleIds = updated;
  fetchAnalytics();
};

const isPsChecked = (ps: DisplayedPs) => {
  return ps.ids.length > 0 && ps.ids.some((id) => filters.value.policeStationIds.includes(id));
};

const selectAllPs = () => {
  filters.value.policeStationIds = [];
  fetchAnalytics();
};

const togglePsSelection = (ps: DisplayedPs) => {
  const checked = isPsChecked(ps);
  let updated: number[];
  if (checked) {
    updated = filters.value.policeStationIds.filter((id) => !ps.ids.includes(id));
  } else {
    const toAdd = ps.ids.filter((id) => !filters.value.policeStationIds.includes(id));
    updated = [...filters.value.policeStationIds, ...toAdd];
  }
  filters.value.policeStationIds = updated;
  fetchAnalytics();
};

const selectedPsCount = computed(() => {
  const allList = policeStations.value || [];
  const selected = new Set<string>();
  allList.forEach((ps: any) => {
    if (filters.value.policeStationIds.includes(Number(ps.id))) {
      selected.add(ps.name.trim());
    }
  });
  return selected.size;
});

// Area Filters State
const selectedMajorArea = ref<string[]>([]);
const selectedMfgArea = ref<string[]>([]);
const selectedServiceArea = ref<string[]>([]);

const uniqueMajorAreas = ref<string[]>([]);
const uniqueMfgAreasBase = ref<string[]>([]);
const uniqueServiceAreasBase = ref<string[]>([]);
const areaRelations = ref<{ major: string; mfg: string | null; service: string | null }[]>([]);

const majorFilterText = ref('');
const mfgFilterText = ref('');
const serviceFilterText = ref('');

const toggleFilter = (filterRef: string[], value: string) => {
  const index = filterRef.indexOf(value);
  if (index > -1) {
    filterRef.splice(index, 1);
  } else {
    filterRef.push(value);
  }
};


const resetAllFilters = () => {
  filters.value.circleIds = [];
  filters.value.policeStationIds = [];
  filters.value.fromDate = prevMonth;
  filters.value.toDate = prevMonth;
  selectedMajorArea.value = [];
  selectedMfgArea.value = [];
  selectedServiceArea.value = [];
  fetchAnalytics();
};

// Dependent Area Options: Major Area -> Mfg Area & Service Area
const uniqueMfgAreas = computed(() => {
  if (selectedMajorArea.value.length === 0) {
    return uniqueMfgAreasBase.value;
  }
  const validMfg = new Set<string>();
  for (const rel of areaRelations.value) {
    if (rel.major && selectedMajorArea.value.includes(rel.major) && rel.mfg) {
      validMfg.add(rel.mfg);
    }
  }
  return Array.from(validMfg).sort();
});

const uniqueServiceAreas = computed(() => {
  if (selectedMajorArea.value.length === 0) {
    return uniqueServiceAreasBase.value;
  }
  const validService = new Set<string>();
  for (const rel of areaRelations.value) {
    if (rel.major && selectedMajorArea.value.includes(rel.major) && rel.service) {
      validService.add(rel.service);
    }
  }
  return Array.from(validService).sort();
});

// Filtered by Search Inputs
const filteredMajorList = computed(() => {
  if (!majorFilterText.value.trim()) return uniqueMajorAreas.value;
  const q = majorFilterText.value.toLowerCase();
  return uniqueMajorAreas.value.filter(a => a.toLowerCase().includes(q));
});

const filteredMfgList = computed(() => {
  if (!mfgFilterText.value.trim()) return uniqueMfgAreas.value;
  const q = mfgFilterText.value.toLowerCase();
  return uniqueMfgAreas.value.filter(a => a.toLowerCase().includes(q));
});

const filteredServiceList = computed(() => {
  if (!serviceFilterText.value.trim()) return uniqueServiceAreas.value;
  const q = serviceFilterText.value.toLowerCase();
  return uniqueServiceAreas.value.filter(a => a.toLowerCase().includes(q));
});

const fetchAreaOptions = async () => {
  const token = localStorage.getItem('token');
  try {
    const res = await axios.get('/api/return-data-analyser/filter-options', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data) {
      uniqueMajorAreas.value = res.data.majorAreas || [];
      uniqueMfgAreasBase.value = res.data.mfgAreas || [];
      uniqueServiceAreasBase.value = res.data.serviceAreas || [];
      areaRelations.value = res.data.areaRelations || [];
    }
  } catch (error) {
    console.error('Failed to load area options:', error);
  }
};

const fetchFiltersData = async () => {
  const token = localStorage.getItem('token');
  try {
    const cRes = await axios.get('/api/settings/circles', { headers: { Authorization: `Bearer ${token}` } });
    circles.value = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);
  } catch (error) {
    console.error('Failed to load circles:', error);
  }

  try {
    const pRes = await axios.get('/api/settings/police-stations', { headers: { Authorization: `Bearer ${token}` } });
    policeStations.value = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data || []);
  } catch (error) {
    console.error('Failed to load police stations:', error);
  }
};

const fetchAnalytics = async () => {
  if (filters.value.fromDate && filters.value.toDate && filters.value.fromDate > filters.value.toDate) {
    alert("From Period cannot be later than To Period.");
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    let url = '/api/return-data-analyser/analytics?';
    const params = new URLSearchParams();
    if (filters.value.circleIds.length > 0) params.append('circleId', filters.value.circleIds.join(','));
    if (filters.value.policeStationIds.length > 0) params.append('policeStationId', filters.value.policeStationIds.join(','));
    if (filters.value.fromDate) params.append('fromDate', filters.value.fromDate);
    if (filters.value.toDate) params.append('toDate', filters.value.toDate);
    if (filters.value.topLimit && filters.value.topLimit !== 'All') {
      const num = filters.value.topLimit.replace(/\D/g, '');
      if (num) params.append('topLimit', num);
    } else if (filters.value.topLimit === 'All') {
      params.append('topLimit', 'All');
    }
    if (selectedMajorArea.value.length > 0) params.append('majorArea', selectedMajorArea.value.join(','));
    if (selectedMfgArea.value.length > 0) params.append('mfgArea', selectedMfgArea.value.join(','));
    if (selectedServiceArea.value.length > 0) params.append('serviceArea', selectedServiceArea.value.join(','));
    
    url += params.toString();
    const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    analyticsData.value = response.data.data || response.data;
  } catch (error: any) {
    console.error('Failed to load analytics:', error);
    alert(error.response?.data?.error || 'Failed to load analytics');
  } finally {
    loading.value = false;
  }
};

const metricsList = computed(() => {
  if (!analyticsData.value || !analyticsData.value.metrics) return [];
  const m = analyticsData.value.metrics;
  return [
    // 3 Stars
    { title: 'Entities with Negative (-) Net Payable (VAT) BUT have Deposited (VAT)', description: 'Negative net payable VAT but still deposited VAT.', value: m.metric11, stars: 3 },
    { title: 'Entities with No Manufacturing Area BUT have taken Rebate (Input Tax Credit)', description: 'No manufacturing area registered but has claimed input tax credit / rebate.', value: m.metric23, stars: 3 },
    { title: 'Entities with Closing Balance (VAT) > 5,00,000 BDT', description: 'Large closing balance range.', value: m.metric16, stars: 3 },
    { title: 'Entities where Deposited (VAT) < VDS (Increasing)', description: 'Deposited VAT is less than VDS (Increasing) — potential illegal adjustment.', value: m.metric22, stars: 3 },
    
    // 2 Stars
    { title: 'Entities with Negative (-) Net Payable (VAT)', description: 'Net payable VAT is below zero. (Credit goes to Entity)', value: m.metric9, stars: 2 },
    { title: 'Entities with Net Payable (VAT) < -1,00,000 BDT', description: 'Net payable VAT is below -1,00,000 BDT (Large credit balance).', value: m.metric10, stars: 2 },
    { title: 'Entities with Closing Balance (VAT) between 1,00,001 and 5,00,000 BDT', description: 'Medium closing balance range.', value: m.metric15, stars: 2 },
    { title: 'Entities with VDS (Decreasing)', description: 'Has positive VDS (Decreasing).', value: m.metric18, stars: 2 },
    { title: 'Entities where Advanced Tax Paid < Increasing Adjustment', description: 'Advanced tax paid is less than increasing adjustment.', value: m.metric20, stars: 2 },
    
    // 1 Star
    { title: 'Entities with Total Sales Value BUT NO Total Payable (VAT)', description: 'Sales exist, but payable VAT is zero or missing.', value: m.metric4, stars: 1 },
    { title: 'Entities with Total Input Tax Credit (Value)', description: 'Has positive input tax credit.', value: m.metric6, stars: 1 },
    { title: 'Entities with Decreasing Adjustment', description: 'Has made decreasing adjustments.', value: m.metric8, stars: 1 },
    
    // 0 Stars
    { title: 'Entities with both Total Sales Value AND Total Payable (VAT)', description: 'Has positive values in both sales and payable VAT.', value: m.metric3 },
    { title: 'Entities with Total Payable (SD)', description: 'Has positive payable SD.', value: m.metric5 },
    { title: 'Entities with Increasing Adjustment', description: 'Has made increasing adjustments.', value: m.metric7 },
    { title: 'Entities with Net Payable (VAT) > 1,00,000 BDT AND have Deposited (VAT)', description: 'Large net payable VAT and has deposits.', value: m.metric12 },
    { title: 'Entities with Negative (-) Net Payable (SD)', description: 'Net payable SD is below zero.', value: m.metric13 },
    { title: 'Entities with Closing Balance (VAT) between 0 and 1,00,000 BDT', description: 'Small closing balance range.', value: m.metric14 },
    { title: 'Entities with VDS (Increasing)', description: 'Has positive VDS (Increasing).', value: m.metric17 },
    { title: 'Entities with Advanced Tax Paid', description: 'Has paid advanced tax.', value: m.metric19 },
    { title: 'Entities with Fine/Penalty but have an Equal Amount in Decreasing Adjustment', description: 'Fine matches decreasing adjustment exactly.', value: m.metric21 },
  ];
});

// ─── FY Comparison in New Tab ───────────────────────────────────────────────────
const openComparisonTab = () => {
  const query: any = {};
  if (filters.value.circleIds.length > 0) query.circleId = filters.value.circleIds.join(',');
  if (filters.value.policeStationIds.length > 0) query.policeStationId = filters.value.policeStationIds.join(',');
  if (filters.value.fromDate) query.fromDate = filters.value.fromDate;
  if (filters.value.toDate) query.toDate = filters.value.toDate;
  if (selectedMajorArea.value.length > 0) query.majorArea = selectedMajorArea.value.join(',');
  if (selectedMfgArea.value.length > 0) query.mfgArea = selectedMfgArea.value.join(',');
  if (selectedServiceArea.value.length > 0) query.serviceArea = selectedServiceArea.value.join(',');

  const routeData = router.resolve({
    name: 'return-fy-comparison',
    query
  });
  window.open(routeData.href, '_blank');
};

const openYearComparisonTab = () => {
  const query: any = {};
  if (filters.value.circleIds.length > 0) query.circleId = filters.value.circleIds.join(',');
  if (filters.value.policeStationIds.length > 0) query.policeStationId = filters.value.policeStationIds.join(',');
  if (filters.value.fromDate) query.fromDate = filters.value.fromDate;
  if (filters.value.toDate) query.toDate = filters.value.toDate;
  if (selectedMajorArea.value.length > 0) query.majorArea = selectedMajorArea.value.join(',');
  if (selectedMfgArea.value.length > 0) query.mfgArea = selectedMfgArea.value.join(',');
  if (selectedServiceArea.value.length > 0) query.serviceArea = selectedServiceArea.value.join(',');

  const routeData = router.resolve({
    name: 'return-year-comparison',
    query
  });
  window.open(routeData.href, '_blank');
};


const selectedClassification = ref<'activity' | 'registration'>('activity');

const sortedActivityList = computed(() => {
  if (!analyticsData.value?.byActivity) return [];
  return [...analyticsData.value.byActivity].sort((a: any, b: any) => {
    if (a.activity === 'No') return -1;
    if (b.activity === 'No') return 1;
    return 0;
  });
});

const sortedRegistrationList = computed(() => {
  if (!analyticsData.value?.byRegistration) return [];
  return [...analyticsData.value.byRegistration].sort((a: any, b: any) => {
    if (a.forced_registration === 'No') return -1;
    if (b.forced_registration === 'No') return 1;
    return 0;
  });
});

const openDynamicComparisonTab = () => {
  const query: any = {};
  if (selectedClassification.value === 'activity') query.metric = 'activity';
  else query.forcedRegistration = 'Yes';
  if (filters.value.circleIds.length > 0) query.circleId = filters.value.circleIds.join(',');
  if (filters.value.policeStationIds.length > 0) query.policeStationId = filters.value.policeStationIds.join(',');
  if (filters.value.fromDate) query.fromDate = filters.value.fromDate;
  if (filters.value.toDate) query.toDate = filters.value.toDate;
  if (selectedMajorArea.value.length > 0) query.majorArea = selectedMajorArea.value.join(',');
  if (selectedMfgArea.value.length > 0) query.mfgArea = selectedMfgArea.value.join(',');
  if (selectedServiceArea.value.length > 0) query.serviceArea = selectedServiceArea.value.join(',');

  const routeData = router.resolve({
    name: 'return-fy-comparison',
    query
  });
  window.open(routeData.href, '_blank');
};

const openDynamicYearComparisonTab = () => {
  const query: any = {};
  if (selectedClassification.value === 'activity') query.metric = 'activity';
  else query.forcedRegistration = 'Yes';
  if (filters.value.circleIds.length > 0) query.circleId = filters.value.circleIds.join(',');
  if (filters.value.policeStationIds.length > 0) query.policeStationId = filters.value.policeStationIds.join(',');
  if (filters.value.fromDate) query.fromDate = filters.value.fromDate;
  if (filters.value.toDate) query.toDate = filters.value.toDate;
  if (selectedMajorArea.value.length > 0) query.majorArea = selectedMajorArea.value.join(',');
  if (selectedMfgArea.value.length > 0) query.mfgArea = selectedMfgArea.value.join(',');
  if (selectedServiceArea.value.length > 0) query.serviceArea = selectedServiceArea.value.join(',');

  const routeData = router.resolve({
    name: 'return-year-comparison',
    query
  });
  window.open(routeData.href, '_blank');
};

const openEntityDrilldown = (type: 'activity' | 'registration', value: string) => {
  const query: any = {
    classificationType: type,
    categoryValue: value
  };
  if (filters.value.circleIds.length > 0) query.circleId = filters.value.circleIds.join(',');
  if (filters.value.policeStationIds.length > 0) query.policeStationId = filters.value.policeStationIds.join(',');
  if (filters.value.fromDate) query.fromDate = filters.value.fromDate;
  if (filters.value.toDate) query.toDate = filters.value.toDate;
  if (selectedMajorArea.value.length > 0) query.majorArea = selectedMajorArea.value.join(',');
  if (selectedMfgArea.value.length > 0) query.mfgArea = selectedMfgArea.value.join(',');
  if (selectedServiceArea.value.length > 0) query.serviceArea = selectedServiceArea.value.join(',');

  const routeData = router.resolve({
    name: 'return-entity-drilldown',
    query
  });
  window.open(routeData.href, '_blank');
};

watch(() => filters.value.circleIds, () => {
  filters.value.policeStationIds = [];
  fetchAnalytics();
}, { deep: true });

watch(() => filters.value.policeStationIds, () => {
  fetchAnalytics();
}, { deep: true });

watch(() => filters.value.fromDate, () => {
  fetchAnalytics();
});

watch(() => filters.value.toDate, () => {
  fetchAnalytics();
});

// Watch area filters with cascading pruning
watch(selectedMajorArea, () => {
  const validMfg = new Set(uniqueMfgAreas.value);
  selectedMfgArea.value = selectedMfgArea.value.filter(m => validMfg.has(m));

  const validService = new Set(uniqueServiceAreas.value);
  selectedServiceArea.value = selectedServiceArea.value.filter(s => validService.has(s));

  fetchAnalytics();
}, { deep: true });

watch(selectedMfgArea, () => {
  fetchAnalytics();
}, { deep: true });

watch(selectedServiceArea, () => {
  fetchAnalytics();
}, { deep: true });

onMounted(async () => {
  await Promise.all([fetchFiltersData(), fetchAreaOptions()]);
  await fetchAnalytics();
});
</script>

<style scoped>
.hover-list-item {
  transition: background-color 0.2s ease, padding-left 0.2s ease;
}
.hover-list-item:hover {
  background-color: #2c3034 !important;
  padding-left: 1.5rem !important;
}
.category-clickable-row {
  transition: all 0.2s ease;
}
.category-clickable-row:hover {
  background-color: #212832 !important;
  border-left: 3px solid #0dcaf0 !important;
}
.category-clickable-row:hover .hover-show-icon {
  color: #0dcaf0 !important;
}
.spin {
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
