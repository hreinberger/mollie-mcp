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
    // Ensure the client is initialized before making API calls
    if (!mollieClient) {
        throw new Error(
            'Mollie client is not initialized. MOLLIE_API_KEY might be missing.'
        );
    }
    const payments = await mollieClient.payments.page({ limit });
    return payments;
}

export async function mollieCreatePaymentLink(amount: string): Promise<string> {
    console.error('Creating payment link with amount:', amount);
    // Ensure the client is initialized before making API calls
    if (!mollieClient) {
        throw new Error(
            'Mollie client is not initialized. MOLLIE_API_KEY might be missing.'
        );
    }
    const link = await mollieClient.paymentLinks.create({
        amount: {
            currency: 'EUR',
            value: amount, // Amount in EUR
        },
        description: 'Test payment link',
        redirectUrl: 'https://mollie-next.vercel.app/success',
        // Add more options as needed
    });

    // Attempt to get the payment URL using the getPaymentUrl() method
    const paymentUrl = link.getPaymentUrl();

    if (!paymentUrl) {
        console.error('Payment link URL not found using getPaymentUrl().');
        throw new Error('Payment link URL not found in Mollie API response');
    }

    return paymentUrl;
}
