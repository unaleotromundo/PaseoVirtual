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
    } else { console.warn('⚠️ Supabase offline.'); }
} catch (err) { console.error('❌ Error Supabase:', err); }

// ==========================================
// 2. DATOS
// ==========================================
// Datos de respaldo por si falla el JSON
const FALLBACK_DB = {
  "dogs": [
    { "id": 995, "nombre": "Fido (Ejemplo)", "dueno_email": "cliente@paseos.com", "perfil": { "raza": "Pastor Alemán", "foto_id": "https://images.pexels.com/photos/163036/malamute-dog-animal-163036.jpeg", "telefono": "5491155550000" }, "walks": [] }
  ],
  "admin": { "email": "admin@paseos.com", "password": "admin123" }
};

const DB_URL = 'paseoDogDB.json';
let TRAINER_PHONE = "5491100000000";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let EXAMPLE_DOGS = [];
let REAL_DOGS = [];
let DATABASE = null;

let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [], simulatedPhotos = [], isEditing = false, backStack = [];
let editWalkIdx = null, editWalkPhotos = [], slideInterval = null, isPlaying = false;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isAudioEnabled = true, hasPlayedWelcome = false, userHasInteracted = false, carouselAudio = null;

// ==========================================
// 3. UTILIDADES
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
    if(id.startsWith('http')) return id;
    if (id.includes('perfil_') || id.includes('walk_') || id.includes('.')) { 
       if(id.includes('.')) return id; 
       return `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${id}`;
    }
    return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

// ==========================================
// 4. CARGA DE DATOS
// ==========================================
async function loadExampleDogs() {
    try {
        const res = await fetch(DB_URL);
        if (!res.ok) throw new Error("Fallo carga local");
        const data = await res.json();
        processLoadedData(data);
    } catch (err) {
        processLoadedData(FALLBACK_DB);
    }
}

function processLoadedData(data) {
    EXAMPLE_DOGS = (data.dogs || []).map((d, index) => ({
        ...d, id: d.id || (1000 + index), isExample: true
    }));
    TRAINER_PHONE = data.trainer_phone || "5491100000000";
    if(data.admin) ADMIN_USER = data.admin;
    DATABASE = data;
}

async function loadRealDogs() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient.from('dogs_real').select('*').order('nombre', { ascending: true });
    if (error) return [];
    return data.map(d => ({ ...d, isReal: true }));
}

async function loadAllDogs() {
    const reals = await loadRealDogs();
    REAL_DOGS = reals;
    return [...EXAMPLE_DOGS, ...reals];
}

async function saveRealDog(dogData) {
    if (!supabaseClient) throw new Error("Sin conexión DB");
    const { error } = await supabaseClient.from('dogs_real').insert([{ ...dogData }]);
    if (error) throw error;
}
async function updateRealDogWalks(dogId, walks) {
    if (!supabaseClient) throw new Error("Sin conexión DB");
    const { error } = await supabaseClient.from('dogs_real').update({ walks }).eq('id', dogId);
    if (error) throw error;
}
async function updateRealDogProfile(dogId, newPerfil) {
    if (!supabaseClient) throw new Error("Sin conexión DB");
    const { error } = await supabaseClient.from('dogs_real').update({ perfil: newPerfil }).eq('id', dogId);
    if (error) throw error;
}

// ==========================================
// 5. GESTIÓN FOTOS PERFIL
// ==========================================
async function uploadProfilePhoto(file) {
    if (!supabaseClient) return showToast('❌ Error conexión', 'error');
    if (!currentDog || currentDog.isExample) return showToast('ℹ️ Los ejemplos no se editan', 'info');
    
    const extension = file.name.split('.').pop().toLowerCase();
    const fileName = `perfil_${currentDog.id}_${Date.now()}.${extension}`;
    const container = document.getElementById('profile-photo-container');
    const loading = document.createElement('div'); loading.className = 'uploading-fill'; container.appendChild(loading);

    try {
        const { error } = await supabaseClient.storage.from('paseodog-photos').upload(fileName, file, { upsert: true });
        if (error) throw error;
        const newPerfil = { ...currentDog.perfil, foto_id: fileName };
        await updateRealDogProfile(currentDog.id, newPerfil);
        REAL_DOGS = REAL_DOGS.map(d => d.id === currentDog.id ? { ...d, perfil: newPerfil } : d);
        currentDog.perfil = newPerfil;
        document.getElementById('profile-photo').src = `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${fileName}`;
        showToast('✅ Foto actualizada', 'success');
    } catch (err) { showToast('❌ Error subida', 'error'); } 
    finally { loading.remove(); }
}

// ==========================================
// 6. CARRUSEL
// ==========================================
const CARRUSEL_TRACKS = ['musica1.mp3', 'musica2.mp3', 'musica3.mp3', 'musica4.mp3'];
function playRandomCarouselTrack() {
    if (!isAudioEnabled) return;
    if (carouselAudio) { carouselAudio.pause(); carouselAudio = null; }
    const randomTrack = CARRUSEL_TRACKS[Math.floor(Math.random() * CARRUSEL_TRACKS.length)];
    carouselAudio = new Audio(randomTrack);
    carouselAudio.onended = () => { isPlaying = false; updatePlayBtnState(); if(slideInterval) clearInterval(slideInterval); };
    carouselAudio.play().catch(e => {});
}

function updatePlayBtnState() {
    const btn = document.getElementById('play-pause-btn');
    const largeBtn = document.getElementById('carousel-play-large');
    const icon = isPlaying ? '⏸' : '▶';
    if(btn) btn.textContent = icon;
    if(largeBtn) largeBtn.textContent = icon;
    if(isPlaying) { largeBtn?.classList.add('playing'); document.querySelector('.carousel-controls')?.classList.add('playing'); } 
    else { largeBtn?.classList.remove('playing'); document.querySelector('.carousel-controls')?.classList.remove('playing'); }
}

function initCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const slides = [];
    if (currentDog && currentDog.walks) currentDog.walks.forEach(wa => { if (wa.fotos) wa.fotos.forEach(f => slides.push(f.id)); });

    if (!slides.length) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = 'flex';
    let idx = slides.length - 1; 
    isPlaying = false; if (slideInterval) clearInterval(slideInterval);

    const img = document.getElementById('carousel-img');
    const counter = document.getElementById('carousel-counter');
    const showSlide = () => {
        const photoUrl = getPhotoUrl(slides[idx], 800, 500);
        img.style.opacity = 0;
        setTimeout(() => {
            img.src = photoUrl;
            wrapper.style.backgroundImage = `url('${photoUrl}')`;
            img.onload = () => { img.style.opacity = 1; };
            counter.textContent = `${idx + 1} / ${slides.length}`;
        }, 200);
    };

    window.nextSlide = () => { idx = (idx + 1) % slides.length; showSlide(); };
    window.prevSlide = () => { idx = (idx - 1 + slides.length) % slides.length; showSlide(); };
    window.togglePlay = () => {
        isPlaying = !isPlaying; updatePlayBtnState();
        if(isPlaying) { playRandomCarouselTrack(); if (slideInterval) clearInterval(slideInterval); slideInterval = setInterval(window.nextSlide, 5000); } 
        else { if(carouselAudio) carouselAudio.pause(); if(slideInterval) clearInterval(slideInterval); }
    };
    window.toggleFullscreen = () => {
        const elem = document.getElementById('carousel-wrapper');
        if (!document.fullscreenElement) elem.requestFullscreen().catch(err => {});
        else document.exitFullscreen();
    };
    showSlide(); updatePlayBtnState();
}

// ==========================================
// 7. UI Y NAVEGACIÓN
// ==========================================
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) themeToggle.onclick = (e) => {
    createRipple(e, themeToggle);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.textContent = isDark ? '🐕‍🦺' : '🐩';
};

function updateWhatsApp() {
    const btn = document.getElementById('whatsapp-btn');
    if(currentView.includes('login') || currentView.includes('admin-dashboard')){ btn.style.display='none'; return; }
    btn.style.display='flex';
    let num = TRAINER_PHONE;
    if(currentUser && currentUser.isAdmin && currentDog && !currentDog.isExample) num = currentDog.perfil.telefono.replace(/[^0-9]/g, '');
    btn.href = `https://wa.me/${num}`;
}

async function showView(id, dogId = null) {
    const allDogs = await loadAllDogs();
    currentView = id;
    if (id === 'login-section') document.body.classList.remove('user-logged-in');
    else document.body.classList.add('user-logged-in');

    if (currentView !== 'dog-selection-dashboard') { if(slideInterval) clearInterval(slideInterval); if(carouselAudio) { carouselAudio.pause(); isPlaying=false; } }
    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    if(dogId) currentDog = allDogs.find(d => String(d.id) === String(dogId));
    if(currentDog) {
        document.querySelectorAll('.dog-name-placeholder').forEach(e => e.textContent = currentDog.nombre);
        if(id === 'dog-selection-dashboard') {
            document.getElementById('admin-create-walk-btn').style.display = currentUser?.isAdmin ? 'block' : 'none';
            initCarousel();
        }
        if(id === 'profile-section') { isEditing = false; loadProfile(currentDog); }
        if(id === 'walks-history-section') loadHistory(currentDog);
        if(id === 'create-walk-section') {
            document.getElementById('walk-form').reset(); document.getElementById('walk-date').valueAsDate = new Date();
            currentWalkFiles = []; document.getElementById('photo-preview').innerHTML = ''; loadMultiDog();
        }
    }
    if(id === 'admin-dashboard-section') loadAdminDashboard();
    if((id === 'dog-selection-dashboard' || id === 'admin-dashboard-section') && userHasInteracted) playWelcomeSound();
    updateWhatsApp(); window.scrollTo(0,0);
}

function goBack() {
    switch (currentView) {
        case 'create-walk-section':
        case 'walks-history-section':
        case 'profile-section': showView('dog-selection-dashboard', currentDog ? currentDog.id : null); break;
        case 'create-dog-section': showView('admin-dashboard-section'); break;
        case 'dog-selection-dashboard':
            if (currentUser && currentUser.isAdmin) showView('admin-dashboard-section');
            else showView('login-section');
            break;
        case 'admin-dashboard-section': showView('login-section'); break;
        default: showView('login-section'); break;
    }
}

function playWelcomeSound() {
    if (!isAudioEnabled || hasPlayedWelcome) return;
    hasPlayedWelcome = true;
    const o = audioContext.createOscillator(); const g = audioContext.createGain();
    o.connect(g); g.connect(audioContext.destination);
    o.frequency.value = 660; g.gain.setValueAtTime(0.05, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    o.start(); o.stop(audioContext.currentTime + 0.3);
}

// ==========================================
// 8. ADMIN Y LOGIN
// ==========================================
document.getElementById('toggle-password').onclick = () => { const p = document.getElementById('password'); p.type = p.type === 'password' ? 'text' : 'password'; };
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const em = document.getElementById('email').value.toLowerCase();
    const pw = document.getElementById('password').value;
    const allDogs = await loadAllDogs();
    if(em === ADMIN_USER.email && pw === ADMIN_USER.password){
        currentUser = { email: em, isAdmin: true };
        document.body.classList.add('user-logged-in'); showView('admin-dashboard-section');
    } else {
        const d = allDogs.find(x => x.dueno_email === em);
        if(d && pw === '123456'){
            currentUser = { email: em, isAdmin: false }; currentDog = d;
            document.body.classList.add('user-logged-in'); showView('dog-selection-dashboard');
        } else { showToast('Credenciales incorrectas', 'error'); }
    }
};

async function loadAdminDashboard() {
    const allDogs = await loadAllDogs();
    const c = document.getElementById('dog-list-container'); c.innerHTML = '';
    document.getElementById('demo-status-text').textContent = `${allDogs.length} perros en sistema`;
    if(!allDogs.length) return c.innerHTML = '<p class="info-text">Sin perros registrados.</p>';
    
    allDogs.forEach((d, i) => {
        const suffix = d.isExample ? ' (ejemplo)' : '';
        const photoUrl = getPhotoUrl(d.perfil.foto_id, 60, 60);
        const card = document.createElement('div'); card.className = 'dog-card'; card.style.setProperty('--i', i);
        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                <img src="${photoUrl}" class="dog-list-thumb" alt="${d.nombre}" onerror="this.src='https://via.placeholder.com/50?text=🐶'">
                <div><strong style="font-size:1.1rem; display:block; line-height:1.2;">${d.nombre}</strong><small style="color:var(--text-secondary)">${d.perfil.raza}${suffix}</small></div>
            </div>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        c.appendChild(card);
        card.querySelector('button').addEventListener('click', (e) => createRipple(e));
    });
}

document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return showToast('❌ Error DB', 'error');
    const submitBtn = document.querySelector('#create-dog-form .save-btn'); submitBtn.disabled = true;
    try {
        const nd = {
            nombre: document.getElementById('new-dog-name').value, dueno_email: document.getElementById('new-dog-email').value.toLowerCase(),
            perfil: { raza: document.getElementById('new-dog-breed').value, sexo: document.getElementById('new-dog-sex').value, dueno: document.getElementById('new-dog-owner').value, telefono: document.getElementById('new-dog-phone').value, foto_id: '1581268694', edad: '?', peso: '?', alergias: 'Ninguna', energia: 'Media', social: '?' }, walks: []
        };
        await saveRealDog(nd); showToast('✅ Perro registrado', 'success');
        document.getElementById('create-dog-form').reset(); showView('admin-dashboard-section');
    } catch (err) { showToast('❌ Error: ' + err.message, 'error'); } finally { submitBtn.disabled = false; }
};

// ==========================================
// 9. PERFIL
// ==========================================
function loadProfile(d) {
    const p = d.perfil;
    document.getElementById('profile-photo').src = getPhotoUrl(p.foto_id, 300, 300);
    document.getElementById('profile-dog-name-display').textContent = d.nombre;
    const canEdit = currentUser?.isAdmin && !d.isExample;
    document.getElementById('edit-photo-btn').style.display = (isEditing && canEdit) ? 'block' : 'none';
    const toggleBtn = document.getElementById('toggle-edit-btn');
    if (!canEdit) toggleBtn.style.display = 'none'; else { toggleBtn.style.display = 'block'; toggleBtn.textContent = isEditing ? '❌ Cancelar' : '✏️ Editar Perfil'; }
    const v = document.getElementById('profile-details-view');

    if (isEditing && !d.isExample) {
        v.innerHTML = `<form id="profile-edit-form"></form>`;
        const form = document.getElementById('profile-edit-form');
        ['raza','edad','sexo','peso','alergias','dueno','telefono','energia','social'].forEach(k => { form.innerHTML += `<label>${k.charAt(0).toUpperCase() + k.slice(1)}</label><input type="text" name="${k}" value="${p[k] || ''}">`; });
        form.innerHTML += '<button type="submit" class="save-btn ripple">💾 Guardar Cambios</button>';
        
        if (currentUser && currentUser.isAdmin) {
            form.innerHTML += `
                <div style="margin-top: 30px; border-top: 2px dashed var(--danger-light); padding-top: 20px;">
                    <p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; margin-bottom:10px;">Zona de Peligro</p>
                    <button type="button" id="btn-delete-dog" onclick="deleteCurrentDog()" class="ripple" style="background-color: var(--danger); color: white; width: 100%;">🗑️ ELIMINAR MIMOSO</button>
                </div>
            `;
        }
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const updatedPerfil = { ...currentDog.perfil };
            for (let [key, value] of formData.entries()) updatedPerfil[key] = value;
            try { await updateRealDogProfile(currentDog.id, updatedPerfil); currentDog.perfil = updatedPerfil; showToast('✅ Actualizado', 'success'); isEditing = false; loadProfile(currentDog); } catch (err) { showToast('❌ Error', 'error'); }
        };
    } else {
        v.innerHTML = `
            <h3>🐕 Datos Básicos</h3><div class="detail-row"><span class="detail-label">Raza:</span> <span class="detail-value">${p.raza}</span></div><div class="detail-row"><span class="detail-label">Edad:</span> <span class="detail-value">${p.edad}</span></div><div class="detail-row"><span class="detail-label">Sexo:</span> <span class="detail-value">${p.sexo}</span></div>
            <h3>💊 Salud y Contacto</h3><div class="detail-row"><span class="detail-label">Peso:</span> <span class="detail-value">${p.peso}</span></div><div class="detail-row"><span class="detail-label">Alergias:</span> <span class="detail-value">${p.alergias}</span></div><div class="detail-row"><span class="detail-label">Dueño:</span> <span class="detail-value">${p.dueno}</span></div><div class="detail-row"><span class="detail-label">Teléfono:</span> <span class="detail-value">${p.telefono}</span></div>
            <h3>🎾 Comportamiento</h3><div class="detail-row"><span class="detail-label">Energía:</span> <span class="detail-value">${p.energia || '?'}</span></div><div class="detail-row"><span class="detail-label">Social:</span> <span class="detail-value">${p.social || '?'}</span></div>
        `;
    }
}
function toggleEditMode(){ if (currentDog?.isExample) return showToast('ℹ️ Ejemplo no editable', 'info'); isEditing = !isEditing; loadProfile(currentDog); }
function randomizeProfilePhoto(){ document.getElementById('photo-upload-input').click(); }

window.deleteCurrentDog = async () => {
    if (!currentDog || currentDog.isExample) return showToast('🔒 No puedes borrar ejemplos', 'info');
    if (!confirm(`⚠️ ¿Eliminar a ${currentDog.nombre}?\nSe borrará todo su historial.`)) return;
    if (!confirm(`🔴 ÚLTIMA ADVERTENCIA\n\n¿Realmente quieres eliminarlo?`)) return;
    try {
        const btn = document.getElementById('btn-delete-dog'); if(btn) btn.innerText = "⏳ Eliminando...";
        const { error } = await supabaseClient.from('dogs_real').delete().eq('id', currentDog.id);
        if (error) throw error;
        showToast('🗑️ Eliminado', 'success');
        REAL_DOGS = REAL_DOGS.filter(d => d.id !== currentDog.id);
        showView('admin-dashboard-section');
    } catch (err) { showToast('❌ Error: ' + err.message, 'error'); }
};

// ==========================================
// 10. PASEOS E HISTORIAL
// ==========================================
function renderWalkPreview() {
    const container = document.getElementById('photo-preview'); container.innerHTML = '';
    currentWalkFiles.forEach((file, index) => {
        const div = document.createElement('div'); div.style.position = 'relative'; div.style.width = '80px'; div.style.height = '80px'; div.style.margin = '5px';
        const img = document.createElement('img'); img.src = URL.createObjectURL(file); img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; img.style.borderRadius = '8px';
        const delBtn = document.createElement('button'); delBtn.innerHTML = '×'; delBtn.className = 'delete-photo-btn'; 
        delBtn.onclick = () => { currentWalkFiles.splice(index, 1); renderWalkPreview(); };
        div.appendChild(img); div.appendChild(delBtn); container.appendChild(div);
    });
}
async function loadMultiDog(){
    const c = document.getElementById('multi-dog-container'); c.innerHTML = '';
    const allDogs = await loadAllDogs();
    allDogs.filter(d => String(d.id) !== String(currentDog.id)).forEach(d => { c.innerHTML += `<div class="dog-select-item"><input type="checkbox" value="${d.id}" id="md${d.id}"><label for="md${d.id}" style="margin:0">${d.nombre}</label></div>`; });
}

document.getElementById('walk-form').onsubmit = async (e) => {
    e.preventDefault(); if (currentDog?.isExample) return showToast('ℹ️ Ejemplo no editable', 'info');
    if (!supabaseClient) return showToast('❌ Error DB', 'error');
    const submitBtn = document.querySelector('#walk-form .save-btn'); submitBtn.disabled = true;
    try {
        const uploadedPhotos = [];
        if (currentWalkFiles.length > 0) {
            for (let i = 0; i < currentWalkFiles.length; i++) {
                const ext = currentWalkFiles[i].name.split('.').pop().toLowerCase();
                const fileName = `walk_${currentDog.id}_${Date.now()}_${i}.${ext}`;
                await supabaseClient.storage.from('paseodog-photos').upload(fileName, currentWalkFiles[i]);
                uploadedPhotos.push({ id: fileName, comentario: 'Foto del paseo' });
            }
        }
        const w = { fecha: document.getElementById('walk-date').value, duracion_minutos: parseInt(document.getElementById('walk-duration').value), distancia_km: parseFloat(document.getElementById('walk-distance').value), resumen_diario: document.getElementById('walk-summary').value, comportamiento_problemas: document.getElementById('comportamiento-problemas').checked, incidentes_salud: document.getElementById('incidentes-salud').value, fotos: uploadedPhotos };
        
        let updatedWalks = [w, ...(currentDog.walks || [])]; await updateRealDogWalks(currentDog.id, updatedWalks); currentDog.walks = updatedWalks;
        const others = document.querySelectorAll('#multi-dog-container input:checked');
        for (const chk of others) {
            const otherDog = REAL_DOGS.find(d => String(d.id) === String(chk.value));
            if(otherDog) await updateRealDogWalks(otherDog.id, [w, ...(otherDog.walks || [])]);
        }
        showToast('✅ Paseo guardado', 'success'); showView('dog-selection-dashboard');
    } catch (err) { showToast('❌ Error: ' + err.message, 'error'); } finally { submitBtn.disabled = false; currentWalkFiles = []; renderWalkPreview(); }
};

function loadHistory(d) {
    const c = document.getElementById('walks-history'); c.innerHTML = '';
    if(!d.walks || !d.walks.length) return c.innerHTML = '<p class="info-text">Sin historial.</p>';
    d.walks.forEach((w,i) => {
        const imgs = (w.fotos || []).map(f => `<div class="photo-card" onclick="openLightbox('${f.id}')"><img src="${getPhotoUrl(f.id,200,200)}"></div>`).join('');
        const adminBtns = (currentUser && currentUser.isAdmin && !d.isExample) ? `<div class="admin-walk-controls"><button class="admin-walk-btn edit-btn" onclick="openEditWalk(${i})">✏️ Editar</button><button class="admin-walk-btn delete-btn" style="border-color:var(--danger-light); color:#fca5a5;" onclick="delWalk(${i})">🗑️ Borrar</button></div>` : '';
        const session = document.createElement('div'); session.className = 'walk-session'; session.style.setProperty('--i', i);
        session.innerHTML = `<h3><span>📅 ${w.fecha}</span> ${adminBtns}</h3><div class="walk-details"><div class="walk-metrics"><span>⏱️ ${w.duracion_minutos} min</span><span>📏 ${w.distancia_km} km</span><span>📸 ${(w.fotos||[]).length} fotos</span></div><p><strong>Resumen:</strong> ${w.resumen_diario}</p>${w.comportamiento_problemas ? '<div class="incident-alert">⚠️ Problemas</div>' : '<div class="success-notice">✅ Tranquilo</div>'}${w.incidentes_salud ? `<div class="incident-alert">🩺 ${w.incidentes_salud}</div>` : ''}<div class="gallery">${imgs}</div></div>`;
        c.appendChild(session);
    });
}
window.openLightbox = (id) => { document.getElementById('lightbox-img').src = getPhotoUrl(id,800,800); document.getElementById('lightbox').style.display = 'flex'; };
document.getElementById('close-lightbox').onclick = () => document.getElementById('lightbox').style.display = 'none';

window.openEditWalk = (walkIndex) => {
    editWalkIdx = walkIndex; const walk = currentDog.walks[walkIndex];
    document.getElementById('edit-walk-date').value = walk.fecha; document.getElementById('edit-walk-duration').value = walk.duracion_minutos; document.getElementById('edit-walk-distance').value = walk.distancia_km; document.getElementById('edit-walk-summary').value = walk.resumen_diario; document.getElementById('edit-walk-behavior').checked = walk.comportamiento_problemas; document.getElementById('edit-walk-health').value = walk.incidentes_salud || '';
    editWalkPhotos = [...(walk.fotos || [])]; renderEditPhotos(); document.getElementById('edit-walk-modal').style.display = 'flex';
};
function renderEditPhotos() {
    const preview = document.getElementById('edit-photo-preview'); preview.innerHTML = '';
    editWalkPhotos.forEach((f, i) => {
        const div = document.createElement('div'); div.style.position = 'relative'; div.style.margin = '5px';
        div.innerHTML = `<img src="${getPhotoUrl(f.id,100,100)}" style="border-radius:8px;"><button class="delete-photo-btn">×</button>`;
        div.querySelector('button').onclick = (e) => { e.preventDefault(); editWalkPhotos.splice(i, 1); renderEditPhotos(); };
        preview.appendChild(div);
    });
}
window.triggerEditUpload = () => document.getElementById('edit-walk-upload-input').click();
document.getElementById('edit-walk-upload-input').onchange = async (e) => {
    if(!e.target.files[0]) return;
    const btn = document.getElementById('btn-add-edit-photo'); btn.disabled = true; btn.innerHTML = '⌛ Subiendo...';
    try {
        const file = e.target.files[0]; const ext = file.name.split('.').pop().toLowerCase(); const fileName = `walk_edit_${Date.now()}.${ext}`;
        await supabaseClient.storage.from('paseodog-photos').upload(fileName, file);
        editWalkPhotos.push({ id: fileName }); renderEditPhotos(); showToast('✅ Foto subida', 'success');
    } catch (err) { showToast('❌ Error', 'error'); } finally { btn.disabled = false; btn.innerHTML = '➕ Subir Nueva Foto'; e.target.value = ''; }
};
document.getElementById('edit-walk-form').onsubmit = async (e) => {
    e.preventDefault();
    currentDog.walks[editWalkIdx] = { fecha: document.getElementById('edit-walk-date').value, duracion_minutos: parseInt(document.getElementById('edit-walk-duration').value), distancia_km: parseFloat(document.getElementById('edit-walk-distance').value), resumen_diario: document.getElementById('edit-walk-summary').value, comportamiento_problemas: document.getElementById('edit-walk-behavior').checked, incidentes_salud: document.getElementById('edit-walk-health').value, fotos: editWalkPhotos };
    try { await updateRealDogWalks(currentDog.id, currentDog.walks); showToast('✅ Actualizado', 'success'); document.getElementById('edit-walk-modal').style.display = 'none'; loadHistory(currentDog); } catch (err) { showToast('❌ Error', 'error'); }
};
window.delWalk = (i) => {
    if (!confirm('¿Eliminar paseo?')) return;
    const newWalks = [...currentDog.walks]; newWalks.splice(i, 1);
    updateRealDogWalks(currentDog.id, newWalks).then(() => { currentDog.walks = newWalks; showToast('🗑️ Eliminado', 'success'); loadHistory(currentDog); }).catch(() => showToast('❌ Error', 'error'));
};

// ==========================================
// 11. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('photo-upload-input').onchange = (e) => { if(e.target.files[0]) uploadProfilePhoto(e.target.files[0]); };
    document.getElementById('add-walk-photo-btn').onclick = () => document.getElementById('walk-photo-input').click();
    document.getElementById('walk-photo-input').onchange = (e) => { if(e.target.files) { currentWalkFiles = [...currentWalkFiles, ...Array.from(e.target.files)]; renderWalkPreview(); e.target.value=''; } };
    
    const hb = document.getElementById('hamburger-btn'); const mn = document.getElementById('main-nav');
    hb.onclick = (e) => { e.stopPropagation(); mn.classList.toggle('show'); hb.textContent = mn.classList.contains('show') ? '✕' : '☰'; };
    document.onclick = (e) => { if(mn.classList.contains('show') && !mn.contains(e.target) && !hb.contains(e.target)) { mn.classList.remove('show'); hb.textContent = '☰'; } };
    
    document.getElementById('nav-home-btn').onclick = () => { mn.classList.remove('show'); hb.textContent = '☰'; goBack(); };
    document.getElementById('nav-logout-btn').onclick = () => { currentUser=null; currentDog=null; document.body.classList.remove('user-logged-in'); if(carouselAudio) { carouselAudio.pause(); isPlaying=false; } showView('login-section'); showToast('👋 Adiós', 'info'); };
});

window.onload = async () => {
    await loadExampleDogs();
    document.getElementById('loading-overlay').style.display = 'none';
    document.body.classList.remove('user-logged-in'); showView('login-section');
    
    const savedAudio = localStorage.getItem('paseoDogAudio');
    if (savedAudio === 'off') { isAudioEnabled = false; document.getElementById('audio-toggle').textContent = '🔇'; }
    document.getElementById('audio-toggle').onclick = () => { isAudioEnabled = !isAudioEnabled; document.getElementById('audio-toggle').textContent = isAudioEnabled ? '🔊' : '🔇'; localStorage.setItem('paseoDogAudio', isAudioEnabled ? 'on' : 'off'); if(!isAudioEnabled && carouselAudio) { carouselAudio.pause(); isPlaying=false; } };
    document.addEventListener('click', () => { if (!userHasInteracted) userHasInteracted = true; }, { once: true });
};

// ==========================================
// 12. PWA & INSTALACIÓN (MODAL)
// ==========================================
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(err => console.log('Error SW:', err));

let deferredPrompt;
const installModal = document.getElementById('install-modal');
const btnYes = document.getElementById('btn-install-yes');
const btnNo = document.getElementById('btn-install-no');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (!sessionStorage.getItem('installDeclined')) setTimeout(() => { if(installModal) installModal.style.display = 'flex'; }, 2000);
});

if(btnYes) btnYes.onclick = async () => {
    if(installModal) installModal.style.display = 'none';
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
};
if(btnNo) btnNo.onclick = () => { if(installModal) installModal.style.display = 'none'; sessionStorage.setItem('installDeclined', 'true'); };
window.addEventListener('appinstalled', () => { if(installModal) installModal.style.display = 'none'; showToast('🎉 Instalada', 'success'); });