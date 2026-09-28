# KennaDent

Sitio web de la clínica dental **KennaDent**: una página estática (HTML, CSS y JavaScript, sin dependencias ni paso de compilación).

## Estructura

```
KennaDent/
├── index.html        Página principal (todas las secciones)
├── css/styles.css    Estilos y diseño responsive
├── js/main.js        Menú móvil, animaciones y formulario de citas por WhatsApp
└── assets/
    └── favicon.svg   Logotipo / ícono
```

## Secciones

1. **Inicio**: mensaje principal y llamada a agendar cita
2. **Servicios**: limpieza, estética, ortodoncia, implantes, endodoncia y odontopediatría
3. **Nosotros**: cifras y valores de la clínica
4. **¿Cómo funciona?**: la primera visita en 3 pasos
5. **Testimonios**
6. **Preguntas frecuentes**
7. **Contacto**: datos y formulario que abre WhatsApp con el mensaje ya escrito

## Verla localmente

Abre `index.html` en el navegador, o levanta un servidor local:

```bash
python3 -m http.server 8000
# luego visita http://localhost:8000
```

## Pendiente: datos reales

El contexto del proyecto no traía datos de la clínica, así que estos elementos son **provisionales** y hay que cambiarlos:

- Dirección, teléfono, correo y horario: sección `#contacto` de `index.html`
- Número de WhatsApp: constante `WHATSAPP_NUMBER` en `js/main.js` y los enlaces `wa.me` en `index.html`
- Testimonios: son textos de ejemplo
- Cifras de la sección "Nosotros" (años, pacientes, especialistas)
- Lista de servicios, si la clínica ofrece otros

## Publicación

Al ser un sitio estático se puede publicar gratis con **GitHub Pages**: en *Settings → Pages*, elige la rama `main` y la carpeta raíz. También funciona en Netlify o Vercel sin configuración adicional.
