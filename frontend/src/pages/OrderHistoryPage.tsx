import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import apiClient from '../services/apiClient';

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image?: string;
}

interface Order {
  _id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: {
    fullName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

// Design system components based on Figma
interface ButtonProps {
  buttonText?: string;
  state?: "Small Stroke" | "White Stroke" | "Fill" | "Black Stroke" | "Fill Small" | "Stroke Small";
  onClick?: () => void;
  className?: string;
}

function Button({ buttonText = "Label", state = "Black Stroke", onClick, className = "" }: ButtonProps) {
  const baseClasses = "box-border content-stretch flex gap-[8px] items-center justify-center relative rounded-[6px] cursor-pointer transition-colors";
  
  let stateClasses = "";
  switch (state) {
    case "Fill Small":
      stateClasses = "bg-black text-white px-[64px] py-[12px] text-[14px] rounded-[8px]";
      break;
    case "Black Stroke":
      stateClasses = "border border-black border-solid text-black px-[56px] py-[16px] text-[16px]";
      break;
    case "Fill":
      stateClasses = "bg-black text-white px-[56px] py-[16px] text-[16px]";
      break;
    default:
      stateClasses = "border border-solid border-white text-white px-[56px] py-[16px] text-[16px]";
  }

  return (
    <button
      className={`${baseClasses} ${stateClasses} ${className}`}
      onClick={onClick}
    >
      <span className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-center text-nowrap">
        {buttonText}
      </span>
    </button>
  );
}

// Order status badge component using Figma color system
function StatusBadge({ status }: { status: Order['status'] }) {
  const getStatusStyles = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-[16px] py-[4px] rounded-[20px] border font-['SF_Pro_Display:Medium',_sans-serif] text-[12px] leading-[16px] ${getStatusStyles(status)}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Order card component using Figma design patterns
function OrderCard({ order, onViewDetails }: { order: Order; onViewDetails: (order: Order) => void }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="bg-white box-border border border-[#e5e5e5] border-solid content-stretch flex flex-col gap-[24px] p-[24px] relative rounded-[9px] w-full">
      {/* Order header */}
      <div className="content-stretch flex items-center justify-between relative w-full">
        <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
          <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[16px] text-black">
            Order #{order._id.slice(-8).toUpperCase()}
          </div>
          <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
            Placed on {formatDate(order.createdAt)}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Order items preview */}
      <div className="content-stretch flex flex-col gap-[12px] items-start justify-start relative w-full">
        <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
          Items ({order.items.length})
        </div>
        <div className="content-stretch flex flex-col gap-[8px] items-start justify-start relative w-full">
          {order.items.slice(0, 3).map((item, index) => (
            <div key={index} className="content-stretch flex items-center justify-between relative w-full">
              <div className="content-stretch flex gap-[12px] items-center justify-start">
                <div className="bg-[#f6f6f6] h-[48px] relative rounded-[6px] w-[48px]">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full object-cover rounded-[6px] w-full"
                    />
                  )}
                </div>
                <div className="content-stretch flex flex-col gap-[2px] items-start justify-start">
                  <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                    {item.name}
                  </div>
                  <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[12px] text-[#909090]">
                    Qty: {item.quantity}
                  </div>
                </div>
              </div>
              <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                {formatPrice(item.price * item.quantity)}
              </div>
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[12px] text-[#909090]">
              +{order.items.length - 3} more items
            </div>
          )}
        </div>
      </div>

      {/* Order footer */}
      <div className="content-stretch flex items-center justify-between relative w-full">
        <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
          <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
            Total Amount
          </div>
          <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[20px] text-black">
            {formatPrice(order.totalAmount)}
          </div>
        </div>
        <Button
          buttonText="View Details"
          state="Black Stroke"
          onClick={() => onViewDetails(order)}
          className="px-[32px] py-[12px] text-[14px]"
        />
      </div>
    </div>
  );
}

// Order details modal
function OrderDetailsModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-[24px] z-50">
      <div className="bg-white max-h-[90vh] max-w-[800px] overflow-y-auto relative rounded-[12px] w-full">
        {/* Modal header */}
        <div className="bg-white border-b border-[#e5e5e5] border-solid content-stretch flex items-center justify-between p-[24px] sticky top-0 z-10">
          <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
            <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[20px] text-black">
              Order Details
            </div>
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
              Order #{order._id.slice(-8).toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-[#f6f6f6] content-stretch flex h-[32px] items-center justify-center relative rounded-[6px] w-[32px]"
          >
            <span className="font-['SF_Pro_Display:Medium',_sans-serif] text-[16px] text-black">×</span>
          </button>
        </div>

        {/* Modal content */}
        <div className="content-stretch flex flex-col gap-[32px] p-[24px]">
          {/* Order status and dates */}
          <div className="content-stretch flex flex-col gap-[16px] items-start justify-start">
            <div className="content-stretch flex items-center justify-between w-full">
              <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-black">
                Order Status
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="content-stretch flex gap-[32px] items-start justify-start w-full">
              <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
                <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                  Order Date
                </div>
                <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                  {formatDate(order.createdAt)}
                </div>
              </div>
              <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
                <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                  Last Updated
                </div>
                <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                  {formatDate(order.updatedAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Order items */}
          <div className="content-stretch flex flex-col gap-[16px] items-start justify-start">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-black">
              Items ({order.items.length})
            </div>
            <div className="content-stretch flex flex-col gap-[16px] items-start justify-start w-full">
              {order.items.map((item, index) => (
                <div key={index} className="bg-[#f9f9f9] box-border content-stretch flex items-center justify-between p-[16px] relative rounded-[8px] w-full">
                  <div className="content-stretch flex gap-[16px] items-center justify-start">
                    <div className="bg-white h-[64px] relative rounded-[8px] w-[64px]">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full object-cover rounded-[8px] w-full"
                        />
                      )}
                    </div>
                    <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
                      <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-black">
                        {item.name}
                      </div>
                      <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                        Quantity: {item.quantity}
                      </div>
                      <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                        Unit Price: {formatPrice(item.price)}
                      </div>
                    </div>
                  </div>
                  <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[16px] text-black">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping address */}
          <div className="content-stretch flex flex-col gap-[16px] items-start justify-start">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-black">
              Shipping Address
            </div>
            <div className="bg-[#f9f9f9] box-border content-stretch flex flex-col gap-[8px] p-[16px] relative rounded-[8px] w-full">
              <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                {order.shippingAddress.fullName}
              </div>
              <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                {order.shippingAddress.address}
              </div>
              <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                {order.shippingAddress.city}, {order.shippingAddress.postalCode}
              </div>
              <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                {order.shippingAddress.country}
              </div>
            </div>
          </div>

          {/* Payment information */}
          <div className="content-stretch flex flex-col gap-[16px] items-start justify-start">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-black">
              Payment Information
            </div>
            <div className="content-stretch flex gap-[32px] items-start justify-start w-full">
              <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
                <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                  Payment Method
                </div>
                <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                  {order.paymentMethod}
                </div>
              </div>
              <div className="content-stretch flex flex-col gap-[4px] items-start justify-start">
                <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[14px] text-[#909090]">
                  Payment Status
                </div>
                <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-black">
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Order total */}
          <div className="border-t border-[#e5e5e5] border-solid content-stretch flex items-center justify-between pt-[16px] w-full">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[18px] text-black">
              Total Amount
            </div>
            <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[24px] text-black">
              {formatPrice(order.totalAmount)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | Order['status']>('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/orders');
      setOrders(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => 
    filterStatus === 'all' ? true : order.status === filterStatus
  );

  const statusOptions: Array<{ value: 'all' | Order['status']; label: string }> = [
    { value: 'all', label: 'All Orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  if (!user) {
    return (
      <div className="content-stretch flex items-center justify-center min-h-[60vh] relative w-full">
        <div className="content-stretch flex flex-col gap-[24px] items-center justify-center relative">
          <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[20px] text-black text-center">
            Please log in to view your order history
          </div>
          <Button
            buttonText="Login"
            state="Fill"
            onClick={() => window.location.href = '/auth'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen relative w-full">
      <Header />
      
      {/* Page header */}
      <div className="bg-white border-b border-[#e5e5e5] border-solid content-stretch flex flex-col gap-[32px] px-[160px] py-[40px] relative w-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <div className="content-stretch flex flex-col gap-[8px] items-start justify-start">
            <div className="font-['SF_Pro_Display:Semibold',_sans-serif] leading-[0] not-italic text-[32px] text-[#17183b]">
              Order History
            </div>
            <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[16px] text-[#909090]">
              Track and manage your orders
            </div>
          </div>
          <Button
            buttonText="Continue Shopping"
            state="Black Stroke"
            onClick={() => window.location.href = '/products'}
          />
        </div>

        {/* Status filter */}
        <div className="content-stretch flex gap-[16px] items-center justify-start relative w-full">
          <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-[#17183b]">
            Filter by Status:
          </div>
          <div className="content-stretch flex gap-[8px] items-center justify-start">
            {statusOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                className={`box-border content-stretch flex gap-[8px] items-center justify-center px-[16px] py-[8px] relative rounded-[20px] cursor-pointer transition-colors ${
                  filterStatus === option.value
                    ? 'bg-black text-white'
                    : 'bg-[#f6f6f6] border border-[#e5e5e5] border-solid text-[#17183b] hover:bg-[#eeeeee]'
                }`}
              >
                <span className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[14px] text-nowrap">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="content-stretch flex flex-col gap-[24px] px-[160px] py-[40px] relative w-full">
        {loading ? (
          <div className="content-stretch flex items-center justify-center min-h-[400px] relative w-full">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-[#909090]">
              Loading your orders...
            </div>
          </div>
        ) : error ? (
          <div className="content-stretch flex flex-col gap-[16px] items-center justify-center min-h-[400px] relative w-full">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-red-600 text-center">
              {error}
            </div>
            <Button
              buttonText="Try Again"
              state="Black Stroke"
              onClick={fetchOrders}
            />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="content-stretch flex flex-col gap-[24px] items-center justify-center min-h-[400px] relative w-full">
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[20px] text-[#17183b] text-center">
              {filterStatus === 'all' ? 'No orders found' : `No ${filterStatus} orders found`}
            </div>
            <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic text-[16px] text-[#909090] text-center">
              Start shopping to create your first order
            </div>
            <Button
              buttonText="Browse Products"
              state="Fill"
              onClick={() => window.location.href = '/products'}
            />
          </div>
        ) : (
          <>
            {/* Orders count */}
            <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-[16px] text-[#909090]">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
            </div>

            {/* Orders list */}
            <div className="content-stretch flex flex-col gap-[16px] items-start justify-start relative w-full">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order._id}
                  order={order}
                  onViewDetails={setSelectedOrder}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Order details modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
      
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
}