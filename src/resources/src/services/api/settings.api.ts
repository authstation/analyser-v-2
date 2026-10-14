import axios from "@/plugins/axios";

export const settingsApi = {
  // --- Divisions ---
  async getDivisions() {
    const res = await axios.get("/api/settings/divisions");
    return res.data;
  },
  async createDivision(data: { name: string }) {
    const res = await axios.post("/api/settings/divisions", data);
    return res.data;
  },
  async updateDivision(id: number, data: { name: string }) {
    const res = await axios.put(`/api/settings/divisions/${id}`, data);
    return res.data;
  },
  async deleteDivision(id: number) {
    const res = await axios.delete(`/api/settings/divisions/${id}`);
    return res.data;
  },

  // --- Circles ---
  async getCircles(divisionId?: number) {
    const res = await axios.get("/api/settings/circles", {
      params: divisionId ? { divisionId } : undefined,
    });
    return res.data;
  },
  async createCircle(data: { name: string; divisionId: number }) {
    const res = await axios.post("/api/settings/circles", data);
    return res.data;
  },
  async updateCircle(id: number, data: { name: string; divisionId: number }) {
    const res = await axios.put(`/api/settings/circles/${id}`, data);
    return res.data;
  },
  async deleteCircle(id: number) {
    const res = await axios.delete(`/api/settings/circles/${id}`);
    return res.data;
  },

  // --- Penalty Rules ---
  async getPenaltyRules() {
    const res = await axios.get("/api/settings/penalty-rules");
    return res.data;
  },
  async updatePenaltyRules(rules: any[]) {
    const res = await axios.put("/api/settings/penalty-rules", { rules });
    return res.data;
  },

  // --- Validation Limits ---
  async getValidationLimits() {
    const res = await axios.get("/api/settings/validation-limits");
    return res.data;
  },
  async updateValidationLimits(limits: any[]) {
    const res = await axios.put("/api/settings/validation-limits", { limits });
    return res.data;
  },

  // --- Column Mappings ---
  async getColumnMappings(module?: string) {
    const res = await axios.get("/api/settings/column-mappings", {
      params: module ? { module } : undefined,
    });
    return res.data;
  },
  async updateColumnMappings(module: string, mappings: any[]) {
    const res = await axios.put(`/api/settings/column-mappings/${module}`, { mappings });
    return res.data;
  },

  // --- Item Mappings ---
  async getItemMappings() {
    const res = await axios.get("/api/settings/item-mappings");
    return res.data;
  },
  async updateItemMappings(mappings: any[]) {
    const res = await axios.put("/api/settings/item-mappings", { mappings });
    return res.data;
  },

  // --- IBAS Offices ---
  async getIbasOffices() {
    const res = await axios.get("/api/settings/ibas-offices");
    return res.data;
  },
  async updateIbasOffices(offices: any[]) {
    const res = await axios.put("/api/settings/ibas-offices", { offices });
    return res.data;
  },
};

export default settingsApi;
