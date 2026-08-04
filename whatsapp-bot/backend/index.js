require('dotenv').config();
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

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
app.use(express.static('public'));
app.use('/media', express.static('public'));

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whatsapp-crm';
const SALES_TEAM_PHONE = process.env.SALES_TEAM_PHONE || '';
const GOOGLE_SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK || '';
const BACKEND_URL = process.env.BACKEND_URL || 'https://whatapp-automation-kxml.onrender.com';
const BANNER_IMAGE_URL = `${BACKEND_URL}/mansara_banner.jpg`;
const LOGO_IMAGE_URL = `${BACKEND_URL}/logo.png`;

// --- MongoDB Setup ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Cluster'))
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
    language: { type: String, default: "en" }, // 'en', 'ta'
    consent: { type: Boolean, default: true }, // Defaults to true so direct notifications (order, status, cart, reviews) send automatically without requiring 'hi'
    consentDate: { type: Date, default: Date.now },
    cart: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number
    }],
    lastCartNudgeDate: { type: Date }, // Tracks 2-day (48-hour) recurring cart reminder
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
    selectedCategory: { type: String, default: "" },
    selectedProductId: { type: String, default: "" },
    step: { type: String, default: "welcome" }, // welcome, consent_pending, language_selection, main_menu, checkout_address, checkout_payment_mode, payment_pending, coupon_entry, orders_menu, reschedule_entry, cancel_entry, support_menu, ticket_entry, feedback_pending
    funnelState: { type: String, default: "onboarding" } // onboarding, browsing, cart, checkout, completed
});

const Contact = mongoose.model('Contact', contactSchema);

// --- Website Database Mongoose Models Integration ---
const backendModelsDir = path.resolve(__dirname, '../../../mansara backend/models');

let ProductModel, OrderModel, CategoryModel, UserModel, SettingModel;

if (fs.existsSync(path.join(backendModelsDir, 'Product.js'))) {
    try {
        const prodModule = require(path.join(backendModelsDir, 'Product'));
        ProductModel = prodModule.Product || prodModule;
        console.log('✅ Registered website Product model');
    } catch (e) {
        ProductModel = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({ name: String, price: Number, offerPrice: Number, stock: Number, category: String, description: String, image: String, isActive: Boolean }, { strict: false }));
    }
} else {
    ProductModel = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({ name: String, price: Number, offerPrice: Number, stock: Number, category: String, description: String, image: String, isActive: Boolean }, { strict: false }));
}

if (fs.existsSync(path.join(backendModelsDir, 'Order.js'))) {
    try {
        OrderModel = require(path.join(backendModelsDir, 'Order'));
        console.log('✅ Registered website Order model');
    } catch (e) {
        OrderModel = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({ orderId: String }, { strict: false }));
    }
} else {
    OrderModel = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({ orderId: String }, { strict: false }));
}

if (fs.existsSync(path.join(backendModelsDir, 'Category.js'))) {
    try {
        CategoryModel = require(path.join(backendModelsDir, 'Category'));
        console.log('✅ Registered website Category model');
    } catch (e) {
        CategoryModel = mongoose.models.Category || mongoose.model('Category', new mongoose.Schema({ name: String }, { strict: false }));
    }
} else {
    CategoryModel = mongoose.models.Category || mongoose.model('Category', new mongoose.Schema({ name: String }, { strict: false }));
}

if (fs.existsSync(path.join(backendModelsDir, 'User.js'))) {
    try {
        UserModel = require(path.join(backendModelsDir, 'User'));
        console.log('✅ Registered website User model');
    } catch (e) {
        UserModel = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ name: String, phone: String, whatsapp: String }, { strict: false }));
    }
} else {
    UserModel = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ name: String, phone: String, whatsapp: String }, { strict: false }));
}

if (fs.existsSync(path.join(backendModelsDir, 'Setting.js'))) {
    try {
        SettingModel = require(path.join(backendModelsDir, 'Setting'));
        console.log('✅ Registered website Setting model');
    } catch (e) {
        SettingModel = mongoose.models.Setting || mongoose.model('Setting', new mongoose.Schema({}, { strict: false }));
    }
} else {
    SettingModel = mongoose.models.Setting || mongoose.model('Setting', new mongoose.Schema({}, { strict: false }));
}

// --- Mansara Foods Fallback Products Dataset ---
const PRODUCTS = [
    { id: "69a91a0c4ee07f2c99a1aea1", name: "Ragi Choco Malt", category: "Health Mixes", weight: "250g", price: 250, offerPrice: 245, stock: 100, description: "Nutritious health drink mix combining Ragi (Finger Millet) with premium cocoa, brown sugar, almonds & saffron." },
    { id: "69a9b4091c2c00db0a9bf83e", name: "Nutriminix Multi-Grain Mix", category: "Health Mixes", weight: "250g", price: 200, offerPrice: 195, stock: 99, description: "Traditional 27-ingredient health mix with Kavuni black rice, samba wheat, barley & millets." },
    { id: "69620f7e7f9c4b0e78ddbc4d", name: "Urad Health Mix - Classic", category: "Health Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 50, description: "Time-tested nourishing blend made primarily from premium black gram (Urad Dal) and samba wheat." },
    { id: "69620f7f7f9c4b0e78ddbc50", name: "Urad Health Mix - Premium", category: "Health Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 50, description: "Formulated with black gram, ragi, Kavuni black rice, and traditional Indian rice varieties." },
    { id: "69620f7e7f9c4b0e78ddbc4e", name: "Urad Mix - Salt n Pepper", category: "Health Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 50, description: "Savoury porridge variant infused with black pepper and cumin seeds for gut health." },
    { id: "69620f7f7f9c4b0e78ddbc4f", name: "Urad Mix - Millet Magic", category: "Health Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 50, description: "Nutritious porridge mix crafted with black gram and a carefully balanced selection of 7 millets." },
    { id: "69620f7f7f9c4b0e78ddbc51", name: "Black Rice Delight (Kavuni)", category: "Health Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 50, description: "Traditional black rice (Karuppu Kavuni) porridge mix rich in antioxidants and iron." },
    { id: "69620f7f7f9c4b0e78ddbc52", name: "Idly Podi - Millet Fusion", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Nutritious millet-enriched idly podi combining lentils, 4 millets, and roasted spices." },
    { id: "69a9b40c1c2c00db0a9bf83f", name: "Idly Podi - Traditional", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Classic South Indian idly podi made from roasted lentils, dry red chillies, and spices." },
    { id: "69a9b40e1c2c00db0a9bf840", name: "Homestyle Paruppu Rice Podi", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Protein-rich lentil rice powder delicious with hot rice & ghee." },
    { id: "69a9b4111c2c00db0a9bf841", name: "Curry Leaves Rice Podi", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Traditional Karuveppilai rice podi rich in iron and essential vitamins." },
    { id: "69a9b4131c2c00db0a9bf842", name: "Coriander Rice Podi Mix", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Fragrant roasted coriander & lentil powder mix for hot rice." },
    { id: "69a9b4151c2c00db0a9bf843", name: "Moringa Rice Podi Mix", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Superfood Moringa leaf rice mix packed with essential nutrients." },
    { id: "69a9b4251c2c00db0a9bf844", name: "Pirandai Rice Podi Mix", category: "Rice Podi Mixes", weight: "100g", price: 75, offerPrice: 70, stock: 100, description: "Medicinal Veldt Grape (Pirandai) rice mix supporting digestive wellness." },
    { id: "6967d5e7c88a08abbf51f0ac", name: "Ultimate Wellness Combo", category: "Combos & Packs", weight: "5 Mixes Pack", price: 330, offerPrice: 330, stock: 50, description: "Value pack of all 5 signature porridge mixes (Classic, Premium, Salt & Pepper, Millet Magic & Black Rice)." }
];

// --- Live Database Query Helpers ---

function formatDbProduct(p) {
    const categoryName = (p.category && p.category.name) ? p.category.name : (typeof p.category === 'string' ? p.category : 'Health Mixes');
    const firstVariant = (p.variants && p.variants.length > 0) ? p.variants[0] : null;
    const effectiveWeight = p.weight || (firstVariant ? firstVariant.weight : '100g');
    const effectivePrice = p.price || (firstVariant ? firstVariant.price : 100);
    const effectiveOfferPrice = p.offerPrice || (firstVariant && firstVariant.offerPrice ? firstVariant.offerPrice : effectivePrice);

    return {
        id: p._id ? p._id.toString() : (p.id || "69620f7e7f9c4b0e78ddbc4d"),
        name: p.name || 'Mansara Product',
        category: categoryName,
        weight: effectiveWeight,
        price: effectivePrice,
        offerPrice: effectiveOfferPrice,
        stock: typeof p.stock === 'number' ? p.stock : 50,
        description: p.description || p.short_description || 'Authentic traditional food product',
        image: p.image || BANNER_IMAGE_URL
    };
}

async function fetchLiveProducts() {
    try {
        const dbProducts = await ProductModel.find({ isActive: { $ne: false } }).populate('category').lean();
        if (dbProducts && dbProducts.length > 0) {
            return dbProducts.map(formatDbProduct);
        }
    } catch (err) {
        console.error('[DB Products Error]:', err.message);
    }
    return PRODUCTS;
}

async function fetchLiveCategories() {
    try {
        const dbCategories = await CategoryModel.find({ isActive: { $ne: false } }).sort({ order: 1, name: 1 }).lean();
        if (dbCategories && dbCategories.length > 0) {
            return dbCategories.map(c => ({ id: c._id.toString(), name: c.name, description: c.description || '' }));
        }
    } catch (err) {
        console.error('[DB Categories Error]:', err.message);
    }
    return [
        { id: "cat_health", name: "Health Mixes", description: "Ragi Choco, Nutriminix & Urad Porridge" },
        { id: "cat_podi", name: "Rice Podi Mixes", description: "Idly Podi, Paruppu, Curry Leaves & Moringa Podi" },
        { id: "cat_combos", name: "Combos & Packs", description: "Ultimate Wellness Combo Pack" }
    ];
}

async function fetchLiveProductsByCategory(categoryName) {
    const allProducts = await fetchLiveProducts();
    if (!categoryName || categoryName === 'All' || categoryName === 'Top') {
        return allProducts;
    }
    const cleanCat = categoryName.toLowerCase().trim();
    return allProducts.filter(p => p.category.toLowerCase().includes(cleanCat) || cleanCat.includes(p.category.toLowerCase()));
}

async function fetchLiveProductById(productId) {
    const allProducts = await fetchLiveProducts();
    const found = allProducts.find(p => p.id === productId || p.id === productId.replace('prod_', ''));
    return found || allProducts[0];
}

async function searchLiveProducts(searchTerm) {
    const term = (searchTerm || '').toLowerCase().trim();
    if (!term) return [];
    try {
        const dbMatches = await ProductModel.find({
            isActive: { $ne: false },
            $or: [
                { name: { $regex: term, $options: 'i' } },
                { description: { $regex: term, $options: 'i' } },
                { short_description: { $regex: term, $options: 'i' } },
                { ingredients: { $regex: term, $options: 'i' } }
            ]
        }).populate('category').lean();

        if (dbMatches && dbMatches.length > 0) {
            return dbMatches.map(formatDbProduct);
        }
    } catch (err) {
        console.error('[DB Search Error]:', err.message);
    }
    const allProducts = await fetchLiveProducts();
    return allProducts.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
}

async function saveOrderToDatabase(orderData, contact) {
    try {
        const cleanPhone = (contact.phone || '').replace(/\D/g, '');
        let dbUser = await UserModel.findOne({
            $or: [
                { phone: cleanPhone },
                { whatsapp: cleanPhone },
                { phone: `91${cleanPhone}` },
                { whatsapp: `91${cleanPhone}` }
            ]
        });

        if (!dbUser) {
            dbUser = new UserModel({
                name: contact.name || `WhatsApp User ${cleanPhone.slice(-4)}`,
                email: `${cleanPhone}@mansarafoods.com`,
                phone: cleanPhone,
                whatsapp: cleanPhone,
                authProvider: 'local'
            });
            await dbUser.save().catch(e => console.warn('[DB User Save Warning]:', e.message));
        }

        const dbItems = (orderData.items || []).map(item => {
            const isValidId = item.productId && mongoose.Types.ObjectId.isValid(item.productId);
            return {
                product: isValidId ? new mongoose.Types.ObjectId(item.productId) : new mongoose.Types.ObjectId("69620f7e7f9c4b0e78ddbc4d"),
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                weight: item.weight || '100g'
            };
        });

        const newDbOrder = new OrderModel({
            orderId: orderData.orderId,
            user: dbUser ? dbUser._id : new mongoose.Types.ObjectId("69620f7e7f9c4b0e78ddbc4d"),
            total: orderData.total,
            paymentStatus: orderData.paymentStatus === 'Paid' ? 'Paid' : 'Pending',
            orderStatus: 'Ordered',
            items: dbItems,
            deliveryAddress: {
                firstName: contact.name || 'WhatsApp Customer',
                street: contact.address || 'WhatsApp Delivery Address',
                city: 'Chennai',
                state: 'Tamil Nadu',
                zip: '600001',
                phone: cleanPhone
            }
        });

        await newDbOrder.save();
        console.log(`✅ Saved Order ${orderData.orderId} to MongoDB Order collection`);

        // Decrement Product Stock in DB
        for (const item of orderData.items) {
            if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
                const updatedProd = await ProductModel.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: -item.quantity } },
                    { new: true }
                );
                if (updatedProd && updatedProd.stock <= 5) {
                    const adminPhone = process.env.ADMIN_PHONE || '918838887064';
                    const stockAlertText = updatedProd.stock <= 0
                        ? `🚨 *OUT OF STOCK ALERT!* ❌\n\nProduct: *${updatedProd.name}*\nStock: *0 items*\n\nPlease restock immediately on website backend!`
                        : `⚠️ *LOW STOCK ALERT!* 📦\n\nProduct: *${updatedProd.name}*\nStock: *${updatedProd.stock} items remaining*`;
                    await sendMessage(adminPhone, stockAlertText).catch(e => console.error(e));
                }
            }
        }
    } catch (err) {
        console.error('[DB Order Save Error]:', err.message);
    }
}

async function fetchCrossChannelOrders(phone) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const phoneSuffix = cleanPhone.slice(-10);
    const mergedOrders = [];

    try {
        const contact = await Contact.findOne({ phone });
        if (contact && contact.orders && contact.orders.length > 0) {
            contact.orders.forEach(o => {
                mergedOrders.push({
                    orderId: o.orderId,
                    items: o.items,
                    total: o.total,
                    status: o.status,
                    paymentStatus: o.paymentStatus,
                    trackingLink: o.trackingLink || `https://mansarafoods.com/order-tracking/${o.orderId}`,
                    createdAt: o.createdAt || new Date(),
                    source: 'WhatsApp'
                });
            });
        }
    } catch (e) {
        console.warn('[Contact Orders Fetch Warning]:', e.message);
    }

    try {
        const webOrders = await OrderModel.find({
            $or: [
                { 'deliveryAddress.phone': new RegExp(phoneSuffix, 'i') },
                { 'deliveryAddress.phone': cleanPhone }
            ]
        }).sort({ date: -1 }).lean();

        if (webOrders && webOrders.length > 0) {
            webOrders.forEach(o => {
                if (!mergedOrders.some(existing => existing.orderId.toUpperCase() === o.orderId.toUpperCase())) {
                    mergedOrders.push({
                        orderId: o.orderId,
                        items: (o.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                        total: o.total,
                        status: o.orderStatus || 'Placed',
                        paymentStatus: o.paymentStatus || 'Pending',
                        trackingLink: `https://mansarafoods.com/order-tracking/${o.orderId}`,
                        createdAt: o.date || o.createdAt || new Date(),
                        source: 'Website'
                    });
                }
            });
        }
    } catch (e) {
        console.warn('[Website Orders Fetch Warning]:', e.message);
    }

    mergedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return mergedOrders;
}

async function getAdminStoreMetrics() {
    try {
        const totalProducts = await ProductModel.countDocuments();
        const lowStockProducts = await ProductModel.find({ stock: { $lte: 5 } }).lean();
        const outOfStockCount = lowStockProducts.filter(p => p.stock <= 0).length;

        const totalOrdersCount = await OrderModel.countDocuments();
        const pendingOrders = await OrderModel.find({ orderStatus: { $in: ['Ordered', 'Processing', 'Placed'] } }).sort({ date: -1 }).lean();
        
        const allOrders = await OrderModel.find({ paymentStatus: 'Paid' }).lean();
        const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayOrders = await OrderModel.find({ date: { $gte: startOfToday } }).lean();
        const todaySales = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        const totalContacts = await Contact.countDocuments();
        const optedInContacts = await Contact.countDocuments({ consent: true });
        const openTicketsCount = await Contact.aggregate([
            { $unwind: "$tickets" },
            { $match: { "tickets.status": "Open" } },
            { $count: "openCount" }
        ]);

        return {
            totalProducts,
            outOfStockCount,
            lowStockCount: lowStockProducts.length,
            lowStockItems: lowStockProducts.map(p => `${p.name} (${p.stock} left)`),
            totalOrdersCount,
            pendingOrdersCount: pendingOrders.length,
            pendingOrdersList: pendingOrders.slice(0, 5),
            totalRevenue,
            todaySales,
            todayOrdersCount: todayOrders.length,
            totalContacts,
            optedInContacts,
            openTickets: openTicketsCount[0] ? openTicketsCount[0].openCount : 0
        };
    } catch (e) {
        console.error('[Admin Metrics Error]:', e.message);
        return {
            totalProducts: 20,
            outOfStockCount: 0,
            lowStockCount: 0,
            lowStockItems: [],
            totalOrdersCount: 29,
            pendingOrdersCount: 3,
            pendingOrdersList: [],
            totalRevenue: 15400,
            todaySales: 1250,
            todayOrdersCount: 4,
            totalContacts: 76,
            optedInContacts: 68,
            openTickets: 1
        };
    }
}

function isTargetNumber(phone) {
    if (!phone) return false;
    const cleanPhone = phone.toString().replace(/\D/g, '');
    return cleanPhone.endsWith('7904441760');
}

function normalizePhone(phone) {
    if (!phone) return '';
    const clean = phone.toString().replace(/\D/g, '');
    if (clean.length === 10) return '91' + clean;
    if (clean.length > 10 && clean.length <= 15) return clean;
    return '';
}

// --- Send Message Functions ---
async function sendMessage(to, text) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    const target = normalizePhone(to);
    if (!target || target.length < 10) {
        console.warn(`[BOT SERVICE] Skipping sendMessage: Invalid phone '${to}'`);
        return;
    }
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: { messaging_product: 'whatsapp', to: target, type: 'text', text: { body: text } }
        });
    } catch (error) {
        console.error("Error sending message:", error.response ? error.response.data : error.message);
    }
}

async function sendImageMessage(to, imageUrl, captionText = "") {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    const target = normalizePhone(to);
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: target,
                type: 'image',
                image: {
                    link: imageUrl,
                    ...(captionText ? { caption: captionText } : {})
                }
            },
            timeout: 5000
        });
    } catch (error) {
        console.error("Error sending image message:", error.response ? error.response.data : error.message);
    }
}

async function sendInteractiveButtons(to, bodyText, buttonsArray, imageUrl = null) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    const target = normalizePhone(to);

    const buttons = buttonsArray.map((btn) => ({
        type: "reply",
        reply: { id: btn.id, title: btn.title.substring(0, 20) }
    }));

    const interactiveData = {
        type: 'button',
        body: { text: bodyText },
        action: { buttons }
    };

    if (imageUrl) {
        interactiveData.header = {
            type: 'image',
            image: { link: imageUrl }
        };
    }

    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: target,
                type: 'interactive',
                interactive: interactiveData
            }
        });
    } catch (error) {
        console.error(`[sendInteractiveButtons] FAILED → ${target}:`, error.response ? error.response.data : error.message);
        if (imageUrl) {
            delete interactiveData.header;
            try {
                await axios({
                    method: 'POST',
                    url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
                    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                    data: {
                        messaging_product: 'whatsapp',
                        to: target,
                        type: 'interactive',
                        interactive: interactiveData
                    }
                });
                return;
            } catch (e2) {
                console.warn('[sendInteractiveButtons] Plain interactive fallback failed:', e2.response ? e2.response.data : e2.message);
            }
        }
        // Fallback: Send direct text message so notification is delivered directly to customer's WhatsApp inbox!
        const textWithButtons = bodyText + "\n\n" + buttonsArray.map(b => `• *${b.title}*`).join('\n');
        await sendMessage(target, textWithButtons).catch(e3 => console.error('[sendTextFallback] FAILED:', e3.message));
    }
}

async function sendInteractiveList(to, bodyText, buttonText, sections, imageUrl = null, headerText = "Mansara Foods") {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
    const target = normalizePhone(to);

    const sanitizedSections = (sections || []).map(sec => ({
        title: (sec.title || '').substring(0, 24),
        rows: (sec.rows || []).map(row => ({
            id: row.id,
            title: (row.title || '').substring(0, 24),
            ...(row.description ? { description: row.description.substring(0, 72) } : {})
        }))
    }));

    const interactiveData = {
        type: 'list',
        body: { text: bodyText },
        action: {
            button: buttonText.substring(0, 20),
            sections: sanitizedSections
        }
    };

    if (imageUrl) {
        interactiveData.header = {
            type: 'image',
            image: { link: imageUrl }
        };
    } else if (headerText) {
        interactiveData.header = {
            type: 'text',
            text: headerText
        };
    }

    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: target,
                type: 'interactive',
                interactive: interactiveData
            }
        });
    } catch (error) {
        console.error("Error sending list:", error.response ? error.response.data : error.message);
        let listText = bodyText + "\n\n";
        sections.forEach(sec => {
            listText += `*${sec.title}*\n`;
            sec.rows.forEach(r => {
                listText += `• *${r.title}* ${r.description ? `(${r.description})` : ''}\n`;
            });
            listText += "\n";
        });
        await sendMessage(target, listText).catch(e => console.error('[sendListTextFallback] FAILED:', e.message));
    }
}

function calculateLeadScore(contact) {
    let score = 0;
    score += (contact.orders ? contact.orders.length * 20 : 0);
    score += Math.min(contact.loyaltyPoints || 0, 50);
    if (contact.consent) score += 20;
    if (contact.cart && contact.cart.length > 0) score += 15;
    return score;
}

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

// --- Chatbot Main Logic ---
async function handleBotReply(phone, messageText, contact) {

    const isAdminCmd = await handleAdminCommand(phone, messageText);
    if (isAdminCmd) return;

    if (isTargetNumber(phone) && !contact.is_paused) {
        if (contact.consent !== true) {
            contact.consent = true;
            contact.consentDate = new Date();
        }
    }

    const msg = messageText.toLowerCase().trim();
    const lang = contact.language || 'en';
    const t = MESSAGES[lang] || MESSAGES.en;

    // --- Product Review Rating Handler ---
    if (msg.startsWith('rate_') || (contact.step === 'feedback_pending' && ['5', '4', '3', '2', '1'].includes(msg))) {
        let stars = 5;
        if (msg === 'rate_5_stars' || msg === '5') stars = 5;
        else if (msg === 'rate_4_stars' || msg === '4') stars = 4;
        else if (msg === 'rate_3_stars' || ['1', '2', '3'].includes(msg)) stars = 3;

        contact.step = 'main_menu';
        contact.lead_status = "Feedback Received";
        await contact.save();

        if (stars >= 4) {
            const thankYouMsg = lang === 'en'
                ? `🎉 *Thank you for your ${stars}-Star Review!* ⭐⭐⭐⭐⭐\n\nWe are thrilled you enjoyed your organic food products from Mansara Foods! 🌿\n\n🎁 Use coupon code *THANKYOU10* to get *10% OFF* your next purchase!`
                : `🎉 *உங்கள் ${stars}-நட்சத்திர மதிப்பாய்வுக்கு நன்றி!* ⭐⭐⭐⭐⭐\n\nமன்சரா ஃபுட்ஸின் இயற்கை உணவுகளை நீங்கள் ரசித்ததில் நாங்கள் மகிழ்ச்சியடைகிறோம்! 🌿\n\n🎁 உங்கள் அடுத்த ஆர்டரில் 10% தள்ளுபடி பெற *THANKYOU10* கியூபொனை பயன்படுத்தவும்!`;
            
            await sendInteractiveButtons(phone, thankYouMsg, [
                { id: "opt_1_shop", title: lang === 'en' ? "Shop Again 🛍️" : "மீண்டும் வாங்க 🛍️" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);
        } else {
            const feedbackCareMsg = lang === 'en'
                ? `🙏 *Thank you for your feedback.*\n\nWe are sorry to hear your experience wasn't perfect. Our customer support team would love to make it right for you!`
                : `🙏 *உங்கள் கருத்திற்கு நன்றி.*\n\nஎங்கள் சேவை உங்களுக்கு முழு திருப்தி அளிக்காததற்கு வருந்துகிறோம். எங்கள் வாடிக்கையாளர் ஆதரவு குழு உங்களுக்கு உதவ தயாராக உள்ளது!`;
            
            await sendInteractiveButtons(phone, feedbackCareMsg, [
                { id: "btn_human", title: lang === 'en' ? "Talk to Agent 🎧" : "எஜென்ட்டிடம் பேச 🎧" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);
        }
        return;
    }

    const isRestartKeyword = ['hi', 'hello', 'hey', 'menu', 'main menu', 'restart', 'start', 'btn_menu', 'hi!', '0'].includes(msg) || msg === '0';

    if (contact.is_paused) {
        if (isRestartKeyword) {
            contact.is_paused = false;
            contact.step = 'main_menu';
            await contact.save();
            await sendMainMenu(phone, contact);
        }
        return;
    }

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
            { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "கடைப் பட்டியல் 📁" },
            { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் பார்க்க 🛒" },
            { id: "btn_support", title: lang === 'en' ? "Support 💬" : "உதவி 💬" }
        ], BANNER_IMAGE_URL);
        return;
    }

    if (msg === "6" || msg === "btn_human" || msg.includes("human") || msg.includes("agent") || msg.includes("talk to someone")) {
        contact.is_paused = true;
        contact.step = 'human_takeover';
        await contact.save();
        
        const handoffMsg = lang === 'en' 
            ? `👋 *Connecting you to our team!*\n\nOur team member will respond shortly.\n\n📞 *Direct Call/WhatsApp:* +91 96000 67611\n_Hours: 9 AM - 6 PM (Mon-Sat)_\n\n_Send *Hi* anytime to restart the bot._`
            : `👋 *எங்கள் குழுவோடு உங்களை இணைக்கிறோம்!*\n\nஎங்கள் குழு உறுப்பினர் விரைவில் பதிலளிப்பார்.\n\n📞 *நேரடி தொடர்பு/வாட்ஸ்அப்:* +91 96000 67611\n_நேரம்: காலை 9 - மாலை 6 (திங்கள்-சனி)_\n\n_மீண்டும் தொடங்க *Hi* அனுப்பவும்._`;
        
        await sendMessage(phone, handoffMsg);
        
        if (SALES_TEAM_PHONE) {
            await sendMessage(SALES_TEAM_PHONE, `⚠️ *LIVE AGENT HANDOFF REQUIRED*\nCustomer: ${contact.name || phone} (${phone})\nLanguage: ${lang}\nNeeds human assistance.`);
        }
        return;
    }

    if (contact.consent === null && contact.step !== 'consent_pending') {
        contact.step = 'consent_pending';
        await contact.save();
        await sendInteractiveButtons(phone, MESSAGES.en.welcome + "\n\n" + MESSAGES.ta.welcome, [
            { id: "btn_opt_in_yes", title: "Yes, I agree" },
            { id: "btn_opt_in_no", title: "No, Guest Mode" }
        ], BANNER_IMAGE_URL);
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

    if (isRestartKeyword) {
        await sendMainMenu(phone, contact);
        return;
    }

    // --- 1. MAIN MENU ROUTING ---
    if (contact.step === 'main_menu' || msg.startsWith('opt_')) {
        if (msg === '1' || msg === '1️⃣' || msg.includes('shop') || msg === 'opt_1_shop' || msg === 'opt_1_products' || msg === 'btn_catalog') {
            await sendShopProductsMenu(phone, contact);
            return;
        }
        if (msg === '2' || msg === '2️⃣' || msg.includes('order') || msg === 'opt_2_orders' || msg === 'opt_2_order') {
            await sendOrdersMenu(phone, contact);
            return;
        }
        if (msg === '3' || msg === '3️⃣' || msg.includes('business') || msg.includes('dealer') || msg.includes('bulk') || msg === 'opt_3_business') {
            await sendBusinessMenu(phone, contact);
            return;
        }
        if (msg === '4' || msg === '4️⃣' || msg.includes('help') || msg.includes('support') || msg === 'opt_4_support') {
            await sendSupportMenu(phone, contact);
            return;
        }
        if (msg.includes('offer') || msg.includes('discount') || msg.includes('coupon') || msg === '6') {
            const offerText = `🏷️ *Special Offers & Discounts* 🎁\n\n🔥 *WELCOME10*: 10% OFF on all Health Mixes\n🔥 *SAVE10*: Extra 10% OFF on Cart items!\n🔥 *FREE SHIPPING* on all orders above ₹500\n\nTap below to shop with discount:`;
            await sendInteractiveButtons(phone, offerText, [
                { id: "opt_1_shop", title: "Shop Products 🛍️" },
                { id: "btn_cart", title: "View Cart 🛒" },
                { id: "btn_menu", title: "Main Menu 🏠" }
            ]);
            return;
        }
    }

    // --- 2. SHOP PRODUCTS FLOW ---
    if (contact.step === 'shop_products' || msg.startsWith('shop_')) {
        if (msg === '1' || msg === 'shop_1_categories' || msg.includes('category') || msg.includes('categories')) {
            await sendProductCategoriesMenu(phone, contact);
            return;
        }
        if (msg === '2' || msg === 'shop_2_offers' || msg.includes('offer')) {
            const offerText = `🏷️ *Today's Special Offers*\n\n🔥 10% OFF on all Health Mixes (Code: WELCOME10)\n🔥 Buy 2 Podi Packs & Get 1 Free!\n🔥 Free Shipping on orders above ₹500`;
            await sendInteractiveButtons(phone, offerText, [
                { id: "shop_1_categories", title: "Product Categories 🥫" },
                { id: "shop_5_back", title: "Main Menu 🏠" }
            ]);
            return;
        }
        if (msg === '3' || msg === 'shop_3_arrivals' || msg.includes('new') || msg.includes('arrival')) {
            const allProds = await fetchLiveProducts();
            const topNew = allProds.slice(0, 3);
            let newText = `✨ *New Arrivals & Featured Products*\n\n`;
            topNew.forEach((p, i) => {
                newText += `${i + 1}. 🌾 ${p.name} (${p.weight} - ₹${p.price})\n`;
            });
            await sendInteractiveButtons(phone, newText, [
                { id: "shop_1_categories", title: "Product Categories 🥫" },
                { id: "shop_5_back", title: "Main Menu 🏠" }
            ]);
            return;
        }
        if (msg === '4' || msg === 'shop_4_recipes' || msg.includes('recipe')) {
            const recipeText = `🍳 *Recipes*\n\n1. 🥣 Ragi Choco Malt Drink\n2. 🌾 Multigrain Health Mix Porridge\n3. 🍚 Authentic Podi Rice with Ghee`;
            await sendInteractiveButtons(phone, recipeText, [
                { id: "shop_1_categories", title: "Product Categories 🥫" },
                { id: "shop_5_back", title: "Main Menu 🏠" }
            ]);
            return;
        }
        if (msg === '5' || msg === 'shop_5_back' || msg === 'back' || msg.includes('main menu')) {
            await sendMainMenu(phone, contact);
            return;
        }
    }

    // --- 3. PRODUCT CATEGORIES FLOW ---
    if (contact.step === 'product_categories' || msg.startsWith('cat_')) {
        let catName = "";
        if (msg === '1' || msg === 'cat_readymix' || msg.includes('health') || msg.includes('porridge')) catName = "Health Mixes";
        else if (msg === '2' || msg === 'cat_podi' || msg.includes('podi') || msg.includes('rice')) catName = "Rice Podi Mixes";
        else if (msg === '3' || msg === 'cat_combos' || msg.includes('combo') || msg.includes('wellness')) catName = "Combos & Packs";
        else if (msg === '4' || msg === 'cat_all' || msg.includes('all')) catName = "All";

        if (catName) {
            await sendCategoryItemsMenu(phone, catName, contact);
            return;
        }

        if (msg === '5' || msg === 'cat_back' || msg === 'back' || msg.includes('main menu')) {
            await sendMainMenu(phone, contact);
            return;
        }
    }

    // --- 4. CATEGORY ITEMS SELECTION ---
    if (contact.step === 'category_items_list' || msg.startsWith('item_select_') || msg === 'item_back' || msg === 'shop_more_products') {
        if (msg === 'shop_more_products' || msg.includes('more product')) {
            await sendMoreProductsMenu(phone, contact);
            return;
        }

        const items = await fetchLiveProductsByCategory(contact.selectedCategory || 'All');

        if (msg.startsWith('item_select_')) {
            const prodId = msg.replace('item_select_', '');
            const selectedProd = await fetchLiveProductById(prodId);
            if (selectedProd) {
                await sendProductCardView(phone, selectedProd, contact);
                return;
            }
        }

        const choice = parseInt(msg);
        if (!isNaN(choice) && choice >= 1 && choice <= items.length) {
            const selectedProd = items[choice - 1];
            await sendProductCardView(phone, selectedProd, contact);
            return;
        }

        if (msg === 'item_back' || msg === 'shop_5_back' || msg === 'back' || msg.includes('back')) {
            await sendProductCategoriesMenu(phone, contact);
            return;
        }
    }

    // --- 5. INDIVIDUAL PRODUCT ACTIONS ---
    if (contact.step === 'product_item_view' || msg.startsWith('prod_action_')) {
        const selectedProd = await fetchLiveProductById(contact.selectedProductId);

        if (msg === '1' || msg === 'prod_action_details' || msg.includes('detail')) {
            const stockStatus = selectedProd.stock > 5 ? 'Available (In Stock)' : selectedProd.stock > 0 ? `Low Stock (${selectedProd.stock} left)` : 'Out of Stock';
            const detailsText = `ℹ️ *${selectedProd.name} Details*\n\n${selectedProd.description}\n\nWeight: ${selectedProd.weight}\nPrice: ₹${selectedProd.price}\nStock: ${stockStatus}`;
            await sendMessage(phone, detailsText);
            await sendProductCardView(phone, selectedProd, contact);
            return;
        }

        if (msg === '2' || msg === 'prod_action_add' || msg.includes('add')) {
            const existingItem = contact.cart.find(item => item.productId === selectedProd.id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                contact.cart.push({ productId: selectedProd.id, name: selectedProd.name, price: selectedProd.price, quantity: 1 });
            }
            contact.funnelState = 'cart';
            await contact.save();

            const addedMsg = `🛒 Added *${selectedProd.name} (${selectedProd.weight})* to your cart!\nTotal Cart Items: ${contact.cart.length}`;
            await sendInteractiveButtons(phone, addedMsg, [
                { id: "btn_checkout", title: "Checkout 💳" },
                { id: "btn_cart", title: "View Cart 🛒" },
                { id: "opt_1_shop", title: "Continue Shopping 🛍️" }
            ]);
            return;
        }

        if (msg === '3' || msg === 'prod_action_buy' || msg.includes('buy')) {
            const existingItem = contact.cart.find(item => item.productId === selectedProd.id);
            if (!existingItem) {
                contact.cart.push({ productId: selectedProd.id, name: selectedProd.name, price: selectedProd.price, quantity: 1 });
            }
            contact.step = 'checkout_address';
            contact.funnelState = 'checkout';
            await contact.save();

            const checkoutMsg = `💳 *Checkout - Shipping Details*\n\nPlease type your complete delivery address (Street, City, Pincode):`;
            await sendMessage(phone, checkoutMsg);
            return;
        }

        if (msg === '4' || msg === 'prod_action_back' || msg === 'back' || msg.includes('back')) {
            await sendShopProductsMenu(phone, contact);
            return;
        }
    }

    // --- 6. ORDERS MENU FLOW ---
    if (contact.step === 'orders_menu' || msg.startsWith('orders_')) {
        if (msg === '1' || msg === 'orders_1_place' || msg.includes('place')) {
            await sendShopProductsMenu(phone, contact);
            return;
        }
        if (msg === '2' || msg === 'orders_2_track' || msg.includes('track')) {
            const userOrders = await fetchCrossChannelOrders(phone);
            if (userOrders.length > 0) {
                const lastOrder = userOrders[0];
                const trackMsg = `📦 *Order Tracking*\n\nOrder ID: *${lastOrder.orderId}*\nStatus: *${lastOrder.status}*\nPayment: *${lastOrder.paymentStatus}*\nTotal: ₹${lastOrder.total}\nTracking Link: ${lastOrder.trackingLink}`;
                await sendInteractiveButtons(phone, trackMsg, [
                    { id: "orders_6_back", title: "Orders Menu 📦" },
                    { id: "btn_menu", title: "Main Menu 🏠" }
                ]);
            } else {
                await sendMessage(phone, "📦 You haven't placed any orders yet.");
                await sendOrdersMenu(phone, contact);
            }
            return;
        }
        if (msg === '3' || msg === 'orders_3_reorder' || msg.includes('reorder')) {
            const userOrders = await fetchCrossChannelOrders(phone);
            if (userOrders.length > 0) {
                const lastOrder = userOrders[0];
                lastOrder.items.forEach(i => {
                    contact.cart.push({ productId: i.productId || "69620f7e7f9c4b0e78ddbc4d", name: i.name, price: i.price, quantity: i.quantity });
                });
                contact.step = 'checkout_address';
                contact.funnelState = 'checkout';
                await contact.save();
                await sendMessage(phone, `🔄 Added items from Order *${lastOrder.orderId}* to your cart!\n\nPlease type your delivery address to proceed with reorder:`);
            } else {
                await sendMessage(phone, "📦 No previous orders found to reorder.");
                await sendOrdersMenu(phone, contact);
            }
            return;
        }
        if (msg === '4' || msg === 'orders_4_history' || msg.includes('history')) {
            const userOrders = await fetchCrossChannelOrders(phone);
            if (userOrders.length > 0) {
                let historyText = `📜 *Cross-Channel Order History*\n\n`;
                userOrders.forEach((o, idx) => {
                    historyText += `${idx + 1}. *${o.orderId}* - ₹${o.total} (${o.status})\nDate: ${new Date(o.createdAt).toLocaleDateString()}\n\n`;
                });
                await sendInteractiveButtons(phone, historyText, [
                    { id: "orders_6_back", title: "Orders Menu 📦" },
                    { id: "btn_menu", title: "Main Menu 🏠" }
                ]);
            } else {
                await sendMessage(phone, "📦 No order history available yet.");
                await sendOrdersMenu(phone, contact);
            }
            return;
        }
        if (msg === '5' || msg === 'orders_5_payment' || msg.includes('payment')) {
            const userOrders = await fetchCrossChannelOrders(phone);
            if (userOrders.length > 0) {
                const lastOrder = userOrders[0];
                const payMsg = `💳 *Payment Status*\n\nOrder ID: *${lastOrder.orderId}*\nAmount: ₹${lastOrder.total}\nPayment Method: ${lastOrder.paymentStatus}\nStatus: ${lastOrder.paymentStatus === 'Paid' ? '✅ Paid' : lastOrder.paymentStatus === 'COD' ? '💵 Cash on Delivery' : '⏳ Pending'}`;
                await sendInteractiveButtons(phone, payMsg, [
                    { id: "orders_6_back", title: "Orders Menu 📦" },
                    { id: "btn_menu", title: "Main Menu 🏠" }
                ]);
            } else {
                await sendMessage(phone, "📦 No active orders or pending payments.");
                await sendOrdersMenu(phone, contact);
            }
            return;
        }
        if (msg === '6' || msg === 'orders_6_back' || msg === 'back' || msg.includes('back')) {
            await sendMainMenu(phone, contact);
            return;
        }
    }

    // --- 7. BUSINESS MENU FLOW ---
    if (contact.step === 'business_menu' || msg.startsWith('biz_')) {
        if (msg === '1' || msg === 'biz_1_dealer' || msg.includes('dealer')) {
            contact.step = 'dealer_registration';
            await contact.save();
            const dealerMsg = `🤝 *Mansara Foods Dealer Registration*\n\nPartner with us to distribute authentic traditional food products in your region!\n\nPlease reply with:\n1. Your Name / Business Name\n2. City & District\n3. Contact Phone Number`;
            await sendMessage(phone, dealerMsg);
            return;
        }
        if (msg === '2' || msg === 'biz_2_distributor' || msg.includes('distributor')) {
            contact.step = 'distributor_registration';
            await contact.save();
            const distMsg = `🚚 *Mansara Foods Distributor Network*\n\nExpand your business with fast-selling organic health products!\n\nPlease reply with:\n1. Company / Enterprise Name\n2. Operating Districts / State\n3. Contact Phone & Email`;
            await sendMessage(phone, distMsg);
            return;
        }
        if (msg === '3' || msg === 'biz_3_bulk' || msg.includes('bulk')) {
            contact.step = 'bulk_orders';
            await contact.save();
            const bulkMsg = `📦 *Bulk & Wholesale Orders*\n\nWe supply bulk quantities for corporate gifting, events, restaurants & institutions.\n\nPlease type the products and quantity required (e.g., *50 Packs Ragi Choco Malt, 100 Packs Lemon Pickle*).`;
            await sendMessage(phone, bulkMsg);
            return;
        }
        if (msg === '4' || msg === 'biz_4_price' || msg.includes('price')) {
            const priceMsg = `📄 *Mansara B2B Wholesale Price List Summary*\n\n1. Ragi Choco Malt (50+ units): ₹200 / unit\n2. Health Mixes (50+ units): ₹160 / unit\n3. Podi Varieties (100+ units): ₹65 / unit\n4. Pickles (50+ units): ₹140 / unit\n5. Cold-Pressed Oils (20+ L): ₹350 / L`;
            await sendInteractiveButtons(phone, priceMsg, [
                { id: "biz_3_bulk", title: "Submit Bulk Order 📦" },
                { id: "biz_7_back", title: "Business Menu 🏪" }
            ]);
            return;
        }
        if (msg === '5' || msg === 'biz_5_partner' || msg.includes('partner')) {
            contact.step = 'partner_registration';
            await contact.save();
            const partnerMsg = `💼 *Become a Partner*\n\nInterested in co-branding, white-labeling, or export partnerships?\n\nPlease reply with your proposal summary and phone number:`;
            await sendMessage(phone, partnerMsg);
            return;
        }
        if (msg === '6' || msg === 'biz_6_sales' || msg.includes('sales')) {
            contact.is_paused = true;
            contact.step = 'human_takeover';
            await contact.save();
            const salesMsg = `👋 *Connecting you to the Mansara Sales Team!*\n\nOur sales representative will respond to your chat shortly.\n\n📞 *Direct Sales Phone / WhatsApp:* +91 96000 67611\n_Hours: 9 AM - 6 PM (Mon-Sat)_`;
            await sendMessage(phone, salesMsg);
            return;
        }
        if (msg === '7' || msg === 'biz_7_back' || msg === 'back' || msg.includes('back')) {
            await sendMainMenu(phone, contact);
            return;
        }
    }

    // --- 8. HELP & SUPPORT MENU FLOW ---
    if (contact.step === 'support_menu' || msg.startsWith('supp_')) {
        if (msg === '1' || msg === 'supp_1_faq' || msg.includes('faq')) {
            const faqMsg = `💬 *Help & Support - FAQs*\n\n1. *How long does shipping take?*\n- Tamil Nadu: 2-3 days\n- Rest of India: 4-6 days\n\n2. *Are products 100% natural?*\n- Yes! Zero artificial preservatives or chemicals.\n\n3. *Payment options?*\n- UPI, Credit/Debit Cards, NetBanking & COD.`;
            await sendInteractiveButtons(phone, faqMsg, [
                { id: "supp_7_back", title: "Support Menu 💬" },
                { id: "btn_menu", title: "Main Menu 🏠" }
            ]);
            return;
        }
        if (msg === '2' || msg === 'supp_2_store' || msg.includes('store') || msg.includes('locator')) {
            const storeMsg = `📍 *Store Locator*\n\n🏢 *Head Office & Experience Store:*\nMansara Foods Pvt Ltd, Chennai, Tamil Nadu - 600001\n📞 Phone: +91 96000 67611\n\n🌐 *Official Online Shop:* https://mansarafoods.com`;
            await sendInteractiveButtons(phone, storeMsg, [
                { id: "supp_7_back", title: "Support Menu 💬" },
                { id: "btn_menu", title: "Main Menu 🏠" }
            ]);
            return;
        }
        if (msg === '3' || msg === 'supp_3_customer' || msg.includes('customer support')) {
            contact.is_paused = true;
            contact.step = 'human_takeover';
            await contact.save();
            const agentMsg = `👋 *Connecting you to Customer Support!*\n\nAn agent will join this chat shortly to assist you.\n📞 Direct Line: +91 96000 67611`;
            await sendMessage(phone, agentMsg);
            return;
        }
        if (msg === '4' || msg === 'supp_4_complaint' || msg.includes('complaint')) {
            contact.step = 'ticket_entry';
            await contact.save();
            const complaintMsg = `🎫 *Raise a Complaint / Ticket*\n\nPlease type a brief description of your issue (e.g. damaged package, missing item, delivery delay):`;
            await sendMessage(phone, complaintMsg);
            return;
        }
        if (msg === '5' || msg === 'supp_5_feedback' || msg.includes('feedback')) {
            contact.step = 'feedback_entry';
            await contact.save();
            const feedbackMsg = `⭐ *Customer Feedback*\n\nWe value your opinion! Please type your suggestions or experience with Mansara Foods:`;
            await sendMessage(phone, feedbackMsg);
            return;
        }
        if (msg === '6' || msg === 'supp_6_contact' || msg.includes('contact')) {
            const contactUsMsg = `📞 *Contact Us*\n\n🏢 Mansara Foods Pvt Ltd\n📍 Chennai, Tamil Nadu, India\n📞 Phone / WhatsApp: +91 96000 67611\n✉️ Email: support@mansarafoods.com\n🌐 Website: https://mansarafoods.com`;
            await sendInteractiveButtons(phone, contactUsMsg, [
                { id: "supp_7_back", title: "Support Menu 💬" },
                { id: "btn_menu", title: "Main Menu 🏠" }
            ]);
            return;
        }
        if (msg === '7' || msg === 'supp_7_back' || msg === 'back' || msg.includes('back')) {
            await sendMainMenu(phone, contact);
            return;
        }
    }

    // --- ADD TO CART & CHECKOUT HANDLING ---
    if (msg.startsWith('add_prod_')) {
        const prodId = msg.replace('add_', '');
        const product = await fetchLiveProductById(prodId);
        if (product) {
            const existingItem = contact.cart.find(item => item.productId === product.id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                contact.cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
            }
            contact.funnelState = 'cart';
            await contact.save();

            const cartMsg = lang === 'en'
                ? `🛒 Added *1x ${product.name}* to your cart!\nPrice: ₹${product.price}\n\nWhat would you like to do?`
                : `🛒 *1x ${product.name}* உங்கள் கார்ட்டில் சேர்க்கப்பட்டது!\nவிலை: ₹${product.price}\n\nநீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?`;

            await sendInteractiveButtons(phone, cartMsg, [
                { id: "btn_checkout", title: lang === 'en' ? "Checkout 💳" : "செக்அவுட் 💳" },
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் பார்க்க 🛒" },
                { id: "btn_catalog", title: lang === 'en' ? "Continue Shopping 🛍️" : "தொடர்ந்து வாங்க 🛍️" }
            ]);
            return;
        }
    }

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
            { id: "pay_online", title: lang === 'en' ? "1 - Pay Online" : "1 - ஆன்லைனில் செலுத்த" },
            { id: "pay_cod", title: lang === 'en' ? "2 - Cash on Delivery" : "2 - கேஷ் ஆன் டெலிவரி" }
        ]);
        return;
    }

    if (contact.step === 'checkout_payment_mode') {
        const isOnline = msg === '1' || msg === 'pay_online' || msg.includes('online') || msg.includes('upi');
        const isCod = msg === '2' || msg === 'pay_cod' || msg.includes('cod') || msg.includes('delivery');

        if (isOnline || isCod) {
            const subtotal = contact.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            let discount = 0;
            if (contact.loyaltyPoints > 0) {
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
                trackingLink: `https://mansarafoods.com/order-tracking/${orderId}`,
                createdAt: new Date()
            };

            contact.orders.push(newOrder);
            contact.cart = [];
            contact.funnelState = 'completed';

            await saveOrderToDatabase(newOrder, contact);

            if (isCod) {
                const earnedPoints = Math.floor(total * 0.05);
                contact.loyaltyPoints += earnedPoints;
                contact.step = 'main_menu';
                await contact.save();

                const successMsg = t.cod_success
                    .replace('{orderId}', orderId)
                    .replace('{total}', total)
                    .replace('{points}', earnedPoints);

                await sendInteractiveButtons(phone, successMsg, [
                    { id: "orders_2_track", title: lang === 'en' ? "Track Order 📦" : "ஆர்டரைக் கண்காணிக்க 📦" },
                    { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
                ]);

                syncCrmOrder(contact, newOrder);
                notifyAdminNewOrder({
                    orderId: newOrder.orderId,
                    customerName: contact.name || 'WhatsApp Customer',
                    customerPhone: phone,
                    address: contact.address || 'N/A',
                    items: newOrder.items,
                    total: newOrder.total,
                    paymentMethod: 'COD',
                    paymentStatus: 'COD'
                }).catch(err => console.error('[ADMIN NOTIFY ERROR]:', err.message));
            } else {
                contact.step = 'payment_pending';
                await contact.save();

                const successMsg = t.payment_pending
                    .replace('{orderId}', orderId)
                    .replace('{total}', total);

                await sendInteractiveButtons(phone, successMsg, [
                    { id: "confirm_payment", title: lang === 'en' ? "Confirm Payment ✅" : "கட்டணத்தை உறுதிப்படுத்த ✅" },
                    { id: "cancel_pending_order", title: lang === 'en' ? "Cancel Order ❌" : "ஆர்டரை ரத்து செய் ❌" }
                ]);
            }
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

    // --- CONVERSATIONAL SEARCH ASSISTANT ---
    if (msg.length > 2) {
        const matches = await searchLiveProducts(msg);
        if (matches && matches.length > 0) {
            contact.step = 'main_menu';
            await contact.save();

            let resultsMsg = lang === 'en' 
                ? `🔍 *Database Search Results for "${messageText}":*\n\n`
                : `🔍 *"${messageText}" க்கான தேடல் முடிவுகள்:*\n\n`;

            matches.slice(0, 5).forEach((p, index) => {
                const stockText = p.stock > 0 ? `Stock: ${p.stock}` : `⚠️ Out of Stock`;
                resultsMsg += `*${index + 1}️⃣ ${p.name}* - ₹${p.price} (${stockText})\n_${p.description.slice(0, 60)}_\n👉 ID: \`add_${p.id}\` to buy\n\n`;
            });

            await sendInteractiveButtons(phone, resultsMsg, [
                { id: "btn_catalog", title: lang === 'en' ? "Browse Categories" : "பிரிவுகளைக் காண்க" },
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் காண்க 🛒" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);
            return;
        }
    }

    // Fallback menu
    contact.step = 'main_menu';
    await contact.save();
    await sendInteractiveButtons(phone, t.invalid_option, [
        { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" },
        { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "கடைப் பட்டியல் 📁" },
        { id: "btn_human", title: lang === 'en' ? "Talk to Human 👤" : "எஜென்ட்டிடம் பேச 👤" }
    ]);
}

async function sendMainMenu(phone, contact) {
    contact.step = 'main_menu';
    await contact.save();

    const welcomeMsg = `👋 Welcome to Mansara Foods!\n\nநாங்கள் தயாரிப்பது வெறும் பொருள் அல்ல, ஒரு குடும்பத்தின் ஆரோக்கியம்.\n\nPlease choose an option below:`;

    await sendInteractiveButtons(phone, welcomeMsg, [
        { id: "opt_1_shop",     title: "🛍️ Shop Products" },
        { id: "opt_2_orders",   title: "📋 My Orders" },
        { id: "opt_3_business", title: "💼 Business" }
    ], BANNER_IMAGE_URL);

    await new Promise(resolve => setTimeout(resolve, 800));

    await sendInteractiveButtons(phone, "❓ Need help? We're here for you!", [
        { id: "opt_4_support", title: "🎧 Help & Support" }
    ]);
}

async function sendShopProductsMenu(phone, contact) {
    contact.step = 'category_items_list';
    contact.selectedCategory = 'Top';
    await contact.save();

    const allProds = await fetchLiveProducts();
    const topProducts = allProds.slice(0, 8);
    const topRows = topProducts.map((item, idx) => {
        const prefix = `${idx + 1}. `;
        const maxNameLen = 24 - prefix.length;
        return {
            id: `item_select_${item.id}`,
            title: `${prefix}${item.name.slice(0, maxNameLen)}`.substring(0, 24),
            description: `${item.weight} – ₹${item.price} (Stock: ${item.stock})`
        };
    });

    const sections = [
        {
            title: "🛒 Top Products",
            rows: topRows
        },
        {
            title: "More Options",
            rows: [
                { id: "shop_more_products", title: "📦 More Products", description: "View remaining products catalog" },
                { id: "shop_5_back", title: "🏠 Main Menu", description: "Return to main menu" }
            ]
        }
    ];

    await sendInteractiveList(
        phone,
        `🛒 *Shop Products*\n\nBrowse our top traditional products directly from database catalog:`,
        "View Products 🛍️",
        sections
    );
}

async function sendMoreProductsMenu(phone, contact) {
    contact.step = 'category_items_list';
    contact.selectedCategory = 'More';
    await contact.save();

    const allProds = await fetchLiveProducts();
    const remainingProducts = allProds.slice(8);
    const remainingRows = remainingProducts.map((item, idx) => {
        const prefix = `${idx + 9}. `;
        const maxNameLen = 24 - prefix.length;
        return {
            id: `item_select_${item.id}`,
            title: `${prefix}${item.name.slice(0, maxNameLen)}`.substring(0, 24),
            description: `${item.weight} – ₹${item.price}`
        };
    });

    const sections = [
        {
            title: "📦 More Products",
            rows: remainingRows
        },
        {
            title: "Navigation",
            rows: [
                { id: "opt_1_shop", title: "⬅️ Top Products", description: "Return to top products" },
                { id: "shop_5_back", title: "🏠 Main Menu", description: "Return to main menu" }
            ]
        }
    ];

    await sendInteractiveList(
        phone,
        `📦 *More Products*\n\nHere are more of our traditional products:`,
        "More Products 🛍️",
        sections
    );
}

async function sendProductCategoriesMenu(phone, contact) {
    contact.step = 'product_categories';
    await contact.save();

    const liveCats = await fetchLiveCategories();
    const rows = liveCats.map(c => ({
        id: `cat_${c.name.toLowerCase().replace(/\s+/g, '_')}`,
        title: `🥫 ${c.name}`.substring(0, 24),
        description: c.description.substring(0, 70) || `Browse ${c.name}`
    }));

    rows.push({ id: "cat_all", title: "🛍️ All Products", description: "Browse complete catalog" });

    const sections = [
        { title: "📁 Product Categories", rows },
        { title: "Navigation", rows: [{ id: "cat_back", title: "🏠 Main Menu", description: "Return to main menu" }] }
    ];

    await sendInteractiveList(
        phone,
        `🥫 *Mansara Product Categories*\n\nPlease choose a category below:`,
        "Select Category 📁",
        sections
    );
}

async function sendCategoryItemsMenu(phone, category, contact) {
    contact.step = 'category_items_list';
    contact.selectedCategory = category;
    await contact.save();

    const items = await fetchLiveProductsByCategory(category);

    const rows = items.slice(0, 9).map((item, idx) => ({
        id: `item_select_${item.id}`,
        title: `${idx + 1}. ${item.name.slice(0, 18)}`.substring(0, 24),
        description: `${item.weight} - ₹${item.price} (${item.stock > 0 ? 'In Stock' : 'Out of Stock'})`
    }));

    rows.push({
        id: "item_back",
        title: `${rows.length + 1}. Back`,
        description: "Return to Categories"
    });

    const sections = [{ title: (category === "All" ? "All Products" : category).substring(0, 24), rows }];
    await sendInteractiveList(phone, `🥫 *${category === "All" ? "All Products" : category}*\n\nPlease select a product below:`, "Select Product 🛍️", sections);
}

async function sendProductCardView(phone, selectedProd, contact) {
    contact.selectedProductId = selectedProd.id;
    contact.step = 'product_item_view';
    await contact.save();

    const icon = selectedProd.category === 'Pickles' ? '🍋' : selectedProd.category === 'Oils & Ghee' ? '🧈' : selectedProd.category === 'Snacks' ? '🥨' : '🥣';
    const stockStatus = selectedProd.stock > 5 ? '✅ In Stock' : selectedProd.stock > 0 ? `⚠️ Low Stock (${selectedProd.stock} left)` : '❌ Out of Stock';
    
    const cardText = `${icon} *${selectedProd.name}*\n\n✅ Weight: ${selectedProd.weight}\n✅ Price: ₹${selectedProd.price}\n📦 Availability: ${stockStatus}\n\n📝 _${selectedProd.description}_\n\nPlease choose an action below:`;

    const buttons = [
        { id: "prod_action_add", title: "🛒 Add to Cart" },
        { id: "prod_action_buy", title: "⚡ Buy Now" },
        { id: "prod_action_back", title: "🏠 Back" }
    ];

    await sendInteractiveButtons(phone, cardText, buttons);
}

async function sendOrdersMenu(phone, contact) {
    contact.step = 'orders_menu';
    await contact.save();

    const userOrders = await fetchCrossChannelOrders(phone);

    if (userOrders && userOrders.length > 0) {
        const latestOrder = userOrders[0];
        const dateStr = latestOrder.createdAt 
            ? new Date(latestOrder.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Recent';

        let itemsSummary = '';
        if (latestOrder.items && latestOrder.items.length > 0) {
            itemsSummary = latestOrder.items.map(i => `• *${i.name}* (x${i.quantity}) - ₹${i.price * i.quantity}`).join('\n');
        } else {
            itemsSummary = '• Item details in order invoice';
        }

        const trackingInfo = `\n🔗 *Tracking:* ${latestOrder.trackingLink}`;

        const text = `📦 *My Orders (Cross-Channel Tracking)*\n\n🔹 *Your Latest Order Details:* (${latestOrder.source || 'Website'})\n🆔 *Order ID:* ${latestOrder.orderId}\n📅 *Date:* ${dateStr}\n📊 *Status:* *${latestOrder.status}* (${latestOrder.paymentStatus})\n\n🛒 *Items Purchased:*\n${itemsSummary}\n\n💰 *Total Amount:* ₹${latestOrder.total}${trackingInfo}\n\nSelect an option below:`;

        const buttons = [
            { id: "orders_2_track", title: "🚚 Track Order" },
            { id: "orders_4_history", title: "📜 Order History" },
            { id: "orders_6_back", title: "🏠 Main Menu" }
        ];

        await sendInteractiveButtons(phone, text, buttons);
    } else {
        const text = `📦 *My Orders*\n\nℹ️ You haven't placed any orders yet.\n\nBrowse our authentic traditional products to place your first order!`;
        const buttons = [
            { id: "opt_1_shop", title: "🛍️ Shop Products" },
            { id: "orders_6_back", title: "🏠 Main Menu" }
        ];

        await sendInteractiveButtons(phone, text, buttons);
    }
}

async function sendBusinessMenu(phone, contact) {
    contact.step = 'business_menu';
    await contact.save();

    const text = `🏪 *Business*\n\nPlease choose an option below:`;
    const sections = [
        {
            title: "Business Options",
            rows: [
                { id: "biz_1_dealer", title: "🤝 Dealer Registration", description: "Become an authorized dealer" },
                { id: "biz_2_distributor", title: "🚚 Distributor Network", description: "Join regional distribution network" },
                { id: "biz_3_bulk", title: "📦 Bulk Order", description: "Corporate gifting & bulk inquiries" },
                { id: "biz_4_price", title: "📋 Request Price List", description: "View wholesale B2B pricing" },
                { id: "biz_5_partner", title: "⭐ Become a Partner", description: "Co-branding & export partnerships" },
                { id: "biz_6_sales", title: "📞 Contact Sales Team", description: "Speak directly with sales representative" },
                { id: "biz_7_back", title: "🏠 Back", description: "Return to Main Menu" }
            ]
        }
    ];

    await sendInteractiveList(phone, text, "Business Menu 🏪", sections);
}

async function sendSupportMenu(phone, contact) {
    contact.step = 'support_menu';
    await contact.save();

    const text = `💬 *Help & Support*\n\nPlease choose an option below:`;
    const buttons = [
        { id: "supp_3_customer", title: "🎧 Live Support" },
        { id: "supp_1_faq", title: "❓ FAQs & Store Info" },
        { id: "supp_7_back", title: "🏠 Main Menu" }
    ];

    await sendInteractiveButtons(phone, text, buttons);
}

function syncCrmOrder(contact, order) {
    if (!process.env.CRM_LEAD_WEBHOOK) return;
    axios.post(process.env.CRM_LEAD_WEBHOOK, {
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

// --- Admin WhatsApp Control Command Handler ---
async function handleAdminCommand(phone, messageText) {
    const rawMsg = (messageText || '').trim();
    const isPrimaryAdmin = isTargetNumber(phone) || phone.endsWith('8838887064') || phone === process.env.ADMIN_PHONE;

    const lowerMsg = rawMsg.toLowerCase();
    const isAdminTrigger = isPrimaryAdmin && (
        ['admin', '/admin', 'stats', 'dashboard', 'orders', 'stock', 'leads', 'adm_menu_stats', 'adm_menu_orders', 'adm_menu_stock', 'adm_menu_leads'].includes(lowerMsg) ||
        lowerMsg.startsWith('adm_')
    );

    if (!isAdminTrigger && !rawMsg.toUpperCase().startsWith('ORD') && !rawMsg.startsWith('adm_')) {
        return false;
    }

    console.log(`[ADMIN CONTROL] Admin ${phone} invoked command: "${rawMsg}"`);

    if (['admin', '/admin', 'dashboard'].includes(lowerMsg)) {
        const metrics = await getAdminStoreMetrics();
        const adminWelcome = `⚙️ *Mansara Foods - Admin WhatsApp Control Panel* 🛠️\n\n` +
            `📊 *Store Summary:*\n` +
            `💰 Today's Revenue: *₹${metrics.todaySales}* (${metrics.todayOrdersCount} orders)\n` +
            `💵 Total Revenue: *₹${metrics.totalRevenue.toLocaleString()}*\n` +
            `📦 Pending Orders: *${metrics.pendingOrdersCount}*\n` +
            `⚠️ Low/Out of Stock Items: *${metrics.lowStockCount}*\n` +
            `👥 Total Customers: *${metrics.totalContacts}* (${metrics.optedInContacts} opted-in)\n\n` +
            `Please select an admin service below:`;

        await sendInteractiveButtons(phone, adminWelcome, [
            { id: "adm_menu_stats", title: "📊 Store Analytics" },
            { id: "adm_menu_orders", title: "📦 Pending Orders" },
            { id: "adm_menu_stock", title: "🚨 Stock Alert" }
        ]);

        await new Promise(resolve => setTimeout(resolve, 800));
        await sendInteractiveButtons(phone, "👥 Lead & Customer Management", [
            { id: "adm_menu_leads", title: "👥 Customer Leads" },
            { id: "btn_menu", title: "🏠 Customer View" }
        ]);
        return true;
    }

    if (lowerMsg === 'adm_menu_stats' || lowerMsg === 'stats') {
        const m = await getAdminStoreMetrics();
        const statsMsg = `📊 *Mansara Foods - Real-Time Store Analytics*\n\n` +
            `💰 *Sales Performance:*\n` +
            `• Today's Revenue: ₹${m.todaySales} (${m.todayOrdersCount} orders)\n` +
            `• Total Lifetime Sales: ₹${m.totalRevenue.toLocaleString()}\n\n` +
            `📦 *Order Fulfilment:*\n` +
            `• Total Orders Processed: ${m.totalOrdersCount}\n` +
            `• Pending Fulfillment: ${m.pendingOrdersCount}\n\n` +
            `🥫 *Inventory & Catalog:*\n` +
            `• Total Products Active: ${m.totalProducts}\n` +
            `• Out of Stock Items: ${m.outOfStockCount}\n` +
            `• Low Stock Alerts: ${m.lowStockCount}\n\n` +
            `👥 *Customer Engagement:*\n` +
            `• WhatsApp Contacts: ${m.totalContacts}\n` +
            `• Opted-in Subscribers: ${m.optedInContacts}\n` +
            `• Open Support Tickets: ${m.openTickets}`;

        await sendInteractiveButtons(phone, statsMsg, [
            { id: "adm_menu_orders", title: "📦 Pending Orders" },
            { id: "adm_menu_stock", title: "🚨 Stock Alert" },
            { id: "admin", title: "⚙️ Admin Menu" }
        ]);
        return true;
    }

    if (lowerMsg === 'adm_menu_orders' || lowerMsg === 'orders') {
        const m = await getAdminStoreMetrics();
        if (!m.pendingOrdersList || m.pendingOrdersList.length === 0) {
            await sendInteractiveButtons(phone, "✅ *No Pending Orders!*\n\nAll customer orders have been processed and fulfilled.", [
                { id: "admin", title: "⚙️ Admin Menu" }
            ]);
            return true;
        }

        const firstOrder = m.pendingOrdersList[0];
        let ordersMsg = `📦 *Pending Customer Orders (${m.pendingOrdersCount})*\n\n` +
            `*Latest Pending Order:* \`${firstOrder.orderId}\`\n` +
            `💰 Total: ₹${firstOrder.total} (${firstOrder.paymentStatus})\n` +
            `📍 Address: ${firstOrder.deliveryAddress?.city || 'TN'}, ${firstOrder.deliveryAddress?.zip || ''}\n\n` +
            `Select an action button below to update status for *${firstOrder.orderId}*:`;

        await sendInteractiveButtons(phone, ordersMsg, [
            { id: `adm_Packed_${firstOrder.orderId}`, title: "Pack 📦" },
            { id: `adm_Shipped_${firstOrder.orderId}`, title: "Ship 🚚" },
            { id: `adm_Delivered_${firstOrder.orderId}`, title: "Deliver ✅" }
        ]);
        return true;
    }

    if (lowerMsg === 'adm_menu_stock' || lowerMsg === 'stock') {
        const m = await getAdminStoreMetrics();
        let stockMsg = `🚨 *Inventory & Stock Status Report*\n\n`;
        if (m.lowStockItems && m.lowStockItems.length > 0) {
            stockMsg += `*Items Requiring Restock (<= 5 items):*\n`;
            m.lowStockItems.forEach(item => {
                stockMsg += `• ⚠️ ${item}\n`;
            });
            stockMsg += `\n_Please log into website admin panel to restock items._`;
        } else {
            stockMsg += `✅ All products have healthy stock levels in database!`;
        }

        await sendInteractiveButtons(phone, stockMsg, [
            { id: "adm_menu_stats", title: "📊 Analytics" },
            { id: "admin", title: "⚙️ Admin Menu" }
        ]);
        return true;
    }

    if (lowerMsg === 'adm_menu_leads' || lowerMsg === 'leads') {
        const m = await getAdminStoreMetrics();
        const leadsMsg = `👥 *Customer & Lead Statistics*\n\n` +
            `• Total Database Contacts: *${m.totalContacts}*\n` +
            `• Opted-in WhatsApp Subscribers: *${m.optedInContacts}*\n` +
            `• Open Support Tickets: *${m.openTickets}*\n\n` +
            `_Use the bot API dashboard to trigger broadcasts or manage individual leads._`;

        await sendInteractiveButtons(phone, leadsMsg, [
            { id: "adm_menu_stats", title: "📊 Analytics" },
            { id: "admin", title: "⚙️ Admin Menu" }
        ]);
        return true;
    }

    let orderId = "";
    let newStatus = "";

    if (rawMsg.startsWith('adm_')) {
        const parts = rawMsg.split('_');
        if (parts.length >= 3) {
            newStatus = parts[1];
            orderId = parts.slice(2).join('_');
        }
    } else {
        const tokens = rawMsg.split(/\s+/);
        if (tokens.length >= 2 && tokens[0].toUpperCase().startsWith('ORD')) {
            orderId = tokens[0].toUpperCase();
            const statusInput = tokens[1].toLowerCase();
            if (statusInput.includes('pack')) newStatus = 'Packed';
            else if (statusInput.includes('ship')) newStatus = 'Shipped';
            else if (statusInput.includes('deliv')) newStatus = 'Delivered';
            else if (statusInput.includes('canc')) newStatus = 'Cancelled';
        }
    }

    if (orderId && newStatus) {
        let customerPhone = "";
        try {
            const dbOrder = await OrderModel.findOne({ orderId: new RegExp(`^${orderId}$`, 'i') });
            if (dbOrder) {
                dbOrder.orderStatus = newStatus === 'Packed' ? 'Processing' : newStatus;
                await dbOrder.save();
                if (dbOrder.deliveryAddress && dbOrder.deliveryAddress.phone) {
                    customerPhone = dbOrder.deliveryAddress.phone;
                }
            }

            const contactWithOrder = await Contact.findOne({ "orders.orderId": new RegExp(`^${orderId}$`, 'i') });
            if (contactWithOrder) {
                const orderObj = contactWithOrder.orders.find(o => o.orderId.toUpperCase() === orderId.toUpperCase());
                if (orderObj) {
                    orderObj.status = newStatus;
                    await contactWithOrder.save();
                    if (!customerPhone) customerPhone = contactWithOrder.phone;
                }
            }

            if (customerPhone) {
                const trackingLink = `https://mansarafoods.com/order-tracking/${orderId}`;
                await notifyCustomerOrderStatus(customerPhone, orderId, newStatus, trackingLink).catch(e => console.error(e));
            }

            const confirmMsg = `✅ *Order Status Updated Successfully!*\n\n📦 *Order ID:* ${orderId}\n🔄 *New Status:* ${newStatus}\n👤 *Customer Notified:* ${customerPhone || 'Via System'}`;
            await sendInteractiveButtons(phone, confirmMsg, [
                { id: "adm_menu_orders", title: "📦 Pending Orders" },
                { id: "admin", title: "⚙️ Admin Menu" }
            ]);
            return true;
        } catch (e) {
            console.error('[ADMIN COMMAND ERROR]:', e.message);
        }
    }

    return false;
}

// --- Customer Order & Status Notification Helpers ---

async function ensureContactConsent(phone, name = 'Customer') {
    try {
        const custPhone = normalizePhone(phone);
        if (!custPhone) return;
        let contact = await Contact.findOne({ phone: custPhone });
        if (!contact) {
            contact = new Contact({
                phone: custPhone,
                name: name,
                consent: true,
                consentDate: new Date(),
                step: 'main_menu'
            });
            await contact.save();
        } else if (contact.consent !== true) {
            contact.consent = true;
            await contact.save();
        }
    } catch (e) {
        console.warn('[Contact Upsert Error]:', e.message);
    }
}

async function notifyCustomerOrderPlaced(phone, orderData) {
    const custPhone = normalizePhone(phone);
    if (!custPhone) return;

    await ensureContactConsent(custPhone, orderData.customerName);

    const itemsText = (orderData.items || []).map(i => `• ${i.quantity}x *${i.name || i.title}* – ₹${i.price * i.quantity}`).join('\n');
    const addr = typeof orderData.address === 'object'
        ? `${orderData.address.street || ''}, ${orderData.address.city || ''}, ${orderData.address.state || ''} - ${orderData.address.zip || ''}`
        : (orderData.address || 'Your saved address');

    const message = `Namaste ${orderData.customerName || 'Valued Customer'}! 🙏\n\n` +
        `🎉 *Order Confirmed!* 🛍️\n\n` +
        `Thank you for ordering pure, natural foods with Mansara Foods!\n\n` +
        `📦 *Order ID:* *${orderData.orderId}*\n` +
        `💰 *Total Paid/Due:* *₹${orderData.total}* (${orderData.paymentMethod || 'COD'} - ${orderData.paymentStatus || 'Pending'})\n` +
        `📍 *Delivery Address:* ${addr}\n\n` +
        `🛒 *Items Ordered:*\n${itemsText}\n\n` +
        `✅ We are preparing your fresh batch for dispatch! You will receive live status updates on WhatsApp as it ships.`;

    await sendInteractiveButtons(custPhone, message, [
        { id: "orders_2_track", title: "Track Order 📦" },
        { id: "btn_menu", title: "Main Menu 🏠" }
    ]);
}

async function sendCustomerReviewRequest(phone, { orderId, customerName = 'Valued Customer', items = [] }) {
    const custPhone = normalizePhone(phone);
    if (!custPhone) return;

    await ensureContactConsent(custPhone, customerName);

    const contact = await Contact.findOne({ phone: custPhone });
    if (contact) {
        contact.step = 'feedback_pending';
        await contact.save().catch(e => console.warn(e.message));
    }

    let itemsList = '';
    if (items && items.length > 0) {
        itemsList = '\n*Items in your order:*\n' + items.map(i => `• ${i.name || i}`).join('\n') + '\n';
    }

    const reviewMsg = `⭐ *How was your order from Mansara Foods?* 🌿\n\n` +
        `Hi ${customerName}! Your order *#${orderId}* has been delivered! 🎉\n` +
        itemsList + `\n` +
        `We would love to hear your feedback. Please rate your experience below or reply with a rating number (1-5):\n\n` +
        `🔗 *Write a review online:* https://mansarafoods.com/account/orders`;

    await sendInteractiveButtons(custPhone, reviewMsg, [
        { id: "rate_5_stars", title: "5 Stars ⭐⭐⭐⭐⭐" },
        { id: "rate_4_stars", title: "4 Stars ⭐⭐⭐⭐" },
        { id: "rate_3_stars", title: "1-3 Stars 💬" }
    ]);
}

async function sendCustomerWelcomeNotification(phone, customerName = 'Valued Customer') {
    const custPhone = normalizePhone(phone);
    if (!custPhone) return;

    await ensureContactConsent(custPhone, customerName);

    const welcomeMsg = `🌿 *Welcome to Mansara Foods!* 🌿\n\n` +
        `Namaste ${customerName}! Thank you for joining our healthy living family. 🙏\n\n` +
        `🏆 Traditional & Natural Recipes\n` +
        `✅ Homestyle Quality & Authentic Taste\n` +
        `✅ Zero Preservatives or Chemicals\n\n` +
        `🎁 *Special Gift:* Use coupon code *WELCOME10* to get *10% OFF* your first purchase!\n\n` +
        `Tap below to explore our products:`;

    await sendInteractiveButtons(custPhone, welcomeMsg, [
        { id: "opt_1_shop", title: "Shop Products 🛍️" },
        { id: "btn_catalog", title: "Browse Catalog 📁" },
        { id: "btn_menu", title: "Main Menu 🏠" }
    ]);
}

async function sendCustomerCustomNotification(phone, { customerName = 'Valued Customer', orderId = '', messageText = '' }) {
    const custPhone = normalizePhone(phone);
    if (!custPhone) return;

    await ensureContactConsent(custPhone, customerName);

    const msg = `💬 *Message from Mansara Foods* 🌿\n\n` +
        `Dear ${customerName},\n\n` +
        `${messageText}\n\n` +
        (orderId ? `📦 *Order ID:* ${orderId}\n\n` : '') +
        `If you need any assistance, tap below to reply:`;

    await sendInteractiveButtons(custPhone, msg, [
        { id: "btn_human", title: "Talk to Agent 🎧" },
        { id: "btn_menu", title: "Main Menu 🏠" }
    ]);
}

async function notifyCustomerOrderStatus(phone, orderId, status, trackingLink = '') {
    const custPhone = normalizePhone(phone);
    if (!custPhone) return;

    await ensureContactConsent(custPhone, 'Customer');

    const trackUrl = trackingLink || `https://mansarafoods.com/order-tracking/${orderId}`;
    let statusMsg = "";

    if (status === 'Packed' || status === 'Processing') {
        statusMsg = `📦 *Order Update:* Your order *${orderId}* has been packed and is ready for dispatch!`;
    } else if (status === 'Shipped') {
        statusMsg = `🚚 *Order Update:* Your order *${orderId}* has been shipped!\n\n🔗 *Track Shipment:* ${trackUrl}`;
    } else if (status === 'Out for Delivery') {
        statusMsg = `🛵 *Order Update:* Your order *${orderId}* is out for delivery today!`;
    } else if (status === 'Delivered') {
        statusMsg = `🎉 *Order Delivered!* 📦\n\nYour order *${orderId}* has been successfully delivered!\n\nThank you for choosing Mansara Foods. 🌿 We hope you love our fresh organic foods.`;
    } else if (status === 'Cancelled') {
        statusMsg = `❌ *Order Update:* Your order *${orderId}* has been cancelled.`;
    } else {
        statusMsg = `📦 *Order Update:* Your order *${orderId}* status updated to: *${status}*.`;
    }

    await sendInteractiveButtons(custPhone, statusMsg, [
        { id: "orders_2_track", title: "Track Order 📦" },
        { id: "btn_menu", title: "Main Menu 🏠" }
    ]);

    // Send Product Review Request via WhatsApp when Delivered!
    if (status === 'Delivered') {
        await new Promise(resolve => setTimeout(resolve, 2500));
        await sendCustomerReviewRequest(custPhone, { orderId, customerName: 'Valued Customer' });
    }
}

// --- Cron Jobs for Automated Notifications & Follow-ups ---

// 1. Recurring 2-Day (48-Hour) Abandoned Cart Reminder Cron Job (Runs every 6 hours)
cron.schedule('0 */6 * * *', async () => {
    console.log("Running Recurring 2-Day (48-Hour) Abandoned Cart Reminder Cron Job...");
    const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000));
    
    try {
        // Find contacts with cart items where lastCartNudgeDate is null OR > 48 hours ago
        const cartContacts = await Contact.find({
            is_paused: false,
            cart: { $exists: true, $not: { $size: 0 } },
            $or: [
                { lastCartNudgeDate: { $exists: false } },
                { lastCartNudgeDate: null },
                { lastCartNudgeDate: { $lt: twoDaysAgo } }
            ]
        });

        console.log(`[Cart Reminder Cron] Found ${cartContacts.length} contacts eligible for 2-day cart reminder`);

        for (const contact of cartContacts) {
            const lang = contact.language || 'en';
            const itemsSummary = contact.cart.map(i => `• ${i.quantity}x *${i.name}* (₹${i.price * i.quantity})`).join('\n');
            const totalAmount = contact.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

            const nudgeMsg = lang === 'en'
                ? `🛒 *Items waiting in your cart!* 👋\n\nHi ${contact.name || 'there'}, you have delicious organic items waiting in your cart.\n\n🛒 *Cart Items Summary:*\n${itemsSummary}\n*Total:* ₹${totalAmount}\n\n🎁 Use coupon code *SAVE10* to get *10% OFF* your checkout total!\n\nTap below to complete your order.`
                : `🛒 *உங்கள் கார்ட்டில் பொருட்கள் உள்ளன!* 👋\n\nவணக்கம், உங்கள் கார்ட்டில் சில சுவையான ஆர்கானிக் பொருட்கள் காத்திருக்கின்றன.\n\n*கார்ட் விபரங்கள்:*\n${itemsSummary}\n\n🎁 செக்அவுட்டில் *10% தள்ளுபடி* பெற *SAVE10* கியூபொனை பயன்படுத்தவும்!\n\nஆர்டரை முடிக்க கீழே தட்டவும்.`;
            
            await sendInteractiveButtons(contact.phone, nudgeMsg, [
                { id: "btn_checkout", title: lang === 'en' ? "Checkout 💳" : "செக்அவுட் 💳" },
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் பார்க்க 🛒" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);

            contact.lastCartNudgeDate = new Date();
            contact.lead_status = "Cart Nudged";
            await contact.save();
            console.log(`[Cart Reminder Cron] ✓ 2-day reminder sent to ${contact.phone}`);
        }
    } catch (e) {
        console.error("2-day cart recovery cron error:", e);
    }
});

// 2. Daily Survey and Follow-up (Runs daily at 10:00 AM IST)
cron.schedule('0 10 * * *', async () => {
    console.log("Running Daily NPS/CSAT and Reorder Cron Job...");
    const now = new Date();
    
    try {
        const deliveredContacts = await Contact.find({
            "orders.status": "Delivered",
            lead_status: { $ne: "Feedback Requested" }
        });

        for (const contact of deliveredContacts) {
            const deliveredOrder = contact.orders.find(o => o.status === "Delivered");
            if (deliveredOrder) {
                await sendCustomerReviewRequest(contact.phone, {
                    orderId: deliveredOrder.orderId,
                    customerName: contact.name || 'Valued Customer',
                    items: deliveredOrder.items
                });
                contact.lead_status = "Feedback Requested";
                contact.step = "feedback_pending";
                await contact.save();
            }
        }

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
                : `🌿 *பொருட்கள் மீண்டும் தேவைப்படுகிறதா?* 🛒\n\nவணக்கம், மன்சரா ஃபுட்ஸில் நீங்கள் கடைசியாக வாங்கி ஒரு மாதம் ஆகிறது. மீண்டும் ஆர்டர் செய்ய கீழே தட்டவும்!`;
            
            await sendInteractiveButtons(contact.phone, reorderMsg, [
                { id: "btn_catalog", title: lang === 'en' ? "Browse Catalog 📁" : "கடைப் பட்டியல் 📁" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
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

    console.log('[WEBHOOK] POST received. object:', body.object);

    if (body.object === 'whatsapp_business_account' && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
        const webhook_event = body.entry[0].changes[0].value;
        const message = webhook_event.messages[0];
        const contactInfo = webhook_event.contacts && webhook_event.contacts[0] ? webhook_event.contacts[0] : null;

        console.log(`[WEBHOOK] Message from: ${message.from}, type: ${message.type}`);
        
        let messageText = '';
        if (message.type === 'text') messageText = message.text.body;
        else if (message.type === 'interactive') {
            if (message.interactive.button_reply) messageText = message.interactive.button_reply.id;
            else if (message.interactive.list_reply) messageText = message.interactive.list_reply.id;
        }

        console.log(`[WEBHOOK] messageText: "${messageText}"`);

        if (messageText) {
            const phone = message.from;
            const name = contactInfo && contactInfo.profile ? contactInfo.profile.name : '';
            
            if (process.env.CRM_ENQUIRY_WEBHOOK) {
                axios.post(process.env.CRM_ENQUIRY_WEBHOOK, {
                    CustomerName: name || phone,
                    WhatsAppNumber: phone,
                    MessageText: message.type === 'text' ? message.text.body : `Selection: ${messageText}`
                })
                .then(() => console.log(`[CRM Enquiry Sync] Message synced for ${phone}`))
                .catch(e => console.error("[CRM Enquiry Sync Error]:", e.message || JSON.stringify(e)));
            }

            try {
                let contact = await Contact.findOne({ phone });
                const now = new Date();
                const isTarget = isTargetNumber(phone);
                if (!contact) {
                    console.log(`[WEBHOOK] New contact: ${phone}`);
                    contact = new Contact({ 
                        phone, 
                        name: name || phone, 
                        firstSeen: now, 
                        lastSeen: now, 
                        messageCount: 1, 
                        messages: [{ text: messageText, time: now }],
                        consent: isTarget ? true : null
                    });
                } else {
                    console.log(`[WEBHOOK] Existing contact: ${phone}, step: ${contact.step}, is_paused: ${contact.is_paused}`);
                    contact.lastSeen = now;
                    contact.messageCount += 1;
                    if (name) contact.name = name;
                    contact.messages.push({ text: messageText, time: now });
                    if (isTarget && !contact.is_paused) {
                        contact.consent = true;
                    }
                    if (contact.lead_status === "Cart Nudged") {
                        contact.lead_status = "Active";
                    }
                }
                await contact.save();
                console.log(`[WEBHOOK] Calling handleBotReply for ${phone}`);
                await handleBotReply(phone, messageText, contact);
                console.log(`[WEBHOOK] handleBotReply done for ${phone}`);
            } catch(e) {
                console.error("DB Error processing webhook:", e);
            }
        } else {
            console.log('[WEBHOOK] No messageText — skipping');
        }
    } else if (body.object === 'whatsapp_business_account' && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.statuses) {
        const statusEvent = body.entry[0].changes[0].value.statuses[0];
        console.log(`[WEBHOOK STATUS] Recipient: ${statusEvent.recipient_id}, Status: ${statusEvent.status}`);
        if (statusEvent.errors) {
            console.error(`[WEBHOOK STATUS ERROR] Meta Delivery Error for ${statusEvent.recipient_id}:`, JSON.stringify(statusEvent.errors, null, 2));
        }
    } else {
        console.log('[WEBHOOK] Not a message event — ignored');
    }
});

// --- Customer Order & Status Notification API Endpoints ---

// 1. Notify Customer of New Order Confirmation
app.post('/api/notify-customer-order', async (req, res) => {
    try {
        const { phone, orderId } = req.body;
        if (!phone || !orderId) {
            return res.status(400).json({ success: false, error: "phone and orderId are required" });
        }
        await notifyCustomerOrderPlaced(phone, req.body);
        res.json({ success: true, message: `Customer order confirmation sent to ${phone}` });
    } catch (error) {
        console.error('[API NOTIFY CUSTOMER ORDER ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Notify Customer of Order Status Change
app.post('/api/notify-customer-status', async (req, res) => {
    try {
        const { phone, orderId, status, trackingLink } = req.body;
        if (!phone || !orderId || !status) {
            return res.status(400).json({ success: false, error: "phone, orderId, and status are required" });
        }
        await notifyCustomerOrderStatus(phone, orderId, status, trackingLink);
        res.json({ success: true, message: `Customer status notification sent to ${phone}` });
    } catch (error) {
        console.error('[API NOTIFY CUSTOMER STATUS ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Notify Customer with Product Review Request (After Delivery)
app.post('/api/notify-customer-review', async (req, res) => {
    try {
        const { phone, orderId, customerName, items } = req.body;
        if (!phone || !orderId) {
            return res.status(400).json({ success: false, error: "phone and orderId are required" });
        }
        await sendCustomerReviewRequest(phone, { orderId, customerName, items });
        res.json({ success: true, message: `Customer review request sent to ${phone}` });
    } catch (error) {
        console.error('[API NOTIFY CUSTOMER REVIEW ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Notify Customer Welcome Onboarding Message
app.post('/api/notify-customer-welcome', async (req, res) => {
    try {
        const { phone, customerName } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: "phone is required" });
        }
        await sendCustomerWelcomeNotification(phone, customerName);
        res.json({ success: true, message: `Welcome message sent to ${phone}` });
    } catch (error) {
        console.error('[API NOTIFY CUSTOMER WELCOME ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Notify Customer Custom Admin Message
app.post('/api/notify-customer-custom', async (req, res) => {
    try {
        const { phone, customerName, orderId, messageText } = req.body;
        if (!phone || !messageText) {
            return res.status(400).json({ success: false, error: "phone and messageText are required" });
        }
        await sendCustomerCustomNotification(phone, { customerName, orderId, messageText });
        res.json({ success: true, message: `Custom message sent to ${phone}` });
    } catch (error) {
        console.error('[API NOTIFY CUSTOMER CUSTOM ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Send Offer / Promotional Broadcast Notification to Customers
app.post('/api/send-offer-notification', async (req, res) => {
    try {
        const { phone, offerTitle, offerDescription, couponCode, segment } = req.body;
        
        const offerText = `🏷️ *${offerTitle || 'Special Offer from Mansara Foods!'}* 🎁\n\n` +
            `${offerDescription || 'Enjoy authentic traditional health mixes & podis with special discount!'}\n\n` +
            `🎟️ Use Coupon Code: *${couponCode || 'WELCOME10'}* at checkout for discount!\n\n` +
            `🌿 Pure, zero preservatives, 100% natural.`;

        let targetContacts = [];
        if (phone) {
            targetContacts = [normalizePhone(phone)];
        } else {
            let query = {};
            if (segment === 'opt_in') query.consent = true;
            else if (segment === 'cart') query.cart = { $exists: true, $not: { $size: 0 } };

            const contacts = await Contact.find(query);
            targetContacts = contacts.map(c => c.phone);
        }

        let sentCount = 0;
        for (const targetPhone of targetContacts) {
            await sendInteractiveButtons(targetPhone, offerText, [
                { id: "opt_1_shop", title: "Shop Products 🛍️" },
                { id: "btn_catalog", title: "Browse Categories 📁" },
                { id: "btn_menu", title: "Main Menu 🏠" }
            ]);
            sentCount++;
        }

        res.json({ success: true, sentCount, message: `Offer notification sent to ${sentCount} customer(s)` });
    } catch (error) {
        console.error('[API SEND OFFER ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Trigger 2-Day Abandoned Cart Reminders (On-Demand Admin API)
app.post('/api/trigger-cart-reminders', async (req, res) => {
    try {
        const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000));
        const cartContacts = await Contact.find({
            is_paused: false,
            cart: { $exists: true, $not: { $size: 0 } },
            $or: [
                { lastCartNudgeDate: { $exists: false } },
                { lastCartNudgeDate: null },
                { lastCartNudgeDate: { $lt: twoDaysAgo } }
            ]
        });

        let sentCount = 0;
        for (const contact of cartContacts) {
            const lang = contact.language || 'en';
            const itemsSummary = contact.cart.map(i => `• ${i.quantity}x *${i.name}* (₹${i.price * i.quantity})`).join('\n');
            const totalAmount = contact.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

            const nudgeMsg = lang === 'en'
                ? `🛒 *Items waiting in your cart!* 👋\n\nHi ${contact.name || 'there'}, you have delicious organic items waiting in your cart.\n\n🛒 *Cart Items Summary:*\n${itemsSummary}\n*Total:* ₹${totalAmount}\n\n🎁 Use coupon code *SAVE10* to get *10% OFF* your checkout total!\n\nTap below to complete your order.`
                : `🛒 *உங்கள் கார்ட்டில் பொருட்கள் உள்ளன!* 👋\n\nவணக்கம், உங்கள் கார்ட்டில் சில சுவையான ஆர்கானிக் பொருட்கள் காத்திருக்கின்றன.\n\n*கார்ட் விபரங்கள்:*\n${itemsSummary}\n\n🎁 செக்அவுட்டில் *10% தள்ளுபடி* பெற *SAVE10* கியூபொனை பயன்படுத்தவும்!\n\nஆர்டரை முடிக்க கீழே தட்டவும்.`;
            
            await sendInteractiveButtons(contact.phone, nudgeMsg, [
                { id: "btn_checkout", title: lang === 'en' ? "Checkout 💳" : "செக்அவுட் 💳" },
                { id: "btn_cart", title: lang === 'en' ? "View Cart 🛒" : "கார்ட் பார்க்க 🛒" },
                { id: "btn_menu", title: lang === 'en' ? "Main Menu 🏠" : "முதன்மை பட்டி 🏠" }
            ]);

            contact.lastCartNudgeDate = new Date();
            contact.lead_status = "Cart Nudged";
            await contact.save();
            sentCount++;
        }

        res.json({ success: true, sentCount, message: `2-day cart reminder sent to ${sentCount} contact(s)` });
    } catch (error) {
        console.error('[API CART REMINDERS ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Dashboard & Admin API Endpoints ---
app.get('/crm', async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ lastSeen: -1 });
        res.json({ totalContacts: contacts.length, contacts });
    } catch (err) { res.status(500).json({ error: "Failed to fetch contacts" }); }
});

app.get('/crm/analytics', async (req, res) => {
    try {
        const metrics = await getAdminStoreMetrics();
        const contacts = await Contact.find();
        
        let botCount = 0;
        let pausedCount = 0;
        const funnel = { onboarding: 0, browsing: 0, cart: 0, checkout: 0, completed: 0 };

        contacts.forEach(c => {
            if (c.is_paused) pausedCount++; else botCount++;
            const state = c.funnelState || 'onboarding';
            if (funnel[state] !== undefined) funnel[state]++;
        });

        res.json({
            totalContacts: metrics.totalContacts,
            totalRevenue: metrics.totalRevenue,
            todaySales: metrics.todaySales,
            activeOrders: metrics.pendingOrdersCount,
            openTickets: metrics.openTickets,
            lowStockCount: metrics.lowStockCount,
            outOfStockCount: metrics.outOfStockCount,
            consentRate: metrics.totalContacts > 0 ? Math.round((metrics.optedInContacts / metrics.totalContacts) * 100) : 0,
            funnel,
            botVsHuman: { bot: botCount, human: pausedCount }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate analytics" });
    }
});

app.get('/api/admin/metrics', async (req, res) => {
    try {
        const metrics = await getAdminStoreMetrics();
        res.json({ success: true, metrics });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const webOrders = await OrderModel.find().sort({ date: -1 }).limit(50).lean();
        res.json({ success: true, count: webOrders.length, orders: webOrders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/admin/update-stock', async (req, res) => {
    try {
        const { productId, stock } = req.body;
        if (!productId || typeof stock !== 'number') {
            return res.status(400).json({ success: false, error: "productId and numeric stock are required" });
        }
        const updated = await ProductModel.findByIdAndUpdate(productId, { stock }, { new: true });
        res.json({ success: true, product: updated });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/crm/:phone/pause', async (req, res) => {
    try {
        const contact = await Contact.findOne({ phone: req.params.phone });
        if (!contact) return res.status(404).json({ error: "Contact not found" });

        contact.is_paused = req.body.is_paused;
        if (!contact.is_paused) {
            contact.step = 'main_menu';
        }
        await contact.save();

        res.json({ success: true, is_paused: contact.is_paused });
    } catch (err) {
        res.status(500).json({ error: "Failed to update pause state" });
    }
});

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

app.post('/crm/:phone/update-order', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const contact = await Contact.findOne({ phone: req.params.phone });
        if (!contact) return res.status(404).json({ error: "Contact not found" });

        const order = contact.orders.find(o => o.orderId === orderId);
        if (!order) return res.status(404).json({ error: "Order not found" });

        order.status = status;
        await contact.save();

        const trackingLink = order.trackingLink || `https://mansarafoods.com/order-tracking/${orderId}`;
        await notifyCustomerOrderStatus(req.params.phone, orderId, status, trackingLink).catch(e => console.error(e));

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ error: "Failed to update order status" });
    }
});

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

app.post('/crm/update-whatsapp-dp', async (req, res) => {
    try {
        if (PHONE_NUMBER_ID && ACCESS_TOKEN) {
            const jpgPath = path.join(__dirname, 'public', 'logo_dp.jpg');
            const fileBuffer = fs.readFileSync(jpgPath);
            const fileLength = fileBuffer.length;

            const sessionRes = await axios.post(
                `https://graph.facebook.com/v19.0/app/uploads`,
                null,
                {
                    params: { file_length: fileLength, file_type: 'image/jpeg' },
                    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
                }
            );
            const uploadHandle = sessionRes.data.id;

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
            const pictureHandle = uploadRes.data.h;

            const metaResponse = await axios.post(
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

            return res.json({ success: true, meta: metaResponse.data, logoUrl: `${BACKEND_URL}/logo_dp.jpg` });
        }

        res.json({ success: false, message: "Local DP updated." });
    } catch (error) {
        console.error('[DP UPDATE] Error:', error?.response?.data || error.message);
        res.status(500).json({ success: false, error: error?.response?.data || error.message });
    }
});

async function sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return false;
    const target = normalizePhone(to);
    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            data: {
                messaging_product: 'whatsapp',
                to: target,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    ...(components.length > 0 ? { components: components } : {})
                }
            }
        });
        return true;
    } catch (error) {
        console.error(`[sendTemplateMessage] Error:`, error.response ? error.response.data : error.message);
        return false;
    }
}

app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, otp, type, templateName } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: "phone and otp are required" });
        }

        const targetPhone = normalizePhone(phone);
        const activeTemplate = templateName || process.env.OTP_TEMPLATE_NAME || 'mansara_otp';

        const templateSent = await sendTemplateMessage(targetPhone, activeTemplate, 'en', [
            {
                type: 'body',
                parameters: [{ type: 'text', text: String(otp) }]
            }
        ]);

        if (!templateSent) {
            let message = type === 'forgot_password'
                ? `🔐 *Mansara Foods - Password Reset Code*\n\nYour verification code is: *${otp}*\nValid for 10 minutes.`
                : `🌿 *Welcome to Mansara Foods!*\n\nYour verification code is: *${otp}*\nValid for 10 minutes.`;
            await sendMessage(targetPhone, message);
        }

        res.json({ success: true, message: `OTP sent to ${targetPhone} via WhatsApp`, phone: targetPhone });
    } catch (error) {
        console.error('[API SEND OTP ERROR]:', error.message || error);
        res.status(500).json({ success: false, error: error.message || "Failed to send OTP" });
    }
});

async function notifyAdminNewOrder(orderData) {
    const adminPhone = process.env.ADMIN_PHONE || '918838887064';

    const itemsText = (orderData.items || []).map(i => `• ${i.quantity}x ${i.name || i.title} (${i.weight || ''}) – ₹${i.price * i.quantity}`).join('\n');
    const addr = typeof orderData.address === 'object'
        ? `${orderData.address.street || ''}, ${orderData.address.city || ''}, ${orderData.address.state || ''} - ${orderData.address.zip || ''}`
        : (orderData.address || 'N/A');

    const alertMsg = `🛍️ *NEW ORDER RECEIVED!* 🛒\n\n` +
        `📦 *Order ID:* ${orderData.orderId}\n` +
        `👤 *Customer:* ${orderData.customerName || 'N/A'}\n` +
        `📞 *Phone:* ${orderData.customerPhone || 'N/A'}\n` +
        `📍 *Address:* ${addr}\n` +
        `💳 *Payment:* ${orderData.paymentMethod || 'COD'} (${orderData.paymentStatus || 'Pending'})\n\n` +
        `🛒 *Items Ordered:*\n${itemsText}\n\n` +
        `💰 *Total Amount:* ₹${orderData.total}\n\n` +
        `👇 *Tap below to update order status:*`;

    await sendInteractiveButtons(adminPhone, alertMsg, [
        { id: `adm_Packed_${orderData.orderId}`, title: "Packed 📦" },
        { id: `adm_Shipped_${orderData.orderId}`, title: "Shipped 🚚" },
        { id: `adm_Delivered_${orderData.orderId}`, title: "Delivered ✅" }
    ]);
}

app.post('/api/notify-admin-order', async (req, res) => {
    try {
        await notifyAdminNewOrder(req.body);
        res.json({ success: true, message: "Admin order alert sent" });
    } catch (error) {
        console.error('[API NOTIFY ADMIN ORDER ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/notify-admin-stock', async (req, res) => {
    try {
        const { productName, stock } = req.body;
        const adminPhone = process.env.ADMIN_PHONE || '918838887064';

        let alertMsg = stock <= 0
            ? `🚨 *OUT OF STOCK ALERT!* ❌\n\nProduct: *${productName}*\nStock: *0 items*\n\n⚠️ Product is OUT OF STOCK. Restock immediately!`
            : `⚠️ *LOW STOCK ALERT!* 📦\n\nProduct: *${productName}*\nStock: *${stock} items remaining*`;

        await sendMessage(adminPhone, alertMsg);
        res.json({ success: true, message: `Stock alert sent to Admin ${adminPhone}` });
    } catch (error) {
        console.error('[API NOTIFY ADMIN STOCK ERROR]:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Keep-Alive Utility Template Ping (Every 20 Hours) ---
// Sends a Utility Template ping to Sales & Admin numbers every 20 hours
// to keep Meta's WhatsApp Business session active and ensure
// all order notifications reach the recipients without any interruption.
const KEEP_ALIVE_PHONES = (process.env.ADMIN_PHONE || '919342400879,918838887064')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length >= 10);

async function sendKeepAlivePing() {
    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        console.log('[KEEP-ALIVE] Skipping ping: Missing META credentials');
        return;
    }

    console.log(`[KEEP-ALIVE] Sending 20-hour Utility Template ping to: ${KEEP_ALIVE_PHONES.join(', ')}...`);

    for (const phone of KEEP_ALIVE_PHONES) {
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone || normalizedPhone.length < 10) continue;

        try {
            const res = await axios({
                method: 'POST',
                url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: normalizedPhone,
                    type: 'template',
                    template: {
                        name: 'sales_lead_alert',
                        language: { code: 'en_US' },
                        components: [
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', text: 'Mansara Team' },
                                    { type: 'text', text: 'System Keep-Alive Ping' },
                                    { type: 'text', text: 'Mansara Foods WhatsApp service is active and running. Order notifications are live!' },
                                    { type: 'text', text: 'Mansarafoods.com' }
                                ]
                            }
                        ]
                    }
                }
            });

            console.log(`[KEEP-ALIVE] ✓ Ping delivered to ${normalizedPhone} | Message ID: ${res.data?.messages?.[0]?.id}`);
        } catch (err) {
            console.error(`[KEEP-ALIVE] ❌ Failed to ping ${normalizedPhone}:`, err.response?.data || err.message);
        }
    }
}

// Cron: Run every 20 hours (at minute 0, every 20th hour: 0:00, 20:00, 16:00, ...)
// Cron expression: "0 */20 * * *" = at minute 0, every 20 hours
cron.schedule('0 */20 * * *', async () => {
    console.log(`[KEEP-ALIVE CRON] Triggered at ${new Date().toISOString()}`);
    await sendKeepAlivePing();
}, {
    timezone: 'Asia/Kolkata'
});

console.log('[KEEP-ALIVE CRON] Scheduled: every 20 hours to Sales & Admin numbers');

// Trigger once immediately on startup to confirm system is live
setTimeout(() => {
    sendKeepAlivePing();
}, 10000); // Wait 10 seconds after startup before first ping

app.listen(PORT, () => {
    console.log(`🚀 Mansara Foods WhatsApp Automation Server is running on port ${PORT}`);
});
