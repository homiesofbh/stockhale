/** Keep development chunks out of the offline cache without touching workspace records. */
export async function configureServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV === "production") {
    await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => {
        const worker =
          registration.active ||
          registration.waiting ||
          registration.installing;
        return worker && new URL(worker.scriptURL).pathname === "/sw.js";
      })
      .map((registration) => registration.unregister()),
  );

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("stockwell-offline-"))
        .map((key) => caches.delete(key)),
    );
  }
}
