import { sendNotification } from "./notificacions.js";
import { auth, db, ADMIN_EMAILS } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, getDocs, doc, updateDoc, query,
  orderBy, serverTimestamp, getDoc, where, addDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from "./nav.js";
import { menuData, tableLayouts } from "./data.js";

setTimeout(() => document.querySelector(".page-loader")?.classList.add("out"), 500);

let currentUser = null;
let mapaZonaActual = "interior";
let mapaFechaActual = "";
let mapaHoraActual = "";
let reservasEnMapa = {};
let unsubscribeReservaciones = null;

function renderAdminUser(user) {
  const el = document.getElementById("adminUserBadge");
  if (!el) return;
  const displayName = user.displayName || user.email;
  const initial = displayName ? displayName[0].toUpperCase() : "A";
  const shortName = displayName.split("@")[0].split(" ")[0];
  el.innerHTML = `<div style="display: flex; align-items: center; gap: 12px; background: var(--cream); padding: 6px 16px 6px 12px; border-radius: 40px; border: 1px solid var(--ink-20);">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--red); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px;">${initial}</div>
      <div style="display: flex; flex-direction: column;"><span style="font-weight: 600; font-size: 14px;">${shortName}</span><span style="font-size: 10px; color: var(--gold);">Administrador</span></div>
      <button id="btnAdminLogoutHeader" style="background: none; border: none; font-size: 13px; color: var(--ink-50); cursor: pointer; padding: 6px 10px;">Salir</button>
    </div>`;
  document.getElementById("btnAdminLogoutHeader")?.addEventListener("click", async () => { await signOut(auth); window.location.href = "../pages/login.html"; });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../pages/login.html"; return; }
  if (!ADMIN_EMAILS.includes(user.email)) { alert("Acceso denegado"); window.location.href = "../pages/mi-cuenta.html"; return; }
  currentUser = user;
  renderAdminUser(user);
  await cargarReservaciones();
  await eliminarReservasExpiradasSilencioso();
});

async function eliminarReservasCanceladas() {
  if (!confirm("¿Eliminar TODAS las reservaciones canceladas?")) return;
  const container = document.getElementById("adminContent");
  container.innerHTML = '<div style="text-align:center;padding:40px;">⏳ Eliminando...</div>';
  try {
    const q = query(collection(db, "reservations"), where("status", "==", "cancelled"));
    const snapshot = await getDocs(q);
    let eliminadas = 0;
    for (const docSnap of snapshot.docs) { await deleteDoc(doc(db, "reservations", docSnap.id)); eliminadas++; }
    showToast(`✅ Se eliminaron ${eliminadas} reservaciones canceladas`, "success");
  } catch (error) { showToast("❌ Error al eliminar", "error"); }
}

async function eliminarReservasExpiradas() {
  if (!confirm("¿Eliminar TODAS las reservaciones con fecha pasada?")) return;
  const container = document.getElementById("adminContent");
  container.innerHTML = '<div style="text-align:center;padding:40px;">⏳ Eliminando...</div>';
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const snapshot = await getDocs(collection(db, "reservations"));
    let eliminadas = 0;
    for (const docSnap of snapshot.docs) {
      const r = docSnap.data();
      const fechaReserva = new Date(r.date); fechaReserva.setHours(0,0,0,0);
      if (fechaReserva < hoy) { await deleteDoc(doc(db, "reservations", docSnap.id)); eliminadas++; }
    }
    showToast(`✅ Se eliminaron ${eliminadas} reservaciones`, "success");
  } catch (error) { showToast("❌ Error", "error"); }
}

async function eliminarReservasExpiradasSilencioso() {
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const snapshot = await getDocs(collection(db, "reservations"));
    for (const docSnap of snapshot.docs) {
      const r = docSnap.data();
      const fechaReserva = new Date(r.date); fechaReserva.setHours(0,0,0,0);
      if (fechaReserva < hoy) await deleteDoc(doc(db, "reservations", docSnap.id));
    }
  } catch (error) {}
}

async function mostrarDetalleReserva(reservaId) {
  try {
    const reservaSnap = await getDoc(doc(db, "reservations", reservaId));
    if (!reservaSnap.exists()) { showToast("No encontrada", "error"); return; }
    const r = reservaSnap.data();
    const modal = document.createElement("div");
    modal.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;`;
    modal.innerHTML = `<div style="background:white;border-radius:20px;padding:30px;max-width:400px;"><h3>📋 Detalle</h3><div><strong>Cliente:</strong> ${r.userName || r.userEmail}</div><div><strong>Email:</strong> ${r.userEmail}</div><div><strong>Mesa:</strong> ${r.tableName}</div><div><strong>Fecha:</strong> ${r.date} ${r.time}</div><div><strong>Personas:</strong> ${r.guests}</div><button id="closeModalBtn" style="margin-top:20px;background:#C8392B;color:white;padding:10px;border-radius:8px;width:100%;">Cerrar</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector("#closeModalBtn").addEventListener("click", () => modal.remove());
  } catch (error) {}
}

// ============================================
// FUNCIÓN PRINCIPAL - CARGAR RESERVACIONES (tiempo real)
// ============================================
function renderTablaReservaciones(snapshot) {
  const container = document.getElementById("adminContent");
  if (!container) return;

  if (snapshot.empty) {
    container.innerHTML = `<div style="text-align:center;padding:40px;"><div style="font-size:48px;">📅</div><h3>No hay reservaciones</h3></div>`;
    return;
  }

  let html = `<div style="background:white;border-radius:16px;border:1px solid #E5E5E0;">
    <div style="padding:18px 24px;background:#F9F9F7;border-bottom:1px solid #E5E5E0;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;"><h2>📅 Reservaciones</h2>
      <div><button id="btnEliminarCanceladas" style="background:#C8392B;color:white;padding:8px 16px;border-radius:8px;">🗑️ Eliminar Canceladas</button>
      <button id="btnEliminarExpiradas" style="background:#64748B;color:white;padding:8px 16px;border-radius:8px;margin-left:8px;">📅 Eliminar Pasadas</button></div></div>
      <p>${snapshot.size} reservaciones</p>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#F5F5F0;"><th style="padding:12px;">Cliente</th><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>`;

  for (const docSnap of snapshot.docs) {
    const id = docSnap.id;
    const r = docSnap.data();
    const zoneIcon = r.zone === "interior" ? "🏮" : r.zone === "terraza" ? "🌿" : "🏯";
    const statusText = r.status === "pending" ? "⏳ Pendiente" : r.status === "confirmed" ? "✅ Confirmada" : "❌ Cancelada";
    const statusBg = r.status === "pending" ? "#FFFBEB" : r.status === "confirmed" ? "#F0FDF4" : "#FEF2F2";
    const statusColor = r.status === "pending" ? "#92400E" : r.status === "confirmed" ? "#166534" : "#991B1B";

    html += `<tr>
      <td style="padding:12px;"><strong>${r.userName || r.userEmail}</strong><br><small>${r.userEmail}</small></td>
      <td style="padding:12px;">${zoneIcon} ${r.tableName}</td>
      <td style="padding:12px;">${r.date}</td>
      <td style="padding:12px;">${r.time}</td>
      <td style="padding:12px;">${r.guests}</td>
      <td style="padding:12px;"><span style="background:${statusBg};color:${statusColor};padding:4px 10px;border-radius:20px;">${statusText}</span></td>
      <td style="padding:12px;">`;

    if (r.status === "pending") {
      html += `<button class="btn-confirm-reserve" data-id="${id}" style="background:#16A34A;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;margin-right:5px;">✓ Confirmar</button>
               <button class="btn-cancel-reserve" data-id="${id}" style="background:#C8392B;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;">✗ Cancelar</button>`;
    } else if (r.status === "confirmed") {
      html += `<button class="btn-cancel-reserve" data-id="${id}" style="background:#C8392B;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;">✗ Cancelar</button>`;
    } else {
      html += `<span style="color:gray;">—</span>`;
    }
    html += `</td></tr>`;
  }

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;

  document.querySelectorAll('.btn-confirm-reserve').forEach(btn => {
    btn.addEventListener('click', () => confirmarReserva(btn.dataset.id));
  });
  document.querySelectorAll('.btn-cancel-reserve').forEach(btn => {
    btn.addEventListener('click', () => cancelarReserva(btn.dataset.id));
  });
  document.getElementById("btnEliminarCanceladas")?.addEventListener("click", eliminarReservasCanceladas);
  document.getElementById("btnEliminarExpiradas")?.addEventListener("click", eliminarReservasExpiradas);
}

function cargarReservaciones() {
  const container = document.getElementById("adminContent");
  if (!container) return;

  // Cancelar listener anterior si existe
  if (unsubscribeReservaciones) {
    unsubscribeReservaciones();
    unsubscribeReservaciones = null;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px;">⏳ Cargando...</div>';

  const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"));

  // onSnapshot actualiza la tabla automáticamente ante cualquier cambio en Firestore
  unsubscribeReservaciones = onSnapshot(q, (snapshot) => {
    renderTablaReservaciones(snapshot);
  }, (error) => {
    if (container) container.innerHTML = `<div style="color:red;padding:40px;">❌ Error: ${error.message}</div>`;
  });
}

// ============================================
// FUNCIONES PARA CONFIRMAR/CANCELAR
// ============================================
async function confirmarReserva(id) {
  console.log("✅ Confirmar reserva ID:", id);
  
  if (!id) {
    showToast("❌ ID de reservación no válido", "error");
    return;
  }
  
  if (!confirm("¿Confirmar esta reservación?")) return;
  
  try {
    const reservaRef = doc(db, "reservations", id);
    const reservaSnap = await getDoc(reservaRef);
    
    if (!reservaSnap.exists()) {
      showToast("❌ No se encontró la reservación", "error");
      console.error("Reserva no encontrada:", id);
      return;
    }
    
    const reserva = reservaSnap.data();
    
    await updateDoc(reservaRef, { 
      status: "confirmed", 
      updatedAt: serverTimestamp(), 
      updatedBy: currentUser?.email 
    });
    
    showToast("✅ Reservación confirmada", "success");
    
    // Enviar notificación
    try {
      await sendNotification(reserva, "confirmed");
    } catch (notifError) {
      console.error("Error al enviar notificación:", notifError);
    }
    
    // Si la vista activa es el mapa, recargarlo (la tabla se actualiza sola por onSnapshot)
    const activeView = document.querySelector(".sb-link.active")?.dataset.view;
    if (activeView === "tables") {
      await cargarMapaMesasConReservas();
    }
    
  } catch (error) {
    console.error("Error al confirmar:", error);
    showToast("❌ Error: " + error.message, "error");
  }
}

async function cancelarReserva(id) {
  console.log("❌ Cancelar reserva ID:", id);
  
  if (!id) {
    showToast("❌ ID de reservación no válido", "error");
    return;
  }
  
  if (!confirm("¿Cancelar esta reservación?")) return;
  
  try {
    const reservaRef = doc(db, "reservations", id);
    const reservaSnap = await getDoc(reservaRef);
    
    if (!reservaSnap.exists()) {
      showToast("❌ No se encontró la reservación", "error");
      console.error("Reserva no encontrada:", id);
      return;
    }
    
    const reserva = reservaSnap.data();
    
    await updateDoc(reservaRef, { 
      status: "cancelled", 
      updatedAt: serverTimestamp(), 
      updatedBy: currentUser?.email 
    });
    
    showToast("✅ Reservación cancelada", "success");
    
    // Enviar notificación
    try {
      await sendNotification(reserva, "cancelled");
    } catch (notifError) {
      console.error("Error al enviar notificación:", notifError);
    }
    
    // Si la vista activa es el mapa, recargarlo (la tabla se actualiza sola por onSnapshot)
    const activeView = document.querySelector(".sb-link.active")?.dataset.view;
    if (activeView === "tables") {
      await cargarMapaMesasConReservas();
    }
    
  } catch (error) {
    console.error("Error al cancelar:", error);
    showToast("❌ Error: " + error.message, "error");
  }
}

async function cargarMapaMesasConReservas() {
  const container = document.getElementById("adminContent");
  const hoy = new Date().toISOString().split("T")[0];
  mapaFechaActual = hoy;
  mapaHoraActual = "19:00";
  mapaZonaActual = "interior";
  container.innerHTML = `<div style="background:white;border-radius:16px;padding:20px;"><h2>🗺️ Mapa de Mesas</h2>
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;"><input type="date" id="mapFecha" value="${hoy}">
    <select id="mapHora"><option value="13:00">13:00</option><option value="14:00">14:00</option><option value="15:00">15:00</option><option value="19:00" selected>19:00</option><option value="20:00">20:00</option><option value="21:00">21:00</option></select>
    <select id="mapZona"><option value="interior">🏮 Interior</option><option value="terraza">🌿 Terraza</option><option value="segundo">🏯 Segundo Piso</option></select>
    <button id="btnActualizarMapa">Actualizar</button></div><div id="mapaMesasContainer">Cargando...</div></div>`;
  document.getElementById("mapFecha").onchange = () => { mapaFechaActual = document.getElementById("mapFecha").value; cargarReservasParaMapa(); };
  document.getElementById("mapHora").onchange = () => { mapaHoraActual = document.getElementById("mapHora").value; cargarReservasParaMapa(); };
  document.getElementById("mapZona").onchange = () => { mapaZonaActual = document.getElementById("mapZona").value; cargarReservasParaMapa(); };
  document.getElementById("btnActualizarMapa").onclick = () => cargarReservasParaMapa();
  await cargarReservasParaMapa();
}

async function cargarReservasParaMapa() {
  if (!mapaFechaActual || !mapaHoraActual) return;
  const container = document.getElementById("mapaMesasContainer");
  if (!container) return;
  try {
    const q = query(collection(db, "reservations"), where("date", "==", mapaFechaActual), where("time", "==", mapaHoraActual), where("zone", "==", mapaZonaActual));
    const snapshot = await getDocs(q);
    reservasEnMapa = {};
    snapshot.forEach(doc => { const r = doc.data(); reservasEnMapa[r.tableId] = { status: r.status, userName: r.userName, guests: r.guests, id: doc.id }; });
    renderizarMapaMesas();
  } catch (error) { container.innerHTML = `<div style="color:red;">Error: ${error.message}</div>`; }
}

function renderizarMapaMesas() {
  const container = document.getElementById("mapaMesasContainer");
  const mesas = tableLayouts[mapaZonaActual] || [];
  let html = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;">`;
  mesas.forEach(mesa => {
    const reserva = reservasEnMapa[mesa.id];
    let color = "#4ADE80", texto = "Disponible", info = "", reservaId = "";
    if (reserva) {
      reservaId = reserva.id;
      if (reserva.status === "pending") { color = "#FCD34D"; texto = "⏳ Pendiente"; info = `<div style="font-size:10px;">${reserva.userName?.split(" ")[0] || "Cliente"} · ${reserva.guests} pers</div>`; }
      else if (reserva.status === "confirmed") { color = "#94A3B8"; texto = "🔴 Confirmada"; info = `<div style="font-size:10px;">${reserva.userName?.split(" ")[0] || "Cliente"} · ${reserva.guests} pers</div>`; }
    }
    const onclickAttr = reserva ? `onclick="window.mostrarDetalleReserva && window.mostrarDetalleReserva('${reservaId}')"` : '';
    html += `<div style="background:${color}20;border:2px solid ${color};border-radius:12px;padding:15px;text-align:center;${reserva ? 'cursor:pointer;' : ''}" ${onclickAttr}>
      <div style="font-size:28px;">🪑</div><div style="font-weight:700;">${mesa.name}</div><div>${mesa.seats} personas</div>
      <div style="margin-top:5px;"><span style="background:${color};padding:3px 8px;border-radius:12px;font-size:10px;">${texto}</span></div>${info}</div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function cargarMenuAdmin() {
  const container = document.getElementById("adminContent");
  let html = `<div style="background:white;border-radius:16px;padding:24px;"><h2>🍽️ Catálogo del Menú</h2><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;">`;
  const categorias = { entradas: "🥢 Entradas", principales: "🍲 Platos Principales", postres: "🍰 Postres", bebidas: "🍹 Bebidas" };
  for (const [key, items] of Object.entries(menuData)) {
    html += `<div style="border:1px solid #ddd;border-radius:12px;"><div style="background:#f5f5f0;padding:12px;"><h3>${categorias[key] || key}</h3><p>${items.length} platillos</p></div><div style="padding:12px;">`;
    items.forEach(item => { html += `<div style="padding:8px 0;border-bottom:1px solid #eee;"><strong>${item.name}</strong> - $${item.price}<br><small style="color:gray;">${item.desc.substring(0,80)}...</small></div>`; });
    html += `</div></div>`;
  }
  html += `</div></div>`;
  container.innerHTML = html;
}

function cargarDashboard() {
  const container = document.getElementById("adminContent");
  container.innerHTML = `<div style="background:white;border-radius:20px;padding:40px;text-align:center;">
    <div style="font-size:64px;">👑</div><h2>Bienvenido al Panel Admin</h2>
    <p>Selecciona una opción del menú lateral</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:30px;">
      <div class="dashboard-card" data-view="reservations" style="background:#FDF8F0;padding:25px;border-radius:16px;cursor:pointer;"><div style="font-size:40px;">📅</div><div>Reservaciones</div></div>
      <div class="dashboard-card" data-view="tables" style="background:#FDF8F0;padding:25px;border-radius:16px;cursor:pointer;"><div style="font-size:40px;">🗺️</div><div>Mapa de Mesas</div></div>
      <div class="dashboard-card" data-view="menu-admin" style="background:#FDF8F0;padding:25px;border-radius:16px;cursor:pointer;"><div style="font-size:40px;">🍽️</div><div>Menú</div></div>
      <div class="dashboard-card" data-view="new-reservation" style="background:#FDF8F0;padding:25px;border-radius:16px;cursor:pointer;"><div style="font-size:40px;">➕</div><div>Nueva Reserva</div></div>
    </div></div>`;
  document.querySelectorAll('.dashboard-card').forEach(card => {
    card.addEventListener('click', () => { document.querySelector(`.sb-link[data-view="${card.dataset.view}"]`)?.click(); });
  });
}

function mostrarFormularioReservaAdmin() {
  const container = document.getElementById("adminContent");
  const hoy = new Date().toISOString().split("T")[0];
  container.innerHTML = `<div style="background:white;border-radius:16px;padding:24px;"><h2>📝 Crear Reserva</h2>
    <div style="max-width:500px;"><input type="text" id="adminNombre" placeholder="Nombre" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;">
    <input type="email" id="adminEmail" placeholder="Email" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;">
    <input type="tel" id="adminTelefono" placeholder="Teléfono" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;">
    <input type="date" id="adminFecha" value="${hoy}" style="width:100%;padding:10px;margin-bottom:10px;border-radius:8px;">
    <select id="adminHora" style="width:100%;padding:10px;margin-bottom:10px;"><option value="13:00">13:00</option><option value="14:00">14:00</option><option value="15:00">15:00</option><option value="19:00">19:00</option><option value="20:00">20:00</option><option value="21:00">21:00</option></select>
    <select id="adminZona" style="width:100%;padding:10px;margin-bottom:10px;"><option value="interior">Interior</option><option value="terraza">Terraza</option><option value="segundo">Segundo Piso</option></select>
    <select id="adminMesa" style="width:100%;padding:10px;margin-bottom:10px;"></select>
    <input type="number" id="adminPersonas" value="2" placeholder="Personas" style="width:100%;padding:10px;margin-bottom:10px;">
    <textarea id="adminNotas" placeholder="Notas" rows="2" style="width:100%;padding:10px;margin-bottom:10px;"></textarea>
    <button id="guardarReservaBtn" style="background:#C8392B;color:white;padding:12px;border-radius:8px;width:100%;">✅ Crear Reserva</button></div></div>`;
  
  const zonaSelect = document.getElementById("adminZona");
  const mesaSelect = document.getElementById("adminMesa");
  function cargarMesas() {
    const mesas = tableLayouts[zonaSelect.value] || [];
    mesaSelect.innerHTML = '<option value="">-- Selecciona mesa --</option>';
    mesas.forEach(m => mesaSelect.innerHTML += `<option value="${m.id}" data-capacity="${m.seats}" data-name="${m.name}">${m.name} (${m.seats} pers)</option>`);
  }
  zonaSelect.onchange = cargarMesas;
  cargarMesas();
  
  document.getElementById("guardarReservaBtn").onclick = async () => {
    const nombre = document.getElementById("adminNombre").value.trim();
    const email = document.getElementById("adminEmail").value.trim();
    const telefono = document.getElementById("adminTelefono").value.trim();
    const fecha = document.getElementById("adminFecha").value;
    const hora = document.getElementById("adminHora").value;
    const zona = document.getElementById("adminZona").value;
    const mesaId = document.getElementById("adminMesa").value;
    const personas = parseInt(document.getElementById("adminPersonas").value);
    const notas = document.getElementById("adminNotas").value.trim();
    if (!nombre || !email || !fecha || !hora || !zona || !mesaId) { showToast("Completa todos los campos", "error"); return; }
    const mesaOption = mesaSelect.options[mesaSelect.selectedIndex];
    const mesaNombre = mesaOption?.dataset?.name || mesaId;
    const mesaCapacity = parseInt(mesaOption?.dataset?.capacity || 0);
    if (personas > mesaCapacity) { showToast(`Capacidad máxima ${mesaCapacity} personas`, "error"); return; }
    try {
      await addDoc(collection(db, "reservations"), { userId: `admin_${Date.now()}`, userName: nombre, userEmail: email, userPhone: telefono, notifVia: "email", zone: zona, tableId: mesaId, tableName: mesaNombre, tableSeats: mesaCapacity, date: fecha, time: hora, guests: personas, notes: notas, status: "confirmed", createdBy: currentUser?.email, createdAt: serverTimestamp() });
      showToast("✅ Reserva creada", "success");
      setTimeout(() => cargarReservaciones(), 1000);
    } catch (error) { showToast("❌ Error: " + error.message, "error"); }
  };
}

document.querySelectorAll(".sb-link[data-view]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const view = btn.dataset.view;
    const titles = { dashboard: "📊 Dashboard", reservations: "📅 Reservaciones", tables: "🗺️ Mapa de Mesas", "menu-admin": "🍽️ Menú", "new-reservation": "➕ Nueva Reserva" };
    document.getElementById("viewTitle").textContent = titles[view] || view;
    document.querySelectorAll(".sb-link").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Cancelar listener de reservaciones si cambiamos a otra vista
    if (view !== "reservations" && unsubscribeReservaciones) {
      unsubscribeReservaciones();
      unsubscribeReservaciones = null;
    }

    if (view === "dashboard") cargarDashboard();
    else if (view === "reservations") cargarReservaciones();
    else if (view === "tables") await cargarMapaMesasConReservas();
    else if (view === "menu-admin") cargarMenuAdmin();
    else if (view === "new-reservation") mostrarFormularioReservaAdmin();
  });
});

document.getElementById("btnAdminLogout")?.addEventListener("click", async () => { await signOut(auth); window.location.href = "../pages/login.html"; });
document.getElementById("sidebarToggle")?.addEventListener("click", () => document.getElementById("adminSidebar")?.classList.toggle("open"));
window.mostrarDetalleReserva = mostrarDetalleReserva;

function initAdminSidebarToggle() {
  const toggleBtn = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("adminSidebar");
  if (!toggleBtn || !sidebar) return;
  toggleBtn.onclick = (e) => { e.preventDefault(); sidebar.classList.toggle("open"); };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAdminSidebarToggle);
else initAdminSidebarToggle();