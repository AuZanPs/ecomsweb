import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';

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

interface CheckoutData {
  selectedAddressId: string;
  shippingMethod: string;
  paymentMethod: 'card' | 'paypal';
  cardDetails?: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    cardholderName: string;
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

function CloseIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M18 6 6 18M6 6l12 12" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  );
}

function ShippingIcon() {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
    </svg>
  );
}

function AddressCard({ address, onSelect, onEdit, onDelete }: { 
  address: Address; 
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-between">
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-4 w-full">
          <RadioButton selected={address.isSelected} onChange={onSelect} />
          <div className="flex items-center gap-6 flex-1">
            <h3 className="text-lg font-normal text-[#17183b] tracking-wider">{address.name}</h3>
            <span className="bg-black text-white text-xs font-medium px-2 py-1 rounded uppercase">
              {address.tag.toLowerCase()}
            </span>
          </div>
        </div>
        <div className="pl-10 flex flex-col gap-2">
          <p className="text-base text-[#17183b] leading-relaxed">{address.address}</p>
          <p className="text-base text-[#17183b]">{address.phone}</p>
        </div>
      </div>
      <div className="flex gap-6 ml-6">
        <button onClick={onEdit} className="text-gray-600 hover:text-gray-800">
          <EditIcon />
        </button>
        <button onClick={onDelete} className="text-gray-600 hover:text-gray-800">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function AddNewAddressButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex flex-col items-center gap-2">
      <div className="flex items-center w-full h-6">
        <div className="flex-1 h-px bg-gray-300"></div>
        <div className="mx-4 p-1 bg-white rounded-full">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>
      <span className="text-sm text-black text-center tracking-wider">Add New Address</span>
    </button>
  );
}

function StepIndicator({ step, currentStep, title, icon }: { 
  step: number; 
  currentStep: number; 
  title: string;
  icon: React.ReactNode;
}) {
  const isActive = step === currentStep;
  
  return (
    <div className={`flex items-center gap-2 ${isActive ? 'opacity-100' : 'opacity-20'}`}>
      <div className="bg-black rounded-full p-1.5 w-6 h-6 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium tracking-widest">Step {step}</span>
        <span className="text-lg font-medium tracking-wider">{title}</span>
      </div>
    </div>
  );
}

function StepsNavigation({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between px-40 py-18">
      <div className="flex items-center flex-1">
        <StepIndicator 
          step={1} 
          currentStep={currentStep} 
          title="Address" 
          icon={<LocationIcon />}
        />
      </div>
      
      <div className="flex-1 h-px bg-gray-300 mx-4"></div>
      
      <div className="flex items-center flex-1 justify-center">
        <StepIndicator 
          step={2} 
          currentStep={currentStep} 
          title="Shipping" 
          icon={<ShippingIcon />}
        />
      </div>
      
      <div className="flex-1 h-px bg-gray-300 mx-4"></div>
      
      <div className="flex items-center flex-1 justify-end">
        <StepIndicator 
          step={3} 
          currentStep={currentStep} 
          title="Payment" 
          icon={<PaymentIcon />}
        />
      </div>
    </div>
  );
}

export const CheckoutPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Mock address data - in real app this would come from API
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: '1',
      name: '2118 Thornridge',
      address: '2118 Thornridge Cir. Syracuse, Connecticut 35624',
      phone: '(209) 555-0104',
      tag: 'HOME',
      isSelected: true
    },
    {
      id: '2',
      name: 'Headoffice',
      address: '2715 Ash Dr. San Jose, South Dakota 83475',
      phone: '(704) 555-0127',
      tag: 'OFFICE',
      isSelected: false
    }
  ]);

  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    selectedAddressId: '1',
    shippingMethod: '',
    paymentMethod: 'card',
    cardDetails: {
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      cardholderName: ''
    }
  });

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
      if (!response.data.items || response.data.items.length === 0) {
        navigate('/cart');
        return;
      }
      setCart(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (addressId: string) => {
    setAddresses(prev => prev.map(addr => ({
      ...addr,
      isSelected: addr.id === addressId
    })));
    setCheckoutData(prev => ({ ...prev, selectedAddressId: addressId }));
  };

  const handleAddressEdit = (addressId: string) => {
    // TODO: Open address edit modal
    console.log('Edit address:', addressId);
  };

  const handleAddressDelete = (addressId: string) => {
    // TODO: Delete address with confirmation
    console.log('Delete address:', addressId);
  };

  const handleAddNewAddress = () => {
    // TODO: Open add address modal
    console.log('Add new address');
  };

  const processCheckout = async () => {
    try {
      setProcessing(true);
      setError('');

      // Validate cart first
      await api.cart.validate();

      // Initiate checkout
      const checkoutResponse = await api.checkout.initiate({
        addressId: checkoutData.selectedAddressId,
        shippingMethod: checkoutData.shippingMethod,
        paymentMethod: checkoutData.paymentMethod,
        ...(checkoutData.paymentMethod === 'card' && { cardDetails: checkoutData.cardDetails })
      });

      // Confirm checkout
      const confirmResponse = await api.checkout.confirm({
        checkoutId: checkoutResponse.data.checkoutId,
        paymentConfirmation: true
      });

      // Redirect to success page or order details
      navigate(`/order/${confirmResponse.data.orderId}?success=true`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (priceCents: number) => {
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="bg-white min-h-screen">
        <Header />
        <div className="px-40 py-12">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <Header />
      
      {/* Steps Navigation */}
      <StepsNavigation currentStep={currentStep} />

      {/* Main Content */}
      <div className="px-40 py-12">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Step 1: Address Selection */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-16">
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-semibold text-[#17183b] leading-relaxed">Select Address</h2>
              
              <div className="flex flex-col gap-12">
                <div className="flex flex-col gap-6">
                  {addresses.map((address) => (
                    <AddressCard
                      key={address.id}
                      address={address}
                      onSelect={() => handleAddressSelect(address.id)}
                      onEdit={() => handleAddressEdit(address.id)}
                      onDelete={() => handleAddressDelete(address.id)}
                    />
                  ))}
                </div>
                
                <AddNewAddressButton onClick={handleAddNewAddress} />
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-start justify-end gap-6">
              <button
                onClick={() => navigate('/cart')}
                className="px-20 py-6 border border-black rounded-md font-medium text-black hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!checkoutData.selectedAddressId}
                className="px-20 py-6 bg-black text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Shipping Method */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-16">
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-semibold text-[#17183b] leading-relaxed">Select Shipping Method</h2>
              
              <div className="flex flex-col gap-6">
                <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RadioButton 
                      selected={checkoutData.shippingMethod === 'standard'} 
                      onChange={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'standard' }))}
                    />
                    <div className="flex flex-col">
                      <h3 className="text-lg font-normal text-[#17183b]">Standard Shipping</h3>
                      <p className="text-sm text-gray-600">5-7 business days</p>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-[#17183b]">Free</span>
                </div>

                <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RadioButton 
                      selected={checkoutData.shippingMethod === 'express'} 
                      onChange={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'express' }))}
                    />
                    <div className="flex flex-col">
                      <h3 className="text-lg font-normal text-[#17183b]">Express Shipping</h3>
                      <p className="text-sm text-gray-600">2-3 business days</p>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-[#17183b]">$9.99</span>
                </div>

                <div className="bg-gray-100 rounded-lg p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RadioButton 
                      selected={checkoutData.shippingMethod === 'overnight'} 
                      onChange={() => setCheckoutData(prev => ({ ...prev, shippingMethod: 'overnight' }))}
                    />
                    <div className="flex flex-col">
                      <h3 className="text-lg font-normal text-[#17183b]">Overnight Shipping</h3>
                      <p className="text-sm text-gray-600">Next business day</p>
                    </div>
                  </div>
                  <span className="text-lg font-medium text-[#17183b]">$24.99</span>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-start justify-end gap-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-20 py-6 border border-black rounded-md font-medium text-black hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!checkoutData.shippingMethod}
                className="px-20 py-6 bg-black text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment & Confirmation */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-16">
            <div className="flex flex-col gap-8">
              <h2 className="text-xl font-semibold text-[#17183b] leading-relaxed">Payment & Review Order</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Payment Method */}
                <div className="flex flex-col gap-6">
                  <h3 className="text-lg font-medium text-[#17183b]">Payment Method</h3>
                  
                  <div className="flex flex-col gap-4">
                    <div className="bg-gray-100 rounded-lg p-6 flex items-center gap-4">
                      <RadioButton 
                        selected={checkoutData.paymentMethod === 'card'} 
                        onChange={() => setCheckoutData(prev => ({ ...prev, paymentMethod: 'card' }))}
                      />
                      <span className="text-lg font-normal text-[#17183b]">Credit/Debit Card</span>
                    </div>

                    <div className="bg-gray-100 rounded-lg p-6 flex items-center gap-4">
                      <RadioButton 
                        selected={checkoutData.paymentMethod === 'paypal'} 
                        onChange={() => setCheckoutData(prev => ({ ...prev, paymentMethod: 'paypal' }))}
                      />
                      <span className="text-lg font-normal text-[#17183b]">PayPal</span>
                    </div>
                  </div>

                  {checkoutData.paymentMethod === 'card' && (
                    <div className="flex flex-col gap-4 mt-4">
                      <input
                        type="text"
                        placeholder="Cardholder Name"
                        value={checkoutData.cardDetails?.cardholderName || ''}
                        onChange={(e) => setCheckoutData(prev => ({
                          ...prev,
                          cardDetails: { ...prev.cardDetails!, cardholderName: e.target.value }
                        }))}
                        className="p-4 border border-gray-300 rounded-lg text-base"
                      />
                      <input
                        type="text"
                        placeholder="Card Number"
                        value={checkoutData.cardDetails?.cardNumber || ''}
                        onChange={(e) => setCheckoutData(prev => ({
                          ...prev,
                          cardDetails: { ...prev.cardDetails!, cardNumber: e.target.value }
                        }))}
                        className="p-4 border border-gray-300 rounded-lg text-base"
                      />
                      <div className="grid grid-cols-3 gap-4">
                        <input
                          type="text"
                          placeholder="MM"
                          value={checkoutData.cardDetails?.expiryMonth || ''}
                          onChange={(e) => setCheckoutData(prev => ({
                            ...prev,
                            cardDetails: { ...prev.cardDetails!, expiryMonth: e.target.value }
                          }))}
                          className="p-4 border border-gray-300 rounded-lg text-base"
                        />
                        <input
                          type="text"
                          placeholder="YY"
                          value={checkoutData.cardDetails?.expiryYear || ''}
                          onChange={(e) => setCheckoutData(prev => ({
                            ...prev,
                            cardDetails: { ...prev.cardDetails!, expiryYear: e.target.value }
                          }))}
                          className="p-4 border border-gray-300 rounded-lg text-base"
                        />
                        <input
                          type="text"
                          placeholder="CVV"
                          value={checkoutData.cardDetails?.cvv || ''}
                          onChange={(e) => setCheckoutData(prev => ({
                            ...prev,
                            cardDetails: { ...prev.cardDetails!, cvv: e.target.value }
                          }))}
                          className="p-4 border border-gray-300 rounded-lg text-base"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="flex flex-col gap-6">
                  <h3 className="text-lg font-medium text-[#17183b]">Order Summary</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-6 flex flex-col gap-4">
                    {cart?.items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-4">
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
                          <h4 className="font-medium text-[#17183b]">{item.product.name}</h4>
                          <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        </div>
                        <span className="font-medium text-[#17183b]">
                          {formatPrice(item.product.priceCents * item.quantity)}
                        </span>
                      </div>
                    ))}
                    
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center text-lg font-medium text-[#17183b]">
                        <span>Total</span>
                        <span>{formatPrice(cart?.totalCents || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-start justify-end gap-6">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-20 py-6 border border-black rounded-md font-medium text-black hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={processCheckout}
                disabled={processing || (checkoutData.paymentMethod === 'card' && !checkoutData.cardDetails?.cardNumber)}
                className="px-20 py-6 bg-black text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Complete Order'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-black text-white px-40 py-26">
        <div className="flex justify-between mb-6">
          <div className="flex flex-col gap-6">
            <div className="text-white text-sm font-medium">7cyber</div>
            <p className="text-gray-300 text-sm leading-relaxed max-w-md">
              We are a residential interior design firm located in Portland. 
              Our boutique-studio offers more than
            </p>
          </div>
          <div className="flex gap-28">
            <div className="flex flex-col gap-2">
              <h4 className="text-white font-semibold mb-2">Services</h4>
              <div className="text-gray-300 text-sm space-y-2">
                <p>Bonus program</p>
                <p>Gift cards</p>
                <p>Credit and payment</p>
                <p>Service contracts</p>
                <p>Non-cash account</p>
                <p>Payment</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-white font-semibold mb-2">Assistance to the buyer</h4>
              <div className="text-gray-300 text-sm space-y-2">
                <p>Find an order</p>
                <p>Terms of delivery</p>
                <p>Exchange and return of goods</p>
                <p>Guarantee</p>
                <p>Frequently asked questions</p>
                <p>Terms of use of the site</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-4 h-4 text-white"></div>
          <div className="w-4 h-4 text-white"></div>
          <div className="w-4 h-4 text-white"></div>
          <div className="w-4 h-4 text-white"></div>
        </div>
      </footer>
    </div>
  );
};