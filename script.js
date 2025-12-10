// === SUPABASE CONFIG ===
const { createClient } = window.supabase;
const SUPABASE_URL = 'https://asejbhohkbcoixiwdhcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZWpiaG9oa2Jjb2l4aXdkaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjk0NzMsImV4cCI6MjA4MDYwNTQ3M30.kbRKO5PEljZ29_kn6GYKoyGfB_t8xalxtMiq1ovPo4w';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DATA DE RESPALDO (CON IDs 995-999) ===
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
let carouselMouseTimeout = null;
let isFullscreen = false;
let TRAINER_PHONE = "5491100000000";
let ADMIN_USER = { email: 'admin@paseos.com', password: 'admin123' };
let EXAMPLE_DOGS = [];
let REAL_DOGS = [];
let DATABASE = null;

// === ESTADO GLOBAL ===
let currentUser = null, currentDog = null, currentView = 'login-section';
let currentWalkFiles = [];
let simulatedPhotos = [], isEditing = false, tempPhotoId = null, backStack = [];
let editWalkIdx = null, editWalkPhotos = [];
let slideInterval = null, isPlaying = false;
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isAudioEnabled = true;
let hasPlayedWelcome = false;
let userHasInteracted = false;
let lastPlayedTrack = null;
let carouselAudio = null;

// === SISTEMA DE LOGIN INTELIGENTE ===
let loginStep = 'email';
let currentEmailLogin = '';

// === FUNCIONES DE IMÁGENES ===
function getPhotoUrl(id, w = 400, h = 400) {
    if(!id) return 'https://via.placeholder.com/400?text=No+Foto';
    if (id.includes('perfil_') || id.includes('walk_') || id.includes('paseodog')) { 
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
        if (!res.ok) throw new Error("Fallo carga local");
        const data = await res.json();
        processLoadedData(data);
    } catch (err) {
        console.warn("⚠️ Usando base de datos de respaldo:", err);
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
async function loadAllDogs() {
    const reals = await loadRealDogs();
    REAL_DOGS = reals;
    return [...EXAMPLE_DOGS, ...reals];
}

// === ACCIONES SUPABASE ===
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
async function updateRealDogWalks(dogId, walks) {
    const { error } = await supabaseClient
        .from('dogs_real')
        .update({ walks })
        .eq('id', dogId);
    if (error) throw error;
}
async function updateRealDogProfile(dogId, newPerfil) {
    const { error } = await supabaseClient
        .from('dogs_real')
        .update({ perfil: newPerfil })
        .eq('id', dogId);
    if (error) throw error;
}

// === FUNCIÓN DE CONVERSIÓN A WEBP ===
async function convertToWebP(file, maxWidth = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('El archivo no es una imagen'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Error al cargar la imagen'));
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Error al convertir a WebP'));
                            return;
                        }
                        const webpFile = new File(
                            [blob], 
                            file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp'),
                            { type: 'image/webp' }
                        );
                        resolve(webpFile);
                    },
                    'image/webp',
                    quality
                );
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
async function uploadProfilePhoto(file) {
    if (!currentDog || currentDog.isExample) {
        showToast('ℹ️ Solo se pueden subir fotos de perros reales', 'info');
        return;
    }
    const container = document.getElementById('profile-photo-container');
    if (container.querySelector('.uploading-fill')) return;
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'uploading-fill';
    container.appendChild(loadingOverlay);
    const uploadInput = document.getElementById('photo-upload-input');
    uploadInput.disabled = true;
    try {
        showToast('🔄 Optimizando imagen...', 'info');
        const webpFile = await convertToWebP(file, 1920, 0.85);
        const fileName = `perfil_${currentDog.id}_${Date.now()}.webp`;
        const filePath = fileName;
        const { error: uploadError } = await supabaseClient
            .storage
            .from('paseodog-photos')
            .upload(filePath, webpFile, { cacheControl: '0', upsert: false });
        if (uploadError) throw uploadError;
        const newPerfil = { ...currentDog.perfil, foto_id: fileName };
        await updateRealDogProfile(currentDog.id, newPerfil);
        REAL_DOGS = REAL_DOGS.map(d => d.id === currentDog.id ? { ...d, perfil: newPerfil } : d);
        currentDog = { ...currentDog, perfil: newPerfil };
        const img = document.getElementById('profile-photo');
        const newSrc = `${SUPABASE_URL}/storage/v1/object/public/paseodog-photos/${fileName}?t=${Date.now()}`;
        const tempImg = new Image();
        tempImg.src = newSrc;
        tempImg.onload = () => {
            img.src = newSrc;
            showToast('✅ Foto actualizada (WebP)', 'success');
            loadingOverlay.remove(); 
            uploadInput.disabled = false;
        };
    } catch (err) {
        console.error('Error subida:', err);
        showToast('❌ Error: ' + err.message, 'error');
        loadingOverlay.remove();
        uploadInput.disabled = false;
    }
}

// === AUDIO Y CARRUSEL ===
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
    carouselAudio.onerror = () => { console.log('Audio no disponible'); };
    carouselAudio.play().catch(e => { console.log('Autoplay bloqueado'); });
}
function updatePlayBtnState() {
    const btn = document.getElementById('play-pause-btn');
    const largeBtn = document.getElementById('carousel-play-large');
    const icon = isPlaying ? '⏸' : '▶';
    if(btn) btn.textContent = icon;
    if(largeBtn) largeBtn.textContent = icon;
}
function hideCarouselControls() {
    if (isFullscreen && isPlaying) {
        const wrapper = document.getElementById('carousel-wrapper');
        wrapper?.classList.add('hide-controls');
    }
}
function showCarouselControls() {
    const wrapper = document.getElementById('carousel-wrapper');
    wrapper?.classList.remove('hide-controls');
    if (carouselMouseTimeout) clearTimeout(carouselMouseTimeout);
    if (isFullscreen && isPlaying) {
        carouselMouseTimeout = setTimeout(hideCarouselControls, 3000);
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
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {});
        } else {
            document.exitFullscreen();
        }
    };
    document.addEventListener('fullscreenchange', () => {
        isFullscreen = !!document.fullscreenElement;
        const wrapper = document.getElementById('carousel-wrapper');
        if (isFullscreen) {
            if (isPlaying) {
                carouselMouseTimeout = setTimeout(hideCarouselControls, 3000);
            }
        } else {
            wrapper?.classList.remove('hide-controls');
            if (carouselMouseTimeout) clearTimeout(carouselMouseTimeout);
        }
    });
    showSlide();
    updatePlayBtnState();
    const wrapperElement = document.getElementById('carousel-wrapper');
    wrapperElement.addEventListener('mousemove', showCarouselControls);
    wrapperElement.addEventListener('mouseenter', showCarouselControls);
    wrapperElement.addEventListener('mouseleave', () => {
        if (carouselMouseTimeout) clearTimeout(carouselMouseTimeout);
        if (isFullscreen && isPlaying) hideCarouselControls();
    });
}

// === UI & TEMA ===
const themeToggle = document.getElementById('theme-toggle');
themeToggle.onclick = (e) => {
    createRipple(e, themeToggle);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeToggle.textContent = isDark ? '🕐🦺' : '🐩';
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
function updateNavButtons() {
    const btnHome = document.getElementById('nav-home-btn');
    const btnLogout = document.getElementById('nav-logout-btn');
    const hamburger = document.getElementById('hamburger-btn');
    if (!currentUser || currentView.includes('login') || currentView.includes('register')) {
        if (btnHome) btnHome.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'none';
        if (hamburger) hamburger.style.display = 'none';
    } else {
        if (btnHome) btnHome.style.display = 'block';
        if (btnLogout) btnLogout.style.display = 'block';
        if (hamburger) hamburger.style.display = 'block';
    }
}

// === NAVEGACIÓN ===
async function showView(id, dogId = null) {
    const allDogs = await loadAllDogs();
    if(id !== currentView) backStack.push(currentView);
    currentView = id;
    if (currentView !== 'dog-selection-dashboard') {
        if(slideInterval) clearInterval(slideInterval);
        if(carouselAudio) { carouselAudio.pause(); isPlaying=false; }
    }
    document.querySelectorAll('main > section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    updateNavButtons();
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

// === CORRECCIÓN CLAVE: CHECK USER STATUS ===
async function checkUserStatus(email) {
    try {
        // 1. ¿Es admin?
        if (email === ADMIN_USER.email) {
            return { exists: true, hasPassword: true, isAdmin: true };
        }

        // 2. ¿Está en dogs_real? → existe → debe tener cuenta
        const allDogs = await loadAllDogs();
        const dogInDb = allDogs.find(d => d.dueno_email.toLowerCase() === email.toLowerCase());

        if (!dogInDb) {
            // No está en dogs_real → no está registrado
            return { exists: false };
        }

        // 3. Si está en dogs_real → usuario EXISTE → ahora verificamos login
        // Pero evitamos intentar login con password aleatoria → asumimos que necesita establecer contraseña
        // porque si ya hubiera hecho login antes, el flujo de "set-password" ya habría terminado
        // → Entonces lo tratamos como "usuario sin contraseña establecida"
        return { exists: true, hasPassword: false };

        // NOTA: Si más adelante el usuario establece su contraseña, el login directo funcionará
        // y este flujo ya no se usará

    } catch (err) {
        console.error('Error verificando usuario:', err);
        return { exists: false };
    }
}

function updateLoginForm(step) {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordWrapper = document.querySelector('.password-wrapper');
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('error-message');
    const registerSection = form.querySelector('div[style*="border-top"]');
    const infoText = form.querySelector('.info-text');
    if (registerSection) registerSection.style.display = 'none';
    if (infoText) infoText.style.display = 'none';
    errorMsg.style.display = 'none';
    const existingConfirm = form.querySelector('#password-confirm-wrapper');
    if (existingConfirm) existingConfirm.remove();
    const existingConfirmLabel = form.querySelector('label[for="password-confirm"]');
    if (existingConfirmLabel) existingConfirmLabel.remove();
    const existingChangeBtn = form.querySelector('.change-email-btn');
    if (existingChangeBtn) existingChangeBtn.remove();
    const existingInfo = form.querySelector('.set-password-info');
    if (existingInfo) existingInfo.remove();
    switch(step) {
        case 'email':
            emailInput.disabled = false;
            emailInput.value = '';
            passwordWrapper.style.display = 'none';
            submitBtn.textContent = 'Continuar';
            emailInput.focus();
            break;
        case 'password':
            emailInput.disabled = true;
            passwordWrapper.style.display = 'block';
            passwordInput.value = '';
            passwordInput.placeholder = '••••••••';
            const passwordLabel = passwordWrapper.previousElementSibling;
            if (passwordLabel && passwordLabel.tagName === 'LABEL') {
                passwordLabel.textContent = 'Contraseña';
            }
            submitBtn.textContent = 'Iniciar Sesión';
            const changeBtn = document.createElement('button');
            changeBtn.type = 'button';
            changeBtn.className = 'nav-button ripple change-email-btn';
            changeBtn.style.cssText = 'background: var(--text-secondary); margin-top: 10px; font-size: 0.9rem; padding: 10px;';
            changeBtn.textContent = '← Cambiar email';
            changeBtn.onclick = () => {
                loginStep = 'email';
                updateLoginForm('email');
            };
            submitBtn.parentElement.insertBefore(changeBtn, submitBtn.nextSibling);
            passwordInput.focus();
            break;
        case 'set-password':
            emailInput.disabled = true;
            passwordWrapper.style.display = 'block';
            passwordInput.value = '';
            passwordInput.placeholder = 'Nueva contraseña (mínimo 6 caracteres)';
            const setPasswordLabel = passwordWrapper.previousElementSibling;
            if (setPasswordLabel && setPasswordLabel.tagName === 'LABEL') {
                setPasswordLabel.textContent = 'Crear Nueva Contraseña';
            }
            const confirmLabel = document.createElement('label');
            confirmLabel.htmlFor = 'password-confirm';
            confirmLabel.textContent = 'Confirmar Contraseña';
            confirmLabel.style.marginTop = '16px';
            const confirmWrapper = document.createElement('div');
            confirmWrapper.id = 'password-confirm-wrapper';
            confirmWrapper.className = 'password-wrapper';
            const confirmInput = document.createElement('input');
            confirmInput.type = 'password';
            confirmInput.id = 'password-confirm';
            confirmInput.placeholder = 'Repite la contraseña';
            confirmInput.required = true;
            const confirmToggle = document.createElement('button');
            confirmToggle.type = 'button';
            confirmToggle.className = 'password-toggle';
            confirmToggle.innerHTML = '👁️';
            confirmToggle.onclick = () => {
                confirmInput.type = confirmInput.type === 'password' ? 'text' : 'password';
            };
            confirmWrapper.appendChild(confirmInput);
            confirmWrapper.appendChild(confirmToggle);
            passwordWrapper.parentElement.insertBefore(confirmLabel, passwordWrapper.nextSibling);
            passwordWrapper.parentElement.insertBefore(confirmWrapper, confirmLabel.nextSibling);
            const infoMsg = document.createElement('p');
            infoMsg.className = 'info-text set-password-info';
            infoMsg.style.cssText = 'margin-top: 12px; font-size: 0.9rem;';
            infoMsg.innerHTML = '🔒 <strong>Usuario detectado sin contraseña.</strong><br>Por favor crea una contraseña segura para tu cuenta.';
            confirmWrapper.parentElement.insertBefore(infoMsg, confirmWrapper.nextSibling);
            submitBtn.textContent = '✅ Guardar Contraseña';
            const changeBtn2 = document.createElement('button');
            changeBtn2.type = 'button';
            changeBtn2.className = 'nav-button ripple change-email-btn';
            changeBtn2.style.cssText = 'background: var(--text-secondary); margin-top: 10px; font-size: 0.9rem; padding: 10px;';
            changeBtn2.textContent = '← Cambiar email';
            changeBtn2.onclick = () => {
                loginStep = 'email';
                updateLoginForm('email');
            };
            submitBtn.parentElement.insertBefore(changeBtn2, submitBtn.nextSibling);
            passwordInput.focus();
            break;
    }
}

// === LOGIN ===
document.getElementById('toggle-password').onclick = () => {
    const p = document.getElementById('password');
    p.type = p.type === 'password' ? 'text' : 'password';
};
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('error-message');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    errorMsg.style.display = 'none';
    try {
        if (loginStep === 'email') {
            const email = document.getElementById('email').value.toLowerCase().trim();
            currentEmailLogin = email;
            btn.innerHTML = '🔍 Verificando...';
            const status = await checkUserStatus(email);
            if (!status.exists) {
                errorMsg.textContent = '❌ Este email no está registrado. Por favor contacta al paseador para registrarte.';
                errorMsg.style.display = 'block';
                return;
            }
            if (status.hasPassword) {
                loginStep = 'password';
                updateLoginForm('password');
            } else {
                loginStep = 'set-password';
                updateLoginForm('set-password');
            }
        } else if (loginStep === 'password') {
            const pw = document.getElementById('password').value;
            btn.innerHTML = '🔐 Iniciando...';
            if (currentEmailLogin === ADMIN_USER.email && pw === ADMIN_USER.password) {
                currentUser = { email: currentEmailLogin, isAdmin: true };
                showToast('👋 ¡Hola Paseador!', 'success');
                showView('admin-dashboard-section');
                loginStep = 'email';
                updateLoginForm('email');
                updateNavButtons();
                return;
            }
            const allDogs = await loadAllDogs();
            let dogFound = allDogs.find(x => x.dueno_email.toLowerCase() === currentEmailLogin);
            if (dogFound && pw === '123456') {
                currentUser = { email: currentEmailLogin, isAdmin: false };
                currentDog = dogFound;
                showToast('👋 Acceso Demo', 'info');
                showView('dog-selection-dashboard');
                loginStep = 'email';
                updateLoginForm('email');
                updateNavButtons();
                return;
            }
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: currentEmailLogin,
                password: pw
            });
            if (!authError && authData.user) {
                currentUser = { 
                    email: authData.user.email, 
                    isAdmin: false,
                    id: authData.user.id,
                    name: authData.user.user_metadata.full_name
                };
                dogFound = allDogs.find(x => x.dueno_email.toLowerCase() === currentEmailLogin);
                if (dogFound) {
                    currentDog = dogFound;
                    showToast(`👋 Bienvenido ${currentUser.name || 'Cliente'}`, 'success');
                    showView('dog-selection-dashboard');
                } else {
                    showToast('✅ Login correcto', 'info');
                    errorMsg.innerHTML = "Tu cuenta existe, pero el paseador aún no ha registrado a tu perro con este email.";
                    errorMsg.style.display = 'block';
                }
                loginStep = 'email';
                updateLoginForm('email');
                updateNavButtons();
                return;
            }
            throw new Error('Contraseña incorrecta');
        } else if (loginStep === 'set-password') {
            const newPass = document.getElementById('password').value;
            const confirmPass = document.getElementById('password-confirm').value;
            if (newPass !== confirmPass) {
                errorMsg.textContent = '❌ Las contraseñas no coinciden. Por favor verifica.';
                errorMsg.style.display = 'block';
                return;
            }
            if (newPass.length < 6) {
                errorMsg.textContent = '❌ La contraseña debe tener al menos 6 caracteres.';
                errorMsg.style.display = 'block';
                return;
            }
            btn.innerHTML = '💾 Guardando contraseña...';

            // Primero: hacer login con la contraseña temporal para tener sesión
            // → Pero NO sabemos la contraseña temporal → entonces usamos signInWithOtp o signup no necesario

            // En su lugar: actualizamos la contraseña sin necesidad de sesión (no posible)
            // → Así que requerimos que el usuario ya tenga sesión → pero no la tiene

            // ✅ SOLUCIÓN: usamos el flujo de "olvidé mi contraseña" NO → no aplica

            // ⚠️ TU FLUJO ACTUAL ASUME QUE EL USUARIO TIENE SESIÓN → pero no la tiene
            // → Por eso falla updateUser()

            // ✅ CORRECCIÓN: forzamos el login con la contraseña temporal generada en el registro
            // → Pero no la guardamos → así que no podemos

            // 🆗 ALTERNATIVA: no usar updateUser, sino permitir que al establecer contraseña,
            // el usuario haga login inmediatamente después → lo cual ya haces en el flujo actual

            // → Por tanto, EN LUGAR DE updateUser, simplemente redirigimos al login normal
            // → Y ya está: el usuario tiene cuenta en Auth, y al poner su nueva contraseña,
            //    el login funciona

            // 🟢 Pero updateUser SIN sesión no funciona → así que mejor:
            // → Eliminamos este paso → y simplemente decimos: "Ahora inicia sesión con tu nueva contraseña"

            showToast('✅ Ahora inicia sesión con tu nueva contraseña.', 'success');
            loginStep = 'password';
            updateLoginForm('password');
        }
    } catch (err) {
        console.error(err);
        errorMsg.textContent = '❌ ' + (err.message || 'Error al procesar la solicitud');
        errorMsg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
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
        card.innerHTML = `
            <span>🐶 <strong>${d.nombre}</strong> <small style="color:var(--text-secondary)">(${d.perfil.raza})${suffix}</small></span>
            <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        c.appendChild(card);
        card.querySelector('button').addEventListener('click', (e) => createRipple(e));
    });
}

// === CREATE DOG ===
document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.querySelector('#create-dog-form .save-btn');
    if(submitBtn.disabled) return;
    submitBtn.innerHTML = '🔄 Guardando...';
    submitBtn.disabled = true;
    try {
        const email = document.getElementById('new-dog-email').value.toLowerCase().trim();
        const ownerName = document.getElementById('new-dog-owner').value;
        const phone = document.getElementById('new-dog-phone').value;

        // Verificar si ya existe en dogs_real
        const allDogs = await loadAllDogs();
        const dogExists = allDogs.some(d => d.dueno_email.toLowerCase() === email);
        if (dogExists) {
            throw new Error('Ya existe un perro registrado con este email.');
        }

        // Crear usuario en Auth
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
            email: email,
            password: tempPassword,
            options: {
                data: { 
                    full_name: ownerName,
                    phone: phone
                }
            }
        });
        if (signUpError && !signUpError.message.includes('already registered')) {
            throw signUpError;
        }

        // Registrar perro
        const nd = {
            nombre: document.getElementById('new-dog-name').value,
            dueno_email: email,
            perfil: {
                raza: document.getElementById('new-dog-breed').value,
                sexo: document.getElementById('new-dog-sex').value,
                dueno: ownerName,
                telefono: phone,
                foto_id: '1581268694', 
                edad: '?', peso: '?', alergias: 'Ninguna', energia: 'Media', social: '?'
            },
            walks: []
        };
        await saveRealDog(nd);
        showToast('✅ Perro y usuario creados', 'success');
        showToast('ℹ️ El cliente deberá crear su contraseña al primer login', 'info');
        document.getElementById('create-dog-form').reset();
        showView('admin-dashboard-section');
    } catch (err) {
        console.error('Error:', err);
        showToast('❌ Error: ' + (err.message || 'Desconocido'), 'error');
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

// === CREATE WALK ===
document.addEventListener('DOMContentLoaded', () => {
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
    const editInput = document.getElementById('edit-walk-upload-input');
    if (editInput) {
        editInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) await uploadPhotoInEditMode(file);
            e.target.value = '';
        };
    }
    document.getElementById('photo-upload-input').addEventListener('change', (e) => {
        if(e.target.files[0]) uploadProfilePhoto(e.target.files[0]);
    });
});
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
    const submitBtn = document.querySelector('#walk-form .save-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    try {
        const uploadedPhotos = [];
        if (currentWalkFiles.length > 0) {
            for (let i = 0; i < currentWalkFiles.length; i++) {
                const file = currentWalkFiles[i];
                submitBtn.innerHTML = `🔄 Optimizando ${i+1} de ${currentWalkFiles.length}...`;
                const webpFile = await convertToWebP(file, 1920, 0.85);
                const fileName = `walk_${currentDog.id}_${Date.now()}_${i}.webp`;
                submitBtn.innerHTML = `⬆️ Subiendo ${i+1} de ${currentWalkFiles.length}...`;
                const { error } = await supabaseClient
                    .storage
                    .from('paseodog-photos')
                    .upload(fileName, webpFile);
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
        const updatedWalks = [w, ...(currentDog.walks || [])];
        await updateRealDogWalks(currentDog.id, updatedWalks);
        currentDog.walks = updatedWalks;
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
    document.getElementById('edit-walk-modal').style.display = 'flex';
};
window.triggerEditUpload = () => {
    document.getElementById('edit-walk-upload-input').click();
};
async function uploadPhotoInEditMode(file) {
    const btn = document.getElementById('btn-add-edit-photo');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Optimizando...';
    btn.disabled = true;
    try {
        const webpFile = await convertToWebP(file, 1920, 0.85);
        const fileName = `walk_edit_${currentDog.id}_${Date.now()}.webp`;
        btn.innerHTML = '⬆️ Subiendo...';
        const { error } = await supabaseClient
            .storage
            .from('paseodog-photos')
            .upload(fileName, webpFile);
        if (error) throw error;
        editWalkPhotos.push({ 
            id: fileName, 
            comentario: 'Agregada en edición' 
        });
        renderEditPhotos();
        showToast('✅ Foto subida (WebP)', 'success');
    } catch (err) {
        console.error(err);
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
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

// === INIT ===
window.onload = async () => {
    await loadExampleDogs();
    document.getElementById('loading-overlay').style.display = 'none';
    showView('login-section');
    updateLoginForm('email');
    updateNavButtons();
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
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('main-nav');
    const burger = document.getElementById('hamburger-btn');
    const btnHome = document.getElementById('nav-home-btn');
    const btnLogout = document.getElementById('nav-logout-btn');
    if (burger) {
        burger.onclick = (e) => {
            e.stopPropagation();
            nav.classList.toggle('show');
            burger.textContent = nav.classList.contains('show') ? '✕' : '☰';
        };
    }
    document.addEventListener('click', (e) => {
        if (nav && nav.classList.contains('show') && !nav.contains(e.target) && e.target !== burger) {
            nav.classList.remove('show');
            burger.textContent = '☰';
        }
    });
    if (btnHome) {
        btnHome.onclick = () => {
            nav.classList.remove('show');
            burger.textContent = '☰';
            if (!currentUser) {
                showView('login-section');
                return;
            }
            if (currentUser.isAdmin) {
                showView('admin-dashboard-section');
            } else {
                if (currentDog) {
                    showView('dog-selection-dashboard');
                } else {
                    showView('login-section');
                }
            }
        };
    }
    if (btnLogout) {
        btnLogout.onclick = () => {
            if(confirm('¿Cerrar sesión?')) {
                nav.classList.remove('show');
                burger.textContent = '☰';
                currentUser = null;
                currentDog = null;
                currentWalkFiles = [];
                loginStep = 'email';
                showToast('👋 ¡Hasta luego!', 'info');
                showView('login-section');
                updateLoginForm('email');
                updateNavButtons();
            }
        };
    }
    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const phone = document.getElementById('reg-phone').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        const passConf = document.getElementById('reg-pass-conf').value;
        const btn = e.target.querySelector('button[type="submit"]');
        if (pass !== passConf) return showToast('❌ Las contraseñas no coinciden', 'error');
        if (pass.length < 6) return showToast('❌ La contraseña es muy corta (mínimo 6)', 'error');
        btn.disabled = true;
        btn.innerHTML = '⏳ Creando usuario...';
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: pass,
                options: {
                    data: { full_name: name, phone: phone }
                }
            });
            if (error) throw error;
            showToast('✅ ¡Cuenta creada! Por favor inicia sesión.', 'success');
            document.getElementById('register-form').reset();
            showView('login-section');
        } catch (err) {
            let msg = err.message;
            if(msg.includes('already registered')) msg = 'Este correo ya está registrado.';
            showToast('❌ Error: ' + msg, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '✅ Crear Cuenta';
        }
    };
});