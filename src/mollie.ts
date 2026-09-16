import { MollieClient } from '@mollie/api-client';

// retrieve payments
export async function mollieGetPayments(mollieClient: MollieClient, limit = 5) {
  const payments = await mollieClient.payments.page({ limit });
  return payments;
}

// retrieve a single payment by ID
export async function mollieGetPayment(mollieClient: MollieClient, paymentId: string) {
  const payment = await mollieClient.payments.get(paymentId);
  return payment;
}

// create a payment link with a specified amount
export async function mollieCreatePaymentLink(
  mollieClient: MollieClient,
  amount: string
): Promise<string> {
  const link = await mollieClient.paymentLinks.create({
    amount: {
      currency: 'EUR',
      value: amount,
    },
    description: 'Test payment link',
    redirectUrl: 'https://mollie-next.vercel.app/success',
  });

  const paymentUrl = link.getPaymentUrl();

  if (!paymentUrl) {
    throw new Error('Payment link URL not found in Mollie API response');
  }

  return paymentUrl;
}

// retrieve all available payment methods
export async function mollieGetMethods(mollieClient: MollieClient) {
  const methods = await mollieClient.methods.list();
  return methods;
}

// retrieve information about the current profile
export async function mollieGetProfile(mollieClient: MollieClient) {
  const profile = await mollieClient.profiles.getCurrent();
  return profile;
}
