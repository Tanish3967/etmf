import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3002/api', // Connection to eTMF Node.js server
});

/**
 * Extracts tenant identifier dynamically from JWT claims.
 * Eliminates hardcoded multi-tenancy headers in compliance with Part 11 isolation.
 */
export function extractTenantFromJwt(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.tenant || payload.tenantId || payload.tenant_id || null;
  } catch {
    return null;
  }
}

// Request Interceptor: Attach JWT Token & Dynamically Derived Tenant ID
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('etmf_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        const tenant = extractTenantFromJwt(token);
        if (tenant) {
          config.headers['X-Tenant-ID'] = tenant;
        } else {
          delete config.headers['X-Tenant-ID'];
        }
      } else {
        delete config.headers['X-Tenant-ID'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized globally (excluding in-modal e-signature failures)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Exclude workflow e-signature credential verification errors from session eviction
      if (error.response?.data?.code === 'ESIG_FAILED') {
        return Promise.reject(error);
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('etmf_token');
        localStorage.removeItem('etmf_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
