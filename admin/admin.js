// admin/admin.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let token = localStorage.getItem('adminToken');

// DOM Elements
let currentSection = 'dashboard';

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
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardContent').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';
    loadDashboard();
    loadMembers();
    loadEvents();
    loadDonations();
    loadSettings();
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
        
        document.getElementById('dashboardSection').style.display = section === 'dashboard' ? 'block' : 'none';
        document.getElementById('membersSection').style.display = section === 'members' ? 'block' : 'none';
        document.getElementById('eventsSection').style.display = section === 'events' ? 'block' : 'none';
        document.getElementById('donationsSection').style.display = section === 'donations' ? 'block' : 'none';
        document.getElementById('settingsSection').style.display = section === 'settings' ? 'block' : 'none';
        
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
        document.getElementById('statMembers').innerText = stats.memberCount || 0;
        document.getElementById('statEvents').innerText = stats.eventCount || 0;
        document.getElementById('statDonations').innerHTML = `₹${stats.totalDonations || 0}`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Members
async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();
        const tbody = document.getElementById('membersTable');
        tbody.innerHTML = members.map(m => `
            <tr>
                <td>${m.name}</td>
                <td>${m.phone || '-'}</td>
                <td>${m.role || 'Member'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editMember('${m._id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMember('${m._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

window.openMemberModal = () => {
    document.getElementById('memberId').value = '';
    document.getElementById('memberForm').reset();
    new bootstrap.Modal(document.getElementById('memberModal')).show();
};

window.editMember = async (id) => {
    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();
        const member = members.find(m => m._id === id);
        
        document.getElementById('memberId').value = member._id;
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberPhone').value = member.phone || '';
        document.getElementById('memberRole').value = member.role || 'Member';
        
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
        phone: document.getElementById('memberPhone').value,
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

// Events
async function loadEvents() {
    try {
        const res = await fetch(`${API_URL}/events`);
        const events = await res.json();
        const tbody = document.getElementById('eventsTable');
        tbody.innerHTML = events.map(e => `
            <tr>
                <td>${e.title}</td>
                <td>${e.date ? new Date(e.date).toLocaleDateString() : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editEvent('${e._id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEvent('${e._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

window.openEventModal = () => {
    document.getElementById('eventId').value = '';
    document.getElementById('eventForm').reset();
    new bootstrap.Modal(document.getElementById('eventModal')).show();
};

window.editEvent = async (id) => {
    try {
        const res = await fetch(`${API_URL}/events`);
        const events = await res.json();
        const event = events.find(e => e._id === id);
        
        document.getElementById('eventId').value = event._id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDesc').value = event.description || '';
        document.getElementById('eventDate').value = event.date ? event.date.split('T')[0] : '';
        
        new bootstrap.Modal(document.getElementById('eventModal')).show();
    } catch (error) {
        alert('Error loading event');
    }
};

window.deleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
        const res = await fetch(`${API_URL}/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            alert('Event deleted successfully');
            loadEvents();
            loadDashboard();
        } else {
            alert('Failed to delete event');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('eventId').value;
    const data = {
        title: document.getElementById('eventTitle').value,
        description: document.getElementById('eventDesc').value,
        date: document.getElementById('eventDate').value
    };
    
    try {
        const url = id ? `${API_URL}/events/${id}` : `${API_URL}/events`;
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
            alert(id ? 'Event updated successfully' : 'Event added successfully');
            bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
            loadEvents();
            loadDashboard();
        } else {
            const error = await res.json();
            alert('Failed to save event: ' + error.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Donations
async function loadDonations() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/donations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const donations = await res.json();
        const tbody = document.getElementById('donationsTable');
        tbody.innerHTML = donations.map(d => `
            <tr>
                <td>${d.name || 'Anonymous'}</td>
                <td>₹${d.amount || 0}</td>
                <td>${d.transactionId || '-'}</td>
                <td>${new Date(d.date).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading donations:', error);
    }
}

// Settings
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
        { key: 'whatsapp_number', value: document.getElementById('settingWhatsapp').value },
        { key: 'contact_email', value: document.getElementById('settingEmail').value },
        { key: 'contact_phone', value: document.getElementById('settingPhone').value },
        { key: 'about_content', value: document.getElementById('settingAboutEn').value },
        { key: 'about_content_as', value: document.getElementById('settingAboutAs').value }
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
