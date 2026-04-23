// admin/admin.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let token = localStorage.getItem('adminToken');

// DOM Elements
let currentSection = 'dashboard';
let currentEventImage = null;

// Check authentication
async function checkAuth() {
    if (!token) {
        showLogin();
        return false;
    }
    
    try {
        const res = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            showDashboard();
            return true;
        } else {
            localStorage.removeItem('adminToken');
            token = null;
            showLogin();
            return false;
        }
    } catch (error) {
        showLogin();
        return false;
    }
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardContent = document.getElementById('dashboardContent');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboardContent) dashboardContent.style.display = 'none';
}

function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardContent = document.getElementById('dashboardContent');
    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboardContent) dashboardContent.style.display = 'block';
    loadDashboard();
    loadMembers();
    loadEvents();
    loadDonations();
    loadSettings();
    loadEventStats();
}

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.token) {
            token = data.token;
            localStorage.setItem('adminToken', token);
            showDashboard();
        } else {
            alert('Login failed: ' + (data.error || 'Invalid credentials'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    token = null;
    showLogin();
});

// Navigation
document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const section = link.getAttribute('data-section');
        currentSection = section;
        
        const dashboardSection = document.getElementById('dashboardSection');
        const membersSection = document.getElementById('membersSection');
        const eventsSection = document.getElementById('eventsSection');
        const donationsSection = document.getElementById('donationsSection');
        const settingsSection = document.getElementById('settingsSection');
        
        if (dashboardSection) dashboardSection.style.display = section === 'dashboard' ? 'block' : 'none';
        if (membersSection) membersSection.style.display = section === 'members' ? 'block' : 'none';
        if (eventsSection) eventsSection.style.display = section === 'events' ? 'block' : 'none';
        if (donationsSection) donationsSection.style.display = section === 'donations' ? 'block' : 'none';
        if (settingsSection) settingsSection.style.display = section === 'settings' ? 'block' : 'none';
        
        if (section === 'members') loadMembers();
        if (section === 'events') loadEvents();
        if (section === 'donations') loadDonations();
        if (section === 'settings') loadSettings();
    });
});

// Dashboard Stats
async function loadDashboard() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await res.json();
        
        const statMembers = document.getElementById('statMembers');
        const statEvents = document.getElementById('statEvents');
        const statDonations = document.getElementById('statDonations');
        
        if (statMembers) statMembers.innerText = stats.memberCount || 0;
        if (statEvents) statEvents.innerText = stats.eventCount || 0;
        if (statDonations) statDonations.innerHTML = `₹${stats.totalDonations || 0}`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load event statistics for dashboard
async function loadEventStats() {
    try {
        const res = await fetch(`${API_URL}/events/stats/summary`);
        const stats = await res.json();
        
        const todayEventsCount = document.getElementById('todayEventsCount');
        const upcomingEventsCount = document.getElementById('upcomingEventsCount');
        const pastEventsCount = document.getElementById('pastEventsCount');
        
        if (todayEventsCount) todayEventsCount.innerText = stats.today || 0;
        if (upcomingEventsCount) upcomingEventsCount.innerText = stats.upcoming || 0;
        if (pastEventsCount) pastEventsCount.innerText = stats.past || 0;
    } catch (error) {
        console.error('Error loading event stats:', error);
    }
}

// ========== MEMBERS MANAGEMENT ==========

async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();
        const tbody = document.getElementById('membersTable');
        if (!tbody) return;
        
        tbody.innerHTML = members.map(m => `
            <tr>
                <td>${m.name}${m.nameAs ? `<br><small class="text-muted">${m.nameAs}</small>` : ''}</td>
                <td>${m.phone || '-'}</td>
                <td>${m.address || '-'}</td>
                <td>${m.role || 'Member'}</td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="editMember('${m._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMember('${m._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                 </td>
             </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

window.openMemberModal = () => {
    const memberId = document.getElementById('memberId');
    const memberForm = document.getElementById('memberForm');
    const memberModalTitle = document.getElementById('memberModalTitle');
    
    if (memberId) memberId.value = '';
    if (memberForm) memberForm.reset();
    if (memberModalTitle) memberModalTitle.innerText = 'Add New Member';
    
    new bootstrap.Modal(document.getElementById('memberModal')).show();
};

window.editMember = async (id) => {
    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();
        const member = members.find(m => m._id === id);
        
        const memberId = document.getElementById('memberId');
        const memberName = document.getElementById('memberName');
        const memberNameAs = document.getElementById('memberNameAs');
        const memberPhone = document.getElementById('memberPhone');
        const memberAddress = document.getElementById('memberAddress');
        const memberRole = document.getElementById('memberRole');
        const memberModalTitle = document.getElementById('memberModalTitle');
        
        if (memberId) memberId.value = member._id;
        if (memberName) memberName.value = member.name;
        if (memberNameAs) memberNameAs.value = member.nameAs || '';
        if (memberPhone) memberPhone.value = member.phone || '';
        if (memberAddress) memberAddress.value = member.address || '';
        if (memberRole) memberRole.value = member.role || 'Member';
        if (memberModalTitle) memberModalTitle.innerText = 'Edit Member';
        
        new bootstrap.Modal(document.getElementById('memberModal')).show();
    } catch (error) {
        alert('Error loading member');
    }
};

window.deleteMember = async (id) => {
    if (!confirm('Delete this member?')) return;
    try {
        const res = await fetch(`${API_URL}/members/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            alert('Member deleted successfully');
            loadMembers();
            loadDashboard();
        } else {
            alert('Failed to delete member');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

document.getElementById('memberForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('memberId').value;
    const data = {
        name: document.getElementById('memberName').value,
        nameAs: document.getElementById('memberNameAs')?.value || '',
        phone: document.getElementById('memberPhone').value,
        address: document.getElementById('memberAddress').value,
        role: document.getElementById('memberRole').value
    };
    
    try {
        const url = id ? `${API_URL}/members/${id}` : `${API_URL}/members`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            alert(id ? 'Member updated successfully' : 'Member added successfully');
            bootstrap.Modal.getInstance(document.getElementById('memberModal')).hide();
            loadMembers();
            loadDashboard();
        } else {
            const error = await res.json();
            alert('Failed to save member: ' + error.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// ========== ENHANCED EVENTS MANAGEMENT ==========

async function loadEvents() {
    try {
        const res = await fetch(`${API_URL}/events`);
        const events = await res.json();
        const tbody = document.getElementById('eventsTable');
        if (!tbody) return;
        
        tbody.innerHTML = events.map(event => `
            <tr>
                <td>
                    ${event.image ? 
                        `<img src="${API_URL.replace('/api', '')}${event.image}" width="50" height="50" style="object-fit:cover; border-radius:8px;">` : 
                        '<i class="fas fa-calendar fa-2x text-muted"></i>'}
                </td>
                <td>
                    <strong>${event.title}</strong>
                    ${event.titleAs ? `<br><small class="text-muted">${event.titleAs}</small>` : ''}
                </td>
                <td>
                    ${new Date(event.date).toLocaleDateString()}<br>
                    <small class="text-muted">${event.time || 'Time TBA'}</small>
                </td>
                <td>${event.location || 'TBA'}</td>
                <td>
                    <span class="badge bg-${event.category === 'today' ? 'danger' : event.category === 'upcoming' ? 'success' : 'secondary'}">
                        ${event.category === 'today' ? 'Today' : event.category === 'upcoming' ? 'Upcoming' : 'Past'}
                    </span>
                    ${event.featured ? '<span class="badge bg-warning ms-1">Featured</span>' : ''}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="editEvent('${event._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEvent('${event._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

// Open event modal for add/edit
window.openEventModal = () => {
    const eventId = document.getElementById('eventId');
    const eventForm = document.getElementById('eventForm');
    const eventModalTitle = document.getElementById('eventModalTitle');
    const eventImagePreview = document.getElementById('eventImagePreview');
    
    if (eventId) eventId.value = '';
    if (eventForm) eventForm.reset();
    if (eventModalTitle) eventModalTitle.innerText = 'Add New Event';
    if (eventImagePreview) {
        eventImagePreview.innerHTML = '';
        eventImagePreview.style.display = 'none';
    }
    currentEventImage = null;
    
    // Set default date to today
    const eventDate = document.getElementById('eventDate');
    if (eventDate) {
        const today = new Date().toISOString().split('T')[0];
        eventDate.value = today;
    }
    
    new bootstrap.Modal(document.getElementById('eventModal')).show();
};

// Edit event
window.editEvent = async (id) => {
    try {
        const res = await fetch(`${API_URL}/events/${id}`);
        const event = await res.json();
        
        const eventId = document.getElementById('eventId');
        const eventTitle = document.getElementById('eventTitle');
        const eventTitleAs = document.getElementById('eventTitleAs');
        const eventDesc = document.getElementById('eventDesc');
        const eventDescAs = document.getElementById('eventDescAs');
        const eventDate = document.getElementById('eventDate');
        const eventTime = document.getElementById('eventTime');
        const eventEndTime = document.getElementById('eventEndTime');
        const eventLocation = document.getElementById('eventLocation');
        const eventLocationAs = document.getElementById('eventLocationAs');
        const eventStatus = document.getElementById('eventStatus');
        const eventFeatured = document.getElementById('eventFeatured');
        const eventModalTitle = document.getElementById('eventModalTitle');
        const eventImagePreview = document.getElementById('eventImagePreview');
        
        if (eventId) eventId.value = event._id;
        if (eventTitle) eventTitle.value = event.title;
        if (eventTitleAs) eventTitleAs.value = event.titleAs || '';
        if (eventDesc) eventDesc.value = event.description || '';
        if (eventDescAs) eventDescAs.value = event.descriptionAs || '';
        if (eventDate) eventDate.value = event.date ? event.date.split('T')[0] : '';
        if (eventTime) eventTime.value = event.time || '12:00';
        if (eventEndTime) eventEndTime.value = event.endTime || '';
        if (eventLocation) eventLocation.value = event.location || '';
        if (eventLocationAs) eventLocationAs.value = event.locationAs || '';
        if (eventStatus) eventStatus.value = event.status || 'active';
        if (eventFeatured) eventFeatured.checked = event.featured || false;
        if (eventModalTitle) eventModalTitle.innerText = 'Edit Event';
        
        if (event.image && eventImagePreview) {
            currentEventImage = event.image;
            eventImagePreview.innerHTML = `
                <div class="text-center">
                    <img src="${API_URL.replace('/api', '')}${event.image}" style="max-width: 200px; border-radius: 8px; margin-bottom: 10px;">
                    <br>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeEventImage()">Remove Image</button>
                </div>
            `;
            eventImagePreview.style.display = 'block';
        }
        
        new bootstrap.Modal(document.getElementById('eventModal')).show();
    } catch (error) {
        console.error('Error loading event:', error);
        alert('Error loading event: ' + error.message);
    }
};

// Remove event image
window.removeEventImage = () => {
    currentEventImage = null;
    const eventImagePreview = document.getElementById('eventImagePreview');
    const eventImage = document.getElementById('eventImage');
    
    if (eventImagePreview) {
        eventImagePreview.innerHTML = '';
        eventImagePreview.style.display = 'none';
    }
    if (eventImage) eventImage.value = '';
};

// Delete event
window.deleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
        const res = await fetch(`${API_URL}/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            alert('Event deleted successfully');
            loadEvents();
            loadDashboard();
            loadEventStats();
        } else {
            alert('Failed to delete event');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Save event (create or update)
document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('eventId').value;
    const formData = new FormData();
    
    const eventData = {
        title: document.getElementById('eventTitle').value,
        titleAs: document.getElementById('eventTitleAs')?.value || '',
        description: document.getElementById('eventDesc').value,
        descriptionAs: document.getElementById('eventDescAs')?.value || '',
        date: document.getElementById('eventDate').value,
        time: document.getElementById('eventTime').value,
        endTime: document.getElementById('eventEndTime')?.value || '',
        location: document.getElementById('eventLocation').value,
        locationAs: document.getElementById('eventLocationAs')?.value || '',
        status: document.getElementById('eventStatus').value,
        featured: document.getElementById('eventFeatured')?.checked || false
    };
    
    formData.append('data', JSON.stringify(eventData));
    
    const imageFile = document.getElementById('eventImage')?.files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const url = id ? `${API_URL}/events/${id}` : `${API_URL}/events`;
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        if (res.ok) {
            alert(id ? 'Event updated successfully' : 'Event added successfully');
            bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
            loadEvents();
            loadDashboard();
            loadEventStats();
        } else {
            const error = await res.json();
            alert('Failed to save event: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error: ' + error.message);
    }
});

// ========== DONATIONS MANAGEMENT ==========

async function loadDonations() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/donations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const donations = await res.json();
        const tbody = document.getElementById('donationsTable');
        if (!tbody) return;
        
        tbody.innerHTML = donations.map(d => `
            <tr>
                <td>${d.name || 'Anonymous'}</td>
                <td>₹${d.amount || 0}</td>
                <td>${d.transactionId || '-'}</td>
                <td>${new Date(d.date).toLocaleDateString()}</td>
                <td>
                    <span class="badge bg-${d.status === 'completed' ? 'success' : 'warning'}">
                        ${d.status || 'pending'}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading donations:', error);
    }
}

// ========== SETTINGS MANAGEMENT ==========

async function loadSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        
        const settingWhatsapp = document.getElementById('settingWhatsapp');
        const settingEmail = document.getElementById('settingEmail');
        const settingPhone = document.getElementById('settingPhone');
        const settingAboutEn = document.getElementById('settingAboutEn');
        const settingAboutAs = document.getElementById('settingAboutAs');
        
        if (settingWhatsapp) settingWhatsapp.value = settings.whatsapp_number?.value || '';
        if (settingEmail) settingEmail.value = settings.contact_email?.value || '';
        if (settingPhone) settingPhone.value = settings.contact_phone?.value || '';
        if (settingAboutEn) settingAboutEn.value = settings.about_content?.value || '';
        if (settingAboutAs) settingAboutAs.value = settings.about_content_as?.value || '';
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!token) return;
    
    const updates = [
        { key: 'whatsapp_number', value: document.getElementById('settingWhatsapp')?.value || '' },
        { key: 'contact_email', value: document.getElementById('settingEmail')?.value || '' },
        { key: 'contact_phone', value: document.getElementById('settingPhone')?.value || '' },
        { key: 'about_content', value: document.getElementById('settingAboutEn')?.value || '' },
        { key: 'about_content_as', value: document.getElementById('settingAboutAs')?.value || '' }
    ];
    
    try {
        for (const up of updates) {
            await fetch(`${API_URL}/settings/${up.key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: up.value })
            });
        }
        alert('Settings saved successfully!');
    } catch (error) {
        alert('Error saving settings: ' + error.message);
    }
});

// Initialize
checkAuth();
