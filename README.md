# 🥢 Hanshikdang – Sistema Completo de Restaurante Coreano

## Estructura del Proyecto

```
hanshikdang/
├── index.html                 ← Página principal (Hero, categorías, highlights)
├── firestore.rules            ← Reglas de seguridad Firestore
│
├── pages/
│   ├── login.html             ← Login + Registro con Google
│   ├── menu.html              ← Menú completo (50 platillos)
│   ├── reservaciones.html     ← Mapa SVG de mesas + sistema de reservas
│   ├── nosotros.html          ← Historia, valores, espacios
│   ├── contacto.html          ← Formulario + info de contacto
│   ├── mi-cuenta.html         ← Perfil de usuario + historial
│   └── admin.html             ← Panel de administrador completo
│
├── css/
│   ├── base.css               ← Variables, reset, nav, footer, componentes
│   ├── index.css              ← Estilos de la página principal
│   ├── auth.css               ← Login / registro
│   ├── menu.css               ← Menú de platillos
│   ├── reservaciones.css      ← Mapa de mesas y formulario
│   ├── nosotros.css           ← Página nosotros
│   ├── contacto.css           ← Página de contacto
│   ├── micuenta.css           ← Perfil de usuario
│   └── admin.css              ← Panel de administrador
│
└── js/
    ├── firebase-config.js     ← ⚠️ CONFIGURAR AQUÍ
    ├── data.js                ← Menú (50 platillos) + layout de mesas
    ├── nav.js                 ← Navegación, auth header, toasts, utilidades
    ├── auth.js                ← Login, registro, Google Auth
    ├── menu.js                ← Renderizado del menú + filtros
    ├── reservaciones.js       ← Mapa SVG + sistema de reservas
    ├── micuenta.js            ← Perfil + historial de reservaciones
    └── admin.js               ← Panel admin completo
```

---

## 🔥 Configuración de Firebase (Paso a Paso)

### 1. Crear proyecto
1. Ve a https://console.firebase.google.com
2. Clic en "Agregar proyecto" → Nombre: `hanshikdang`
3. Acepta y crea el proyecto

### 2. Authentication
1. Panel lateral → **Authentication** → "Comenzar"
2. Pestaña "Sign-in method", habilita:
   - ✅ **Correo electrónico / Contraseña**
   - ✅ **Google**

### 3. Firestore Database
1. Panel lateral → **Firestore Database** → "Crear base de datos"
2. Modo: **Producción** → Elige región `nam5 (us-central)` → Listo
3. Ve a la pestaña **Reglas** y pega el contenido de `firestore.rules`

### 4. Obtener credenciales
1. Ícono ⚙️ → **Configuración del proyecto**
2. Pestaña "General" → sección "Tus apps" → clic en `</>`
3. Registra la app: nombre `Hanshikdang Web`
4. Copia el objeto `firebaseConfig`

### 5. Actualizar firebase-config.js
Abre `js/firebase-config.js` y reemplaza:
```javascript
const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROJECT.firebaseapp.com",
  projectId:         "TU_PROJECT_ID",
  storageBucket:     "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};

export const ADMIN_EMAILS = [
  "admin@hanshikdang.mx",   // ← Cambia por tu email real
];
```

### 6. Crear cuenta de administrador
1. Agrega tu email a `ADMIN_EMAILS` en `firebase-config.js`
2. Abre el sitio y ve a `/pages/login.html`
3. Regístrate con ese email
4. ¡Listo! Tendrás acceso al panel `/pages/admin.html`

---

## 🚀 Cómo correr el proyecto

**Opción A – VS Code Live Server (recomendado):**
1. Instala la extensión "Live Server"
2. Clic derecho en `index.html` → "Open with Live Server"
3. Asegúrate que el servidor corra en `http://localhost:5500`

**Opción B – Python:**
```bash
python3 -m http.server 5500
```
Luego abre http://localhost:5500

**Nota importante:** Los módulos ES6 (`type="module"`) requieren un servidor HTTP. No funcionan abriendo el archivo directamente desde el explorador.

---

## 👥 Roles del Sistema

| Rol | Acceso |
|-----|--------|
| **Visitante** | Ver menú, nosotros, contacto |
| **Usuario** | + Reservaciones, Mi cuenta, historial |
| **Administrador** | + Panel admin: confirmar reservas, ver mapa en tiempo real, gestionar usuarios |

---

## 📅 Flujo de Reservaciones

```
Usuario elige fecha/hora → Mapa SVG muestra disponibilidad →
Usuario selecciona mesa → Llena formulario (notas, notificación) →
Reserva queda en estado "pending" → Admin ve notificación en dashboard →
Admin confirma o cancela → Usuario recibe estado actualizado
```

**Detección de conflictos:** Antes de crear la reserva se hace una consulta en Firestore verificando que no exista otra reserva para la misma mesa, fecha, hora y estado `pending/confirmed`.

---

## 🗺️ Mapa de Mesas

El mapa es un **SVG dinámico** generado con JavaScript:
- Verde (`#4ADE80`) = Disponible
- Rojo (`#C8392B`) = Seleccionada  
- Amarillo (`#FCD34D`) = Pendiente de confirmación
- Gris (`#94A3B8`) = Ocupada/Confirmada

Las posiciones de las mesas están definidas en `js/data.js` con coordenadas `x%/y%` para escalar en cualquier pantalla.

---

## 📱 Notificaciones

El sistema guarda en Firestore el canal de notificación elegido (`email` o `whatsapp`) y el teléfono. Para enviar notificaciones reales se necesita integrar:
- **Email:** Firebase Extensions "Trigger Email" + SendGrid/Mailgun
- **WhatsApp:** API de WhatsApp Business / Twilio

---

## Colecciones en Firestore

```
users/
  {uid}: { name, email, phone, role, createdAt }

reservations/
  {id}: { userId, userName, userEmail, userPhone, notifVia,
          zone, tableId, tableName, tableSeats, date, time,
          guests, notes, status, createdAt }

contactMessages/
  {id}: { name, email, phone, subject, message, createdAt, read }
```
