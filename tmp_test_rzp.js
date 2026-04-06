require('dotenv').config();
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
   key_id: process.env.RAZORPAY_KEY_ID,
   key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function test() {
   try {
       // Using the dummy plan ID the user probably pasted "price_1Pkx..." which is a STRIPE id!
       const subscription = await razorpay.subscriptions.create({
           plan_id: "plan_abcd", // We don't have the user's real plan ID, but it will throw a 400 Bad Request
           customer_notify: 1,
           total_count: 1200
       });
       console.log(subscription);
   } catch (e) {
       console.error("Razorpay Error:", e);
   }
}

test();
