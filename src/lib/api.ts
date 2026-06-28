import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

const ACCESS = "hearth_access";
const REFRESH = "hearth_refresh";

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS, access);
  if (refresh) localStorage.setItem(REFRESH, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}
export function getAccess() {
  return localStorage.getItem(ACCESS);
}

api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const refresh = localStorage.getItem(REFRESH);
    if (error.response?.status === 401 && refresh && !original._retry) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          axios
            .post("/api/auth/token/refresh/", { refresh })
            .then((res) => {
              setTokens(res.data.access);
              return res.data.access as string;
            })
            .finally(() => {
              refreshing = null;
            });
        const newAccess = await refreshing;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        clearTokens();
      }
    }
    return Promise.reject(error);
  },
);
