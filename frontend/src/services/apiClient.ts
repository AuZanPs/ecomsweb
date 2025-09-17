import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with base configuration
const baseURL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth';
    }
    
    // Handle network errors
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const api = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),
    register: (email: string, password: string, name: string) =>
      apiClient.post('/auth/register', { email, password, name }),
    getProfile: () => apiClient.get('/auth/profile'),
    updateProfile: (data: any) => apiClient.put('/auth/profile', data),
  },

  // Product endpoints
  products: {
    getAll: (params?: any) => apiClient.get('/products', { params }),
    getById: (id: string) => apiClient.get(`/products/${id}`),
    search: (query: string, params?: any) =>
      apiClient.get('/products/search', { params: { query, ...params } }),
    getFeatured: (limit?: number) =>
      apiClient.get('/products/featured', { params: { limit } }),
    getTopSelling: (limit?: number) =>
      apiClient.get('/products/top-selling', { params: { limit } }),
    getByPriceRange: (minPrice: number, maxPrice: number) =>
      apiClient.get('/products/price-range', { params: { minPrice, maxPrice } }),
  },

  // Cart endpoints
  cart: {
    get: () => apiClient.get('/cart'),
    add: (productId: string, quantity: number) =>
      apiClient.post('/cart/add', { productId, quantity }),
    update: (productId: string, quantity: number) =>
      apiClient.put('/cart/update', { productId, quantity }),
    remove: (productId: string) => apiClient.delete(`/cart/${productId}`),
    clear: () => apiClient.delete('/cart/clear'),
    validate: () => apiClient.get('/cart/validate'),
  },

  // Checkout endpoints
  checkout: {
    validate: () => apiClient.get('/checkout/validate'),
    initiate: (data: any) => apiClient.post('/checkout/initiate', data),
    confirm: (data: any) => apiClient.post('/checkout/confirm', data),
    calculateTotal: (shippingAddress: any) =>
      apiClient.post('/checkout/calculate-total', { shippingAddress }),
    cancel: (orderId: string, reason: string) =>
      apiClient.post('/checkout/cancel', { orderId, reason }),
    express: (data: any) => apiClient.post('/checkout/express', data),
  },

  // Order endpoints
  orders: {
    getAll: (params?: any) => apiClient.get('/orders', { params }),
    getById: (id: string) => apiClient.get(`/orders/${id}`),
    cancel: (id: string, reason?: string) =>
      apiClient.put(`/orders/${id}/cancel`, { reason }),
    getStatistics: () => apiClient.get('/orders/statistics'),
    getByStatus: (status: string) => apiClient.get(`/orders/status/${status}`),
    getTracking: (orderNumber: string) =>
      apiClient.get(`/orders/tracking/${orderNumber}`),
  },
};

export default apiClient;
