// admin/admin.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let token = localStorage.getItem('adminToken');
let autoRefreshInterval = null;

// DOM Elements
let currentSection = 'dashboard';
let currentEventImage = null;
let currentEventFilter = 'all';

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
            startAutoRefresh();
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

// Start auto-refresh every 30 seconds
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        if (currentSection === 'events') {
            filterEvents(currentEventFilter);
            loadEventStats();
        } else if (currentSection === 'dashboard') {
            loadDashboard();
            loadEventStats();
        } else if (currentSection === 'members') {
            loadMembers();
        }
    }, 30000);
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardContent = document.getElementById('dashboardContent');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboardContent) dashboardContent.style.display = 'none';
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
}

function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardContent = document.getElementById('dashboardContent');
    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboardContent) dashboardContent.style.display = 'block';
    loadDashboard();
    loadMembers();
    filterEvents('all');
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
            startAutoRefresh();
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
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
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
        if (section === 'events') filterEvents(currentEventFilter);
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
        
        if (todayEventsCount) {
            todayEventsCount.innerText = stats.today || 0;
            animateValue(todayEventsCount);
        }
        if (upcomingEventsCount) {
            upcomingEventsCount.innerText = stats.upcoming || 0;
            animateValue(upcomingEventsCount);
        }
        if (pastEventsCount) {
            pastEventsCount.innerText = stats.past || 0;
            animateValue(pastEventsCount);
        }
    } catch (error) {
        console.error('Error loading event stats:', error);
    }
}

// Animation helper
function animateValue(element) {
    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 200);
}

// ========== ENHANCED MEMBERS MANAGEMENT (with Address for Area Filter) ==========

async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();
        const tbody = document.getElementById('membersTable');
        if (!tbody) return;
        
        tbody.innerHTML = members.map(m => `
            <tr>
                <td>
                    <strong>${escapeHtml(m.name)}</strong>
                    ${m.nameAs ? `<br><small class="text-muted">${escapeHtml(m.nameAs)}</small>` : ''}
                </td>
                <td>${m.nameAs ? escapeHtml(m.nameAs) : '-'}</td>
                <td>${m.phone || '-'}</td>
                <td>${m.address ? escapeHtml(m.address) : '-'}</td>
                <td><span class="badge bg-success">${m.role || 'Member'}</span></td>
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
        const res = await fetch(`${API_URL}/members/${id}`);
        const member = await res.json();
        
        document.getElementById('memberId').value = member._id;
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberNameAs').value = member.nameAs || '';
        document.getElementById('memberPhone').value = member.phone || '';
        document.getElementById('memberAddress').value = member.address || '';
        document.getElementById('memberRole').value = member.role || 'Member';
        document.getElementById('memberModalTitle').innerText = 'Edit Member';
        
        new bootstrap.Modal(document.getElementById('memberModal')).show();
    } catch (error) {
        console.error('Error loading member:', error);
        alert('Error loading member: ' + error.message);
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
    
    if (!data.name) {
        alert('Name is required');
        return;
    }
    
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
            alert('Failed to save member: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving member:', error);
        alert('Error: ' + error.message);
    }
});

// ========== ENHANCED EVENTS MANAGEMENT ==========

async function filterEvents(category) {
    currentEventFilter = category;
    
    // Update active button styling
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === category) {
            btn.classList.add('active');
        }
    });
    
    try {
        let url = `${API_URL}/events`;
        if (category !== 'all') {
            url = `${API_URL}/events/category/${category}`;
        }
        
        const res = await fetch(url);
        const events = await res.json();
        const tbody = document.getElementById('eventsTable');
        if (!tbody) return;
        
        if (events.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="fas fa-calendar-times fa-2x mb-2 d-block"></i>
                        No ${category !== 'all' ? category : ''} events found
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = events.map(event => {
            let statusBadgeClass = '';
            let statusText = '';
            
            if (event.status === 'cancelled') {
                statusBadgeClass = 'danger';
                statusText = 'Cancelled';
            } else if (event.status === 'completed') {
                statusBadgeClass = 'info';
                statusText = 'Completed';
            } else {
                statusBadgeClass = 'success';
                statusText = 'Active';
            }
            
            return `
                <tr data-event-id="${event._id}">
                    <td>
                        ${event.image ? 
                            `<img src="${API_URL.replace('/api', '')}${event.image}" width="50" height="50" style="object-fit:cover; border-radius:8px;">` : 
                            '<i class="fas fa-calendar fa-2x text-muted"></i>'}
                    </td>
                    <td>
                        <strong>${escapeHtml(event.title)}</strong>
                        ${event.titleAs ? `<br><small class="text-muted">${escapeHtml(event.titleAs)}</small>` : ''}
                    </td>
                    <td>
                        ${new Date(event.date).toLocaleDateString()}<br>
                        <small class="text-muted">${event.time || 'Time TBA'}</small>
                    </td>
                    <td>${event.location ? escapeHtml(event.location) : 'TBA'}</td>
                    <td>
                        <span class="badge ${event.category === 'today' ? 'bg-danger' : event.category === 'upcoming' ? 'bg-success' : 'bg-secondary'}">
                            ${event.category === 'today' ? 'Today' : event.category === 'upcoming' ? 'Upcoming' : 'Past'}
                        </span>
                        ${event.featured ? '<span class="badge bg-warning ms-1">Featured</span>' : ''}
                    </td>
                    <td>
                        <span class="badge bg-${statusBadgeClass} event-status-badge" data-id="${event._id}">
                            ${statusText}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="toggleEventStatus('${event._id}', '${event.status}')" title="Change Status">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-primary me-1" onclick="editEvent('${event._id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEvent('${event._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error filtering events:', error);
    }
}

// Toggle event status
window.toggleEventStatus = async (id, currentStatus) => {
    let newStatus = '';
    let confirmMessage = '';
    
    if (currentStatus === 'active') {
        newStatus = 'cancelled';
        confirmMessage = 'Are you sure you want to CANCEL this event?';
    } else if (currentStatus === 'cancelled') {
        newStatus = 'completed';
        confirmMessage = 'Mark this event as COMPLETED?';
    } else if (currentStatus === 'completed') {
        newStatus = 'active';
        confirmMessage = 'Reactivate this event?';
    }
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const getRes = await fetch(`${API_URL}/events/${id}`);
        const event = await getRes.json();
        
        event.status = newStatus;
        
        const res = await fetch(`${API_URL}/events/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(event)
        });
        
        if (res.ok) {
            alert(`Event ${newStatus === 'cancelled' ? 'cancelled' : newStatus === 'completed' ? 'marked as completed' : 'reactivated'} successfully!`);
            await filterEvents(currentEventFilter);
            await loadEventStats();
            await loadDashboard();
            
            // Trigger sync
            await fetch(`${API_URL}/events/sync`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } else {
            const error = await res.json();
            alert('Failed to update event status: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating event status:', error);
        alert('Error: ' + error.message);
    }
};

// Open event modal
window.openEventModal = () => {
    document.getElementById('eventId').value = '';
    document.getElementById('eventForm').reset();
    document.getElementById('eventModalTitle').innerText = 'Add New Event';
    
    const eventImagePreview = document.getElementById('eventImagePreview');
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
    
    // Set default time
    const eventTime = document.getElementById('eventTime');
    if (eventTime) {
        const now = new Date();
        eventTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    new bootstrap.Modal(document.getElementById('eventModal')).show();
};

// Edit event
window.editEvent = async (id) => {
    try {
        const res = await fetch(`${API_URL}/events/${id}`);
        const event = await res.json();
        
        document.getElementById('eventId').value = event._id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventTitleAs').value = event.titleAs || '';
        document.getElementById('eventDesc').value = event.description || '';
        document.getElementById('eventDescAs').value = event.descriptionAs || '';
        document.getElementById('eventDate').value = event.date ? event.date.split('T')[0] : '';
        document.getElementById('eventTime').value = event.time || '12:00';
        document.getElementById('eventEndTime').value = event.endTime || '';
        document.getElementById('eventLocation').value = event.location || '';
        document.getElementById('eventLocationAs').value = event.locationAs || '';
        document.getElementById('eventStatus').value = event.status || 'active';
        document.getElementById('eventFeatured').checked = event.featured || false;
        document.getElementById('eventModalTitle').innerText = 'Edit Event';
        
        const eventImagePreview = document.getElementById('eventImagePreview');
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
            await filterEvents(currentEventFilter);
            await loadDashboard();
            await loadEventStats();
        } else {
            alert('Failed to delete event');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Save event
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
            await filterEvents(currentEventFilter);
            await loadDashboard();
            await loadEventStats();
            
            // Trigger sync
            await fetch(`${API_URL}/events/sync`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } else {
            const error = await res.json();
            alert('Failed to save event: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving event:', error);
        alert('Error: ' + error.message);
    }
});

// Manual sync
window.manualSync = async () => {
    if (!confirm('Manually sync event categories? This will update all event statuses based on current date.')) return;
    
    try {
        const res = await fetch(`${API_URL}/events/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            alert(`Sync completed! Today: ${data.stats.today}, Upcoming: ${data.stats.upcoming}, Past: ${data.stats.past}`);
            
            await filterEvents(currentEventFilter);
            await loadEventStats();
            await loadDashboard();
        } else {
            alert('Sync failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

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
                <td>${escapeHtml(d.name || 'Anonymous')}</td>
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
        
        document.getElementById('settingWhatsapp').value = settings.whatsapp_number?.value || '';
        document.getElementById('settingEmail').value = settings.contact_email?.value || '';
        document.getElementById('settingPhone').value = settings.contact_phone?.value || '';
        document.getElementById('settingAboutEn').value = settings.about_content?.value || '';
        document.getElementById('settingAboutAs').value = settings.about_content_as?.value || '';
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

// Escape HTML helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
checkAuth();
