import { menuData } from "./data.js";
import { initLoader, initScrollHeader, initHamburger, setActiveNav, initAuthNav } from "./nav.js";

initLoader(); initScrollHeader(); initHamburger(); setActiveNav(); initAuthNav();

let activeCategory = "entradas";
let activeFilter   = "all";

const urlCat = new URLSearchParams(window.location.search).get("cat");
if (urlCat && menuData[urlCat]) {
  activeCategory = urlCat;
  document.querySelectorAll(".menu-tab").forEach(b => {
    b.classList.toggle("active", b.dataset.cat === urlCat);
  });
}

renderMenu();

document.querySelectorAll(".menu-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".menu-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.cat;
    renderMenu();
  });
});

document.querySelectorAll(".mf-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mf-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderMenu();
  });
});

document.getElementById("dishClose")?.addEventListener("click", closeDish);
document.getElementById("dishOverlay")?.addEventListener("click", e => {
  if (e.target === document.getElementById("dishOverlay")) closeDish();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDish(); });

function renderMenu() {
  const grid = document.getElementById("menuGrid");
  grid.classList.add("fading");

  setTimeout(() => {
    let items = menuData[activeCategory] || [];

    if (activeFilter === "spicy")  items = items.filter(i => i.spicy);
    if (activeFilter === "veg")    items = items.filter(i => i.veg);

    grid.innerHTML = "";

    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--ink-50)">Sin resultados para este filtro.</div>`;
    } else {
      items.forEach(item => {
        const card = document.createElement("div");
        card.className = "menu-card";

        const tags = [
          item.spicy   ? `<span class="mc-tag spicy">🌶️ Picante</span>` : "",
          item.veg     ? `<span class="mc-tag veg">🌿 Veg</span>`      : "",
          item.alcohol ? `<span class="mc-tag alc">🍶 Alcohol</span>`  : "",
        ].filter(Boolean).join("");

        const isImage = item.img && (
          item.img.endsWith(".jpg") ||
          item.img.endsWith(".png") ||
          item.img.endsWith(".jpeg") ||
          item.img.startsWith("http")
        );

        const imgHtml = isImage
          ? `<img src="${item.img}" alt="${item.name}" class="mc-img">`
          : `<div class="mc-emoji">${item.emoji || "🍽️"}</div>`;

        card.innerHTML = `
          <div class="mc-image">
            ${imgHtml}
          </div>
          <div class="mc-body">
            <div class="mc-num">#${String(item.id).padStart(2,"0")}</div>
            <div class="mc-name">${item.name}</div>
            <div class="mc-desc">${item.desc}</div>
            <div class="mc-foot">
              <span class="mc-price">$${item.price}</span>
              <div class="mc-tags">${tags}</div>
            </div>
          </div>
        `;

        card.addEventListener("click", () => openDish(item));
        grid.appendChild(card);
      });
    }

    grid.classList.remove("fading");
  }, 150);
}

function openDish(item) {
  const overlay = document.getElementById("dishOverlay");
  const content = document.getElementById("dishContent");
  const catLabel = { entradas:"Entrada", principales:"Plato Principal", postres:"Postre", bebidas:"Bebida" };
  const cat = Object.entries(menuData).find(([,arr]) => arr.includes(item))?.[0] || "";
  const tags = [
    item.spicy   ? `<span class="mc-tag spicy">🌶️ Picante</span>`  : "",
    item.veg     ? `<span class="mc-tag veg">🌿 Vegetariano</span>`: "",
    item.alcohol ? `<span class="mc-tag alc">🍶 Contiene alcohol</span>` : "",
  ].filter(Boolean).join("");

  const isImage = item.img && (
    item.img.endsWith(".jpg") ||
    item.img.endsWith(".jpeg") ||
    item.img.endsWith(".png") ||
    item.img.endsWith(".webp") ||
    item.img.startsWith("http")
  );
  const imgHtml = isImage
    ? `<div style="display:flex;justify-content:center;margin-bottom:20px"><img src="${item.img}" alt="${item.name}" style="width:160px;height:160px;object-fit:cover;border-radius:20px;box-shadow:0 8px 24px rgba(26,18,8,0.15);"></div>`
    : `<div class="dish-emoji">${item.emoji || "🍽️"}</div>`;

  content.innerHTML = `
    ${imgHtml}
    <div class="dish-name">${item.name}</div>
    <div class="dish-catbadge">${catLabel[cat] || ""} · #${String(item.id).padStart(2,"0")}</div>
    <p class="dish-desc">${item.desc}</p>
    ${tags ? `<div class="dish-meta">${tags}</div>` : ""}
    <div class="dish-price">$${item.price} MXN</div>
    <div class="dish-price-note">Precio por porción</div>
  `;
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDish() {
  document.getElementById("dishOverlay")?.classList.add("hidden");
  document.body.style.overflow = "";
}