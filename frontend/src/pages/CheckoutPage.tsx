import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { api } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import getStripe from '../services/stripeService';
import SecureCheckoutForm from '../components/SecureCheckoutForm';

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

interface Address {
  id: string;
  name: string;
  address: string;
  phone: string;
  tag: 'HOME' | 'OFFICE';
  isSelected: boolean;
}

// Secure checkout data interface - no sensitive card data
interface SecureCheckoutData {
  selectedAddressId: string;
  shippingMethod: string;
  paymentMethod: 'card' | 'paypal';
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

// UI Components
function RadioButton({ selected, onChange }: { selected: boolean; onChange: () => void }) {
  return (
    <button 
      onClick={onChange}
      className="relative w-6 h-6 flex items-center justify-center"
    >
      <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center bg-white">
        {selected && (
          <div className="w-3 h-3 bg-black rounded-full"></div>
        )}
      </div>
    </button>
  );
}

function EditIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Mock addresses for demo
  const [addresses] = useState<Address[]>([
    {
      id: '1',
      name: 'John Doe',
      address: '123 Main St, Anytown, CA 12345',
      phone: '+1 (555) 123-4567',
      tag: 'HOME',
      isSelected: true
    },
    {
      id: '2',
      name: 'John Doe',
      address: '456 Business Ave, Corporate City, CA 54321',
      phone: '+1 (555) 987-6543',
      tag: 'OFFICE',
      isSelected: false
    }
  ]);

  const [checkoutData, setCheckoutData] = useState<SecureCheckoutData>({
    selectedAddressId: '1',
    shippingMethod: 'standard',
    paymentMethod: 'card'
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchCart();
  }, [user, navigate]);

  useEffect(() => {
    // Create payment intent when cart is loaded
    if (cart && cart.totalCents > 0) {
      createPaymentIntent();
    }
  }, [cart]);

  const fetchCart = async () => {
    try {
      const response = await api.cart.get();
      setCart(response.data);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    try {
      if (!cart) return;
      
      const response = await api.checkout.createPaymentIntent({
        amount: cart.totalCents,
        currency: 'usd',
        metadata: {
          userId: user?.id,
          cartId: cart.items.map(item => item.productId).join(',')
        }
      });

      setClientSecret(response.data.clientSecret);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create payment intent');
    }
  };

  const handleSecurePaymentSuccess = async (paymentMethodId: string, confirmedPaymentIntentId: string) => {
    try {
      const selectedAddress = addresses.find(addr => addr.id === checkoutData.selectedAddressId);
      
      const response = await api.checkout.confirm({
        paymentMethodId,
        paymentIntentId: confirmedPaymentIntentId,
        shippingAddress: {
          street: selectedAddress?.address || '',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      });

      if (response.data.success) {
        navigate('/orders', { 
          state: { 
            message: 'Order placed successfully!',
            orderId: response.data.order.id 
          }
        });
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to confirm payment');
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (!user) {
    return <div>Please log in to continue.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">Loading checkout...</div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
            <p className="text-gray-600 mb-8">Add some products to your cart to checkout</p>
            <button
              onClick={() => navigate('/products')}
              className="bg-black text-white px-6 py-3 rounded hover:bg-gray-800"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stripe = getStripe();
  const stripeOptions = {
    clientSecret: clientSecret || undefined,
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">Secure Checkout</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Checkout Form */}
          <div className="space-y-6">
            {/* Shipping Address */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Shipping Address</h3>
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      checkoutData.selectedAddressId === address.id
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setCheckoutData(prev => ({ ...prev, selectedAddressId: address.id }))}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <RadioButton 
                          selected={checkoutData.selectedAddressId === address.id}
                          onChange={() => setCheckoutData(prev => ({ ...prev, selectedAddressId: address.id }))}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{address.name}</span>
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                              {address.tag}
                            </span>
                          </div>
                          <p className="text-gray-600 mt-1">{address.address}</p>
                          <p className="text-gray-600">{address.phone}</p>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <EditIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Method */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Shipping Method</h3>
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-lg border cursor-pointer ${
                    checkoutData.shippingMethod === 'standard'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'standard' }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <RadioButton 
                        selected={checkoutData.shippingMethod === 'standard'}
                        onChange={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'standard' }))}
                      />
                      <div>
                        <div className="font-medium">Standard Shipping</div>
                        <div className="text-gray-600 text-sm">5-7 business days</div>
                      </div>
                    </div>
                    <div className="font-medium">Free</div>
                  </div>
                </div>
                
                <div
                  className={`p-4 rounded-lg border cursor-pointer ${
                    checkoutData.shippingMethod === 'express'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'express' }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <RadioButton 
                        selected={checkoutData.shippingMethod === 'express'}
                        onChange={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'express' }))}
                      />
                      <div>
                        <div className="font-medium">Express Shipping</div>
                        <div className="text-gray-600 text-sm">2-3 business days</div>
                      </div>
                    </div>
                    <div className="font-medium">$9.99</div>
                  </div>
                </div>
                
                <div
                  className={`p-4 rounded-lg border cursor-pointer ${
                    checkoutData.shippingMethod === 'overnight'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'overnight' }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <RadioButton 
                        selected={checkoutData.shippingMethod === 'overnight'}
                        onChange={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'overnight' }))}
                      />
                      <div>
                        <div className="font-medium">Overnight Shipping</div>
                        <div className="text-gray-600 text-sm">1 business day</div>
                      </div>
                    </div>
                    <div className="font-medium">$24.99</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Secure Payment */}
            {clientSecret && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  🔒 Secure Payment Information
                  <span className="text-sm font-normal text-green-600 ml-2">
                    (Powered by Stripe - PCI DSS Compliant)
                  </span>
                </h3>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <RadioButton 
                      selected={checkoutData.paymentMethod === 'card'}
                      onChange={() => setCheckoutData(prev => ({ ...prev, paymentMethod: 'card' }))}
                    />
                    <span>Credit/Debit Card</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioButton 
                      selected={checkoutData.paymentMethod === 'paypal'}
                      onChange={() => setCheckoutData(prev => ({ ...prev, paymentMethod: 'paypal' }))}
                    />
                    <span>PayPal</span>
                  </div>
                </div>

                {checkoutData.paymentMethod === 'card' && (
                  <Elements stripe={stripe} options={stripeOptions}>
                    <SecureCheckoutForm
                      onSuccess={handleSecurePaymentSuccess}
                      onError={handlePaymentError}
                      totalCents={cart.totalCents}
                    />
                  </Elements>
                )}

                {checkoutData.paymentMethod === 'paypal' && (
                  <div className="text-center py-8 text-gray-500">
                    PayPal integration coming soon
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 h-fit">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            
            <div className="space-y-4 mb-6">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0">
                    {item.product.imageUrl && (
                      <img 
                        src={item.product.imageUrl} 
                        alt={item.product.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{item.product.name}</h4>
                    <p className="text-gray-600 text-sm">Qty: {item.quantity}</p>
                  </div>
                  <div className="font-medium">
                    ${((item.product.priceCents * item.quantity) / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${(cart.totalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {checkoutData.shippingMethod === 'standard' ? 'Free' :
                   checkoutData.shippingMethod === 'express' ? '$9.99' : '$24.99'}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t pt-2">
                <span>Total</span>
                <span>
                  ${((cart.totalCents + 
                    (checkoutData.shippingMethod === 'express' ? 999 : 
                     checkoutData.shippingMethod === 'overnight' ? 2499 : 0)) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6 text-xs text-gray-500 bg-green-50 p-3 rounded">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-green-600">🔒</span>
                <span className="font-medium text-green-800">Secure Payment Processing</span>
              </div>
              <p>Your payment information is processed securely by Stripe and never stored on our servers. This checkout is PCI DSS compliant.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}