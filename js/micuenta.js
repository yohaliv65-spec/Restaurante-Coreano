
import { auth, db, ADMIN_EMAILS } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, updateDoc, getDocs, query,
  collection, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initLoader, initScrollHeader, initHamburger, setActiveNav, initAuthNav, showToast, formatDate } from "./nav.js";

initLoader(); initScrollHeader(); initHamburger(); setActiveNav(); initAuthNav();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById("guestMsg").classList.remove("hidden");
    return;
  }
  document.getElementById("cuentaContent").classList.remove("hidden");
  renderProfile(user);
  await loadUserData(user);
});

function renderProfile(user) {
  const initial = (user.displayName || user.email || "U")[0].toUpperCase();
  document.getElementById("cuAvatar").textContent = initial;
  document.getElementById("cuName").textContent   = user.displayName || "Usuario";
  document.getElementById("cuEmail").textContent  = user.email;
  document.getElementById("profileEmail").value   = user.email;
  document.getElementById("profileName").value    = user.displayName || "";

  const roleEl = document.getElementById("cuRole");
  if (ADMIN_EMAILS.includes(user.email)) {
    roleEl.textContent = "👑 Administrador";
    roleEl.classList.add("admin");
  } else {
    roleEl.textContent = "👤 Usuario";
  }
}

async function loadUserData(user) {
 
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const d = snap.data();
      if (d.phone) document.getElementById("profilePhone").value = d.phone;
    }
  } catch(e) {  }


  await loadReservations(user.uid);
}

async function loadReservations(uid) {
  console.log("=== CARGANDO RESERVAS PARA:", uid);
  
  const list = document.getElementById("cuReservList");
  if (!list) return;
  
  list.innerHTML = '<div style="text-align:center;padding:20px;">⏳ Cargando tus reservaciones...</div>';
  
  try {

    const q = query(
      collection(db, "reservations"),
      where("userId", "==", uid)
    );
    
    const snapshot = await getDocs(q);
    console.log("Reservas encontradas:", snapshot.size);

    const reservas = [];
    snapshot.forEach(doc => {
      reservas.push({ id: doc.id, ...doc.data() });
    });
    reservas.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });
    
    let total = 0, confirmed = 0, pending = 0;
    
    if (reservas.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--ink-50);">
          <div style="font-size:48px;margin-bottom:10px;">📅</div>
          <p>No tienes reservaciones aún.</p>
          <a href="reservaciones.html" style="color:var(--red);">Reservar ahora →</a>
        </div>
      `;
    } else {
      list.innerHTML = "";
      
      reservas.forEach(r => {
        total++;
        if (r.status === "confirmed") confirmed++;
        if (r.status === "pending") pending++;
        
        const zoneIcon = { interior: "🏮", terraza: "🌿", segundo: "🏯" }[r.zone] || "🍽️";
        const statusText = r.status === "confirmed" ? "✅ Confirmada" : r.status === "pending" ? "⏳ Pendiente" : "❌ Cancelada";
        const statusColor = r.status === "confirmed" ? "#16A34A" : r.status === "pending" ? "#D4A843" : "#C8392B";
        const statusBg = r.status === "confirmed" ? "#F0FDF4" : r.status === "pending" ? "#FFFBEB" : "#FEF2F2";
        
        const card = document.createElement("div");
        card.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          border-left: 4px solid ${statusColor};
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-weight:700;font-size:16px;">${zoneIcon} ${r.tableName}</div>
              <div style="font-size:13px;color:var(--ink-50);margin-top:4px;">
                📅 ${r.date} · ⏰ ${r.time} hrs · 👥 ${r.guests} personas
              </div>
              ${r.notes ? `<div style="font-size:12px;color:var(--ink-50);margin-top:5px;">📝 ${r.notes}</div>` : ""}
            </div>
            <div>
              <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${statusBg};color:${statusColor}">
                ${statusText}
              </span>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
    }
    
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statConfirmed").textContent = confirmed;
    document.getElementById("statPending").textContent = pending;
    
  } catch (error) {
    console.error("Error cargando reservas:", error);
    list.innerHTML = `<div style="color:red;padding:20px;text-align:center;">❌ Error: ${error.message}</div>`;
  }
}


document.getElementById("btnSaveProfile")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  const name  = document.getElementById("profileName").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  const msgEl = document.getElementById("profileMsg");

  if (!name) { msgEl.textContent="El nombre no puede estar vacío."; msgEl.className="form-error"; return; }

  try {
    await updateProfile(user, { displayName: name });
    await updateDoc(doc(db,"users",user.uid), { name, phone, updatedAt: serverTimestamp() });
    document.getElementById("cuName").textContent = name;
    msgEl.textContent = "✅ Perfil actualizado correctamente.";
    msgEl.className = "form-success";
    msgEl.classList.remove("hidden");
    showToast("Perfil actualizado ✅","success");
    setTimeout(() => msgEl.classList.add("hidden"), 4000);
  } catch(e) {
    msgEl.textContent = "Error al guardar. Intenta de nuevo.";
    msgEl.className = "form-error";
    msgEl.classList.remove("hidden");
  }
});

document.getElementById("btnLogoutCuenta")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../index.html";
});
