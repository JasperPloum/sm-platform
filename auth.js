// auth.js
import { auth, db, googleProvider } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Redirect if already logged in ──────────────────────────────
onAuthStateChanged(auth, user => {
    if (user) window.location.href = "app.html";
});

// ── DOM refs ───────────────────────────────────────────────────
const tabs        = document.querySelectorAll(".tab");
const indicator   = document.querySelector(".tab-indicator");
const loginForm   = document.getElementById("loginForm");
const signupForm  = document.getElementById("signupForm");
const errorBanner = document.getElementById("errorBanner");
const errorText   = document.getElementById("errorText");
const googleBtn   = document.getElementById("googleBtn");

// ── Tab switching ──────────────────────────────────────────────
tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        hideError();

        if (tab.dataset.tab === "signup") {
            loginForm.classList.remove("active");
            signupForm.classList.add("active");
            indicator.classList.add("right");
        } else {
            signupForm.classList.remove("active");
            loginForm.classList.add("active");
            indicator.classList.remove("right");
        }
    });
});

// ── Password toggle ────────────────────────────────────────────
document.querySelectorAll(".eye-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === "password" ? "text" : "password";
    });
});

// ── Helpers ────────────────────────────────────────────────────
function showError(msg) {
    errorText.textContent = msg;
    errorBanner.hidden = false;
}
function hideError() {
    errorBanner.hidden = true;
}

function setLoading(btn, loading) {
    const text    = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".spinner");
    btn.disabled  = loading;
    text.hidden   = loading;
    spinner.hidden = !loading;
}

function friendlyError(code) {
    const map = {
        "auth/email-already-in-use":   "That email is already registered.",
        "auth/invalid-email":          "Please enter a valid email.",
        "auth/weak-password":          "Password must be at least 6 characters.",
        "auth/user-not-found":         "No account found with that email.",
        "auth/wrong-password":         "Incorrect password. Try again.",
        "auth/too-many-requests":      "Too many attempts. Please wait a moment.",
        "auth/popup-closed-by-user":   "Google sign-in was cancelled.",
    };
    return map[code] || "Something went wrong. Please try again.";
}

// Save user profile to Firestore (runs on first sign-in)
async function ensureUserDoc(user, extraData = {}) {
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const displayName = extraData.displayName || user.displayName || user.email.split("@")[0];
    const username    = (extraData.username || user.email.split("@")[0]).toLowerCase().replace(/\s+/g, "_");

    if (!snap.exists()) {
        await setDoc(ref, {
            uid:         user.uid,
            email:       user.email,
            displayName,
            username,
            searchName:  displayName.toLowerCase(),   // for case-insensitive search
            photoURL:    user.photoURL || null,
            friends:     [],
            createdAt:   serverTimestamp()
        });
    } else {
        // Patch existing docs that are missing searchName
        const data = snap.data();
        if (!data.searchName) {
            await setDoc(ref, { searchName: (data.displayName || "").toLowerCase() }, { merge: true });
        }
    }
}

// ── Login ──────────────────────────────────────────────────────
loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    hideError();
    const btn   = document.getElementById("loginBtn");
    const email = document.getElementById("loginEmail").value.trim();
    const pass  = document.getElementById("loginPassword").value;

    setLoading(btn, true);
    try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        await ensureUserDoc(cred.user);
        window.location.href = "app.html";
    } catch (err) {
        showError(friendlyError(err.code));
        setLoading(btn, false);
    }
});

// ── Sign Up ────────────────────────────────────────────────────
signupForm.addEventListener("submit", async e => {
    e.preventDefault();
    hideError();
    const btn      = document.getElementById("signupBtn");
    const username = document.getElementById("signupUsername").value.trim();
    const email    = document.getElementById("signupEmail").value.trim();
    const pass     = document.getElementById("signupPassword").value;

    if (!/^[a-zA-Z0-9_]{2,24}$/.test(username)) {
        return showError("Username must be 2–24 characters (letters, numbers, _).");
    }

    setLoading(btn, true);
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: username });
        await ensureUserDoc(cred.user, { username, displayName: username });
        window.location.href = "app.html";
    } catch (err) {
        showError(friendlyError(err.code));
        setLoading(btn, false);
    }
});

// ── Google ─────────────────────────────────────────────────────
googleBtn.addEventListener("click", async () => {
    hideError();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await ensureUserDoc(result.user);
        window.location.href = "app.html";
    } catch (err) {
        showError(friendlyError(err.code));
    }
});