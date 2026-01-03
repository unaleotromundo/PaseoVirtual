const CACHE_NAME = 'paseovirtual-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './paseovirtualapp.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Retorna la respuesta del caché si existe, si no intenta fetch a internet
      return response || fetch(e.request).catch((err) => {
        // Captura el error de red para evitar el error "Uncaught in promise"
        console.warn('Network request failed, ignoring error:', err);
        
        // Opcional: Si es una imagen la que falló, podrías retornar un icono por defecto
        if (e.request.destination === 'image') {
          return caches.match('./paseovirtualapp.png');
        }
        
        // Para otros fallos críticos sin internet simplemente no devuelve nada (undefined)
      });
    })
  );
});