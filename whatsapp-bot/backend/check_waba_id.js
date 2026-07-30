require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function checkWabaId() {
    try {
        const tokenRes = await axios.get(
            `https://graph.facebook.com/v20.0/debug_token?input_token=${ACCESS_TOKEN}`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Granular scopes:', JSON.stringify(tokenRes.data.data.granular_scopes, null, 2));

        // Get shared WABAs for business
        const bizRes = await axios.get(
            `https://graph.facebook.com/v20.0/122096427609408784?fields=id,name`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('User info:', bizRes.data);
    } catch (err) {
        console.error('Error:', err?.response?.data || err.message);
    }
}

checkWabaId();
