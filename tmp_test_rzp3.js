require('dotenv').config();
const Razorpay = require("razorpay");

console.log("TESTING RAZORPAY WITH KEY:", process.env.RAZORPAY_KEY_ID);

const rzp = new Razorpay({
   key_id: process.env.RAZORPAY_KEY_ID,
   key_secret: process.env.RAZORPAY_KEY_SECRET
});

rzp.subscriptions.create({
   plan_id: 'plan_abcd', // Intentionally fake plan
   total_count: 120,
   customer_notify: 1
}, (e, r) => {
   if (e) return console.error("ERROR>", e);
   console.log("SUCCESS>", r);
});
