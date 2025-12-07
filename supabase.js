// supabase.js

// 🔑 CONFIGURACIÓN
const SUPABASE_URL = 'https://asejbhohkbcoixiwdhcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZWpiaG9oa2Jjb2l4aXdkaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjk0NzMsImV4cCI6MjA4MDYwNTQ3M30.kbRKO5PEljZ29_kn6GYKoyGfB_t8xalxtMiq1ovPo4w';

console.log('🌐 [SUPABASE] Inicializando cliente...');
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ [SUPABASE] Cliente creado con éxito');

// === FUNCIONES ===

/**
 * 🐶 Cargar perros desde Supabase
 * Incluye la inicialización de los nuevos campos de perfil.
 */
export async function loadDogs(email = null, isAdmin = false) {
    console.log('📥 [LOAD DOGS] Iniciando carga de perros...');
    console.log('   👤 Usuario:', email || 'todos');
    console.log('   👨‍💼 Es admin:', isAdmin);

    let query = supabase.from('dogs').select('*');
    if (!isAdmin && email) {
        console.log('   🔍 Filtrando por email:', email);
        query = query.eq('dueno_email', email);
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ [LOAD DOGS] ERROR al cargar perros:', error.message);
        throw new Error('Error al cargar perros: ' + error.message);
    }

    console.log('✅ [LOAD DOGS] Perros cargados:', data.length);
    console.table(data);
    // Mapeo para asegurar que los nuevos campos existen, aunque sea como null
    return data.map(dog => ({
        ...dog,
        edad: dog.edad || null,
        peso: dog.peso || null,
        alergias: dog.alergias || '',
        energia: dog.energia || 'Bajo',
        social: dog.social || 'Buena'
    }));
}

/**
 * 🚶 Cargar paseos de un perro
 */
export async function loadWalks(dogId) {
    console.log('📥 [LOAD WALKS] Cargando paseos para perro ID:', dogId);

    const { data, error } = await supabase
        .from('walks')
        .select('*')
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ [LOAD WALKS] ERROR al cargar paseos:', error.message);
        throw new Error('Error al cargar paseos: ' + error.message);
    }

    console.log('✅ [LOAD WALKS] Paseos cargados:', data.length);
    if (data.length > 0) {
        console.group('📸 URLs de fotos en paseos:');
        data.forEach((w, i) => {
            console.log(`   Paseo ${i+1} (${w.fecha}):`, w.fotos_urls || []);
        });
        console.groupEnd();
    }
    return data.map(w => ({
        ...w,
        fotos: (w.fotos_urls || []).map(url => ({ id: url }))
    }));
}

/**
 * 🐕 Crear o actualizar perro (upsert)
 * Incluye los nuevos campos de perfil (edad, peso, etc.)
 */
export async function createDog(dogData) {
    console.log('💾 [CREATE DOG] Guardando perro en Supabase...');
    console.log('   Nombre:', dogData.nombre);
    console.log('   Email:', dogData.dueno_email);

    const { data, error } = await supabase
        .from('dogs')
        .upsert([{
            nombre: dogData.nombre,
            raza: dogData.perfil.raza,
            sexo: dogData.perfil.sexo,
            dueno: dogData.perfil.dueno,
            telefono: dogData.perfil.telefono,
            dueno_email: dogData.dueno_email,
            foto_url: dogData.perfil.foto_url || '',
            // 💡 NUEVOS CAMPOS AGREGADOS
            edad: dogData.perfil.edad,
            peso: dogData.perfil.peso,
            alergias: dogData.perfil.alergias,
            energia: dogData.perfil.energia,
            social: dogData.perfil.social
        }], {
            onConflict: 'dueno_email'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ [CREATE DOG] ERROR al guardar perro:', error.message);
        throw new Error('Error al crear/actualizar perro: ' + error.message);
    }

    console.log('✅ [CREATE DOG] Perro guardado con ID:', data.id);
    return data;
}

/**
 * 💾 Actualizar perfil del perro (incluye los nuevos campos)
 */
export async function updateDogProfile(dogData) {
    console.log('💾 [UPDATE PROFILE] Actualizando perfil de perro ID:', dogData.id);

    const { error } = await supabase
        .from('dogs')
        .update({
            nombre: dogData.nombre,
            raza: dogData.raza,
            sexo: dogData.sexo,
            dueno: dogData.dueno,
            telefono: dogData.telefono,
            // 💡 NUEVOS CAMPOS AGREGADOS
            edad: dogData.edad,
            peso: dogData.peso,
            alergias: dogData.alergias,
            energia: dogData.energia,
            social: dogData.social,
            // foto_url no se actualiza aquí
        })
        .eq('id', dogData.id);

    if (error) {
        console.error('❌ [UPDATE PROFILE] ERROR al actualizar perfil:', error.message);
        throw new Error('Error al actualizar perfil: ' + error.message);
    }
    console.log('✅ [UPDATE PROFILE] Perfil actualizado con éxito.');
}

/**
 * 📸 Crear paseo
 */
export async function createWalk(walkData, dogId) {
    console.log('💾 [CREATE WALK] Guardando paseo para perro ID:', dogId);
    console.log('   Fecha:', walkData.fecha);
    console.log('   Fotos a guardar:', walkData.fotos_urls?.length || 0);

    const { data, error } = await supabase
        .from('walks')
        .insert([{
            dog_id: dogId,
            fecha: walkData.fecha,
            duracion_minutos: walkData.duracion_minutos,
            distancia_km: walkData.distancia_km,
            resumen_diario: walkData.resumen_diario,
            comportamiento_problemas: walkData.comportamiento_problemas,
            incidentes_salud: walkData.incidentes_salud,
            fotos_urls: walkData.fotos_urls || []
        }])
        .select()
        .single();

    if (error) {
        console.error('❌ [CREATE WALK] ERROR al guardar paseo:', error.message);
        throw new Error('Error al crear paseo: ' + error.message);
    }

    console.log('✅ [CREATE WALK] Paseo guardado con ID:', data.id);
    return data;
}

/**
 * 💾 Actualizar paseo (Requerido para la edición de paseos en el HTML)
 */
export async function updateWalk(walkData) {
    console.log('💾 [UPDATE WALK] Actualizando paseo ID:', walkData.id);
    const { error } = await supabase
        .from('walks')
        .update({
            duracion_minutos: walkData.duracion_minutos,
            distancia_km: walkData.distancia_km,
            resumen_diario: walkData.resumen_diario,
            comportamiento_problemas: walkData.comportamiento_problemas,
            incidentes_salud: walkData.incidentes_salud,
            fotos_urls: walkData.fotos_urls
        })
        .eq('id', walkData.id);

    if (error) {
        console.error('❌ [UPDATE WALK] ERROR al actualizar paseo:', error.message);
        throw new Error('Error al actualizar paseo: ' + error.message);
    }
    console.log('✅ [UPDATE WALK] Paseo actualizado con éxito.');
}

/**
 * 🗑️ Eliminar paseo (Requerido por el botón de eliminación en el HTML)
 */
export async function deleteWalk(walkId) {
    console.log('🗑️ [DELETE WALK] Eliminando paseo ID:', walkId);
    const { error } = await supabase
        .from('walks')
        .delete()
        .eq('id', walkId);

    if (error) {
        console.error('❌ [DELETE WALK] ERROR al eliminar paseo:', error.message);
        throw new Error('Error al eliminar paseo: ' + error.message);
    }
    console.log('✅ [DELETE WALK] Paseo eliminado con éxito.');
}

/**
 * 📤 Subir foto de paseo al bucket 'photos'
 */
export async function uploadWalkPhoto(file, dogId) {
    const timestamp = Date.now();
    const fileName = `${dogId}/${timestamp}-${file.name}`;
    console.log('📤 [UPLOAD PHOTO] Subiendo archivo de paseo a Storage...');

    const { error: uploadError } = await supabase
        .storage
        .from('photos')
        .upload(fileName, file, {
            contentType: file.type,
            upsert: false
        });

    if (uploadError) {
        console.error('❌ [UPLOAD PHOTO] ERROR al subir archivo:', uploadError.message);
        throw new Error('Error al subir foto: ' + uploadError.message);
    }

    const { data, error: urlError } = await supabase
        .storage
        .from('photos')
        .getPublicUrl(fileName);

    if (urlError) {
        console.error('❌ [UPLOAD PHOTO] ERROR al obtener URL pública:', urlError.message);
        throw new Error('Error al obtener URL pública: ' + urlError.message);
    }

    const publicUrl = data.publicUrl;
    console.log('🔗 [UPLOAD PHOTO] URL pública generada:', publicUrl);
    return publicUrl;
}

/**
 * 📤 Subir foto de perfil al bucket 'photos'
 */
export async function uploadProfilePhoto(dogId, file) {
    // Usamos dogId como primer argumento para que coincida con la firma en el HTML
    const fileName = `profile/${dogId}/avatar-${Date.now()}-${file.name}`;
    console.log('📤 [PERFIL] Subiendo foto de perfil:', fileName);
    
    const { error: uploadError } = await supabase
        .storage
        .from('photos')
        .upload(fileName, file, { contentType: file.type, upsert: true });

    if (uploadError) {
        console.error('❌ [PERFIL] Error al subir:', uploadError.message);
        throw new Error('Error al subir foto de perfil: ' + uploadError.message);
    }

    const { data, error: urlError } = await supabase
        .storage
        .from('photos')
        .getPublicUrl(fileName);

    if (urlError) {
        console.error('❌ [PERFIL] Error URL pública:', urlError.message);
        throw new Error('Error al obtener URL de perfil: ' + urlError.message);
    }

    const publicUrl = data.publicUrl;
    console.log('✅ [PERFIL] Foto de perfil subida:', publicUrl);
    return publicUrl;
}

/**
 * 💾 Actualizar foto de perfil en la tabla 'dogs'
 */
export async function updateDogProfilePhoto(dogId, fotoUrl) {
    console.log('💾 [PERFIL] Actualizando foto de perro ID:', dogId);
    const { error } = await supabase
        .from('dogs')
        .update({ foto_url: fotoUrl })
        .eq('id', dogId);

    if (error) {
        console.error('❌ [PERFIL] Error al actualizar:', error.message);
        throw new Error('Error al guardar foto de perfil: ' + error.message);
    }
    console.log('✅ [PERFIL] Foto de perfil guardada en DB');
}

export { supabase };