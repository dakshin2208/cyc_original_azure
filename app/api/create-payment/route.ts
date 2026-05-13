import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.error('Razorpay server credentials are not configured');
      return NextResponse.json(
        { error: 'Payment service is not configured' },
        { status: 503 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const { amount, currency = 'INR', planName } = await request.json();

    if (!amount || !planName) {
      return NextResponse.json(
        { error: 'Amount and plan name are required' },
        { status: 400 }
      );
    }

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        plan: planName,
        description: `Payment for ${planName} plan`,
      },
    };

    const order = await razorpay.orders.create(options);

    // Key ID is public (same as in Checkout); returning it avoids requiring
    // NEXT_PUBLIC_RAZORPAY_KEY_ID at build time on Netlify/Vercel.
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
} 
