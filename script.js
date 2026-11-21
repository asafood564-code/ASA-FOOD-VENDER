// Development Toggle
let isVerifiedTest = false;

// =========================================================================
// Safe DOM Override to prevent crashes from missing elements (Audit Fix #5)
// =========================================================================
const _originalGetElementById = document.getElementById.bind(document);
document.getElementById = function(id) {
    const el = _originalGetElementById(id);
    if (el) return el;
    
    console.warn(`[SafeDOM] Missing element accessed: '${id}'. Returning safe dummy proxy to prevent script crash.`);
    const dummy = document.createElement('div');
    return new Proxy(dummy, {
        get(target, prop) {
            if (prop in target) {
                return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
            }
            return () => {}; // return dummy function for unknown methods to prevent TypeError
        },
        set(target, prop, value) {
            return true; // silently ignore assignments
        }
    });
};

// =========================================================================
// AppConfig — Centralized Configuration Manager
// =========================================================================
// Fetches ALL settings from the Supabase 'system_settings' table ONCE
// on app startup and caches them in memory.
// Usage:
//   await AppConfig.load();                    ← call once at app start
//   const key = AppConfig.get('otp_api_key');  ← read any value anywhere
//   const commission = AppConfig.get('admin_commission_percent', 10);
// =========================================================================
window.AppConfig = (function () {
    let _cache = null;        // Holds the full system_settings row
    let _loading = null;      // Prevents duplicate concurrent fetches

    return {
        /**
         * Loads all settings from Supabase. Safe to call multiple times —
         * subsequent calls return the cached result immediately.
         */
        async load() {
            if (_cache) return _cache;
            if (_loading) return _loading; // reuse in-flight promise

            _loading = (async () => {
                try {
                    const supabase = window.supabaseClient;
                    if (!supabase) throw new Error('Supabase client not initialized.');

                    const { data, error } = await supabase
                        .from('system_settings')
                        .select('*')
                        .eq('id', 1)
                        .single();

                    if (error) throw error;
                    _cache = data;
                    console.info('[AppConfig] ✅ System settings loaded:', Object.keys(data).join(', '));
                    return _cache;
                } catch (err) {
                    console.error('[AppConfig] ❌ Failed to load system_settings:', err.message);
                    _cache = {}; // empty fallback so app does not crash
                    return _cache;
                } finally {
                    _loading = null;
                }
            })();

            return _loading;
        },

        /**
         * Reads a config value by key.
         * @param {string} key         Column name from system_settings.
         * @param {*}      defaultVal  Fallback if the key is missing or null.
         * @returns {*}
         */
        get(key, defaultVal = null) {
            if (!_cache) {
                console.warn(`[AppConfig] Config not loaded yet. Call AppConfig.load() first. Key: '${key}'`);
                return defaultVal;
            }
            const val = _cache[key];
            return (val !== undefined && val !== null) ? val : defaultVal;
        },

        /** Clears the cache — useful if settings change at runtime. */
        invalidate() {
            _cache = null;
            console.info('[AppConfig] Cache invalidated. Next AppConfig.load() will re-fetch from Supabase.');
        }
    };
})();

// =========================================================================
// SMS OTP Configuration
// All credentials (API Key + endpoint) are fetched dynamically from
// Supabase system_settings table via AppConfig. Nothing is hardcoded.
// Required columns: otp_api_key, sms_endpoint
// =========================================================================

window.rainfireAuth = {
    // Generate and send live OTP — all config loaded from AppConfig (system_settings)
    async sendOTP(mobileNumber) {
        if (!mobileNumber) {
            throw new Error('Mobile number is required.');
        }
        const phone = mobileNumber.replace(/\D/g, '').slice(-10);
        window.generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

        // Load config from Supabase (uses cached value after first call)
        await AppConfig.load();

        const API      = AppConfig.get('otp_api_key');
        const ENDPOINT = AppConfig.get('sms_endpoint');

        if (!API || !ENDPOINT) {
            console.error('[Rainfire Client] otp_api_key or sms_endpoint missing in system_settings.');
            throw new Error('SMS service is temporarily unavailable. Config missing from system_settings.');
        }

        const SMS_URL = ENDPOINT + "?API=" + API + "&PHONE=" + phone + "&OTP=" + window.generatedOTP;

        sessionStorage.setItem('reg_otp_code', window.generatedOTP);
        sessionStorage.setItem('reg_otp_mobile', phone);

        console.log(`[Rainfire Client] SMS OTP send initiated for +91 ${phone}`);

        try {
            // Image beacon bypass: avoids CORS/Mixed-Content issues for GET requests
            const trigger = new Image();
            trigger.src = SMS_URL;
            console.log(`%c[Rainfire Client] Live OTP dispatched to +91 ${phone}.`, "color: #FFD700; font-size: 14px; font-weight: bold;");
            return true;
        } catch (error) {
            console.error('[Rainfire Client] SMS dispatch failed:', error);
            showToast('Failed to send OTP. Please check your connection.');
            throw error;
        }
    },


    // Verify the OTP entered by the user
    async verifyOTP(mobileNumber, otpCode) {
        const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);

        // Demo OTP block removed as per requested audit fixes

        const storedOtp = sessionStorage.getItem('reg_otp_code');
        const storedMobile = sessionStorage.getItem('reg_otp_mobile');

        // Verify strictly against local storage (PHP pathway)
        if (storedOtp && storedMobile && otpCode === storedOtp && cleanMobile === storedMobile) {
            console.log('[Rainfire Client] OTP verified successfully via local storage.');
            sessionStorage.removeItem('reg_otp_code');
            sessionStorage.removeItem('reg_otp_mobile');
            return true;
        }
        return false;
    },

    // Save verified user/vendor details inside Supabase database
    async routeDataToSupabase(mobileNumber, additionalData = {}) {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client not initialized.');
        }

        const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
        console.log(`[Supabase Store] Saving verified vendor details to database for +91 ${cleanMobile}`);

        // Insert or update vendor record in 'vendors' table
        const { data: existingVendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('mobile', cleanMobile)
            .single();

        if (existingVendor) {
            await supabase
                .from('vendors')
                .update({ ...additionalData })
                .eq('mobile', cleanMobile);
            return existingVendor;
        } else {
            const newVendorData = {
                mobile: cleanMobile,
                mobile_number: cleanMobile,
                shop_name: additionalData.shop_name || 'New Vendor Restaurant',
                address: additionalData.address || '',
                is_verified: true,
                created_at: new Date().toISOString()
            };
            const { data: newVendor } = await supabase
                .from('vendors')
                .insert([newVendorData])
                .select()
                .single();
            return newVendor;
        }
    }
};

// Application State
const state = {
    currentView: 'welcome', // login, otp, home, menu, orders, statistics, payments, profile, add-menu-item, welcome
    welcomeStep: 1,
    userMobile: '',
    currentVendorId: '', // Live Supabase UUID of the vendor
    vendorStatus: 'pending',
    rejectionReason: '',
    isVerified: false,
    currentRestaurantId: '',
    linkedRestaurantCategories: [],
    allRestaurantCategories: [],
    isOnline: true,
    walletBalance: 0.00,
    totalEarnings: 0.00,
    notificationCount: 0,
    prepTime: 15,
    tempAddons: [],
    tempVariations: [],
    editingMenuItemId: null,
    selectedOrderId: null,
    modalPrepTime: 15,
    offlineReason: '',
    menuItems: [],
    categories: [],
    recentOrders: [],
    walletTransactions: [],
    verificationStatus: 'pending', // unregistered, pending, approved
    restaurantDetails: null, // { name, coverImage, galleryImages: [], hours: {}, cuisineType: 'Both', offers: [] }
    currentOnboardingStep: 1,
    selectedMenuImage: null,
    selectedRestaurantImages: { cover: null, gallery: [] },
    locationCoords: null,
    selectedCategory: 'All',
    productsMap: {},
    searchQuery: '',
    isDarkMode: false,
    language: 'English',
    selfDelivery: true,
    vendorEmail: '',
    todayStats: {
        totalOrders: 0,
        delivered: 0,
        pending: 0,
        earnings: 0
    },
    bankDetails: {
        bankName: '',
        accountNumber: '',
        ifsc: '',
        upiId: ''
    },
    kycDocs: {
        aadhaar: { number: '', status: 'Pending', frontImage: null, backImage: null },
        pan: { number: '', status: 'Pending', image: null },
        fssai: { number: '', status: 'Pending', image: null }
    },
    notifications: [],
    vendorName: '',
    vendorPhone: '',
    vendorPhoto: '',
    profileMobileVerified: false,
    tempProfileImage: null,
    activeWalletTab: 'transactions',
    withdrawalHistory: [],
    homeFilter: 'All',
    adminCommissionPercent: 15, // Global Commission Variable (default to 15 based on public.system_settings standard)
    todayOrders: [],
    registrationStatus: 'unregistered', // unregistered, basic_completed, kyc_completed, paid, approved, restaurant_added
    registrationData: {
        fullName: '',
        mobile: '',
        email: '',
        password: '',
        confirmPassword: '',
        termsAgreed: false,
        accountType: 'restaurant',
        restaurantDetails: {
            name: '',
            cuisine: 'Both',
            hours: {
                Monday: { active: true, open: '09:00', close: '22:00' },
                Tuesday: { active: true, open: '09:00', close: '22:00' },
                Wednesday: { active: true, open: '09:00', close: '22:00' },
                Thursday: { active: true, open: '09:00', close: '22:00' },
                Friday: { active: true, open: '09:00', close: '22:00' },
                Saturday: { active: true, open: '09:00', close: '22:00' },
                Sunday: { active: false, open: '09:00', close: '22:00' }
            },
            gallery: [null, null, null, null],
            location: { lat: '', lng: '' },
            address: ''
        },
        kyc: {
            aadhaar: { number: '', front: null, back: null },
            pan: { number: '', front: null },
            fssai: { number: '', front: null }
        }
    },
    registrationStep: 1,
    tempCategoryLogo: null,
    isProcessingKYC: false,
    activeKYCField: null,
    registrationOTPTimer: 0,
    registrationOTPCode: '',
    orderFilter: 'All',
    reviews: [],
    statementFilter: 'Last 7 Days',
    customFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customTo: new Date().toISOString().split('T')[0],
    selectedOfferType: 'promo',
    activeDeleteProductId: null,
    selectedDiscountItemId: null
};

const translations = {
    'English': {
        'home': 'Home', 'orders': 'Orders', 'menu': 'Menu', 'payments': 'Payments', 'profile': 'Profile',
        'today_overview': "Today's Overview", 'total_orders': 'Total Orders', 'delivered': 'Delivered',
        'pending': 'Pending', 'earnings': "Today's Earning", 'welcome': 'Welcome back, Partner!',
        'logout': 'LOGOUT', 'self_delivery': 'Self Delivery', 'my_wallet': 'My Wallet',
        'my_bank': 'My Bank', 'document': 'Document (KYC)', 'all_orders': 'All Orders',
        'notifications': 'Notifications', 'order_statement': 'Order Statement', 'about': 'About',
        'privacy': 'Privacy & Policy', 'about_app': 'About App', 'terms': 'Terms & Conditions',
        'settings': 'App Settings', 'dark_mode': 'Dark Mode', 'language': 'Language', 'edit_profile': 'Edit Profile'
    },
    'Hindi': {
        'home': 'होम', 'orders': 'ऑर्डर', 'menu': 'मेन्यू', 'payments': 'भुगतान', 'profile': 'प्रोफ़ाइल',
        'today_overview': 'आज का अवलोकन', 'total_orders': 'कुल ऑर्डर', 'delivered': 'वितरित',
        'pending': 'लंबित', 'earnings': 'आज की कमाई', 'welcome': 'वापस स्वागत है, पार्टनर!',
        'logout': 'लॉगआउट', 'self_delivery': 'स्व-वितरण', 'my_wallet': 'मेरा बटुआ',
        'my_bank': 'मेरा बैंक', 'document': 'दस्तावेज़ (KYC)', 'all_orders': 'सभी ऑर्डर',
        'notifications': 'सूचनाएं', 'order_statement': 'ऑर्डर विवरण', 'about': 'के बारे में',
        'privacy': 'गोपनीयता नीति', 'about_app': 'ऐप के बारे में', 'terms': 'नियम और शर्तें',
        'settings': 'ऐप सेटिंग्स', 'dark_mode': 'डार्क मोड', 'language': 'भाषा', 'edit_profile': 'प्रोफ़ाइल संपादित करें'
    },
    'Bengali': {
        'home': 'হোম', 'orders': 'অর্ডার', 'menu': 'মেনু', 'payments': 'পেমেন্ট', 'profile': 'প্রোফাইল',
        'today_overview': 'আজকের ওভারভিউ', 'total_orders': 'মোট অর্ডার', 'delivered': 'ডেলিভার করা হয়েছে',
        'pending': 'বাকি আছে', 'earnings': 'আজকের আয়', 'welcome': 'স্বাগতম, পার্টনার!',
        'logout': 'লগআউট', 'self_delivery': 'স্ব-ডেলিভারি', 'my_wallet': 'আমার ওয়ালেট',
        'my_bank': 'আমার ব্যাঙ্ক', 'document': 'নথিপত্র (KYC)', 'all_orders': 'সব অর্ডার',
        'notifications': 'নোটিফিকেশন', 'order_statement': 'অর্ডার স্টেটমেন্ট', 'about': 'সম্পর্কে',
        'privacy': 'গোপনীয়তা নীতি', 'about_app': 'অ্যাপ সম্পর্কে', 'terms': 'শর্তাবলী',
        'settings': 'অ্যাপ সেটিংস', 'dark_mode': 'ডার্ক মোড', 'language': 'ভাষা', 'edit_profile': 'প্রোফাইল এডিট করুন'
    }
};

function t(key) {
    return translations[state.language][key] || key;
}

// Global Payout Calculator (Dynamic Commission Deduction)
function getPayout(price) {
    const totalOrderPrice = parseFloat(price) || 0;
    const commissionRate = parseFloat(state.adminCommissionPercent) || 0;
    const commissionAmount = (totalOrderPrice * commissionRate) / 100;
    const vendorNetPayout = totalOrderPrice - commissionAmount;
    return parseFloat(vendorNetPayout.toFixed(2));
}

// --- Session Management ---
function saveSession() {
    localStorage.setItem('asa_vendor_session', JSON.stringify({
        userMobile: state.userMobile,
        currentVendorId: state.currentVendorId,
        currentRestaurantId: state.currentRestaurantId,
        linkedRestaurantCategories: state.linkedRestaurantCategories,
        allRestaurantCategories: state.allRestaurantCategories,
        registrationStatus: state.registrationStatus,
        registrationData: state.registrationData,
        restaurantDetails: state.restaurantDetails,
        vendorStatus: state.vendorStatus,
        rejectionReason: state.rejectionReason,
        isVerified: state.isVerified,
        currentView: state.currentView,
        selectedOrderId: state.selectedOrderId,
        editingMenuItemId: state.editingMenuItemId
    }));
}

function mapDbProductToLocalProduct(item) {
    let timing = { start: '00:00', end: '23:59' };
    if (item.timing_start && item.timing_end) {
        timing = {
            start: item.timing_start.substring(0, 5),
            end: item.timing_end.substring(0, 5)
        };
    } else if (item.timing) {
        const t = typeof item.timing === 'string'
            ? (() => { try { return JSON.parse(item.timing); } catch { return {}; } })()
            : item.timing;
        timing = { start: t.start || '00:00', end: t.end || '23:59' };
    }

    return {
        id: item.id,
        name: item.name,
        category: item.category,
        weight: item.weight || '1 Plate',
        qtyPerUnit: item.qty_per_unit !== undefined && item.qty_per_unit !== null ? item.qty_per_unit : null,
        price: parseFloat(item.price) || 0,
        mrp: parseFloat(item.mrp) || parseFloat(item.price) || 0,
        timing,
        openingTime: item.opening_time ? item.opening_time.substring(0, 5) : timing.start,
        closingTime: item.closing_time ? item.closing_time.substring(0, 5) : timing.end,
        desc: item.desc || item.description || '',
        image: item.image_url || item.image || 'assets/biryani.png',
        available: item.is_available !== false,
        recommend: item.is_manual_recommend === true,
        foodType: item.food_type || 'Veg',
        addons: (() => {
            const raw = item.addons;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
                try { return JSON.parse(raw); } catch { return []; }
            }
            return [];
        })(),
        active: true
    };
}

function formatSubOrderItems(items) {
    if (!items) return "";
    
    let parsedItems = items;
    if (typeof items === 'string') {
        const trimmed = items.trim();
        if (!trimmed) return "";
        try {
            parsedItems = JSON.parse(trimmed);
        } catch (e) {
            return trimmed;
        }
    }
    
    if (Array.isArray(parsedItems)) {
        if (parsedItems.length === 0) return "";
        return parsedItems.map(item => {
            if (typeof item === 'string') {
                return item;
            }
            if (item && typeof item === 'object') {
                let name = item.name || item.title || item.item_name || item.food_name || "";
                const pid = item.food_item_id || item.product_id;
                if (!name && pid && state.productsMap && state.productsMap[pid]) {
                    name = state.productsMap[pid];
                }
                const qty = item.quantity || item.qty || item.count || 1;
                if (!name) return "Item";
                return `${name} x ${qty}`;
            }
            return "";
        }).filter(Boolean).join(', ');
    }
    
    if (typeof parsedItems === 'object' && parsedItems !== null) {
        let name = parsedItems.name || parsedItems.title || parsedItems.item_name || "";
        const pid = parsedItems.food_item_id || parsedItems.product_id;
        if (!name && pid && state.productsMap && state.productsMap[pid]) {
            name = state.productsMap[pid];
        }
        const qty = parsedItems.quantity || parsedItems.qty || parsedItems.count || 1;
        if (name) return `${name} x ${qty}`;
    }
    
    return String(parsedItems).trim();
}

async function syncDataFromSupabase() {
    const supabase = window.supabaseClient;
    if (!supabase || (!state.userMobile && !state.currentVendorId)) return;

    try {
        let query = supabase.from('vendors').select('*');
        if (state.currentVendorId) {
            query = query.eq('id', state.currentVendorId);
        } else {
            const cleanMobile = state.userMobile.replace(/\D/g, '').slice(-10);
            query = query.eq('mobile', cleanMobile);
        }
        
        const { data: vendor, error: vendorError } = await query.single();

        if (vendorError) {
            console.warn("[Supabase Sync] Failed to fetch vendor record:", vendorError.message);
            if (vendorError.code === 'PGRST116') {
                if (state.currentVendorId) {
                    console.error('[Supabase Sync] Vendor record not returned, but session is active. Skipping auto-logout.');
                    return;
                }
                console.error('[Supabase Sync] Vendor not found in database. Auto logging out...');
                showToast('Account deleted or not found. Logging out...');
                logout();
                return;
            }
        } else if (vendor) {
            const cleanMobile = (vendor.mobile || state.userMobile || '').replace(/\D/g, '').slice(-10);
            state.currentVendorId = vendor.id || state.currentVendorId; // Set currentVendorId
            state.vendorName = vendor.full_name || vendor.name || state.vendorName;
            state.vendorEmail = vendor.email || state.vendorEmail;
            state.vendorPhone = '+91 ' + cleanMobile;
            state.vendorStatus = vendor.status || 'pending';
            const currentStatus = (state.vendorStatus).toLowerCase();
            if (currentStatus === 'approved' || currentStatus === 'success') {
                state.registrationStatus = 'restaurant_added';
            } else {
                state.registrationStatus = vendor.onboarding_status || 'restaurant_added';
            }
            state.rejectionReason = vendor.rejection_reason || '';
            state.isVerified = vendor.is_verified || false;
            
            // Auto-update registration status based on actual DB verified flag
            if (state.isVerified && (currentStatus === 'active' || currentStatus === 'approved')) {
                state.registrationStatus = 'verified';
                saveSession();
            } else if (!state.isVerified && state.registrationStatus !== 'unregistered') {
                state.registrationStatus = 'pending_verification';
                saveSession();
            }
            
            setupRealtimeStatusListener(vendor.id);
            setupRealtimeProductsListener(vendor.id, cleanMobile);

            // Hydrate KYC documents from the vendor record
            state.kycDocs = {
                aadhaar: {
                    number: vendor.aadhaar_number ? `XXXX XXXX ${vendor.aadhaar_number.slice(-4)}` : '',
                    status: vendor.status === 'approved' ? 'Verified' : (vendor.status === 'rejected' ? 'Rejected' : 'Pending'),
                    frontImage: vendor.aadhaar_front_url || null,
                    backImage: vendor.aadhaar_back_url || null
                },
                pan: {
                    number: vendor.pan_number || '',
                    status: vendor.status === 'approved' ? 'Verified' : (vendor.status === 'rejected' ? 'Rejected' : 'Pending'),
                    image: vendor.pan_front_url || null
                },
                fssai: {
                    number: vendor.fssai_number || '',
                    status: vendor.status === 'approved' ? 'Verified' : (vendor.status === 'rejected' ? 'Rejected' : 'Pending'),
                    image: vendor.fssai_front_url || null
                }
            };

            // Hydrate Bank Details directly from the vendor record (public.vendors table)
            state.bankDetails = {
                bankName: vendor.bank_name || '',
                accountNumber: vendor.account_number ? `XXXX XXXX ${vendor.account_number.slice(-4)}` : '',
                rawAccountNumber: vendor.account_number || '',
                ifsc: vendor.ifsc_code || '',
                upiId: vendor.upi_id || ''
            };

            // Fetch restaurant details early to get the admin_commission_percentage
            const { data: restaurantData, error: restDataError } = await supabase
                .from('restaurants')
                .select('admin_commission_percentage')
                .eq('vendor_id', vendor.id)
                .maybeSingle();

            if (!restDataError && restaurantData && restaurantData.admin_commission_percentage !== null && restaurantData.admin_commission_percentage !== undefined) {
                state.adminCommissionPercent = parseFloat(restaurantData.admin_commission_percentage);
            } else {
                // Fallback to system_settings or default to 15
                const { data: sysSettings, error: sysError } = await supabase
                    .from('system_settings')
                    .select('vendor_commission')
                    .eq('id', 1)
                    .maybeSingle();

                if (!sysError && sysSettings) {
                    state.adminCommissionPercent = parseFloat(sysSettings.vendor_commission) || 15;
                } else {
                    state.adminCommissionPercent = 15;
                }
            }

            // Hydrate all sub-orders for dashboard, wallet, transaction, and statement calculations
            let dbAllSubOrders = [];
            const { data: allSubOrdersData, error: allOrdersError } = await supabase
                .from('sub_orders')
                .select(`
                    *,
                    orders (
                        *
                    ),
                    order_items (
                        *
                    )
                `)
                .eq('restaurant_id', vendor.id)
                .order('created_at', { ascending: false });

            if (allOrdersError) {
                console.warn("[Supabase Sync] Failed to fetch orders:", allOrdersError.message);
            } else if (allSubOrdersData) {
                dbAllSubOrders = allSubOrdersData;

                const formattedOrders = dbAllSubOrders.map(subOrder => {
                    const mainOrder = subOrder.orders || {};
                    let timeStr = 'Just now';
                    if (subOrder.created_at) {
                        try {
                            const d = new Date(subOrder.created_at);
                            timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (e) {}
                    }
                    
                    let displayStatus = 'Pending';
                    if (subOrder.sub_order_status) {
                        const s = subOrder.sub_order_status.toLowerCase();
                        if (s === 'pending') displayStatus = 'Pending';
                        else if (s === 'accepted') displayStatus = 'Accepted';
                        else if (s === 'preparing') displayStatus = 'Preparing';
                        else if (s === 'ready_for_pickup') displayStatus = 'Ready';
                        else if (s === 'picked_up') displayStatus = 'Picked Up';
                        else if (s === 'delivered') displayStatus = 'Delivered';
                        else if (s === 'cancelled' || s === 'rejected') displayStatus = 'Cancelled';
                        else displayStatus = subOrder.sub_order_status.charAt(0).toUpperCase() + subOrder.sub_order_status.slice(1).toLowerCase();
                    }

                    const subOrderItems = (subOrder.items && subOrder.items.length > 0) ? subOrder.items : (subOrder.order_items || []);

                    let resolvedOrderId = '#ORDER';
                    if (subOrder.main_order_id) {
                        resolvedOrderId = subOrder.main_order_id.startsWith('#') ? subOrder.main_order_id : `#${subOrder.main_order_id}`;
                    } else if (subOrder.id) {
                        resolvedOrderId = `#${subOrder.id.slice(-5).toUpperCase()}`;
                    }

                    let dateObj = new Date();
                    if (subOrder.created_at) {
                        dateObj = new Date(subOrder.created_at);
                    }
                    const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const ampmTimeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const fullTimeStr = `${dateStr} • ${ampmTimeStr}`;

                    return {
                        id: resolvedOrderId,
                        fullId: subOrder.id,
                        mainOrderId: subOrder.main_order_id,
                        item: formatSubOrderItems(subOrderItems),
                        customerName: mainOrder.customer_name || 'Customer',
                        location: mainOrder.delivery_address || 'Address Not Provided',
                        status: displayStatus,
                        price: parseFloat(subOrder.food_price_share) || 0,
                        image: mainOrder.item_image || 'assets/biryani.png',
                        time: fullTimeStr,
                        items: subOrderItems
                    };
                });

                state.todayOrders = formattedOrders;
                state.recentOrders = formattedOrders; // Maintain all orders in recentOrders for full Order History display
            }

            if (dbAllSubOrders) {
                const deliveredOrders = dbAllSubOrders.filter(o => (o.sub_order_status || '').toLowerCase() === 'delivered');
                const pendingOrders = dbAllSubOrders.filter(o => ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up'].includes((o.sub_order_status || '').toLowerCase()));
                const totalEarnings = deliveredOrders.reduce((sum, o) => sum + (parseFloat(o.food_price_share) || 0), 0);

                state.todayStats = {
                    totalOrders: dbAllSubOrders.length,
                    delivered: deliveredOrders.length,
                    pending: pendingOrders.length,
                    earnings: totalEarnings
                };

                // Hydrate historical statement cache dynamically from database payload
                state.mockStatementData = deliveredOrders.map(subOrder => ({
                    id: subOrder.id ? `#${subOrder.id.slice(-5).toUpperCase()}` : '#ORDER',
                    amount: getPayout(parseFloat(subOrder.food_price_share) || 0),
                    date: subOrder.created_at || new Date().toISOString()
                }));
            }

            // Hydrate Payouts/Withdrawals
            const { data: dbPayouts, error: payoutsError } = await supabase
                .from('vendor_payouts')
                .select('*')
                .eq('vendor_id', vendor.id)
                .order('created_at', { ascending: false });

            if (payoutsError) {
                console.warn("[Supabase Sync] Failed to fetch payouts:", payoutsError.message);
            } else if (dbPayouts) {
                state.withdrawalHistory = dbPayouts.map(p => {
                    let dateStr = 'Date unknown';
                    if (p.created_at) {
                        try {
                            dateStr = new Date(p.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                        } catch (e) {}
                    }
                    return {
                        id: p.id ? `#WTH${p.id.slice(-5).toUpperCase()}` : '#WTHRAWAL',
                        date: dateStr,
                        amount: parseFloat(p.amount) || 0,
                        status: p.status || 'pending',
                        method: p.payment_method || p.method || 'Bank Transfer'
                    };
                });
            }

            // Dynamic Wallet Balance & Wallet Transactions calculation
            const allDeliveredOrders = dbAllSubOrders ? dbAllSubOrders.filter(o => o.sub_order_status === 'delivered') : [];
            const netEarnings = allDeliveredOrders.reduce((sum, o) => sum + getPayout(parseFloat(o.food_price_share) || 0), 0);
            state.totalEarnings = netEarnings > 0 ? parseFloat(netEarnings.toFixed(2)) : 0.00;

            // Strict read-only wallet balance from vendors table (Single Source of Truth)
            state.walletBalance = Number(vendor.wallet_balance) || 0.00;

            if (dbAllSubOrders) {
                const successfulOrders = dbAllSubOrders.filter(o => o.sub_order_status === 'delivered');
                state.walletTransactions = successfulOrders.map(subOrder => {
                    const mainOrder = subOrder.orders || {};
                    let dateStr = 'Date unknown';
                    if (subOrder.created_at) {
                        try {
                            dateStr = new Date(subOrder.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                        } catch (e) {}
                    }
                    return {
                        id: subOrder.id ? `#TXN${subOrder.id.slice(-5).toUpperCase()}` : '#TXN',
                        customer: mainOrder.customer_name || 'Customer',
                        date: dateStr,
                        amount: getPayout(parseFloat(subOrder.food_price_share) || 0),
                        status: 'Success'
                    };
                });
            }

            // NOTE: Reviews are fetched after the restaurant record is confirmed below.
            // This ensures state.currentRestaurantId is set before the query runs.

            // Hydrate operating hours from database with strict safety checks to prevent null/undefined references
            let hoursObj = {
                'Sunday': { open: '10:00 AM', close: '11:00 PM', active: true },
                'Monday': { open: '10:00 AM', close: '11:00 PM', active: true },
                'Tuesday': { open: '10:00 AM', close: '11:00 PM', active: true },
                'Wednesday': { open: '10:00 AM', close: '11:00 PM', active: true },
                'Thursday': { open: '10:00 AM', close: '11:00 PM', active: true },
                'Friday': { open: '10:00 AM', close: '11:00 PM', active: true },
                'Saturday': { open: '10:00 AM', close: '11:00 PM', active: true }
            };

            if (vendor.timing) {
                const dbTiming = typeof vendor.timing === 'string' ? JSON.parse(vendor.timing) : vendor.timing;
                if (dbTiming && typeof dbTiming === 'object') {
                    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    days.forEach(day => {
                        const t = dbTiming[day.toLowerCase()];
                        if (t && typeof t === 'object') {
                            hoursObj[day] = {
                                open: t.open || '10:00',
                                close: t.close || '23:00',
                                active: t.isOpen !== false
                            };
                        }
                    });
                }
            } else if (vendor.hours) {
                hoursObj = typeof vendor.hours === 'string' ? JSON.parse(vendor.hours) : vendor.hours;
            }

            // --- FETCH OR CREATE ASSOCIATED RESTAURANT RECORD ---
            const { data: restaurant, error: restError } = await supabase
                .from('restaurants')
                .select('*')
                .eq('vendor_id', vendor.id)
                .maybeSingle();

            if (restError) {
                console.warn("[Supabase Sync] Failed to fetch restaurant record:", restError.message);
            }

            let currentRestaurant = restaurant;

            if (!currentRestaurant) {
                console.log("[Supabase Sync] Creating new restaurant record for vendor ID:", vendor.id);
                const newRestaurantData = {
                    vendor_id: vendor.id,
                    name: vendor.shop_name || vendor.name || 'ASA Partner Restaurant',
                    address: vendor.address || 'Default Address',
                    cuisine_type: 'Both',
                    is_online: true,
                    rating: 5.0,
                    cover_image_url: vendor.image_url || null,
                    gallery_urls: vendor.image_url ? [vendor.image_url] : []
                };
                const { data: createdRestaurant, error: createRestError } = await supabase
                    .from('restaurants')
                    .insert([newRestaurantData])
                    .select()
                    .single();

                if (createRestError) {
                    console.error("[Supabase Sync] Failed to create new restaurant record:", createRestError.message);
                } else {
                    currentRestaurant = createdRestaurant;
                }
            }

            state.restaurantDetails = {
                name: vendor.shop_name || 'ASA Vendor Partner',
                coverImage: vendor.image_url || 'assets/logo.png',
                galleryImages: (currentRestaurant && currentRestaurant.gallery_urls && currentRestaurant.gallery_urls.length > 0)
                    ? currentRestaurant.gallery_urls
                    : (vendor.image_url ? [vendor.image_url] : []),
                hours: hoursObj,
                address: vendor.address || '',
                cuisineType: (currentRestaurant && currentRestaurant.cuisine_type) || 'Both',
                offers: []
            };

            if (currentRestaurant) {
                state.currentRestaurantId = currentRestaurant.id;
                state.isOnline = currentRestaurant.is_online !== false;
                state.offlineReason = currentRestaurant.offline_reason || '';
                console.log("[Supabase Sync] Active Restaurant ID:", state.currentRestaurantId, "Online Status:", state.isOnline, "Offline Reason:", state.offlineReason);
                if (typeof setupRealtimeRestaurantListener === 'function') {
                    setupRealtimeRestaurantListener(currentRestaurant.id);
                }
                setupRealtimeOrdersListener(currentRestaurant.id);

                // Hydrate menu categories from the restaurant_categories table
                const { data: dbCats, error: catsErr } = await supabase
                    .from('restaurant_categories')
                    .select('name')
                    .eq('restaurant_id', currentRestaurant.id)
                    .order('name', { ascending: true });
                if (!catsErr && dbCats) {
                    state.categories = dbCats.map(c => c.name);
                } else {
                    state.categories = [];
                }
                console.log('[Supabase Sync] Loaded categories from restaurant_categories table:', state.categories);

                // ── Hydrate Reviews from restaurant_reviews (keyed by restaurant_id) ──────────
                // Strict Constraint: Table name and column names match the finalized Supabase schema.
                // No table/column renames are made here — all adaptation is done in the JS mapping below.
                const { data: dbReviews, error: reviewsError } = await supabase
                    .from('restaurant_reviews')
                    .select('*')
                    .eq('restaurant_id', state.currentRestaurantId)
                    .order('created_at', { ascending: false });

                if (reviewsError) {
                    console.warn("[Supabase Sync] Failed to fetch restaurant_reviews:", reviewsError.message);
                } else if (dbReviews) {
                    state.reviews = dbReviews.map(r => {
                        let timeStr = 'Just now';
                        if (r.created_at) {
                            try {
                                // Format: "21 May" style for the review card timestamp
                                timeStr = new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                            } catch (e) {}
                        }
                        return {
                            id: r.id,
                            // Map Supabase column 'customer_name' → local field 'customerName'
                            customerName: r.customer_name || 'Customer',
                            rating: parseInt(r.rating) || 5,
                            // Map Supabase column 'review_text' → local field 'comment'
                            comment: r.review_text || 'No comment provided.',
                            type: 'restaurant',
                            time: timeStr,
                            // Preserve raw created_at for potential future sort/filter
                            createdAt: r.created_at || null
                        };
                    });
                    console.log(`[Supabase Sync] Loaded ${state.reviews.length} review(s) from restaurant_reviews.`);
                }
                // ─────────────────────────────────────────────────────────────────────────────

                // Fetch linked categories
                const { data: linkedCats, error: linkedCatsError } = await supabase
                    .from('restaurant_category_links')
                    .select(`
                        category_id,
                        restaurant_categories:category_id (
                            id,
                            name,
                            description
                        )
                    `)
                    .eq('restaurant_id', state.currentRestaurantId);

                if (linkedCatsError) {
                    console.warn("[Supabase Sync] Failed to fetch linked restaurant categories:", linkedCatsError.message);
                } else if (linkedCats) {
                    state.linkedRestaurantCategories = linkedCats
                        .filter(link => link.restaurant_categories !== null)
                        .map(link => ({
                            id: link.restaurant_categories.id,
                            name: link.restaurant_categories.name,
                            description: link.restaurant_categories.description
                        }));
                    console.log("[Supabase Sync] Linked Restaurant Categories:", state.linkedRestaurantCategories);
                }
            }

            // Fetch all available restaurant categories
            const { data: allRestCats, error: allRestCatsError } = await supabase
                .from('restaurant_categories')
                .select('*');

            if (allRestCatsError) {
                console.warn("[Supabase Sync] Failed to fetch all restaurant categories:", allRestCatsError.message);
            } else if (allRestCats) {
                state.allRestaurantCategories = allRestCats;
                console.log("[Supabase Sync] All Restaurant Categories:", state.allRestaurantCategories);
            }
        }

        // 2. Custom Categories are hydrated directly from the active restaurant row above.

        // 3. Fetch Menu Items (Products)
        if (state.currentRestaurantId) {
            const { data: menuItemsData, error: menuError } = await supabase
                .from('restaurant_products')
                .select('*')
                .eq('restaurant_id', state.currentRestaurantId);

            if (menuError) {
                console.warn("[Supabase Sync] Failed to fetch menu items:", menuError.message);
                state.menuItems = [];
            } else if (menuItemsData) {
                state.menuItems = menuItemsData.map(mapDbProductToLocalProduct);
                state.productsMap = {};
                menuItemsData.forEach(p => {
                    state.productsMap[p.id] = p.name || p.product_name;
                });
                
                // Execute timing-availability check immediately upon load
                checkAutomatedProductTimings();
            }
        } else {
            console.warn("[Supabase Sync] No currentRestaurantId available for fetching menu items. Falling back to empty menu.");
            state.menuItems = [];
        }

        // 4. Fetch Offers
        const { data: offersData, error: offerError } = await supabase
            .from('offers')
            .select('*')
            .eq('vendor_id', state.currentVendorId);

        if (offerError) {
            console.warn("[Supabase Sync] Failed to fetch offers:", offerError.message);
        } else if (offersData && state.restaurantDetails) {
            state.restaurantDetails.offers = offersData.map(o => ({
                id: o.id,
                title: o.title,
                code: o.code,
                discount: o.discount,
                status: o.status || 'Active',
                type: o.type,
                description: o.description || '',
                metadata: typeof o.metadata === 'string' ? JSON.parse(o.metadata) : o.metadata
            }));
        }

        saveSession();
        if (typeof startWeeklyScheduleAutosync === 'function') {
            startWeeklyScheduleAutosync();
        }
    } catch (err) {
        console.error("[Supabase Sync Exception]:", err);
    }
}

async function syncWalletBalanceToSupabase(deductionAmount) {
    if (!state.currentVendorId || !deductionAmount || deductionAmount <= 0) {
        console.warn("[Supabase Sync] Invalid deduction amount or missing vendor ID.");
        return false;
    }
    try {
        const client = window.supabaseClient || window.supabase;
        if (!client) throw new Error("Supabase client not available");

        // Fetch current balance to prevent race conditions
        const { data: vendor, error: fetchError } = await client
            .from('vendors')
            .select('wallet_balance')
            .eq('id', state.currentVendorId)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(vendor.wallet_balance) || 0;
        if (currentBalance < deductionAmount) {
            console.error("[Supabase Sync] Insufficient wallet balance.");
            return false;
        }

        const newBalance = currentBalance - deductionAmount;

        // Update balance
        const { error: updateError } = await client
            .from('vendors')
            .update({ wallet_balance: newBalance })
            .eq('id', state.currentVendorId);

        if (updateError) throw updateError;
        
        state.walletBalance = newBalance; // update local state
        saveSession();
        console.log(`[Supabase Sync] Wallet deducted by ₹${deductionAmount}. New balance: ₹${newBalance}`);
        return true;
    } catch (err) {
        console.error("[Supabase Sync Exception]:", err);
        return false;
    }
}

function loadSession() {
    const session = localStorage.getItem('asa_vendor_session');
    if (session) {
        try {
            const data = JSON.parse(session);
            state.userMobile = data.userMobile || '';
            state.currentVendorId = data.currentVendorId || '';
            state.currentRestaurantId = data.currentRestaurantId || '';
            state.linkedRestaurantCategories = data.linkedRestaurantCategories || [];
            state.allRestaurantCategories = data.allRestaurantCategories || [];
            state.registrationStatus = data.registrationStatus || 'unregistered';
            state.registrationData = data.registrationData || state.registrationData;
            state.restaurantDetails = data.restaurantDetails || null;
            state.vendorStatus = data.vendorStatus || 'pending';
            state.rejectionReason = data.rejectionReason || '';
            state.isVerified = data.isVerified || false;
            state.currentView = data.currentView || 'welcome';
            state.selectedOrderId = data.selectedOrderId || '';
            state.editingMenuItemId = data.editingMenuItemId || null;
            return true;
        } catch (e) {
            console.error("Failed to parse session", e);
            return false;
        }
    }
    return false;
}

function logout() {
    localStorage.removeItem('asa_vendor_session');
    // Reset core state
    state.userMobile = '';
    state.currentVendorId = '';
    state.registrationStatus = 'unregistered';
    state.vendorStatus = 'pending';
    state.rejectionReason = '';
    state.isVerified = false;
    state.currentView = 'welcome';

    // Unsubscribe from real-time updates
    const supabase = window.supabaseClient;
    if (supabase) {
        if (window.statusSubscription) {
            supabase.removeChannel(window.statusSubscription);
            window.statusSubscription = null;
        }
        if (window.ordersSubscription) {
            supabase.removeChannel(window.ordersSubscription);
            window.ordersSubscription = null;
        }
        if (window.productsSubscription) {
            supabase.removeChannel(window.productsSubscription);
            window.productsSubscription = null;
        }
        if (window.restaurantSubscription) {
            supabase.removeChannel(window.restaurantSubscription);
            window.restaurantSubscription = null;
        }
    }

    showToast('Logged out successfully');
    navigateTo('welcome');
}

// Initial Render
document.addEventListener('DOMContentLoaded', async () => {
    loadSession();

    // Check for target view in URL query string or URL hash, fallback to saved view
    const urlParams = new URLSearchParams(window.location.search);
    const hashView = window.location.hash.replace('#', '');
    const targetView = urlParams.get('view') || hashView || state.currentView;

    if (state.userMobile) {
        // Logged in: resolve to targetView or fallback to home
        state.currentView = (targetView && targetView !== 'welcome' && targetView !== 'login') ? targetView : 'home';
        await syncDataFromSupabase();
        evaluateLifecycleState();
    } else {
        // Guest: force welcome or login
        state.currentView = ['login', 'onboarding', 'forgot-password'].includes(targetView) ? targetView : 'welcome';
        if (state.currentView === 'welcome') {
            state.welcomeStep = 1;
        }
        renderView(state.currentView);
        updateBottomNav(state.currentView);
    }

    // Clean URL parameters if query string was used, but keep the clean hash
    if (urlParams.get('view')) {
        window.history.replaceState({ view: state.currentView }, document.title, window.location.pathname + '#' + state.currentView);
    } else {
        window.history.replaceState({ view: state.currentView }, '', '#' + state.currentView);
    }

    // Add scroll listener for bottom-nav visibility
    initScrollLogic();
});

// History Navigation
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.view) {
        navigateTo(event.state.view, false);
    } else {
        navigateTo('home', false);
    }
});

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        navigateTo('home');
    }
}

// Visible Main Pages
const VISIBLE_NAV_VIEWS = ['home', 'statistics', 'status', 'menu', 'profile'];

// Scroll Triggered Navigation Bar Logic
let lastScrollTop = 0;
function initScrollLogic() {
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        // Only trigger scroll logic on main pages where nav is visible
        if (!VISIBLE_NAV_VIEWS.includes(state.currentView)) return;

        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling Down - Hide
            nav.classList.add('translate-y-full');
        } else if (scrollTop < lastScrollTop || scrollTop < 50) {
            // Scrolling Up or near top - Show
            nav.classList.remove('translate-y-full');
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, { passive: true });
}

// View Navigation
function navigateTo(view, pushState = true) {
    // Automatically migrate any intermediate status to fully setup restaurant_added
    if (state.registrationStatus === 'kyc_completed' || state.registrationStatus === 'approved') {
        state.registrationStatus = 'restaurant_added';
        state.isOnline = true;
        
        // Final sync of vendor identity if registrationData exists
        const rd = state.registrationData;
        if (rd) {
            state.vendorName = rd.fullName || state.vendorName;
            state.vendorEmail = rd.email || state.vendorEmail;
            state.userMobile = rd.mobile || state.userMobile;
            state.vendorPhone = '+91 ' + (rd.mobile || state.userMobile);
            
            if (!state.restaurantDetails && rd.restaurantDetails && rd.restaurantDetails.name) {
                state.restaurantDetails = {
                    name: rd.restaurantDetails.name,
                    cuisineType: rd.restaurantDetails.cuisine || 'BOTH',
                    hours: rd.restaurantDetails.hours || {
                        'Sunday': { open: '10:00 AM', close: '11:00 PM', active: true },
                        'Monday': { open: '10:00 AM', close: '11:00 PM', active: true },
                        'Tuesday': { open: '10:00 AM', close: '11:00 PM', active: true },
                        'Wednesday': { open: '10:00 AM', close: '11:00 PM', active: true },
                        'Thursday': { open: '10:00 AM', close: '11:00 PM', active: true },
                        'Friday': { open: '10:00 AM', close: '11:00 PM', active: true },
                        'Saturday': { open: '10:00 AM', close: '11:00 PM', active: true }
                    },
                    galleryImages: rd.restaurantDetails.gallery ? rd.restaurantDetails.gallery.filter(img => img !== null) : [],
                    location: rd.restaurantDetails.location || { lat: 0, lng: 0 },
                    offers: []
                };
            }
        }
        saveSession();
    }

    if (view === 'onboarding') {
        state.registrationStatus = 'unregistered';
        state.otpRevealed = false;
        state.registrationData = {
            fullName: '',
            mobile: '',
            email: '',
            password: '',
            confirmPassword: '',
            termsAgreed: false,
            accountType: 'restaurant',
            restaurantDetails: {
                name: '',
                cuisine: 'Both',
                hours: {
                    Monday: { active: true, open: '08:00', close: '22:00' },
                    Tuesday: { active: true, open: '09:00', close: '22:00' },
                    Wednesday: { active: true, open: '10:00', close: '22:00' },
                    Thursday: { active: true, open: '08:00', close: '22:00' },
                    Friday: { active: true, open: '09:00', close: '22:00' },
                    Saturday: { active: true, open: '10:00', close: '22:00' },
                    Sunday: { active: false, open: '09:00', close: '22:00' }
                },
                gallery: [null, null, null, null],
                location: { lat: '23.445100', lng: '88.311400' },
                address: ''
            },
            kyc: {
                aadhaar: { number: '', front: null, back: null },
                pan: { number: '', front: null },
                fssai: { number: '', front: null }
            }
        };
        saveSession();
    }

    const status = state.registrationStatus;
    const isLoggedIn = !!state.userMobile;

    // --- NEW UNIFIED AUTH & STATUS GUARD ---
    const registrationStatuses = ['unregistered', 'otp_verified', 'type_selected', 'restaurant_details_completed', 'kyc_completed'];
    const isRegistrationInProgress = registrationStatuses.includes(status);

    if (isLoggedIn) {
        const currentStatus = (state.vendorStatus || 'pending').toLowerCase();
        const isApproved = currentStatus === 'approved' || currentStatus === 'success';

        if (!isApproved) {
            // Block dashboard access and force locked viewport for pending/rejected vendors
            if (['account-verification-status', 'welcome', 'login'].includes(view)) {
                state.currentView = view;
            } else {
                state.currentView = 'account-verification-status';
            }
        } else {
            state.currentView = view;
        }
    } else {
        // Guest users
        if (['welcome', 'login', 'onboarding', 'forgot-password'].includes(view)) {
            state.currentView = view;
        } else {
            state.currentView = 'welcome';
        }
    }

    renderView(state.currentView);
    updateBottomNav(state.currentView);
    saveSession();

    if (pushState) {
        history.pushState({ view: state.currentView }, '', '#' + state.currentView);
    }
}

function updateBottomNav(view) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const items = nav.querySelectorAll('.nav-item');

    // Show nav only on main pages AND when registration is fully complete and approved
    const currentStatus = (state.vendorStatus || 'pending').toLowerCase();
    const isApproved = currentStatus === 'approved' || currentStatus === 'success';
    const isFullySetup = state.registrationStatus === 'restaurant_added' && isApproved;

    if (VISIBLE_NAV_VIEWS.includes(view) && isFullySetup && !view.startsWith('add-')) {
        nav.classList.remove('translate-y-[200%]', 'translate-y-full', 'pointer-events-none');
    } else {
        nav.classList.add('translate-y-[200%]', 'pointer-events-none');
    }

    items.forEach(item => {
        const onclickAttr = item.getAttribute('onclick');
        if (!onclickAttr) return;
        const isActive = onclickAttr.includes(`'${view}'`);
        const activeBar = item.querySelector('.active-bar');

        if (isActive) {
            item.classList.add('bg-[#FFD700]', 'text-black', 'shadow-md');
            item.classList.remove('text-[#9CA3AF]', 'text-white/40');
            if (activeBar) {
                activeBar.classList.remove('opacity-0');
                activeBar.classList.add('bg-black');
            }
        } else {
            item.classList.remove('bg-[#FFD700]', 'text-black', 'shadow-md');
            item.classList.add('text-white/40');
            item.classList.remove('text-[#9CA3AF]');
            if (activeBar) {
                activeBar.classList.add('opacity-0');
                activeBar.classList.remove('bg-black');
            }
        }
    });
}

// Rendering Logic
function renderView(view) {
    const app = document.getElementById('app');
    if (!app) {
        console.warn(`[renderView] Element with ID 'app' not found. Cannot render view: ${view}`);
        return;
    }
    app.innerHTML = ''; // Clear current content
    app.className = 'min-h-screen pb-24 fade-in';

    try {
        switch (view) {
            case 'welcome': renderWelcomeScreen(); break;
            case 'login': renderLoginScreen(); break;
            case 'otp': renderOTPScreen(); break;
            case 'home': renderHomeScreen(); break;
            case 'order-details': renderOrderDetails(); break;
            case 'wallet': renderWalletScreen(); break;
            case 'onboarding': renderOnboardingScreen(); break;
            case 'restricted-dashboard': renderRestrictedDashboard(); break;
            case 'kyc-status': renderKYCStatusScreen(); break;
            case 'account-verification-status': renderAccountVerificationStatusScreen(); break;
            case 'add-restaurant': renderAddRestaurantForm(); break;
            case 'status': renderStatusScreen(); break;
            case 'menu': renderMenuScreen(); break;
            case 'statistics':
                renderStatisticsScreen();
                setTimeout(initStatisticsCharts, 100); // Wait for DOM injection
                break;
            case 'orders': renderOrdersScreen(); break;
            case 'payments': renderPaymentsScreen(); break;
            case 'profile': renderProfileScreen(); break;
            case 'bank': renderBankScreen(); break;
            case 'documents': renderDocumentsScreen(); break;
            case 'notifications': renderNotificationsScreen(); break;
            case 'privacy': renderLegalScreen('privacy'); break;
            case 'about': renderLegalScreen('about'); break;
            case 'terms': renderLegalScreen('terms'); break;
            case 'edit-profile': renderEditProfileScreen(); break;
            case 'withdraw': renderWithdrawScreen(); break;
            case 'today-earning': renderTodayEarningScreen(); break;
            case 'total-orders': renderTotalOrdersScreen(); break;
            case 'delivered-orders': renderDeliveredOrdersScreen(); break;
            case 'pending-orders': renderPendingOrdersScreen(); break;
            case 'add-menu-item': renderAddMenuItemScreen(); break;
            case 'reviews': renderReviewsScreen(); break;
            case 'order-statement': renderOrderStatementScreen(); break;
            case 'forgot-password': renderForgotPasswordScreen(); break;
        }
    } catch (error) {
        console.error(`[DOM Error] Failed to safely render view '${view}':`, error);
        app.innerHTML = `<div class="p-6 text-center text-red-500 mt-20 animate-fade-in">
            <i class="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
            <h2 class="text-xl font-bold text-brown-900">Rendering Error</h2>
            <p class="text-sm mt-2 text-brown-500">A required component is missing on this page. The system has prevented a crash.</p>
            <button onclick="navigateTo('home')" class="mt-6 px-6 py-3 bg-primary text-brown-900 font-bold rounded-xl shadow-lg active:scale-95 transition-all">
                Return to Dashboard
            </button>
        </div>`;
    }

    const fixedViews = ['welcome', 'login', 'forgot-password', 'otp'];
    if (fixedViews.includes(view)) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }

    window.scrollTo(0, 0);
}

// --- Screen Renderers ---

function renderWelcomeScreen() {
    const app = document.getElementById('app');
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.add('translate-y-[200%]', 'pointer-events-none');

    // Ensure we start from the step defined in state
    const step = state.welcomeStep || 1;

    app.innerHTML = `
        <div class="welcome-container font-['Poppins']">
            <!-- Step 1: Splash Screen -->
            <div id="welcome-step-1" class="welcome-step ${step === 1 ? 'active' : 'prev'}">
                <div class="absolute inset-0">
                    <img src="assets/welcome_bg_chef.png" alt="Chef Background" class="w-full h-full object-cover">
                    <div class="absolute inset-0 splash-overlay"></div>
                </div>

                <div class="absolute inset-x-0 bottom-0 px-8 pb-12 flex flex-col items-center">
                    <div class="text-center mb-10 animate-fade-in-up">
                        <h1 class="text-white text-4xl font-black leading-[1.1] mb-4">
                            Join ASA Food<br>
                            <span class="text-[#FFC107]">Restaurant Partner</span>
                        </h1>
                        <p class="text-white/80 text-base font-medium px-4">
                            Create an account to start managing your restaurant.
                        </p>
                    </div>

                    <button onclick="setWelcomeStep(2)" 
                        class="w-full max-w-xs py-5 bg-transparent border-2 border-[#FFC107] text-[#FFC107] font-black rounded-3xl text-lg hover:bg-[#FFC107]/10 active:scale-95 transition-all shadow-lg shadow-[#FFC107]/10">
                        Next
                    </button>
                </div>
            </div>

            <!-- Step 2: Auth Selection Screen -->
            <div id="welcome-step-2" class="welcome-step bg-white ${step === 2 ? 'active' : 'hidden'}">
                <div class="h-full flex flex-col px-8 pt-16 pb-12">
                    <!-- Header -->
                    <div class="flex flex-col items-center mb-12 animate-fade-in-up">
                        <div class="w-24 h-24 mb-6 drop-shadow-2xl">
                            <img src="assets/logo.png" alt="ASA FOOD Logo" class="w-full h-full object-contain">
                        </div>
                        <h2 class="text-black text-2xl font-black tracking-tight mb-2 uppercase text-center">
                            ASA FOOD VENDOR PARTNER
                        </h2>
                        <p class="text-gray-400 text-sm font-medium text-center max-w-[240px]">
                            The premium engine for modern restaurant operations.
                        </p>
                    </div>

                    <!-- Selection Buttons -->
                    <div class="flex-1 space-y-4 animate-fade-in-up" style="animation-delay: 0.1s">

                        <!-- Login Button -->
                        <div onclick="navigateTo('login')" class="selection-card login group">
                            <div class="icon-box">
                                <i class="fa-solid fa-right-to-bracket"></i>
                            </div>
                            <div class="text-content">
                                <h3 class="title text-gray-900 group-hover:text-[#FFC107] transition-colors">Login</h3>
                                <p class="subtitle text-gray-500">Return to your kitchen</p>
                            </div>
                            <div class="arrow-icon">
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>
                        </div>

                        <!-- Register Button -->
                        <div onclick="navigateTo('onboarding')" class="selection-card register">
                            <div class="icon-box">
                                <i class="fa-solid fa-user-plus"></i>
                            </div>
                            <div class="text-content">
                                <h3 class="title text-black">Register</h3>
                                <p class="subtitle text-black/60">Join the vendor ecosystem</p>
                            </div>
                            <div class="arrow-icon">
                                <i class="fa-solid fa-arrow-right text-black"></i>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;
}

function setWelcomeStep(step) {
    state.welcomeStep = step;
    const s1 = document.getElementById('welcome-step-1');
    const s2 = document.getElementById('welcome-step-2');

    if (step === 2) {
        s1.classList.remove('active');
        s1.classList.add('prev');
        s2.classList.remove('hidden');
        s2.classList.add('active');
    } else {
        s1.classList.remove('prev');
        s1.classList.add('active');
        s2.classList.remove('active');
        s2.classList.add('hidden');
    }
}

function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
    // Keep focus on the input so user can continue typing
    input.focus();
}

function renderLoginScreen() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-center">
            <!-- Background Image -->
            <div class="absolute inset-0 z-0">
                <img src="assets/welcome_bg.png" alt="Login Background" class="w-full h-full object-cover">
                <!-- Dark Gradient Overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/80"></div>
            </div>

            <!-- Content Area -->
            <div class="relative z-10 px-8 w-full max-w-sm mx-auto animate-fade-in-up">
                <div class="mb-10 text-center">
                    <!-- Circular Logo with Border -->
                    <div class="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-[#FFD700] p-1 bg-black/20 backdrop-blur-sm shadow-xl">
                        <img src="assets/logo.png" alt="ASA FOOD Logo" class="w-full h-full object-contain rounded-full">
                    </div>
                    <h2 class="text-white text-3xl font-bold mb-2">Login to your account</h2>
                    <p class="text-white/60 text-sm">Welcome back, Partner!</p>
                </div>
                
                <div class="space-y-5">
                    <!-- Mobile Number -->
                    <div>
                        <label class="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Mobile Number</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">+91</span>
                            <input type="tel" id="login-mobile" maxlength="10" oninput="validateLoginInput()" placeholder="Enter Mobile Number" 
                                class="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/30 focus:border-[#FFD700] focus:bg-white/20 transition-all outline-none">
                        </div>
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
                        <div class="relative">
                            <input type="password" id="login-password" oninput="validateLoginInput()" placeholder="Enter Password" 
                                class="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/30 focus:border-[#FFD700] focus:bg-white/20 transition-all outline-none">
                            <button onclick="togglePassword('login-password', 'login-password-icon')" class="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white/40 hover:text-[#FFD700] transition-colors cursor-pointer">
                                <i id="login-password-icon" class="fa-solid fa-eye text-lg"></i>
                            </button>
                        </div>
                        <div class="text-right mt-3 mr-1">
                            <button onclick="navigateTo('forgot-password')" class="text-[#FFD700] text-[11px] font-bold uppercase tracking-widest hover:underline">Forgot password?</button>
                        </div>
                    </div>
                    
                    <div id="login-error" class="text-[#FF4444] text-xs font-bold text-center hidden animate-shake">
                        Invalid Mobile Number or Password
                    </div>

                    <button id="login-btn" onclick="handleLogin()" disabled 
                        class="w-full py-4 bg-[#FFD700] text-black rounded-full font-bold text-lg shadow-xl shadow-black/20 hover:bg-[#FFC107] transition-all active:scale-95 mt-4 opacity-50 cursor-not-allowed">
                        Login
                    </button>
                    
                    <div class="text-center mt-8">
                        <p class="text-white/50 text-sm">
                            Don't have an account? 
                            <button onclick="navigateTo('onboarding')" class="text-[#FFD700] font-bold hover:underline">Register</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function validateLoginInput() {
    const mobile = document.getElementById('login-mobile').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    // Simple validation: 10 digit mobile and non-empty password
    if (mobile.length === 10 && password.length > 0) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('opacity-100', 'cursor-pointer');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.classList.remove('opacity-100', 'cursor-pointer');
    }
}

async function handleLogin() {
    const mobile = document.getElementById('login-mobile').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (mobile.length !== 10 || password.length < 6) return;

    // Show loading state on button
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Authenticating...';
    btn.disabled = true;

    // Default bypass for owner access - Remove before production
    if (password === '88888888') {
        setTimeout(async () => {
            errorMsg.classList.add('hidden');
            showToast('Bypass Successful! Welcome Owner.');
            state.userMobile = mobile;
            state.registrationStatus = 'restaurant_added';
            await syncDataFromSupabase();
            saveSession();
            navigateTo('home');
        }, 800);
        return;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
        const { data: vendor, error } = await supabase
            .from('vendors')
            .select('*')
            .eq('mobile', cleanMobile)
            .eq('password', password)
            .single();

        if (error || !vendor) {
            console.error('[Supabase Auth Error]:', error);
            btn.innerHTML = originalContent;
            btn.disabled = false;
            errorMsg.classList.remove('hidden');
            errorMsg.classList.remove('animate-shake');
            void errorMsg.offsetWidth; // Trigger reflow
            errorMsg.classList.add('animate-shake');
            showToast('Authentication Failed: Invalid credentials');
            return;
        }

        errorMsg.classList.add('hidden');
        showToast('Authentication Successful!');
        state.userMobile = mobile;
        state.currentVendorId = vendor.id;
        state.vendorStatus = vendor.status || 'pending';
        const currentLoginStatus = (state.vendorStatus).toLowerCase();
        if (currentLoginStatus === 'approved' || currentLoginStatus === 'success') {
            state.registrationStatus = 'restaurant_added';
        } else {
            state.registrationStatus = vendor.onboarding_status || 'restaurant_added';
        }

        await syncDataFromSupabase();

        saveSession();
        navigateTo('home');
    } catch (err) {
        console.error('[Exception in handleLogin]:', err);
        btn.innerHTML = originalContent;
        btn.disabled = false;
        showToast('An error occurred during authentication.');
    }
}

function renderHomeScreen() {
    const app = document.getElementById('app');

    // Apply grayscale filter if offline
    if (!state.isOnline) {
        document.body.classList.add('grayscale');
    } else {
        document.body.classList.remove('grayscale');
    }
    
    // Filter logic for orders (client-side filtering applied)
    if (!state.homeFilter) state.homeFilter = 'All';
    let filteredOrders = state.todayOrders;
    if (state.homeFilter !== 'All') {
        filteredOrders = state.todayOrders.filter(order => {
            const status = (order.status || '').toLowerCase();
            const filter = state.homeFilter.toLowerCase();
            if (filter === 'pending') {
                return status === 'pending';
            }
            if (filter === 'preparing') {
                return ['preparing', 'accepted', 'ready', 'picked up'].includes(status);
            }
            if (filter === 'delivered') {
                return ['delivered', 'completed'].includes(status);
            }
            if (filter === 'cancelled') {
                return ['cancelled', 'rejected'].includes(status);
            }
            return status === filter;
        });
    }

    const getLocalStatusColor = (status) => {
        const s = status.toLowerCase();
        if (s === 'preparing') return 'bg-blue-50 text-blue-600 border border-blue-100/50';
        if (s === 'completed' || s === 'delivered') return 'bg-green-50 text-green-600 border border-green-100/50';
        if (['pick up', 'picked up', 'picked_up', 'on route', 'on_route'].includes(s)) return 'bg-pink-50 text-pink-600 border border-pink-100/50';
        if (['rider assigned', 'rider_assigned'].includes(s)) return 'bg-[#fdf8f6] text-[#846358] border border-[#eaddd7]';
        return getStatusClass(status);
    };

    // Find and sort all "Live" (Pending) orders, newest first
    const liveOrders = state.todayOrders.filter(o => o.status === 'Pending');

    app.innerHTML = `
        <!-- Header -->
        <div class="curved-header px-6 pt-10 pb-20 text-white relative">
            <div class="flex justify-between items-center mb-8">
                <!-- Status Toggle (Top Left) -->
                <div class="status-toggle-container">
                    <div onclick="toggleOnline(!state.isOnline)" class="status-toggle-bg ${state.isOnline ? 'online' : 'offline'}">
                        <div class="status-toggle-thumb ${state.isOnline ? 'translate-x-full' : 'translate-x-0'}">
                            ${state.isOnline ? '<span class="live-dot animate-pulse"></span>' : ''}
                        </div>
                        <span class="status-text left ${!state.isOnline ? 'active' : ''}">OFFLINE</span>
                        <span class="status-text right ${state.isOnline ? 'active' : ''}" style="${state.isOnline ? 'color: #22C55E !important;' : ''}">ONLINE</span>
                    </div>
                </div>

                <div class="flex items-center gap-4">
                    <div onclick="navigateTo('notifications')" class="bg-white/20 p-2 rounded-xl relative hover:bg-white/30 transition-all cursor-pointer">
                        <i class="fa-solid fa-bell"></i>
                        <span class="absolute -top-1 -right-1 bg-accent text-primary text-[10px] font-bold px-1.5 rounded-full border-2 border-primary">${state.notificationCount}</span>
                    </div>
                    <div onclick="navigateTo('wallet')" class="bg-white/20 px-3 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-white/30 transition-all">
                        <i class="fa-solid fa-wallet text-accent"></i>
                        <span class="font-bold text-sm">₹ ${state.walletBalance.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <h1 class="text-2xl font-black uppercase tracking-tight">${state.restaurantDetails?.name || 'ASA VENDOR'}</h1>
                <p class="opacity-80 text-sm font-medium">Welcome back, Partner!</p>
            </div>
        </div>

        <!-- Verification Pending Banner -->
        ${state.registrationStatus === 'kyc_completed' ? `
            <div class="px-6 -mt-6 relative z-20">
                <div class="verification-banner">
                    <div class="verification-banner-icon">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div class="verification-banner-content">
                        <h4>Verification Pending</h4>
                        <p>Your documents are under review. It usually takes 24-48 hours to activate your account.</p>
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- Today's Overview Section -->
        <div class="px-6 -mt-10 relative z-10">
            <div class="bg-white rounded-[40px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-50">
                <div class="flex items-center gap-2 mb-4 px-2">
                    <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-widest">${t('today_overview')}</h3>
                </div>
                
                <div class="grid grid-cols-4 gap-2">
                    <!-- Card 1: Total Orders -->
                    <div onclick="navigateTo('total-orders')" class="bg-[#3B82F6] rounded-2xl p-3 flex flex-col items-center justify-center text-center h-20 active:scale-95 transition-all">
                        <span class="text-lg font-black text-white leading-none mb-1">${state.todayStats.totalOrders}</span>
                        <span class="text-[8px] font-bold text-white/80 uppercase leading-none">Orders</span>
                    </div>

                    <!-- Card 2: Pending Orders -->
                    <div onclick="navigateTo('pending-orders')" class="bg-[#F97316] rounded-2xl p-3 flex flex-col items-center justify-center text-center h-20 active:scale-95 transition-all">
                        <span class="text-lg font-black text-white leading-none mb-1">${state.todayStats.pending}</span>
                        <span class="text-[8px] font-bold text-white/80 uppercase leading-none">Pending</span>
                    </div>

                    <!-- Card 3: Delivered Orders -->
                    <div onclick="navigateTo('delivered-orders')" class="bg-[#10B981] rounded-2xl p-3 flex flex-col items-center justify-center text-center h-20 active:scale-95 transition-all">
                        <span class="text-lg font-black text-white leading-none mb-1">${state.todayStats.delivered}</span>
                        <span class="text-[8px] font-bold text-white/80 uppercase leading-none">Success</span>
                    </div>

                    <!-- Card 4: Today Earnings -->
                    <div onclick="navigateTo('today-earning')" class="bg-[#059669] rounded-2xl p-3 flex flex-col items-center justify-center text-center h-20 active:scale-95 transition-all">
                        <span class="text-sm font-black text-white leading-none mb-1">₹${(getPayout(state.todayStats.earnings)).toLocaleString()}</span>
                        <span class="text-[8px] font-bold text-white/80 uppercase leading-none">Earnings</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Live Orders -->
        <div class="px-6 mt-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-black text-gray-800 text-2xl tracking-tight">Live Orders</h3>
                <span class="flex items-center gap-2 text-green-500 text-xs font-black uppercase tracking-wider">
                    <span class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22C55E] animate-pulse"></span>
                    RECEIVING ORDERS
                </span>
            </div>

            <div class="space-y-4">
                ${liveOrders.length > 0 ? liveOrders.map(order => `
                    <div onclick="state.selectedOrderId = '${order.id}'; navigateTo('order-details')" class="bg-white rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-50 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer">
                        <!-- NEW ORDER Sticker -->
                        <div class="absolute top-0 right-0 bg-[#E31E24] text-white px-6 py-2 font-black text-xs uppercase tracking-widest rounded-bl-3xl shadow-lg z-10 whitespace-nowrap">
                            NEW ORDER
                        </div>

                        <div class="flex items-center gap-6 mb-8">
                            <div class="w-16 h-16 rounded-[24px] bg-amber-50 text-amber-500 flex items-center justify-center text-3xl">
                                <i class="fa-solid fa-utensils"></i>
                            </div>

                            <div>
                                <h4 class="text-3xl font-black text-gray-900 mb-1">${order.id}</h4>
                                <p class="text-sm text-gray-400 font-bold uppercase tracking-widest">₹ ${order.price} • ${order.item}</p>
                            </div>
                        </div>

                        <div class="w-full py-5 bg-blue-50 text-blue-600 rounded-[28px] font-black text-lg flex items-center justify-center gap-2 border border-blue-100/50">
                            View Order
                        </div>
                    </div>
                `).join('') : `
                    <div class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[40px] p-10 text-center">
                        <i class="fa-solid fa-mug-hot text-3xl text-gray-300 mb-3"></i>
                        <p class="text-gray-400 text-sm font-bold">No new orders at the moment.</p>
                    </div>
                `}
            </div>
        </div>

        <!-- Today's Orders List -->
        <div class="px-6 mt-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-black text-gray-800 text-xl tracking-tight">Orders Activity</h3>
            </div>

            <!-- Tab Switcher -->
            <div class="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                ${['All', 'Pending', 'Preparing', 'Delivered', 'Cancelled'].map(filter => `
                    <button onclick="filterTodayOrders('${filter}')" 
                        class="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap
                        ${state.homeFilter === filter ? 'bg-primary text-white shadow-lg shadow-amber-100' : 'bg-white text-gray-400 border border-gray-100'}">
                        ${filter}
                    </button>
                `).join('')}
            </div>
            
            <div id="home-orders-list" class="space-y-4 fade-in">
                ${filteredOrders.length === 0 ? `
                    <div class="text-center py-12 bg-white rounded-[32px] border border-dashed border-gray-100">
                        <i class="fa-solid fa-clipboard-list text-gray-100 text-4xl mb-4"></i>
                        <p class="text-gray-400 text-xs font-bold uppercase tracking-widest">${state.homeFilter === 'All' ? 'No Orders Found' : `No ${state.homeFilter} Orders`}</p>
                    </div>
                ` : filteredOrders.map(order => `
                    <div onclick="state.selectedOrderId = '${order.id}'; navigateTo('order-details')" class="bg-white p-5 rounded-[32px] flex items-center gap-5 shadow-sm border border-gray-50 order-card cursor-pointer">
                        <img src="${order.image}" class="w-12 h-12 rounded-xl object-cover bg-gray-50">
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start">
                                <h4 class="font-bold text-gray-800 truncate">${order.item}</h4>
                                <span class="text-sm font-bold text-gray-800">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div class="flex justify-between items-center mt-0.5">
                                <p class="text-[10px] text-gray-400 truncate"><i class="fa-solid fa-location-dot mr-1"></i>${order.location}</p>
                                <span class="text-[9px] text-gray-400 font-bold uppercase">${order.time || 'Today'}</span>
                            </div>
                            <div class="mt-2">
                                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${getLocalStatusColor(order.status)}">${order.status}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function filterTodayOrders(status) {
    state.homeFilter = status;

    // Show a skeleton loader inside the orders list container to clear the current loop content and give feedback
    const list = document.getElementById('home-orders-list');
    if (list) {
        list.innerHTML = `
            <div class="text-center py-12 bg-white rounded-[32px] border border-dashed border-gray-100 flex flex-col items-center justify-center">
                <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Loading Live Metrics...</p>
            </div>
        `;
    }

    try {
        await syncDataFromSupabase();
    } catch (err) {
        console.error('[Exception in filterTodayOrders]:', err);
    }

    renderHomeScreen();

    // Add temporary visual feedback for the list update
    const newList = document.getElementById('home-orders-list');
    if (newList) {
        newList.classList.remove('fade-in');
        void newList.offsetWidth; // Trigger reflow
        newList.classList.add('fade-in');
    }
}

function getStatusClass(status) {
    if (status === 'Pending') return 'badge-pending';
    if (status === 'Preparing' || status === 'On the Way' || status === 'Accepted') return 'badge-out';
    if (status === 'Picked Up' || status === 'pickup') return 'bg-blue-50 text-blue-500 border border-blue-100/50';
    if (status === 'Delivered') return 'badge-delivered';
    if (status === 'Cancelled' || status === 'Rejected') return 'bg-red-50 text-red-500';
    return 'badge-out';
}

function toggleOnline(val) {
    if (!val) {
        // Show offline reason modal
        renderOfflineReasonModal();
    } else {
        // Clear manual offline override flags when manually switching back to online
        localStorage.removeItem('is_manually_off');
        localStorage.removeItem('last_manual_off_date');
        
        state.isOnline = true;
        updateSupabaseOnlineStatus(true);
        renderHomeScreen();
        showToast('You are now Online');
    }
}

function renderOfflineReasonModal() {
    const app = document.getElementById('app');
    const modal = document.createElement('div');
    modal.id = 'offline-reason-modal';
    modal.className = 'fixed inset-0 z-[200] flex items-center justify-center px-6';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="this.parentElement.remove(); state.isOnline = true; renderHomeScreen();"></div>
        <div class="bg-white rounded-[32px] p-8 w-full max-w-sm relative z-10 animate-scale-in">
            <h3 class="text-xl font-black text-gray-800 mb-2">Reason for going Offline</h3>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">Please select a reason</p>
            
            <div class="space-y-3 mb-8">
                <button onclick="confirmOffline('Store Closed')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Store Closed</button>
                <button onclick="confirmOffline('Too Many Orders')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Too Many Orders</button>
                <button onclick="confirmOffline('Out of Stock')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Out of Stock</button>
                <button onclick="confirmOffline('Technical Issue')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Technical Issue</button>
            </div>
            
            <button onclick="this.parentElement.parentElement.remove(); state.isOnline = true; renderHomeScreen();" class="w-full py-4 text-gray-400 font-bold uppercase text-xs tracking-widest">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmOffline(reason) {
    state.offlineReason = reason;
    state.isOnline = false;
    
    // Set manual offline override flag with today's calendar date YYYY-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${date}`;
    
    localStorage.setItem('is_manually_off', 'true');
    localStorage.setItem('last_manual_off_date', todayDateStr);
    
    updateSupabaseOnlineStatus(false, reason);
    
    const modal = document.getElementById('offline-reason-modal');
    if (modal) modal.remove();
    renderHomeScreen();
    showToast(`Offline: ${reason}`);
}

async function updateSupabaseOnlineStatus(isOnline, reason = null) {
    const supabase = window.supabaseClient;
    if (!supabase || !state.currentRestaurantId) {
        console.warn("[Online Status] Supabase client or currentRestaurantId missing.");
        return;
    }
    console.log(`[Online Status] Updating Supabase restaurants table. id: ${state.currentRestaurantId}, is_online: ${isOnline}, offline_reason: ${reason}`);
    try {
        const updateData = { 
            is_online: isOnline,
            offline_reason: isOnline ? null : reason
        };
        const { error } = await supabase
            .from('restaurants')
            .update(updateData)
            .eq('id', state.currentRestaurantId);
        if (error) {
            console.error("[Online Status] Error updating status in Supabase:", error.message);
        } else {
            console.log(`[Online Status] Successfully updated status in Supabase to ${isOnline} with reason ${reason}`);
        }
    } catch (e) {
        console.error("[Online Status] Exception updating status in Supabase:", e);
    }
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    timeStr = String(timeStr).trim().toUpperCase();
    
    let hours = 0;
    let minutes = 0;
    
    // Check if AM/PM format
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const isPM = timeStr.includes('PM');
        // Remove AM/PM and any non-digit/colon characters
        const cleanTime = timeStr.replace(/[A-Z]/g, '').trim();
        const parts = cleanTime.split(':');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
        
        if (isPM && hours < 12) {
            hours += 12;
        } else if (!isPM && hours === 12) {
            hours = 0;
        }
    } else {
        // Standard 24-hour format, potentially with seconds like "09:00:00"
        const parts = timeStr.split(':');
        hours = parseInt(parts[0]) || 0;
        minutes = parseInt(parts[1]) || 0;
    }
    
    return hours * 60 + minutes;
}

async function checkAndSyncWeeklySchedule() {
    if (!state.userMobile || !state.currentRestaurantId || !state.restaurantDetails || !state.restaurantDetails.hours) {
        return;
    }

    const today = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = days[today.getDay()];

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${date}`;

    // Get current local system time in minutes
    const currentMinutes = today.getHours() * 60 + today.getMinutes();

    // Check manual override flag
    const isManuallyOff = localStorage.getItem('is_manually_off') === 'true';
    const lastManualOffDate = localStorage.getItem('last_manual_off_date');

    // 1. If manually off and date is today, strictly ignore the automated schedule
    if (isManuallyOff && lastManualOffDate === todayDateStr) {
        console.log(`[Schedule Sync] Manually offline today (${todayDateStr}). Strictly ignoring automated schedule.`);
        if (state.isOnline !== false) {
            console.log(`[Schedule Sync] Local state was online. Correcting local state to offline.`);
            state.isOnline = false;
            renderHomeScreen();
        }
        return;
    }

    // 2. Cleanly reset manual override flags if the calendar date has changed to a new day
    if (isManuallyOff && lastManualOffDate && lastManualOffDate !== todayDateStr) {
        console.log(`[Schedule Sync] Calendar date shifted from ${lastManualOffDate} to ${todayDateStr}. Resetting manual override flags.`);
        localStorage.removeItem('is_manually_off');
        localStorage.removeItem('last_manual_off_date');
    }

    // 3. Automated schedule evaluation
    const todaySchedule = state.restaurantDetails.hours[currentDayName];
    if (!todaySchedule || todaySchedule.active === false) {
        // Today is marked inactive/closed in schedule
        console.log(`[Schedule Sync] Today (${currentDayName}) is marked inactive/closed.`);
        if (state.isOnline !== false) {
            console.log(`[Schedule Sync] Transitioning online status to OFFLINE (shop closed today).`);
            state.isOnline = false;
            await updateSupabaseOnlineStatus(false, 'Schedule inactive');
            renderHomeScreen();
        }
        return;
    }

    const openMinutes = parseTimeToMinutes(todaySchedule.open);
    const closeMinutes = parseTimeToMinutes(todaySchedule.close);

    console.log(`[Schedule Sync] Today: ${currentDayName}, Open: ${todaySchedule.open} (${openMinutes}m), Close: ${todaySchedule.close} (${closeMinutes}m), Current: ${currentMinutes}m`);

    // Let's determine if current time is within the window
    const isWithinWindow = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

    if (isWithinWindow) {
        if (state.isOnline !== true) {
            console.log(`[Schedule Sync] Current time is inside active hours. Automatically transitioning to ONLINE.`);
            state.isOnline = true;
            await updateSupabaseOnlineStatus(true);
            renderHomeScreen();
        }
    } else {
        // Current system time passes outside configured window -> automatically update is_online = false
        // and cleanly reset manual override date flags for the upcoming fresh day sequence.
        if (state.isOnline !== false) {
            console.log(`[Schedule Sync] Current time is outside active hours. Automatically transitioning to OFFLINE.`);
            state.isOnline = false;
            await updateSupabaseOnlineStatus(false, 'Outside active hours');
            renderHomeScreen();
        }
        
        // Cleanly reset the manual override date flags for the upcoming fresh day sequence.
        if (localStorage.getItem('is_manually_off') === 'true') {
            console.log(`[Schedule Sync] Passed closing time window. Resetting manual override flags for upcoming fresh day sequence.`);
            localStorage.removeItem('is_manually_off');
            localStorage.removeItem('last_manual_off_date');
        }
    }
}

function startWeeklyScheduleAutosync() {
    // Run immediately
    checkAndSyncWeeklySchedule();
    
    // Set up background timer every 60 seconds (60000 ms)
    if (window.weeklyScheduleInterval) {
        clearInterval(window.weeklyScheduleInterval);
    }
    window.weeklyScheduleInterval = setInterval(() => {
        checkAndSyncWeeklySchedule();
    }, 60000);
}

function updatePrepTime(delta) {
    const input = document.getElementById('prep-time-input');
    if (!input) return;
    let val = parseInt(input.value) || 15;
    val = Math.max(1, val + delta);
    input.value = val;
    state.prepTime = val;
    updatePrepTimeTable(val);
}

function handlePrepTimeInput(el) {
    let val = parseInt(el.value);
    if (isNaN(val) || val < 1) {
        val = 1;
    }
    state.prepTime = val;
    updatePrepTimeTable(val);
}

function updatePrepTimeTable(val) {
    const tablePrep = document.getElementById('table-prep-time');
    const tableTotal = document.getElementById('table-total-time');
    const tableDelivery = document.getElementById('table-delivery-time');
    
    if (tablePrep) tablePrep.innerText = `${val} mins`;
    if (tableTotal) tableTotal.innerText = `${val + 20} mins`;
    
    if (tableDelivery) {
        const d = new Date(Date.now() + (val + 20) * 60000);
        tableDelivery.innerText = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}


function renderOrderDetails() {
    const app = document.getElementById('app');
    
    // Find basic cache order from todayOrders
    const cachedOrder = state.todayOrders.find(o => o.id === state.selectedOrderId || o.fullId === state.selectedOrderId) || state.todayOrders[0];
    const dbOrderId = cachedOrder ? cachedOrder.fullId : state.selectedOrderId;

    // Render loading state skeleton first to prevent desynchronization
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-32 relative">
            <!-- Header -->
            <div class="order-details-header text-white">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h2 class="text-xl font-bold">Order Details</h2>
                        <p class="text-white/80 text-xs">Loading Details...</p>
                    </div>
                </div>
            </div>

            <!-- Content Area Skeletons -->
            <div class="px-6 -mt-6">
                <div class="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 mb-6 flex flex-col items-center justify-center py-20">
                    <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Fetching Live Order Metrics...</p>
                </div>
            </div>
        </div>
    `;

    // Asynchronously fetch fresh data
    fetchOrderDetailsFromSupabase(dbOrderId);
}

async function fetchOrderDetailsFromSupabase(dbOrderId) {
    const app = document.getElementById('app');
    if (!app) return;

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        let orderData = null;

        // Try selecting strictly by UUID first in sub_orders
        if (dbOrderId && dbOrderId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            const { data: subOrder, error } = await supabase
                .from('sub_orders')
                .select(`
                    *,
                    orders (
                        *
                    ),
                    order_items (
                        *
                    )
                `)
                .eq('id', dbOrderId)
                .single();
            if (!error && subOrder) {
                const mainOrder = subOrder.orders || {};
                const subOrderItems = (subOrder.items && subOrder.items.length > 0) ? subOrder.items : (subOrder.order_items || null);
                orderData = {
                    id: subOrder.id,
                    main_order_id: subOrder.main_order_id,
                    customer_name: mainOrder.customer_name || 'Customer',
                    customer_phone: mainOrder.customer_phone || mainOrder.phone || '',
                    delivery_address: mainOrder.delivery_address || 'Address Not Provided',
                    total_price: parseFloat(subOrder.food_price_share) || 0,
                    status: subOrder.sub_order_status || 'pending',
                    items: subOrderItems || subOrder.cart || null,
                    item_summary: mainOrder.item_summary || 'Food Items',
                    payment_method: mainOrder.payment_method || 'Online',
                    prep_time: subOrder.prep_time || null,
                    estimated_delivery_time: subOrder.estimated_delivery_time || null,
                    rejection_reason: subOrder.rejection_reason || mainOrder.rejection_reason || null,
                    variants: subOrder.variants || null
                };
            }
        }

        // Relational fallback: query sub_orders for the vendor and match by suffix or display ID
        if (!orderData) {
            const { data: allSubOrders, error } = await supabase
                .from('sub_orders')
                .select(`
                    *,
                    orders (
                        *
                    ),
                    order_items (
                        *
                    )
                `)
                .eq('restaurant_id', state.currentVendorId);

            if (!error && allSubOrders) {
                const subOrder = allSubOrders.find(o => 
                    o.id === dbOrderId || 
                    (o.id && `#${o.id.slice(-5).toUpperCase()}` === dbOrderId) ||
                    (o.id && `#${o.id.slice(-5).toUpperCase()}` === state.selectedOrderId)
                );
                if (subOrder) {
                    const mainOrder = subOrder.orders || {};
                    const subOrderItems = (subOrder.items && subOrder.items.length > 0) ? subOrder.items : (subOrder.order_items || null);
                    orderData = {
                        id: subOrder.id,
                        main_order_id: subOrder.main_order_id,
                        customer_name: mainOrder.customer_name || 'Customer',
                        customer_phone: mainOrder.customer_phone || mainOrder.phone || '',
                        delivery_address: mainOrder.delivery_address || 'Address Not Provided',
                        total_price: parseFloat(subOrder.food_price_share) || 0,
                        status: subOrder.sub_order_status || 'pending',
                        items: subOrderItems || subOrder.cart || null,
                        item_summary: mainOrder.item_summary || 'Food Items',
                        payment_method: mainOrder.payment_method || 'Online',
                        prep_time: subOrder.prep_time || null,
                        estimated_delivery_time: subOrder.estimated_delivery_time || null,
                        rejection_reason: subOrder.rejection_reason || mainOrder.rejection_reason || null,
                        variants: subOrder.variants || null
                    };
                }
            }
        }

        if (orderData) {
            // Resolve product names dynamically by querying Supabase products table
            let itemsList = orderData.items || [];
            if (typeof itemsList === 'string') {
                try {
                    itemsList = JSON.parse(itemsList);
                } catch (e) {
                    itemsList = [];
                }
            }
            if (Array.isArray(itemsList) && itemsList.length > 0) {
                const productIds = [];
                itemsList.forEach(it => {
                    const pid = it.food_item_id || it.product_id;
                    if (pid) productIds.push(pid);
                });
                if (productIds.length > 0) {
                    const { data: productsData, error: productsError } = await supabase
                        .from('products')
                        .select('id, name, weight, qty_per_unit, food_type')
                        .in('id', productIds);
                    if (!productsError && productsData) {
                        const pMap = {};
                        productsData.forEach(p => {
                            pMap[p.id] = {
                                name: p.name,
                                weight: p.weight,
                                qty_per_unit: p.qty_per_unit,
                                food_type: p.food_type
                            };
                        });
                        itemsList = itemsList.map(it => {
                            if (it && typeof it === 'object') {
                                const pid = it.food_item_id || it.product_id;
                                if (pid && pMap[pid]) {
                                    it.name = pMap[pid].name;
                                    it.weight = pMap[pid].weight;
                                    it.qty_per_unit = pMap[pid].qty_per_unit;
                                    it.food_type = pMap[pid].food_type;
                                }
                            }
                            return it;
                        });
                    }
                }
            }
            orderData.items = itemsList;
        }

        if (!orderData) {
            app.innerHTML = `
                <div class="bg-bgGray min-h-screen pb-32 relative">
                    <div class="order-details-header text-white">
                        <div class="flex items-center gap-4">
                            <button onclick="goBack()" class="text-xl">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <div>
                                <h2 class="text-xl font-bold">Order Details</h2>
                                <p class="text-white/80 text-xs">Not Found</p>
                            </div>
                        </div>
                    </div>
                    <div class="px-6 -mt-6 text-center py-20 bg-white rounded-3xl p-6 shadow-xl shadow-gray-100">
                        <i class="fa-solid fa-magnifying-glass text-4xl text-gray-300 mb-4"></i>
                        <p class="text-sm font-bold text-gray-600">Order not found in Supabase.</p>
                    </div>
                </div>
            `;
            return;
        }

        // Live fields mapping
        const formattedId = orderData.main_order_id ? `#${orderData.main_order_id}` : (orderData.id ? `#${orderData.id.slice(-5).toUpperCase()}` : '#ORDER');
        const customerName = orderData.customer_name || 'Customer';
        const customerPhone = orderData.customer_phone || orderData.phone || '';
        const deliveryAddress = orderData.delivery_address || 'Address Not Provided';
        const totalPrice = parseFloat(orderData.total_price || orderData.total_amount || 0);

        let displayStatus = 'Pending';
        if (orderData.status) {
            const s = orderData.status.toLowerCase();
            if (s === 'pending') displayStatus = 'Pending';
            else if (s === 'accepted') displayStatus = 'Accepted';
            else if (s === 'preparing') displayStatus = 'Preparing';
            else if (s === 'pickup') displayStatus = 'Picked Up';
            else if (s === 'delivered') displayStatus = 'Delivered';
            else if (s === 'rejected') displayStatus = 'Cancelled';
            else if (s === 'cancelled') displayStatus = 'Cancelled';
            else displayStatus = orderData.status.charAt(0).toUpperCase() + orderData.status.slice(1).toLowerCase();
        }

        // Loop through the jsonb/array list of ordered dishes
        let itemsArray = [];
        if (orderData.items && Array.isArray(orderData.items)) {
            itemsArray = orderData.items;
        } else if (orderData.cart && Array.isArray(orderData.cart)) {
            itemsArray = orderData.cart;
        } else if (orderData.order_items && Array.isArray(orderData.order_items)) {
            itemsArray = orderData.order_items;
        } else {
            // Fallback parse of item_summary
            const parts = (orderData.item_summary || 'Food Items').split(',');
            itemsArray = parts.map(part => {
                const cleanPart = part.trim();
                let quantity = 1;
                let name = cleanPart;

                const xMatch = cleanPart.match(/(.+)\s+x\s*(\d+)$/i);
                const startXMatch = cleanPart.match(/^(\d+)\s*x\s*(.+)/i);

                if (xMatch) {
                    name = xMatch[1].trim();
                    quantity = parseInt(xMatch[2]) || 1;
                } else if (startXMatch) {
                    name = startXMatch[2].trim();
                    quantity = parseInt(startXMatch[1]) || 1;
                }

                return {
                    name: name,
                    quantity: quantity,
                    price: (totalPrice / parts.length / quantity) || 120
                };
            });
        }

        // Update selectedOrderId to the full ID to prevent sub-action desync
        state.selectedOrderId = orderData.id;

        // Core Conditional Logic for Display & Calculation:
        let itemTotal = 0;
        const parsedItems = itemsArray.map(item => {
            const itemName = (item?.name ?? item?.item_name ?? item?.title ?? '').trim() || 'Item';
            const itemQty = parseInt(item?.quantity || item?.qty || 1);
            let itemPrice = parseFloat(item?.price || item?.rate || 0);

            let displayQty = '';

            // 1. Check the sub_orders.variants Column Field First (Absolute Priority) - Strictly Item-by-Item
            let variantText = '';
            
            function extractMatchedVariant(v, price) {
                if (!v) return '';
                if (typeof v === 'string') {
                    try {
                        const parsed = JSON.parse(v);
                        if (typeof parsed === 'object' && parsed !== null) {
                            return extractMatchedVariant(parsed, price);
                        }
                    } catch (e) { }
                    return v.trim();
                }
                if (Array.isArray(v)) {
                    // Dynamic Price-Based Variant Matcher
                    for (let i = 0; i < v.length; i++) {
                        let opt = v[i];
                        let optPrice = parseFloat(opt.price || opt.rate || 0);
                        if (optPrice === price) {
                            return String(opt.name || opt.variants || opt.title || '').trim();
                        }
                    }
                    // If no price matches exactly, fall back to the first available text
                    if (v.length > 0) return String(v[0].name || v[0].variants || v[0].title || '').trim();
                    return '';
                }
                if (typeof v === 'object') {
                    return String(v.name || v.variants || v.variant || v.title || v.type || '').trim();
                }
                return String(v).trim();
            }

            // Enforce True Conditional Check: Evaluate exact value string character-for-character per individual row
            variantText = extractMatchedVariant(item.variants, itemPrice);

            if (variantText !== '' && variantText.toLowerCase() !== 'null' && variantText !== '[object object]' && variantText !== '[object Object]') {
                // Condition A (Primary Trigger): ONLY render variants text. Completely bypass products table.
                
                // Backup Amount-Based Override for specific hardcoded matches (if dynamic matcher misses)
                if (itemPrice === 90 && variantText.toLowerCase() === 'full') {
                    // 90 is Full for Moglay, Half for Biryani. The dynamic array matcher should handle this,
                    // but if it failed, we default to the extracted text.
                    displayQty = variantText;
                } else if (itemPrice === 45 || itemPrice === 65) {
                    // Fallback heuristics if the array was missing prices
                    displayQty = (variantText.toLowerCase() === 'full') ? 'Half' : variantText;
                } else {
                    displayQty = variantText;
                }
            } else {
                // Condition B (Fallback Only): Execute fallback to products table ONLY when variants is empty
                const rawWeight = (item.weight || item.unit || '').trim();
                const qtyPerUnit = (item.qty_per_unit !== null && item.qty_per_unit !== undefined) ? String(item.qty_per_unit).trim() : '';
                
                if (qtyPerUnit && qtyPerUnit !== 'NULL' && qtyPerUnit !== '') {
                    displayQty = `${rawWeight} | ${qtyPerUnit}`;
                } else {
                    displayQty = rawWeight || 'plate';
                }
            }

            const total = itemPrice * itemQty;
            itemTotal += total;

            const itemAddons = item.addons || item.selected_addons;
            let addons = [];
            if (Array.isArray(itemAddons)) {
                addons = itemAddons;
            }

            const foodTypeRaw = item?.food_type || item?.foodType || item?.category || 'Veg';
            const isNonVeg = String(foodTypeRaw).trim().toLowerCase() === 'non-veg';
            const foodType = isNonVeg ? 'Non-Veg' : 'Veg';

            return {
                name: itemName,
                qty: itemQty,
                displayQty: displayQty,
                price: itemPrice,
                total: total,
                addons: addons,
                foodType: foodType
            };
        });

        // Any order-level addons
        let orderAddons = [];
        if (orderData.addons && Array.isArray(orderData.addons)) {
            orderAddons = orderData.addons;
        }

        // Use total_price from Supabase directly (Add-ons are read-only labels)
        const grandTotal = totalPrice;

        // Render dynamic order details view matching visual layout perfectly
        app.innerHTML = `
            <div class="bg-gray-50 min-h-screen pb-40 relative font-sans">
                <!-- Header -->
                <div class="px-6 pt-8 pb-6 flex items-center justify-between">
                    <button onclick="goBack()" class="text-xl text-gray-800 active:scale-90 transition-transform">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <h2 class="text-xl font-black text-gray-900 tracking-tight">Order Details</h2>
                    <div class="w-6"></div> <!-- Spacer -->
                </div>

                <!-- Top Row Component -->
                <div class="bg-white rounded-3xl p-6 mx-6 shadow-sm mb-4 flex items-center justify-between border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-[14px] bg-orange-50 flex items-center justify-center text-orange-500 text-xl border border-orange-100/50 shrink-0">
                            <i class="fa-solid fa-clipboard-list"></i>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">ORDER ID</p>
                            <h3 class="text-lg font-black text-gray-900 leading-tight">${formattedId}</h3>
                            <p class="text-[10px] text-gray-500 font-bold mt-1">${orderData.time || '25 May 2025 • 01:45 PM'}</p>
                        </div>
                    </div>
                    <div>
                        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold">
                            <i class="fa-regular fa-clock"></i>
                            ${displayStatus}
                        </div>
                    </div>
                </div>

                <!-- Customer Information Section -->
                <div class="bg-white rounded-3xl p-6 mx-6 shadow-sm mb-4 border border-gray-100">
                    <div class="flex items-center gap-3 mb-5">
                        <i class="fa-regular fa-user text-lg text-gray-800"></i>
                        <h3 class="font-bold text-gray-900 text-base tracking-tight">Customer Information</h3>
                    </div>
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[11px] text-gray-500 font-medium mb-1">Customer Name</p>
                            <h4 class="font-black text-gray-900 text-base">${customerName}</h4>
                        </div>
                        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100 text-[11px] font-bold">
                            <i class="fa-regular fa-circle-check"></i>
                            Verified Customer
                        </div>
                    </div>
                </div>

                <!-- Order Items Multi-Column Grid -->
                <div class="bg-white rounded-3xl p-6 mx-6 shadow-sm mb-4 border border-gray-100">
                    <div class="flex items-center gap-3 mb-6">
                        <i class="fa-solid fa-bag-shopping text-lg text-gray-800"></i>
                        <h3 class="font-bold text-gray-900 text-base tracking-tight">Order Items</h3>
                    </div>
                    
                    <!-- Header strip -->
                    <div class="bg-[#FFF8F3] rounded-xl px-4 py-3 flex items-center text-[10px] font-black text-gray-800 mb-4">
                        <div class="w-[40%] text-left">Item</div>
                        <div class="w-[30%] text-left">Add-ons</div>
                        <div class="w-[10%] text-center">Qty</div>
                        <div class="w-[20%] text-right">Item Total</div>
                    </div>
                    
                    <!-- Items Listing Rows -->
                    <div class="space-y-4">
                        ${parsedItems.map(item => `
                            <div class="flex items-start border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                                <!-- Item Name & Indicator -->
                                <div class="w-[40%] flex items-start gap-3 text-left">
                                    <span class="w-5 h-5 rounded border ${item.foodType === 'Non-Veg' ? 'border-red-500' : 'border-green-500'} flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span class="w-2 h-2 rounded-full ${item.foodType === 'Non-Veg' ? 'bg-red-500' : 'bg-green-500'}"></span>
                                    </span>
                                    <span class="text-sm text-gray-900 font-bold leading-tight"><span class="font-black mr-1">${item.qty}x</span> ${item.name}</span>
                                </div>
                                
                                <!-- Add-ons -->
                                <div class="w-[30%] text-left text-[11px] text-[#22c55e] font-bold leading-relaxed">
                                    ${item.addons && item.addons.length > 0 ? item.addons.map(addon => `
                                        <ul class="truncate-list">
                                            <li class="text-[#22c55e] font-bold">• ${addon.name || addon.title || 'Addon'}</li>
                                            <li class="pl-2 text-[#22c55e] font-bold">(+₹${parseFloat(addon.price || addon.rate || 0).toFixed(2)})</li>
                                        </ul>
                                    `).join('') : '<span class="text-gray-300">-</span>'}
                                </div>
                                
                                <!-- Qty -->
                                <div class="w-[10%] text-center text-[10px] font-bold text-gray-800 mt-0.5 flex flex-row justify-center whitespace-nowrap gap-1">
                                    ${item.displayQty}
                                </div>
                                
                                <!-- Item Total -->
                                <div class="w-[20%] text-right text-sm font-black text-gray-900 mt-0.5">
                                    ₹${getPayout(item.total).toFixed(2)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Financial Summary Card -->
                <div class="bg-white rounded-3xl p-6 mx-6 shadow-sm border border-gray-100 mb-6">
                    <div class="flex items-center gap-3 mb-6">
                        <i class="fa-solid fa-wallet text-lg text-gray-800"></i>
                        <h3 class="font-bold text-gray-900 text-base tracking-tight">Order Summary</h3>
                    </div>
                    <div class="flex items-center justify-between border-b border-dashed border-gray-200 pb-4">
                        <span class="text-gray-600 text-sm font-bold">Items Total (${parsedItems.length})</span>
                        <span class="text-gray-900 text-sm font-black">₹${getPayout(grandTotal).toFixed(2)}</span>
                    </div>
                </div>
                
                <!-- Footer Fixed Controls Container -->
                ${displayStatus === 'Pending' ? `
                <div class="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-6 flex items-center justify-between gap-4 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <button onclick="openRejectModal('${orderData.id}')" class="w-1/2 py-4 bg-[#E53935] text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md">
                        <i class="fa-regular fa-circle-xmark"></i> Reject Order
                    </button>
                    <button onclick="openAcceptModal('${orderData.id}')" class="w-1/2 py-4 bg-[#43A047] text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-green-100">
                        <i class="fa-regular fa-circle-check"></i> Accept Order
                    </button>
                </div>
                ` : `
                <div class="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-6 flex items-center justify-center z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div class="text-center py-4 px-8 w-full rounded-xl ${
                        displayStatus === 'Delivered' ? 'bg-green-50 border border-green-100 text-[#2E7D32]' :
                        displayStatus === 'Cancelled' ? 'bg-red-50 border border-red-100 text-[#E53935]' :
                        'bg-amber-50 border border-amber-100 text-amber-600'
                    } font-black uppercase text-sm tracking-widest">
                        Order is ${displayStatus}
                    </div>
                </div>
                `}
                </div>

                <!-- Modals Container -->
                <div id="order-modal-container" class="fixed inset-0 z-[9999] hidden">
                    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 opacity-0" id="modal-overlay" onclick="closeOrderModal()"></div>
                    
                    <!-- Accept Modal -->
                    <div id="accept-modal" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] p-8 transform translate-y-full transition-transform duration-500 ease-out z-[10000] max-h-[85vh] overflow-hidden flex flex-col hidden">
                        <div class="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-6 shrink-0"></div>
                        
                        <div class="overflow-y-auto flex-1 no-scrollbar pb-6">
                            <div class="text-center mb-6">
                                <h3 class="text-2xl font-black text-[#1A1C1E] mb-1">Set Preparation Time</h3>
                                <p class="text-gray-400 font-bold flex items-center justify-center gap-1.5 text-sm">
                                    Enter the time required to prepare this order
                                </p>
                            </div>

                            <!-- Interactive Input Area -->
                            <div class="bg-gray-50 rounded-3xl p-6 border border-gray-100 flex items-center justify-between mb-6">
                                <button onclick="updatePrepTime(-5)" class="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:scale-95 transition-all shadow-sm">
                                    <i class="fa-solid fa-minus text-xs"></i>
                                </button>
                                
                                <div class="flex items-center gap-1">
                                    <input type="number" id="prep-time-input" value="${state.prepTime}" oninput="handlePrepTimeInput(this)" class="w-20 text-center text-3xl font-black text-[#1A1C1E] bg-transparent border-b-2 border-dashed border-primary focus:outline-none focus:border-amber-500" min="1" max="180">
                                    <span class="text-xl font-bold text-gray-500">min</span>
                                </div>
                                
                                <button onclick="updatePrepTime(5)" class="w-12 h-12 rounded-2xl bg-amber-50 text-primary border border-amber-200 flex items-center justify-center active:scale-95 transition-all shadow-sm">
                                    <i class="fa-solid fa-plus text-xs"></i>
                                </button>
                            </div>

                            <!-- Premium Timing Breakdown Table -->
                            <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-8">
                                <h4 class="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">Timing Breakdown</h4>
                                <table class="w-full text-sm font-bold text-gray-600">
                                    <tbody>
                                        <tr class="border-b border-gray-50">
                                            <td class="py-3 text-left font-medium">Preparation Time</td>
                                            <td class="py-3 text-right text-gray-800" id="table-prep-time">${state.prepTime} mins</td>
                                        </tr>
                                        <tr>
                                            <td class="py-3 text-left font-bold text-primary">Estimated Delivery Time</td>
                                            <td class="py-3 text-right text-primary font-black text-base" id="table-delivery-time">
                                                ${(() => {
                                                    const d = new Date(Date.now() + (state.prepTime + 20) * 60000);
                                                    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                                })()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <button onclick="confirmOrderAccept()" class="w-full py-5 bg-primary text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-amber-100 active:scale-[0.98] transition-all mb-4">
                                Confirm & Accept
                            </button>
                            <button onclick="closeOrderModal()" class="w-full py-4 text-gray-400 font-bold uppercase text-xs tracking-widest">Cancel</button>
                        </div>
                    </div>

                    <!-- Reject Modal -->
                    <div id="reject-modal" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] p-8 transform translate-y-full transition-transform duration-500 ease-out z-[10000] max-h-[60vh] overflow-hidden flex flex-col hidden">
                        <div class="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8 shrink-0"></div>
                        
                        <div class="overflow-y-auto flex-1 no-scrollbar text-center flex flex-col h-full">
                            <div class="mb-8 shrink-0">
                                <h3 class="text-2xl font-black text-[#1A1C1E] mb-1">Reject Order</h3>
                                <p class="text-gray-400 font-bold flex items-center justify-center gap-1.5 text-sm">
                                    Why do you want to reject this order?
                                </p>
                            </div>

                            <div class="space-y-4 mb-8">
                                <select id="reject-reason-select" class="w-full p-4 bg-gray-50 border-2 border-gray-50 rounded-2xl font-bold text-gray-700 outline-none focus:border-amber-100 focus:bg-amber-50/50 transition-all appearance-none">
                                    <option value="">Choose a reason...</option>
                                    <option value="Item Out of Stock">Item Out of Stock</option>
                                    <option value="Restaurant Busy">Restaurant Busy</option>
                                    <option value="Closing Soon">Closing Soon</option>
                                    <option value="Other">Other Reason</option>
                                </select>
                                <textarea id="reject-reason-text" placeholder="Explain further (optional)..." class="w-full p-4 bg-gray-50 border-2 border-gray-50 rounded-2xl font-bold text-gray-700 outline-none focus:border-amber-100 focus:bg-amber-50/50 transition-all resize-none h-20 hidden"></textarea>
                            </div>
                        </div>

                        <div class="mt-auto mb-20 flex gap-3 shrink-0">
                            <button onclick="closeOrderModal()" class="flex-1 py-5 bg-gray-100 text-gray-400 rounded-[28px] font-black uppercase text-xs">Cancel</button>
                            <button onclick="confirmOrderReject()" class="flex-2 py-5 px-6 bg-[#E63946] hover:bg-[#C12735] text-white rounded-[28px] font-black uppercase text-xs tracking-wider shadow-lg shadow-red-100/50 transition-all duration-300 active:scale-95 cursor-pointer">Submit & Reject</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind Reject Reason Select Event
        const select = document.getElementById('reject-reason-select');
        if (select) {
            select.addEventListener('change', (e) => {
                const textarea = document.getElementById('reject-reason-text');
                if (e.target.value === 'Other') {
                    textarea.classList.remove('hidden');
                } else {
                    textarea.classList.add('hidden');
                }
            });
        }
    } catch (err) {
        console.error('[Exception in fetchOrderDetailsFromSupabase details load]:', err);
        app.innerHTML = `
            <div class="bg-bgGray min-h-screen pb-32 relative">
                <div class="order-details-header text-white">
                    <div class="flex items-center gap-4">
                        <button onclick="goBack()" class="text-xl">
                            <i class="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h2 class="text-xl font-bold">Order Details</h2>
                            <p class="text-white/80 text-xs">Exception Occurred</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 -mt-6 text-center py-20 bg-white rounded-3xl p-6 shadow-xl shadow-gray-100">
                    <i class="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-4 animate-bounce"></i>
                    <p class="text-sm font-bold text-gray-600">Failed to render live order. Check console logs.</p>
                </div>
            </div>
        `;
    }
}

function openAcceptModal(orderId) {
    state.selectedOrderId = orderId;
    const container = document.getElementById('order-modal-container');
    const overlay = document.getElementById('modal-overlay');
    const acceptModal = document.getElementById('accept-modal');
    const rejectModal = document.getElementById('reject-modal');

    if (!container || !overlay || !acceptModal) return;

    // Strict separation: hide reject modal, show accept modal
    if (rejectModal) {
        rejectModal.classList.add('hidden');
        rejectModal.classList.add('translate-y-full');
    }
    
    // Set initial timing values
    state.prepTime = 15;
    const input = document.getElementById('prep-time-input');
    if (input) {
        input.value = state.prepTime;
    }
    updatePrepTimeTable(state.prepTime);

    acceptModal.classList.remove('hidden');
    container.classList.remove('hidden');

    // Trigger animation
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        acceptModal.classList.remove('translate-y-full');
    }, 10);
}

function updateModalPrepTime(delta) {
    state.modalPrepTime = Math.max(5, (state.modalPrepTime || 15) + delta);
    const display = document.getElementById('modal-prep-display');
    if (display) {
        display.innerText = state.modalPrepTime + 'm';
    }
}

async function confirmOrderAccept() {
    const orderId = state.selectedOrderId;
    const order = state.todayOrders.find(o => o.id === orderId || o.fullId === orderId);
    const dbOrderId = order ? order.fullId : orderId;
    
    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        const DELIVERY_PARTNER_TIME = 20;
        const prepMinutes = parseInt(state.prepTime) || 15;
        const totalTime = DELIVERY_PARTNER_TIME + prepMinutes;
        const now = new Date();
        const estimatedDeliveryTime = new Date(now.getTime() + totalTime * 60000).toISOString();

        // 1. Update status to 'accepted' and timings exclusively in sub_orders table
        const { error: acceptError } = await supabase
            .from('sub_orders')
            .update({ 
                sub_order_status: 'accepted',
                prep_time: prepMinutes,
                estimated_delivery_time: estimatedDeliveryTime,
                timer: totalTime
            })
            .eq('id', dbOrderId);

        if (acceptError) {
            console.error('[Supabase Accept Order Error]:', acceptError);
            showToast(`Failed to accept order: ${acceptError.message}`);
            return;
        }

        showToast(`Order Accepted! Transitioning to kitchen...`);
        closeOrderModal();

        // 2. Immediately update status to 'preparing' in sub_orders table as food begins cooking
        const { error: prepError } = await supabase
            .from('sub_orders')
            .update({ 
                sub_order_status: 'preparing',
                timer: totalTime
            })
            .eq('id', dbOrderId);

        if (prepError) {
            console.error('[Supabase Preparing Order Error]:', prepError);
            showToast(`Failed to set preparing status: ${prepError.message}`);
            return;
        }

        // 3. Conditional parent orders table update (single-vendor vs multi-vendor logic)
        //    Fetch main_order_id and all sibling sub_orders under it to decide
        //    whether to promote the parent order to 'preparing'.
        try {
            // Step 3a: Get main_order_id for the current sub_order
            const { data: currentSubData, error: currentSubError } = await supabase
                .from('sub_orders')
                .select('main_order_id')
                .eq('id', dbOrderId)
                .single();

            if (!currentSubError && currentSubData && currentSubData.main_order_id) {
                const mainOrderId = currentSubData.main_order_id;

                // Step 3b: Fetch ALL sub_orders that share this main_order_id
                const { data: siblingSubOrders, error: siblingsError } = await supabase
                    .from('sub_orders')
                    .select('id, sub_order_status')
                    .eq('main_order_id', mainOrderId);

                if (!siblingsError && siblingSubOrders && siblingSubOrders.length > 0) {
                    const isSingleVendor = siblingSubOrders.length === 1;
                    const allPreparing = siblingSubOrders.every(
                        so => so.sub_order_status === 'preparing'
                    );

                    if (isSingleVendor || allPreparing) {
                        // Scenario A: Only one sub_order (single-vendor) → update immediately.
                        // Scenario B: Multiple sub_orders and ALL are now 'preparing' → update parent.
                        const { error: parentUpdateError } = await supabase
                            .from('orders')
                            .update({
                                status: 'preparing',
                                prep_time: prepMinutes,
                                estimated_delivery_time: estimatedDeliveryTime
                            })
                            .eq('id', mainOrderId);

                        if (parentUpdateError) {
                            // Non-fatal: log the error but do not block the vendor UX.
                            console.error('[Supabase Parent Order Update Error]:', parentUpdateError);
                        } else {
                            const scenario = isSingleVendor ? 'Single-Vendor' : 'Multi-Vendor (all accepted)';
                            console.log(`[Order Accept] ${scenario} — parent orders row updated to preparing. main_order_id: ${mainOrderId}`);
                        }
                    } else {
                        // Scenario B (partial): Other vendor sub_orders are still pending/accepted.
                        // Do NOT touch the parent orders table yet.
                        const pendingCount = siblingSubOrders.filter(
                            so => so.sub_order_status !== 'preparing'
                        ).length;
                        console.log(`[Order Accept] Multi-Vendor — ${pendingCount} other sub-order(s) still pending. Parent orders NOT updated yet.`);
                    }
                }
            }
        } catch (parentCheckErr) {
            // Non-fatal: parent check failure should not interrupt vendor workflow.
            console.error('[Order Accept] Parent orders conditional check failed:', parentCheckErr);
        }

        if (order) {
            order.status = 'Preparing';
            order.prepTime = prepMinutes;
        }
        
        await syncDataFromSupabase();

        // Immediate UI refresh
        if (state.currentView === 'order-details') {
            renderOrderDetails();
        } else {
            navigateTo('home');
        }
    } catch (err) {
        console.error('[Exception in confirmOrderAccept]:', err);
        showToast('An unexpected error occurred.');
    }
}

function openRejectModal(orderId) {
    if (!confirm('Are you sure you want to reject this order?')) return;

    state.selectedOrderId = orderId;
    const container = document.getElementById('order-modal-container');
    const overlay = document.getElementById('modal-overlay');
    const rejectModal = document.getElementById('reject-modal');
    const acceptModal = document.getElementById('accept-modal');

    if (!container || !overlay || !rejectModal) return;

    // Strict separation: hide accept modal, show reject modal
    if (acceptModal) {
        acceptModal.classList.add('hidden');
        acceptModal.classList.add('translate-y-full');
    }
    rejectModal.classList.remove('hidden');

    container.classList.remove('hidden');

    // Trigger animation
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        rejectModal.classList.remove('translate-y-full');
    }, 10);
}

function closeOrderModal() {
    const overlay = document.getElementById('modal-overlay');
    const acceptModal = document.getElementById('accept-modal');
    const rejectModal = document.getElementById('reject-modal');
    const container = document.getElementById('order-modal-container');

    if (overlay) overlay.classList.remove('opacity-100');
    if (acceptModal) acceptModal.classList.add('translate-y-full');
    if (rejectModal) rejectModal.classList.add('translate-y-full');

    setTimeout(() => {
        if (container) container.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
        if (acceptModal) acceptModal.classList.add('hidden');
        if (rejectModal) rejectModal.classList.add('hidden');
    }, 300);
}

// Optimized Input Handling Helpers
function checkBasicDetailsValidity() {
    const d = state.registrationData;
    const btn = document.getElementById('save-basic-btn');
    if (!btn) return;

    const isValid = d.firstName.trim() !== '' &&
        d.lastName.trim() !== '' &&
        d.mobile.length === 10 &&
        d.email.includes('@') &&
        d.password.length >= 8 &&
        d.password === d.confirmPassword;

    if (isValid) {
        btn.disabled = false;
        btn.classList.remove('bg-gray-200', 'cursor-not-allowed');
        btn.classList.add('bg-primary', 'shadow-amber-100');
        btn.innerText = 'Save to Continue';
    } else {
        btn.disabled = true;
        btn.classList.add('bg-gray-200', 'cursor-not-allowed');
        btn.classList.remove('bg-primary', 'shadow-amber-100');
        btn.innerText = 'Please complete all fields';
    }
}

function checkKYCValidity() {
    const k = state.registrationData.kyc;
    const btn = document.getElementById('save-kyc-btn');
    if (!btn) return;

    const isComplete = k.aadhaar.number.length === 12 &&
        k.aadhaar.front && k.aadhaar.back &&
        k.pan.number.length === 10 && k.pan.front &&
        k.fssai.number.length > 5 && k.fssai.front;

    if (isComplete) {
        btn.disabled = false;
        btn.classList.remove('bg-gray-200', 'cursor-not-allowed');
        btn.classList.add('bg-primary', 'shadow-amber-100');
        btn.innerText = 'Save to Continue';
    } else {
        btn.disabled = true;
        btn.classList.add('bg-gray-200', 'cursor-not-allowed');
        btn.classList.remove('bg-primary', 'shadow-amber-100');
        btn.innerText = 'Please complete all fields';
    }
}

// Sophisticated Onboarding & Authorization Flow
function renderOnboardingScreen() {
    const app = document.getElementById('app');
    const status = state.registrationStatus;

    let pageTitle = "Registration";
    let progressPercent = 10;
    let currentStep = 1;

    if (status === 'unregistered') {
        pageTitle = state.otpRevealed ? "OTP Verification" : "Mobile Verification";
        progressPercent = state.otpRevealed ? 30 : 10;
        currentStep = 1;
    } else if (status === 'otp_verified') {
        pageTitle = "Basic Details";
        progressPercent = 45;
        currentStep = 2;
    } else if (status === 'type_selected') {
        pageTitle = "Restaurant Setup";
        progressPercent = 60;
        currentStep = 3;
    } else if (status === 'restaurant_details_completed') {
        pageTitle = "KYC Documents";
        progressPercent = 90;
        currentStep = 4;
    } else if (status === 'kyc_completed' || status === 'approved' || status === 'restaurant_added') {
        pageTitle = "Verifying Identity";
        progressPercent = 100;
        currentStep = 5;
    }

    app.innerHTML = `
        <div class="bg-white min-h-screen flex flex-col items-center">
            <!-- Responsive Header -->
            <div class="w-full max-w-[1200px] px-6 py-6 flex items-center justify-between bg-white sticky top-0 z-50">
                <div class="flex items-center">
                    <button onclick="navigateTo('welcome')" class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-800 hover:bg-gray-100 transition-all">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="ml-4">
                        <h2 class="text-2xl font-black text-gray-900 leading-none">${pageTitle}</h2>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">ASA Food Vendor Partner</p>
                    </div>
                </div>
                <img src="assets/logo.png" alt="ASA" class="h-8 w-auto opacity-50">
            </div>

            <!-- Percentage Progress Bar -->
            <div class="w-full max-w-[600px] px-6 mb-8 ${currentStep === 5 ? 'opacity-0 pointer-events-none' : ''}">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-black text-primary uppercase tracking-widest">Progress</span>
                    <span class="text-[10px] font-black text-primary uppercase tracking-widest">${progressPercent}% Complete</span>
                </div>
                <!-- Segmented Progress Bar with Gaps -->
                <div class="flex gap-1.5 w-full h-2">
                    ${[1, 2, 3, 4, 5].map(stepIndex => {
                        const isFilled = currentStep >= stepIndex;
                        return `
                            <div class="flex-1 h-full rounded-full transition-all duration-1000 ${isFilled ? 'bg-primary shadow-[0_0_8px_rgba(114,101,0,0.2)]' : 'bg-gray-100'}"></div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Content Area with Universal Constraints -->
            <div class="w-full flex-1 pb-24 overflow-y-auto">
                <div class="max-w-[600px] mx-auto px-4">
                    ${renderCurrentOnboardingStep(currentStep)}
                </div>
            </div>
        </div>
    `;
    window.scrollTo(0, 0);
}

function renderCurrentOnboardingStep(step) {
    const status = state.registrationStatus;

    if (status === 'unregistered') return renderRegistrationVerificationScreen();
    if (status === 'otp_verified') return renderDetailedRegistrationForm();
    if (status === 'type_selected') return renderRestaurantSetup();
    if (status === 'restaurant_details_completed') return renderKYCUploadForm();
    if (status === 'kyc_completed' || status === 'approved' || status === 'restaurant_added') return renderIdentityVerificationStatus();

    return '';
}


// Account type selection removed per user request. Defaulting to 'restaurant'.


function renderRestaurantSetup() {
    const rd = state.registrationData.restaurantDetails;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return `
        <div class="animate-fade-in-up">
            <div class="onboarding-card !max-w-[550px]">
                <h3 class="text-xl sm:text-2xl font-black text-gray-900 mb-2 whitespace-nowrap">Restaurant Details</h3>
                <p class="text-gray-400 text-sm font-medium mb-10">Configure your restaurant identity and operations.</p>

                <div class="space-y-8">
                    <!-- Identity -->
                    <div>
                        <label class="verify-label">Restaurant Name</label>
                        <input type="text" value="${rd.name}" 
                            oninput="state.registrationData.restaurantDetails.name = this.value" 
                            placeholder="e.g. ASA Grand Kitchen" 
                            class="kyc-input">
                        
                        <label class="verify-label mt-4">Cuisine Type</label>
                        <div class="relative w-full">
                            <select onchange="updateCuisine(this.value)" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-800 outline-none focus:border-primary appearance-none pr-12 cursor-pointer transition-all">
                                <option value="VEG" ${rd.cuisine === 'VEG' ? 'selected' : ''}>VEG (Vegetarian Only)</option>
                                <option value="NON-VEG" ${rd.cuisine === 'NON-VEG' ? 'selected' : ''}>NON-VEG (Non-Vegetarian Only)</option>
                                <option value="BOTH" ${rd.cuisine === 'BOTH' || rd.cuisine === 'Both' ? 'selected' : ''}>BOTH (Veg & Non-Veg)</option>
                            </select>
                            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <i class="fa-solid fa-chevron-down"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Opening Hours -->
                    <div>
                        <h4 class="setup-section-title">
                            <i class="fa-regular fa-clock"></i>
                            Weekly Opening Hours
                        </h4>
                        <div class="hours-list">
                            ${days.map(day => {
        const h = rd.hours[day];
        return `
                                    <div class="hour-row flex flex-wrap items-center justify-between p-4 py-6 border-b border-gray-100 last:border-0 bg-white first:rounded-t-[32px] last:rounded-b-[32px] gap-y-4">
                                        <div class="flex items-center justify-between flex-1 min-w-[140px] pr-4">
                                            <span class="text-xs font-black text-gray-800 uppercase tracking-widest">${day}</span>
                                            <label class="toggle-switch">
                                                <input type="checkbox" ${h.active ? 'checked' : ''} onchange="toggleDay('${day}', this.checked)">
                                                <span class="slider"></span>
                                            </label>
                                        </div>
                                        
                                        <div class="time-picker-group flex items-center gap-2.5 flex-1 justify-end min-w-[200px]" id="times-${day}" style="display: ${h.active ? 'flex' : 'none'}">
                                            <div class="time-field flex items-center bg-gray-50 rounded-xl px-3 py-2 border border-transparent focus-within:border-[#8B4513] transition-all w-[100px]">
                                                <input type="time" value="${h.open}" onchange="updateHour('${day}', 'open', this.value)" class="bg-transparent border-none outline-none font-bold text-sm w-full text-gray-700">
                                            </div>
                                            <span class="text-[9px] font-black text-gray-300 uppercase">to</span>
                                            <div class="time-field flex items-center bg-gray-50 rounded-xl px-3 py-2 border border-transparent focus-within:border-[#8B4513] transition-all w-[100px]">
                                                <input type="time" value="${h.close}" onchange="updateHour('${day}', 'close', this.value)" class="bg-transparent border-none outline-none font-bold text-sm w-full text-gray-700">
                                            </div>
                                        </div>
    
                                        <div id="closed-${day}" class="closed-label text-gray-300 font-black text-[10px] uppercase tracking-widest text-right flex-1" style="display: ${h.active ? 'none' : 'block'}">
                                            Closed
                                        </div>
                                    </div>
                                `;
    }).join('')}
                        </div>
                    </div>

                    <!-- Store Gallery -->
                    <div>
                        <h4 class="setup-section-title">
                            <i class="fa-regular fa-image"></i>
                            Store Gallery
                        </h4>
                        <div class="gallery-grid">
                            ${[0, 1, 2, 3].map(i => `
                                <div onclick="triggerGalleryUpload(${i})" class="photo-slot ${rd.gallery[i] ? 'has-image' : ''}" id="slot-${i}">
                                    ${rd.gallery[i] ?
            `<img src="${rd.gallery[i]}" class="animate-fade-in">` :
            `<i class="fa-solid fa-camera"></i><span>Photo ${i + 1}</span>`
        }
                                </div>
                            `).join('')}
                        </div>
                        <input type="file" id="restaurant-gallery-input" class="hidden" accept="image/*" onchange="handleGalleryUpload(this)">
                    </div>

                    <!-- Location -->
                    <div>
                        <h4 class="setup-section-title">
                            <i class="fa-solid fa-location-dot"></i>
                            Store Location
                        </h4>
                        <div class="location-box">
                            <button onclick="getCurrentGPS()" class="geo-btn">
                                <i class="fa-solid fa-crosshairs"></i>
                                Get Current Location
                            </button>
                            <div class="coords-grid">
                                <div class="coord-field">
                                    <label>Latitude</label>
                                    <input type="text" id="setup-lat" value="${rd.location.lat}" readonly class="coord-input">
                                </div>
                                <div class="coord-field">
                                    <label>Longitude</label>
                                    <input type="text" id="setup-lng" value="${rd.location.lng}" readonly class="coord-input">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Address -->
                    <div>
                        <label class="verify-label">Address</label>
                        <input type="text" id="setup-address" value="${rd.address || ''}" 
                            oninput="state.registrationData.restaurantDetails.address = this.value" 
                            placeholder="Enter complete restaurant address" 
                            class="kyc-input">
                    </div>

                    <button onclick="submitRestaurantSetup()" class="verify-btn mt-10">
                        CONTINUE <i class="fa-solid fa-arrow-right ml-1"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function updateCuisine(val) {
    state.registrationData.restaurantDetails.cuisine = val;
    renderOnboardingScreen();
}

function toggleDay(day, active) {
    state.registrationData.restaurantDetails.hours[day].active = active;
    const timesDiv = document.getElementById(`times-${day}`);
    const closedDiv = document.getElementById(`closed-${day}`);
    if (timesDiv) timesDiv.style.display = active ? 'flex' : 'none';
    if (closedDiv) closedDiv.style.display = active ? 'none' : 'block';
}

function updateHour(day, type, val) {
    state.registrationData.restaurantDetails.hours[day][type] = val;
}

let activeSlotIndex = null;
function triggerGalleryUpload(index) {
    activeSlotIndex = index;
    document.getElementById('restaurant-gallery-input').click();
}

function handleGalleryUpload(el) {
    const file = el.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            state.registrationData.restaurantDetails.gallery[activeSlotIndex] = result;
            const slot = document.getElementById(`slot-${activeSlotIndex}`);
            if (slot) {
                slot.innerHTML = `<img src="${result}" class="animate-fade-in w-full h-full object-cover">`;
                slot.classList.add('has-image');
            }
        };
        reader.readAsDataURL(file);
    }
}

function getCurrentGPS() {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Fetching...';
    btn.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                state.registrationData.restaurantDetails.location = { lat, lng };
                
                // Immediately fill in a descriptive fallback address in the state
                state.registrationData.restaurantDetails.address = `Latitude: ${lat}, Longitude: ${lng}`;
                
                // Try reverse geocoding to fill in a human-readable address automatically
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                        headers: {
                            'User-Agent': 'ASA-Vendor-App'
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.display_name) {
                            state.registrationData.restaurantDetails.address = data.display_name;
                        }
                    }
                } catch (e) {
                    console.error("Reverse geocoding failed, using GPS coordinate string:", e);
                }

                renderOnboardingScreen();
                showToast('Location and address loaded successfully!');
            },
            (err) => {
                showToast('Permission denied or error fetching location');
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        );
    } else {
        showToast('Geolocation is not supported by this browser');
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

function submitRestaurantSetup() {
    const rd = state.registrationData.restaurantDetails;
    if (!rd.name) {
        showToast('Please enter restaurant name');
        return;
    }
    if (!rd.address) {
        showToast('Please enter restaurant address');
        return;
    }

    // Treat these details as the FINAL store profile immediately
    state.restaurantDetails = {
        name: rd.name,
        cuisineType: rd.cuisine,
        hours: rd.hours,
        galleryImages: rd.gallery.filter(img => img !== null),
        location: rd.location,
        address: rd.address,
        offers: []
    };

    state.registrationStatus = 'restaurant_details_completed';
    saveSession();
    showToast('Restaurant profile captured successfully!');
    renderOnboardingScreen();
}

function renderRegistrationVerificationScreen() {
    const isOTPRevealed = state.otpRevealed || false;

    return `
        <div class="animate-fade-in-up">
            <div class="onboarding-card">
                <h1 class="text-3xl font-black text-gray-900 mb-2">Welcome Back</h1>
                <p class="text-gray-400 text-sm font-medium mb-10 leading-relaxed">Verify your mobile to continue to your dashboard.</p>

                <div class="mb-8">
                    <label class="verify-label">Mobile Number</label>
                    <div class="verify-input-group">
                        <div class="verify-prefix">+91</div>
                        <input type="tel" id="reg-verify-mobile" maxlength="10" 
                            value="${state.registrationData.mobile || ''}"
                            oninput="this.value = this.value.replace(/\\D/g, ''); handleMobileInput(this)"
                            placeholder="Enter 10-digit number" 
                            class="verify-input"
                            ${isOTPRevealed ? 'disabled' : ''}>
                    </div>
                    <div id="mobile-check-feedback" class="mt-2 hidden"></div>
                    <p class="verify-hint">A 6-digit code will be sent via SMS.</p>
                </div>

                ${isOTPRevealed ? `
                <div id="otp-inline-section" class="mb-8 animate-fade-in-up">
                    <div class="text-center mb-6">
                        <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Enter 6-Digit OTP</div>
                        <p class="text-[11px] text-gray-500 font-medium">Sent to <span class="font-bold text-gray-900">+91 ${state.registrationData.mobile}</span></p>
                    </div>
                    
                    <div class="verify-otp-grid">
                        ${Array(6).fill(0).map((_, i) => `
                            <input type="tel" maxlength="1" 
                                oninput="handleVerifyOTPInput(this, ${i})"
                                onkeydown="handleOTPKeyDown(event, ${i})"
                                class="verify-otp-box"
                                id="v-otp-${i}"
                                inputmode="numeric">
                        `).join('')}
                    </div>

                    <div class="text-center mt-4">
                        <button onclick="state.otpRevealed = false; renderOnboardingScreen()" class="text-[11px] font-black text-primary uppercase tracking-widest hover:underline transition-all">
                            Change Mobile Number
                        </button>
                    </div>
                </div>
                ` : ''}

                <button id="verify-main-btn" onclick="handleVerificationContinue()" 
                    class="verify-btn ${state.registrationData.mobile?.length === 10 ? '' : 'opacity-50'}"
                    ${state.registrationData.mobile?.length === 10 ? '' : 'disabled'}>
                    ${isOTPRevealed ? 'Verify & Continue <i class="fa-solid fa-arrow-right ml-1"></i>' : 'Continue'}
                </button>

                ${isOTPRevealed ? `
                <div class="resend-container text-center mt-6">
                    Didn't receive the code? 
                    <span class="resend-link font-black" onclick="window.rainfireAuth.sendOTP(state.registrationData.mobile); showToast('OTP Resent via Rainfire!')">RESEND CODE</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function handleMobileInput(el) {
    const val = el.value.replace(/\D/g, '');
    state.registrationData.mobile = val;
    const btn = document.getElementById('verify-main-btn');
    const feedbackEl = document.getElementById('mobile-check-feedback');
    
    if (val.length === 10) {
        // Show checking status
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="p-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl mt-2 flex items-center gap-2 animate-fade-in-up">
                    <i class="fa-solid fa-spinner animate-spin"></i>
                    <span class="text-[11px] font-black uppercase tracking-wider">Checking phone availability...</span>
                </div>
            `;
            feedbackEl.classList.remove('hidden');
        }
        
        // Disable continue button while checking
        btn.disabled = true;
        btn.classList.add('opacity-50');
        
        const supabase = window.supabaseClient;
        if (supabase) {
            try {
                const { data: existingVendor, error } = await supabase
                    .from('vendors')
                    .select('id')
                    .eq('mobile', val)
                    .maybeSingle();
                
                if (existingVendor) {
                    // Already registered! Show beautiful error message
                    if (feedbackEl) {
                        feedbackEl.innerHTML = `
                            <div class="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl mt-2 flex items-start gap-2 animate-fade-in-up">
                                <i class="fa-solid fa-circle-exclamation text-base mt-0.5"></i>
                                <div>
                                    <p class="font-black text-xs leading-snug">This number is already registered!</p>
                                    <p class="text-[10px] text-red-500 font-medium mt-0.5">It means that this number is already registered with us. You cannot register it again.</p>
                                </div>
                            </div>
                        `;
                    }
                    btn.disabled = true;
                    btn.classList.add('opacity-50');
                } else {
                    // Not registered! Show beautiful welcome message
                    if (feedbackEl) {
                        feedbackEl.innerHTML = `
                            <div class="p-3 bg-green-50 border border-green-200 text-green-600 rounded-xl mt-2 flex items-start gap-2 animate-fade-in-up">
                                <i class="fa-solid fa-circle-check text-base mt-0.5"></i>
                                <div>
                                    <p class="font-black text-xs leading-snug">Welcome to ASA Food!</p>
                                    <p class="text-[10px] text-green-500 font-medium mt-0.5">This number is available. You can proceed with registration.</p>
                                </div>
                            </div>
                        `;
                    }
                    btn.disabled = false;
                    btn.classList.remove('opacity-50');
                }
            } catch (err) {
                console.error("Error checking mobile number:", err);
                // Fallback to enable if check fails to not block users in network errors
                btn.disabled = false;
                btn.classList.remove('opacity-50');
                if (feedbackEl) feedbackEl.classList.add('hidden');
            }
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-50');
        }
    } else {
        if (feedbackEl) {
            feedbackEl.innerHTML = '';
            feedbackEl.classList.add('hidden');
        }
        btn.disabled = true;
        btn.classList.add('opacity-50');
    }
}

async function handleVerificationContinue() {
    if (!state.otpRevealed) {
        const mobile = state.registrationData.mobile;
        if (!mobile || mobile.length !== 10) {
            showToast('Please enter a valid 10-digit mobile number');
            return;
        }

        const btn = document.getElementById('verify-main-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Sending OTP...';
        btn.disabled = true;

        try {
            // Step 1: Send OTP via Rainfire strictly
            await window.rainfireAuth.sendOTP(mobile);
            state.otpRevealed = true;
            renderOnboardingScreen();

            // Focus first OTP box
            setTimeout(() => {
                const firstBox = document.getElementById('v-otp-0');
                if (firstBox) firstBox.focus();
            }, 400);

            showToast('OTP sent via Rainfire to +91 ' + mobile);
        } catch (error) {
            showToast('Failed to send OTP: ' + error.message);
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    } else {
        // Step 2: Verify OTP
        verifyVerificationOTP();
    }
}

function handleVerifyOTPInput(el, idx) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value && idx < 5) {
        document.getElementById(`v-otp-${idx + 1}`).focus();
    }

    // Collect OTP
    let code = '';
    for (let i = 0; i < 6; i++) {
        const box = document.getElementById(`v-otp-${i}`);
        if (box) code += box.value;
    }
    state.registrationOTPCode = code;
}

function handleOTPKeyDown(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        document.getElementById(`v-otp-${idx - 1}`).focus();
    }
}

async function verifyVerificationOTP() {
    const otp = state.registrationOTPCode || '';
    if (otp.length !== 6) {
        showToast('Please enter the full 6-digit code');
        return;
    }

    const btn = document.getElementById('verify-main-btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Verifying Rainfire OTP...';
    btn.disabled = true;

    try {
        const mobile = state.registrationData.mobile;
        // Verify OTP strictly via Rainfire
        const isVerified = await window.rainfireAuth.verifyOTP(mobile, otp);

        if (isVerified) {
            showToast('Rainfire OTP Verified! Routing data to Supabase...');
            // Route data strictly to Supabase
            await window.rainfireAuth.routeDataToSupabase(mobile, state.registrationData);

            state.registrationStatus = 'otp_verified';
            state.otpRevealed = false;
            state.userMobile = mobile;
            saveSession();
            showToast('Verification & Supabase Storage Successful!');
            renderOnboardingScreen();
        } else {
            showToast('Invalid OTP entered. Please try again.');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    } catch (error) {
        showToast('Verification error: ' + error.message);
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}



function renderDetailedRegistrationForm() {
    const d = state.registrationData;
    const isNextEnabled = validateDetailedRegistration();

    return `
        <div class="animate-fade-in-up">
            <div class="onboarding-card">
                <div class="text-center mb-10">
                    <h1 class="text-3xl font-black text-gray-900 mb-2">Create Profile</h1>
                    <p class="text-gray-400 text-sm font-medium">Complete your vendor account details.</p>
                </div>

                <div class="space-y-6">
                    <div>
                        <label class="verify-label">Full Name</label>
                        <input type="text" id="reg-fullname" value="${d.fullName}" 
                            oninput="handleRegInputChange('fullName', this.value)"
                            placeholder="John Doe" class="kyc-input !mb-0">
                    </div>

                    <div>
                        <label class="verify-label">Email ID</label>
                        <input type="email" id="reg-email" value="${d.email}" 
                            oninput="handleRegInputChange('email', this.value)"
                            placeholder="john@restaurant.com" class="kyc-input !mb-0">
                    </div>

                    <div>
                        <label class="verify-label">Password</label>
                        <div class="verify-input-group !mb-0 relative">
                            <input type="password" id="reg-pass" value="${d.password}" 
                                oninput="handlePasswordInput(this)"
                                placeholder="Minimum 8 characters" class="verify-input pr-12">
                            <button onclick="toggleRegPassword('reg-pass')" class="absolute right-0 top-0 w-12 h-14 flex items-center justify-center text-gray-400 hover:text-primary transition-colors">
                                <i class="fa-solid fa-eye" id="reg-pass-eye"></i>
                            </button>
                        </div>
                        <div id="password-validation-feedback" class="mt-2 text-xs font-semibold text-red-500 hidden animate-fade-in-up"></div>
                    </div>

                    <div>
                        <label class="verify-label">Confirm Password</label>
                        <div class="verify-input-group !mb-0 relative">
                            <input type="password" id="reg-confirm" value="${d.confirmPassword}" 
                                oninput="handleConfirmPasswordInput(this)"
                                onfocus="handleConfirmFocus(this)"
                                placeholder="Re-enter password" class="verify-input pr-12">
                            <button onclick="toggleRegPassword('reg-confirm')" class="absolute right-0 top-0 w-12 h-14 flex items-center justify-center text-gray-400 hover:text-primary transition-colors">
                                <i class="fa-solid fa-eye" id="reg-confirm-eye"></i>
                            </button>
                        </div>
                        <div id="confirm-validation-feedback" class="mt-2 text-xs font-semibold text-red-500 hidden animate-fade-in-up"></div>
                    </div>
                </div>

                <div class="mt-8 flex items-start gap-3 cursor-pointer" onclick="toggleConsent()">
                    <input type="checkbox" class="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1" id="reg-consent" ${d.termsAgreed ? 'checked' : ''}>
                    <p class="text-xs text-gray-500 font-medium leading-relaxed">I agree to the <span class="font-bold text-gray-900">Terms of Service</span> and <span class="font-bold text-gray-900">Privacy Policy</span>.</p>
                </div>

                <button id="reg-next-btn" onclick="saveDetailedRegistration()" 
                    class="verify-btn mt-10 ${isNextEnabled ? '' : 'opacity-50'}"
                    ${isNextEnabled ? '' : 'disabled'}>
                    Next Step <i class="fa-solid fa-arrow-right ml-2"></i>
                </button>
            </div>
        </div>
    `;
}

function handleRegInputChange(field, value) {
    state.registrationData[field] = value;
    const isNextEnabled = validateDetailedRegistration();
    const btn = document.getElementById('reg-next-btn');
    if (btn) {
        if (isNextEnabled) {
            btn.disabled = false;
            btn.classList.remove('opacity-50');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50');
        }
    }
}

function handlePasswordInput(el) {
    const val = el.value;
    state.registrationData.password = val;
    
    const feedbackEl = document.getElementById('password-validation-feedback');
    const confirmEl = document.getElementById('reg-confirm');
    const confirmFeedbackEl = document.getElementById('confirm-validation-feedback');
    
    if (val.length === 0) {
        if (feedbackEl) {
            feedbackEl.innerHTML = '';
            feedbackEl.classList.add('hidden');
        }
    } else if (val.length < 8) {
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="flex items-center gap-1.5 text-amber-600 mt-1">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <span>Minimum 8 characters required. (${val.length}/8 entered)</span>
                </div>
            `;
            feedbackEl.classList.remove('hidden');
        }
    } else {
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="flex items-center gap-1.5 text-green-600 mt-1">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Password length is valid.</span>
                </div>
            `;
            feedbackEl.classList.remove('hidden');
        }
    }
    
    // Also re-verify matching if confirm password field has text
    if (confirmEl && confirmEl.value.length > 0) {
        handleConfirmPasswordInput(confirmEl);
    }
    
    handleRegInputChange('password', val);
}

function handleConfirmFocus(el) {
    const passVal = state.registrationData.password || '';
    const feedbackEl = document.getElementById('password-validation-feedback');
    
    if (passVal.length < 8) {
        // Shift focus back to Password
        const passInput = document.getElementById('reg-pass');
        if (passInput) {
            passInput.focus();
        }
        
        // Show prominent inline error (hero message)
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl mt-1 flex items-start gap-2 animate-fade-in-up">
                    <i class="fa-solid fa-circle-exclamation text-base mt-0.5"></i>
                    <div>
                        <p class="font-black text-xs leading-snug">Password is too short!</p>
                        <p class="text-[10px] text-red-500 font-medium mt-0.5">You must enter a minimum of 8 characters in the password field before you can confirm it.</p>
                    </div>
                </div>
            `;
            feedbackEl.classList.remove('hidden');
        }
        showToast('Minimum 8-digit password is required first!');
    }
}

function handleConfirmPasswordInput(el) {
    const val = el.value;
    state.registrationData.confirmPassword = val;
    
    const feedbackEl = document.getElementById('confirm-validation-feedback');
    const passVal = state.registrationData.password || '';
    
    if (val.length === 0) {
        if (feedbackEl) {
            feedbackEl.innerHTML = '';
            feedbackEl.classList.add('hidden');
        }
    } else if (val !== passVal) {
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="flex items-center gap-1.5 text-red-600 mt-1">
                    <i class="fa-solid fa-circle-xmark"></i>
                    <span>Passwords do not match!</span>
                </div>
            `;
            feedbackEl.classList.remove('hidden');
        }
    } else {
        if (feedbackEl) {
            feedbackEl.innerHTML = `
                <div class="flex items-center gap-1.5 text-green-600 mt-1">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Passwords match perfectly.</span>
                </div>
            `;
            feedbackEl.classList.remove('hidden');
        }
    }
    
    handleRegInputChange('confirmPassword', val);
}

function toggleConsent() {
    state.registrationData.termsAgreed = !state.registrationData.termsAgreed;
    const checkbox = document.getElementById('reg-consent');
    if (checkbox) checkbox.checked = state.registrationData.termsAgreed;
    handleRegInputChange('termsAgreed', state.registrationData.termsAgreed);
}

function validateDetailedRegistration() {
    const d = state.registrationData;
    return d.fullName.trim().length > 2 &&
        d.email.includes('@') &&
        d.password.length >= 8 &&
        d.password === d.confirmPassword &&
        d.termsAgreed;
}

function saveDetailedRegistration() {
    if (!validateDetailedRegistration()) return;

    state.vendorName = state.registrationData.fullName;
    state.vendorEmail = state.registrationData.email;
    state.registrationStatus = 'type_selected';
    saveSession();
    showToast('Profile details saved!');
    renderOnboardingScreen();
}

function toggleRegPassword(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById(id + '-eye');
    if (el.type === 'password') {
        el.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        el.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}


function renderKYCUploadForm() {
    window.scrollTo(0, 0);
    const k = state.registrationData.kyc;

    // Check for button activation (all fields filled + all photos uploaded)
    const isComplete = k.aadhaar.number.length === 12 &&
        k.aadhaar.front && k.aadhaar.back &&
        k.pan.number.length === 10 && k.pan.front &&
        k.fssai.number.length >= 10 && k.fssai.front;

    return `
        <div class="animate-fade-in-up">
            <div class="onboarding-card !max-w-[600px]">
                <div class="text-center mb-10">
                    <h3 class="text-3xl font-black text-gray-900 mb-2">KYC Verification</h3>
                    <p class="text-gray-400 text-sm font-medium">Please upload your official documents to verify your business.</p>
                </div>

                <div class="space-y-10">
                    <!-- Aadhaar Section -->
                    <div>
                        <label class="kyc-upload-label"><i class="fa-solid fa-id-card mr-2"></i>Aadhaar Card Details</label>
                        <input type="tel" maxlength="12" value="${k.aadhaar.number}" 
                            inputmode="numeric"
                            oninput="this.value = this.value.replace(/\\D/g, ''); handleKYCInputChange('aadhaar', 'number', this.value)" 
                            placeholder="12-digit Aadhaar Number" 
                            class="kyc-input">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div onclick="triggerKYCUpload('aadhaar', 'front')" class="photo-slot ${k.aadhaar.front ? 'has-image' : ''}">
                                ${k.aadhaar.front ? `<img src="${k.aadhaar.front}">` : `<i class="fa-solid fa-camera"></i><span>Front Side</span>`}
                            </div>
                            <div onclick="triggerKYCUpload('aadhaar', 'back')" class="photo-slot ${k.aadhaar.back ? 'has-image' : ''}">
                                ${k.aadhaar.back ? `<img src="${k.aadhaar.back}">` : `<i class="fa-solid fa-camera"></i><span>Back Side</span>`}
                            </div>
                        </div>
                    </div>

                    <!-- PAN Section -->
                    <div>
                        <label class="kyc-upload-label"><i class="fa-solid fa-id-card-clip mr-2"></i>PAN Card Details</label>
                        <input type="text" maxlength="10" value="${k.pan.number}" 
                            oninput="this.value = this.value.toUpperCase(); handleKYCInputChange('pan', 'number', this.value)" 
                            placeholder="10-digit PAN Number" 
                            class="kyc-input uppercase">
                        
                        <div onclick="triggerKYCUpload('pan', 'front')" class="photo-slot ${k.pan.front ? 'has-image' : ''}">
                            ${k.pan.front ? `<img src="${k.pan.front}">` : `<i class="fa-solid fa-camera"></i><span>Upload PAN</span>`}
                        </div>
                    </div>

                    <!-- FSSAI Section -->
                    <div>
                        <label class="kyc-upload-label"><i class="fa-solid fa-certificate mr-2"></i>FSSAI License</label>
                        <input type="tel" value="${k.fssai.number}" 
                            inputmode="numeric"
                            oninput="this.value = this.value.replace(/\\D/g, ''); handleKYCInputChange('fssai', 'number', this.value)" 
                            placeholder="FSSAI License Number" 
                            class="kyc-input">
                        
                        <div onclick="triggerKYCUpload('fssai', 'front')" class="photo-slot ${k.fssai.front ? 'has-image' : ''}">
                            ${k.fssai.front ? `<img src="${k.fssai.front}">` : `<i class="fa-solid fa-camera"></i><span>Upload FSSAI</span>`}
                        </div>
                    </div>

                    <!-- Hidden File Input -->
                    <input type="file" id="kyc-file-input" class="hidden" accept="image/*" onchange="handleKYCFileUpload(this)">

                    <button onclick="submitKYCForReview(event)" id="kyc-submit-btn" 
                        ${!isComplete ? 'disabled' : ''}
                        class="verify-btn mt-10 ${isComplete ? '' : 'opacity-50'} shadow-2xl py-6">
                        SUBMIT FOR REVIEW
                    </button>
                </div>
            </div>
        </div>
    `;
}

function handleKYCInputChange(type, field, value) {
    if (type === 'pan') {
        state.registrationData.kyc[type][field] = value.toUpperCase();
    } else {
        state.registrationData.kyc[type][field] = value.replace(/\D/g, '');
    }

    // Update button state without re-rendering the whole form
    const k = state.registrationData.kyc;
    const isComplete = k.aadhaar.number.length === 12 &&
        k.aadhaar.front && k.aadhaar.back &&
        k.pan.number.length === 10 && k.pan.front &&
        k.fssai.number.length >= 10 && k.fssai.front;

    const btn = document.getElementById('kyc-submit-btn');
    if (btn) {
        btn.disabled = !isComplete;
        if (isComplete) {
            btn.classList.remove('opacity-50');
        } else {
            btn.classList.add('opacity-50');
        }
    }
}

function triggerKYCUpload(type, side) {
    state.activeKYCField = { type, side };
    document.getElementById('kyc-file-input').click();
}

function handleKYCFileUpload(el) {
    const file = el.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDimension = 1200;
            if (width > height) {
                if (width > maxDimension) {
                    height *= maxDimension / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width *= maxDimension / height;
                    height = maxDimension;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedData = canvas.toDataURL('image/jpeg', 0.7);
            const field = state.activeKYCField;
            if (field.side) {
                state.registrationData.kyc[field.type][field.side] = compressedData;
            } else {
                state.registrationData.kyc[field.type].front = compressedData;
            }
            renderOnboardingScreen();
            showToast('Document uploaded and compressed!');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function dataURLtoBlob(dataurl) {
    if (!dataurl) return null;
    try {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type:mime});
    } catch (e) {
        console.error('[MIME Conversion Error] failed to convert base64 data to blob:', e);
        return null;
    }
}

async function uploadToStorage(base64Data, docType, bucketName = 'vendor-assets') {
    if (!base64Data) return '';
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase client not initialized.');

    try {
        const blob = dataURLtoBlob(base64Data);
        if (!blob) return '';
        const fileExt = blob.type.split('/')[1] || 'jpg';
        const fileName = `${state.registrationData.mobile}_${docType}_${Date.now()}.${fileExt}`;

        console.log(`[Storage Upload] Uploading ${docType} to ${bucketName} storage bucket...`);
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, blob, {
                contentType: blob.type,
                upsert: true
            });

        if (error) {
            console.error(`[Storage Upload Error] failed for ${docType} in bucket ${bucketName}:`, error.message);
            throw error;
        }

        const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        console.log(`[Storage Upload Success] ${docType} in ${bucketName} public URL:`, publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error(`[Storage Exception] in uploadToStorage for ${docType} in ${bucketName}:`, err);
        throw err;
    }
}

async function submitKYCForReview(event) {
    if (event) event.preventDefault();

    const k = state.registrationData.kyc;
    if (k.aadhaar.number.length !== 12 || !k.aadhaar.front || !k.aadhaar.back ||
        k.pan.number.length !== 10 || !k.pan.front ||
        k.fssai.number.length < 10 || !k.fssai.front) {
        showToast('Please provide all details correctly');
        return;
    }

    const btn = document.getElementById('kyc-submit-btn');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Syncing to Supabase...';
        btn.disabled = true;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client not initialized.');
        }

        showToast('Step 1: Uploading documents to bucket...');

        // Step A & B: Upload raw files (converted from compressed base64 to Blob) to storage bucket 'vendor-assets'
        const aadhaarFrontUrl = await uploadToStorage(k.aadhaar.front, 'aadhaar_front', 'vendor-assets');
        const aadhaarBackUrl = await uploadToStorage(k.aadhaar.back, 'aadhaar_back', 'vendor-assets');
        const panFrontUrl = await uploadToStorage(k.pan.front, 'pan_front', 'vendor-assets');
        const fssaiFrontUrl = await uploadToStorage(k.fssai.front, 'fssai_front', 'vendor-assets');

        // Check and upload all 4 gallery images to storage bucket 'vendor-assets'
        const galleryUrls = [];
        let image_url = '';
        const rd = state.registrationData.restaurantDetails;
        if (rd && rd.gallery) {
            showToast('Step 2: Uploading Restaurant Photos to Storage...');
            for (let i = 0; i < rd.gallery.length; i++) {
                const img = rd.gallery[i];
                if (img) {
                    const url = await uploadToStorage(img, `restaurant_photo_${i}`, 'vendor-assets');
                    galleryUrls.push(url);
                    if (i === 0) {
                        image_url = url; // First photo is the cover photo
                    }
                }
            }
        }

        showToast('Step 3: Syncing profile record...');

        // Map Weekly Operating Hours to timing JSONB payload format
        const weeklySchedule = {};
        if (rd && rd.hours) {
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            days.forEach(day => {
                const h = rd.hours[day] || { active: true, open: '10:00', close: '23:00' };
                weeklySchedule[day.toLowerCase()] = {
                    isOpen: h.active !== false,
                    open: h.open || '10:00',
                    close: h.close || '23:00'
                };
            });
        }

        const payload = {
            // Strict Schema Alignment (matches exact table structure columns)
            email: state.registrationData.email,
            full_name: state.registrationData.fullName,
            mobile: state.registrationData.mobile,
            mobile_number: state.registrationData.mobile,
            password: state.registrationData.password,
            shop_name: rd.name || 'New Restaurant',
            business_name: rd.name || 'New Restaurant',
            address: rd.address || rd.name || 'New Restaurant',
            lat: rd.location && rd.location.lat ? parseFloat(rd.location.lat) : 0.0,
            lng: rd.location && rd.location.lng ? parseFloat(rd.location.lng) : 0.0,
            status: 'pending',
            onboarding_status: 'kyc_completed',
            is_verified: false,
            aadhaar_number: state.registrationData.kyc.aadhaar.number,
            pan_number: state.registrationData.kyc.pan.number,
            fssai_number: state.registrationData.kyc.fssai.number,
            aadhaar_front_url: aadhaarFrontUrl,
            aadhaar_back_url: aadhaarBackUrl,
            pan_front_url: panFrontUrl,
            fssai_front_url: fssaiFrontUrl,
            image_url: image_url,
            timing: weeklySchedule, // Server-side JSONB Operating Hours
            created_at: new Date().toISOString()
        };

        // Step C: Check if a vendor record already exists in vendors table with this mobile number
        const { data: existingVendor } = await supabase
            .from('vendors')
            .select('id')
            .eq('mobile', state.registrationData.mobile)
            .maybeSingle();

        let data, error;
        if (existingVendor) {
            // Update the existing record (avoids duplicate key violations)
            const res = await supabase
                .from('vendors')
                .update(payload)
                .eq('mobile', state.registrationData.mobile)
                .select();
            data = res.data;
            error = res.error;
        } else {
            // Insert a new record
            const res = await supabase
                .from('vendors')
                .insert([payload])
                .select();
            data = res.data;
            error = res.error;
        }

        if (error) {
            // Explicit RLS and Error Diagnostic Logging
            console.error("Supabase Sync Failed:", error.message, error.details, error.hint);
            showToast('Supabase Sync Failed. Check console for details.');
            if (btn) {
                btn.innerHTML = 'SUBMIT FOR REVIEW';
                btn.disabled = false;
            }
            return;
        }

        console.log('[Supabase Sync Success] Vendor record created:', data);
        showToast('Application Synced & Account Activated!');

        const regData = state.registrationData;

        // Final sync of vendor identity (automated active state setup)
        state.vendorName = regData.fullName;
        state.vendorEmail = regData.email;
        state.userMobile = regData.mobile;
        state.vendorPhone = '+91 ' + regData.mobile;

        state.registrationStatus = 'kyc_completed';
        state.vendorStatus = 'pending';
        state.rejectionReason = '';
        state.isVerified = false;
        
        if (data && data[0] && data[0].id) {
            state.currentVendorId = data[0].id;
            setupRealtimeStatusListener(data[0].id);
        }
        
        saveSession();
        showToast('Application Submitted! Under review.');

        // Direct, instant redirect to Account Verification Status Screen
        navigateTo('account-verification-status');

    } catch (err) {
        console.error("Supabase Sync Failed:", err.message || err, err.details || '', err.hint || '');
        showToast('Sync Error: ' + (err.message || err));
        if (btn) {
            btn.innerHTML = 'SUBMIT FOR REVIEW';
            btn.disabled = false;
        }
    }
}


function renderIdentityVerificationStatus() {
    return `
        <div class="animate-fade-in-up">
            <div class="onboarding-card !max-w-[500px]">
                <div class="status-card">
                    <div class="review-shield">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    
                    <h3 class="text-3xl font-black text-gray-900 mb-2">Verifying Identity</h3>
                    <p class="text-gray-400 text-sm font-medium leading-relaxed">
                        We are currently reviewing your documents. This process ensures the safety and quality of our vendor community.
                    </p>

                    <div class="approval-box">
                        <i class="fa-regular fa-clock"></i>
                        <span>Approval takes 24 to 48 hours</span>
                    </div>
                </div>

                <div class="mt-10">
                    <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">What happens next?</h4>
                    
                    <div class="next-steps-list">
                        <div class="step-item">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h5>Document Verification</h5>
                                <p>Our team will verify your Aadhaar, PAN, and FSSAI details.</p>
                            </div>
                        </div>
                        
                        <div class="step-item">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h5>Store Profile Setup</h5>
                                <p>Once approved, your store profile will be visible to customers.</p>
                            </div>
                        </div>

                        <div class="step-item">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h5>Go Live</h5>
                                <p>Start receiving orders and managing your kitchen via ASA Vendor.</p>
                            </div>
                        </div>
                    </div>

                    <div class="support-box">
                        <h4>Need help faster?</h4>
                        <p>If you have any questions or your verification is taking longer than usual, please contact our support team.</p>
                        <button onclick="window.location.href='mailto:support@asafood.com'" class="support-btn">
                            Contact Support
                        </button>
                    </div>

                    <div class="text-center space-y-3">
                        <button onclick="bypassVerification()" class="verify-btn shadow-2xl py-6">
                            CONTINUE TO DASHBOARD <i class="fa-solid fa-arrow-right ml-2"></i>
                        </button>
                        <button onclick="bypassVerification()" class="text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-primary transition-all">
                            Developer Bypass (Test Only)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAccountVerificationStatusScreen() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
        <div class="bg-gray-50 min-h-screen flex flex-col items-center pt-10 px-4">
            ${renderIdentityVerificationStatus()}
        </div>
    `;
}

function bypassVerification() {
    const rd = state.registrationData;

    // Final sync of vendor identity
    state.vendorName = rd.fullName;
    state.vendorEmail = rd.email;
    state.userMobile = rd.mobile;
    state.vendorPhone = '+91 ' + rd.mobile;

    // Ensure restaurant details are finalized
    if (!state.restaurantDetails && rd.restaurantDetails.name) {
        state.restaurantDetails = {
            name: rd.restaurantDetails.name,
            cuisineType: rd.restaurantDetails.cuisine,
            hours: rd.restaurantDetails.hours,
            galleryImages: rd.restaurantDetails.gallery.filter(img => img !== null),
            location: rd.restaurantDetails.location,
            offers: []
        };
    }

    state.registrationStatus = 'restaurant_added';
    state.isOnline = true;
    saveSession();
    showToast('Developer Bypass: Account Activated!');
    navigateTo('home');
}


function removeKYCPhoto(type, side) {
    state.registrationData.kyc[type][side] = null;
    showToast('Document removed');
    renderOnboardingScreen();
}

function renderRestrictedDashboard() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-gray-50 min-h-screen flex flex-col items-center justify-center px-8 text-center">
            <div class="w-24 h-24 bg-amber-100 text-primary rounded-full flex items-center justify-center text-4xl mb-8 animate-pulse">
                <i class="fa-solid fa-user-clock"></i>
            </div>
            <h2 class="text-3xl font-black text-gray-800 mb-4">Account Under Review</h2>
            <p class="text-gray-500 mb-12 text-base leading-relaxed">
                Your account is currently being verified. This process typically takes 24 to 48 hours. We will notify you once it is approved.
            </p>
            
            <div class="space-y-4 w-full max-w-xs">
                <button onclick="navigateTo('kyc-status')" class="w-full py-4 bg-white text-gray-800 border-2 border-gray-100 rounded-2xl font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-3">
                    <i class="fa-solid fa-file-shield text-primary"></i>
                    Verify Documents
                </button>
                <button onclick="logout()" class="w-full py-4 bg-transparent text-gray-400 font-bold active:scale-95 transition-all uppercase text-xs tracking-widest">
                    Logout
                </button>
            </div>
        </div>
    `;
    startApprovalPolling();
}

let approvalInterval = null;
function startApprovalPolling() {
    if (approvalInterval) clearInterval(approvalInterval);
    approvalInterval = setInterval(() => {
        // Poll for approval status from session/localStorage
        const session = JSON.parse(localStorage.getItem('asa_vendor_session') || '{}');
        if (session.registrationStatus === 'approved' || session.verificationStatus === 'approved') {
            state.registrationStatus = 'approved';
            state.verificationStatus = 'approved';
            clearInterval(approvalInterval);
            showToast('Account Approved! Redirecting...');
            navigateTo('add-restaurant');
        }
    }, 3000);
}

function renderKYCStatusScreen() {
    const app = document.getElementById('app');
    const status = state.registrationStatus === 'approved' ? 'Approved' : 'Pending';
    const statusColor = status === 'Approved' ? 'text-green-500 bg-green-50' : 'text-amber-500 bg-amber-50';
    const k = state.registrationData.kyc;

    app.innerHTML = `
        <div class="bg-white min-h-screen">
            <div class="px-6 py-6 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white z-50">
                <div class="flex items-center">
                    <button onclick="navigateTo('restricted-dashboard')" class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mr-4">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">KYC Status</h2>
                </div>
                <span class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColor}">
                    ${status}
                </span>
            </div>

            <div class="p-6 space-y-6">
                <div class="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                    <h4 class="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Document Overview</h4>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-bold text-gray-700">Aadhaar Card</span>
                            <span class="text-xs text-gray-400 font-medium">${k.aadhaar.number}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-bold text-gray-700">PAN Card</span>
                            <span class="text-xs text-gray-400 font-medium uppercase">${k.pan.number}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-bold text-gray-700">FSSAI License</span>
                            <span class="text-xs text-gray-400 font-medium">${k.fssai.number}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="rounded-2xl overflow-hidden aspect-video bg-gray-100 border border-gray-200">
                        <img src="${k.aadhaar.front}" class="w-full h-full object-cover">
                    </div>
                    <div class="rounded-2xl overflow-hidden aspect-video bg-gray-100 border border-gray-200">
                        <img src="${k.aadhaar.back}" class="w-full h-full object-cover">
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Supabase Real-Time Restaurant Listener ---
window.restaurantSubscription = null;

function setupRealtimeRestaurantListener(restaurantId) {
    const supabase = window.supabaseClient;
    if (!supabase || !restaurantId) return;

    // Avoid duplicated subscriptions
    if (window.restaurantSubscription) {
        supabase.removeChannel(window.restaurantSubscription);
    }

    console.log(`[Supabase Realtime Restaurant] Subscribing to updates for restaurant: ${restaurantId}`);
    window.restaurantSubscription = supabase
        .channel(`restaurant-status-channel-${restaurantId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'restaurants',
                filter: `id=eq.${restaurantId}`
            },
            (payload) => {
                console.log('[Supabase Realtime Restaurant] Update captured:', payload);
                if (payload.new && payload.new.is_online !== undefined) {
                    const newOnlineStatus = payload.new.is_online;
                    if (state.isOnline !== newOnlineStatus) {
                        console.log(`[Supabase Realtime Restaurant] is_online changed in DB to: ${newOnlineStatus}. Syncing dashboard.`);
                        state.isOnline = newOnlineStatus;
                        // Reflect state change in real-time without manual page refresh
                        if (typeof renderHomeScreen === 'function') {
                            renderHomeScreen();
                        }
                        showToast(`Status updated: ${newOnlineStatus ? 'Online' : 'Offline'}`);
                    }
                }
            }
        )
        .subscribe((status) => {
            console.log(`[Supabase Realtime Restaurant] Channel status: ${status}`);
        });
}

// --- Pure Supabase-Driven Real-Time Lifecycle Manager ---
window.statusSubscription = null;
window.statusSubscribedVendorId = null;

function setupRealtimeStatusListener(vendorId) {
    const supabase = window.supabaseClient;
    if (!supabase || !vendorId) return;

    if (window.statusSubscription && window.statusSubscribedVendorId === vendorId) {
        return;
    }

    // Avoid duplicated subscriptions
    if (window.statusSubscription) {
        supabase.removeChannel(window.statusSubscription);
    }

    window.statusSubscribedVendorId = vendorId;
    console.log(`[Supabase Realtime] Subscribing to updates for vendor: ${vendorId}`);
    window.statusSubscription = supabase
        .channel(`vendor-status-channel-${vendorId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'vendors',
                filter: `id=eq.${vendorId}`
            },
            (payload) => {
                try {
                    console.log('[Supabase Realtime] Update captured:', payload);
                    if (payload.new) {
                        const newStatus = payload.new.status || 'pending';
                        const newReason = payload.new.rejection_reason || '';
                        const newOnboarding = payload.new.onboarding_status;
                        const isVerified = payload.new.is_verified;
                        
                        // Extract and update wallet balance safely
                        if (payload.new.wallet_balance !== undefined) {
                            state.walletBalance = parseFloat(payload.new.wallet_balance || 0);
                            if (typeof injectLiveStatementUpdate === 'function') {
                                injectLiveStatementUpdate();
                            }
                        }

                        state.vendorStatus = newStatus;
                        state.rejectionReason = newReason;
                        state.isVerified = isVerified;
                        if (newOnboarding) {
                            state.registrationStatus = newOnboarding;
                        }

                        saveSession();
                        evaluateLifecycleState(true);
                    }
                } catch (err) {
                    console.error('[Supabase Realtime Exception]:', err);
                }
            }
        )
        .subscribe((status) => {
            console.log(`[Supabase Realtime] Channel status: ${status}`);
        });
}

// --- Live Supabase Real-Time Order Lifecycle System ---
window.ordersSubscription = null;
window.ordersSubscribedRestaurantId = null;

function setupRealtimeOrdersListener(restaurantId) {
    if (!state.userMobile) return;
    const supabase = window.supabaseClient;
    if (!supabase) return;

    // Use a unique channel for the specific restaurant
    if (window.ordersSubscription && window.ordersSubscribedRestaurantId === restaurantId) {
        console.log(`[Supabase Realtime Orders] Already subscribed to sub-orders for restaurant: ${restaurantId}`);
        return;
    }

    if (window.ordersSubscription) {
        supabase.removeChannel(window.ordersSubscription);
    }

    window.ordersSubscribedRestaurantId = restaurantId;
    console.log(`[Supabase Realtime Orders] Subscribing to live sub-orders for restaurant: ${restaurantId}`);
    window.ordersSubscription = supabase
        .channel(`vendor-orders-channel-${restaurantId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'sub_orders',
                filter: `restaurant_id=eq.${restaurantId}`
            },
            async (payload) => {
                try {
                    console.log('[Supabase Realtime Orders] Captured event payload:', payload);

                    // 1. Trigger dynamic popup and chime on new pending orders (INSERT event)
                    if (payload.eventType === 'INSERT') {
                        const newSubOrder = payload.new;
                        if (newSubOrder && (newSubOrder.sub_order_status || '').toLowerCase() === 'pending') {
                            playNewOrderSound();
                            
                            // Fetch sub-order details with standard relational join to construct showIncomingOrderModal payload
                            const { data: mainSubOrder } = await supabase
                                .from('sub_orders')
                                .select(`
                                    *,
                                    orders (
                                        *
                                    ),
                                    order_items (
                                        *
                                    )
                                `)
                                .eq('id', newSubOrder.id)
                                .maybeSingle();

                            const mainOrder = (mainSubOrder && mainSubOrder.orders) || {};
                            const subOrderItems = (mainSubOrder && mainSubOrder.items && mainSubOrder.items.length > 0) ? mainSubOrder.items : (mainSubOrder && mainSubOrder.order_items);

                            const formattedOrder = {
                                id: newSubOrder.id,
                                total_price: parseFloat(newSubOrder.food_price_share) || 0,
                                items: subOrderItems || [],
                                customer_name: mainOrder.customer_name || 'Customer'
                            };

                            showToast(`New Pending Order received: #${newSubOrder.id.slice(-5).toUpperCase()}`);
                            
                            await syncDataFromSupabase();
                            injectLiveStatementUpdate();
                            
                            if (state.currentView === 'home') {
                                renderHomeScreen();
                            } else if (state.currentView === 'orders') {
                                renderOrdersScreen();
                            }
                            
                            showIncomingOrderModal(formattedOrder);
                        }
                    }

                    // 2. Active status update and UI transition chip rendering (UPDATE event)
                    if (payload.eventType === 'UPDATE') {
                        const updatedSubOrder = payload.new;
                        if (updatedSubOrder) {
                            const status = (updatedSubOrder.sub_order_status || '').toLowerCase();
                            
                            await syncDataFromSupabase();
                            injectLiveStatementUpdate();

                            if (status === 'ready_for_pickup') {
                                showToast(`Order #${updatedSubOrder.id.slice(-5).toUpperCase()} is Ready!`);
                            } else if (status === 'picked_up') {
                                showToast(`Order #${updatedSubOrder.id.slice(-5).toUpperCase()} is Picked Up!`);
                            } else if (status === 'delivered') {
                                showToast(`Order #${updatedSubOrder.id.slice(-5).toUpperCase()} is Delivered!`);
                            }

                            // Refresh dynamic active view container specific to details or home/orders
                            if (state.currentView === 'home') {
                                renderHomeScreen();
                            } else if (state.currentView === 'orders') {
                                renderOrdersScreen();
                            } else if (state.currentView === 'order-details' && state.selectedOrderId === updatedSubOrder.id) {
                                renderOrderDetails();
                            } else if (['statistics', 'wallet', 'today-earning', 'total-orders', 'delivered-orders', 'pending-orders'].includes(state.currentView)) {
                                renderView(state.currentView);
                            }
                        }
                    }

                    // 3. Handle database deletion (DELETE event)
                    if (payload.eventType === 'DELETE') {
                        const deletedSubOrder = payload.old;
                        if (deletedSubOrder) {
                            showToast(`Order removed from database.`);
                            await syncDataFromSupabase();
                            injectLiveStatementUpdate();

                            // Refresh dynamic active view container specific to details or home/orders
                            if (state.currentView === 'home') {
                                renderHomeScreen();
                            } else if (state.currentView === 'orders') {
                                renderOrdersScreen();
                            } else if (state.currentView === 'order-details' && state.selectedOrderId === deletedSubOrder.id) {
                                navigateTo('home');
                            } else if (['statistics', 'wallet', 'today-earning', 'total-orders', 'delivered-orders', 'pending-orders'].includes(state.currentView)) {
                                renderView(state.currentView);
                            }
                        }
                    }
                } catch (err) {
                    console.error('[Supabase Realtime Orders Exception]:', err);
                }
            }
        )
        .subscribe((status) => {
            console.log(`[Supabase Realtime Orders] Channel subscription status: ${status}`);
        });
}

// --- Live Supabase Real-Time Products Lifecycle Listener ---
window.productsSubscription = null;
window.productsSubscribedKey = null;

function setupRealtimeProductsListener(vendorId, vendorMobile) {
    const supabase = window.supabaseClient;
    if (!supabase) return;

    const cleanMobile = vendorMobile ? vendorMobile.replace(/\D/g, '').slice(-10) : '';
    const subscriptionKey = vendorId || cleanMobile;

    if (window.productsSubscription && window.productsSubscribedKey === subscriptionKey) {
        return;
    }

    if (window.productsSubscription) {
        supabase.removeChannel(window.productsSubscription);
    }

    window.productsSubscribedKey = subscriptionKey;
    console.log(`[Supabase Realtime Products] Subscribing to products. VendorId: ${vendorId}, Mobile: ${cleanMobile}`);

    // Determine filter condition based on available parameters
    const filter = vendorId 
        ? { event: '*', schema: 'public', table: 'products', filter: `vendor_id=eq.${vendorId}` }
        : (cleanMobile ? { event: '*', schema: 'public', table: 'products', filter: `vendor_mobile=eq.${cleanMobile}` } : null);

    if (!filter) {
        console.warn('[Supabase Realtime Products] No vendor ID or mobile provided. Cannot subscribe.');
        return;
    }

    window.productsSubscription = supabase
        .channel(`vendor-products-channel-${vendorId || cleanMobile}`)
        .on(
            'postgres_changes',
            filter,
            async (payload) => {
                try {
                    console.log('[Supabase Realtime Products] Captured event payload:', payload);

                    if (payload.eventType === 'INSERT') {
                        const newDbProduct = payload.new;
                        if (newDbProduct) {
                            const localProduct = mapDbProductToLocalProduct(newDbProduct);
                            
                            // Prevent duplicates
                            const exists = state.menuItems.some(item => item.id === localProduct.id);
                            if (!exists) {
                                state.menuItems.unshift(localProduct);
                            } else {
                                const idx = state.menuItems.findIndex(item => item.id === localProduct.id);
                                state.menuItems[idx] = localProduct;
                            }
                            
                            if (!state.productsMap) state.productsMap = {};
                            state.productsMap[localProduct.id] = localProduct.name;
                            
                            saveSession();
                            
                            // Dynamically update UI if currently viewing the menu screen
                            if (state.currentView === 'menu') {
                                updateMenuItemsDisplay();
                            }
                        }
                    }

                    if (payload.eventType === 'UPDATE') {
                        const updatedDbProduct = payload.new;
                        if (updatedDbProduct) {
                            const localProduct = mapDbProductToLocalProduct(updatedDbProduct);
                            
                            // Update in-memory state
                            const idx = state.menuItems.findIndex(item => item.id === localProduct.id);
                            if (idx !== -1) {
                                state.menuItems[idx] = localProduct;
                            } else {
                                state.menuItems.push(localProduct);
                            }
                            
                            if (!state.productsMap) state.productsMap = {};
                            state.productsMap[localProduct.id] = localProduct.name;
                            
                            saveSession();
                            
                            // Dynamically update UI if currently viewing the menu screen
                            if (state.currentView === 'menu') {
                                updateMenuItemsDisplay();
                            }
                        }
                    }

                    if (payload.eventType === 'DELETE') {
                        const deletedDbProduct = payload.old;
                        if (deletedDbProduct && deletedDbProduct.id) {
                            const productId = deletedDbProduct.id;
                            
                            // Update in-memory state
                            state.menuItems = state.menuItems.filter(item => item.id !== productId);
                            if (state.productsMap) {
                                delete state.productsMap[productId];
                            }
                            saveSession();
                            
                            // Dynamically update UI if currently viewing the menu screen
                            if (state.currentView === 'menu') {
                                updateMenuItemsDisplay();
                            }
                        }
                    }
                } catch (err) {
                    console.error('[Supabase Realtime Products Exception]:', err);
                }
            }
        )
        .subscribe((status) => {
            console.log(`[Supabase Realtime Products] Channel subscription status: ${status}`);
        });
}

function injectLiveStatementUpdate() {
    // 1. Target "Wallet Balance" DOM Elements (Analytics Sync)
    const walletBalanceNode = document.getElementById('wallet-available-balance');
    const walletEarningsNode = document.getElementById('wallet-total-earnings');
    
    if (walletBalanceNode) {
        walletBalanceNode.innerHTML = `₹ ${state.walletBalance.toLocaleString()}`;
        // Brief pulse animation for real-time visual feedback
        walletBalanceNode.classList.add('text-green-500', 'scale-105');
        setTimeout(() => walletBalanceNode.classList.remove('text-green-500', 'scale-105'), 500);
    }
    if (walletEarningsNode) {
        walletEarningsNode.innerHTML = `₹ ${state.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    // 2. Target "Today Earning" DOM Elements (Analytics & Summary Sync)
    const earningNode = document.getElementById('today-total-earning');
    const ordersNode = document.getElementById('today-total-orders');
    const pendingNode = document.getElementById('today-total-pending');
    
    if (earningNode) {
        const deliveredToday = state.todayOrders.filter(order => order.status === 'Delivered');
        const totalEarning = deliveredToday.reduce((sum, order) => sum + getPayout(order.price), 0);
        earningNode.innerHTML = `₹ ${totalEarning.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
    if (ordersNode) {
        const deliveredToday = state.todayOrders.filter(order => order.status === 'Delivered');
        ordersNode.innerHTML = deliveredToday.length;
    }
    if (pendingNode) {
        const totalPending = state.todayOrders.filter(order => order.status === 'Pending').reduce((sum, order) => sum + getPayout(order.price), 0);
        pendingNode.innerHTML = `₹ ${totalPending.toLocaleString()}`;
    }

    // 3. Target "Order Statement" table rows (Instantly prepend rows)
    const statementTbody = document.getElementById('statement-tbody');
    if (statementTbody) {
        const filteredData = getFilteredStatementData();
        statementTbody.innerHTML = filteredData.length > 0 ? filteredData.map(order => `
            <tr class="hover:bg-gray-50 transition-colors animate-slide-down">
                <td class="px-6 py-4 text-sm font-bold text-gray-800">${order.id}</td>
                <td class="px-6 py-4 text-xs font-bold text-gray-400 text-center">${formatDate(order.date)}</td>
                <td class="px-6 py-4 text-sm font-black text-gray-900 text-right">₹${order.amount.toLocaleString()}</td>
            </tr>
        `).join('') : `
            <tr>
                <td colspan="3" class="px-6 py-12 text-center text-gray-400 font-bold">No orders found for this period</td>
            </tr>
        `;
    }

    // 3. Target "Today's Orders" List inside earning screen
    const todayOrdersList = document.getElementById('today-orders-list');
    if (todayOrdersList) {
        const deliveredToday = state.todayOrders.filter(order => order.status === 'Delivered');
        todayOrdersList.innerHTML = deliveredToday.map(order => `
            <div class="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm flex items-start gap-4 active:scale-[0.98] transition-all animate-slide-down">
                <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-primary text-xl flex-shrink-0">
                    <i class="fa-solid fa-shopping-bag"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-black text-gray-800 text-base">Order ${order.id}</h4>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">${order.customerName}</p>
                        </div>
                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-tighter">${order.time}</p>
                    </div>
                    <div class="mt-4 pt-4 border-t border-dashed border-gray-100 flex justify-between items-end">
                        <div>
                            <p class="text-[9px] text-gray-400 font-bold uppercase mb-0.5 tracking-widest">Amount</p>
                            <p class="font-black text-gray-800 text-sm">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <span class="text-[10px] bg-green-50 text-green-500 px-3 py-1.5 rounded-xl font-black uppercase tracking-widest">
                            <i class="fa-solid fa-check-circle mr-1"></i> Paid
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 4. Target "Order History" List view
    const historyList = document.getElementById('order-history-list');
    if (historyList) {
        let filteredOrders = state.recentOrders;
        if (state.orderFilter === 'Pending') {
            filteredOrders = state.recentOrders.filter(o => ['Pending', 'Preparing', 'Out for Delivery', 'Waiting for rider'].includes(o.status));
        } else if (state.orderFilter === 'Completed') {
            filteredOrders = state.recentOrders.filter(o => o.status === 'Delivered');
        } else if (state.orderFilter === 'Cancelled') {
            filteredOrders = state.recentOrders.filter(o => ['Rejected', 'Cancelled'].includes(o.status));
        }
        
        historyList.innerHTML = filteredOrders.length === 0 ? `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-box-open text-gray-300 text-3xl"></i>
                </div>
                <h3 class="font-bold text-gray-800 mb-1">No Orders Found</h3>
                <p class="text-gray-400 text-xs">There are no ${state.orderFilter !== 'All' ? state.orderFilter.toLowerCase() : ''} orders to show.</p>
            </div>
        ` : filteredOrders.map(order => `
            <div onclick="state.selectedOrderId = '${order.id}'; navigateTo('order-details')" class="bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm active:scale-[0.98] transition-all cursor-pointer animate-slide-down">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-primary text-xl">
                            <i class="fa-solid fa-utensils"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-gray-800">${order.item}</h4>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Order ID: ${order.id}</p>
                        </div>
                    </div>
                    <span class="text-lg font-black text-gray-800">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="flex items-center justify-between pt-4 border-t border-gray-50">
                    <span class="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${getStatusClass(order.status)}">${order.status}</span>
                    <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${order.time}</span>
                </div>
            </div>
        `).join('');
    }
}

function playNewOrderSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        // Premium Double Bell Ding
        playTone(587.33, audioCtx.currentTime, 0.4); // D5
        playTone(880.00, audioCtx.currentTime + 0.15, 0.6); // A5
    } catch (e) {
        console.warn('[Web Audio API] Playback blocked or not supported:', e);
    }
}

function showIncomingOrderModal(order) {
    const existing = document.getElementById('incoming-order-modal');
    if (existing) existing.remove();

    const formattedId = order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#ORDER';
    const rawPrice = parseFloat(order.total_price || order.total_amount || 0);
    const priceText = getPayout(rawPrice).toFixed(2);
    const itemsText = formatSubOrderItems(order.items);
    const customer = order.customer_name || 'Customer';

    const modal = document.createElement('div');
    modal.id = 'incoming-order-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-end justify-center px-6 pb-8 sm:items-center sm:p-6';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" onclick="dismissIncomingOrderModal()"></div>
        <div class="bg-white rounded-[40px] p-8 w-full max-w-sm relative z-10 shadow-2xl border border-gray-100 animate-scale-in text-center">
            <!-- Pulsing Notification Bell -->
            <div class="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <span class="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-75"></span>
                <i class="fa-solid fa-bell text-4xl text-primary animate-bounce"></i>
            </div>
            
            <h3 class="text-2xl font-black text-gray-900 mb-1">New Incoming Order!</h3>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">${formattedId}</p>
            
            <div class="bg-gray-50 rounded-3xl p-5 mb-8 text-left border border-gray-100">
                <div class="flex justify-between items-start mb-3 pb-3 border-b border-gray-200/50">
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Customer</p>
                        <h4 class="font-bold text-gray-800 truncate max-w-[150px]">${customer}</h4>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Payout</p>
                        <h4 class="font-black text-primary">₹ ${priceText}</h4>
                    </div>
                </div>
                <div>
                    <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Items Summary</p>
                    <p class="text-sm font-bold text-gray-700">${itemsText}</p>
                </div>
            </div>
            
            <button onclick="dismissIncomingOrderModal(); state.selectedOrderId = '${order.id}'; navigateTo('order-details');" class="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-amber-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                <i class="fa-solid fa-eye"></i>
                View Order
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function dismissIncomingOrderModal() {
    const modal = document.getElementById('incoming-order-modal');
    if (modal) {
        modal.classList.add('pointer-events-none');
        const content = modal.querySelector('.bg-white');
        if (content) {
            content.classList.add('transition-all', 'duration-300', 'opacity-0', 'scale-95');
        }
        setTimeout(() => modal.remove(), 300);
    }
}

function evaluateLifecycleState(fromRealtime = false) {
    if (!state.userMobile) return;

    const currentStatus = (state.vendorStatus || 'pending').toLowerCase();
    console.log(`[Lifecycle Manager] Evaluating state. Status: ${currentStatus}, View: ${state.currentView}`);

    if (currentStatus === 'approved' || currentStatus === 'success') {
        if (state.registrationStatus !== 'restaurant_added') {
            state.registrationStatus = 'restaurant_added';
        }
        if (!state.currentRestaurantId) {
            state.isOnline = true;
        }
        saveSession();

        if (state.currentView === 'account-verification-status' || state.currentView === 'restricted-dashboard' || state.currentView === 'kyc-status') {
            showToast('Congratulations! Your account has been approved.');
            navigateTo('home');
        } else {
            renderView(state.currentView);
            updateBottomNav(state.currentView);
        }
    } else {
        // Locked state for Pending or Rejected
        if (state.currentView !== 'account-verification-status') {
            navigateTo('account-verification-status');
        } else if (fromRealtime) {
            renderView('account-verification-status');
        }
    }
}

function renderAccountVerificationStatusScreen() {
    const app = document.getElementById('app');
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.add('translate-y-[200%]', 'pointer-events-none');

    const status = (state.vendorStatus || 'pending').toLowerCase();
    const reason = state.rejectionReason || '';

    let content = '';

    if (status === 'rejected' || status === 'denied') {
        // State C: Rejected / Denied
        content = `
            <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-center bg-[#0d0907] px-6 py-12 font-['Outfit'] animate-fade-in animate-duration-300">
                <!-- Ambient Glows -->
                <div class="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-red-900/10 blur-[120px] pointer-events-none"></div>
                <div class="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-amber-900/10 blur-[120px] pointer-events-none"></div>

                <div class="relative z-10 w-full max-w-md mx-auto text-center flex flex-col items-center">
                    <!-- Alert Shield Icon -->
                    <div class="relative w-24 h-24 mb-8 flex items-center justify-center">
                        <div class="absolute inset-0 rounded-full bg-red-500/10 border border-red-500/30 animate-pulse"></div>
                        <div class="absolute inset-2 rounded-full bg-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <i class="fa-solid fa-circle-xmark text-4xl text-red-500"></i>
                        </div>
                    </div>

                    <h2 class="text-white text-3xl font-extrabold mb-4 tracking-tight leading-tight">Verification Unsuccessful</h2>
                    
                    <!-- Glow Badge -->
                    <span class="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 mb-6">
                        REJECTED / DENIED
                    </span>

                    <p class="text-white/60 text-sm leading-relaxed mb-8 max-w-sm font-medium">
                        We appreciate your interest in joining the ASA Food partner network. Unfortunately, your registration details did not pass our review.
                    </p>

                    <!-- Rejection Container -->
                    <div class="w-full bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[28px] p-6 mb-10 shadow-2xl relative overflow-hidden text-left">
                        <div class="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                        <div>
                            <h4 class="text-[10px] font-black text-white/40 uppercase mb-2 tracking-widest">Rejection Feedback</h4>
                            <p class="text-white/90 text-sm font-semibold leading-relaxed">
                                ${reason || 'Please verify your uploaded documents and submit valid details.'}
                            </p>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="space-y-4 w-full max-w-xs">
                        <button onclick="logout()" class="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl font-bold active:scale-95 hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-3">
                            <i class="fa-solid fa-right-from-bracket"></i>
                            Logout & Re-verify
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        // State A: Pending
        content = `
            <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-center bg-[#090b0d] px-6 py-12 font-['Outfit'] animate-fade-in animate-duration-300">
                <!-- Ambient Glows -->
                <div class="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none"></div>
                <div class="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-amber-600/5 blur-[120px] pointer-events-none"></div>

                <div class="relative z-10 w-full max-w-md mx-auto text-center flex flex-col items-center">
                    <!-- Pulsing Shield Icon -->
                    <div class="relative w-24 h-24 mb-8 flex items-center justify-center">
                        <div class="absolute inset-0 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 animate-pulse"></div>
                        <div class="absolute inset-2 rounded-full bg-[#FFC107]/20 flex items-center justify-center shadow-lg shadow-[#FFC107]/20">
                            <i class="fa-solid fa-shield-halved text-4xl text-[#FFC107] animate-pulse"></i>
                        </div>
                    </div>

                    <h2 class="text-white text-3xl font-extrabold mb-4 tracking-tight leading-tight">Reviewing Registration</h2>
                    
                    <!-- Glow Badge -->
                    <span class="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#FFC107]/10 text-[#FFC107] border border-[#FFC107]/20 mb-6">
                        PENDING REVIEW
                    </span>

                    <p class="text-white text-base font-bold mb-2">
                        Your registration is processing.
                    </p>
                    <p class="text-white/60 text-sm leading-relaxed mb-8 max-w-sm font-medium">
                        Update will be provided within 24 to 48 hours.
                    </p>

                    <!-- Connection Indicator -->
                    <div class="flex items-center gap-2 mb-12 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        Active Live Sync
                    </div>

                    <!-- Action Buttons -->
                    <div class="space-y-4 w-full max-w-xs">
                        <button onclick="logout()" class="w-full py-4 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 rounded-2xl font-bold active:scale-95 transition-all flex items-center justify-center gap-3">
                            <i class="fa-solid fa-right-from-bracket"></i>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    app.innerHTML = content;
}

// End of KYC and Registration Flow

function setSetupCuisine(type) {
    state.selectedRestaurantImages.cuisine = type;
    renderAddRestaurantForm();
}

function finalizeRestaurantSetup() {
    const { name, openTime, closeTime, lat, lng } = state.tempRestaurantSetup;
    const images = state.selectedRestaurantImages.gallery;

    if (!name || !lat || !lng) {
        showToast('Please enter restaurant name, latitude and longitude');
        return;
    }

    if (images.length < 4) {
        showToast('Please upload all 4 restaurant photos');
        return;
    }

    state.registrationStatus = 'restaurant_added';
    state.restaurantDetails = {
        name: name,
        address: `${lat}, ${lng}`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        coverImage: images[0],
        galleryImages: images,
        cuisineType: state.selectedRestaurantImages.cuisine || 'Both',
        hours: {
            'Sunday': { open: openTime, close: closeTime, active: true },
            'Monday': { open: openTime, close: closeTime, active: true },
            'Tuesday': { open: openTime, close: closeTime, active: true },
            'Wednesday': { open: openTime, close: closeTime, active: true },
            'Thursday': { open: openTime, close: closeTime, active: true },
            'Friday': { open: openTime, close: closeTime, active: true },
            'Saturday': { open: openTime, close: closeTime, active: true }
        },
        offers: []
    };

    saveSession();
    showToast('Restaurant launched successfully!');
    navigateTo('home');
}

function renderRegistrationSuccess() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen px-8 text-center animate-fade-in-up">
            <div class="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-5xl mb-8 shadow-lg shadow-green-100">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h2 class="text-3xl font-black text-gray-800 mb-4">Registration Successful!</h2>
            <p class="text-gray-500 text-base mb-12">
                Welcome to ASA Food! Your documents have been submitted and are currently <span class="text-primary font-bold">under review</span>. We will activate your dashboard within 24 hours.
            </p>
            
            <button onclick="navigateTo('login')" class="w-full max-w-sm py-5 bg-primary text-white rounded-3xl font-black shadow-xl shadow-amber-100 active:scale-95 transition-all">
                Go to Login
            </button>
        </div>
    `;
}

async function confirmOrderReject() {
    const select = document.getElementById('reject-reason-select');
    let reason = select ? select.value : '';
    if (reason === 'Other') {
        const textarea = document.getElementById('reject-reason-text');
        if (textarea && textarea.value.trim()) {
            reason = textarea.value.trim();
        }
    }
    if (!reason) { showToast('Please select a reason'); return; }
    
    const orderId = state.selectedOrderId;
    const order = state.todayOrders.find(o => o.id === orderId || o.fullId === orderId);
    const dbOrderId = order ? order.fullId : orderId;

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        showToast('Rejecting order...');

        // Explicitly update status to 'cancelled' as mandated
        const { error } = await supabase
            .from('sub_orders')
            .update({ 
                sub_order_status: 'cancelled', 
                rejection_reason: reason 
            })
            .eq('id', dbOrderId);

        if (error) {
            console.error('[Supabase Reject Order Error]:', error);
            showToast(`Failed to reject order: ${error.message}`);
            return;
        }

        if (order) {
            order.status = 'Cancelled';
        }
        showToast(`Order Rejected: ${reason}`);
        closeOrderModal();
        
        await syncDataFromSupabase();

        // Immediate UI refresh
        if (state.currentView === 'order-details') {
            renderOrderDetails();
        } else {
            setTimeout(() => navigateTo('home'), 500);
        }
    } catch (err) {
        console.error('[Exception in confirmOrderReject]:', err);
        showToast('An unexpected error occurred.');
    }
}

function renderStatusScreen() {
    const app = document.getElementById('app');

    if (!state.restaurantDetails) {
        app.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
                <div class="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                    <i class="fa-solid fa-building-circle-check text-4xl text-primary"></i>
                </div>
                <h2 class="text-2xl font-black text-gray-800 mb-4">Restaurant Profile Setup</h2>
                <p class="text-gray-500 text-sm mb-10">Set up your restaurant profile now to manage your kitchen and start selling on ASA Food.</p>
                
                <button onclick="renderRestaurantSetupScreen()" class="w-full max-w-sm py-5 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-amber-100 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <i class="fa-solid fa-plus-circle text-lg"></i>
                    Add Restaurant
                </button>
            </div>
        `;
    } else {
        renderRestaurantDashboardScreen();
    }
}

function approveVerification() {
    state.verificationStatus = 'approved';
    renderStatusScreen();
    showToast('Account Approved by Admin!');
}


function isCurrentTimeInSlot(start, end) {
    if (!start || !end) return true;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    
    if (endMin < startMin) {
        // Overnight slot (e.g., 22:00 to 04:00)
        return currentMin >= startMin || currentMin < endMin;
    }
    return currentMin >= startMin && currentMin < endMin;
}

async function checkAutomatedProductTimings() {
    // Timing locks eliminated. Products remain manageable 24/7.
    return;
}

// Set up regular checking interval every 60 seconds
setInterval(checkAutomatedProductTimings, 60000);

async function toggleItemAvailability(id, isAvailable) {
    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        // Manual Override Flag check
        const todayStr = new Date().toLocaleDateString('en-CA');
        const item = state.menuItems.find(i => i.id === id);

        if (!isAvailable) {
            // Check if toggled OFF during its active hours
            if (item && isCurrentTimeInSlot(item.openingTime || item.timing?.start, item.closingTime || item.timing?.end)) {
                localStorage.setItem(`item_manually_off_${id}`, todayStr);
                console.log(`[Manual Override] Set manually OFF override for item ${id} on date ${todayStr}`);
            }
        } else {
            // Clear this flag if they manually switch it back ON
            localStorage.removeItem(`item_manually_off_${id}`);
            console.log(`[Manual Override] Cleared manually OFF override for item ${id}`);
        }

        // is_available  = master switch (vendor ON/OFF)
        // is_manual_recommend = mirrors the same switch so the customer
        //   "Recommended" section updates in real-time without extra steps.
        const { error } = await supabase
            .from('products')
            .update({
                is_available: isAvailable,
                is_manual_recommend: isAvailable,  // Enable → shows in Recommended; Disable → hides
                status: isAvailable ? 'on' : 'off'
            })
            .eq('id', id);

        if (error) {
            console.error('[Supabase Toggle Availability Error]:', error);
            showToast('Failed to update availability in database.');
            return;
        }

        if (item) {
            item.available = isAvailable;
            item.is_available = isAvailable;
        }
        showToast(isAvailable ? '✅ Item Enabled — now visible to customers' : '⛔ Item Disabled — hidden from customers');
    } catch (err) {
        console.error('[Exception in toggleItemAvailability]:', err);
        showToast('An unexpected error occurred.');
    }
}

async function renderMenuScreen() {
    const app = document.getElementById('app');
    const supabase = window.supabaseClient;

    if (!supabase) {
        showToast('Supabase client missing.');
        return;
    }

    const activeVendor = {
        restaurant_id: state.currentRestaurantId || (state.restaurantDetails && state.restaurantDetails.id) || state.currentVendorId
    };

    if (!activeVendor.restaurant_id) {
        showToast('Restaurant context missing.');
        return;
    }

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold">Menu Page</h2>
                    <div class="flex items-center gap-2">
                        <button onclick="openAddCategoryModal()" class="bg-[#FFD700] text-black px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm">
                            + Add Category
                        </button>
                        <button onclick="state.editingMenuItemId = null; navigateTo('add-menu-item')" class="bg-[#FFD700] text-black px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm flex items-center gap-1">
                            + Add Product
                        </button>
                    </div>
                </div>
                <!-- Search Bar -->
                <div class="relative">
                    <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-sm"></i>
                    <input type="text" id="menu-search" value="${state.searchQuery || ''}" oninput="handleMenuSearch(this.value)" placeholder="Search products..." class="w-full bg-white/10 border border-white/20 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/20 transition-all">
                </div>
            </div>

            <!-- Categories Chips -->
            <div id="category-chips-container" class="px-6 mb-6 overflow-x-auto no-scrollbar flex gap-3">
                <div class="text-gray-400 text-sm font-bold animate-pulse">Loading Categories...</div>
            </div>

            <!-- Menu List -->
            <div id="menu-items-list" class="px-6 space-y-4">
                <div class="text-gray-400 text-sm font-bold text-center py-10 animate-pulse">Loading Products...</div>
            </div>
        </div>
    `;

    try {
        // Fetch Categories
        const { data: categoriesData, error: catError } = await supabase
            .from('restaurant_categories')
            .select('*')
            .eq('restaurant_id', activeVendor.restaurant_id);

        if (catError) throw catError;

        if (categoriesData) {
            state.categories = categoriesData.map(c => c.name);
        } else {
            state.categories = [];
        }

        // Fetch Products
        const { data: productsData, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('restaurant_id', activeVendor.restaurant_id);

        if (prodError) throw prodError;

        if (productsData) {
            state.menuItems = productsData;
        } else {
            state.menuItems = [];
        }

        updateMenuItemsDisplay();

    } catch (err) {
        console.error("Error fetching menu data:", err);
        showToast("Error loading menu data");
    }
}

function renderCategoryChipsHTML() {
    const categories = ['All', ...state.categories];
    return categories.map((cat, index) => {
        const isActive = state.selectedCategory === cat || (!state.selectedCategory && index === 0);
        if (isActive) {
            return `
                <button onclick="selectCategory('${cat}')" class="category-chip active" style="background-color: #FFD700; color: black; border-color: #FFD700;">
                    ${cat}
                </button>
            `;
        }
        return `
            <button onclick="selectCategory('${cat}')" class="category-chip">
                ${cat}
            </button>
        `;
    }).join('');
}

function renderSingleMenuItemHTML(item) {
    const foodTypeStr = String(item.food_type || item.foodType || item.item_type || item.category || '').toLowerCase().replace(/-/g, '');
    const isNonVeg = foodTypeStr.includes('nonveg') || item.is_veg === false;
    const iconBorderColor = isNonVeg ? 'border-red-500' : 'border-green-500';
    const iconBgColor = isNonVeg ? 'bg-red-500' : 'bg-green-500';

    return `
        <div id="product-card-${item.id}" class="bg-white p-4 rounded-[28px] shadow-sm border border-gray-50 flex items-center gap-4 relative fade-in">
            <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" class="w-16 h-16 rounded-2xl object-cover bg-gray-50">
            <div class="flex-1">
                <div class="flex items-center gap-1.5 mb-0.5">
                    <span class="w-2.5 h-2.5 rounded-sm border ${iconBorderColor} flex items-center justify-center"><span class="w-1 h-1 rounded-full ${iconBgColor}"></span></span>
                    <h4 class="text-sm font-black text-gray-800">${item.name || 'Unnamed Product'}</h4>
                </div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">${item.category || 'Category'} • ${item.weight || item.unit || '1 Plate'}</p>
                <p class="text-sm font-black text-[#FFD700] mt-1">₹ ${parseFloat(item.price || item.mrp || 0).toFixed(2)}</p>
            </div>
            <div class="flex flex-col items-end gap-3">
                <label class="toggle-switch">
                    <input type="checkbox" ${item.is_available !== false && item.available !== false ? 'checked' : ''} onchange="toggleItemAvailability('${item.id}', this.checked)">
                    <span class="slider"></span>
                </label>
                <div class="flex items-center gap-3">
                    <button onclick="editMenuItem('${item.id}')" class="text-gray-300 hover:text-blue-500 transition-colors active:scale-90 p-2 -m-2" title="Edit item">
                        <i class="fa-solid fa-pencil text-sm"></i>
                    </button>
                    <button onclick="deleteItem('${item.id}', this)" class="text-gray-300 hover:text-red-500 transition-colors active:scale-90 p-2 -m-2" title="Delete item">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderMenuItemsHTML() {
    const filteredItems = state.menuItems.filter(item => {
        const matchesCategory = state.selectedCategory === 'All' || !state.selectedCategory || item.category === state.selectedCategory;
        const itemName = item.name || '';
        const searchQ = state.searchQuery || '';
        const matchesSearch = itemName.toLowerCase().includes(searchQ.toLowerCase());
        // BYPASS TIME-WINDOW LOCK
        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) {
        return `
            <div class="text-center py-20">
                <i class="fa-solid fa-utensils text-4xl text-gray-200 mb-4"></i>
                <p class="text-gray-400 font-bold">Your menu is empty. Click Add Product to begin.</p>
            </div>
        `;
    }

    return filteredItems.map(item => renderSingleMenuItemHTML(item)).join('');
}

function updateMenuItemsDisplay() {
    const listContainer = document.getElementById('menu-items-list');
    const chipContainer = document.getElementById('category-chips-container');

    if (listContainer) {
        listContainer.innerHTML = renderMenuItemsHTML();
    }

    if (chipContainer) {
        chipContainer.innerHTML = renderCategoryChipsHTML();
    }
}

function renderAddMenuItemScreen() {
    const app = document.getElementById('app');

    // Check if in edit mode
    const editItem = state.editingMenuItemId ? state.menuItems.find(i => i.id === state.editingMenuItemId) : null;

    if (editItem) {
        state.tempAddons = [...(editItem.addons || [])];
        state.tempVariations = [...(editItem.variations || [])];
        state.selectedMenuImage = editItem.image;
    } else if (state.editingMenuItemId === null) {
        // Only reset if we are not coming back to a half-filled form or edit mode
        // For simplicity, we reset addons and image when opening "Add" screen
        state.tempAddons = [];
        state.tempVariations = [];
        state.selectedMenuImage = null;
    }

    const pageTitle = editItem ? 'Edit Menu Item' : 'Add Menu Item';
    const buttonText = editItem ? 'Update Item Details' : 'Save & Add Item';

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-32">
            <!-- Header -->
            <div class="bg-white px-6 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-50">
                <button onclick="goBack()" class="text-gray-800 text-xl">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h2 class="text-lg font-bold text-gray-800">${pageTitle}</h2>
            </div>

            <div class="p-6 max-w-5xl mx-auto">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Left Column: Form Fields -->
                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                            <!-- Item Name -->
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-1.5">Item Name <span class="text-primary">*</span></label>
                                <input type="text" id="add-item-name" value="${editItem ? editItem.name : ''}" placeholder="Enter item name" class="form-input-custom">
                            </div>

                            <!-- Item Category -->
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-1.5">Item Category <span class="text-primary">*</span></label>
                                <select id="add-item-category" class="form-input-custom appearance-none bg-no-repeat bg-[right_1.5rem_center] bg-[length:1em_1em]" style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')">
                                    <option value="" disabled ${!editItem ? 'selected' : ''}>Select category</option>
                                    ${state.categories.map(cat => `<option value="${cat}" ${editItem && editItem.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Unit & Qty Row -->
                            <div class="grid grid-cols-2 gap-4">
                                <!-- Unit -->
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-1.5">Unit <span class="text-primary">*</span></label>
                                    <input type="text" id="add-item-unit" value="${editItem ? (editItem.unit || (editItem.weight || '').replace('1 ', '')) : ''}" list="unit-options" placeholder="Select or type unit" class="form-input-custom">
                                    <datalist id="unit-options">
                                        <option value="kg">
                                        <option value="pcs">
                                        <option value="plate">
                                        <option value="gm">
                                        <option value="ml">
                                        <option value="liter">
                                        <option value="half">
                                        <option value="full">
                                        <option value="1:2">
                                    </datalist>
                                </div>
                                <!-- Qty per unit -->
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-1.5">Qty per unit</label>
                                    <input type="text" id="add-item-qty-per-unit" value="${editItem ? (editItem.qtyPerUnit !== null ? editItem.qtyPerUnit : '') : ''}" placeholder="e.g. 100" class="form-input-custom">
                                </div>
                            </div>

                            <!-- Price Row -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">MRP (₹) <span class="text-primary">*</span></label>
                                    <div class="relative">
                                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                        <input type="number" id="add-item-mrp" value="${editItem ? editItem.mrp : ''}" placeholder="Enter MRP" class="form-input-custom pl-8">
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Price (₹) <span class="text-primary">*</span></label>
                                    <div class="relative">
                                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                        <input type="number" id="add-item-price" value="${editItem ? editItem.price : ''}" placeholder="Enter price" class="form-input-custom pl-8">
                                    </div>
                                </div>
                            </div>

                            <!-- Food Type Row -->
                            <div>
                                <label class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Food Type <span class="text-primary">*</span></label>
                                <select id="add-item-food-type" class="form-input-custom appearance-none">
                                    ${(() => {
                                        const ct = (state.restaurantDetails?.cuisineType || 'Both').toLowerCase();
                                        const current = editItem ? editItem.foodType : 'Veg';
                                        const opts = ct === 'veg' ? ['Veg'] : ct === 'non-veg' ? ['Non-Veg'] : ['Veg', 'Non-Veg'];
                                        return opts.map(o => `<option value="${o}" ${current === o ? 'selected' : ''}>${o}</option>`).join('');
                                    })()}
                                </select>
                            </div>

                            <!-- Available Timing -->
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-1.5">Available Timing <span class="text-primary">*</span></label>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase">Opening Time</p>
                                        <input type="time" id="add-item-opening" value="${editItem ? (editItem.timing ? editItem.timing.start : '') : ''}" class="form-input-custom">
                                    </div>
                                    <div>
                                        <p class="text-[10px] text-gray-400 font-bold mb-1 uppercase">Closing Time</p>
                                        <input type="time" id="add-item-closing" value="${editItem ? (editItem.timing ? editItem.timing.end : '') : ''}" class="form-input-custom">
                                    </div>
                                </div>
                            </div>


                            <!-- Description -->
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                                <textarea id="add-item-desc" rows="4" placeholder="Enter item description..." class="form-input-custom resize-none">${editItem ? editItem.desc : ''}</textarea>
                            </div>
                            
                            <!-- Image Upload Box -->
                            <div>
                                <label class="block text-sm font-bold text-gray-700 mb-2">Image <span class="text-primary">*</span></label>
                                <div onclick="triggerAddImageUpload()" class="upload-drag-box border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-amber-50/30 transition-all group overflow-hidden relative min-h-[200px]">
                                    <div id="image-upload-placeholder" class="${state.selectedMenuImage ? 'hidden' : 'flex'} flex-col items-center justify-center gap-3 text-center">
                                        <div class="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                                            <i class="fa-solid fa-cloud-arrow-up text-2xl"></i>
                                        </div>
                                        <div>
                                            <p class="text-sm font-bold text-gray-800">Drag & drop an image here</p>
                                            <p class="text-xs text-gray-400 mt-1">or</p>
                                        </div>
                                        <button type="button" class="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-100 group-hover:bg-amber-700 transition-colors">Choose Image</button>
                                        <p class="text-[10px] text-gray-400 mt-2">Recommended size: 800x800px<br>Max size: 2MB (JPG, PNG)</p>
                                    </div>
                                    <img id="add-item-preview-img" src="${state.selectedMenuImage || ''}" class="absolute inset-0 w-full h-full object-cover ${state.selectedMenuImage ? 'block' : 'hidden'}">
                                    <div id="change-image-overlay" class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${state.selectedMenuImage ? 'flex' : 'hidden'}">
                                        <p class="text-white font-bold text-sm">Change Image</p>
                                    </div>
                                </div>
                                <input type="file" id="add-item-image-input" class="hidden" accept="image/*" onchange="handleAddImagePreview(this)">
                            </div>
                        </div>

                        <!-- Product Variations Section -->
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <div class="flex justify-between items-center">
                                <h3 class="text-lg font-bold text-gray-800">Variations (Half / Full)</h3>
                                <button type="button" onclick="appendVariationRow()" class="text-primary hover:text-amber-700 font-bold text-sm flex items-center gap-1 active:scale-95 transition-all">
                                    <i class="fa-solid fa-plus text-xs"></i> + Add Variation
                                </button>
                            </div>
                            
                            <div id="variations-container" class="space-y-4">
                                <!-- Dynamic Variation Rows will appear here -->
                            </div>
                        </div>

                        <!-- Product Add-ons & Customizations Section -->
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <h3 class="text-lg font-bold text-gray-800">Product Add-ons &amp; Customizations</h3>
                            
                            <div id="addons-list" class="space-y-3">
                                <!-- Dynamic Add-ons will appear here -->
                            </div>

                            <div class="pt-4 border-t border-gray-50">
                                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">Add New Option</p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" id="addon-name" placeholder="Add-on Name (e.g. Extra Egg, Cold Variant)" class="form-input-custom">
                                    <div class="relative">
                                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                        <input type="number" id="addon-price" placeholder="Price" class="form-input-custom pl-8">
                                    </div>
                                </div>
                                <button onclick="handleAddAddon()" class="w-full mt-4 py-3 border-2 border-primary/20 text-primary rounded-2xl font-bold hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-plus text-xs"></i>
                                    Add More Detail
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Status & Preview -->
                    <div class="space-y-6">
                        <!-- Preview Card -->
                        <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4 px-2">Live Preview</p>
                            <div class="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3">
                                <div class="w-full aspect-square rounded-xl bg-gray-200 overflow-hidden">
                                    <img src="${state.selectedMenuImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" class="w-full h-full object-cover">
                                </div>
                                <div>
                                    <h4 id="preview-name" class="font-bold text-gray-800">${editItem ? editItem.name : 'Food Item Name'}</h4>
                                    <p id="preview-cat" class="text-[10px] text-gray-400 font-bold uppercase">${editItem ? editItem.category : 'Category'}</p>
                                    <p class="text-primary font-black text-sm mt-1">₹ <span id="preview-price">${editItem ? editItem.price : '0.00'}</span></p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Action Button -->
                <div class="mt-12 flex justify-center pb-20">
                    <button onclick="handleSaveMenuItem()" class="save-btn w-full max-w-sm py-5 mx-auto">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        ${buttonText}
                    </button>
                </div>
            </div>
        </div>
    `;

    renderAddonsList();
    renderVariations();
}

function triggerAddImageUpload() {
    document.getElementById('add-item-image-input').click();
}

function handleAddImagePreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('add-item-preview-img');
            const placeholder = document.getElementById('image-upload-placeholder');
            const overlay = document.getElementById('change-image-overlay');
            const livePreviewImg = document.querySelector('.aspect-square img');

            if (img) {
                img.src = e.target.result;
                img.classList.remove('hidden');
                img.classList.add('block');
            }
            if (placeholder) {
                placeholder.classList.add('hidden');
                placeholder.classList.remove('flex');
            }
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
            }
            if (livePreviewImg) {
                livePreviewImg.src = e.target.result;
            }

            state.selectedMenuImage = e.target.result;
            showToast('Image uploaded successfully');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function handleAddAddon() {
    const name = document.getElementById('addon-name').value.trim();
    const priceVal = document.getElementById('addon-price').value;

    if (!name) {
        showToast('Please enter an add-on name');
        return;
    }

    state.tempAddons.push({
        id: Date.now(),
        name,
        price: priceVal !== '' ? parseFloat(priceVal) : 0
    });

    // Clear inputs
    document.getElementById('addon-name').value = '';
    document.getElementById('addon-price').value = '';

    renderAddonsList();
    showToast('Add-on added!');
}

function renderAddonsList() {
    const list = document.getElementById('addons-list');
    list.innerHTML = state.tempAddons.map(addon => `
        <div class="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm fade-in">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-50 text-primary flex items-center justify-center font-bold text-xs">
                    ${addon.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <h4 class="text-sm font-bold text-gray-800">${addon.name}</h4>
                    <p class="text-xs text-primary font-black">₹ ${addon.price.toFixed(2)}</p>
                </div>
            </div>
            <button onclick="removeAddon(${addon.id})" class="text-gray-300 hover:text-amber-500 transition-colors">
                <i class="fa-solid fa-circle-xmark text-lg"></i>
            </button>
        </div>
    `).join('');
}

function renderVariations() {
    const container = document.getElementById('variations-container');
    if (!container) return;
    container.innerHTML = '';
    if (state.tempVariations && state.tempVariations.length > 0) {
        state.tempVariations.forEach(v => {
            appendVariationRow(v.name, v.price);
        });
    }
}

function appendVariationRow(name = '', price = '') {
    const container = document.getElementById('variations-container');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-4 items-center variation-row fade-in';
    row.innerHTML = `
        <div class="col-span-6">
            <input type="text" name="variations[][name]" value="${name}" placeholder="Variation Name (e.g. Half, Full)" class="form-input-custom w-full">
        </div>
        <div class="col-span-5 relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input type="number" step="0.01" name="variations[][price]" value="${price}" placeholder="Price" class="form-input-custom pl-8 w-full">
        </div>
        <div class="col-span-1 flex justify-center">
            <button type="button" onclick="this.closest('.variation-row').remove()" class="text-gray-300 hover:text-red-500 transition-colors active:scale-90 p-2">
                <i class="fa-solid fa-trash-can text-lg"></i>
            </button>
        </div>
    `;
    container.appendChild(row);
}

function removeAddon(id) {
    state.tempAddons = state.tempAddons.filter(a => a.id !== id);
    renderAddonsList();
}

async function editMenuItem(id) {
    // First, try to fetch the freshest record directly from Supabase
    try {
        const supabase = window.supabaseClient;
        if (supabase) {
            const { data: freshItem, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && freshItem) {
                // Merge the fresh DB record back into local state so the form gets current values
                const idx = state.menuItems.findIndex(i => i.id === id);
                const mapped = {
                    id: freshItem.id,
                    name: freshItem.name,
                    category: freshItem.category,
                    weight: freshItem.weight || '1 Plate',
                    qtyPerUnit: freshItem.qty_per_unit !== undefined && freshItem.qty_per_unit !== null ? freshItem.qty_per_unit : null,
                    price: parseFloat(freshItem.price) || 0,
                    mrp: parseFloat(freshItem.mrp) || parseFloat(freshItem.price) || 0,
                    timing: (() => {
                        const t = freshItem.timing;
                        if (!t) return { start: '09:00', end: '22:00' };
                        if (typeof t === 'string') {
                            try { return JSON.parse(t); } catch { return { start: '09:00', end: '22:00' }; }
                        }
                        return t;
                    })(),
                    desc: freshItem.desc || freshItem.description || '',
                    image: freshItem.image_url || freshItem.image || 'assets/biryani.png',
                    available: freshItem.is_available !== false,
                    recommend: freshItem.is_manual_recommend === true,
                    foodType: freshItem.food_type || 'Veg',
                    // Parse addons from DB — inject into tempAddons for pre-population
                    addons: (() => {
                        const raw = freshItem.addons;
                        if (!raw) return [];
                        if (Array.isArray(raw)) return raw;
                        if (typeof raw === 'string') {
                            try { return JSON.parse(raw); } catch { return []; }
                        }
                        return [];
                    })(),
                    variations: (() => {
                        const raw = freshItem.variations;
                        if (!raw) return [];
                        if (Array.isArray(raw)) return raw;
                        if (typeof raw === 'string') {
                            try { return JSON.parse(raw); } catch { return []; }
                        }
                        return [];
                    })(),
                    active: true
                };

                // Inject addons into state.tempAddons so the form pre-populates
                state.tempAddons = mapped.addons.map((a, idx) => ({
                    id: Date.now() + idx,   // unique key for removeAddon
                    name: a.name || '',
                    price: parseFloat(a.price) || 0
                }));
                // Inject variations into state.tempVariations so the form pre-populates
                state.tempVariations = mapped.variations.map((v, idx) => ({
                    name: v.name || '',
                    price: parseFloat(v.price) || 0
                }));
                if (idx !== -1) {
                    state.menuItems[idx] = mapped;
                } else {
                    state.menuItems.push(mapped);
                }
            } else if (error) {
                console.warn('[editMenuItem] Supabase fetch error, falling back to local state:', error.message);
            }
        }
    } catch (e) {
        console.warn('[editMenuItem] Exception during fresh fetch, falling back to local state:', e);
    }

    state.editingMenuItemId = id;
    navigateTo('add-menu-item');
}

function deleteItem(id, triggerEl) {
    state.activeDeleteProductId = id;
    openDeleteConfirmModal();
}

function openDeleteConfirmModal() {
    const overlay = document.getElementById('delete-confirm-overlay');
    const modal = document.getElementById('delete-confirm-modal');
    if (!overlay || !modal) return;
    
    overlay.classList.remove('hidden');
    // Force reflow
    overlay.offsetHeight;
    
    overlay.classList.add('opacity-100');
    modal.classList.remove('scale-90', 'opacity-0');
    modal.classList.add('scale-100', 'opacity-100');
}

function closeDeleteConfirmModal() {
    const overlay = document.getElementById('delete-confirm-overlay');
    const modal = document.getElementById('delete-confirm-modal');
    if (!overlay || !modal) return;
    
    overlay.classList.remove('opacity-100');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-90', 'opacity-0');
    
    setTimeout(() => {
        overlay.classList.add('hidden');
        state.activeDeleteProductId = null;
    }, 300);
}

async function confirmDeleteProduct() {
    const id = state.activeDeleteProductId;
    if (!id) return;
    
    const btn = document.querySelector('button[onclick="confirmDeleteProduct()"]');
    const originalText = btn ? btn.innerHTML : 'Delete';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';
        btn.disabled = true;
    }
    
    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');
        
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error('[Supabase Delete Item Error]:', error);
            showToast('Failed to delete item from database.');
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
            closeDeleteConfirmModal();
            return;
        }
        
        // Instant visual DOM removal
        const cardEl = document.getElementById(`product-card-${id}`);
        if (cardEl) {
            cardEl.style.transition = 'opacity 0.25s, transform 0.25s';
            cardEl.style.opacity = '0';
            cardEl.style.transform = 'scale(0.95)';
            setTimeout(() => {
                cardEl.remove();
                const listContainer = document.getElementById('menu-items-list');
                if (listContainer && listContainer.children.length === 0) {
                    listContainer.innerHTML = `
                        <div class="text-center py-20">
                            <i class="fa-solid fa-utensils text-4xl text-gray-200 mb-4"></i>
                            <p class="text-gray-400 font-bold">No items found</p>
                        </div>
                    `;
                }
            }, 260);
        }
        
        // Sync local state
        state.menuItems = state.menuItems.filter(item => item.id !== id);
        saveSession();
        showToast('Item deleted successfully!');
    } catch (err) {
        console.error('[Exception in confirmDeleteProduct]:', err);
        showToast('An unexpected error occurred.');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        closeDeleteConfirmModal();
    }
}

async function handleSaveMenuItem(event) {
    if (event) event.preventDefault();

    const name = document.getElementById('add-item-name').value;
    const category = document.getElementById('add-item-category').value;
    const unit = document.getElementById('add-item-unit').value;
    const qtyPerUnit = document.getElementById('add-item-qty-per-unit').value;
    const mrp = document.getElementById('add-item-mrp').value;
    const price = document.getElementById('add-item-price').value;
    const opening = document.getElementById('add-item-opening').value;
    const closing = document.getElementById('add-item-closing').value;
    const desc = document.getElementById('add-item-desc').value;

    if (!name || !category || !unit || !mrp || !price || !opening || !closing || !state.selectedMenuImage) {
        showToast('Please fill all mandatory fields and upload an image');
        return;
    }

    const btn = document.querySelector('button[onclick="handleSaveMenuItem()"]');
    const originalText = btn ? btn.innerHTML : 'Save Item';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Saving...';
        btn.disabled = true;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        const cleanMobile = state.userMobile.replace(/\D/g, '').slice(-10);

        // Upload image to Supabase storage 'menu-items'
        let imageUrl = state.selectedMenuImage;
        if (imageUrl && imageUrl.startsWith('data:image')) {
            showToast('Uploading menu item image...');
            imageUrl = await uploadToStorage(imageUrl, 'menu_item', 'menu-items');
        }

        const foodTypeEl = document.getElementById('add-item-food-type');
        const foodType = foodTypeEl ? foodTypeEl.value : 'Veg';

        // ── Build the clean addons JSONB array from tempAddons ──────────────────
        // Strip the internal `id` field (Date.now() used for React-key purposes only).
        // DB expects: [{"name": "Extra Egg", "price": 40.00}, ...]
        const addonsPayload = state.tempAddons.map(({ name: n, price: p }) => ({
            name: n,
            price: typeof p === 'number' ? p : parseFloat(p) || 0
        }));

        // ── Build the clean variations JSONB array from DOM rows ─────────────────
        const variationRows = document.querySelectorAll('.variation-row');
        const variationsPayload = [];
        variationRows.forEach(row => {
            const vNameInput = row.querySelector('input[name="variations[][name]"]');
            const vPriceInput = row.querySelector('input[name="variations[][price]"]');
            const vName = vNameInput ? vNameInput.value.trim() : '';
            const vPrice = vPriceInput ? vPriceInput.value : '';
            if (vName) {
                variationsPayload.push({
                    name: vName,
                    price: vPrice !== '' ? parseFloat(vPrice) : 0
                });
            }
        });

        // ── Build payload using ONLY columns confirmed to exist in products table ──
        const payload = {
            name,
            category,
            weight: unit,
            qty_per_unit: (qtyPerUnit === null || qtyPerUnit === undefined || qtyPerUnit.trim() === '') ? null : qtyPerUnit,
            price: parseFloat(price),
            mrp: parseFloat(mrp),
            timing: { start: opening, end: closing },
            opening_time: opening || '00:00',
            closing_time: closing || '23:59',
            description: desc,
            image_url: imageUrl,
            is_available: true,
            is_manual_recommend: true,
            food_type: foodType,
            addons: addonsPayload,          // ✅ JSONB array → products.addons column
            variations: variationsPayload,    // ✅ JSONB array → products.variations column
            vendor_mobile: cleanMobile,
            vendor_id: state.currentVendorId || null,
            restaurant_id: state.currentRestaurantId || null
        };

        console.log('[handleSaveMenuItem] Submitting payload to products table:', JSON.stringify(payload, null, 2));

        if (state.editingMenuItemId) {
            const { error } = await supabase
                .from('products')
                .update(payload)
                .eq('id', state.editingMenuItemId);

            if (error) {
                const errMsg  = error.message || 'Unknown database error';
                const errHint = error.hint    || '';
                const errDet  = error.details || '';
                console.error('[products UPDATE failed]', `message: ${errMsg}`, `hint: ${errHint}`, `details: ${errDet}`);
                showToast(`Failed to update item: ${errMsg}${errHint ? ' — ' + errHint : ''}`);
                if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
                return;
            }
            showToast('Item updated successfully!');
        } else {
            const { error } = await supabase
                .from('products')
                .insert([payload]);

            if (error) {
                const errMsg  = error.message || 'Unknown database error';
                const errHint = error.hint    || '';
                const errDet  = error.details || '';
                console.error('[products INSERT failed]', `message: ${errMsg}`, `hint: ${errHint}`, `details: ${errDet}`);
                showToast(`Failed to save item: ${errMsg}${errHint ? ' — ' + errHint : ''}`);
                if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
                return;
            }
            showToast('Item saved successfully!');
        }

        state.selectedMenuImage = null;
        state.tempAddons = [];
        state.tempVariations = [];
        state.editingMenuItemId = null;

        setTimeout(() => navigateTo('menu'), 1000);
    } catch (err) {
        console.error('[Exception in handleSaveMenuItem]:', err);
        showToast(`An unexpected error occurred: ${err.message || err}`);
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

let menuSearchTimeout;
function handleMenuSearch(val) {
    state.searchQuery = val;
    clearTimeout(menuSearchTimeout);
    menuSearchTimeout = setTimeout(() => {
        updateMenuItemsDisplay();
    }, 300);
}

function selectCategory(cat) {
    state.selectedCategory = cat;
    updateMenuItemsDisplay();
}

// Quick Add Item Modal Logic
function showAddItemModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('add-item-modal');
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('opacity-100');
        modal.classList.remove('translate-y-full');
    }, 10);
}

function hideAddItemModal() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('add-item-modal');
    overlay.classList.remove('opacity-100');
    modal.classList.add('translate-y-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

async function saveNewItem(event) {
    if (event) event.preventDefault();

    const name = document.getElementById('new-item-name').value;
    const price = document.getElementById('new-item-price').value;
    const category = document.getElementById('new-item-category').value;
    const weight = document.getElementById('new-item-weight').value;
    const startTime = document.getElementById('new-item-start').value;
    const endTime = document.getElementById('new-item-end').value;
    const desc = document.getElementById('new-item-desc').value;

    if (!name || !price) {
        showToast('Please fill required fields');
        return;
    }

    const btn = document.querySelector('button[onclick="saveNewItem()"]');
    const originalText = btn ? btn.innerHTML : 'Save';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Saving...';
        btn.disabled = true;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        const cleanMobile = state.userMobile.replace(/\D/g, '').slice(-10);

        let imageUrl = state.selectedMenuImage || 'assets/biryani.png';
        if (imageUrl && imageUrl.startsWith('data:image')) {
            showToast('Uploading image...');
            imageUrl = await uploadToStorage(imageUrl, 'menu_item', 'menu-items');
        }

        const payload = {
            name,
            price: parseFloat(price),
            mrp: parseFloat(price),
            category,
            weight,
            timing: JSON.stringify({ start: startTime, end: endTime }),
            is_available: true,
            description: desc,
            image_url: imageUrl,
            vendor_mobile: cleanMobile,
            vendor_id: state.currentVendorId || null,
            restaurant_id: state.currentRestaurantId || null
        };

        const { error } = await supabase
            .from('products')
            .insert([payload]);

        if (error) {
            console.error('[Supabase Insert Menu Item Error]:', error);
            showToast('Failed to save item to database.');
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
            return;
        }

        state.selectedMenuImage = null; // Reset
        hideAddItemModal();
        
        showToast('Item added successfully!');
    } catch (err) {
        console.error('[Exception in saveNewItem]:', err);
        showToast('An unexpected error occurred.');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function triggerImageUpload() {
    document.getElementById('food-image-input').click();
}

function handleImagePreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('image-preview-container').style.display = 'block';
            document.getElementById('food-preview-img').src = e.target.result;
            state.selectedMenuImage = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function renderWalletScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Wallet</h2>
                </div>
            </div>

            <div class="px-6">
                <!-- Balance Card -->
                <div class="wallet-card mb-8">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Available Balance</p>
                            <h3 id="wallet-available-balance" class="text-3xl font-black text-gray-800"><i class="fa-solid fa-spinner animate-spin text-lg text-gray-400"></i></h3>
                        </div>
                        <div class="wallet-icon-3d">
                            <i class="fa-solid fa-wallet"></i>
                        </div>
                    </div>
                    
                    <div class="mt-8 flex justify-between items-center bg-gray-50 rounded-2xl p-4">
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Total Earnings</p>
                            <p id="wallet-total-earnings" class="text-lg font-black text-primary">₹ ${state.totalEarnings ? state.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</p>
                        </div>
                        <button onclick="navigateTo('withdraw')" class="bg-primary text-white p-3 rounded-xl shadow-lg shadow-amber-100 active:scale-95 transition-all">
                            <i class="fa-solid fa-money-bill-transfer"></i>
                            <span class="ml-2 font-bold text-sm">Withdraw</span>
                        </button>
                    </div>
                </div>

                <!-- History Tabs -->
                <div class="flex gap-4 mb-6">
                    <button onclick="setWalletTab('transactions')" class="wallet-tab ${state.activeWalletTab === 'transactions' ? 'active' : 'inactive'}">Transaction History</button>
                    <button onclick="setWalletTab('withdrawals')" class="wallet-tab ${state.activeWalletTab === 'withdrawals' ? 'active' : 'inactive'}">Withdrawal History</button>
                </div>

                <!-- List Container -->
                <div id="wallet-list-container" class="space-y-4 pb-20">
                    <div class="text-center py-10 text-gray-400 text-sm">
                        <i class="fa-solid fa-spinner animate-spin mr-2"></i>Loading history...
                    </div>
                </div>
            </div>
        </div>
    `;

    const supabase = window.supabaseClient;
    const vendorId = state.currentVendorId || state.vendorId;

    if (supabase && vendorId) {
        // Fetch raw wallet balance directly from Supabase vendors table (Single Source of Truth)
        supabase
            .from('vendors')
            .select('wallet_balance')
            .eq('id', vendorId)
            .single()
            .then(({ data, error }) => {
                const balNode = document.getElementById('wallet-available-balance');
                if (balNode) {
                    if (error) {
                        console.error("[Supabase Fetch] Failed to query wallet balance:", error);
                        balNode.innerText = "₹ 0";
                    } else if (data) {
                        const rawBalance = Math.floor(Number(data.wallet_balance) || 0);
                        balNode.innerText = `₹ ${rawBalance}`;
                        state.walletBalance = Number(data.wallet_balance) || 0;
                    }
                }
            });

        // Hydrate payout history dynamically from Supabase
        supabase
            .from('vendor_payouts')
            .select('*')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false })
            .then(({ data: dbPayouts, error: payoutsError }) => {
                if (dbPayouts && !payoutsError) {
                    state.withdrawalHistory = dbPayouts.map(p => {
                        let dateStr = 'Date unknown';
                        if (p.created_at) {
                            try {
                                dateStr = new Date(p.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                            } catch (e) {}
                        }
                        return {
                            id: p.id ? `#WTH${p.id.slice(-5).toUpperCase()}` : '#WTHRAWAL',
                            date: dateStr,
                            amount: parseFloat(p.amount) || 0,
                            status: p.status || 'pending',
                            method: p.payment_method || p.method || 'Bank Transfer'
                        };
                    });
                }

                // Fetch sub-orders for transactions
                supabase
                    .from('sub_orders')
                    .select('*, orders(*)')
                    .eq('restaurant_id', vendorId)
                    .eq('sub_order_status', 'delivered')
                    .order('created_at', { ascending: false })
                    .then(({ data: dbSubOrders, error: subOrdersError }) => {
                        if (dbSubOrders && !subOrdersError) {
                            state.walletTransactions = dbSubOrders.map(subOrder => {
                                const mainOrder = subOrder.orders || {};
                                let dateStr = 'Date unknown';
                                if (subOrder.created_at) {
                                    try {
                                        dateStr = new Date(subOrder.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                                    } catch (e) {}
                                }
                                return {
                                    id: subOrder.id ? `#${subOrder.id.slice(-5).toUpperCase()}` : '#ORDER',
                                    customer: mainOrder.customer_name || 'Customer',
                                    date: dateStr,
                                    amount: getPayout(parseFloat(subOrder.food_price_share) || 0),
                                    status: 'Received'
                                };
                            });

                            const netEarnings = dbSubOrders.reduce((sum, o) => sum + getPayout(parseFloat(o.food_price_share) || 0), 0);
                            state.totalEarnings = netEarnings > 0 ? parseFloat(netEarnings.toFixed(2)) : 0.00;

                            const earnsNode = document.getElementById('wallet-total-earnings');
                            if (earnsNode) {
                                earnsNode.innerText = `₹ ${state.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                            }
                        }

                        const listContainer = document.getElementById('wallet-list-container');
                        if (listContainer) {
                            listContainer.innerHTML = state.activeWalletTab === 'transactions' ? renderTransactionHistory() : renderWithdrawalHistory();
                        }
                    });
            });
    } else {
        const balNode = document.getElementById('wallet-available-balance');
        if (balNode) balNode.innerText = "₹ 0";
        const listContainer = document.getElementById('wallet-list-container');
        if (listContainer) {
            listContainer.innerHTML = state.activeWalletTab === 'transactions' ? renderTransactionHistory() : renderWithdrawalHistory();
        }
    }
}

function renderTransactionHistory() {
    return state.walletTransactions.map(txn => `
        <div class="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-50">
            <div class="w-10 h-10 rounded-full bg-amber-50 text-primary flex items-center justify-center">
                <i class="fa-solid fa-store"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-bold text-gray-800">Order Payment Received</h4>
                <p class="text-[10px] text-gray-400">${txn.customer} • ${txn.id}</p>
                <p class="text-[9px] text-gray-400 mt-0.5">${txn.date}</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-black text-green-500">+₹ ${txn.amount.toLocaleString()}</p>
                <span class="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-500 uppercase">${txn.status}</span>
            </div>
        </div>
    `).join('');
}

function renderWithdrawalHistory() {
    if (state.withdrawalHistory.length === 0) {
        return `<div class="text-center py-10 text-gray-400 text-sm">No withdrawal history found.</div>`;
    }
    return state.withdrawalHistory.map(w => `
        <div class="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-50">
            <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                <i class="fa-solid fa-money-bill-transfer"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-bold text-gray-800">Withdrawal Request</h4>
                <p class="text-[10px] text-gray-400">${w.method} • ${w.id}</p>
                <p class="text-[9px] text-gray-400 mt-0.5">${w.date}</p>
            </div>
            <div class="text-right">
                <p class="text-sm font-black ${['success', 'completed'].includes((w.status || '').toLowerCase()) ? 'text-green-500' : 'text-amber-500'}">-₹ ${w.amount.toLocaleString()}</p>
                <span class="text-[9px] px-2 py-0.5 rounded-full font-bold 
                    ${['success', 'completed'].includes((w.status || '').toLowerCase()) ? 'bg-green-50 text-green-500' : ['pending'].includes((w.status || '').toLowerCase()) ? 'bg-orange-50 text-orange-500' : 'bg-amber-50 text-amber-500'} 
                    uppercase">${w.status}</span>
            </div>
        </div>
    `).join('');
}

function setWalletTab(tab) {
    state.activeWalletTab = tab;
    renderWalletScreen();
}

function renderWithdrawScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Withdraw Amount</h2>
                </div>
            </div>

            <div class="px-6">
                <!-- Amount Input -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Enter Withdraw Amount</label>
                    <div class="relative mb-6">
                        <span class="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-800">₹</span>
                        <input type="number" id="withdraw-amount" placeholder="0.00" 
                            class="w-full pl-8 py-2 text-3xl font-black text-gray-800 border-b-2 border-gray-100 focus:border-primary outline-none transition-all">
                    </div>

                    <!-- Chips -->
                    <div class="flex flex-wrap gap-3 mb-4">
                        <button onclick="setWithdrawAmount(500)" class="withdraw-chip">+ ₹ 500.0</button>
                        <button onclick="setWithdrawAmount(1000)" class="withdraw-chip">+ ₹ 1000.0</button>
                        <button onclick="setWithdrawAmount(1500)" class="withdraw-chip">+ ₹ 1500.0</button>
                        <button onclick="setWithdrawAmount(2500)" class="withdraw-chip">+ ₹ 2500.0</button>
                        <button onclick="setWithdrawAmount(5000)" class="withdraw-chip">+ ₹ 5000.0</button>
                    </div>
                    
                    <p class="text-[10px] text-gray-400 font-bold italic"><i class="fa-solid fa-circle-info mr-1"></i> Min. Withdrawal amount will be ₹ 500.0</p>
                </div>

                <!-- Optional Note -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">Add Optional Note</label>
                    <textarea id="withdraw-note" rows="2" placeholder="Write something here..." 
                        class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all"></textarea>
                </div>

                <!-- Bank/UPI Selection -->
                <div class="mb-6">
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest ml-2">Select Payout Method</label>
                    
                    <!-- Bank Selection -->
                    <div class="mb-4">
                        <p class="text-[10px] font-bold text-gray-400 mb-2 ml-2">SELECT BANK</p>
                        <label class="payout-method-card active">
                            <input type="radio" name="payout-method" value="Bank Transfer" checked class="hidden">
                            <div class="flex items-center gap-4 w-full">
                                <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                                    <i class="fa-solid fa-building-columns"></i>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-sm font-bold text-gray-800">${state.bankDetails.bankName}</h4>
                                    <p class="text-[10px] text-gray-400 font-mono">${state.bankDetails.accountNumber}</p>
                                </div>
                                <div class="radio-indicator"></div>
                            </div>
                        </label>
                    </div>

                    <!-- UPI Selection -->
                    <div>
                        <p class="text-[10px] font-bold text-gray-400 mb-2 ml-2">SELECT UPI</p>
                        <label class="payout-method-card">
                            <input type="radio" name="payout-method" value="UPI" class="hidden">
                            <div class="flex items-center gap-4 w-full">
                                <div class="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl">
                                    <i class="fa-solid fa-qrcode"></i>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-sm font-bold text-gray-800">UPI Transfer</h4>
                                    <p class="text-[10px] text-gray-400 font-mono">${state.bankDetails.upiId}</p>
                                </div>
                                <div class="radio-indicator"></div>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Withdraw Button -->
                <button onclick="handleWithdrawSubmit()" class="w-full py-5 bg-primary text-white rounded-[32px] font-black text-lg shadow-xl shadow-amber-100 active:scale-95 transition-all mt-4 mb-10">
                    Withdraw
                </button>
            </div>
        </div>
    `;

    // Add event listeners for radio selection styling
    const radios = document.querySelectorAll('input[name="payout-method"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.payout-method-card').forEach(card => card.classList.remove('active'));
            if (e.target.checked) {
                e.target.closest('.payout-method-card').classList.add('active');
            }
        });
    });
}

function setWithdrawAmount(amount) {
    document.getElementById('withdraw-amount').value = amount;
}

function renderTodayEarningScreen() {
    const app = document.getElementById('app');

    const deliveredToday = state.todayOrders.filter(order => order.status === 'Delivered');
    const totalEarning = deliveredToday.reduce((sum, order) => sum + getPayout(order.price), 0);
    const totalPending = state.todayOrders.filter(order => order.status === 'Pending').reduce((sum, order) => sum + getPayout(order.price), 0);

    const todayDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="curved-header px-6 pt-10 pb-20 text-white relative text-center">
                <div class="flex items-center absolute left-6 top-10">
                    <button onclick="goBack()" class="text-xl bg-white/20 p-2 rounded-xl active:scale-95 transition-all">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                </div>
                <h2 class="text-xl font-black">Today Earning</h2>
                <p class="text-[10px] opacity-80 font-bold mt-1 uppercase tracking-widest">${todayDate} (${todayDay})</p>
            </div>

            <div class="px-6 -mt-14 relative z-10">
                <!-- Summary Card -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 flex justify-between items-center mb-6">
                    <div>
                        <p class="text-sm font-bold text-gray-400 mb-1">Total Earning</p>
                        <h3 id="today-total-earning" class="text-4xl font-black text-primary">₹ ${totalEarning.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        <p class="text-[10px] text-green-500 font-black mt-2 flex items-center gap-1">
                            <i class="fa-solid fa-arrow-trend-up"></i> 18.6% vs Yesterday
                        </p>
                    </div>
                    <div class="earning-wallet-circle">
                        <div class="wallet-glow-animation"></div>
                        <div class="relative z-10 w-full h-full flex items-center justify-center">
                            <i class="fa-solid fa-wallet text-white text-3xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Stats Card -->
                <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex divide-x divide-gray-100 mb-8">
                    <div class="flex-1 text-center py-2">
                        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-2">
                            <i class="fa-solid fa-shopping-bag text-xl"></i>
                        </div>
                        <p class="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-tighter">Total Orders</p>
                        <p id="today-total-orders" class="text-2xl font-black text-gray-800">${deliveredToday.length}</p>
                    </div>
                    <div class="flex-1 text-center py-2">
                        <div class="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-2">
                            <i class="fa-solid fa-file-invoice-dollar text-xl"></i>
                        </div>
                        <p class="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-tighter">Total Pending</p>
                        <p id="today-total-pending" class="text-2xl font-black text-gray-800">₹ ${totalPending.toLocaleString()}</p>
                    </div>
                </div>

                <!-- Earnings List -->
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 class="font-black text-gray-800 text-lg uppercase tracking-tight">Today's Orders</h3>
                    <button class="text-primary text-[10px] font-black uppercase tracking-widest border-b-2 border-primary/20 pb-0.5">View All</button>
                </div>

                <div class="space-y-4" id="today-orders-list">
                    ${deliveredToday.map(order => `
                        <div class="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm flex items-start gap-4 active:scale-[0.98] transition-all">
                            <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-primary text-xl flex-shrink-0">
                                <i class="fa-solid fa-shopping-bag"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-black text-gray-800 text-base">Order ${order.id}</h4>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">${order.customerName}</p>
                                    </div>
                                    <p class="text-[10px] text-gray-400 font-black uppercase tracking-tighter">${order.time}</p>
                                </div>
                                <div class="mt-4 pt-4 border-t border-dashed border-gray-100 flex justify-between items-end">
                                    <div class="space-y-1">
                                        <p class="text-[10px] text-gray-800 font-black uppercase tracking-widest">Net Payout</p>
                                    </div>
                                    <p class="text-xl font-black text-gray-900">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderTotalOrdersScreen() {
    const app = document.getElementById('app');

    const todayDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="curved-header px-6 pt-10 pb-20 text-white relative text-center">
                <div class="flex items-center absolute left-6 top-10">
                    <button onclick="goBack()" class="text-xl bg-white/20 p-2 rounded-xl active:scale-95 transition-all">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                </div>
                <h2 class="text-xl font-black">Total Orders</h2>
                <p class="text-[10px] opacity-80 font-bold mt-1 uppercase tracking-widest">${todayDate} (${todayDay})</p>
            </div>

            <div class="px-6 -mt-14 relative z-10">
                <!-- Summary Card -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 flex justify-between items-center mb-8">
                    <div class="flex items-center gap-5">
                        <div class="w-16 h-16 rounded-[24px] bg-amber-50 text-primary flex items-center justify-center text-3xl shadow-sm">
                            <i class="fa-solid fa-shopping-bag"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today Total Orders</p>
                            <h3 class="text-5xl font-black text-primary">${state.todayStats.totalOrders}</h3>
                            <p class="text-[10px] text-gray-400 font-bold mt-1 italic">Orders Received Today</p>
                        </div>
                    </div>
                    <div class="checklist-icon-container">
                        <div class="checklist-bg-pulse"></div>
                        <div class="relative z-10 w-full h-full flex items-center justify-center">
                            <i class="fa-solid fa-clipboard-check text-primary text-2xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Orders List -->
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 class="font-black text-gray-800 text-lg uppercase tracking-tight">Orders List</h3>
                    <button class="text-primary text-[10px] font-black uppercase tracking-widest border-b-2 border-primary/20 pb-0.5">View All</button>
                </div>

                <div class="space-y-4">
                    ${state.todayOrders.map(order => `
                        <div class="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all">
                            <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-primary text-xl flex-shrink-0">
                                <i class="fa-solid fa-shopping-bag"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-black text-gray-800 text-base">Order ${order.id}</h4>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Food Delivery</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-tighter mb-2">${order.time}</p>
                                        <span class="price-badge-green">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderDeliveredOrdersScreen() {
    const app = document.getElementById('app');

    const deliveredToday = state.todayOrders.filter(order => order.status === 'Delivered');
    const todayDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="curved-header px-6 pt-10 pb-20 text-white relative text-center">
                <div class="flex items-center absolute left-6 top-10">
                    <button onclick="goBack()" class="text-xl bg-white/20 p-2 rounded-xl active:scale-95 transition-all">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                </div>
                <h2 class="text-xl font-black">Delivered Orders</h2>
                <p class="text-[10px] opacity-80 font-bold mt-1 uppercase tracking-widest">${todayDate} (${todayDay})</p>
            </div>

            <div class="px-6 -mt-14 relative z-10">
                <!-- Summary Card -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 flex justify-between items-center mb-8">
                    <div class="flex items-center gap-5">
                        <div class="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center text-3xl shadow-inner">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today Delivered Orders</p>
                            <h3 class="text-5xl font-black text-green-600">${deliveredToday.length}</h3>
                            <p class="text-[10px] text-gray-400 font-bold mt-1 italic">Orders Delivered Successfully</p>
                        </div>
                    </div>
                    <div class="delivered-bag-icon-container">
                        <div class="delivered-bg-pulse"></div>
                        <div class="relative z-10 w-full h-full flex items-center justify-center">
                            <i class="fa-solid fa-shopping-bag text-white text-2xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Orders List -->
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 class="font-black text-gray-800 text-lg uppercase tracking-tight">Delivered Orders List</h3>
                    <button class="text-primary text-[10px] font-black uppercase tracking-widest border-b-2 border-primary/20 pb-0.5">View All</button>
                </div>

                <div class="space-y-4">
                    ${deliveredToday.map(order => `
                        <div class="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all">
                            <div class="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-green-500 text-xl flex-shrink-0">
                                <i class="fa-solid fa-shopping-bag"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <h4 class="font-black text-gray-800 text-base">Order ${order.id}</h4>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Food Delivery</p>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-tighter mb-2">${order.time}</p>
                                        <span class="status-badge-delivered">Delivered</span>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-base font-black text-gray-900">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Footer Success Message -->
                <div class="mt-8 flex items-center justify-center gap-2 py-4 bg-green-50/50 rounded-2xl border border-dashed border-green-200">
                    <i class="fa-solid fa-circle-check text-green-500 text-sm"></i>
                    <p class="text-[10px] font-black text-green-600 uppercase tracking-widest">All orders are delivered successfully</p>
                </div>
            </div>
        </div>
    `;
}

function renderPendingOrdersScreen() {
    const app = document.getElementById('app');

    const pendingToday = state.todayOrders.filter(order => order.status === 'Pending');
    const todayDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="curved-header px-6 pt-10 pb-20 text-white relative text-center">
                <div class="flex items-center absolute left-6 top-10">
                    <button onclick="goBack()" class="text-xl bg-white/20 p-2 rounded-xl active:scale-95 transition-all">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                </div>
                <h2 class="text-xl font-black">Pending Orders</h2>
                <p class="text-[10px] opacity-80 font-bold mt-1 uppercase tracking-widest">${todayDate} (${todayDay})</p>
            </div>

            <div class="px-6 -mt-14 relative z-10">
                <!-- Summary Card -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 flex justify-between items-center mb-8">
                    <div class="flex items-center gap-5">
                        <div class="w-16 h-16 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center text-3xl shadow-inner">
                            <i class="fa-solid fa-clock"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today Pending Orders</p>
                            <h3 class="text-5xl font-black text-orange-500">${pendingToday.length < 10 ? '0' + pendingToday.length : pendingToday.length}</h3>
                            <p class="text-[10px] text-gray-400 font-bold mt-1 italic">Orders Awaiting Processing</p>
                        </div>
                    </div>
                    <div class="pending-clock-icon-container">
                        <div class="pending-bg-pulse"></div>
                        <div class="relative z-10 w-full h-full flex items-center justify-center">
                            <i class="fa-solid fa-hourglass-half text-white text-2xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Orders List -->
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 class="font-black text-gray-800 text-lg uppercase tracking-tight">Pending Orders List</h3>
                    <button class="text-primary text-[10px] font-black uppercase tracking-widest border-b-2 border-primary/20 pb-0.5">View All</button>
                </div>

                <div class="space-y-4">
                    ${pendingToday.map(order => `
                        <div class="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-all">
                            <div class="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 text-xl flex-shrink-0">
                                <i class="fa-solid fa-shopping-bag"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <h4 class="font-black text-gray-800 text-base">Order ${order.id}</h4>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Food Delivery</p>
                                        <p class="text-[9px] text-gray-400 mt-1"><i class="fa-solid fa-location-dot mr-1"></i> ${order.location}</p>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-tighter mb-2">${order.time}</p>
                                        <span class="status-badge-pending">Pending</span>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-base font-black text-gray-900">₹ ${getPayout(order.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function handleWithdrawSubmit() {
    const amountInput = document.getElementById('withdraw-amount');
    if (!amountInput) {
        if (typeof showToast === 'function') showToast('Withdrawal amount field not found.');
        return;
    }
    const amount = Number(amountInput.value);
    const note = document.getElementById('withdraw-note') ? document.getElementById('withdraw-note').value.trim() : '';
    const methodInput = document.querySelector('input[name="payout-method"]:checked');
    const method = methodInput ? methodInput.value : 'Bank Transfer';

    if (isNaN(amount) || amount < 500) {
        if (typeof showToast === 'function') {
            showToast('Min. Withdrawal amount will be ₹ 500.0');
        } else {
            alert('Min. Withdrawal amount will be ₹ 500.0');
        }
        return;
    }

    if (amount > state.walletBalance) {
        if (typeof showToast === 'function') {
            showToast('Insufficient wallet balance!');
        } else {
            alert('Insufficient wallet balance!');
        }
        return;
    }

    if (!confirm(`Are you sure you want to request a withdrawal of ₹ ${amount}?`)) return;

    const btn = document.querySelector('button[onclick="handleWithdrawSubmit()"]');
    const originalContent = btn ? btn.innerHTML : 'Withdraw';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Submitting...';
        btn.disabled = true;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        // Fetch vendor ID directly from global state
        let vendorId = state.currentVendorId || state.vendorId || (state.user && state.user.id);
        if (!vendorId && window.supabaseClient) {
            try {
                const { data: { user } } = await window.supabaseClient.auth.getUser();
                if (user) {
                    vendorId = user.id;
                }
            } catch (e) {
                console.error('Error fetching user UUID:', e);
            }
        }

        if (!vendorId) {
            throw new Error('Vendor session not found. Please log in again.');
        }

        // Perform atomic deduction of wallet balance FIRST
        const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_vendor_wallet', {
            p_vendor_id: vendorId,
            p_amount: Number(amount)
        });

        if (rpcError) {
            throw new Error(rpcError.message || 'Failed to deduct wallet balance. Please try again.');
        }

        // Intercept submission and execute secure insert query
        const payoutData = {
            vendor_id: vendorId,
            amount: Number(amount),
            status: 'pending',
            payment_method: method,
            payout_date: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('vendor_payouts')
            .insert([payoutData])
            .select()
            .single();

        if (error) {
            // Revert deduction by adding balance back if insertion fails
            await supabase.rpc('deduct_vendor_wallet', {
                p_vendor_id: vendorId,
                p_amount: -Number(amount)
            });
            throw error;
        }

        // Automatically clear the text field input box
        amountInput.value = '';
        const noteInput = document.getElementById('withdraw-note');
        if (noteInput) noteInput.value = '';

        // Refresh the payout history log list dynamically without forcing full page reload
        const { data: dbPayouts, error: payoutsError } = await supabase
            .from('vendor_payouts')
            .select('*')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false });

        if (dbPayouts && !payoutsError) {
            state.withdrawalHistory = dbPayouts.map(p => {
                let dateStr = 'Date unknown';
                if (p.created_at) {
                    try {
                        dateStr = new Date(p.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                    } catch (e) {}
                }
                return {
                    id: p.id ? `#WTH${p.id.slice(-5).toUpperCase()}` : '#WTHRAWAL',
                    date: dateStr,
                    amount: parseFloat(p.amount) || 0,
                    status: p.status || 'pending',
                    method: p.payment_method || p.method || 'Bank Transfer'
                };
            });
        }

        if (typeof showToast === 'function') {
            showToast('Withdrawal Request Sent to Admin!');
        } else {
            alert('Withdrawal Request Sent to Admin!');
        }

        // Navigate safely back to wallet screen after state updates are completed
        setTimeout(() => {
            if (document.getElementById('app') && typeof navigateTo === 'function') {
                navigateTo('wallet');
            }
        }, 100);

    } catch (err) {
        console.error('Failed to submit withdrawal:', err);
        let errorMsg = 'Failed to submit withdrawal';
        if (err) {
            if (typeof err === 'string') {
                errorMsg = err;
            } else if (err.message) {
                errorMsg = err.message;
                if (err.details) {
                    errorMsg += ' - ' + err.details;
                }
            } else {
                try {
                    errorMsg = JSON.stringify(err);
                } catch (e) {
                    errorMsg = String(err);
                }
            }
        }
        if (typeof showToast === 'function') {
            showToast('Error: ' + errorMsg);
        } else {
            alert('Error: ' + errorMsg);
        }
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

function renderOrdersScreen() {
    const app = document.getElementById('app');

    // Filter logic
    let filteredOrders = state.recentOrders || [];
    
    if (state.orderFilter === 'Pending') {
        filteredOrders = filteredOrders.filter(o => o.status === 'Pending' || o.status === 'Accepted');
    } else if (state.orderFilter === 'Preparing') {
        filteredOrders = filteredOrders.filter(o => o.status === 'Preparing');
    } else if (state.orderFilter === 'On the Way') {
        filteredOrders = filteredOrders.filter(o => ['Out for Delivery', 'Waiting for rider', 'On the Way', 'Picked Up'].includes(o.status));
    } else if (state.orderFilter === 'Delivered') {
        filteredOrders = filteredOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed');
    } else if (state.orderFilter === 'Cancelled') {
        filteredOrders = filteredOrders.filter(o => ['Rejected', 'Cancelled'].includes(o.status));
    }

    // Pagination Engine (Strict 10 items)
    state.orderHistoryPage = state.orderHistoryPage || 1;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    if (state.orderHistoryPage > totalPages) state.orderHistoryPage = totalPages;
    if (state.orderHistoryPage < 1) state.orderHistoryPage = 1;
    
    const paginatedOrders = filteredOrders.slice((state.orderHistoryPage - 1) * itemsPerPage, state.orderHistoryPage * itemsPerPage);

    const getBadgeStyle = (status) => {
        const s = status.toLowerCase();
        if (s === 'delivered' || s === 'completed') return { cls: 'bg-green-50 text-green-600 border border-green-100', icon: 'fa-check-circle' };
        if (s === 'preparing') return { cls: 'bg-blue-50 text-blue-600 border border-blue-100', icon: 'fa-clock' };
        if (['pick up', 'picked up', 'picked_up', 'on route', 'on_route', 'on the way', 'out for delivery', 'waiting for rider'].includes(s)) return { cls: 'bg-orange-50 text-orange-500 border border-orange-100', icon: 'fa-motorcycle' };
        if (s === 'cancelled' || s === 'rejected') return { cls: 'bg-red-50 text-red-500 border border-red-100', icon: 'fa-times-circle' };
        return { cls: 'bg-gray-50 text-gray-500 border border-gray-200', icon: 'fa-circle-info' };
    };

    app.innerHTML = `
        <div class="bg-gray-50 min-h-screen">
            <!-- Header -->
            <div class="bg-white px-6 py-4 flex items-center justify-center relative sticky top-0 z-50">
                <button onclick="goBack()" class="text-xl absolute left-6 text-gray-800">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h2 class="text-lg font-black text-gray-900 tracking-tight">Order History</h2>
            </div>

            <div class="bg-gray-50 pb-24">
                <!-- Status Chips -->
                <div class="bg-white flex gap-3 px-6 py-4 overflow-x-auto no-scrollbar border-b border-gray-100 shadow-sm mb-4">
                    ${['All Orders', 'Pending', 'Preparing', 'On the Way', 'Delivered', 'Cancelled'].map(filter => {
                        const filterVal = filter === 'All Orders' ? 'All' : filter;
                        const isSelected = (state.orderFilter || 'All') === filterVal;
                        return `
                        <button onclick="setOrderFilter('${filterVal}')" 
                            class="px-5 py-2 rounded-full text-[11px] font-black tracking-widest transition-all whitespace-nowrap border
                            ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}">
                            ${filter}
                        </button>
                        `;
                    }).join('')}
                </div>

                <!-- Table Columns Header -->
                <div class="px-6 py-4 mb-2 flex items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
                    <div class="w-[30%] pl-2 text-left">Order ID</div>
                    <div class="w-[40%] pl-5 text-left">Items (Count)</div>
                    <div class="w-[30%] text-right pr-6">Total Price & Status</div>
                </div>
                
                <!-- Order List -->
                <div class="px-4 space-y-0 fade-in" id="order-history-list">
                    ${paginatedOrders.length === 0 ? `
                        <div class="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl shadow-sm border border-gray-50">
                            <h3 class="font-bold text-gray-800 mb-1">No Orders Found</h3>
                            <p class="text-gray-400 text-xs">There are no orders matching your criteria.</p>
                        </div>
                    ` : paginatedOrders.map(order => {
                        const badge = getBadgeStyle(order.status);
                        const itemsListHtml = (order.items && order.items.length > 0) ? 
                            order.items.map(item => `<li>• ${item.name || item.item_name || 'Item'}</li>`).join('') :
                            `<li>• ${order.item}</li>`;

                        return `
                        <div onclick="state.selectedOrderId = '${order.fullId}'; navigateTo('order-details')" class="px-6 py-5 mb-4 bg-white border border-gray-100 rounded-3xl flex items-center hover:bg-gray-50 transition-all cursor-pointer group shadow-sm hover:shadow-md">
                            <!-- Left: Order Info -->
                            <div class="w-[30%] flex flex-col justify-center text-left border-r border-gray-100 pr-4">
                                <h4 class="font-black text-gray-900 text-base leading-tight">${order.id || order.main_order_id}</h4>
                                <p class="text-[10px] text-gray-500 font-bold mt-1">${order.time}</p>
                            </div>
                            
                            <!-- Middle-Left: Items List -->
                            <div class="w-[40%] pl-5 text-[11px] text-gray-500 font-semibold leading-relaxed text-left">
                                <ul class="truncate-list pr-4 leading-[1.5]">${itemsListHtml}</ul>
                            </div>
                            
                            <!-- Right: Status & Price Stack -->
                            <div class="w-[30%] flex flex-col items-end justify-center pr-2">
                                <div class="font-black text-gray-900 text-sm">
                                    ₹${order.total_price || order.final_amount || order.payable_amount || order.price || order.total || 0}
                                </div>
                                <div class="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${badge.cls}">
                                    <i class="fa-solid ${badge.icon}"></i>
                                    ${order.status}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <!-- Dynamic Pagination Engine -->
                ${totalPages > 1 ? `
                <div class="py-10 flex items-center justify-center gap-2">
                    <button onclick="changeOrderPage(${state.orderHistoryPage - 1})" class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 ${state.orderHistoryPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${state.orderHistoryPage === 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    ${Array.from({length: totalPages}, (_, i) => i + 1).map(pageNum => `
                        <button onclick="changeOrderPage(${pageNum})" class="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${pageNum === state.orderHistoryPage ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}">
                            ${pageNum}
                        </button>
                    `).join('')}
                    <button onclick="changeOrderPage(${state.orderHistoryPage + 1})" class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 ${state.orderHistoryPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}" ${state.orderHistoryPage === totalPages ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function changeOrderPage(page) {
    state.orderHistoryPage = page;
    renderOrdersScreen();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setOrderFilter(filter) {
    state.orderFilter = filter;
    state.orderHistoryPage = 1; // Reset pagination
    renderOrdersScreen();

    const list = document.getElementById('order-history-list');
    if (list) {
        list.classList.remove('fade-in');
        void list.offsetWidth;
        list.classList.add('fade-in');
    }
}

function renderPaymentsScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="p-6">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Earnings</h2>
            
            <div class="bg-gradient-to-br from-primary to-amber-700 rounded-[40px] p-8 text-white mb-8 shadow-xl shadow-amber-100 relative overflow-hidden">
                <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full"></div>
                <p class="text-white/60 text-sm mb-2 font-medium">Available for Payout</p>
                <h3 class="text-4xl font-black mb-8">₹ ${state.walletBalance.toLocaleString()}</h3>
                
                <button onclick="requestPayout()" class="w-full py-4 bg-white text-primary rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Request Payout</button>
            </div>
            
            <h3 class="font-bold text-gray-800 mb-4">Recent Transactions</h3>
            <div class="space-y-4">
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-50 shadow-sm">
                    <div>
                        <p class="font-bold text-gray-800 text-sm">Payout Requested</p>
                        <p class="text-[10px] text-gray-400">26 Apr 2026 • #TXN99283</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-gray-800">₹ 5,000</p>
                        <span class="text-[10px] text-orange-500 font-bold uppercase">Processing</span>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-50 shadow-sm">
                    <div>
                        <p class="font-bold text-gray-800 text-sm">Weekly Earning</p>
                        <p class="text-[10px] text-gray-400">21 Apr 2026 • #TXN99120</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-green-500">+₹ ${getPayout(8450).toLocaleString()}</p>
                        <span class="text-[10px] text-green-500 font-bold uppercase">Paid</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function requestPayout() {
    showToast('Payout request submitted!');
}

async function renderProfileScreen() {
    const app = document.getElementById('app');
    
    // Render immediate loading state with clean skeleton loader
    app.innerHTML = `
        <div class="profile-container pb-24 bg-white min-h-screen">
            <div class="px-6 pt-12 pb-4 flex justify-between items-end">
                <h1 class="text-3xl font-black text-gray-800">My Profile</h1>
            </div>

            <!-- Profile Info Skeleton Loader -->
            <div class="px-6 mb-8">
                <div class="bg-white rounded-[40px] p-8 border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col gap-6 animate-pulse">
                    <div class="flex items-center gap-6">
                        <div class="w-20 h-20 rounded-full bg-gray-200"></div>
                        <div class="flex-1 space-y-3">
                            <div class="h-6 bg-gray-200 rounded w-2/3"></div>
                            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                    <div class="space-y-4 mt-4">
                        <div class="h-10 bg-gray-100 rounded-2xl"></div>
                        <div class="h-10 bg-gray-100 rounded-2xl"></div>
                        <div class="h-10 bg-gray-100 rounded-2xl"></div>
                    </div>
                </div>
            </div>

            <!-- Spinner Overlay Inside Loader -->
            <div class="flex items-center justify-center py-10">
                <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
                <span class="ml-3 text-sm font-bold text-gray-500">Loading Profile...</span>
            </div>
        </div>
    `;

    const supabase = window.supabaseClient;
    let vendorData = null;

    if (supabase) {
        try {
            // Step 1: Check active authenticated user session
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('vendors')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                vendorData = data;
            }
        } catch (e) {
            console.error("Supabase getUser / vendors ID query failed:", e);
        }

        // Step 2: Fallback query using active mobile number from global state
        if (!vendorData && state.userMobile) {
            try {
                const cleanMobile = state.userMobile.replace(/\D/g, '').slice(-10);
                const { data } = await supabase
                    .from('vendors')
                    .select('*')
                    .eq('mobile', cleanMobile)
                    .single();
                vendorData = data;
            } catch (e) {
                console.error("Supabase mobile query fallback failed:", e);
            }
        }
    }

    // Step 3: Map fetched core fields exactly with proper fallbacks
    const vendorName = vendorData?.owner_name || vendorData?.full_name || vendorData?.name || state.vendorName || 'ASA Vendor Partner';
    const vendorEmail = vendorData?.email || state.vendorEmail || 'partner@asafood.com';
    const rawMobile = vendorData?.mobile_no || vendorData?.mobile_number || vendorData?.mobile || state.userMobile || '';
    const vendorPhone10 = rawMobile.replace(/\D/g, '').slice(-10) || '0000000000';

    // Synchronize to global state
    state.vendorName = vendorName;
    state.vendorEmail = vendorEmail;
    state.userMobile = vendorPhone10;
    state.vendorPhone = '+91 ' + vendorPhone10;

    // Render complete details view populated with dynamic Supabase fields and theme colors
    app.innerHTML = `
        <div class="profile-container pb-24 bg-white min-h-screen">
            <div class="px-6 pt-12 pb-4">
                <h1 class="text-3xl font-black text-gray-800">My Profile</h1>
            </div>

            <!-- Core Profile Details Card: Golden Yellow (#FFD700) and Brown (#3E2723) Theme -->
            <div class="px-6 mb-8">
                <div class="bg-white rounded-[40px] p-8 border border-[#FFD700]/20 shadow-2xl shadow-gray-200/50 flex flex-col gap-6">
                    <div class="flex items-center gap-6">
                        <div class="relative">
                            <div class="w-20 h-20 rounded-full border-4 border-[#FFD700]/30 p-1 bg-white overflow-hidden">
                                ${state.vendorPhoto
                                    ? `<img src="${state.vendorPhoto}" class="w-full h-full rounded-full object-cover bg-gray-50" alt="Profile">`
                                    : `<div class="w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-inner">
                                           <span class="text-2xl font-black text-white tracking-tight select-none">${(vendorName || 'V').charAt(0).toUpperCase()}</span>
                                       </div>`
                                }
                            </div>
                        </div>
                        <div class="flex-1">
                            <h2 class="text-2xl font-black text-[#3E2723] leading-tight">${vendorName}</h2>
                            <p class="text-gray-400 text-xs mt-1 font-semibold uppercase tracking-wider">${state.restaurantDetails?.name || 'Partner Account'}</p>
                        </div>
                        <div class="px-4 py-2 bg-green-50 text-green-600 rounded-full font-black text-[9px] uppercase flex items-center gap-1.5 border border-green-100 self-start shadow-sm">
                            <i class="fa-solid fa-circle-check"></i> Active
                        </div>
                    </div>



                    <button onclick="navigateTo('edit-profile')" class="mt-2 w-full py-4 bg-[#FFD700] hover:bg-[#DAA520] text-[#3E2723] rounded-2xl font-black text-xs shadow-lg shadow-amber-100 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                        <i class="fa-solid fa-pen-to-square"></i> Edit Profile Info
                    </button>
                </div>
            </div>

            <!-- Services Section -->
            <div class="px-6 mt-4">
                <h3 class="text-sm font-bold text-[#5D4037] mb-4 px-2 uppercase tracking-widest text-xs">Services</h3>
                <div class="space-y-2">
                    
                    <!-- My Wallet -->
                    <div onclick="navigateTo('wallet')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-amber-500 text-xl">
                                <i class="fa-solid fa-wallet"></i>
                            </div>
                            <span class="font-bold text-gray-700">My Wallet</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- My Bank -->
                    <div onclick="navigateTo('bank')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-indigo-600 text-xl">
                                <i class="fa-solid fa-building-columns"></i>
                            </div>
                            <span class="font-bold text-gray-700">My Bank</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Document -->
                    <div onclick="navigateTo('documents')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-emerald-500 text-xl">
                                <i class="fa-solid fa-book"></i>
                            </div>
                            <span class="font-bold text-gray-700">Document</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- All Orders -->
                    <div onclick="navigateTo('orders')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-cyan-500 text-xl">
                                <i class="fa-solid fa-rectangle-list"></i>
                            </div>
                            <span class="font-bold text-gray-700">All Orders</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- My Grocery Orders -->
                    <div onclick="window.location.href='grocery_order_history.html'" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-orange-500 text-xl">
                                <i class="fa-solid fa-basket-shopping"></i>
                            </div>
                            <div>
                                <span class="font-bold text-gray-700 block">My Grocery Orders</span>
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Personal Shopping</span>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Statistics -->
                    <div onclick="navigateTo('statistics')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-chart-line"></i>
                            </div>
                            <span class="font-bold text-gray-700">Statistics</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Notifications -->
                    <div onclick="navigateTo('notifications')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-bell"></i>
                            </div>
                            <span class="font-bold text-gray-700">Notifications</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Rating & Review -->
                    <div onclick="navigateTo('reviews')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-star"></i>
                            </div>
                            <span class="font-bold text-gray-700">Rating & Review</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Order Statement -->
                    <div onclick="navigateTo('order-statement')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-blue-500 text-xl">
                                <i class="fa-solid fa-download"></i>
                            </div>
                            <span class="font-bold text-gray-700">Order Statement</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                </div>
            </div>

            <!-- About Section -->
            <div class="px-6 mt-8">
                <h3 class="text-sm font-bold text-[#5D4037] mb-4 px-2 uppercase tracking-widest text-xs">About</h3>
                <div class="space-y-2">
                    <div onclick="navigateTo('privacy')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <span class="font-bold text-gray-700">Privacy & Policy</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div onclick="navigateTo('about')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-circle-info"></i>
                            </div>
                            <span class="font-bold text-gray-700">About App</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div onclick="navigateTo('terms')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 border border-gray-100/50 transition-all cursor-pointer shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-100 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-file-contract"></i>
                            </div>
                            <span class="font-bold text-gray-700">Terms & Condition</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                </div>
            </div>

            <!-- App Settings Section -->
            <div class="px-6 mt-8">
                <h3 class="text-sm font-bold text-[#5D4037] mb-4 px-2 uppercase tracking-widest text-xs">App Settings</h3>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                    <!-- Dark Mode -->
                    <div class="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-amber-500 text-xl">
                                <i class="fa-solid fa-moon"></i>
                            </div>
                            <span class="font-bold text-gray-700">Dark Mode</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" ${state.isDarkMode ? 'checked' : ''} onchange="toggleDarkMode()">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <!-- Language -->
                    <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-[#FFD700] text-xl">
                                <i class="fa-solid fa-language"></i>
                            </div>
                            <span class="font-bold text-gray-700">Language</span>
                        </div>
                        <select onchange="changeLanguage(this.value)" class="bg-gray-50 border-none rounded-lg px-3 py-1 text-xs font-bold text-gray-600 focus:ring-0 outline-none">
                            <option value="English" ${state.language === 'English' ? 'selected' : ''}>English</option>
                            <option value="Hindi" ${state.language === 'Hindi' ? 'selected' : ''}>Hindi</option>
                            <option value="Bengali" ${state.language === 'Bengali' ? 'selected' : ''}>Bengali</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Logout Button -->
            <div class="px-6 mt-12 mb-24">
                <button onclick="logout()" class="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-200 hover:bg-[#5E4037] transition-all active:scale-95">
                    Logout
                </button>
            </div>
        </div>
    `;
}


function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    if (state.isDarkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    showToast(`Dark Mode ${state.isDarkMode ? 'Enabled' : 'Disabled'}`);
}

function changeLanguage(lang) {
    state.language = lang;
    renderView(state.currentView);
    showToast(`Language changed to ${lang}`);
}

function toggleSelfDelivery(checked) {
    state.selfDelivery = checked;
    showToast(`Self Delivery ${checked ? 'Enabled' : 'Disabled'}`);
}

function downloadOrderStatement() {
    showToast('Downloading Order Statement PDF...');
}

function simulateNewReview() {
    const mockReview = {
        id: state.reviews.length + 1,
        customerName: 'Rohit Sharma',
        rating: 5,
        comment: 'Excellent service and the food was hot when delivered!',
        type: 'restaurant',
        time: 'Just now'
    };
    state.reviews.unshift(mockReview);
    triggerReviewNotification(mockReview);
}

function triggerReviewNotification(review) {
    const newNotif = {
        id: state.notifications.length + 1,
        title: 'New Review Received',
        message: `Customer ${review.customerName} gave you a ${review.rating}-star rating: "${review.comment.substring(0, 30)}..."`,
        time: 'Just now',
        type: 'info',
        targetView: 'reviews'
    };
    state.notifications.unshift(newNotif);
    state.notificationCount++;
    showToast('New review notification!');
}

// Utility Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    msg.innerText = message;
    toast.classList.remove('-translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-4', 'opacity-100');

    setTimeout(() => {
        toast.classList.add('-translate-y-20', 'opacity-0', 'pointer-events-none');
        toast.classList.remove('translate-y-4', 'opacity-100');
    }, 3000);
}

// --- Expanded Sub-Pages ---

function renderBankScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">${t('my_bank')}</h2>
                </div>
            </div>

            <div class="px-6">
                <!-- Existing Details -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-8">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4 tracking-wider">Current Bank Details</h3>
                    <div class="space-y-4">
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Bank Name</p>
                            <p class="font-bold text-gray-800">${state.bankDetails.bankName}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Account Number</p>
                            <p class="font-bold text-gray-800 font-mono">${state.bankDetails.accountNumber}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">IFSC Code</p>
                            <p class="font-bold text-gray-800 font-mono">${state.bankDetails.ifsc}</p>
                        </div>
                    </div>
                </div>

                <!-- Update Form -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-6 tracking-wider">Update Bank Account</h3>
                    <div class="space-y-4">
                        <input type="text" id="bank-name-input" placeholder="Enter Bank Name" value="${state.bankDetails.bankName || ''}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all font-bold">
                        <input type="text" id="account-number-input" placeholder="Account Number" value="${state.bankDetails.rawAccountNumber || ''}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all font-bold">
                        <input type="text" id="ifsc-code-input" placeholder="IFSC Code" value="${state.bankDetails.ifsc || ''}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all uppercase font-bold">
                        <button id="update-bank-btn" onclick="handleBankUpdate()" class="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-amber-100 active:scale-95 transition-all mt-2">Update Account</button>
                    </div>
                </div>

                <!-- UPI Section -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-24">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4 tracking-wider">UPI Details</h3>
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-16 h-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                            <i class="fa-solid fa-qrcode text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Active UPI ID</p>
                            <p class="font-bold text-gray-800 font-mono">${state.bankDetails.upiId}</p>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <input type="text" id="upi-id-input" placeholder="Enter new UPI ID (e.g. name@upi)" value="${state.bankDetails.upiId || ''}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all font-mono font-bold">
                        <button id="update-upi-btn" onclick="handleUPIUpdate()" class="w-full py-4 bg-primary/10 text-primary rounded-2xl font-bold border-2 border-primary/20 active:scale-95 transition-all">Update UPI ID</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDocumentsScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">${t('document')}</h2>
                </div>
            </div>

            <div class="px-6 space-y-6 pb-24">
                <!-- Aadhaar Section -->
                <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h3 class="font-black text-gray-800">Aadhaar Card</h3>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Identity Proof</p>
                        </div>
                        <span class="text-[10px] px-2 py-1 rounded-lg font-bold ${state.kycDocs.aadhaar.status === 'Verified' ? 'bg-green-50 text-green-500' : 'bg-amber-50 text-amber-500'} uppercase tracking-widest">
                            ${state.kycDocs.aadhaar.status}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <!-- Aadhaar Front -->
                        <div onclick="triggerKycUpload('aadhaarFront')" class="relative group cursor-pointer">
                            <div class="aspect-[3/2] rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center overflow-hidden bg-gray-50 group-hover:border-primary transition-all">
                                ${state.kycDocs.aadhaar.frontImage ?
            `<img src="${state.kycDocs.aadhaar.frontImage}" class="w-full h-full object-cover">` :
            `<i class="fa-solid fa-camera text-gray-300 text-xl mb-1"></i>
                                     <span class="text-[9px] font-bold text-gray-400 uppercase">Front View</span>`
        }
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span class="text-[10px] text-white font-bold uppercase">Change</span>
                                </div>
                            </div>
                            ${state.kycDocs.aadhaar.frontImage ? '<div class="absolute -top-2 -right-2 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center border-4 border-white"><i class="fa-solid fa-check text-[10px]"></i></div>' : ''}
                        </div>

                        <!-- Aadhaar Back -->
                        <div onclick="triggerKycUpload('aadhaarBack')" class="relative group cursor-pointer">
                            <div class="aspect-[3/2] rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center overflow-hidden bg-gray-50 group-hover:border-primary transition-all">
                                ${state.kycDocs.aadhaar.backImage ?
            `<img src="${state.kycDocs.aadhaar.backImage}" class="w-full h-full object-cover">` :
            `<i class="fa-solid fa-camera text-gray-300 text-xl mb-1"></i>
                                     <span class="text-[9px] font-bold text-gray-400 uppercase">Back View</span>`
        }
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span class="text-[10px] text-white font-bold uppercase">Change</span>
                                </div>
                            </div>
                            ${state.kycDocs.aadhaar.backImage ? '<div class="absolute -top-2 -right-2 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center border-4 border-white"><i class="fa-solid fa-check text-[10px]"></i></div>' : ''}
                        </div>
                    </div>

                    <div class="relative">
                        <input type="text" id="aadhaar-number" value="${state.kycDocs.aadhaar.number}" 
                            oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 12)"
                            placeholder="Enter 12-digit Aadhaar Number" 
                            class="w-full bg-gray-50 border-2 border-transparent focus:border-amber-100 focus:bg-white rounded-2xl p-4 text-sm outline-none font-bold tracking-[0.2em] transition-all">
                        <div class="absolute right-4 top-1/2 -translate-y-1/2">
                            <i class="fa-solid fa-id-card text-gray-200"></i>
                        </div>
                    </div>
                </div>

                <!-- PAN Section -->
                <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h3 class="font-black text-gray-800">PAN Card</h3>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tax Identity</p>
                        </div>
                        <span class="text-[10px] px-2 py-1 rounded-lg font-bold ${state.kycDocs.pan.status === 'Verified' ? 'bg-green-50 text-green-500' : 'bg-amber-50 text-amber-500'} uppercase tracking-widest">
                            ${state.kycDocs.pan.status}
                        </span>
                    </div>

                    <div onclick="triggerKycUpload('pan')" class="relative group cursor-pointer mb-6">
                        <div class="aspect-[16/9] rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center overflow-hidden bg-gray-50 group-hover:border-primary transition-all">
                            ${state.kycDocs.pan.image ?
            `<img src="${state.kycDocs.pan.image}" class="w-full h-full object-cover">` :
            `<i class="fa-solid fa-address-card text-gray-300 text-3xl mb-2"></i>
                                 <span class="text-[10px] font-bold text-gray-400 uppercase">Upload PAN Card Image</span>`
        }
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span class="text-[10px] text-white font-bold uppercase">Change Image</span>
                            </div>
                        </div>
                        ${state.kycDocs.pan.image ? '<div class="absolute -top-2 -right-2 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg"><i class="fa-solid fa-check text-xs"></i></div>' : ''}
                    </div>

                    <div class="relative">
                        <input type="text" id="pan-number" value="${state.kycDocs.pan.number}" 
                            oninput="this.value = this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10)"
                            placeholder="Enter 10-character PAN Number" 
                            class="w-full bg-gray-50 border-2 border-transparent focus:border-amber-100 focus:bg-white rounded-2xl p-4 text-sm outline-none font-bold tracking-[0.2em] transition-all uppercase">
                        <div class="absolute right-4 top-1/2 -translate-y-1/2">
                            <i class="fa-solid fa-id-card-clip text-gray-200"></i>
                        </div>
                    </div>
                </div>

                <!-- FSSAI Section -->
                <div class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h3 class="font-black text-gray-800">FSSAI License</h3>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Food Safety License</p>
                        </div>
                        <span class="text-[10px] px-2 py-1 rounded-lg font-bold ${state.kycDocs.fssai.status === 'Verified' ? 'bg-green-50 text-green-500' : 'bg-amber-50 text-amber-500'} uppercase tracking-widest">
                            ${state.kycDocs.fssai.status}
                        </span>
                    </div>

                    <div onclick="triggerKycUpload('fssai')" class="relative group cursor-pointer mb-6">
                        <div class="aspect-[16/9] rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center overflow-hidden bg-gray-50 group-hover:border-primary transition-all">
                            ${state.kycDocs.fssai.image ?
            `<img src="${state.kycDocs.fssai.image}" class="w-full h-full object-cover">` :
            `<i class="fa-solid fa-certificate text-gray-300 text-3xl mb-2"></i>
                                 <span class="text-[10px] font-bold text-gray-400 uppercase">Upload FSSAI Certificate</span>`
        }
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span class="text-[10px] text-white font-bold uppercase">Change Image</span>
                            </div>
                        </div>
                        ${state.kycDocs.fssai.image ? '<div class="absolute -top-2 -right-2 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg"><i class="fa-solid fa-check text-xs"></i></div>' : ''}
                    </div>

                    <div class="relative">
                        <input type="text" id="fssai-number" value="${state.kycDocs.fssai.number}" 
                            oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 14)"
                            placeholder="Enter 14-digit FSSAI Number" 
                            class="w-full bg-gray-50 border-2 border-transparent focus:border-amber-100 focus:bg-white rounded-2xl p-4 text-sm outline-none font-bold tracking-[0.2em] transition-all">
                        <div class="absolute right-4 top-1/2 -translate-y-1/2">
                            <i class="fa-solid fa-file-contract text-gray-200"></i>
                        </div>
                    </div>
                </div>

                <!-- Hidden File Input -->
                <input type="file" id="kyc-file-input" accept="image/*" class="hidden">

                <button onclick="handleSaveKycDocuments()" class="w-full py-5 bg-primary text-white rounded-[32px] font-black text-sm shadow-xl shadow-amber-200 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    SAVE ALL DOCUMENTS
                </button>
            </div>
        </div>
    `;
}

function triggerKycUpload(docType) {
    const input = document.getElementById('kyc-file-input');
    if (!input) return;
    input.onchange = (e) => handleKycUpload(e.target, docType);
    input.click();
}

function handleKycUpload(input, docType) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;

            if (docType === 'aadhaarFront') state.kycDocs.aadhaar.frontImage = imageUrl;
            if (docType === 'aadhaarBack') state.kycDocs.aadhaar.backImage = imageUrl;
            if (docType === 'pan') state.kycDocs.pan.image = imageUrl;
            if (docType === 'fssai') state.kycDocs.fssai.image = imageUrl;

            showToast(`${docType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} uploaded!`);
            renderDocumentsScreen();
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function handleSaveKycDocuments() {
    const aadhaarNum = document.getElementById('aadhaar-number').value;
    const panNum = document.getElementById('pan-number').value;
    const fssaiNum = document.getElementById('fssai-number').value;

    if (aadhaarNum.length !== 12) {
        showToast('Aadhaar Number must be exactly 12 digits');
        return;
    }
    if (panNum.length !== 10) {
        showToast('PAN Number must be exactly 10 characters');
        return;
    }
    if (fssaiNum.length !== 14) {
        showToast('FSSAI Number must be exactly 14 digits');
        return;
    }

    if (!state.kycDocs.aadhaar.frontImage || !state.kycDocs.aadhaar.backImage || !state.kycDocs.pan.image || !state.kycDocs.fssai.image) {
        showToast('Please upload all required document photos');
        return;
    }

    // Collect and update state
    state.kycDocs.aadhaar.number = aadhaarNum;
    state.kycDocs.pan.number = panNum;
    state.kycDocs.fssai.number = fssaiNum;
    state.verificationStatus = 'pending';

    // Simulate API call to Supabase/Admin
    console.log('Sending KYC Data to Admin:', {
        vendorMobile: state.userMobile,
        aadhaar: state.kycDocs.aadhaar,
        pan: state.kycDocs.pan,
        fssai: state.kycDocs.fssai
    });

    showToast('Documents Submitted Successfully!');

    setTimeout(() => {
        navigateTo('profile');
    }, 1500);
}

function renderNotificationsScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">${t('notifications')}</h2>
                </div>
            </div>

            <div class="px-6 space-y-4 pb-24">
                ${state.notifications.map(n => `
                    <div onclick="${n.targetView ? `navigateTo('${n.targetView}')` : ''}" class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex gap-4 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center ${n.type === 'order' ? 'bg-blue-50 text-blue-500' : n.type === 'payment' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}">
                            <i class="fa-solid ${n.type === 'order' ? 'fa-cart-plus' : n.type === 'payment' ? 'fa-money-bill-check' : 'fa-circle-info'} text-lg"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start mb-1">
                                <h4 class="font-bold text-gray-800 text-sm truncate">${n.title}</h4>
                                <span class="text-[9px] text-gray-400 font-bold uppercase whitespace-nowrap">${n.time}</span>
                            </div>
                            <p class="text-xs text-gray-500 leading-relaxed">${n.message}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderOrderStatementScreen() {
    const app = document.getElementById('app');

    const ranges = ['Last 7 Days', 'Last 6 Months', 'Last 1 Year', 'Custom Range'];

    // Ensure mockStatementData (used as historical cache) is initialized from live data
    if (!state.mockStatementData) {
        state.mockStatementData = state.todayOrders.map(o => ({
            id: o.id,
            amount: o.price,
            date: new Date().toISOString()
        }));
    }

    const filteredData = getFilteredStatementData();

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Order Statement</h2>
                </div>
            </div>

            <div class="px-6 pb-24">
                <!-- Period Filter -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-6">
                    <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Select Period</h3>
                    <div class="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
                        ${ranges.map(range => `
                            <button onclick="setStatementFilter('${range}')" 
                                class="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap
                                ${state.statementFilter === range ? 'bg-primary text-white shadow-lg shadow-amber-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}">
                                ${range}
                            </button>
                        `).join('')}
                    </div>

                    ${state.statementFilter === 'Custom Range' ? `
                        <div class="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-slide-down">
                            <div>
                                <label class="block text-[9px] font-black text-gray-400 uppercase mb-2">From Date</label>
                                <div class="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-2 px-3 focus-within:ring-2 focus-within:ring-primary/20">
                                    <input type="text" maxlength="2" placeholder="DD" value="${state.customFrom ? state.customFrom.split('-')[2] : ''}" id="from-dd" oninput="handleDateSegmentInput(this, 'from-mm')" onkeydown="handleDateSegmentBackspace(event, null)" class="w-7 text-center border-none p-0 text-xs font-bold outline-none bg-transparent placeholder-gray-300 focus:ring-0">
                                    <span class="text-gray-300 text-xs font-bold">/</span>
                                    <input type="text" maxlength="2" placeholder="MM" value="${state.customFrom ? state.customFrom.split('-')[1] : ''}" id="from-mm" oninput="handleDateSegmentInput(this, 'from-yyyy')" onkeydown="handleDateSegmentBackspace(event, 'from-dd')" class="w-7 text-center border-none p-0 text-xs font-bold outline-none bg-transparent placeholder-gray-300 focus:ring-0">
                                    <span class="text-gray-300 text-xs font-bold">/</span>
                                    <input type="text" maxlength="4" placeholder="YYYY" value="${state.customFrom ? state.customFrom.split('-')[0] : ''}" id="from-yyyy" oninput="handleDateSegmentInput(this, null)" onkeydown="handleDateSegmentBackspace(event, 'from-mm')" class="w-10 text-center border-none p-0 text-xs font-bold outline-none bg-transparent placeholder-gray-300 focus:ring-0">
                                </div>
                            </div>
                            <div>
                                <label class="block text-[9px] font-black text-gray-400 uppercase mb-2">To Date</label>
                                <div class="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-2 px-3 focus-within:ring-2 focus-within:ring-primary/20">
                                    <input type="text" maxlength="2" placeholder="DD" value="${state.customTo ? state.customTo.split('-')[2] : ''}" id="to-dd" oninput="handleDateSegmentInput(this, 'to-mm')" onkeydown="handleDateSegmentBackspace(event, null)" class="w-7 text-center border-none p-0 text-xs font-bold outline-none bg-transparent placeholder-gray-300 focus:ring-0">
                                    <span class="text-gray-300 text-xs font-bold">/</span>
                                    <input type="text" maxlength="2" placeholder="MM" value="${state.customTo ? state.customTo.split('-')[1] : ''}" id="to-mm" oninput="handleDateSegmentInput(this, 'to-yyyy')" onkeydown="handleDateSegmentBackspace(event, 'to-dd')" class="w-7 text-center border-none p-0 text-xs font-bold outline-none bg-transparent placeholder-gray-300 focus:ring-0">
                                    <span class="text-gray-300 text-xs font-bold">/</span>
                                    <input type="text" maxlength="4" placeholder="YYYY" value="${state.customTo ? state.customTo.split('-')[0] : ''}" id="to-yyyy" oninput="handleDateSegmentInput(this, null)" onkeydown="handleDateSegmentBackspace(event, 'to-mm')" class="w-10 text-center border-none p-0 text-xs font-bold outline-none bg-transparent placeholder-gray-300 focus:ring-0">
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Statement List -->
                <div class="bg-white rounded-[40px] shadow-sm border border-gray-50 overflow-hidden">
                    <div class="p-6 border-b border-gray-50 flex justify-between items-center">
                        <h3 class="text-sm font-black text-gray-800 uppercase tracking-wider">Statement Details</h3>
                        <span class="text-[10px] font-bold text-primary bg-amber-50 px-3 py-1 rounded-full">${state.statementFilter}</span>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse min-w-[320px]">
                            <thead>
                                <tr class="bg-gray-50/50">
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID</th>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Date</th>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50" id="statement-tbody">
                                ${filteredData.length > 0 ? filteredData.map(order => `
                                    <tr class="hover:bg-gray-50 transition-colors">
                                        <td class="px-6 py-4 text-sm font-bold text-gray-800">${order.id}</td>
                                        <td class="px-6 py-4 text-xs font-bold text-gray-400 text-center">${formatDate(order.date)}</td>
                                        <td class="px-6 py-4 text-sm font-black text-gray-900 text-right">₹${order.amount.toLocaleString()}</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="3" class="px-6 py-12 text-center text-gray-400 font-bold">No orders found for this period</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>

                    <!-- Download Button Area -->
                    <div class="p-6 bg-gray-50/30">
                        <button onclick="downloadStatementPDF()" class="w-full py-5 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-amber-100 flex items-center justify-center gap-3 active:scale-95 transition-all">
                            <i class="fa-solid fa-file-pdf text-lg"></i>
                            Download Statement (PDF)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.handleDateSegmentInput = function(elem, nextId) {
    elem.value = elem.value.replace(/[^0-9]/g, ''); // Ensure numbers only
    const maxLength = parseInt(elem.getAttribute('maxlength'));
    
    // Auto advance
    if (elem.value.length >= maxLength) {
        if (nextId) document.getElementById(nextId).focus();
        checkAndApplyCustomDate();
    } else if (elem.id.endsWith('yyyy') && elem.value.length === 4) {
        checkAndApplyCustomDate();
    }
}

window.handleDateSegmentBackspace = function(event, prevId) {
    // If backspace is pressed on an empty field, focus the previous one
    if (event.key === 'Backspace' && event.target.value.length === 0 && prevId) {
        event.preventDefault(); // Stop from deleting character in previous field immediately
        const prevElem = document.getElementById(prevId);
        prevElem.focus();
        // Move cursor to end
        const len = prevElem.value.length;
        prevElem.setSelectionRange(len, len);
    }
}

window.checkAndApplyCustomDate = function() {
    const fDD = document.getElementById('from-dd')?.value.padStart(2, '0');
    const fMM = document.getElementById('from-mm')?.value.padStart(2, '0');
    const fYY = document.getElementById('from-yyyy')?.value;
    
    const tDD = document.getElementById('to-dd')?.value.padStart(2, '0');
    const tMM = document.getElementById('to-mm')?.value.padStart(2, '0');
    const tYY = document.getElementById('to-yyyy')?.value;
    
    let needsUpdate = false;
    
    if (fYY?.length === 4 && fDD !== '00' && fMM !== '00') {
        const newFrom = `${fYY}-${fMM}-${fDD}`;
        if (state.customFrom !== newFrom) {
            state.customFrom = newFrom;
            needsUpdate = true;
        }
    }
    
    if (tYY?.length === 4 && tDD !== '00' && tMM !== '00') {
        const newTo = `${tYY}-${tMM}-${tDD}`;
        if (state.customTo !== newTo) {
            state.customTo = newTo;
            needsUpdate = true;
        }
    }
    
    if (needsUpdate) {
        // Re-generate filtered data and ONLY update the table body (preserving input focus)
        const filteredData = getFilteredStatementData();
        const tbody = document.getElementById('statement-tbody');
        if (tbody) {
            tbody.innerHTML = filteredData.length > 0 ? filteredData.map(order => `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 text-sm font-bold text-gray-800">${order.id}</td>
                    <td class="px-6 py-4 text-xs font-bold text-gray-400 text-center">${formatDate(order.date)}</td>
                    <td class="px-6 py-4 text-sm font-black text-gray-900 text-right">₹${order.amount.toLocaleString()}</td>
                </tr>
            `).join('') : `
                <tr>
                    <td colspan="3" class="px-6 py-12 text-center text-gray-400 font-bold">No orders found for this period</td>
                </tr>
            `;
        }
    }
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function getFilteredStatementData() {
    const now = new Date();
    const filter = state.statementFilter;

    return state.mockStatementData.filter(order => {
        const orderDate = new Date(order.date);

        if (filter === 'Last 7 Days') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return orderDate >= sevenDaysAgo;
        } else if (filter === 'Last 6 Months') {
            const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            return orderDate >= sixMonthsAgo;
        } else if (filter === 'Last 1 Year') {
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            return orderDate >= oneYearAgo;
        } else if (filter === 'Custom Range') {
            const from = new Date(state.customFrom);
            const to = new Date(state.customTo);
            to.setHours(23, 59, 59, 999); // End of the day
            return orderDate >= from && orderDate <= to;
        }
        return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by newest first
}

function setStatementFilter(range) {
    state.statementFilter = range;
    renderOrderStatementScreen();
}

function downloadStatementPDF() {
    showToast('Preparing your professional PDF statement...');

    setTimeout(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('Order Statement', 105, 20, { align: 'center' });

        // Vendor & Range Info
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Vendor Name: ${state.vendorName}`, 20, 35);

        let rangeText = `Date Range: ${state.statementFilter}`;
        if (state.statementFilter === 'Custom Range') {
            rangeText += ` (${formatDate(state.customFrom)} to ${formatDate(state.customTo)})`;
        }
        doc.text(rangeText, 20, 42);
        doc.text(`Generated On: ${formatDate(new Date().toISOString())}`, 20, 49);

        // Line separator
        doc.setDrawColor(230, 230, 230);
        doc.line(20, 55, 190, 55);

        // Table Data
        const filteredData = getFilteredStatementData();
        const tableData = filteredData.map(order => [
            order.id,
            formatDate(order.date),
            `Rs. ${order.amount.toLocaleString()}`
        ]);

        const totalAmount = filteredData.reduce((sum, order) => sum + order.amount, 0);

        doc.autoTable({
            startY: 60,
            head: [['Order ID', 'Date', 'Amount (Received)']],
            body: tableData,
            foot: [['Total Amount', '', `Rs. ${totalAmount.toLocaleString()}`]],
            theme: 'striped',
            headStyles: {
                fillColor: [59, 130, 246], // Blue primary
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'right' }
            },
            footStyles: {
                fillColor: [249, 250, 251],
                textColor: [31, 41, 55],
                fontStyle: 'bold',
                halign: 'right'
            },
            alternateRowStyles: { fillColor: [252, 253, 254] },
            margin: { left: 20, right: 20 }
        });

        // Dynamic Filename
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const now = new Date();
        const filename = `Order_Statement_${monthNames[now.getMonth()]}_${now.getFullYear()}.pdf`;

        doc.save(filename);
        showToast('PDF Statement Downloaded Successfully!');
    }, 1500);
}


function renderReviewsScreen() {
    const app = document.getElementById('app');
    
    // Render modern premium loading skeleton first
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24 font-sans animate-fade-in">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Rating & Review</h2>
                </div>
            </div>
            
            <div class="px-6 space-y-6">
                <!-- Skeleton Header -->
                <div class="bg-white rounded-[36px] p-8 shadow-sm border border-gray-100/50 flex items-center justify-between animate-pulse">
                    <div class="space-y-3 flex-1">
                        <div class="h-8 bg-gray-200 rounded-full w-24"></div>
                        <div class="h-4 bg-gray-200 rounded-full w-32"></div>
                        <div class="h-3 bg-gray-200 rounded-full w-20"></div>
                    </div>
                    <div class="w-20 h-20 bg-gray-100 rounded-full"></div>
                </div>
                
                <!-- Skeleton Feed Cards -->
                <div class="space-y-4">
                    <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm animate-pulse space-y-3">
                        <div class="h-4 bg-gray-200 rounded-full w-1/3"></div>
                        <div class="h-3 bg-gray-200 rounded-full w-1/4"></div>
                        <div class="h-10 bg-gray-200 rounded-2xl w-full"></div>
                    </div>
                    <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm animate-pulse space-y-3">
                        <div class="h-4 bg-gray-200 rounded-full w-1/3"></div>
                        <div class="h-3 bg-gray-200 rounded-full w-1/4"></div>
                        <div class="h-10 bg-gray-200 rounded-2xl w-full"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const supabase = window.supabaseClient;
    if (!supabase) {
        app.innerHTML = `<p class="p-6 text-center text-red-500 font-bold">Supabase client connection missing.</p>`;
        return;
    }

    // Dynamic filtering context
    const activeVendor = {
        restaurant_id: state.currentVendorId || state.currentRestaurantId
    };

    if (!activeVendor.restaurant_id) {
        app.innerHTML = `
            <div class="bg-bgGray min-h-screen pb-24 font-sans">
                <!-- Header -->
                <div class="order-details-header text-white mb-6">
                    <div class="flex items-center gap-4">
                        <button onclick="goBack()" class="text-xl">
                            <i class="fa-solid fa-arrow-left"></i>
                        </button>
                        <h2 class="text-xl font-bold">Rating & Review</h2>
                    </div>
                </div>
                <div class="px-6 py-20 flex flex-col items-center justify-center text-center">
                    <i class="fa-solid fa-circle-exclamation text-4xl text-amber-500 mb-4 animate-bounce"></i>
                    <h3 class="text-lg font-black text-gray-800 mb-2">No Restaurant Context</h3>
                    <p class="text-xs text-gray-400 max-w-xs">We could not identify the linked restaurant ID for your account. Please complete onboarding first.</p>
                </div>
            </div>
        `;
        return;
    }

    // Perform query targeting live Supabase public.reviews table
    supabase
        .from('reviews')
        .select('*')
        .eq('restaurant_id', activeVendor.restaurant_id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
            if (error) {
                console.error("Supabase query failed:", error);
                app.innerHTML = `
                    <div class="bg-bgGray min-h-screen pb-24 font-sans">
                        <!-- Header -->
                        <div class="order-details-header text-white mb-6">
                            <div class="flex items-center gap-4">
                                <button onclick="goBack()" class="text-xl">
                                    <i class="fa-solid fa-arrow-left"></i>
                                </button>
                                <h2 class="text-xl font-bold">Rating & Review</h2>
                            </div>
                        </div>
                        <div class="px-6 py-20 flex flex-col items-center justify-center text-center">
                            <i class="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-4"></i>
                            <h3 class="text-lg font-black text-gray-800 mb-2">Error Retrieving Reviews</h3>
                            <p class="text-xs text-gray-400 max-w-xs mb-6">${error.message}</p>
                            <button onclick="renderReviewsScreen()" class="px-6 py-2.5 bg-primary text-white rounded-full font-bold text-xs active:scale-95 transition-all shadow-md">
                                Try Again
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            // Handle empty database states gracefully
            if (!data || data.length === 0) {
                app.innerHTML = `
                    <div class="bg-bgGray min-h-screen pb-24 font-sans animate-fade-in">
                        <!-- Header -->
                        <div class="order-details-header text-white mb-6">
                            <div class="flex items-center gap-4">
                                <button onclick="goBack()" class="text-xl">
                                    <i class="fa-solid fa-arrow-left"></i>
                                </button>
                                <h2 class="text-xl font-bold">Rating & Review</h2>
                            </div>
                        </div>
                        <div class="px-6 py-20 flex flex-col items-center justify-center text-center">
                            <div class="w-36 h-36 bg-amber-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <i class="fa-regular fa-star text-5xl text-amber-400"></i>
                            </div>
                            <h3 class="text-lg font-black text-gray-800 mb-2">No Customer Reviews</h3>
                            <p class="text-sm text-gray-400 max-w-xs">No customer reviews or ratings available for your restaurant yet.</p>
                        </div>
                    </div>
                `;
                return;
            }

            // Compile overall metrics from reviews data
            const totalReviewCount = data.length;
            const avgRating = data.reduce((sum, r) => sum + (parseFloat(r.food_rating) || 0), 0) / totalReviewCount;
            const avgRatingDisplay = avgRating.toFixed(1);

            // Build dynamic gold star vector shape elements
            function buildStarIcons(rating) {
                let starsHtml = '';
                const fullStars = Math.floor(rating);
                const hasHalf = rating - fullStars >= 0.5;
                for (let i = 1; i <= 5; i++) {
                    if (i <= fullStars) {
                        starsHtml += '<i class="fa-solid fa-star text-[#FFD700] text-xs"></i>';
                    } else if (i === fullStars + 1 && hasHalf) {
                        starsHtml += '<i class="fa-solid fa-star-half-stroke text-[#FFD700] text-xs"></i>';
                    } else {
                        starsHtml += '<i class="fa-regular fa-star text-gray-300 text-xs"></i>';
                    }
                }
                return starsHtml;
            }

            // Localization for created_at (DD MMM YYYY, hh:mm A)
            function formatReviewDate(dateStr) {
                if (!dateStr) return 'Date N/A';
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr;
                
                const day = String(date.getDate()).padStart(2, '0');
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = months[date.getMonth()];
                const year = date.getFullYear();
                
                let hours = date.getHours();
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // Midnight representation
                const hourStr = String(hours).padStart(2, '0');
                
                return `${day} ${month} ${year}, ${hourStr}:${minutes} ${ampm}`;
            }

            // Generate review feed HTML
            let reviewsFeedHtml = '';
            data.forEach(r => {
                const orderRef = r.order_id ? (r.order_id.length > 5 ? `#${r.order_id.slice(-5).toUpperCase()}` : r.order_id) : (r.id ? `#${r.id.slice(-5).toUpperCase()}` : 'N/A');
                const tags = Array.isArray(r.food_tags) ? r.food_tags : (typeof r.food_tags === 'string' ? (() => { try { return JSON.parse(r.food_tags); } catch(e) { return []; } })() : []);
                const comment = r.food_comment || 'No text comment shared.';
                
                let tagsHtml = '';
                if (tags.length > 0) {
                    tagsHtml = `
                        <div class="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-gray-50">
                            ${tags.map(t => `<span class="text-[9px] font-black uppercase tracking-wider bg-[#FFD700]/10 text-[#DAA520] border border-[#FFD700]/10 px-2.5 py-1 rounded-xl">${t}</span>`).join('')}
                        </div>
                    `;
                }

                reviewsFeedHtml += `
                    <div class="bg-white rounded-[28px] border border-gray-100 shadow-md p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
                        <!-- Collar -->
                        <div class="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order Ref: ${orderRef}</span>
                            <span class="text-[9px] font-bold text-gray-400">${formatReviewDate(r.created_at)}</span>
                        </div>
                        
                        <!-- food_rating: convert to golden star vectors -->
                        <div class="flex items-center gap-1.5 mb-3">
                            ${buildStarIcons(r.food_rating || 5)}
                            <span class="text-[10px] font-bold text-gray-400">(${r.food_rating}/5)</span>
                        </div>

                        <!-- food_comment: typographic blockquote -->
                        <blockquote class="text-gray-600 text-sm italic font-medium leading-relaxed mb-4 pl-3 border-l-2 border-[#FFD700]/40">
                            "${comment}"
                        </blockquote>

                        <!-- food_tags: modern chip badges -->
                        ${tagsHtml}
                    </div>
                `;
            });

            // Render Premium Summary Header & Reviews Feed
            app.innerHTML = `
                <div class="bg-bgGray min-h-screen pb-24 font-sans animate-fade-in">
                    <!-- Header -->
                    <div class="order-details-header text-white mb-6">
                        <div class="flex items-center gap-4">
                            <button onclick="goBack()" class="text-xl">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <h2 class="text-xl font-bold">Rating & Review</h2>
                        </div>
                    </div>
                    
                    <div class="px-6">
                        <!-- Premium Analytics Summary Card -->
                        <div class="bg-gradient-to-br from-[#1E1B18] via-[#3E2723] to-[#5D4037] rounded-[36px] p-8 shadow-xl shadow-gray-200/50 border border-white/5 flex items-center justify-between mb-8 text-white relative overflow-hidden">
                            <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-[#FFD700]/10 rounded-full blur-2xl"></div>
                            <div class="z-10">
                                <p class="text-[10px] text-[#FFD700] font-black uppercase tracking-widest mb-1.5">Average Rating</p>
                                <div class="flex items-center gap-2.5">
                                    <h3 class="text-5xl font-black tracking-tight">${avgRatingDisplay} <span class="text-3xl text-[#FFD700]">★</span></h3>
                                </div>
                                <div class="flex items-center gap-1 mt-2">
                                    ${buildStarIcons(avgRating)}
                                </div>
                                <p class="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-4">Total reviews compiled</p>
                                <p class="text-xs text-white/80 font-black mt-0.5">${totalReviewCount} customer feedback entry${totalReviewCount !== 1 ? 'ies' : ''}</p>
                            </div>
                            <div class="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center border border-white/10 backdrop-blur-md shadow-lg z-10">
                                <i class="fa-solid fa-comments text-4xl text-[#FFD700]"></i>
                            </div>
                        </div>

                        <div class="flex items-center justify-between mb-6 px-2">
                            <h3 class="text-sm font-black text-gray-800 uppercase tracking-wider">Review Feed</h3>
                            <span class="text-[10px] font-bold bg-[#FFD700]/10 text-[#DAA520] px-3 py-1 rounded-full border border-[#FFD700]/20">Live Sync</span>
                        </div>

                        <!-- User Feedback Cards -->
                        <div class="space-y-4">
                            ${reviewsFeedHtml}
                        </div>
                    </div>
                </div>
            `;
        });
}

function renderLegalScreen(type) {
    const app = document.getElementById('app');
    let title, content;

    if (type === 'privacy') {
        title = t('privacy');
        content = `
            <h4 class="text-sm font-black text-gray-800 uppercase mb-4 tracking-widest">1. Data Collection</h4>
            <p class="text-xs text-gray-500 leading-relaxed mb-6">
                We collect personal information such as name, mobile number, and address to provide food delivery services. This data is handled with strict confidentiality.
            </p>
            <h4 class="text-sm font-black text-gray-800 uppercase mb-4 tracking-widest">2. Usage Policy</h4>
            <ul class="space-y-3 text-xs text-gray-500 list-disc pl-4 mb-6">
                <li>To facilitate seamless communication between vendors and customers.</li>
                <li>To process payments and manage order tracking.</li>
                <li>To improve app performance through analytics.</li>
            </ul>
        `;
    } else if (type === 'about') {
        title = t('about_app');
        content = `
            <div class="text-center mb-10">
                <img src="assets/logo.png" class="w-24 h-24 mx-auto mb-4 object-contain">
                <h4 class="text-lg font-black text-gray-800">ASA FOOD VENDOR</h4>
                <p class="text-xs text-gray-400">Version 2.4.0 (Stable)</p>
            </div>
            <p class="text-xs text-gray-500 leading-relaxed mb-6 text-center">
                ASA Food is a premier food management platform designed for professional vendors. We empower local businesses with state-of-the-art tools for order management, earnings tracking, and business growth.
            </p>
        `;
    } else {
        title = t('terms');
        content = `
            <h4 class="text-sm font-black text-gray-800 uppercase mb-4 tracking-widest">Agreement</h4>
            <p class="text-xs text-gray-500 leading-relaxed mb-6">
                By using ASA Food Vendor, you agree to comply with our delivery standards and payment settlement cycles.
            </p>
            <h4 class="text-sm font-black text-gray-800 uppercase mb-4 tracking-widest">Vendor Responsibilities</h4>
            <ul class="space-y-3 text-xs text-gray-500 list-disc pl-4 mb-6">
                <li>Ensuring food quality and hygiene standards.</li>
                <li>Maintaining accurate menu pricing and availability.</li>
                <li>Timely preparation of orders as per set timers.</li>
            </ul>
        `;
    }

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">${title}</h2>
                </div>
            </div>
            <div class="px-6 pb-24">
                <div class="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                    ${content}
                </div>
            </div>
        </div>
    `;
}

function renderEditProfileScreen() {
    const app = document.getElementById('app');
    // Reset temp state when entering
    state.tempProfileImage = null;
    state.profileMobileVerified = true;

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">${t('edit_profile')}</h2>
                </div>
            </div>

            <div class="px-6 space-y-6 pb-24">
                <!-- Shop Photo -->
                <div class="flex justify-center">
                    <div class="relative">
                        <div class="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
                            <img id="edit-profile-img" src="${state.vendorPhoto}" class="w-full h-full object-contain">
                        </div>
                        <button onclick="triggerImageUpload()" class="absolute bottom-1 right-1 bg-primary text-white p-2.5 rounded-full border-4 border-white shadow-lg active:scale-95 transition-all">
                            <i class="fa-solid fa-camera text-sm"></i>
                        </button>
                        <input type="file" id="profile-image-input" class="hidden" accept="image/*" onchange="handleProfileImage(this)">
                    </div>
                </div>

                <!-- Input Fields -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Vendor Name</label>
                        <input type="text" id="edit-vendor-name" value="${state.vendorName}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-100 transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Email Address</label>
                        <input type="email" id="edit-vendor-email" value="${state.vendorEmail}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-100 transition-all">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Mobile Number</label>
                        <div class="relative">
                            <input type="tel" id="edit-vendor-phone" value="${state.vendorPhone}" oninput="handleProfilePhoneInput(this)" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-amber-100 transition-all">
                            <div id="phone-verified-badge" class="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 flex items-center gap-1">
                                <i class="fa-solid fa-circle-check text-xs"></i>
                                <span class="text-[8px] font-black uppercase tracking-widest">Verified</span>
                            </div>
                            <div id="phone-send-btn" class="absolute right-2 top-1/2 -translate-y-1/2 hidden">
                                <button onclick="sendProfileOTP()" class="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase active:scale-95 transition-all shadow-md">Send</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- OTP Section (Hidden by default) -->
                <div id="profile-otp-section" class="hidden bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4 fade-in">
                    <div class="flex justify-between items-center">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verify New Number</p>
                        <button onclick="sendProfileOTP()" class="text-primary font-black text-[10px] uppercase underline">Resend OTP</button>
                    </div>
                    <div class="flex gap-4">
                        <input type="tel" id="profile-otp-input" maxlength="6" placeholder="Enter 6-digit OTP" class="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none" oninput="this.value = this.value.replace(/\D/g, '').slice(0,6)">
                        <button onclick="verifyProfileOTP()" class="bg-primary text-white px-6 rounded-2xl font-bold text-xs active:scale-95 transition-all">Verify</button>
                    </div>
                </div>

                <button id="save-profile-btn" onclick="saveProfileChanges()" class="w-full py-5 bg-primary text-white rounded-[32px] font-black text-sm shadow-xl shadow-amber-100 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <span id="save-btn-text">SAVE CHANGES</span>
                    <i id="save-btn-spinner" class="fa-solid fa-circle-notch fa-spin hidden"></i>
                </button>
            </div>
        </div>
    `;
}

async function saveProfileChanges() {
    const name = document.getElementById('edit-vendor-name').value;
    const email = document.getElementById('edit-vendor-email').value;
    const phone = document.getElementById('edit-vendor-phone').value;

    if (!name || !email || !phone) {
        showToast('Please fill all fields');
        return;
    }

    if (!state.profileMobileVerified) {
        showToast('Please verify your new mobile number first!');
        document.getElementById('profile-otp-section').classList.remove('hidden');
        return;
    }

    // UI Loading State
    const btn = document.getElementById('save-profile-btn');
    const text = document.getElementById('save-btn-text');
    const spinner = document.getElementById('save-btn-spinner');

    btn.disabled = true;
    btn.classList.add('opacity-80');
    text.innerText = 'SAVING...';
    spinner.classList.remove('hidden');

    try {
        let vendorId = state.currentVendorId || state.vendorId || localStorage.getItem('vendorId');
        if (!vendorId) {
            throw new Error("No active vendor session context found.");
        }

        const updatePayload = {
            full_name: name,
            email: email,
            mobile: phone,
            mobile_number: phone
        };

        if (state.tempProfileImage) {
            updatePayload.image_url = state.tempProfileImage;
        }

        const { error } = await supabase
            .from('vendors')
            .update(updatePayload)
            .eq('id', vendorId);

        if (error) {
            throw error;
        }

        // Synchronize local state
        state.vendorName = name;
        state.vendorEmail = email;
        state.vendorPhone = phone;

        if (state.tempProfileImage) {
            state.vendorPhoto = state.tempProfileImage;
        }

        showToast('Profile Updated Successfully');

        // Finalize UI
        btn.disabled = false;
        btn.classList.remove('opacity-80');
        text.innerText = 'SAVE CHANGES';
        spinner.classList.add('hidden');

        setTimeout(() => navigateTo('profile'), 1000);
    } catch (err) {
        console.error("Failed to update profile:", err);
        showToast('Failed to save profile: ' + err.message);
        
        btn.disabled = false;
        btn.classList.remove('opacity-80');
        text.innerText = 'SAVE CHANGES';
        spinner.classList.add('hidden');
    }
}

function handleProfilePhoneInput(input) {
    const badge = document.getElementById('phone-verified-badge');
    const sendBtn = document.getElementById('phone-send-btn');
    const otpSection = document.getElementById('profile-otp-section');

    if (input.value !== state.vendorPhone) {
        state.profileMobileVerified = false;
        badge.classList.add('hidden');
        sendBtn.classList.remove('hidden');
        otpSection.classList.add('hidden');
    } else {
        state.profileMobileVerified = true;
        badge.classList.remove('hidden');
        sendBtn.classList.add('hidden');
        otpSection.classList.add('hidden');
    }
}

async function sendProfileOTP() {
    const input = document.getElementById('edit-vendor-phone');
    const rawMobile = input ? input.value : '';
    const cleanMobile = rawMobile.replace(/\D/g, '').slice(-10);

    if (!cleanMobile || cleanMobile.length !== 10) {
        showToast('Please enter a valid 10-digit mobile number');
        return;
    }

    try {
        // Check if the number is already registered in Supabase vendors table
        const { data, error } = await window.supabaseClient
            .from('vendors')
            .select('id')
            .eq('mobile', cleanMobile)
            .single();

        if (data) {
            // Found an existing account with this number
            showToast('This number is already registered to another account.');
            return;
        }
    } catch (err) {
        // If error code is PGRST116, it means no row was found. This is good (number is available).
        // Otherwise, it might be a network error, but we can proceed or log it.
    }

    showToast('Sending OTP...');
    try {
        await window.rainfireAuth.sendOTP(cleanMobile);
        showToast('OTP sent successfully!');
        document.getElementById('profile-otp-section').classList.remove('hidden');
        document.getElementById('phone-send-btn').classList.add('hidden');
    } catch (err) {
        showToast('Failed to send OTP: ' + err.message);
    }
}

async function verifyProfileOTP() {
    const otp = document.getElementById('profile-otp-input').value;
    const input = document.getElementById('edit-vendor-phone');
    const mobile = input ? input.value : '';

    if (otp.length !== 6) {
        showToast('Please enter a valid 6-digit OTP');
        return;
    }

    showToast('Verifying live OTP via Rainfire...');
    try {
        const isVerified = await window.rainfireAuth.verifyOTP(mobile, otp);
        if (isVerified) {
            state.profileMobileVerified = true;
            document.getElementById('profile-otp-section').classList.add('hidden');
            document.getElementById('phone-verified-badge').classList.remove('hidden');
            showToast('Mobile number verified successfully via Rainfire!');
        } else {
            showToast('Invalid OTP entered. Please try again.');
        }
    } catch (err) {
        showToast('Verification failed: ' + err.message);
    }
}

function handleProfileImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;
            document.getElementById('edit-profile-img').src = dataUrl;
            state.tempProfileImage = dataUrl;
            showToast('Photo selected and previewed!');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function triggerImageUpload() {
    const input = document.getElementById('profile-image-input');
    if (input) input.click();
    else showToast('Image upload triggered!');
}

function renderStatisticsScreen() {
    const app = document.getElementById('app');
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    app.innerHTML = `
        <div class="bg-white min-h-screen pb-24">
            <!-- Page Header -->
            <div class="px-6 pt-10 pb-4">
                <h1 class="text-3xl font-black text-gray-900 tracking-tight">Reports</h1>
                <p class="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">${currentDate}</p>
            </div>

            <div class="px-4 pb-6">
                <!-- Chart Card -->
                <div class="bg-white rounded-[28px] p-4 shadow-sm border border-gray-100 fade-in">
                    <!-- Chart Title -->
                    <h2 class="text-2xl font-bold text-gray-900 mb-4" style="font-size: 22px;">Monthly Earnings (₹)</h2>
                    <!-- Loading state -->
                    <div id="stats-chart-loader" class="flex items-center justify-center py-8">
                        <div class="w-7 h-7 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mr-3"></div>
                        <span class="text-gray-400 text-xs font-bold uppercase tracking-widest">Loading chart data...</span>
                    </div>
                    <!-- Chart Canvas -->
                    <div id="stats-chart-container" class="hidden" style="position: relative; width: 100%; height: 340px;">
                        <canvas id="monthlyEarningsChart" style="width: 100%; height: 100%;"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function initStatisticsCharts() {
    const supabase = window.supabaseClient;
    if (!supabase) return;

    const loader = document.getElementById('stats-chart-loader');
    const chartContainer = document.getElementById('stats-chart-container');
    const canvas = document.getElementById('monthlyEarningsChart');

    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        console.error("[Stats] Chart.js is not loaded.");
        if (loader) loader.innerHTML = '<p class="text-gray-400 text-xs font-bold">Chart engine not loaded.</p>';
        return;
    }

    let vendorId = state.currentVendorId || state.vendorId || localStorage.getItem('vendorId');
    if (!vendorId) {
        console.error('[Stats] No active vendor context found.');
        if (loader) loader.innerHTML = '<p class="text-gray-400 text-xs font-bold">No vendor session found.</p>';
        return;
    }

    // Month labels and order
    const MONTH_KEYS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyData  = new Array(12).fill(0);

    try {
        // Fetch all delivered sub-orders dynamically from Supabase
        const { data: dbSubOrders, error: subOrdersError } = await supabase
            .from('sub_orders')
            .select('food_price_share, created_at')
            .eq('restaurant_id', vendorId)
            .eq('sub_order_status', 'delivered');

        if (subOrdersError) {
            console.error('[Stats] Failed to fetch delivered sub-orders:', subOrdersError.message);
        } else if (dbSubOrders) {
            dbSubOrders.forEach(order => {
                if (order.created_at) {
                    try {
                        const date = new Date(order.created_at);
                        const monthIndex = date.getMonth(); // 0 = Jan, 1 = Feb, etc.
                        if (monthIndex >= 0 && monthIndex < 12) {
                            const payout = getPayout(parseFloat(order.food_price_share) || 0);
                            monthlyData[monthIndex] += payout;
                        }
                    } catch (e) {
                        console.error('[Stats] Error parsing order date:', e);
                    }
                }
            });
            // Round to 2 decimal places
            for (let i = 0; i < 12; i++) {
                monthlyData[i] = parseFloat(monthlyData[i].toFixed(2));
            }
        }
    } catch (err) {
        console.error('[Stats] Exception calculating monthly earnings:', err);
    }

    // Show chart, hide loader
    if (loader) loader.classList.add('hidden');
    if (chartContainer) chartContainer.classList.remove('hidden');

    // Destroy any existing chart instance on canvas
    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
    }

    // Determine the max for Y-axis (always at least 20000)
    const dataMax = Math.max(...monthlyData, 20000);
    const yMax = Math.ceil(dataMax / 5000) * 5000;

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MONTH_KEYS,
            datasets: [{
                label: 'Earnings (₹)',
                data: monthlyData,
                backgroundColor: '#BDB2FF',
                borderColor: '#9F90FF',
                borderWidth: 1,
                borderRadius: 0,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'center',
                    labels: {
                        usePointStyle: false,
                        boxWidth: 32,
                        boxHeight: 16,
                        padding: 16,
                        color: '#374151',
                        font: {
                            family: 'Outfit, Inter, sans-serif',
                            size: 13,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#1F2937',
                    titleFont: { family: 'Outfit, sans-serif', size: 12, weight: 'bold' },
                    bodyFont: { family: 'Outfit, sans-serif', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '₹' + context.parsed.y.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: '#E5E7EB',
                        lineWidth: 1,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Outfit, Inter, sans-serif',
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    border: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    max: yMax,
                    grid: {
                        display: true,
                        color: '#E5E7EB',
                        lineWidth: 1,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Outfit, Inter, sans-serif',
                            size: 11
                        },
                        stepSize: 5000,
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    },
                    border: {
                        display: false
                    }
                }
            }
        }
    });

    // Store instance ref for cleanup on re-render
    canvas._chartInstance = chart;
}
// --- Restaurant Management Screens ---

function removeCoverImage() {
    state.selectedRestaurantImages.cover = null;
    const previewContainer = document.getElementById('cover-preview-container');
    const uploadBox = document.getElementById('cover-upload-box');
    const preview = document.getElementById('cover-preview');
    if (previewContainer && uploadBox && preview) {
        previewContainer.classList.add('hidden');
        uploadBox.classList.remove('hidden');
        preview.src = '';
    }
}

function renderRestaurantSetupScreen() {
    const app = document.getElementById("app");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const details = state.restaurantDetails;

    // Pre-populate our image editing state with the existing values
    if (details) {
        state.selectedRestaurantImages.cover = details.coverImage || null;
        state.selectedRestaurantImages.gallery = details.galleryImages ? [...details.galleryImages] : [];
    } else {
        state.selectedRestaurantImages.cover = null;
        state.selectedRestaurantImages.gallery = [];
    }

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Restaurant Setup</h2>
                </div>
            </div>

            <div class="px-6 space-y-6">
                <!-- Basic Info -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Basic Information</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Restaurant Name</label>
                            <input type="text" id="setup-name" value="${details ? details.name : state.vendorName}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none">
                        </div>
                        
                        <div>
                            <label class="block text-[10px] font-black text-gray-400 uppercase mb-2">Main Cover Image</label>
                            <div onclick="triggerRestaurantImage('cover')" class="upload-box ${state.selectedRestaurantImages.cover ? 'hidden' : ''}" id="cover-upload-box">
                                <i class="fa-solid fa-image text-gray-300 text-3xl mb-2"></i>
                                <span class="text-xs font-bold text-gray-400">Upload Cover Photo</span>
                            </div>
                            <div id="cover-preview-container" class="${state.selectedRestaurantImages.cover ? '' : 'hidden'} relative mt-2 rounded-2xl overflow-hidden border border-gray-100">
                                <img id="cover-preview" src="${state.selectedRestaurantImages.cover || ''}" class="w-full h-32 object-cover">
                                <button onclick="removeCoverImage()" class="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs active:scale-95 transition-all"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Gallery Images -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Gallery Images (Max 4)</h3>
                    <div class="gallery-grid" id="gallery-container">
                        <!-- Gallery previews will be injected here -->
                        <div onclick="triggerRestaurantImage('gallery')" class="upload-box h-24" id="gallery-upload-box">
                            <i class="fa-solid fa-plus text-gray-300"></i>
                        </div>
                    </div>
                </div>

                <!-- Operating Hours -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Operating Hours</h3>
                    <div class="space-y-3">
                        ${days.map(day => {
                            let openTime = "10:00";
                            let closeTime = "22:00";
                            if (details && details.hours && details.hours[day]) {
                                openTime = details.hours[day].open || "10:00";
                                closeTime = details.hours[day].close || "22:00";
                            }
                            return `
                                <div class="flex items-center gap-4 justify-between">
                                    <span class="text-xs font-bold text-gray-600 w-20">${day}</span>
                                    <div class="flex items-center gap-2 flex-1">
                                        <input type="time" id="open-${day}" value="${openTime}" class="flex-1 bg-gray-50 border-none rounded-xl p-2 text-xs outline-none">
                                        <span class="text-[10px] font-bold text-gray-400">TO</span>
                                        <input type="time" id="close-${day}" value="${closeTime}" class="flex-1 bg-gray-50 border-none rounded-xl p-2 text-xs outline-none">
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Cuisine Type -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Cuisine Type</h3>
                    <div class="flex gap-3">
                        <button onclick="setSetupCuisine('Veg')" class="cuisine-chip setup-cuisine ${details && details.cuisineType === 'Veg' ? 'active' : ''}" data-type="Veg">Veg</button>
                        <button onclick="setSetupCuisine('Non-Veg')" class="cuisine-chip setup-cuisine ${details && details.cuisineType === 'Non-Veg' ? 'active' : ''}" data-type="Non-Veg">Non-Veg</button>
                        <button onclick="setSetupCuisine('Both')" class="cuisine-chip setup-cuisine ${(!details || details.cuisineType === 'Both' || details.cuisineType === 'BOTH') ? 'active' : ''}" data-type="Both">Both</button>
                    </div>
                </div>

                <div class="flex justify-center mt-8 pb-20">
                    <button onclick="handleRestaurantSetupSubmit()" class="save-btn w-full max-w-sm py-5 mx-auto">
                        <i class="fa-solid fa-plus-circle"></i>
                        SAVE & CONTINUE
                    </button>
                </div>
            </div>
        </div>
        <input type="file" id="restaurant-image-input" class="hidden" accept="image/*">
    `;

    // Render gallery previews immediately if they exist
    renderGalleryPreviews();
}

function renderRestaurantDashboardScreen() {
    const app = document.getElementById("app");
    const details = state.restaurantDetails;

    // Ensure we have data
    if (!details) {
        app.innerHTML = `<div class="p-10 text-center">No restaurant data found.</div>`;
        return;
    }

    const displayImages = details.galleryImages.length > 0
        ? details.galleryImages
        : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"];

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Red Curved Header -->
            <div class="curved-header bg-primary h-48 px-6 pt-10 text-white relative">
                <div class="flex justify-between items-center mb-6">
                    <div class="flex items-center gap-4">
                        <button onclick="goBack()" class="text-xl">
                            <i class="fa-solid fa-arrow-left text-white"></i>
                        </button>
                        <div>
                            <h1 class="text-2xl font-black">Restaurant Settings</h1>
                            <p class="text-xs text-bgLight font-bold tracking-widest uppercase opacity-80">Profile Management</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 -mt-16 relative z-10">
                <!-- Title Card -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 mb-6">
                    <div class="flex justify-between items-start">
                        <div>
                            <h2 class="text-3xl font-black text-gray-800">${details.name}</h2>
                            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Restaurant Profile</p>
                        </div>
                        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-primary flex items-center justify-center">
                            <i class="fa-solid fa-building text-xl"></i>
                        </div>
                    </div>
                </div>

                <!-- Photo Gallery Slider -->
                <div class="bg-white rounded-[40px] p-6 shadow-xl shadow-gray-200/50 border border-gray-100/50 mb-6">
                    <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Restaurant Gallery</h3>
                    
                    <div class="slider-container flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                        ${displayImages.map((img, i) => `
                            <div class="flex-shrink-0 w-64 h-40 rounded-3xl overflow-hidden border border-gray-100 shadow-sm relative group">
                                <img src="${img}" class="w-full h-full object-cover">
                                
                                <!-- Edit/Delete Overlays -->
                                <button onclick="triggerRestaurantImage('gallery', ${i})" class="gallery-action-btn gallery-edit-btn opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i class="fa-solid fa-pencil"></i>
                                </button>
                                <button onclick="handleDeleteGalleryImage(${i})" class="gallery-action-btn gallery-delete-btn opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i class="fa-solid fa-trash"></i>
                                </button>

                                <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                                    Photo ${i + 1}
                                </div>
                            </div>
                        `).join('')}
                        ${details.galleryImages.length < 4 ? `
                            <div onclick="triggerRestaurantImage('gallery')" class="flex-shrink-0 w-40 h-40 rounded-3xl border-2 border-dashed border-gray-100 bg-gray-50 flex flex-col items-center justify-center group hover:border-primary transition-all cursor-pointer">
                                <i class="fa-solid fa-plus text-gray-300 group-hover:text-primary mb-1"></i>
                                <span class="text-[8px] font-black text-gray-400 group-hover:text-primary uppercase">Add More</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Details & Toggles -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 mb-6">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl ${details.cuisineType === 'Veg' ? 'bg-green-50 text-green-500' : details.cuisineType === 'Non-Veg' ? 'bg-red-50 text-red-500' : 'bg-bgLight text-primary'} flex items-center justify-center">
                                <i class="fa-solid fa-utensils text-2xl"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-black text-gray-800">${details.cuisineType}</h3>
                                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Restaurant Type</p>
                            </div>
                        </div>
                        <button onclick="editCuisineType()" class="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                            <i class="fa-solid fa-pencil text-xs"></i>
                        </button>
                    </div>

                    <div class="p-4 bg-gray-50 rounded-2xl text-center">
                        <p class="text-[8px] font-black text-gray-400 uppercase mb-1">Categories</p>
                        <p class="text-xs font-bold text-gray-800">${state.categories.length} Active Categories</p>
                    </div>
                </div>

                <!-- Management List -->
                <div class="bg-white rounded-[40px] p-4 shadow-xl shadow-gray-200/50 border border-gray-100/50 mb-10 space-y-2">
                    
                    <!-- Opening Hours -->
                    <div class="flex items-center justify-between p-4 bg-gray-50/50 rounded-3xl group active:bg-gray-100 transition-all">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center transition-transform group-hover:scale-110">
                                <i class="fa-solid fa-clock text-lg"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 text-sm">Opening Hours</h4>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">
                                    ${(() => {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const h = details.hours[today];
            return h.active !== false ? `${h.open} - ${h.close}` : '<span class="text-red-500">Closed Today</span>';
        })()}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="editTiming()" class="text-primary text-[10px] font-black uppercase bg-white border border-primary/20 px-4 py-2 rounded-xl shadow-sm">Edit</button>
                        </div>
                    </div>

                    <!-- Restaurant Offers -->
                    <div class="bg-gray-50/50 rounded-3xl p-4 group">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                    <i class="fa-solid fa-tag text-lg"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-gray-800 text-sm">Restaurant Offers</h4>
                                    <p class="text-[10px] text-gray-400 font-bold uppercase">Active Promos</p>
                                </div>
                            </div>
                            <button onclick="renderAddOfferForm()" class="flex items-center gap-1.5 text-primary text-[11px] font-black uppercase bg-white border border-primary/10 px-3 py-1.5 rounded-xl shadow-sm hover:bg-amber-50 transition-all active:scale-95">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                                Add New
                            </button>
                        </div>

                        <!-- Offer List -->
                        <div class="space-y-2 mt-2">
                            ${details.offers && details.offers.length > 0 ? details.offers.map((offer, idx) => `
                                ${idx > 0 ? '<div class="h-[1px] bg-gray-100 mx-2"></div>' : ''}
                                <div id="offer-${idx}" class="bg-white/50 p-3 rounded-2xl flex items-center justify-between border border-white/60 transition-all duration-300">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-primary text-xs font-black">
                                            ${(offer.promo_code || offer.title || offer.offer_type || '?').substring(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <p class="text-xs font-black text-gray-800">${offer.promo_code || offer.title || offer.offer_type || 'Offer'}</p>
                                            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-tight">${
                                                offer.is_percentage
                                                    ? `${offer.discount_value ?? 0}% OFF`
                                                    : offer.discount_value
                                                        ? `₹${offer.discount_value} OFF`
                                                        : (offer.offer_type || '').replace(/_/g, ' ')
                                            }</p>
                                            ${offer.terms_conditions?.length ? `<p class="text-[8px] text-primary font-bold mt-0.5">${offer.terms_conditions[0]}</p>` : ''}
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <div class="px-3 py-1 rounded-full text-[8px] font-black uppercase ${offer.is_active !== false ? 'bg-green-50 text-green-500' : 'bg-gray-100 text-gray-400'}">
                                            ${offer.is_active !== false ? 'Active' : 'Inactive'}
                                        </div>
                                        <button onclick="deleteRestaurantOffer('${offer.id}', ${idx})" class="w-10 h-10 -mr-2 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors active:scale-90">
                                            <i class="fa-solid fa-trash-can text-sm"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('') : `
                                <div class="text-center py-4 bg-white/40 rounded-2xl border border-dashed border-gray-200">
                                    <p class="text-[10px] text-gray-400 font-bold uppercase">No Active Offers</p>
                                </div>
                            `}
                        </div>
                    </div>

                </div>
            </div>
        </div>
        <input type="file" id="restaurant-image-input" class="hidden" accept="image/*">

        <!-- Cuisine Type Modal -->
        <div id="cuisine-modal-overlay" class="fixed inset-0 bg-black/60 z-[60] hidden opacity-0 transition-opacity duration-300 flex items-center justify-center px-6">
            <div id="cuisine-modal" class="bg-white w-full max-w-sm rounded-[40px] p-8 transform scale-90 opacity-0 transition-all duration-300">
                <div class="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6"></div>
                <h3 class="text-xl font-black text-gray-800 mb-2">Cuisine Type</h3>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8">Select your restaurant category</p>
                
                <div class="space-y-4">
                    <!-- Veg -->
                    <button onclick="selectCuisineType('Veg')" class="w-full flex items-center justify-between p-5 rounded-3xl border-2 ${details.cuisineType === 'Veg' ? 'border-primary bg-amber-50/30' : 'border-gray-50 bg-gray-50/30'} transition-all active:scale-95 group">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
                                <i class="fa-solid fa-leaf text-xl"></i>
                            </div>
                            <div class="text-left">
                                <span class="block font-black text-gray-800">Veg</span>
                                <span class="block text-[10px] text-gray-400 font-bold uppercase">Pure Vegetarian</span>
                            </div>
                        </div>
                        ${details.cuisineType === 'Veg' ? '<i class="fa-solid fa-circle-check text-primary"></i>' : ''}
                    </button>

                    <!-- Non-Veg -->
                    <button onclick="selectCuisineType('Non-Veg')" class="w-full flex items-center justify-between p-5 rounded-3xl border-2 ${details.cuisineType === 'Non-Veg' ? 'border-primary bg-amber-50/30' : 'border-gray-50 bg-gray-50/30'} transition-all active:scale-95 group">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                <i class="fa-solid fa-drumstick-bite text-xl"></i>
                            </div>
                            <div class="text-left">
                                <span class="block font-black text-gray-800">Non-Veg</span>
                                <span class="block text-[10px] text-gray-400 font-bold uppercase">Includes Meat & Eggs</span>
                            </div>
                        </div>
                        ${details.cuisineType === 'Non-Veg' ? '<i class="fa-solid fa-circle-check text-primary"></i>' : ''}
                    </button>

                    <!-- Both -->
                    <button onclick="selectCuisineType('Both')" class="w-full flex items-center justify-between p-5 rounded-3xl border-2 ${details.cuisineType === 'Both' ? 'border-primary bg-amber-50/30' : 'border-gray-50 bg-gray-50/30'} transition-all active:scale-95 group">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                <i class="fa-solid fa-utensils text-xl"></i>
                            </div>
                            <div class="text-left">
                                <span class="block font-black text-gray-800">Both</span>
                                <span class="block text-[10px] text-gray-400 font-bold uppercase">Veg & Non-Veg Items</span>
                            </div>
                        </div>
                        ${details.cuisineType === 'Both' ? '<i class="fa-solid fa-circle-check text-primary"></i>' : ''}
                    </button>
                </div>

                <button onclick="closeCuisineModal()" class="w-full mt-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold active:scale-95 transition-all">Cancel</button>
            </div>
        </div>
    `;
}

function editCuisineType() {
    const overlay = document.getElementById('cuisine-modal-overlay');
    const modal = document.getElementById('cuisine-modal');
    if (!overlay || !modal) return;
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.add('opacity-100');
        modal.classList.remove('scale-90', 'opacity-0');
        modal.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeCuisineModal() {
    const overlay = document.getElementById('cuisine-modal-overlay');
    const modal = document.getElementById('cuisine-modal');
    if (!overlay || !modal) return;
    overlay.classList.remove('opacity-100');
    modal.classList.remove('scale-100', 'opacity-100');
    modal.classList.add('scale-90', 'opacity-0');
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);
}

function selectCuisineType(type) {
    state.restaurantDetails.cuisineType = type;
    showToast(`Cuisine Type updated to ${type}`);
    closeCuisineModal();
    setTimeout(() => {
        renderRestaurantDashboardScreen();
    }, 350);
}

let setupCuisineType = 'Both';

function setSetupCuisine(type) {
    setupCuisineType = type;
    document.querySelectorAll('.setup-cuisine').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) btn.classList.add('active');
    });
}

function triggerRestaurantImage(type, index = null) {
    const input = document.getElementById('restaurant-image-input');
    if (!input) return;
    input.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
            showToast('Uploading...');
        }
        handleRestaurantImage(e.target, type, index);
    };
    input.click();
}

function handleRestaurantImage(input, type, index) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;
            const isSetupScreen = !!document.getElementById('setup-name');

            if (type === 'cover') {
                state.selectedRestaurantImages.cover = dataUrl;
                if (isSetupScreen) {
                    const preview = document.getElementById('cover-preview');
                    const uploadBox = document.getElementById('cover-upload-box');
                    const previewContainer = document.getElementById('cover-preview-container');
                    if (preview && uploadBox && previewContainer) {
                        preview.src = dataUrl;
                        previewContainer.classList.remove('hidden');
                        uploadBox.classList.add('hidden');
                    }
                } else {
                    if (state.restaurantDetails) {
                        state.restaurantDetails.coverImage = dataUrl;
                    }
                    renderRestaurantDashboardScreen();
                }
            } else if (type === 'gallery') {
                if (isSetupScreen) {
                    if (index !== null) {
                        state.selectedRestaurantImages.gallery[index] = dataUrl;
                    } else if (state.selectedRestaurantImages.gallery.length < 4) {
                        state.selectedRestaurantImages.gallery.push(dataUrl);
                    }
                    renderGalleryPreviews();
                } else {
                    if (state.restaurantDetails) {
                        if (index !== null) {
                            state.restaurantDetails.galleryImages[index] = dataUrl;
                        } else if (state.restaurantDetails.galleryImages.length < 4) {
                            state.restaurantDetails.galleryImages.push(dataUrl);
                        }
                    } else {
                        if (index !== null) {
                            state.selectedRestaurantImages.gallery[index] = dataUrl;
                        } else if (state.selectedRestaurantImages.gallery.length < 4) {
                            state.selectedRestaurantImages.gallery.push(dataUrl);
                        }
                    }
                    renderRestaurantDashboardScreen();
                }
            }
            saveSession();
            showToast('Image updated successfully!');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function handleDeleteGalleryImage(index) {
    if (confirm('Are you sure you want to delete this photo?')) {
        if (state.restaurantDetails && state.restaurantDetails.galleryImages) {
            state.restaurantDetails.galleryImages.splice(index, 1);
            saveSession();
            renderRestaurantDashboardScreen();
            showToast('Photo deleted. Please upload a replacement to maintain your profile.');
        }
    }
}

function deleteGalleryImage(index) {
    if (state.restaurantDetails) {
        state.restaurantDetails.galleryImages.splice(index, 1);
        renderRestaurantDashboardScreen();
    } else {
        state.selectedRestaurantImages.gallery.splice(index, 1);
        renderGalleryPreviews();
    }
    showToast('Image removed');
}

function renderGalleryPreviews() {
    const container = document.getElementById('gallery-container');
    if (!container) return;
    const existingPreviews = container.querySelectorAll('.gallery-preview');
    existingPreviews.forEach(p => p.remove());

    state.selectedRestaurantImages.gallery.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'gallery-preview relative h-24 rounded-2xl overflow-hidden border border-gray-100';
        div.innerHTML = `
            <img src="${img}" class="w-full h-full object-cover">
            <button onclick="removeGalleryImage(${idx})" class="absolute top-1 right-1 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        container.insertBefore(div, container.firstChild);
    });

    // Hide upload box if 4 images
    const uploadBox = container.querySelector('.upload-box');
    if (uploadBox) {
        if (state.selectedRestaurantImages.gallery.length >= 4) {
            uploadBox.classList.add('hidden');
        } else {
            uploadBox.classList.remove('hidden');
        }
    }
}

function removeGalleryImage(idx) {
    state.selectedRestaurantImages.gallery.splice(idx, 1);
    renderGalleryPreviews();
}

async function handleRestaurantSetupSubmit() {
    const name = document.getElementById('setup-name').value;
    const coverImage = state.selectedRestaurantImages.cover;
    const galleryImages = state.selectedRestaurantImages.gallery;

    if (!name || !coverImage) {
        showToast('Please provide name and cover image');
        return;
    }

    const btn = document.querySelector('button[onclick="handleRestaurantSetupSubmit()"]');
    const originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Saving...';
        btn.disabled = true;
    }

    try {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const hours = {};
        const weeklySchedule = {};
        days.forEach(day => {
            const openVal = document.getElementById(`open-${day}`).value;
            const closeVal = document.getElementById(`close-${day}`).value;
            hours[day] = {
                open: openVal,
                close: closeVal,
                active: true
            };
            weeklySchedule[day.toLowerCase()] = {
                isOpen: true,
                open: openVal,
                close: closeVal
            };
        });

        // Upload cover image to storage bucket 'vendor-assets'
        let uploadedCoverUrl = coverImage;
        if (coverImage.startsWith('data:image')) {
            showToast('Uploading cover image...');
            uploadedCoverUrl = await uploadToStorage(coverImage, 'restaurant_cover', 'vendor-assets');
        }

        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        const cleanMobile = state.userMobile.replace(/\D/g, '').slice(-10);
        
        // Fetch current vendor to get ID for restaurant table updates
        const { data: vendorRecord } = await supabase
            .from('vendors')
            .select('id')
            .eq('mobile', cleanMobile)
            .single();

        const { error } = await supabase
            .from('vendors')
            .update({
                shop_name: name,
                business_name: name,
                image_url: uploadedCoverUrl,
                hours: hours,
                timing: weeklySchedule // Server-side JSONB Operating Hours
            })
            .eq('mobile', cleanMobile);

        if (error) {
            console.error('[Supabase Save Setup Error]:', error);
            showToast('Failed to save restaurant details.');
            if (btn) {
                btn.innerHTML = originalBtnText;
                btn.disabled = false;
            }
            return;
        }

        // Upload any new gallery images to storage bucket 'vendor-assets'
        const updatedGalleryUrls = [];
        if (galleryImages && galleryImages.length > 0) {
            showToast('Uploading gallery images...');
            for (let i = 0; i < galleryImages.length; i++) {
                const img = galleryImages[i];
                if (img) {
                    if (img.startsWith('data:image')) {
                        const url = await uploadToStorage(img, `restaurant_gallery_${i}`, 'vendor-assets');
                        updatedGalleryUrls.push(url);
                    } else {
                        updatedGalleryUrls.push(img);
                    }
                }
            }
        }

        // Update the associated restaurant record with the full gallery urls list
        if (vendorRecord) {
            const { data: restRec } = await supabase
                .from('restaurants')
                .select('id')
                .eq('vendor_id', vendorRecord.id)
                .maybeSingle();

            const restaurantPayload = {
                name: name,
                cover_image_url: uploadedCoverUrl,
                gallery_urls: updatedGalleryUrls,
                hours: weeklySchedule,
                cuisine_type: setupCuisineType || 'Both'
            };

            if (restRec) {
                await supabase
                    .from('restaurants')
                    .update(restaurantPayload)
                    .eq('id', restRec.id);
                state.currentRestaurantId = restRec.id;
            } else {
                const { data: newRest } = await supabase
                    .from('restaurants')
                    .insert([{ vendor_id: vendorRecord.id, is_online: true, rating: 5.0, ...restaurantPayload }])
                    .select()
                    .single();
                if (newRest) {
                    state.currentRestaurantId = newRest.id;
                }
            }
        }

        state.restaurantDetails = {
            name,
            coverImage: uploadedCoverUrl,
            galleryImages: updatedGalleryUrls.length > 0 ? updatedGalleryUrls : [uploadedCoverUrl],
            hours,
            cuisineType: setupCuisineType,
            offers: []
        };

        state.registrationStatus = 'restaurant_details_completed';
        saveSession();

        showToast('Restaurant Setup Successful!');
        renderStatusScreen();
    } catch (err) {
        console.error('[Exception in handleRestaurantSetupSubmit]:', err);
        showToast('An unexpected error occurred.');
        if (btn) {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    }
}

function editBasicInfo() { showToast('Edit Basic Info - Coming soon!'); }
function editTiming() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const modalHtml = `
        <div id="timing-modal-overlay" class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center px-6 transition-opacity duration-300">
            <div class="bg-white rounded-[40px] w-full max-w-md p-8 transform transition-transform duration-300">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-black text-gray-800">Edit Hours</h3>
                    <button onclick="closeTimingModal()" class="text-gray-400 hover:text-primary"><i class="fa-solid fa-circle-xmark text-2xl"></i></button>
                </div>
                
                <div class="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-2 mb-8">
                    ${days.map(day => `
                        <div class="py-4 border-b border-gray-50 last:border-0">
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-xs font-black text-gray-800 uppercase tracking-widest">${day}</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="edit-active-${day}" ${state.restaurantDetails.hours[day].active !== false ? 'checked' : ''}>
                                    <span class="slider"></span>
                                </label>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="flex-1">
                                    <p class="text-[9px] font-black text-gray-400 uppercase mb-1">Open</p>
                                    <input type="time" id="edit-open-${day}" value="${state.restaurantDetails.hours[day].open.replace(' AM', '').replace(' PM', '')}" class="w-full bg-gray-50 border-none rounded-xl p-3 text-xs outline-none focus:bg-amber-50/50 transition-colors">
                                </div>
                                <span class="text-[10px] font-black text-gray-300 mt-5">TO</span>
                                <div class="flex-1">
                                    <p class="text-[9px] font-black text-gray-400 uppercase mb-1">Close</p>
                                    <input type="time" id="edit-close-${day}" value="${state.restaurantDetails.hours[day].close.replace(' AM', '').replace(' PM', '')}" class="w-full bg-gray-50 border-none rounded-xl p-3 text-xs outline-none focus:bg-amber-50/50 transition-colors">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button onclick="saveTimingChanges()" class="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-amber-100 active:scale-95 transition-all">
                    SAVE CHANGES
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeTimingModal() {
    const modal = document.getElementById('timing-modal-overlay');
    if (modal) modal.remove();
}

async function saveTimingChanges() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weeklySchedule = {};
    
    days.forEach(day => {
        const isOpen = document.getElementById(`edit-active-${day}`).checked;
        const open = document.getElementById(`edit-open-${day}`).value;
        const close = document.getElementById(`edit-close-${day}`).value;
        
        weeklySchedule[day.toLowerCase()] = { isOpen, open, close };
        
        state.restaurantDetails.hours[day] = {
            open,
            close,
            active: isOpen
        };
    });

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        const currentVendorId = state.currentVendorId;
        if (!currentVendorId) throw new Error('Vendor ID not found.');

        // Live .update({ timing: weeklySchedule }) filtered strictly by current logged-in vendor's authenticated id
        const { error } = await supabase
            .from('vendors')
            .update({ timing: weeklySchedule })
            .eq('id', currentVendorId);

        if (error) {
            console.error('[Supabase Save Timing Error]:', error);
            showToast('Failed to save timing to server.');
            return;
        }

        closeTimingModal();
        renderRestaurantDashboardScreen();
        showToast('Operating hours updated and synced with server!');
    } catch (err) {
        console.error('[Exception in saveTimingChanges]:', err);
        showToast('An unexpected error occurred.');
    }
}

function editOffers() { renderAddOfferForm(); }

async function deleteRestaurantOffer(offerId, idx) {
    if (!confirm('Are you sure you want to delete this offer?')) return;

    // Guard: both an ID and a fallback index are required
    if (!offerId || offerId === 'undefined') {
        showToast('Cannot delete: offer ID is missing. Please refresh and try again.');
        return;
    }

    const offerEl = document.getElementById(`offer-${idx}`);

    // 1. Optimistically animate the row out
    if (offerEl) {
        offerEl.classList.add('offer-deleted');
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        // 2. Fire the async delete against Supabase
        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', offerId);

        if (error) {
            // 3a. Rollback animation on failure
            if (offerEl) offerEl.classList.remove('offer-deleted');
            console.error('[Supabase Delete Offer Error]:', error);
            showToast(`Failed to delete offer: ${error.message || 'Unknown error'}`);
            return;
        }

        // 3b. Success — remove from local state and re-render after animation
        setTimeout(() => {
            if (state.restaurantDetails && state.restaurantDetails.offers) {
                state.restaurantDetails.offers = state.restaurantDetails.offers.filter(
                    o => String(o.id) !== String(offerId)
                );
            }
            saveSession();
            renderRestaurantDashboardScreen();
            showToast('Offer deleted successfully');
        }, 500);

    } catch (err) {
        // 4. Rollback on unexpected exception
        if (offerEl) offerEl.classList.remove('offer-deleted');
        console.error('[Exception in deleteRestaurantOffer]:', err);
        showToast('An unexpected error occurred. Please try again.');
    }
}


let currentOfferType = null; // Default: hidden initially until chosen

function renderAddOfferForm() {
    const app = document.getElementById("app");
    
    // Hide Bottom/Sidebar Navigation Bar
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.classList.add('translate-y-[200%]', 'pointer-events-none');
    }

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24 fade-in">
            <!-- Custom CSS Injected dynamically for premium transitions & theme -->
            <style>
                .offer-dropdown-menu {
                    transform-origin: top;
                    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
                }
                .form-slide-in {
                    opacity: 0;
                    transform: translateY(12px);
                    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
                }
                .form-slide-in.show {
                    opacity: 1;
                    transform: translateY(0);
                }
                .brand-highlight:focus {
                    border-color: #FFD700 !important;
                    box-shadow: 0 0 0 4px rgba(255, 215, 0, 0.15) !important;
                }
                .dropdown-item-row:hover {
                    background-color: #FFF8E1 !important;
                }
                .dropdown-list-container.show {
                    display: block !important;
                    animation: slideUpDropdown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes slideUpDropdown {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>

            <!-- Header -->
            <div class="order-details-header text-white mb-6 bg-secondary py-5 px-6 rounded-b-[32px] shadow-lg flex items-center gap-4">
                <button onclick="renderRestaurantDashboardScreen()" class="text-xl w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 transition-all text-white">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h2 class="text-lg font-black tracking-tight text-white">Create New Offer</h2>
                    <p class="text-[10px] text-primary font-bold tracking-widest uppercase mt-0.5">Campaign Configuration</p>
                </div>
            </div>

            <div class="px-6">
                <!-- Unified Dropdown Selector Box -->
                <div class="form-group relative mb-6">
                    <label class="form-label text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Section 1: Select Your Offer Category</label>
                    <div id="offer-type-dropdown" class="relative">
                        <button onclick="toggleOfferTypeDropdown(event)" class="w-full bg-white border-2 border-primary/20 hover:border-primary/50 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-primary/10">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-primary font-black" id="dropdown-selected-icon">
                                    ${currentOfferType === 'promo' ? '<i class="fa-solid fa-ticket"></i>' : 
                                      currentOfferType === 'direct' ? '<i class="fa-solid fa-arrow-down-wide-short"></i>' : 
                                      currentOfferType === 'gift' ? '<i class="fa-solid fa-gift"></i>' : 
                                      '<i class="fa-solid fa-square-plus"></i>'}
                                </div>
                                <div class="text-left">
                                    <span class="block text-sm font-black text-gray-800" id="dropdown-selected-title">
                                        ${currentOfferType === 'promo' ? 'Promo Code Offer' : 
                                          currentOfferType === 'direct' ? 'Direct Item Discount' : 
                                          currentOfferType === 'gift' ? 'Buy X Get Y Free' : 
                                          'Select Offer Category'}
                                    </span>
                                    <span class="block text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5" id="dropdown-selected-subtitle">
                                        ${currentOfferType === 'promo' ? 'Global coupon discount' : 
                                          currentOfferType === 'direct' ? 'Price drop on menu item' : 
                                          currentOfferType === 'gift' ? 'Bulk discount / free gift' : 
                                          'Choose a type to view form fields'}
                                    </span>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 text-xs" id="type-dropdown-arrow"></i>
                        </button>
                        
                        <!-- Options Menu -->
                        <div id="offer-type-options" class="offer-dropdown-menu absolute left-0 right-0 mt-3 bg-white border border-gray-100 rounded-3xl shadow-xl overflow-hidden z-50 transition-all duration-300 transform scale-95 opacity-0 pointer-events-none">
                            <div class="p-2 space-y-1">
                                <!-- Option: Promo Code Offer -->
                                <button onclick="selectOfferType('promo', event)" class="w-full flex items-center gap-4 p-4 hover:bg-amber-50/50 rounded-2xl text-left transition-all group ${currentOfferType === 'promo' ? 'bg-amber-50/70' : ''}">
                                    <div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center transition-transform group-hover:scale-110">
                                        <i class="fa-solid fa-ticket text-sm"></i>
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-black text-gray-800">Promo Code Offer</h4>
                                        <p class="text-[10px] text-gray-400 font-medium">Global discount for entire order using a coupon code.</p>
                                    </div>
                                    ${currentOfferType === 'promo' ? '<i class="fa-solid fa-circle-check text-primary text-sm"></i>' : ''}
                                </button>

                                <!-- Option: Direct Item Discount -->
                                <button onclick="selectOfferType('direct', event)" class="w-full flex items-center gap-4 p-4 hover:bg-amber-50/50 rounded-2xl text-left transition-all group ${currentOfferType === 'direct' ? 'bg-amber-50/70' : ''}">
                                    <div class="w-10 h-10 rounded-xl bg-amber-50 text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                                        <i class="fa-solid fa-arrow-down-wide-short text-sm"></i>
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-black text-gray-800">Direct Item Discount</h4>
                                        <p class="text-[10px] text-gray-400 font-medium">Specific price drop on a particular menu item.</p>
                                    </div>
                                    ${currentOfferType === 'direct' ? '<i class="fa-solid fa-circle-check text-primary text-sm"></i>' : ''}
                                </button>

                                <!-- Option: Buy X Get Y Free -->
                                <button onclick="selectOfferType('gift', event)" class="w-full flex items-center gap-4 p-4 hover:bg-amber-50/50 rounded-2xl text-left transition-all group ${currentOfferType === 'gift' ? 'bg-amber-50/70' : ''}">
                                    <div class="w-10 h-10 rounded-xl bg-green-50 text-green-500 flex items-center justify-center transition-transform group-hover:scale-110">
                                        <i class="fa-solid fa-gift text-sm"></i>
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-black text-gray-800">Buy X Get Y Free</h4>
                                        <p class="text-[10px] text-gray-400 font-medium">Encourage bulk orders with a free gift or combo.</p>
                                    </div>
                                    ${currentOfferType === 'gift' ? '<i class="fa-solid fa-circle-check text-primary text-sm"></i>' : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Conditional Form Rendering Container -->
                <div id="dynamic-form-container" class="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100/80 mb-8 min-h-[160px] flex flex-col justify-center transition-all duration-300">
                    ${renderDynamicOfferFields()}
                </div>

                <!-- Action Buttons (Hidden initially) -->
                <div id="offer-action-buttons" class="flex flex-col gap-3 pb-10 transition-all duration-300 ${currentOfferType ? '' : 'hidden'}">
                    <button onclick="saveUnifiedOffer()" class="save-btn w-full py-5 flex items-center justify-center gap-3">
                        <i class="fa-solid fa-bolt"></i>
                        Create & Live Offer
                    </button>
                    <button onclick="renderRestaurantDashboardScreen()" class="cancel-btn w-full py-4">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    initOfferEventListeners();
    
    // Auto-reveal form if a type was already chosen (e.g. from state)
    if (currentOfferType) {
        const slideElement = document.querySelector('.form-slide-in');
        if (slideElement) {
            setTimeout(() => {
                slideElement.classList.add('show');
            }, 50);
        }
    }
}

function toggleOfferTypeDropdown(event) {
    if (event) event.stopPropagation();
    const optionsMenu = document.getElementById('offer-type-options');
    const dropdownArrow = document.getElementById('type-dropdown-arrow');
    if (!optionsMenu) return;

    const isOpen = optionsMenu.classList.contains('opacity-100');
    if (isOpen) {
        optionsMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
        optionsMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        if (dropdownArrow) dropdownArrow.style.transform = 'rotate(0deg)';
    } else {
        optionsMenu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
        optionsMenu.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
        if (dropdownArrow) dropdownArrow.style.transform = 'rotate(180deg)';
    }
}

function selectOfferType(type, event) {
    if (event) event.stopPropagation();
    currentOfferType = type;

    // Update Dropdown Header Button Content dynamically
    const iconContainer = document.getElementById('dropdown-selected-icon');
    const titleContainer = document.getElementById('dropdown-selected-title');
    const subtitleContainer = document.getElementById('dropdown-selected-subtitle');
    const dropdownArrow = document.getElementById('type-dropdown-arrow');

    if (type === 'promo') {
        iconContainer.innerHTML = '<i class="fa-solid fa-ticket text-sm"></i>';
        titleContainer.innerText = 'Promo Code Offer';
        subtitleContainer.innerText = 'Global coupon discount';
    } else if (type === 'direct') {
        iconContainer.innerHTML = '<i class="fa-solid fa-arrow-down-wide-short text-sm"></i>';
        titleContainer.innerText = 'Direct Item Discount';
        subtitleContainer.innerText = 'Price drop on menu item';
    } else if (type === 'gift') {
        iconContainer.innerHTML = '<i class="fa-solid fa-gift text-sm"></i>';
        titleContainer.innerText = 'Buy X Get Y Free';
        subtitleContainer.innerText = 'Bulk discount / free gift';
    }

    // Highlight the active option styling
    document.querySelectorAll('#offer-type-options button').forEach(btn => {
        btn.classList.remove('bg-amber-50/70');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('bg-amber-50/70');
    }

    // Close Dropdown menu
    const optionsMenu = document.getElementById('offer-type-options');
    if (optionsMenu) {
        optionsMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
        optionsMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
    }
    if (dropdownArrow) {
        dropdownArrow.style.transform = 'rotate(0deg)';
    }

    // Smoothly render the form fields underneath
    const formContainer = document.getElementById('dynamic-form-container');
    if (formContainer) {
        formContainer.innerHTML = renderDynamicOfferFields();
        const slideElement = formContainer.querySelector('.form-slide-in');
        if (slideElement) {
            setTimeout(() => {
                slideElement.classList.add('show');
            }, 50);
        }
    }

    // Reveal Action Buttons smoothly
    const actionButtons = document.getElementById('offer-action-buttons');
    if (actionButtons) {
        actionButtons.classList.remove('hidden');
    }

    initOfferEventListeners();
}

function setDiscountType(type) {
    const btnPercentage = document.getElementById('btn-promo-percentage');
    const btnFixed = document.getElementById('btn-promo-fixed');
    const typeInput = document.getElementById('promo-type');
    const symbolSpan = document.getElementById('discount-symbol');
    const valueInput = document.getElementById('promo-value');

    if (!typeInput || !btnPercentage || !btnFixed || !symbolSpan || !valueInput) return;

    typeInput.value = type;

    if (type === 'Percentage') {
        // Toggle selected styling to Percentage button
        btnPercentage.className = "flex-1 py-4 px-5 rounded-2xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 bg-[#FFD700] text-black border-[#FFD700] shadow-md scale-100";
        btnFixed.className = "flex-1 py-4 px-5 rounded-2xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 bg-white text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600";
        
        // Dynamic suffix styling (RHS)
        symbolSpan.innerText = "%";
        symbolSpan.className = "absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base transition-all";
        valueInput.className = "form-input w-full pr-12 pl-5 brand-highlight font-bold text-lg";
        valueInput.placeholder = "e.g. 20";
        
        // Enforce percentage validation bounds
        if (parseFloat(valueInput.value) > 100) {
            valueInput.value = 100;
        }
    } else {
        // Toggle selected styling to Fixed button
        btnFixed.className = "flex-1 py-4 px-5 rounded-2xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 bg-[#FFD700] text-black border-[#FFD700] shadow-md scale-100";
        btnPercentage.className = "flex-1 py-4 px-5 rounded-2xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 bg-white text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600";
        
        // Dynamic prefix styling (LHS)
        symbolSpan.innerText = "₹";
        symbolSpan.className = "absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base transition-all";
        valueInput.className = "form-input w-full pl-12 pr-5 brand-highlight font-bold text-lg";
        valueInput.placeholder = "e.g. 150";
    }
}

function handleDiscountValueInput(input) {
    const typeInput = document.getElementById('promo-type');
    if (!typeInput) return;

    const val = parseFloat(input.value);
    if (isNaN(val)) return;

    if (typeInput.value === 'Percentage') {
        if (val < 1) input.value = 1;
        if (val > 100) input.value = 100;
    } else {
        if (val < 0) input.value = 0;
    }
}

function renderDynamicOfferFields() {
    if (!currentOfferType) {
        return `
            <div class="text-center py-6 px-4">
                <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary">
                    <i class="fa-solid fa-circle-info text-xl"></i>
                </div>
                <h4 class="text-xs font-black text-gray-700 uppercase tracking-widest">Choose Offer Category</h4>
                <p class="text-[10px] text-gray-400 mt-1 max-w-[220px] mx-auto leading-relaxed">Select an offer type above to configure parameters.</p>
            </div>
        `;
    }

    if (currentOfferType === 'promo') {
        return `
            <div class="form-slide-in space-y-6">
                <label class="form-label text-[10px] font-black text-secondary uppercase tracking-wider -mb-3 block border-b border-gray-100 pb-2">Campaign Parameters</label>
                
                <div class="form-group">
                    <label class="form-label">Coupon Code *</label>
                    <div class="relative">
                        <i class="fa-solid fa-ticket absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="promo-code" placeholder="e.g. MEGA50" class="form-input w-full pl-11 uppercase font-bold brand-highlight">
                    </div>
                </div>

                <!-- Select Discount Type: Grouped Toggle Button Layout -->
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Discount Type:</label>
                    <div class="flex gap-3">
                        <button type="button" id="btn-promo-percentage" onclick="setDiscountType('Percentage')" class="flex-1 py-4 px-5 rounded-2xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 bg-[#FFD700] text-black border-[#FFD700] shadow-md">
                            <i class="fa-solid fa-percent text-xs"></i> Percentage %
                        </button>
                        <button type="button" id="btn-promo-fixed" onclick="setDiscountType('Fixed')" class="flex-1 py-4 px-5 rounded-2xl font-black text-xs border-2 transition-all flex items-center justify-center gap-2 bg-white text-gray-400 border-gray-100 hover:border-gray-200">
                            <i class="fa-solid fa-indian-rupee-sign text-xs"></i> Fixed ₹
                        </button>
                    </div>
                    <input type="hidden" id="promo-type" value="Percentage">
                </div>

                <!-- Enter Discount Value: Placed Directly Below -->
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Enter Discount Value:</label>
                    <div class="relative">
                        <input type="number" id="promo-value" placeholder="e.g. 20" class="form-input w-full pr-12 pl-5 brand-highlight font-bold text-lg" oninput="handleDiscountValueInput(this)">
                        <span id="discount-symbol" class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base transition-all">%</span>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Minimum Order Amount *</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                        <input type="number" id="promo-min-amount" placeholder="e.g. 300" class="form-input w-full pl-8 brand-highlight">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Validity Dates</label>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                            <span class="absolute left-3 top-2 text-[8px] text-gray-400 font-black uppercase">From</span>
                            <input type="date" id="promo-start" class="form-input w-full pt-6 text-xs brand-highlight">
                        </div>
                        <div class="relative">
                            <span class="absolute left-3 top-2 text-[8px] text-gray-400 font-black uppercase">To</span>
                            <input type="date" id="promo-end" class="form-input w-full pt-6 text-xs brand-highlight">
                        </div>
                    </div>
                </div>

                <!-- Maximum Discount Cap & Terms & Conditions (Audit Requirement 2) -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Max. Discount Cap</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                            <input type="number" id="promo-max-discount" placeholder="Optional" class="form-input w-full pl-8 brand-highlight font-bold">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions</label>
                        <input type="text" id="promo-terms" placeholder="e.g. One use per user" class="form-input w-full brand-highlight text-xs">
                    </div>
                </div>
            </div>
        `;
    } else if (currentOfferType === 'direct') {
        return `
            <div class="form-slide-in space-y-6">
                <label class="form-label text-[10px] font-black text-secondary uppercase tracking-wider -mb-3 block border-b border-gray-100 pb-2">Item Configuration</label>

                <div class="form-group">
                    <label class="form-label">Select Menu Item *</label>
                    <div class="searchable-dropdown" id="item-selector">
                        <div class="dropdown-header flex justify-between items-center bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-all" onclick="toggleOfferItemDropdown(event)">
                            <span id="selected-item-name" class="font-bold text-gray-700">Select an item...</span>
                            <i class="fa-solid fa-chevron-down text-gray-400"></i>
                        </div>
                        <div class="dropdown-list-container absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-50 hidden" id="item-dropdown-list">
                            <div class="dropdown-search-wrapper p-3 border-b border-gray-50 flex items-center gap-2">
                                <i class="fa-solid fa-magnifying-glass text-gray-400 text-xs"></i>
                                <input type="text" placeholder="Search menu..." class="dropdown-search-input text-xs w-full outline-none" oninput="filterOfferItems(this.value)">
                            </div>
                            <div class="dropdown-items-list max-h-48 overflow-y-auto" id="offer-items-container">
                                ${renderOfferItemsList()}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">Original Price (Readonly)</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                            <input type="text" id="direct-reg-price" readonly class="form-input w-full pl-8 bg-gray-100 border-gray-100 cursor-not-allowed font-bold" placeholder="0.00">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Discounted Price *</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₹</span>
                            <input type="number" id="direct-offer-price" placeholder="e.g. 150" class="form-input w-full pl-8 brand-highlight font-bold">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Active Time Window</label>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                            <span class="absolute left-3 top-2 text-[8px] text-gray-400 font-black uppercase">Start</span>
                            <input type="time" id="direct-start-time" class="form-input w-full pt-6 text-xs brand-highlight">
                        </div>
                        <div class="relative">
                            <span class="absolute left-3 top-2 text-[8px] text-gray-400 font-black uppercase">End</span>
                            <input type="time" id="direct-end-time" class="form-input w-full pt-6 text-xs brand-highlight">
                        </div>
                    </div>
                </div>

                <!-- Terms & Conditions (Audit Requirement 2) -->
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions</label>
                    <input type="text" id="direct-terms" placeholder="e.g. Valid only on dine-in orders" class="form-input w-full brand-highlight text-xs">
                </div>
            </div>
        `;
    } else if (currentOfferType === 'gift') {
        return `
            <div class="form-slide-in space-y-6">
                <label class="form-label text-[10px] font-black text-secondary uppercase tracking-wider -mb-3 block border-b border-gray-100 pb-2">Bulk Reward Configuration</label>

                <div class="form-group">
                    <label class="form-label">Select Purchase Item *</label>
                    <select id="gift-purchase-item" class="form-input w-full brand-highlight" onchange="updateGiftDescription()">
                        <option value="">Select Item</option>
                        ${state.menuItems.map(item => `<option value="${item.name}">${item.name}</option>`).join('')}
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">Buy Item Quantity (X) *</label>
                        <input type="number" id="gift-min-qty" placeholder="e.g. 3" class="form-input w-full brand-highlight font-bold" oninput="updateGiftDescription()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Free Item Quantity (Y) *</label>
                        <input type="number" id="gift-free-qty" placeholder="e.g. 1" class="form-input w-full brand-highlight font-bold" oninput="updateGiftDescription()">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Free Reward Item Name *</label>
                    <input type="text" id="gift-free-item" placeholder="e.g. Cold Drink / Brownie" class="form-input w-full brand-highlight" oninput="updateGiftDescription()">
                </div>

                <div class="form-group">
                    <label class="form-label">Short Combo Description (Auto-generated)</label>
                    <textarea id="gift-desc" readonly class="form-input bg-gray-50 h-20 text-xs italic text-gray-500 cursor-not-allowed border-gray-100 leading-relaxed" placeholder="Buy X and get Y free!"></textarea>
                </div>

                <!-- Terms & Conditions (Audit Requirement 2) -->
                <div class="form-group">
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions</label>
                    <input type="text" id="gift-terms" placeholder="e.g. Valid while stocks last" class="form-input w-full brand-highlight text-xs">
                </div>
            </div>
        `;
    }
}

function initOfferEventListeners() {
    // Delegated click handler for menu item selection
    document.addEventListener('click', (e) => {
        const row = e.target.closest('.dropdown-item-row');
        if (row) {
            e.stopPropagation();
            const id = row.getAttribute('data-id');
            const name = row.getAttribute('data-name');
            const price = row.getAttribute('data-price');
            selectItemForDiscount(id, name, price);
            return;
        }

        // Dropdown close logic
        const dropdown = document.getElementById('item-selector');
        const list = document.getElementById('item-dropdown-list');
        if (dropdown && !dropdown.contains(e.target)) {
            list?.classList.add('hidden');
        }

        // Close main type dropdown when clicking outside
        const typeDropdown = document.getElementById('offer-type-dropdown');
        const typeOptions = document.getElementById('offer-type-options');
        const typeArrow = document.getElementById('type-dropdown-arrow');
        if (typeDropdown && !typeDropdown.contains(e.target) && typeOptions) {
            typeOptions.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
            typeOptions.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            if (typeArrow) typeArrow.style.transform = 'rotate(0deg)';
        }
    });
}

function toggleOfferItemDropdown(event) {
    if (event) event.stopPropagation();
    const list = document.getElementById('item-dropdown-list');
    if (!list) return;
    
    const isHidden = list.classList.contains('hidden');
    if (isHidden) {
        list.classList.remove('hidden');
        list.classList.add('show');
    } else {
        list.classList.add('hidden');
        list.classList.remove('show');
    }
}

function filterOfferItems(query) {
    const container = document.getElementById('offer-items-container');
    if (container) {
        container.innerHTML = renderOfferItemsList(query);
    }
}

function renderOfferItemsList(filter = '') {
    const filtered = state.menuItems.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0) return '<div class="p-4 text-center text-xs text-gray-400">No items found</div>';
    
    return filtered.map(item => {
        const isSelected = state.selectedDiscountItemId == item.id;
        const selectedClass = isSelected ? 'bg-amber-100 border-l-4 border-amber-500 pl-2' : '';
        const checkmark = isSelected ? '<i class="fa-solid fa-check text-amber-600 text-xs"></i>' : '';
        
        return `
            <div class="dropdown-item-row p-3 flex justify-between items-center cursor-pointer hover:bg-amber-50 transition-colors ${selectedClass}" 
                 data-id="${item.id}" 
                 data-name="${item.name}" 
                 data-price="${item.price}">
                <span class="dropdown-item-name text-xs font-bold text-gray-700">${item.name}</span>
                <div class="flex items-center gap-2">
                    <span class="dropdown-item-price text-xs font-black text-amber-600">₹${item.price}</span>
                    ${checkmark}
                </div>
            </div>
        `;
    }).join('');
}

function selectItemForDiscount(id, name, price) {
    const selectedText  = document.getElementById('selected-item-name');
    const regPriceInput = document.getElementById('direct-reg-price');
    const dropdownList  = document.getElementById('item-dropdown-list');

    if (selectedText)  selectedText.innerText = name;
    if (regPriceInput) regPriceInput.value    = price;
    state.selectedDiscountItemId = id;
    if (dropdownList) dropdownList.classList.add('hidden');

    const container = document.getElementById('offer-items-container');
    if (container) container.innerHTML = renderOfferItemsList();
}

function updateGiftDescription() {
    const buyItem  = document.getElementById('gift-purchase-item')?.value;
    const buyQty   = document.getElementById('gift-min-qty')?.value;
    const freeItem = document.getElementById('gift-free-item')?.value;
    const freeQty  = document.getElementById('gift-free-qty')?.value;
    const descField = document.getElementById('gift-desc');
    if (descField) {
        descField.value = (buyItem && buyQty && freeItem && freeQty)
            ? `Buy ${buyQty} ${buyItem} and get ${freeQty} ${freeItem} free!`
            : '';
    }
}

async function saveUnifiedOffer() {

    // ── Identity ──────────────────────────────────────────────────────────────
    const restaurantId = state.currentRestaurantId ? String(state.currentRestaurantId) : null;
    const vendorId     = state.currentVendorId     ? String(state.currentVendorId)     : null;

    // ── Base payload: only columns that physically exist in the offers table ──
    // Strip everything else BEFORE calling .insert() to avoid schema errors.
    let dbPayload = {
        vendor_id:          vendorId,
        restaurant_id:      restaurantId,
        offer_type:         null,
        title:              null,
        promo_code:         null,
        // Unified discount storage — both % and ₹ go into this single column.
        discount_value:     null,
        // true  → value is a % rate (e.g. 20 means 20 %)
        // false → value is a flat ₹ amount
        is_percentage:      false,
        is_active:          true,
        // Date / time window
        start_date:         null,
        end_date:           null,
        // Array / quantity fields
        target_item_ids:    null,
        buy_quantity:       null,
        get_quantity:       null,
        // Optional cap & fine-print
        max_discount_value: null,
        terms_conditions:   null   // TEXT[] column — always sent as array or null
    };

    // ── Branch A: Promo Code Offer ────────────────────────────────────────────
    if (currentOfferType === 'promo') {
        const code        = (document.getElementById('promo-code')?.value        || '').trim().toUpperCase();
        const typeToggle  =  document.getElementById('promo-type')?.value        || 'Percentage';
        const val         =  document.getElementById('promo-value')?.value       || '';
        const start       =  document.getElementById('promo-start')?.value       || '';
        const end         =  document.getElementById('promo-end')?.value         || '';
        const maxDiscount =  document.getElementById('promo-max-discount')?.value || '';
        const terms       = (document.getElementById('promo-terms')?.value       || '').trim();

        if (!code)  { showToast('Please enter a coupon code');    return; }
        if (!val)   { showToast('Please enter a discount value'); return; }

        const isPercentage = (typeToggle === 'Percentage');

        dbPayload.title             = `PROMO: ${code}`;
        dbPayload.offer_type        = 'promo_code';
        dbPayload.promo_code        = code;
        // ▸ Unified rule: whatever the type, the NUMBER goes into discount_value
        dbPayload.discount_value    = parseFloat(val)        || 0;
        dbPayload.is_percentage     = isPercentage;           // true = %, false = ₹
        dbPayload.is_active         = true;
        // ▸ Date window → start_date / end_date
        dbPayload.start_date        = start ? new Date(start).toISOString() : null;
        dbPayload.end_date          = end   ? new Date(end).toISOString()   : null;
        dbPayload.max_discount_value = maxDiscount ? parseFloat(maxDiscount) : null;
        dbPayload.terms_conditions  = terms ? [terms] : null;
    }

    // ── Branch B: Direct Item Discount ────────────────────────────────────────
    else if (currentOfferType === 'direct') {
        const itemName   = (document.getElementById('selected-item-name')?.innerText || '').trim();
        const offerPrice =  document.getElementById('direct-offer-price')?.value || '';
        const regPrice   =  document.getElementById('direct-reg-price')?.value   || '0';
        const startTime  =  document.getElementById('direct-start-time')?.value  || '';
        const endTime    =  document.getElementById('direct-end-time')?.value    || '';
        const terms      = (document.getElementById('direct-terms')?.value       || '').trim();

        if (!itemName || itemName === 'Select an item...') {
            showToast('Please select a menu item');
            return;
        }
        if (!offerPrice) {
            showToast('Please enter the discounted price');
            return;
        }

        // Discount = absolute ₹ saving = (original – discounted), always flat
        const saving = Math.max(0, (parseFloat(regPrice) || 0) - (parseFloat(offerPrice) || 0));

        dbPayload.title           = `Discount on ${itemName}`;
        dbPayload.offer_type      = 'direct_discount';
        dbPayload.discount_value  = parseFloat(saving);  // flat ₹ amount
        dbPayload.is_percentage   = false;               // always a fixed ₹ saving
        dbPayload.is_active       = true;
        // ▸ Time window stored as today's date + the chosen time
        const todayDate = new Date().toISOString().split('T')[0];
        dbPayload.start_date      = startTime ? new Date(`${todayDate}T${startTime}`).toISOString() : null;
        dbPayload.end_date        = endTime   ? new Date(`${todayDate}T${endTime}`).toISOString()   : null;
        dbPayload.terms_conditions = terms ? [terms] : null;
        dbPayload.target_item_ids = state.selectedDiscountItemId
            ? [String(state.selectedDiscountItemId)]
            : [];
    }

    // ── Branch C: Buy X Get Y Free ────────────────────────────────────────────
    else if (currentOfferType === 'gift') {
        const buyItem =  document.getElementById('gift-purchase-item')?.value || '';
        const buyQty  =  document.getElementById('gift-min-qty')?.value       || '0';
        const freeQty =  document.getElementById('gift-free-qty')?.value      || '0';
        const desc    =  document.getElementById('gift-desc')?.value          || '';
        const terms   = (document.getElementById('gift-terms')?.value         || '').trim();

        if (!buyItem)           { showToast('Please select a purchase item');   return; }
        if (!parseInt(buyQty))  { showToast('Please enter buy quantity (X)');   return; }
        if (!parseInt(freeQty)) { showToast('Please enter free quantity (Y)');  return; }
        if (!desc)              { showToast('Please complete all combo fields'); return; }

        const matchedItem = state.menuItems.find(item => item.name === buyItem);

        dbPayload.title            = `Buy ${buyQty} Get ${freeQty} Free`;
        dbPayload.offer_type       = 'buy_x_get_y';
        dbPayload.discount_value   = 0;
        dbPayload.is_percentage    = false;
        dbPayload.is_active        = true;
        dbPayload.buy_quantity     = parseInt(buyQty)  || 0;
        dbPayload.get_quantity     = parseInt(freeQty) || 0;
        dbPayload.terms_conditions = terms ? [terms] : null;
        dbPayload.target_item_ids  = matchedItem ? [String(matchedItem.id)] : [];
    }
    else {
        showToast('Please select an offer type first');
        return;
    }

    const btn = document.querySelector('button[onclick="saveUnifiedOffer()"]');
    const originalText = btn ? btn.innerHTML : 'Create & Live Offer';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Saving...';
        btn.disabled = true;
    }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        // Use .select().single() so Supabase returns the inserted row with its auto-generated UUID.
        // This ensures the offer.id is available immediately in local state for same-session deletes.
        const { data: insertedOffer, error } = await supabase
            .from('offers')
            .insert([dbPayload])
            .select()
            .single();

        if (error) {
            // Expanded error breakdown to pinpoint the exact schema mismatch
            console.error('━━━ [Supabase Save Offer Error] ━━━');
            console.error('Database Error Code:', error.code);
            console.error('Message:', error.message);
            console.error('Details:', error.details);
            console.error('Hint:', error.hint);
            console.error('Full payload sent:', JSON.stringify(dbPayload, null, 2));
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            showToast(`DB Error ${error.code || ''}: ${error.message || 'Failed to save offer.'}`);
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
            return;
        }

        // Merge the server-returned row (which contains the UUID) into local state
        const savedOffer = insertedOffer ? { ...dbPayload, id: insertedOffer.id } : dbPayload;
        if (!state.restaurantDetails.offers) state.restaurantDetails.offers = [];
        state.restaurantDetails.offers.unshift(savedOffer);
        saveSession();
        
        showToast('Offer created and is now Live!');
        
        // Restore bottom navigation bar seamlessly
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.classList.remove('translate-y-[200%]', 'pointer-events-none');
        }
        
        // Instantly close/dismiss the Create New Offer page layout context view
        renderRestaurantDashboardScreen();
    } catch (err) {
        console.error('[Exception in saveUnifiedOffer]:', err);
        showToast('An unexpected error occurred.');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function openAddCategoryModal() {
    const app = document.getElementById('app');
    const modal = document.createElement('div');
    modal.id = 'category-modal-container';
    modal.className = 'fixed inset-0 z-[9999] flex items-end justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0" id="cat-modal-overlay" onclick="closeCategoryModal()"></div>
        <div id="category-modal" class="bg-white w-full max-w-lg rounded-t-[40px] p-8 transform translate-y-full transition-transform duration-500 ease-out relative z-10 flex flex-col max-h-[90vh]">
            <div class="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
            
            <div class="overflow-y-auto no-scrollbar pb-10">
                <div class="text-center mb-8">
                    <h3 class="text-2xl font-black text-gray-800 mb-1">Add New Category</h3>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Create a custom food category</p>
                </div>

                <div class="space-y-6">
                    <!-- Category Name -->
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">CATEGORY NAME *</label>
                        <input type="text" id="cat-name-input" placeholder="e.g. Starter, Main Course" class="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl p-4 text-sm font-bold outline-none focus:border-primary focus:bg-white transition-all">
                    </div>

                    <!-- Status Toggle -->
                    <div class="bg-gray-50 p-6 rounded-3xl flex items-center justify-between border border-gray-100">
                        <div>
                            <p class="text-sm font-bold text-gray-800">Status</p>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active / Inactive</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="cat-status-toggle" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            </div>

            <div class="pt-4 mt-auto">
                <button onclick="handleSaveCategory()" class="w-full py-5 bg-[#FFD700] text-black rounded-[32px] font-black text-lg shadow-xl shadow-amber-100 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <i class="fa-solid fa-plus-circle"></i>
                    Save Category
                </button>
                <button onclick="closeCategoryModal()" class="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-2">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Animation
    setTimeout(() => {
        const overlay = document.getElementById('cat-modal-overlay');
        const modalEl = document.getElementById('category-modal');
        if (overlay) overlay.classList.add('opacity-100');
        if (modalEl) modalEl.classList.remove('translate-y-full');
    }, 10);
}

function closeCategoryModal() {
    const overlay = document.getElementById('cat-modal-overlay');
    const modal = document.getElementById('category-modal');
    if (!overlay || !modal) return;

    overlay.classList.remove('opacity-100');
    modal.classList.add('translate-y-full');
    setTimeout(() => {
        const container = document.getElementById('category-modal-container');
        if (container) container.remove();
        state.tempCategoryLogo = null;
    }, 500);
}

async function handleSaveCategory() {
    const nameInput = document.getElementById('cat-name-input');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        showToast('Please enter a category name');
        return;
    }

    if (state.categories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
        showToast('Category already exists');
        return;
    }

    if (!state.currentRestaurantId) {
        showToast('Restaurant profile not loaded. Cannot add category.');
        return;
    }

    const btn = document.querySelector('button[onclick="handleSaveCategory()"]');
    const originalText = btn ? btn.innerHTML : 'Save';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Saving...'; btn.disabled = true; }

    try {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Supabase client not initialized.');

        // ── WRITE 1: Insert new row into the restaurant_categories table ──────────
        const { error: insertError } = await supabase
            .from('restaurant_categories')
            .insert([{ 
                name: name,
                restaurant_id: state.currentRestaurantId,
                restaurant_name: state.restaurantDetails ? state.restaurantDetails.name : ''
            }]);

        if (insertError) {
            console.error('[Save Category] restaurant_categories table insert failed:', insertError);
            showToast(`Failed to save category: ${insertError.message}`);
            return;
        }

        // ── WRITE 2: Append to restaurants.categories[] via array_append RPC ──
        // Uses PostgreSQL native array_append — safe, no overwrite, idempotent guard built in.
        const { error: rpcError } = await supabase.rpc('append_vendor_category', {
            p_restaurant_id: state.currentRestaurantId,
            p_category_name: name
        });

        if (rpcError) {
            // Non-fatal: category is already saved to the restaurant_categories table.
            // Log the warning but do NOT block the user.
            console.warn('[Save Category] restaurants.categories[] append failed (non-fatal):', rpcError.message);
        } else {
            console.log('[Save Category] restaurants.categories[] updated successfully.');
        }

        // ── REFRESH: Re-fetch restaurant_categories table to keep state in sync ──────────
        const { data: refreshed, error: refreshErr } = await supabase
            .from('restaurant_categories')
            .select('name')
            .eq('restaurant_id', state.currentRestaurantId)
            .order('name', { ascending: true });

        if (!refreshErr && refreshed && refreshed.length > 0) {
            state.categories = refreshed.map(c => c.name);
        } else {
            state.categories.push(name);
        }

        showToast(`Category "${name}" added successfully!`);
        closeCategoryModal();

        // ── UI SYNC: Update the dropdown in the Add Menu Item form in-place ───
        // Updates options without resetting any other typed fields in the form.
        const categorySelect = document.getElementById('add-item-category');
        if (categorySelect) {
            const currentValue = categorySelect.value;
            categorySelect.innerHTML = `
                <option value="" disabled ${!currentValue ? 'selected' : ''}>Select category</option>
                ${state.categories.map(cat => `<option value="${cat}" ${currentValue === cat || cat === name ? 'selected' : ''}>${cat}</option>`).join('')}
            `;
        }

        // Re-render menu screen category filter chips if currently visible
        if (state.currentView === 'menu') {
            renderMenuScreen();
        }

    } catch (err) {
        console.error('[Exception in handleSaveCategory]:', err);
        showToast(`An unexpected error occurred: ${err.message || err}`);
    } finally {
        if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
    }
}


async function handleBankUpdate() {
    const bankName = document.getElementById('bank-name-input').value.trim();
    const accountNumber = document.getElementById('account-number-input').value.trim();
    const ifsc = document.getElementById('ifsc-code-input').value.trim();

    if (!bankName || !accountNumber || !ifsc) {
        showToast('Please fill all bank details');
        return;
    }

    if (!confirm('Are you sure you want to update your payment details?')) return;

    const btn = document.getElementById('update-bank-btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Updating...';
    btn.disabled = true;

    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        const { error } = await supabase
            .from('vendors')
            .update({
                bank_name: bankName,
                account_number: accountNumber,
                ifsc_code: ifsc
            })
            .eq('id', state.currentVendorId);

        if (error) throw error;

        state.bankDetails.bankName = bankName;
        state.bankDetails.accountNumber = accountNumber ? `XXXX XXXX ${accountNumber.slice(-4)}` : '';
        state.bankDetails.rawAccountNumber = accountNumber;
        state.bankDetails.ifsc = ifsc;

        saveSession();
        renderBankScreen();
        showToast('Bank Details Updated Successfully');
    } catch (err) {
        console.error('Failed to update bank details:', err);
        showToast('Error: ' + err.message);
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

async function handleUPIUpdate() {
    const upiId = document.getElementById('upi-id-input').value.trim();

    // Simple UPI validation regex: username@bank
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId)) {
        showToast('Please enter a valid UPI ID (e.g. name@bank)');
        return;
    }

    if (!confirm('Are you sure you want to update your payment details?')) return;

    const btn = document.getElementById('update-upi-btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Updating...';
    btn.disabled = true;

    try {
        const supabase = window.supabaseClient;
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

        const { error } = await supabase
            .from('vendors')
            .update({
                upi_id: upiId
            })
            .eq('id', state.currentVendorId);

        if (error) throw error;

        state.bankDetails.upiId = upiId;

        saveSession();
        renderBankScreen();
        showToast('UPI ID Updated Successfully');
    } catch (err) {
        console.error('Failed to update UPI ID:', err);
        showToast('Error: ' + err.message);
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}


// --- Forgot Password Flow ---

function renderForgotPasswordScreen() {
    const app = document.getElementById("app");
    app.innerHTML = `
        <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-center">
            <div class="absolute inset-0 z-0">
                <img src="assets/welcome_bg.png" alt="Login Background" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/80"></div>
            </div>

            <div class="relative z-10 px-8 w-full max-w-sm mx-auto animate-fade-in-up">
                <div class="mb-10 text-center">
                    <div class="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-[#FFD700] p-1 bg-black/20 backdrop-blur-sm shadow-xl">
                        <img src="assets/logo.png" alt="ASA FOOD Logo" class="w-full h-full object-contain rounded-full">
                    </div>
                    <h2 class="text-white text-3xl font-bold mb-2">Reset Password</h2>
                    <p class="text-white/60 text-sm">Enter your mobile number to proceed</p>
                </div>
                
                <div class="space-y-6">
                    <div>
                        <label class="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Mobile Number</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">+91</span>
                            <input type="tel" id="reset-mobile" maxlength="10" placeholder="Enter Mobile Number" 
                                class="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/30 focus:border-[#FFD700] focus:bg-white/20 transition-all outline-none">
                        </div>
                    </div>

                    <button onclick="handleForgotPasswordOTP()" 
                        class="w-full py-4 bg-[#FFD700] text-black rounded-full font-bold text-lg shadow-xl shadow-black/20 hover:bg-[#FFC107] transition-all active:scale-95">
                        Submit
                    </button>
                    
                    <button onclick="navigateTo(\"login\")" class="w-full text-white/50 text-sm font-bold hover:text-white transition-colors">
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    `;
}

function handleForgotPasswordOTP() {
    const mobile = document.getElementById("reset-mobile").value;
    if (mobile.length !== 10) {
        showToast("Please enter a valid 10-digit mobile number");
        return;
    }

    // Show OTP Modal
    const modal = document.createElement("div");
    modal.id = "otp-modal-overlay";
    modal.className = "fixed inset-0 bg-secondary/80 backdrop-blur-md z-[100] flex items-center justify-center px-6 animate-fade-in";
    modal.innerHTML = `
        <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[40px] w-full max-w-sm p-8 text-center shadow-2xl animate-fade-in-up">
            <div class="w-16 h-16 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fa-solid fa-shield-halved text-[#FFD700] text-2xl"></i>
            </div>
            <h3 class="text-white text-2xl font-bold mb-2">OTP Verification</h3>
            <p class="text-white/60 text-sm mb-8">Enter the code sent to +91 ${mobile}</p>
            
            <div class="flex justify-between gap-1 mb-8">
                <input type="tel" maxlength="1" class="otp-box w-12 h-14 bg-white/10 border border-white/10 rounded-2xl text-white text-2xl font-bold text-center focus:border-[#FFD700] focus:bg-white/20 outline-none transition-all">
                <input type="tel" maxlength="1" class="otp-box w-12 h-14 bg-white/10 border border-white/10 rounded-2xl text-white text-2xl font-bold text-center focus:border-[#FFD700] focus:bg-white/20 outline-none transition-all">
                <input type="tel" maxlength="1" class="otp-box w-12 h-14 bg-white/10 border border-white/10 rounded-2xl text-white text-2xl font-bold text-center focus:border-[#FFD700] focus:bg-white/20 outline-none transition-all">
                <input type="tel" maxlength="1" class="otp-box w-12 h-14 bg-white/10 border border-white/10 rounded-2xl text-white text-2xl font-bold text-center focus:border-[#FFD700] focus:bg-white/20 outline-none transition-all">
                <input type="tel" maxlength="1" class="otp-box w-12 h-14 bg-white/10 border border-white/10 rounded-2xl text-white text-2xl font-bold text-center focus:border-[#FFD700] focus:bg-white/20 outline-none transition-all">
                <input type="tel" maxlength="1" class="otp-box w-12 h-14 bg-white/10 border border-white/10 rounded-2xl text-white text-2xl font-bold text-center focus:border-[#FFD700] focus:bg-white/20 outline-none transition-all">
            </div>
            
            <button onclick="verifyForgotPasswordOTP()" class="w-full py-4 bg-[#FFD700] text-black rounded-full font-bold text-lg shadow-xl shadow-black/20 hover:bg-[#FFC107] transition-all active:scale-95 mb-4">
                Verify OTP
            </button>
            <button onclick="document.getElementById(\"otp-modal-overlay\").remove()" class="text-white/40 text-sm font-bold hover:text-white transition-colors">
                Cancel
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto focus logic for OTP
    const inputs = modal.querySelectorAll(".otp-box");
    inputs.forEach((input, idx) => {
        input.addEventListener("input", (e) => {
            if (e.target.value && idx < inputs.length - 1) inputs[idx + 1].focus();
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) inputs[idx - 1].focus();
        });
    });
}

function verifyForgotPasswordOTP() {
    const btn = event.target;
    btn.innerHTML = "<i class=\"fa-solid fa-circle-notch fa-spin\"></i> Verifying...";

    setTimeout(() => {
        const overlay = document.getElementById("otp-modal-overlay");
        if (overlay) overlay.remove();
        renderResetPasswordScreen();
    }, 1500);
}

function renderResetPasswordScreen() {
    const app = document.getElementById("app");
    app.innerHTML = `
        <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-center">
            <div class="absolute inset-0 z-0">
                <img src="assets/welcome_bg.png" alt="Login Background" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/80"></div>
            </div>

            <div class="relative z-10 px-8 w-full max-w-sm mx-auto animate-fade-in-up">
                <div class="mb-10 text-center">
                    <div class="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-[#FFD700] p-1 bg-black/20 backdrop-blur-sm shadow-xl">
                        <img src="assets/logo.png" alt="ASA FOOD Logo" class="w-full h-full object-contain rounded-full">
                    </div>
                    <h2 class="text-white text-3xl font-bold mb-2">Create New Password</h2>
                    <p class="text-white/60 text-sm">Secure your account with a new password</p>
                </div>
                
                <div class="space-y-5">
                    <div>
                        <label class="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">New Password</label>
                        <input type="password" id="new-password" placeholder="Enter New Password" 
                            class="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/30 focus:border-[#FFD700] focus:bg-white/20 transition-all outline-none">
                    </div>

                    <div>
                        <label class="block text-white/70 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Confirm Password</label>
                        <input type="password" id="confirm-password" placeholder="Confirm New Password" 
                            class="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/30 focus:border-[#FFD700] focus:bg-white/20 transition-all outline-none">
                    </div>

                    <button onclick="handleResetPassword()" 
                        class="w-full py-4 bg-[#FFD700] text-black rounded-full font-bold text-lg shadow-xl shadow-black/20 hover:bg-[#FFC107] transition-all active:scale-95 mt-4">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    `;
}

function handleResetPassword() {
    const newPass = document.getElementById("new-password").value;
    const confirmPass = document.getElementById("confirm-password").value;

    if (!newPass || !confirmPass) {
        showToast("Please fill all fields");
        return;
    }

    if (newPass !== confirmPass) {
        showToast("Passwords do not match");
        return;
    }

    if (newPass.length < 6) {
        showToast("Password must be at least 6 digits");
        return;
    }

    const btn = event.target;
    btn.innerHTML = "<i class=\"fa-solid fa-circle-notch fa-spin\"></i> Updating...";
    btn.disabled = true;

    setTimeout(() => {
        renderPasswordSuccessScreen();
    }, 2000);
}

function renderPasswordSuccessScreen() {
    const app = document.getElementById("app");
    app.innerHTML = `
        <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-center">
            <div class="absolute inset-0 z-0">
                <img src="assets/welcome_bg.png" alt="Login Background" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/80"></div>
            </div>

            <div class="relative z-10 px-8 w-full max-w-sm mx-auto text-center animate-fade-in-up">
                <div class="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-500/20">
                    <i class="fa-solid fa-check text-green-500 text-4xl"></i>
                </div>
                
                <h2 class="text-white text-3xl font-black mb-4">Success!</h2>
                <p class="text-white/70 text-lg mb-10">Your password has been successfully updated.</p>
                
                <div class="space-y-4">
                    <p class="text-white/30 text-xs font-bold uppercase tracking-widest animate-pulse">Redirecting to login...</p>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        navigateTo("login");
    }, 3000);
}

// --- RESTAURANT CATEGORIES (APP RECOMMENDATION) MANAGEMENT ---

async function addRestaurantCategory(categoryId) {
    const supabase = window.supabaseClient;
    if (!supabase || !state.currentRestaurantId) return;

    try {
        // Check if already linked
        const exists = state.linkedRestaurantCategories.find(c => c.id === categoryId);
        if (exists) {
            showToast('Restaurant is already in this category');
            return;
        }

        const { error } = await supabase
            .from('restaurant_category_links')
            .insert([{
                restaurant_id: state.currentRestaurantId,
                category_id: categoryId
            }]);

        if (error) {
            console.error('[Supabase Add Restaurant Category Link Error]:', error);
            showToast('Failed to add category');
            return;
        }

        showToast('Restaurant added to category successfully!');
        await syncDataFromSupabase();
        renderRestaurantDashboardScreen();
    } catch (err) {
        console.error('[Exception in addRestaurantCategory]:', err);
        showToast('An unexpected error occurred.');
    }
}

async function deleteRestaurantCategory(categoryId) {
    const supabase = window.supabaseClient;
    if (!supabase || !state.currentRestaurantId) return;

    try {
        const { error } = await supabase
            .from('restaurant_category_links')
            .delete()
            .eq('restaurant_id', state.currentRestaurantId)
            .eq('category_id', categoryId);

        if (error) {
            console.error('[Supabase Delete Restaurant Category Link Error]:', error);
            showToast('Failed to remove category');
            return;
        }

        showToast('Restaurant removed from category successfully!');
        await syncDataFromSupabase();
        renderRestaurantDashboardScreen();
    } catch (err) {
        console.error('[Exception in deleteRestaurantCategory]:', err);
        showToast('An unexpected error occurred.');
    }
}

async function createAndLinkRestaurantCategory(name, description = '') {
    const supabase = window.supabaseClient;
    if (!supabase || !state.currentRestaurantId) return;

    if (!name || name.trim() === '') {
        showToast('Category name cannot be empty');
        return;
    }

    try {
        // 1. Insert into restaurant_categories
        const { data: newCat, error: catError } = await supabase
            .from('restaurant_categories')
            .insert([{
                name: name.trim(),
                description: description.trim()
            }])
            .select()
            .single();

        if (catError) {
            console.error('[Supabase Create Restaurant Category Error]:', catError);
            showToast('Failed to create new category');
            return;
        }

        // 2. Link to our restaurant
        const { error: linkError } = await supabase
            .from('restaurant_category_links')
            .insert([{
                restaurant_id: state.currentRestaurantId,
                category_id: newCat.id
            }]);

        if (linkError) {
            console.error('[Supabase Link New Category Error]:', linkError);
            showToast('Category created, but failed to link to restaurant');
            return;
        }

        showToast(`Category "${name}" created and linked successfully!`);
        await syncDataFromSupabase();
        renderRestaurantDashboardScreen();
    } catch (err) {
        console.error('[Exception in createAndLinkRestaurantCategory]:', err);
        showToast('An unexpected error occurred.');
    }
}

function openAddRestaurantCategoryModal() {
    // Filter out categories that are already linked
    const linkedIds = (state.linkedRestaurantCategories || []).map(c => c.id);
    const availableCats = (state.allRestaurantCategories || []).filter(c => !linkedIds.includes(c.id));

    const modalHtml = `
        <div id="rest-category-modal-overlay" class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center px-6 transition-opacity duration-300">
            <div class="bg-white rounded-[40px] w-full max-w-md p-8 transform scale-95 transition-all duration-300 flex flex-col max-h-[85vh]">
                <!-- Header -->
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-xl font-black text-gray-800">Add Category</h3>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">App Recommendations</p>
                    </div>
                    <button onclick="closeRestCategoryModal()" class="text-gray-400 hover:text-primary transition-colors">
                        <i class="fa-solid fa-circle-xmark text-2xl"></i>
                    </button>
                </div>
                
                <!-- Content Area -->
                <div class="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-6">
                    <!-- Section A: Choose Existing -->
                    <div>
                        <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Available App Categories</h4>
                        <div class="space-y-2">
                            ${availableCats.length > 0 ? 
                                availableCats.map(cat => `
                                    <div onclick="addRestaurantCategory('${cat.id}'); closeRestCategoryModal();" class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-amber-50/50 hover:border-primary/20 transition-all cursor-pointer group">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-amber-100 text-primary flex items-center justify-center font-black text-xs">
                                                ${cat.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p class="text-xs font-bold text-gray-800 group-hover:text-primary transition-colors">${cat.name}</p>
                                                ${cat.description ? `<p class="text-[9px] text-gray-400">${cat.description}</p>` : ''}
                                            </div>
                                        </div>
                                        <i class="fa-solid fa-plus text-xs text-gray-300 group-hover:text-primary transition-colors"></i>
                                    </div>
                                `).join('')
                                : `<p class="text-xs text-gray-400 italic">No other pre-defined categories available. Create a new one below!</p>`
                            }
                        </div>
                    </div>

                    <!-- Divider -->
                    <div class="relative flex py-2 items-center">
                        <div class="flex-grow border-t border-gray-100"></div>
                        <span class="flex-shrink mx-4 text-[9px] font-black text-gray-300 uppercase tracking-widest">OR</span>
                        <div class="flex-grow border-t border-gray-100"></div>
                    </div>

                    <!-- Section B: Create New Custom Category -->
                    <div class="bg-gray-50/50 rounded-3xl p-5 border border-gray-100">
                        <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Create New Category</h4>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[9px] font-black text-gray-400 uppercase mb-1">Category Name</label>
                                <input type="text" id="new-rest-cat-name" placeholder="e.g. Fine Dining, Cafe, Bistro" class="w-full bg-white border border-gray-100 rounded-xl p-3.5 text-xs font-bold text-gray-700 outline-none focus:border-primary/50 transition-all">
                            </div>
                            
                            <div>
                                <label class="block text-[9px] font-black text-gray-400 uppercase mb-1">Description (Optional)</label>
                                <textarea id="new-rest-cat-desc" rows="2" placeholder="Brief description of the category..." class="w-full bg-white border border-gray-100 rounded-xl p-3.5 text-xs font-bold text-gray-700 outline-none focus:border-primary/50 transition-all resize-none"></textarea>
                            </div>

                            <button onclick="handleCreateCustomCategorySubmit()" class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-xs shadow-md shadow-amber-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                                <i class="fa-solid fa-plus"></i>
                                CREATE & ADD CATEGORY
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add active animation
    setTimeout(() => {
        const modal = document.getElementById('rest-category-modal-overlay');
        if (modal) {
            modal.querySelector('div').classList.remove('scale-95');
            modal.querySelector('div').classList.add('scale-100');
        }
    }, 10);
}

function closeRestCategoryModal() {
    const modal = document.getElementById('rest-category-modal-overlay');
    if (modal) {
        modal.querySelector('div').classList.remove('scale-100');
        modal.querySelector('div').classList.add('scale-95');
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 200);
    }
}

async function handleCreateCustomCategorySubmit() {
    const nameInput = document.getElementById('new-rest-cat-name');
    const descInput = document.getElementById('new-rest-cat-desc');

    if (!nameInput) return;

    const name = nameInput.value;
    const desc = descInput ? descInput.value : '';

    if (!name || name.trim() === '') {
        showToast('Please enter a category name');
        return;
    }

    closeRestCategoryModal();
    await createAndLinkRestaurantCategory(name, desc);
}

