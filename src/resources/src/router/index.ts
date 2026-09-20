import { createRouter, createWebHistory } from "vue-router";
import { setupRouteProgress } from "@/plugins/routeProgress";
import { useAuthStore } from "@/stores/auth";

export const routes = [
  {
    path: "/",
    name: "landing",
    component: () => import("@/pages/landing/index.vue")
  },
  {
    path: "/plans",
    name: "plans",
    component: () => import("@/pages/plans/index.vue")
  },
  {
    path: "/dashboard",
    name: "dashlayout",
    component: () => import("@/layouts/Layout/index.vue"),
    children: [
      {
        path: "",
        name: "dashboard",
        component: () => import("@/pages/dashboard/index.vue"),
        meta: { requiresAuth: true }
      },
      {
        path: "/admin",
        redirect: "/admin/users"
      },
      {
        path: "/admin/users",
        name: "admin-users",
        component: () => import("@/pages/admin/users/index.vue"),
        meta: { 
          requiresAuth: true,
          requiresAdmin: true,
          headerTitle: 'User Management',
          headerIcon: 'bi-people-fill',
          headerColor: 'text-primary'
        }
      },
      {
        path: "/admin/plans",
        name: "admin-plans",
        component: () => import("@/pages/admin/plans/index.vue"),
        meta: { 
          requiresAuth: true,
          requiresAdmin: true,
          headerTitle: 'Subscription Plans',
          headerIcon: 'bi-tags-fill',
          headerColor: 'text-info'
        }
      },
      {
        path: "/admin/subscriptions",
        name: "admin-subscriptions",
        component: () => import("@/pages/admin/subscriptions/index.vue"),
        meta: { 
          requiresAuth: true,
          requiresAdmin: true,
          headerTitle: 'Manage Subscriptions',
          headerIcon: 'bi-card-checklist',
          headerColor: 'text-success'
        }
      },
      {
        path: "/admin/settings",
        name: "admin-settings",
        component: () => import("@/pages/admin/settings/index.vue"),
        meta: { 
          requiresAuth: true,
          requiresAdmin: true,
          headerTitle: 'Global Settings',
          headerIcon: 'bi-gear-fill',
          headerColor: 'text-light'
        }
      },
      {
        path: "/profile",
        name: "profile",
        component: () => import("@/pages/profile/index.vue"),
        meta: { 
          requiresAuth: true,
          headerTitle: 'My Profile',
          headerIcon: 'bi-person-circle',
          headerColor: 'text-secondary'
        }
      },
      {
        path: "/modules/bin-analyser",
        name: "bin-analyser",
        component: () => import("@/pages/modules/bin-analyser.vue"),
        meta: { 
          requiresAuth: true,
          headerTitle: 'BIN Analyser',
          headerIcon: 'bi-file-earmark-bar-graph',
          headerColor: 'text-primary'
        }
      },
      {
        path: "/modules/return-data-analyser",
        name: "return-data-analyser",
        component: () => import("@/pages/modules/return-analyser.vue"),
        meta: { 
          requiresAuth: true,
          headerTitle: 'Return Data Analyser',
          headerIcon: 'bi-arrow-return-right',
          headerColor: 'text-success'
        }
      },
      {
        path: "/modules/reports",
        component: () => import("@/pages/modules/reports/layout.vue"),
        redirect: "/modules/reports/dashboard",
        meta: { 
          requiresAuth: true,
          headerTitle: 'Reports & Analytics',
          headerIcon: 'bi-bar-chart-fill',
          headerColor: 'text-warning'
        },
        children: [
          {
            path: "dashboard",
            name: "bin-dashboard",
            component: () => import("@/pages/modules/reports/dashboard.vue")
          },
          {
            path: "bin-list",
            name: "bin-list",
            component: () => import("@/pages/modules/reports/bin-list.vue")
          },
          {
            path: "duplicate-entities",
            name: "bin-duplicate-entities",
            component: () => import("@/pages/modules/reports/duplicate-entities.vue")
          },
          {
            path: "search-entity",
            name: "bin-search-entity",
            component: () => import("@/pages/modules/reports/search-entity.vue")
          },
          {
            path: "comparison/:type",
            name: "bin-area-comparison",
            component: () => import("@/pages/modules/reports/area-comparison.vue")
          },
          {
            path: "chart-details/:type",
            name: "bin-chart-details",
            component: () => import("@/pages/modules/reports/chart-details.vue")
          },
          {
            path: "pivot-drilldown",
            name: "bin-pivot-drilldown",
            component: () => import("@/pages/modules/reports/pivot-drilldown.vue")
          }
        ]
      },
      {
        path: "/modules/return-data-reports",
        component: () => import("@/pages/modules/return-data-reports/layout.vue"),
        redirect: "/modules/return-data-reports/dashboard",
        meta: {
          requiresAuth: true,
          headerTitle: 'Return Data Reports',
          headerIcon: 'bi-pie-chart-fill',
          headerColor: 'text-success'
        },
        children: [
          {
            path: "dashboard",
            name: "return-dashboard",
            component: () => import("@/pages/modules/return-data-reports/dashboard.vue")
          },
          {
            path: "return-list",
            name: "return-list",
            component: () => import("@/pages/modules/return-data-reports/return-list.vue")
          },
          {
            path: "search-by-bin",
            name: "return-search-by-bin",
            component: () => import("@/pages/modules/return-data-reports/search-by-bin.vue")
          },
          {
            path: "non-filer-list",
            name: "return-non-filer-list",
            component: () => import("@/pages/modules/return-data-reports/non-filer-list.vue")
          },
          {
            path: "return-fy-comparison",
            name: "return-fy-comparison",
            component: () => import("@/pages/modules/return-data-reports/return-fy-comparison.vue")
          },
          {
            path: "return-year-comparison",
            name: "return-year-comparison",
            component: () => import("@/pages/modules/return-data-reports/return-year-comparison.vue")
          },
          {
            path: "entity-drilldown",
            name: "return-entity-drilldown",
            component: () => import("@/pages/modules/return-data-reports/entity-drilldown.vue")
          },
          {
            path: "entity-details-report",
            name: "return-entity-details-report",
            component: () => import("@/pages/modules/return-data-reports/entity-details-report.vue")
          }
        ]
      },
      {
        path: "/my-subscriptions",
        name: "my-subscriptions",
        component: () => import("@/pages/subscriptions/index.vue"),
        meta: {
          requiresAuth: true,
          headerTitle: 'My Subscriptions',
          headerIcon: 'bi-briefcase',
          headerColor: 'text-primary'
        }
      }
    ]
  },
  {
    path: "/:authLayout(login|register|forget-password|reset-password|verify-email)",
    component: () => import("@/layouts/AuthLayout.vue"),
    children: [
      {
        path: "/register",
        name: "register",
        component: () => import("@/pages/auth/register.vue"),
        meta: { guestOnly: true }
      },
      {
        path: "/login",
        name: "login",
        component: () => import("@/pages/auth/login.vue"),
        meta: { guestOnly: true }
      },
      {
        path: "/forget-password",
        name: "forget-password",
        component: () => import("@/pages/auth/forgetPassword.vue"),
        meta: { guestOnly: true }
      },
      {
        path: "/reset-password",
        name: "reset-password",
        component: () => import("@/pages/auth/resetPassword.vue"),
        meta: { guestOnly: true }
      },
      {
        path: "/verify-email",
        name: "verify-email",
        component: () => import("@/pages/auth/verifyEmail.vue"),
        meta: { guestOnly: true }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, savedPosition) => {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  }
});

setupRouteProgress(router);

import axios from "@/plugins/axios";

let cachedSettings: Record<string, boolean> | null = null;
let lastFetchTime = 0;
let fetchInFlight: Promise<void> | null = null;

async function getModuleStatus(moduleKey: string): Promise<boolean> {
  const now = Date.now();
  if (!cachedSettings || now - lastFetchTime > 30000) {
    // If a fetch is already in-flight, wait for it instead of making a duplicate request
    if (!fetchInFlight) {
      fetchInFlight = (async () => {
        try {
          const res = await axios.get('/api/settings/app-settings');
          const list = res.data?.data || [];
          const map: Record<string, boolean> = {};
          for (const item of list) {
            map[item.key] = item.value === 'true';
          }
          cachedSettings = map;
          lastFetchTime = Date.now();
        } catch {
          // fallback: keep existing cache or return true
        } finally {
          fetchInFlight = null;
        }
      })();
    }
    await fetchInFlight;
  }
  if (cachedSettings && moduleKey in cachedSettings) {
    return cachedSettings[moduleKey];
  }
  return true;
}

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.bootstrap();

  // Redirect to login if not authenticated
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (auth.isAuthenticated) {
    const userRole = String((auth.user?.role as unknown) ?? "").toLowerCase();

    // Inactive or rejected user check: immediately kick to login
    if (userRole !== "admin" && (auth.user?.paymentStatus === "inactive" || auth.user?.paymentStatus === "rejected")) {
      // Logout in background (don't await — avoids re-triggering the guard mid-logout)
      auth.logout().catch(() => {});
      return { path: "/login" };
    }

    // Redirect to dashboard if admin-only route accessed by non-admin
    if (to.meta.requiresAdmin && userRole !== "admin") {
      return { path: "/dashboard" };
    }

    // Prevent non-admin access to disabled modules
    if (userRole !== "admin") {
      const path = to.path;
      if (path.startsWith("/modules/bin-analyser") || path.startsWith("/modules/reports")) {
        const active = await getModuleStatus("module_bin_analyser");
        if (!active) return { path: "/dashboard" };
      } else if (path.startsWith("/modules/return-data") || path.startsWith("/modules/return-data-reports") || path.startsWith("/modules/return-data-analyser")) {
        const active = await getModuleStatus("module_return_data");
        if (!active) return { path: "/dashboard" };
      } else if (path.startsWith("/modules/revenue-analyser")) {
        const active = await getModuleStatus("module_revenue");
        if (!active) return { path: "/dashboard" };
      } else if (path.startsWith("/modules/ibas-analysis")) {
        const active = await getModuleStatus("module_ibas");
        if (!active) return { path: "/dashboard" };
      }
    }
  }

  // Redirect authenticated users away from guest-only pages
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { path: "/dashboard" };
  }

  return true;
});

export default router;
