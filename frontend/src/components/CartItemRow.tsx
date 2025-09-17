import React from 'react';

interface CartItem {
  _id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  productSku?: string;
}

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: string, newQuantity: number) => void;
  onRemoveItem: (productId: string) => void;
  className?: string;
}

// Minus Icon SVG
const MinusIcon: React.FC = () => (
  <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
    <path d="M0 1H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Plus Icon SVG
const PlusIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 0V12M0 6H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Close Icon SVG
const CloseIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  onUpdateQuantity,
  onRemoveItem,
  className = ""
}) => {
  const handleIncrement = () => {
    onUpdateQuantity(item.productId, item.quantity + 1);
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.productId, item.quantity - 1);
    }
  };

  const handleRemove = () => {
    onRemoveItem(item.productId);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const totalPrice = item.price * item.quantity;

  return (
    <div className={`flex gap-4 items-center py-4 ${className}`}>
      {/* Product Image */}
      <div className="flex-shrink-0 w-[90px] h-[90px] rounded-lg overflow-hidden bg-gray-100">
        <img
          src={item.productImage || '/placeholder-product.png'}
          alt={item.productName}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-product.png';
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6">
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[24px] text-[#17183b] line-clamp-2 mb-2">
            {item.productName}
          </h3>
          {item.productSku && (
            <p className="font-['SF_Pro_Display',_sans-serif] font-normal text-[14px] leading-[24px] text-gray-500">
              #{item.productSku}
            </p>
          )}
        </div>

        {/* Right Side - Counter, Price, Remove */}
        <div className="flex items-center gap-6">
          {/* Quantity Counter */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDecrement}
              disabled={item.quantity <= 1}
              className={`
                w-6 h-6 flex items-center justify-center rounded-full border transition-colors duration-200
                ${item.quantity <= 1 
                  ? 'border-gray-300 text-gray-300 cursor-not-allowed' 
                  : 'border-gray-400 text-gray-600 hover:border-[#17183b] hover:text-[#17183b]'
                }
              `}
              aria-label="Decrease quantity"
            >
              <MinusIcon />
            </button>

            <div className="min-w-[48px] px-4 py-2 border border-[#d9d9d9] rounded text-center">
              <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[16px] text-[#17183b]">
                {item.quantity}
              </span>
            </div>

            <button
              onClick={handleIncrement}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-400 text-gray-600 hover:border-[#17183b] hover:text-[#17183b] transition-colors duration-200"
              aria-label="Increase quantity"
            >
              <PlusIcon />
            </button>
          </div>

          {/* Price */}
          <div className="min-w-[80px] text-right">
            <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[20px] leading-[32px] text-[#17183b] tracking-[0.6px]">
              {formatPrice(totalPrice)}
            </span>
          </div>

          {/* Remove Button */}
          <button
            onClick={handleRemove}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors duration-200"
            aria-label="Remove item from cart"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartItemRow;