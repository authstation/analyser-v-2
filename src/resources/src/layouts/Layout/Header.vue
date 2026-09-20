<template>
  <header :class="{ scrolled: isScrolled }" class="app-header w-100">
    <div class="container-fluid px-3 px-sm-4">
      <nav class="navbar py-2 px-0 position-relative d-flex align-items-center justify-content-between">
        <!-- Left: Logo or Dynamic Title -->
        <div class="d-flex align-items-center me-auto">
          <router-link to="/dashboard" class="text-decoration-none">
            <div v-if="$route.meta.headerTitle" class="d-flex align-items-center fw-bold fs-5 header-page-title" :class="String($route.meta.headerColor || 'text-primary')">
              <i class="me-2" :class="String($route.meta.headerIcon || '')"></i> {{ $route.meta.headerTitle }}
            </div>
            <AppLogo v-else icon-size="1.5rem" text-size="1.1rem" />
          </router-link>
        </div>

        <!-- Center: Countdown Badge (Dead Center) -->
        <div class="position-absolute start-50 top-50 translate-middle d-none d-md-flex align-items-center" style="z-index: 10; pointer-events: auto;" v-if="!isAdmin && remainingTime">
          <div class="premium-countdown d-flex align-items-center rounded-pill shadow-sm px-3 py-1 border">
            <span class="text-muted me-3 small fw-bold">Plan Expires In</span>
            <i class="bi bi-hourglass-split text-warning me-2"></i>
            <span :class="isExpiringSoon ? 'text-danger fw-bold small' : 'text-success fw-bold small'">{{ remainingTime }}</span>
          </div>
        </div>
        
        <div id="pagebar" class="card card-body nav-card order-5 order-sm-2 d-none"></div>
        <template v-for="btn in featureButtons" :key="btn.id">
          <button v-if="!btn.render" type="button" class="nav-btn order-3 order-sm-3" :class="btn.class" :title="btn.title || undefined" :aria-label="btn.label || 'button'" v-bind="btn.attrs" @click="btn.onClick">
            <i v-if="btn.icon" :class="btn.icon"></i>
            <span v-if="btn.label" class="ms-1">{{ btn.label }}</span>
          </button>
          <template v-else>
            <component :is="featureComponent(btn)" />
          </template>
        </template>

        <!-- Right: Notifications, Theme switch, User profile -->
        <div class="d-flex align-items-center ms-auto gap-3">
          <!-- Notification Bell Dropdown -->
          <div class="dropdown position-relative" ref="notifDropdownRef" v-if="authUser">
            <button 
              type="button" 
              class="btn p-0 border-0 shadow-none hover-scale header-action-btn d-flex align-items-center justify-content-center position-relative" 
              title="Notifications" 
              @click="toggleNotifications"
              :aria-expanded="isNotifOpen" 
              aria-label="Notifications"
            >
              <i class="bi fs-5" :class="unreadCount > 0 ? 'bi-bell-fill text-warning' : 'bi-bell'"></i>
              <!-- Unread Badge -->
              <span 
                v-if="unreadCount > 0" 
                class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-dark notification-badge"
              >
                {{ unreadCount > 9 ? '9+' : unreadCount }}
                <span class="visually-hidden">unread notifications</span>
              </span>
            </button>

            <!-- Notifications Menu Popup -->
            <div 
              class="dropdown-menu dropdown-menu-end custom-notif-dropdown position-absolute end-0 top-100 mt-2 z-3 shadow-lg"
              :class="{ show: isNotifOpen }"
              v-if="isNotifOpen"
              @click.stop
            >
              <!-- Dropdown Header -->
              <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom border-custom notif-header">
                <div class="d-flex align-items-center gap-2">
                  <h6 class="mb-0 fw-bold small text-light">Notifications</h6>
                  <span v-if="unreadCount > 0" class="badge bg-primary text-white text-xs px-2 py-1">
                    {{ unreadCount }} new
                  </span>
                </div>
                <div class="d-flex align-items-center gap-1">
                  <button 
                    type="button" 
                    class="btn btn-link p-0 text-muted hover-light text-xs text-decoration-none" 
                    title="Refresh" 
                    @click="fetchNotifications"
                    :disabled="loadingNotifs"
                  >
                    <i class="bi bi-arrow-clockwise" :class="{ 'spin-anim': loadingNotifs }"></i>
                  </button>
                  <button 
                    v-if="unreadCount > 0"
                    type="button" 
                    class="btn btn-link p-0 text-info text-xs ms-2 text-decoration-none" 
                    @click="handleMarkAllAsRead"
                  >
                    Mark all read
                  </button>
                </div>
              </div>

              <!-- Notifications List -->
              <div class="notif-list-scroll" style="max-height: 340px; overflow-y: auto;">
                <div v-if="loadingNotifs && notificationsList.length === 0" class="text-center py-4 text-muted small">
                  <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                  <div>Loading notifications...</div>
                </div>

                <div v-else-if="notificationsList.length === 0" class="text-center py-4 text-muted px-3">
                  <i class="bi bi-bell-slash fs-4 d-block mb-2 opacity-50"></i>
                  <div class="small fw-semibold">No notifications</div>
                  <div class="text-xs opacity-75">You are all caught up!</div>
                </div>

                <div 
                  v-for="notif in notificationsList" 
                  :key="notif.id"
                  class="notif-item px-3 py-2-5 d-flex align-items-start gap-3 border-bottom border-custom cursor-pointer"
                  :class="{ 'notif-unread': !notif.isRead }"
                  @click="goToNotification(notif)"
                >
                  <!-- Notification Icon -->
                  <div 
                    class="notif-icon-box rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                    :class="iconBoxClass(notif.colorClass)"
                  >
                    <i :class="notif.icon || 'bi-bell-fill'"></i>
                  </div>

                  <!-- Notification Content -->
                  <div class="flex-grow-1 overflow-hidden">
                    <div class="d-flex align-items-center justify-content-between mb-1">
                      <span class="fw-bold small text-light text-truncate pe-1">{{ notif.title }}</span>
                      <span v-if="notif.badge" class="badge text-xs flex-shrink-0" :class="badgeClass(notif.colorClass)">
                        {{ notif.badge }}
                      </span>
                    </div>
                    <p class="mb-1 text-xs text-muted notif-body-clamp">{{ notif.body }}</p>
                    <div class="text-xs text-muted d-flex align-items-center justify-content-between opacity-75">
                      <span>{{ formatTimeAgo(notif.createdAt) }}</span>
                      <span class="text-info d-flex align-items-center gap-1 action-arrow">
                        <span>Action</span>
                        <i class="bi bi-chevron-right text-xs"></i>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Dropdown Footer -->
              <div class="px-3 py-2 border-top border-custom text-center">
                <router-link 
                  :to="isAdmin ? '/admin/users' : '/my-subscriptions'" 
                  class="text-xs text-muted text-decoration-none hover-light" 
                  @click="isNotifOpen = false"
                >
                  {{ isAdmin ? 'Manage User Approvals' : 'Manage Subscriptions' }} <i class="bi bi-arrow-right ms-1"></i>
                </router-link>
              </div>
            </div>
          </div>

          <!-- Theme Toggle -->
          <button id="theme-switch" type="button" title="Toggle Theme" class="btn p-0 border-0 shadow-none hover-scale header-action-btn d-flex align-items-center justify-content-center" aria-label="Toggle Theme" @click="props.onToggleTheme">
            <i :class="themeIconClass" class="fs-5"></i>
          </button>

          <!-- User Account Dropdown -->
          <div class="dropdown ms-1 position-relative" ref="userDropdownRef">
            <button 
              type="button" 
              class="btn p-0 border-0 shadow-none d-flex align-items-center justify-content-center hover-scale dropdown-toggle-no-caret header-action-btn" 
              title="User Account" 
              @click="isUserMenuOpen = !isUserMenuOpen"
              :aria-expanded="isUserMenuOpen" 
              aria-label="User Profile"
            >
              <i class="bi bi-person-circle fs-3 header-user-icon"></i>
            </button>
            <ul 
              class="dropdown-menu dropdown-menu-end custom-user-dropdown position-absolute end-0 top-100 mt-2 z-3"
              :class="{ show: isUserMenuOpen }"
              v-if="isUserMenuOpen"
              @click.stop
            >
              <li class="px-3 py-2 user-info-header mb-1">
                <h6 class="mb-0 small fw-bold user-name-text">{{ authUser?.name || 'User' }}</h6>
                <small class="text-muted d-block text-truncate" style="font-size: 0.75rem; max-width: 180px;">{{ authUser?.email || authUser?.role?.name || '' }}</small>
              </li>
              <li>
                <router-link class="dropdown-item py-2 d-flex align-items-center" to="/profile" @click="isUserMenuOpen = false">
                  <i class="bi bi-person-check me-2 text-info"></i><span>My Profile</span>
                </router-link>
              </li>
              <li v-if="!isAdmin">
                <router-link class="dropdown-item py-2 d-flex align-items-center" to="/my-subscriptions" @click="isUserMenuOpen = false">
                  <i class="bi bi-building-check me-2 text-primary"></i><span>My Subscriptions</span>
                </router-link>
              </li>
              <li>
                <button type="button" class="dropdown-item py-2 text-danger d-flex align-items-center" @click="handleLogoutClick">
                  <i class="bi bi-power me-2"></i><span>Log Out</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, h, inject, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import AppLogo from "@/components/AppLogo.vue";
import { authUser } from "@/composables/useAuth";
import axios from "@/plugins/axios";
import { formatTimeAgo } from "@/utils/format";

interface ButtonEntry {
  id: symbol;
  icon?: string;
  label: string;
  title: string;
  attrs?: Record<string, string>;
  class?: any;
  onClick: () => void;
  render?: () => any[];
}

const featureButtons = inject<ButtonEntry[]>("featureButtons")!;

function featureComponent(btn: ButtonEntry) {
  return {
    name: "FeatureSlot",
    render: () => h("div", { class: ["order-3 order-sm-4", btn.class] }, btn.render!())
  };
}

interface HeaderProps {
  isScrolled: boolean;
  themeMode: "light" | "dark" | "auto";
  onLogout: () => void | Promise<void>;
  onToggleTheme: () => void;
}

const props = defineProps<HeaderProps>();
const router = useRouter();

const isUserMenuOpen = ref(false);
const userDropdownRef = ref<HTMLElement | null>(null);

// Notifications state
const isNotifOpen = ref(false);
const notifDropdownRef = ref<HTMLElement | null>(null);
const notificationsList = ref<any[]>([]);
const unreadCount = ref(0);
const loadingNotifs = ref(false);
let notifInterval: any = null;

const toggleNotifications = async () => {
  isNotifOpen.value = !isNotifOpen.value;
  if (isNotifOpen.value) {
    isUserMenuOpen.value = false;
    await fetchNotifications();
  }
};

const fetchNotifications = async () => {
  if (!authUser.value) return;
  loadingNotifs.value = true;
  try {
    const res = await axios.get("/api/notifications");
    notificationsList.value = res.data?.data || [];
    unreadCount.value = res.data?.unreadCount ?? 0;
  } catch (err) {
    console.error("Fetch notifications error:", err);
  } finally {
    loadingNotifs.value = false;
  }
};

const goToNotification = (notif: any) => {
  isNotifOpen.value = false;
  if (notif.link) {
    router.push(notif.link);
  }
};

const handleMarkAllAsRead = async () => {
  try {
    await axios.post("/api/notifications/read-all");
    unreadCount.value = 0;
    // Use map() to create a new array — ensures Vue 3 reactivity detects the change
    notificationsList.value = notificationsList.value.map((n) => ({ ...n, isRead: true }));
  } catch (err) {
    console.error("Mark all as read error:", err);
  }
};


const iconBoxClass = (colorClass: string) => ({
  warning: "bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25",
  danger: "bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25",
  info: "bg-info bg-opacity-10 text-info border border-info border-opacity-25",
  success: "bg-success bg-opacity-10 text-success border border-success border-opacity-25",
  primary: "bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25",
}[colorClass] ?? "bg-secondary bg-opacity-10 text-secondary");

const badgeClass = (colorClass: string) => ({
  warning: "bg-warning text-dark fw-bold px-2 py-1",
  danger: "bg-danger text-white fw-bold px-2 py-1",
  info: "bg-info text-dark fw-bold px-2 py-1",
  success: "bg-success text-white fw-bold px-2 py-1",
  primary: "bg-primary text-white fw-bold px-2 py-1",
}[colorClass] ?? "bg-secondary text-white px-2 py-1");

const handleClickOutside = (e: MouseEvent) => {
  if (userDropdownRef.value && !userDropdownRef.value.contains(e.target as Node)) {
    isUserMenuOpen.value = false;
  }
  if (notifDropdownRef.value && !notifDropdownRef.value.contains(e.target as Node)) {
    isNotifOpen.value = false;
  }
};

const currentTime = ref(Date.now());
let timerInterval: any = null;

function startNotifPolling() {
  if (notifInterval) clearInterval(notifInterval);
  fetchNotifications();
  notifInterval = setInterval(() => {
    fetchNotifications();
  }, 45000);
}

function stopNotifPolling() {
  if (notifInterval) {
    clearInterval(notifInterval);
    notifInterval = null;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  timerInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 30000);

  // Start polling only if already authenticated
  if (authUser.value) {
    startNotifPolling();
  }
});

// Watch authUser — restart polling on login, stop on logout
watch(authUser, (newUser) => {
  if (newUser) {
    startNotifPolling();
  } else {
    stopNotifPolling();
    notificationsList.value = [];
    unreadCount.value = 0;
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  if (timerInterval) clearInterval(timerInterval);
  stopNotifPolling();
});

const handleLogoutClick = async () => {
  isUserMenuOpen.value = false;
  await props.onLogout();
};

const isAdmin = computed(() => {
  if (!authUser.value) return false;
  const roleVal = authUser.value.role;
  const r = (typeof roleVal === "string" ? roleVal : roleVal?.name || "").toLowerCase();
  return r === "admin" || r === "super-admin" || r === "superadmin";
});

const remainingTime = computed(() => {
  const u = authUser.value as any;
  if (!u || !u.planStartDate || !u.planDurationDays) return null;
  const start = new Date(u.planStartDate).getTime();
  const durationMs = Number(u.planDurationDays) * 24 * 60 * 60 * 1000;
  const expiry = start + durationMs;
  const diff = expiry - currentTime.value;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${days}d : ${hours.toString().padStart(2, "0")}h : ${mins.toString().padStart(2, "0")}m`;
});

const isExpiringSoon = computed(() => {
  const u = authUser.value as any;
  if (!u || !u.planStartDate || !u.planDurationDays) return false;
  const start = new Date(u.planStartDate).getTime();
  const durationMs = Number(u.planDurationDays) * 24 * 60 * 60 * 1000;
  const expiry = start + durationMs;
  const diff = expiry - currentTime.value;
  return diff <= 3 * 24 * 60 * 60 * 1000; // <= 3 days
});

const themeIconClass = computed(() => {
  if (props.themeMode === "light") return "bi bi-brightness-high-fill";
  if (props.themeMode === "dark") return "bi bi-moon-stars";
  return "bi bi-circle-half";
});
</script>

<style lang="scss" scoped>
.app-header {
  background-color: var(--app-surface, #212529) !important;
  border-bottom: 1px solid var(--app-border, rgba(255, 255, 255, 0.12)) !important;
  width: 100% !important;
  position: sticky;
  top: 0;
  z-index: 1060;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.navbar {
  background-color: transparent !important;
  border: none !important;
  min-height: 56px;
}

.header-action-btn {
  color: var(--app-text, #f8f9fa);
  transition: transform 0.15s ease, opacity 0.15s ease, color 0.15s ease;

  &:hover {
    opacity: 0.85;
  }
}

.header-user-icon {
  color: var(--app-text, #f8f9fa);
}

.hover-scale {
  transition: transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
}
.hover-scale:hover {
  transform: scale(1.06);
}

.notification-badge {
  font-size: 0.65rem;
  padding: 0.2em 0.45em;
  transform: translate(25%, -30%) !important;
}

.custom-notif-dropdown {
  background-color: var(--app-surface, #212529) !important;
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  border-radius: 0.75rem;
  width: 330px;
  max-width: 90vw;
  padding: 0;
  animation: fadeInDropdown 0.15s ease-out;
}

.custom-user-dropdown {
  background-color: var(--app-surface, #212529) !important;
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  border-radius: 0.75rem;
  min-width: 220px;
  padding: 0.4rem 0;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28) !important;
  animation: fadeInDropdown 0.15s ease-out;
}

@keyframes fadeInDropdown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-info-header,
.notif-header {
  border-bottom: 1px solid var(--app-border, rgba(255, 255, 255, 0.1)) !important;
}

.border-custom {
  border-color: var(--app-border, rgba(255, 255, 255, 0.1)) !important;
}

.user-name-text {
  color: var(--app-text, #f8f9fa) !important;
}

.notif-item {
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--app-hover, rgba(255, 255, 255, 0.06)) !important;

    .action-arrow {
      color: #0dcaf0 !important;
      transform: translateX(2px);
    }
  }
}

.notif-unread {
  background-color: rgba(13, 110, 253, 0.05);
}

.notif-icon-box {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
}

.notif-body-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.action-arrow {
  transition: transform 0.15s ease;
}

.text-xs {
  font-size: 0.72rem;
}

.py-2-5 {
  padding-top: 0.65rem;
  padding-bottom: 0.65rem;
}

.cursor-pointer {
  cursor: pointer;
}

.hover-light:hover {
  color: var(--app-text, #ffffff) !important;
}

.spin-anim {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.notif-list-scroll::-webkit-scrollbar {
  width: 5px;
}
.notif-list-scroll::-webkit-scrollbar-thumb {
  background: var(--app-border, rgba(255, 255, 255, 0.2));
  border-radius: 4px;
}

.dropdown-item {
  color: var(--app-text, #f8f9fa) !important;
  background-color: transparent !important;
  font-size: 0.88rem;
  font-weight: 500;
  padding: 0.55rem 1rem;
  display: flex;
  align-items: center;
  width: 100%;
  border: none;
  outline: none;
  box-shadow: none !important;
  transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;

  &:hover,
  &:focus,
  &:active {
    background-color: var(--app-hover, rgba(255, 255, 255, 0.08)) !important;
    color: var(--app-text, #ffffff) !important;
  }
}

.premium-countdown {
  background: rgba(255, 193, 7, 0.05);
  border-color: rgba(255, 193, 7, 0.2) !important;
}
</style>
