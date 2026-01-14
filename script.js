// ==========================================
// FUNCIONES DE EDAD INTELIGENTE (AGREGAR AL INICIO)
// ==========================================

/**
 * Parsea entrada de edad flexible y retorna fecha de nacimiento estimada
 * Acepta: "3 años", "4 meses", "2 años 5 meses", "20/07/2025", "2025-07-20"
 */
function parseAgeInput(input) {
    if (!input) return null;
    
    const trimmed = input.trim().toLowerCase();
    
    // Intentar parsear como fecha (varios formatos)
    const datePatterns = [
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // DD/MM/YYYY o DD-MM-YYYY
        /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // YYYY/MM/DD o YYYY-MM-DD
    ];
    
    for (let pattern of datePatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            let day, month, year;
            if (pattern.source.startsWith('^(\\d{4})')) {
                // Formato YYYY-MM-DD
                [, year, month, day] = match;
            } else {
                // Formato DD/MM/YYYY
                [, day, month, year] = match;
            }
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0]; // Retorna YYYY-MM-DD
            }
        }
    }
    
    // Parsear expresiones de edad relativa
    let totalMonths = 0;
    
    // Buscar años
    const yearsMatch = trimmed.match(/(\d+)\s*(año|anos|years?|a)/i);
    if (yearsMatch) {
        totalMonths += parseInt(yearsMatch[1]) * 12;
    }
    
    // Buscar meses
    const monthsMatch = trimmed.match(/(\d+)\s*(mes|meses|months?|m)(?!i)/i);
    if (monthsMatch) {
        totalMonths += parseInt(monthsMatch[1]);
    }
    
    // Buscar semanas (convertir a meses aproximados)
    const weeksMatch = trimmed.match(/(\d+)\s*(semana|semanas|weeks?|w)/i);
    if (weeksMatch) {
        totalMonths += Math.floor(parseInt(weeksMatch[1]) / 4);
    }
    
    if (totalMonths > 0) {
        const birthDate = new Date();
        birthDate.setMonth(birthDate.getMonth() - totalMonths);
        return birthDate.toISOString().split('T')[0];
    }
    
    return null;
}

/**
 * Calcula la edad exacta desde una fecha de nacimiento
 * Retorna string formateado como "3 años 5 meses" o "8 meses"
 */
function calculateExactAge(birthDateString) {
    if (!birthDateString) return '?';
    
    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return '?';
    
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    // Ajustar si aún no ha llegado el día del mes
    if (today.getDate() < birthDate.getDate()) {
        months--;
        if (months < 0) {
            years--;
            months += 12;
        }
    }
    
    if (years === 0) {
        return months === 1 ? '1 mes' : `${months} meses`;
    } else if (months === 0) {
        return years === 1 ? '1 año' : `${years} años`;
    } else {
        const yearText = years === 1 ? '1 año' : `${years} años`;
        const monthText = months === 1 ? '1 mes' : `${months} meses`;
        return `${yearText} ${monthText}`;
    }
}

/**
 * Verifica si hoy es el cumpleaños del perro
 */
function isBirthdayToday(birthDateString) {
    if (!birthDateString) return false;
    const birthDate = new Date(birthDateString);
    const today = new Date();
    return birthDate.getDate() === today.getDate() && 
           birthDate.getMonth() === today.getMonth();
}

/**
 * Verifica si el cumpleaños es en los próximos 7 días
 */
function isBirthdaySoon(birthDateString) {
    if (!birthDateString) return false;
    const birthDate = new Date(birthDateString);
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    return thisYearBirthday >= today && thisYearBirthday <= nextWeek;
}

// ==========================================
// MODIFICAR LA FUNCIÓN loadProfile EXISTENTE
// ==========================================

function loadProfile(d) {
    const p = d.perfil;
    
    // Calcular edad en tiempo real si hay fecha de nacimiento
    let displayAge = p.edad || '?';
    if (p.fecha_nacimiento) {
        displayAge = calculateExactAge(p.fecha_nacimiento);
    }
    
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
        const fields = ['raza','sexo','peso','alergias','dueno','telefono','energia','social'];
        let html = '';
        
        // Campo especial para edad/fecha de nacimiento
        html += `
            <label>Edad o Fecha de Nacimiento 🎂</label>
            <input type="text" name="edad_input" value="${p.edad_input || displayAge}" 
                   placeholder="Ej: 3 años, 4 meses, 20/07/2025">
            <small style="color: var(--text-secondary); display: block; margin-top: -10px; margin-bottom: 16px; font-size: 0.85rem;">
                💡 Puedes escribir "3 años", "5 meses" o una fecha como "20/07/2025"
            </small>
        `;
        
        fields.forEach(k => {
            html += `<label>${k.charAt(0).toUpperCase() + k.slice(1)}</label>
            <input type="text" name="${k}" value="${p[k] || ''}">`;
        });
        html += '<button type="submit" class="save-btn ripple">💾 Guardar Cambios</button>';
        if (currentUser && currentUser.isAdmin) {
            html += `
            <div style="margin-top: 30px; border-top: 2px dashed var(--danger-light); padding-top: 20px;">
                <p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; margin-bottom:10px;">Zona de Peligro</p>
                <button type="button" id="btn-delete-dog" onclick="deleteCurrentDog()" class="ripple" style="background-color: var(--danger); color: white; width: 100%;">
                    🗑️ ELIMINAR MIMOSO
                </button>
            </div>
            `;
        }
        form.innerHTML = html;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const updatedPerfil = { ...currentDog.perfil };
            
            for (let [key, value] of formData.entries()) {
                if (key === 'edad_input') {
                    // Procesar el input de edad
                    const parsedDate = parseAgeInput(value);
                    if (parsedDate) {
                        updatedPerfil.fecha_nacimiento = parsedDate;
                        updatedPerfil.edad_input = value; // Guardar el input original
                        updatedPerfil.edad = calculateExactAge(parsedDate);
                    } else {
                        updatedPerfil.edad = value;
                        updatedPerfil.edad_input = value;
                    }
                } else {
                    updatedPerfil[key] = value;
                }
            }
            
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
        <div class="detail-row"><span class="detail-label">Edad:</span> <span class="detail-value">${displayAge}</span></div>
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

// ==========================================
// MODIFICAR LA FUNCIÓN DE CREAR PERRO
// ==========================================

// Reemplazar el submit handler del formulario create-dog-form:
document.getElementById('create-dog-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) {
        showToast('❌ Error: No hay conexión con la base de datos.', 'error');
        return;
    }
    const submitBtn = document.querySelector('#create-dog-form .save-btn');
    if(submitBtn.disabled) return;
    submitBtn.disabled = true;
    
    try {
        const ageInput = document.getElementById('new-dog-birthdate').value;
        const parsedDate = parseAgeInput(ageInput);
        
        const nd = {
            nombre: document.getElementById('new-dog-name').value,
            dueno_email: document.getElementById('new-dog-email').value.toLowerCase(),
            perfil: {
                raza: document.getElementById('new-dog-breed').value,
                sexo: document.getElementById('new-dog-sex').value,
                dueno: document.getElementById('new-dog-owner').value,
                telefono: document.getElementById('new-dog-phone').value,
                foto_id: '1581268694',
                peso: '?', 
                alergias: 'Ninguna', 
                energia: 'Media', 
                social: '?',
                edad_input: ageInput,
                fecha_nacimiento: parsedDate,
                edad: parsedDate ? calculateExactAge(parsedDate) : ageInput
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
        submitBtn.disabled = false;
    }
};

// ==========================================
// MODIFICAR loadAdminDashboard PARA MOSTRAR EDAD ACTUALIZADA
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
        const photoUrl = getPhotoUrl(d.perfil.foto_id, 60, 60);
        
        // Calcular edad en tiempo real
        let displayAge = d.perfil.edad || '?';
        if (d.perfil.fecha_nacimiento) {
            displayAge = calculateExactAge(d.perfil.fecha_nacimiento);
        }
        
        // Badge de cumpleaños
        let birthdayBadge = '';
        if (d.perfil.fecha_nacimiento) {
            if (isBirthdayToday(d.perfil.fecha_nacimiento)) {
                birthdayBadge = '<span class="birthday-badge">🎂 ¡HOY ES SU CUMPLEAÑOS!</span>';
            } else if (isBirthdaySoon(d.perfil.fecha_nacimiento)) {
                birthdayBadge = '<span class="birthday-badge" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">🎈 Cumpleaños próximo</span>';
            }
        }
        
        const card = document.createElement('div');
        card.className = 'dog-card';
        card.style.setProperty('--i', i);
        card.innerHTML = `
        <div style="display:flex; align-items:center; flex: 1;">
            <img src="${photoUrl}" class="dog-list-thumb" alt="${d.nombre}" onerror="this.src='https://via.placeholder.com/50?text=🐶'">
            <div style="flex: 1;">
                <strong style="font-size:1.1rem; display:block; line-height:1.2;">${d.nombre}</strong>
                <small style="color:var(--text-secondary)">${d.perfil.raza}${suffix}</small>
                <small style="color:var(--primary); display:block; font-weight:600;">${displayAge}</small>
                ${birthdayBadge}
            </div>
        </div>
        <button class="ripple" onclick="showView('dog-selection-dashboard', '${d.id}')">Gestionar</button>
        `;
        c.appendChild(card);
        card.querySelector('button').addEventListener('click', (e) => createRipple(e));
    });
}
