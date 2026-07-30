require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function checkTemplates() {
    try {
        // 1. Get WABA ID from Phone Number ID
        console.log(`Checking Phone Number Details for ID: ${PHONE_NUMBER_ID}...`);
        const phoneRes = await axios.get(
            `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}?fields=id,display_phone_number,name_status,whatsapp_business_account`,
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
        );
        console.log('Phone Number Details:', phoneRes.data);

        const wabaId = phoneRes.data.whatsapp_business_account?.id;
        if (wabaId) {
            console.log(`\nFetching Message Templates for WABA ID: ${wabaId}...`);
            const templateRes = await axios.get(
                `https://graph.facebook.com/v20.0/${wabaId}/message_templates`,
                { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
            );
            console.log('\nApproved Message Templates count:', templateRes.data.data?.length || 0);
            (templateRes.data.data || []).forEach(t => {
                console.log(`- Template Name: "${t.name}" | Status: ${t.status} | Category: ${t.category} | Language: ${t.language}`);
                console.log('  Components:', JSON.stringify(t.components));
            });
        }
    } catch (err) {
        console.error('Error fetching templates:', err?.response?.data || err.message);
    }
}

checkTemplates();
