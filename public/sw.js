/* global self, clients */

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  if (!payload || typeof payload !== "object") payload = {};

  const title = typeof payload.title === "string" && payload.title
    ? payload.title
    : "Відмітка";
  const body = typeof payload.body === "string" ? payload.body : "";
  const tag = typeof payload.tag === "string" ? payload.tag : undefined;
  const requestedUrl = typeof payload.url === "string" ? payload.url : "/";
  let safeUrl = "/";
  try {
    const url = new URL(requestedUrl, self.location.origin);
    if (url.origin === self.location.origin) safeUrl = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    safeUrl = "/";
  }

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: { url: safeUrl },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data && typeof event.notification.data.url === "string"
    ? event.notification.data.url
    : "/";
  const targetUrl = new URL(requestedUrl, self.location.origin).href;

  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === targetUrl);
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  }));
});
