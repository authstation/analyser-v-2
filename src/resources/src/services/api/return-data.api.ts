import axios from "@/plugins/axios";

export interface ReturnQueryFilters {
  circle?: string;
  major?: string;
  year?: string;
  fromDate?: string;
  toDate?: string;
  q?: string;
  page?: number;
  limit?: number;
  type?: string;
  field?: string;
  trendBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any;
}

export const returnDataApi = {
  /**
   * Fetch filter options for Return Data Analyser
   */
  async getFilterOptions() {
    const res = await axios.get("/api/return-data/filter-options");
    return res.data;
  },

  /**
   * Fetch high-level analytics & KPI metrics
   */
  async getAnalytics(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/analytics", { params });
    return res.data;
  },

  /**
   * Fetch Fiscal Year comparison report
   */
  async getFyComparison(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/fy-comparison", { params });
    return res.data;
  },

  /**
   * Fetch Year-on-Year comparison report
   */
  async getYearComparison(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/year-comparison", { params });
    return res.data;
  },

  /**
   * Fetch paginated list of returns
   */
  async getList(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/list", { params });
    return res.data;
  },

  /**
   * Fetch search suggestions / options
   */
  async getSearchOptions(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/search-options", { params });
    return res.data;
  },

  /**
   * Drilldown entities under specific criteria
   */
  async getDrilldownEntities(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/drilldown-entities", { params });
    return res.data;
  },

  /**
   * Fetch multi-year trend for a specific entity
   */
  async getEntityTrends(params: { bin?: string; entityName?: string; [key: string]: any }) {
    const res = await axios.get("/api/return-data/entity-trends", { params });
    return res.data;
  },

  /**
   * Fetch comprehensive 5-year audit & calculation details for an entity
   */
  async getEntityDetailsReport(params: { bin?: string; entityName?: string; [key: string]: any }) {
    const res = await axios.get("/api/return-data/entity-details-report", { params });
    return res.data;
  },

  /**
   * Fetch list of non-filing taxpayers
   */
  async getNonFilerList(params?: ReturnQueryFilters) {
    const res = await axios.get("/api/return-data/non-filer-list", { params });
    return res.data;
  },

  /**
   * Upload & parse Excel file
   */
  async parse(formData: FormData, onUploadProgress?: (progressEvent: any) => void) {
    const res = await axios.post("/api/return-data/parse", formData, {
      timeout: 180000,
      onUploadProgress,
    });
    return res.data;
  },

  /**
   * Save a chunk of parsed returns
   */
  async save(data: any[]) {
    const res = await axios.post("/api/return-data/save", { data });
    return res.data;
  },

  /**
   * Delete return data (all or by circle)
   */
  async deleteAll(circle?: string) {
    const res = await axios.delete("/api/return-data/delete-all", {
      params: circle ? { circle } : undefined,
    });
    return res.data;
  },
};

export default returnDataApi;
