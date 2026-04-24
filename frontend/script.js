// frontend/script.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let currentLanguage = 'en';
let currentAreaFilter = 'all';
let currentSearchTerm = '';
let allMembers = [];
let uniqueAreas = [];

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
        // Extract area name (first part of address or full address)
        let area = member.address.split(',')[0].trim();
        if (area.length > 0 && area.length < 50) {
          areasSet.add(area);
        }
      }
    });
    uniqueAreas = Array.from(areasSet).sort();
    
    // Render area filter buttons
    renderAreaFilters();
    
    // Apply filters
    applyFilters();
  } catch (error) {
    console.error('Error loading members:', error);
    const container = document.getElementById('membersContainer');
    if (container) {
      container.innerHTML = '<div class="col-12 text-center"><p class="text-danger">Error loading members. Please try again later.</p></div>';
    }
  }
}

// Render area filter buttons
function renderAreaFilters() {
  const container = document.getElementById('areaFilterContainer');
  if (!container) return;
  
  const allCount = allMembers.length;
  
  let buttonsHtml = `
    <button class="btn btn-outline-success area-filter-btn ${currentAreaFilter === 'all' ? 'active' : ''}" data-area="all" onclick="filterByArea('all')">
      <i class="fas fa-globe me-1"></i> <span data-en="All Areas" data-as="সকলো এলাকা">All Areas</span>
      <span class="area-stats">(${allCount})</span>
    </button>
  `;
  
  uniqueAreas.forEach(area => {
    const count = allMembers.filter(m => m.address && m.address.split(',')[0].trim() === area).length;
    buttonsHtml += `
      <button class="btn btn-outline-success area-filter-btn ${currentAreaFilter === area ? 'active' : ''}" data-area="${area}" onclick="filterByArea('${area.replace(/'/g, "\\'")}')">
        <i class="fas fa-map-marker-alt me-1"></i> ${area}
        <span class="area-stats">(${count})</span>
      </button>
    `;
  });
  
  container.innerHTML = buttonsHtml;
  
  // Update language for area buttons if needed
  if (currentLanguage === 'as') {
    document.querySelectorAll('[data-en]').forEach(el => {
      if (el.getAttribute('data-as')) {
        el.innerText = el.getAttribute('data-as');
      }
    });
  }
}

// Filter by area
window.filterByArea = function(area) {
  currentAreaFilter = area;
  currentSearchTerm = document.getElementById('memberSearch')?.value.toLowerCase() || '';
  applyFilters();
  
  // Update active button styling
  document.querySelectorAll('.area-filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-area') === area) {
      btn.classList.add('active');
    }
  });
};

// Clear search
window.clearSearch = function() {
  const searchInput = document.getElementById('memberSearch');
  if (searchInput) {
    searchInput.value = '';
    currentSearchTerm = '';
    applyFilters();
  }
};

// Apply both area and search filters
function applyFilters() {
  let filteredMembers = [...allMembers];
  
  // Apply area filter
  if (currentAreaFilter !== 'all') {
    filteredMembers = filteredMembers.filter(member => 
      member.address && member.address.split(',')[0].trim() === currentAreaFilter
    );
  }
  
  // Apply search filter (by name in both English and Assamese)
  if (currentSearchTerm) {
    filteredMembers = filteredMembers.filter(member => 
      member.name.toLowerCase().includes(currentSearchTerm) ||
      (member.nameAs && member.nameAs.toLowerCase().includes(currentSearchTerm))
    );
  }
  
  displayMembers(filteredMembers);
  updateResultCount(filteredMembers.length);
}

// Update result count display
function updateResultCount(count) {
  const resultCountEl = document.getElementById('resultCount');
  if (resultCountEl) {
    if (currentLanguage === 'en') {
      resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> Showing ${count} member${count !== 1 ? 's' : ''}`;
    } else {
      resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> ${count} জন সদস্য দেখুওৱা হৈছে`;
    }
  }
}

// Display members in the UI
function displayMembers(members) {
  const container = document.getElementById('membersContainer');
  
  if (!members || members.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="fas fa-user-slash fa-4x text-muted mb-3"></i>
        <h4 class="text-muted">${currentLanguage === 'en' ? 'No members found' : 'কোনো সদস্য পোৱা নগল'}</h4>
        <p class="text-muted">${currentLanguage === 'en' ? 'Try adjusting your search or filter criteria' : 'আপোনাৰ সন্ধান বা ফিল্টাৰ সামঞ্জস্য কৰক'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = members.map(member => `
    <div class="col-md-4 col-sm-6">
      <div class="member-card">
        <div class="position-relative">
          <i class="fas fa-user-circle fa-4x text-success mb-2"></i>
          ${member.role === 'Committee Head' ? '<span class="position-absolute top-0 end-0 badge bg-warning text-dark">Head</span>' : ''}
        </div>
        <h5 class="mb-1">${escapeHtml(member.name)}</h5>
        ${member.nameAs ? `<p class="text-muted small mb-2">${escapeHtml(member.nameAs)}</p>` : ''}
        <p class="text-muted mb-1"><i class="fas fa-tag me-1"></i> ${member.role || 'Member'}</p>
        ${member.phone ? `<p class="mb-1"><small><i class="fas fa-phone me-1 text-success"></i> ${member.phone}</small></p>` : ''}
        ${member.address ? `<p class="mb-0"><small><i class="fas fa-map-marker-alt me-1 text-danger"></i> ${escapeHtml(member.address)}</small></p>` : ''}
      </div>
    </div>
  `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

// Language toggle
const languageToggle = document.getElementById('languageToggle');
if (languageToggle) {
  languageToggle.addEventListener('click', () => {
    currentLanguage = currentLanguage === 'en' ? 'as' : 'en';
    updateLanguage();
    loadSettings();
    loadEvents();
    loadMembers();
    renderAreaFilters();
  });
}

// Search functionality
const memberSearch = document.getElementById('memberSearch');
if (memberSearch) {
  memberSearch.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.toLowerCase();
    applyFilters();
  });
}

// Initialize all on page load
document.addEventListener('DOMContentLoaded', () => {
  updateLanguage();
  loadSettings();
  loadMembers();
  loadEvents();
  loadDonationProgress();
});

// Handle navigation menu active state
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function() {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
  });
});
