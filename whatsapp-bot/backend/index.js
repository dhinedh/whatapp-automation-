require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors({
  origin: [
    'https://testbot-gray-rho.vercel.app',
    'https://whatapp-automation-xi.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ]
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whatsapp-crm';
const SALES_TEAM_PHONE = process.env.SALES_TEAM_PHONE || '';
const GOOGLE_SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK || '';

// --- MongoDB Setup ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const contactSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    name: { type: String },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    messages: [{
        text: String,
        time: { type: Date, default: Date.now }
    }],
    selected_service: { type: String, default: "" },
    area_required: { type: String, default: "" },
    site_location: { type: String, default: "" },
    project_timeline: { type: String, default: "" },
    budget_range: { type: String, default: "" },
    quote_step: { type: Number, default: 0 },
    lead_status: { type: String, default: "New" },
    lead_score: { type: Number, default: 0 },
    is_paused: { type: Boolean, default: false },

    // Mansara Foods E-commerce Fields
    language: { type: String, default: "en" }, // 'en', 'hi'
    consent: { type: Boolean, default: null }, // true, false, null
    consentDate: { type: Date },
    cart: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number
    }],
    wishlist: [String],
    address: { type: String, default: "" },
    orders: [{
        orderId: String,
        items: [{
            productId: String,
            name: String,
            price: Number,
            quantity: Number
        }],
        subtotal: Number,
        discount: Number,
        total: Number,
        status: { type: String, default: "Placed" }, // Placed, Packed, Shipped, Delivered, Cancelled
        paymentStatus: { type: String, default: "Pending" }, // Pending, Paid, COD
        trackingLink: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
    }],
    loyaltyPoints: { type: Number, default: 0 },
    tickets: [{
        ticketId: String,
        subject: String,
        status: { type: String, default: "Open" }, // Open, Resolved
        createdAt: { type: Date, default: Date.now }
    }],
    step: { type: String, default: "welcome" }, // welcome, consent_pending, language_selection, main_menu, checkout_address, checkout_payment_mode, payment_pending, coupon_entry, orders_menu, reschedule_entry, cancel_entry, support_menu, ticket_entry
    funnelState: { type: String, default: "onboarding" } // onboarding, browsing, cart, checkout, completed
});

const Contact = mongoose.model('Contact', contactSchema);

// --- Mansara Foods Products Database (mansarafoods.com) ---
const PRODUCTS = [
    { id: "prod_ragi_choco", name: "Mansara Ragi Choco Malt (250g)", category: "Health Mixes", price: 250, stock: 80, description: "Nutritious health drink mix combining pure Ragi (finger millet) with rich cocoa." },
    { id: "prod_nutriminix", name: "Nutriminix Multi-Grain Health Mix (250g)", category: "Health Mixes", price: 200, stock: 100, description: "Traditional health mix with Kavuni black rice, samba wheat, barley & millets." },
    { id: "prod_paruppu_podi", name: "Homestyle Paruppu Rice Mix Podi (100g)", category: "Rice Mixes & Podi", price: 85, stock: 150, description: "Authentic South Indian roasted lentil rice mix powder." },
    { id: "prod_pirandai_podi", name: "Pirandai Power Rice Mix Podi (100g)", category: "Rice Mixes & Podi", price: 85, stock: 120, description: "Herbal Veldt Grape rice mix powder, traditional recipe for digestion & joint health." },
    { id: "prod_karuveppilai_podi", name: "Karuveppilai Special Rice Mix Podi (100g)", category: "Rice Mixes & Podi", price: 85, stock: 90, description: "Aromatic Curry Leaves rice powder rich in natural iron & traditional flavor." },
    { id: "prod_kothamalli_podi", name: "Kothamalli Aroma Rice Mix Podi (100g)", category: "Rice Mixes & Podi", price: 68, stock: 75, description: "Fresh Coriander rice mix powder packed with authentic herbal goodness." },
    { id: "prod_rice_combo", name: "5-Flavor Traditional Rice Mix Podi Combo (5x100g)", category: "Combos & Packs", price: 400, stock: 40, description: "Special value pack featuring 5 authentic traditional rice mix podi varieties." }
];

// --- Send Message Functions ---
async function sendMessage(to, text) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: { messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } }
        });
    } catch (error) {
        console.error("Error sending message:", error.response ? error.response.data : error.message);
    }
}

async function sendInteractiveButtons(to, bodyText, buttonsArray) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    const buttons = buttonsArray.map((btn) => ({
        type: "reply",
        reply: { id: btn.id, title: btn.title.substring(0, 20) }
    }));

    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'interactive',
                interactive: { type: 'button', body: { text: bodyText }, action: { buttons } }
            }
        });
    } catch (error) {
        console.error("Error sending buttons:", error.response ? error.response.data : error.message);
    }
}

async function sendInteractiveList(to, bodyText, buttonText, sections) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'interactive',
                interactive: { 
                    type: 'list', 
                    body: { text: bodyText }, 
                    action: { 
                        button: buttonText.substring(0, 20),
                        sections: sections
                    } 
                }
            }
        });
    } catch (error) {
        console.error("Error sending list:", error.response ? error.response.data : error.message);
    }
}

// --- Lead Scoring ---
function calculateLeadScore(contact) {
    let score = 0;
    // Base score on orders count
    score += (contact.orders ? contact.orders.length * 20 : 0);
    // Base score on loyalty points
    score += Math.min(contact.loyaltyPoints || 0, 50);
    // Base score on opt-in
    if (contact.consent) score += 20;
    // Base score on active cart items
    if (contact.cart && contact.cart.length > 0) score += 15;
    return score;
}

// --- Multilingual Bot Messages Dictionary ---
const MESSAGES = {
    en: {
        welcome: "🌿 *Welcome to Mansara Foods!* 🌿\n\nPure, Traditional, and Healthy Food Products (Health Mixes, Rice Mix Podis & Herbal Foods) delivered directly to your doorstep.\n\n🏆 Traditional & Natural Recipes\n✅ Homestyle Quality & Authentic Taste\n✅ Zero Preservatives or Chemicals\n✅ PAN India Fast Delivery\n\nDo you consent to receive order updates, catalog details, and special offers from us on WhatsApp? (WhatsApp Policy Compliance)\n\n1️⃣ Yes, I agree & opt-in\n2️⃣ No, continue as Guest",
        opt_in_thank_you: "Thank you for opting in! 🌿 We will keep you updated with our latest traditional health products and exclusive offers.",
        opt_out_thank_you: "No problem! You are now browsing in Guest Mode. You won't receive promotional alerts. You can type 'START' anytime to opt back in.",
        language_select: "🇬🇧 *Please select your preferred language:*\n\n1️⃣ English\n2️⃣ Tamil / தமிழ்",
        main_menu: "👋 *Welcome to Mansara Foods!* 🌿\n\nHow can we serve you today?\n\n*1️⃣ View Products 📁*\n*2️⃣ Place an Order 🛒*\n*3️⃣ Track My Order 📦*\n*4️⃣ Dealer Registration 🤝*\n*5️⃣ Bulk Orders 📦*\n*6️⃣ Offers & Discounts 🎟️*\n*7️⃣ Recipes 🍳*\n*8️⃣ Store Locator 📍*\n*9️⃣ Customer Support 💬*\n*🔟 Contact Sales Team 👤*\n\n_Reply with a number (1-10) or tap the button below to choose from the menu list._",
        catalog_menu: "📁 *Mansara Product Categories* 📁\n\nTap the button below or reply with a number to view products:\n\n*1️⃣ Health Mixes & Porridge 🥣*\n*2️⃣ Rice Mixes & Podi 🌾*\n*3️⃣ Combos & Value Packs 🎁*\n\n_4️⃣ Back to Main Menu 🏠_",
        cart_empty: "🛒 *Your Cart is Empty!*\n\nBrowse our traditional food categories to add delicious, health-boosting items.",
        invalid_option: "😊 I didn't quite understand that. Please reply with a valid option or number, or tap a button below to navigate.",
        checkout_address: "💳 *Checkout - Shipping Details*\n\nPlease type your complete delivery address (Street, City, Pincode):",
        checkout_pay_mode: "📍 *Delivery Address Saved!*\n\nAddress: {address}\n\nHow would you like to pay?\n\n*1️⃣ Pay Online (UPI, Card, NetBanking)*\n*2️⃣ Cash on Delivery (COD)*",
        payment_pending: "💳 *Secure Online Payment*\n\nOrder ID: *{orderId}*\nTotal Amount: *₹{total}*\n\n👉 Complete payment securely using our official portal: https://mansarafoods.com/pay/{orderId}\n\nOnce completed, click the button below or reply 'CONFIRM' to verify.",
        cod_success: "🎉 *Order Confirmed!*\n\nOrder ID: *{orderId}*\nTotal: *₹{total}*\nPayment: *Cash on Delivery (COD)*\n\n✅ We are preparing your fresh order for dispatch! Tracking link will be sent shortly.\n🎁 You earned *{points} loyalty points*!",
        online_success: "🎉 *Payment Received & Order Confirmed!*\n\nOrder ID: *{orderId}*\nTotal Paid: *₹{total}*\n\n✅ Your payment has been verified. We will notify you when it ships!\n🎁 You earned *{points} loyalty points*!",
        support_menu: "💬 *Mansara Help Center* 💬\n\nSelect a topic to view details:\n\n*1️⃣ Shipping & Delivery Policy*\n*2️⃣ Return, Refund & Exchange Policy*\n*3️⃣ Natural Ingredients & Health Mix Benefits*\n*4️⃣ Report an Issue / Raise a Ticket*\n*5️⃣ Talk to a Live Agent 👤*\n*6️⃣ Back to Main Menu 🏠*",
        ticket_success: "✅ *Ticket Created Successfully!*\n\nTicket ID: *{ticketId}*\nSubject: {subject}\n\nOur customer support representative will review it and reply within 12 hours. Thank you!",
        no_orders: "📦 You haven't placed any orders yet. Start shopping to create one!",
        loyalty_info: "🎁 *Mansara Loyalty Rewards* 🎁\n\nEarn points on every purchase and redeem them for discounts!\n\n*Your Points Balance:* {points} points\n*Value:* ₹{points}\n\n💡 *How it works:*\n- Earn 5% of order value as points on every order.\n- 1 point = ₹1.\n- Points are automatically applied as a discount on your next order!\n\nTap below to shop healthy!",
        opt_out_success: "Unsubscribed successfully. You will not receive any more marketing broadcasts. Reply 'START' to subscribe again.",
        coupon_entry: "🎟️ *Enter Coupon Code:*\n\nType the coupon code (e.g. *SAVE10* for 10% off) or reply with 'CANCEL' to go back:"
    },
    ta: {
        welcome: "🌿 *மன்சரா ஃபுட்ஸ்-க்கு உங்களை வரவேற்கிறோம்!* 🌿\n\nதூய்மையான, பாராம்பரிய மற்றும் ஆரோக்கிய உணவு பொருட்கள் (சத்து மாவுகள், சாதப் பொடிகள் & மூலிகை உணவுகள்) உங்கள் வீட்டிற்கே நேரடியாக விநியோகிக்கப்படும்.\n\n🏆 பாரம்பரிய மற்றும் இயற்கை செய்முறைகள்\n✅ உயர் தரம் & வீட்டுமுறை சுவை\n✅ ரசாயனங்கள் அல்லது பாதுகாப்புகள் இல்லை\n✅ இந்தியா முழுவதும் விரைவான விநியோகம்\n\nவாட்ஸ்அப்பில் எங்களிடமிருந்து தயாரிப்பு பட்டியல்கள் மற்றும் சலுகைகளைப் பெற ஒப்புக்கொள்கிறீர்களா?\n\n1️⃣ ஆம், நான் ஒப்புக்கொள்கிறேன் & இணைகிறேன்\n2️⃣ இல்லை, விருந்தினராக தொடரவும்",
        opt_in_thank_you: "ஒப்புக்கொண்டதற்கு நன்றி! 🌿 எங்கள் சமீபத்திய தயாரிப்புகள் மற்றும் பிரத்யேக சலுகைகளை உங்களுக்கு வாட்ஸ்அப்பில் அறிவிப்போம்.",
        opt_out_thank_you: "பரவாயில்லை! நீங்கள் இப்போது விருந்தினர் பயன்முறையில் உலாவுகிறீர்கள். உங்களுக்கு விளம்பர விழிப்பூட்டல்கள் கிடைக்காது. மீண்டும் இணைய எப்போது வேண்டுமானாலும் 'START' என டைப் செய்யவும்.",
        language_select: "🇬🇧 *தயவுசெய்து உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்:*\n\n1️⃣ English\n2️⃣ Tamil / தமிழ்",
        main_menu: "👋 *மன்சரா ஃபுட்ஸ்-க்கு உங்களை வரவேற்கிறோம்!* 🌿\n\nஇன்று நாங்கள் உங்களுக்கு எவ்வாறு உதவலாம்?\n\n*1️⃣ தயாரிப்புகளைப் பார்க்க 📁*\n*2️⃣ ஆர்டர் செய்ய 🛒*\n*3️⃣ ஆர்டரைக் கண்காணிக்க 📦*\n*4️⃣ டீலர் பதிவு 🤝*\n*5️⃣ மொத்த ஆர்டர்கள் 📦*\n*6️⃣ சலுகைகள் & தள்ளுபடிகள் 🎟️*\n*7️⃣ சமையல் குறிப்புகள் 🍳*\n*8️⃣ கடைகள் இருப்பிடம் 📍*\n*9️⃣ வாடிக்கையாளர் ஆதரவு 💬*\n*🔟 விற்பனை குழுவை தொடர்பு கொள்ள 👤*\n\n_எண்ணைக் கொண்டு (1-10) பதிலளிக்கவும் அல்லது மெனுவில் தேர்ந்தெடுக்கவும்_",
        catalog_menu: "📁 *மன்சரா தயாரிப்பு வகைகள்* 📁\n\nதயாரிப்புகளைப் பார்க்க கீழே உள்ள பட்டனை தட்டவும் அல்லது எண்ணைக் கொண்டு பதிலளிக்கவும்:\n\n*1️⃣ சத்து மாவுகள் & ஹெல்த் மிக்ஸ் 🥣*\n*2️⃣ சாதப் பொடிகள் & பொடி வகைகள் 🌾*\n*3️⃣ சிறப்பு காம்போ பேக்குகள் 🎁*\n\n_4️⃣ முதன்மை பட்டிக்குத் திரும்புக 🏠_",
        cart_empty: "🛒 *உங்கள் கார்ட் காலியாக உள்ளது!*\n\nஆரோக்கியமான பொருட்களைச் சேர்க்க தயாரிப்பு வகைகளை உலாவுங்கள்.",
        invalid_option: "😊 என்னால் அதைப் புரிந்து கொள்ள முடியவில்லை. தயவுசெய்து சரியான விருப்பத்தைத் தேர்ந்தெடுக்கவும் அல்லது கீழே உள்ள பட்டனை தட்டவும்.",
        checkout_address: "💳 *செக்அவுட் - விநியோக விவரங்கள்*\n\nதயவுசெய்து உங்கள் முழுமையான விநியோக முகவரியைத் தட்டச்சு செய்யவும் (தெரு, நகரம், பின்கோடு):",
        checkout_pay_mode: "📍 *விநியோக முகவரி சேமிக்கப்பட்டது!*\n\nமுகவரி: {address}\n\nநீங்கள் எவ்வாறு செலுத்த விரும்புகிறீர்கள்?\n\n*1️⃣ ஆன்லைனில் செலுத்த (UPI, கார்டு, நெட்பேங்கிங்)*\n*2️⃣ கேஷ் ஆன் டெலிவரி (COD)*",
        payment_pending: "💳 *பாதுகாப்பான ஆன்லைன் கட்டணம்*\n\nஆர்டர் ஐடி: *{orderId}*\nமொத்த தொகை: *₹{total}*\n\n👉 பாதுகாப்பாக பணம் செலுத்த இந்த இணைப்பைப் பயன்படுத்தவும்: https://mansarafoods.com/pay/{orderId}\n\nமுற்றுப்பெற்றதும், 'CONFIRM' என்று பதிலளிக்கவும் அல்லது கீழே உள்ள பட்டனைத் தட்டவும்.",
        cod_success: "🎉 *ஆர்டர் உறுதி செய்யப்பட்டது!*\n\nஆர்டர் ஐடி: *{orderId}*\nமொத்தம்: *₹{total}*\nகட்டண முறை: *கேஷ் ஆன் டெலிவரி (COD)*\n\n✅ நாங்கள் உங்கள் ஆர்டரைத் தயாரிக்கிறோம்! டிராக்கிங் இணைப்பு விரைவில் அனுப்பப்படும்.\n🎁 நீங்கள் *{points} லாயல்டி புள்ளிகள்* பெற்றுள்ளீர்கள்!",
        online_success: "🎉 *கட்டணம் பெறப்பட்டு ஆர்டர் உறுதி செய்யப்பட்டது!*\n\nஆர்டர் ஐடி: *{orderId}*\nமொத்த கட்டணம்: *₹{total}*\n\n✅ உங்கள் கட்டணம் சரிபார்க்கப்பட்டது. ஆர்டர் அனுப்பப்படும் போது உங்களுக்கு அறிவிப்போம்!\n🎁 நீங்கள் *{points} லாயல்டி புள்ளிகள்* பெற்றுள்ளீர்கள்!",
        support_menu: "💬 *மன்சரா உதவி மையம்* 💬\n\nவிவரங்களைப் பார்க்க ஒரு தலைப்பைத் தேர்ந்தெடுக்கவும்:\n\n*1️⃣ ஷிப்பிங் மற்றும் டெலிவரி கொள்கை*\n*2️⃣ வருவாய் மற்றும் பணத்தைத் திரும்பப்பெறும் கொள்கை*\n*3️⃣ இயற்கை உணவுகள் & சத்து மாவுகளின் நன்மைகள்*\n*4️⃣ சிக்கலைப் புகாரளிக்க / டிக்கெட் உருவாக்க*\n*5️⃣ எஜென்ட்டிடம் பேச 👤*\n*6️⃣ முதன்மை பட்டிக்குத் திரும்புக 🏠*",
        ticket_success: "✅ *டிக்கெட் வெற்றிகரமாக உருவாக்கப்பட்டது!*\n\nடிக்கெட் ஐடி: *{ticketId}*\nதலைப்பு: {subject}\n\nஎங்கள் வாடிக்கையாளர் ஆதரவு குழு இதை 12 மணி நேரத்திற்குள் சரிபார்த்து பதிலளிக்கும். நன்றி!",
        no_orders: "📦 நீங்கள் இன்னும் எந்த ஆர்டரும் செய்யவில்லை. ஆர்டர் செய்ய உலாவத் தொடங்குங்கள்!",
        loyalty_info: "🎁 *மன்சரா லாயல்டி வெகுமதிகள்* 🎁\n\nஒவ்வொரு வாங்குதலுக்கும் புள்ளிகளைப் பெற்று அவற்றை தள்ளுபடியாகப் பயன்படுத்துங்கள்!\n\n*உங்கள் லாயல்டி புள்ளிகள்:* {points} புள்ளிகள்\n*மதிப்பு:* ₹{points}\n\n💡 *இது எப்படி செயல்படுகிறது:*\n- ஒவ்வொரு ஆர்டருக்கும் 5% லாயல்டி புள்ளிகள் கிடைக்கும்.\n- 1 புள்ளி = ₹1.\n- உங்கள் அடுத்த ஆர்டரில் புள்ளிகள் தள்ளுபடியாகக் கழிக்கப்படும்!\n\nஆரோக்கியமான பொருட்களை வாங்க கீழே தட்டவும்!",
        opt_out_success: "வெற்றிகரமாக விலகினீர்கள். இனி உங்களுக்கு விளம்பர செய்திகள் வராது. மீண்டும் இணைய 'START' என பதிலளிக்கவும்.",
        coupon_entry: "🎟️ *கியூபொன் குறியீடு உள்ளிடவும்:*\n\nஉங்கள் கியூபொன் குறியீட்டை டைப் செய்யவும் (எ.கா. 10% தள்ளுபடிக்கு *SAVE10*) அல்லது முந்தைய மெனுவிற்கு செல்ல 'CANCEL' என டைப் செய்யவும்:"
    }
};

// --- Chatbot Logic ---
async function handleBotReply(phone, messageText, contact) {
    if (contact.is_paused) return; // Human takeover active

    const msg = messageText.toLowerCase().trim();
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;

    // Compliance Check: Opt-out (STOP) / Opt-in (START)
    if (msg === 'stop' || msg === 'unsubscribe') {
        contact.consent = false;
        contact.step = 'opt_out';
        contact.funnelState = 'onboarding';
        await contact.save();
        await sendMessage(phone, t.opt_out_success);
        return;
    }
    if (msg === 'start' || msg === 'subscribe') {
        contact.consent = true;
        contact.consentDate = new Date();
        contact.step = 'main_menu';
        contact.funnelState = 'browsing';
        await contact.save();
        await sendInteractiveButtons(phone, t.opt_in_thank_you + "\n\n" + t.main_menu, [
            { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "कैटलॉग देखें 📁" },
            { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "कार्ट देखें 🛒" },
            { id: "btn_support", title: lang === 'en' ? "Support 💬" : "सहायता 💬" }
        ]);
        return;
    }

    // Human Takeover / Live Agent Request
    if (msg === "6" || msg === "btn_human" || msg.includes("human") || msg.includes("agent") || msg.includes("talk to someone")) {
        contact.is_paused = true;
        contact.step = 'human_takeover';
        await contact.save();
        
        const handoffMsg = lang === 'en' 
            ? `👋 *Connecting you to our team!*\n\nOur team member will respond shortly.\n\n📞 *Direct Call/WhatsApp:* +91 96000 67611\n_Hours: 9 AM - 6 PM (Mon-Sat)_`
            : `👋 *आपको हमारी टीम से जोड़ रहे हैं!*\n\nहमारा टीम सदस्य जल्द ही जवाब देगा।\n\n📞 *सीधा कॉल/व्हाट्सएप:* +91 96000 67611\n_समय: सुबह 9 बजे से शाम 6 बजे तक_`;
        
        await sendMessage(phone, handoffMsg);
        
        if (SALES_TEAM_PHONE) {
            await sendMessage(SALES_TEAM_PHONE, `⚠️ *LIVE AGENT HANDOFF REQUIRED*\nCustomer: ${contact.name || phone} (${phone})\nLanguage: ${lang}\nNeeds human assistance.`);
        }
        return;
    }

    // --- ONBOARDING FLOW: CONSENT ---
    if (contact.consent === null && contact.step !== 'consent_pending') {
        contact.step = 'consent_pending';
        await contact.save();
        await sendInteractiveButtons(phone, MESSAGES.en.welcome + "\n\n" + MESSAGES.ta.welcome, [
            { id: "btn_opt_in_yes", title: "Yes, I agree" },
            { id: "btn_opt_in_no", title: "No, Guest Mode" }
        ]);
        return;
    }

    if (contact.step === 'consent_pending') {
        if (msg === '1' || msg === 'btn_opt_in_yes' || msg.includes('yes') || msg.includes('agree')) {
            contact.consent = true;
            contact.consentDate = new Date();
            contact.step = 'language_selection';
            await contact.save();
            await sendInteractiveButtons(phone, MESSAGES.en.language_select, [
                { id: "btn_lang_en", title: "English" },
                { id: "btn_lang_ta", title: "தமிழ் / Tamil" }
            ]);
        } else if (msg === '2' || msg === 'btn_opt_in_no' || msg.includes('no') || msg.includes('guest')) {
            contact.consent = false;
            contact.step = 'language_selection';
            await contact.save();
            await sendInteractiveButtons(phone, MESSAGES.en.language_select, [
                { id: "btn_lang_en", title: "English" },
                { id: "btn_lang_ta", title: "தமிழ் / Tamil" }
            ]);
        } else {
            await sendMessage(phone, "Please select an option by tapping a button or replying with 1 or 2.");
        }
        return;
    }

    // --- ONBOARDING FLOW: LANGUAGE ---
    if (contact.step === 'language_selection') {
        if (msg === '1' || msg === 'btn_lang_en' || msg.includes('english')) {
            contact.language = 'en';
            contact.step = 'main_menu';
            contact.funnelState = 'browsing';
            await contact.save();
            await sendMainMenu(phone, contact);
        } else if (msg === '2' || msg === 'btn_lang_ta' || msg.includes('tamil')) {
            contact.language = 'ta';
            contact.step = 'main_menu';
            contact.funnelState = 'browsing';
            await contact.save();
            await sendMainMenu(phone, contact);
        } else {
            await sendMessage(phone, "Please choose language / மொழியைத் தேர்ந்தெடுக்கவும்:\n1 - English\n2 - Tamil");
        }
        return;
    }

    // Main Menu navigation from buttons or text
    if (msg === 'btn_menu' || msg === 'main menu' || msg === 'menu') {
        contact.step = 'main_menu';
        await contact.save();
        await sendMainMenu(phone, contact);
        return;
    }

    // --- PROCESS DEALER REGISTRATION & BULK ORDER INPUTS ---
    if (contact.step === 'dealer_registration') {
        contact.step = 'main_menu';
        contact.lead_status = 'Dealer Lead';
        contact.tickets.push({ ticketId: `DLR-${Date.now().toString().slice(-4)}`, subject: `Dealer Reg: ${messageText.slice(0, 30)}` });
        await contact.save();
        const ackMsg = lang === 'en'
            ? `✅ *Dealer Registration Received!*\n\nThank you! Our wholesale manager will review your submission and contact you shortly.`
            : `✅ *டீலர் பதிவு பெறப்பட்டது!*\n\nநன்றி! எங்கள் குழு விரைவில் உங்களைத் தொடர்பு கொள்ளும்.`;
        await sendInteractiveButtons(phone, ackMsg, [{ id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }]);
        return;
    }

    if (contact.step === 'bulk_orders') {
        contact.step = 'main_menu';
        contact.lead_status = 'Bulk Order Enquiry';
        contact.tickets.push({ ticketId: `BLK-${Date.now().toString().slice(-4)}`, subject: `Bulk Enquiry: ${messageText.slice(0, 30)}` });
        await contact.save();
        const ackMsg = lang === 'en'
            ? `✅ *Bulk Order Inquiry Submitted!*\n\nThank you! Our B2B sales team will calculate your volume discount and reply with a formal quote shortly.`
            : `✅ *மொத்த ஆர்டர் கோரிக்கை சமர்ப்பிக்கப்பட்டது!*\n\nநன்றி! எங்கள் விற்பனைக் குழு விரைவில் விலை விவரங்களை அனுப்பும்.`;
        await sendInteractiveButtons(phone, ackMsg, [{ id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }]);
        return;
    }

    // --- PROCESS MAIN MENU OPTIONS (1 to 10) ---
    if (contact.step === 'main_menu' || msg.startsWith('opt_')) {
        // Option 1: View Products
        if (msg === '1' || msg === 'opt_1_products' || msg.includes('product') || msg.includes('browse') || msg === 'btn_catalog') {
            await sendCatalogMenu(phone, contact);
            return;
        }
        // Option 2: Place an Order
        if (msg === '2' || msg === 'opt_2_order' || msg.includes('place order') || msg.includes('checkout') || msg === 'btn_cart') {
            await sendCartView(phone, contact);
            return;
        }
        // Option 3: Track My Order
        if (msg === '3' || msg === 'opt_3_track' || msg.includes('track') || msg.includes('my order') || msg === 'btn_orders') {
            await sendOrdersMenu(phone, contact);
            return;
        }
        // Option 4: Dealer Registration
        if (msg === '4' || msg === 'opt_4_dealer' || msg.includes('dealer') || msg.includes('distributor') || msg.includes('partner')) {
            contact.step = 'dealer_registration';
            await contact.save();
            const dealerMsg = lang === 'en'
                ? `🤝 *Mansara Foods Dealer Registration* 🤝\n\nPartner with us to distribute authentic organic health mixes & traditional food products in your region!\n\nPlease reply with your details:\n1. Your Name / Business Name\n2. City / District & State\n3. Contact Phone Number & Email\n\nOur partnership team will get in touch with you within 24 hours.`
                : `🤝 *மன்சரா ஃபுட்ஸ் டீலர் பதிவு* 🤝\n\nஉங்கள் பகுதியில் எங்கள் பாரம்பரிய உணவுப் பொருட்களை விநியோகிக்க எங்களோடு இணையுங்கள்!\n\nதயவுசெய்து உங்கள் விவரங்களை எழுதவும்:\n1. உங்கள் பெயர் / வணிகப் பெயர்\n2. மாவட்டம் & மாநிலம்\n3. தொலைபேசி எண்\n\nஎங்கள் குழு 24 மணி நேரத்திற்குள் உங்களைத் தொடர்பு கொள்ளும்.`;
            await sendMessage(phone, dealerMsg);
            return;
        }
        // Option 5: Bulk Orders
        if (msg === '5' || msg === 'opt_5_bulk' || msg.includes('bulk') || msg.includes('wholesale')) {
            contact.step = 'bulk_orders';
            await contact.save();
            const bulkMsg = lang === 'en'
                ? `📦 *Mansara Bulk & Wholesale Orders* 📦\n\nWe supply bulk quantities for corporate gifting, events, restaurants & institutions.\n\nPlease type the products and quantity you require (e.g. *50 Packs Ragi Choco Malt, 100 Packs Paruppu Podi*).\n\nOur B2B sales team will send you custom wholesale pricing!`
                : `📦 *மன்சரா மொத்த மற்றும் மொத்த விற்பனை ஆர்டர்கள்* 📦\n\nநிறுவனங்கள், விழாக்கள் மற்றும் உணவகங்களுக்கு மொத்தமாக விநியோகம் செய்கிறோம்.\n\nஉங்களுக்குத் தேவையான பொருட்கள் மற்றும் அளவைக் குறிப்பிடவும்.\n\nஎங்கள் விற்பனைக் குழு உங்களுக்கு பிரத்யேக மொத்த விலையை அனுப்பும்!`;
            await sendMessage(phone, bulkMsg);
            return;
        }
        // Option 6: Offers & Discounts
        if (msg === '6' || msg === 'opt_6_offers' || msg.includes('offer') || msg.includes('discount') || msg.includes('coupon')) {
            await sendLoyaltyInfo(phone, contact);
            return;
        }
        // Option 7: Recipes
        if (msg === '7' || msg === 'opt_7_recipes' || msg.includes('recipe') || msg.includes('dish') || msg.includes('cook')) {
            const recipeMsg = lang === 'en'
                ? `🍳 *Mansara Healthy Traditional Recipes* 🍳\n\nTry these delicious, nutrient-rich dishes at home:\n\n🥣 *1. Ragi Choco Malt Drink:* Mix 2 tsp Mansara Ragi Choco Malt in warm milk/water. Stir well & enjoy a healthy energy boost!\n\n🌾 *2. Kavuni Multigrain Porridge:* Boil 3 tbsp Nutriminix Health Mix with 2 cups of water. Add a pinch of salt & fresh buttermilk.\n\n🍚 *3. Authentic Podi Rice:* Mix 2 tbsp Paruppu or Pirandai Podi with hot steamed rice and a spoonful of pure Ghee.\n\nTap below to buy the ingredients!`
                : `🍳 *மன்சரா ஆரோக்கியமான பாரம்பரிய செய்முறைகள்* 🍳\n\nசுவையான ஆரோக்கிய உணவுகள்:\n\n🥣 *1. ராகி சோக்கோ மால்ட்:* 2 ஸ்பூன் மன்சரா ராகி சோக்கோ மால்ட்டை வெதுவெதுப்பான பாலில் கலந்து குடிக்கவும்.\n\n🌾 *2. சத்து மாவு கஞ்சி:* 3 ஸ்பூன் நியூட்ரிமினிக்ஸ் சத்து மாவை 2 கப் தண்ணீரில் கொதிக்க வைத்து, சிறிதளவு உப்பு மற்றும் மோர் சேர்க்கவும்.\n\n🍚 *3. சுவையான பொடி சாதம்:* சூடான சாதத்தில் 2 ஸ்பூன் பருப்பு அல்லது பிரண்டை பொடி மற்றும் நெய் கலந்து சாப்பிடவும்.`;
            await sendInteractiveButtons(phone, recipeMsg, [
                { id: "btn_catalog", title: lang === 'en' ? "Shop Ingredients 🛍️" : "பொருட்கள் வாங்க 🛍️" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);
            return;
        }
        // Option 8: Store Locator
        if (msg === '8' || msg === 'opt_8_store' || msg.includes('store') || msg.includes('location') || msg.includes('address')) {
            const storeMsg = lang === 'en'
                ? `📍 *Mansara Foods Outlets & Online Store* 📍\n\n🏢 *Head Office & Experience Store:*\nMansara Foods Pvt Ltd, Chennai, Tamil Nadu - 600001\n📞 Support: +91 88388 87064\n\n🌐 *Official Online Shop:* https://mansarafoods.com\n🚚 *Delivery:* Fast delivery available across PAN India & select international locations.\n\nTap below to order online!`
                : `📍 *மன்சரா ஃபுட்ஸ் கடைகள் & ஆன்லைன் ஸ்டோர்* 📍\n\n🏢 *தலைமை அலுவலகம்:*\nமன்சரா ஃபுட்ஸ் பிரைவேட் லிமிடெட், சென்னை, தமிழ்நாடு.\n📞 உதவி: +91 88388 87064\n\n🌐 *ஆன்லைன் கடை:* https://mansarafoods.com\n🚚 *டெலிவரி:* இந்தியா முழுவதும் விரைவான விநியோகம்.`;
            await sendInteractiveButtons(phone, storeMsg, [
                { id: "btn_catalog", title: lang === 'en' ? "Order Online 🛍️" : "ஆன்லைனில் ஆர்டர் செய்ய 🛍️" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);
            return;
        }
        // Option 9: Customer Support
        if (msg === '9' || msg === 'opt_9_support' || msg.includes('support') || msg.includes('help') || msg === 'btn_support') {
            await sendSupportMenu(phone, contact);
            return;
        }
        // Option 10: Contact Sales Team
        if (msg === '10' || msg === 'opt_10_sales' || msg.includes('sales') || msg.includes('contact') || msg.includes('human') || msg === 'btn_human') {
            contact.is_paused = true;
            contact.step = 'human_takeover';
            await contact.save();
            
            const handoffMsg = lang === 'en' 
                ? `👋 *Connecting you to the Mansara Sales Team!*\n\nOur team representative will respond to your chat shortly.\n\n📞 *Direct Phone / WhatsApp:* +91 88388 87064 / +91 79045 07105\n_Hours: 9 AM - 7 PM (Mon-Sat)_`
                : `👋 *மன்சரா விற்பனைக் குழுவோடு உங்களை இணைக்கிறோம்!*\n\nஎங்கள் விற்பனை பிரதிநிதி விரைவில் பதிலளிப்பார்.\n\n📞 *தொடர்பு எண்:* +91 88388 87064 / +91 79045 07105`;
            
            await sendMessage(phone, handoffMsg);
            return;
        }
    }

    // --- PROCESS CATALOG CATEGORY SELECTIONS ---
    if (msg.startsWith('cat_') || ['health mixes', 'rice mixes', 'podi', 'combos'].includes(msg)) {
        let category = '';
        if (msg === 'cat_health_mixes' || msg.includes('health')) category = 'Health Mixes';
        else if (msg === 'cat_rice_podi' || msg.includes('podi') || msg.includes('rice')) category = 'Rice Mixes & Podi';
        else if (msg === 'cat_combos' || msg.includes('combo')) category = 'Combos & Packs';

        if (category) {
            await sendCategoryProducts(phone, category, contact);
            return;
        }
    }

    // Handle catalog navigation menu numbers
    if (contact.step === 'catalog_menu') {
        if (msg === '1') { await sendCategoryProducts(phone, 'Health Mixes', contact); return; }
        if (msg === '2') { await sendCategoryProducts(phone, 'Rice Mixes & Podi', contact); return; }
        if (msg === '3') { await sendCategoryProducts(phone, 'Combos & Packs', contact); return; }
        if (msg === '4') { contact.step = 'main_menu'; await contact.save(); await sendMainMenu(phone, contact); return; }
    }

    // --- ADD TO CART / WISHLIST ACTION ---
    if (msg.startsWith('add_prod_')) {
        const prodId = msg.replace('add_', '');
        const product = PRODUCTS.find(p => p.id === prodId);
        if (product) {
            const existingItem = contact.cart.find(item => item.productId === prodId);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                contact.cart.push({ productId: prodId, name: product.name, price: product.price, quantity: 1 });
            }
            contact.funnelState = 'cart';
            await contact.save();

            const cartMsg = lang === 'en'
                ? `🛒 Added *1x ${product.name}* to your cart!\nPrice: ₹${product.price}\n\nWhat would you like to do?`
                : `🛒 *1x ${product.name}* आपकी कार्ट में जोड़ा गया!\nकीमत: ₹${product.price}\n\nआप क्या करना चाहेंगे?`;

            await sendInteractiveButtons(phone, cartMsg, [
                { id: "btn_checkout", title: lang === 'en' ? "Checkout 💳" : "चेकआउट 💳" },
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "कार्ट देखें 🛒" },
                { id: "btn_catalog", title: lang === 'en' ? "Continue Shopping 🛍️" : "खरीदारी जारी रखें 🛍️" }
            ]);
            return;
        }
    }

    if (msg.startsWith('wish_prod_')) {
        const prodId = msg.replace('wish_', '');
        const product = PRODUCTS.find(p => p.id === prodId);
        if (product) {
            if (!contact.wishlist.includes(product.name)) {
                contact.wishlist.push(product.name);
                await contact.save();
            }
            const wishMsg = lang === 'en'
                ? `❤️ Added *${product.name}* to your Wishlist!`
                : `❤️ *${product.name}* आपकी विशलिस्ट में जोड़ा गया!`;
            await sendMessage(phone, wishMsg);
            await sendCategoryProducts(phone, product.category, contact);
            return;
        }
    }

    // --- CHECKOUT & CART MANIPULATION ---
    if (msg === 'btn_checkout' || (contact.step === 'cart_view' && msg === '1')) {
        if (contact.cart.length === 0) {
            await sendMessage(phone, t.cart_empty);
            await sendMainMenu(phone, contact);
            return;
        }
        contact.step = 'checkout_address';
        contact.funnelState = 'checkout';
        await contact.save();
        await sendMessage(phone, t.checkout_address);
        return;
    }

    if (contact.step === 'checkout_address') {
        contact.address = messageText;
        contact.step = 'checkout_payment_mode';
        await contact.save();

        const addressMsg = t.checkout_pay_mode.replace('{address}', contact.address);
        await sendInteractiveButtons(phone, addressMsg, [
            { id: "pay_online", title: lang === 'en' ? "1 - Pay Online" : "1 - ऑनलाइन भुगतान" },
            { id: "pay_cod", title: lang === 'en' ? "2 - Cash on Delivery" : "2 - कैश ऑन डिलीवरी" }
        ]);
        return;
    }

    if (contact.step === 'checkout_payment_mode') {
        const isOnline = msg === '1' || msg === 'pay_online' || msg.includes('online') || msg.includes('upi');
        const isCod = msg === '2' || msg === 'pay_cod' || msg.includes('cod') || msg.includes('delivery');

        if (isOnline || isCod) {
            // Create Order
            const subtotal = contact.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // Coupon check
            let discount = 0;
            if (contact.loyaltyPoints > 0) {
                // Auto redeem loyalty points
                discount = Math.min(contact.loyaltyPoints, subtotal);
                contact.loyaltyPoints -= discount;
            }

            const total = subtotal - discount;
            const orderId = `ORD-${Date.now().toString().slice(-6)}`;
            
            const orderItems = contact.cart.map(i => ({
                productId: i.productId,
                name: i.name,
                price: i.price,
                quantity: i.quantity
            }));

            const newOrder = {
                orderId,
                items: orderItems,
                subtotal,
                discount,
                total,
                status: "Placed",
                paymentStatus: isOnline ? "Pending" : "COD",
                trackingLink: `https://track.shiprocket.in/mansarafoods/${orderId}`,
                createdAt: new Date()
            };

            contact.orders.push(newOrder);
            contact.cart = []; // clear cart
            contact.funnelState = 'completed';

            if (isCod) {
                // COD Flow
                const earnedPoints = Math.floor(total * 0.05); // 5% points
                contact.loyaltyPoints += earnedPoints;
                contact.step = 'main_menu';
                await contact.save();

                const successMsg = t.cod_success
                    .replace('{orderId}', orderId)
                    .replace('{total}', total)
                    .replace('{points}', earnedPoints);

                await sendInteractiveButtons(phone, successMsg, [
                    { id: "btn_orders", title: lang === 'en' ? "Track Order 📦" : "ट्रैक करें 📦" },
                    { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "मुख्य मेनू 🏠" }
                ]);

                // Sync CRM Lead Webhook
                syncCrmOrder(contact, newOrder);
            } else {
                // Online Payment Flow
                contact.step = 'payment_pending';
                await contact.save();

                const successMsg = t.payment_pending
                    .replace('{orderId}', orderId)
                    .replace('{total}', total);

                await sendInteractiveButtons(phone, successMsg, [
                    { id: "confirm_payment", title: lang === 'en' ? "Confirm Payment ✅" : "भुगतान की पुष्टि ✅" },
                    { id: "cancel_pending_order", title: lang === 'en' ? "Cancel Order ❌" : "ऑर्डर रद्द करें ❌" }
                ]);
            }
            return;
        }
    }

    if (contact.step === 'payment_pending') {
        const lastOrder = contact.orders[contact.orders.length - 1];
        if (msg === 'confirm_payment' || msg === 'confirm' || msg === 'pay') {
            if (lastOrder && lastOrder.paymentStatus === 'Pending') {
                lastOrder.paymentStatus = 'Paid';
                const earnedPoints = Math.floor(lastOrder.total * 0.05);
                contact.loyaltyPoints += earnedPoints;
                contact.step = 'main_menu';
                await contact.save();

                const successMsg = t.online_success
                    .replace('{orderId}', lastOrder.orderId)
                    .replace('{total}', lastOrder.total)
                    .replace('{points}', earnedPoints);

                await sendInteractiveButtons(phone, successMsg, [
                    { id: "btn_orders", title: lang === 'en' ? "Track Order 📦" : "ट्रैक करें 📦" },
                    { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "मुख्य मेनू 🏠" }
                ]);

                syncCrmOrder(contact, lastOrder);
            }
            return;
        }

        if (msg === 'cancel_pending_order' || msg.includes('cancel')) {
            if (lastOrder && lastOrder.paymentStatus === 'Pending') {
                lastOrder.status = 'Cancelled';
                // Return loyalty points if redeemed
                if (lastOrder.discount > 0) {
                    contact.loyaltyPoints += lastOrder.discount;
                }
                contact.step = 'main_menu';
                await contact.save();

                await sendMessage(phone, lang === 'en' ? "❌ Order cancelled successfully." : "❌ ऑर्डर सफलतापूर्वक रद्द कर दिया गया।");
                await sendMainMenu(phone, contact);
            }
            return;
        }
    }

    // Apply Coupon entry
    if (contact.step === 'cart_view' && msg === '2') {
        contact.step = 'coupon_entry';
        await contact.save();
        await sendMessage(phone, t.coupon_entry || "🎟️ Enter Coupon Code (e.g. SAVE10):");
        return;
    }

    if (contact.step === 'coupon_entry') {
        if (msg === 'save10' || msg === 'welcome10') {
            contact.appliedCoupon = msg.toUpperCase();
            contact.step = 'main_menu';
            await contact.save();
            await sendMessage(phone, lang === 'en' ? "✅ Coupon applied! 10% discount added to your checkout total." : "✅ कूपन लागू! चेकआउट पर 10% की छूट जोड़ी गई है।");
            await sendCartView(phone, contact);
        } else {
            contact.step = 'main_menu';
            await contact.save();
            await sendMessage(phone, lang === 'en' ? "❌ Invalid coupon code. Returning to cart." : "❌ अमान्य कूपन कोड। कार्ट में वापस जा रहे हैं।");
            await sendCartView(phone, contact);
        }
        return;
    }

    if (contact.step === 'cart_view' && msg === '3') {
        contact.cart = [];
        contact.appliedCoupon = "";
        contact.step = 'main_menu';
        await contact.save();
        await sendMessage(phone, lang === 'en' ? "🗑️ Cart cleared successfully!" : "🗑️ कार्ट सफलतापूर्वक खाली की गई!");
        await sendMainMenu(phone, contact);
        return;
    }

    // --- ORDER STATUS & TRACKING MENU ---
    if (contact.step === 'orders_menu') {
        if (msg === '1') {
            await sendMessage(phone, lang === 'en' ? "📝 Please type your new address or instructions:" : "📝 कृपया अपना नया पता या निर्देश टाइप करें:");
            contact.step = 'reschedule_entry';
            await contact.save();
            return;
        }
        if (msg === '2') {
            await sendMessage(phone, lang === 'en' ? "❌ Please type the Order ID you wish to cancel (e.g. ORD-123456):" : "❌ कृपया रद्द करने के लिए ऑर्डर आईडी टाइप करें (जैसे ORD-123456):");
            contact.step = 'cancel_entry';
            await contact.save();
            return;
        }
        if (msg === '3') {
            contact.step = 'main_menu';
            await contact.save();
            await sendMainMenu(phone, contact);
            return;
        }
    }

    if (contact.step === 'reschedule_entry') {
        contact.address = messageText;
        contact.step = 'main_menu';
        await contact.save();
        await sendMessage(phone, lang === 'en' ? "✅ Delivery instruction received and updated in shipping system." : "✅ वितरण निर्देश प्राप्त हुआ और अपडेट कर दिया गया है।");
        await sendMainMenu(phone, contact);
        return;
    }

    if (contact.step === 'cancel_entry') {
        const orderIdToCancel = messageText.toUpperCase().trim();
        const orderToCancel = contact.orders.find(o => o.orderId === orderIdToCancel);
        if (orderToCancel) {
            if (orderToCancel.status === 'Placed') {
                orderToCancel.status = 'Cancelled';
                if (orderToCancel.discount > 0) {
                    contact.loyaltyPoints += orderToCancel.discount;
                }
                contact.step = 'main_menu';
                await contact.save();
                await sendMessage(phone, lang === 'en' ? `✅ Order ${orderIdToCancel} has been cancelled.` : `✅ ऑर्डर ${orderIdToCancel} रद्द कर दिया गया है।`);
            } else {
                contact.step = 'main_menu';
                await contact.save();
                await sendMessage(phone, lang === 'en' ? `❌ Cannot cancel order. Status is already ${orderToCancel.status}.` : `❌ ऑर्डर रद्द नहीं किया जा सकता। इसकी स्थिति पहले से ही ${orderToCancel.status} है।`);
            }
        } else {
            contact.step = 'main_menu';
            await contact.save();
            await sendMessage(phone, lang === 'en' ? "❌ Order ID not found." : "❌ ऑर्डर आईडी नहीं मिला।");
        }
        await sendMainMenu(phone, contact);
        return;
    }

    // --- SUPPORT & FAQ MENU ---
    if (contact.step === 'support_menu') {
        if (msg === '1') {
            const shipMsg = lang === 'en'
                ? "🚚 *Shipping & Delivery:*\nWe deliver PAN India. Orders in Tamil Nadu are delivered in 2-3 business days. Rest of India takes 4-7 days. Free shipping on orders above ₹500!"
                : "🚚 *शिपिंग और वितरण:*\nहम पूरे भारत में डिलीवरी करते हैं। तमिलनाडु में डिलीवरी 2-3 दिनों में होती है। शेष भारत में 4-7 दिन लगते हैं। ₹500 से अधिक के ऑर्डर पर मुफ्त शिपिंग!";
            await sendMessage(phone, shipMsg);
            await sendSupportMenu(phone, contact);
            return;
        }
        if (msg === '2') {
            const retMsg = lang === 'en'
                ? "🔄 *Returns & Refunds:*\nIf you receive a damaged or incorrect food item, report it within 48 hours for a 100% free replacement or refund. We do not accept returns for opened items due to food hygiene."
                : "🔄 *वापसी और धनवापसी:*\nयदि आपको क्षतिग्रस्त या गलत खाद्य उत्पाद मिलता है, तो मुफ्त प्रतिस्थापन या धनवापसी के लिए 48 घंटों के भीतर रिपोर्ट करें। खाद्य स्वच्छता के कारण हम खुली हुई वस्तुओं की वापसी स्वीकार नहीं करते हैं।";
            await sendMessage(phone, retMsg);
            await sendSupportMenu(phone, contact);
            return;
        }
        if (msg === '3') {
            const certMsg = lang === 'en'
                ? "🌿 *Organic Certifications:*\nAll our products are certified organic under India's National Programme for Organic Production (NPOP) and FSSAI standards. We source directly from sustainable organic farmers."
                : "🌿 *जैविक प्रमाणन:*\nहमारे सभी उत्पाद भारत के जैविक उत्पादन के लिए राष्ट्रीय कार्यक्रम (NPOP) और FSSAI मानकों के तहत प्रमाणित जैविक हैं। हम सीधे जैविक किसानों से प्राप्त करते हैं।";
            await sendMessage(phone, certMsg);
            await sendSupportMenu(phone, contact);
            return;
        }
        if (msg === '4') {
            contact.step = 'ticket_entry';
            await contact.save();
            await sendMessage(phone, lang === 'en' ? "🎫 *Submit a Ticket*\n\nPlease type a description of the problem you are facing (e.g. damaged Cashews packing, delay in delivery, payment issue):" : "🎫 *टिकट दर्ज करें*\n\nकृपया अपनी समस्या का विवरण लिखें (जैसे: काजू की पैकिंग खराब है, डिलीवरी में देरी, पेमेंट की समस्या):");
            return;
        }
        if (msg === '5') {
            contact.is_paused = true;
            contact.step = 'human_takeover';
            await contact.save();
            
            const handoffMsg = lang === 'en'
                ? `👋 *Connecting you to our support team!*\nAn agent will reply shortly.`
                : `👋 *आपको हमारी सहायता टीम से जोड़ रहे हैं!*\nएक एजेंट जल्द ही जवाब देगा।`;
            await sendMessage(phone, handoffMsg);
            return;
        }
        if (msg === '6') {
            contact.step = 'main_menu';
            await contact.save();
            await sendMainMenu(phone, contact);
            return;
        }
    }

    if (contact.step === 'ticket_entry') {
        const ticketId = `TK-${Date.now().toString().slice(-4)}`;
        contact.tickets.push({
            ticketId,
            subject: messageText,
            status: "Open",
            createdAt: new Date()
        });
        contact.step = 'main_menu';
        await contact.save();

        const successMsg = t.ticket_success
            .replace('{ticketId}', ticketId)
            .replace('{subject}', messageText);

        await sendMessage(phone, successMsg);
        await sendMainMenu(phone, contact);
        return;
    }

    // --- SEARCH / CONVERSATIONAL ASSISTANT ---
    // If the message is not matched, let's treat it as a product search query
    const keywords = ['oil', 'honey', 'turmeric', 'almonds', 'cookies', 'ragi', 'millet', 'spices', 'nuts', 'cashew', 'sweet', 'snack'];
    const containsKeyword = keywords.some(k => msg.includes(k));
    
    if (containsKeyword || msg.length > 2) {
        const matches = PRODUCTS.filter(p => 
            p.name.toLowerCase().includes(msg) || 
            p.category.toLowerCase().includes(msg) || 
            p.description.toLowerCase().includes(msg)
        );

        if (matches.length > 0) {
            contact.step = 'main_menu';
            await contact.save();

            let resultsMsg = lang === 'en' 
                ? `🔍 *Search Results for "${messageText}":*\n\n`
                : `🔍 *"${messageText}" க்கான தேடல் முடிவுகள்:*\n\n`;

            matches.forEach((p, index) => {
                resultsMsg += `*${index + 1}️⃣ ${p.name}* - ₹${p.price}\n_${p.description}_\n👉 ID: \`add_${p.id}\` to add to cart\n\n`;
            });

            resultsMsg += lang === 'en'
                ? `_To add an item, type "add_" followed by product ID (e.g. add_prod_honey)._`
                : `_கார்டில் சேர்க்க, \"add_\" குறியீடு மற்றும் தயாரிப்பு ஐடி தட்டச்சு செய்யவும் (எ.கா: add_prod_honey)._`;

            await sendInteractiveButtons(phone, resultsMsg, [
                { id: "btn_catalog", title: lang === 'en' ? "Browse Categories" : "பிரிவுகளைக் காண்க" },
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் காண்க 🛒" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);
            return;
        }
    }

    // Fallback: If nothing was matched, show fallback main menu
    contact.step = 'main_menu';
    await contact.save();
    await sendInteractiveButtons(phone, t.invalid_option, [
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" },
        { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "கடைப் பட்டியல் 📁" },
        { id: "btn_human", title: lang === 'en' ? "Talk to Human 👤" : "எஜென்ட்டிடம் பேச 👤" }
    ]);
}

async function sendMainMenu(phone, contact) {
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;
    contact.step = 'main_menu';
    await contact.save();

    const sections = [
        {
            title: lang === 'en' ? "Mansara Foods Menu" : "மன்சரா ஃபுட்ஸ் பட்டி",
            rows: [
                { id: "opt_1_products", title: lang === 'en' ? "1️⃣ View Products" : "1️⃣ தயாரிப்புகளைப் பார்க்க", description: "Browse traditional health mixes & podis" },
                { id: "opt_2_order", title: lang === 'en' ? "2️⃣ Place an Order" : "2️⃣ ஆர்டர் செய்ய", description: "View cart & checkout items" },
                { id: "opt_3_track", title: lang === 'en' ? "3️⃣ Track My Order" : "3️⃣ ஆர்டரைக் கண்காணிக்க", description: "Check status of your purchases" },
                { id: "opt_4_dealer", title: lang === 'en' ? "4️⃣ Dealer Registration" : "4️⃣ டீலர் பதிவு", description: "Become a partner / distributor" },
                { id: "opt_5_bulk", title: lang === 'en' ? "5️⃣ Bulk Orders" : "5️⃣ மொத்த ஆர்டர்கள்", description: "Inquire about wholesale pricing" },
                { id: "opt_6_offers", title: lang === 'en' ? "6️⃣ Offers & Discounts" : "6️⃣ சலுகைகள் & தள்ளுபடிகள்", description: "Special coupon codes & discounts" },
                { id: "opt_7_recipes", title: lang === 'en' ? "7️⃣ Recipes" : "7️⃣ சமையல் குறிப்புகள்", description: "Healthy dishes & preparation ideas" },
                { id: "opt_8_store", title: lang === 'en' ? "8️⃣ Store Locator" : "8️⃣ கடைகள் இருப்பிடம்", description: "Find nearby outlets & shipping info" },
                { id: "opt_9_support", title: lang === 'en' ? "9️⃣ Customer Support" : "9️⃣ வாடிக்கையாளர் ஆதரவு", description: "FAQs, returns & help center" },
                { id: "opt_10_sales", title: lang === 'en' ? "🔟 Contact Sales Team" : "🔟 விற்பனை குழு", description: "Speak with a representative" }
            ]
        }
    ];

    await sendInteractiveList(
        phone,
        t.main_menu,
        lang === 'en' ? "Select Option 📋" : "தேர்வு செய்க 📋",
        sections
    );
}

async function sendCatalogMenu(phone, contact) {
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;
    contact.step = 'catalog_menu';
    await contact.save();

    const sections = [
        {
            title: lang === 'en' ? "Product Categories" : "தயாரிப்பு வகைகள்",
            rows: [
                { id: "cat_health_mixes", title: lang === 'en' ? "🥣 Health Mixes & Porridge" : "🥣 சத்து மாவுகள் & கஞ்சி", description: "Ragi Choco Malt, Nutriminix multigrain mix" },
                { id: "cat_rice_podi", title: lang === 'en' ? "🌾 Rice Mixes & Podi" : "🌾 சாதப் பொடிகள்", description: "Paruppu, Pirandai, Curry Leaves & Coriander Podi" },
                { id: "cat_combos", title: lang === 'en' ? "🎁 Combos & Packs" : "🎁 சிறப்பு பேக்குகள்", description: "5-Flavor traditional rice mix podi combo pack" }
            ]
        },
        {
            title: lang === 'en' ? "Actions" : "செயல்கள்",
            rows: [
                { id: "btn_menu", title: lang === 'en' ? "🏠 Main Menu" : "🏠 முதன்மை பட்டி" }
            ]
        }
    ];

    await sendInteractiveList(
        phone,
        t.catalog_menu,
        lang === 'en' ? "View Categories" : "வகைகளைக் காண்க",
        sections
    );
}

async function sendCategoryProducts(phone, category, contact) {
    const lang = contact.language || 'en';
    const products = PRODUCTS.filter(p => p.category === category);
    
    let prodMsg = lang === 'en' 
        ? `📁 *Mansara Foods - ${category}* 📁\n\n`
        : `📁 *மன்சரா ஃபுட்ஸ் - ${category}* 📁\n\n`;

    products.forEach((p, idx) => {
        prodMsg += `*${idx + 1}️⃣ ${p.name}*\n💰 Price: ₹${p.price}\n📝 _${p.description}_\n🛒 ID: \`add_${p.id}\` to buy\n❤️ ID: \`wish_${p.id}\` to wishlist\n\n`;
    });

    prodMsg += lang === 'en'
        ? `Type the add ID to add to cart, or click below.`
        : `கார்டில் சேர்க்க 'add ID' தட்டச்சு செய்யவும், அல்லது கீழே கிளிக் செய்யவும்.`;

    await sendInteractiveButtons(phone, prodMsg, [
        { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் காண்க 🛒" },
        { id: "btn_catalog", title: lang === 'en' ? "Back to Categories" : "பிரிவுகளுக்கு திரும்பவும்" },
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
    ]);
}

async function sendCartView(phone, contact) {
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;
    
    if (contact.cart.length === 0) {
        await sendMessage(phone, t.cart_empty);
        await sendMainMenu(phone, contact);
        return;
    }

    contact.step = 'cart_view';
    await contact.save();

    const subtotal = contact.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let discount = 0;
    if (contact.appliedCoupon === "SAVE10" || contact.appliedCoupon === "WELCOME10") {
        discount = Math.round(subtotal * 0.10);
    }
    const total = subtotal - discount;

    let cartMsg = lang === 'en' 
        ? `🛒 *Your Shopping Cart:*\n\n`
        : `🛒 *உங்கள் கார்ட் விபரங்கள்:*\n\n`;

    contact.cart.forEach((item, idx) => {
        cartMsg += `*${idx + 1}. ${item.name}*\nQty: ${item.quantity} | Price: ₹${item.price} each\nSubtotal: ₹${item.price * item.quantity}\n━━━━━━━━━━━━━━━━━\n`;
    });

    cartMsg += lang === 'en'
        ? `*Subtotal:* ₹${subtotal}\n` + (discount > 0 ? `*Coupon (${contact.appliedCoupon}):* -₹${discount}\n` : '') + `*Shipping:* FREE\n*Grand Total:* ₹${total}\n\n` +
          `Reply with number:\n*1️⃣ Proceed to Checkout 💳*\n*2️⃣ Apply Coupon Code 🎟️*\n*3️⃣ Empty Cart 🗑️*\n*4️⃣ Back to Main Menu 🏠*`
        : `*உப-தொகை:* ₹${subtotal}\n` + (discount > 0 ? `*கியூபொன் (${contact.appliedCoupon}):* -₹${discount}\n` : '') + `*விநியோக கட்டணம்:* இலவசம்\n*மொத்த தொகை:* ₹${total}\n\n` +
          `பதிலளிக்க எண்:\n*1️⃣ செக்அவுட் செய்ய 💳*\n*2️⃣ கியூபொன் குறியீடு உள்ளிட 🎟️*\n*3️⃣ கார்ட்டை காலி செய்ய 🗑️*\n*4️⃣ முதன்மை பட்டிக்கு திரும்ப 🏠*`;

    await sendInteractiveButtons(phone, cartMsg, [
        { id: "btn_checkout", title: lang === 'en' ? "Checkout 💳" : "செக்அவுட் 💳" },
        { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "கடைப் பட்டியல் 📁" },
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
    ]);
}

async function sendOrdersMenu(phone, contact) {
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;

    if (!contact.orders || contact.orders.length === 0) {
        await sendMessage(phone, t.no_orders);
        await sendMainMenu(phone, contact);
        return;
    }

    contact.step = 'orders_menu';
    await contact.save();

    let ordersMsg = lang === 'en'
        ? `📦 *Your Recent Orders:*\n\n`
        : `📦 *உங்கள் சமீபத்திய ஆர்டர்கள்:*\n\n`;

    contact.orders.slice(-3).forEach(o => {
        ordersMsg += `*Order ID:* ${o.orderId}\n*Date:* ${new Date(o.createdAt).toLocaleDateString('en-GB')}\n*Items:* ${o.items.length}\n*Total:* ₹${o.total}\n*Status:* ${o.status}\n*Payment:* ${o.paymentStatus}\n${o.status === 'Shipped' ? `*Track Link:* ${o.trackingLink}\n` : ''}━━━━━━━━━━━━━━━━━\n`;
    });

    ordersMsg += lang === 'en'
        ? `Reply with number:\n*1️⃣ Reschedule / Change Delivery Details*\n*2️⃣ Cancel an Order*\n*3️⃣ Back to Main Menu 🏠*`
        : `பதிலளிக்க எண்:\n*1️⃣ விநியோக முகவரி / விபரங்களை மாற்ற*\n*2️⃣ ஆர்டரை ரத்து செய்ய*\n*3️⃣ முதன்மை பட்டிக்கு திரும்ப 🏠*`;

    await sendInteractiveButtons(phone, ordersMsg, [
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
    ]);
}

async function sendLoyaltyInfo(phone, contact) {
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;
    contact.step = 'main_menu';
    await contact.save();

    const info = t.loyalty_info.replace(/{points}/g, contact.loyaltyPoints || 0);
    await sendInteractiveButtons(phone, info, [
        { id: "btn_catalog", title: lang === 'en' ? "Shop Organic 📁" : "ஆர்கானிக் கடை 📁" },
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
    ]);
}

async function sendSupportMenu(phone, contact) {
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;
    contact.step = 'support_menu';
    await contact.save();

    await sendInteractiveButtons(phone, t.support_menu, [
        { id: "btn_human", title: lang === 'en' ? "Talk to Agent 👤" : "எஜென்ட்டிடம் பேச 👤" },
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
    ]);
}

// Simulated CRM sync for orders
function syncCrmOrder(contact, order) {
    axios.post(process.env.CRM_LEAD_WEBHOOK || 'http://localhost:5000/api/webhooks/whatsapp-bot-lead', {
        CustomerName: contact.name || contact.phone,
        WhatsAppNumber: contact.phone,
        OrderId: order.orderId,
        OrderTotal: order.total,
        OrderStatus: order.status,
        PaymentStatus: order.paymentStatus,
        ItemsCount: order.items.length,
        LeadStatus: "Order Placed",
        LeadScore: calculateLeadScore(contact)
    })
    .then(() => console.log(`[CRM Order Sync] Successfully synced order ${order.orderId} to CRM`))
    .catch(err => console.error(`[CRM Order Sync Error] Failed:`, err.message));
}
// --- Cron Jobs for Automated Follow-ups ---
// 1. Abandoned Cart Recovery (Runs every 15 minutes)
cron.schedule('*/15 * * * *', async () => {
    console.log("Running Abandoned Cart Recovery Cron Job...");
    const fifteenMinsAgo = new Date(Date.now() - (15 * 60 * 1000));
    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    try {
        const abandonedContacts = await Contact.find({
            is_paused: false,
            cart: { $exists: true, $not: { $size: 0 } },
            lastSeen: { $lt: fifteenMinsAgo, $gt: oneDayAgo },
            lead_status: { $ne: "Cart Nudged" }
        });

        for (const contact of abandonedContacts) {
            const lang = contact.language || 'en';
            const nudgeMsg = lang === 'en'
                ? `🛒 *Items waiting in your cart!* 👋\n\nHi ${contact.name || 'there'}, we noticed you left some delicious organic products in your cart.\n\nUse code *SAVE10* to get *10% OFF* on your checkout total!\n\nTap below to complete your order.`
                : `🛒 *आपकी कार्ट में आइटम बचे हैं!* 👋\n\nनमस्ते, हमने देखा कि आपने अपनी कार्ट में कुछ स्वादिष्ट जैविक उत्पाद छोड़े हैं।\n\nचेकआउट पर *10% छूट* पाने के लिए कूपन *SAVE10* का उपयोग करें!\n\nऑर्डर पूरा करने के लिए नीचे टैप करें।`;
            
            await sendInteractiveButtons(contact.phone, nudgeMsg, [
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "कार्ट देखें 🛒" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "मुख्य मेनू 🏠" }
            ]);

            contact.lead_status = "Cart Nudged";
            await contact.save();
        }
    } catch (e) {
        console.error("Cart recovery cron error:", e);
    }
});

// 2. Daily Survey and Follow-up (Runs daily at 10:00 AM IST)
cron.schedule('0 10 * * *', async () => {
    console.log("Running Daily NPS/CSAT and Reorder Cron Job...");
    const now = new Date();
    
    try {
        // Send feedback requests to contacts with orders delivered 1 day ago
        const deliveredContacts = await Contact.find({
            "orders.status": "Delivered",
            lead_status: { $ne: "Feedback Requested" }
        });

        for (const contact of deliveredContacts) {
            const deliveredOrder = contact.orders.find(o => o.status === "Delivered");
            if (deliveredOrder) {
                const lang = contact.language || 'en';
                const feedbackMsg = lang === 'en'
                    ? `🌿 *How was your order ${deliveredOrder.orderId}?* ⭐\n\nThank you for shopping with Mansara Foods! We would love to hear your feedback.\n\nRate your experience from 1 (Poor) to 5 (Excellent) by replying with a number.`
                    : `🌿 *आपका ऑर्डर ${deliveredOrder.orderId} कैसा था?* ⭐\n\nमनसारा फूड्स के साथ खरीदारी करने के लिए धन्यवाद! हम आपकी प्रतिक्रिया जानना चाहेंगे।\n\n1 (खराब) से 5 (उत्कृष्ट) के बीच नंबर लिखकर प्रतिक्रिया दें।`;
                
                await sendMessage(contact.phone, feedbackMsg);
                contact.lead_status = "Feedback Requested";
                contact.step = "feedback_pending";
                await contact.save();
            }
        }

        // 3. Reorder Reminder (Runs for consumable orders older than 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const reorderContacts = await Contact.find({
            "orders.status": "Delivered",
            "orders.createdAt": { $lt: thirtyDaysAgo },
            lead_status: { $ne: "Reorder Reminded" }
        });

        for (const contact of reorderContacts) {
            const lang = contact.language || 'en';
            const reorderMsg = lang === 'en'
                ? `🌿 *Time to restock?* 🛒\n\nHi ${contact.name || 'there'}, it has been about a month since your last purchase of fresh organic foods from Mansara Foods.\n\nTap below to browse our fresh batch and order again!`
                : `🌿 *क्या स्टॉक खत्म हो रहा है?* 🛒\n\nनमस्ते, मनसारा फूड्स से आपकी पिछली खरीदारी को लगभग एक महीना हो गया है। दोबारा ऑर्डर करने के लिए नीचे टैप करें!`;
            
            await sendInteractiveButtons(contact.phone, reorderMsg, [
                { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "कैटलॉग देखें 📁" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "मुख्य मेनू 🏠" }
            ]);

            contact.lead_status = "Reorder Reminded";
            await contact.save();
        }
    } catch (e) {
        console.error("Daily follow-up cron error:", e);
    }
}, { timezone: "Asia/Kolkata" });

// --- Webhook Endpoints ---
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) res.status(200).send(challenge);
    else res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
    res.sendStatus(200);
    const body = req.body;
    if (body.object === 'whatsapp_business_account' && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
        const webhook_event = body.entry[0].changes[0].value;
        const message = webhook_event.messages[0];
        const contactInfo = webhook_event.contacts && webhook_event.contacts[0] ? webhook_event.contacts[0] : null;
        
        let messageText = '';
        if (message.type === 'text') messageText = message.text.body;
        else if (message.type === 'interactive') {
            if (message.interactive.button_reply) messageText = message.interactive.button_reply.id;
            else if (message.interactive.list_reply) messageText = message.interactive.list_reply.id;
        }

        if (messageText) {
            const phone = message.from;
            const name = contactInfo && contactInfo.profile ? contactInfo.profile.name : '';
            
            // Sync enquiry immediately with CRM
            axios.post(process.env.CRM_ENQUIRY_WEBHOOK || 'http://localhost:5000/api/webhooks/whatsapp-bot-enquiry', {
                CustomerName: name || phone,
                WhatsAppNumber: phone,
                MessageText: message.type === 'text' ? message.text.body : `Selection: ${messageText}`
            })
            .then(() => console.log(`[CRM Enquiry Sync] Message synced to CRM for ${phone}`))
            .catch(e => console.error("[CRM Enquiry Sync Error]:", e.message));

            try {
                let contact = await Contact.findOne({ phone });
                const now = new Date();
                if (!contact) {
                    contact = new Contact({ phone, name: name || phone, firstSeen: now, lastSeen: now, messageCount: 1, messages: [{ text: messageText, time: now }] });
                } else {
                    contact.lastSeen = now;
                    contact.messageCount += 1;
                    if (name) contact.name = name;
                    contact.messages.push({ text: messageText, time: now });
                    // Reset cart recovery nudge status on user activity
                    if (contact.lead_status === "Cart Nudged") {
                        contact.lead_status = "Active";
                    }
                }
                await contact.save();
                await handleBotReply(phone, messageText, contact);
            } catch(e) {
                console.error("DB Error processing webhook:", e);
            }
        }
    }
});

// --- Dashboard API Endpoints ---
app.get('/crm', async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ lastSeen: -1 });
        res.json({ totalContacts: contacts.length, contacts });
    } catch (err) { res.status(500).json({ error: "Failed to fetch contacts" }); }
});

// --- Analytics Dashboard API ---
app.get('/crm/analytics', async (req, res) => {
    try {
        const contacts = await Contact.find();
        
        let totalRevenue = 0;
        let activeOrders = 0;
        let openTickets = 0;
        let optedInCount = 0;
        let botCount = 0;
        let pausedCount = 0;

        const funnel = {
            onboarding: 0,
            browsing: 0,
            cart: 0,
            checkout: 0,
            completed: 0
        };

        contacts.forEach(c => {
            // Consent opt-in rate
            if (c.consent === true) optedInCount++;
            
            // Bot vs human
            if (c.is_paused) pausedCount++;
            else botCount++;

            // Funnel calculation
            const state = c.funnelState || 'onboarding';
            if (funnel[state] !== undefined) funnel[state]++;

            // Tickets count
            if (c.tickets) {
                openTickets += c.tickets.filter(t => t.status === 'Open').length;
            }

            // Orders and Revenue
            if (c.orders) {
                c.orders.forEach(o => {
                    if (o.status !== 'Cancelled') {
                        totalRevenue += o.total || 0;
                        if (['Placed', 'Packed', 'Shipped'].includes(o.status)) {
                            activeOrders++;
                        }
                    }
                });
            }
        });

        const consentRate = contacts.length > 0 ? Math.round((optedInCount / contacts.length) * 100) : 0;
        const botResolutionRate = (botCount + pausedCount) > 0 ? Math.round((botCount / (botCount + pausedCount)) * 100) : 100;

        res.json({
            totalContacts: contacts.length,
            totalRevenue,
            activeOrders,
            openTickets,
            consentRate,
            botResolutionRate,
            funnel,
            botVsHuman: { bot: botCount, human: pausedCount }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate analytics" });
    }
});

// --- Pause/Resume Bot Endpoint ---
app.post('/crm/:phone/pause', async (req, res) => {
    try {
        const contact = await Contact.findOne({ phone: req.params.phone });
        if (!contact) return res.status(404).json({ error: "Contact not found" });

        contact.is_paused = req.body.is_paused;
        if (!contact.is_paused) {
            contact.step = 'main_menu'; // Reset to main menu on resume
        }
        await contact.save();

        res.json({ success: true, is_paused: contact.is_paused });
    } catch (err) {
        res.status(500).json({ error: "Failed to update pause state" });
    }
});

// --- Broadcast Campaign Endpoint ---
app.post('/crm/broadcast', async (req, res) => {
    try {
        const { messageText, segment } = req.body;
        if (!messageText) return res.status(400).json({ error: "Message text is required" });

        let query = {};
        if (segment === 'opt_in') {
            query.consent = true;
        } else if (segment === 'loyalty') {
            query.loyaltyPoints = { $gt: 0 };
        } else if (segment === 'cart_abandoned') {
            query.cart = { $exists: true, $not: { $size: 0 } };
        }

        const contacts = await Contact.find(query);
        let sentCount = 0;

        for (const contact of contacts) {
            await sendMessage(contact.phone, messageText);
            sentCount++;
        }

        res.json({ success: true, sentCount });
    } catch (err) {
        res.status(500).json({ error: "Failed to send broadcast" });
    }
});

// --- Update Order Status (ERP / Shipping mock) ---
app.post('/crm/:phone/update-order', async (req, res) => {
    try {
        const { orderId, status } = req.body; // status: Placed, Packed, Shipped, Delivered, Cancelled
        const contact = await Contact.findOne({ phone: req.params.phone });
        if (!contact) return res.status(404).json({ error: "Contact not found" });

        const order = contact.orders.find(o => o.orderId === orderId);
        if (!order) return res.status(404).json({ error: "Order not found" });

        order.status = status;
        await contact.save();

        // Send WhatsApp notification to user
        const lang = contact.language || 'en';
        let alertMsg = "";
        if (status === 'Packed') {
            alertMsg = lang === 'en' 
                ? `📦 *Order Update:* Your order *${orderId}* has been packed and is ready for dispatch!`
                : `📦 *ऑर्डर अपडेट:* आपका ऑर्डर *${orderId}* पैक हो गया है और प्रेषण के लिए तैयार है!`;
        } else if (status === 'Shipped') {
            alertMsg = lang === 'en'
                ? `🚚 *Order Update:* Your order *${orderId}* has been shipped!\nTrack here: ${order.trackingLink}`
                : `🚚 *ऑर्डर अपडेट:* आपका ऑर्डर *${orderId}* शिप कर दिया गया है!\nयहाँ ट्रैक करें: ${order.trackingLink}`;
        } else if (status === 'Delivered') {
            alertMsg = lang === 'en'
                ? `🎉 *Order Delivered:* Your order *${orderId}* has been successfully delivered!\n\nThank you for choosing Mansara Foods. 🌿\nWe hope you love our organic products.`
                : `🎉 *ऑर्डर डिलीवर हो गया:* आपका ऑर्डर *${orderId}* सफलतापूर्वक वितरित कर दिया गया है!\n\nमनसारा फूड्स को चुनने के लिए धन्यवाद। 🌿`;
        } else if (status === 'Cancelled') {
            alertMsg = lang === 'en'
                ? `❌ *Order Cancelled:* Your order *${orderId}* has been cancelled.`
                : `❌ *ऑर्डर रद्द:* आपका ऑर्डर *${orderId}* रद्द कर दिया गया है।`;
        }

        if (alertMsg) {
            await sendMessage(contact.phone, alertMsg);
        }

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ error: "Failed to update order status" });
    }
});

// --- Resolve Support Ticket Endpoint ---
app.post('/crm/:phone/resolve-ticket', async (req, res) => {
    try {
        const { ticketId } = req.body;
        const contact = await Contact.findOne({ phone: req.params.phone });
        if (!contact) return res.status(404).json({ error: "Contact not found" });

        const ticket = contact.tickets.find(t => t.ticketId === ticketId);
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });

        ticket.status = 'Resolved';
        await contact.save();

        const alertMsg = contact.language === 'en'
            ? `🎫 *Support Update:* Your ticket *${ticketId}* has been resolved. Let us know if you need anything else!`
            : `🎫 *सहायता अपडेट:* आपका टिकट *${ticketId}* हल कर दिया गया है।`;
        await sendMessage(contact.phone, alertMsg);

        res.json({ success: true, ticket });
    } catch (err) {
        res.status(500).json({ error: "Failed to resolve ticket" });
    }
});

app.get('/crm/:phone', async (req, res) => {
    try {
        const contact = await Contact.findOne({ phone: req.params.phone });
        if (contact) res.json(contact);
        else res.status(404).json({ error: "Contact not found" });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.delete('/crm/:phone', async (req, res) => {
    try {
        const result = await Contact.deleteOne({ phone: req.params.phone });
        if (result.deletedCount > 0) res.json({ success: true });
        else res.status(404).json({ error: "Contact not found" });
    } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
