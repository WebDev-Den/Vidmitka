"use client";

const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

function waitForServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("SERVICE_WORKER_READY_TIMEOUT")), SERVICE_WORKER_READY_TIMEOUT_MS);
    navigator.serviceWorker.ready.then(
      (readyRegistration) => {
        window.clearTimeout(timeout);
        resolve(readyRegistration);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/**
 * Registers the single public-scope worker used by installation and Web Push.
 * Callers deliberately own all permission prompts; registration itself never
 * requests notification permission.
 */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("SERVICE_WORKER_UNSUPPORTED");
  }

  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  return waitForServiceWorkerReady();
}
