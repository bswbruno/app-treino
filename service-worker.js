// Service worker mínimo, apenas para o app cumprir os requisitos técnicos
// de "instalável" no Android/Chrome (exibindo o ícone próprio, e não um
// print da tela como ícone padrão). Não faz cache agressivo de propósito,
// para sempre carregar a versão mais recente do app.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
