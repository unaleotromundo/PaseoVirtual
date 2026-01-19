/**
 * PASEOVIRTUAL - SCRIPT MAESTRO COMPLETO
 * Versión: Full Logic (Supabase + PWA + Multimedia)
 */

// ==========================================
// 1. CONFIGURACIÓN Y SUPABASE (CONEXIÓN)
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
// 2. MOTOR DE EDAD Y FECHAS (NATURAL LANGUAGE)
// ==========================================

function parseAgeInput(input) {
    if (!input) return null;
    const trimmed = input.trim().toLowerCase();
    const monthsMap = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    // 1. "20 de octubre 2020"
    const textDateMatch = trimmed.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de?\s+(\d{4})$/);
    if (textDateMatch) {
        const [, d, m, y] = textDateMatch;
        return new Date(y, monthsMap[m], d).toISOString().split('T')[0];
    }

    // 2. "DD/MM/YYYY"
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateMatch) {
        const [, d, m, y] = dateMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // 3. "3 años", "5 meses"
    let totalMonths = 0;
    const yearsMatch = trimmed.match(/(\d+)\s*(año|ano|a)/i);
    if (yearsMatch) totalMonths += parseInt(yearsMatch[1]) * 12;
    const monthsMatch = trimmed.match(/(\d+)\s*(mes|m)(?!i)/i);
    if (monthsMatch) totalMonths += parseInt(monthsMatch[1]);

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
        years--; months += 12;
    }
    if (years === 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    const yText = years === 1 ? '1 año' : `${years} años`;
    const mText = months === 0 ? '' : (months === 1 ? ' 1 mes' : ` ${months} meses`);
    return yText + mText;
}

function isBirthdayToday(birthStr) {
    if (!birthStr) return false;
    const b = new Date(birthStr);
    const t = new Date();
    return b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
}

// ==========================================
// 3. VARIABLES DE ESTADO Y DATOS
// ==========================================
let TRAINER_PHONE = "59896921960";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let REAL_DOGS = [];
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [], isEditing = false, editWalkIdx = null, editWalkPhotos = [];
let slideInterval = null, isPlaying = false, carouselAudio = null;
let isAudioEnabled = localStorage.getItem('paseoDogAudio') !== 'off';
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// ==========================================
// 4. UTILIDADES DE INTERFAZ (UI)
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function createRipple(event) {
    const btn = event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - btn.getBoundingClientRect().left - diameter / 2}px`;
    circle.style.top = `${event.clientY - btn.getBoundingClientRect().top - diameter / 2}px`;
    circle.classList.add('ripple-effect');
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
}

function getPhotoUrl(id) {
    if (!id) return 'https://via.placeholder.com/150?text=🐶';
    if (String(id).startsWith('http')) return id;
    return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
}

// ==========================================
// 5. COMUNICACIÓN CON SUPABASE (CRUD)
// ==========================================
async function loadAllDogs() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient.from('dogs_real').select('*').order('nombre');
    if (error) { console.error(error); return []; }
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
// 6. DASHBOARD ADMIN (CUMPLES Y BUSCADOR)
// ==========================================
async function loadAdminDashboard() {
    const dogs = await loadAllDogs();
    const alerts = document.getElementById('birthday-alerts-container');
    const list = document.getElementById('dog-list-container');
    
    alerts.innerHTML = '';
    list.innerHTML = '';

    // Buscador Dinámico
    if (!document.getElementById('admin-search-bar')) {
        const sb = document.createElement('input');
        sb.id = 'admin-search-bar';
        sb.placeholder = '🔍 Buscar perro por nombre...';
        sb.className = 'search-bar';
        sb.oninput = (e) => {
            const query = e.target.value.toLowerCase();
            renderDogList(REAL_DOGS.filter(d => d.nombre.toLowerCase().includes(query)));
        };
        list.parentElement.insertBefore(sb, list);
    }

    // Alertas de Cumpleaños
    dogs.filter(d => d.perfil.fecha_nacimiento && isBirthdayToday(d.perfil.fecha_nacimiento)).forEach(dog => {
        const age = calculateExactAge(dog.perfil.fecha_nacimiento);
        const card = document.createElement('div');
        card.className = 'birthday-alert-card';
        card.innerHTML = `
            <div class="birthday-cake-icon">🎂</div>
            <div class="birthday-alert-content">
                <div class="birthday-alert-title">¡Hoy cumple ${dog.nombre}!</div>
                <div class="birthday-alert-message">El mimoso está cumpliendo <strong>${age}</strong>.</div>
            </div>`;
        alerts.appendChild(card);
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
// 8. PERFIL Y EDICIÓN
// ==========================================
function loadProfile(dog) {
    const p = dog.perfil;
    const v = document.getElementById('profile-details-view');
    document.getElementById('profile-photo').src = getPhotoUrl(p.foto_id);
    document.getElementById('profile-dog-name-display').textContent = dog.nombre;

    if (isEditing) {
        v.innerHTML = `
            <label>Raza</label><input type="text" id="edit-raza" value="${p.raza || ''}">
            <label>Sexo</label><select id="edit-sexo"><option ${p.sexo=='Macho'?'selected':''}>Macho</option><option ${p.sexo=='Hembra'?'selected':''}>Hembra</option></select>
            <label>Dueño</label><input type="text" id="edit-dueno" value="${p.dueno || ''}">
            <label>WhatsApp</label><input type="text" id="edit-tel" value="${p.telefono || ''}">
            <label>Peso</label><input type="text" id="edit-peso" value="${p.peso || ''}">
            <label>Energía</label><input type="text" id="edit-energia" value="${p.energia || ''}">
            <button class="save-btn" onclick="saveProfileChanges()">💾 Guardar Todo</button>`;
    } else {
        v.innerHTML = `
            <div class="detail-row"><span class="detail-label">Raza:</span> ${p.raza}</div>
            <div class="detail-row"><span class="detail-label">Edad:</span> ${p.fecha_nacimiento ? calculateExactAge(p.fecha_nacimiento) : p.edad_input}</div>
            <div class="detail-row"><span class="detail-label">Sexo:</span> ${p.sexo}</div>
            <div class="detail-row"><span class="detail-label">Peso:</span> ${p.peso || '?' }</div>
            <div class="detail-row"><span class="detail-label">Dueño:</span> ${p.dueno}</div>`;
    }
}

async function saveProfileChanges() {
    const newP = {
        ...currentDog.perfil,
        raza: document.getElementById('edit-raza').value,
        sexo: document.getElementById('edit-sexo').value,
        dueno: document.getElementById('edit-dueno').value,
        telefono: document.getElementById('edit-tel').value,
        peso: document.getElementById('edit-peso').value,
        energia: document.getElementById('edit-energia').value
    };
    await updateRealDogProfile(currentDog.id, newP);
    currentDog.perfil = newP;
    isEditing = false;
    showToast('Perfil actualizado', 'success');
    loadProfile(currentDog);
}

// ==========================================
// 9. HISTORIAL Y PASEOS
// ==========================================
function loadHistory(dog) {
    const c = document.getElementById('walks-history');
    c.innerHTML = '';
    if (!dog.walks?.length) { c.innerHTML = '<p class="info-text">No hay paseos registrados.</p>'; return; }
    
    dog.walks.forEach((w, i) => {
        const div = document.createElement('div');
        div.className = 'walk-session';
        div.style.setProperty('--i', i);
        div.innerHTML = `
            <h3>📅 ${w.fecha}</h3>
            <div class="walk-details">
                <div class="walk-metrics">
                    <span>⏱️ ${w.duracion_minutos} min</span>
                    <span>📏 ${w.distancia_km} km</span>
                </div>
                <p>${w.resumen_diario}</p>
                <div class="gallery">
                    ${(w.fotos || []).map(f => `<img src="${getPhotoUrl(f.id)}" class="photo-card" onclick="openLightbox('${f.id}')">`).join('')}
                </div>
            </div>`;
        c.appendChild(div);
    });
}

function loadMultiDog() {
    const c = document.getElementById('multi-dog-container');
    c.innerHTML = '';
    REAL_DOGS.filter(d => String(d.id) !== String(currentDog.id)).forEach(d => {
        c.innerHTML += `<div class="dog-select-item"><input type="checkbox" value="${d.id}" id="md${d.id}"><label for="md${d.id}">${d.nombre}</label></div>`;
    });
}

// ==========================================
// 10. NAVEGACIÓN Y LOGIN
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
        currentDog = REAL_DOGS.find(d => String(d.id) === String(dogId));
        document.querySelectorAll('.dog-name-placeholder').forEach(el => el.textContent = currentDog.nombre);
    }

    if (id === 'admin-dashboard-section') loadAdminDashboard();
    if (id === 'dog-selection-dashboard') initCarousel();
    if (id === 'profile-section') { isEditing = false; loadProfile(currentDog); }
    if (id === 'walks-history-section') loadHistory(currentDog);
    if (id === 'create-walk-section') {
        document.getElementById('walk-form').reset();
        document.getElementById('walk-date').valueAsDate = new Date();
        currentWalkFiles = [];
        loadMultiDog();
    }

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

function updateWhatsApp() {
    const btn = document.getElementById('whatsapp-btn');
    if (['login-section', 'admin-dashboard-section'].includes(currentView)) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'flex';
        btn.href = `https://wa.me/${TRAINER_PHONE}`;
    }
}

// ==========================================
// 11. INICIALIZACIÓN (ONLOAD)
// ==========================================
window.onload = () => {
    document.getElementById('loading-overlay').style.display = 'none';

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
                showToast('Credenciales incorrectas', 'error');
            }
        }
    };

    // Listeners Multimedia
    const audioBtn = document.getElementById('audio-toggle');
    audioBtn.onclick = () => {
        isAudioEnabled = !isAudioEnabled;
        audioBtn.textContent = isAudioEnabled ? '🔊' : '🔇';
        localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off');
        if (!isAudioEnabled && carouselAudio) carouselAudio.pause();
    };

    document.getElementById('hamburger-btn').onclick = () => document.getElementById('main-nav').classList.toggle('show');
    document.getElementById('nav-logout-btn').onclick = () => location.reload();
    document.getElementById('toggle-edit-btn').onclick = () => { isEditing = !isEditing; loadProfile(currentDog); };

    showView('login-section');
};

// LIGHTBOX
window.openLightbox = (id) => {
    document.getElementById('lightbox-img').src = getPhotoUrl(id);
    document.getElementById('lightbox').style.display = 'flex';
};
document.getElementById('close-lightbox').onclick = () => document.getElementById('lightbox').style.display = 'none';

// SERVICE WORKER
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
}