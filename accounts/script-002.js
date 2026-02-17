import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signOut,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  runTransaction,
  arrayUnion,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBw97sFAJ4_LvL5B4SIVmOX_M9F-CcfBio",
  authDomain: "flash-sales-8f768.firebaseapp.com",
  projectId: "flash-sales-8f768",
  storageBucket: "flash-sales-8f768.firebasestorage.app",
  messagingSenderId: "1048280668943",
  appId: "1:1048280668943:web:4e8cec214a1bd2e3e57c7a",
  measurementId: "G-V1J2MYF0H1",
  /*
	apiKey: "AIzaSyA1nP6GuOZ201uX9IpgG5luRxO_6OPyBS0",
	authDomain: "timeego-35df7.firebaseapp.com",
	projectId: "timeego-35df7",
	storageBucket: "timeego-35df7.appspot.com",
	messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
	appId: "1:10386311177:web:0842e821cda6e7af9190d8"*/
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Global State Variables ---
const SESSION_NAME = "userSession";
let isUpgradeMode = false,
  currentUserData = null;
//for functions
function setAccentColor(color) {
  document.documentElement.style.setProperty("--accent-color", color);
}

function clearErrors() {
  if (usernameError) usernameError.textContent = "";
  if (emailError) emailError.textContent = "";
  if (passwordError) passwordError.textContent = "";
  if (formMessage) formMessage.textContent = "";
  const loginEmailError = document.getElementById("loginEmailError");
  const loginPasswordError = document.getElementById("loginPasswordError");
  const loginFormMessage = document.getElementById("loginFormMessage");
  if (loginEmailError) loginEmailError.textContent = "";
  if (loginPasswordError) loginPasswordError.textContent = "";
  if (loginFormMessage) loginFormMessage.textContent = "";
}

const validateInput = (input, errorElement, message) => {
  if (input && input.value.trim() === "") {
    errorElement.textContent = message;
    return false;
  } else {
    if (errorElement) errorElement.textContent = "";
    return true;
  }
};

const validateEmail = (input, errorElement) => {
  const email = input.value.trim();
  if (email === "") {
    if (errorElement) errorElement.textContent = "Email is required.";
    return false;
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    if (errorElement) errorElement.textContent = "Invalid email format.";
    return false;
  } else {
    if (errorElement) errorElement.textContent = "";
    return true;
  }
};

onAuthStateChanged(auth, async (user) => {
  showLoading(true);
  if (user && getCookie(SESSION_NAME)) {
    try {
      const userDocRef = doc(db, "flash-sales", "auth", "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        currentUserData = userDoc.data();
        window.location.href = "/index.html";
      } else {
        await signOut(auth);
        showPage("login-page");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      showAlert("Error loading user data. Please try again.", false);
      await signOut(auth);
      showPage("login-page");
    }
  } else {
    currentUserData = null;
    showPage("login-page");
  }
  showLoading(false);
});

let initBal;
// --- Event Listeners ---
const syncBranding = async () => {
  try {
    const configSnap = await getDoc(
      doc(db, "flash-sales", "auth", "settings", "config"),
    );

    if (configSnap.exists()) {
      const data = configSnap.data();
      initBal = data.initBal;
      // Update all Site Name instances (Header, Footer, Titles)
      if (data.siteName) {
        document.querySelectorAll(".site-name").forEach((el) => {
          el.innerText = data.siteName;
        });
        document.title = data.siteName; // Updates browser tab title
      }

      // Update Logo
      // 2. Update Main Logo
      if (data) {
        const logoImg = document.querySelectorAll(".logo-img");
        logoImg.forEach((img) => {
          img.src = data.siteLogo;
        });
        if (!data.siteLogo) {
          logoImg.forEach((img) => {
            img.style.display = "none";
          });
        }

        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.getElementsByTagName("head")[0].appendChild(link);
        }
        link.href = data.siteLogo;
      }
    }
  } catch (err) {
    console.log("Branding sync failed:", err);
  }
};

// Call this when the page loads
syncBranding();
// Placed below the functions they call
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    let isValid = true;
    if (!validateInput(usernameInput, usernameError, "Username is required."))
      isValid = false;
    if (!validateEmail(emailInput, emailError)) isValid = false;
    if (!validateInput(passwordInput, passwordError, "Password is required."))
      isValid = false;
    if (
      usernameInput &&
      (usernameInput.value.length < 2 ||
        usernameInput.value.length > 15 ||
        usernameInput.value.includes("@") ||
        usernameInput.value.includes("."))
    ) {
      usernameError.textContent = "Invalid Name format or length";
      isValid = false;
    }
    if (passwordInput && passwordInput.value.length < 6) {
      passwordError.textContent = "Password must be at least 6 characters.";
      isValid = false;
    }
    if (!isValid) {
      formMessage.textContent = "Please fix the errors above to proceed.";
      return;
    }

    showLoading(true);
    if (isValid) {
      try {
        const username = usernameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const user = userCredential.user;

        const referralCode =
          referralCodeInput.value === ""
            ? "flash sales"
            : referralCodeInput.value;
        const userDocRef = doc(db, "flash-sales", "auth", "users", user.uid);
        await setDoc(userDocRef, {
          role: "user",
          username: username,
          email: user.email,
          userid: user.uid,
          ib: initBal,
          refPoints: 0,
          referrerId: referralCode || null,
          referralAwarded: false,
          emailVerified: false,
          hasDeposited: false,
          status: "Active",
          createdAt: serverTimestamp(),
        });

        showAlert("Account successfully created! Please Log in.", true);
        sendEmailVerification(user)
          .then(() => showAlert("Verification email sent!", true))
          .catch((error) =>
            showAlert("Failed to send verification email.", false),
          );
        signupForm.reset();
        showPage("login-page");
      } catch (error) {
        let errorMessage = "Signup failed. Please try again.";
        if (error.code === "auth/email-already-in-use") {
          errorMessage = "An account with this email already exists.";
        } else if (error.message.includes("code was just used")) {
          errorMessage = error.message;
        } else {
          console.error("Signup Error:", error);
        }
        showAlert(errorMessage, false);
      } finally {
        showLoading(false);
      }
    }
  });
}

// ... other event listeners and function calls ...
if (usernameInput)
  usernameInput.addEventListener("blur", () =>
    validateInput(usernameInput, usernameError, "Username is required."),
  );
if (emailInput)
  emailInput.addEventListener("blur", () =>
    validateEmail(emailInput, emailError),
  );
if (passwordInput)
  passwordInput.addEventListener("blur", () => {
    validateInput(passwordInput, passwordError, "Password is required.");
    if (passwordInput.value.length < 6 && passwordInput.value.length > 0)
      passwordError.textContent = "Password must be at least 6 characters.";
  });

// --- Login Form Submission ---
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    showLoading(true);

    let isValid = true;
    if (!validateInput(loginEmailInput, loginEmailError, "Email is required."))
      isValid = false;
    if (
      !validateInput(
        loginPasswordInput,
        loginPasswordError,
        "Password is required.",
      )
    )
      isValid = false;

    if (!isValid) {
      if (loginFormMessage) {
        loginFormMessage.textContent =
          "Please fix the errors above to proceed.";
      }
      showLoading(false);
      return;
    }

    try {
      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;

      // Set Firebase persistence to LOCAL for a long-lasting session
      //await setPersistence(auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;
      const userDocRef = doc(db, "flash-sales", "auth", "users", user.uid);

      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        localStorage.setItem(
          "loggedInUser",
          JSON.stringify({
            username: userData.username,
            email: userData.email,
            userid: userData.userid,
            refferer: userData.referrerId || null,
          }),
        );
        showAlert("Login successful!", true);
        loginForm.reset();

        // Set Cookie for 1 Day (1)
        //	setCookie("site_id", user.uid, 2);
        setCookie(SESSION_NAME, user.uid);
        // Redirect to Dashboard
        setTimeout(() => {
          window.location.href = "/index.html";
        }, 1000);
      } else {
        await signOut(auth);
        showAlert("This account does not exist.", false);
        console.error("Firestore document for user does not exist.");
      }
    } catch (error) {
      let errorMessage = "Login failed. Please check your credentials.";
      if (error.code === "auth/wrong-password") {
        errorMessage = "Invalid password.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No user found with that email.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "Your account actions has been Permanently Suspended";
      } else {
        console.error("Login Error:", error);
      }
      showAlert(errorMessage, false);
    } finally {
      showLoading(false);
    }
  });
}

// --- Password Reset Form Submission ---
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    const resetEmailInput = resetForm.querySelector("#resetEmail");
    showLoading(true);

    try {
      const email = resetEmailInput.value.trim();
      await sendPasswordResetEmail(auth, email);
      showAlert(
        "A password reset link has been sent to your email. Please check your inbox or spam folder.",
        true,
      );
      showPage("login-page");
    } catch (error) {
      let errorMessage =
        "Failed to send password reset email. Please try again later.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "This Email isn't registered yet";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "The email address you entered is not valid.";
      } else {
        console.error("Password Reset Error:", error);
      }
      showAlert(errorMessage, false);
    } finally {
      showLoading(false);
      resetForm.reset();
    }
  });
}

// --- Optional: Add blur listeners for real-time feedback ---
if (loginEmailInput) {
  loginEmailInput.addEventListener("blur", () => {
    validateInput(loginEmailInput, loginEmailError, "Email is required.");
  });
}

if (loginPasswordInput) {
  loginPasswordInput.addEventListener("blur", () => {
    validateInput(
      loginPasswordInput,
      loginPasswordError,
      "Password is required.",
    );
  });
}

// --- General Form Submission Feedback ---
document.querySelectorAll("form").forEach((form) => {
  const button = form.querySelector("button");
  if (button) {
    button.addEventListener("blur", () => {
      button.innerHTML = `<div class="loader" style='height:20px;width:20px'></div> Please Wait...`;
      setTimeout(() => {
        button.innerHTML = "Continue";
      }, 1500);
    });
  }
});

// --- REFERRER VERIFICATION LOGIC ---
const checkReferrer = async () => {
  if (refParam) {
    const section = document.getElementById("referrerSection");
    const nameDisplay = document.getElementById("referrerName");

    try {
      // Fetch the referrer's name from Firestore
      const docRef = doc(db, "flash-sales", "auth", "users", refParam);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const referrerData = docSnap.data();

        // Show the name (or username)
        nameDisplay.innerText = referrerData.username || "a friend";
        section.style.display = "block";

        // Save for later use in the actual registration process
        localStorage.setItem("pendingReferrer", refParam);
      }
    } catch (error) {
      console.error("Error fetching referrer:", error);
    }
  }
};

// Call this function when the registration page loads
checkReferrer();

// ===========================
// COOKIE HELPERS
// ===========================
function getCookie(name) {
  const cookies = document.cookie.split(";");

  for (let cookie of cookies) {
    const c = cookie.trim();

    if (c.startsWith(name + "=")) {
      return c.substring(name.length + 1);
    }
  }

  return null;
}

function setCookie(name, value) {
  document.cookie =
    name + "=" + value + ";expires=" + ";path=/;SameSite=Strict";
}

// LISTEN FOR REAL-TIME THEME CHANGES
const configRef = doc(db, "flash-sales", "auth", "settings", "config");
onSnapshot(configRef, (docSnap) => {
  if (docSnap.exists() && docSnap.data().theme) {
    applyTheme(docSnap.data().theme);
  }
});

function applyTheme(theme) {
  const root = document.documentElement;

  // 1. Set Colors
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--accent-green", theme.secondary);
  // 2. Set Mode (Backgrounds/Text)
  if (theme.mode === "dark") {
    // Dark Mode Palette
    root.style.setProperty("--right-panel-bg", "#0b1437"); // Deep Navy
    root.style.setProperty("--card-bg", "#111c44"); // Lighter Navy
    root.style.setProperty("--text-white", "#ffffff");
    root.style.setProperty("--text-gary", "#a3adc2"); // Soft Grey
    root.style.setProperty("--input-bg", "#1b254b");
    root.style.setProperty("--border", "rgba(255,255,255,0.1)");
  } else {
    // Light Mode Palette
    root.style.setProperty("--right-panel-bg", "#f4f7fe"); // Light Grey-Blue
    root.style.setProperty("--card-bg", "#ffffff"); // Pure White
    root.style.setProperty("--text-white", "#2b3674"); // Dark Blue Text
    root.style.setProperty("--text-gray", "#a3adc2"); // Soft Grey
    root.style.setProperty("--input-bg", "#f4f7fe");
    root.style.setProperty("--border", "#e0e5f2");
  }

  console.log("🎨 Theme updated:", theme.mode);
}
