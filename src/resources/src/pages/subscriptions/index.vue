<template>
  <Pagebar title="My Subscriptions" />

  <!-- Floating Toast Notification -->
  <div 
    v-if="toastMessage" 
    class="position-fixed top-0 start-50 translate-middle-x mt-4 px-4 py-3 rounded-3 shadow-lg text-white d-flex align-items-center gap-3 toast-slide" 
    :class="toastType === 'error' ? 'bg-danger' : 'bg-success'" 
    style="z-index: 9999; min-width: 340px; max-width: 90vw;"
  >
    <i :class="toastType === 'error' ? 'bi bi-exclamation-octagon-fill fs-4' : 'bi bi-check-circle-fill fs-4'"></i>
    <div class="flex-grow-1">
      <div class="fw-bold small">{{ toastType === 'error' ? 'Notice' : 'Success' }}</div>
      <div class="small opacity-90">{{ toastMessage }}</div>
    </div>
    <button type="button" class="btn-close btn-close-white ms-auto" aria-label="Close" @click="toastMessage = ''"></button>
  </div>

  <!-- Error / Loading -->
  <div v-if="loading" class="text-center py-5 container-fluid mt-4">
    <div class="spinner-border text-primary" role="status"></div>
    <div class="mt-2 text-muted">Loading subscriptions...</div>
  </div>

  <div v-else-if="error" class="alert alert-danger border-danger container-fluid mt-4 mx-3">
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <i class="bi bi-exclamation-triangle me-2"></i> {{ error }}
      </div>
      <button @click="fetchData" class="btn btn-sm btn-outline-danger">
        <i class="bi bi-arrow-clockwise me-1"></i> Retry
      </button>
    </div>
  </div>

  <div v-else class="container-fluid mt-4 mb-5 px-3">
    <div class="row g-4">
      <!-- Left / Top: Plan Overview & Request New Access -->
      <div class="col-lg-4">
        <!-- Current Plan Overview Card -->
        <div class="card bg-surface border-custom shadow-sm mb-4">
          <div class="card-header bg-transparent border-bottom border-custom py-3">
            <h6 class="mb-0 fw-bold d-flex align-items-center justify-content-between">
              <span><i class="bi bi-star-fill text-warning me-2"></i> Current Plan</span>
              <span v-if="quotaInfo" :class="quotaInfo.isLimitReached ? 'badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25' : 'badge bg-success bg-opacity-10 text-success border border-success border-opacity-25'">
                {{ quotaInfo.used }} / {{ quotaInfo.total >= 9999 ? '∞' : quotaInfo.total }} Offices
              </span>
            </h6>
          </div>
          <div class="card-body">
            <div v-if="profile?.planName">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-muted">Plan Name:</span>
                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 py-1 px-2 fw-bold">
                  {{ profile.planName }} <span v-if="profile.planPrice">(৳{{ profile.planPrice }})</span>
                </span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-muted">Account Status:</span>
                <span :class="['badge py-1 px-2', statusClass(profile.paymentStatus)]">
                  {{ formatStatus(profile.paymentStatus) }}
                </span>
              </div>
              
              <!-- Plan Quota Status -->
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-muted">Office Quota:</span>
                <span class="fw-bold" :class="quotaInfo?.isLimitReached ? 'text-warning' : 'text-success'">
                  {{ quotaInfo?.used || 0 }} of {{ (quotaInfo?.total ?? 1) >= 9999 ? 'Unlimited' : quotaInfo?.total }} Used
                  <small v-if="quotaInfo && !quotaInfo.isLimitReached && quotaInfo.total < 9999" class="text-muted">
                    ({{ quotaInfo.available }} left)
                  </small>
                </span>
              </div>

              <div v-if="profile.trxId" class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-muted">bKash / TrxID:</span>
                <span class="text-warning fw-bold">{{ profile.trxId }}</span>
              </div>
              <div v-if="profile.planStartDate" class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-muted">Activated On:</span>
                <span class="fw-semibold">{{ new Date(profile.planStartDate).toLocaleDateString() }}</span>
              </div>
              <div v-if="profile.planStartDate && profile.planDurationDays" class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-muted">Expires On:</span>
                <span class="fw-bold text-info">{{ calculateExpiry(profile.planStartDate, profile.planDurationDays) }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-muted">Joined:</span>
                <span>{{ profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-' }}</span>
              </div>

              <div class="mt-4 pt-2 border-top border-custom d-flex gap-2">
                <router-link to="/plans" class="btn btn-sm btn-outline-primary flex-grow-1">
                  <i class="bi bi-arrow-repeat me-1"></i> Upgrade Plan
                </router-link>
              </div>
            </div>
            <div v-else class="text-center py-3">
              <div class="text-muted mb-3">No active subscription plan found.</div>
              <router-link to="/plans" class="btn btn-sm btn-primary">
                <i class="bi bi-tag-fill me-1"></i> View Plans
              </router-link>
            </div>
          </div>
        </div>

        <!-- Add / Request Office Card -->
        <div class="card bg-surface border-custom shadow-sm">
          <div class="card-header bg-transparent border-bottom border-custom py-3">
            <h6 class="mb-0 fw-bold d-flex align-items-center justify-content-between">
              <span><i class="bi bi-building-add text-info me-2"></i> Add Office / Circle</span>
              <span v-if="quotaInfo && !quotaInfo.isLimitReached" class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 small">
                Auto-Active
              </span>
              <span v-else-if="quotaInfo?.isLimitReached" class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 small">
                ৳300 Add-on
              </span>
            </h6>
          </div>
          <div class="card-body">
            <!-- Quota Notice Alert -->
            <div v-if="quotaInfo?.isLimitReached" class="alert alert-warning py-2 mb-3 small d-flex align-items-center">
              <i class="bi bi-info-circle-fill me-2 fs-5 text-warning flex-shrink-0"></i>
              <div>
                Your plan quota is full ({{ quotaInfo.used }}/{{ quotaInfo.total }}). You can add extra offices for <strong>৳300/month</strong> or upgrade plan.
              </div>
            </div>

            <div class="mb-3 position-relative" ref="dropdownRef">
              <label class="form-label text-muted small fw-semibold d-flex justify-content-between align-items-center">
                <span>Select Office / Circle</span>
                <span class="text-xs text-muted" v-if="availableCircles.length">{{ availableCircles.length }} offices</span>
              </label>

              <!-- Custom Dropdown Trigger Button -->
              <div 
                class="form-control d-flex justify-content-between align-items-center bg-surface border-custom user-select-none cursor-pointer py-2"
                :class="{ 'border-primary ring-focus': isDropdownOpen }"
                @click="toggleDropdown"
                role="button"
                tabindex="0"
                @keydown.enter.space.prevent="toggleDropdown"
              >
                <div class="d-flex align-items-center text-truncate pe-2">
                  <i class="bi bi-building me-2 text-info opacity-75"></i>
                  <span v-if="selectedCircle" class="fw-semibold text-truncate">
                    {{ selectedCircle.name }}
                    <small v-if="selectedCircle.divisionName" class="text-muted ms-1">({{ selectedCircle.divisionName }})</small>
                  </span>
                  <span v-else class="text-muted">-- Choose an office / circle --</span>
                </div>
                <div class="d-flex align-items-center gap-1 text-muted">
                  <i v-if="selectedCircleId" class="bi bi-x-circle-fill text-secondary me-1 hover-opacity cursor-pointer" title="Clear" @click.stop="clearSelection"></i>
                  <i class="bi" :class="isDropdownOpen ? 'bi-chevron-up text-primary' : 'bi-chevron-down'"></i>
                </div>
              </div>

              <!-- Dropdown Menu / Popup -->
              <div 
                v-if="isDropdownOpen" 
                class="position-absolute start-0 end-0 bg-surface border border-custom rounded-3 shadow-lg mt-1 p-2 z-3 custom-dropdown-menu"
                @click.stop
              >
                <!-- Clean Search Input inside Dropdown -->
                <div class="px-1 pb-2">
                  <input 
                    ref="searchInputRef"
                    type="text" 
                    v-model="circleSearchQuery" 
                    class="form-control form-control-sm bg-surface border-custom shadow-none" 
                    placeholder="Type to search..."
                    @keydown.esc="isDropdownOpen = false"
                  />
                </div>

                <!-- Circles List -->
                <div class="dropdown-list-scroll" style="max-height: 230px; overflow-y: auto;">
                  <div v-if="filteredCircles.length === 0" class="text-center py-3 text-muted small">
                    <i class="bi bi-slash-circle d-block fs-5 mb-1 opacity-50"></i>
                    No offices match "{{ circleSearchQuery }}"
                  </div>

                  <div 
                    v-for="c in filteredCircles" 
                    :key="c.id"
                    class="dropdown-circle-item d-flex justify-content-between align-items-center px-2 py-2 rounded-2 mb-1 cursor-pointer"
                    :class="{
                      'active-item bg-primary text-white': selectedCircleId === c.id,
                      'opacity-60 disabled-item': isAlreadySubscribed(c.id)
                    }"
                    @click="handleSelectCircle(c)"
                  >
                    <div class="text-truncate pe-2">
                      <div class="fw-semibold text-truncate small" :class="selectedCircleId === c.id ? 'text-white' : ''">{{ c.name }}</div>
                      <div class="text-xs text-truncate" :class="selectedCircleId === c.id ? 'text-white text-opacity-75' : 'text-muted'">
                        {{ c.divisionName || 'Circle Office' }}
                      </div>
                    </div>
                    <div class="flex-shrink-0 ms-2">
                      <span v-if="isAlreadySubscribed(c.id)" class="badge bg-secondary bg-opacity-25 text-muted text-xs">
                        {{ getSubscriptionStatusText(c.id) }}
                      </span>
                      <i v-else-if="selectedCircleId === c.id" class="bi bi-check-lg text-white"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              @click="handleOfficeSubmit" 
              class="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm" 
              :disabled="submitting || !selectedCircleId"
            >
              <span v-if="submitting" class="spinner-border spinner-border-sm" role="status"></span>
              <i v-else :class="quotaInfo?.isLimitReached ? 'bi bi-tag-fill' : 'bi bi-check-circle-fill'"></i>
              <span>
                {{ submitting ? 'Processing...' : (quotaInfo?.isLimitReached ? 'Purchase Extra Office (৳300)' : 'Add Office Now') }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Subscribed Offices Table Card -->
      <div class="col-lg-8">
        <div class="card bg-surface border-custom shadow-sm h-100 d-flex flex-column overflow-hidden">
          <div class="card-header bg-transparent border-bottom border-custom d-flex justify-content-between align-items-center py-3 px-3">
            <button @click="$router.back()" class="btn btn-outline-secondary btn-sm">
              <i class="bi bi-arrow-left me-1"></i> Back
            </button>
            <button @click="fetchData" class="btn btn-outline-info btn-sm">
              <i class="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>

          <div class="table-responsive flex-grow-1" style="overflow-y: auto;">
            <table class="table table-hover table-bordered mb-0 align-middle">
              <thead class="sticky-top" style="z-index: 10;">
                <tr>
                  <th>#</th>
                  <th>Office / Circle Name</th>
                  <th>Type</th>
                  <th>Access Status</th>
                  <th>Added Date</th>
                  <th class="text-center" style="width: 140px;">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="subscriptions.length === 0">
                  <td colspan="6" class="text-center text-muted py-4">No office subscriptions found.</td>
                </tr>
                <tr v-for="(sub, idx) in subscriptions" :key="sub.id">
                  <td class="text-muted small">{{ idx + 1 }}</td>
                  <td class="fw-bold">{{ sub.circleName || 'N/A' }}</td>
                  <td>
                    <div v-if="sub.isAddon">
                      <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1">
                        ৳{{ sub.addonPrice || 300 }} Single Add-on
                      </span>
                      <div v-if="sub.trxId" class="small text-muted font-monospace mt-1">
                        {{ sub.paymentMethod || 'Trx' }}: {{ sub.trxId }}
                      </div>
                    </div>
                    <div v-else>
                      <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1">
                        Plan Quota
                      </span>
                    </div>
                  </td>
                  <td>
                    <span :class="['badge py-1 px-2', statusClass(sub.status)]">
                      {{ formatStatus(sub.status) }}
                    </span>
                  </td>
                  <td>{{ sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '-' }}</td>
                  <td class="text-center">
                    <button 
                      v-if="sub.status === 'approved' && !profile?.hasChangedCircle" 
                      @click="openChangeModal(sub)"
                      class="btn btn-xs btn-outline-info d-inline-flex align-items-center gap-1 py-1 px-2 fw-semibold"
                      title="Transfer/Switch to another office (1 time allowed)"
                    >
                      <i class="bi bi-arrow-left-right"></i>
                      <span>Change</span>
                    </button>
                    <span v-else-if="sub.status === 'approved' && profile?.hasChangedCircle" class="badge bg-secondary bg-opacity-25 text-muted small" title="1-time change allowance already used">
                      Changed (1x)
                    </span>
                    <span v-else-if="sub.status === 'pending'" class="badge bg-warning bg-opacity-10 text-warning small">
                      Pending Review
                    </span>
                    <span v-else class="text-muted small">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Single Circle Add-on Purchase Modal (৳300) -->
  <div v-if="isAddonModalOpen" class="modal-backdrop-custom d-flex align-items-center justify-content-center" @click.self="closeAddonModal">
    <div class="modal-card bg-surface border border-custom rounded-3 shadow-lg p-4" style="width: 500px; max-width: 95vw;" @click.stop>
      <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-custom">
        <h6 class="mb-0 fw-bold d-flex align-items-center">
          <i class="bi bi-tag-fill text-warning me-2 fs-5"></i>
          <span>Single Office Subscription (৳300)</span>
        </h6>
        <button type="button" class="btn-close btn-close-white" @click="closeAddonModal"></button>
      </div>

      <div class="alert alert-info py-2 mb-3 small d-flex align-items-center">
        <i class="bi bi-info-circle-fill me-2 fs-5 flex-shrink-0 text-info"></i>
        <div>
          You have used all office slots in your plan. Add <strong>{{ addonTargetCircle?.name }}</strong> as an additional single circle subscription for <strong>৳300 / month</strong>.
        </div>
      </div>

      <!-- Payment Instructions -->
      <div class="card bg-surface border border-custom p-3 mb-3">
        <div class="fw-bold small text-warning mb-2"><i class="bi bi-wallet2 me-1"></i> Payment Instructions:</div>
        <div class="small text-muted mb-1">
          Send <strong>৳300</strong> via <strong>bKash / Nagad / Rocket</strong> (Send Money / Payment) to:
        </div>
        <div class="d-flex align-items-center gap-2 font-monospace fw-bold text-light bg-black bg-opacity-25 p-2 rounded border border-custom mb-1">
          <span>01700-000000</span>
          <span class="badge bg-primary text-xs ms-auto">Personal / Merchant</span>
        </div>
        <div class="text-xs text-muted">Please enter your transaction ID (TrxID) below after sending payment.</div>
      </div>

      <!-- Form Inputs -->
      <div class="row g-2 mb-3">
        <div class="col-sm-5">
          <label class="form-label text-muted small fw-semibold">Payment Method</label>
          <select v-model="addonPaymentMethod" class="form-select form-select-sm bg-surface border-custom">
            <option value="bKash">bKash</option>
            <option value="Nagad">Nagad</option>
            <option value="Rocket">Rocket</option>
            <option value="Bank">Bank Transfer</option>
          </select>
        </div>
        <div class="col-sm-7">
          <label class="form-label text-muted small fw-semibold">Transaction ID (TrxID) *</label>
          <input 
            type="text" 
            v-model="addonTrxId" 
            class="form-control form-control-sm bg-surface border-custom" 
            placeholder="e.g. 9J4K8L2M" 
            required 
          />
        </div>
      </div>

      <div class="d-flex justify-content-between align-items-center pt-2 border-top border-custom">
        <router-link to="/plans" class="btn btn-sm btn-link text-info p-0 text-decoration-none small">
          <i class="bi bi-arrow-up-circle me-1"></i> Or Upgrade Plan
        </router-link>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeAddonModal" :disabled="submittingAddon">
            Cancel
          </button>
          <button type="button" class="btn btn-sm btn-warning text-dark fw-bold d-flex align-items-center gap-1" @click="submitSingleCirclePurchase" :disabled="submittingAddon || !addonTrxId">
            <span v-if="submittingAddon" class="spinner-border spinner-border-sm"></span>
            <i v-else class="bi bi-check2-circle"></i>
            <span>{{ submittingAddon ? 'Submitting...' : 'Submit ৳300 Add-on' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Change Office Modal Dialog -->
  <div v-if="isChangeModalOpen" class="modal-backdrop-custom d-flex align-items-center justify-content-center" @click.self="closeChangeModal">
    <div class="modal-card bg-surface border border-custom rounded-3 shadow-lg p-4" style="width: 480px; max-width: 95vw;" @click.stop>
      <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-custom">
        <h6 class="mb-0 fw-bold d-flex align-items-center">
          <i class="bi bi-arrow-left-right text-info me-2 fs-5"></i>
          <span>Change / Switch Office</span>
        </h6>
        <button type="button" class="btn-close btn-close-white" @click="closeChangeModal"></button>
      </div>

      <div class="mb-3">
        <label class="form-label text-muted small fw-semibold">Current Active Office</label>
        <div class="form-control bg-surface border-custom d-flex align-items-center text-light opacity-75">
          <i class="bi bi-building me-2 text-info"></i>
          <span class="fw-bold">{{ subToChange?.circleName }}</span>
        </div>
      </div>

      <div class="alert alert-warning py-2 mb-3 small d-flex align-items-center">
        <i class="bi bi-info-circle-fill me-2 fs-5 flex-shrink-0 text-warning"></i>
        <div>
          You can change your office <strong>once</strong> during your active plan. Access will transfer to the new office immediately.
        </div>
      </div>

      <!-- Select New Target Office -->
      <div class="mb-4 position-relative" ref="changeDropdownRef">
        <label class="form-label text-muted small fw-semibold">Select New Target Office</label>
        
        <div 
          class="form-control d-flex justify-content-between align-items-center bg-surface border-custom user-select-none cursor-pointer py-2"
          :class="{ 'border-primary ring-focus': isChangeDropdownOpen }"
          @click="isChangeDropdownOpen = !isChangeDropdownOpen"
          role="button"
          tabindex="0"
        >
          <div class="d-flex align-items-center text-truncate pe-2">
            <i class="bi bi-building-add me-2 text-success opacity-75"></i>
            <span v-if="targetCircle" class="fw-semibold text-truncate">
              {{ targetCircle.name }}
              <small v-if="targetCircle.divisionName" class="text-muted ms-1">({{ targetCircle.divisionName }})</small>
            </span>
            <span v-else class="text-muted">-- Choose new office --</span>
          </div>
          <i class="bi" :class="isChangeDropdownOpen ? 'bi-chevron-up text-primary' : 'bi-chevron-down text-muted'"></i>
        </div>

        <div 
          v-if="isChangeDropdownOpen" 
          class="position-absolute start-0 end-0 bg-surface border border-custom rounded-3 shadow-lg mt-1 p-2 z-3 custom-dropdown-menu"
          @click.stop
        >
          <div class="px-1 pb-2">
            <input 
              type="text" 
              v-model="changeSearchQuery" 
              class="form-control form-control-sm bg-surface border-custom shadow-none" 
              placeholder="Type to search new office..."
              autofocus
            />
          </div>

          <div class="dropdown-list-scroll" style="max-height: 200px; overflow-y: auto;">
            <div v-if="targetAvailableCircles.length === 0" class="text-center py-3 text-muted small">
              No offices match "{{ changeSearchQuery }}"
            </div>

            <div 
              v-for="c in targetAvailableCircles" 
              :key="c.id"
              class="dropdown-circle-item d-flex justify-content-between align-items-center px-2 py-2 rounded-2 mb-1 cursor-pointer"
              :class="{ 'active-item bg-primary text-white': targetCircleId === c.id }"
              @click="targetCircleId = c.id; isChangeDropdownOpen = false; changeSearchQuery = ''"
            >
              <div class="text-truncate pe-2">
                <div class="fw-semibold text-truncate small" :class="targetCircleId === c.id ? 'text-white' : ''">{{ c.name }}</div>
                <div class="text-xs text-truncate" :class="targetCircleId === c.id ? 'text-white text-opacity-75' : 'text-muted'">
                  {{ c.divisionName || 'Circle Office' }}
                </div>
              </div>
              <i v-if="targetCircleId === c.id" class="bi bi-check-lg text-white"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2 pt-2 border-top border-custom">
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="closeChangeModal" :disabled="changingCircle">
          Cancel
        </button>
        <button type="button" class="btn btn-sm btn-primary d-flex align-items-center gap-1" @click="confirmChangeCircle" :disabled="changingCircle || !targetCircleId">
          <span v-if="changingCircle" class="spinner-border spinner-border-sm"></span>
          <i v-else class="bi bi-check-circle-fill"></i>
          <span>{{ changingCircle ? 'Switching...' : 'Confirm Switch' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import axios from '@/plugins/axios';

useHead({ title: 'My Subscriptions | Analyser' });

const subscriptions = ref<any[]>([]);
const availableCircles = ref<any[]>([]);
const profile = ref<any>(null);
const quotaInfo = ref<any>(null);
const selectedCircleId = ref<number | null>(null);
const loading = ref(true);
const error = ref('');
const submitting = ref(false);

const circleSearchQuery = ref('');
const isDropdownOpen = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

// Single Circle Addon Modal state
const isAddonModalOpen = ref(false);
const addonTargetCircle = ref<any>(null);
const addonPaymentMethod = ref('bKash');
const addonTrxId = ref('');
const submittingAddon = ref(false);

// Change Circle Modal state
const isChangeModalOpen = ref(false);
const subToChange = ref<any>(null);
const targetCircleId = ref<number | null>(null);
const changeSearchQuery = ref('');
const isChangeDropdownOpen = ref(false);
const changingCircle = ref(false);
const changeDropdownRef = ref<HTMLElement | null>(null);

const formatStatus = (s: string) => {
  if (s === 'approved') return 'Active';
  if (s === 'inactive') return 'Inactive';
  if (s === 'pending') return 'Pending';
  if (s === 'rejected') return 'Rejected';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'None';
};

const statusClass = (s: string) => ({
  approved: 'bg-success bg-opacity-10 text-success border border-success border-opacity-25',
  inactive: 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25',
  rejected: 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25',
  pending: 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'
}[s] ?? 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25');

const calculateExpiry = (startDate: string, durationDays: number) => {
  if (!startDate || !durationDays) return '-';
  const d = new Date(startDate);
  d.setDate(d.getDate() + Number(durationDays));
  return d.toLocaleDateString();
};

const selectedCircle = computed(() => {
  return availableCircles.value.find(c => c.id === selectedCircleId.value) || null;
});

const targetCircle = computed(() => {
  return availableCircles.value.find(c => c.id === targetCircleId.value) || null;
});

const subscribedCircleIds = computed(() => {
  return new Set(subscriptions.value.filter(s => s.status === 'approved' || s.status === 'pending').map(s => s.circleId));
});

const isAlreadySubscribed = (circleId: number) => {
  return subscribedCircleIds.value.has(circleId);
};

const targetAvailableCircles = computed(() => {
  const currentId = subToChange.value?.circleId;
  const q = changeSearchQuery.value.trim().toLowerCase();
  return availableCircles.value
    .filter(c => c.id !== currentId && !subscriptions.value.some(s => s.circleId === c.id && s.status === 'approved'))
    .filter(c => {
      if (!q) return true;
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const divMatch = (c.divisionName || '').toLowerCase().includes(q);
      return nameMatch || divMatch;
    });
});

const getSubscriptionStatusText = (circleId: number) => {
  const sub = subscriptions.value.find(s => s.circleId === circleId);
  if (!sub) return '';
  return formatStatus(sub.status);
};

const filteredCircles = computed(() => {
  const q = circleSearchQuery.value.trim().toLowerCase();
  if (!q) return availableCircles.value;
  return availableCircles.value.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const divMatch = (c.divisionName || '').toLowerCase().includes(q);
    return nameMatch || divMatch;
  });
});

const toggleDropdown = async () => {
  isDropdownOpen.value = !isDropdownOpen.value;
  if (isDropdownOpen.value) {
    await nextTick();
    searchInputRef.value?.focus();
  }
};

const handleSelectCircle = (c: any) => {
  if (isAlreadySubscribed(c.id)) return;
  selectedCircleId.value = c.id;
  isDropdownOpen.value = false;
  circleSearchQuery.value = '';
};

const clearSelection = () => {
  selectedCircleId.value = null;
  circleSearchQuery.value = '';
};

// Add / Request Office button handler
const handleOfficeSubmit = async () => {
  if (!selectedCircleId.value) return;

  // If quota is already reached, open Add-on purchase modal directly
  if (quotaInfo.value?.isLimitReached) {
    openAddonModal(selectedCircle.value);
    return;
  }

  submitting.value = true;
  try {
    const res = await axios.post('/api/subscriptions/request', { circleId: selectedCircleId.value });
    showToast(res.data?.message || 'Office added successfully!', 'success');
    selectedCircleId.value = null;
    await fetchData();
  } catch (err: any) {
    const data = err.response?.data;
    if (data?.limitReached) {
      openAddonModal(selectedCircle.value);
    } else {
      const msg = data?.message ?? data?.error ?? 'Failed to add office';
      showToast(msg, 'error');
    }
  } finally {
    submitting.value = false;
  }
};

// Open Single Addon Modal
const openAddonModal = (circle: any) => {
  addonTargetCircle.value = circle;
  addonPaymentMethod.value = 'bKash';
  addonTrxId.value = '';
  isAddonModalOpen.value = true;
};

const closeAddonModal = () => {
  if (submittingAddon.value) return;
  isAddonModalOpen.value = false;
  addonTargetCircle.value = null;
};

const submitSingleCirclePurchase = async () => {
  if (!addonTargetCircle.value || !addonTrxId.value) return;
  submittingAddon.value = true;

  try {
    const res = await axios.post('/api/subscriptions/buy-single-circle', {
      circleId: addonTargetCircle.value.id,
      paymentMethod: addonPaymentMethod.value,
      trxId: addonTrxId.value
    });
    showToast(res.data?.message || 'Single circle add-on submitted successfully!', 'success');
    closeAddonModal();
    selectedCircleId.value = null;
    await fetchData();
  } catch (err: any) {
    const msg = err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to submit single circle purchase';
    showToast(msg, 'error');
  } finally {
    submittingAddon.value = false;
  }
};

// Change Circle Modal handlers
const openChangeModal = (sub: any) => {
  subToChange.value = sub;
  targetCircleId.value = null;
  changeSearchQuery.value = '';
  isChangeDropdownOpen.value = false;
  isChangeModalOpen.value = true;
};

const closeChangeModal = () => {
  if (changingCircle.value) return;
  isChangeModalOpen.value = false;
  subToChange.value = null;
  targetCircleId.value = null;
};

const confirmChangeCircle = async () => {
  if (!subToChange.value || !targetCircleId.value) return;
  changingCircle.value = true;

  try {
    const res = await axios.post('/api/subscriptions/change-circle', {
      fromCircleId: subToChange.value.circleId,
      toCircleId: targetCircleId.value
    });
    showToast(res.data?.message || 'Office successfully switched!', 'success');
    closeChangeModal();
    await fetchData();
  } catch (err: any) {
    const msg = err.response?.data?.message ?? err.response?.data?.error ?? 'Failed to switch office';
    showToast(msg, 'error');
  } finally {
    changingCircle.value = false;
  }
};

const handleGlobalClick = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false;
  }
  if (changeDropdownRef.value && !changeDropdownRef.value.contains(e.target as Node)) {
    isChangeDropdownOpen.value = false;
  }
};

const fetchData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const [subRes, profileRes, circlesRes] = await Promise.all([
      axios.get('/api/subscriptions/my'),
      axios.get('/api/auth/me'),
      axios.get('/api/settings/circles')
    ]);

    subscriptions.value = subRes.data?.data ?? subRes.data ?? [];
    quotaInfo.value = subRes.data?.quota ?? null;
    profile.value = profileRes.data?.data ?? profileRes.data?.user ?? profileRes.data ?? {};
    availableCircles.value = circlesRes.data?.data ?? circlesRes.data ?? [];
  } catch (err: any) {
    console.error('Fetch subscriptions error:', err);
    error.value = err.response?.data?.message ?? err.response?.data?.error ?? err.message ?? 'Failed to load subscriptions';
  } finally {
    loading.value = false;
  }
};

const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
let toastTimer: any = null;

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = message;
  toastType.value = type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 4000);
};

onMounted(() => {
  fetchData();
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.toast-slide {
  animation: slideDownToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideDownToast {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 1070;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.cursor-pointer {
  cursor: pointer;
}
.hover-opacity:hover {
  opacity: 0.75;
}
.text-xs {
  font-size: 0.75rem;
}
.btn-xs {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.35rem;
}
.ring-focus {
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}
.dropdown-circle-item {
  transition: background-color 0.15s ease;
}
.dropdown-circle-item:not(.disabled-item):not(.active-item):hover {
  background-color: var(--app-hover, rgba(255, 255, 255, 0.08));
}
.dropdown-circle-item.disabled-item {
  cursor: not-allowed;
}
.custom-dropdown-menu {
  background-color: var(--app-surface, #212529) !important;
  border-color: var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35) !important;
  animation: fadeInDown 0.15s ease-out;
}
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.dropdown-list-scroll::-webkit-scrollbar {
  width: 5px;
}
.dropdown-list-scroll::-webkit-scrollbar-thumb {
  background: var(--app-border, rgba(255, 255, 255, 0.2));
  border-radius: 4px;
}
</style>
