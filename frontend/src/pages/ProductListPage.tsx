import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/apiClient';

interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  imageUrl?: string;
  featured: boolean;
  createdAt: string;
}

interface ProductListResponse {
  products: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface Filters {
  search: string;
  minPrice: string;
  maxPrice: string;
  sortBy: 'createdAt' | 'name' | 'price' | 'stock';
  sortOrder: 'asc' | 'desc';
}

// Figma-inspired Product Card Component
const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const formatPrice = (priceCents: number) => {
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  return (
    <div className="bg-[#f6f6f6] box-border content-stretch flex flex-col gap-[8px] items-center justify-start px-[12px] py-[24px] relative rounded-[9px] hover:shadow-lg transition-shadow duration-300">
      {/* Like button */}
      <div className="content-stretch flex gap-[8px] items-center justify-end relative shrink-0 w-full">
        <div className="relative shrink-0 size-[32px] cursor-pointer hover:opacity-70">
          <div className="absolute inset-[4.17%_4.17%_12.5%_4.17%]">
            <div className="absolute inset-[16.66%_5.84%_-1.93%_5.84%]">
              <svg className="block max-w-none size-full" viewBox="0 0 24 24" fill="none" stroke="rgba(144, 144, 144, 1)" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Product Image */}
      <div className="shrink-0 size-[104px] bg-center bg-cover bg-no-repeat rounded-lg overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xs">No Image</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="content-stretch flex flex-col gap-[16px] items-center justify-start relative shrink-0 w-full">
        <div className="content-stretch flex flex-col gap-[16px] items-start justify-start leading-[0] not-italic relative shrink-0 text-black text-center w-full">
          <div className="font-medium overflow-ellipsis overflow-hidden relative shrink-0 text-[16px] w-full line-clamp-2">
            <p className="leading-[24px]">{product.name}</p>
          </div>
          <div className="font-semibold relative shrink-0 text-[24px] tracking-[0.72px] w-full">
            <p className="leading-[24px]">{formatPrice(product.priceCents)}</p>
          </div>
        </div>
        
        {/* Stock status */}
        <div className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-600'} mb-2`}>
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
        </div>

        {/* Buy Now Button */}
        <Link
          to={`/products/${product.id}`}
          className="bg-black box-border content-stretch flex gap-[8px] items-center justify-center px-[64px] py-[12px] relative rounded-[8px] shrink-0 w-full text-white hover:bg-gray-800 transition-colors duration-200"
        >
          <div className="font-medium leading-[0] not-italic relative shrink-0 text-[14px] text-center text-nowrap">
            <p className="leading-[24px] whitespace-pre">View Details</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

// Category Card Component
const CategoryCard: React.FC<{ name: string; icon: React.ReactNode; active?: boolean; onClick?: () => void }> = ({ 
  name, 
  icon, 
  active = false, 
  onClick 
}) => (
  <div 
    onClick={onClick}
    className={`basis-0 box-border content-stretch flex flex-col gap-[8px] grow h-[128px] items-center justify-center min-h-px min-w-[135px] px-[52px] py-[24px] relative rounded-[15px] shrink-0 cursor-pointer hover:bg-gray-200 transition-colors duration-200 ${
      active ? 'bg-black text-white' : 'bg-[#ededed]'
    }`}
  >
    <div className="overflow-clip relative shrink-0 size-[48px]">
      {icon}
    </div>
    <div className={`font-medium leading-[0] not-italic relative shrink-0 text-[16px] text-center text-nowrap ${
      active ? 'text-white' : 'text-black'
    }`}>
      <p className="leading-[24px] whitespace-pre">{name}</p>
    </div>
  </div>
);

export const ProductListPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCategory, setActiveCategory] = useState('all');
  const [filters, setFilters] = useState<Filters>({
    search: '',
    minPrice: '',
    maxPrice: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: 12,
        search: filters.search || undefined,
        minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };

      const response = await api.products.getAll(params);
      const data: ProductListResponse = response.data;

      setProducts(data.products);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [currentPage, filters]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadProducts();
  };

  // Category icons (simplified SVG icons)
  const phoneIcon = (
    <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
      <rect x="14" y="4" width="20" height="40" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>
      <line x1="20" y1="38" x2="28" y2="38" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );

  const watchIcon = (
    <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
      <rect x="12" y="12" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  );

  const cameraIcon = (
    <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
      <rect x="8" y="16" width="32" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="24" cy="26" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
      <rect x="18" y="12" width="12" height="4" rx="2" fill="currentColor"/>
    </svg>
  );

  const headphoneIcon = (
    <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
      <path d="M24 8C15.2 8 8 15.2 8 24v8h4v-8c0-6.6 5.4-12 12-12s12 5.4 12 12v8h4v-8c0-8.8-7.2-16-16-16z" fill="currentColor"/>
      <rect x="6" y="28" width="8" height="12" rx="2" fill="currentColor"/>
      <rect x="34" y="28" width="8" height="12" rx="2" fill="currentColor"/>
    </svg>
  );

  const categories = [
    { id: 'all', name: 'All Products', icon: phoneIcon },
    { id: 'phones', name: 'Phones', icon: phoneIcon },
    { id: 'watches', name: 'Smart Watches', icon: watchIcon },
    { id: 'cameras', name: 'Cameras', icon: cameraIcon },
    { id: 'audio', name: 'Headphones', icon: headphoneIcon }
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white box-border content-stretch flex items-center justify-between px-[16px] py-[24px] border-b border-gray-200">
        <div className="h-[32px] w-[96px]">
          <h1 className="font-semibold text-[24px] text-black leading-[32px]">
            Products
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search products..."
              className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
            />
            <button
              onClick={() => loadProducts()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-[48px] items-start justify-start px-[16px] py-[64px]">
        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
          <div className="font-medium leading-[0] not-italic relative shrink-0 text-[24px] text-black tracking-[0.24px]">
            <p className="leading-[32px]">Browse By Category</p>
          </div>
        </div>
        
        <div className="content-start flex flex-wrap gap-[16px] items-start justify-start relative shrink-0 w-full">
          {categories.map(category => (
            <CategoryCard
              key={category.id}
              name={category.name}
              icon={category.icon}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            />
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white px-[16px] py-[32px] border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Price
                </label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  placeholder="$0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Price
                </label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  placeholder="$999"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="createdAt">Date Added</option>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="stock">Stock</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order
                </label>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({
                    search: '',
                    minPrice: '',
                    maxPrice: '',
                    sortBy: 'createdAt',
                    sortOrder: 'desc'
                  });
                  setCurrentPage(1);
                  setActiveCategory('all');
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Clear Filters
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mx-4 my-6">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {/* Products Section */}
      {!loading && !error && (
        <div className="bg-white box-border content-stretch flex flex-col gap-[32px] items-start justify-start px-[16px] py-[56px]">
          <div className="font-medium leading-[0] not-italic relative shrink-0 text-[24px] text-black text-center text-nowrap">
            <p className="leading-[32px] whitespace-pre">
              {activeCategory === 'all' ? 'All Products' : `${categories.find(c => c.id === activeCategory)?.name}`}
            </p>
          </div>
          
          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Empty State */}
          {products.length === 0 && (
            <div className="text-center py-12 w-full">
              <div className="text-gray-500 text-lg">No products found</div>
              <p className="text-gray-400 mt-2">Try adjusting your filters</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 w-full mt-8">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};