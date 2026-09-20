<template>
  <Pagebar title="Global Settings" />

  <main class="flex-grow-1 p-4">
  <div class="container-fluid mb-5">
    <!-- Top Row: Back Button and Navigation Tabs -->
    <div class="mb-4 d-flex align-items-center">
      <!-- Left: Back Button -->
      <div class="me-3">
        <router-link to="/dashboard" class="btn btn-primary btn-sm rounded-pill px-3 shadow-sm text-nowrap">
          <i class="bi bi-arrow-left me-1"></i> Dashboard
        </router-link>
      </div>

      <!-- Center: Navigation Tabs Component -->
      <div class="flex-grow-1 overflow-hidden">
        <AppTabs :tabs="settingTabs" v-model="activeTab" />
      </div>
    </div>

    <div class="card bg-surface border-custom shadow-sm flex-grow-1 overflow-hidden d-flex flex-column">
      
      <!-- Divisions Tab -->
      <div v-if="activeTab === 'divisions'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="mb-0 fw-bold">Divisions</h5>
          <button class="btn btn-primary btn-sm" @click="openDivModal()">
            <i class="bi bi-plus-lg me-1"></i> Add Division
          </button>
        </div>
        <div class="table-responsive flex-grow-1">
          <table class="table table-hover table-bordered mb-0 align-middle">
            <thead class="sticky-top">
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="3" class="text-center py-3">Loading...</td></tr>
              <tr v-else-if="divisions.length === 0"><td colspan="3" class="text-center py-3">No divisions found.</td></tr>
              <tr v-else v-for="d in divisions" :key="d.id">
                <td>{{ d.id }}</td>
                <td>{{ d.name }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-warning me-2" @click="openDivModal(d)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" @click="deleteDivision(d.id)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Circles Tab -->
      <div v-if="activeTab === 'circles'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="mb-0 fw-bold">Circles</h5>
          <button class="btn btn-primary btn-sm" @click="openCircleModal()">
            <i class="bi bi-plus-lg me-1"></i> Add Circle
          </button>
        </div>
        <div class="table-responsive flex-grow-1">
          <table class="table table-hover table-bordered mb-0 align-middle">
            <thead class="sticky-top">
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Division</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="4" class="text-center py-3">Loading...</td></tr>
              <tr v-else-if="circles.length === 0"><td colspan="4" class="text-center py-3">No circles found.</td></tr>
              <tr v-else v-for="c in circles" :key="c.id">
                <td>{{ c.id }}</td>
                <td>{{ c.name }}</td>
                <td>{{ c.divisionName || divisions.find(d => d.id === c.divisionId)?.name }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-warning me-2" @click="openCircleModal(c)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" @click="deleteCircle(c.id)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Penalties Tab -->
      <div v-if="activeTab === 'penalties'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="mb-0 fw-bold">Penalty Rules</h5>
          <button class="btn btn-primary btn-sm" @click="openPenaltyModal()">
            <i class="bi bi-plus-lg me-1"></i> Add Rule
          </button>
        </div>
        <div class="table-responsive flex-grow-1">
          <table class="table table-hover table-bordered mb-0 align-middle">
            <thead class="sticky-top">
              <tr>
                <th>ID</th>
                <th>Amount (TK)</th>
                <th>Effective Date</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingPenalties"><td colspan="4" class="text-center py-3">Loading...</td></tr>
              <tr v-else-if="penalties.length === 0"><td colspan="4" class="text-center py-3">No penalty rules found.</td></tr>
              <tr v-else v-for="p in penalties" :key="p.id">
                <td>{{ p.id }}</td>
                <td>{{ Number(p.amount).toLocaleString() }} ৳</td>
                <td>{{ new Date(p.effectiveDate).toLocaleDateString() }}</td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-warning me-2" @click="openPenaltyModal(p)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" @click="deletePenalty(p.id)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Security & Limits Tab -->
      <div v-if="activeTab === 'security'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="mb-0 fw-bold">Security & Limits</h5>
          <div>
            <button v-if="!isEditingSecurity" class="btn btn-warning btn-sm" @click="isEditingSecurity = true">
              <i class="bi bi-pencil me-1"></i> Edit Settings
            </button>
            <button v-if="isEditingSecurity" class="btn btn-primary btn-sm me-2" @click="saveAllSettings" :disabled="savingSecurity">
              <span v-if="savingSecurity" class="spinner-border spinner-border-sm me-1"></span>
              {{ savingSecurity ? 'Saving...' : 'Save Settings' }}
            </button>
            <button v-if="isEditingSecurity" class="btn btn-secondary btn-sm" @click="isEditingSecurity = false">Cancel</button>
          </div>
        </div>

        <div v-if="loadingSettings" class="text-center py-4 text-muted">Loading settings...</div>
        <div v-else class="flex-grow-1" style="overflow-y: auto; overflow-x: hidden;">
          <!-- Common Validation -->
          <h6 class="fw-bold text-info border-bottom border-custom pb-2 mb-3">Common Validation Settings (BIN, Return)</h6>
          <div class="row g-3 mb-4">
            <div class="col-md-6" v-for="s in settingsByGroup.common" :key="s.key">
              <div class="d-flex flex-column h-100">
                <label class="form-label text-muted small mb-2">{{ s.description || s.key }}</label>
                <div class="input-group mt-auto">
                  <input 
                    type="text" 
                    class="form-control border-custom" 
                    :class="{ 'text-muted border-0 bg-transparent fw-bold px-2': !isEditingSecurity }"
                    v-model="s.editValue"
                    :readonly="!isEditingSecurity"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- iBAS++ Validation -->
          <h6 class="fw-bold text-success border-bottom border-custom pb-2 mb-3">iBAS++ Validation</h6>
          <div class="row g-3 mb-4">
            <div class="col-md-6" v-for="s in settingsByGroup.ibas" :key="s.key">
              <div class="d-flex flex-column h-100">
                <label class="form-label text-muted small mb-2">{{ s.description || s.key }}</label>
                <div class="input-group mt-auto">
                  <input 
                    type="text" 
                    class="form-control border-custom" 
                    :class="{ 'text-muted border-0 bg-transparent fw-bold px-2': !isEditingSecurity }"
                    v-model="s.editValue"
                    :readonly="!isEditingSecurity"
                  >
                </div>
              </div>
            </div>
          </div>




        </div>
      </div>

    <!-- Column Mappings Tab -->
      <div v-if="activeTab === 'mappings'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="mb-0 fw-bold">Column Mappings</h5>
          <div>
            <button v-if="!isEditingMapping" class="btn btn-warning btn-sm" @click="isEditingMapping = true">
              <i class="bi bi-pencil me-1"></i> Edit Mappings
            </button>
            <button v-if="isEditingMapping" class="btn btn-primary btn-sm me-2" @click="saveMappings" :disabled="savingMappings">
              <span v-if="savingMappings" class="spinner-border spinner-border-sm me-1"></span>
              {{ savingMappings ? 'Saving...' : 'Save Mappings' }}
            </button>
            <button v-if="isEditingMapping" class="btn btn-secondary btn-sm" @click="isEditingMapping = false">Cancel</button>
          </div>
        </div>

        <div v-if="loadingMappings" class="text-center py-4 text-muted">Loading mappings...</div>
        <div v-else class="flex-grow-1" style="overflow-y: auto; overflow-x: hidden;">
          
          <div class="alert bg-secondary bg-opacity-10 border border-secondary text-light d-flex align-items-center mb-4 rounded-3 shadow-sm">
            <i class="bi bi-info-circle me-3 fs-5 text-warning"></i>
            <small class="text-muted">Define the exact "Excel Header Name" that corresponds to each Database Column for each module.</small>
          </div>

          <!-- BIN Analyser Mappings -->
          <h6 class="fw-bold text-white border-bottom border-secondary pb-2 mb-3">BIN Analyser Mappings</h6>
          <div class="table-responsive mb-4">
            <table class="table table-bordered border-custom align-middle mb-0">
              <thead class="table-active">
                <tr>
                  <th style="width: 40%;">Database Field (Target)</th>
                  <th style="width: 60%;">Excel Column Header (Source)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="col in binDbColumnsList" :key="col.key">
                  <td>
                    <div class="fw-bold">{{ col.label }}</div>
                    <div class="text-muted small">Key: <code>{{ col.key }}</code></div>
                  </td>
                  <td>
                    <input 
                      type="text" 
                      v-model="(binMappings as any)[col.key]" 
                      class="form-control form-control-sm border-custom" 
                      :class="{ 'text-muted border-0 bg-transparent fw-bold px-0': !isEditingMapping }"
                      :placeholder="`e.g. ${col.label}`"
                      :readonly="!isEditingMapping"
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Return Analyser Mappings -->
          <h6 class="fw-bold text-white border-bottom border-secondary pb-2 mb-3 mt-4">Return Analyser Mappings</h6>
          <div class="table-responsive mb-4">
            <table class="table table-bordered border-custom align-middle mb-0">
              <thead class="table-active">
                <tr>
                  <th style="width: 40%;">Database Field (Target)</th>
                  <th style="width: 60%;">Excel Column Header (Source)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="col in returnDbColumnsList" :key="col.key">
                  <td>
                    <div class="fw-bold">{{ col.label }}</div>
                    <div class="text-muted small">Key: <code>{{ col.key }}</code></div>
                  </td>
                  <td>
                    <input 
                      type="text" 
                      v-model="(returnMappings as any)[col.key]" 
                      class="form-control form-control-sm border-custom" 
                      :class="{ 'text-muted border-0 bg-transparent fw-bold px-0': !isEditingMapping }"
                      :placeholder="`e.g. ${col.label}`"
                      :readonly="!isEditingMapping"
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- iBAS++ Analyser Mappings -->
          <h6 class="fw-bold text-white border-bottom border-secondary pb-2 mb-3 mt-4">iBAS++ Analyser Mappings</h6>
          <div class="table-responsive mb-4">
            <table class="table table-bordered border-custom align-middle mb-0">
              <thead class="table-active">
                <tr>
                  <th style="width: 40%;">Database Field (Target)</th>
                  <th style="width: 60%;">Excel Column Header (Source)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="col in ibasDbColumnsList" :key="col.key">
                  <td>
                    <div class="fw-bold">{{ col.label }}</div>
                    <div class="text-muted small">Key: <code>{{ col.key }}</code></div>
                  </td>
                  <td>
                    <input 
                      type="text" 
                      v-model="(ibasMappings as any)[col.key]" 
                      class="form-control form-control-sm border-custom" 
                      :class="{ 'text-muted border-0 bg-transparent fw-bold px-0': !isEditingMapping }"
                      :placeholder="`e.g. ${col.label}`"
                      :readonly="!isEditingMapping"
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>

      <!-- Item Mapping Tab -->
      <div v-if="activeTab === 'item_mapping'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3 align-items-center">
          <div class="d-flex align-items-center">
            <h5 class="mb-0 fw-bold me-3">Global Item Mappings</h5>
            <select class="form-select form-select-sm border-custom bg-surface w-auto" v-model="selectedItemModule" @change="fetchItemMappings">
              <option value="ibas">iBAS++ Analyser</option>
              <option value="bin">BIN Analyser</option>
              <option value="return">Return Analyser</option>
            </select>
          </div>
          <div>
            <button class="btn btn-warning btn-sm me-2" @click="startAddNewItem">
              <i class="bi bi-plus-circle me-1"></i> Add New Item
            </button>
            <button class="btn btn-info btn-sm" @click="fetchItemMappings">
              <i class="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>
        </div>
        <div class="table-responsive flex-grow-1">
          <table class="table table-hover table-bordered mb-0 align-middle">
            <thead class="sticky-top">
              <tr>
                <th>ID</th>
                <th>Item Name (Raw)</th>
                <th>Common Item (Mapped)</th>
                <th>Status</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Add New Row -->
              <tr v-if="isAddingNewItem" class="table-active">
                <td>-</td>
                <td>
                  <input type="text" v-model="newItem.itemName" class="form-control form-control-sm border-custom" placeholder="Raw Item Name">
                </td>
                <td>
                  <input type="text" v-model="newItem.commonItem" list="commonItemsList" class="form-control form-control-sm border-custom" placeholder="Common Item">
                </td>
                <td>
                  <select v-model="newItem.status" class="form-select form-select-sm border-custom">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                  </select>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-success me-1" @click="saveNewItem"><i class="bi bi-check2"></i></button>
                  <button class="btn btn-sm btn-secondary" @click="isAddingNewItem = false"><i class="bi bi-x"></i></button>
                </td>
              </tr>

              <tr v-if="loadingItemMappings"><td colspan="5" class="text-center py-3">Loading item mappings...</td></tr>
              <tr v-else-if="itemMappings.length === 0 && !isAddingNewItem"><td colspan="5" class="text-center py-3 text-muted">No item mappings found.</td></tr>
              
              <tr v-else v-for="mapping in itemMappings" :key="mapping.id">
                <td>{{ mapping.id }}</td>
                <td>
                  <span v-if="!mapping.isEditing">{{ mapping.itemName }}</span>
                  <input v-else type="text" v-model="mapping.editItemName" class="form-control form-control-sm border-custom" disabled>
                </td>
                <td>
                  <span v-if="!mapping.isEditing" class="badge bg-secondary">{{ mapping.commonItem }}</span>
                  <input v-else type="text" v-model="mapping.editCommonItem" list="commonItemsList" class="form-control form-control-sm border-custom">
                </td>
                <td>
                  <span v-if="!mapping.isEditing" :class="['badge', mapping.status === 'approved' ? 'bg-success' : 'bg-warning text-dark']">
                    {{ mapping.status }}
                  </span>
                  <select v-else v-model="mapping.editStatus" class="form-select form-select-sm border-custom">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                  </select>
                </td>
                <td class="text-end">
                  <div v-if="!mapping.isEditing">
                    <button class="btn btn-sm btn-outline-info me-1" @click="startEditItem(mapping)">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" @click="deleteItemMapping(mapping.id)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                  <div v-else>
                    <button class="btn btn-sm btn-success me-1" @click="saveEditItem(mapping)">
                      <i class="bi bi-check2"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" @click="mapping.isEditing = false">
                      <i class="bi bi-x"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <datalist id="commonItemsList">
            <option v-for="item in commonItemOptions" :key="item" :value="item"></option>
          </datalist>
        </div>
      </div>

      <!-- Offices & Areas Tab -->
      <div v-if="activeTab === 'offices'" class="p-4 d-flex flex-column h-100">
        <div class="d-flex justify-content-between mb-3">
          <h5 class="mb-0 fw-bold">Offices & Areas (iBAS++)</h5>
          <div>
            <button class="btn btn-warning btn-sm me-2" @click="startAddNewOffice">
              <i class="bi bi-plus-circle me-1"></i> Add New Office
            </button>
            <button class="btn btn-info btn-sm" @click="fetchOffices">
              <i class="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>
        </div>
        <div class="table-responsive flex-grow-1">
          <table class="table table-hover table-bordered mb-0 align-middle">
            <thead class="sticky-top">
              <tr>
                <th>ID</th>
                <th>Office Name</th>
                <th>Area Name</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Add New Office Row -->
              <tr v-if="isAddingNewOffice" class="table-active">
                <td>-</td>
                <td>
                  <input type="text" v-model="newOfficeData.officeName" class="form-control form-control-sm border-custom" placeholder="e.g. UAO- Upazilla Accounts Office">
                </td>
                <td>
                  <input type="text" v-model="newOfficeData.areaName" class="form-control form-control-sm border-custom" placeholder="e.g. Bancharampur">
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-success me-1" @click="saveNewOffice"><i class="bi bi-check2"></i></button>
                  <button class="btn btn-sm btn-secondary" @click="isAddingNewOffice = false"><i class="bi bi-x"></i></button>
                </td>
              </tr>

              <tr v-if="loadingOffices"><td colspan="4" class="text-center py-3">Loading offices...</td></tr>
              <tr v-else-if="officesIbas.length === 0 && !isAddingNewOffice"><td colspan="4" class="text-center py-3 text-muted">No offices found. Add some to get started.</td></tr>
              
              <tr v-else v-for="office in officesIbas" :key="office.id">
                <td>{{ office.id }}</td>
                <td>
                  <span v-if="!office.isEditing">{{ office.officeName }}</span>
                  <input v-else type="text" v-model="office.editOfficeName" class="form-control form-control-sm border-custom">
                </td>
                <td>
                  <span v-if="!office.isEditing" class="badge bg-secondary">{{ office.areaName }}</span>
                  <input v-else type="text" v-model="office.editAreaName" class="form-control form-control-sm border-custom">
                </td>
                <td class="text-end">
                  <div v-if="!office.isEditing">
                    <button class="btn btn-sm btn-outline-info me-1" @click="startEditOffice(office)">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" @click="deleteOffice(office.id)">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                  <div v-else>
                    <button class="btn btn-sm btn-success me-1" @click="saveEditOffice(office)">
                      <i class="bi bi-check2"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" @click="office.isEditing = false">
                      <i class="bi bi-x"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Division Modal -->
    <div class="modal fade" id="divModal" tabindex="-1" ref="divModalRef">
      <div class="modal-dialog">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">{{ editDivData.id ? 'Edit' : 'Add' }} Division</h5>
            <button type="button" class="btn-close" @click="closeDivModal"></button>
          </div>
          <div class="modal-body">
            <label class="form-label">Name</label>
            <input type="text" class="form-control border-custom" v-model="editDivData.name" placeholder="e.g. Dhaka">
          </div>
          <div class="modal-footer border-custom">
            <button class="btn btn-secondary" @click="closeDivModal">Cancel</button>
            <button class="btn btn-primary" @click="saveDivision" :disabled="saving">Save</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Circle Modal -->
    <div class="modal fade" id="circleModal" tabindex="-1" ref="circleModalRef">
      <div class="modal-dialog">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">{{ editCircleData.id ? 'Edit' : 'Add' }} Circle</h5>
            <button type="button" class="btn-close" @click="closeCircleModal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Name</label>
              <input type="text" class="form-control border-custom" v-model="editCircleData.name" placeholder="e.g. Circle-1">
            </div>
            <div class="mb-3">
              <label class="form-label">Division</label>
              <select class="form-select border-custom" v-model="editCircleData.divisionId">
                <option value="" disabled>Select Division</option>
                <option v-for="d in divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>
          </div>
          <div class="modal-footer border-custom">
            <button class="btn btn-secondary" @click="closeCircleModal">Cancel</button>
            <button class="btn btn-primary" @click="saveCircle" :disabled="saving">Save</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Penalty Modal -->
    <div class="modal fade" id="penaltyModal" tabindex="-1" ref="penaltyModalRef">
      <div class="modal-dialog">
        <div class="modal-content bg-surface border-custom">
          <div class="modal-header border-custom">
            <h5 class="modal-title">{{ editPenaltyData.id ? 'Edit' : 'Add' }} Penalty Rule</h5>
            <button type="button" class="btn-close" @click="closePenaltyModal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label text-info">Penalty Amount (TK)</label>
              <input type="number" class="form-control border-custom" v-model="editPenaltyData.amount" placeholder="e.g. 10000">
            </div>
            <div class="mb-3">
              <label class="form-label text-info">Effective Date</label>
              <input type="date" class="form-control border-custom" v-model="editPenaltyData.effectiveDate">
            </div>
          </div>
          <div class="modal-footer border-custom">
            <button class="btn btn-secondary" @click="closePenaltyModal">Cancel</button>
            <button class="btn btn-primary" @click="savePenalty" :disabled="saving">Save</button>
          </div>
        </div>
      </div>
    </div>

  </div>
  </main>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useHead } from '@vueuse/head';
import Pagebar from '@/components/Pagebar.vue';
import AppTabs from '@/components/AppTabs.vue';
import axios from '@/plugins/axios';
import * as bootstrap from 'bootstrap';

useHead({ title: 'Global Settings | Admin' });

const activeTab = ref('divisions');
const loading = ref(false);
const saving = ref(false);

const settingTabs = computed(() => [
  { id: 'divisions', label: 'Divisions', icon: 'bi-map' },
  { id: 'circles', label: 'Circles', icon: 'bi-geo-alt' },
  { id: 'penalties', label: 'Fines', icon: 'bi-exclamation-triangle' },
  { id: 'security', label: 'Limits', icon: 'bi-shield-lock', onClick: () => typeof fetchAppSettings === 'function' ? fetchAppSettings() : null },
  { id: 'mappings', label: 'Column Mappings', icon: 'bi-layout-text-window-reverse', onClick: () => typeof fetchMappings === 'function' ? fetchMappings() : null },
  { id: 'item_mapping', label: 'Item Mappings', icon: 'bi-diagram-3', onClick: () => typeof fetchItemMappings === 'function' ? fetchItemMappings() : null },
  { id: 'offices', label: 'Offices & Areas', icon: 'bi-building', onClick: () => typeof fetchOffices === 'function' ? fetchOffices() : null }
]);

const loadingPenalties = ref(false);
const penalties = ref<any[]>([]);

const divisions = ref<any[]>([]);
const circles = ref<any[]>([]);

// Security Settings
const loadingSettings = ref(false);
const isEditingSecurity = ref(false);
const savingSecurity = ref(false);
const appSettingsList = ref<any[]>([]);

const divModalRef = ref(null);
const circleModalRef = ref(null);
const penaltyModalRef = ref(null);
let divModalInst: bootstrap.Modal | null = null;
let circleModalInst: bootstrap.Modal | null = null;
let penaltyModalInst: bootstrap.Modal | null = null;

const editDivData = reactive({ id: null as number|null, name: '' });
const editCircleData = reactive({ id: null as number|null, name: '', divisionId: '' as number|string });
const editPenaltyData = reactive({ id: null as number|null, amount: '', effectiveDate: '' });

const settingsByGroup = computed(() => {
  const commonKeys = ['bin_format_regex', 'bin_format_description', 'common_date_format', 'common_max_file_size_mb', 'common_max_file_rows'];
  const ibasKeys = ['ibas_date_format', 'ibas_max_file_size_mb', 'ibas_max_file_rows'];
  return {
    common: appSettingsList.value.filter(s => commonKeys.includes(s.key)),
    ibas:   appSettingsList.value.filter(s => ibasKeys.includes(s.key)),
  };
});

const fetchDivisions = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/divisions');
    divisions.value = res.data.data ?? [];
  } catch {
    // Dummy Data
    divisions.value = [
      { id: 1, name: 'Dhaka' },
      { id: 2, name: 'Chattogram' }
    ];
  }
  loading.value = false;
};

const fetchCircles = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/settings/circles');
    circles.value = res.data.data ?? [];
  } catch {
    circles.value = [
      { id: 1, name: 'Dhaka North', divisionId: 1 },
      { id: 2, name: 'Agrabad', divisionId: 2 }
    ];
  }
  loading.value = false;
};

const fetchPenalties = async () => {
  loadingPenalties.value = true;
  try {
    const res = await axios.get('/api/settings/penalties');
    penalties.value = res.data.data ?? [];
  } catch {
    penalties.value = [
      { id: 1, amount: 10000, effectiveDate: new Date().toISOString() }
    ];
  }
  loadingPenalties.value = false;
};

const fetchAppSettings = async () => {
  if (appSettingsList.value.length > 0) return;
  loadingSettings.value = true;
  try {
    const res = await axios.get('/api/settings/app-settings');
    appSettingsList.value = res.data.data.map((s: any) => ({ ...s, editValue: s.value, saving: false }));
  } catch {
    // Dummy Data
    appSettingsList.value = [
      { key: 'bin_format_regex',       value: '^[0-9]{9}-[0-9]{4}$',  editValue: '^[0-9]{9}-[0-9]{4}$',  description: 'Regex pattern for BIN validation (default: 000000000-0000)' },
      { key: 'bin_format_description', value: '000000000-0000 (9 digits, dash, 4 digits)', editValue: '000000000-0000 (9 digits, dash, 4 digits)', description: 'Human-readable BIN format shown in error messages' },
      { key: 'common_date_format',     value: 'DD/MM/YYYY',           editValue: 'DD/MM/YYYY',           description: 'Date format for Excel uploads (DD/MM/YYYY or MM/DD/YYYY)' },
      { key: 'ibas_date_format',       value: 'DD/MM/YYYY',           editValue: 'DD/MM/YYYY',           description: 'Date format for Excel uploads (DD/MM/YYYY or MM/DD/YYYY)' },

      { key: 'common_max_file_size_mb',       value: '2',                    editValue: '2',                    description: 'Maximum Excel upload size in MB (Common)' },
      { key: 'common_max_file_rows',          value: '10000',                editValue: '10000',                description: 'Maximum number of rows allowed in uploaded Excel file (Common)' },
      { key: 'ibas_max_file_size_mb',         value: '5',                    editValue: '5',                    description: 'Maximum Excel upload size in MB (iBAS++)' },
      { key: 'ibas_max_file_rows',            value: '50000',                editValue: '50000',                description: 'Maximum number of rows allowed in uploaded Excel file (iBAS++)' },
    ];
  } finally {
    loadingSettings.value = false;
  }
};

const saveAllSettings = async () => {
  savingSecurity.value = true;
  try {
    for (const s of appSettingsList.value) {
      if (s.value !== s.editValue) {
        await axios.put(`/api/settings/app-settings/${s.key}`, { value: s.editValue });
        s.value = s.editValue;
      }
    }
    alert('All settings saved successfully!');
    isEditingSecurity.value = false;
  } catch (err: any) {
    alert(err.response?.data?.error || 'Failed to save settings');
  } finally {
    savingSecurity.value = false;
  }
};

// Penalty Logic
const openPenaltyModal = (p?: any) => {
  if (p) { 
    editPenaltyData.id = p.id; 
    editPenaltyData.amount = p.amount; 
    editPenaltyData.effectiveDate = new Date(p.effectiveDate).toISOString().split('T')[0];
  } else { 
    editPenaltyData.id = null; 
    editPenaltyData.amount = ''; 
    editPenaltyData.effectiveDate = '';
  }
  penaltyModalInst?.show();
};
const closePenaltyModal = () => penaltyModalInst?.hide();

const savePenalty = async () => {
  if (!editPenaltyData.amount || !editPenaltyData.effectiveDate) return;
  saving.value = true;
  try {
    const payload = { amount: Number(editPenaltyData.amount), effectiveDate: editPenaltyData.effectiveDate };
    if (editPenaltyData.id) {
      await axios.put(`/api/settings/penalties/${editPenaltyData.id}`, payload);
    } else {
      await axios.post('/api/settings/penalties', payload);
    }
    alert('Saved successfully');
    closePenaltyModal();
    fetchPenalties();
  } catch {
    alert('Failed to save');
  }
  saving.value = false;
};

const deletePenalty = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await axios.delete(`/api/settings/penalties/${id}`);
    alert('Deleted');
    fetchPenalties();
  } catch {
    alert('Failed to delete');
  }
};

onMounted(() => {
  fetchDivisions();
  fetchCircles();
  fetchPenalties();
  if (divModalRef.value) divModalInst = new bootstrap.Modal(divModalRef.value);
  if (circleModalRef.value) circleModalInst = new bootstrap.Modal(circleModalRef.value);
  if (penaltyModalRef.value) penaltyModalInst = new bootstrap.Modal(penaltyModalRef.value);
});

// Divisions logic
const openDivModal = (d?: any) => {
  if (d) { editDivData.id = d.id; editDivData.name = d.name; } 
  else { editDivData.id = null; editDivData.name = ''; }
  divModalInst?.show();
};
const closeDivModal = () => divModalInst?.hide();

const saveDivision = async () => {
  if (!editDivData.name) return;
  saving.value = true;
  try {
    const payload = { name: editDivData.name };
    if (editDivData.id) {
      await axios.put(`/api/settings/divisions/${editDivData.id}`, payload);
    } else {
      await axios.post('/api/settings/divisions', payload);
    }
    alert('Saved successfully');
    closeDivModal();
    fetchDivisions();
  } catch {
    alert('Failed to save');
  }
  saving.value = false;
};

const deleteDivision = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await axios.delete(`/api/settings/divisions/${id}`);
    alert('Deleted');
    fetchDivisions();
  } catch {
    alert('Failed to delete');
  }
};

// Circles logic
const openCircleModal = (c?: any) => {
  if (c) { 
    editCircleData.id = c.id; 
    editCircleData.name = c.name; 
    editCircleData.divisionId = c.divisionId;
  } else { 
    editCircleData.id = null; 
    editCircleData.name = ''; 
    editCircleData.divisionId = '';
  }
  circleModalInst?.show();
};
const closeCircleModal = () => circleModalInst?.hide();

const saveCircle = async () => {
  if (!editCircleData.name || !editCircleData.divisionId) return;
  saving.value = true;
  try {
    const payload = { name: editCircleData.name, divisionId: Number(editCircleData.divisionId) };
    if (editCircleData.id) {
      await axios.put(`/api/settings/circles/${editCircleData.id}`, payload);
    } else {
      await axios.post('/api/settings/circles', payload);
    }
    alert('Saved successfully');
    closeCircleModal();
    fetchCircles();
  } catch {
    alert('Failed to save');
  }
  saving.value = false;
};

const deleteCircle = async (id: number) => {
  if (!confirm('Are you sure?')) return;
  try {
    await axios.delete(`/api/settings/circles/${id}`);
    alert('Deleted');
    fetchCircles();
  } catch {
    alert('Failed to delete');
  }
};

// --- Mapping Logic ---
const isEditingMapping = ref(false);
const savingMappings = ref(false);
const loadingMappings = ref(false);

const binDbColumnsList = [
  { key: 'bin_issue_date', label: 'BIN Issue Date' },
  { key: 'division', label: 'Division' },
  { key: 'circle', label: 'Circle' },
  { key: 'bin', label: 'BIN' },
  { key: 'entity_name', label: 'Name' },
  { key: 'address', label: 'Factory / Business Operation Address' },
  { key: 'police_station', label: 'Police Station' },
  { key: 'mobile', label: 'Mobile Number' },
  { key: 'email', label: 'Email' },
  { key: 'hq_address', label: 'Registered HQ Address' },
  { key: 'forced_registration', label: 'Forced Registration' },
  { key: 'major_area', label: 'Major Area of Economic Activity' },
  { key: 'manufacturing_area', label: 'Areas of Manufacturing' },
  { key: 'service_area', label: 'Areas of Service' },
  { key: 'bin_status', label: 'BIN Status' },
  { key: 'e_tin', label: 'e-TIN' }
];

const binMappings = ref<Record<string, string>>({});

const returnDbColumnsList = [
  { key: 'division', label: 'Division' },
  { key: 'circle', label: 'Circle' },
  { key: 'bin', label: 'BIN' },
  { key: 'submission_id', label: 'Submission ID' },
  { key: 'tax_period', label: 'Tax Period' },
  { key: 'has_activities', label: 'Any activities in this Tax Period?' },
  { key: 'total_sales_value', label: 'Total Sales Value' },
  { key: 'total_payable_vat', label: 'Total Payable (VAT)' },
  { key: 'total_payable_sd', label: 'Total Payable (SD)' },
  { key: 'total_input_tax_credit_value', label: 'Total Input Tax Credit (Value)' },
  { key: 'total_input_tax_credit_vat', label: 'Total Input Tax Credit (VAT)' },
  { key: 'increasing_adjustment', label: 'Increasing Adjustment' },
  { key: 'decreasing_adjustment', label: 'Decreasing Adjustment' },
  { key: 'net_payable_vat', label: 'Net Payable (VAT)' },
  { key: 'net_payable_sd', label: 'Net Payable (SD)' },
  { key: 'fine_penalty', label: 'Fine/Penalty for Non-submission Return' },
  { key: 'deposited_vat', label: 'Deposited (VAT)' },
  { key: 'deposited_sd', label: 'Deposited (SD)' },
  { key: 'closing_balance_vat', label: 'Closing Balance (VAT)' },
  { key: 'closing_balance_sd', label: 'Closing Balance (SD)' },
  { key: 'vds_increasing', label: 'VDS (Increasing)' },
  { key: 'vds_decreasing', label: 'VDS (Decreasing)' },
  { key: 'advanced_tax_paid', label: 'Advanced Tax Paid' },
  { key: 'submission_date', label: 'Submission Date' },
  { key: 'last_amendment_date', label: 'Last Amendment Date' }
];

const ibasDbColumnsList = [
  { key: 'office', label: 'Office' },
  { key: 'item', label: 'Item Name' },
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Expenditure' }
];

const returnMappings = ref<Record<string, string>>({});
const ibasMappings = ref<Record<string, string>>({});

const fetchMappings = async () => {
  loadingMappings.value = true;
  try {
    const resBin = await axios.get('/api/settings/mappings?module=bin');
    const dbMappingsBin = resBin.data?.data;
    const currentMapBin: Record<string, string> = {};
    if (Array.isArray(dbMappingsBin) && dbMappingsBin.length > 0) {
      binDbColumnsList.forEach(col => {
        const match = dbMappingsBin.find((m: any) => m.dbColumn === col.key);
        currentMapBin[col.key] = match ? match.excelHeader : col.label;
      });
    } else {
      binDbColumnsList.forEach(col => currentMapBin[col.key] = col.label);
    }
    binMappings.value = currentMapBin;
  } catch {
    binDbColumnsList.forEach(col => binMappings.value[col.key] = col.label);
  }

  try {
    const resReturn = await axios.get('/api/settings/mappings?module=return');
    const dbMappingsReturn = resReturn.data?.data;
    const currentMapReturn: Record<string, string> = {};
    if (Array.isArray(dbMappingsReturn) && dbMappingsReturn.length > 0) {
      returnDbColumnsList.forEach(col => {
        const match = dbMappingsReturn.find((m: any) => m.dbColumn === col.key);
        currentMapReturn[col.key] = match ? match.excelHeader : col.label;
      });
    } else {
      returnDbColumnsList.forEach(col => currentMapReturn[col.key] = col.label);
    }
    returnMappings.value = currentMapReturn;
  } catch {
    returnDbColumnsList.forEach(col => returnMappings.value[col.key] = col.label);
  }

  try {
    const resIbas = await axios.get('/api/settings/mappings?module=ibas');
    const dbMappingsIbas = resIbas.data?.data;
    const currentMapIbas: Record<string, string> = {};
    if (Array.isArray(dbMappingsIbas) && dbMappingsIbas.length > 0) {
      ibasDbColumnsList.forEach(col => {
        const match = dbMappingsIbas.find((m: any) => m.dbColumn === col.key);
        currentMapIbas[col.key] = match ? match.excelHeader : col.label;
      });
    } else {
      ibasDbColumnsList.forEach(col => currentMapIbas[col.key] = col.label);
    }
    ibasMappings.value = currentMapIbas;
  } catch {
    ibasDbColumnsList.forEach(col => ibasMappings.value[col.key] = col.label);
  }
  
  loadingMappings.value = false;
};

const saveMappings = async () => {
  savingMappings.value = true;
  try {
    await axios.post('/api/settings/mappings?module=bin', { mappings: binMappings.value });
    await axios.post('/api/settings/mappings?module=return', { mappings: returnMappings.value });
    await axios.post('/api/settings/mappings?module=ibas', { mappings: ibasMappings.value });
    alert('Mappings saved successfully!');
    isEditingMapping.value = false;
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to save mappings');
  } finally {
    savingMappings.value = false;
  }
};

// --- Item Mappings State ---
const itemMappings = ref<any[]>([]);
const loadingItemMappings = ref(false);
const isAddingNewItem = ref(false);
const selectedItemModule = ref('ibas');
const newItem = ref({ itemName: '', commonItem: '', status: 'approved' });
const commonItemOptions = ref(['Entertainment', 'Travel', 'Stationery', 'Honorarium', 'Fuel', 'Maintenance', 'Training']);

const fetchItemMappings = async () => {
  loadingItemMappings.value = true;
  try {
    const res = await axios.get(`/api/settings/item-mappings?module=${selectedItemModule.value}`);
    itemMappings.value = res.data.map((m: any) => ({
      ...m,
      isEditing: false,
      editItemName: m.itemName,
      editCommonItem: m.commonItem,
      editStatus: m.status
    }));
  } catch (error) {
    itemMappings.value = [];
  } finally {
    loadingItemMappings.value = false;
  }
};

const startAddNewItem = () => {
  isAddingNewItem.value = true;
  newItem.value = { itemName: '', commonItem: '', status: 'approved' };
};

const saveNewItem = async () => {
  if (!newItem.value.itemName || !newItem.value.commonItem) return;
  try {
    await axios.post('/api/settings/item-mappings', {
      moduleName: selectedItemModule.value,
      ...newItem.value
    });
    alert('Item Mapping added!');
    isAddingNewItem.value = false;
    fetchItemMappings();
  } catch (error) {
    alert('Failed to add item mapping');
  }
};

const startEditItem = (mapping: any) => {
  mapping.isEditing = true;
  mapping.editItemName = mapping.itemName;
  mapping.editCommonItem = mapping.commonItem;
  mapping.editStatus = mapping.status;
};

const saveEditItem = async (mapping: any) => {
  try {
    await axios.put(`/api/settings/item-mappings/${mapping.id}`, {
      itemName: mapping.editItemName,
      commonItem: mapping.editCommonItem,
      status: mapping.editStatus
    });
    alert('Item Mapping updated!');
    mapping.isEditing = false;
    fetchItemMappings();
  } catch (error) {
    alert('Failed to update item mapping');
  }
};

const deleteItemMapping = async (id: number) => {
  if (!confirm('Delete this mapping?')) return;
  try {
    await axios.delete(`/api/settings/item-mappings/${id}`);
    alert('Item Mapping deleted!');
    fetchItemMappings();
  } catch (error) {
    alert('Failed to delete item mapping');
  }
};

// --- Offices & Areas State ---
const officesIbas = ref<any[]>([]);
const loadingOffices = ref(false);
const isAddingNewOffice = ref(false);
const newOfficeData = ref({ officeName: '', areaName: '' });

const fetchOffices = async () => {
  loadingOffices.value = true;
  try {
    const res = await axios.get('/api/settings/ibas/offices');
    officesIbas.value = res.data.map((o: any) => ({
      ...o,
      isEditing: false,
      editOfficeName: o.officeName,
      editAreaName: o.areaName
    }));
  } catch (err) {
    officesIbas.value = [];
  } finally {
    loadingOffices.value = false;
  }
};

const startAddNewOffice = () => {
  isAddingNewOffice.value = true;
  newOfficeData.value = { officeName: '', areaName: '' };
};

const saveNewOffice = async () => {
  if (!newOfficeData.value.officeName || !newOfficeData.value.areaName) return;
  try {
    await axios.post('/api/settings/ibas/offices', newOfficeData.value);
    alert('Office added!');
    isAddingNewOffice.value = false;
    fetchOffices();
  } catch (error) {
    alert('Failed to add office');
  }
};

const startEditOffice = (office: any) => {
  office.isEditing = true;
  office.editOfficeName = office.officeName;
  office.editAreaName = office.areaName;
};

const saveEditOffice = async (office: any) => {
  try {
    await axios.put(`/api/settings/ibas/offices/${office.id}`, {
      officeName: office.editOfficeName,
      areaName: office.editAreaName
    });
    alert('Office updated!');
    office.isEditing = false;
    fetchOffices();
  } catch (error) {
    alert('Failed to update office');
  }
};

const deleteOffice = async (id: number) => {
  if (!confirm('Delete this office?')) return;
  try {
    await axios.delete(`/api/settings/ibas/offices/${id}`);
    alert('Office deleted!');
    fetchOffices();
  } catch (error) {
    alert('Failed to delete office');
  }
};

</script>

<style scoped>
.bg-surface {
  background-color: var(--app-surface, #fff);
}
.border-custom {
  border-color: var(--app-border, #dee2e6);
}
.btn-outline-warning {
  color: #ffc107 !important;
  border-color: #ffc107 !important;
}
.btn-outline-warning:hover {
  background-color: #ffc107 !important;
  color: #000 !important;
}
.btn-outline-danger {
  color: #dc3545 !important;
  border-color: #dc3545 !important;
}
.btn-outline-danger:hover {
  background-color: #dc3545 !important;
  color: #fff !important;
}
</style>
