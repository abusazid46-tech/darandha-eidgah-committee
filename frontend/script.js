// frontend/script.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let currentLanguage = 'en'; // 'en' or 'as'

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

// Load members
async function loadMembers() {
  try {
    const res = await fetch(`${API_URL}/members`);
    const members = await res.json();
    const searchTerm = document.getElementById('memberSearch')?.value.toLowerCase() || '';
    
    const container = document.getElementById('membersContainer');
    if (!container) return;
    
    const filtered = members.filter(m => m.name.toLowerCase().includes(searchTerm));
    
    if (filtered.length === 0) {
      container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No members found</p></div>';
      return;
    }
    
    container.innerHTML = filtered.map(member => `
      <div class="col-md-4 col-sm-6">
        <div class="member-card">
          <i class="fas fa-user-circle fa-3x text-success mb-2"></i>
          <h5>${member.name}</h5>
          ${member.nameAs ? `<p class="text-muted small">${member.nameAs}</p>` : ''}
          <p class="text-muted mb-1">${member.role || 'Member'}</p>
          ${member.phone ? `<small><i class="fas fa-phone"></i> ${member.phone}</small><br>` : ''}
          ${member.address ? `<small><i class="fas fa-map-marker-alt"></i> ${member.address}</small>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading members:', error);
    const container = document.getElementById('membersContainer');
    if (container) {
      container.innerHTML = '<div class="col-12 text-center"><p class="text-danger">Error loading members. Please try again later.</p></div>';
    }
  }
}

// Load events (for homepage - shows upcoming events only)
// Updated loadEvents function for homepage
async function loadEvents() {
    try {
        // Fetch upcoming events only for homepage
        const res = await fetch(`${API_URL}/events/upcoming`);
        const events = await res.json();
        const container = document.getElementById('eventsContainer');
        
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="col-12 text-center"><p class="text-muted">No upcoming events at this time. Please check back later.</p></div>';
            return;
        }
        
        // Show only first 3 upcoming events on homepage
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
                            <h4 class="mb-2">${title}</h4>
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
                                    <i class="fas fa-location-dot me-2"></i>${location}
                                </div>
                            ` : ''}
                            <p class="text-muted">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</p>
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
    const goal = 500000; // ₹5 lakh goal
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
    loadMembers(); // Reload members with language
  });
}

// Search functionality
const memberSearch = document.getElementById('memberSearch');
if (memberSearch) {
  memberSearch.addEventListener('input', () => loadMembers());
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
