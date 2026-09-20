import axios from "axios";

const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
if (envApiUrl && (envApiUrl.startsWith("http://") || envApiUrl.startsWith("https://"))) {
  axios.defaults.baseURL = envApiUrl.replace(/\/api\/?$/, "");
}

axios.defaults.withCredentials = true;
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
axios.defaults.headers.common.Accept = "application/json";

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isAuthPage =
      window.location.pathname === "/register" ||
      window.location.pathname === "/login" ||
      window.location.pathname === "/forget-password" ||
      window.location.pathname === "/reset-password" ||
      window.location.pathname === "/verify-email";

    if ((status === 401 || (status === 403 && error?.response?.data?.message?.includes("inactive"))) && !isAuthPage) {
      const configUrl = error?.config?.url || "";
      if (!configUrl.includes("/api/auth/me")) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        window.location.href = `/login?redirect=${redirect}`;
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
