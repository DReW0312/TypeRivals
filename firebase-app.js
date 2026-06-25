const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/donrmilry/image/upload";
const CLOUDINARY_PRESET = "typerivals_preset";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1.CONFIGURATIONS
const firebaseConfig = {
  apiKey: "AIzaSyDqDUtFP4gxFEmuHQhZOQGniojwBIrxUjY",
  authDomain: "typerivals-f8d2d.firebaseapp.com",
  projectId: "typerivals-f8d2d",
  storageBucket: "typerivals-f8d2d.firebasestorage.app",
  messagingSenderId: "898298062972",
  appId: "1:898298062972:web:1dd789edeb0e31cd8201f9",
  measurementId: "G-WGSQZ3FSQS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authModal = document.getElementById('authModal');
const profileModal = document.getElementById('profileModal');
const usernameInput = document.getElementById('usernameInput');
const toggleAuthMode = document.getElementById('toggleAuthMode');
let isLoginMode = true;

// Expose user ID globally so typing.js can save scores
window.currentUserUid = null; 

// --- AUTHENTICATION UI LOGIC ---
document.getElementById('navLoginBtn').addEventListener('click', () => authModal.style.display = 'flex');
document.getElementById('closeAuthBtn').addEventListener('click', () => authModal.style.display = 'none');
document.getElementById('closeProfileBtn').addEventListener('click', () => profileModal.style.display = 'none');

toggleAuthMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').innerText = isLoginMode ? 'Login' : 'Sign Up';
    usernameInput.style.display = isLoginMode ? 'none' : 'block';
    toggleAuthMode.innerText = isLoginMode ? 'Need an account? Sign up' : 'Have an account? Login';
});

// --- FIREBASE AUTH LOGIC ---
document.getElementById('authSubmitBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const username = usernameInput.value;

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            // Create user profile in Firestore
            await setDoc(doc(db, "users", userCred.user.uid), {
                username: username || "Typist",
                profilePic: "https://via.placeholder.com/100"
            });
        }
        authModal.style.display = 'none';
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('navLogoutBtn').addEventListener('click', () => signOut(auth));

// --- AUTH STATE LISTENER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUserUid = user.uid;
        document.getElementById('navLoginBtn').style.display = 'none';
        document.getElementById('navProfileBtn').style.display = 'inline-block';
        document.getElementById('navLogoutBtn').style.display = 'inline-block';
        loadUserProfile(user.uid);
    } else {
        window.currentUserUid = null;
        document.getElementById('navLoginBtn').style.display = 'inline-block';
        document.getElementById('navProfileBtn').style.display = 'none';
        document.getElementById('navLogoutBtn').style.display = 'none';
    }
});

// --- CLOUDINARY UPLOAD LOGIC ---
document.getElementById('picUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !window.currentUserUid) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    try {
        // 1. Upload to Cloudinary
        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const data = await res.json();
        const imageUrl = data.secure_url;

        // 2. Update Firestore with new image URL
        await setDoc(doc(db, "users", window.currentUserUid), { profilePic: imageUrl }, { merge: true });
        
        // 3. Update UI
        document.getElementById('profilePicDisplay').src = imageUrl;
    } catch (error) {
        console.error("Upload failed", error);
    }
});

// --- LOAD PROFILE & HISTORY ---
document.getElementById('navProfileBtn').addEventListener('click', () => profileModal.style.display = 'flex');

async function loadUserProfile(uid) {
    // Load Profile Info
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        document.getElementById('profileUsernameDisplay').innerText = data.username;
        document.getElementById('profilePicDisplay').src = data.profilePic;
    }

    // Load History
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    const q = query(collection(db, `users/${uid}/history`), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const li = document.createElement('li');
        li.innerText = `WPM: ${data.wpm} | Acc: ${data.accuracy}% | Date: ${new Date(data.date).toLocaleDateString()}`;
        historyList.appendChild(li);
    });
}

// --- GLOBAL SAVE FUNCTION ---
// We attach this to window so typing.js can call it when a game ends
window.saveGameToFirebase = async (wpm, accuracy) => {
    if (!window.currentUserUid) return; // Don't save if not logged in
    try {
        await addDoc(collection(db, `users/${window.currentUserUid}/history`), {
            wpm: wpm,
            accuracy: accuracy,
            date: Date.now()
        });
        loadUserProfile(window.currentUserUid); // Refresh history list
    } catch (error) {
        console.error("Error saving score:", error);
    }
};