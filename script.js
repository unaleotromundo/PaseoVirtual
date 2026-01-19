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
// 2. BASE DE DATOS INTERNA (PERROS DE EJEMPLO)
// ==========================================
// Esto es lo que le da el peso y la autonomía al script
const INTERNAL_DOGS = [
    {
      "id": 995,
      "nombre": "Fido (Ejemplo)",
      "dueno_email": "cliente@paseos.com",
      "perfil": {
        "raza": "Pastor Alemán", "edad": "3 años", "sexo": "Macho", "peso": "35 kg",
        "dueno": "Juan Pérez", "telefono": "5491155550000", "energia": "Alta",
        "foto_id": "https://asejbhohkbcoixiwdhcq.supabase.co/storage/v1/object/public/ejemplos/pastoreo1.webp"
      },
      "walks": [
        { "fecha": "2025-10-28", "resumen_diario": "¡Fido tuvo un día fantástico!", "duracion_minutos": 75, "distancia_km": 4.8, "fotos": [{"id": "https://asejbhohkbcoixiwdhcq.supabase.co/storage/v1/object/public/ejemplos/pastoreo1.webp"}] }
      ]
    },
    {
      "id": 996,
      "nombre": "Luna (Ejemplo)",
      "dueno_email": "luna@paseos.com",
      "perfil": {
        "raza": "Bulldog Francés", "edad": "1 año", "sexo": "Hembra", "peso": "12 kg",
        "dueno": "Sofía Gómez", "telefono": "5491155550000", "energia": "Media",
        "foto_id": "https://asejbhohkbcoixiwdhcq.supabase.co/storage/v1/object/public/ejemplos/Bulldog2.webp"
      },
      "walks": []
    },
    {
      "id": 997,
      "nombre": "Max (Ejemplo)",
      "dueno_email": "max@paseos.com",
      "perfil": {
        "raza": "Golden Retriever", "edad": "5 años", "sexo": "Macho",
        "dueno": "Carlos Martínez", "telefono": "5491155550000", "energia": "Muy Alta",
        "foto_id": "https://asejbhohkbcoixiwdhcq.supabase.co/storage/v1/object/public/ejemplos/golden1_resultado.webp"
      },
      "walks": []
    },
    {
      "id": 998,
      "nombre": "Bella (Ejemplo)",
      "dueno_email": "bella@paseos.com",
      "perfil": {
        "raza": "Beagle", "edad": "2 años", "sexo": "Hembra",
        "dueno": "María López", "telefono": "5491155550000", "energia": "Alta",
        "foto_id": "https://asejbhohkbcoixiwdhcq.supabase.co/storage/v1/object/public/ejemplos/beagle1.webp"
      },
      "walks": []
    },
    {
      "id": 999,
      "nombre": "Rocky (Ejemplo)",
      "dueno_email": "rocky@paseos.com",
      "perfil": {
        "raza": "Rottweiler", "edad": "4 años", "sexo": "Macho",
        "dueno": "Diego Fernández", "telefono": "5491155550000", "energia": "Media-Alta",
        "foto_id": "https://asejbhohkbcoixiwdhcq.supabase.co/storage/v1/object/public/ejemplos/rootweilet_resultado.webp"
      },
      "walks": []
    }
];

// ==========================================
// 3. VARIABLES DE ESTADO
// ==========================================
let TRAINER_PHONE = "59896921960";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let REAL_DOGS = [];
let ALL_DOGS_COMBINED = [];
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [], isEditing = false;
let slideInterval = null, isPlaying = false, carouselAudio = null;
let isAudioEnabled = localStorage.getItem('paseoDogAudio') !== 'off';

// ==========================================
// 4. FUNCIONES DE FECHA Y EDAD
// ==========================================
function calculateExactAge(birthStr) {
    if (!birthStr) return '?';
    if (isNaN(Date.parse(birthStr)) && !birthStr.includes('/')) return birthStr;
    const birth = new Date(birthStr);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
        years--; months += 12;
    }
    return years === 0 ? `${months} meses` : `${years} años`;
}

function isBirthdayToday(birthStr) {
    if (!birthStr || isNaN(Date.parse(birthStr))) return false;
    const b = new Date(birthStr);
    const t = new Date();
    return b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
}

// ==========================================
// 5. CARGA DE DATOS (COMBINADA)
// ==========================================
async function loadDogsData() {
    let reals = [];
    if (supabaseClient) {
        const { data, error } = await supabaseClient.from('dogs_real').select('*').order('nombre');
        if (!error) reals = data;
    }
    REAL_DOGS = reals;
    ALL_DOGS_COMBINED = [...INTERNAL_DOGS, ...reals];
    return ALL_DOGS_COMBINED;
}

function getPhotoUrl(id) {
    if (!id) return 'https://via.placeholder.com/150?text=🐶';
    if (String(id).startsWith('http')) return id;
    return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
}

// ==========================================
// 6. DASHBOARD ADMIN (CON BUSCADOR Y ALERTAS)
// ==========================================
async function loadAdminDashboard() {
    const dogs = await loadDogsData();
    const list = document.getElementById('dog-list-container');
    const alerts = document.getElementById('birthday-alerts-container');
    
    list.innerHTML = '';
    alerts.innerHTML = '';

    // Buscador
    if (!document.getElementById('admin-search-input')) {
        const si = document.createElement('input');
        si.id = 'admin-search-input';
        si.placeholder = '🔍 Buscar mimoso...';
        si.className = 'search-bar';
        si.style.marginBottom = '20px';
        si.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = ALL_DOGS_COMBINED.filter(d => d.nombre.toLowerCase().includes(query));
            renderDogList(filtered);
        };
        list.parentElement.insertBefore(si, list);
    }

    // Alertas Cumpleaños
    dogs.filter(d => d.perfil.fecha_nacimiento && isBirthdayToday(d.perfil.fecha_nacimiento)).forEach(dog => {
        const alert = document.createElement('div');
        alert.className = 'birthday-alert-card';
        alert.innerHTML = `
            <div class="birthday-cake-icon">🎂</div>
            <div class="birthday-alert-content">
                <div class="birthday-alert-title">¡Hoy cumple ${dog.nombre}!</div>
                <div class="birthday-alert-message">El mimoso está de fiesta.</div>
            </div>`;
        alerts.appendChild(alert);
    });

    renderDogList(dogs);
}

function renderDogList(dogs) {
    const list = document.getElementById('dog-list-container');
    list.innerHTML = '';
    dogs.forEach((d, i) => {
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                <img src="${getPhotoUrl(d.perfil.foto_id)}" class="dog-list-thumb">
                <div>
                    <strong>${d.nombre}</strong>
                    <small style="display:block; color:var(--text-secondary)">${d.perfil.raza}</small>
                </div>
            </div>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>`;
        list.appendChild(card);
    });
}

// ==========================================
// 7. CARRUSEL Y MULTIMEDIA
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
// 8. NAVEGACIÓN Y VISTAS
// ==========================================
async function showView(id, dogId = null) {
    currentView = id;
    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    if (id !== 'dog-selection-dashboard') {
        if (slideInterval) clearInterval(slideInterval);
        if (carouselAudio) { carouselAudio.pause(); isPlaying = false; }
    }

    if (dogId) {
        currentDog = ALL_DOGS_COMBINED.find(d => String(d.id) === String(dogId));
        if (currentDog) document.querySelectorAll('.dog-name-placeholder').forEach(el => el.textContent = currentDog.nombre);
    }

    if (id === 'admin-dashboard-section') loadAdminDashboard();
    if (id === 'dog-selection-dashboard') initCarousel();
    if (id === 'profile-section') {
        const p = currentDog.perfil;
        document.getElementById('profile-photo').src = getPhotoUrl(p.foto_id);
        document.getElementById('profile-details-view').innerHTML = `
            <div class="detail-row"><strong>Raza:</strong> ${p.raza}</div>
            <div class="detail-row"><strong>Edad:</strong> ${calculateExactAge(p.fecha_nacimiento || p.edad)}</div>
            <div class="detail-row"><strong>Dueño:</strong> ${p.dueno}</div>
        `;
    }
    if (id === 'walks-history-section') {
        const c = document.getElementById('walks-history');
        c.innerHTML = '';
        currentDog.walks?.forEach(w => {
            c.innerHTML += `<div class="walk-session"><h3>📅 ${w.fecha}</h3><p>${w.resumen_diario}</p></div>`;
        });
    }

    const wa = document.getElementById('whatsapp-btn');
    wa.style.display = (id==='login-section' || id==='admin-dashboard-section') ? 'none' : 'flex';
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
// 9. INICIALIZACIÓN
// ==========================================
window.onload = async () => {
    await loadDogsData();
    document.getElementById('loading-overlay').style.display = 'none';

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const em = document.getElementById('email').value.toLowerCase();
        const pw = document.getElementById('password').value;

        if (em === ADMIN_USER.email && pw === ADMIN_USER.password) {
            currentUser = { isAdmin: true };
            showView('admin-dashboard-section');
        } else {
            const dog = ALL_DOGS_COMBINED.find(d => d.dueno_email === em && pw === '123456');
            if (dog) {
                currentUser = { isAdmin: false };
                showView('dog-selection-dashboard', dog.id);
            } else {
                alert('Error de acceso');
            }
        }
    };

    document.getElementById('hamburger-btn').onclick = () => document.getElementById('main-nav').classList.toggle('show');
    document.getElementById('nav-logout-btn').onclick = () => location.reload();

    showView('login-section');
};