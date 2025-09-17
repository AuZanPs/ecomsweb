import React, { useState } from 'react';

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  description?: string;
  stock: number;
  category?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string) => void;
  onToggleFavorite?: (productId: string) => void;
  isLiked?: boolean;
  className?: string;
}

// Heart icon SVG for like button
const HeartIcon: React.FC<{ filled?: boolean }> = ({ filled = false }) => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill={filled ? "#ef4444" : "none"} 
    stroke={filled ? "#ef4444" : "#909090"} 
    strokeWidth="2"
    className="transition-colors duration-200"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleFavorite,
  isLiked = false,
  className = ""
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = () => {
    if (onAddToCart && product.stock > 0) {
      onAddToCart(product._id);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(product._id);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const productImage = product.images && product.images.length > 0 
    ? product.images[0] 
    : '/placeholder-product.png';

  return (
    <div 
      className={`bg-[#f6f6f6] border border-gray-200 rounded-[9px] p-4 pb-6 flex flex-col items-center gap-4 hover:shadow-lg transition-shadow duration-200 relative ${className}`}
    >
      {/* Like Button */}
      <div className="flex justify-end w-full">
        <button
          onClick={handleToggleFavorite}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors duration-200"
          aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
        >
          <HeartIcon filled={isLiked} />
        </button>
      </div>

      {/* Product Image */}
      <div className="relative w-40 h-40 mb-2">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gray-300 animate-pulse rounded-lg flex items-center justify-center">
            <div className="text-gray-500 text-sm">Loading...</div>
          </div>
        )}
        {imageError ? (
          <div className="absolute inset-0 bg-gray-300 rounded-lg flex items-center justify-center">
            <div className="text-gray-500 text-sm text-center">
              <div>No Image</div>
              <div>Available</div>
            </div>
          </div>
        ) : (
          <img
            src={productImage}
            alt={product.name}
            className={`w-full h-full object-cover rounded-lg transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
          />
        )}
        
        {/* Stock indicator */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
            <span className="text-white font-medium text-sm">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="text-center space-y-4">
          {/* Product Name */}
          <h3 className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[24px] text-[#17183b] line-clamp-2">
            {product.name}
          </h3>

          {/* Price */}
          <p className="font-['SF_Pro_Display',_sans-serif] font-semibold text-[24px] leading-[24px] tracking-[0.72px] text-[#17183b]">
            {formatPrice(product.price)}
          </p>
        </div>

        {/* Buy Now Button */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className={`
            w-full px-16 py-3 rounded-[8px] font-['SF_Pro_Display',_sans-serif] font-medium text-[14px] leading-[24px] text-center transition-all duration-200
            ${product.stock > 0 
              ? 'bg-[#17183b] text-white hover:bg-[#232447] active:bg-[#0f1020]' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;