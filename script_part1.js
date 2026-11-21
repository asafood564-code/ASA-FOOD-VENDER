// Development Toggle
let isVerifiedTest = false;

// Application State
const state = {
    currentView: 'welcome', // login, otp, home, menu, orders, statistics, payments, profile, add-menu-item, welcome
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
        { id: '#WTH99120', date: '21 Apr 2026, 04:15 PM', amount: 2500, status: 'rejected', method: 'UPI' }
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
        firstName: '',
        lastName: '',
        mobile: '',
        email: '',
        password: '',
        confirmPassword: '',
        kyc: {
            aadhaar: { number: '', front: null, back: null },
            pan: { number: '', front: null },
            fssai: { number: '', front: null }
        },
        paymentStatus: 'pending',
        paymentId: null
    },
    registrationStep: 1,
    tempCategoryLogo: null,
    orderFilter: 'All',
    reviews: [
        { id: 1, customerName: 'Rahul Sharma', rating: 5, comment: 'The Chicken Biryani was amazing! Highly recommended for the taste and quantity.', type: 'restaurant', time: 'Just now' },
        { id: 2, customerName: 'Priya Das', rating: 4, comment: 'Food quality is great, but the packaging could be better. The Fried Rice was delicious.', type: 'restaurant', time: '2 hours ago' },
        { id: 3, customerName: 'Amit Roy', rating: 5, comment: 'Best experience so far! The Mutton Curry was cooked to perfection. Will order again.', type: 'restaurant', time: '5 hours ago' },
        { id: 4, customerName: 'Suman Ghosh', rating: 3, comment: 'The food taste was okay, but it arrived a bit cold. Needs improvement on preparation time.', type: 'restaurant', time: '1 day ago' }
    ]
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

// Global Payout Calculator (Silent Commission Removed)
function getPayout(price) {
    // Return exact fixed item rate without subtracting the 10% commission
    return price;
}

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    renderView(state.currentView);
    updateBottomNav(state.currentView);
    // Initialize history state
    history.replaceState({ view: state.currentView }, '', '');

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
        } else if (scrollTop < lastScrollTop) {
            // Scrolling Up - Show
            nav.classList.remove('translate-y-full');
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, { passive: true });
}

// View Navigation
function navigateTo(view, pushState = true) {
    // Navigation Guard Logic
    const status = state.registrationStatus;

    // Allow 'welcome' and 'login' always
    if (view === 'welcome' || view === 'login') {
        state.currentView = view;
    }
    // Onboarding flow control
    else if (status === 'unregistered' || status === 'basic_completed' || status === 'kyc_completed') {
        state.currentView = 'onboarding';
    }
    // Paid but pending approval
    else if (status === 'paid') {
        if (view === 'restricted-dashboard' || view === 'kyc-status' || view === 'welcome') {
            state.currentView = view;
        } else {
            state.currentView = 'restricted-dashboard';
            showToast('Account under review. Restricted access.');
        }
    }
    // Approved but no restaurant added
    else if (status === 'approved') {
        if (view === 'add-restaurant' || view === 'welcome') {
            state.currentView = view;
        } else {
            state.currentView = 'add-restaurant';
            showToast('Please complete restaurant setup first.');
        }
    }
    // Fully unlocked
    else {
        state.currentView = view;
    }

    renderView(state.currentView);
    updateBottomNav(state.currentView);

    if (pushState) {
        history.pushState({ view: state.currentView }, '', '');
    }
}

function updateBottomNav(view) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    const items = nav.querySelectorAll('.nav-item');

    // Show nav only on main pages AND when registration is fully complete
    const isFullySetup = state.registrationStatus === 'restaurant_added';

    if (VISIBLE_NAV_VIEWS.includes(view) && isFullySetup) {
        nav.classList.remove('translate-y-[200%]', 'pointer-events-none');
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
    }
    window.scrollTo(0, 0);
}

// --- Screen Renderers ---

function renderWelcomeScreen() {
    const app = document.getElementById('app');
    // Hide bottom nav explicitly just in case
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.add('translate-y-[200%]', 'pointer-events-none');

    app.innerHTML = `
        <div class="relative min-h-screen w-full overflow-hidden flex flex-col justify-end">
            <!-- Background Image -->
            <div class="absolute inset-0 z-0">
                <img src="assets/welcome_bg.png" alt="Welcome Background" class="w-full h-full object-cover">
                <!-- Dark Gradient Overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
            </div>

            <!-- Content Area -->
            <div class="relative z-10 px-8 pb-16 text-center animate-fade-in-up">
                <h1 class="text-white text-4xl font-bold leading-tight mb-3">
                    Join ASA Food<br>
                    <span class="text-[#FFD700]">Restaurant Partner</span>
                </h1>
                <p class="text-white/90 text-base font-medium mb-12 max-w-[280px] mx-auto">
                    Create an account to start managing your restaurant.
                </p>

                <div class="flex flex-col gap-4 max-w-sm mx-auto">
                    <!-- Register Button -->
                    <button onclick="navigateTo('onboarding')" 
                        class="w-full py-4 bg-[#FFD700] text-black font-bold rounded-full text-lg shadow-xl shadow-black/20 active:scale-95 transition-all">
                        Register
                    </button>
                    
                    <!-- Login Button -->
                    <button onclick="navigateTo('login')" 
                        class="w-full py-4 bg-transparent border-2 border-[#FFD700] text-[#FFD700] font-bold rounded-full text-lg active:scale-95 transition-all">
                        Login
                    </button>
                </div>
            </div>
        </div>
    `;
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
                            <button onclick="togglePasswordVisibility()" class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#FFD700] transition-colors">
                                <i id="password-toggle-icon" class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                        <!-- Password Hint -->
                        <p id="password-hint" class="text-[#FFD700] text-[10px] font-bold mt-2 ml-1 transition-all opacity-100">
                            <i class="fa-solid fa-circle-info mr-1"></i> Password must be at least 8 characters
                        </p>
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
    const hint = document.getElementById('password-hint');
    const btn = document.getElementById('login-btn');

    // Check password length
    if (password.length > 0 && password.length < 8) {
        hint.classList.remove('opacity-0');
        hint.classList.add('opacity-100');
        hint.innerHTML = `<i class="fa-solid fa-circle-info mr-1"></i> Password must be at least 8 characters (${password.length}/8)`;
    } else {
        hint.classList.add('opacity-0');
        hint.classList.remove('opacity-100');
    }

    // Enable/Disable Button
    if (mobile.length === 10 && password.length >= 8) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function handleLogin() {
    const mobile = document.getElementById('login-mobile').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (mobile.length !== 10 || password.length < 8) return;

    // Show loading state on button
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Authenticating...';
    btn.disabled = true;

    // Default bypass for owner access - Remove before production
    if (password === '88888888') {
        setTimeout(() => {
            errorMsg.classList.add('hidden');
            showToast('Bypass Successful! Welcome Owner.');
            state.userMobile = mobile;
            navigateTo('home');
        }, 800);
        return;
    }

    // SUPABASE AUTHENTICATION LOGIC
    // Querying 'vendors' table as per requirement
    /*
    const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('mobile', mobile)
        .eq('password', password)
        .single();
    */

    // Mocking the result
    const isMockSuccess = (mobile === '9876543210' && password === 'password123') || (mobile === '1234567890' && password === '12345678');

    setTimeout(() => {
        if (isMockSuccess) {
            errorMsg.classList.add('hidden');
            showToast('Authentication Successful!');
            state.userMobile = mobile;
            navigateTo('home');
        } else {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            errorMsg.classList.remove('hidden');
            errorMsg.classList.remove('animate-shake');
            void errorMsg.offsetWidth; // Trigger reflow
            errorMsg.classList.add('animate-shake');
            showToast('Authentication Failed: Invalid credentials');
        }
    }, 1500);
}

function renderHomeScreen() {
    const app = document.getElementById('app');

    // Apply grayscale filter if offline
    if (!state.isOnline) {
        document.body.classList.add('grayscale');
    } else {
        document.body.classList.remove('grayscale');
    }

    // Filter logic for orders
    const filteredOrders = state.homeFilter === 'All'
        ? state.todayOrders
        : state.todayOrders.filter(order => order.status === state.homeFilter);

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
                <h1 class="text-2xl font-black">ASA VENDOR</h1>
                <p class="opacity-80 text-sm font-medium">${t('welcome')}</p>
            </div>
        </div>

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

        <!-- Live Order -->
        ${state.homeFilter === 'All' ? `
            <div class="px-6 mt-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="font-black text-gray-800 text-2xl tracking-tight">Live Order</h3>
                    <span class="flex items-center gap-2 text-green-500 text-xs font-black uppercase tracking-wider">
                        <span class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22C55E] animate-pulse"></span>
                        RECEIVING ORDERS
                    </span>
                </div>

                <div onclick="state.selectedOrderId = '#12348'; navigateTo('order-details')" class="bg-white rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-50 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer">
                    <!-- NEW ORDER Sticker -->
                    <div class="absolute top-0 right-0 bg-[#E31E24] text-white px-6 py-2 font-black text-xs uppercase tracking-widest rounded-bl-3xl shadow-lg z-10 whitespace-nowrap">
                        NEW ORDER
                    </div>

                    <div class="flex items-center gap-6 mb-8">
                        <!-- Icon Placeholder -->
                        <div class="w-16 h-16 rounded-[24px] bg-amber-50 text-amber-500 flex items-center justify-center text-3xl">
                            <i class="fa-solid fa-utensils"></i>
                        </div>

                        <div>
                            <h4 class="text-3xl font-black text-gray-900 mb-1">#12348</h4>
                            <p class="text-sm text-gray-400 font-bold uppercase tracking-widest">2 ITEMS • ₹405.00</p>
                        </div>
                    </div>

                    <div class="w-full py-5 bg-blue-50 text-blue-600 rounded-[28px] font-black text-lg flex items-center justify-center gap-2 border border-blue-100/50">
                        View Order
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- Today's Orders List -->
        <div class="px-6 mt-8">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-gray-800 text-lg">${state.homeFilter === 'All' ? "Today's All Orders" : state.homeFilter + " Orders"}</h3>
                <button onclick="navigateTo('orders')" class="text-primary text-sm font-semibold">View All</button>
            </div>
            
            <div id="home-orders-list" class="space-y-4 fade-in">
                ${filteredOrders.length === 0 ? `
                    <div class="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">
                        <p class="text-gray-400 text-sm">No orders found for this category today.</p>
                    </div>
                ` : filteredOrders.map(order => `
                    <div onclick="navigateTo('order-details')" class="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-100 order-card cursor-pointer">
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
                                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${getStatusClass(order.status)}">${order.status}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function filterTodayOrders(status) {
    state.homeFilter = status;
    renderHomeScreen();

    // Add temporary visual feedback for the list update
    const list = document.getElementById('home-orders-list');
    if (list) {
        list.classList.remove('fade-in');
        void list.offsetWidth; // Trigger reflow
        list.classList.add('fade-in');
    }
}

function getStatusClass(status) {
    if (status === 'Pending') return 'badge-pending';
    if (status === 'Delivered') return 'badge-delivered';
    return 'badge-out';
}

function toggleOnline(val) {
    state.isOnline = val;
    if (!val) {
        // Show offline reason modal
        renderOfflineReasonModal();
    } else {
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
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="this.parentElement.remove(); renderHomeScreen();"></div>
        <div class="bg-white rounded-[32px] p-8 w-full max-w-sm relative z-10 animate-scale-in">
            <h3 class="text-xl font-black text-gray-800 mb-2">Reason for going Offline</h3>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-6">Please select a reason</p>
            
            <div class="space-y-3 mb-8">
                <button onclick="confirmOffline('Store Closed')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Store Closed</button>
                <button onclick="confirmOffline('Too Many Orders')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Too Many Orders</button>
                <button onclick="confirmOffline('Out of Stock')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Out of Stock</button>
                <button onclick="confirmOffline('Technical Issue')" class="w-full p-4 bg-gray-50 hover:bg-amber-50 text-left rounded-2xl font-bold text-gray-700 transition-all">Technical Issue</button>
            </div>
            
            <button onclick="this.parentElement.parentElement.remove(); renderHomeScreen();" class="w-full py-4 text-gray-400 font-bold uppercase text-xs tracking-widest">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmOffline(reason) {
    state.offlineReason = reason;
    document.getElementById('offline-reason-modal').remove();
    renderHomeScreen();
    showToast(`Offline: ${reason}`);
}

function updatePrepTime(delta) {
    state.prepTime = Math.max(5, state.prepTime + delta);
    document.getElementById('prep-time-display').innerText = `${state.prepTime}m`;
}

function renderOrderDetails() {
    const app = document.getElementById('app');
    const order = state.todayOrders.find(o => o.id === state.selectedOrderId) || state.todayOrders[0];

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
                        <p class="text-white/80 text-xs">Order ID: ${order.id}</p>
                    </div>
                </div>
            </div>

            <!-- Content Area -->
            <div class="px-6 -mt-6">
                <!-- Customer Details Card -->
                <div class="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 mb-6">
                    ${(order.customerInstructions) ? `
                        <div class="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-4">
                            <p class="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Customer Instructions</p>
                            <p class="text-xs text-blue-600 font-bold">"${order.customerInstructions}"</p>
                        </div>
                    ` : ''}
                    <div class="flex items-center gap-4 mb-4 pb-4 border-b border-gray-50">
                        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-primary flex items-center justify-center font-black text-lg">
                            ${order.customerName ? order.customerName.charAt(0) : 'C'}
                        </div>
                        <div>
                            <h4 class="font-black text-gray-800">${order.customerName || 'Customer'}</h4>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${order.location}</p>
                        </div>
                    </div>
                </div>

                <!-- Item Details Card -->
                <div class="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 mb-6">
                    <h3 class="font-bold text-gray-800 mb-4 border-b pb-3 flex items-center justify-between">
                        Items
                        <span class="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">2 Items</span>
                    </h3>
                    <div class="space-y-4 mb-6">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-sm border border-green-500 flex items-center justify-center"><span class="w-1 h-1 rounded-full bg-green-500"></span></span>
                                <span class="text-sm text-gray-600 font-bold">Veg Biryani x1</span>
                            </div>
                            <span class="text-sm font-black text-gray-800">₹ ${getPayout(150).toFixed(2)}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-sm border border-amber-500 flex items-center justify-center"><span class="w-1 h-1 rounded-full bg-amber-500"></span></span>
                                <span class="text-sm text-gray-600 font-bold">Chicken Burger x1</span>
                            </div>
                            <span class="text-sm font-black text-gray-800">₹ ${getPayout(100).toFixed(2)}</span>
                        </div>
                    </div>

                    <div class="border-t border-dashed border-gray-100 pt-4 space-y-2">
                        <div class="flex justify-between text-sm text-gray-400 font-bold uppercase">
                            <span class="text-[10px]">Total Price</span>
                            <span class="text-primary text-lg">₹ ${getPayout(250).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <!-- Address Section -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-6">
                    <h3 class="font-bold text-gray-800 mb-6">Address Details</h3>
                    <div>
                        <div class="mb-8 relative">
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-widest">RESTAURANT ADDRESS</p>
                            <p class="text-sm font-bold text-gray-800">ASA Food - Salt Lake</p>
                            <p class="text-[11px] text-gray-500">Sector V, Bidhannagar, Kolkata</p>
                        </div>
                        <div class="relative">
                            <div class="timeline-dot bottom"></div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-widest">CUSTOMER ADDRESS</p>
                            <p class="text-sm font-bold text-gray-800">${order.customerName || 'Customer'}</p>
                            <p class="text-[11px] text-gray-500">${order.location}, New Town, Kolkata</p>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons (Visible for Pending orders) -->
                ${order.status === 'Pending' ? `
                    <div class="grid grid-cols-2 gap-4 mt-8">
                        <button onclick="openRejectModal('${order.id}')" class="py-4 bg-gray-100 text-gray-400 rounded-[24px] font-black uppercase text-xs active:scale-95 transition-all hover:bg-amber-50 hover:text-amber-500">
                            Reject
                        </button>
                        <button onclick="openAcceptModal('${order.id}')" class="py-4 bg-primary text-white rounded-[24px] font-black uppercase text-xs shadow-xl shadow-amber-100 active:scale-95 transition-all">
                            Accept Order
                        </button>
                    </div>
                ` : `
                    <div class="text-center py-6">
                        <span class="text-sm font-bold text-gray-400 uppercase tracking-widest">Order is already ${order.status}</span>
                    </div>
                `}
            </div>

            <!-- Modals Container -->
            <div id="order-modal-container" class="fixed inset-0 z-[9999] hidden">
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 opacity-0" id="modal-overlay" onclick="closeOrderModal()"></div>
                
                <!-- Accept Modal -->
                <div id="accept-modal" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] p-8 transform translate-y-full transition-transform duration-500 ease-out z-[10000] max-h-[60vh] overflow-hidden flex flex-col">
                    <div class="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8 shrink-0"></div>
                    
                    <div class="overflow-y-auto flex-1 no-scrollbar">
                        <div class="text-center mb-8">
                            <h3 class="text-2xl font-black text-[#1A1C1E] mb-1">Order Preparing Time</h3>
                            <p class="text-gray-400 font-bold flex items-center justify-center gap-1.5 text-sm">
                                How much time do you need? 
                                <i class="fa-solid fa-circle-question text-gray-300 text-xs"></i>
                            </p>
                        </div>

                        <div class="bg-white rounded-[32px] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.03)] border border-gray-50 flex items-center justify-between mb-8">
                            <span class="font-bold text-[#1A1C1E] text-lg">Preparation Time</span>
                            <div class="flex items-center gap-4 bg-[#F7F8FA] p-2 rounded-2xl">
                                <button onclick="updateModalPrepTime(-5)" class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-800 hover:bg-gray-50 transition-all active:scale-90">
                                    <i class="fa-solid fa-minus"></i>
                                </button>
                                <span id="modal-prep-display" class="text-xl font-black text-[#E31E24] min-w-[50px] text-center">${state.modalPrepTime}m</span>
                                <button onclick="updateModalPrepTime(5)" class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-800 hover:bg-gray-50 transition-all active:scale-90">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-auto mb-20 shrink-0">
                        <button onclick="confirmOrderAccept()" class="w-full py-5 bg-[#FFC107] text-[#1A1C1E] rounded-[32px] font-black text-lg shadow-xl shadow-amber-100 active:scale-95 transition-all flex items-center justify-center gap-3">
                            <i class="fa-solid fa-clipboard-check text-xl"></i>
                            Confirm Order
                        </button>
                    </div>
                </div>

                <!-- Reject Modal -->
                <div id="reject-modal" class="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] p-8 transform translate-y-full transition-transform duration-500 ease-out z-[10000] max-h-[60vh] overflow-hidden flex flex-col">
                    <div class="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8 shrink-0"></div>
                    
                    <div class="overflow-y-auto flex-1 no-scrollbar">
                        <h3 class="text-2xl font-black text-gray-800 mb-1 text-center">Rejection Reason</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8 text-center">Please provide a valid reason</p>
                        
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
                        <button onclick="confirmOrderReject()" class="flex-2 py-5 bg-[#FFC107] text-[#1A1C1E] rounded-[28px] font-black uppercase text-xs shadow-xl shadow-amber-100">Submit & Reject</button>
                    </div>
                </div>
            </div>
        </div>
    `;

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
}

function openAcceptModal(orderId) {
    state.selectedOrderId = orderId;
    const container = document.getElementById('order-modal-container');
    const overlay = document.getElementById('modal-overlay');
    const acceptModal = document.getElementById('accept-modal');
    const rejectModal = document.getElementById('reject-modal');

    if (!container || !overlay || !acceptModal) return;

    container.classList.remove('hidden');
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    acceptModal.classList.remove('translate-y-full');
    if (rejectModal) rejectModal.classList.add('translate-y-full');
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

// Sophisticated Onboarding & Authorization Flow
function renderOnboardingScreen() {
    const app = document.getElementById('app');
    const status = state.registrationStatus;

    let currentStep = 1;
    if (status === 'basic_completed') currentStep = 2;
    else if (status === 'kyc_completed') currentStep = 3;

    app.innerHTML = `
        <div class="bg-white min-h-screen flex flex-col">
            <div class="px-6 py-6 flex items-center border-b border-gray-50">
                <button onclick="navigateTo('welcome')" class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-800">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h2 class="ml-4 text-xl font-bold text-gray-800">Vendor Onboarding</h2>
            </div>

            <div class="px-8 py-8">
                <div class="flex justify-between items-center relative">
                    <div class="absolute top-1/2 left-0 w-full h-[2px] bg-gray-100 -z-10"></div>
                    <div class="absolute top-1/2 left-0 h-[2px] bg-primary -z-10 transition-all duration-500" style="width: ${(currentStep - 1) * 50}%"></div>
                    
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${currentStep >= 1 ? 'bg-primary text-white shadow-lg shadow-amber-200' : 'bg-gray-100 text-gray-400'}">1</div>
                        <span class="text-[9px] font-bold mt-2 uppercase text-gray-400">Basic</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${currentStep >= 2 ? 'bg-primary text-white shadow-lg shadow-amber-200' : 'bg-gray-100 text-gray-400'}">2</div>
                        <span class="text-[9px] font-bold mt-2 uppercase text-gray-400">KYC</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${currentStep >= 3 ? 'bg-primary text-white shadow-lg shadow-amber-200' : 'bg-gray-100 text-gray-400'}">3</div>
                        <span class="text-[9px] font-bold mt-2 uppercase text-gray-400">Payment</span>
                    </div>
                </div>
            </div>

            <div class="flex-1 px-6 pb-24 overflow-y-auto">
                ${renderCurrentOnboardingStep(currentStep)}
            </div>
        </div>
    `;
}

function renderCurrentOnboardingStep(step) {
    switch (step) {
        case 1: return renderBasicDetailsForm();
        case 2: return renderKYCUploadForm();
        case 3: return renderPaymentGateway();
        default: return '';
    }
}

function renderBasicDetailsForm() {
    const d = state.registrationData;
    return `
        <div class="animate-fade-in-up">
            <h3 class="text-2xl font-bold text-gray-800 mb-2">Basic Details</h3>
            <p class="text-gray-400 text-sm mb-8">Enter your primary contact information</p>

            <div class="space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                        <input type="text" id="reg-fname" value="${d.firstName}" oninput="state.registrationData.firstName = this.value" placeholder="John" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                        <input type="text" id="reg-lname" value="${d.lastName}" oninput="state.registrationData.lastName = this.value" placeholder="Doe" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mobile Number</label>
                    <input type="tel" id="reg-mobile" value="${d.mobile}" oninput="state.registrationData.mobile = this.value" placeholder="10-digit mobile" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email ID</label>
                    <input type="email" id="reg-email" value="${d.email}" oninput="state.registrationData.email = this.value" placeholder="john@example.com" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Create Password</label>
                    <input type="password" id="reg-pass" value="${d.password}" oninput="state.registrationData.password = this.value" placeholder="Min 8 characters" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirm Password</label>
                    <input type="password" id="reg-confirm" value="${d.confirmPassword}" oninput="state.registrationData.confirmPassword = this.value" placeholder="Repeat password" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                </div>

                <button onclick="saveBasicDetails()" class="w-full mt-6 py-5 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-amber-100 active:scale-95 transition-all">
                    Save to Continue
                </button>
            </div>
        </div>
    `;
}

function saveBasicDetails() {
    const d = state.registrationData;
    if (!d.firstName || !d.lastName || !d.mobile || !d.email || d.password.length < 8) {
        showToast('Please fill all fields correctly (Password min 8 chars)');
        return;
    }
    if (d.password !== d.confirmPassword) {
        showToast('Passwords do not match');
        return;
    }

    state.vendorName = `${d.firstName} ${d.lastName}`;
    state.vendorPhone = `+91 ${d.mobile}`;
    state.vendorEmail = d.email;

    state.registrationStatus = 'basic_completed';
    showToast('Profile synced! Now upload your documents.');
    renderOnboardingScreen();
}

function renderKYCUploadForm() {
    const k = state.registrationData.kyc;
    return `
        <div class="animate-fade-in-up">
            <h3 class="text-2xl font-bold text-gray-800 mb-2">KYC Verification</h3>
            <p class="text-gray-400 text-sm mb-8">Official documents for verification</p>

            <div class="space-y-8">
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Aadhaar Card Details</label>
                    <input type="text" maxlength="12" value="${k.aadhaar.number}" oninput="state.registrationData.kyc.aadhaar.number = this.value" placeholder="12-digit Aadhaar Number" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mb-4 outline-none focus:border-primary">
                    <div class="grid grid-cols-2 gap-4">
                        <div onclick="triggerKYCUpload('aadhaar', 'front')" class="h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                            ${k.aadhaar.front ? `<img src="${k.aadhaar.front}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-id-card text-gray-300 text-xl mb-1"></i><span class="text-[9px] font-bold text-gray-400 uppercase">Front Side</span>`}
                        </div>
                        <div onclick="triggerKYCUpload('aadhaar', 'back')" class="h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                            ${k.aadhaar.back ? `<img src="${k.aadhaar.back}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-id-card text-gray-300 text-xl mb-1"></i><span class="text-[9px] font-bold text-gray-400 uppercase">Back Side</span>`}
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">PAN Card Details</label>
                    <input type="text" maxlength="10" value="${k.pan.number}" oninput="state.registrationData.kyc.pan.number = this.value" placeholder="10-digit PAN Number" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mb-4 outline-none focus:border-primary uppercase">
                    <div onclick="triggerKYCUpload('pan', 'front')" class="h-40 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                        ${k.pan.front ? `<img src="${k.pan.front}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-id-card-clip text-gray-300 text-2xl mb-2"></i><span class="text-[10px] font-bold text-gray-400 uppercase">Upload PAN Front</span>`}
                    </div>
                </div>

                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">FSSAI License</label>
                    <input type="text" value="${k.fssai.number}" oninput="state.registrationData.kyc.fssai.number = this.value" placeholder="FSSAI License Number" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm mb-4 outline-none focus:border-primary">
                    <div onclick="triggerKYCUpload('fssai', 'front')" class="h-40 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                        ${k.fssai.front ? `<img src="${k.fssai.front}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-certificate text-gray-300 text-2xl mb-2"></i><span class="text-[10px] font-bold text-gray-400 uppercase">Upload FSSAI Photo</span>`}
                    </div>
                </div>

                <input type="file" id="kyc-file-input" class="hidden" accept="image/*" onchange="handleKYCFileUpload(this)">

                <button onclick="saveKYCDetails()" class="w-full mt-6 py-5 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-amber-100 active:scale-95 transition-all">
                    Save to Continue
                </button>
            </div>
        </div>
    `;
}

function saveKYCDetails() {
    const k = state.registrationData.kyc;
    if (!k.aadhaar.number || !k.aadhaar.front || !k.aadhaar.back || !k.pan.number || !k.pan.front || !k.fssai.number || !k.fssai.front) {
        showToast('Please upload all mandatory documents and enter numbers');
        return;
    }
    state.registrationStatus = 'kyc_completed';
    showToast('KYC details saved!');
    renderOnboardingScreen();
}

function renderPaymentGateway() {
    return `
        <div class="animate-fade-in-up flex flex-col h-full">
            <h3 class="text-2xl font-bold text-gray-800 mb-2">Onboarding Fee</h3>
            <p class="text-gray-400 text-sm mb-12">One-time payment for platform access</p>

            <div class="bg-amber-50 rounded-[40px] p-10 text-center mb-auto border border-amber-100">
                <div class="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary text-3xl">
                    <i class="fa-solid fa-lock-open"></i>
                </div>
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Amount Payable</p>
                <h4 class="text-5xl font-black text-gray-800 mb-3">₹ 750</h4>
                <p class="text-xs text-amber-700 leading-relaxed font-medium">
                    Access to the platform is <span class="font-bold underline">restricted</span> until this one-time activation fee is successfully paid.
                </p>
            </div>

            <div class="pt-10">
                <button onclick="handleOnboardingPayment()" id="onboarding-pay-btn" class="w-full py-5 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-amber-100 active:scale-95 transition-all">
                    Pay Now & Activate
                </button>
                <p class="text-center text-[9px] text-gray-400 mt-4 uppercase font-bold tracking-widest">Secured by Razorpay • UPI • Card</p>
            </div>
        </div>
    `;
}

function handleOnboardingPayment() {
    const btn = document.getElementById('onboarding-pay-btn');
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Initializing Payment...';
    btn.disabled = true;

    setTimeout(() => {
        state.registrationStatus = 'paid';
        state.registrationData.paymentId = 'TXN_' + Date.now();
        showToast('Payment successful! Redirecting to dashboard...');
        setTimeout(() => navigateTo('restricted-dashboard'), 1000);
    }, 2000);
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
                Thank you for joining ASA Food! Your documents are currently being verified by our team. You will have full access once approved.
            </p>
            
            <div class="space-y-4 w-full max-w-xs">
                <button onclick="navigateTo('kyc-status')" class="w-full py-4 bg-white text-gray-800 border-2 border-gray-100 rounded-2xl font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center gap-3">
                    <i class="fa-solid fa-file-shield text-primary"></i>
                    Verify Documents
                </button>
                <button onclick="navigateTo('welcome')" class="w-full py-4 bg-transparent text-gray-400 font-bold active:scale-95 transition-all uppercase text-xs tracking-widest">
                    Logout
                </button>
            </div>

            <!-- Developer Hack for Testing -->
            <div class="mt-12 p-4 bg-white rounded-2xl border border-dashed border-gray-200">
                <p class="text-[8px] font-black text-gray-300 uppercase mb-2">Admin Control (Test Mode)</p>
                <button onclick="mockAdminApproval()" class="px-4 py-2 bg-green-500 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">
                    MOCK ADMIN APPROVE
                </button>
            </div>
        </div>
    `;
}

function mockAdminApproval() {
    state.registrationStatus = 'approved';
    showToast('ADMIN ACTION: Account Approved!');
    navigateTo('add-restaurant');
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

function renderAddRestaurantForm() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="bg-white min-h-screen pb-24">
            <div class="px-6 py-10">
                <h2 class="text-3xl font-black text-gray-800 mb-2">Setup Restaurant</h2>
                <p class="text-gray-400 text-sm mb-10">Final step to unlock your dashboard</p>

                <div class="space-y-6">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Restaurant Name</label>
                        <input type="text" id="setup-res-name" placeholder="e.g. ASA FOOD - Kolkata" class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Restaurant Cover Photo</label>
                        <div onclick="triggerImageUpload()" class="h-44 rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                            <i class="fa-solid fa-camera text-3xl text-gray-300"></i>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Primary Cuisine</label>
                        <select class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:border-primary outline-none appearance-none">
                            <option>Indian</option>
                            <option>Chinese</option>
                            <option>Fast Food</option>
                            <option>Bengali</option>
                        </select>
                    </div>
                    
                    <button onclick="finalizeRestaurantSetup()" class="w-full mt-6 py-5 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-amber-100 active:scale-95 transition-all">
                        Complete Setup & Launch
                    </button>
                </div>
            </div>
        </div>
    `;
}

function finalizeRestaurantSetup() {
    const name = document.getElementById('setup-res-name').value;
    if (!name) {
        showToast('Please enter restaurant name');
        return;
    }

    state.registrationStatus = 'restaurant_added';
    state.restaurantDetails = { name: name, coverImage: 'assets/welcome_bg.png' };
    showToast('Congratulations! Platform Unlocked.');
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

function confirmOrderReject() {
    const select = document.getElementById('reject-reason-select');
    const reason = select ? select.value : '';
    if (!reason) { showToast('Please select a reason'); return; }
    const order = state.todayOrders.find(o => o.id === state.selectedOrderId);
    if (order) {
        order.status = 'Rejected';
        showToast(`Order #${order.id.replace('#', '')} rejected: ${reason}`);
    }
    closeOrderModal();
    setTimeout(() => navigateTo('home'), 500);
}

