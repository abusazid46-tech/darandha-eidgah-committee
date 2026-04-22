// admin/admin.js
const API_URL = 'http://localhost:5000/api';
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
