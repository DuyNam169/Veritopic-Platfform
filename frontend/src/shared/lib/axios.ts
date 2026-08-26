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
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push(() => resolve(api(originalRequest)));
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem("refresh_token");

      try {
        const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/login/refresh/`, {
          refresh: refreshToken,
        });
        localStorage.setItem("access_token", data.access);
        pendingRequests.forEach((cb) => cb());
        pendingRequests = [];
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
