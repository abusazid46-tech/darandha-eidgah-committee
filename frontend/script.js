// frontend/script.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let currentLanguage = 'en';
let currentAreaFilter = 'all';
let currentSearchTerm = '';
let currentViewMode = 'all'; // 'dignitaries' or 'all'
let allMembers = [];
let uniqueAreas = [];
let allMembersFiltered = [];

// Configuration for homepage member display
const MAX_DIGNITARIES_ON_HOMEPAGE = 6; // Show maximum 6 dignitaries initially
const MAX_MEMBERS_ON_HOMEPAGE = 12; // Show maximum 12 members in all view

// Dignitary roles (committee heads and leadership positions)
const dignitaryRoles = ['Committee Head', 'Secretary', 'Treasurer', 'Vice President', 'President', 'Chairman', 'General Secretary'];

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
  
  // Update result count text if exists
  const resultCountEl = document.getElementById('resultCount');
  if (resultCountEl && resultCountEl.innerHTML) {
    applyFilters(); // Refresh display with new language
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
        settings.about_content?.value || 'Darandha Eidgah Committee is dedicated to serving the Muslim community by maintaining the graveyard with dignity and respect. We provide funeral services, maintain records, and support bereaved families.' : 
        settings.about_content_as?.value || 'দৰংদহ ঈদগাহ কমিটিয়ে মুছলমান সমাজক মৰ্যাদা আৰু সন্মানেৰে কবৰস্থান পৰিচালনা কৰি সেৱা আগবঢ়োৱাত নিয়োজিত। আমি জানাজা সেৱা প্ৰদান কৰো, অভিলেখ ৰাখো, আৰু শোকাহত পৰিয়ালবোৰক সহায় কৰো।';
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
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Load members with area filter support
async function loadMembers() {
  try {
    const res = await fetch(`${API_URL}/members`);
    allMembers = await res.json();
    
    // Extract unique areas from member addresses
    const areasSet = new Set();
    allMembers.forEach(member => {
      if (member.address && member.address.trim()) {
        let area = member.address.split(',')[0].trim();
        if (area.length > 0 && area.length < 50) {
          areasSet.add(area);
        }
      }
    });
    uniqueAreas = Array.from(areasSet).sort();
    
    // Populate area dropdown
    populateAreaDropdown();
    
    // Apply filters and display
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
    const count = allMembers.filter(m => m.address && m.address.split(',')[0].trim() === area).length;
    options += `<option value="${escapeHtml(area)}">📍 ${escapeHtml(area)} (${count})</option>`;
  });
  
  select.innerHTML = options;
  select.value = currentAreaFilter;
}

// Apply all filters with limits
function applyFilters() {
  let filteredMembers = [...allMembers];
  
  // Apply area filter
  if (currentAreaFilter !== 'all') {
    filteredMembers = filteredMembers.filter(member => 
      member.address && member.address.split(',')[0].trim() === currentAreaFilter
    );
  }
  
  // Apply search filter
  if (currentSearchTerm) {
    filteredMembers = filteredMembers.filter(member => 
      member.name.toLowerCase().includes(currentSearchTerm) ||
      (member.nameAs && member.nameAs.toLowerCase().includes(currentSearchTerm))
    );
  }
  
  // Store original filtered count for reference
  allMembersFiltered = [...filteredMembers];
  let displayMembers = [...filteredMembers];
  let isLimited = false;
  let totalAvailable = 0;
  
  // Apply view mode filter and limits
  if (currentViewMode === 'dignitaries') {
    displayMembers = displayMembers.filter(member => dignitaryRoles.includes(member.role));
    totalAvailable = displayMembers.length;
    
    // Limit dignitaries shown on homepage (only when no search/area filter)
    if (displayMembers.length > MAX_DIGNITARIES_ON_HOMEPAGE && currentSearchTerm === '' && currentAreaFilter === 'all') {
      displayMembers = displayMembers.slice(0, MAX_DIGNITARIES_ON_HOMEPAGE);
      isLimited = true;
    }
  } else {
    totalAvailable = displayMembers.length;
    
    // Limit all members shown on homepage (only when no search/area filter)
    if (displayMembers.length > MAX_MEMBERS_ON_HOMEPAGE && currentSearchTerm === '' && currentAreaFilter === 'all') {
      displayMembers = displayMembers.slice(0, MAX_MEMBERS_ON_HOMEPAGE);
      isLimited = true;
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
  
  if (currentViewMode === 'dignitaries') {
    // List view for dignitaries
    container.innerHTML = `
      <div class="members-decorated-list">
        ${members.map(member => createMemberListItem(member)).join('')}
      </div>
    `;
  } else {
    // Grid view for all members
    const dignitaries = members.filter(m => dignitaryRoles.includes(m.role));
    const regularMembers = members.filter(m => !dignitaryRoles.includes(m.role));
    
    let html = '';
    
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
    
    container.innerHTML = html;
  }
}

// Create member card (grid view)
function createMemberCard(member) {
  const isDignitary = dignitaryRoles.includes(member.role);
  const roleClass = isDignitary ? 'border-warning' : 'border-success';
  const roleIcon = isDignitary ? 'fa-crown text-warning' : 'fa-user-circle text-success';
  
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
            <span class="badge ${isDignitary ? 'bg-warning text-dark' : 'bg-success'} mb-2">
              <i class="fas ${isDignitary ? 'fa-crown' : 'fa-user'} me-1"></i> ${member.role || 'Member'}
            </span>
            ${member.phone ? `<p class="mb-1 small"><i class="fas fa-phone me-1 text-success"></i> ${member.phone}</p>` : ''}
            ${member.address ? `<p class="mb-0 small"><i class="fas fa-map-marker-alt me-1 text-danger"></i> ${escapeHtml(member.address)}</p>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Create member list item (decorated list view for dignitaries)
function createMemberListItem(member) {
  const isDignitary = dignitaryRoles.includes(member.role);
  const roleIcon = isDignitary ? 'fa-crown text-warning' : 'fa-user-circle text-success';
  
  return `
    <div class="member-list-item p-3 mb-2 bg-white rounded-3 shadow-sm border-start border-3 ${isDignitary ? 'border-warning' : 'border-success'}">
      <div class="d-flex align-items-center flex-wrap flex-md-nowrap">
        <div class="member-avatar me-3">
          <i class="fas ${roleIcon} fa-2x"></i>
        </div>
        <div class="member-info flex-grow-1">
          <div class="d-flex align-items-center flex-wrap gap-2">
            <h5 class="mb-0">${escapeHtml(member.name)}</h5>
            ${member.nameAs ? `<small class="text-muted">(${escapeHtml(member.nameAs)})</small>` : ''}
            <span class="badge ${isDignitary ? 'bg-warning text-dark' : 'bg-success'}">
              ${member.role || 'Member'}
            </span>
          </div>
          <div class="member-details mt-2">
            ${member.phone ? `<span class="me-3"><i class="fas fa-phone text-success me-1"></i> ${member.phone}</span>` : ''}
            ${member.address ? `<span><i class="fas fa-map-marker-alt text-danger me-1"></i> ${escapeHtml(member.address)}</span>` : ''}
          </div>
        </div>
        <div class="member-badge ms-2">
          ${isDignitary ? '<i class="fas fa-crown fa-lg text-warning" title="Committee Leader"></i>' : ''}
        </div>
      </div>
    </div>
  `;
}

// Update result count display
function updateResultCount(displayCount, isLimited, totalCount) {
  const resultCountEl = document.getElementById('resultCount');
  if (!resultCountEl) return;
  
  if (currentLanguage === 'en') {
    const viewText = currentViewMode === 'dignitaries' ? 'leaders' : 'members';
    if (isLimited && totalCount > displayCount) {
      resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> Showing ${displayCount} of ${totalCount} ${viewText}. 
        <a href="javascript:void(0)" onclick="loadAllMembers()" class="text-success fw-bold">View All →</a>`;
    } else {
      resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> Showing ${displayCount} ${viewText}`;
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

// Load all members (remove limit)
window.loadAllMembers = function() {
  let displayMembers;
  
  if (currentViewMode === 'dignitaries') {
    displayMembers = allMembersFiltered.filter(member => dignitaryRoles.includes(member.role));
  } else {
    displayMembers = [...allMembersFiltered];
  }
  
  displayMembersList(displayMembers);
  updateResultCount(displayMembers.length, false, displayMembers.length);
  hideViewAllButton();
};

// Show view all button container
function showViewAllButton() {
  let viewAllContainer = document.getElementById('viewAllContainer');
  if (!viewAllContainer) {
    const container = document.getElementById('membersListContainer');
    if (container && container.parentNode) {
      const div = document.createElement('div');
      div.id = 'viewAllContainer';
      div.className = 'text-center mt-3';
      container.parentNode.insertBefore(div, container.nextSibling);
      viewAllContainer = div;
    }
  }
  
  if (viewAllContainer) {
    viewAllContainer.innerHTML = `
      <div class="text-center mt-4">
        <button class="btn btn-outline-success px-4 py-2 rounded-pill" onclick="loadAllMembers()">
          <i class="fas fa-eye me-2"></i>
          ${currentLanguage === 'en' ? `View All ${currentViewMode === 'dignitaries' ? 'Leaders' : 'Members'}` : `সকলো ${currentViewMode === 'dignitaries' ? 'নেতৃবৃন্দ' : 'সদস্য'} চাওক`}
          <i class="fas fa-arrow-right ms-2"></i>
        </button>
      </div>
    `;
  }
}

function hideViewAllButton() {
  const viewAllContainer = document.getElementById('viewAllContainer');
  if (viewAllContainer) {
    viewAllContainer.innerHTML = '';
  }
}

// Filter by area from dropdown
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
  
  // Update button styles
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

// Load events (for homepage - shows upcoming events only)
async function loadEvents() {
  try {
    const res = await fetch(`${API_URL}/events/upcoming`);
    const events = await res.json();
    const container = document.getElementById('eventsContainer');
    
    if (!container) return;
    
    if (!events || events.length === 0) {
      container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No upcoming events at this time. Please check back later.</p></div>';
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
              ${event.time ? `
                <div class="mb-2">
                  <i class="far fa-clock me-2"></i>${time}
                </div>
              ` : ''}
              ${location ? `
                <div class="mb-3">
                  <i class="fas fa-location-dot me-2"></i>${escapeHtml(location)}
                </div>
              ` : ''}
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
    const res = await fetch(`${API_URL}/donations`);
    const donations = await res.json();
    const total = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
    const goal = 500000;
    const percentage = Math.min((total / goal) * 100, 100);
    
    const progressBar = document.getElementById('donationProgress');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      if (percentage > 0) {
        progressBar.innerText = `₹${total.toLocaleString()} raised of ₹${goal.toLocaleString()}`;
      } else {
        progressBar.innerText = '0%';
      }
    }
  } catch (error) {
    console.error('Error loading donation progress:', error);
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
      status: 'completed'
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
        alert('Thank you for your donation! May Allah reward you abundantly.');
        const modal = bootstrap.Modal.getInstance(document.getElementById('donationModal'));
        if (modal) modal.hide();
        donationForm.reset();
        loadDonationProgress();
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to submit donation. Please try again.'));
      }
    } catch (error) {
      console.error('Donation error:', error);
      alert('Network error. Please check your connection and try again.');
    }
  });
}

// Escape HTML helper
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  updateLanguage();
  loadSettings();
  loadMembers();
  loadEvents();
  loadDonationProgress();
  
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

// Add styles for member list
const style = document.createElement('style');
style.textContent = `
  .members-decorated-list {
    max-height: 600px;
    overflow-y: auto;
    padding-right: 5px;
  }
  
  .members-decorated-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .members-decorated-list::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  .members-decorated-list::-webkit-scrollbar-thumb {
    background: #1a5f3e;
    border-radius: 10px;
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
  
  .member-details {
    font-size: 0.85rem;
    color: #6c757d;
  }
  
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
`;
document.head.appendChild(style);
