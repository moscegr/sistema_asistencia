/**
 * LANDING PAGE INTERACTIVA - CBTis 134 "Nicolás Catalán"
 * Conexión dinámica con MongoDB REST API, información oficial de carreras y admisiones
 */

const carrerasInfo = {
    ia: {
        titulo: "Inteligencia Artificial",
        icono: "bi-cpu-fill",
        color: "#0284c7",
        badge: "Alta Demanda & Vanguardia 4.0",
        duracion: "6 Semestres (3 Años)",
        promedioMinimo: "8.0",
        tituloOtorgado: "Técnico en Inteligencia Artificial",
        imagen: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80",
        objetivo: "La carrera de Técnico en Inteligencia Artificial proporciona al estudiante la preparación para aplicar técnicas de representación del conocimiento y procesamiento de información en diversos contextos industriales y de servicios, basándose en estándares y procedimientos implementados por una empresa, lo que contribuye a la satisfacción y éxito del negocio.",
        descripcion: "Carrera de alta demanda y vanguardia tecnológica enfocada en Machine Learning, procesamiento de lenguaje natural, visión artificial, entrenamiento de redes neuronales y automatización inteligente.",
        modulos: [
            {
                titulo: "Módulo I: Desarrolla programación lógica para solucionar problemas",
                submodulos: [
                    "Submódulo 1 - Desarrolla algoritmos para solucionar problemas",
                    "Submódulo 2 - Elabora proyectos con programación lógica"
                ]
            },
            {
                titulo: "Módulo II: Soluciona problemas con herramientas de inteligencia artificial",
                submodulos: [
                    "Submódulo 1 - Soluciona problemas con machine learning",
                    "Submódulo 2 - Soluciona problemas con lenguaje natural",
                    "Submódulo 3 - Soluciona problemas con visión artificial"
                ]
            },
            {
                titulo: "Módulo III: Entrena modelos de inteligencia artificial",
                submodulos: [
                    "Submódulo 1 - Construye modelos con inteligencia artificial",
                    "Submódulo 2 - Configura parámetros operativos de modelos de inteligencia artificial"
                ]
            },
            {
                titulo: "Módulo IV: Automatiza procesos con inteligencia artificial",
                submodulos: [
                    "Submódulo 1 - Automatiza procesos para el sector industrial",
                    "Submódulo 2 - Automatiza procesos para el sector servicios"
                ]
            },
            {
                titulo: "Módulo V: Implementa sistemas inteligentes",
                submodulos: [
                    "Submódulo 1 - Implementa sistemas con inteligencia artificial en el sector industrial",
                    "Submódulo 2 - Implementa sistemas con inteligencia artificial en el sector servicios"
                ]
            }
        ],
        campoLaboral: [
            "Empresas desarrolladoras de software y soluciones de inteligencia artificial.",
            "Centros de ciencia de datos, analítica e investigación tecnológica.",
            "Automatización de procesos en el sector industrial, bancario y de servicios.",
            "Emprendimiento tecnológico y consultoría en transformación digital 4.0."
        ]
    },
    prog: {
        titulo: "Programación",
        icono: "bi-code-slash",
        color: "#7c3aed",
        badge: "Desarrollo de Software",
        duracion: "6 Semestres (3 Años)",
        promedioMinimo: "8.0",
        tituloOtorgado: "Técnico en Programación",
        imagen: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
        objetivo: "Ofrece las competencias profesionales que permiten al estudiante realizar actividades dirigidas a analizar, diseñar, desarrollar, instalar y mantener software de aplicación tomando en cuenta los requerimientos del usuario.",
        descripcion: "Formación integral en desarrollo de aplicaciones web full-stack, software estructurado y orientado a objetos, gestión de bases de datos persistentes y apps móviles para Android e iOS.",
        modulos: [
            {
                titulo: "Módulo I: Desarrolla software de aplicación con programación estructurada",
                submodulos: [
                    "Submódulo 1 - Construye algoritmos para la solución de problemas",
                    "Submódulo 2 - Aplica estructuras de control con un lenguaje de programación",
                    "Submódulo 3 - Aplica estructuras de datos con un lenguaje de programación"
                ]
            },
            {
                titulo: "Módulo II: Aplica metodologías de desarrollo de software con herramientas de programación visual",
                submodulos: [
                    "Submódulo 1 - Aplica la metodología espiral con programación orientada a objetos",
                    "Submódulo 2 - Aplica la metodología de desarrollo rápido de aplicaciones con programación orientada a eventos"
                ]
            },
            {
                titulo: "Módulo III: Desarrolla aplicaciones web",
                submodulos: [
                    "Submódulo 1 - Construye páginas web",
                    "Submódulo 2 - Desarrolla aplicaciones que se ejecutan en el cliente",
                    "Submódulo 3 - Desarrolla aplicaciones que se ejecutan en el servidor"
                ]
            },
            {
                titulo: "Módulo IV: Desarrolla software de aplicación web con almacenamiento persistente de datos",
                submodulos: [
                    "Submódulo 1 - Construye bases de datos para aplicaciones web",
                    "Submódulo 2 - Desarrolla aplicaciones web con conexión a bases de datos"
                ]
            },
            {
                titulo: "Módulo V: Desarrolla aplicaciones para dispositivos móviles",
                submodulos: [
                    "Submódulo 1 - Desarrolla aplicaciones móviles para Android",
                    "Submódulo 2 - Desarrolla aplicaciones móviles para iOS"
                ]
            }
        ],
        campoLaboral: [
            "Empresas de desarrollo de software nacional e internacional.",
            "Desarrollo frontend, backend o full-stack en agencias de tecnología.",
            "Creación y mantenimiento de aplicaciones móviles y plataformas en la nube.",
            "Departamentos de TI, sistemas de corporativos y trabajo independiente (Freelance)."
        ]
    },
    ecom: {
        titulo: "Comercio Electrónico (E-Commerce)",
        icono: "bi-cart-check-fill",
        color: "#ea580c",
        badge: "Negocios Digitales & Marketing",
        duracion: "6 Semestres (3 Años)",
        promedioMinimo: "8.0",
        tituloOtorgado: "Técnico en Comercio Electrónico",
        imagen: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80",
        objetivo: "Formar profesionales capaces de gestionar, diseñar y operar negocios en línea, preparando a los estudiantes para las demandas del entorno digital actual.",
        descripcion: "Capacitación en gestión de tiendas en línea, análisis de mercado digital, campañas de promoción y marketing, analítica web y logística de envíos para marketplaces globales.",
        modulos: [
            {
                titulo: "Módulo I: Gestiona plataformas digitales para venta de productos y servicios en línea",
                submodulos: [
                    "Submódulo 1 - Administra la tienda en línea para la comercialización",
                    "Submódulo 2 - Aplica procedimientos para oportunidades de negocios en línea",
                    "Submódulo 3 - Opera plataformas de comercio digital"
                ]
            },
            {
                titulo: "Módulo II: Colabora en el análisis de mercado para la toma de decisiones en el contexto empresarial y emprendedor",
                submodulos: [
                    "Submódulo 1 - Auxilia en la promoción digital de productos y servicios",
                    "Submódulo 2 - Implementa estrategias de promoción digital de acuerdo con el modelo de negocio"
                ]
            },
            {
                titulo: "Módulo III: Evalúa el rendimiento de la tienda virtual mediante indicadores de desempeño",
                submodulos: [
                    "Submódulo 1 - Realiza análisis de tendencias con medidores de desempeño (KPI)",
                    "Submódulo 2 - Elabora informes de rendimiento para la toma de decisiones"
                ]
            },
            {
                titulo: "Módulo IV: Auxilia en los procesos logísticos para negocios en línea",
                submodulos: [
                    "Submódulo 1 - Verifica disponibilidad de inventarios para venta en línea",
                    "Submódulo 2 - Gestiona el proceso de envío y devolución de productos"
                ]
            },
            {
                titulo: "Módulo V: Implementa modelos de negocios en E-commerce",
                submodulos: [
                    "Submódulo 1 - Comercializa bienes y servicios en tiendas en línea",
                    "Submódulo 2 - Aplica modelos de atención al cliente en canales electrónicos",
                    "Submódulo 3 - Aplica protocolos de seguridad en transacciones electrónicas"
                ]
            }
        ],
        campoLaboral: [
            "Empresas de retail con tiendas digitales y canales omnicanal.",
            "Agencias de marketing digital, pauta publicitaria (Google/Meta) y SEO.",
            "Gestión logística y comercial en marketplaces (Amazon, MercadoLibre).",
            "Creación de tu propia marca, tienda virtual y emprendimiento digital."
        ]
    },
    lab: {
        titulo: "Laboratorista Clínico",
        icono: "bi-eyedropper",
        color: "#059669",
        badge: "Más Cotizada & Ciencias de la Salud",
        duracion: "6 Semestres (3 Años)",
        promedioMinimo: "8.5",
        cupoNota: "4 grupos matutino y 1 grupo vespertino",
        tituloOtorgado: "Técnico Laboratorista Clínico",
        imagen: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
        objetivo: "Ofrece las competencias profesionales que permiten al estudiante realizar actividades dirigidas a la participación en procesos encaminados al diagnóstico, tratamiento, seguimiento y preservación de la salud del ser humano; así como a los procesos tecnológicos y de investigación inherentes a su campo laboral.",
        descripcion: "Una de las especialidades más cotizadas, prestigiosas y con mayor demanda académica del CBTis 134. Formación especializada en toma de muestras, microbiología, análisis hematológicos, citoquímicos, inmunohematología, química clínica y banco de sangre.",
        modulos: [
            {
                titulo: "Módulo I: Auxilia en los procesos básicos de laboratorio clínico",
                submodulos: [
                    "Submódulo 1 - Prepara soluciones para las operaciones básicas del laboratorio",
                    "Submódulo 2 - Toma muestras biológicas"
                ]
            },
            {
                titulo: "Módulo II: Identifica microorganismos con base en técnicas microbiológicas para el diagnóstico clínico",
                submodulos: [
                    "Submódulo 1 - Identifica microorganismos con base en técnicas bacteriológicas",
                    "Submódulo 2 - Identifica microorganismos con base en técnicas parasitológicas"
                ]
            },
            {
                titulo: "Módulo III: Analiza fluidos corporales de interés clínico",
                submodulos: [
                    "Submódulo 1 - Realiza análisis hematológicos de serie roja",
                    "Submódulo 2 - Realiza análisis inmunológicos",
                    "Submódulo 3 - Realiza análisis citoquímicos a líquidos y secreciones corporales"
                ]
            },
            {
                titulo: "Módulo IV: Analiza sangre con base en técnicas inmunohematológicas y hemostáticas",
                submodulos: [
                    "Submódulo 1 - Realiza análisis hematológicos de serie blanca y hemostasia",
                    "Submódulo 2 - Analiza y fracciona sangre con fines transfusionales"
                ]
            },
            {
                titulo: "Módulo V: Analiza sangre con base en técnicas de química clínica y pruebas especiales",
                submodulos: [
                    "Submódulo 1 - Analiza sangre con base en técnicas de química clínica",
                    "Submódulo 2 - Analiza sangre mediante pruebas hormonales, toxicológicas y de marcadores tumorales"
                ]
            }
        ],
        campoLaboral: [
            "Hospitales públicos (IMSS, ISSSTE, SSA) y clínicas privadas.",
            "Laboratorios de análisis clínicos, banco de sangre y centros de transfusión.",
            "Centros de diagnóstico médico y laboratorios de investigación biomédica.",
            "Industria farmacéutica, biotecnológica y control de calidad sanitaria."
        ]
    },
    const: {
        titulo: "Construcción",
        icono: "bi-building-gear",
        color: "#b45309",
        badge: "Más Cotizada & Obra Civil",
        duracion: "6 Semestres (3 Años)",
        promedioMinimo: "8.0",
        tituloOtorgado: "Técnico en Construcción",
        imagen: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
        objetivo: "Ofrece las competencias profesionales que permiten al estudiante realizar actividades dirigidas a satisfacer la demanda actual de personal calificado capaz de supervisar, organizar y controlar la construcción de obras de acuerdo con las necesidades del proyecto; así como también generar su propia empresa con el propósito de auto emplearse.",
        descripcion: "Especialidad emblemática y de las más cotizadas del plantel con alta inserción laboral. Elaboración de planos digitales (CAD/BIM), levantamientos topográficos con estación total y GPS, supervisión de obra civil, acabados y presupuestos.",
        modulos: [
            {
                titulo: "Módulo I: Realizar dibujos de planos arquitectónicos con equipo básico y software",
                submodulos: [
                    "Submódulo 1 - Realizar dibujos de planos arquitectónicos y constructivos con equipo básico de dibujo",
                    "Submódulo 2 - Realizar dibujos de planos arquitectónicos y constructivos con software"
                ]
            },
            {
                titulo: "Módulo II: Supervisar obras de construcción de casa habitación",
                submodulos: [
                    "Submódulo 1 - Supervisar los procesos constructivos de trabajos preliminares y de obra negra",
                    "Submódulo 2 - Supervisar los procesos de acabados de casa habitación"
                ]
            },
            {
                titulo: "Módulo III: Supervisar las instalaciones de casa habitación",
                submodulos: [
                    "Submódulo 1 - Supervisar la instalación hidrosanitaria",
                    "Submódulo 2 - Supervisar la instalación eléctrica",
                    "Submódulo 3 - Supervisar las instalaciones especiales"
                ]
            },
            {
                titulo: "Módulo IV: Realiza levantamiento y trazo topográfico con equipo convencional, y cuantifica volúmenes de obra",
                submodulos: [
                    "Submódulo 1 - Realiza trazo y levantamiento topográfico con equipo convencional",
                    "Submódulo 2 - Cuantifica volúmenes de una obra"
                ]
            },
            {
                titulo: "Módulo V: Realiza levantamiento y trazo topográfico con estación total y GPS, y presupuesto de obra",
                submodulos: [
                    "Submódulo 1 - Realiza trazo y levantamiento topográfico con estación total y GPS",
                    "Submódulo 2 - Realiza el presupuesto de una obra con software"
                ]
            }
        ],
        campoLaboral: [
            "Empresas constructoras, despachos de arquitectura e ingeniería civil.",
            "Supervisión y control de obra en dependencias públicas de desarrollo urbano.",
            "Laboratorios de mecánica de suelos y control de calidad de concreto.",
            "Despachos de topografía digital, contratista independiente y edificación."
        ]
    },
    cont: {
        titulo: "Contabilidad",
        icono: "bi-calculator-fill",
        color: "#1d4ed8",
        badge: "Finanzas & Fiscal",
        duracion: "6 Semestres (3 Años)",
        promedioMinimo: "8.0",
        tituloOtorgado: "Técnico en Contabilidad",
        imagen: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
        objetivo: "Ofrece las competencias profesionales que permiten al estudiante registrar operaciones contables de empresas comerciales y de servicios u operaciones contables a través de un sistema electrónico, así como registrar operaciones contables de una entidad fabril, determinar contribuciones y asistir en actividades de auditoría.",
        descripcion: "Gestión de registros contables, formulación de estados financieros, nóminas digitales, declaraciones y obligaciones fiscales (SAT) y auditoría contable.",
        modulos: [
            {
                titulo: "Módulo I: Registra operaciones contables de empresas comerciales y de servicios",
                submodulos: [
                    "Submódulo 1 - Registra información contable de diversas entidades económicas",
                    "Submódulo 2 - Formula estados financieros de las empresas"
                ]
            },
            {
                titulo: "Módulo II: Opera los procesos contables dentro de un sistema electrónico",
                submodulos: [
                    "Submódulo 1 - Registra información contable en forma electrónica",
                    "Submódulo 2 - Registra información de los recursos materiales y financieros"
                ]
            },
            {
                titulo: "Módulo III: Registra operaciones contables de una entidad fabril",
                submodulos: [
                    "Submódulo 1 - Registra información contable de diversas entidades fabriles",
                    "Submódulo 2 - Genera nóminas en forma electrónica"
                ]
            },
            {
                titulo: "Módulo IV: Determina las contribuciones fiscales de personas físicas y morales",
                submodulos: [
                    "Submódulo 1 - Genera información fiscal de las personas físicas",
                    "Submódulo 2 - Genera información fiscal de las personas morales"
                ]
            },
            {
                titulo: "Módulo V: Asiste en actividades de auditoría de una entidad",
                submodulos: [
                    "Submódulo 1 - Verifica que la información contable de una entidad económica corresponda a las políticas",
                    "Submódulo 2 - Controla cuentas por cobrar y por pagar de la entidad"
                ]
            }
        ],
        campoLaboral: [
            "Despachos contables, de auditoría financiera y consultoría fiscal.",
            "Departamentos de finanzas, tesorería y nóminas en empresas privadas.",
            "Instituciones bancarias, cajas de ahorro y sector financiero.",
            "Dependencias de gobierno y organismos de fiscalización pública."
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
    const promedioEl = document.getElementById('modalCareerPromedio');
    const objetivoEl = document.getElementById('modalCareerObjetivo');
    const tituloEl = document.getElementById('modalCareerTitulo');
    const duracionEl = document.getElementById('modalCareerDuracion');

    if (titleEl) titleEl.innerText = info.titulo;
    if (badgeEl) badgeEl.innerText = info.badge;
    if (promedioEl) promedioEl.innerText = 'Promedio Mínimo: ' + info.promedioMinimo + (info.cupoNota ? ' (' + info.cupoNota + ')' : '');
    if (objetivoEl) objetivoEl.innerText = info.objetivo;
    if (tituloEl) tituloEl.innerText = info.tituloOtorgado;
    if (duracionEl) duracionEl.innerText = info.duracion;

    const modulosList = document.getElementById('modalCareerModulos');
    if (modulosList) {
        modulosList.innerHTML = '';
        info.modulos.forEach(m => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-light rounded-3 border mb-3';
            
            let submodulosHtml = '';
            m.submodulos.forEach(sm => {
                submodulosHtml += '<li class="mb-1 text-secondary small d-flex align-items-start gap-2"><i class="bi bi-arrow-right-short text-primary fs-5 mt-n1"></i><span>' + sm + '</span></li>';
            });

            div.innerHTML = '<h6 class="fw-bold text-dark mb-2 d-flex align-items-center gap-2"><i class="bi bi-bookmark-check-fill" style="color: ' + info.color + ';"></i> ' + m.titulo + '</h6><ul class="list-unstyled ps-3 mb-0">' + submodulosHtml + '</ul>';
            modulosList.appendChild(div);
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

// 3.1 Cerrar Modal y Desplazar hacia Contacto
function solicitarInfoDesdeModal() {
    const modalEl = document.getElementById('modalDetalleCarrera');
    const careerTitle = document.getElementById('modalCareerTitle')?.innerText;
    
    // Auto seleccionar la carrera en el formulario de contacto si coincide
    if (careerTitle) {
        const selectEl = document.getElementById('contactCarrera');
        if (selectEl) {
            for (let i = 0; i < selectEl.options.length; i++) {
                if (careerTitle.toLowerCase().includes(selectEl.options[i].value.toLowerCase())) {
                    selectEl.selectedIndex = i;
                    break;
                }
            }
        }
    }

    if (modalEl && window.bootstrap) {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        
        const ejecutarScroll = () => {
            modalEl.removeEventListener('hidden.bs.modal', ejecutarScroll);
            const contactoEl = document.getElementById('contacto');
            if (contactoEl) {
                const navHeight = document.querySelector('.landing-navbar')?.offsetHeight || 70;
                const elementPosition = contactoEl.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navHeight;
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        };

        modalEl.addEventListener('hidden.bs.modal', ejecutarScroll);
        bsModal.hide();
    } else {
        const contactoEl = document.getElementById('contacto');
        if (contactoEl) contactoEl.scrollIntoView({ behavior: 'smooth' });
    }
}
window.solicitarInfoDesdeModal = solicitarInfoDesdeModal;
window.solicitarFichaDesdeModal = solicitarInfoDesdeModal;

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
