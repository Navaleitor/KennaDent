// Número de WhatsApp de la clínica (formato internacional, sin "+" ni espacios).
// TODO: reemplazar por el número real.
const WHATSAPP_NUMBER = "520000000000";

// Menú móvil
const toggle = document.querySelector(".nav-toggle");
const menu = document.getElementById("menu");
toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});
menu.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// Animación al hacer scroll
const revealTargets = document.querySelectorAll(".card, .stat, .steps li, .quote, details, .section-head");
revealTargets.forEach((el) => el.classList.add("reveal"));

const counters = document.querySelectorAll("[data-count]");
const animateCount = (el) => {
  const target = Number(el.dataset.count);
  const duration = 1200;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * progress).toLocaleString("es-MX");
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        const counter = entry.target.querySelector("[data-count]");
        if (counter) animateCount(counter);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );
  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("visible"));
  counters.forEach((el) => (el.textContent = el.dataset.count));
}

// Formulario de cita → abre WhatsApp con el mensaje prellenado
const form = document.getElementById("cita-form");
const status = form.querySelector(".form-status");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("[required]").forEach((field) => {
    const ok = field.value.trim() !== "";
    field.classList.toggle("invalid", !ok);
    if (!ok) valid = false;
  });
  if (!valid) {
    status.textContent = "Por favor completa tu nombre y teléfono.";
    return;
  }
  const data = new FormData(form);
  const text = [
    "Hola KennaDent, me gustaría agendar una cita.",
    `Nombre: ${data.get("nombre")}`,
    `Teléfono: ${data.get("telefono")}`,
    `Servicio: ${data.get("servicio")}`,
    data.get("mensaje") ? `Mensaje: ${data.get("mensaje")}` : "",
  ].filter(Boolean).join("\n");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  status.textContent = "¡Gracias! Te redirigimos a WhatsApp para enviar tu solicitud.";
  form.reset();
});

document.getElementById("year").textContent = new Date().getFullYear();
