// === SUPABASE CONFIG ===
const { createClient } = window.supabase;
const SUPABASE_URL = 'https://asejbhohkbcoixiwdhcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZWpiaG9oa2Jjb2l4aXdkaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjk0NzMsImV4cCI6MjA4MDYwNTQ3M30.kbRKO5PEljZ29_kn6GYKoyGfB_t8xalxtMiq1ovPo4w';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === UTILIDADES ===
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
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple-effect');
    const ripple = button.querySelector('.ripple-effect');
    if (ripple) ripple.remove();
    button.appendChild(circle);
}

// === CONFIGURACIÓN ===
const DB_URL = 'paseoDogDB.json';
let TRAINER_PHONE = "5491100000000";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let EXAMPLE_DOGS = [];
let REAL_DOGS = [];
let DATABASE = null;

// === ESTADO GLOBAL ===
let currentUser = null, currentDog = null, currentView = 'login-section';
let simulatedPhotos = [], isEditing = false, tempPhotoId = null, backStack = [];
let editWalkIdx = null, editWalkPhotos = [];
let slideInterval = null, isPlaying = false;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isAudioEnabled = true;
let hasPlayedWelcome = false;
let userHasInteracted = false;
let lastPlayedTrack = null;
let carouselAudio = null;

// === FUNCIONES DE IMÁGENES ===
function getPhotoUrl(id, w = 400, h = 400) {
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

// === CARGAR EJEMPLOS DESDE JSON (con IDs 995–999) ===
async function loadExampleDogs() {
    try {
        const res = await fetch(DB_URL);
        const data = await res.json();
        const exampleIds = [995, 996, 997, 998, 999];
        EXAMPLE_DOGS = data.dogs.map((d, index) => ({
            ...d,
            id: exampleIds[index] || (995 + index),
            isExample: true
        }));
        TRAINER_PHONE = data.trainer_phone || "5491100000000";
        ADMIN_USER = data.admin || { email: 'admin@paseos.com', password: 'admin123' };
        DATABASE = data;
    } catch (err) {
        console.warn("No se pudo cargar paseoDogDB.json", err);
    }
}

// === CARGAR PERROS REALES DESDE SUPABASE ===
async function loadRealDogs() {
    const { data, error } = await supabaseClient
        .from('dogs_real')
        .select('*')
        .order('nombre', { ascending: true });
    if (error) {
        console.error('Error Supabase:', error);
        return [];
    }
    return data.map(d => ({ ...d, isReal: true }));
}

// === COMBINAR AMBOS ===
async function loadAllDogs() {
    REAL_DOGS = await loadRealDogs();
    return [...EXAMPLE_DOGS, ...REAL_DOGS];
}

// === GUARDAR PERRO REAL EN SUPABASE ===
async function saveRealDog(dogData) {
    const { error } = await supabaseClient
        .from('dogs_real')
        .insert([{
            nombre: dogData.nombre,
            dueno_email: dogData.dueno_email,
            perfil: dogData.perfil,
            walks: dogData.walks || []
        }]);
    if (error) throw error;
}

// === ACTUALIZAR PASEOS EN SUPABASE ===
async function updateRealDogWalks(dogId, walks) {
    const { error } = await supabaseClient
        .from('dogs_real')
        .update({ walks })
        .eq('id', dogId);
    if (error) throw error;
}
// === ACTUALIZAR PERFIL EN SUPABASE ===
async function updateRealDogProfile(dogId, newPerfil) {
    const { error } = await supabaseClient
        .from('dogs_real')
        .update({ perfil: newPerfil })
        .eq('id', dogId);
    if (error) throw error;
}


// === AUDIO DEL CARRUSEL ===
const CARRUSEL_TRACKS = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];
function playRandomCarouselTrack() {
    if (!isAudioEnabled) return;
    if (carouselAudio) {
        carouselAudio.pause();
        carouselAudio = null;
    }
    let randomTrack;
    if (CARRUSEL_TRACKS.length > 1) {
        do {
            randomTrack = CARRUSEL_TRACKS[Math.floor(Math.random() * CARRUSEL_TRACKS.length)];
        } while (randomTrack === lastPlayedTrack && CARRUSEL_TRACKS.length > 1);
    } else {
        randomTrack = CARRUSEL_TRACKS[0];
    }
    lastPlayedTrack = randomTrack;
    carouselAudio = new Audio(randomTrack);
    carouselAudio.onended = () => {
        carouselAudio = null;
        isPlaying = false;
        const playPauseBtn = document.getElementById('play-pause-btn');
        const playLargeBtn = document.getElementById('carousel-play-large');
        if (playPauseBtn) playPauseBtn.textContent = '▶';
        if (playLargeBtn) playLargeBtn.textContent = '▶';
    };
    carouselAudio.onerror = () => {
        console.warn('No se pudo cargar el audio:', randomTrack);
        carouselAudio = null;
    };
    carouselAudio.play().catch(e => {
        console.warn('Reproducción bloqueada:', e);
        carouselAudio = null;
    });
}

// === CAROUSEL MODERNO CON AUDIO ===
function initCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const slides = [];
    if (currentDog && currentDog.walks) {
        currentDog.walks.forEach(wa => {
            if (wa.fotos) wa.fotos.forEach(f => slides.push(f.id));
        });
    }
    if (!slides.length) {
        wrapper.style.display = 'none';
        return;
    }
    wrapper.style.display = 'flex';
    let idx = 0;
    isPlaying = false;
    const img = document.getElementById('carousel-img');
    const counter = document.getElementById('carousel-counter');
    const controls = document.querySelector('.carousel-controls');
    const navBtns = document.querySelectorAll('.carousel-nav-btn');
    let hideTimer = null;
    const showSlide = () => {
        img.style.opacity = 0;
        setTimeout(() => {
            img.src = getPhotoUrl(slides[idx], 800, 500);
            img.onload = () => { img.style.opacity = 1; };
            counter.textContent = `${idx + 1} / ${slides.length}`;
        }, 200);
    };
    const updatePlayState = () => {
        const playPauseBtn = document.getElementById('play-pause-btn');
        playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
        const playLargeBtn = document.getElementById('carousel-play-large');
        playLargeBtn.textContent = isPlaying ? '⏸' : '▶';
        if (isPlaying) {
            playLargeBtn.classList.add('playing');
            controls.classList.add('playing');
            navBtns.forEach(btn => btn.classList.add('playing'));
        } else {
            playLargeBtn.classList.remove('playing');
            controls.classList.remove('playing');
            navBtns.forEach(btn => btn.classList.remove('playing'));
        }
    };
    const showControls = () => {
        wrapper.classList.add('active');
        resetHideTimer();
    };
    const hideControls = () => {
        wrapper.classList.remove('active');
    };
    const resetHideTimer = () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(hideControls, 3000);
    };
    wrapper.addEventListener('mouseenter', showControls);
    wrapper.addEventListener('mouseleave', resetHideTimer);
    wrapper.addEventListener('touchstart', showControls, { passive: true });
    document.addEventListener('click', () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            showControls();
        }
    });
    window.nextSlide = () => {
        idx = (idx + 1) % slides.length;
        showSlide();
        showControls();
    };
    window.prevSlide = () => {
        idx = (idx - 1 + slides.length) % slides.length;
        showSlide();
        showControls();
    };
    window.togglePlay = () => {
        if (!isPlaying) {
            playRandomCarouselTrack();
            isPlaying = true;
        } else {
            if (carouselAudio) {
                carouselAudio.pause();
                carouselAudio = null;
            }
            isPlaying = false;
        }
        updatePlayState();
        showControls();
    };
    window.toggleFullscreen = () => {
        const elem = document.getElementById('carousel-container');
        if (!document.fullscreenElement && !document.webkitFullscreenElement &&
            !document.mozFullScreenElement && !document.msFullscreenElement) {
            if (elem.requestFullscreen) elem.requestFullscreen();
            else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
            else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
            else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
        showControls();
    };
    showSlide();
    updatePlayState();
    hideControls();
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        if (!isPlaying) {
            window.nextSlide();
        }
    }, 3000);
}

// === TEMA Y WHATSAPP ===
const themeToggle = document.getElementById('theme-toggle');
function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeToggle.textContent = isDark ? '🐩' : '🐕‍🦺';
}
themeToggle.onclick = (e) => {
    createRipple(e, themeToggle);
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    updateThemeIcon();
};

function updateWhatsApp() {
    const btn = document.getElementById('whatsapp-btn');
    if(currentView.includes('login') || currentView.includes('admin-dashboard')){
        btn.style.display='none';
        return;
    }
    btn.style.display='flex';
    let num = TRAINER_PHONE;
    if(currentUser && currentUser.isAdmin && currentDog && !currentDog.isExample) {
        num = currentDog.perfil.telefono.replace(/[^0-9]/g, '');
    }
    btn.href = `https://wa.me/${num}`;
}

// === NAVEGACIÓN ===
async function showView(id, dogId = null) {
    const allDogs = await loadAllDogs();
    if(id !== currentView) backStack.push(currentView);
    currentView = id;
    if (currentView !== 'dog-selection-dashboard' && slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
        if (carouselAudio) {
            carouselAudio.pause();
            carouselAudio = null;
        }
        isPlaying = false;
    }
    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    if(dogId) {
        currentDog = REAL_DOGS.find(d => d.id === dogId) || EXAMPLE_DOGS.find(d => d.id === dogId);
    }
    if(currentDog) {
        document.querySelectorAll('.dog-name-placeholder').forEach(e => e.textContent = currentDog.nombre);
        if(id === 'dog-selection-dashboard') {
            document.getElementById('admin-create-walk-btn').style.display = currentUser?.isAdmin ? 'block' : 'none';
            initCarousel();
        }
        if(id === 'profile-section') { isEditing = false; loadProfile(currentDog); }
        if(id === 'walks-history-section') loadHistory(currentDog);
        if(id === 'create-walk-section') {
            document.getElementById('walk-form').reset();
            document.getElementById('walk-date').valueAsDate = new Date();
            simulatedPhotos = [];
            document.getElementById('photo-preview').innerHTML = '';
            loadMultiDog();
        }
    }
    if(id === 'admin-dashboard-section') loadAdminDashboard();
    if((id === 'dog-selection-dashboard' || id === 'admin-dashboard-section') && userHasInteracted) {
        setTimeout(playWelcomeSound, 500);
    }
    updateWhatsApp();
    window.scrollTo(0,0);
}
function goBack(){
    if(backStack.length) showView(backStack.pop());
    else showView('login-section');
}

// === AUDIO DE BIENVENIDA ===
function playWelcomeSound() {
    if (!isAudioEnabled || hasPlayedWelcome || !userHasInteracted) return;
    hasPlayedWelcome = true;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 660;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.6);
}

// === LOGIN ===
document.getElementById('toggle-password').onclick = () => {
    const p = document.getElementById('password');
    p.type = p.type === 'password' ? 'text' : 'password';
};
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const em = document.getElementById('email').value.toLowerCase();
    const pw = document.getElementById('password').value;
    const allDogs = await loadAllDogs();
    if(em === ADMIN_USER.email && pw === ADMIN_USER.password){
        currentUser = { email: em, isAdmin: true };
        showView('admin-dashboard-section');
    } else {
        const d = allDogs.find(x => x.dueno_email === em);
        if(d && pw === '123456'){
            currentUser = { email: em, isAdmin: false };
            currentDog = d;
            showView('dog-selection-dashboard');
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    }
};

// === ADMIN DASHBOARD ===
async function loadAdminDashboard() {
    const allDogs = await loadAllDogs();
    const c = document.getElementById('dog-list-container');
    c.innerHTML = '';
    document.getElementById('demo-status-text').textContent = `${allDogs.length} perros (ejemplos + reales)`;
    if(!allDogs.length) return c.innerHTML = '<p class="info-text">Sin perros.</p>';
    allDogs.forEach((d, i) => {
        const suffix = d.isExample ? ' (ejemplo)' : '';
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
            <span>🐶 <strong>${d.nombre}</strong> <small style="color:var(--text-secondary)">(${d.perfil.raza})${suffix}</small></span>
            <button class="ripple" onclick="showView('dog-selection-dashboard',${d.id})">Gestionar</button>
        `;
        c.appendChild(card);
        card.querySelector('button').addEventListener('click', (e) => createRipple(e));
    });
}

// === CREAR PERRO (solo reales van a Supabase) ===
document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.querySelector('#create-dog-form .save-btn');
    if (!submitBtn || submitBtn.disabled) return;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '🔄 Guardando...';
    submitBtn.disabled = true;
    
    try {
        const photoId = DATABASE?.photo_references?.random?.[0] || '1581268694';
        const nd = {
            nombre: document.getElementById('new-dog-name').value,
            dueno_email: document.getElementById('new-dog-email').value,
            perfil: {
                raza: document.getElementById('new-dog-breed').value,
                sexo: document.getElementById('new-dog-sex').value,
                dueno: document.getElementById('new-dog-owner').value,
                telefono: document.getElementById('new-dog-phone').value,
                foto_id: photoId,
                edad: '?', peso: '?', alergias: 'Ninguna',
                energia: 'Media', social: '?'
            },
            walks: []
        };
        await saveRealDog(nd);
        showToast('✅ Perro real registrado en la nube', 'success');
        showView('admin-dashboard-section');
    } catch (err) {
        showToast('❌ Error: ' + (err.message || 'No se pudo guardar'), 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
};

// === PROFILE ===
function loadProfile(d) {
    const p = d.perfil;
    const photoId = tempPhotoId || p.foto_id || (DATABASE?.photo_references?.random?.[0] || '1581268694');
    document.getElementById('profile-photo').src = getPhotoUrl(photoId, 300, 300);
    document.getElementById('profile-dog-name-display').textContent = d.nombre;
    document.getElementById('edit-photo-btn').style.display = isEditing && !d.isExample ? 'block' : 'none';
    document.getElementById('toggle-edit-btn').textContent = isEditing ? '❌ Cancelar' : '✏️ Editar Perfil';
    const v = document.getElementById('profile-details-view');
    const e = document.getElementById('profile-details-edit');
    v.innerHTML = `
        <h3>🐕 Datos Básicos</h3>
        <div class="detail-row"><span class="detail-label">Raza:</span> <span class="detail-value">${p.raza}</span></div>
        <div class="detail-row"><span class="detail-label">Edad:</span> <span class="detail-value">${p.edad}</span></div>
        <div class="detail-row"><span class="detail-label">Sexo:</span> <span class="detail-value">${p.sexo}</span></div>
        <h3>💊 Salud y Contacto</h3>
        <div class="detail-row"><span class="detail-label">Peso:</span> <span class="detail-value">${p.peso}</span></div>
        <div class="detail-row"><span class="detail-label">Alergias:</span> <span class="detail-value">${p.alergias}</span></div>
        <div class="detail-row"><span class="detail-label">Dueño:</span> <span class="detail-value">${p.dueno}</span></div>
        <div class="detail-row"><span class="detail-label">Teléfono:</span> <span class="detail-value">${p.telefono}</span></div>
        <h3>🎾 Comportamiento</h3>
        <div class="detail-row"><span class="detail-label">Energía:</span> <span class="detail-value">${p.energia}</span></div>
        <div class="detail-row"><span class="detail-label">Social:</span> <span class="detail-value">${p.social}</span></div>
    `;
    e.innerHTML = '';
    const fields = ['raza','edad','sexo','peso','alergias','dueno','telefono','energia','social'];
    fields.forEach(k => {
        e.innerHTML += `<label>${k.charAt(0).toUpperCase() + k.slice(1)}</label><input type="text" name="${k}" value="${p[k]}">`;
    });
    e.innerHTML += '<button type="submit" class="save-btn ripple">Guardar Cambios</button>';
    v.style.display = isEditing ? 'none' : 'block';
    e.style.display = isEditing ? 'block' : 'none';
    if (isEditing) {
        e.onsubmit = (ev) => {
            ev.preventDefault();
            const btn = e.querySelector('.save-btn');
            if (!btn || btn.disabled) return;
            const txt = btn.innerHTML;
            btn.innerHTML = '🔄 Guardando...';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = txt;
                btn.disabled = false;
                showToast('✅ Perfil actualizado', 'success');
                toggleEditMode();
            }, 600);
        };
    }
}
// === PROFILE: guardar cambios (versión corregida para Supabase) ===
function toggleEditMode() {
    if (currentDog?.isExample) {
        showToast('ℹ️ Los ejemplos no se pueden editar', 'info');
        return;
    }
    isEditing = !isEditing;
    tempPhotoId = null;
    loadProfile(currentDog);
    
    if (isEditing) {
        // Activar formulario editable
        const form = document.getElementById('profile-details-edit');
        form.innerHTML = '';
        const fields = ['raza','edad','sexo','peso','alergias','dueno','telefono','energia','social'];
        const p = currentDog.perfil;
        
        fields.forEach(k => {
            form.innerHTML += `<label>${k.charAt(0).toUpperCase() + k.slice(1)}</label>
                              <input type="text" name="${k}" value="${p[k]}" required>`;
        });
        
        form.innerHTML += '<button type="submit" class="save-btn ripple">💾 Guardar Cambios</button>';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const updatedPerfil = {};
            for (let [key, value] of formData.entries()) {
                updatedPerfil[key] = value;
            }
            
            try {
                // ✅ Guardar en Supabase
                await updateRealDogProfile(currentDog.id, updatedPerfil);
                showToast('✅ Perfil actualizado en la nube', 'success');
                toggleEditMode(); // salir del modo edición
            } catch (err) {
                showToast('❌ Error al guardar: ' + err.message, 'error');
            }
        };
    }
}
function randomizeProfilePhoto(){
    if (currentDog?.isExample) return;
    const randomId = DATABASE?.photo_references?.random ?
        DATABASE.photo_references.random[Math.floor(Math.random() * DATABASE.photo_references.random.length)] :
        '1581268694';
    tempPhotoId = randomId;
    document.getElementById('profile-photo').src = getPhotoUrl(tempPhotoId,300,300);
}

// === CREATE WALK ===
async function loadMultiDog(){
    const c = document.getElementById('multi-dog-container');
    c.innerHTML = '';
    const allDogs = await loadAllDogs();
    allDogs.filter(d => d.id !== currentDog.id).forEach(d => {
        c.innerHTML += `<div class="dog-select-item"><input type="checkbox" value="${d.id}" id="md${d.id}"><label for="md${d.id}" style="margin:0">${d.nombre}</label></div>`;
    });
}

document.getElementById('simulate-photos-btn').onclick = () => {
    simulatedPhotos = [];
    const c = document.getElementById('photo-preview');
    c.innerHTML = '';
    const refs = DATABASE?.photo_references?.random || ['1581268694', '1581268695', '1581268696'];
    for(let i = 0; i < Math.min(3, refs.length); i++){
        const id = refs[i];
        simulatedPhotos.push({id, comentario: `Foto ${i+1} del paseo`});
        c.innerHTML += `<img src="${getPhotoUrl(id,100,100)}">`;
    }
};

document.getElementById('walk-form').onsubmit = async (e) => {
    e.preventDefault();
    if (currentDog?.isExample) {
        showToast('ℹ️ Los perros de ejemplo no se pueden modificar', 'info');
        return;
    }
    const submitBtn = document.querySelector('#walk-form .save-btn');
    if (!submitBtn || submitBtn.disabled) return;
    submitBtn.innerHTML = '🔄 Guardando...';
    submitBtn.disabled = true;
    
    try {
        const w = {
            fecha: document.getElementById('walk-date').value,
            duracion_minutos: parseInt(document.getElementById('walk-duration').value),
            distancia_km: parseFloat(document.getElementById('walk-distance').value),
            resumen_diario: document.getElementById('walk-summary').value,
            comportamiento_problemas: document.getElementById('comportamiento-problemas').checked,
            incidentes_salud: document.getElementById('incidentes-salud').value,
            fotos: simulatedPhotos
        };
        const updatedWalks = [w, ...(currentDog.walks || [])];
        await updateRealDogWalks(currentDog.id, updatedWalks);
        showToast('✅ Paseo guardado en la nube', 'success');
        showView('dog-selection-dashboard');
    } catch (err) {
        showToast('❌ Error al guardar paseo', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = '💾 Guardar Paseo';
            submitBtn.disabled = false;
        }
    }
};

// === HISTORY & EDIT ===
function loadHistory(d) {
    const c = document.getElementById('walks-history');
    c.innerHTML = '';
    if(!d.walks.length) return c.innerHTML = '<p class="info-text">Sin historial.</p>';
    d.walks.forEach((w,i) => {
        const imgs = w.fotos.map(f => 
            `<div class="photo-card" onclick="openLightbox('${f.id}')">
                <img src="${getPhotoUrl(f.id,200,200)}">
            </div>`
        ).join('');
        const adminBtns = (currentUser && currentUser.isAdmin && !d.isExample) ?
            `<div class="admin-walk-controls" data-index="${i}">
                <button class="admin-walk-btn edit-btn">✏️ Editar</button>
                <button class="admin-walk-btn delete-btn" style="border-color:var(--danger-light); color:#fca5a5;">🗑️ Borrar</button>
            </div>` : '';
        const session = document.createElement('div');
        session.className = 'walk-session';
        session.style.setProperty('--i', i);
        session.innerHTML = `
            <h3><span>📅 ${w.fecha}</span> ${adminBtns}</h3>
            <div class="walk-details">
                <div class="walk-metrics">
                    <span>⏱️ ${w.duracion_minutos} min</span>
                    <span>📏 ${w.distancia_km} km</span>
                    <span>📸 ${w.fotos.length} fotos</span>
                </div>
                <p><strong>Resumen:</strong> ${w.resumen_diario}</p>
                ${w.comportamiento_problemas ? '<div class="incident-alert">⚠️ Hubo problemas de comportamiento</div>' : '<div class="success-notice">✅ Paseo tranquilo</div>'}
                ${w.incidentes_salud ? `<div class="incident-alert">🩺 <strong>Salud:</strong> ${w.incidentes_salud}</div>` : ''}
                <div class="gallery">${imgs}</div>
            </div>
        `;
        c.appendChild(session);
    });
    c.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = (e) => {
            const walkIndex = e.target.closest('.admin-walk-controls').dataset.index;
            openEditWalk(parseInt(walkIndex));
        };
    });
    c.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = (e) => {
            const walkIndex = e.target.closest('.admin-walk-controls').dataset.index;
            delWalk(parseInt(walkIndex));
        };
    });
}

// === LIGHTBOX ===
function openLightbox(id){
    document.getElementById('lightbox-img').src = getPhotoUrl(id,800,800);
    document.getElementById('lightbox').style.display = 'flex';
}
document.getElementById('close-lightbox').onclick = () =>
    document.getElementById('lightbox').style.display = 'none';

// === FUNCIONES DE EDICIÓN ===
function openEditWalk(i){
    if (currentDog?.isExample) return;
    editWalkIdx=i; 
    editWalkPhotos=[...currentDog.walks[i].fotos];
    const w=currentDog.walks[i];
    document.getElementById('edit-walk-date').value=w.fecha;
    document.getElementById('edit-walk-duration').value=w.duracion_minutos;
    document.getElementById('edit-walk-distance').value=w.distancia_km;
    document.getElementById('edit-walk-summary').value=w.resumen_diario;
    document.getElementById('edit-walk-behavior').checked=w.comportamiento_problemas;
    document.getElementById('edit-walk-health').value=w.incidentes_salud;
    renderEditPhotos();
    document.getElementById('edit-walk-modal').style.display='flex';
}
function renderEditPhotos(){ 
    const c=document.getElementById('edit-photo-preview'); 
    c.innerHTML=''; 
    editWalkPhotos.forEach((p,i)=>
        c.innerHTML+=`<div style="position:relative">
            <img src="${getPhotoUrl(p.id,100,100)}">
            <button type="button" class="delete-photo-btn" onclick="delEditPhoto(${i})">x</button>
        </div>`
    ); 
}
function delEditPhoto(i){ 
    editWalkPhotos.splice(i,1); 
    renderEditPhotos(); 
}
function addPhotoEdit(){ 
    const newId = DATABASE?.photo_references?.random?.[0] || '1581268694';
    editWalkPhotos.push({
        id: newId, 
        comentario: 'Nueva foto'
    }); 
    renderEditPhotos(); 
}
document.getElementById('edit-walk-form').onsubmit = async (e) => {
    e.preventDefault();
    if (currentDog?.isExample) return;
    try {
        const updatedWalks = [...currentDog.walks];
        updatedWalks[editWalkIdx] = {
            fecha: document.getElementById('edit-walk-date').value,
            duracion_minutos: parseInt(document.getElementById('edit-walk-duration').value),
            distancia_km: parseFloat(document.getElementById('edit-walk-distance').value),
            resumen_diario: document.getElementById('edit-walk-summary').value,
            comportamiento_problemas: document.getElementById('edit-walk-behavior').checked,
            incidentes_salud: document.getElementById('edit-walk-health').value,
            fotos: editWalkPhotos
        };
        await updateRealDogWalks(currentDog.id, updatedWalks);
        document.getElementById('edit-walk-modal').style.display = 'none';
        loadHistory(currentDog);
        showToast('✅ Paseo actualizado', 'success');
    } catch (err) {
        showToast('❌ Error al actualizar', 'error');
    }
};

function delWalk(i) {
    if (!confirm('¿Borrar este paseo?') || currentDog?.isExample) return;
    const updatedWalks = currentDog.walks.filter((_, idx) => idx !== i);
    updateRealDogWalks(currentDog.id, updatedWalks)
        .then(() => loadHistory(currentDog))
        .catch(() => showToast('❌ Error al borrar', 'error'));
}

// === BOTÓN: Recargar ejemplos (sin tocar Supabase) ===
document.getElementById('toggle-demo-btn').onclick = async () => {
    if (confirm('¿Recargar datos de ejemplo desde paseoDogDB.json?')) {
        await loadExampleDogs();
        showToast('✅ Ejemplos recargados desde archivo local', 'info');
        if (currentView === 'admin-dashboard-section') loadAdminDashboard();
    }
};

// === INIT ===
window.onload = async () => {
    await loadExampleDogs();
    document.getElementById('loading-overlay').style.display = 'none';
    showView('login-section');
    updateThemeIcon();

    const particlesContainer = document.getElementById('particles-container');
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            const size = 4 + Math.random() * 14;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${Math.random() * 100}vw`;
            p.style.top = `${Math.random() * 100}vh`;
            particlesContainer.appendChild(p);
        }
    }

    const observer = new MutationObserver(() => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        particlesContainer.style.display = isDark ? 'block' : 'none';
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    document.querySelectorAll('.ripple').forEach(btn => {
        btn.addEventListener('click', createRipple);
    });

    const audioToggle = document.getElementById('audio-toggle');
    const savedAudio = localStorage.getItem('paseoDogAudio');
    if (savedAudio === 'off') {
        isAudioEnabled = false;
        audioToggle.textContent = '🔇';
    }
    audioToggle.onclick = (e) => {
        e.stopPropagation();
        isAudioEnabled = !isAudioEnabled;
        audioToggle.textContent = isAudioEnabled ? '🔊' : '🔇';
        localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off');
        if (!isAudioEnabled && carouselAudio) {
            carouselAudio.pause();
            carouselAudio = null;
            isPlaying = false;
            const playPauseBtn = document.getElementById('play-pause-btn');
            const playLargeBtn = document.getElementById('carousel-play-large');
            if (playPauseBtn) playPauseBtn.textContent = '▶';
            if (playLargeBtn) playLargeBtn.textContent = '▶';
        }
    };

    document.addEventListener('click', () => {
        if (!userHasInteracted) userHasInteracted = true;
    }, { once: true });
};