import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

// Cart item interface
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  maxQuantity?: number;
}

// Cart totals interface
interface CartTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

// Cart hook return type
interface UseCartReturn {
  items: CartItem[];
  totals: CartTotals;
  itemCount: number;
  isLoading: boolean;
  error: string | null;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

export function useCart(): UseCartReturn {
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState<CartTotals>({
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate totals from items
  const calculateTotals = useCallback((cartItems: CartItem[], discountAmount = 0) => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // 8% tax
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const total = subtotal + tax + shipping - discountAmount;

    return {
      subtotal,
      tax,
      shipping,
      discount: discountAmount,
      total: Math.max(0, total)
    };
  }, []);

  // Fetch cart data from API
  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      // Handle guest cart from localStorage
      const guestCart = localStorage.getItem('guestCart');
      if (guestCart) {
        try {
          const parsedCart = JSON.parse(guestCart);
          setItems(parsedCart.items || []);
          setTotals(calculateTotals(parsedCart.items || [], parsedCart.discount || 0));
        } catch (err) {
          localStorage.removeItem('guestCart');
        }
      } else {
        setItems([]);
        setTotals(calculateTotals([]));
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get('/cart');
      const cartData = response.data;
      
      setItems(cartData.items || []);
      setTotals(calculateTotals(cartData.items || [], cartData.discount || 0));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch cart');
      console.error('Cart fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, calculateTotals]);

  // Save guest cart to localStorage
  const saveGuestCart = useCallback((cartItems: CartItem[], discount = 0) => {
    if (!isAuthenticated) {
      localStorage.setItem('guestCart', JSON.stringify({
        items: cartItems,
        discount
      }));
    }
  }, [isAuthenticated]);

  // Add item to cart
  const addItem = useCallback(async (productId: string, quantity = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isAuthenticated) {
        const response = await apiClient.post('/cart/add', {
          productId,
          quantity
        });
        setItems(response.data.items);
        setTotals(calculateTotals(response.data.items, response.data.discount || 0));
      } else {
        // Handle guest cart
        const existingItemIndex = items.findIndex(item => item.productId === productId);
        let newItems: CartItem[];

        if (existingItemIndex >= 0) {
          // Update existing item
          newItems = items.map((item, index) => 
            index === existingItemIndex 
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          // Add new item (need to fetch product details)
          const productResponse = await apiClient.get(`/products/${productId}`);
          const product = productResponse.data;
          
          const newItem: CartItem = {
            id: `guest-${Date.now()}`,
            productId,
            name: product.name,
            price: product.price,
            quantity,
            image: product.image,
            maxQuantity: product.stock
          };
          
          newItems = [...items, newItem];
        }

        setItems(newItems);
        setTotals(calculateTotals(newItems));
        saveGuestCart(newItems);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add item to cart');
      console.error('Add to cart error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, items, calculateTotals, saveGuestCart]);

  // Update item quantity
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    try {
      setIsLoading(true);
      setError(null);

      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        if (isAuthenticated) {
          const response = await apiClient.delete(`/cart/items/${itemId}`);
          setItems(response.data.items);
          setTotals(calculateTotals(response.data.items, response.data.discount || 0));
        } else {
          // Handle guest cart
          const newItems = items.filter(item => item.id !== itemId);
          setItems(newItems);
          setTotals(calculateTotals(newItems));
          saveGuestCart(newItems);
        }
        return;
      }

      if (isAuthenticated) {
        const response = await apiClient.put(`/cart/items/${itemId}`, {
          quantity
        });
        setItems(response.data.items);
        setTotals(calculateTotals(response.data.items, response.data.discount || 0));
      } else {
        // Handle guest cart
        const newItems = items.map(item => 
          item.id === itemId 
            ? { ...item, quantity }
            : item
        );
        
        setItems(newItems);
        setTotals(calculateTotals(newItems));
        saveGuestCart(newItems);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update quantity');
      console.error('Update quantity error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, items, calculateTotals, saveGuestCart]);

  // Remove item from cart
  const removeItem = useCallback(async (itemId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isAuthenticated) {
        const response = await apiClient.delete(`/cart/items/${itemId}`);
        setItems(response.data.items);
        setTotals(calculateTotals(response.data.items, response.data.discount || 0));
      } else {
        // Handle guest cart
        const newItems = items.filter(item => item.id !== itemId);
        setItems(newItems);
        setTotals(calculateTotals(newItems));
        saveGuestCart(newItems);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove item');
      console.error('Remove item error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, items, calculateTotals, saveGuestCart]);

  // Clear entire cart
  const clearCart = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (isAuthenticated) {
        await apiClient.delete('/cart');
      } else {
        localStorage.removeItem('guestCart');
      }
      
      setItems([]);
      setTotals(calculateTotals([]));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clear cart');
      console.error('Clear cart error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, calculateTotals]);

  // Apply discount code
  const applyDiscount = useCallback(async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isAuthenticated) {
        const response = await apiClient.post('/cart/discount', { code });
        setTotals(calculateTotals(items, response.data.discountAmount));
      } else {
        // For guest users, simulate discount validation
        // In a real app, you might want to validate against a public endpoint
        const discountAmount = totals.subtotal * 0.1; // 10% discount simulation
        setTotals(calculateTotals(items, discountAmount));
        saveGuestCart(items, discountAmount);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid discount code');
      console.error('Apply discount error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, items, totals.subtotal, calculateTotals, saveGuestCart]);

  // Remove discount
  const removeDiscount = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (isAuthenticated) {
        await apiClient.delete('/cart/discount');
      }
      
      setTotals(calculateTotals(items, 0));
      saveGuestCart(items, 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove discount');
      console.error('Remove discount error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, items, calculateTotals, saveGuestCart]);

  // Refresh cart data
  const refreshCart = useCallback(async () => {
    await fetchCart();
  }, [fetchCart]);

  // Initialize cart on mount and when auth state changes
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Merge guest cart with user cart when user logs in
  useEffect(() => {
    const mergeGuestCart = async () => {
      if (isAuthenticated && user) {
        const guestCart = localStorage.getItem('guestCart');
        if (guestCart) {
          try {
            const parsedCart = JSON.parse(guestCart);
            if (parsedCart.items && parsedCart.items.length > 0) {
              // Merge guest items with user cart
              for (const item of parsedCart.items) {
                await addItem(item.productId, item.quantity);
              }
              localStorage.removeItem('guestCart');
            }
          } catch (err) {
            console.error('Failed to merge guest cart:', err);
            localStorage.removeItem('guestCart');
          }
        }
      }
    };

    mergeGuestCart();
  }, [isAuthenticated, user]); // Note: addItem dependency removed to prevent infinite loop

  // Calculate item count
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    totals,
    itemCount,
    isLoading,
    error,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyDiscount,
    removeDiscount,
    refreshCart
  };
}