import axios from "axios";

/**
 * Axios instance dùng chung toàn app.
 * - Tự gắn Access Token (JWT) vào header Authorization.
 * - Tự refresh token khi access token hết hạn (401), sau đó gọi lại request cũ.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token && !config.headers.Authorization && !config.url?.startsWith("/auth/login/")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  response => response,
  async error => {
    const request = error.config;
    const refresh = localStorage.getItem("refresh_token");
    if (error.response?.status !== 401 || !request || request._retry || !refresh || request.url?.startsWith("/auth/login/")) {
      return Promise.reject(error);
    }
    request._retry = true;
    if (!refreshPromise) {
      refreshPromise = axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/login/refresh/`, {refresh})
        .then(({data}) => {
          if (localStorage.getItem("refresh_token") !== refresh) throw new Error("Session changed");
          localStorage.setItem("access_token", data.access);
          return data.access as string;
        })
        .finally(() => { refreshPromise = null; });
    }
    try {
      const token = await refreshPromise;
      request.headers.Authorization = `Bearer ${token}`;
      return api(request);
    } catch (refreshError) {
      if (localStorage.getItem("refresh_token") === refresh) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  },
);
