require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = '1234259863105295';

async function checkMe() {
    try {
        const phoneRes = await axios.get(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Phone details for 1234259863105295:', phoneRes.data);
    } catch (err) {
        console.error('Error:', err?.response?.data || err.message);
    }
}

checkMe();
