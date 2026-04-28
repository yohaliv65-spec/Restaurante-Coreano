
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where,
  orderBy, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { tableLayouts } from "./data.js";
import { initLoader, initScrollHeader, initHamburger, setActiveNav, initAuthNav, showToast, formatDate, todayStr } from "./nav.js";

initLoader(); 
initScrollHeader(); 
initHamburger(); 
setActiveNav(); 
initAuthNav();

let currentUser = null;
let selectedZone = "interior";
let selectedTable = null;
let guestCount = 2;
let occupiedMap = {};
let dateStr = "";
let timeStr = "";

onAuthStateChanged(auth, async (user) => {
  console.log("Usuario autenticado:", user);
  currentUser = user;
  
  if (user) {
    document.getElementById("authGate").classList.add("hidden");
    document.getElementById("reservContent").classList.remove("hidden");
    
    setupForm();
    
    await loadMyReservations();
  } else {
    document.getElementById("authGate").classList.remove("hidden");
    document.getElementById("reservContent").classList.add("hidden");
  }
});

function setupForm() {
  console.log("Configurando formulario...");
  
  const today = todayStr();
  const dateInput = document.getElementById("reservDate");
  dateInput.min = today;
  dateInput.value = today;
  dateStr = today;
  
  dateInput.addEventListener("change", (e) => {
    dateStr = e.target.value;
    console.log("Fecha seleccionada:", dateStr);
    fetchOccupied();
    renderMap();
    clearSelectedTable();
  });

  const timeSelect = document.getElementById("reservTime");
  timeSelect.addEventListener("change", (e) => {
    timeStr = e.target.value;
    console.log("Hora seleccionada:", timeStr);
    fetchOccupied();
    renderMap();
    clearSelectedTable();
  });

  document.getElementById("guestMinus").addEventListener("click", () => {
    if (guestCount > 1) {
      guestCount--;
      document.getElementById("guestCount").textContent = guestCount;
    }
  });
  
  document.getElementById("guestPlus").addEventListener("click", () => {
    if (guestCount < 12) {
      guestCount++;
      document.getElementById("guestCount").textContent = guestCount;
    }
  });

  document.querySelectorAll(".zone-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".zone-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedZone = btn.dataset.zone;
      console.log("Zona seleccionada:", selectedZone);
      await fetchOccupied();
      renderMap();
      clearSelectedTable();
    });
  });

  document.querySelectorAll("input[name='notif']").forEach(r => {
    r.addEventListener("change", () => {
      const wa = document.getElementById("whatsappField");
      wa.classList.toggle("hidden", r.value !== "whatsapp");
    });
  });

  document.getElementById("btnReserve").addEventListener("click", handleReserve);
  
  fetchOccupied();
  renderMap();
}

async function fetchOccupied() {
  if (!dateStr || !timeStr) return;
  
  console.log("Buscando ocupadas para:", dateStr, timeStr, selectedZone);
  occupiedMap = {};
  
  try {
    const q = query(
      collection(db, "reservations"),
      where("date", "==", dateStr),
      where("time", "==", timeStr),
      where("zone", "==", selectedZone),
      where("status", "in", ["pending", "confirmed"])
    );
    
    const snap = await getDocs(q);
    snap.forEach(d => {
      const r = d.data();
      occupiedMap[r.tableId] = r.status;
    });
    console.log("Mesas ocupadas:", occupiedMap);
  } catch (error) {
    console.error("Error al obtener ocupadas:", error);
  }
}

function renderMap() {
  const svg = document.getElementById("tableMapSVG");
  if (!svg) {
    console.error("No se encontró el SVG del mapa");
    return;
  }
  
  const layer = document.getElementById("mapTablesLayer");
  const deco = document.getElementById("mapDecoLayer");
  if (!layer || !deco) return;
  
  layer.innerHTML = "";
  
  const tables = tableLayouts[selectedZone] || [];
  const W = 600, H = 420;
  
  deco.innerHTML = `
    <rect width="600" height="420" rx="16" fill="#FDF8F0"/>
    <text x="300" y="24" text-anchor="middle" font-size="12" fill="#1A1208" opacity=".3" font-family="DM Sans">
      ${selectedZone === "interior" ? "🏮 INTERIOR" : selectedZone === "terraza" ? "🌿 TERRAZA" : "🏯 SEGUNDO PISO"}
    </text>
  `;
  
  tables.forEach(table => {
    const cx = (table.x / 100) * W;
    const cy = (table.y / 100) * H;
    
    let status = "available";
    if (occupiedMap[table.id] === "confirmed") status = "occupied";
    else if (occupiedMap[table.id] === "pending") status = "pending";
    if (selectedTable?.id === table.id) status = "selected";
    
    const colors = {
      available: { fill: "#F0FDF4", stroke: "#4ADE80", text: "#166534" },
      selected: { fill: "#C8392B", stroke: "#9E2A1E", text: "#FFFFFF" },
      pending: { fill: "#FFFBEB", stroke: "#FCD34D", text: "#92400E" },
      occupied: { fill: "#F1F5F9", stroke: "#94A3B8", text: "#64748B" }
    }[status];
    
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.style.cursor = status !== "occupied" ? "pointer" : "not-allowed";
    
    if (table.shape === "round" || table.shape === "oval") {
      const rx = table.shape === "oval" ? 44 : 30;
      const ry = table.shape === "oval" ? 26 : 30;
      g.innerHTML = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2.5"/>`;
    } else if (table.shape === "bar") {
      g.innerHTML = `<rect x="${cx-42}" y="${cy-14}" width="84" height="28" rx="14" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2.5"/>`;
    } else {
      const w = table.shape === "rect-lg" ? 74 : 58;
      const h = 40;
      g.innerHTML = `<rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="8" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2.5"/>`;
    }
    
    const shortName = table.name.replace("Mesa ", "M").replace("Terraza ", "T").replace("Salón ", "").replace("Privado ", "P");
    
    g.innerHTML += `
      <text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="11" font-weight="700" fill="${colors.text}" font-family="DM Sans" pointer-events="none">${shortName}</text>
      <text x="${cx}" y="${cy+11}" text-anchor="middle" font-size="9" fill="${colors.text}" opacity=".75" pointer-events="none">${table.seats}p ${status === "occupied" ? "🔴" : status === "pending" ? "⏳" : ""}</text>
    `;
    
    if (status !== "occupied") {
      g.addEventListener("click", () => handleTableClick(table));
    }
    
    layer.appendChild(g);
  });
}

function handleTableClick(table) {
  if (!dateStr || !timeStr) {
    showToast("Selecciona fecha y horario primero", "warn");
    return;
  }
  
  if (occupiedMap[table.id] === "confirmed") {
    showToast("Esta mesa ya está ocupada en ese horario", "error");
    return;
  }
  
  selectedTable = table;
  renderMap();
  showSummary(table);
}

function clearSelectedTable() {
  selectedTable = null;
  document.getElementById("selectedSummary").innerHTML = `<p class="summary-hint">← Selecciona una mesa en el mapa</p>`;
  document.getElementById("reservFormFull").classList.add("hidden");
}

function showSummary(table) {
  const zoneName = { interior: "🏮 Interior", terraza: "🌿 Terraza", segundo: "🏯 Segundo Piso" }[selectedZone];
  document.getElementById("selectedSummary").innerHTML = `
    <div class="selected-summary-data">
      <div class="ss-table-name">${table.name}</div>
      <div class="ss-row"><span class="ss-label">📍 Zona</span><span class="ss-val">${zoneName}</span></div>
      <div class="ss-row"><span class="ss-label">👥 Capacidad</span><span class="ss-val">hasta ${table.seats} personas</span></div>
      <div class="ss-row"><span class="ss-label">📅 Fecha</span><span class="ss-val">${formatDate(dateStr)}</span></div>
      <div class="ss-row"><span class="ss-label">⏰ Hora</span><span class="ss-val">${timeStr} hrs</span></div>
    </div>
  `;
  document.getElementById("reservFormFull").classList.remove("hidden");
}


async function handleReserve() {
  console.log("=== INICIANDO RESERVA ===");
  
  if (!currentUser) {
    showToast("Debes iniciar sesión", "error");
    return;
  }
  
  if (!dateStr || !timeStr || !selectedTable) {
    showToast("Selecciona fecha, hora y mesa", "warn");
    return;
  }
  
  if (guestCount > selectedTable.seats) {
    showToast(`Esta mesa solo acepta hasta ${selectedTable.seats} personas`, "error");
    return;
  }
  
  const notif = document.querySelector("input[name='notif']:checked")?.value || "email";
  let phone = "";
  
  if (notif === "whatsapp") {
    phone = document.getElementById("reservPhone").value.trim();
    if (!phone) {
      showToast("Ingresa tu número de WhatsApp", "error");
      return;
    }
  }
  
  const btn = document.getElementById("btnReserve");
  btn.disabled = true;
  btn.textContent = "Enviando...";
  
  try {
    let userName = currentUser.displayName || currentUser.email;
    let userPhone = phone;
    
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userName = userData.name || userName;
        userPhone = userData.phone || phone;
        console.log("Datos usuario desde Firestore:", userData);
      }
    } catch (err) {
      console.log("Error obteniendo usuario:", err);
    }
    
    const reservationData = {
      userId: currentUser.uid,
      userName: userName,
      userEmail: currentUser.email,
      userPhone: userPhone,
      notifVia: notif,
      zone: selectedZone,
      tableId: selectedTable.id,
      tableName: selectedTable.name,
      tableSeats: selectedTable.seats,
      date: dateStr,
      time: timeStr,
      guests: guestCount,
      notes: document.getElementById("reservNotes").value.trim() || "",
      status: "pending",
      createdAt: serverTimestamp()
    };
    
    console.log("Guardando reserva:", reservationData);
    
    const docRef = await addDoc(collection(db, "reservations"), reservationData);
    console.log("✅ Reserva creada con ID:", docRef.id);
    
    showToast("✅ Reservación creada correctamente", "success");
    
    clearSelectedTable();
    await fetchOccupied();
    renderMap();
    await loadMyReservations();
    
    document.getElementById("reservNotes").value = "";
    if (notif === "whatsapp") {
      document.getElementById("reservPhone").value = "";
    }
    
  } catch (error) {
    console.error("Error al reservar:", error);
    showToast("❌ Error al crear la reservación: " + error.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Confirmar Reservación";
  }
}

async function loadMyReservations() {
  if (!currentUser) return;
  
  const list = document.getElementById("myReservList");
  list.innerHTML = "<p>Cargando...</p>";
  
  try {
    const q = query(
      collection(db, "reservations"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    
    const snap = await getDocs(q);
    
    if (snap.empty) {
      list.innerHTML = "<p>No tienes reservaciones aún.</p>";
      return;
    }
    
    list.innerHTML = "";
    const labels = { pending: "⏳ Pendiente", confirmed: "✅ Confirmada", cancelled: "❌ Cancelada" };
    
    snap.forEach(d => {
      const r = d.data();
      const card = document.createElement("div");
      card.className = `mr-card status-${r.status}`;
      card.innerHTML = `
        <div>
          <div class="mr-title">${r.tableName}</div>
          <div class="mr-detail">📅 ${formatDate(r.date)} · ⏰ ${r.time} hrs · 👥 ${r.guests} personas</div>
          ${r.notes ? `<div class="mr-notes">📝 ${r.notes}</div>` : ""}
        </div>
        <div class="mr-right">
          <span class="badge badge-${r.status}">${labels[r.status] || r.status}</span>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (error) {
    console.error("Error al cargar reservas:", error);
    list.innerHTML = "<p>Error al cargar tus reservaciones</p>";
  }
}