require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function checkPhoneFields() {
    try {
        const res = await axios.get(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=id,display_phone_number,name_status,quality_rating,platform_type,throughput`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Phone Data:', res.data);
    } catch (err) {
        console.error('Error:', err?.response?.data || err.message);
    }
}

checkPhoneFields();
