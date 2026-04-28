import { auth, ADMIN_EMAILS } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const inPages = window.location.pathname.includes("/pages/");
const base = inPages ? "../" : "./";

export function initLoader() {
  window.addEventListener("load", () => {
    setTimeout(() => {
      const loader = document.querySelector(".page-loader");
      if (loader) loader.classList.add("out");
    }, 500);
  });
}

export function initScrollHeader() {
  const h = document.getElementById("mainHeader");
  if (!h) return;
  window.addEventListener("scroll", () => {
    h.classList.toggle("scrolled", window.scrollY > 50);
  });
}

export function initHamburger() {
  const btn = document.getElementById("hamburger");
  const links = document.getElementById("navLinks");

  if (!btn || !links) return;

  // Guardar posición original en el DOM para poder restaurar en desktop
  const originalParent = links.parentNode;
  const originalNextSibling = links.nextSibling;

  let overlay = document.querySelector(".nav-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    document.body.appendChild(overlay);
  }

  function moveToBody() {
    if (links.parentNode !== document.body) {
      document.body.appendChild(links);
    }
  }

  function restoreToNav() {
    if (links.parentNode === document.body) {
      if (originalNextSibling) {
        originalParent.insertBefore(links, originalNextSibling);
      } else {
        originalParent.appendChild(links);
      }
    }
  }

  function closeMenu() {
    links.classList.remove("open");
    btn.classList.remove("active");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  function openMenu() {
    links.classList.add("open");
    btn.classList.add("active");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Solo mover al body en mobile para romper herencia del header
  if (window.innerWidth <= 767) {
    moveToBody();
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (links.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener("click", closeMenu);

  const allLinks = document.querySelectorAll(".nav-link");
  allLinks.forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 767) {
      closeMenu();
      restoreToNav();
    } else {
      moveToBody();
    }
  });
}

export function setActiveNav() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach(link => {
    const href = link.getAttribute("href")?.split("/").pop() || "";
    if (href === current || (current === "index.html" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

export function initAuthNav() {
  const area = document.getElementById("navUserArea");
  if (!area) return;
  
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      area.innerHTML = `
        <a href="${base}pages/login.html" class="btn-nav-ghost">Iniciar sesión</a>
        <a href="${base}pages/login.html#register" class="btn-nav-primary">Registrarse</a>
      `;
      
      const navLinks = document.getElementById("navLinks");
      if (navLinks && !document.querySelector(".mobile-auth-btns")) {
        const mobileBtns = document.createElement("div");
        mobileBtns.className = "mobile-auth-btns";
        mobileBtns.innerHTML = `
          <a href="${base}pages/login.html" class="btn-nav-mobile ghost">Iniciar sesión</a>
          <a href="${base}pages/login.html#register" class="btn-nav-mobile primary">Registrarse</a>
        `;
        navLinks.appendChild(mobileBtns);
      }
      return;
    }
    
    const isAdmin = ADMIN_EMAILS.includes(user.email);
    const initial = (user.displayName || user.email || "U")[0].toUpperCase();
    const shortName = (user.displayName || user.email).split("@")[0].split(" ")[0];
    
    let adminLinkHtml = '';
    if (isAdmin) {
      adminLinkHtml = `<a href="${base}pages/admin.html" class="nav-admin-link">⚙️ Admin</a>`;
    }
    
    area.innerHTML = `
      <div class="nav-user-area">
        <div class="nav-user-avatar">${initial}</div>
        <div class="nav-user-info">
          <a href="${base}pages/mi-cuenta.html" class="nav-user-name-link">${shortName}</a>
          ${isAdmin ? '<span class="nav-user-badge">Admin</span>' : ''}
        </div>
        ${adminLinkHtml}
        <button class="nav-user-logout" id="btnLogoutNav" title="Cerrar sesión">Salir</button>
      </div>
    `;
    
    const logoutBtn = document.getElementById("btnLogoutNav");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = base + "index.html";
      });
    }
    
    const mobileBtns = document.querySelector(".mobile-auth-btns");
    if (mobileBtns) mobileBtns.remove();
  });
}

export function showToast(msg, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(container);
  }
  
  const toast = document.createElement("div");
  const colors = { success: "#16A34A", error: "#C8392B", info: "#1A1208", warn: "#D4A843" };
  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = msg;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export const formatDate = (str) => {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
};

export const todayStr = () => new Date().toISOString().split("T")[0];