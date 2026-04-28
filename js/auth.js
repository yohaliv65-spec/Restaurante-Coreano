
import { auth, db, googleProvider, ADMIN_EMAILS } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "./nav.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    const dest = ADMIN_EMAILS.includes(user.email)
      ? "../pages/admin.html"
      : "../pages/mi-cuenta.html";
    window.location.href = dest;
  }
});

document.querySelectorAll(".auth-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("loginPanel").classList.toggle("hidden", tab !== "login");
    document.getElementById("registerPanel").classList.toggle("hidden", tab !== "register");
  });
});

if (window.location.hash === "#register") {
  document.querySelector('[data-tab="register"]')?.click();
}

function togglePass(inputId, btnId) {
  const btn = document.getElementById(btnId);
  const inp = document.getElementById(inputId);
  btn?.addEventListener("click", () => {
    inp.type = inp.type === "password" ? "text" : "password";
    btn.textContent = inp.type === "password" ? "👁" : "🙈";
  });
}
togglePass("loginPassword", "eyeLogin");
togglePass("regPassword", "eyeReg");

const regPassInput = document.getElementById("regPassword");
if (regPassInput) {
  regPassInput.addEventListener("input", (e) => {
    const val = e.target.value;
    const bar = document.getElementById("passStrength");
    if (!bar) return;
    let level = "";
    if (val.length >= 10 && /[A-Z]/.test(val) && /[0-9]/.test(val)) level = "strong";
    else if (val.length >= 6) level = "medium";
    else if (val.length > 0) level = "weak";
    bar.dataset.level = level;
  });
}

async function saveUserToFirestore(user, extraData = {}) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    const userData = {
      uid: user.uid,
      name: user.displayName || extraData.name || "",
      email: user.email,
      phone: extraData.phone || "",
      role: ADMIN_EMAILS.includes(user.email) ? "admin" : "user",
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, userData);
    console.log("✅ Usuario guardado en Firestore:", user.email);
    return true;
  }
  return false;
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 6000);
}

document.getElementById("btnLogin")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;
  
  if (!email || !pass) {
    showErr("loginError", "Completa todos los campos.");
    return;
  }
  
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("¡Bienvenido de vuelta! 🥢", "success");
  } catch (e) {
    console.error("Login error:", e);
    let m = "Error al iniciar sesión. Verifica tus credenciales.";
    if (e.code === "auth/invalid-credential") m = "Correo o contraseña incorrectos.";
    else if (e.code === "auth/too-many-requests") m = "Demasiados intentos. Intenta más tarde.";
    else if (e.code === "auth/user-disabled") m = "Esta cuenta ha sido deshabilitada.";
    showErr("loginError", m);
  }
});

document.getElementById("loginPassword")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btnLogin")?.click();
});

document.getElementById("btnRegister")?.addEventListener("click", async () => {
  const name = document.getElementById("regName").value.trim();
  const lastname = document.getElementById("regLastname").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  
  const phoneCode = document.getElementById("regPhoneCode")?.value || "+52";
  const phoneNumber = document.getElementById("regPhone")?.value.trim() || "";
  const phone = phoneNumber ? `${phoneCode}${phoneNumber.replace(/\s/g, '')}` : "";
  
  const pass = document.getElementById("regPassword").value;
  const terms = document.getElementById("acceptTerms")?.checked;

  if (!name || !email || !pass) {
    showErr("registerError", "Completa todos los campos requeridos.");
    return;
  }
  
  if (pass.length < 6) {
    showErr("registerError", "La contraseña debe tener al menos 6 caracteres.");
    return;
  }
  
  if (!terms) {
    showErr("registerError", "Debes aceptar los términos y condiciones.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const fullName = `${name} ${lastname}`.trim();
    
    await updateProfile(cred.user, { displayName: fullName });
    await saveUserToFirestore(cred.user, { name: fullName, phone });
    
    console.log("✅ Usuario creado:", email);
    showToast("¡Cuenta creada! Bienvenido 🎉", "success");
    
  } catch (e) {
    console.error("Register error:", e);
    let m = "Error al crear la cuenta.";
    if (e.code === "auth/email-already-in-use") {
      m = "Este correo ya está registrado.";
    } else if (e.code === "auth/weak-password") {
      m = "La contraseña es demasiado débil.";
    } else if (e.code === "auth/invalid-email") {
      m = "El correo electrónico no es válido.";
    } else if (e.code === "auth/operation-not-allowed") {
      m = "⚠️ El registro no está habilitado. Ve a Firebase Console > Authentication > Sign-in methods y habilita 'Correo electrónico/Contraseña'";
    }
    showErr("registerError", m);
  }
});

async function googleAuth() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email,
        phone: "",
        role: ADMIN_EMAILS.includes(user.email) ? "admin" : "user",
        createdAt: serverTimestamp()
      });
      console.log("✅ Usuario de Google guardado en Firestore:", user.email);
    }
    
    showToast("¡Bienvenido! 🥢", "success");
  } catch (e) {
    console.error("Google auth error:", e);
    if (e.code === "auth/popup-closed-by-user") {
      return;
    } else if (e.code === "auth/operation-not-allowed") {
      showToast("⚠️ El inicio con Google no está habilitado. Ve a Firebase Console y habilita Google.", "error");
    } else if (e.code === "auth/account-exists-with-different-credential") {
      showToast("Ya existe una cuenta con este correo. Inicia sesión con tu contraseña.", "error");
    } else {
      showToast("Error con Google. Intenta de nuevo.", "error");
    }
  }
}

document.getElementById("btnGoogle")?.addEventListener("click", googleAuth);
document.getElementById("btnGoogleReg")?.addEventListener("click", googleAuth);