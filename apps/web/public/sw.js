self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Map of pending requests: messageId -> resolve function
const pendingRequests = new Map();

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CHUNK_RESPONSE") {
    const { id, buffer, error, status, headers } = event.data;
    const resolve = pendingRequests.get(id);
    if (resolve) {
      if (error) {
        resolve(new Response(error, { status: 500 }));
      } else {
        resolve(new Response(buffer, { status: status || 200, headers }));
      }
      pendingRequests.delete(id);
    }
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  // Intercept /stream/:inodeId
  if (url.pathname.startsWith("/stream/")) {
    const inodeId = url.pathname.replace("/stream/", "");
    const rangeHeader = event.request.headers.get("Range");

    event.respondWith(
      new Promise(async (resolve) => {
        const id = Math.random().toString(36).substring(7);
        pendingRequests.set(id, resolve);

        // Find an active window client to delegate the decryption to
        const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        let targetClient = clientsList.find(c => c.visibilityState === "visible") || clientsList[0];

        if (!targetClient) {
          resolve(new Response("No active Aether tab found to perform decryption.", { status: 503 }));
          pendingRequests.delete(id);
          return;
        }

        // Send the request to the React app
        targetClient.postMessage({
          type: "FETCH_CHUNK",
          id,
          inodeId,
          rangeHeader
        });
      })
    );
  }
});
