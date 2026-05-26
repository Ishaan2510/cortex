import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  // Required so the browser sends the httpOnly session cookie on cross-origin
  // requests. The cookie is set by /api/auth/login and consumed by the SSE
  // endpoint, which uses cookie auth because EventSource cannot send custom
  // Authorization headers.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;