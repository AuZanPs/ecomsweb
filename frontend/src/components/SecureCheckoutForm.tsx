import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

interface SecureCheckoutFormProps {
  onSuccess: (paymentMethodId: string, paymentIntentId: string) => void;
  onError: (error: string) => void;
  totalCents: number;
}

const SecureCheckoutForm: React.FC<SecureCheckoutFormProps> = ({
  onSuccess,
  onError,
  totalCents
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe not loaded');
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/checkout/success',
      },
      redirect: 'if_required',
    });

    setProcessing(false);

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      onError(confirmError.message || 'Payment failed');
    } else if (paymentIntent) {
      onSuccess(paymentIntent.payment_method as string, paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-lg">
        <PaymentElement 
          options={{
            layout: 'tabs'
          }}
        />
      </div>
      
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="text-sm text-gray-600">
        Total: ${(totalCents / 100).toFixed(2)}
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          !stripe || processing
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-black text-white hover:bg-gray-800'
        }`}
      >
        {processing ? 'Processing...' : `Pay $${(totalCents / 100).toFixed(2)}`}
      </button>
    </form>
  );
};

export default SecureCheckoutForm;