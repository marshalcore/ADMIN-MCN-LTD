// Configuration
const API_BASE = "https://backend-mcn-ltd.onrender.com";
let authToken = localStorage.getItem('authToken');

// DOM Elements
const pageLoader = document.getElementById('pageLoader');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const adminResetPasswordForm = document.getElementById('adminResetPasswordForm');
const logoutBtn = document.getElementById('logoutBtn');
const dashboardSection = document.getElementById('dashboardSection');
const loginSection = document.getElementById('loginSection');
const signupSection = document.getElementById('signupSection');
const forgotPasswordSection = document.getElementById('forgotPasswordSection');
const resetPasswordSection = document.getElementById('resetPasswordSection');
const otpSection = document.getElementById('otpSection');
const otpForm = document.getElementById('otpForm');

// Dashboard elements - FIXED: Removed duplicate totalAdmins declaration
const totalApplicants = document.getElementById('totalApplicants');
const totalOfficers = document.getElementById('totalOfficers');
const totalAdmins = document.getElementById('totalAdmins'); // Only one declaration

// Tab elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Modal elements
const editOfficerModal = document.getElementById('editOfficerModal');
const editApplicantModal = document.getElementById('editApplicantModal');
const resetPasswordModal = document.getElementById('resetPasswordModal');
const closeButtons = document.querySelectorAll('.close-btn');

// Utility Functions
function showLoader() {
  if (pageLoader) pageLoader.style.display = "flex";
}

function hideLoader() {
  if (pageLoader) pageLoader.style.display = "none";
}

function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
  }
}

function clearError(element) {
  if (element) {
    element.textContent = '';
    element.style.display = 'none';
  }
}

function showModal(modal) {
  if (modal) modal.style.display = 'block';
}

function closeModal(modal) {
  if (modal) modal.style.display = 'none';
}

function showSection(sectionId) {
  document.querySelectorAll('.section-container').forEach(section => {
    section.classList.remove('active-section');
  });
  const section = document.getElementById(sectionId);
  if (section) section.classList.add('active-section');
  window.scrollTo(0, 0);
}

function showToast(message, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? 'success' : 'error'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Auth Functions
async function adminLogin(event) {
  event.preventDefault();
  showLoader();
  console.log("Login function started");

  const email = document.getElementById("login_email").value;
  const password = document.getElementById("login_password").value;

  try {
    console.log("Attempting to send login request");
    
    const response = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    console.log("Received response, status:", response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Login error response:", errorData);
      throw new Error(errorData.detail || "Login failed");
    }

    const data = await response.json();
    console.log("Login successful response:", data);

    if (data.requires_otp || data.status === "otp_required") {
      localStorage.setItem("pendingAdminEmail", data.email || email);
      localStorage.setItem("pendingOtpPurpose", "login");

      currentEmail = email;
      currentPurpose = "login";

      showSection("otpSection");
      showToast("OTP sent to your email for login");
    } else if (data.access_token) {
      localStorage.setItem("authToken", data.access_token);
      authToken = data.access_token;
      showSection("dashboardSection");
      loadDashboard();
      showToast("Login successful!");
    } else {
      throw new Error("Unexpected login response");
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast(err.message || "Login failed. Please try again.", false);
  } finally {
    hideLoader();
    console.log("Login function completed");
  }
}

async function adminSignup(event) {
  event.preventDefault();
  showLoader();

  const form = event.target;
  const full_name = form.elements["full_name"].value;
  const email = form.elements["email"].value;
  const password = form.elements["password"].value;

  try {
    const response = await fetch(`${API_BASE}/admin/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ full_name, email, password })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Signup failed");
    }

    const data = await response.json();

    if (data.status === "otp_required") {
      localStorage.setItem("pendingAdminEmail", email);
      localStorage.setItem("pendingOtpPurpose", "signup");
      currentEmail = email;
      currentPurpose = "signup";

      showSection("otpSection");
      showToast("OTP sent to your email for verification");
    } else if (data.access_token) {
      localStorage.setItem("authToken", data.access_token);
      authToken = data.access_token;
      showSection("dashboardSection");
      loadDashboard();
      showToast("Signup successful!");
    } else {
      throw new Error("Unexpected signup response");
    }
  } catch (err) {
    showToast(err.message || "Signup failed", false);
  } finally {
    hideLoader();
  }
}

let currentEmail = "";
let currentPurpose = "";

async function verifyOtp(event) {
  event.preventDefault();
  const otp = document.getElementById("otp_input").value.trim();
  const email = currentEmail;

  if (!email) {
    console.error("No email found for OTP verification.");
    showToast("Error: No email found for OTP verification", true);
    return;
  }

  console.log("Verifying OTP for:", email, "| purpose:", currentPurpose);

  let endpoint = "/admin/verify-otp";
  if (currentPurpose === "login") {
    endpoint = "/admin/verify-login-otp";
  }

  showLoader();
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, code: otp, purpose: currentPurpose })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "OTP verification failed");
    }

    const data = await response.json();
    console.log("OTP verification response:", data);

    if (data.access_token) {
      showToast("OTP verified successfully!");
      localStorage.setItem("adminToken", data.access_token);
      authToken = data.access_token;
      
      if (currentPurpose === "password_reset") {
        showSection("loginSection");
      } else {
        showSection("dashboardSection");
        loadDashboard();
      }
    } else if (data.message && data.message.includes("verified")) {
      showToast("Signup successful! Please login.");
      showSection("loginSection");
    } else {
      throw new Error(data.message || "OTP verification failed");
    }
  } catch (err) {
    console.error("OTP verification error:", err);
    showToast(err.message, true);
  } finally {
    hideLoader();
  }
}

async function adminForgotPassword(email) {
  showLoader();

  try {
    const response = await fetch(`${API_BASE}/admin/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to send reset code");
    }

    showToast("Reset code sent to your email");
    
    const resetEmailField = document.getElementById("reset_email");
    if (resetEmailField) {
      resetEmailField.value = email;
    }
    
    showSection("resetPasswordSection");
    
  } catch (err) {
    console.error("Forgot password error:", err);
    document.getElementById("forgotPasswordError").textContent = err.message;
    showToast(err.message, true);
  } finally {
    hideLoader();
  }
}

async function adminResetPassword(event) {
  event.preventDefault();
  showLoader();

  const email = document.getElementById("reset_email")?.value;
  const code = document.getElementById("reset_code")?.value;
  const new_password = document.getElementById("reset_new_password")?.value;

  console.log("Reset password data:", { email, code, new_password });

  if (!email || !code || !new_password) {
    showToast("Please fill in all fields", true);
    hideLoader();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/admin/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, code, new_password })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Password reset failed");
    }

    const data = await response.json();
    console.log("Reset password response:", data);
    showToast('Password reset successfully!');
    
    document.getElementById("adminResetPasswordForm").reset();
    
    setTimeout(() => {
      showSection('loginSection');
    }, 3000);
  } catch (error) {
    console.error("Reset password error:", error);
    showToast('Password reset failed: ' + error.message, false);
  } finally {
    hideLoader();
  }
}

function adminLogout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('pendingAdminEmail');
  authToken = null;
  showSection('loginSection');
}

async function loadDashboard() {
  showLoader();
  try {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      console.error("No token found. Redirecting to login.");
      showSection("loginSection");
      return;
    }

    const response = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load dashboard');
    }

    const stats = await response.json();

    if (totalApplicants) totalApplicants.textContent = stats.total_applicants;
    if (totalOfficers) totalOfficers.textContent = stats.total_officers;
    if (totalAdmins) totalAdmins.textContent = stats.total_admins;

    await loadOfficers();
    await loadApplicants();
    await loadAdmins();
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    showToast('Failed to load dashboard data', true);
  } finally {
    hideLoader();
  }
}

async function loadOfficers() {
  try {
    const token = localStorage.getItem("adminToken");
    const response = await fetch(`${API_BASE}/admin/all-officers`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load officers');
    }

    const officers = await response.json();
    const tbody = document.querySelector('#officersTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    officers.forEach(officer => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${officer.unique_id || 'N/A'}</td>
        <td>${officer.full_name || 'N/A'}</td>
        <td>${officer.email || 'N/A'}</td>
        <td>${officer.rank || 'N/A'}</td>
        <td>${officer.position || 'N/A'}</td>
        <td>
          <button onclick="openEditOfficerModal('${officer.id}')">Edit</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading officers:', err);
    showToast('Failed to load officers', false);
  }
}

async function openEditOfficerModal(officerId) {
  try {
    const token = localStorage.getItem("adminToken");
    const response = await fetch(`${API_BASE}/admin/officers/${officerId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch officer details');
    }

    const officer = await response.json();
    
    document.getElementById('editOfficerId').value = officerId;
    document.getElementById('editOfficerEmail').value = officer.email || '';
    document.getElementById('editOfficerRank').value = officer.rank || '';
    document.getElementById('editOfficerPosition').value = officer.position || '';
    
    showModal(editOfficerModal);
  } catch (error) {
    console.error('Error fetching officer:', error);
    showToast('Failed to fetch officer details', false);
  }
}

async function updateOfficer(e) {
  e.preventDefault();
  showLoader();
  
  try {
    const officerId = document.getElementById('editOfficerId').value;
    const updates = {
      email: document.getElementById('editOfficerEmail').value,
      rank: document.getElementById('editOfficerRank').value,
      position: document.getElementById('editOfficerPosition').value
    };

    const token = localStorage.getItem("adminToken");
    const response = await fetch(`${API_BASE}/admin/officers/${officerId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update officer');
    }
    
    closeModal(editOfficerModal);
    await loadOfficers();
    showToast('Officer updated successfully');
  } catch (error) {
    console.error('Error updating officer:', error);
    showToast('Failed to update officer: ' + error.message, false);
  } finally {
    hideLoader();
  }
}

async function loadApplicants() {
  try {
    const token = localStorage.getItem("adminToken");
    const response = await fetch(`${API_BASE}/admin/all-applicants`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load applicants');
    }

    const applicants = await response.json();
    const tbody = document.querySelector('#applicantsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    applicants.forEach(applicant => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${applicant.unique_id || 'N/A'}</td>
        <td>${applicant.full_name || 'N/A'}</td>
        <td>${applicant.email || 'N/A'}</td>
        <td>${applicant.phone_number || 'N/A'}</td>
        <td>${applicant.is_verified ? 'Yes' : 'No'}</td>
        <td>
          <button class="action-btn" onclick="openEditApplicantModal('${applicant.id}')">Edit ID</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading applicants:', err);
    showToast('Failed to load applicants', false);
  }
}

async function openEditApplicantModal(applicantId) {
  try {
    const token = localStorage.getItem("adminToken");
    const response = await fetch(`${API_BASE}/admin/applicants/${applicantId}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch applicant details');
    }

    const applicant = await response.json();
    
    document.getElementById('editApplicantId').value = applicantId;
    document.getElementById('editApplicantUniqueId').value = applicant.unique_id || '';
    
    showModal(editApplicantModal);
  } catch (error) {
    console.error('Error fetching applicant:', error);
    showToast('Failed to fetch applicant details', false);
  }
}

async function updateApplicantUniqueId(e) {
  e.preventDefault();
  showLoader();
  
  try {
    const applicantId = document.getElementById('editApplicantId').value;
    const newUniqueId = document.getElementById('editApplicantUniqueId').value.trim();
    
    if (!newUniqueId) {
      showToast('Unique ID cannot be empty', true);
      return;
    }

    const token = localStorage.getItem("adminToken");
    const response = await fetch(`${API_BASE}/admin/applicants/${applicantId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ unique_id: newUniqueId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update applicant');
    }
    
    closeModal(editApplicantModal);
    await loadApplicants();
    showToast('Applicant Unique ID updated successfully');
  } catch (error) {
    console.error('Error updating applicant:', error);
    showToast('Failed to update applicant: ' + (error.message || 'Unknown error'), false);
  } finally {
    hideLoader();
  }
}

async function loadAdmins() {
  try {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      console.error("No token found. Redirecting to login.");
      showSection("loginSection");
      return;
    }

    const response = await fetch(`${API_BASE}/admin/all-admins`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load admins');
    }

    const admins = await response.json();
    const tbody = document.querySelector('#adminsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    admins.forEach(admin => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${admin.full_name || 'N/A'}</td>
        <td>${admin.email || 'N/A'}</td>
        <td>${admin.is_superuser ? 'Yes' : 'No'}</td>
        <td>
          <button class="action-btn delete-btn" data-email="${admin.email}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading admins:', err);
    showToast('Failed to load admins', true);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication status
  if (authToken) {
    showSection('dashboardSection');
    loadDashboard();
  } else {
    showSection('loginSection');
  }

  // Check if we're coming from login to OTP page
  const pendingEmail = localStorage.getItem("pendingAdminEmail");
  if (pendingEmail && document.getElementById("otp-email")) {
    document.getElementById("otp-email").textContent = pendingEmail;
  }

  // Attach form handlers
  if (loginForm) loginForm.addEventListener('submit', adminLogin);
  if (signupForm) signupForm.addEventListener('submit', adminSignup);
  if (otpForm) otpForm.addEventListener('submit', verifyOtp);

  // Forgot password form
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById("forgot_email").value;
      adminForgotPassword(email);
    });
  }

  // Reset password form
  if (adminResetPasswordForm) {
    adminResetPasswordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      adminResetPassword(e);
    });
  }

  // Add these event listeners for edit forms
  const editOfficerForm = document.getElementById('editOfficerForm');
  const editApplicantForm = document.getElementById('editApplicantForm');

  if (editOfficerForm) {
    editOfficerForm.addEventListener('submit', updateOfficer);
  }

  if (editApplicantForm) {
    editApplicantForm.addEventListener('submit', updateApplicantUniqueId);
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', adminLogout);
  }

  // Tab navigation
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const tabId = button.dataset.tab;
      const tabContent = document.getElementById(tabId);
      if (tabContent) tabContent.classList.add('active');
      
      if (tabId === 'officersTab') loadOfficers();
      if (tabId === 'applicantsTab') loadApplicants();
      if (tabId === 'adminsTab') loadAdmins();
    });
  });

  // Navigation links
  const showLoginLink = document.getElementById('showLoginLink');
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('loginSection');
    });
  }

  const showSignupLink = document.getElementById('showSignupLink');
  if (showSignupLink) {
    showSignupLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('signupSection');
    });
  }

  const showForgotPasswordLink = document.getElementById('showForgotPasswordLink');
  if (showForgotPasswordLink) {
    showForgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('forgotPasswordSection');
    });
  }

  const showLoginLink2 = document.getElementById('showLoginLink2');
  if (showLoginLink2) {
    showLoginLink2.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('loginSection');
    });
  }

  const showLoginLink3 = document.getElementById('showLoginLink3');
  if (showLoginLink3) {
    showLoginLink3.addEventListener('click', (e) => {
      e.preventDefault();
      showSection('loginSection');
    });
  }

  // Resend OTP handler
  const resendOtpBtn = document.getElementById("resendOtp");
  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      showLoader();
      
      const email = localStorage.getItem("pendingAdminEmail");
      
      try {
        const response = await fetch(`${API_BASE}/admin/resend-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, purpose: "admin_login" })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to resend OTP");
        }

        const data = await response.json();
        showToast("New OTP code sent!");
      } catch (err) {
        showToast(err.message || "Failed to resend OTP", false);
      } finally {
        hideLoader();
      }
    });
  }

  // Modal Management
  const modals = document.querySelectorAll('.modal');
  const closeButtons = document.querySelectorAll('.close-btn, .modal-close');

  // Close modals when clicking close button
  closeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) closeModal(modal);
    });
  });

  // Close modals when clicking outside
  modals.forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeModal(this);
      }
    });
  });

  // Close modals with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      modals.forEach(modal => {
        if (modal.style.display === 'block') {
          closeModal(modal);
        }
      });
    }
  });

  // Delete admin functionality
  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const adminEmail = e.target.getAttribute('data-email');

      if (!confirm(`Are you sure you want to delete admin: ${adminEmail}?`)) return;

      try {
        const token = localStorage.getItem("adminToken");
        const response = await fetch(`${API_BASE}/admin/delete-admin/${encodeURIComponent(adminEmail)}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to delete admin");
        }

        showToast(`Admin ${adminEmail} deleted successfully`, true);
        loadAdmins();
      } catch (err) {
        console.error('Error deleting admin:', err);
        showToast('Failed to delete admin', false);
      }
    }
  });
});

// Make functions available globally
window.openEditOfficerModal = openEditOfficerModal;
window.openEditApplicantModal = openEditApplicantModal;
window.updateOfficer = updateOfficer;
window.updateApplicantUniqueId = updateApplicantUniqueId;