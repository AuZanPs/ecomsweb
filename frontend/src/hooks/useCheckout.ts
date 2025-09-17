import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

// Shipping address interface
interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Payment method interface
interface PaymentMethod {
  type: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  cardholderName?: string;
  paypalEmail?: string;
}

// Order item interface
interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// Order totals interface
interface OrderTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}

// Checkout session interface
interface CheckoutSession {
  items: OrderItem[];
  totals: OrderTotals;
  shippingAddress?: ShippingAddress;
  paymentMethod?: PaymentMethod;
  shippingMethod?: string;
  discountCode?: string;
}

// Order response interface
interface OrderResponse {
  orderId: string;
  status: string;
  total: number;
  paymentIntentClientSecret?: string;
}

// Checkout steps
type CheckoutStep = 'shipping' | 'payment' | 'review' | 'complete';

// Use checkout hook return type
interface UseCheckoutReturn {
  session: CheckoutSession;
  currentStep: CheckoutStep;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  
  // Session management
  initializeCheckout: () => Promise<void>;
  updateShippingAddress: (address: ShippingAddress) => void;
  updatePaymentMethod: (payment: PaymentMethod) => void;
  updateShippingMethod: (method: string) => void;
  applyDiscountCode: (code: string) => Promise<void>;
  removeDiscountCode: () => void;
  
  // Navigation
  goToStep: (step: CheckoutStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Order processing
  validateShipping: () => boolean;
  validatePayment: () => boolean;
  calculateShipping: (address: ShippingAddress) => Promise<void>;
  processPayment: () => Promise<OrderResponse>;
  
  // Utility
  canProceedToNext: () => boolean;
  reset: () => void;
}

const CHECKOUT_STEPS: CheckoutStep[] = ['shipping', 'payment', 'review', 'complete'];

export function useCheckout(): UseCheckoutReturn {
  const { isAuthenticated, user } = useAuth();
  
  const [session, setSession] = useState<CheckoutSession>({
    items: [],
    totals: {
      subtotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      total: 0
    }
  });
  
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize checkout session with cart data
  const initializeCheckout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get('/checkout/init');
      const checkoutData = response.data;

      setSession(prev => ({
        ...prev,
        items: checkoutData.items,
        totals: checkoutData.totals,
        discountCode: checkoutData.discountCode
      }));

      // Pre-fill shipping address if user is logged in
      if (isAuthenticated && user) {
        const userResponse = await apiClient.get('/users/profile');
        const userData = userResponse.data;
        
        if (userData.defaultShippingAddress) {
          setSession(prev => ({
            ...prev,
            shippingAddress: userData.defaultShippingAddress
          }));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initialize checkout');
      console.error('Checkout initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Update shipping address
  const updateShippingAddress = useCallback((address: ShippingAddress) => {
    setSession(prev => ({
      ...prev,
      shippingAddress: address
    }));
  }, []);

  // Update payment method
  const updatePaymentMethod = useCallback((payment: PaymentMethod) => {
    setSession(prev => ({
      ...prev,
      paymentMethod: payment
    }));
  }, []);

  // Update shipping method
  const updateShippingMethod = useCallback((method: string) => {
    setSession(prev => ({
      ...prev,
      shippingMethod: method
    }));
  }, []);

  // Apply discount code
  const applyDiscountCode = useCallback(async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.post('/checkout/discount', {
        code,
        items: session.items
      });

      setSession(prev => ({
        ...prev,
        discountCode: code,
        totals: response.data.totals
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid discount code');
      console.error('Apply discount error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session.items]);

  // Remove discount code
  const removeDiscountCode = useCallback(() => {
    setSession(prev => {
      const newTotals = { ...prev.totals };
      newTotals.total += newTotals.discount;
      newTotals.discount = 0;

      return {
        ...prev,
        discountCode: undefined,
        totals: newTotals
      };
    });
  }, []);

  // Calculate shipping costs
  const calculateShipping = useCallback(async (address: ShippingAddress) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.post('/checkout/shipping', {
        address,
        items: session.items
      });

      setSession(prev => ({
        ...prev,
        totals: {
          ...prev.totals,
          shipping: response.data.shippingCost,
          total: prev.totals.subtotal + prev.totals.tax + response.data.shippingCost - prev.totals.discount
        }
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to calculate shipping');
      console.error('Shipping calculation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session.items]);

  // Validate shipping information
  const validateShipping = useCallback(() => {
    const { shippingAddress } = session;
    if (!shippingAddress) return false;

    const requiredFields: (keyof ShippingAddress)[] = [
      'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'country'
    ];

    return requiredFields.every(field => {
      const value = shippingAddress[field];
      return value && value.toString().trim().length > 0;
    });
  }, [session.shippingAddress]);

  // Validate payment information
  const validatePayment = useCallback(() => {
    const { paymentMethod } = session;
    if (!paymentMethod) return false;

    switch (paymentMethod.type) {
      case 'card':
        return !!(
          paymentMethod.cardNumber &&
          paymentMethod.expiryMonth &&
          paymentMethod.expiryYear &&
          paymentMethod.cvv &&
          paymentMethod.cardholderName
        );
      case 'paypal':
        return !!paymentMethod.paypalEmail;
      case 'apple_pay':
      case 'google_pay':
        return true; // These are handled by their respective SDKs
      default:
        return false;
    }
  }, [session.paymentMethod]);

  // Process payment and create order
  const processPayment = useCallback(async (): Promise<OrderResponse> => {
    try {
      setIsProcessing(true);
      setError(null);

      const orderData = {
        items: session.items,
        shippingAddress: session.shippingAddress,
        paymentMethod: session.paymentMethod,
        shippingMethod: session.shippingMethod,
        discountCode: session.discountCode,
        totals: session.totals
      };

      const response = await apiClient.post('/orders', orderData);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Payment processing failed';
      setError(errorMessage);
      console.error('Payment processing error:', err);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [session]);

  // Navigation helpers
  const goToStep = useCallback((step: CheckoutStep) => {
    setCurrentStep(step);
  }, []);

  const nextStep = useCallback(() => {
    const currentIndex = CHECKOUT_STEPS.indexOf(currentStep);
    if (currentIndex < CHECKOUT_STEPS.length - 1) {
      setCurrentStep(CHECKOUT_STEPS[currentIndex + 1]);
    }
  }, [currentStep]);

  const previousStep = useCallback(() => {
    const currentIndex = CHECKOUT_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(CHECKOUT_STEPS[currentIndex - 1]);
    }
  }, [currentStep]);

  // Check if can proceed to next step
  const canProceedToNext = useCallback(() => {
    switch (currentStep) {
      case 'shipping':
        return validateShipping();
      case 'payment':
        return validatePayment();
      case 'review':
        return validateShipping() && validatePayment();
      case 'complete':
        return false;
      default:
        return false;
    }
  }, [currentStep, validateShipping, validatePayment]);

  // Reset checkout session
  const reset = useCallback(() => {
    setSession({
      items: [],
      totals: {
        subtotal: 0,
        tax: 0,
        shipping: 0,
        discount: 0,
        total: 0
      }
    });
    setCurrentStep('shipping');
    setError(null);
  }, []);

  return {
    session,
    currentStep,
    isLoading,
    error,
    isProcessing,
    
    // Session management
    initializeCheckout,
    updateShippingAddress,
    updatePaymentMethod,
    updateShippingMethod,
    applyDiscountCode,
    removeDiscountCode,
    
    // Navigation
    goToStep,
    nextStep,
    previousStep,
    
    // Order processing
    validateShipping,
    validatePayment,
    calculateShipping,
    processPayment,
    
    // Utility
    canProceedToNext,
    reset
  };
}