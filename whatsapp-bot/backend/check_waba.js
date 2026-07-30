require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function checkWaba() {
    try {
        const phoneRes = await axios.get(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,account_mode`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Phone info:', phoneRes.data);

        // Get WABA ID via debug_token or shared_whatsapp_business_accounts
        const tokenRes = await axios.get(
            `https://graph.facebook.com/v20.0/debug_token?input_token=${ACCESS_TOKEN}`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Token debug info:', tokenRes.data);
        
        const granular = tokenRes.data.data?.granular_scopes || [];
        const wabaScope = granular.find(s => s.scope === 'whatsapp_business_management');
        console.log('WABA IDs in scope:', wabaScope?.target_ids);

        if (wabaScope?.target_ids?.length > 0) {
            for (const wabaId of wabaScope.target_ids) {
                console.log(`\n--- Checking WABA ID: ${wabaId} ---`);
                try {
                    const tRes = await axios.get(
                        `https://graph.facebook.com/v20.0/${wabaId}/message_templates`,
                        { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
                    );
                    console.log(`Templates for ${wabaId}:`, tRes.data.data?.map(t => ({ name: t.name, status: t.status, category: t.category, language: t.language })));
                } catch (e) {
                    console.error(`Error for ${wabaId}:`, e?.response?.data || e.message);
                }
            }
        }
    } catch (err) {
        console.error('Error:', err?.response?.data || err.message);
    }
}

checkWaba();
