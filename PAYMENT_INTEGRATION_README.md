# Razorpay Payment Integration

This project now includes a complete Razorpay payment integration for processing payments for the different pricing plans.

## Features

- ✅ Secure payment processing with Razorpay
- ✅ Payment verification with signature validation
- ✅ Test mode integration (ready for production)
- ✅ TypeScript support
- ✅ Toast notifications for payment status
- ✅ Automatic redirect after successful payment

## Setup

### 1. Environment Variables

Create a `.env.local` file in your project root and add:

```env
RAZORPAY_KEY_ID=rzp_test_qooJHsq0y4J1aK
RAZORPAY_KEY_SECRET=hcCQnehBV89uXZUa9uvDN2n2
```

### 2. API Routes

The integration includes two API routes:

- `/api/create-payment` - Creates a payment order
- `/api/verify-payment` - Verifies payment signature

### 3. Components

- `PaymentButton` - Reusable payment button component
- Updated pricing page with payment buttons

## Usage

### Using the PaymentButton Component

```tsx
import { PaymentButton } from '@/components/PaymentButton'

<PaymentButton
  amount={199}
  planName="Secure"
  onSuccess={(paymentId) => {
    console.log('Payment successful:', paymentId)
    // Handle successful payment
  }}
  onError={(error) => {
    console.error('Payment failed:', error)
    // Handle payment error
  }}
  className="bg-blue-600 hover:bg-blue-700 text-white"
>
  Buy Now
</PaymentButton>
```

### Payment Flow

1. User clicks "Buy Now" button
2. Payment order is created via `/api/create-payment`
3. Razorpay modal opens with payment options
4. User completes payment
5. Payment is verified via `/api/verify-payment`
6. Success/error callback is triggered
7. User is redirected to choice filling page on success

## Test Cards

For testing, you can use these test card details:

- **Card Number**: 4111 1111 1111 1111
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **Name**: Any name

## Production Setup

To move to production:

1. Replace test API keys with live keys from Razorpay dashboard
2. Update the key in `PaymentButton.tsx` and API routes
3. Test thoroughly with small amounts first

## Security Features

- Payment signature verification
- Server-side order creation
- Client-side payment processing
- Proper error handling

## Files Modified/Created

- `app/api/create-payment/route.ts` - Payment order creation
- `app/api/verify-payment/route.ts` - Payment verification
- `components/PaymentButton.tsx` - Payment button component
- `app/pricing/page.tsx` - Updated with payment buttons
- `app/layout.tsx` - Added Razorpay script
- `types/razorpay.d.ts` - TypeScript definitions
- `package.json` - Added razorpay dependency

## Troubleshooting

### Common Issues

1. **Payment modal not opening**: Check if Razorpay script is loaded
2. **Verification failed**: Ensure API keys match between frontend and backend
3. **Amount issues**: Remember Razorpay expects amount in paise (multiply by 100)

### Debug Mode

Enable console logging in the PaymentButton component to debug payment flow.

## Support

For Razorpay-specific issues, refer to the [Razorpay Documentation](https://razorpay.com/docs/). 