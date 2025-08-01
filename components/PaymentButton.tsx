'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PaymentButtonProps {
  amount: number;
  planName: string;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onClick?: () => boolean | void; // Allow both boolean and void return types
  children: React.ReactNode;
  className?: string;
  userId?: string;
  userEmail?: string;
}



export function PaymentButton({
  amount,
  planName,
  onSuccess,
  onError,
  onClick, // Add onClick parameter
  children,
  className,
  userId,
  userEmail
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    // Call onClick and check if payment should proceed
    if (onClick) {
      const result = onClick();
      // If onClick returns false, stop payment. If it returns void or true, continue.
      if (result === false) {
        return; // Stop payment if onClick returns false
      }
    }
    
    setLoading(true);
    
    try {
      // Create payment order
      const orderResponse = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          planName,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Initialize Razorpay
      const options = {
        key: 'rzp_live_KlInbHxazxLUKL',
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'CYC - College Choice Filling',
        description: `${planName} Plan`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyResponse = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.verified) {
              // Update user plan after successful payment
              if (userId && userEmail) {
                try {
                  const planUpdateResponse = await fetch('/api/update-user-plan', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      userId,
                      email: userEmail,
                      planName,
                      paymentId: response.razorpay_payment_id
                    }),
                  });

                  const planUpdateData = await planUpdateResponse.json();
                  
                  if (!planUpdateResponse.ok) {
                    console.error('Failed to update user plan:', planUpdateData.error);
                    // Don't throw error here as payment was successful
                  } else {
                    console.log('User plan updated successfully:', planUpdateData);
                  }
                } catch (error) {
                  console.error('Error updating user plan:', error);
                  // Don't throw error here as payment was successful
                }
              }
              
              toast.success('Payment successful!');
              onSuccess?.(response.razorpay_payment_id);
            } else {
              throw new Error(verifyData.error || 'Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
            onError?.('Payment verification failed');
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: {
          color: '#3B82F6',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment');
      onError?.(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={loading}
      className={className}
    >
      {loading ? 'Processing...' : children}
    </Button>
  );
} 
