/**
 * SCRIPT OPTIMIZADO - Perfumería VELOURS
 * Incluye: mejor parsing CSV, validaciones, cache localStorage, y UX mejorada
 */

// ===== CONFIGURACIÓN =====
const CONFIG = {
    SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1NFr-sfM4kG0NFPc6peUqKmnxuNcMHq28KcgFdlGT5xGNwBhhpslcwHoI8L2lH2hh7dvN9-dRfIrL/pub?output=csv",
    CACHE_KEY: "perfumes_cache",
    CACHE_DURATION: 600000, // 1 hora
    WHATSAPP_NUMBER: "573214132175", // CAMBIAR POR TU NÚMERO
    DEFAULT_IMAGE: "https://via.placeholder.com/300?text=Perfume"
};

// ===== ESTADO GLOBAL =====
let todosLosProductos = [];
let carrito = [];
let filtroActual = "TODOS";

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    inicializarEventos();
    restaurarCarrito();
});

// ===== CARGA DE PRODUCTOS =====
async function cargarProductos() {
    try {
        // Intentar cargar desde cache primero
        const cached = obtenerCache();

        if (cached && cached.length > 0) {
            console.log("⚡ Cargando desde cache");
            todosLosProductos = cached;
            renderizarProductos(todosLosProductos);
            return;
        }

        console.log("🌐 Cargando desde Google Sheets...");

        // Si no hay cache, cargar desde sheet
        const response = await fetch(CONFIG.SHEET_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.text();
        todosLosProductos = parsearCSV(data);

        // Guardar en cache
        guardarCache(todosLosProductos);
        renderizarProductos(todosLosProductos);
    } catch (error) {
        console.error("❌ Error cargando inventario:", error);
        mostrarError("No se pudo cargar los productos. Intenta de nuevo más tarde.");
    }
}

/**
 * Parsea CSV de forma robusta (maneja comillas y valores complejos)
 */
function parsearCSV(data) {
    const filas = data.split(/\r?\n/).filter(line => line.trim() !== "");

    if (filas.length < 2) {
        console.warn("⚠️ CSV vacío o sin encabezados");
        return [];
    }

    return filas.slice(1)
        .map(fila => {
            try {
                const columnas = extraerColumnas(fila);
                return {
                    nombre: limpiarValor(columnas[0]),
                    precio: parseInt(columnas[1]?.replace(/\D/g, '')) || 0,
                    categoria: limpiarValor(columnas[2]),
                    imagen: limpiarValor(columnas[3]) || CONFIG.DEFAULT_IMAGE,
                    oferta: limpiarValor(columnas[4]).toUpperCase() === "SI"
                };
            } catch (error) {
                console.warn("⚠️ Error parseando fila:", fila, error);
                return null;
            }
        })
        .filter(p => p && p.nombre && p.precio > 0);
}

/**
 * Extrae columnas considerando comillas escapadas
 */
function extraerColumnas(fila) {
    const columnas = [];
    let actual = "";
    let dentroDeComas = false;

    for (let i = 0; i < fila.length; i++) {
        const char = fila[i];
        const siguienteChar = fila[i + 1];

        if (char === '"') {
            if (dentroDeComas && siguienteChar === '"') {
                actual += '"';
                i++;
            } else {
                dentroDeComas = !dentroDeComas;
            }
        } else if (char === ',' && !dentroDeComas) {
            columnas.push(actual.trim());
            actual = "";
        } else {
            actual += char;
        }
    }

    columnas.push(actual.trim());
    return columnas;
}

/**
 * Limpia valores removiendo comillas y espacios extras
 */
function limpiarValor(valor) {
    return valor?.replace(/^"|"$/g, '').trim() || "";
}

// ===== CACHE EN LOCALSTORAGE =====
function guardarCache(productos) {
    try {
        const cache = {
            datos: productos,
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.warn("⚠️ No se pudo guardar en cache:", error);
    }
}

function obtenerCache() {
    try {
        const cache = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY));
        if (!cache) return null;

        const ahora = Date.now();
        if (ahora - cache.timestamp > CONFIG.CACHE_DURATION) {
            localStorage.removeItem(CONFIG.CACHE_KEY);
            return null;
        }

        return cache.datos;
    } catch (error) {
        console.warn("⚠️ Error leyendo cache:", error);
        return null;
    }
}

// ===== RENDERIZADO DE PRODUCTOS =====
function renderizarProductos(lista) {
    const contenedor = document.getElementById("contenedor-productos");

    if (lista.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <p>🔍 No se encontraron fragancias</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = lista.map(p => `
        <div class="product-card" role="article" aria-label="Producto: ${p.nombre}">
            <div class="product-image-container" role="img" aria-label="Imagen de ${p.nombre}">
                ${p.oferta ? '<div class="ribbon" aria-label="En oferta">¡Oferta!</div>' : ''}
                <img 
                    src="${p.imagen}" 
                    alt="${p.nombre}"
                    loading="lazy"
                    onerror="this.src='${CONFIG.DEFAULT_IMAGE}'"
                    title="${p.nombre}"
                >
            </div>

            <div class="product-info">
                <h3 class="product-name" title="${p.nombre}">${escapeHTML(p.nombre)}</h3>
                <p class="product-category">${escapeHTML(p.categoria)}</p>
                
                <div class="product-footer">
                    <span class="product-price" aria-label="Precio: ${formatearPrecio(p.precio)}">
                        $${formatearPrecio(p.precio)}
                    </span>
                    <button 
                        onclick="agregarAlCarrito('${escapeHTML(p.nombre)}', ${p.precio})"
                        class="add-to-cart"
                        title="Agregar ${p.nombre} al carrito"
                        aria-label="Agregar ${p.nombre} al carrito"
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Escapa caracteres especiales HTML para prevenir XSS
 */
function escapeHTML(texto) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return texto.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Formatea números como moneda
 */
function formatearPrecio(precio) {
    return precio.toLocaleString('es-CO');
}

// ===== FILTRADO Y BÚSQUEDA =====
function filtrarProductos(criterio) {
    filtroActual = criterio;
    let filtrados = [];

    if (criterio === 'TODOS') {
        filtrados = todosLosProductos;
    } else if (criterio === 'SI') {
        filtrados = todosLosProductos.filter(p => p.oferta);
    } else {
        filtrados = todosLosProductos.filter(p =>
            p.categoria.toLowerCase().includes(criterio.toLowerCase())
        );
    }

    renderizarProductos(filtrados);
}

function buscarProducto() {
    const query = document.getElementById('buscador').value.toLowerCase().trim();

    if (!query) {
        renderizarProductos(todosLosProductos);
        return;
    }

    const filtrados = todosLosProductos.filter(p =>
        p.nombre.toLowerCase().includes(query) ||
        p.categoria.toLowerCase().includes(query)
    );

    renderizarProductos(filtrados);
}

// ===== GESTIÓN DEL CARRITO =====
function agregarAlCarrito(nombre, precio) {
    carrito.push({ nombre, precio, id: Date.now() });
    actualizarCarritoUI();
    guardarCarrito();

    // Abrir carrito automáticamente
    if (!document.getElementById('cart-sidebar').classList.contains('open')) {
        toggleCart();
    }

    mostrarNotificacion(`✓ ${nombre} agregado al carrito`);
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    actualizarCarritoUI();
    guardarCarrito();
}

function actualizarCarritoUI() {
    const lista = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total');
    const countElement = document.getElementById('cart-count');
    const whatsappBtn = document.querySelector('.whatsapp-button');

    countElement.innerText = carrito.length;

    if (carrito.length === 0) {
        lista.innerHTML = '<div class="cart-empty">Tu carrito está vacío</div>';
        whatsappBtn.disabled = true;
    } else {
        lista.innerHTML = carrito.map((item, index) => `
            <div class="cart-item" role="listitem">
                <div class="cart-item-info">
                    <p class="cart-item-name">${escapeHTML(item.nombre)}</p>
                    <p class="cart-item-price">$${formatearPrecio(item.precio)}</p>
                </div>
                <button 
                    onclick="eliminarDelCarrito(${item.id})"
                    class="remove-item"
                    title="Eliminar ${item.nombre}"
                    aria-label="Eliminar ${item.nombre}"
                >
                    ✕
                </button>
            </div>
        `).join('');
        whatsappBtn.disabled = false;
    }

    const total = carrito.reduce((sum, item) => sum + item.precio, 0);
    totalElement.innerText = `$${formatearPrecio(total)}`;
}

function restaurarCarrito() {
    try {
        const saved = localStorage.getItem('carrito_items');
        if (saved) {
            carrito = JSON.parse(saved);
            actualizarCarritoUI();
        }
    } catch (error) {
        console.warn("⚠️ Error restaurando carrito:", error);
        carrito = [];
    }
}

function guardarCarrito() {
    try {
        localStorage.setItem('carrito_items', JSON.stringify(carrito));
    } catch (error) {
        console.warn("⚠️ No se pudo guardar el carrito:", error);
    }
}

// ===== CARRITO LATERAL =====
function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
}

// ===== SIDEBAR MOBILE =====
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('mobile-open');
}

// ===== WHATSAPP =====
function enviarWhatsApp() {
    if (carrito.length === 0) {
        alert("⚠️ Tu carrito está vacío");
        return;
    }

    let mensaje = "Hola 👋 Velours, me interesa este pedido:\n\n";
    let total = 0;

    carrito.forEach((item, i) => {
        mensaje += `${i + 1}. *${item.nombre}* - $${formatearPrecio(item.precio)}\n`;
        total += item.precio;
    });

    mensaje += `\n*TOTAL: $${formatearPrecio(total)}*\n\n¿Cuál es la disponibilidad?`;

    // Validar número de WhatsApp
    if (!CONFIG.WHATSAPP_NUMBER || CONFIG.WHATSAPP_NUMBER === "573000000000") {
        alert("⚠️ Número de WhatsApp no configurado. Contáctate con el administrador.");
        return;
    }

    window.open(
        `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`,
        '_blank'
    );
}

// ===== UTILIDADES =====
function mostrarNotificacion(mensaje) {
    // Crear elemento de notificación
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 100;
        font-weight: bold;
        animation: slideIn 0.3s ease-out;
    `;
    notif.innerText = mensaje;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notif.remove(), 300);
    }, 2000);
}

function mostrarError(mensaje) {
    const error = document.createElement('div');
    error.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 100;
        font-weight: bold;
    `;
    error.innerText = mensaje;
    document.body.appendChild(error);

    setTimeout(() => error.remove(), 4000);
}

// ===== EVENTOS =====
function inicializarEventos() {
    // Cerrar carrito con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const cartSidebar = document.getElementById('cart-sidebar');
            if (cartSidebar.classList.contains('open')) {
                toggleCart();
            }
        }
    });

    // Cerrar carrito si se hace click fuera
    document.addEventListener('click', (e) => {
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar.classList.contains('open') &&
            !cartSidebar.contains(e.target) &&
            !e.target.closest('.cart-button')) {
            toggleCart();
        }
    });

    // Cerrar sidebar mobile al hacer click en botón de navegación
    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (window.innerWidth < 768 && sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });
}
