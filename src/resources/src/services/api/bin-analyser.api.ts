import axios from "@/plugins/axios";

export interface BinQueryFilters {
  status?: string;
  forcedRegistration?: string;
  reg?: string;
  majorArea?: string;
  manufacturingArea?: string;
  serviceArea?: string;
  circle?: string;
  policeStations?: string;
  year?: string;
  fromDate?: string;
  toDate?: string;
  q?: string;
  page?: number;
  limit?: number;
  trendBy?: 'year' | 'month' | 'day';
  fullDetails?: boolean;
}

export const binApi = {
  /**
   * Upload & parse Excel file for BIN Analyser
   */
  async parse(formData: FormData, onUploadProgress?: (progressEvent: any) => void) {
    const res = await axios.post("/api/bin-analyser/parse", formData, {
      timeout: 180000,
      onUploadProgress,
    });
    return res.data;
  },

  /**
   * Save a chunk of parsed BIN records to the database
   */
  async save(data: any[]) {
    const res = await axios.post("/api/bin-analyser/save", { data });
    return res.data;
  },

  /**
   * Delete BIN data (admin: all or by circle; user: own uploads)
   */
  async deleteAll(circle?: string) {
    const res = await axios.delete("/api/bin-analyser/delete", {
      params: circle ? { circle } : undefined,
    });
    return res.data;
  },

  /**
   * Fetch paginated list of BIN data
   */
  async getList(params?: BinQueryFilters) {
    const res = await axios.get("/api/bin-analyser/list", { params });
    return res.data;
  },

  /**
   * Fetch filter options (circles, statuses, areas, years)
   */
  async getFilters(params?: { circle?: string }) {
    const res = await axios.get("/api/bin-analyser/filters", { params });
    return res.data;
  },

  /**
   * Fetch dashboard statistics and chart data
   */
  async getAllStats(params?: BinQueryFilters) {
    const res = await axios.get("/api/bin-analyser/dashboard/all-stats", { params });
    return res.data;
  },

  /**
   * Drilldown pivot table records
   */
  async getDrilldownPivot(params: { majorArea?: string; columnType?: string; [key: string]: any }) {
    const res = await axios.get("/api/bin-analyser/dashboard/drilldown/pivot", { params });
    return res.data;
  },

  /**
   * Area comparison (manufacturing, service, or major activity)
   */
  async getComparison(type: "manufacturing" | "service" | "major", params?: BinQueryFilters) {
    const res = await axios.get(`/api/bin-analyser/dashboard/comparison/${type}`, { params });
    return res.data;
  },

  /**
   * Quick search for entities
   */
  async search(params?: BinQueryFilters) {
    const res = await axios.get("/api/bin-analyser/search", { params });
    return res.data;
  },

  /**
   * Find duplicate records by mobile
   */
  async getDuplicates(params?: BinQueryFilters) {
    const res = await axios.get("/api/bin-analyser/duplicates", { params });
    return res.data;
  },

  /**
   * Download CSV export
   */
  async exportData(params?: BinQueryFilters) {
    const res = await axios.get("/api/bin-analyser/export", {
      params,
      responseType: "blob",
    });
    return res.data;
  },
};

export default binApi;
