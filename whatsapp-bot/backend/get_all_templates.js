require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function getWabaTemplates() {
    try {
        const phoneRes = await axios.get(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=whatsapp_business_account`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        const wabaId = phoneRes.data.whatsapp_business_account?.id;
        console.log('Found WABA ID:', wabaId);

        if (wabaId) {
            const templatesRes = await axios.get(
                `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`,
                { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
            );
            console.log('Templates Count:', templatesRes.data.data?.length);
            (templatesRes.data.data || []).forEach(t => {
                console.log(`\n📌 Template: "${t.name}" | Status: ${t.status} | Category: ${t.category} | Lang: ${t.language}`);
                console.log('   Components:', JSON.stringify(t.components));
            });
        }
    } catch (err) {
        console.error('Error fetching templates:', err?.response?.data || err.message);
    }
}

getWabaTemplates();
