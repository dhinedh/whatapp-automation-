require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

async function checkToken() {
    try {
        const res = await axios.get(`https://graph.facebook.com/v20.0/debug_token?input_token=${ACCESS_TOKEN}&access_token=${ACCESS_TOKEN}`);
        console.log('Token Info:', JSON.stringify(res.data, null, 2));

        // Get permissions / granular scopes target IDs
        const scopes = res.data?.data?.granular_scopes || [];
        console.log('\nGranular Scopes Target IDs:');
        scopes.forEach(s => {
            console.log(`Scope: ${s.scope}, Target IDs:`, s.target_ids);
        });

        const targetWabaId = scopes.find(s => s.target_ids && s.target_ids.length > 0)?.target_ids?.[0];
        if (targetWabaId) {
            console.log(`\nFetching phone numbers for Target WABA ID: ${targetWabaId}...`);
            const phoneRes = await axios.get(`https://graph.facebook.com/v20.0/${targetWabaId}/phone_numbers?access_token=${ACCESS_TOKEN}`);
            console.log('Phone Numbers Data:', JSON.stringify(phoneRes.data, null, 2));
        }
    } catch (err) {
        console.error('Error:', err?.response?.data || err.message);
    }
}

checkToken();
