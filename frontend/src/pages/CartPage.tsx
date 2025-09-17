import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

interface CartItem {
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    stock: number;
    imageUrl?: string;
  };
}

interface CartResponse {
  items: CartItem[];
  totalCents: number;
  itemCount: number;
}

// Figma design components
function Counter({ quantity, onIncrease, onDecrease, disabled = false }: { 
  quantity: number; 
  onIncrease: () => void; 
  onDecrease: () => void; 
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={onDecrease}
        disabled={disabled || quantity <= 1}
        className="flex items-center justify-center w-6 h-6 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-lg leading-none">−</span>
      </button>
      <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded min-w-[48px]">
        <span className="text-sm font-medium">{quantity}</span>
      </div>
      <button 
        onClick={onIncrease}
        disabled={disabled}
        className="flex items-center justify-center w-6 h-6 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-lg leading-none">+</span>
      </button>
    </div>
  );
}

function CloseIcon({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-6 h-6 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

function CartProduct({ item, onUpdateQuantity, onRemove, isUpdating }: {
  item: CartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  isUpdating: boolean;
}) {
  const formatPrice = (priceCents: number) => `$${(priceCents / 100).toFixed(2)}`;
  
  const handleIncrease = () => {
    if (item.quantity < item.product.stock) {
      onUpdateQuantity(item.productId, item.quantity + 1);
    }
  };

  const handleDecrease = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.productId, item.quantity - 1);
    }
  };

  const handleRemove = () => {
    onRemove(item.productId);
  };

  return (
    <div className="flex items-center gap-4 py-4">
      {/* Product Image */}
      <div className="w-[90px] h-[90px] bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        {item.product.imageUrl ? (
          <img 
            src={item.product.imageUrl} 
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-xs">No Image</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="space-y-2">
          <h3 className="font-medium text-black text-base leading-6 line-clamp-2">
            {item.product.name}
          </h3>
          <p className="text-sm text-gray-600">
            #{item.productId.slice(-10)}
          </p>
          {item.product.stock <= 5 && (
            <p className="text-xs text-red-500">
              Only {item.product.stock} left in stock
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <Counter 
          quantity={item.quantity}
          onIncrease={handleIncrease}
          onDecrease={handleDecrease}
          disabled={isUpdating}
        />
        <div className="text-right">
          <p className="text-xl font-medium text-black tracking-wide">
            {formatPrice(item.product.priceCents)}
          </p>
        </div>
        <CloseIcon onClick={handleRemove} disabled={isUpdating} />
      </div>
    </div>
  );
}

function OrderSummary({ 
  cart, 
  isLoading, 
  onCheckout, 
  discountCode, 
  setDiscountCode, 
  bonusCard, 
  setBonusCard 
}: {
  cart: CartResponse | null;
  isLoading: boolean;
  onCheckout: () => void;
  discountCode: string;
  setDiscountCode: (code: string) => void;
  bonusCard: string;
  setBonusCard: (card: string) => void;
}) {
  const formatPrice = (priceCents: number) => `$${(priceCents / 100).toFixed(2)}`;
  
  const subtotal = cart?.totalCents || 0;
  const tax = Math.round(subtotal * 0.08); // 8% tax
  const shipping = subtotal > 5000 ? 0 : 2900; // Free shipping over $50
  const total = subtotal + tax + shipping;

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-10">
      <h2 className="text-xl font-bold text-gray-900">Order Summary</h2>
      
      <div className="space-y-6">
        {/* Discount Code */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">
            Discount code / Promo code
          </label>
          <div className="relative">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Code"
              className="w-full px-4 py-3 border border-gray-400 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        {/* Bonus Card */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">
            Your bonus card number
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={bonusCard}
              onChange={(e) => setBonusCard(e.target.value)}
              placeholder="Enter Card Number"
              className="flex-1 px-4 py-3 border border-gray-400 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <button className="px-4 py-2 border border-black rounded text-sm font-medium hover:bg-black hover:text-white transition-colors">
              Apply
            </button>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-base font-medium">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-base">
              <span className="text-gray-600">Estimated Tax</span>
              <span className="font-medium">{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between items-center text-base">
              <span className="text-gray-600">Estimated shipping & Handling</span>
              <span className="font-medium">{formatPrice(shipping)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-base font-medium pt-4 border-t">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          disabled={isLoading || !cart?.items.length}
          className="w-full bg-black text-white py-4 px-14 rounded-lg font-medium text-base hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Checkout'}
        </button>
      </div>
    </div>
  );
}

export const CartPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [discountCode, setDiscountCode] = useState('');
  const [bonusCard, setBonusCard] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    loadCart();
  }, [isAuthenticated, navigate]);

  const loadCart = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.cart.get();
      setCart(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      setUpdatingItems(prev => new Set(prev).add(productId));
      await api.cart.update(productId, newQuantity);
      await loadCart(); // Reload cart to get updated totals
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update quantity');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const removeItem = async (productId: string) => {
    try {
      setUpdatingItems(prev => new Set(prev).add(productId));
      await api.cart.remove(productId);
      await loadCart(); // Reload cart to get updated totals
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove item');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const clearCart = async () => {
    if (!window.confirm('Are you sure you want to clear your cart?')) return;

    try {
      setLoading(true);
      await api.cart.clear();
      await loadCart();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear cart');
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your cart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-4">
            <button
              onClick={loadCart}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Try Again
            </button>
            <Link
              to="/"
              className="text-gray-600 hover:text-black transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="text-6xl mb-8">🛒</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-8">
              Looks like you haven't added anything to your cart yet.
            </p>
            <Link
              to="/products"
              className="inline-block bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-black">Shopping Cart</h1>
          </div>

          {/* Cart Items */}
          <div className="space-y-10 mb-10">
            {cart.items.map((item) => (
              <div key={item.productId}>
                <CartProduct
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                  isUpdating={updatingItems.has(item.productId)}
                />
                <div className="h-px bg-gray-200 mt-6"></div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <OrderSummary
            cart={cart}
            isLoading={loading}
            onCheckout={handleCheckout}
            discountCode={discountCode}
            setDiscountCode={setDiscountCode}
            bonusCard={bonusCard}
            setBonusCard={setBonusCard}
          />
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Side - Cart Items */}
            <div className="col-span-7">
              <h1 className="text-2xl font-semibold text-black mb-8">Shopping Cart</h1>
              
              <div className="space-y-8">
                {cart.items.map((item, index) => (
                  <div key={item.productId}>
                    <CartProduct
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeItem}
                      isUpdating={updatingItems.has(item.productId)}
                    />
                    {index < cart.items.length - 1 && (
                      <div className="h-px bg-gray-200 mt-6"></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Clear Cart Button */}
              {cart.items.length > 0 && (
                <div className="mt-8 pt-6 border-t">
                  <button
                    onClick={clearCart}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                  >
                    Clear entire cart
                  </button>
                </div>
              )}
            </div>

            {/* Right Side - Order Summary */}
            <div className="col-span-5">
              <div className="sticky top-8">
                <OrderSummary
                  cart={cart}
                  isLoading={loading}
                  onCheckout={handleCheckout}
                  discountCode={discountCode}
                  setDiscountCode={setDiscountCode}
                  bonusCard={bonusCard}
                  setBonusCard={setBonusCard}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Continue Shopping Link */}
        <div className="mt-8 text-center">
          <Link
            to="/products"
            className="text-gray-600 hover:text-black transition-colors text-sm"
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};