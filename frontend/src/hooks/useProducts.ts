import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

// Product interface
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Product filters interface
interface ProductFilters {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  tags?: string[];
  sortBy?: 'name' | 'price' | 'rating' | 'newest' | 'oldest';
  sortOrder?: 'asc' | 'desc';
}

// Pagination interface
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Products response interface
interface ProductsResponse {
  products: Product[];
  pagination: Pagination;
}

// Use products hook return type
interface UseProductsReturn {
  products: Product[];
  pagination: Pagination;
  isLoading: boolean;
  error: string | null;
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  hasMore: boolean;
}

export function useProducts(initialFilters: ProductFilters = {}): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ProductFilters>(initialFilters);

  // Fetch products from API
  const fetchProducts = useCallback(async (page = 1, append = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      // Add pagination params
      params.append('page', page.toString());
      params.append('limit', pagination.limit.toString());

      // Add filter params
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.inStock !== undefined) params.append('inStock', filters.inStock.toString());
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag));
      }
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await apiClient.get(`/products?${params.toString()}`);
      const data: ProductsResponse = response.data;

      if (append) {
        setProducts(prev => [...prev, ...data.products]);
      } else {
        setProducts(data.products);
      }
      
      setPagination(data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch products');
      console.error('Products fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.limit]);

  // Set filters and fetch products
  const setFilters = useCallback((newFilters: ProductFilters) => {
    setFiltersState(newFilters);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Load more products (pagination)
  const loadMore = useCallback(async () => {
    if (pagination.page < pagination.totalPages) {
      const nextPage = pagination.page + 1;
      setPagination(prev => ({ ...prev, page: nextPage }));
      await fetchProducts(nextPage, true);
    }
  }, [pagination.page, pagination.totalPages, fetchProducts]);

  // Refresh products
  const refresh = useCallback(async () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    await fetchProducts(1, false);
  }, [fetchProducts]);

  // Check if there are more products to load
  const hasMore = pagination.page < pagination.totalPages;

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts(1, false);
  }, [filters]); // Remove fetchProducts from dependencies to prevent infinite loop

  return {
    products,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    loadMore,
    refresh,
    hasMore
  };
}

// Hook for fetching a single product
interface UseProductReturn {
  product: Product | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProduct(productId: string): UseProductReturn {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get(`/products/${productId}`);
      setProduct(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch product');
      console.error('Product fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  const refresh = useCallback(async () => {
    await fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  return {
    product,
    isLoading,
    error,
    refresh
  };
}

// Hook for product categories
interface UseProductCategoriesReturn {
  categories: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProductCategories(): UseProductCategoriesReturn {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get('/products/categories');
      setCategories(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch categories');
      console.error('Categories fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refresh
  };
}

// Hook for product search suggestions
interface UseProductSearchReturn {
  suggestions: string[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clearSuggestions: () => void;
}

export function useProductSearch(): UseProductSearchReturn {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get(`/products/search/suggestions?q=${encodeURIComponent(query)}`);
      setSuggestions(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch suggestions');
      console.error('Search suggestions error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    search,
    clearSuggestions
  };
}