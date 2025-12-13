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
// 2. DATOS DE RESPALDO Y VARIABLES GLOBALES
// ==========================================

const FALLBACK_DB = {
  "dogs": [
    { "id": 995, "nombre": "Fido (Ejemplo)", "dueno_email": "cliente@paseos.com", "perfil": { "raza": "Pastor Alemán", "foto_id": "1589941013453-ec89f33b5e95", "telefono": "5491155550000" }, "walks": [] },
    { "id": 996, "nombre": "Luna (Ejemplo)", "dueno_email": "luna@paseos.com", "perfil": { "raza": "Bulldog", "foto_id": "1583511655857-d19b40a7a54e", "telefono": "5491155550000" }, "walks": [] },
    { "id": 997, "nombre": "Max (Ejemplo)", "dueno_email": "max@paseos.com", "perfil": { "raza": "Golden Retriever", "foto_id": "1633722715463-d30f4f325e24", "telefono": "5491155550000" }, "walks": [] },
    { "id": 998, "nombre": "Bella (Ejemplo)", "dueno_email": "bella@paseos.com", "perfil": { "raza": "Beagle", "foto_id": "1537151608828-ea2b11777ee8", "telefono": "5491155550000" }, "walks": [] },
    { "id": 999, "nombre": "Rocky (Ejemplo)", "dueno_email": "rocky@paseos.com", "perfil": { "raza": "Rottweiler", "foto_id": "1561037404-61cd46aa615b", "telefono": "5491155550000" }, "walks": [] }
  ],
  "admin": { "email": "admin@paseos.com", "password": "admin123" }
};

const DB_URL = 'paseoDogDB.json';
let TRAINER_PHONE = "5491100000000";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let EXAMPLE_DOGS = [];
let REAL_DOGS = [];
let DATABASE = null;

// ESTADO GLOBAL
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = []; // Fotos para NUEVO paseo
let simulatedPhotos = [], isEditing = false, backStack = [];
let editWalkIdx = null, editWalkPhotos = []; // Fotos para EDICIÓN de paseo
let slideInterval = null, isPlaying = false;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isAudioEnabled = true;
let hasPlayedWelcome = false;
let userHasInteracted = false;
let carouselAudio = null;

// ==========================================
// 3. UTILIDADES (Toast, URL Fotos, Ripples)
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
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add('ripple-effect');
    const ripple = button.querySelector('.ripple-effect');
    if (ripple) ripple.remove();
    button.appendChild(circle);
}

function getPhotoUrl(id, w = 400, h = 400) {
    if(!id) return 'https://via.placeholder.com/400?text=No+Foto';
    
    // Si contiene puntos (extensión) o prefijos conocidos, es de Supabase o local
    if (id.includes('perfil_') || id.includes('walk_') || id.includes('.')) { 
       if(id.startsWith('http')) {
           return id;
       }
       // Construir URL pública de Supabase
       return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
    }
    // Si es un ID simple, asumimos Unsplash (para datos de ejemplo)
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

// ==========================================
// 4. CARGA DE DATOS (DB Local y Supabase)
// ==========================================

async function loadExampleDogs() {
    try {
        const res = await fetch(DB_URL);
        if (!res.ok) throw new Error("Fallo carga local");
        const data = await res.json();
        processLoadedData(data);
    } catch (err) {
        console.warn("⚠️ Usando base de datos de respaldo interna.");
        processLoadedData(FALLBACK_DB);
    }
}

function processLoadedData(data) {
    const exampleIds = [995, 996, 997, 998, 999];
    EXAMPLE_DOGS = (data.dogs || []).map((d, index) => ({
        ...d,
        id: exampleIds[index] || (1000 + index),
        isExample: true
    }));
    TRAINER_PHONE = data.trainer_phone || "5491100000000";
    if(data.admin) ADMIN_USER = data.admin;
    DATABASE = data;
}

async function loadRealDogs() {
    if (!supabaseClient) return [];
    
    const { data, error } = await supabaseClient
        .from('dogs_real')
        .select('*')
        .order('nombre', { ascending: true });
    
    if (error) {
        console.error('Error Supabase Load:', error);
        return [];
    }
    return data.map(d => ({ ...d, isReal: true }));
}

async function loadAllDogs() {
    const reals = await loadRealDogs();
    REAL_DOGS = reals;
    return [...EXAMPLE_DOGS, ...reals];
}

// ACCIONES EN SUPABASE (Insert/Update)

async function saveRealDog(dogData) {
    if (!supabaseClient) throw new Error("Sin conexión a base de datos");
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

async function updateRealDogWalks(dogId, walks) {
    if (!supabaseClient) throw new Error("Sin conexión a base de datos");
    const { error } = await supabaseClient
        .from('dogs_real')
        .update({ walks })
        .eq('id', dogId);
    if (error) throw error;
}

async function updateRealDogProfile(dogId, newPerfil) {
    if (!supabaseClient) throw new Error("Sin conexión a base de datos");
    const { error } = await supabaseClient
        .from('dogs_real')
        .update({ perfil: newPerfil })
        .eq('id', dogId);
    if (error) throw error;
}

// ==========================================
// 5. GESTIÓN DE FOTOS (PERFIL) - ACTUALIZADO
// ==========================================

async function uploadProfilePhoto(file) {
    // 1. Validar Conexión
    if (!supabaseClient) {
        showToast('❌ Error de conexión con la base de datos', 'error');
        return;
    }

    // 2. Validar que no sea Ejemplo
    if (!currentDog || currentDog.isExample) {
        showToast('ℹ️ Los perros de ejemplo no se guardan en la nube. Crea uno nuevo.', 'info');
        return;
    }

    // 3. Validar Archivo
    const extension = file.name.split('.').pop().toLowerCase();
    const allowedTypes = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowedTypes.includes(extension)) {
        showToast('❌ Solo imágenes JPG, PNG o WebP', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Máximo 5MB por foto', 'error');
        return;
    }

    // 4. UI de carga (Fill Effect)
    const container = document.getElementById('profile-photo-container');
    if (container.querySelector('.uploading-fill')) return; 
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'uploading-fill';
    container.appendChild(loadingOverlay);

    const uploadInput = document.getElementById('photo-upload-input');
    uploadInput.disabled = true;

    // Nombre único
    const fileName = `perfil_${currentDog.id}_${Date.now()}.${extension}`;

    try {
        // 5. Subida a Storage
        const { error: uploadError } = await supabaseClient
            .storage
            .from('paseodog-photos')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        // 6. Actualizar DB
        const newPerfil = { ...currentDog.perfil, foto_id: fileName };
        await updateRealDogProfile(currentDog.id, newPerfil);

        // 7. Actualizar Estado Local
        REAL_DOGS = REAL_DOGS.map(d => d.id === currentDog.id ? { ...d, perfil: newPerfil } : d);
        currentDog.perfil = newPerfil;
        
        // 8. Refrescar imagen visualmente
        const img = document.getElementById('profile-photo');
        const newSrc = `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${fileName}`;
        
        const tempImg = new Image();
        tempImg.src = newSrc;
        tempImg.onload = () => {
            img.src = newSrc;
            showToast('✅ Foto actualizada', 'success');
            cleanup();
        };
        tempImg.onerror = () => {
            img.src = newSrc;
            showToast('✅ Subida (refresca si no se ve)', 'warning');
            cleanup();
        };

    } catch (err) {
        console.error('Error subida:', err);
        showToast('❌ Error: ' + (err.message || 'Desconocido'), 'error');
        cleanup();
    }

    function cleanup() {
        if(loadingOverlay) loadingOverlay.remove();
        uploadInput.disabled = false;
        uploadInput.value = ''; 
    }
}

// ==========================================
// 6. AUDIO Y CARRUSEL
// ==========================================
const CARRUSEL_TRACKS = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];

function playRandomCarouselTrack() {
    if (!isAudioEnabled) return;
    if (carouselAudio) {
        carouselAudio.pause();
        carouselAudio = null;
    }
    
    const randomTrack = CARRUSEL_TRACKS[Math.floor(Math.random() * CARRUSEL_TRACKS.length)];
    carouselAudio = new Audio(randomTrack);
    
    carouselAudio.onended = () => { 
        isPlaying = false; 
        updatePlayBtnState(); 
        if(slideInterval) clearInterval(slideInterval);
    };
    
    carouselAudio.onerror = () => { console.log('Audio no disponible o bloqueado'); };
    carouselAudio.play().catch(e => { console.log('Autoplay bloqueado por navegador'); });
}

function updatePlayBtnState() {
    const btn = document.getElementById('play-pause-btn');
    const largeBtn = document.getElementById('carousel-play-large');
    const icon = isPlaying ? '⏸' : '▶';
    if(btn) btn.textContent = icon;
    if(largeBtn) largeBtn.textContent = icon;
    
    if(isPlaying) {
        largeBtn?.classList.add('playing');
        document.querySelector('.carousel-controls')?.classList.add('playing');
    } else {
        largeBtn?.classList.remove('playing');
        document.querySelector('.carousel-controls')?.classList.remove('playing');
    }
}

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
    let idx = slides.length - 1; 
    
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

    window.togglePlay = () => {
        isPlaying = !isPlaying;
        updatePlayBtnState();

        if(isPlaying) {
            playRandomCarouselTrack(); 
            if (slideInterval) clearInterval(slideInterval);
            slideInterval = setInterval(() => {
                window.nextSlide();
            }, 5000); 
        } else {
            if(carouselAudio) carouselAudio.pause();
            if(slideInterval) clearInterval(slideInterval);
        }
    };

    window.toggleFullscreen = () => {
        const elem = document.getElementById('carousel-container');
        if (!document.fullscreenElement) elem.requestFullscreen().catch(err => {});
        else document.exitFullscreen();
    };

    showSlide();
    updatePlayBtnState();
}

// ==========================================
// 7. UI, TEMA Y NAVEGACIÓN
// ==========================================

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.onclick = (e) => {
        createRipple(e, themeToggle);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.textContent = isDark ? '🐕‍🦺' : '🐩';
    };
}

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

async function showView(id, dogId = null) {
    const allDogs = await loadAllDogs();
    
    if(id !== currentView) backStack.push(currentView);
    currentView = id;

    // --- MANEJO DE VISIBILIDAD HEADER (LOGIN) ---
    // Si estamos en login, quitamos la clase. Si estamos dentro, la ponemos.
    if (id === 'login-section') {
        document.body.classList.remove('user-logged-in');
    } else {
        document.body.classList.add('user-logged-in');
    }

    // Detener música si salimos del dashboard del perro
    if (currentView !== 'dog-selection-dashboard') {
        if(slideInterval) clearInterval(slideInterval);
        if(carouselAudio) { carouselAudio.pause(); isPlaying=false; }
    }

    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    if(dogId) {
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
            currentWalkFiles = [];
            document.getElementById('photo-preview').innerHTML = '';
            loadMultiDog();
        }
    }

    if(id === 'admin-dashboard-section') loadAdminDashboard();
    
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

// ==========================================
// 8. LOGIN Y REGISTRO
// ==========================================

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
        document.body.classList.add('user-logged-in'); // ACTIVAR HEADER
        showView('admin-dashboard-section');
    } else {
        const d = allDogs.find(x => x.dueno_email === em);
        if(d && pw === '123456'){
            currentUser = { email: em, isAdmin: false };
            currentDog = d;
            document.body.classList.add('user-logged-in'); // ACTIVAR HEADER
            showView('dog-selection-dashboard');
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    }
};

// ==========================================
// 9. ADMIN DASHBOARD Y CREAR PERRO
// ==========================================

async function loadAdminDashboard() {
    const allDogs = await loadAllDogs();
    const c = document.getElementById('dog-list-container');
    c.innerHTML = '';
    const statusText = document.getElementById('demo-status-text');
    if(statusText) statusText.textContent = `${allDogs.length} perros en sistema`;
    
    if(!allDogs.length) return c.innerHTML = '<p class="info-text">Sin perros registrados.</p>';
    
    allDogs.forEach((d, i) => {
        const suffix = d.isExample ? ' (ejemplo)' : '';
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
            <span>🐶 <strong>${d.nombre}</strong> <small style="color:var(--text-secondary)">(${d.perfil.raza})${suffix}</small></span>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        c.appendChild(card);
        card.querySelector('button').addEventListener('click', (e) => createRipple(e));
    });
}

document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
        showToast('❌ Error: No hay conexión con la base de datos.', 'error');
        return;
    }

    const submitBtn = document.querySelector('#create-dog-form .save-btn');
    if(submitBtn.disabled) return;
    
    submitBtn.innerHTML = '🔄 Guardando...';
    submitBtn.disabled = true;
    
    try {
        const nd = {
            nombre: document.getElementById('new-dog-name').value,
            dueno_email: document.getElementById('new-dog-email').value.toLowerCase(),
            perfil: {
                raza: document.getElementById('new-dog-breed').value,
                sexo: document.getElementById('new-dog-sex').value,
                dueno: document.getElementById('new-dog-owner').value,
                telefono: document.getElementById('new-dog-phone').value,
                foto_id: '1581268694', 
                edad: '?', peso: '?', alergias: 'Ninguna', energia: 'Media', social: '?'
            },
            walks: []
        };
        await saveRealDog(nd);
        showToast('✅ Perro registrado con éxito', 'success');
        document.getElementById('create-dog-form').reset();
        showView('admin-dashboard-section');
    } catch (err) {
        showToast('❌ Error: ' + (err.message || 'Desconocido'), 'error');
    } finally {
        submitBtn.innerHTML = '💾 Guardar en Base de Datos';
        submitBtn.disabled = false;
    }
};

// ==========================================
// 10. PERFIL Y EDICIÓN
// ==========================================

function loadProfile(d) {
    const p = d.perfil;
    let photoSrc = getPhotoUrl(p.foto_id, 300, 300);
    
    document.getElementById('profile-photo').src = photoSrc;
    document.getElementById('profile-dog-name-display').textContent = d.nombre;
    
    const canEdit = currentUser?.isAdmin && !d.isExample;
    document.getElementById('edit-photo-btn').style.display = (isEditing && canEdit) ? 'block' : 'none';
    
    const toggleBtn = document.getElementById('toggle-edit-btn');
    if (!canEdit) {
        toggleBtn.style.display = 'none';
    } else {
        toggleBtn.style.display = 'block';
        toggleBtn.textContent = isEditing ? '❌ Cancelar' : '✏️ Editar Perfil';
    }
    
    const v = document.getElementById('profile-details-view');
    
    if (isEditing && !d.isExample) {
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

            <h3>🎾 Comportamiento</h3>
            <div class="detail-row"><span class="detail-label">Energía:</span> <span class="detail-value">${p.energia || '?'}</span></div>
            <div class="detail-row"><span class="detail-label">Social:</span> <span class="detail-value">${p.social || '?'}</span></div>
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

// ==========================================
// 11. CREAR PASEO (Lógica de Fotos)
// ==========================================

function renderWalkPreview() {
    const container = document.getElementById('photo-preview');
    container.innerHTML = '';

    currentWalkFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.width = '80px';
        div.style.height = '80px';
        div.style.margin = '5px';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'delete-photo-btn'; 
        delBtn.onclick = () => {
            currentWalkFiles.splice(index, 1);
            renderWalkPreview();
        };

        div.appendChild(img);
        div.appendChild(delBtn);
        container.appendChild(div);
    });
}

async function loadMultiDog(){
    const c = document.getElementById('multi-dog-container');
    c.innerHTML = '';
    const allDogs = await loadAllDogs();
    allDogs.filter(d => String(d.id) !== String(currentDog.id)).forEach(d => {
        c.innerHTML += `<div class="dog-select-item"><input type="checkbox" value="${d.id}" id="md${d.id}"><label for="md${d.id}" style="margin:0">${d.nombre}</label></div>`;
    });
}

document.getElementById('walk-form').onsubmit = async (e) => {
    e.preventDefault();
    if (currentDog?.isExample) return showToast('ℹ️ Ejemplo: no editable', 'info');
    if (!supabaseClient) return showToast('❌ Error DB', 'error');

    const submitBtn = document.querySelector('#walk-form .save-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    
    try {
        const uploadedPhotos = [];

        if (currentWalkFiles.length > 0) {
            for (let i = 0; i < currentWalkFiles.length; i++) {
                const file = currentWalkFiles[i];
                const ext = file.name.split('.').pop().toLowerCase();
                const fileName = `walk_${currentDog.id}_${Date.now()}_${i}.${ext}`;
                
                submitBtn.innerHTML = `☁️ Subiendo ${i+1} de ${currentWalkFiles.length}...`;

                const { error } = await supabaseClient
                    .storage
                    .from('paseodog-photos')
                    .upload(fileName, file);

                if (error) throw error;
                
                uploadedPhotos.push({
                    id: fileName,
                    comentario: 'Foto del paseo'
                });
            }
        }

        submitBtn.innerHTML = '💾 Guardando datos...';

        const w = {
            fecha: document.getElementById('walk-date').value,
            duracion_minutos: parseInt(document.getElementById('walk-duration').value),
            distancia_km: parseFloat(document.getElementById('walk-distance').value),
            resumen_diario: document.getElementById('walk-summary').value,
            comportamiento_problemas: document.getElementById('comportamiento-problemas').checked,
            incidentes_salud: document.getElementById('incidentes-salud').value,
            fotos: uploadedPhotos 
        };

        let updatedWalks = [w, ...(currentDog.walks || [])];
        await updateRealDogWalks(currentDog.id, updatedWalks);
        currentDog.walks = updatedWalks;

        const others = document.querySelectorAll('#multi-dog-container input:checked');
        for (const chk of others) {
            const otherDogId = chk.value;
            const otherDog = REAL_DOGS.find(d => String(d.id) === String(otherDogId));
            if(otherDog) {
                const otherWalks = [w, ...(otherDog.walks || [])];
                await updateRealDogWalks(otherDogId, otherWalks);
            }
        }
        
        showToast('✅ Paseo guardado', 'success');
        showView('dog-selection-dashboard');

    } catch (err) {
        console.error(err);
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText; 
        submitBtn.disabled = false;
        currentWalkFiles = [];
        renderWalkPreview();
    }
};

// ==========================================
// 12. HISTORIAL Y EDICIÓN DE PASEOS
// ==========================================

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

window.openLightbox = (id) => {
    document.getElementById('lightbox-img').src = getPhotoUrl(id,800,800);
    document.getElementById('lightbox').style.display = 'flex';
};
document.getElementById('close-lightbox').onclick = () => document.getElementById('lightbox').style.display = 'none';

window.openEditWalk = (walkIndex) => {
    if (!currentDog || currentDog.isExample) return;
    editWalkIdx = walkIndex;
    const walk = currentDog.walks[walkIndex];
    
    document.getElementById('edit-walk-date').value = walk.fecha;
    document.getElementById('edit-walk-duration').value = walk.duracion_minutos;
    document.getElementById('edit-walk-distance').value = walk.distancia_km;
    document.getElementById('edit-walk-summary').value = walk.resumen_diario;
    document.getElementById('edit-walk-behavior').checked = walk.comportamiento_problemas;
    document.getElementById('edit-walk-health').value = walk.incidentes_salud || '';
    
    editWalkPhotos = [...(walk.fotos || [])];
    renderEditPhotos();
    
    document.getElementById('edit-walk-upload-input').value = '';
    document.getElementById('edit-walk-modal').style.display = 'flex';
};

function renderEditPhotos() {
    const preview = document.getElementById('edit-photo-preview');
    preview.innerHTML = '';
    editWalkPhotos.forEach((f, i) => {
        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'relative';
        imgContainer.style.display = 'inline-block';
        imgContainer.style.margin = '5px';
        
        const img = document.createElement('img');
        img.src = getPhotoUrl(f.id, 100, 100);
        img.style.borderRadius = '8px';
        
        const btn = document.createElement('button');
        btn.innerHTML = '×';
        btn.className = 'delete-photo-btn';
        btn.onclick = (e) => {
            e.preventDefault(); 
            editWalkPhotos.splice(i, 1);
            renderEditPhotos();
        };
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(btn);
        preview.appendChild(imgContainer);
    });
}

window.triggerEditUpload = () => {
    document.getElementById('edit-walk-upload-input').click();
};

const editFileInput = document.getElementById('edit-walk-upload-input');
if(editFileInput) {
    editFileInput.addEventListener('change', async (e) => {
        if (!e.target.files || !e.target.files[0]) return;
        if (!supabaseClient) return showToast('❌ Error DB', 'error');
        
        const file = e.target.files[0];
        const btn = document.getElementById('btn-add-edit-photo');
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '⌛ Subiendo...';

        try {
            const ext = file.name.split('.').pop().toLowerCase();
            const fileName = `walk_edit_${Date.now()}.${ext}`;

            const { error } = await supabaseClient
                .storage
                .from('paseodog-photos')
                .upload(fileName, file);

            if (error) throw error;

            editWalkPhotos.push({
                id: fileName,
                comentario: 'Foto agregada en edición'
            });
            renderEditPhotos();
            showToast('✅ Foto subida', 'success');

        } catch (err) {
            console.error(err);
            showToast('❌ Error subida: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            e.target.value = ''; 
        }
    });
}

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

// ==========================================
// 13. INICIALIZACIÓN (DOM & ONLOAD)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const photoInput = document.getElementById('photo-upload-input');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            if(e.target.files[0]) uploadProfilePhoto(e.target.files[0]);
        });
    }

    const addBtn = document.getElementById('add-walk-photo-btn');
    const walkInput = document.getElementById('walk-photo-input');
    if (addBtn && walkInput) {
        addBtn.onclick = () => walkInput.click();
        walkInput.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const newFiles = Array.from(e.target.files);
                currentWalkFiles = [...currentWalkFiles, ...newFiles];
                renderWalkPreview();
            }
            e.target.value = '';
        };
    }

    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mainNav = document.getElementById('main-nav');
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mainNav.classList.toggle('show');
            hamburgerBtn.textContent = mainNav.classList.contains('show') ? '✕' : '☰';
        });
    }

    document.addEventListener('click', (e) => {
        if (mainNav && mainNav.classList.contains('show')) {
            if (!mainNav.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                mainNav.classList.remove('show');
                hamburgerBtn.textContent = '☰';
            }
        }
    });

    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => {
            mainNav.classList.remove('show');
            hamburgerBtn.textContent = '☰';
            
            if (currentUser && currentUser.isAdmin) {
                showView('admin-dashboard-section');
            } else if (currentDog) {
                showView('dog-selection-dashboard');
            } else {
                showView('login-section');
            }
        });
    }

    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', () => {
            mainNav.classList.remove('show');
            hamburgerBtn.textContent = '☰';
            
            currentUser = null;
            currentDog = null;
            hasPlayedWelcome = false;
            backStack = [];
            
            document.body.classList.remove('user-logged-in'); // OCULTAR HEADER
            
            if (carouselAudio) {
                carouselAudio.pause();
                carouselAudio = null;
            }
            if (slideInterval) {
                clearInterval(slideInterval);
            }
            isPlaying = false;
            
            showView('login-section');
            showToast('👋 Sesión cerrada', 'info');
        });
    }
});

window.onload = async () => {
    try {
        await loadExampleDogs();
    } catch (e) {
        console.error("Error cargando datos locales:", e);
    } finally {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }
    
    // Asegurar estado inicial limpio
    document.body.classList.remove('user-logged-in');
    showView('login-section');
    
    const audioToggle = document.getElementById('audio-toggle');
    const savedAudio = localStorage.getItem('paseoDogAudio');
    if (savedAudio === 'off') {
        isAudioEnabled = false;
        if(audioToggle) audioToggle.textContent = '🔇';
    }
    if(audioToggle) {
        audioToggle.onclick = (e) => {
            isAudioEnabled = !isAudioEnabled;
            audioToggle.textContent = isAudioEnabled ? '🔊' : '🔇';
            localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off');
            if(!isAudioEnabled && carouselAudio) { carouselAudio.pause(); isPlaying=false; }
        };
    }
    
    document.addEventListener('click', () => {
        if (!userHasInteracted) userHasInteracted = true;
    }, { once: true });
};