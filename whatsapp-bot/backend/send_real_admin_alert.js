require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // Now 868952799641767
const TARGET = '918838887064';

async function sendRealAdminAlert() {
    console.log(`=== TESTING REAL META CLOUD API FOR LIVE PHONE ID ${PHONE_NUMBER_ID} TO ${TARGET} ===\n`);

    // 1. Order Alert (Interactive Buttons)
    const orderMsg = `🛍️ *NEW ORDER RECEIVED!* 🛒\n\n` +
        `📦 *Order ID:* ORD-984210\n` +
        `👤 *Customer:* Ramesh Kumar\n` +
        `📞 *Phone:* 919976719422\n` +
        `📍 *Address:* 15 Anna Salai, T. Nagar, Chennai, TN - 600017\n` +
        `💳 *Payment:* COD (Pending)\n\n` +
        `🛒 *Items Ordered:*\n` +
        `• 2x Ragi Choco Malt (250g) – ₹500\n` +
        `• 1x Traditional Idly Podi (100g) – ₹75\n\n` +
        `💰 *Total Amount:* ₹575\n\n` +
        `👇 *Tap below to update order status:*`;

    try {
        console.log(`1️⃣ Sending Order Alert to ${TARGET} via Phone ID ${PHONE_NUMBER_ID}...`);
        const res1 = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: TARGET,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: orderMsg },
                    action: {
                        buttons: [
                            { type: 'reply', reply: { id: 'adm_Packed_ORD-984210', title: 'Packed 📦' } },
                            { type: 'reply', reply: { id: 'adm_Shipped_ORD-984210', title: 'Shipped 🚚' } },
                            { type: 'reply', reply: { id: 'adm_Delivered_ORD-984210', title: 'Delivered ✅' } }
                        ]
                    }
                }
            }
        });
        console.log('✅ Interactive Order Alert Result:', JSON.stringify(res1.data, null, 2));
    } catch (err) {
        console.error('❌ Interactive Alert Error:', err?.response?.data || err.message);
    }

    // 2. Low Stock Alert
    const stockMsg = `⚠️ *LOW STOCK ALERT!* 📦\n\n` +
        `Product: *Ragi Choco Malt (250g)*\n` +
        `Remaining Stock: *3 items*\n\n` +
        `💡 Stock is running low. Please re-order soon!`;

    try {
        console.log(`\n2️⃣ Sending Low Stock Alert to ${TARGET}...`);
        const res2 = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: TARGET,
                type: 'text',
                text: { body: stockMsg }
            }
        });
        console.log('✅ Low Stock Alert Result:', JSON.stringify(res2.data, null, 2));
    } catch (err) {
        console.error('❌ Low Stock Alert Error:', err?.response?.data || err.message);
    }
}

sendRealAdminAlert();
