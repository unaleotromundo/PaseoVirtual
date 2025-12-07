// supabase.js

const SUPABASE_URL = 'https://asejbhohkbcoixiwdhcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZWpiaG9oa2Jjb2l4aXdkaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMjk0NzMsImV4cCI6MjA4MDYwNTQ3M30.kbRKO5PEljZ29_kn6GYKoyGfB_t8xalxtMiq1ovPo4w';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === FUNCIONES ===

export async function loadDogs(email = null, isAdmin = false) {
    let query = supabase.from('dogs').select('*');
    if (!isAdmin && email) query = query.eq('dueno_email', email);
    const { data, error } = await query;
    if (error) throw new Error('Error al cargar perros: ' + error.message);
    return data;
}

export async function loadWalks(dogId) {
    const { data, error } = await supabase
        .from('walks')
        .select('*')
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false });
    if (error) throw new Error('Error al cargar paseos: ' + error.message);
    return data.map(w => ({
        ...w,
        fotos: (w.fotos_urls || []).map(url => ({ id: url }))
    }));
}

export async function createDog(dogData) {
    const { data, error } = await supabase
        .from('dogs')
        .upsert([{
            nombre: dogData.nombre,
            raza: dogData.perfil.raza,
            sexo: dogData.perfil.sexo,
            dueno: dogData.perfil.dueno,
            telefono: dogData.perfil.telefono,
            dueno_email: dogData.dueno_email,
            foto_url: dogData.perfil.foto_url || ''
        }], {
            onConflict: 'dueno_email' // Campo que causa el conflicto
        })
        .select()
        .single();
    
    if (error) throw new Error('Error al crear/actualizar perro: ' + error.message);
    return data;
}

export async function createWalk(walkData, dogId) {
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
    if (error) throw new Error('Error al crear paseo: ' + error.message);
    return data;
}

// 🔺 NUEVA FUNCIÓN: Subir foto real a Storage
export async function uploadPhoto(file, dogId) {
    const timestamp = Date.now();
    const fileName = `${dogId}/${timestamp}-${file.name}`;
    const { data, error } = await supabase
        .storage
        .from('photos')
        .upload(fileName, file, {
            contentType: file.type,
            upsert: false
        });
    if (error) throw new Error('Error al subir foto: ' + error.message);

    // Obtener URL pública
    const { data: { publicUrl } } = supabase
        .storage
        .from('photos')
        .getPublicUrl(fileName);
    return publicUrl;
}

export { supabase };