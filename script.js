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
    } else {
        console.warn('⚠️ La librería de Supabase no cargó. Se usará modo offline limitado.');
    }
} catch (err) {
    console.error('❌ Error crítico inicializando Supabase:', err);
}

// ==========================================
// 2. FUNCIONES DE EDAD INTELIGENTE
// ==========================================

function parseAgeInput(input) {
    if (!input) return null;
    const trimmed = input.trim().toLowerCase();
    const monthsMap = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
        'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    const textDateMatch = trimmed.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de?\s+(\d{4})$/);
    if (textDateMatch) {
        const [, dStr, mName, yStr] = textDateMatch;
        const d = parseInt(dStr, 10); const y = parseInt(yStr, 10); const m = monthsMap[mName];
        if (m !== undefined && d >= 1 && d <= 31) {
            const date = new Date(y, m, d);
            return date.toISOString().split('T')[0];
        }
    }
    const datePatterns = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/];
    for (let pattern of datePatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            let day, month, year;
            if (pattern.source.startsWith('^(')) { [, day, month, year] = match.map(Number); }
            else { [, year, month, day] = match.map(Number); }
            const date = new Date(year, month - 1, day);
            return date.toISOString().split('T')[0];
        }
    }
    let totalMonths = 0;
    const yearsMatch = trimmed.match(/(\d+)\s*(año|anos|years?|a)/i);
    if (yearsMatch) totalMonths += parseInt(yearsMatch[1]) * 12;
    const monthsMatch = trimmed.match(/(\d+)\s*(mes|meses|months?|m)(?!i)/i);
    if (monthsMatch) totalMonths += parseInt(monthsMatch[1]);
    if (totalMonths > 0) {
        const birthDate = new Date();
        birthDate.setMonth(birthDate.getMonth() - totalMonths);
        return birthDate.toISOString().split('T')[0];
    }
    return null;
}

function calculateExactAge(birthDateString) {
    if (!birthDateString) return '?';
    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return '?';
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0) { years--; months += 12; }
    if (today.getDate() < birthDate.getDate()) {
        months--; if (months < 0) { years--; months += 12; }
    }
    if (years === 0) return months === 1 ? '1 mes' : `${months} meses`;
    if (months === 0) return years === 1 ? '1 año' : `${years} años`;
    return `${years} ${years === 1 ? 'año' : 'años'} ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function isBirthdayToday(birthDateString) {
    if (!birthDateString) return false;
    const birth = new Date(birthDateString);
    const today = new Date();
    return birth.getDate() === today.getDate() && birth.getMonth() === today.getMonth();
}

function isBirthdaySoon(birthDateString) {
    if (!birthDateString) return false;
    const birth = new Date(birthDateString);
    const today = new Date();
    const thisYearBday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return thisYearBday >= today && thisYearBday <= nextWeek;
}

// ==========================================
// 3. VARIABLES GLOBALES
// ==========================================
const DB_URL = 'paseoDogDB.json';
let TRAINER_PHONE = "59896921960";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let REAL_DOGS = [];
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [], isEditing = false;
let editWalkIdx = null, editWalkPhotos = [];
let slideInterval = null, isPlaying = false, carouselAudio = null;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isAudioEnabled = true, userHasInteracted = false;

// ==========================================
// 4. UTILIDADES
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function createRipple(event, element) {
    const button = element || event.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - diameter/2}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - diameter/2}px`;
    circle.classList.add('ripple-effect');
    button.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
}

function getPhotoUrl(id) {
    if(!id) return 'https://via.placeholder.com/150?text=🐶';
    if(id.toString().startsWith('http')) return id;
    return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
}

// ==========================================
// 5. CARGA Y MIGRACIÓN
// ==========================================
async function loadRealDogs() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient.from('dogs_real').select('*').order('nombre');
    if (error) return [];
    return data;
}

async function migrateLegacyAgeFields(dogs) {
    for (const dog of dogs) {
        if (dog.perfil.fecha_nacimiento) continue;
        const possibleDate = parseAgeInput(dog.perfil.edad);
        if (possibleDate) {
            dog.perfil.fecha_nacimiento = possibleDate;
            await updateRealDogProfile(dog.id, dog.perfil);
        }
    }
}

async function loadAllDogs() {
    const reals = await loadRealDogs();
    await migrateLegacyAgeFields(reals);
    REAL_DOGS = reals;
    return reals;
}

async function saveRealDog(dogData) {
    return await supabaseClient.from('dogs_real').insert([dogData]);
}

async function updateRealDogWalks(dogId, walks) {
    return await supabaseClient.from('dogs_real').update({ walks }).eq('id', dogId);
}

async function updateRealDogProfile(dogId, newPerfil) {
    return await supabaseClient.from('dogs_real').update({ perfil: newPerfil }).eq('id', dogId);
}

// ==========================================
// 6. DASHBOARD ADMIN (MEJORADO CON ALERTAS)
// ==========================================
async function loadAdminDashboard() {
    const dogs = await loadAllDogs();
    const list = document.getElementById('dog-list-container');
    const alerts = document.getElementById('birthday-alerts-container');
    
    list.innerHTML = '';
    alerts.innerHTML = '';

    // Buscador Dinámico (Parche 1)
    if (!document.getElementById('admin-search')) {
        const search = document.createElement('input');
        search.id = 'admin-search';
        search.placeholder = '🔍 Buscar mimoso...';
        search.className = 'search-bar';
        search.style.marginBottom = '20px';
        search.oninput = (e) => filterAdminList(e.target.value);
        list.parentElement.insertBefore(search, list);
    }

    // Tarjetas de Alerta de Cumpleaños (Parche 2)
    const todayBirthdays = dogs.filter(d => d.perfil.fecha_nacimiento && isBirthdayToday(d.perfil.fecha_nacimiento));
    todayBirthdays.forEach(dog => {
        const alertCard = document.createElement('div');
        alertCard.className = 'birthday-alert-card';
        alertCard.innerHTML = `
            <div class="birthday-cake-icon">🎂</div>
            <div class="birthday-alert-content">
                <div class="birthday-alert-title">¡Hoy cumple ${dog.nombre}!</div>
                <div class="birthday-alert-message">El mimoso está cumpliendo <strong>${calculateExactAge(dog.perfil.fecha_nacimiento)}</strong>.</div>
            </div>
        `;
        alerts.appendChild(alertCard);
    });

    renderAdminList(dogs);
}

function renderAdminList(dogs) {
    const list = document.getElementById('dog-list-container');
    list.innerHTML = '';
    dogs.forEach((d, i) => {
        const age = d.perfil.fecha_nacimiento ? calculateExactAge(d.perfil.fecha_nacimiento) : d.perfil.edad;
        let bDayBadge = isBirthdayToday(d.perfil.fecha_nacimiento) ? '<span class="birthday-badge">🎂 HOY</span>' : '';
        
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                <img src="${getPhotoUrl(d.perfil.foto_id)}" class="dog-list-thumb">
                <div>
                    <strong>${d.nombre} ${bDayBadge}</strong>
                    <small style="display:block; color:var(--text-secondary)">${d.perfil.raza} • ${age}</small>
                </div>
            </div>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        list.appendChild(card);
    });
}

function filterAdminList(query) {
    const filtered = REAL_DOGS.filter(d => d.nombre.toLowerCase().includes(query.toLowerCase()));
    renderAdminList(filtered);
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

    const showSlide = () => {
        const url = getPhotoUrl(slides[idx]);
        img.src = url;
        wrapper.style.backgroundImage = `url(${url})`;
        counter.textContent = `${idx + 1} / ${slides.length}`;
    };

    window.nextSlide = () => { idx = (idx + 1) % slides.length; showSlide(); };
    window.prevSlide = () => { idx = (idx - 1 + slides.length) % slides.length; showSlide(); };
    
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
    showSlide();
}

// ==========================================
// 8. LOGÍN Y NAVEGACIÓN
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
    if (id === 'profile-section') loadProfile(currentDog);
    if (id === 'walks-history-section') loadHistory(currentDog);
    if (id === 'create-walk-section') loadMultiDog();

    updateWhatsApp();
    window.scrollTo(0,0);
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
// 9. EVENTOS DE FORMULARIO (SUBIDAS)
// ==========================================
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.toLowerCase();
    const pass = document.getElementById('password').value;
    const dogs = await loadAllDogs();

    if (email === ADMIN_USER.email && pass === ADMIN_USER.password) {
        currentUser = { isAdmin: true };
        showView('admin-dashboard-section');
    } else {
        const dog = dogs.find(d => d.dueno_email === email && pass === '123456');
        if (dog) {
            currentUser = { isAdmin: false };
            showView('dog-selection-dashboard', dog.id);
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    }
};

document.getElementById('walk-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    showToast('Guardando paseo...', 'info');

    try {
        const fotos = [];
        for (let i = 0; i < currentWalkFiles.length; i++) {
            const file = currentWalkFiles[i];
            const name = `walk_${currentDog.id}_${Date.now()}_${i}.jpg`;
            await supabaseClient.storage.from('paseodog-photos').upload(name, file);
            fotos.push({ id: name });
        }

        const walk = {
            fecha: document.getElementById('walk-date').value,
            duracion_minutos: document.getElementById('walk-duration').value,
            distancia_km: document.getElementById('walk-distance').value,
            resumen_diario: document.getElementById('walk-summary').value,
            comportamiento_problemas: document.getElementById('comportamiento-problemas').checked,
            incidentes_salud: document.getElementById('incidentes-salud').value,
            fotos
        };

        const updatedWalks = [walk, ...(currentDog.walks || [])];
        await updateRealDogWalks(currentDog.id, updatedWalks);

        // Actualizar a los compañeros de paseo
        const others = document.querySelectorAll('#multi-dog-container input:checked');
        for (const chk of others) {
            const oDog = REAL_DOGS.find(d => String(d.id) === String(chk.value));
            if (oDog) {
                const oWalks = [walk, ...(oDog.walks || [])];
                await updateRealDogWalks(oDog.id, oWalks);
            }
        }

        showToast('✅ Paseo registrado con éxito', 'success');
        showView('dog-selection-dashboard');
    } catch (err) {
        showToast('❌ Error al subir', 'error');
    } finally {
        btn.disabled = false;
    }
};

// ==========================================
// 10. CARGA INICIAL
// ==========================================
window.onload = () => {
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Toggle Audio
    const audioBtn = document.getElementById('audio-toggle');
    audioBtn.onclick = () => {
        isAudioEnabled = !isAudioEnabled;
        audioBtn.textContent = isAudioEnabled ? '🔊' : '🔇';
        if (!isAudioEnabled && carouselAudio) carouselAudio.pause();
    };

    // Subida de Fotos
    document.getElementById('add-walk-photo-btn').onclick = () => document.getElementById('walk-photo-input').click();
    document.getElementById('walk-photo-input').onchange = (e) => {
        currentWalkFiles = Array.from(e.target.files);
        const prev = document.getElementById('photo-preview');
        prev.innerHTML = '';
        currentWalkFiles.forEach(f => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(f);
            img.style.width = '60px'; img.style.height = '60px'; img.style.objectFit = 'cover';
            prev.appendChild(img);
        });
    };

    // Navegación
    document.getElementById('hamburger-btn').onclick = () => document.getElementById('main-nav').classList.toggle('show');
    document.getElementById('nav-logout-btn').onclick = () => location.reload();

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

// Historial y Perfil (Simplificados para este bloque, usa tus funciones de carga)
function loadHistory(d) {
    const c = document.getElementById('walks-history');
    c.innerHTML = '';
    d.walks?.forEach(w => {
        c.innerHTML += `<div class="walk-session"><h3>📅 ${w.fecha}</h3><p>${w.resumen_diario}</p></div>`;
    });
}

function loadProfile(d) {
    const v = document.getElementById('profile-details-view');
    document.getElementById('profile-photo').src = getPhotoUrl(d.perfil.foto_id);
    v.innerHTML = `<div class="detail-row"><strong>Raza:</strong> ${d.perfil.raza}</div>`;
}

function loadMultiDog() {
    const c = document.getElementById('multi-dog-container');
    c.innerHTML = '';
    REAL_DOGS.filter(d => d.id !== currentDog.id).forEach(d => {
        c.innerHTML += `<div><input type="checkbox" value="${d.id}"> ${d.nombre}</div>`;
    });
}