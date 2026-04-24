// frontend/script.js - Enhanced Member Functions

let currentAreaFilter = 'all';
let currentSearchTerm = '';
let currentViewMode = 'dignitaries'; // 'dignitaries' or 'all'
let allMembers = [];
let uniqueAreas = [];

// Dignitary roles (committee heads and leadership positions)
const dignitaryRoles = ['Committee Head', 'Secretary', 'Treasurer', 'Vice President', 'President', 'Chairman', 'General Secretary'];

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
  
  let options = `<option value="all">🌍 <span data-en="All Areas" data-as="সকলো এলাকা">All Areas</span> (${allCount})</option>`;
  
  uniqueAreas.forEach(area => {
    const count = allMembers.filter(m => m.address && m.address.split(',')[0].trim() === area).length;
    options += `<option value="${escapeHtml(area)}">📍 ${escapeHtml(area)} (${count})</option>`;
  });
  
  select.innerHTML = options;
  
  // Set current value
  select.value = currentAreaFilter;
}

// Apply all filters
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
  
  // Apply view mode filter
  if (currentViewMode === 'dignitaries') {
    filteredMembers = filteredMembers.filter(member => 
      dignitaryRoles.includes(member.role)
    );
  }
  
  displayMembersAsList(filteredMembers);
  updateResultCount(filteredMembers.length);
}

// Display members as decorated list
function displayMembersAsList(members) {
  const container = document.getElementById('membersListContainer');
  
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
  
  // Group members by role for better organization
  const dignitaries = members.filter(m => dignitaryRoles.includes(m.role));
  const regularMembers = members.filter(m => !dignitaryRoles.includes(m.role));
  
  let html = '';
  
  // Display Dignitaries section
  if (dignitaries.length > 0 && currentViewMode === 'all') {
    html += `
      <div class="mb-4">
        <h4 class="border-bottom border-success pb-2 mb-3">
          <i class="fas fa-crown text-warning me-2"></i>
          <span data-en="Committee Leaders" data-as="সমিতিৰ নেতৃবৃন্দ">Committee Leaders</span>
          <span class="badge bg-success ms-2">${dignitaries.length}</span>
        </h4>
        <div class="row">
          ${dignitaries.map(member => createMemberCard(member)).join('')}
        </div>
      </div>
    `;
  }
  
  // Display Regular Members section
  if (regularMembers.length > 0) {
    if (currentViewMode === 'dignitaries') {
      // Show dignitaries in list view
      html += `
        <div class="members-decorated-list">
          ${members.map(member => createMemberListItem(member)).join('')}
        </div>
      `;
    } else {
      html += `
        <div>
          <h4 class="border-bottom border-success pb-2 mb-3">
            <i class="fas fa-users text-success me-2"></i>
            <span data-en="Community Members" data-as="সম্প্ৰদায়ৰ সদস্য">Community Members</span>
            <span class="badge bg-success ms-2">${regularMembers.length}</span>
          </h4>
          <div class="row">
            ${regularMembers.map(member => createMemberCard(member)).join('')}
          </div>
        </div>
      `;
    }
  }
  
  // For dignitaries only view, use list view
  if (currentViewMode === 'dignitaries') {
    html = `
      <div class="members-decorated-list">
        ${members.map(member => createMemberListItem(member)).join('')}
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Update language for dynamically added content
  if (currentLanguage === 'as') {
    document.querySelectorAll('[data-en]').forEach(el => {
      if (el.getAttribute('data-as')) {
        el.innerText = el.getAttribute('data-as');
      }
    });
  }
}

// Create member card (grid view)
function createMemberCard(member) {
  const roleClass = dignitaryRoles.includes(member.role) ? 'border-warning' : 'border-success';
  const roleIcon = dignitaryRoles.includes(member.role) ? 'fa-crown text-warning' : 'fa-user-circle text-success';
  
  return `
    <div class="col-md-6 col-lg-4 mb-3">
      <div class="member-card border-start border-3 ${roleClass} shadow-sm">
        <div class="d-flex align-items-start">
          <div class="flex-shrink-0">
            <i class="fas ${roleIcon} fa-3x me-3"></i>
          </div>
          <div class="flex-grow-1">
            <h5 class="mb-1">${escapeHtml(member.name)}</h5>
            ${member.nameAs ? `<p class="text-muted small mb-1">${escapeHtml(member.nameAs)}</p>` : ''}
            <span class="badge ${dignitaryRoles.includes(member.role) ? 'bg-warning text-dark' : 'bg-success'} mb-2">
              <i class="fas ${dignitaryRoles.includes(member.role) ? 'fa-crown' : 'fa-user'} me-1"></i> ${member.role || 'Member'}
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
  const roleIcon = dignitaryRoles.includes(member.role) ? 'fa-crown text-warning' : 'fa-user-circle text-success';
  
  return `
    <div class="member-list-item p-3 mb-2 bg-white rounded-3 shadow-sm border-start border-3 ${dignitaryRoles.includes(member.role) ? 'border-warning' : 'border-success'}">
      <div class="d-flex align-items-center flex-wrap flex-md-nowrap">
        <div class="member-avatar me-3">
          <i class="fas ${roleIcon} fa-2x"></i>
        </div>
        <div class="member-info flex-grow-1">
          <div class="d-flex align-items-center flex-wrap gap-2">
            <h5 class="mb-0">${escapeHtml(member.name)}</h5>
            ${member.nameAs ? `<small class="text-muted">(${escapeHtml(member.nameAs)})</small>` : ''}
            <span class="badge ${dignitaryRoles.includes(member.role) ? 'bg-warning text-dark' : 'bg-success'}">
              ${member.role || 'Member'}
            </span>
          </div>
          <div class="member-details mt-2">
            ${member.phone ? `<span class="me-3"><i class="fas fa-phone text-success me-1"></i> ${member.phone}</span>` : ''}
            ${member.address ? `<span><i class="fas fa-map-marker-alt text-danger me-1"></i> ${escapeHtml(member.address)}</span>` : ''}
          </div>
        </div>
        <div class="member-badge ms-2">
          ${dignitaryRoles.includes(member.role) ? '<i class="fas fa-crown fa-lg text-warning" title="Committee Leader"></i>' : ''}
        </div>
      </div>
    </div>
  `;
}

// Update result count display
function updateResultCount(count) {
  const resultCountEl = document.getElementById('resultCount');
  if (resultCountEl) {
    if (currentLanguage === 'en') {
      let viewText = currentViewMode === 'dignitaries' ? 'leaders' : 'members';
      resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> Showing ${count} ${viewText}${count !== 1 ? '' : ''}`;
    } else {
      resultCountEl.innerHTML = `<i class="fas fa-users me-1"></i> ${count} জন সদস্য দেখুওৱা হৈছে`;
    }
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

// Search input event listener
const memberSearch = document.getElementById('memberSearch');
if (memberSearch) {
  memberSearch.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.toLowerCase();
    applyFilters();
  });
}

// Area filter change event listener
const areaFilterSelect = document.getElementById('areaFilterSelect');
if (areaFilterSelect) {
  areaFilterSelect.addEventListener('change', filterByArea);
}

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
    background: var(--islamic-green);
    border-radius: 10px;
  }
  
  .member-list-item {
    transition: all 0.3s ease;
    cursor: pointer;
  }
  
  .member-list-item:hover {
    transform: translateX(5px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  }
  
  .member-avatar i {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .member-details {
    font-size: 0.85rem;
    color: #6c757d;
  }
  
  .member-card {
    transition: all 0.3s ease;
    background: white;
    border-radius: 12px;
  }
  
  .member-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  }
`;
document.head.appendChild(style);
