(() => {
  "use strict";

  // aquí se pega todo el código, organizado por secciones
  document.getElementById("cookieSettings").addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("cookie_consent");
    document.getElementById("cookieBanner").classList.remove("cookie-hidden");
  });

  /* ==========================================================
     LAZY LOAD DE YOUTUBE, SI EXISTE
     ========================================================== */

  const MAX_ACTIVE_YT_IFRAMES = 3;

  // Cola FIFO de iframes que están actualmente cargados (src real).
  const activeQueue = [];

  function isLoaded(iframe) {
    return iframe.dataset.loaded === "1";
  }

  function setLoaded(iframe, value) {
    iframe.dataset.loaded = value ? "1" : "0";
  }

  function loadIframe(iframe) {
    if (isLoaded(iframe)) return;

    const realSrc = iframe.getAttribute("data-src");
    if (!realSrc) return;

    iframe.setAttribute("src", realSrc);
    setLoaded(iframe, true);

    // Evitar duplicados en la cola
    const idx = activeQueue.indexOf(iframe);
    if (idx >= 0) activeQueue.splice(idx, 1);

    activeQueue.push(iframe);
    enforceLimit();
  }

  function unloadIframe(iframe) {
    if (!isLoaded(iframe)) return;

    // Descargar el reproductor.
    iframe.setAttribute("src", "about:blank");

    // Clave para que reaparezca al volver: marcar como NO cargado.
    setLoaded(iframe, false);

    const idx = activeQueue.indexOf(iframe);
    if (idx >= 0) activeQueue.splice(idx, 1);
  }

  function enforceLimit() {
    // Limpieza de referencias huérfanas
    for (let i = activeQueue.length - 1; i >= 0; i--) {
      const f = activeQueue[i];
      if (!f || !document.contains(f)) activeQueue.splice(i, 1);
    }

    while (activeQueue.length > MAX_ACTIVE_YT_IFRAMES) {
      const oldest = activeQueue.shift();
      if (oldest) unloadIframe(oldest);
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const iframe = entry.target;

        if (entry.isIntersecting) {
          loadIframe(iframe);
        } else {
          // Opcional, pero recomendado si hay muchos vídeos: apagar al salir de pantalla.
          unloadIframe(iframe);
        }
      }
    },
    {
      threshold: 0.15,
      rootMargin: "200px 0px 200px 0px",
    }
  );

  document.querySelectorAll("iframe.yt-embed[data-src]").forEach((iframe) => {
    // Estado inicial
    if (!iframe.getAttribute("src")) iframe.setAttribute("src", "about:blank");
    if (iframe.dataset.loaded !== "0" && iframe.dataset.loaded !== "1")
      setLoaded(iframe, false);

    observer.observe(iframe);
  });

  // Cuando se vuelve a la pestaña, se reevalúa el límite.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) enforceLimit();
  });

  // Para el caso de que no se acepten las cookies.
  const consent = localStorage.getItem("cookie_consent");
  if (consent !== "accepted") return;

  /* ==========================================================
     SISTEMA DE PESTAÑAS
     ========================================================== */
  const container = document.getElementById("tab-content");
  const buttons = document.querySelectorAll(".tabs button");

  async function loadTab(name) {
    // Limpia contenido actual
    container.innerHTML = "";

    // Marca pestaña activa
    buttons.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === name)
    );

    try {
      const resp = await fetch(name + ".html");
      if (!resp.ok) throw new Error("No se pudo cargar " + name);
      const html = await resp.text();
      container.innerHTML = html;
      if (typeof window.applyCookieConsentToEmbeds === "function") {
        window.applyCookieConsentToEmbeds();
      }
    } catch (e) {
      container.innerHTML = "<p>Error cargando sección.</p>";
    }
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => loadTab(btn.dataset.tab));
  });

  // Cargar la primera por defecto
  loadTab(buttons[0].dataset.tab);

  /* ==========================================================
     COOKIES Y BANNER
     ========================================================== */

  const KEY = "cookie_consent";
  const banner = document.getElementById("cookieBanner");
  const btnAccept = document.getElementById("cookieAccept");
  const btnReject = document.getElementById("cookieReject");

  function getConsent() {
    return localStorage.getItem(KEY); // "accepted" | "rejected" | null
  }

  function setConsent(value) {
    localStorage.setItem(KEY, value);
  }

  function showBanner() {
    banner.classList.remove("cookie-hidden");
  }

  function hideBanner() {
    banner.classList.add("cookie-hidden");
  }

  function loadYouTubeEmbeds() {
    document.querySelectorAll("iframe.yt-embed[data-src]").forEach((iframe) => {
      const src = iframe.getAttribute("data-src");
      if (!src) return;
      //if (iframe.getAttribute("src") === src) return;
      iframe.setAttribute("src", src);
    });
  }

  function unloadYouTubeEmbeds() {
    document.querySelectorAll("iframe.yt-embed").forEach((iframe) => {
      iframe.setAttribute("src", "about:blank");
    });
  }

  function applyConsent(consent) {
    if (consent === "accepted") {
      loadYouTubeEmbeds();
    } else if (consent === "rejected") {
      unloadYouTubeEmbeds();
    }
  }

  const current = getConsent();
  if (!current) {
    showBanner();
  } else {
    applyConsent(current);
  }

  btnAccept.addEventListener("click", () => {
    setConsent("accepted");
    applyConsent("accepted");
    hideBanner();
  });

  btnReject.addEventListener("click", () => {
    setConsent("rejected");
    applyConsent("rejected");
    hideBanner();
  });

  window.applyCookieConsentToEmbeds = function () {
    const consent = localStorage.getItem("cookie_consent");

    if (consent === "accepted") {
      document
        .querySelectorAll("iframe.yt-embed[data-src]")
        .forEach((iframe) => {
          const src = iframe.getAttribute("data-src");
          if (src) iframe.setAttribute("src", src);
        });
    } else {
      document.querySelectorAll("iframe.yt-embed").forEach((iframe) => {
        iframe.setAttribute("src", "about:blank");
      });
    }
  };
})();
