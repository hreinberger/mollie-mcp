import { createMollieClient } from '@mollie/api-client';

const apiKey = process.env.MOLLIE_API_KEY;

if (!apiKey) {
  // This error will halt execution if MOLLIE_API_KEY is not set,
  // which is good practice for critical environment variables.
  throw new Error(
    'MOLLIE_API_KEY is not defined in process.env. Ensure it is set in the .env file and loadEnv.ts is imported first in index.ts.'
  );
}

// Set up Mollie API client
const mollieClient = createMollieClient({ apiKey });

// retrieve payments
export async function mollieGetPayments(limit = 5) {
  if (!mollieClient) {
    throw new Error(
      'Mollie client is not initialized. MOLLIE_API_KEY might be missing.'
    );
  }
  const payments = await mollieClient.payments.page({ limit });
  return payments;
}

// retrieve a single payment by ID
export async function mollieGetPayment(paymentId: string) {
  if (!mollieClient) {
    throw new Error(
      'Mollie client is not initialized. MOLLIE_API_KEY might be missing.'
    );
  }
  const payment = await mollieClient.payments.get(paymentId);
  return payment;
}

// create a payment link with a specified amount
export async function mollieCreatePaymentLink(amount: string): Promise<string> {
  console.error('Creating payment link with amount:', amount);
  if (!mollieClient) {
    throw new Error(
      'Mollie client is not initialized. MOLLIE_API_KEY might be missing.'
    );
  }
  const link = await mollieClient.paymentLinks.create({
    amount: {
      currency: 'EUR',
      value: amount,
    },
    description: 'Test payment link',
    redirectUrl: 'https://mollie-next.vercel.app/success',
  });

  // Attempt to get the payment URL using the getPaymentUrl() method
  const paymentUrl = link.getPaymentUrl();

  if (!paymentUrl) {
    console.error('Payment link URL not found using getPaymentUrl().');
    throw new Error('Payment link URL not found in Mollie API response');
  }

  return paymentUrl;
}

// retrieve all available payment methods
export async function mollieGetMethods() {
  const methods = await mollieClient.methods.list();
  return methods;
}

// retrieve information about the current profile
export async function mollieGetProfile() {
  const profile = await mollieClient.profiles.getCurrent();
  return profile;
}
