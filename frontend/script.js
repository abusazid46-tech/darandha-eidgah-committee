
// frontend/script.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let currentLanguage = 'as';
let currentAreaFilter = 'all';
let currentSearchTerm = '';
let currentViewMode = 'dignitaries'; // Default to 'dignitaries' to show leaders first
let allMembers = [];
let uniqueAreas = [];
let allMembersFiltered = [];

// Configuration for homepage member display
const MAX_MEMBERS_ON_HOMEPAGE = 12;
// Dignitary roles - will be loaded from database
let dignitaryRoles = ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Cashier', 'Adviser'];

// Function to load dignitary roles from database
async function loadDignitaryRolesFromDB() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        
        if (settings.dignitary_roles && settings.dignitary_roles.value) {
            const loadedRoles = JSON.parse(settings.dignitary_roles.value);
            dignitaryRoles.length = 0;
            loadedRoles.forEach(role => dignitaryRoles.push(role));
            console.log('✅ Dignitary roles loaded from DB:', dignitaryRoles);
            return true;
        } else {
            console.log('⚠️ No dignitary roles in DB, using defaults');
            return false;
        }
    } catch (error) {
        console.error('❌ Error loading dignitary roles:', error);
        return false;
    }
}

// Helper function for case-insensitive role matching
function isDignitary(role) {
    if (!role) return false;
    const roleLower = role.toLowerCase();
    return dignitaryRoles.some(r => r.toLowerCase() === roleLower);
}


// Helper function to extract area from full address
function extractAreaFromAddress(address) {
    if (!address) return '';
    const firstCommaIndex = address.indexOf(',');
    if (firstCommaIndex === -1) return address;
    return address.substring(firstCommaIndex + 1).trim();
}

// Helper function to parse address into house number and area
function parseAddress(address) {
    if (!address) return { houseNumber: '', area: '' };
    const firstCommaIndex = address.indexOf(',');
    if (firstCommaIndex === -1) {
        return { houseNumber: '', area: address };
    }
    const houseNumber = address.substring(0, firstCommaIndex).trim();
    const area = address.substring(firstCommaIndex + 1).trim();
    return { houseNumber, area };
}

// Translation helper
function updateLanguage() {
    document.querySelectorAll('[data-en]').forEach(el => {
        if (currentLanguage === 'en') {
            el.innerText = el.getAttribute('data-en');
        } else {
            el.innerText = el.getAttribute('data-as');
        }
    });
    
    document.querySelectorAll('[data-en-placeholder]').forEach(el => {
        if (currentLanguage === 'en') {
            el.placeholder = el.getAttribute('data-en-placeholder');
        } else {
            el.placeholder = el.getAttribute('data-as-placeholder');
        }
    });
    
    const languageToggle = document.getElementById('languageToggle');
    if (languageToggle) {
        languageToggle.innerHTML = currentLanguage === 'en' ? 
            '<i class="fas fa-language me-1"></i> অসমীয়া' : 
            '<i class="fas fa-language me-1"></i> English';
    }
}

// Load settings and about content
async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        
        const aboutText = document.getElementById('aboutText');
        if (aboutText) {
            aboutText.innerHTML = currentLanguage === 'en' ? 
                settings.about_content?.value || 'Darandha Eidgah Committee is dedicated to serving the Muslim community by maintaining the graveyard with dignity and respect.' : 
                settings.about_content_as?.value || 'দৰংদহ ঈদগাহ কমিটিয়ে মুছলমান সমাজক মৰ্যাদা আৰু সন্মানেৰে কবৰস্থান পৰিচালনা কৰি সেৱা আগবঢ়োৱাত নিয়োজিত।';
        }
        
        const contactPhone = document.getElementById('contactPhone');
        const contactEmail = document.getElementById('contactEmail');
        const whatsappNumber = document.getElementById('whatsappNumber');
        const whatsappLink = document.getElementById('whatsappLink');
        
        if (contactPhone) contactPhone.innerText = settings.contact_phone?.value || '+91 98765 43210';
        if (contactEmail) contactEmail.innerText = settings.contact_email?.value || 'info@darandhaeidgah.org';
        
        const whatsappNum = settings.whatsapp_number?.value || '+919876543210';
        if (whatsappNumber) whatsappNumber.innerText = whatsappNum;
        if (whatsappLink) whatsappLink.href = `https://wa.me/${whatsappNum.replace(/\+/g, '')}`;
        
        // UPI Settings
        const upiId = settings.upi_id?.value || 'committee@bank';
        const upiIdDisplay = document.getElementById('upiIdDisplay');
        const upiInstructionId = document.getElementById('upiInstructionId');
        const qrCodeImage = document.getElementById('qrCodeImage');
        
        if (upiIdDisplay) upiIdDisplay.innerText = upiId;
        if (upiInstructionId) upiInstructionId.innerText = upiId;
        
        if (qrCodeImage && upiId) {
            const encodedUpi = encodeURIComponent(upiId);
            const encodedName = encodeURIComponent('Darandha Eidgah Committee');
            qrCodeImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodedUpi}&pn=${encodedName}&cu=INR`;
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Load members
async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        allMembers = await res.json();
        
        // Load dignitary roles from database - USE THE CORRECT FUNCTION NAME
        await loadDignitaryRolesFromDB();
        
        // Extract unique areas from member addresses
        const areasSet = new Set();
        allMembers.forEach(member => {
            if (member.address && member.address.trim()) {
                const area = extractAreaFromAddress(member.address);
                if (area.length > 0 && area.length < 100) {
                    areasSet.add(area);
                }
            }
        });
        uniqueAreas = Array.from(areasSet).sort();
        
        populateAreaDropdown();
        applyFilters();
    } catch (error) {
        console.error('Error loading members:', error);
        const container = document.getElementById('membersListContainer');
        if (container) {
            container.innerHTML = '<div class="alert alert-danger text-center">Error loading members. Please try again later.</div>';
        }
    }
}

// Populate area dropdown
function populateAreaDropdown() {
    const select = document.getElementById('areaFilterSelect');
    if (!select) return;
    
    const allCount = allMembers.length;
    let options = `<option value="all">🌍 ${currentLanguage === 'en' ? 'All Areas' : 'সকলো এলাকা'} (${allCount})</option>`;
    
    uniqueAreas.forEach(area => {
        const count = allMembers.filter(m => {
            if (!m.address) return false;
            const memberArea = extractAreaFromAddress(m.address);
            return memberArea === area;
        }).length;
        const displayArea = area.length > 35 ? area.substring(0, 32) + '...' : area;
        options += `<option value="${escapeHtml(area)}">📍 ${escapeHtml(displayArea)} (${count})</option>`;
    });
    
    select.innerHTML = options;
    select.value = currentAreaFilter;
}

// Apply all filters
function applyFilters() {
    let filteredMembers = [...allMembers];
    
    // Apply area filter
    if (currentAreaFilter !== 'all') {
        filteredMembers = filteredMembers.filter(member => {
            if (!member.address) return false;
            const memberArea = extractAreaFromAddress(member.address);
            return memberArea === currentAreaFilter;
        });
    }
    
    // Apply search filter
    if (currentSearchTerm) {
        filteredMembers = filteredMembers.filter(member => 
            member.name.toLowerCase().includes(currentSearchTerm) ||
            (member.nameAs && member.nameAs.toLowerCase().includes(currentSearchTerm)) ||
            (member.phone && member.phone.includes(currentSearchTerm))
        );
    }
    
    // Store original filtered count
    allMembersFiltered = [...filteredMembers];
    let displayMembers = [...filteredMembers];
    let isLimited = false;
    let totalAvailable = displayMembers.length;
    
    // Apply view mode filter - USING CASE-INSENSITIVE MATCHING
    if (currentViewMode === 'dignitaries') {
        displayMembers = displayMembers.filter(member => isDignitary(member.role));
    }
    
    // Apply limits only for homepage initial view
    if (currentViewMode === 'dignitaries' && currentSearchTerm === '' && currentAreaFilter === 'all') {
        if (displayMembers.length > 6) {
            displayMembers = displayMembers.slice(0, 6);
            isLimited = true;
            totalAvailable = allMembersFiltered.filter(m => isDignitary(m.role)).length;
        }
    } else if (currentViewMode === 'all' && currentSearchTerm === '' && currentAreaFilter === 'all') {
        if (displayMembers.length > MAX_MEMBERS_ON_HOMEPAGE) {
            displayMembers = displayMembers.slice(0, MAX_MEMBERS_ON_HOMEPAGE);
            isLimited = true;
            totalAvailable = allMembersFiltered.length;
        }
    }
    
    displayMembersList(displayMembers);
    updateResultCount(displayMembers.length, isLimited, totalAvailable);
}

// Display members list
function displayMembersList(members) {
    const container = document.getElementById('membersListContainer');
    if (!container) return;
    
    if (!members || members.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-user-slash fa-4x text-muted mb-3"></i>
                <h5 class="text-muted">${currentLanguage === 'en' ? 'No members found' : 'কোনো সদস্য পোৱা নগল'}</h5>
                <p class="text-muted small">${currentLanguage === 'en' ? 'Try adjusting your search or filter criteria' : 'আপোনাৰ সন্ধান বা ফিল্টাৰ সামঞ্জস্য কৰক'}</p>
            </div>
        `;
        return;
    }
    
    // CASE-INSENSITIVE role matching for dignitaries
    const dignitaries = members.filter(m => isDignitary(m.role));
    const regularMembers = members.filter(m => !isDignitary(m.role));
    
    let html = '';
    
    if (currentViewMode === 'dignitaries') {
        // List view for leaders
        html = `
            <div class="members-decorated-list">
                ${members.map(member => createMemberListItem(member)).join('')}
            </div>
        `;
    } else {
        // Grid view for all members
        if (dignitaries.length > 0) {
            html += `
                <div class="mb-4">
                    <h4 class="border-bottom border-success pb-2 mb-3">
                        <i class="fas fa-crown text-warning me-2"></i>
                        ${currentLanguage === 'en' ? 'Committee Leaders' : 'সমিতিৰ নেতৃবৃন্দ'}
                        <span class="badge bg-success ms-2">${dignitaries.length}</span>
                    </h4>
                    <div class="row">
                        ${dignitaries.map(member => createMemberCard(member)).join('')}
                    </div>
                </div>
            `;
        }
        
        if (regularMembers.length > 0) {
            html += `
                <div>
                    <h4 class="border-bottom border-success pb-2 mb-3">
                        <i class="fas fa-users text-success me-2"></i>
                        ${currentLanguage === 'en' ? 'Community Members' : 'সম্প্ৰদায়ৰ সদস্য'}
                        <span class="badge bg-success ms-2">${regularMembers.length}</span>
                    </h4>
                    <div class="row">
                        ${regularMembers.map(member => createMemberCard(member)).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    container.innerHTML = html;
}

// Create member card
function createMemberCard(member) {
    const isDignitaryRole = isDignitary(member.role);
    const roleClass = isDignitaryRole ? 'border-warning' : 'border-success';
    const roleIcon = isDignitaryRole ? 'fa-crown text-warning' : 'fa-user-circle text-success';
    
    const { houseNumber, area } = parseAddress(member.address || '');
    
    return `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="member-card border-start border-3 ${roleClass} shadow-sm p-3">
                <div class="d-flex align-items-start">
                    <div class="flex-shrink-0">
                        <i class="fas ${roleIcon} fa-3x me-3"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h5 class="mb-1">${escapeHtml(member.name)}</h5>
                        ${member.nameAs ? `<p class="text-muted small mb-1">${escapeHtml(member.nameAs)}</p>` : ''}
                        <span class="badge ${isDignitaryRole ? 'bg-warning text-dark' : 'bg-success'} mb-2">
                            <i class="fas ${isDignitaryRole ? 'fa-crown' : 'fa-user'} me-1"></i> ${member.role || 'Member'}
                        </span>
                        ${member.phone ? `<p class="mb-1 small"><i class="fas fa-phone me-1 text-success"></i> ${member.phone}</p>` : ''}
                        ${houseNumber ? `<p class="mb-0 small"><i class="fas fa-home me-1 text-primary"></i> ${escapeHtml(houseNumber)}</p>` : ''}
                        ${area ? `<p class="mb-0 small"><i class="fas fa-map-marker-alt me-1 text-danger"></i> ${escapeHtml(area)}</p>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create member list item for leaders view
function createMemberListItem(member) {
    const isDignitaryRole = isDignitary(member.role);
    const roleIcon = isDignitaryRole ? 'fa-crown text-warning' : 'fa-user-circle text-success';
    
    const { houseNumber, area } = parseAddress(member.address || '');
    
    return `
        <div class="member-list-item p-3 mb-2 bg-white rounded-3 shadow-sm border-start border-3 ${isDignitaryRole ? 'border-warning' : 'border-success'}">
            <div class="d-flex align-items-center flex-wrap flex-md-nowrap">
                <div class="member-avatar me-3">
                    <i class="fas ${roleIcon} fa-2x"></i>
                </div>
                <div class="member-info flex-grow-1">
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <h5 class="mb-0">${escapeHtml(member.name)}</h5>
                        ${member.nameAs ? `<small class="text-muted">(${escapeHtml(member.nameAs)})</small>` : ''}
                        <span class="badge ${isDignitaryRole ? 'bg-warning text-dark' : 'bg-success'}">
                            ${member.role || 'Member'}
                        </span>
                    </div>
                    <div class="member-details mt-2">
                        ${member.phone ? `<span class="me-3"><i class="fas fa-phone text-success me-1"></i> ${member.phone}</span>` : ''}
                        ${houseNumber ? `<span class="me-3"><i class="fas fa-home text-primary me-1"></i> ${escapeHtml(houseNumber)}</span>` : ''}
                        ${area ? `<span><i class="fas fa-map-marker-alt text-danger me-1"></i> ${escapeHtml(area)}</span>` : ''}
                    </div>
                </div>
                <div class="member-badge ms-2">
                    ${isDignitaryRole ? '<i class="fas fa-crown fa-lg text-warning" title="Committee Leader"></i>' : ''}
                </div>
            </div>
        </div>
    `;
}

// Update result count
function updateResultCount(displayCount, isLimited, totalCount) {
    const resultCountEl = document.getElementById('resultCount');
    if (!resultCountEl) return;
    
    if (currentLanguage === 'en') {
        if (isLimited && totalCount > displayCount) {
            resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> Showing ${displayCount} of ${totalCount} leaders. 
                <a href="javascript:void(0)" onclick="loadAllMembers()" class="text-success fw-bold">View All →</a>`;
        } else {
            resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> Showing ${displayCount} ${currentViewMode === 'dignitaries' ? 'leaders' : 'members'}`;
        }
    } else {
        if (isLimited && totalCount > displayCount) {
            resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> ${displayCount} জন দেখুওৱা হৈছে (মুঠ ${totalCount} জন)। 
                <a href="javascript:void(0)" onclick="loadAllMembers()" class="text-success fw-bold">সকলো চাওক →</a>`;
        } else {
            resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> ${displayCount} জন সদস্য দেখুওৱা হৈছে`;
        }
    }
}

// Load all members
window.loadAllMembers = function() {
    let displayMembers;
    if (currentViewMode === 'dignitaries') {
        displayMembers = allMembersFiltered.filter(m => isDignitary(m.role));
    } else {
        displayMembers = [...allMembersFiltered];
    }
    displayMembersList(displayMembers);
    updateResultCount(displayMembers.length, false, displayMembers.length);
    hideViewAllButton();
};

function hideViewAllButton() {
    const viewAllContainer = document.getElementById('viewAllContainer');
    if (viewAllContainer) {
        viewAllContainer.innerHTML = '';
    }
}

// Filter by area
function filterByArea() {
    const select = document.getElementById('areaFilterSelect');
    if (select) {
        currentAreaFilter = select.value;
        applyFilters();
    }
}

// Clear search
window.clearSearch = function() {
    const searchInput = document.getElementById('memberSearch');
    if (searchInput) {
        searchInput.value = '';
        currentSearchTerm = '';
        applyFilters();
    }
};

// Toggle view mode
window.toggleView = function(viewMode) {
    currentViewMode = viewMode;
    
    const dignitariesBtn = document.getElementById('viewDignitariesBtn');
    const allBtn = document.getElementById('viewAllBtn');
    
    if (dignitariesBtn && allBtn) {
        if (viewMode === 'dignitaries') {
            dignitariesBtn.classList.add('active');
            allBtn.classList.remove('active');
        } else {
            dignitariesBtn.classList.remove('active');
            allBtn.classList.add('active');
        }
    }
    
    applyFilters();
};

// Load events
async function loadEvents() {
    try {
        const res = await fetch(`${API_URL}/events/upcoming`);
        const events = await res.json();
        const container = document.getElementById('eventsContainer');
        
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No upcoming events at this time.</p></div>';
            return;
        }
        
        const displayEvents = events.slice(0, 3);
        
        container.innerHTML = displayEvents.map(event => {
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString(currentLanguage === 'en' ? 'en-US' : 'as-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const title = currentLanguage === 'en' ? event.title : (event.titleAs || event.title);
            const description = currentLanguage === 'en' ? (event.description || '') : (event.descriptionAs || event.description || '');
            const location = currentLanguage === 'en' ? (event.location || '') : (event.locationAs || event.location || '');
            const time = event.time || 'Time TBA';
            
            return `
                <div class="col-md-4 mb-4">
                    <div class="event-card">
                        <div style="position: relative;">
                            ${event.image ? 
                                `<img src="${API_URL.replace('/api', '')}${event.image}" class="event-image" alt="${event.title}">` : 
                                `<div class="event-image bg-light d-flex align-items-center justify-content-center">
                                    <i class="fas fa-calendar-alt fa-4x text-muted"></i>
                                </div>`
                            }
                            <span class="event-badge badge-upcoming">
                                ${currentLanguage === 'en' ? 'Upcoming' : 'আগন্তুক'}
                            </span>
                        </div>
                        <div class="p-4">
                            <h4 class="mb-2">${escapeHtml(title)}</h4>
                            <div class="event-time mb-2">
                                <i class="far fa-calendar-alt me-2"></i>${formattedDate}
                            </div>
                            ${event.time ? `<div class="mb-2"><i class="far fa-clock me-2"></i>${time}</div>` : ''}
                            ${location ? `<div class="mb-3"><i class="fas fa-location-dot me-2"></i>${escapeHtml(location)}</div>` : ''}
                            <p class="text-muted">${escapeHtml(description.substring(0, 100))}${description.length > 100 ? '...' : ''}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        const container = document.getElementById('eventsContainer');
        if (container) {
            container.innerHTML = '<div class="col-12 text-center"><p class="text-danger">Error loading events. Please try again later.</p></div>';
        }
    }
}

// Load donation progress
async function loadDonationProgress() {
    try {
        const response = await fetch(`${API_URL}/stats/public`);
        
        if (response.ok) {
            const data = await response.json();
            const totalDonated = data.totalDonations || 0;
            const goal = 500000;
            const percentage = Math.min((totalDonated / goal) * 100, 100);
            
            const progressBar = document.getElementById('donationProgress');
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
                if (totalDonated > 0) {
                    progressBar.innerText = `₹${totalDonated.toLocaleString()} raised of ₹${goal.toLocaleString()}`;
                } else {
                    progressBar.innerText = '0%';
                }
            }
            localStorage.setItem('cachedDonationTotal', totalDonated);
        } else {
            const cachedTotal = localStorage.getItem('cachedDonationTotal');
            updateProgressBarFallback(cachedTotal ? parseInt(cachedTotal) : 0);
        }
    } catch (error) {
        console.error('Error loading donation progress:', error);
        const cachedTotal = localStorage.getItem('cachedDonationTotal');
        updateProgressBarFallback(cachedTotal ? parseInt(cachedTotal) : 0);
    }
}

function updateProgressBarFallback(total) {
    const goal = 500000;
    const percentage = Math.min((total / goal) * 100, 100);
    const progressBar = document.getElementById('donationProgress');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        if (total > 0) {
            progressBar.innerText = `₹${total.toLocaleString()} raised of ₹${goal.toLocaleString()}`;
        } else {
            progressBar.innerText = '0%';
        }
    }
}

// Submit donation
const donationForm = document.getElementById('donationForm');
if (donationForm) {
    donationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const donorName = document.getElementById('donorName');
        const donorAmount = document.getElementById('donorAmount');
        const transactionId = document.getElementById('transactionId');
        
        if (!donorName || !donorAmount) return;
        
        const donation = {
            name: donorName.value,
            amount: parseInt(donorAmount.value),
            transactionId: transactionId?.value || '',
            status: 'pending'
        };
        
        if (!donation.name || !donation.amount || donation.amount <= 0) {
            alert('Please enter valid name and amount');
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/donations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(donation)
            });
            
            if (res.ok) {
                alert('Thank you for your donation! Your donation will be visible after admin approval. May Allah reward you abundantly.');
                const modal = bootstrap.Modal.getInstance(document.getElementById('donationModal'));
                if (modal) modal.hide();
                donationForm.reset();
                loadDonationProgress();
            } else {
                const error = await res.json();
                alert('Error: ' + (error.error || 'Failed to submit donation.'));
            }
        } catch (error) {
            console.error('Donation error:', error);
            alert('Network error. Please check your connection.');
        }
    });
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== PWA INSTALLATION ==========
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) {
        installBtn.style.display = 'inline-flex';
        installBtn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the install prompt');
                    }
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                });
            }
        });
    }
});

window.addEventListener('appinstalled', () => {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'none';
    deferredPrompt = null;
    console.log('PWA was installed');
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateLanguage();
    loadSettings();
    loadMembers();
    loadEvents();
    loadDonationProgress();
    
    // Set initial button states (Leaders active by default)
    const dignitariesBtn = document.getElementById('viewDignitariesBtn');
    const allBtn = document.getElementById('viewAllBtn');
    
    if (dignitariesBtn && allBtn) {
        if (currentViewMode === 'dignitaries') {
            dignitariesBtn.classList.add('active');
            allBtn.classList.remove('active');
        } else {
            dignitariesBtn.classList.remove('active');
            allBtn.classList.add('active');
        }
    }
    
    // Search input
    const memberSearch = document.getElementById('memberSearch');
    if (memberSearch) {
        memberSearch.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase();
            applyFilters();
        });
    }
    
    // Area filter
    const areaFilterSelect = document.getElementById('areaFilterSelect');
    if (areaFilterSelect) {
        areaFilterSelect.addEventListener('change', filterByArea);
    }
    
    // Language toggle
    const languageToggle = document.getElementById('languageToggle');
    if (languageToggle) {
        languageToggle.addEventListener('click', () => {
            currentLanguage = currentLanguage === 'en' ? 'as' : 'en';
            updateLanguage();
            loadSettings();
            loadEvents();
            populateAreaDropdown();
            applyFilters();
        });
    }
});

// Styles
const style = document.createElement('style');
style.textContent = `
    .member-card {
        transition: all 0.3s ease;
        background: white;
        border-radius: 12px;
        cursor: pointer;
    }
    .member-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.1) !important;
    }
    .btn-group .btn-outline-success.active {
        background-color: #1a5f3e;
        color: white;
        border-color: #1a5f3e;
    }
    .btn-outline-success {
        color: #1a5f3e;
        border-color: #1a5f3e;
    }
    .btn-outline-success:hover {
        background-color: #1a5f3e;
        color: white;
    }
    .form-select.border-success:focus {
        border-color: #1a5f3e;
        box-shadow: 0 0 0 0.2rem rgba(26, 95, 62, 0.25);
    }
    .members-decorated-list {
        max-height: 600px;
        overflow-y: auto;
        padding-right: 5px;
    }
    .member-list-item {
        transition: all 0.3s ease;
        cursor: pointer;
    }
    .member-list-item:hover {
        transform: translateX(5px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.1) !important;
    }
    .member-avatar i {
        width: 45px;
        height: 45px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f9fa;
        border-radius: 50%;
    }
`;
document.head.appendChild(style);
