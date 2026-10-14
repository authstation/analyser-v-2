import axios from "@/plugins/axios";

export const authApi = {
  async login(credentials: { email?: string; username?: string; password?: string }) {
    const res = await axios.post("/api/auth/login", credentials);
    return res.data;
  },

  async register(data: { name: string; email: string; password?: string; [key: string]: any }) {
    const res = await axios.post("/api/auth/register", data);
    return res.data;
  },

  async logout() {
    const res = await axios.post("/api/auth/logout");
    return res.data;
  },

  async getMe() {
    const res = await axios.get("/api/auth/me");
    return res.data;
  },

  async forgotPassword(email: string) {
    const res = await axios.post("/api/auth/forget-password", { email });
    return res.data;
  },

  async resetPassword(data: { token: string; password: string; passwordConfirmation: string }) {
    const res = await axios.post("/api/auth/reset-password", data);
    return res.data;
  },

  async verifyEmail(token: string) {
    const res = await axios.post("/api/auth/verify-email", { token });
    return res.data;
  },
};

export default authApi;
