/**
 * PASEOVIRTUAL - SCRIPT MAESTRO COMPLETO (CON DATOS DE EJEMPLO)
 * Este archivo incluye la lógica de Supabase + Datos de Respaldo (Fallback)
 */

// ==========================================
// 1. CONFIGURACIÓN Y SUPABASE
// ==========================================
const SUPABASE_URL = 'https://asejbhohkbcoixiwdhcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZWpiaG9oa2Jjb2l4aXdkaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjk0NzMsImV4cCI6MjA4MDYwNTQ3M30.kbRKO5PEljZ29_kn6GYKoyGfB_t8xalxtMiq1ovPo4w';

let supabaseClient = null;
try {
    if (window.supabase) {
        const { createClient } = window.supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (err) {
    console.error('❌ Error Supabase:', err);
}

// ==========================================
// 2. BASE DE DATOS DE EJEMPLO (EL "PESO" DEL SCRIPT)
// ==========================================
const FALLBACK_DB = {
    "dogs": [
        {
            "id": "ex_1",
            "nombre": "Fido (Ejemplo)",
            "dueno_email": "cliente@paseos.com",
            "isExample": true,
            "perfil": {
                "raza": "Pastor Alemán",
                "foto_id": "https://images.pexels.com/photos/163036/malamute-dog-animal-163036.jpeg",
                "telefono": "5491155550000",
                "fecha_nacimiento": "2021-05-20",
                "edad": "2 años",
                "sexo": "Macho",
                "dueno": "Juan Pérez",
                "peso": "32kg",
                "energia": "Alta"
            },
            "walks": [
                {
                    "fecha": "2024-03-10",
                    "duracion_minutos": 60,
                    "distancia_km": 4.2,
                    "resumen_diario": "Paseo energético por el parque central. Fido estuvo muy atento.",
                    "fotos": [{ "id": "https://images.pexels.com/photos/163036/malamute-dog-animal-163036.jpeg" }]
                }
            ]
        },
        {
            "id": "ex_2",
            "nombre": "Luna (Ejemplo)",
            "dueno_email": "luna@ejemplo.com",
            "isExample": true,
            "perfil": {
                "raza": "Golden Retriever",
                "foto_id": "https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg",
                "telefono": "59896000000",
                "fecha_nacimiento": "2020-10-15",
                "edad": "3 años",
                "sexo": "Hembra",
                "dueno": "María García",
                "peso": "28kg",
                "energia": "Media"
            },
            "walks": []
        }
    ],
    "trainer_phone": "59896921960"
};

// ==========================================
// 3. MOTOR DE EDAD Y FECHAS
// ==========================================
function parseAgeInput(input) {
    if (!input) return null;
    const trimmed = input.trim().toLowerCase();
    const monthsMap = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    const textDateMatch = trimmed.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de?\s+(\d{4})$/);
    if (textDateMatch) {
        const [, d, m, y] = textDateMatch;
        return new Date(y, monthsMap[m], d).toISOString().split('T')[0];
    }
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateMatch) {
        const [, d, m, y] = dateMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
}

function calculateExactAge(birthStr) {
    if (!birthStr) return '?';
    const birth = new Date(birthStr);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
        years--; months += 12;
    }
    return years === 0 ? `${months} meses` : `${years} años y ${months} meses`;
}

function isBirthdayToday(birthStr) {
    if (!birthStr) return false;
    const b = new Date(birthStr);
    const t = new Date();
    return b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
}

// ==========================================
// 4. VARIABLES GLOBALES Y CARGA DE DATOS
// ==========================================
let TRAINER_PHONE = FALLBACK_DB.trainer_phone;
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let REAL_DOGS = [];
let ALL_DOGS_COMBINED = [];
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [], isEditing = false;
let slideInterval = null, isPlaying = false, carouselAudio = null;
let isAudioEnabled = localStorage.getItem('paseoDogAudio') !== 'off';

async function loadAllDogs() {
    let reals = [];
    if (supabaseClient) {
        const { data, error } = await supabaseClient.from('dogs_real').select('*').order('nombre');
        if (!error) reals = data;
    }
    REAL_DOGS = reals;
    // Combinamos perros de ejemplo con los de la base de datos real
    ALL_DOGS_COMBINED = [...FALLBACK_DB.dogs, ...reals];
    return ALL_DOGS_COMBINED;
}

// ==========================================
// 5. UTILIDADES DE INTERFAZ (UI)
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function getPhotoUrl(id) {
    if (!id) return 'https://via.placeholder.com/150?text=🐶';
    if (String(id).startsWith('http')) return id;
    return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
}

// ==========================================
// 6. DASHBOARD ADMINISTRADOR
// ==========================================
async function loadAdminDashboard() {
    const dogs = await loadAllDogs();
    const list = document.getElementById('dog-list-container');
    const alerts = document.getElementById('birthday-alerts-container');
    
    list.innerHTML = '';
    alerts.innerHTML = '';

    // Alertas de Cumpleaños (Para todos los perros)
    dogs.filter(d => d.perfil.fecha_nacimiento && isBirthdayToday(d.perfil.fecha_nacimiento)).forEach(dog => {
        const alert = document.createElement('div');
        alert.className = 'birthday-alert-card';
        alert.innerHTML = `<div class="birthday-cake-icon">🎂</div><div class="birthday-alert-content">
            <div class="birthday-alert-title">¡Hoy cumple ${dog.nombre}!</div>
            <div class="birthday-alert-message">Está cumpliendo ${calculateExactAge(dog.perfil.fecha_nacimiento)}.</div>
        </div>`;
        alerts.appendChild(alert);
    });

    // Renderizado de lista
    dogs.forEach((d, i) => {
        const isEx = d.isExample ? ' <span style="font-size:0.7rem; color:var(--secondary)">(EJEMPLO)</span>' : '';
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                <img src="${getPhotoUrl(d.perfil.foto_id)}" class="dog-list-thumb">
                <div>
                    <strong>${d.nombre}${isEx}</strong>
                    <small style="display:block; color:var(--text-secondary)">${d.perfil.raza}</small>
                </div>
            </div>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>`;
        list.appendChild(card);
    });
}

// ==========================================
// 7. DASHBOARD DEL PERRO Y CARRUSEL
// ==========================================
function initCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const slides = [];
    currentDog.walks?.forEach(w => w.fotos?.forEach(f => slides.push(f.id)));
    if (!slides.length) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = 'flex';

    let idx = slides.length - 1;
    const img = document.getElementById('carousel-img');
    const counter = document.getElementById('carousel-counter');

    const update = () => {
        const url = getPhotoUrl(slides[idx]);
        img.src = url;
        wrapper.style.backgroundImage = `url(${url})`;
        counter.textContent = `${idx + 1} / ${slides.length}`;
    };

    window.nextSlide = () => { idx = (idx + 1) % slides.length; update(); };
    window.prevSlide = () => { idx = (idx - 1 + slides.length) % slides.length; update(); };
    window.togglePlay = () => {
        isPlaying = !isPlaying;
        document.getElementById('play-pause-btn').textContent = isPlaying ? '⏸' : '▶';
        if (isPlaying) {
            slideInterval = setInterval(nextSlide, 5000);
            if (isAudioEnabled) {
                if (carouselAudio) carouselAudio.pause();
                carouselAudio = new Audio(`musica${Math.floor(Math.random()*4)+1}.mp3`);
                carouselAudio.play().catch(() => {});
            }
        } else {
            clearInterval(slideInterval);
            if (carouselAudio) carouselAudio.pause();
        }
    };
    update();
}

// ==========================================
// 8. HISTORIAL Y PERFIL
// ==========================================
function loadHistory(dog) {
    const container = document.getElementById('walks-history');
    container.innerHTML = '';
    if (!dog.walks?.length) { container.innerHTML = '<p class="info-text">Sin paseos aún.</p>'; return; }
    
    dog.walks.forEach((w, i) => {
        const div = document.createElement('div');
        div.className = 'walk-session';
        div.style.setProperty('--i', i);
        div.innerHTML = `
            <h3>📅 ${w.fecha}</h3>
            <div class="walk-details">
                <p>${w.resumen_diario}</p>
                <div class="gallery">
                    ${(w.fotos || []).map(f => `<img src="${getPhotoUrl(f.id)}" class="photo-card" onclick="openLightbox('${f.id}')">`).join('')}
                </div>
            </div>`;
        container.appendChild(div);
    });
}

function loadProfile(dog) {
    const p = dog.perfil;
    const v = document.getElementById('profile-details-view');
    document.getElementById('profile-photo').src = getPhotoUrl(p.foto_id);
    v.innerHTML = `
        <div class="detail-row"><span class="detail-label">Raza:</span> ${p.raza}</div>
        <div class="detail-row"><span class="detail-label">Edad:</span> ${p.fecha_nacimiento ? calculateExactAge(p.fecha_nacimiento) : p.edad}</div>
        <div class="detail-row"><span class="detail-label">Dueño:</span> ${p.dueno}</div>
        <div class="detail-row"><span class="detail-label">WhatsApp:</span> ${p.telefono}</div>
    `;
}

// ==========================================
// 9. NAVEGACIÓN Y LOGIN
// ==========================================
async function showView(id, dogId = null) {
    currentView = id;
    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    if (id !== 'dog-selection-dashboard') {
        if (slideInterval) clearInterval(slideInterval);
        if (carouselAudio) carouselAudio.pause();
        isPlaying = false;
    }

    if (dogId) {
        currentDog = ALL_DOGS_COMBINED.find(d => String(d.id) === String(dogId));
        if (currentDog) document.querySelectorAll('.dog-name-placeholder').forEach(el => el.textContent = currentDog.nombre);
    }

    if (id === 'admin-dashboard-section') loadAdminDashboard();
    if (id === 'dog-selection-dashboard') initCarousel();
    if (id === 'profile-section') loadProfile(currentDog);
    if (id === 'walks-history-section') loadHistory(currentDog);

    updateWhatsApp();
}

function goBack() {
    if (['profile-section', 'walks-history-section', 'create-walk-section'].includes(currentView)) {
        showView('dog-selection-dashboard', currentDog.id);
    } else if (currentView === 'dog-selection-dashboard' && currentUser.isAdmin) {
        showView('admin-dashboard-section');
    } else {
        showView('login-section');
    }
}

// ==========================================
// 10. INICIALIZACIÓN
// ==========================================
window.onload = async () => {
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Login Logic
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const em = document.getElementById('email').value.toLowerCase();
        const pw = document.getElementById('password').value;
        const dogs = await loadAllDogs();

        if (em === ADMIN_USER.email && pw === ADMIN_USER.password) {
            currentUser = { isAdmin: true };
            showView('admin-dashboard-section');
        } else {
            const dog = dogs.find(d => d.dueno_email === em && pw === '123456');
            if (dog) {
                currentUser = { isAdmin: false };
                showView('dog-selection-dashboard', dog.id);
            } else {
                showToast('Email o contraseña (123456) incorrectos', 'error');
            }
        }
    };

    // UI Buttons
    document.getElementById('hamburger-btn').onclick = () => document.getElementById('main-nav').classList.toggle('show');
    document.getElementById('nav-logout-btn').onclick = () => location.reload();
    
    const audioBtn = document.getElementById('audio-toggle');
    audioBtn.onclick = () => {
        isAudioEnabled = !isAudioEnabled;
        audioBtn.textContent = isAudioEnabled ? '🔊' : '🔇';
        localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off');
        if (!isAudioEnabled && carouselAudio) carouselAudio.pause();
    };

    showView('login-section');
};

function updateWhatsApp() {
    const btn = document.getElementById('whatsapp-btn');
    if (['login-section', 'admin-dashboard-section'].includes(currentView)) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'flex';
        btn.href = `https://wa.me/${TRAINER_PHONE}`;
    }
}

// LIGHTBOX
window.openLightbox = (id) => {
    document.getElementById('lightbox-img').src = getPhotoUrl(id);
    document.getElementById('lightbox').style.display = 'flex';
};
document.getElementById('close-lightbox').onclick = () => document.getElementById('lightbox').style.display = 'none';