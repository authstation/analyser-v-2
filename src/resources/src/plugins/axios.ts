import axios from "axios";

const envApiUrl = import.meta.env.VITE_API_URL;
if (envApiUrl && (envApiUrl.startsWith("http://") || envApiUrl.startsWith("https://"))) {
  axios.defaults.baseURL = envApiUrl.replace(/\/api\/?$/, "");
}

axios.defaults.withCredentials = true;
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
axios.defaults.headers.common.Accept = "application/json";

axios.interceptors.request.use((config) => {
  if (typeof localStorage !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const isAuthPage =
      window.location.pathname === "/register" ||
      window.location.pathname === "/login" ||
      window.location.pathname === "/forget-password" ||
      window.location.pathname === "/reset-password" ||
      window.location.pathname === "/verify-email";

    // Attempt silent token refresh on 401 (if not an auth request and not already retried)
    if (status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/api/auth/")) {
      const refreshToken = localStorage.getItem("refresh_token");

      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers["Authorization"] = `Bearer ${token}`;
              return axios(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const res = await axios.post("/api/auth/refresh-token", {
            refresh_token: refreshToken
          });

          const newAccessToken = res.data?.data?.access_token || res.data?.access_token;
          const newRefreshToken = res.data?.data?.refresh_token || res.data?.refresh_token;

          if (newAccessToken) {
            localStorage.setItem("access_token", newAccessToken);
            if (newRefreshToken) localStorage.setItem("refresh_token", newRefreshToken);

            originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
            processQueue(null, newAccessToken);
            return axios(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          if (!isAuthPage) {
            const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
            window.location.href = `/login?redirect=${redirect}`;
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }
    }

    if ((status === 401 || (status === 403 && error?.response?.data?.message?.includes("inactive"))) && !isAuthPage) {
      const configUrl = error?.config?.url || "";
      if (!configUrl.includes("/api/auth/me") && !configUrl.includes("/api/auth/refresh-token")) {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        window.location.href = `/login?redirect=${redirect}`;
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
