import React, { useState } from 'react';

interface OrderSummaryItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface OrderSummaryProps {
  items: OrderSummaryItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  onApplyDiscount?: (code: string) => void;
  onApplyBonusCard?: (cardNumber: string) => void;
  onCheckout?: () => void;
  isLoading?: boolean;
  className?: string;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  items,
  subtotal,
  tax = 0,
  shipping = 0,
  discount = 0,
  onApplyDiscount,
  onApplyBonusCard,
  onCheckout,
  isLoading = false,
  className = ""
}) => {
  const [discountCode, setDiscountCode] = useState('');
  const [bonusCard, setBonusCard] = useState('');

  const total = subtotal + tax + shipping - discount;

  const handleApplyDiscount = () => {
    if (discountCode.trim() && onApplyDiscount) {
      onApplyDiscount(discountCode.trim());
      setDiscountCode('');
    }
  };

  const handleApplyBonusCard = () => {
    if (bonusCard.trim() && onApplyBonusCard) {
      onApplyBonusCard(bonusCard.trim());
      setBonusCard('');
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

  return (
    <div className={`bg-white border border-[#ebebeb] rounded-[10px] p-6 ${className}`}>
      {/* Title */}
      <h2 className="font-['SF_Pro_Display',_sans-serif] font-bold text-[20px] leading-[16px] text-[#111111] mb-10">
        Order Summary
      </h2>

      {/* Content */}
      <div className="space-y-12">
        {/* Discount and Bonus Card Fields */}
        <div className="space-y-6">
          {/* Discount Code Field */}
          <div className="space-y-2">
            <label className="font-['SF_Pro_Display',_sans-serif] font-medium text-[14px] leading-[16px] text-[#545454] block">
              Discount code / Promo code
            </label>
            <div className="flex gap-0 bg-white border border-[#9f9f9f] rounded-[7px] overflow-hidden">
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Code"
                className="flex-1 px-4 py-4 font-['SF_Pro_Display',_sans-serif] font-normal text-[14px] leading-[24px] text-[#17183b] placeholder-[#979797] focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleApplyDiscount()}
              />
              <button
                onClick={handleApplyDiscount}
                disabled={!discountCode.trim()}
                className="px-4 py-2 border-l border-[#9f9f9f] font-['SF_Pro_Display',_sans-serif] font-medium text-[12px] leading-[16px] text-center text-[#17183b] hover:bg-gray-50 disabled:text-gray-400 transition-colors duration-200"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Bonus Card Field */}
          <div className="space-y-2">
            <label className="font-['SF_Pro_Display',_sans-serif] font-medium text-[14px] leading-[16px] text-[#545454] block">
              Your bonus card number
            </label>
            <div className="flex gap-0 bg-white border border-[#9f9f9f] rounded-[7px] overflow-hidden">
              <input
                type="text"
                value={bonusCard}
                onChange={(e) => setBonusCard(e.target.value)}
                placeholder="Enter Card Number"
                className="flex-1 px-4 py-4 font-['SF_Pro_Display',_sans-serif] font-normal text-[14px] leading-[24px] text-[#17183b] placeholder-[#979797] focus:outline-none"
              />
              <button
                onClick={handleApplyBonusCard}
                disabled={!bonusCard.trim()}
                className="px-4 py-2 border-l border-[#9f9f9f] font-['SF_Pro_Display',_sans-serif] font-medium text-[12px] leading-[16px] text-center text-[#17183b] hover:bg-gray-50 disabled:text-gray-400 transition-colors duration-200"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-4">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[24px] text-[#17183b] tracking-[0.48px]">
              Subtotal
            </span>
            <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[32px] text-[#17183b] tracking-[0.48px]">
              {formatPrice(subtotal)}
            </span>
          </div>

          {/* Tax */}
          {tax > 0 && (
            <div className="flex items-center justify-between">
              <span className="font-['SF_Pro_Display',_sans-serif] font-normal text-[16px] leading-[32px] text-[#545454]">
                Estimated Tax
              </span>
              <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[32px] text-[#17183b] tracking-[0.48px]">
                {formatPrice(tax)}
              </span>
            </div>
          )}

          {/* Shipping */}
          {shipping > 0 && (
            <div className="flex items-center justify-between">
              <span className="font-['SF_Pro_Display',_sans-serif] font-normal text-[16px] leading-[32px] text-[#545454] tracking-[0.48px]">
                Estimated shipping & Handling
              </span>
              <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[32px] text-[#17183b] tracking-[0.48px]">
                {formatPrice(shipping)}
              </span>
            </div>
          )}

          {/* Discount */}
          {discount > 0 && (
            <div className="flex items-center justify-between">
              <span className="font-['SF_Pro_Display',_sans-serif] font-normal text-[16px] leading-[32px] text-[#545454]">
                Discount
              </span>
              <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[32px] text-green-600 tracking-[0.48px]">
                -{formatPrice(discount)}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[24px] text-[#17183b] tracking-[0.48px]">
              Total
            </span>
            <span className="font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[32px] text-[#17183b] tracking-[0.48px]">
              {formatPrice(total)}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          disabled={isLoading || items.length === 0}
          className={`
            w-full px-14 py-4 rounded-[6px] font-['SF_Pro_Display',_sans-serif] font-medium text-[16px] leading-[24px] text-center transition-all duration-200
            ${isLoading || items.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#17183b] text-white hover:bg-[#232447] active:bg-[#0f1020]'
            }
          `}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </div>
          ) : (
            'Checkout'
          )}
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;