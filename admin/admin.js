// admin/admin.js
const API_URL = 'https://darandha-eidgah-committee.onrender.com/api';
let token = localStorage.getItem('adminToken');

// Check authentication
function checkAuth() {
  if (!token) {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('dashboardContent').style.display = 'none';
    return false;
  }
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboardContent').style.display = 'block';
  return true;
}

// Login handler
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
    if (res.ok) {
      token = data.token;
      localStorage.setItem('adminToken', token);
      checkAuth();
      loadDashboard();
      loadMembersTable();
      loadEventsTable();
      loadDonationsTable();
      loadSettings();
    } else {
      alert('Login failed: ' + data.error);
    }
  } catch (error) {
    alert('Login error');
  }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  token = null;
  checkAuth();
});

// Navigation
document.querySelectorAll('.sidebar .nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const section = link.getAttribute('data-section');
    document.getElementById('dashboardSection').style.display = section === 'dashboard' ? 'block' : 'none';
    document.getElementById('membersSection').style.display = section === 'members' ? 'block' : 'none';
    document.getElementById('eventsSection').style.display = section === 'events' ? 'block' : 'none';
    document.getElementById('donationsSection').style.display = section === 'donations' ? 'block' : 'none';
    document.getElementById('settingsSection').style.display = section === 'settings' ? 'block' : 'none';
    if (section === 'members') loadMembersTable();
    if (section === 'events') loadEventsTable();
    if (section === 'donations') loadDonationsTable();
    if (section === 'settings') loadSettings();
  });
});

// Dashboard stats
async function loadDashboard() {
  if (!token) return;
  const res = await fetch(`${API_URL}/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
  const stats = await res.json();
  document.getElementById('statMembers').innerText = stats.memberCount;
  document.getElementById('statEvents').innerText = stats.eventCount;
  document.getElementById('statDonations').innerHTML = `₹${stats.totalDonations}`;
}

// Members CRUD
async function loadMembersTable() {
  const res = await fetch(`${API_URL}/members`);
  const members = await res.json();
  const tbody = document.getElementById('membersTable');
  tbody.innerHTML = members.map(m => `
    <tr>
      <td>${m.name}</td><td>${m.nameAs || '-'}</td><td>${m.phone || '-'}</td><td>${m.role}</td>
      <td class="table-actions">
        <i class="fas fa-edit text-primary" onclick="editMember('${m._id}')"></i>
        <i class="fas fa-trash text-danger" onclick="deleteMember('${m._id}')"></i>
      </td>
    </tr>
  `).join('');
}

window.editMember = async (id) => {
  const res = await fetch(`${API_URL}/members`);
  const members = await res.json();
  const member = members.find(m => m._id === id);
  document.getElementById('memberId').value = member._id;
  document.getElementById('memberName').value = member.name;
  document.getElementById('memberNameAs').value = member.nameAs || '';
  document.getElementById('memberPhone').value = member.phone || '';
  document.getElementById('memberAddress').value = member.address || '';
  document.getElementById('memberRole').value = member.role;
  new bootstrap.Modal(document.getElementById('memberModal')).show();
};

window.deleteMember = async (id) => {
  if (confirm('Delete this member?')) {
    await fetch(`${API_URL}/members/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadMembersTable();
    loadDashboard();
  }
};

document.getElementById('memberForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('memberId').value;
  const data = {
    name: document.getElementById('memberName').value,
    nameAs: document.getElementById('memberNameAs').value,
    phone: document.getElementById('memberPhone').value,
    address: document.getElementById('memberAddress').value,
    role: document.getElementById('memberRole').value
  };
  const url = id ? `${API_URL}/members/${id}` : `${API_URL}/members`;
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(data) });
  bootstrap.Modal.getInstance(document.getElementById('memberModal')).hide();
  loadMembersTable();
  loadDashboard();
});

window.openMemberModal = () => {
  document.getElementById('memberForm').reset();
  document.getElementById('memberId').value = '';
};

// Events CRUD
async function loadEventsTable() {
  const res = await fetch(`${API_URL}/events`);
  const events = await res.json();
  const tbody = document.getElementById('eventsTable');
  tbody.innerHTML = events.map(e => `
    <tr>
      <td>${e.title}</td><td>${new Date(e.date).toLocaleDateString()}</td><td>${e.type}</td>
      <td class="table-actions">
        <i class="fas fa-edit text-primary" onclick="editEvent('${e._id}')"></i>
        <i class="fas fa-trash text-danger" onclick="deleteEvent('${e._id}')"></i>
      </td>
    </tr>
  `).join('');
}

window.editEvent = async (id) => {
  const res = await fetch(`${API_URL}/events`);
  const events = await res.json();
  const event = events.find(e => e._id === id);
  document.getElementById('eventId').value = event._id;
  document.getElementById('eventTitle').value = event.title;
  document.getElementById('eventTitleAs').value = event.titleAs || '';
  document.getElementById('eventDesc').value = event.description || '';
  document.getElementById('eventDescAs').value = event.descriptionAs || '';
  document.getElementById('eventDate').value = event.date ? event.date.split('T')[0] : '';
  new bootstrap.Modal(document.getElementById('eventModal')).show();
};

window.deleteEvent = async (id) => {
  if (confirm('Delete this event?')) {
    await fetch(`${API_URL}/events/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadEventsTable();
    loadDashboard();
  }
};

document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('eventId').value;
  const formData = new FormData();
  const data = {
    title: document.getElementById('eventTitle').value,
    titleAs: document.getElementById('eventTitleAs').value,
    description: document.getElementById('eventDesc').value,
    descriptionAs: document.getElementById('eventDescAs').value,
    date: document.getElementById('eventDate').value,
    type: 'event'
  };
  formData.append('data', JSON.stringify(data));
  const imageFile = document.getElementById('eventImage').files[0];
  if (imageFile) formData.append('image', imageFile);
  
  const url = id ? `${API_URL}/events/${id}` : `${API_URL}/events`;
  const method = id ? 'PUT' : 'POST';
  await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
  bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
  loadEventsTable();
  loadDashboard();
});

window.openEventModal = () => {
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
};

// Donations
async function loadDonationsTable() {
  const res = await fetch(`${API_URL}/donations`, { headers: { 'Authorization': `Bearer ${token}` } });
  const donations = await res.json();
  const tbody = document.getElementById('donationsTable');
  tbody.innerHTML = donations.map(d => `
    <tr>
      <td>${d.name}</td><td>₹${d.amount}</td><td>${d.transactionId || '-'}</td><td>${new Date(d.date).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

// Settings
async function loadSettings() {
  const res = await fetch(`${API_URL}/settings`);
  const settings = await res.json();
  document.getElementById('settingWhatsapp').value = settings.whatsapp_number?.value || '';
  document.getElementById('settingEmail').value = settings.contact_email?.value || '';
  document.getElementById('settingPhone').value = settings.contact_phone?.value || '';
  document.getElementById('settingAboutEn').value = settings.about_content?.value || '';
  document.getElementById('settingAboutAs').value = settings.about_content_as?.value || '';
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const updates = [
    { key: 'whatsapp_number', value: document.getElementById('settingWhatsapp').value },
    { key: 'contact_email', value: document.getElementById('settingEmail').value },
    { key: 'contact_phone', value: document.getElementById('settingPhone').value },
    { key: 'about_content', value: document.getElementById('settingAboutEn').value, valueAs: document.getElementById('settingAboutAs').value },
    { key: 'about_content_as', value: document.getElementById('settingAboutAs').value }
  ];
  for (const up of updates) {
    await fetch(`${API_URL}/settings/${up.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ value: up.value, valueAs: up.valueAs })
    });
  }
  alert('Settings saved!');
});

// Initial load
checkAuth();
if (token) {
  loadDashboard();
  loadMembersTable();
  loadEventsTable();
  loadDonationsTable();
  loadSettings();
}
