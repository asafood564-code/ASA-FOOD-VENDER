// Development Toggle
let isVerifiedTest = false;

// Application State
const state = {
    currentView: 'welcome', // login, otp, home, menu, orders, statistics, payments, profile, add-menu-item, welcome
    welcomeStep: 1,
    userMobile: '',
    isOnline: true,
    walletBalance: 12450.00,
    notificationCount: 3,
    prepTime: 15,
    tempAddons: [],
    editingMenuItemId: null,
    selectedOrderId: '#12348',
    modalPrepTime: 15,
    offlineReason: '',
    menuItems: [
        { id: 1, name: 'Special Chicken Biryani', price: 250, category: 'Non-Veg', image: 'assets/biryani.png', desc: 'Aromatic basmati rice with tender chicken pieces.' },
        { id: 2, name: 'Veg Cheese Burger', price: 120, category: 'Veg', image: 'assets/burger.png', desc: 'Crispy veg patty with melting cheese.' },
        { id: 3, name: 'Creamy Alfredo Pasta', price: 180, category: 'Veg', image: 'assets/pasta.png', desc: 'White sauce pasta with fresh herbs.' }
    ],
    recentOrders: [
        { id: '#12345', item: 'Chicken Biryani', location: 'Salt Lake, Sector V', status: 'Pending', price: 250, image: 'assets/biryani.png' },
        { id: '#12344', item: 'Cheese Burger', location: 'New Town, Action Area 1', status: 'Delivered', price: 120, image: 'assets/burger.png' },
        { id: '#12343', item: 'Alfredo Pasta', location: 'Kestopur', status: 'Out for Delivery', price: 180, image: 'assets/pasta.png' }
    ],
    walletTransactions: [
        { id: '#TXN12345', customer: 'Rahul Kumar', date: '28 Apr 2026, 09:15 PM', amount: 1250, status: 'Success' },
        { id: '#TXN12344', customer: 'Sujan Paul', date: '27 Apr 2026, 08:30 PM', amount: 840, status: 'Success' },
        { id: '#TXN12343', customer: 'Ankit Sharma', date: '27 Apr 2026, 01:20 PM', amount: 2100, status: 'Success' }
    ],
    verificationStatus: 'pending', // unregistered, pending, approved
    restaurantDetails: null, // { name, coverImage, galleryImages: [], hours: {}, cuisineType: 'Both', offers: [] }
    currentOnboardingStep: 1,
    selectedMenuImage: null,
    selectedRestaurantImages: { cover: null, gallery: [] },
    locationCoords: null,
    selectedCategory: 'All',
    searchQuery: '',
    isDarkMode: false,
    language: 'English',
    selfDelivery: true,
    vendorEmail: 'asavendor@gmail.com',
    todayStats: {
        totalOrders: 12,
        delivered: 8,
        pending: 4,
        earnings: 4250
    },
    bankDetails: {
        bankName: 'State Bank of India',
        accountNumber: 'XXXX XXXX 1234',
        ifsc: 'SBIN0001234',
        upiId: 'asavendor@upi'
    },
    kycDocs: {
        aadhaar: { number: 'XXXX XXXX 5678', status: 'Verified', frontImage: 'assets/aadhaar_front.png', backImage: 'assets/aadhaar_back.png' },
        pan: { number: 'ABCDE1234F', status: 'Verified', image: 'assets/pan_card.png' },
        fssai: { number: '12345678901234', status: 'Verified', image: null }
    },
    notifications: [
        { id: 1, title: 'Order #12348 Received', message: 'You have a new order for Chicken Biryani.', time: '2 mins ago', type: 'order' },
        { id: 2, title: 'Payment Settled', message: '₹ 4,250 has been settled to your bank account.', time: '1 hour ago', type: 'payment' },
        { id: 3, title: 'Menu Update', message: 'Special Chicken Biryani price updated successfully.', time: '5 hours ago', type: 'info' }
    ],
    vendorName: 'ASA VENDOR',
    vendorPhone: '+91 9876543210',
    vendorPhoto: 'assets/logo.png',
    profileMobileVerified: true,
    tempProfileImage: null,
    activeWalletTab: 'transactions',
    withdrawalHistory: [
        { id: '#WTH99283', date: '26 Apr 2026, 11:30 AM', amount: 5000, status: 'Success', method: 'Bank Transfer' },
        { id: '#WTH99120', date: '21 Apr 2026, 04:15 PM', amount: 2500, status: 'Rejected', method: 'UPI' }
    ],
    homeFilter: 'All',
    adminCommissionPercent: 10, // Global Commission Variable
    todayOrders: [
        { id: '#12348', item: 'Chicken Biryani', customerName: 'Rahul Sharma', location: 'Salt Lake', status: 'Pending', price: 250, image: 'assets/biryani.png', time: '10:45 AM' },
        { id: '#12347', item: 'Veg Thali', customerName: 'Priya Das', location: 'New Town', status: 'Delivered', price: 180, image: 'assets/thali.png', time: '09:30 AM' },
        { id: '#12346', item: 'Paneer Roll', customerName: 'Amit Kumar', location: 'Kestopur', status: 'Delivered', price: 120, image: 'assets/roll.png', time: '08:15 AM' },
        { id: '#12345', item: 'Cold Coffee', customerName: 'Sujata Paul', location: 'Sector V', status: 'Pending', price: 90, image: 'assets/coffee.png', time: '07:45 AM' },
        { id: '#12344', item: 'Cheese Burger', customerName: 'Ankit Bose', location: 'Bidhannagar', status: 'Delivered', price: 140, image: 'assets/burger.png', time: '07:15 AM' },
        { id: '#12343', item: 'Alfredo Pasta', customerName: 'Sneha Roy', location: 'Action Area 1', status: 'Delivered', price: 220, image: 'assets/pasta.png', time: '06:50 AM' },
        { id: '#12342', item: 'Hakubaku Ramen', customerName: 'Vikram Singh', location: 'Salt Lake', status: 'Delivered', price: 350, image: 'assets/ramen.png', time: '05:30 AM' },
        { id: '#12341', item: 'Club Sandwich', customerName: 'Ritu Sen', location: 'New Town', status: 'Pending', price: 110, image: 'assets/sandwich.png', time: '04:15 AM' },
        { id: '#12340', item: 'Mutton Kosa', customerName: 'Joydeep Nag', location: 'Kestopur', status: 'Delivered', price: 450, image: 'assets/mutton.png', time: '03:45 AM' },
        { id: '#12339', item: 'Garlic Naan x2', customerName: 'Megha Kundu', location: 'Sector V', status: 'Delivered', price: 160, image: 'assets/naan.png', time: '02:30 AM' },
        { id: '#12338', item: 'Fish Fry', customerName: 'Arnab Dutta', location: 'Bidhannagar', status: 'Delivered', price: 200, image: 'assets/fish.png', time: '01:15 AM' },
        { id: '#12337', item: 'Sweet Lassi', customerName: 'Tania Ghosh', location: 'Action Area 1', status: 'Pending', price: 60, image: 'assets/lassi.png', time: '12:10 AM' }
    ],
    categories: ['Fast Food', 'Thali', 'Beverages', 'Dessert', 'Non-Veg', 'Veg'],
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
            location: { lat: '', lng: '' }
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
    reviews: [
        { id: 1, customerName: 'Rahul Sharma', rating: 5, comment: 'The Chicken Biryani was amazing! Highly recommended for the taste and quantity.', type: 'restaurant', time: 'Just now' },
        { id: 2, customerName: 'Priya Das', rating: 4, comment: 'Food quality is great, but the packaging could be better. The Fried Rice was delicious.', type: 'restaurant', time: '2 hours ago' },
        { id: 3, customerName: 'Amit Roy', rating: 5, comment: 'Best experience so far! The Mutton Curry was cooked to perfection. Will order again.', type: 'restaurant', time: '5 hours ago' },
        { id: 4, customerName: 'Suman Ghosh', rating: 3, comment: 'The food taste was okay, but it arrived a bit cold. Needs improvement on preparation time.', type: 'restaurant', time: '1 day ago' }
    ],
    statementFilter: 'Last 7 Days',
    customFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customTo: new Date().toISOString().split('T')[0]
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
