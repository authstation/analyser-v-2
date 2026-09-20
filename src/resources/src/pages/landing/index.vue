<template>
  <div class="landing-page min-vh-100 d-flex flex-column">
    <!-- Navbar -->
    <header class="landing-nav fixed-top py-3 px-3 px-lg-5" :class="{ 'nav-scrolled shadow-sm': isScrolled }">
      <div class="container-xxl d-flex align-items-center justify-content-between">
        <router-link to="/" class="text-decoration-none d-flex align-items-center">
          <AppLogo icon-size="1.6rem" text-size="1.15rem" />
        </router-link>

        <!-- Desktop Nav Links -->
        <nav class="d-none d-lg-flex align-items-center gap-4">
          <a href="#features" class="nav-link-item">Features</a>
          <a href="#modules" class="nav-link-item">Modules</a>
          <a href="#risk-engine" class="nav-link-item">Risk Engine</a>
          <a href="#pricing" class="nav-link-item">Pricing Plans</a>
          <a href="#faq" class="nav-link-item">FAQ</a>
        </nav>

        <!-- Right Action Buttons -->
        <div class="d-flex align-items-center gap-3">
          <button 
            type="button" 
            title="Toggle Theme" 
            class="btn p-0 border-0 shadow-none theme-toggle-btn d-flex align-items-center justify-content-center" 
            aria-label="Toggle Theme" 
            @click="ui.cycleTheme"
          >
            <i :class="ui.themeIcon" class="fs-5"></i>
          </button>

          <template v-if="auth.isAuthenticated">
            <router-link to="/dashboard" class="btn btn-primary rounded-pill px-4 py-2 fw-semibold d-flex align-items-center shadow-sm">
              <i class="bi bi-speedometer2 me-2"></i> Go to Dashboard
            </router-link>
          </template>
          <template v-else>
            <router-link to="/login" class="btn btn-outline-secondary rounded-pill px-3 py-1 fw-medium btn-sm text-app">
              Login
            </router-link>
            <router-link to="/plans" class="btn btn-primary rounded-pill px-4 py-2 fw-semibold btn-sm shadow-sm">
              Get Started <i class="bi bi-arrow-right ms-1"></i>
            </router-link>
          </template>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section position-relative overflow-hidden pt-5 pb-5 d-flex align-items-center">
      <div class="container-xxl pt-5 pb-4 position-relative z-2">
        <div class="row align-items-center g-5 py-4">
          <div class="col-lg-7 text-center text-lg-start">
            <div class="badge rounded-pill px-3 py-2 mb-4 d-inline-flex align-items-center gap-2 hero-badge">
              <i class="bi bi-shield-check text-success fs-6"></i>
              <span class="fw-semibold">Next-Gen VAT & Revenue Intelligence Platform</span>
            </div>

            <h1 class="display-4 fw-black tracking-tight mb-4 hero-headline">
              Intelligent Auditing & <span class="text-gradient">Tax Compliance</span> for Revenue Offices
            </h1>

            <p class="lead mb-4 mx-auto mx-lg-0 text-muted hero-subtext" style="max-width: 620px;">
              Automate multi-year BIN verification, detect VDS leakages, audit return data across 60 tax periods, and pinpoint non-filing anomalies in seconds.
            </p>

            <div class="d-flex flex-wrap gap-3 justify-content-center justify-content-lg-start pt-2">
              <router-link :to="auth.isAuthenticated ? '/dashboard' : '/plans'" class="btn btn-primary btn-lg rounded-pill px-4 py-3 fw-bold shadow-sm">
                <span>{{ auth.isAuthenticated ? 'Open Dashboard' : 'Explore Plans & Pricing' }}</span>
                <i class="bi bi-arrow-right ms-2"></i>
              </router-link>
              <a href="#features" class="btn btn-outline-secondary btn-lg rounded-pill px-4 py-3 fw-medium text-app">
                <i class="bi bi-play-circle me-2"></i> How It Works
              </a>
            </div>

            <!-- Quick stats bar -->
            <div class="row g-3 mt-4 pt-3 border-top border-custom text-start">
              <div class="col-4">
                <div class="fw-bold fs-4 text-primary">60+</div>
                <div class="small text-muted">Tax Periods Analysed</div>
              </div>
              <div class="col-4">
                <div class="fw-bold fs-4 text-success">21</div>
                <div class="small text-muted">Audit Risk Engines</div>
              </div>
              <div class="col-4">
                <div class="fw-bold fs-4 text-info">100%</div>
                <div class="small text-muted">Automated Reconciliation</div>
              </div>
            </div>
          </div>

          <!-- Hero Graphic / Dashboard Showcase -->
          <div class="col-lg-5">
            <div class="hero-preview-card p-3 shadow-lg">
              <div class="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-custom">
                <div class="d-flex align-items-center gap-2">
                  <span class="status-dot dot-red"></span>
                  <span class="status-dot dot-yellow"></span>
                  <span class="status-dot dot-green"></span>
                  <span class="small fw-bold ms-2 text-muted">Live Compliance Monitor</span>
                </div>
                <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 rounded-pill px-2 py-1 small">
                  Audit Ready
                </span>
              </div>

              <!-- Metric Badges -->
              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="p-2 rounded metric-box">
                    <span class="small text-muted d-block">Active BINs</span>
                    <strong class="fs-5 text-app">14,250</strong>
                    <span class="badge bg-primary bg-opacity-10 text-primary float-end small mt-1">+12%</span>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2 rounded metric-box">
                    <span class="small text-muted d-block">Non-Filers Flagged</span>
                    <strong class="fs-5 text-danger">342</strong>
                    <span class="badge bg-danger bg-opacity-10 text-danger float-end small mt-1">Action Req.</span>
                  </div>
                </div>
              </div>

              <!-- Risk Detection Engine Preview -->
              <div class="p-3 rounded mb-3 risk-preview-box">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="small fw-bold text-info"><i class="bi bi-shield-exclamation me-1"></i> 21-Factor Risk Engine</span>
                  <span class="badge bg-warning bg-opacity-25 text-warning small">Real-Time</span>
                </div>
                <div class="progress mb-2" style="height: 6px;">
                  <div class="progress-bar bg-success" style="width: 78%"></div>
                  <div class="progress-bar bg-warning" style="width: 14%"></div>
                  <div class="progress-bar bg-danger" style="width: 8%"></div>
                </div>
                <div class="d-flex justify-content-between text-muted" style="font-size: 0.75rem;">
                  <span>Normal (78%)</span>
                  <span>Review (14%)</span>
                  <span>High Risk (8%)</span>
                </div>
              </div>

              <!-- Mini Data Table -->
              <div class="table-responsive small">
                <table class="table table-sm table-borderless align-middle mb-0">
                  <thead>
                    <tr class="text-muted border-bottom border-custom">
                      <th>BIN / Entity</th>
                      <th>Tax Period</th>
                      <th>Status</th>
                      <th class="text-end">Risk Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="fw-semibold text-app">002384910-0101</td>
                      <td>2024-05</td>
                      <td><span class="badge bg-success bg-opacity-10 text-success">Filed</span></td>
                      <td class="text-end text-success"><i class="bi bi-check-circle"></i> Clean</td>
                    </tr>
                    <tr>
                      <td class="fw-semibold text-app">004819203-0203</td>
                      <td>2024-05</td>
                      <td><span class="badge bg-danger bg-opacity-10 text-danger">Non-Filer</span></td>
                      <td class="text-end text-danger"><i class="bi bi-exclamation-octagon"></i> Default</td>
                    </tr>
                    <tr>
                      <td class="fw-semibold text-app">001928374-0102</td>
                      <td>2024-04</td>
                      <td><span class="badge bg-warning bg-opacity-10 text-warning">Mismatch</span></td>
                      <td class="text-end text-warning"><i class="bi bi-dash-circle"></i> VDS Variance</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Core Features Section -->
    <section id="features" class="py-5 feature-section border-top border-bottom border-custom">
      <div class="container-xxl py-4">
        <div class="text-center mb-5">
          <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-semibold mb-2">Capabilities</span>
          <h2 class="display-6 fw-bold mb-3 section-heading">Purpose-Built for Bangladesh VAT & Revenue Audit</h2>
          <p class="text-muted mx-auto" style="max-width: 650px;">
            Engineered to process massive datasets from circles and divisions with instant aggregation, audit flags, and multi-year trend analysis.
          </p>
        </div>

        <div class="row g-4">
          <div class="col-md-6 col-lg-3">
            <div class="card h-100 feature-card p-4">
              <div class="icon-circle bg-primary bg-opacity-10 text-primary mb-3">
                <i class="bi bi-file-earmark-bar-graph fs-4"></i>
              </div>
              <h5 class="fw-bold mb-2 card-title-app">BIN Analyser</h5>
              <p class="text-muted small mb-0">
                Instantly check BIN registrations, circle assignments, duplicate entities, and status across commissionerates.
              </p>
            </div>
          </div>

          <div class="col-md-6 col-lg-3">
            <div class="card h-100 feature-card p-4">
              <div class="icon-circle bg-success bg-opacity-10 text-success mb-3">
                <i class="bi bi-arrow-return-right fs-4"></i>
              </div>
              <h5 class="fw-bold mb-2 card-title-app">Return Data Analyser</h5>
              <p class="text-muted small mb-0">
                Audit monthly VAT return filings across 60 tax periods with breakdown of sales, purchases, and net tax payable.
              </p>
            </div>
          </div>

          <div class="col-md-6 col-lg-3">
            <div class="card h-100 feature-card p-4">
              <div class="icon-circle bg-warning bg-opacity-10 text-warning mb-3">
                <i class="bi bi-graph-up-arrow fs-4"></i>
              </div>
              <h5 class="fw-bold mb-2 card-title-app">Revenue Analyser</h5>
              <p class="text-muted small mb-0">
                Track fiscal year targets, collection performance, and compare revenue trends across circles and sectors.
              </p>
            </div>
          </div>

          <div class="col-md-6 col-lg-3">
            <div class="card h-100 feature-card p-4">
              <div class="icon-circle bg-info bg-opacity-10 text-info mb-3">
                <i class="bi bi-bank fs-4"></i>
              </div>
              <h5 class="fw-bold mb-2 card-title-app">iBAS++ Analyser</h5>
              <p class="text-muted small mb-0">
                Cross-verify government treasury deposits, VDS deductions at source, and office-wise reconciliation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Modules Deep Dive Section -->
    <section id="modules" class="py-5">
      <div class="container-xxl py-4">
        <div class="row align-items-center g-5">
          <div class="col-lg-6">
            <span class="badge bg-info bg-opacity-10 text-info rounded-pill px-3 py-2 fw-semibold mb-2">Data Intelligence</span>
            <h2 class="display-6 fw-bold mb-4 section-heading">60-Month Grid & Non-Filer Tracking</h2>
            <p class="text-muted mb-4">
              Our continuous timeline engine tracks 5 years of return submissions month by month, pinpointing habitual defaulters and seasonal filing gaps effortlessly.
            </p>

            <ul class="list-unstyled d-flex flex-column gap-3 mb-4">
              <li class="d-flex align-items-start gap-3">
                <i class="bi bi-check2-circle text-primary fs-5 mt-1 flex-shrink-0"></i>
                <div>
                  <strong class="d-block text-app">Automated Non-Filer Lists</strong>
                  <span class="text-muted small">Generate circle-wise demand notices and non-filer rosters with one click.</span>
                </div>
              </li>
              <li class="d-flex align-items-start gap-3">
                <i class="bi bi-check2-circle text-primary fs-5 mt-1 flex-shrink-0"></i>
                <div>
                  <strong class="d-block text-app">Year-over-Year (YoY) Growth</strong>
                  <span class="text-muted small">Compare fiscal performance across FY 2020-21 through FY 2025-26.</span>
                </div>
              </li>
              <li class="d-flex align-items-start gap-3">
                <i class="bi bi-check2-circle text-primary fs-5 mt-1 flex-shrink-0"></i>
                <div>
                  <strong class="d-block text-app">Duplicate Entity Detection</strong>
                  <span class="text-muted small">Identify duplicate registrations across circles and mismatched NID/TIN records.</span>
                </div>
              </li>
            </ul>

            <router-link :to="auth.isAuthenticated ? '/dashboard' : '/plans'" class="btn btn-primary rounded-pill px-4 py-2 fw-semibold">
              Get Started Now <i class="bi bi-arrow-right ms-1"></i>
            </router-link>
          </div>

          <div class="col-lg-6">
            <div class="p-4 rounded-4 shadow-sm feature-box-highlight">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0 fw-bold text-app"><i class="bi bi-grid-3x3-gap-fill text-primary me-2"></i> Tax Period Timeline Matrix (Sample)</h6>
                <span class="badge bg-primary bg-opacity-25 text-primary small">60 Months</span>
              </div>
              <div class="p-3 rounded matrix-container">
                <div class="d-flex flex-wrap gap-2 justify-content-center">
                  <span v-for="i in 36" :key="i" class="matrix-cell" :class="getMatrixClass(i)" :title="`Period ${i}`">
                    {{ i <= 12 ? '22' : i <= 24 ? '23' : '24' }}-{{ (i % 12 || 12).toString().padStart(2, '0') }}
                  </span>
                </div>
              </div>
              <div class="d-flex justify-content-around mt-3 small text-muted">
                <span><span class="status-square bg-success"></span> Filed on Time</span>
                <span><span class="status-square bg-warning"></span> Delayed / Modified</span>
                <span><span class="status-square bg-danger"></span> Non-Filer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Section -->
    <section id="pricing" class="py-5 pricing-section border-top border-bottom border-custom">
      <div class="container-xxl py-4 text-center">
        <div class="mb-5">
          <span class="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-2 fw-semibold mb-2">Subscription Plans</span>
          <h2 class="display-6 fw-bold mb-3 section-heading">Choose the Right Plan for You</h2>
          <p class="text-muted mx-auto" style="max-width: 600px;">
            Get advanced insights into BIN, Entities, and Area data with transparent, flexible pricing.
          </p>
        </div>

        <!-- Loading / Error -->
        <div v-if="loadingPlans" class="my-5 py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading plans...</span>
          </div>
        </div>
        <div v-else-if="plansError" class="alert alert-danger mx-auto my-4" style="max-width: 500px;">
          {{ plansError }}
        </div>

        <!-- Pricing Cards Grid -->
        <div v-else class="row justify-content-center g-4">
          <div 
            v-for="plan in displayedPlans" 
            :key="plan.id" 
            class="col-12 col-md-6 col-lg-4 col-xl-3"
          >
            <div class="card h-100 pricing-card shadow-sm">
              <div class="card-body d-flex flex-column p-4 text-start">
                <h4 class="card-title fw-bold text-info mb-3 text-truncate">{{ plan.name }}</h4>
                <div class="price-box mb-4">
                  <span class="fs-5 fw-bold price-amount align-top mt-1">৳</span><span class="fs-3 fw-bold price-amount">{{ plan.price }}</span>
                  <span class="text-muted small ms-1" v-if="plan.durationDays">/ {{ plan.durationDays }} Days</span>
                </div>
                <ul class="list-unstyled mb-4 flex-grow-1 feature-list">
                  <li class="mb-2 d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                    <span>Duration: <strong>{{ plan.durationDays }} Days</strong></span>
                  </li>
                  <li class="mb-2 d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                    <span>Max Circles: <strong>{{ plan.maxCircles >= 9999 ? 'Unlimited' : plan.maxCircles }}</strong></span>
                  </li>
                  <li class="mb-2 d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                    <span>Access to All Modules</span>
                  </li>
                  <li class="mb-2 d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2 flex-shrink-0"></i> 
                    <span>Interactive Reports</span>
                  </li>
                </ul>

                <template v-if="auth.isAuthenticated">
                  <router-link to="/my-subscriptions" class="btn btn-outline-info w-100 fw-bold mt-auto rounded-3 py-2">
                    Choose Plan
                  </router-link>
                </template>
                <template v-else>
                  <router-link :to="`/register?planId=${plan.id}`" class="btn btn-outline-info w-100 fw-bold mt-auto rounded-3 py-2">
                    Choose Plan
                  </router-link>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5">
          <router-link to="/plans" class="text-info text-decoration-none fw-semibold">
            View All Subscription Details & Offices <i class="bi bi-chevron-right"></i>
          </router-link>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section id="faq" class="py-5">
      <div class="container-xxl py-4" style="max-width: 800px;">
        <div class="text-center mb-5">
          <span class="badge bg-warning bg-opacity-10 text-warning rounded-pill px-3 py-2 fw-semibold mb-2">Got Questions?</span>
          <h2 class="display-6 fw-bold mb-3 section-heading">Frequently Asked Questions</h2>
        </div>

        <div class="accordion" id="landingFaqAccordion">
          <div class="accordion-item faq-item mb-3 rounded border border-custom">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed fw-bold text-app" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                How does the 21-factor VAT Risk Engine work?
              </button>
            </h2>
            <div id="faq1" class="accordion-collapse collapse" data-bs-parent="#landingFaqAccordion">
              <div class="accordion-body text-muted small">
                The engine automatically checks 21 automated risk criteria including input-output ratio variances, sudden changes in payable VAT, prolonged zero-filing, VDS non-deposit risks, and inter-circle duplicate transactions.
              </div>
            </div>
          </div>

          <div class="accordion-item faq-item mb-3 rounded border border-custom">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed fw-bold text-app" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                Can I upload Excel / CSV files directly from VAT Online System (VOS)?
              </button>
            </h2>
            <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#landingFaqAccordion">
              <div class="accordion-body text-muted small">
                Yes! The system natively accepts VOS standard exports (.xlsx, .csv) for BIN master lists and Return data, with smart automatic header mapping.
              </div>
            </div>
          </div>

          <div class="accordion-item faq-item mb-3 rounded border border-custom">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed fw-bold text-app" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                How do I get started with a subscription plan?
              </button>
            </h2>
            <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#landingFaqAccordion">
              <div class="accordion-body text-muted small">
                Click on "Choose Plan" for your required package, fill in your office details and complete the registration. An administrator will verify and activate your access instantly.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA Banner -->
    <section class="py-5 bg-primary bg-opacity-10 border-top border-custom text-center">
      <div class="container-xxl py-4">
        <h2 class="fw-bold mb-3 section-heading">Ready to streamline your VAT audits?</h2>
        <p class="text-muted mx-auto mb-4" style="max-width: 550px;">
          Join tax professionals and revenue officers using Analyser for real-time compliance insights.
        </p>
        <div class="d-flex justify-content-center gap-3">
          <router-link :to="auth.isAuthenticated ? '/dashboard' : '/plans'" class="btn btn-primary rounded-pill px-4 py-2 fw-bold shadow-sm">
            {{ auth.isAuthenticated ? 'Go to Dashboard' : 'Choose a Plan' }}
          </router-link>
          <router-link v-if="!auth.isAuthenticated" to="/login" class="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold text-app">
            Sign In
          </router-link>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer py-4 border-top border-custom text-center small text-muted">
      <div class="container-xxl d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
        <div class="d-flex align-items-center gap-2">
          <AppLogo icon-size="1.2rem" text-size="0.95rem" />
        </div>
        <span>© {{ new Date().getFullYear() }} Analyser. All rights reserved. Intelligent Data Insights Platform.</span>
        <div class="d-flex gap-3">
          <a href="#features" class="text-muted text-decoration-none hover-app">Features</a>
          <a href="#pricing" class="text-muted text-decoration-none hover-app">Pricing</a>
          <router-link to="/login" class="text-muted text-decoration-none hover-app">Login</router-link>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useHead } from '@vueuse/head';
import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';
import { useAdminUiStore } from '@/stores/admin-ui';
import axios from '@/plugins/axios';

useHead({
  title: 'Analyser - Intelligent VAT & Revenue Insights Platform',
  meta: [
    { name: 'description', content: 'Comprehensive VAT and Return Data Auditing Platform for Bangladesh Revenue Offices.' }
  ]
});

const auth = useAuthStore();
const ui = useAdminUiStore();
const isScrolled = ref(false);
const loadingPlans = ref(true);
const plansError = ref('');
const rawPlans = ref<any[]>([]);

const handleScroll = () => {
  isScrolled.value = window.scrollY > 30;
};

const fetchPublicPlans = async () => {
  loadingPlans.value = true;
  plansError.value = '';
  try {
    const res = await axios.get('/api/plans');
    const data = res.data.data || res.data || [];
    rawPlans.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error('Failed to load plans:', err);
    plansError.value = 'Failed to load pricing plans.';
  } finally {
    loadingPlans.value = false;
  }
};

const displayedPlans = computed(() => {
  if (!rawPlans.value || rawPlans.value.length === 0) {
    return [
      { id: 1, name: 'Basic Plan', price: 500, durationDays: 30, maxCircles: 1, isActive: true },
      { id: 2, name: 'Standard Plan', price: 1000, durationDays: 30, maxCircles: 3, isActive: true },
      { id: 3, name: 'Premium Plan', price: 2000, durationDays: 30, maxCircles: 9999, isActive: true }
    ];
  }
  const activeOnly = rawPlans.value.filter((p: any) => p.isActive !== false);
  const list = activeOnly.length > 0 ? activeOnly : rawPlans.value;
  return [...list].sort((a: any, b: any) => a.price - b.price);
});

const getMatrixClass = (i: number) => {
  if (i % 7 === 0) return 'cell-danger';
  if (i % 5 === 0) return 'cell-warning';
  return 'cell-success';
};

onMounted(() => {
  ui.initTheme();
  window.addEventListener('scroll', handleScroll);
  fetchPublicPlans();
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped lang="scss">
.landing-page {
  background-color: var(--app-bg, #0b0f19);
  color: var(--app-text, #f8f9fa);
  transition: background-color 0.2s ease, color 0.2s ease;
  font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
  width: 100%;
  max-width: 100vw;
  position: relative;
}

.landing-nav {
  background-color: var(--app-surface, rgba(33, 37, 41, 0.95));
  border-bottom: 1px solid var(--app-border, rgba(255, 255, 255, 0.12));
  backdrop-filter: blur(10px);
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  z-index: 1050;
}

.nav-link-item {
  color: var(--app-text-muted, #9aa0a6);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.92rem;
  transition: color 0.15s ease;

  &:hover {
    color: var(--app-primary, #3b8eed);
  }
}

.theme-toggle-btn {
  color: var(--app-text, #f8f9fa);
  transition: transform 0.15s ease, opacity 0.15s ease;

  &:hover {
    transform: scale(1.1);
    opacity: 0.85;
  }
}

.text-app {
  color: var(--app-text, inherit) !important;
  border-color: var(--app-border, #6c757d) !important;

  &:hover {
    background-color: var(--app-hover, rgba(255, 255, 255, 0.08));
    color: var(--app-text, #ffffff) !important;
  }
}

.hero-section {
  background: radial-gradient(circle at 80% 20%, rgba(59, 142, 237, 0.08) 0%, transparent 60%);
}

.hero-badge {
  background-color: var(--app-surface, #212529);
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.15));
  color: var(--app-text, #f8f9fa);
}

.hero-headline {
  color: var(--app-text, #ffffff);
  line-height: 1.15;
}

.text-gradient {
  background: linear-gradient(135deg, #3b8eed 0%, #0dcaf0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-preview-card {
  background-color: var(--app-surface, #212529);
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.15));
  border-radius: 1rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dot-red { background: #dc3545; }
.dot-yellow { background: #ffc107; }
.dot-green { background: #198754; }

.metric-box {
  background-color: var(--app-bg, rgba(0, 0, 0, 0.2));
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.08));
}

.risk-preview-box {
  background-color: var(--app-bg, rgba(0, 0, 0, 0.2));
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.08));
}

.border-custom {
  border-color: var(--app-border, rgba(255, 255, 255, 0.12)) !important;
}

.feature-section, .pricing-section {
  background-color: var(--app-surface, #212529);
}

.section-heading {
  color: var(--app-text, #ffffff);
}

.feature-card {
  background-color: var(--app-bg, #1a1d20);
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.1));
  border-radius: 0.85rem;
  transition: transform 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-5px);
    border-color: var(--app-primary, #3b8eed);
  }
}

.card-title-app {
  color: var(--app-text, #ffffff);
}

.icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-box-highlight {
  background-color: var(--app-surface, #212529);
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.12));
}

.matrix-container {
  background-color: var(--app-bg, #111317);
  border: 1px solid var(--app-border, rgba(255, 255, 255, 0.08));
}

.matrix-cell {
  font-size: 0.72rem;
  padding: 3px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 600;
}
.cell-success { background: rgba(25, 135, 84, 0.18); color: #20c997; border: 1px solid rgba(25, 135, 84, 0.3); }
.cell-warning { background: rgba(255, 193, 7, 0.18); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.3); }
.cell-danger { background: rgba(220, 53, 69, 0.18); color: #ea868f; border: 1px solid rgba(220, 53, 69, 0.3); }

.status-square {
  width: 10px;
  height: 10px;
  display: inline-block;
  border-radius: 2px;
  margin-right: 4px;
}

.pricing-card {
  background-color: var(--app-bg, #1a1d20);
  border: 2px solid var(--app-border, rgba(255, 255, 255, 0.15)) !important;
  border-radius: 0.85rem;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  &:hover {
    transform: translateY(-8px);
    border-color: #0dcaf0 !important;
    box-shadow: 0 1rem 2.5rem rgba(13, 202, 240, 0.18) !important;
  }
}

.price-amount {
  color: var(--app-text, #ffffff);
}

.feature-list li {
  font-size: 0.92rem;
  color: var(--app-text, #e9ecef);
}

.faq-item {
  background-color: var(--app-surface, #212529) !important;
}

.faq-item .accordion-button {
  background-color: var(--app-surface, #212529) !important;
  color: var(--app-text, #ffffff) !important;
  box-shadow: none !important;

  &:not(.collapsed) {
    color: var(--app-primary, #3b8eed) !important;
    border-bottom: 1px solid var(--app-border, rgba(255, 255, 255, 0.1));
  }
}

.landing-footer {
  background-color: var(--app-surface, #212529);
}

.hover-app:hover {
  color: var(--app-text, #ffffff) !important;
}
</style>
