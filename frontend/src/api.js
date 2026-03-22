import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api', // Connection to eTMF Node.js server
});

// Request Interceptor: Attach JWT Token & Tenant ID dynamically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('etmf_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Hardcode tenant for dev unless multi-tenant context dictates otherwise
    config.headers['X-Tenant-ID'] = 'tenant-001'; 
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto-logout if token expires
      localStorage.removeItem('etmf_token');
      localStorage.removeItem('etmf_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
