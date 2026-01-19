// ==========================================
// 1. CONFIGURACIÓN Y SUPABASE (BLINDADO)
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
// 2. FUNCIONES DE EDAD Y CUMPLEAÑOS
// ==========================================

function parseAgeInput(input) {
    if (!input) return null;
    const trimmed = input.trim().toLowerCase();

    // Texto natural: "26 de octubre 2025"
    const monthsMap = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    const textDateMatch = trimmed.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de?\s+(\d{4})$/);
    if (textDateMatch) {
        const [, d, m, y] = textDateMatch;
        const date = new Date(y, monthsMap[m], d);
        return date.toISOString().split('T')[0];
    }

    // Estándar: DD/MM/YYYY
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateMatch) {
        const [, d, m, y] = dateMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // Relativa: "3 años"
    let totalMonths = 0;
    const yM = trimmed.match(/(\d+)\s*(año|ano|a)/i);
    if (yM) totalMonths += parseInt(yM[1]) * 12;
    const mM = trimmed.match(/(\d+)\s*(mes|m)(?!i)/i);
    if (mM) totalMonths += parseInt(mM[1]);

    if (totalMonths > 0) {
        const bD = new Date();
        bD.setMonth(bD.getMonth() - totalMonths);
        return bD.toISOString().split('T')[0];
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
        years--;
        months += 12;
    }
    if (years === 0) return `${months} meses`;
    return months === 0 ? `${years} años` : `${years} años y ${months} meses`;
}

function isBirthdayToday(birthStr) {
    if (!birthStr) return false;
    const b = new Date(birthStr);
    const t = new Date();
    return b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
}

// ==========================================
// 3. VARIABLES GLOBALES Y ESTADO
// ==========================================
let TRAINER_PHONE = "59896921960";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let REAL_DOGS = [];
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [], isEditing = false;
let slideInterval = null, isPlaying = false, carouselAudio = null;
let isAudioEnabled = localStorage.getItem('paseoDogAudio') !== 'off';
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// ==========================================
// 4. UTILIDADES DE UI
// ==========================================
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function createRipple(e) {
    const btn = e.currentTarget;
    const circle = document.createElement('span');
    const d = Math.max(btn.clientWidth, btn.clientHeight);
    circle.style.width = circle.style.height = `${d}px`;
    circle.style.left = `${e.clientX - btn.getBoundingClientRect().left - d/2}px`;
    circle.style.top = `${e.clientY - btn.getBoundingClientRect().top - d/2}px`;
    circle.classList.add('ripple-effect');
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
}

function getPhotoUrl(id) {
    if (!id) return 'https://via.placeholder.com/150?text=🐶';
    if (id.startsWith('http')) return id;
    return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
}

// ==========================================
// 5. GESTIÓN DE DATOS (SUPABASE)
// ==========================================
async function loadAllDogs() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient.from('dogs_real').select('*').order('nombre');
    if (error) { showToast('Error cargando datos', 'error'); return []; }
    REAL_DOGS = data;
    return data;
}

async function updateRealDogProfile(id, perfil) {
    return await supabaseClient.from('dogs_real').update({ perfil }).eq('id', id);
}

async function updateRealDogWalks(id, walks) {
    return await supabaseClient.from('dogs_real').update({ walks }).eq('id', id);
}

// ==========================================
// 6. NAVEGACIÓN Y VISTAS
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
        currentDog = REAL_DOGS.find(d => String(d.id) === String(dogId));
        document.querySelectorAll('.dog-name-placeholder').forEach(el => el.textContent = currentDog.nombre);
    }

    if (id === 'admin-dashboard-section') loadAdminDashboard();
    if (id === 'dog-selection-dashboard') initCarousel();
    if (id === 'profile-section') loadProfile();
    if (id === 'walks-history-section') loadHistory();
    if (id === 'create-walk-section') {
        document.getElementById('walk-form').reset();
        document.getElementById('walk-date').valueAsDate = new Date();
        currentWalkFiles = [];
        document.getElementById('photo-preview').innerHTML = '';
        loadMultiDog();
    }

    updateWhatsApp();
    window.scrollTo(0, 0);
}

function goBack() {
    if (currentView === 'create-dog-section') showView('admin-dashboard-section');
    else if (['profile-section', 'walks-history-section', 'create-walk-section'].includes(currentView)) showView('dog-selection-dashboard');
    else if (currentView === 'dog-selection-dashboard' && currentUser.isAdmin) showView('admin-dashboard-section');
    else showView('login-section');
}

// ==========================================
// 7. DASHBOARD ADMINISTRADOR
// ==========================================
async function loadAdminDashboard() {
    const dogs = await loadAllDogs();
    const list = document.getElementById('dog-list-container');
    const alerts = document.getElementById('birthday-alerts-container');
    
    list.innerHTML = '';
    alerts.innerHTML = '';

    // Buscador (opcional pero recomendado)
    if (!document.getElementById('dog-search')) {
        const search = document.createElement('input');
        search.id = 'dog-search';
        search.placeholder = '🔍 Buscar mimoso...';
        search.style.marginBottom = '20px';
        search.oninput = (e) => filterDogs(e.target.value);
        list.parentElement.insertBefore(search, list);
    }

    // Lógica de Alertas de Cumpleaños
    const todayBdays = dogs.filter(d => d.perfil.fecha_nacimiento && isBirthdayToday(d.perfil.fecha_nacimiento));
    todayBdays.forEach(dog => {
        const age = calculateExactAge(dog.perfil.fecha_nacimiento);
        const card = document.createElement('div');
        card.className = 'birthday-alert-card';
        card.innerHTML = `
            <div class="birthday-cake-icon">🎂</div>
            <div class="birthday-alert-content">
                <div class="birthday-alert-title">¡Hoy es el cumple de ${dog.nombre}!</div>
                <div class="birthday-alert-message">El mimoso está cumpliendo <strong>${age}</strong>.</div>
            </div>
        `;
        alerts.appendChild(card);
    });

    // Lista de Perros
    renderDogList(dogs);
}

function renderDogList(dogs) {
    const list = document.getElementById('dog-list-container');
    list.innerHTML = '';
    dogs.forEach((d, i) => {
        const age = d.perfil.fecha_nacimiento ? calculateExactAge(d.perfil.fecha_nacimiento) : (d.perfil.edad || '?');
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                <img src="${getPhotoUrl(d.perfil.foto_id)}" class="dog-list-thumb">
                <div>
                    <strong>${d.nombre}</strong>
                    <small style="display:block; color:var(--text-secondary)">${d.perfil.raza} • ${age}</small>
                </div>
            </div>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        list.appendChild(card);
        card.querySelector('button').onclick = (e) => { createRipple(e); showView('dog-selection-dashboard', d.id); };
    });
}

function filterDogs(query) {
    const filtered = REAL_DOGS.filter(d => d.nombre.toLowerCase().includes(query.toLowerCase()));
    renderDogList(filtered);
}

// ==========================================
// 8. CARRUSEL DE FOTOS
// ==========================================
function initCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const slides = [];
    if (currentDog.walks) {
        currentDog.walks.forEach(w => w.fotos?.forEach(f => slides.push(f.id)));
    }

    if (!slides.length) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = 'flex';

    let idx = slides.length - 1;
    const img = document.getElementById('carousel-img');
    const counter = document.getElementById('carousel-counter');

    const update = () => {
        const url = getPhotoUrl(slides[idx]);
        img.src = url;
        counter.textContent = `${idx + 1} / ${slides.length}`;
        wrapper.style.backgroundImage = `url(${url})`;
    };

    window.nextSlide = () => { idx = (idx + 1) % slides.length; update(); };
    window.prevSlide = () => { idx = (idx - 1 + slides.length) % slides.length; update(); };
    
    window.togglePlay = () => {
        isPlaying = !isPlaying;
        const btn = document.getElementById('play-pause-btn');
        btn.textContent = isPlaying ? '⏸' : '▶';
        if (isPlaying) {
            slideInterval = setInterval(nextSlide, 4000);
            if (isAudioEnabled) {
                carouselAudio = new Audio(`musica${Math.floor(Math.random()*4)+1}.mp3`);
                carouselAudio.play().catch(() => console.log("Audio bloqueado"));
            }
        } else {
            clearInterval(slideInterval);
            if (carouselAudio) carouselAudio.pause();
        }
    };
    update();
}

// ==========================================
// 9. EVENTOS Y FORMULARIOS
// ==========================================

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.toLowerCase();
    const pass = document.getElementById('password').value;

    if (email === ADMIN_USER.email && pass === ADMIN_USER.password) {
        currentUser = { isAdmin: true };
        showView('admin-dashboard-section');
    } else {
        const dogs = await loadAllDogs();
        const dog = dogs.find(d => d.dueno_email === email && pass === '123456');
        if (dog) {
            currentUser = { isAdmin: false };
            showView('dog-selection-dashboard', dog.id);
        } else {
            showToast('Credenciales inválidas', 'error');
        }
    }
};

document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    const ageInput = document.getElementById('new-dog-age').value;
    const birth = parseAgeInput(ageInput);
    
    const dog = {
        nombre: document.getElementById('new-dog-name').value,
        dueno_email: document.getElementById('new-dog-email').value.toLowerCase(),
        perfil: {
            raza: document.getElementById('new-dog-breed').value,
            sexo: document.getElementById('new-dog-sex').value,
            dueno: document.getElementById('new-dog-owner').value,
            telefono: document.getElementById('new-dog-phone').value,
            foto_id: '1581268694',
            fecha_nacimiento: birth,
            edad_input: ageInput
        },
        walks: []
    };

    const { error } = await supabaseClient.from('dogs_real').insert([dog]);
    if (!error) {
        showToast('¡Mimoso registrado!', 'success');
        showView('admin-dashboard-section');
    }
};

// ==========================================
// 10. INICIALIZACIÓN
// ==========================================
function updateWhatsApp() {
    const btn = document.getElementById('whatsapp-btn');
    if (['login-section', 'admin-dashboard-section'].includes(currentView)) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'flex';
        let num = TRAINER_PHONE;
        if (currentUser?.isAdmin && currentDog) num = currentDog.perfil.telefono;
        btn.href = `https://wa.me/${num.replace(/\D/g,'')}`;
    }
}

window.onload = () => {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = 'none';
    
    const audioBtn = document.getElementById('audio-toggle');
    audioBtn.textContent = isAudioEnabled ? '🔊' : '🔇';
    audioBtn.onclick = () => {
        isAudioEnabled = !isAudioEnabled;
        audioBtn.textContent = isAudioEnabled ? '🔊' : '🔇';
        localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off');
    };

    // Botón hamburguesa
    const ham = document.getElementById('hamburger-btn');
    const nav = document.getElementById('main-nav');
    ham.onclick = () => nav.classList.toggle('show');

    // Cerrar sesión
    document.getElementById('nav-logout-btn').onclick = () => {
        currentUser = null;
        showView('login-section');
    };

    showView('login-section');
};

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}