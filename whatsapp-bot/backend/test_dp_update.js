require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

async function updateProfilePicture() {
    const jpgPath = path.join(__dirname, 'public', 'logo_dp.jpg');
    const pngPath = path.join(__dirname, 'public', 'logo_dp.png');
    
    console.log('Testing Meta WhatsApp Profile Picture Upload Methods...\n');

    // --- Method 1: Direct profile_picture_url with 640x640 logo ---
    try {
        console.log('1. Trying profile_picture_url update with https://whatapp-automation-kxml.onrender.com/logo_dp.jpg ...');
        const urlRes = await axios.post(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/whatsapp_business_profile`,
            {
                messaging_product: 'whatsapp',
                profile_picture_url: 'https://whatapp-automation-kxml.onrender.com/logo_dp.jpg'
            },
            {
                headers: { 
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Method 1 Result:', urlRes.data);
    } catch (err) {
        console.error('Method 1 Error:', err?.response?.data || err.message);
    }

    // --- Method 2: Resumable Upload API via profile_picture_handle ---
    try {
        console.log('\n2. Trying Resumable Upload API (profile_picture_handle)...');
        const fileBuffer = fs.readFileSync(jpgPath);
        const fileLength = fileBuffer.length;

        // Step 2a: Create upload session
        console.log(`- Creating upload session for ${fileLength} bytes...`);
        const sessionRes = await axios.post(
            `https://graph.facebook.com/v19.0/app/uploads`,
            null,
            {
                params: {
                    file_length: fileLength,
                    file_type: 'image/jpeg'
                },
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                }
            }
        );
        console.log('- Upload Session Response:', sessionRes.data);
        const uploadHandle = sessionRes.data.id;

        // Step 2b: Upload binary data
        console.log(`- Uploading image data to handle ${uploadHandle}...`);
        const uploadRes = await axios.post(
            `https://graph.facebook.com/v19.0/${uploadHandle}`,
            fileBuffer,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'file_offset': '0',
                    'Content-Type': 'image/jpeg'
                }
            }
        );
        console.log('- Binary Upload Response:', uploadRes.data);
        const pictureHandle = uploadRes.data.h;

        // Step 2c: Update whatsapp_business_profile with picture handle
        console.log(`- Updating whatsapp_business_profile with handle ${pictureHandle}...`);
        const updateRes = await axios.post(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/whatsapp_business_profile`,
            {
                messaging_product: 'whatsapp',
                profile_picture_handle: pictureHandle
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Method 2 Result:', updateRes.data);
    } catch (err) {
        console.error('Method 2 Error:', err?.response?.data || err.message);
    }

    // --- Check Profile Data afterwards ---
    try {
        console.log('\n--- Fetching updated whatsapp_business_profile ---');
        const getRes = await axios.get(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
            {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            }
        );
        console.log('Profile Data:', JSON.stringify(getRes.data, null, 2));
    } catch (err) {
        console.error('Get Profile Error:', err?.response?.data || err.message);
    }
}

updateProfilePicture();
