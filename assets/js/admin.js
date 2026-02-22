// Configuration
const API_BASE = "https://backend-mcn-ltd.onrender.com";
let adminToken = localStorage.getItem('adminToken');
let adminRefreshToken = localStorage.getItem('adminRefreshToken');
let adminData = null;

// URL encoding helper for officer IDs
function encodeOfficerId(officerId) {
    // URL encode officer IDs to handle special characters like /
    return encodeURIComponent(officerId);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

class AdminApp {
  constructor() {
    this.token = adminToken;
    this.refreshToken = adminRefreshToken;
    this.currentTab = 'dashboardTab';
    this.adminData = adminData;
  }

  initialize() {
    this.setupEventListeners();
    this.checkAuth();
  }

  checkAuth() {
    if (this.token) {
      this.validateToken()
        .then(isValid => {
          if (isValid) {
            showSection('dashboardSection');
            this.loadDashboard();
          } else {
            this.logout();
            showSection('loginSection');
          }
        })
        .catch(() => {
          this.logout();
          showSection('loginSection');
        });
    } else {
      showSection('loginSection');
    }
  }

  async validateToken() {
    try {
      const response = await fetch(`${API_BASE}/admin/profile`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${API_BASE}/admin/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.refreshToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      this.token = data.access_token;
      adminToken = this.token;
      localStorage.setItem('adminToken', this.token);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async makeRequest(url, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
    };

    const requestOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      let response = await fetch(url, requestOptions);

      // If token expired, try to refresh and retry
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          requestOptions.headers.Authorization = `Bearer ${this.token}`;
          response = await fetch(url, requestOptions);
        } else {
          this.logout();
          throw new Error('Session expired. Please login again.');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    
    // Signup form
    document.getElementById('signupForm')?.addEventListener('submit', (e) => this.handleSignup(e));
    
    // OTP form
    document.getElementById('otpForm')?.addEventListener('submit', (e) => this.handleOtpVerification(e));
    
    // Navigation links
    document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('loginSection');
    });
    
    document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('signupSection');
    });
    
    document.getElementById('showForgotPasswordLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showForgotPassword();
    });
    
    document.getElementById('otpBackToLogin')?.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('loginSection');
    });
    
    document.getElementById('resendOtp')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.resendOtp();
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Search functionality with Enter key support
    const searchInputs = ['searchApplicants', 'searchOfficers', 'searchExistingOfficers', 'searchAdmins'];
    searchInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') {
            const tableType = id.replace('search', '').toLowerCase();
            this.searchTable(tableType);
          }
        });
      }
    });

    // Filter change listeners
    document.getElementById('statusFilter')?.addEventListener('change', () => {
      this.loadExistingOfficers();
    });
  }

  showForgotPassword() {
    const email = prompt("Enter your admin email to reset password:");
    if (email) {
      this.requestPasswordReset(email);
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    showLoader();
    
    const email = document.getElementById('login_email').value.trim();
    const password = document.getElementById('login_password').value;
    
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }
      
      const data = await response.json();
      
      if (data.requires_otp || data.status === 'success') {
        localStorage.setItem('pendingAdminEmail', email);
        localStorage.setItem('pendingOtpPurpose', 'admin_login');
        showSection('otpSection');
        showToast('OTP sent to your email');
      }
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    showLoader();
    
    const full_name = document.getElementById('signup_fullname').value.trim();
    const email = document.getElementById('signup_email').value.trim();
    const password = document.getElementById('signup_password').value;
    
    try {
      const response = await fetch(`${API_BASE}/admin/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ full_name, email, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Signup failed');
      }
      
      const data = await response.json();
      
      if (data.id) {
        localStorage.setItem('pendingAdminEmail', email);
        localStorage.setItem('pendingOtpPurpose', 'admin_signup');
        showSection('otpSection');
        showToast('Account created! Please verify with OTP sent to your email');
      }
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  async handleOtpVerification(e) {
    e.preventDefault();
    showLoader();
    
    const otp = document.getElementById('otp_code').value;
    const email = localStorage.getItem('pendingAdminEmail');
    const purpose = localStorage.getItem('pendingOtpPurpose') || 'admin_login';
    
    try {
      const response = await fetch(`${API_BASE}/admin/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: email, 
          code: otp,
          purpose: purpose 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid OTP');
      }
      
      const data = await response.json();
      
      if (data.access_token) {
        this.token = data.access_token;
        this.refreshToken = data.refresh_token;
        this.adminData = data.admin;
        
        adminToken = this.token;
        adminRefreshToken = this.refreshToken;
        adminData = this.adminData;
        
        localStorage.setItem('adminToken', this.token);
        localStorage.setItem('adminRefreshToken', this.refreshToken);
        localStorage.removeItem('pendingAdminEmail');
        localStorage.removeItem('pendingOtpPurpose');
        
        showSection('dashboardSection');
        this.loadDashboard();
        showToast('Login successful!');
      }
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  async resendOtp() {
    showLoader();
    
    const email = localStorage.getItem('pendingAdminEmail');
    const purpose = localStorage.getItem('pendingOtpPurpose');
    
    if (!email || !purpose) {
      showToast('No pending OTP request found', false);
      hideLoader();
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/admin/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, purpose })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to resend OTP');
      }
      
      showToast('New OTP sent to your email');
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  async requestPasswordReset(email) {
    showLoader();
    
    try {
      const response = await fetch(`${API_BASE}/admin/reset-password/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to request password reset');
      }
      
      localStorage.setItem('pendingAdminEmail', email);
      localStorage.setItem('pendingOtpPurpose', 'password_reset');
      showSection('otpSection');
      showToast('Password reset OTP sent to your email');
      
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  async loadDashboard() {
    if (!this.token) {
      showSection('loginSection');
      return;
    }
    
    showLoader();
    
    try {
      const stats = await this.makeRequest(`${API_BASE}/admin/dashboard`);
      
      // Update dashboard stats
      if (stats.dashboard) {
        document.getElementById('totalApplicants').textContent = stats.dashboard.total_applicants || 0;
        document.getElementById('totalOfficers').textContent = stats.dashboard.total_officers || 0;
        document.getElementById('totalExistingOfficers').textContent = stats.dashboard.total_existing_officers || 0;
        document.getElementById('pendingApprovals').textContent = stats.dashboard.pending_approvals || 0;
        
        // Also load pending officers count if available
        try {
          const pendingOfficersResponse = await this.makeRequest(`${API_BASE}/admin/existing-officers/pending?limit=100`);
          const pendingCount = pendingOfficersResponse?.length || 0;
          document.getElementById('pendingApprovals').textContent = pendingCount;
        } catch (error) {
          // Silently fail, use dashboard value
          console.log('Could not load pending officers count:', error.message);
        }
      }
      
      // Update admin info in header if needed
      if (stats.admin) {
        this.adminData = stats.admin;
      }
      
      showToast('Dashboard loaded successfully');
      
    } catch (error) {
      console.error('Dashboard load error:', error);
      if (error.message.includes('Session expired') || error.message.includes('401')) {
        this.logout();
        showToast('Session expired. Please login again.', false);
      } else {
        showToast('Failed to load dashboard', false);
      }
    } finally {
      hideLoader();
    }
  }

  async loadExistingOfficers() {
    try {
      showLoader();
      
      const status = document.getElementById('statusFilter').value;
      let url = `${API_BASE}/admin/existing-officers`;
      
      // Add query parameters
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('skip', '0');
      params.append('limit', '100');
      
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      const officers = await this.makeRequest(url);
      this.renderExistingOfficers(officers);
      
    } catch (error) {
      console.error('Error loading existing officers:', error);
      showToast(`Error: ${error.message}`, false);
      
      const tbody = document.getElementById('existingOfficersTableBody');
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <h3>Error Loading Officers</h3>
            <p>${error.message}</p>
            <button class="btn" onclick="adminApp.loadExistingOfficers()" style="margin-top: 1rem;">Retry</button>
          </td>
        </tr>
      `;
    } finally {
      hideLoader();
    }
  }

  renderExistingOfficers(officers) {
    const tbody = document.getElementById('existingOfficersTableBody');
    
    if (!Array.isArray(officers) || officers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <h3>No existing officers found</h3>
            <p>No existing officers have registered yet</p>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = officers.map(officer => {
      const statusClass = {
        'approved': 'status-approved',
        'verified': 'status-verified',
        'rejected': 'status-rejected',
        'pending': 'status-pending'
      }[officer.status] || 'status-pending';
      
      // Create dropdown menu for actions
      const actionsHtml = this.createOfficerActionMenu(officer);
      
      return `
        <tr data-officer-id="${officer.officer_id}">
          <td><span class="officer-id">${officer.officer_id || 'N/A'}</span></td>
          <td>${officer.full_name || 'N/A'}</td>
          <td>${officer.email || 'N/A'}</td>
          <td>${officer.rank || 'N/A'}</td>
          <td>${officer.position || 'N/A'}</td>
          <td>
            <span class="status-badge ${statusClass}">
              ${officer.status || 'pending'}
            </span>
          </td>
          <td>
            ${actionsHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  createOfficerActionMenu(officer) {
    const baseActions = `
      <button class="action-btn view" onclick="adminApp.viewExistingOfficer('${encodeURIComponent(officer.officer_id)}')">
        <i class="fas fa-eye"></i> View
      </button>
    `;
    
    let statusActions = '';
    
    if (officer.status === 'pending') {
      statusActions = `
        <button class="action-btn verify" onclick="adminApp.showStatusModal('${encodeURIComponent(officer.officer_id)}', 'verified')">
          <i class="fas fa-check-circle"></i> Verify
        </button>
        <button class="action-btn approve" onclick="adminApp.showStatusModal('${encodeURIComponent(officer.officer_id)}', 'approved')">
          <i class="fas fa-thumbs-up"></i> Approve
        </button>
        <button class="action-btn reject" onclick="adminApp.showStatusModal('${encodeURIComponent(officer.officer_id)}', 'rejected')">
          <i class="fas fa-thumbs-down"></i> Reject
        </button>
      `;
    } else if (officer.status === 'verified') {
      statusActions = `
        <button class="action-btn approve" onclick="adminApp.showStatusModal('${encodeURIComponent(officer.officer_id)}', 'approved')">
          <i class="fas fa-thumbs-up"></i> Approve
        </button>
      `;
    }
    
    const statusUpdateBtn = `
      <button class="action-btn edit" onclick="adminApp.openUpdateStatusModal('${encodeURIComponent(officer.officer_id)}', '${officer.status}')">
        <i class="fas fa-edit"></i> Update Status
      </button>
    `;
    
    return `
      <div class="action-menu">
        ${baseActions}
        ${statusActions}
        ${statusUpdateBtn}
      </div>
    `;
  }

  async viewExistingOfficer(officerId) {
    try {
      showLoader();
      
      const officer = await this.makeRequest(`${API_BASE}/admin/existing-officers/${encodeOfficerId(officerId)}`);
      
      const detailsHtml = this.createOfficerDetailsHtml(officer);
      
      document.getElementById('existingOfficerDetails').innerHTML = detailsHtml;
      openModal('existingOfficerModal');
      
    } catch (error) {
      showToast('Failed to fetch officer details', false);
      console.error(error);
    } finally {
      hideLoader();
    }
  }

  createOfficerDetailsHtml(officer) {
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        return 'Invalid date';
      }
    };

    return `
      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-label">Officer ID</div>
          <div class="detail-value officer-id">${officer.officer_id || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Full Name</div>
          <div class="detail-value">${officer.full_name || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Email</div>
          <div class="detail-value">${officer.email || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Phone</div>
          <div class="detail-value">${officer.phone || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Rank</div>
          <div class="detail-value">${officer.rank || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Position</div>
          <div class="detail-value">${officer.position || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Status</div>
          <div class="detail-value">
            <span class="status-badge ${officer.status === 'approved' ? 'status-approved' :
                                    officer.status === 'verified' ? 'status-verified' :
                                    officer.status === 'rejected' ? 'status-rejected' :
                                    'status-pending'}">
              ${officer.status || 'pending'}
            </span>
          </div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">NIN Number</div>
          <div class="detail-value">${officer.nin_number || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Date of Birth</div>
          <div class="detail-value">${formatDate(officer.date_of_birth)}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Gender</div>
          <div class="detail-value">${officer.gender || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Date of Enlistment</div>
          <div class="detail-value">${formatDate(officer.date_of_enlistment)}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Date of Promotion</div>
          <div class="detail-value">${formatDate(officer.date_of_promotion)}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Years of Service</div>
          <div class="detail-value">${officer.years_of_service || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Service Number</div>
          <div class="detail-value">${officer.service_number || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">State of Origin</div>
          <div class="detail-value">${officer.state_of_origin || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">State of Residence</div>
          <div class="detail-value">${officer.state_of_residence || 'N/A'}</div>
        </div>
        
        <div class="detail-item" style="grid-column: 1 / -1;">
          <div class="detail-label">Residential Address</div>
          <div class="detail-value">${officer.residential_address || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Bank Name</div>
          <div class="detail-value">${officer.bank_name || 'N/A'}</div>
        </div>
        
        <div class="detail-item">
          <div class="detail-label">Account Number</div>
          <div class="detail-value">${officer.account_number || 'N/A'}</div>
        </div>
        
        ${officer.admin_notes ? `
          <div class="detail-item" style="grid-column: 1 / -1;">
            <div class="detail-label">Admin Notes</div>
            <div class="detail-value">${officer.admin_notes}</div>
          </div>
        ` : ''}
        
        ${officer.rejection_reason ? `
          <div class="detail-item" style="grid-column: 1 / -1;">
            <div class="detail-label">Rejection Reason</div>
            <div class="detail-value">${officer.rejection_reason}</div>
          </div>
        ` : ''}
        
        ${officer.verified_by ? `
          <div class="detail-item">
            <div class="detail-label">Verified By</div>
            <div class="detail-value">${officer.verified_by}</div>
          </div>
        ` : ''}
        
        ${officer.verification_date ? `
          <div class="detail-item">
            <div class="detail-label">Verification Date</div>
            <div class="detail-value">${formatDate(officer.verification_date)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  showStatusModal(officerId, action) {
    const actionMap = {
      'verify': 'Verify Officer',
      'approve': 'Approve Officer',
      'reject': 'Reject Officer'
    };
    
    const title = actionMap[action] || 'Update Status';
    const reason = prompt(`Enter reason for ${action}:`);
    
    if (reason === null) return; // User cancelled
    
    if (reason || action !== 'reject') {
      this.updateOfficerStatus(officerId, action, reason);
    }
  }

  async updateOfficerStatus(officerId, action, reason = '') {
    showLoader();
    
    try {
      let url, body;
      const encodedOfficerId = encodeOfficerId(officerId);
      
      switch(action) {
        case 'verify':
          url = `${API_BASE}/admin/existing-officers/${encodedOfficerId}/verify`;
          break;
        case 'approve':
          url = `${API_BASE}/admin/existing-officers/${encodedOfficerId}/approve`;
          break;
        case 'reject':
          url = `${API_BASE}/admin/existing-officers/${encodedOfficerId}/reject`;
          break;
        default:
          url = `${API_BASE}/admin/existing-officers/${encodedOfficerId}/status`;
      }
      
      body = {
        status: action,
        reason: reason || `${action} by admin`,
        admin_notes: reason ? `Status changed to ${action}: ${reason}` : `Status changed to ${action}`
      };
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update officer status');
      }
      
      await this.loadExistingOfficers();
      showToast(`Officer ${action} successfully`);
      
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  openUpdateStatusModal(officerId, currentStatus) {
    // Store the original (non-encoded) officer ID
    document.getElementById('updateOfficerId').value = officerId;
    document.getElementById('newStatus').value = currentStatus || 'pending';
    document.getElementById('statusReason').value = '';
    openModal('updateStatusModal');
  }

  async updateOfficerStatusFromModal() {
    const officerId = document.getElementById('updateOfficerId').value;
    const newStatus = document.getElementById('newStatus').value;
    const reason = document.getElementById('statusReason').value;
    
    if (!officerId) {
      showToast('Invalid officer ID', false);
      return;
    }
    
    showLoader();
    
    try {
      const encodedOfficerId = encodeOfficerId(officerId);
      const response = await fetch(`${API_BASE}/admin/existing-officers/${encodedOfficerId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          reason: reason || `Status changed to ${newStatus} by admin`
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update officer status');
      }
      
      closeModal('updateStatusModal');
      await this.loadExistingOfficers();
      showToast(`Officer status updated to ${newStatus}`);
      
    } catch (error) {
      showToast(error.message, false);
    } finally {
      hideLoader();
    }
  }

  async loadApplicants() {
    try {
      showLoader();
      const applicants = await this.makeRequest(`${API_BASE}/admin/all-applicants?skip=0&limit=100`);
      this.renderTable('applicants', applicants);
      showToast('Applicants loaded successfully');
    } catch (error) {
      console.error('Error loading applicants:', error);
      showToast('Failed to load applicants', false);
    } finally {
      hideLoader();
    }
  }

  async loadOfficers() {
    try {
      showLoader();
      const officers = await this.makeRequest(`${API_BASE}/admin/all-officers?skip=0&limit=100`);
      this.renderTable('officers', officers);
      showToast('Officers loaded successfully');
    } catch (error) {
      console.error('Error loading officers:', error);
      showToast('Failed to load officers', false);
    } finally {
      hideLoader();
    }
  }

  async loadAdmins() {
    try {
      showLoader();
      const admins = await this.makeRequest(`${API_BASE}/admin/all-admins`);
      this.renderTable('admins', admins);
      showToast('Admins loaded successfully');
    } catch (error) {
      console.error('Error loading admins:', error);
      showToast('Failed to load admins', false);
    } finally {
      hideLoader();
    }
  }

  renderTable(tableType, data) {
    const tbody = document.getElementById(`${tableType}TableBody`);
    
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No ${tableType} found</td></tr>`;
      return;
    }
    
    if (tableType === 'applicants') {
      tbody.innerHTML = data.map(applicant => `
        <tr>
          <td>${applicant.unique_id || 'N/A'}</td>
          <td>${applicant.full_name}</td>
          <td>${applicant.email}</td>
          <td>${applicant.phone_number || 'N/A'}</td>
          <td>
            <span class="status-badge ${applicant.is_verified ? 'status-verified' : 'status-pending'}">
              ${applicant.is_verified ? 'Verified' : 'Pending'}
            </span>
          </td>
          <td>
            <button class="action-btn view" onclick="adminApp.viewApplicant('${applicant.id}')">
              <i class="fas fa-eye"></i> View
            </button>
          </td>
        </tr>
      `).join('');
    } else if (tableType === 'officers') {
      tbody.innerHTML = data.map(officer => `
        <tr>
          <td>${officer.unique_id || 'N/A'}</td>
          <td>${officer.full_name}</td>
          <td>${officer.email}</td>
          <td>${officer.rank || 'N/A'}</td>
          <td>${officer.position || 'N/A'}</td>
          <td>
            <button class="action-btn view" onclick="adminApp.viewOfficer('${officer.id}')">
              <i class="fas fa-eye"></i> View
            </button>
          </td>
        </tr>
      `).join('');
    } else if (tableType === 'admins') {
      tbody.innerHTML = data.map(admin => `
        <tr>
          <td>${admin.full_name}</td>
          <td>${admin.email}</td>
          <td>${admin.is_superuser ? 'Yes' : 'No'}</td>
          <td>
            <span class="status-badge ${admin.is_active ? 'status-active' : 'status-inactive'}">
              ${admin.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <button class="action-btn delete" onclick="adminApp.deleteAdmin('${admin.email}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  searchTable(tableType) {
    const searchId = `search${tableType.charAt(0).toUpperCase() + tableType.slice(1)}`;
    const query = document.getElementById(searchId).value.toLowerCase().trim();
    const rows = document.querySelectorAll(`#${tableType}TableBody tr`);
    
    let visibleCount = 0;
    
    rows.forEach(row => {
      if (row.classList.contains('empty-state')) {
        row.style.display = query ? 'none' : '';
        return;
      }
      
      const text = row.textContent.toLowerCase();
      const shouldShow = !query || text.includes(query);
      row.style.display = shouldShow ? '' : 'none';
      
      if (shouldShow) visibleCount++;
    });
    
    // Show empty state if no results
    const emptyState = document.querySelector(`#${tableType}TableBody .empty-state`);
    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? '' : 'none';
    }
  }

  switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    document.getElementById(tabId).classList.add('active');
    
    // Load data for the selected tab
    this.currentTab = tabId;
    
    if (tabId === 'existingOfficersTab') {
      this.loadExistingOfficers();
    } else if (tabId === 'applicantsTab') {
      this.loadApplicants();
    } else if (tabId === 'officersTab') {
      this.loadOfficers();
    } else if (tabId === 'adminsTab') {
      this.loadAdmins();
    }
  }

  logout() {
    // Clear all stored data
    this.token = null;
    this.refreshToken = null;
    this.adminData = null;
    
    adminToken = null;
    adminRefreshToken = null;
    adminData = null;
    
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('pendingAdminEmail');
    localStorage.removeItem('pendingOtpPurpose');
    
    // Clear form inputs
    document.getElementById('loginForm')?.reset();
    document.getElementById('otpForm')?.reset();
    
    showSection('loginSection');
    showToast('Logged out successfully');
  }

  // Placeholder functions for future features
  viewApplicant(applicantId) {
    showToast('View applicant details - Coming soon');
  }

  viewOfficer(officerId) {
    showToast('View officer details - Coming soon');
  }

  deleteAdmin(email) {
    if (confirm(`Are you sure you want to delete admin ${email}? This action cannot be undone.`)) {
      showToast(`Delete admin ${email} functionality coming soon`);
    }
  }
}

// Utility Functions
function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

function showToast(message, isSuccess = true) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? 'success' : 'error'}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showSection(sectionId) {
  document.querySelectorAll('.section-container').forEach(section => {
    section.classList.remove('active-section');
  });
  const section = document.getElementById(sectionId);
  if (section) section.classList.add('active-section');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// Initialize app
let adminApp;
function initializeApp() {
  adminApp = new AdminApp();
  adminApp.initialize();
  window.adminApp = adminApp;
}

// Make utility functions globally available
window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.showToast = showToast;
window.showSection = showSection;
window.openModal = openModal;
window.closeModal = closeModal;