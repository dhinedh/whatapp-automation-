require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const TARGET_PHONE = '919976719422';

async function testSendTemplate() {
    console.log(`Sending test template 'hello_world' to ${TARGET_PHONE}...`);
    try {
        const res = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: TARGET_PHONE,
                type: 'template',
                template: {
                    name: 'hello_world',
                    language: { code: 'en_US' }
                }
            }
        });
        console.log('✅ Template Delivery Success:', res.data);
    } catch (err) {
        console.error('❌ Template Delivery Failed:', err?.response?.data || err.message);
    }
}

testSendTemplate();
