import axios from "axios";
import { defineStore } from "pinia";
import { ref } from "vue";
import { type AuthUser, clearUser, setUser } from "@/composables/useAuth";

type LoginPayload = { email: string; password: string; remember?: boolean };
type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};
type VerifyEmailPayload = { email: string; token: string };
type ForgotPayload = { email: string };
type ResetPayload = {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
};

type ApiResponse<T> = { message: string; data?: T };
type AuthData = { user: AuthUser };

async function request<T>(method: "GET" | "POST", path: string, payload?: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await axios.request<ApiResponse<T>>({
      method,
      url: `/api/auth${path}`,
      data: payload
    });

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw new Error(String(error.response?.data?.message || error.message || "Request failed"));
    }
    throw new Error("Request failed");
  }
}

const MAX_BOOTSTRAP_ATTEMPTS = 5;
const BOOTSTRAP_BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STORED_USER_KEY = "auth_user";

function loadStoredUser(): AuthUser | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORED_USER_KEY) : null;
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const initial = loadStoredUser();
  const user = ref<AuthUser | null>(initial);
  const isAuthenticated = ref(!!initial);
  const processing = ref(false);
  const initialized = ref(false);

  if (initial) {
    setUser(initial);
  }

  const syncUser = (value: AuthUser | null) => {
    user.value = value;
    isAuthenticated.value = !!value;
    if (value) {
      setUser(value);
      try {
        localStorage.setItem(STORED_USER_KEY, JSON.stringify(value));
      } catch {}
    } else {
      clearUser();
      try {
        localStorage.removeItem(STORED_USER_KEY);
      } catch {}
    }
  };

  const bootstrap = async (forceRefresh = false) => {
    if (initialized.value && !forceRefresh) return;

    for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt++) {
      try {
        const response = await axios.get<ApiResponse<AuthUser>>("/api/auth/me");
        syncUser((response.data?.data || null) as AuthUser | null);
        break;
      } catch (error) {
        const backendUnreachable = axios.isAxiosError(error) && !error.response;
        if (!backendUnreachable || attempt === MAX_BOOTSTRAP_ATTEMPTS) {
          syncUser(null);
          break;
        }
        await sleep(BOOTSTRAP_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }

    initialized.value = true;
  };

  const login = async (payload: LoginPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/login", payload);
      syncUser((data?.data?.user || null) as AuthUser | null);
      initialized.value = true;
      return data.message || "Login successful";
    } finally {
      processing.value = false;
    }
  };

  const register = async (payload: RegisterPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/register", payload);
      const createdUser = (data?.data?.user || null) as AuthUser | null;
      if (createdUser) {
        syncUser(createdUser);
        initialized.value = true;
      } else {
        syncUser(null);
      }
      return data.message || "Registration successful";
    } finally {
      processing.value = false;
    }
  };

  const verifyEmail = async (payload: VerifyEmailPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/verify-email", payload);
      return data.message || "Email verified successfully";
    } finally {
      processing.value = false;
    }
  };

  const forgotPassword = async (payload: ForgotPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/forgot-password", payload);
      return data.message || "If this email exists, a reset link has been sent";
    } finally {
      processing.value = false;
    }
  };

  const resetPassword = async (payload: ResetPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/reset-password", payload);
      return data.message || "Password reset successfully";
    } finally {
      processing.value = false;
    }
  };

  const logout = async () => {
    processing.value = true;
    try {
      await request<unknown>("POST", "/logout");
    } finally {
      syncUser(null);
      processing.value = false;
      initialized.value = false; // Reset so bootstrap() re-fetches after next login
    }
  };

  return {
    user,
    isAuthenticated,
    processing,
    initialized,
    bootstrap,
    register,
    login,
    forgotPassword,
    resetPassword,
    verifyEmail,
    logout
  };
});
