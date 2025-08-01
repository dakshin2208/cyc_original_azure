import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: 'rzp_live_KlInbHxazxLUKL',
  key_secret: 'zvWala2T9OaV9EPNVHBToBFN',
});

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
} 
