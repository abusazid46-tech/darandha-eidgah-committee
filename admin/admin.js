// admin/admin.js (Updated - Fix House Number Display)
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let token = localStorage.getItem('adminToken');
let autoRefreshInterval = null;
let selectedMembers = new Set();
// admin/admin.js - Update dignitaryRoles to match
const dignitaryRoles = ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Cashier', 'Adviser'];
// DOM Elements
let currentSection = 'dashboard';
let currentEventImage = null;
let currentEventFilter = 'all';

// Helper functions for address handling
function parseAddress(address) {
    if (!address) return { houseNumber: '', fullAddress: '' };
    // Check if address has comma separator
    const firstCommaIndex = address.indexOf(',');
    if (firstCommaIndex === -1) {
        // No comma - treat whole as house number or full address
        return { houseNumber: address, fullAddress: '' };
    }
    const houseNumber = address.substring(0, firstCommaIndex).trim();
    const fullAddress = address.substring(firstCommaIndex + 1).trim();
    return { houseNumber, fullAddress };
}

function combineAddress(houseNumber, fullAddress) {
    if (!houseNumber && !fullAddress) return '';
    if (!houseNumber) return fullAddress;
    if (!fullAddress) return houseNumber;
    return `${houseNumber}, ${fullAddress}`;
}

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
        } else if (currentSection === 'donations') {
            loadDonations();
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
    document.getElementById('dashboardSection').style.display = 'block';
    loadDashboard();
    loadMembers();
    filterEvents('all');
    loadDonations();
    loadSettings();
    loadUpiSettings();
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
        if (section === 'settings') {
            loadSettings();
            loadUpiSettings();
        }
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

function animateValue(element) {
    if (!element) return;
    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
        if (element) element.style.transform = 'scale(1)';
    }, 200);
}

// ========== MEMBERS MANAGEMENT WITH PROPER HOUSE NUMBER DISPLAY ==========

async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        const members = await res.json();
        const tbody = document.getElementById('membersTable');
        if (!tbody) return;
        
        tbody.innerHTML = members.map(m => {
            // Parse address to separate house number and full address
            const { houseNumber, fullAddress } = parseAddress(m.address || '');
            
            // Display house number with badge and full address separately
            let addressHtml = '';
            if (houseNumber) {
                addressHtml += `<span class="badge bg-info me-1"><i class="fas fa-home me-1"></i>${escapeHtml(houseNumber)}</span>`;
            }
            if (fullAddress) {
                addressHtml += `<span class="text-muted small">${escapeHtml(fullAddress)}</span>`;
            }
            if (!houseNumber && !fullAddress) {
                addressHtml = '-';
            }
            
            return `
                <tr>
                    <td><input type="checkbox" class="member-select" value="${m._id}" onclick="updateSelection()"></td>
                    <td>
                        <strong>${escapeHtml(m.name)}</strong>
                        ${m.nameAs ? `<br><small class="text-muted">${escapeHtml(m.nameAs)}</small>` : ''}
                    </td>
                    <td>${m.nameAs ? escapeHtml(m.nameAs) : '-'}</td>
                    <td>${m.phone || '-'}</td>
                    <td>${addressHtml}</td>
                    <td><span class="badge bg-success">${m.role || 'Member'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="editMember('${m._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMember('${m._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Clear selection after loading
        clearSelection();
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

function updateSelection() {
    const checkboxes = document.querySelectorAll('.member-select');
    selectedMembers.clear();
    checkboxes.forEach(cb => {
        if (cb.checked) selectedMembers.add(cb.value);
    });
    
    const selectedCount = document.getElementById('selectedCount');
    const bulkBar = document.getElementById('bulkActionsBar');
    
    if (selectedCount) selectedCount.innerText = selectedMembers.size;
    if (bulkBar) {
        if (selectedMembers.size > 0) {
            bulkBar.classList.add('show');
        } else {
            bulkBar.classList.remove('show');
        }
    }
    
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) {
        selectAll.checked = checkboxes.length > 0 && checkboxes.length === selectedMembers.size;
    }
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.member-select');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
    updateSelection();
}

function clearSelection() {
    const checkboxes = document.querySelectorAll('.member-select');
    checkboxes.forEach(cb => cb.checked = false);
    selectedMembers.clear();
    updateSelection();
}

async function bulkDeleteMembers() {
    if (selectedMembers.size === 0) {
        alert('Please select members to delete');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedMembers.size} selected members? This action cannot be undone.`)) return;
    
    const deletePromises = Array.from(selectedMembers).map(id =>
        fetch(`${API_URL}/members/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        })
    );
    
    try {
        const results = await Promise.all(deletePromises);
        const successCount = results.filter(r => r.ok).length;
        
        alert(`${successCount} members deleted successfully!`);
        loadMembers();
        loadDashboard();
        clearSelection();
    } catch (error) {
        alert('Error deleting members: ' + error.message);
    }
}

// CSV/Excel Import Functions
window.importMembersCSV = function() {
    new bootstrap.Modal(document.getElementById('importCSVModal')).show();
};

async function processImport() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput.files.length) {
        alert('Please select a file');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const data = e.target.result;
            let members = [];
            
            if (file.name.endsWith('.csv')) {
                // Parse CSV
                const lines = data.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = lines[i].split(',');
                    const member = {};
                    headers.forEach((h, idx) => {
                        member[h] = values[idx] ? values[idx].trim() : '';
                    });
                    
                    if (member.name) {
                        const address = combineAddress(member.housenumber || '', member.fulladdress || '');
                        members.push({
                            name: member.name,
                            nameAs: member.nameas || '',
                            phone: member.phone || '',
                            address: address,
                            role: member.role || 'Member'
                        });
                    }
                }
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                // Parse Excel using SheetJS
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);
                
                rows.forEach(row => {
                    const address = combineAddress(row.houseNumber || row.housenumber || '', row.fullAddress || row.fulladdress || '');
                    members.push({
                        name: row.name,
                        nameAs: row.nameAs || row.nameas || '',
                        phone: row.phone || '',
                        address: address,
                        role: row.role || 'Member'
                    });
                });
            }
            
            if (members.length === 0) {
                alert('No valid members found in file');
                return;
            }
            
            // Import members one by one
            let successCount = 0;
            for (const member of members) {
                try {
                    const res = await fetch(`${API_URL}/members`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(member)
                    });
                    if (res.ok) successCount++;
                } catch (err) {
                    console.error('Import error:', err);
                }
            }
            
            alert(`${successCount} out of ${members.length} members imported successfully!`);
            bootstrap.Modal.getInstance(document.getElementById('importCSVModal')).hide();
            fileInput.value = '';
            loadMembers();
            loadDashboard();
            
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing file: ' + error.message);
        }
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsBinaryString(file);
    } else {
        reader.readAsText(file);
    }
}

window.downloadSampleCSV = function() {
    const sampleData = [
        ['name', 'nameAs', 'phone', 'houseNumber', 'fullAddress', 'role'],
        ['Md. Abdul Rahman', 'মোঃ আব্দুল ৰহমান', '9876543210', 'H.No. 123', 'Main Road, Darandha, Dist- Morigaon, PIN-782001', 'President'],
        ['Smt. Ayesha Begum', 'শ্ৰীমতী আয়েশা বেগম', '9876543211', 'Flat 4B', 'Green Park, Darandha, PIN-782001', 'Secretary'],
        ['Md. Karim Uddin', 'মোঃ কৰিম উদ্দিন', '9876543212', 'House No. 45', 'Vill- Darandha, PO- Darandha, Dist- Morigaon', 'Member']
    ];
    
    let csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'member_template.csv';
    a.click();
    URL.revokeObjectURL(url);
};

// Open member modal
window.openMemberModal = function() {
    try {
        document.getElementById('memberId').value = '';
        document.getElementById('memberForm').reset();
        document.getElementById('memberModalTitle').innerText = 'Add New Member';
        
        // Clear house number and address fields
        const houseNumber = document.getElementById('memberHouseNumber');
        const fullAddress = document.getElementById('memberFullAddress');
        if (houseNumber) houseNumber.value = '';
        if (fullAddress) fullAddress.value = '';
        
        const modalElement = document.getElementById('memberModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Error opening member modal:', error);
    }
};

window.editMember = async function(id) {
    try {
        const res = await fetch(`${API_URL}/members/${id}`);
        const member = await res.json();
        
        const { houseNumber, fullAddress } = parseAddress(member.address || '');
        
        document.getElementById('memberId').value = member._id;
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberNameAs').value = member.nameAs || '';
        document.getElementById('memberPhone').value = member.phone || '';
        document.getElementById('memberHouseNumber').value = houseNumber;
        document.getElementById('memberFullAddress').value = fullAddress;
        document.getElementById('memberRole').value = member.role || 'Member';
        document.getElementById('memberModalTitle').innerText = 'Edit Member';
        
        const modalElement = document.getElementById('memberModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Error loading member:', error);
        alert('Error loading member: ' + error.message);
    }
};

window.deleteMember = async function(id) {
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
    
    const houseNumber = document.getElementById('memberHouseNumber')?.value || '';
    const fullAddress = document.getElementById('memberFullAddress')?.value || '';
    const combinedAddress = combineAddress(houseNumber, fullAddress);
    
    const data = {
        name: document.getElementById('memberName').value,
        nameAs: document.getElementById('memberNameAs')?.value || '',
        phone: document.getElementById('memberPhone').value,
        address: combinedAddress,
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
            const modalElement = document.getElementById('memberModal');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }
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

// ========== EVENTS MANAGEMENT ==========
window.filterEvents = async function(category) {
    currentEventFilter = category;
    
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
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4"><i class="fas fa-calendar-times fa-2x mb-2 d-block"></i>No ${category !== 'all' ? category : ''} events found</td></tr>`;
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
                <tr>
                    <td>${event.image ? `<img src="${API_URL.replace('/api', '')}${event.image}" width="50" height="50" style="object-fit:cover; border-radius:8px;">` : '<i class="fas fa-calendar fa-2x text-muted"></i>'}</td>
                    <td><strong>${escapeHtml(event.title)}</strong>${event.titleAs ? `<br><small class="text-muted">${escapeHtml(event.titleAs)}</small>` : ''}</td>
                    <td>${new Date(event.date).toLocaleDateString()}<br><small>${event.time || 'TBA'}</small></td>
                    <td>${event.location ? escapeHtml(event.location) : 'TBA'}</td>
                    <td><span class="badge ${event.category === 'today' ? 'bg-danger' : event.category === 'upcoming' ? 'bg-success' : 'bg-secondary'}">${event.category}</span></td>
                    <td><span class="badge bg-${statusBadgeClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="toggleEventStatus('${event._id}', '${event.status}')" title="Change Status"><i class="fas fa-sync-alt"></i></button>
                        <button class="btn btn-sm btn-primary me-1" onclick="editEvent('${event._id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEvent('${event._id}')" title="Delete"><i class="fas fa-trash"></i></button>
                      </td>
                </table>
            `;
        }).join('');
    } catch (error) {
        console.error('Error filtering events:', error);
    }
};

window.toggleEventStatus = async function(id, currentStatus) {
    let newStatus = '';
    let confirmMessage = '';
    
    if (currentStatus === 'active') {
        newStatus = 'cancelled';
        confirmMessage = 'Cancel this event?';
    } else if (currentStatus === 'cancelled') {
        newStatus = 'completed';
        confirmMessage = 'Mark this event as completed?';
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(event)
        });
        
        if (res.ok) {
            alert(`Event ${newStatus} successfully!`);
            await filterEvents(currentEventFilter);
            await loadEventStats();
            await loadDashboard();
            await fetch(`${API_URL}/events/sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.openEventModal = function() {
    document.getElementById('eventId').value = '';
    document.getElementById('eventForm').reset();
    document.getElementById('eventModalTitle').innerText = 'Add New Event';
    const eventImagePreview = document.getElementById('eventImagePreview');
    if (eventImagePreview) {
        eventImagePreview.innerHTML = '';
        eventImagePreview.style.display = 'none';
    }
    const eventDate = document.getElementById('eventDate');
    if (eventDate) eventDate.value = new Date().toISOString().split('T')[0];
    new bootstrap.Modal(document.getElementById('eventModal')).show();
};

window.editEvent = async function(id) {
    try {
        const res = await fetch(`${API_URL}/events/${id}`);
        const event = await res.json();
        
        document.getElementById('eventId').value = event._id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventTitleAs').value = event.titleAs || '';
        document.getElementById('eventDesc').value = event.description || '';
        document.getElementById('eventDescAs').value = event.descriptionAs || '';
        document.getElementById('eventDate').value = event.date ? event.date.split('T')[0] : '';
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventEndTime').value = event.endTime || '';
        document.getElementById('eventLocation').value = event.location || '';
        document.getElementById('eventLocationAs').value = event.locationAs || '';
        document.getElementById('eventStatus').value = event.status || 'active';
        document.getElementById('eventFeatured').checked = event.featured || false;
        document.getElementById('eventModalTitle').innerText = 'Edit Event';
        
        const preview = document.getElementById('eventImagePreview');
        if (event.image && preview) {
            preview.innerHTML = `<div class="text-center"><img src="${API_URL.replace('/api', '')}${event.image}" style="max-width:200px; border-radius:8px;"><br><button class="btn btn-sm btn-danger mt-2" onclick="removeEventImage()">Remove</button></div>`;
            preview.style.display = 'block';
        }
        new bootstrap.Modal(document.getElementById('eventModal')).show();
    } catch (error) {
        alert('Error loading event');
    }
};

window.removeEventImage = function() {
    const preview = document.getElementById('eventImagePreview');
    if (preview) {
        preview.innerHTML = '';
        preview.style.display = 'none';
    }
    document.getElementById('eventImage').value = '';
};

window.deleteEvent = async function(id) {
    if (!confirm('Delete this event?')) return;
    try {
        const res = await fetch(`${API_URL}/events/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            alert('Event deleted');
            await filterEvents(currentEventFilter);
            await loadDashboard();
            await loadEventStats();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

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
    if (imageFile) formData.append('image', imageFile);
    
    try {
        const url = id ? `${API_URL}/events/${id}` : `${API_URL}/events`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
        if (res.ok) {
            alert(id ? 'Event updated' : 'Event added');
            bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
            await filterEvents(currentEventFilter);
            await loadDashboard();
            await loadEventStats();
            await fetch(`${API_URL}/events/sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

window.manualSync = async function() {
    if (!confirm('Sync event categories? This will update all event statuses based on current date.')) return;
    try {
        const res = await fetch(`${API_URL}/events/sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        alert(`Sync complete! Today: ${data.stats.today}, Upcoming: ${data.stats.upcoming}, Past: ${data.stats.past}`);
        await filterEvents(currentEventFilter);
        await loadEventStats();
        await loadDashboard();
    } catch (error) {
        alert('Sync failed');
    }
};

// ========== DONATIONS MANAGEMENT ==========
async function loadDonations() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/donations`, { headers: { 'Authorization': `Bearer ${token}` } });
        const donations = await res.json();
        const tbody = document.getElementById('donationsTable');
        if (!tbody) return;
        
        if (donations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No donations yet</td></tr>`;
            return;
        }
        
        tbody.innerHTML = donations.map(d => `
            <tr>
                <td>${escapeHtml(d.name || 'Anonymous')}</td>
                <td>₹${d.amount || 0}</td>
                <td>${d.transactionId || '-'}</td>
                <td>${new Date(d.date).toLocaleDateString()}</td>
                <td><span class="badge ${d.status === 'approved' ? 'bg-success' : d.status === 'pending' ? 'bg-warning' : 'bg-danger'}">${d.status || 'pending'}</span></td>
                <td>${d.status === 'pending' ? `<button class="btn btn-sm btn-success me-1" onclick="approveDonation('${d._id}')">Approve</button><button class="btn btn-sm btn-danger" onclick="rejectDonation('${d._id}')">Reject</button>` : (d.status === 'approved' ? '<i class="fas fa-check-circle text-success"></i> Approved' : '<i class="fas fa-times-circle text-danger"></i> Rejected')}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading donations:', error);
    }
}

window.approveDonation = async function(id) {
    if (!confirm('Approve this donation?')) return;
    try {
        const res = await fetch(`${API_URL}/donations/${id}/approve`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            alert('Donation approved! It will now appear in public stats.');
            loadDonations();
            loadDashboard();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

window.rejectDonation = async function(id) {
    if (!confirm('Reject this donation?')) return;
    try {
        const res = await fetch(`${API_URL}/donations/${id}/reject`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            alert('Donation rejected!');
            loadDonations();
            loadDashboard();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

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

async function loadUpiSettings() {
    try {
        const res = await fetch(`${API_URL}/settings`);
        const settings = await res.json();
        document.getElementById('settingUpiId').value = settings.upi_id?.value || 'committee@bank';
        document.getElementById('settingQrUrl').value = settings.qr_url?.value || '';
        document.getElementById('settingBankName').value = settings.bank_name?.value || '';
        document.getElementById('settingBankAccount').value = settings.bank_account?.value || '';
        document.getElementById('settingIfsc').value = settings.ifsc_code?.value || '';
        document.getElementById('settingDonationGoal').value = settings.donation_goal?.value || '500000';
    } catch (error) {
        console.error('Error loading UPI settings:', error);
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
            await fetch(`${API_URL}/settings/${up.key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ value: up.value }) });
        }
        alert('Contact settings saved!');
    } catch (error) {
        alert('Error saving settings: ' + error.message);
    }
});

document.getElementById('upiSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!token) return;
    const updates = [
        { key: 'upi_id', value: document.getElementById('settingUpiId')?.value || 'committee@bank' },
        { key: 'qr_url', value: document.getElementById('settingQrUrl')?.value || '' },
        { key: 'bank_name', value: document.getElementById('settingBankName')?.value || '' },
        { key: 'bank_account', value: document.getElementById('settingBankAccount')?.value || '' },
        { key: 'ifsc_code', value: document.getElementById('settingIfsc')?.value || '' },
        { key: 'donation_goal', value: document.getElementById('settingDonationGoal')?.value || '500000' }
    ];
    try {
        for (const up of updates) {
            await fetch(`${API_URL}/settings/${up.key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ value: up.value }) });
        }
        alert('UPI settings saved! QR code will update on frontend.');
    } catch (error) {
        alert('Error saving UPI settings: ' + error.message);
    }
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.bulkDeleteMembers = bulkDeleteMembers;
window.toggleSelectAll = toggleSelectAll;
window.clearSelection = clearSelection;
window.processImport = processImport;
window.downloadSampleCSV = downloadSampleCSV;

// Initialize
checkAuth();
