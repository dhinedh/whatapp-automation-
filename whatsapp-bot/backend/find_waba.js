require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

async function findWaba() {
    try {
        const res = await axios.get(
            `https://graph.facebook.com/v20.0/me/businesses`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Businesses:', res.data);
        for (const b of res.data.data || []) {
            const wRes = await axios.get(
                `https://graph.facebook.com/v20.0/${b.id}/client_whatsapp_business_accounts`,
                { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
            );
            console.log(`WABAs for biz ${b.name}:`, wRes.data);
            
            const ownWRes = await axios.get(
                `https://graph.facebook.com/v20.0/${b.id}/owned_whatsapp_business_accounts`,
                { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
            );
            console.log(`Owned WABAs for biz ${b.name}:`, ownWRes.data);
        }
    } catch (err) {
        console.error('Error:', err?.response?.data || err.message);
    }
}

findWaba();
