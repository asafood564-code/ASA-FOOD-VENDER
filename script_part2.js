function renderStatusScreen() {
    const app = document.getElementById('app');

    // DEV BYPASS: If test mode is on, force the dashboard
    if (isVerifiedTest) {
        // Ensure mock data exists for testing the dashboard
        if (!state.restaurantDetails) {
            state.restaurantDetails = {
                name: "Spice Garden",
                coverImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
                galleryImages: [
                    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400",
                    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400",
                    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400",
                    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400"
                ],
                hours: {
                    Sunday: { open: "10:00 AM", close: "11:00 PM" },
                    Monday: { open: "10:00 AM", close: "11:00 PM" },
                    Tuesday: { open: "10:00 AM", close: "11:00 PM" },
                    Wednesday: { open: "10:00 AM", close: "11:00 PM" },
                    Thursday: { open: "10:00 AM", close: "11:00 PM" },
                    Friday: { open: "10:00 AM", close: "11:00 PM" },
                    Saturday: { open: "10:00 AM", close: "11:00 PM" }
                },
                cuisineType: "Both",
                offers: [{ id: 1, title: 'FLAT 20% OFF', code: 'WELCOME20', discount: '20% OFF', status: 'Active' }]
            };
        }
        renderRestaurantDashboardScreen();
        return;
    }

    if (state.verificationStatus === 'pending') {
        app.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
                <div class="status-illustration mb-10">
                    <i class="fa-solid fa-hourglass-half text-6xl text-primary animate-pulse"></i>
                </div>
                
                <h2 class="text-2xl font-black text-gray-800 mb-4">Verification in Progress!</h2>
                <p class="text-gray-500 text-sm mb-10 px-4">
                    Thank you for your payment. Your documents have been successfully submitted and are currently under review.
                </p>
                
                <div class="bg-gray-50 rounded-3xl p-6 w-full max-w-sm text-left mb-10">
                    <div class="flex items-start gap-4">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                            <i class="fa-solid fa-user-shield text-xs"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-800 text-sm">Verification Timeline</h4>
                            <p class="text-xs text-gray-400">Our team will audit your profile within <span class="text-primary font-bold">24 to 48 hours</span>.</p>
                        </div>
                    </div>
                </div>
                
                <p class="text-gray-400 text-xs">You will receive an email/SMS notification once your dashboard is activated.</p>
                
                <button onclick="goBack()" class="mt-12 text-primary font-bold">Back to Login</button>
                
                <!-- Developer Shortcut -->
                <button onclick="approveVerification()" class="mt-4 text-[10px] text-gray-300 uppercase tracking-widest font-bold">Dev: Approve Now</button>
            </div>
        `;
    } else if (state.verificationStatus === 'approved') {
        if (!state.restaurantDetails) {
            app.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
                    <div class="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                        <i class="fa-solid fa-building-circle-check text-4xl text-primary"></i>
                    </div>
                    <h2 class="text-2xl font-black text-gray-800 mb-4">Account Verified!</h2>
                    <p class="text-gray-500 text-sm mb-10">Your account has been approved. Now, let's set up your restaurant profile to start selling.</p>
                    
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
}

function approveVerification() {
    state.verificationStatus = 'approved';
    renderStatusScreen();
    showToast('Account Approved by Admin!');
}


function toggleItemAvailability(id, isAvailable) {
    const item = state.menuItems.find(i => i.id === id);
    if (item) item.available = isAvailable;
    showToast(isAvailable ? 'Item Enabled' : 'Item Disabled');
}

function renderMenuScreen() {
    const app = document.getElementById('app');
    const categories = ['All', 'Fast Food', 'Thali', 'Beverages', 'Dessert'];

    // If already in menu view and search input exists, just update the display
    if (state.currentView === 'menu' && document.getElementById('menu-search')) {
        updateMenuItemsDisplay();
        return;
    }

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold">Food Menu</h2>
                    <div class="flex items-center gap-2">
                        <button onclick="openAddCategoryModal()" class="bg-[#FFD700] text-black px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm">
                            Add Category
                        </button>
                        <button onclick="state.editingMenuItemId = null; navigateTo('add-menu-item')" class="bg-[#FFD700] text-black px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-all shadow-sm flex items-center gap-1">
                            <i class="fa-solid fa-plus"></i> Add Product
                        </button>
                    </div>
                </div>
                <!-- Search Bar -->
                <div class="relative">
                    <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-sm"></i>
                    <input type="text" id="menu-search" value="${state.searchQuery}" oninput="handleMenuSearch(this.value)" placeholder="Search food items..." class="w-full bg-white/10 border border-white/20 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/20 transition-all">
                </div>
            </div>

            <!-- Categories Chips -->
            <div id="category-chips-container" class="px-6 mb-6 overflow-x-auto no-scrollbar flex gap-3">
                ${renderCategoryChipsHTML()}
            </div>

            <!-- Menu List -->
            <div id="menu-items-list" class="px-6 space-y-4">
                ${renderMenuItemsHTML()}
            </div>
        </div>
    `;
}

function renderCategoryChipsHTML() {
    const categories = ['All', ...state.categories];
    return categories.map(cat => `
        <button onclick="selectCategory('${cat}')" class="category-chip ${state.selectedCategory === cat ? 'active' : ''}">
            ${cat}
        </button>
    `).join('');
}

function renderMenuItemsHTML() {
    const filteredItems = state.menuItems.filter(item => {
        const matchesCategory = state.selectedCategory === 'All' || item.category === state.selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(state.searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) {
        return `
            <div class="text-center py-20">
                <i class="fa-solid fa-utensils text-4xl text-gray-200 mb-4"></i>
                <p class="text-gray-400 font-bold">No items found</p>
            </div>
        `;
    }

    return filteredItems.map(item => `
        <div class="bg-white p-4 rounded-[28px] shadow-sm border border-gray-50 flex items-center gap-4 relative fade-in">
            <img src="${item.image}" class="w-16 h-16 rounded-2xl object-cover bg-gray-50">
            <div class="flex-1">
                <div class="flex items-center gap-1.5 mb-0.5">
                    <span class="w-2.5 h-2.5 rounded-sm border border-green-500 flex items-center justify-center"><span class="w-1 h-1 rounded-full bg-green-500"></span></span>
                    <h4 class="text-sm font-black text-gray-800">${item.name}</h4>
                </div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">${item.category} • ${item.weight || '1 Plate'}</p>
                <p class="text-sm font-black text-primary mt-1">₹ ${item.price}</p>
            </div>
            <div class="flex flex-col items-end gap-3">
                <label class="toggle-switch">
                    <input type="checkbox" ${item.available !== false ? 'checked' : ''} onchange="toggleItemAvailability(${item.id}, this.checked)">
                    <span class="slider"></span>
                </label>
                <div class="flex items-center gap-3">
                    <button onclick="editMenuItem(${item.id})" class="text-gray-300 hover:text-blue-500 transition-colors">
                        <i class="fa-solid fa-pencil text-sm"></i>
                    </button>
                    <button onclick="deleteItem(${item.id})" class="text-gray-300 hover:text-amber-500 transition-colors">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
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
        state.selectedMenuImage = editItem.image;
    } else if (state.editingMenuItemId === null) {
        // Only reset if we are not coming back to a half-filled form or edit mode
        // For simplicity, we reset addons and image when opening "Add" screen
        state.tempAddons = [];
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
                                    <input type="text" id="add-item-unit" value="${editItem ? (editItem.weight || '').replace('1 ', '') : ''}" list="unit-options" placeholder="Select or type unit" class="form-input-custom">
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
                                    <input type="text" id="add-item-qty-per-unit" value="${editItem ? (editItem.qtyPerUnit || '') : ''}" placeholder="e.g. 100" class="form-input-custom">
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

                            <!-- Stock Row -->
                            <div>
                                <label class="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Stock <span class="text-primary">*</span></label>
                                <input type="number" id="add-item-stock" value="${editItem ? editItem.stock : ''}" placeholder="Enter stock" class="form-input-custom">
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
                                    ${state.selectedMenuImage ? `
                                        <img src="${state.selectedMenuImage}" class="absolute inset-0 w-full h-full object-cover">
                                        <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p class="text-white font-bold text-sm">Change Image</p>
                                        </div>
                                    ` : `
                                        <div class="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                                            <i class="fa-solid fa-cloud-arrow-up text-2xl"></i>
                                        </div>
                                        <div class="text-center">
                                            <p class="text-sm font-bold text-gray-800">Drag & drop an image here</p>
                                            <p class="text-xs text-gray-400 mt-1">or</p>
                                        </div>
                                        <button class="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-100 group-hover:bg-amber-700 transition-colors">Choose Image</button>
                                        <p class="text-[10px] text-gray-400 mt-2 text-center">Recommended size: 800x800px<br>Max size: 2MB (JPG, PNG)</p>
                                    `}
                                </div>
                                <input type="file" id="add-item-image-input" class="hidden" accept="image/*" onchange="handleAddImagePreview(this)">
                            </div>
                        </div>

                        <!-- Additional Details Section -->
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <h3 class="text-lg font-bold text-gray-800">Additional Details (Vendor or App)</h3>
                            
                            <div id="addons-list" class="space-y-3">
                                <!-- Dynamic Add-ons will appear here -->
                            </div>

                            <div class="pt-4 border-t border-gray-50">
                                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">Add New Option</p>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" id="addon-name" placeholder="Detail Name (e.g. Extra Cheese)" class="form-input-custom">
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
                <div class="mt-12 flex justify-center">
                    <button onclick="handleSaveMenuItem()" class="w-full max-w-sm py-5 bg-primary text-white rounded-3xl font-bold shadow-xl shadow-amber-100 active:scale-95 transition-all flex items-center justify-center gap-3">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        ${buttonText}
                    </button>
                </div>
            </div>
        </div>
    `;

    renderAddonsList();
}

function triggerAddImageUpload() {
    document.getElementById('add-item-image-input').click();
}

function handleAddImagePreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('add-item-preview-img');
            const placeholder = document.getElementById('preview-placeholder');
            img.src = e.target.result;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
            state.selectedMenuImage = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function handleAddAddon() {
    const name = document.getElementById('addon-name').value;
    const price = document.getElementById('addon-price').value;

    if (!name || !price) {
        showToast('Please fill addon details');
        return;
    }

    state.tempAddons.push({ id: Date.now(), name, price: parseFloat(price) });
    
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

function removeAddon(id) {
    state.tempAddons = state.tempAddons.filter(a => a.id !== id);
    renderAddonsList();
}

function editMenuItem(id) {
    state.editingMenuItemId = id;
    navigateTo('add-menu-item');
}

function handleSaveMenuItem() {
    const name = document.getElementById('add-item-name').value;
    const category = document.getElementById('add-item-category').value;
    const unit = document.getElementById('add-item-unit').value;
    const qtyPerUnit = document.getElementById('add-item-qty-per-unit').value;
    const mrp = document.getElementById('add-item-mrp').value;
    const price = document.getElementById('add-item-price').value;
    const stock = document.getElementById('add-item-stock').value;
    const opening = document.getElementById('add-item-opening').value;
    const closing = document.getElementById('add-item-closing').value;
    const desc = document.getElementById('add-item-desc').value;

    if (!name || !category || !unit || !mrp || !price || !stock || !opening || !closing || !state.selectedMenuImage) {
        showToast('Please fill all mandatory fields and upload an image');
        return;
    }

    const newItem = {
        id: state.editingMenuItemId || Date.now(),
        name,
        category,
        weight: `1 ${unit}`,
        qtyPerUnit,
        price: parseFloat(price),
        mrp: parseFloat(mrp),
        stock: parseInt(stock),
        timing: { start: opening, end: closing },
        desc,
        image: state.selectedMenuImage,
        available: true,
        active: true,
        addons: [...state.tempAddons]
    };

    if (state.editingMenuItemId) {
        const index = state.menuItems.findIndex(i => i.id === state.editingMenuItemId);
        if (index > -1) {
            state.menuItems[index] = newItem;
            showToast('Item updated successfully!');
        }
    } else {
        state.menuItems.unshift(newItem);
        showToast('Item saved successfully!');
    }

    state.selectedMenuImage = null;
    state.tempAddons = [];
    state.editingMenuItemId = null;
    
    setTimeout(() => navigateTo('menu'), 1000);
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

function saveNewItem() {
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

    const newItem = {
        id: Date.now(),
        name,
        price,
        category,
        weight,
        timing: { start: startTime, end: endTime },
        available: true,
        desc,
        image: state.selectedMenuImage || 'assets/biryani.png'
    };

    state.menuItems.unshift(newItem);
    state.selectedMenuImage = null; // Reset
    hideAddItemModal();
    renderMenuScreen();
    showToast('Item added successfully!');
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
                        <h3 class="text-4xl font-black text-primary">₹ ${totalEarning.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
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
                        <p class="text-2xl font-black text-gray-800">${deliveredToday.length}</p>
                    </div>
                    <div class="flex-1 text-center py-2">
                        <div class="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-2">
                            <i class="fa-solid fa-file-invoice-dollar text-xl"></i>
                        </div>
                        <p class="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-tighter">Total Pending</p>
                        <p class="text-2xl font-black text-gray-800">₹ ${totalPending.toLocaleString()}</p>
                    </div>
                </div>

                <!-- Earnings List -->
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 class="font-black text-gray-800 text-lg uppercase tracking-tight">Today's Orders</h3>
                    <button class="text-primary text-[10px] font-black uppercase tracking-widest border-b-2 border-primary/20 pb-0.5">View All</button>
                </div>

                <div class="space-y-4">
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

        if (error) throw error;

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
    let filteredOrders = state.recentOrders;
    if (state.orderFilter === 'Pending') {
        filteredOrders = state.recentOrders.filter(o => ['Pending', 'Preparing', 'Out for Delivery', 'Waiting for rider'].includes(o.status));
    } else if (state.orderFilter === 'Completed') {
        filteredOrders = state.recentOrders.filter(o => o.status === 'Delivered');
    } else if (state.orderFilter === 'Cancelled') {
        filteredOrders = state.recentOrders.filter(o => ['Rejected', 'Cancelled'].includes(o.status));
    }

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Order History</h2>
                </div>
            </div>

            <div class="px-6 pb-24">
                <!-- Filters -->
                <div class="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
                    ${['All', 'Pending', 'Completed', 'Cancelled'].map(filter => `
                        <button onclick="setOrderFilter('${filter}')" 
                            class="px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap
                            ${state.orderFilter === filter ? 'bg-primary text-white shadow-lg shadow-amber-100' : 'bg-white text-gray-400 border border-gray-100'}">
                            ${filter === 'All' ? 'All Orders' : filter}
                        </button>
                    `).join('')}
                </div>
                
                <!-- Order List -->
                <div class="space-y-4 fade-in" id="order-history-list">
                    ${filteredOrders.length === 0 ? `
                        <div class="flex flex-col items-center justify-center py-20 text-center">
                            <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <i class="fa-solid fa-box-open text-gray-300 text-3xl"></i>
                            </div>
                            <h3 class="font-bold text-gray-800 mb-1">No Orders Found</h3>
                            <p class="text-gray-400 text-xs">There are no ${state.orderFilter !== 'All' ? state.orderFilter.toLowerCase() : ''} orders to show.</p>
                        </div>
                    ` : filteredOrders.map(order => `
                        <div onclick="state.selectedOrderId = '${order.id}'; navigateTo('order-details')" class="bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm active:scale-[0.98] transition-all cursor-pointer">
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
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">28 April 2026, 10:30 PM</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}
function setOrderFilter(filter) {
    state.orderFilter = filter;
    renderOrdersScreen();
    
    // Smooth transition for the list
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
                <h3 class="text-4xl font-black mb-8">₹ ${getPayout(state.walletBalance).toLocaleString()}</h3>
                
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

function renderProfileScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="profile-container pb-24 bg-white min-h-screen">
            <div class="px-6 pt-12 pb-4 flex justify-between items-end">
                <h1 class="text-3xl font-black text-gray-800">My Profile</h1>
                <button onclick="simulateNewReview()" class="text-[8px] text-gray-200 font-bold uppercase tracking-widest hover:text-primary transition-colors mb-1">Dev: Mock Review</button>
            </div>

            <!-- Top Section Card -->
            <div class="px-6 mb-8">
                <div class="bg-white rounded-[40px] p-6 flex items-center gap-6 border border-gray-50 shadow-xl shadow-gray-100/50">
                    <div class="relative">
                        <div class="w-20 h-20 rounded-full border-2 border-primary/20 p-1">
                            <img src="${state.vendorPhoto}" class="w-full h-full rounded-full object-contain bg-gray-50" alt="Profile">
                        </div>
                    </div>
                    <div class="flex-1">
                        <h2 class="text-xl font-black text-gray-800">${state.vendorName}</h2>
                        <p class="text-gray-400 text-xs mb-3">${state.vendorEmail}</p>
                        <button onclick="navigateTo('edit-profile')" class="px-5 py-1.5 bg-primary text-white rounded-full font-bold text-[10px] shadow-lg shadow-amber-100 active:scale-95 transition-all uppercase tracking-wider">
                            Edit Profile
                        </button>
                    </div>
                </div>
            </div>

            <!-- Services Section -->
            <div class="px-6 mt-4">
                <h3 class="text-sm font-bold text-gray-400 mb-4 px-2">Services</h3>
                <div class="space-y-2">
                    
                    <!-- My Wallet -->
                    <div onclick="navigateTo('wallet')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-amber-500 text-xl">
                                <i class="fa-solid fa-wallet"></i>
                            </div>
                            <span class="font-bold text-gray-700">My Wallet</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- My Bank -->
                    <div onclick="navigateTo('bank')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-indigo-600 text-xl">
                                <i class="fa-solid fa-building-columns"></i>
                            </div>
                            <span class="font-bold text-gray-700">My Bank</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Document -->
                    <div onclick="navigateTo('documents')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-emerald-500 text-xl">
                                <i class="fa-solid fa-book"></i>
                            </div>
                            <span class="font-bold text-gray-700">Document</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- All Orders -->
                    <div onclick="navigateTo('orders')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-cyan-500 text-xl">
                                <i class="fa-solid fa-rectangle-list"></i>
                            </div>
                            <span class="font-bold text-gray-700">All Orders</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- My Grocery Orders -->
                    <div onclick="window.location.href='grocery_order_history.html'" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
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

                    <!-- Notifications -->
                    <div onclick="navigateTo('notifications')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-teal-400 text-xl">
                                <i class="fa-solid fa-bell"></i>
                            </div>
                            <span class="font-bold text-gray-700">Notifications</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Rating & Review -->
                    <div onclick="navigateTo('reviews')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-orange-500 text-xl">
                                <i class="fa-solid fa-star"></i>
                            </div>
                            <span class="font-bold text-gray-700">Rating & Review</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>

                    <!-- Order Statement -->
                    <div onclick="downloadOrderStatement()" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
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
                <h3 class="text-sm font-bold text-gray-400 mb-4 px-2">About</h3>
                <div class="space-y-2">
                    <div onclick="navigateTo('privacy')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-cyan-400 text-xl">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <span class="font-bold text-gray-700">Privacy & Policy</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div onclick="navigateTo('about')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-blue-600 text-xl">
                                <i class="fa-solid fa-circle-info"></i>
                            </div>
                            <span class="font-bold text-gray-700">About App</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div onclick="navigateTo('terms')" class="flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-100 flex items-center justify-center bg-white text-blue-500 text-xl">
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
                <h3 class="text-sm font-bold text-gray-400 mb-4 px-2">App Settings</h3>
                <div class="bg-white rounded-3xl overflow-hidden border border-gray-50 shadow-sm">
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
                            <div class="w-12 h-12 rounded-full shadow-sm border border-gray-50 flex items-center justify-center bg-white text-indigo-500 text-xl">
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
                <button onclick="navigateTo('login')" class="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95">
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
                        <input type="text" placeholder="Enter Bank Name" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all">
                        <input type="text" placeholder="Account Number" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all">
                        <input type="text" placeholder="IFSC Code" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all uppercase">
                        <button class="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-amber-100 active:scale-95 transition-all mt-2">Update Account</button>
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
                        <input type="text" placeholder="Enter new UPI ID (e.g. name@upi)" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all font-mono">
                        <button class="w-full py-4 bg-primary/10 text-primary rounded-2xl font-bold border-2 border-primary/20 active:scale-95 transition-all">Update UPI ID</button>
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
                        <input type="number" id="profile-otp-input" placeholder="Enter 6-digit OTP" class="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none">
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

function saveProfileChanges() {
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

    // Simulate Database Call
    setTimeout(() => {
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
    }, 1500);
}

function handleProfilePhoneInput(input) {
    const badge = document.getElementById('phone-verified-badge');
    const otpSection = document.getElementById('profile-otp-section');
    
    if (input.value !== state.vendorPhone) {
        state.profileMobileVerified = false;
        badge.classList.add('hidden');
        otpSection.classList.remove('hidden');
    } else {
        state.profileMobileVerified = true;
        badge.classList.remove('hidden');
        otpSection.classList.add('hidden');
    }
}

async function sendProfileOTP() {
    const phone = document.getElementById('edit-vendor-phone').value;
    if (!phone || phone.length !== 10) {
        showToast('Please enter a valid 10-digit mobile number');
        return;
    }
    showToast('Sending OTP via Rainfire...');
    try {
        await window.rainfireAuth.sendOTP(phone);
        showToast('OTP sent via Rainfire to +91 ' + phone);
    } catch (error) {
        showToast('Failed to send OTP: ' + error.message);
    }
}

async function verifyProfileOTP() {
    const phone = document.getElementById('edit-vendor-phone').value;
    const otp = document.getElementById('profile-otp-input').value;
    if (!otp || otp.length !== 6) {
        showToast('Please enter the 6-digit OTP');
        return;
    }
    showToast('Verifying Rainfire OTP...');
    try {
        const isVerified = await window.rainfireAuth.verifyOTP(phone, otp);
        if (isVerified) {
            state.profileMobileVerified = true;
            document.getElementById('profile-otp-section').classList.add('hidden');
            document.getElementById('phone-verified-badge').classList.remove('hidden');
            showToast('Mobile number verified via Rainfire!');
        } else {
            showToast('Invalid OTP entered. Please try again.');
        }
    } catch (error) {
        showToast('Verification error: ' + error.message);
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

function renderRestaurantSetupScreen() {
    const app = document.getElementById("app");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
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
                            <input type="text" id="setup-name" value="${state.vendorName}" class="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none">
                        </div>
                        
                        <div>
                            <label class="block text-[10px] font-black text-gray-400 uppercase mb-2">Main Cover Image</label>
                            <div onclick="triggerRestaurantImage('cover')" class="upload-box" id="cover-upload-box">
                                <i class="fa-solid fa-image text-gray-300 text-3xl mb-2"></i>
                                <span class="text-xs font-bold text-gray-400">Upload Cover Photo</span>
                            </div>
                            <img id="cover-preview" class="hidden w-full h-32 object-cover rounded-2xl mt-2 border border-gray-100">
                        </div>
                    </div>
                </div>

                <!-- Gallery Images -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Gallery Images (Max 4)</h3>
                    <div class="gallery-grid" id="gallery-container">
                        <div onclick="triggerRestaurantImage('gallery')" class="upload-box h-24">
                            <i class="fa-solid fa-plus text-gray-300"></i>
                        </div>
                    </div>
                </div>

                <!-- Operating Hours -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Operating Hours</h3>
                    <div class="space-y-3">
                        ${days.map(day => `
                            <div class="flex items-center gap-4 justify-between">
                                <span class="text-xs font-bold text-gray-600 w-20">${day}</span>
                                <div class="flex items-center gap-2 flex-1">
                                    <input type="time" id="open-${day}" value="10:00" class="flex-1 bg-gray-50 border-none rounded-xl p-2 text-xs outline-none">
                                    <span class="text-[10px] font-bold text-gray-400">TO</span>
                                    <input type="time" id="close-${day}" value="22:00" class="flex-1 bg-gray-50 border-none rounded-xl p-2 text-xs outline-none">
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Cuisine Type -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-800 uppercase mb-4">Cuisine Type</h3>
                    <div class="flex gap-3">
                        <button onclick="setSetupCuisine('Veg')" class="cuisine-chip setup-cuisine" data-type="Veg">Veg</button>
                        <button onclick="setSetupCuisine('Non-Veg')" class="cuisine-chip setup-cuisine" data-type="Non-Veg">Non-Veg</button>
                        <button onclick="setSetupCuisine('Both')" class="cuisine-chip setup-cuisine active" data-type="Both">Both</button>
                    </div>
                </div>

                <button onclick="handleRestaurantSetupSubmit()" class="w-full py-5 bg-primary text-white rounded-[32px] font-black text-sm shadow-xl shadow-amber-100 active:scale-95 transition-all mb-10">
                    SAVE & CONTINUE
                </button>
            </div>
        </div>
        <input type="file" id="restaurant-image-input" class="hidden" accept="image/*">
    `;
}

function renderRestaurantDashboardScreen() {
    const app = document.getElementById("app");
    const details = state.restaurantDetails;
    
    // Ensure we have at least 4 placeholders if gallery is empty
    const displayImages = details.galleryImages.length > 0 
        ? details.galleryImages.slice(0, 4) 
        : [
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400",
            "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400",
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400"
        ];

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
                            <p class="text-xs text-amber-100 font-bold tracking-widest uppercase opacity-80">Profile Management</p>
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

                <!-- Photo Management Layout -->
                <div class="bg-white rounded-[40px] p-6 shadow-xl shadow-gray-200/50 border border-gray-100/50 mb-6">
                    <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Photo Management</h3>
                    
                    <!-- Main Image -->
                    <div class="relative h-48 w-full rounded-3xl overflow-hidden mb-4 group">
                        <img src="${details.coverImage || displayImages[0]}" class="w-full h-full object-cover">
                        <button onclick="triggerRestaurantImage('cover')" class="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-md text-primary rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </div>

                    <!-- Gallery Grid (3 items) -->
                    <div class="grid grid-cols-3 gap-4">
                        ${[0, 1, 2].map(idx => {
                            const img = details.galleryImages[idx] || displayImages[idx+1];
                            const hasImage = !!details.galleryImages[idx];
                            return `
                                <div class="relative h-24 rounded-2xl overflow-hidden group border border-gray-100">
                                    <img src="${img}" class="w-full h-full object-cover">
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onclick="triggerRestaurantImage('gallery', ${idx})" class="w-7 h-7 bg-white text-primary rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all">
                                            <i class="fa-solid fa-pen text-[10px]"></i>
                                        </button>
                                        ${hasImage ? `
                                            <button onclick="deleteGalleryImage(${idx})" class="w-7 h-7 bg-white text-red-500 rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all">
                                                <i class="fa-solid fa-trash text-[10px]"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Cuisine Type (Prominent) -->
                <div class="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100/50 mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest">Cuisine Type</h3>
                        <button onclick="editCuisineType()" class="text-primary text-[10px] font-black uppercase bg-amber-50 px-4 py-2 rounded-xl">Edit</button>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="w-16 h-16 rounded-3xl bg-green-50 text-green-500 flex items-center justify-center">
                            <i class="fa-solid fa-utensils text-3xl"></i>
                        </div>
                        <div>
                            <p class="text-3xl font-black text-gray-800">${details.cuisineType}</p>
                            <p class="text-xs text-gray-400 font-bold uppercase mt-1 tracking-widest">Active Selection</p>
                        </div>
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
                                <p class="text-[10px] text-gray-400 font-bold uppercase">${details.hours['Sunday'].open} - ${details.hours['Sunday'].close}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="editTiming()" class="text-primary text-[10px] font-black uppercase bg-white border border-primary/20 px-4 py-2 rounded-xl shadow-sm">Edit</button>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
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
                                <div class="bg-white/50 p-3 rounded-2xl flex items-center justify-between border border-white/60">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-primary text-xs font-black">
                                            ${offer.code.substring(0, 1)}
                                        </div>
                                        <div>
                                            <p class="text-xs font-black text-gray-800">${offer.code}</p>
                                            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-tight">${offer.discount}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <div class="px-3 py-1 rounded-full text-[8px] font-black uppercase ${offer.status === 'Active' ? 'bg-green-50 text-green-500' : 'bg-gray-100 text-gray-400'}">
                                            ${offer.status}
                                        </div>
                                        <button class="text-gray-300 hover:text-amber-500 transition-colors">
                                            <i class="fa-solid fa-trash-can text-[10px]"></i>
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
    input.onchange = (e) => handleRestaurantImage(e.target, type, index);
    input.click();
}

function handleRestaurantImage(input, type, index) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;
            if (type === 'cover') {
                if (state.restaurantDetails) {
                    state.restaurantDetails.coverImage = dataUrl;
                    renderRestaurantDashboardScreen();
                } else {
                    state.selectedRestaurantImages.cover = dataUrl;
                    const preview = document.getElementById('cover-preview');
                    const uploadBox = document.getElementById('cover-upload-box');
                    if (preview && uploadBox) {
                        preview.src = dataUrl;
                        preview.classList.remove('hidden');
                        uploadBox.classList.add('hidden');
                    }
                }
            } else if (type === 'gallery') {
                if (state.restaurantDetails) {
                    if (index !== null) {
                        state.restaurantDetails.galleryImages[index] = dataUrl;
                    } else if (state.restaurantDetails.galleryImages.length < 4) {
                        state.restaurantDetails.galleryImages.push(dataUrl);
                    }
                    renderRestaurantDashboardScreen();
                } else {
                    if (index !== null) {
                        state.selectedRestaurantImages.gallery[index] = dataUrl;
                    } else if (state.selectedRestaurantImages.gallery.length < 4) {
                        state.selectedRestaurantImages.gallery.push(dataUrl);
                    }
                    renderGalleryPreviews();
                }
            }
            showToast('Image updated successfully!');
        };
        reader.readAsDataURL(input.files[0]);
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

function handleRestaurantSetupSubmit() {
    const name = document.getElementById('setup-name').value;
    const coverImage = state.selectedRestaurantImages.cover;
    const galleryImages = state.selectedRestaurantImages.gallery;
    
    if (!name || !coverImage) {
        showToast('Please provide name and cover image');
        return;
    }
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const hours = {};
    days.forEach(day => {
        hours[day] = {
            open: document.getElementById(`open-${day}`).value,
            close: document.getElementById(`close-${day}`).value
        };
    });
    
    state.restaurantDetails = {
        name,
        coverImage,
        galleryImages,
        hours,
        cuisineType: setupCuisineType,
        offers: [{ id: 1, title: 'FLAT 20% OFF', code: 'WELCOME20', discount: '20% OFF', status: 'Active' }]
    };
    
    showToast('Restaurant Setup Successful!');
    renderStatusScreen();
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
                        <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <span class="text-xs font-bold text-gray-600 w-24">${day}</span>
                            <div class="flex items-center gap-2">
                                <input type="time" id="edit-open-${day}" value="${state.restaurantDetails.hours[day].open.replace(' AM', '').replace(' PM', '')}" class="bg-gray-50 border-none rounded-xl p-2 text-xs outline-none">
                                <span class="text-[10px] font-bold text-gray-400">TO</span>
                                <input type="time" id="edit-close-${day}" value="${state.restaurantDetails.hours[day].close.replace(' AM', '').replace(' PM', '')}" class="bg-gray-50 border-none rounded-xl p-2 text-xs outline-none">
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

function saveTimingChanges() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    days.forEach(day => {
        state.restaurantDetails.hours[day] = {
            open: document.getElementById(`edit-open-${day}`).value,
            close: document.getElementById(`edit-close-${day}`).value
        };
    });
    closeTimingModal();
    renderRestaurantDashboardScreen();
    showToast('Operating hours updated!');
}

function editOffers() { renderAddOfferForm(); }

function renderAddOfferForm() {
    const app = document.getElementById("app");
    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24 fade-in">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Add Restaurant Offer</h2>
                </div>
            </div>

            <div class="px-6">
                <!-- Offer Type Selection -->
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div onclick="selectOfferType('restaurant')" id="type-restaurant" class="offer-type-card active">
                        <div class="offer-icon-wrapper">
                            <i class="fa-solid fa-tag"></i>
                        </div>
                        <h4 class="text-sm font-black text-gray-800 mb-1">Add The Restaurant Offer</h4>
                        <p class="text-[10px] text-gray-400 font-medium leading-tight">Add offers on restaurant (e.g. coupon, discount on bill)</p>
                        <div class="custom-radio"></div>
                    </div>
                    
                    <div onclick="selectOfferType('item')" id="type-item" class="offer-type-card">
                        <div class="offer-icon-wrapper">
                            <i class="fa-solid fa-utensils"></i>
                        </div>
                        <h4 class="text-sm font-black text-gray-800 mb-1">Add The Restaurant Item Offer</h4>
                        <p class="text-[10px] text-gray-400 font-medium leading-tight">Add offers on restaurant items (e.g. discount on specific items)</p>
                        <div class="custom-radio"></div>
                    </div>
                </div>

                <!-- Form Fields -->
                <div class="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-8 space-y-6">
                    <div class="form-group">
                        <label class="form-label">Coupon Title *</label>
                        <input type="text" id="offer-title" placeholder="Enter coupon title" class="form-input w-full">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Coupon Code *</label>
                        <input type="text" id="offer-code" placeholder="Enter coupon code" class="form-input w-full">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Minimum Amount *</label>
                            <input type="number" id="offer-min-amount" placeholder="Enter minimum amount" class="form-input w-full">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Discount Amount *</label>
                            <input type="number" id="offer-discount" placeholder="Enter discount amount" class="form-input w-full">
                        </div>
                    </div>

                    <div class="form-group pt-2">
                        <label class="form-label">Commission Type *</label>
                        <div class="form-radio-group">
                            <label class="form-radio-item">
                                <input type="radio" name="commission-type" value="Fix" checked class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Fix</span>
                            </label>
                            <label class="form-radio-item">
                                <input type="radio" name="commission-type" value="Percentage" class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Percentage</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group pt-2">
                        <label class="form-label">Coupon Type *</label>
                        <div class="form-radio-group">
                            <label class="form-radio-item">
                                <input type="radio" name="coupon-type" value="Public" checked class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Public</span>
                            </label>
                            <label class="form-radio-item">
                                <input type="radio" name="coupon-type" value="Private" class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Private</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Select Coupon Date *</label>
                        <div class="flex items-center gap-3">
                            <div class="flex-1 relative">
                                <p class="absolute -top-5 left-0 text-[10px] text-gray-400 font-bold">From Date</p>
                                <input type="date" id="offer-from-date" class="form-input w-full">
                            </div>
                            <span class="text-gray-300">-</span>
                            <div class="flex-1 relative">
                                <p class="absolute -top-5 left-0 text-[10px] text-gray-400 font-bold">To Date</p>
                                <input type="date" id="offer-to-date" class="form-input w-full">
                            </div>
                        </div>
                    </div>

                    <div class="form-group border-t border-gray-50 pt-6">
                        <div class="flex justify-between items-center">
                            <label class="form-label mb-0">Status *</label>
                            <div class="flex items-center gap-3">
                                <label class="toggle-switch toggle-red">
                                    <input type="checkbox" id="offer-status" checked>
                                    <span class="slider"></span>
                                </label>
                                <span class="text-sm font-bold text-gray-600" id="status-label">On</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Button -->
                <button onclick="saveRestaurantOffer()" class="save-btn mb-10">
                    <i class="fa-solid fa-floppy-disk"></i>
                    Save Restaurant Offer
                </button>
            </div>
        </div>
    `;

    // Add event listener for status toggle
    const statusToggle = document.getElementById('offer-status');
    const statusLabel = document.getElementById('status-label');
    if (statusToggle && statusLabel) {
        statusToggle.addEventListener('change', () => {
            statusLabel.innerText = statusToggle.checked ? 'On' : 'Off';
        });
    }
}

function selectOfferType(type) {
    if (type === 'item') {
        renderAddItemOfferForm();
    } else {
        renderAddOfferForm();
    }
}

function saveRestaurantOffer() {
    const title = document.getElementById('offer-title').value;
    const code = document.getElementById('offer-code').value;
    const discount = document.getElementById('offer-discount').value;
    const status = document.getElementById('offer-status').checked ? 'Active' : 'Inactive';
    const commissionType = document.querySelector('input[name="commission-type"]:checked').value;
    
    if (!title || !code || !discount) {
        showToast('Please fill all required fields');
        return;
    }

    const newOffer = {
        id: Date.now(),
        title: title,
        code: code.toUpperCase(),
        discount: commissionType === 'Percentage' ? `${discount}% OFF` : `₹ ${discount} OFF`,
        status: status
    };

    if (!state.restaurantDetails.offers) state.restaurantDetails.offers = [];
    state.restaurantDetails.offers.unshift(newOffer);

    showToast('Restaurant Offer Saved Successfully!');
    renderRestaurantDashboardScreen();
}

// --- Restaurant Item Offer Logic ---

let selectedOfferItems = [];

function renderAddItemOfferForm() {
    const app = document.getElementById("app");
    selectedOfferItems = []; // Reset selections

    app.innerHTML = `
        <div class="bg-bgGray min-h-screen pb-24 fade-in">
            <!-- Header -->
            <div class="order-details-header text-white mb-6">
                <div class="flex items-center gap-4">
                    <button onclick="goBack()" class="text-xl">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 class="text-xl font-bold">Add Item Offer</h2>
                </div>
            </div>

            <div class="px-6">
                <!-- Offer Type Selection -->
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div onclick="selectOfferType('restaurant')" id="type-restaurant" class="offer-type-card">
                        <div class="offer-icon-wrapper">
                            <i class="fa-solid fa-tag"></i>
                        </div>
                        <h4 class="text-sm font-black text-gray-800 mb-1">Add The Restaurant Offer</h4>
                        <p class="text-[10px] text-gray-400 font-medium leading-tight">Add offers on restaurant (e.g. coupon, discount on bill)</p>
                        <div class="custom-radio"></div>
                    </div>
                    
                    <div onclick="selectOfferType('item')" id="type-item" class="offer-type-card active">
                        <div class="offer-icon-wrapper">
                            <i class="fa-solid fa-utensils"></i>
                        </div>
                        <h4 class="text-sm font-black text-gray-800 mb-1">Add The Restaurant Item Offer</h4>
                        <p class="text-[10px] text-gray-400 font-medium leading-tight">Add offers on restaurant items (e.g. discount on specific items)</p>
                        <div class="custom-radio"></div>
                    </div>
                </div>

                <!-- Form Fields -->
                <div class="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-8 space-y-6">
                    <div class="form-group mandatory">
                        <label class="form-label">Offer Title *</label>
                        <div class="relative">
                            <i class="fa-solid fa-tag absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input type="text" id="item-offer-title" placeholder="Enter offer title" class="form-input w-full pl-11">
                        </div>
                    </div>

                    <div class="form-group mandatory">
                        <label class="form-label">Coupon Code *</label>
                        <input type="text" id="item-offer-code" placeholder="Enter coupon code" class="form-input w-full">
                    </div>

                    <div class="form-group mandatory">
                        <label class="form-label">Select Item *</label>
                        <div class="searchable-dropdown" id="item-dropdown">
                            <div class="dropdown-header" onclick="toggleDropdown()">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid fa-utensils text-gray-400"></i>
                                    <span id="selected-items-text" class="placeholder-text">Select items</span>
                                </div>
                                <i class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform" id="dropdown-arrow"></i>
                            </div>
                            
                            <div class="dropdown-list-container" id="dropdown-list">
                                <div class="dropdown-search-wrapper">
                                    <i class="fa-solid fa-magnifying-glass search-icon-inside"></i>
                                    <input type="text" placeholder="Search items..." class="dropdown-search-input" oninput="filterDropdownItems(this.value)">
                                </div>
                                <div class="dropdown-items-list" id="items-list-container">
                                    ${renderDropdownItemsList()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group mandatory">
                        <label class="form-label">Minimum Requirement *</label>
                        <div class="form-radio-group mb-4">
                            <label class="form-radio-item" onclick="updateMinimumRequirement('amount')">
                                <input type="radio" name="min-requirement" value="Minimum Amount" checked class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Minimum Amount</span>
                            </label>
                            <label class="form-radio-item" onclick="updateMinimumRequirement('item')">
                                <input type="radio" name="min-requirement" value="Minimum Item" class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Minimum Items</span>
                            </label>
                        </div>
                        <div id="min-requirement-input-container">
                            <input type="number" id="min-requirement-value" placeholder="Enter minimum amount" class="form-input w-full">
                        </div>
                    </div>

                    <div class="form-group mandatory">
                        <label class="form-label">Discount Amount *</label>
                        <input type="number" id="item-offer-discount" placeholder="Enter discount amount" class="form-input w-full">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Free Item (Optional)</label>
                        <select id="free-item-select" class="form-input w-full appearance-none bg-no-repeat bg-[right_1rem_center]" style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-size: .65em auto;">
                            <option value="">Select free item (optional)</option>
                            <option value="Cold Drinks">500ml Cold Drinks</option>
                            <option value="Extra Salad">Extra Salad</option>
                            <option value="Dessert">Mini Dessert</option>
                        </select>
                    </div>

                    <div class="form-group mandatory pt-2">
                        <label class="form-label">Commission Type *</label>
                        <div class="form-radio-group">
                            <label class="form-radio-item">
                                <input type="radio" name="item-commission-type" value="Fix" checked class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Fix</span>
                            </label>
                            <label class="form-radio-item">
                                <input type="radio" name="item-commission-type" value="Percentage" class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Percentage</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group mandatory pt-2">
                        <label class="form-label">Coupon Type *</label>
                        <div class="form-radio-group">
                            <label class="form-radio-item">
                                <input type="radio" name="item-coupon-type" value="Public" checked class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Public</span>
                            </label>
                            <label class="form-radio-item">
                                <input type="radio" name="item-coupon-type" value="Private" class="hidden">
                                <div class="form-radio-circle"></div>
                                <span class="text-sm font-medium text-gray-600">Private</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group mandatory">
                        <label class="form-label">Select Coupon Date *</label>
                        <div class="flex items-center gap-3">
                            <div class="flex-1 relative">
                                <p class="absolute -top-5 left-0 text-[10px] text-gray-400 font-bold">From Date</p>
                                <input type="date" id="item-offer-from-date" class="form-input w-full">
                            </div>
                            <span class="text-gray-300">-</span>
                            <div class="flex-1 relative">
                                <p class="absolute -top-5 left-0 text-[10px] text-gray-400 font-bold">To Date</p>
                                <input type="date" id="item-offer-to-date" class="form-input w-full">
                            </div>
                        </div>
                    </div>

                    <div class="form-group border-t border-gray-50 pt-6 mandatory">
                        <div class="flex justify-between items-center">
                            <label class="form-label mb-0">Status *</label>
                            <div class="flex items-center gap-3">
                                <label class="toggle-switch toggle-red">
                                    <input type="checkbox" id="item-offer-status" checked>
                                    <span class="slider"></span>
                                </label>
                                <span class="text-sm font-bold text-gray-600" id="item-status-label">On</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Button -->
                <button onclick="saveRestaurantItemOffer()" class="save-btn mb-10">
                    <i class="fa-solid fa-floppy-disk"></i>
                    Save Restaurant Item Offer
                </button>
            </div>
        </div>
    `;

    // Add event listener for status toggle
    const statusToggle = document.getElementById('item-offer-status');
    const statusLabel = document.getElementById('item-status-label');
    if (statusToggle && statusLabel) {
        statusToggle.addEventListener('change', () => {
            statusLabel.innerText = statusToggle.checked ? 'On' : 'Off';
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('item-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            document.getElementById('dropdown-list').classList.remove('show');
            document.getElementById('dropdown-arrow').style.transform = 'rotate(0deg)';
        }
    });
}

function renderDropdownItemsList(filter = '') {
    const items = state.menuItems.filter(item => 
        item.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (items.length === 0) {
        return `<div class="p-4 text-center text-xs text-gray-400">No items found</div>`;
    }

    return items.map(item => `
        <div class="dropdown-item-row ${selectedOfferItems.includes(item.id) ? 'selected' : ''}" onclick="toggleItemSelection(${item.id})">
            <div class="item-checkbox"></div>
            <span class="item-name-label">${item.name}</span>
            <span class="item-price-label">৳ ${item.price}</span>
        </div>
    `).join('');
}

function toggleDropdown() {
    const list = document.getElementById('dropdown-list');
    const arrow = document.getElementById('dropdown-arrow');
    list.classList.toggle('show');
    arrow.style.transform = list.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
}

function filterDropdownItems(val) {
    const container = document.getElementById('items-list-container');
    container.innerHTML = renderDropdownItemsList(val);
}

function toggleItemSelection(id) {
    const index = selectedOfferItems.indexOf(id);
    if (index > -1) {
        selectedOfferItems.splice(index, 1);
    } else {
        selectedOfferItems.push(id);
    }

    // Update UI
    const container = document.getElementById('items-list-container');
    const searchVal = document.querySelector('.dropdown-search-input').value;
    container.innerHTML = renderDropdownItemsList(searchVal);

    // Update Header Text
    const headerText = document.getElementById('selected-items-text');
    if (selectedOfferItems.length > 0) {
        headerText.innerText = `${selectedOfferItems.length} items selected`;
        headerText.classList.remove('placeholder-text');
    } else {
        headerText.innerText = 'Select items';
        headerText.classList.add('placeholder-text');
    }
}

function updateMinimumRequirement(type) {
    const container = document.getElementById('min-requirement-input-container');
    if (type === 'amount') {
        container.innerHTML = `<input type="number" id="min-requirement-value" placeholder="Enter minimum amount" class="form-input w-full">`;
    } else {
        container.innerHTML = `<input type="number" id="min-requirement-value" placeholder="Enter minimum items" class="form-input w-full">`;
    }
}

function saveRestaurantItemOffer() {
    const title = document.getElementById('item-offer-title').value;
    const code = document.getElementById('item-offer-code').value;
    const discount = document.getElementById('item-offer-discount').value;
    const minReqValue = document.getElementById('min-requirement-value').value;
    const minReqType = document.querySelector('input[name="min-requirement"]:checked').value;
    const status = document.getElementById('item-offer-status').checked ? 'Active' : 'Inactive';
    const commissionType = document.querySelector('input[name="item-commission-type"]:checked').value;

    if (!title || !code || !discount || selectedOfferItems.length === 0 || !minReqValue) {
        showToast('Please fill all required fields');
        return;
    }

    const newOffer = {
        id: Date.now(),
        title: title,
        code: code.toUpperCase(),
        discount: commissionType === 'Percentage' ? `${discount}% OFF` : `₹ ${discount} OFF`,
        status: status,
        type: 'Item'
    };

    if (!state.restaurantDetails.offers) state.restaurantDetails.offers = [];
    state.restaurantDetails.offers.unshift(newOffer);

    showToast('Restaurant Item Offer Saved Successfully!');
    renderRestaurantDashboardScreen();
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

function handleSaveCategory() {
    const nameInput = document.getElementById('cat-name-input');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        showToast('Please enter a category name');
        return;
    }

    if (state.categories.includes(name)) {
        showToast('Category already exists');
        return;
    }

    state.categories.push(name);
    showToast(`Category "${name}" added successfully!`);
    
    closeCategoryModal();
    
    // Refresh the current view if it depends on categories
    if (state.currentView === 'menu') {
        renderMenuScreen();
    } else if (state.currentView === 'add-menu-item') {
        renderAddMenuItemScreen();
    }
}


