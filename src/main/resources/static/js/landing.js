/**
 * LANDING PAGE INTERACTIVA - CBTis 134 "Nicolás Catalán"
 * Conexión dinámica con MongoDB REST API y animaciones
 */

const carrerasInfo = {
    ia: {
        titulo: "Inteligencia Artificial",
        icono: "bi-cpu-fill",
        color: "#0284c7",
        badge: "Vanguardia Tecnológica 4.0",
        duracion: "6 Semestres (3 Años)",
        tituloOtorgado: "Técnico en Inteligencia Artificial",
        descripcion: "Carrera pionera e innovadora en el estado de Guerrero. Desarrolla competencias en algoritmos de aprendizaje automático (Machine Learning), visión artificial, procesamiento de lenguaje natural, redes neuronales y automatización de procesos para la industria inteligente.",
        modulos: [
            "Módulo I: Fundamentos de programación y estructuras de datos para IA.",
            "Módulo II: Análisis, limpieza y procesamiento masivo de datos (Data Science).",
            "Módulo III: Modelos de Machine Learning y algoritmos de clasificación.",
            "Módulo IV: Visión por computadora y procesamiento de lenguaje natural.",
            "Módulo V: Implementación de agentes inteligentes y soluciones en la nube."
        ],
        campoLaboral: [
            "Empresas desarrolladoras de software e inteligencia artificial.",
            "Centros de analítica de datos e investigación tecnológica.",
            "Automatización de procesos en el sector industrial y bancario.",
            "Emprendimiento de soluciones tecnológicas y consultoría."
        ]
    },
    prog: {
        titulo: "Programación",
        icono: "bi-code-slash",
        color: "#7c3aed",
        badge: "Desarrollo de Software",
        duracion: "6 Semestres (3 Años)",
        tituloOtorgado: "Técnico en Programación",
        descripcion: "Formación especializada en desarrollo de software full-stack, aplicaciones móviles (iOS / Android), administración de bases de datos relacionales y NoSQL, desarrollo de APIs y plataformas empresariales con altos estándares de calidad.",
        modulos: [
            "Módulo I: Desarrollo de software utilizando programación estructurada y POO.",
            "Módulo II: Diseño y gestión de bases de datos relacionales y no relacionales.",
            "Módulo III: Desarrollo de aplicaciones web interactivas (Frontend y Backend).",
            "Módulo IV: Creación de aplicaciones móviles nativas y multiplataforma.",
            "Módulo V: Integración de APIs, microservicios y despliegue en la nube."
        ],
        campoLaboral: [
            "Startups y empresas de tecnología nacionales e internacionales.",
            "Desarrollo de software independiente (Freelance global).",
            "Departamentos de TI y sistemas de corporativos y gobierno.",
            "Empresas de comercio electrónico, fintech y videojuegos."
        ]
    },
    ecom: {
        titulo: "Comercio Electrónico (E-Commerce)",
        icono: "bi-cart-check-fill",
        color: "#ea580c",
        badge: "Negocios Digitales & Marketing",
        duracion: "6 Semestres (3 Años)",
        tituloOtorgado: "Técnico en Comercio Electrónico",
        descripcion: "Especialidad enfocada en la creación, administración y escalamiento de tiendas digitales, estrategias de marketing digital, optimización de conversiones, pasarelas de pago y logística de distribución para la economía global.",
        modulos: [
            "Módulo I: Fundamentos de modelos de negocio digital y diseño web comercial.",
            "Módulo II: Configuración de plataformas de e-commerce y catálogos en línea.",
            "Módulo III: Marketing digital, pauta publicitaria (Google/Meta) y SEO.",
            "Módulo IV: Gestión de pasarelas de pago, seguridad y analítica web.",
            "Módulo V: Logística de envíos, servicio al cliente y fidelización digital."
        ],
        campoLaboral: [
            "Empresas de retail y tiendas con venta digital omnicanal.",
            "Agencias de marketing digital y branding.",
            "Plataformas de marketplace y marketplaces globales.",
            "Emprendimiento y creación de tu propia marca y tienda en línea."
        ]
    },
    lab: {
        titulo: "Laboratorista Clínico",
        icono: "bi-eyedropper",
        color: "#059669",
        badge: "Ciencias de la Salud",
        duracion: "6 Semestres (3 Años)",
        tituloOtorgado: "Técnico Laboratorista Clínico",
        descripcion: "Formación de alto rigor ético y científico en la toma, manejo y análisis de muestras biológicas (sangre, orina, tejidos) mediante técnicas bioquímicas, microbiológicas, hematológicas e inmunológicas para el diagnóstico médico.",
        modulos: [
            "Módulo I: Técnicas de toma de muestras biológicas y bioseguridad.",
            "Módulo II: Análisis hematológicos y citológicos.",
            "Módulo III: Pruebas bioquímicas e inmunoensayos clínicos.",
            "Módulo IV: Análisis microbiológicos y parasitológicos.",
            "Módulo V: Control de calidad en laboratorios clínicos y banco de sangre."
        ],
        campoLaboral: [
            "Hospitales públicos (IMSS, ISSSTE, SSA) y privados.",
            "Laboratorios de análisis clínicos y bancos de sangre.",
            "Centros de diagnóstico y laboratorios de investigación biomédica.",
            "Industria farmacéutica y biotecnológica."
        ]
    },
    const: {
        titulo: "Construcción",
        icono: "bi-building-gear",
        color: "#b45309",
        badge: "Arquitectura & Obra Civil",
        duracion: "6 Semestres (3 Años)",
        tituloOtorgado: "Técnico en Construcción",
        descripcion: "Capacitación técnica en interpretación y elaboración de planos arquitectónicos digitales (AutoCAD/BIM), levantamientos topográficos, cálculo y cuantificación de materiales, supervisión de obra civil y presupuestos.",
        modulos: [
            "Módulo I: Dibujo arquitectónico e ingeniería con software CAD.",
            "Módulo II: Levantamientos topográficos con equipo digital y estación total.",
            "Módulo III: Cuantificación de volúmenes de obra y presupuestos.",
            "Módulo IV: Supervisión de procesos constructivos y control de calidad.",
            "Módulo V: Administración y normatividad de obras civiles públicas y privadas."
        ],
        campoLaboral: [
            "Empresas constructoras y despachos de arquitectura e ingeniería.",
            "Dependencias de obras públicas y desarrollo urbano.",
            "Laboratorios de mecánica de suelos y control de concreto.",
            "Despachos de topografía y contratista independiente."
        ]
    },
    cont: {
        titulo: "Contabilidad",
        icono: "bi-calculator-fill",
        color: "#1d4ed8",
        badge: "Finanzas & Fiscal",
        duracion: "6 Semestres (3 Años)",
        tituloOtorgado: "Técnico en Contabilidad",
        descripcion: "Formación profesional en gestión contable, registro de operaciones comerciales, cálculo y declaración de impuestos fiscales (SAT), elaboración de nóminas digitales y auditoría financiera mediante software contable especializado.",
        modulos: [
            "Módulo I: Registro de operaciones contables de empresas comerciales.",
            "Módulo II: Elaboración de estados financieros y conciliaciones bancarias.",
            "Módulo III: Determinación y cálculo de impuestos federales y estatales.",
            "Módulo IV: Gestión y timbrado de nóminas y seguridad social (IMSS).",
            "Módulo V: Auditoría interna, presupuestos y control de costos."
        ],
        campoLaboral: [
            "Despachos contables, de auditoría y consultoría fiscal.",
            "Empresas privadas en departamentos de finanzas y tesorería.",
            "Instituciones bancarias y financieras.",
            "Dependencias de gobierno y administración pública."
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    sincronizarDatosLandingDesdeMongo();
    inicializarNavbarScroll();
    inicializarNavegacionSuave();
    inicializarContadoresEstadisticas();
    configurarFormularioContacto();
});

// 1. Sincronizar información institucional en tiempo real desde MongoDB
async function sincronizarDatosLandingDesdeMongo() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            if (!data) return;
            
            const nomPlantel = data.nombre_plantel || 'CBTis 134';
            const nomOficial = data.nombre_oficial_plantel || 'Centro de Bachillerato Tecnológico industrial y de servicios No. 134 "Nicolás Catalán"';
            const slogan = data.slogan_plantel || '"Por que prestigio se gana con esfuerzo... Somos CBTis 134"';
            const logoPlantel = (data.logo_plantel_url && data.logo_plantel_url.trim() !== '') ? data.logo_plantel_url : '/img/logo_aniversario.jpg';
            const logoInicio = (data.logo_inicio_url && data.logo_inicio_url.trim() !== '') ? data.logo_inicio_url : '/img/tigres.png';
            const tel = data.telefono_escuela || '(747) 47 2 34 64';
            const cct = data.cct_escuela || '12DCT0001L';

            // Reemplazar textos institucionales
            document.querySelectorAll('.landing-nombre-plantel').forEach(el => el.innerText = nomPlantel);
            document.querySelectorAll('.landing-nombre-oficial').forEach(el => el.innerText = nomOficial);
            document.querySelectorAll('.landing-slogan').forEach(el => el.innerText = slogan);
            document.querySelectorAll('.landing-telefono').forEach(el => {
                el.innerText = tel;
                if (el.tagName === 'A') el.href = 'tel:' + tel.replace(/\D/g, '');
            });
            document.querySelectorAll('.landing-cct').forEach(el => el.innerText = cct);

            // Reemplazar logos de forma segura
            if (logoPlantel) {
                document.querySelectorAll('.landing-logo-plantel').forEach(img => {
                    if (img.tagName === 'IMG') {
                        img.src = logoPlantel;
                        img.onerror = function() { this.onerror = null; this.src = '/img/logo_aniversario.jpg'; };
                    }
                });
            }
            if (logoInicio) {
                document.querySelectorAll('.landing-logo-mascota').forEach(img => {
                    if (img.tagName === 'IMG') {
                        img.src = logoInicio;
                        img.onerror = function() { this.onerror = null; this.src = '/img/tigres.png'; };
                    }
                });
            }
        }
    } catch (e) {
        console.warn("No se pudo sincronizar información en vivo de MongoDB:", e);
    }
}

// 2. Navbar Scroll & Mobile Collapse Auto-Close
function inicializarNavbarScroll() {
    const navbar = document.querySelector('.landing-navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Auto-cerrar menú en dispositivos móviles al presionar una opción
    document.querySelectorAll('.landing-navbar .nav-link, .landing-navbar .btn-portal-acceso').forEach(link => {
        link.addEventListener('click', () => {
            const collapseEl = document.getElementById('navbarLandingContent');
            if (collapseEl && collapseEl.classList.contains('show') && window.bootstrap) {
                const bsCollapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
                bsCollapse.hide();
            }
        });
    });
}

// 2.1 Navegación suave
function inicializarNavegacionSuave() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId !== '#') {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    e.preventDefault();
                    const navHeight = document.querySelector('.landing-navbar')?.offsetHeight || 70;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - navHeight;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// 3. Modal Detallado de Carrera
function verDetalleCarrera(carreraKey) {
    const info = carrerasInfo[carreraKey];
    if (!info) return;

    const titleEl = document.getElementById('modalCareerTitle');
    const badgeEl = document.getElementById('modalCareerBadge');
    const descEl = document.getElementById('modalCareerDesc');
    const tituloEl = document.getElementById('modalCareerTitulo');
    const duracionEl = document.getElementById('modalCareerDuracion');

    if (titleEl) titleEl.innerText = info.titulo;
    if (badgeEl) badgeEl.innerText = info.badge;
    if (descEl) descEl.innerText = info.descripcion;
    if (tituloEl) tituloEl.innerText = info.tituloOtorgado;
    if (duracionEl) duracionEl.innerText = info.duracion;

    const modulosList = document.getElementById('modalCareerModulos');
    if (modulosList) {
        modulosList.innerHTML = '';
        info.modulos.forEach(m => {
            const li = document.createElement('li');
            li.className = 'mb-2 text-dark small d-flex align-items-start gap-2';
            li.innerHTML = '<i class="bi bi-check-circle-fill text-success mt-1"></i><span>' + m + '</span>';
            modulosList.appendChild(li);
        });
    }

    const campoList = document.getElementById('modalCareerCampo');
    if (campoList) {
        campoList.innerHTML = '';
        info.campoLaboral.forEach(c => {
            const li = document.createElement('li');
            li.className = 'mb-2 text-muted small d-flex align-items-start gap-2';
            li.innerHTML = '<i class="bi bi-briefcase-fill mt-1" style="color: ' + info.color + '"></i><span>' + c + '</span>';
            campoList.appendChild(li);
        });
    }

    const modalEl = document.getElementById('modalDetalleCarrera');
    if (modalEl) {
        if (window.bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    }
}
window.verDetalleCarrera = verDetalleCarrera;

// 4. Animación de Contadores al hacer Scroll
function inicializarContadoresEstadisticas() {
    const statsSection = document.querySelector('.stats-strip-section');
    if (!statsSection) return;

    let animado = false;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !animado) {
            animado = true;
            document.querySelectorAll('.stat-number').forEach(el => {
                const target = parseInt(el.getAttribute('data-target') || '0', 10);
                const prefix = el.getAttribute('data-prefix') || '';
                const suffix = el.getAttribute('data-suffix') || '';
                
                let count = 0;
                const duration = 1800;
                const stepTime = Math.max(20, Math.floor(duration / 50));
                
                const timer = setInterval(() => {
                    count += Math.ceil(target / 40);
                    if (count >= target) {
                        count = target;
                        clearInterval(timer);
                    }
                    el.innerText = prefix + count.toLocaleString() + suffix;
                }, stepTime);
            });
        }
    }, { threshold: 0.2 });

    observer.observe(statsSection);
}

// 5. Formulario de Contacto Interactivo
function configurarFormularioContacto() {
    const form = document.getElementById('formContactoLanding');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = document.getElementById('contactNombre')?.value.trim();
        const email = document.getElementById('contactEmail')?.value.trim();
        const mensaje = document.getElementById('contactMensaje')?.value.trim();

        if (!nombre || !email || !mensaje) {
            if (window.Swal) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Campos requeridos',
                    text: 'Por favor completa tu nombre, correo y mensaje.',
                    confirmButtonColor: '#7b1b37'
                });
            } else {
                alert('Por favor completa todos los campos requeridos.');
            }
            return;
        }

        if (window.Swal) {
            Swal.fire({
                icon: 'success',
                title: '¡Mensaje Recibido!',
                html: 'Gracias por contactarnos <b>' + nombre + '</b>.<br>El departamento de Orientación Educativa del CBTis 134 responderá a <b>' + email + '</b> a la brevedad.',
                confirmButtonColor: '#7b1b37'
            });
        } else {
            alert('¡Mensaje enviado con éxito! Nos pondremos en contacto pronto.');
        }

        form.reset();
    });
}
