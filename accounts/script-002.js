/**
 * @file script-002.js
 * @description Fluxmall Core Authentication Controller (Elite v2.0)
 * @author Antigravity Professional UI System
 * @version 2.0.1
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signOut,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* --- Core Configuration --- */
const firebaseConfig = {
  apiKey: "AIzaSyBw97sFAJ4_LvL5B4SIVmOX_M9F-CcfBio",
  authDomain: "flash-sales-8f768.firebaseapp.com",
  projectId: "flash-sales-8f768",
  storageBucket: "flash-sales-8f768.firebasestorage.app",
  messagingSenderId: "1048280668943",
  appId: "1:1048280668943:web:4e8cec214a1bd2e3e57c7a",
  measurementId: "G-V1J2MYF0H1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --- Silk DOM References --- */
const DOM = {
  forms: {
    signup: document.getElementById("signupForm"),
    login: document.getElementById("loginForm"),
    reset: document.getElementById("resetForm")
  },
  fields: {
    username: document.getElementById("username"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    referral: document.getElementById("referralCode"),
    resetEmail: document.getElementById("resetEmail")
  },
  errors: {
    username: document.getElementById("usernameError"),
    email: document.getElementById("emailError"),
    password: document.getElementById("passwordError"),
    loginEmail: document.getElementById("loginEmailError"),
    loginPassword: document.getElementById("loginPasswordError"),
    signupMsg: document.getElementById("formMessage"),
    loginMsg: document.getElementById("loginFormMessage")
  }
};

/* --- Global State --- */
const SESSION_KEY = "fluxmall_session";
let initialBalance = 0;
let isSubmitting = false;

/* --- UI Bridge --- */
const UI = {
  alert: (msg, type) => window.UI?.showAlert(msg, type),
  loading: (state) => window.UI?.showLoading(state),
  page: (id) => window.UI?.showPage(id)
};

/* --- Validation Protocol --- */
const resetValidation = () => {
  Object.values(DOM.errors).forEach(el => { if(el) el.textContent = ""; });
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/* --- Lifecycle: Auth Watcher --- */
onAuthStateChanged(auth, async (user) => {
  const session = getCookie(SESSION_KEY);
  if (user && session) {
    try {
      const userRef = doc(db, "flash-sales", "auth", "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        if (!window.location.pathname.includes("index.html")) {
          window.location.href = "/index.html";
        }
      }
    } catch (e) {
      console.warn("Session isolation failure:", e);
    }
  }
});

/* --- Lifecycle: Real-time Sync --- */
(async () => {
  try {
    const configRef = doc(db, "flash-sales", "auth", "settings", "config");
    onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        initialBalance = data.initBal || 0;
        
        // Sync Visual Branding
        if (data.siteName) {
          document.querySelectorAll(".site-name").forEach(el => el.innerText = data.siteName);
          document.title = data.siteName;
        }
        
        if (data.siteLogo) {
          document.querySelectorAll(".logo-img, .logo-centered").forEach(img => img.src = data.siteLogo);
          let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
          link.rel = 'shortcut icon';
          link.href = data.siteLogo;
          document.head.appendChild(link);
        }

        if (data.theme) applyDesignTokens(data.theme);
      }
    });
  } catch (err) {
    console.error("Infrastructure sync failed.");
  }
})();

const applyDesignTokens = (theme) => {
  const root = document.documentElement;
  if (theme.primary) root.style.setProperty("--primary", theme.primary);
  if (theme.secondary) root.style.setProperty("--secondary", theme.secondary);
  
  const isDark = theme.mode === "dark";
  root.style.setProperty("--bg-deep", isDark ? "#000000" : "#f8fafc");
  root.style.setProperty("--bg-surface", isDark ? "#050505" : "#ffffff");
  root.style.setProperty("--text-primary", isDark ? "#ffffff" : "#0f172a");
  root.style.setProperty("--text-secondary", isDark ? "#a0a0a0" : "#64748b");
};

/* --- Interaction Handlers --- */

// 1. Identity Creation
if (DOM.forms.signup) {
  DOM.forms.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    resetValidation();
    
    const user = DOM.fields.username.value.trim();
    const email = DOM.fields.email.value.trim();
    const pass = DOM.fields.password.value;

    if (user.length < 3) return DOM.errors.username.textContent = "Identifier too short.";
    if (!isValidEmail(email)) return DOM.errors.email.textContent = "Invalid communication channel.";
    if (pass.length < 6) return DOM.errors.password.textContent = "Requires 6+ characters.";

    try {
      isSubmitting = true;
      UI.loading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      
      await setDoc(doc(db, "flash-sales", "auth", "users", cred.user.uid), {
        role: "user",
        username: user,
        email: cred.user.email,
        userid: cred.user.uid,
        ib: initialBalance,
        status: "Active",
        referrerId: DOM.fields.referral.value.trim() || "Direct",
        createdAt: serverTimestamp(),
      });

      UI.alert("Identity Setup Complete.", true);
      await sendEmailVerification(cred.user);
      DOM.forms.signup.reset();
      UI.page("login-page");
    } catch (err) {
      UI.alert(err.code === "auth/email-already-in-use" ? "Email already exists." : "Handshake failed.", false);
    } finally {
      isSubmitting = false;
      UI.loading(false);
    }
  });
}

// 2. Secure Authentication
if (DOM.forms.login) {
  DOM.forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    resetValidation();

    const email = DOM.fields.loginEmail.value.trim();
    const pass = DOM.fields.loginPassword.value;

    if (!email || !pass) return UI.alert("Missing credentials.", false);

    try {
      isSubmitting = true;
      UI.loading(true);
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const snap = await getDoc(doc(db, "flash-sales", "auth", "users", cred.user.uid));

      if (snap.exists()) {
        const data = snap.data();
        if (data.status === "Suspended") {
          await signOut(auth);
          UI.page("admin-contact-page");
          return;
        }

        saveCookie(SESSION_KEY, cred.user.uid);
        UI.alert("Authorization Successful.", true);
        setTimeout(() => window.location.href = "/index.html", 600);
      } else {
        await signOut(auth);
        UI.alert("Record isolation fault.", false);
      }
    } catch (err) {
      UI.alert("Access Denied. Check credentials.", false);
    } finally {
      isSubmitting = false;
      UI.loading(false);
    }
  });
}

// 3. Security Reset
if (DOM.forms.reset) {
  DOM.forms.reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = DOM.fields.resetEmail.value.trim();
    if (!isValidEmail(email)) return UI.alert("Invalid identifier.", false);

    try {
      UI.loading(true);
      await sendPasswordResetEmail(auth, email);
      UI.alert("Recovery link transmitted.", true);
      UI.page("login-page");
    } catch (err) {
      UI.alert("Transmission failure.", false);
    } finally {
      UI.loading(false);
    }
  });
}

/* --- Connectivity Watcher --- */
const monitorConnectivity = () => {
  if (!navigator.onLine) {
    const p404 = document.getElementById("404Page");
    if (p404) {
      p404.querySelector(".error-title").innerText = "OFFLINE";
      p404.querySelector(".status-tag").innerText = "Connection Severed";
      p404.querySelector("p").innerText = "System requires active uplink for secure transactions.";
      UI.page("404Page");
    }
  } else if (document.getElementById("404Page")?.querySelector(".error-title").innerText === "OFFLINE") {
    UI.alert("Uplink Restored.", true);
    UI.page("login-page");
  }
};
window.addEventListener("online", monitorConnectivity);
window.addEventListener("offline", monitorConnectivity);
monitorConnectivity();

/* --- Utility Methods --- */
function saveCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; SameSite=Strict; max-age=86400`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}
