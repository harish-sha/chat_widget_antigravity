const Stripe = require('stripe');
// The Admin should configure this inside their ENV eventually, but we fall back to a dummy key to prevent crashes while testing
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_fake_api_key_123', {
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

exports.stripe = stripe;

/**
 * Automatically spins up a Native Stripe Payment page tightly bound to the user's specific Widget ID
 */
exports.createCheckoutSession = async (priceId, widgetId, customerEmail, successUrl, cancelUrl) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl || 'http://localhost:3000/dashboard/billing?success=true',
    cancel_url: cancelUrl || 'http://localhost:3000/dashboard/billing?canceled=true',
    customer_email: customerEmail,
    client_reference_id: widgetId, // This is explicitly returned in the massive Stripe Webhook payload!
    metadata: {
      widget_id: widgetId
    }
  });

  return session.url;
};

/**
 * Creates the official Stripe Customer Portal where users download massive PDF invoices or swap Credit Cards
 */
exports.createBillingPortalSession = async (customerId, returnUrl) => {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || 'http://localhost:3000/dashboard/billing'
  });

  return session.url;
};
