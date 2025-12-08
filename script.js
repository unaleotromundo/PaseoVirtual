// === SUPABASE CONFIG ===
const { createClient } = window.supabase;
const SUPABASE_URL = 'https://asejbhohkbcoixiwdhcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZWpiaG9oa2Jjb2l4aXdkaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjk0NzMsImV4cCI6MjA4MDYwNTQ3M30.kbRKO5PEljZ29_kn6GYKoyGfB_t8xalxtMiq1ovPo4w';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DATA DE RESPALDO (Por si falla la carga del JSON local) ===
const FALLBACK_DB = {
  "dogs": [
    { "id": 995, "nombre": "Fido (Ejemplo)", "dueno_email": "cliente@paseos.com", "perfil": { "raza": "Pastor Alemán", "foto_id": "1589941013453-ec89f33b5e95", "telefono": "5491155550000" }, "walks": [] },
    { "id": 996, "nombre": "Luna (Ejemplo)", "dueno_email": "luna@paseos.com", "perfil": { "raza": "Bulldog", "foto_id": "1583511655857-d19b40a7a54e", "telefono": "5491155550000" }, "walks": [] }
  ],
  "admin": { "email": "admin@paseos.com", "password": "admin123" }
};

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
    if(!id) return 'https://via.placeholder.com/400?text=No+Foto';
    // Soporte para fotos subidas a Supabase o Unsplash
    if (id.includes('perfil_') || id.includes('paseodog')) { 
       // Si es solo el nombre del archivo, construimos la URL completa
       if(!id.startsWith('http')) {
           return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
       }
       return id;
    }
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

// === CARGAR DATOS ===
async function loadExampleDogs() {
    try {
        const res = await fetch(DB_URL);
        if (!res.ok) throw new Error("No se pudo cargar JSON local");
        const data = await res.json();
        processLoadedData(data);
    } catch (err) {
        console.warn("⚠️ Usando base de datos de respaldo (Fallback) porque falló la carga local:", err);
        processLoadedData(FALLBACK_DB); // Usar fallback si falla fetch (ej. file:// protocol)
    }
}

function processLoadedData(data) {
    const exampleIds = [995, 996, 997, 998, 999];
    EXAMPLE_DOGS = (data.dogs || []).map((d, index) => ({
        ...d,
        id: d.id || exampleIds[index] || (995 + index),
        isExample: true
    }));
    TRAINER_PHONE = data.trainer_phone || "5491100000000";
    if(data.admin) ADMIN_USER = data.admin;
    DATABASE = data;
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
    const reals = await loadRealDogs();
    REAL_DOGS = reals; // Actualizar variable global
    return [...EXAMPLE_DOGS, ...reals];
}

// === GUARDAR PERRO REAL EN SUPABASE (CORREGIDO) ===
async function saveRealDog(dogData) {
    // CORRECCIÓN: dogData en vez de dogDato
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

// === SUBIR FOTO DE PERFIL A SUPABASE ===
async function uploadProfilePhoto(file) {
    if (!currentDog || currentDog.isExample) {
        showToast('ℹ️ Solo se pueden subir fotos de perros reales', 'info');
        return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    const allowedTypes = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedTypes.includes(extension)) {
        showToast('❌ Solo se permiten JPG, PNG o WebP', 'error');
        return;
    }

    const fileName = `perfil_${currentDog.id}_${Date.now()}.${extension}`;
    const filePath = fileName; // Subir directamente a la raíz o carpeta según config del bucket

    try {
        const { error: uploadError } = await supabaseClient
            .storage
            .from('paseodog-photos')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const newPerfil = { ...currentDog.perfil, foto_id: fileName };
        await updateRealDogProfile(currentDog.id, newPerfil);

        // Actualizar en memoria y vista
        REAL_DOGS = REAL_DOGS.map(d => d.id === currentDog.id ? { ...d, perfil: newPerfil } : d);
        currentDog = { ...currentDog, perfil: newPerfil };
        loadProfile(currentDog); // Recargar vista
        showToast('✅ Foto de perfil actualizada', 'success');
        
    } catch (err) {
        console.error('Error al subir foto:', err);
        showToast('❌ Error al subir: ' + (err.message || 'Inténtalo de nuevo'), 'error');
    }
}

// === AUDIO DEL CARRUSEL ===
const CARRUSEL_TRACKS = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];
function playRandomCarouselTrack() {
    if (!isAudioEnabled) return;
    if (carouselAudio) {
        carouselAudio.pause();
        carouselAudio = null;
    }
    
    // Selección aleatoria simple
    const randomTrack = CARRUSEL_TRACKS[Math.floor(Math.random() * CARRUSEL_TRACKS.length)];
    
    carouselAudio = new Audio(randomTrack);
    carouselAudio.onended = () => { isPlaying = false; updatePlayBtnState(); };
    
    // Manejo silencioso de error (por si no existen los archivos)
    carouselAudio.onerror = () => {
        console.warn('🎵 Audio no encontrado, continuando sin música.');
        isPlaying = false;
        updatePlayBtnState();
    };
    
    carouselAudio.play().catch(() => {
        // Bloqueado por el navegador o error de archivo
        isPlaying = false;
        updatePlayBtnState();
    });
}

function updatePlayBtnState() {
    const btn = document.getElementById('play-pause-btn');
    const largeBtn = document.getElementById('carousel-play-large');
    if(btn) btn.textContent = isPlaying ? '⏸' : '▶';
    if(largeBtn) largeBtn.textContent = isPlaying ? '⏸' : '▶';
}

// === CAROUSEL (LÓGICA CORREGIDA) ===
function initCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const slides = [];
    
    // Recopilar todas las fotos
    if (currentDog && currentDog.walks) {
        currentDog.walks.forEach(wa => {
            if (wa.fotos) wa.fotos.forEach(f => slides.push(f.id));
        });
    }

    // Si no hay fotos, ocultar carrusel
    if (!slides.length) {
        wrapper.style.display = 'none';
        return;
    }
    
    wrapper.style.display = 'flex';
    
    // CAMBIO 1: Empezar en la última foto (slides.length - 1)
    let idx = slides.length - 1; 
    
    // Aseguramos que empiece pausado
    isPlaying = false;
    if (slideInterval) clearInterval(slideInterval);

    const img = document.getElementById('carousel-img');
    const counter = document.getElementById('carousel-counter');
    
    const showSlide = () => {
        img.style.opacity = 0;
        setTimeout(() => {
            img.src = getPhotoUrl(slides[idx], 800, 500);
            img.onload = () => { img.style.opacity = 1; };
            counter.textContent = `${idx + 1} / ${slides.length}`;
        }, 200);
    };

    window.nextSlide = () => {
        idx = (idx + 1) % slides.length;
        showSlide();
    };

    window.prevSlide = () => {
        idx = (idx - 1 + slides.length) % slides.length;
        showSlide();
    };

    // CAMBIO 2: Lógica del botón Play sincronizada
    window.togglePlay = () => {
        isPlaying = !isPlaying;
        updatePlayBtnState();

        if(isPlaying) {
            // 1. Arrancar Música
            playRandomCarouselTrack(); 
            
            // 2. Arrancar el pase de fotos (5 segundos)
            // Avanzamos inmediatamente a la siguiente foto o esperamos? 
            // Lo normal es esperar el intervalo primero.
            if (slideInterval) clearInterval(slideInterval);
            slideInterval = setInterval(() => {
                window.nextSlide();
            }, 5000); // CAMBIO 3: 5000ms (5 segundos)
            
        } else {
            // Pausa: Parar música y parar intervalo
            if(carouselAudio) carouselAudio.pause();
            if(slideInterval) clearInterval(slideInterval);
        }
    };

    window.toggleFullscreen = () => {
        const elem = document.getElementById('carousel-container');
        if (!document.fullscreenElement) elem.requestFullscreen().catch(err => {});
        else document.exitFullscreen();
    };

    // Mostrar la foto inicial (la última) estática
    showSlide();
    updatePlayBtnState();
}

// === TEMA Y UI ===
const themeToggle = document.getElementById('theme-toggle');
themeToggle.onclick = (e) => {
    createRipple(e, themeToggle);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.textContent = isDark ? '🐕‍🦺' : '🐩';
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
    // Si estamos navegando, cargamos todo de nuevo para tener info fresca
    const allDogs = await loadAllDogs();
    
    if(id !== currentView) backStack.push(currentView);
    currentView = id;

    // Limpiar estados previos
    if (currentView !== 'dog-selection-dashboard') {
        if(slideInterval) clearInterval(slideInterval);
        if(carouselAudio) { carouselAudio.pause(); isPlaying=false; }
    }

    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    // Establecer perro actual
    if(dogId) {
        // Importante: comparar IDs como strings o números de forma segura
        currentDog = allDogs.find(d => String(d.id) === String(dogId));
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
    
    // Audio de bienvenida sutil
    if((id === 'dog-selection-dashboard' || id === 'admin-dashboard-section') && userHasInteracted) {
        playWelcomeSound();
    }
    
    updateWhatsApp();
    window.scrollTo(0,0);
}

function goBack(){
    if(backStack.length) showView(backStack.pop());
    else showView('login-section');
}

function playWelcomeSound() {
    if (!isAudioEnabled || hasPlayedWelcome) return;
    hasPlayedWelcome = true;
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.connect(g);
    g.connect(audioContext.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.05, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    o.start();
    o.stop(audioContext.currentTime + 0.3);
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
    
    // Cargar datos frescos
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
    document.getElementById('demo-status-text').textContent = `${allDogs.length} perros en sistema`;
    
    if(!allDogs.length) return c.innerHTML = '<p class="info-text">Sin perros.</p>';
    
    allDogs.forEach((d, i) => {
        const suffix = d.isExample ? ' (ejemplo)' : '';
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        // CORRECCIÓN: Agregar comillas simples en '${d.id}' para soportar UUIDs
        card.innerHTML = `
            <span>🐶 <strong>${d.nombre}</strong> <small style="color:var(--text-secondary)">(${d.perfil.raza})${suffix}</small></span>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        c.appendChild(card);
        card.querySelector('button').addEventListener('click', (e) => createRipple(e));
    });
}

// === CREAR PERRO ===
document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.querySelector('#create-dog-form .save-btn');
    if(submitBtn.disabled) return;
    
    submitBtn.innerHTML = '🔄 Guardando...';
    submitBtn.disabled = true;
    
    try {
        const nd = {
            nombre: document.getElementById('new-dog-name').value,
            dueno_email: document.getElementById('new-dog-email').value,
            perfil: {
                raza: document.getElementById('new-dog-breed').value,
                sexo: document.getElementById('new-dog-sex').value,
                dueno: document.getElementById('new-dog-owner').value,
                telefono: document.getElementById('new-dog-phone').value,
                foto_id: '1581268694', // Foto default
                edad: '?', peso: '?', alergias: 'Ninguna', energia: 'Media', social: '?'
            },
            walks: []
        };
        await saveRealDog(nd);
        showToast('✅ Perro registrado con éxito', 'success');
        document.getElementById('create-dog-form').reset();
        showView('admin-dashboard-section');
    } catch (err) {
        showToast('❌ Error: ' + (err.message || 'Error desconocido'), 'error');
    } finally {
        submitBtn.innerHTML = '💾 Guardar en Base de Datos';
        submitBtn.disabled = false;
    }
};

// === PROFILE ===
function loadProfile(d) {
    const p = d.perfil;
    let photoSrc = getPhotoUrl(p.foto_id, 300, 300);
    
    document.getElementById('profile-photo').src = photoSrc;
    document.getElementById('profile-dog-name-display').textContent = d.nombre;
    document.getElementById('edit-photo-btn').style.display = isEditing && !d.isExample ? 'block' : 'none';
    document.getElementById('toggle-edit-btn').textContent = isEditing ? '❌ Cancelar' : '✏️ Editar Perfil';
    
    const v = document.getElementById('profile-details-view');
    
    if (isEditing && !d.isExample) {
        // VISTA EDICIÓN
        v.innerHTML = `<form id="profile-edit-form"></form>`;
        const form = document.getElementById('profile-edit-form');
        const fields = ['raza','edad','sexo','peso','alergias','dueno','telefono','energia','social'];
        fields.forEach(k => {
            form.innerHTML += `<label>${k.charAt(0).toUpperCase() + k.slice(1)}</label>
                              <input type="text" name="${k}" value="${p[k] || ''}">`;
        });
        form.innerHTML += '<button type="submit" class="save-btn ripple">💾 Guardar Cambios</button>';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const updatedPerfil = { ...currentDog.perfil };
            for (let [key, value] of formData.entries()) updatedPerfil[key] = value;
            
            try {
                await updateRealDogProfile(currentDog.id, updatedPerfil);
                // Actualizar localmente para no tener que recargar todo
                currentDog.perfil = updatedPerfil;
                const idx = REAL_DOGS.findIndex(x => x.id === currentDog.id);
                if(idx !== -1) REAL_DOGS[idx] = currentDog;
                
                showToast('✅ Perfil actualizado', 'success');
                isEditing = false;
                loadProfile(currentDog);
            } catch (err) {
                showToast('❌ Error al guardar', 'error');
            }
        };
    } else {
        // VISTA LECTURA
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
        `;
    }
}
function toggleEditMode(){ 
    if (currentDog?.isExample) {
        showToast('ℹ️ Los ejemplos no se pueden editar', 'info');
        return;
    }
    isEditing = !isEditing; 
    loadProfile(currentDog); 
}
function randomizeProfilePhoto(){
    document.getElementById('photo-upload-input').click();
}

// === CREATE WALK ===
async function loadMultiDog(){
    const c = document.getElementById('multi-dog-container');
    c.innerHTML = '';
    const allDogs = await loadAllDogs();
    allDogs.filter(d => String(d.id) !== String(currentDog.id)).forEach(d => {
        c.innerHTML += `<div class="dog-select-item"><input type="checkbox" value="${d.id}" id="md${d.id}"><label for="md${d.id}" style="margin:0">${d.nombre}</label></div>`;
    });
}

document.getElementById('simulate-photos-btn').onclick = () => {
    simulatedPhotos = [];
    const c = document.getElementById('photo-preview');
    c.innerHTML = '';
    // Fotos fake para demo
    const refs = ['1581268694', '1592194996308-7b43878e84a6', '1587300003388-5920dcc28193'];
    refs.forEach((id, i) => {
        simulatedPhotos.push({id, comentario: `Foto ${i+1}`});
        c.innerHTML += `<img src="${getPhotoUrl(id,100,100)}">`;
    });
};

document.getElementById('walk-form').onsubmit = async (e) => {
    e.preventDefault();
    if (currentDog?.isExample) return showToast('ℹ️ Ejemplo: no editable', 'info');
    
    const submitBtn = document.querySelector('#walk-form .save-btn');
    submitBtn.innerHTML = '🔄 Guardando...'; submitBtn.disabled = true;
    
    try {
        const w = {
            fecha: document.getElementById('walk-date').value,
            duracion_minutos: parseInt(document.getElementById('walk-duration').value),
            distancia_km: parseFloat(document.getElementById('walk-distance').value),
            resumen_diario: document.getElementById('walk-summary').value,
            comportamiento_problemas: document.getElementById('comportamiento-problemas').checked,
            incidentes_salud: document.getElementById('incidentes-salud').value,
            fotos: simulatedPhotos.length ? simulatedPhotos : [{id: '1581268694', comentario: 'Paseo'}]
        };
        const updatedWalks = [w, ...(currentDog.walks || [])];
        await updateRealDogWalks(currentDog.id, updatedWalks);
        // Actualizar local
        currentDog.walks = updatedWalks;
        
        showToast('✅ Paseo guardado', 'success');
        showView('dog-selection-dashboard');
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        submitBtn.innerHTML = '💾 Guardar Paseo'; submitBtn.disabled = false;
    }
};

// === HISTORY & EDIT ===
function loadHistory(d) {
    const c = document.getElementById('walks-history');
    c.innerHTML = '';
    if(!d.walks || !d.walks.length) return c.innerHTML = '<p class="info-text">Sin historial.</p>';
    
    d.walks.forEach((w,i) => {
        const imgs = (w.fotos || []).map(f => 
            `<div class="photo-card" onclick="openLightbox('${f.id}')">
                <img src="${getPhotoUrl(f.id,200,200)}">
            </div>`
        ).join('');
        
        const adminBtns = (currentUser && currentUser.isAdmin && !d.isExample) ?
            `<div class="admin-walk-controls" data-index="${i}">
                <button class="admin-walk-btn edit-btn" onclick="openEditWalk(${i})">✏️ Editar</button>
                <button class="admin-walk-btn delete-btn" style="border-color:var(--danger-light); color:#fca5a5;" onclick="delWalk(${i})">🗑️ Borrar</button>
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
                    <span>📸 ${(w.fotos||[]).length} fotos</span>
                </div>
                <p><strong>Resumen:</strong> ${w.resumen_diario}</p>
                ${w.comportamiento_problemas ? '<div class="incident-alert">⚠️ Problemas de comportamiento</div>' : '<div class="success-notice">✅ Paseo tranquilo</div>'}
                ${w.incidentes_salud ? `<div class="incident-alert">🩺 <strong>Salud:</strong> ${w.incidentes_salud}</div>` : ''}
                <div class="gallery">${imgs}</div>
            </div>
        `;
        c.appendChild(session);
    });
}

// === LIGHTBOX ===
window.openLightbox = (id) => {
    document.getElementById('lightbox-img').src = getPhotoUrl(id,800,800);
    document.getElementById('lightbox').style.display = 'flex';
};
document.getElementById('close-lightbox').onclick = () => document.getElementById('lightbox').style.display = 'none';

// === EDIT WALK LOGIC (CORREGIDO PARA NO BORRAR DATOS) ===
window.openEditWalk = (walkIndex) => {
    if (!currentDog || currentDog.isExample) return;
    editWalkIdx = walkIndex;
    const walk = currentDog.walks[walkIndex];
    
    // Llenar formulario solo la primera vez, no si ya estamos editando fotos
    document.getElementById('edit-walk-date').value = walk.fecha;
    document.getElementById('edit-walk-duration').value = walk.duracion_minutos;
    document.getElementById('edit-walk-distance').value = walk.distancia_km;
    document.getElementById('edit-walk-summary').value = walk.resumen_diario;
    document.getElementById('edit-walk-behavior').checked = walk.comportamiento_problemas;
    document.getElementById('edit-walk-health').value = walk.incidentes_salud || '';
    
    editWalkPhotos = [...(walk.fotos || [])];
    renderEditPhotos();
    
    document.getElementById('edit-walk-modal').style.display = 'flex';
};

function renderEditPhotos() {
    const preview = document.getElementById('edit-photo-preview');
    preview.innerHTML = '';
    editWalkPhotos.forEach((f, i) => {
        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'relative';
        imgContainer.style.display = 'inline-block';
        
        const img = document.createElement('img');
        img.src = getPhotoUrl(f.id, 100, 100);
        
        const btn = document.createElement('button');
        btn.innerHTML = '×';
        btn.className = 'delete-photo-btn';
        btn.onclick = () => {
            editWalkPhotos.splice(i, 1);
            renderEditPhotos(); // Re-render solo fotos, no todo el form
        };
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(btn);
        preview.appendChild(imgContainer);
    });
}

window.addPhotoEdit = () => {
    // Agregar foto sin borrar el texto del formulario
    const randomId = ['1581268694', '1581268695', '1581268696'][Math.floor(Math.random()*3)];
    editWalkPhotos.push({ id: randomId, comentario: 'Foto agregada' });
    renderEditPhotos(); // Solo actualizamos la sección de fotos
};

document.getElementById('edit-walk-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentDog || currentDog.isExample || editWalkIdx === null) return;

    const updatedWalk = {
        fecha: document.getElementById('edit-walk-date').value,
        duracion_minutos: parseInt(document.getElementById('edit-walk-duration').value),
        distancia_km: parseFloat(document.getElementById('edit-walk-distance').value),
        resumen_diario: document.getElementById('edit-walk-summary').value,
        comportamiento_problemas: document.getElementById('edit-walk-behavior').checked,
        incidentes_salud: document.getElementById('edit-walk-health').value,
        fotos: editWalkPhotos
    };

    currentDog.walks[editWalkIdx] = updatedWalk;
    
    try {
        await updateRealDogWalks(currentDog.id, currentDog.walks);
        showToast('✅ Paseo actualizado', 'success');
        document.getElementById('edit-walk-modal').style.display = 'none';
        loadHistory(currentDog);
    } catch (err) {
        showToast('❌ Error al guardar cambios', 'error');
    }
};

window.delWalk = (walkIndex) => {
    if (!confirm('¿Eliminar este paseo?')) return;
    if (!currentDog || currentDog.isExample) return;

    const newWalks = [...currentDog.walks];
    newWalks.splice(walkIndex, 1);

    updateRealDogWalks(currentDog.id, newWalks)
        .then(() => {
            currentDog.walks = newWalks;
            showToast('🗑️ Paseo eliminado', 'success');
            loadHistory(currentDog);
        })
        .catch(err => showToast('❌ Error al eliminar', 'error'));
};

// === CARGA INICIAL ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('photo-upload-input').addEventListener('change', (e) => {
        if(e.target.files[0]) uploadProfilePhoto(e.target.files[0]);
    });
});

window.onload = async () => {
    await loadExampleDogs(); // Carga ejemplo o fallback
    document.getElementById('loading-overlay').style.display = 'none';
    showView('login-section');
    
    // Config de audio inicial
    const audioToggle = document.getElementById('audio-toggle');
    const savedAudio = localStorage.getItem('paseoDogAudio');
    if (savedAudio === 'off') {
        isAudioEnabled = false;
        audioToggle.textContent = '🔇';
    }
    audioToggle.onclick = (e) => {
        isAudioEnabled = !isAudioEnabled;
        audioToggle.textContent = isAudioEnabled ? '🔊' : '🔇';
        localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off');
        if(!isAudioEnabled && carouselAudio) { carouselAudio.pause(); isPlaying=false; }
    };
    
    document.addEventListener('click', () => {
        if (!userHasInteracted) userHasInteracted = true;
    }, { once: true });
};