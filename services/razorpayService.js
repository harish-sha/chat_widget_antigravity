const Razorpay = require("razorpay");

// Intelligently bypasses if undefined to avoid critical crashes on Node startup
const razorpayKeysExist = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;

const razorpay = razorpayKeysExist ? new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
}) : null;

exports.razorpay = razorpay;

/**
 * Automatically spins up a Native Razorpay Subscription object tightly bound to the user's specific Widget ID
 */
exports.createCheckoutSession = async (planId, widgetId, email) => {
    if (!razorpay) throw new Error("Razorpay environment keys are completely missing from your Node .env file!");

    try {
        // Razorpay conceptually operates on 'Subscriptions', generating an ID we must return. 
        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            customer_notify: 1, // Razorpay autonomously emails the user
            total_count: 120,   // Reduced from 1200 to 120 to stay purely within safe UPI auto-debit limitations
            notes: {
                widget_id: String(widgetId),
                customer_email: email
            }
        });

        return {
            url: subscription.short_url,
            subscription_id: subscription.id
        };
    } catch (err) {
        // Razorpay SDK often fails without a native Node 'e.message', burying it inside 'e.error'
        const rzpDesc = err.error && err.error.description ? err.error.description : String(err);
        throw new Error(`Razorpay Gateway Check Failed: ${rzpDesc}`);
    }
};
