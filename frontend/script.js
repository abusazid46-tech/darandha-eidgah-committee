// frontend/script.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let currentLanguage = 'as'; // 'en' or 'as'

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
  
  document.getElementById('languageToggle').innerHTML = currentLanguage === 'en' ? 
    '<i class="fas fa-language me-1"></i> অসমীয়া' : 
    '<i class="fas fa-language me-1"></i> English';
}

// Load settings and about content
async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`);
    const settings = await res.json();
    
    document.getElementById('aboutText').innerHTML = currentLanguage === 'en' ? 
      settings.about_content?.value || '' : settings.about_content_as?.value || '';
    
    document.getElementById('contactPhone').innerText = settings.contact_phone?.value || '+91 98765 43210';
    document.getElementById('contactEmail').innerText = settings.contact_email?.value || 'info@darandhaeidgah.org';
    const whatsappNum = settings.whatsapp_number?.value || '+919876543210';
    document.getElementById('whatsappNumber').innerText = whatsappNum;
    document.getElementById('whatsappLink').href = `https://wa.me/${whatsappNum.replace(/\+/g, '')}`;
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
    const filtered = members.filter(m => m.name.toLowerCase().includes(searchTerm));
    
    if (filtered.length === 0) {
      container.innerHTML = '<div class="col-12 text-center">No members found</div>';
      return;
    }
    
    container.innerHTML = filtered.map(member => `
      <div class="col-md-4 col-sm-6">
        <div class="member-card">
          <i class="fas fa-user-circle fa-3x text-success mb-2"></i>
          <h5>${member.name}</h5>
          <p class="text-muted mb-1">${member.role || 'Member'}</p>
          ${member.phone ? `<small><i class="fas fa-phone"></i> ${member.phone}</small><br>` : ''}
          ${member.address ? `<small><i class="fas fa-map-marker-alt"></i> ${member.address}</small>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading members:', error);
  }
}

// Load events
async function loadEvents() {
  try {
    const res = await fetch(`${API_URL}/events`);
    const events = await res.json();
    const container = document.getElementById('eventsContainer');
    
    if (events.length === 0) {
      container.innerHTML = '<div class="col-12 text-center">No upcoming events</div>';
      return;
    }
    
    container.innerHTML = events.map(event => `
      <div class="col-md-4 mb-4">
        <div class="card h-100">
          ${event.image ? `<img src="${API_URL}${event.image}" class="card-img-top" style="height: 200px; object-fit: cover;">` : 
            '<div class="card-img-top bg-light text-center py-5"><i class="fas fa-calendar-alt fa-3x text-muted"></i></div>'}
          <div class="card-body">
            <h5 class="card-title">${currentLanguage === 'en' ? event.title : (event.titleAs || event.title)}</h5>
            <p class="card-text">${currentLanguage === 'en' ? event.description : (event.descriptionAs || event.description)}</p>
            <small class="text-muted"><i class="far fa-calendar-alt"></i> ${new Date(event.date).toLocaleDateString()}</small>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

// Load donation progress
async function loadDonationProgress() {
  try {
    const token = localStorage.getItem('adminToken');
    if (token) {
      const res = await fetch(`${API_URL}/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const stats = await res.json();
        const goal = 500000; // ₹5 lakh goal
        const percentage = Math.min((stats.totalDonations / goal) * 100, 100);
        const progressBar = document.getElementById('donationProgress');
        if (progressBar) {
          progressBar.style.width = `${percentage}%`;
          progressBar.innerText = `₹${stats.totalDonations.toLocaleString()} raised of ₹${goal.toLocaleString()}`;
        }
      }
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
}

// Submit donation
document.getElementById('donationForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const donation = {
    name: document.getElementById('donorName').value,
    amount: parseInt(document.getElementById('donorAmount').value),
    transactionId: document.getElementById('transactionId').value,
    status: 'completed'
  };
  
  try {
    const res = await fetch(`${API_URL}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donation)
    });
    if (res.ok) {
      alert('Thank you for your donation! May Allah reward you.');
      bootstrap.Modal.getInstance(document.getElementById('donationModal')).hide();
      document.getElementById('donationForm').reset();
      loadDonationProgress();
    }
  } catch (error) {
    alert('Error submitting donation. Please try again.');
  }
});

// Language toggle
document.getElementById('languageToggle')?.addEventListener('click', () => {
  currentLanguage = currentLanguage === 'en' ? 'as' : 'en';
  updateLanguage();
  loadSettings(); // Reload about content with new language
  loadEvents();   // Reload events with new language
});

// Search functionality
document.getElementById('memberSearch')?.addEventListener('input', () => loadMembers());

// Initial load
updateLanguage();
loadSettings();
loadMembers();
loadEvents();
loadDonationProgress();
