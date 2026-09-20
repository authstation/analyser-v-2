import { defineStore } from 'pinia';
import axios from '@/plugins/axios';

const API_BASE = '/api/bin-analyser';

export const useDataStore = defineStore('data', {
  state: () => ({
    parsedData: [] as any[],
    isDataLoaded: false,
    meta: {
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 1
    },
    availableCircles: [] as string[],
    availablePoliceStations: [] as string[],
    availableStatuses: [] as string[],
    availableForcedRegistrations: [] as string[],
    availableYears: [] as string[],
    loading: false,
    filtersLoaded: false
  }),
  actions: {
    async fetchFilters(circle?: string) {
      try {
        
        const url = circle && circle !== 'All' 
          ? `${API_BASE}/filters?circle=${encodeURIComponent(circle)}` 
          : `${API_BASE}/filters`;
        const res = await axios.get(url);
        if (res.data) {
          if (res.data.total !== undefined) {
            this.meta.total = res.data.total;
          }
          this.availableCircles = res.data.circles || [];
          this.availablePoliceStations = res.data.policeStations || [];
          this.availableStatuses = res.data.statuses || [];
          this.availableForcedRegistrations = res.data.forcedRegistrations || [];
          this.availableYears = res.data.years || [];
          this.filtersLoaded = true;
        }
      } catch (error) {
        console.error('Failed to fetch filters', error);
      }
    },
    async fetchBinList(page: number = 1, limit: number = 50, filters: any = {}) {
      this.loading = true;
      try {
        
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit)
        });

        if (filters.status && filters.status !== 'All') queryParams.append('status', filters.status);
        if (filters.forcedRegistration && filters.forcedRegistration !== 'All') queryParams.append('forcedRegistration', filters.forcedRegistration);
        if (filters.majorArea && filters.majorArea !== 'All') queryParams.append('majorArea', filters.majorArea);
        if (filters.manufacturingArea && filters.manufacturingArea !== 'All') queryParams.append('manufacturingArea', filters.manufacturingArea);
        if (filters.serviceArea && filters.serviceArea !== 'All') queryParams.append('serviceArea', filters.serviceArea);
        if (filters.circle && filters.circle !== 'All') queryParams.append('circle', filters.circle);
        if (filters.year && filters.year !== 'All') queryParams.append('year', filters.year);
        if (filters.q) queryParams.append('q', filters.q);
        if (filters.policeStations && filters.policeStations.length > 0) {
          queryParams.append('policeStations', filters.policeStations.join(','));
        }

        const res = await axios.get(`${API_BASE}/list?${queryParams.toString()}`);
        
        if (res.data && res.data.data) {
          this.parsedData = res.data.data;
          this.meta = res.data.meta;
          this.isDataLoaded = true;
        }
        
        // Also sync filters in background when fetching the list
        this.fetchFilters(filters.circle);
        
      } catch (error) {
        console.error('Failed to fetch BIN list', error);
        this.parsedData = [];
      } finally {
        this.loading = false;
      }
    },
    clearData() {
      this.parsedData = [];
      this.isDataLoaded = false;
      this.meta = { total: 0, page: 1, limit: 50, totalPages: 1 };
      this.availableCircles = [];
      this.availablePoliceStations = [];
      this.availableYears = [];
    }
  }
});

