// static/js/nav_tigre.js

// 1. Lógica de Redirección
function redirigirAlInicio() {
    const rol = localStorage.getItem('userRole'); 
    const rutas = {
        'admin': '/admin/dashboard',
        'prefecto': '/admin/dashboard',
        'orientacion': '/admin/dashboard',
        'guardia': '/admin/escaneo'
    };

    if (rol && rutas[rol.toLowerCase()]) {
        window.location.href = rutas[rol.toLowerCase()];
    } else {
        window.location.href = '/login';
    }
}

// 2. Cerrar Sesión (Spring Security /logout)
function confirmarCerrarSesion() {
    Swal.fire({
        title: '¿Cerrar Sesión?',
        text: "¡El Tigre te esperará pronto!",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie = "AuthToken=; path=/; max-age=0; SameSite=Strict";
            window.location.href = "/logout";
        }
    });
}

// 3. EL TOGGLE MAESTRO (Delegado)
document.addEventListener("click", function(e) {
    const toggleBtn = e.target.closest("#menu-toggle");
    if (toggleBtn) {
        e.preventDefault();
        const wrapper = document.getElementById("wrapper");
        if (wrapper) {
            wrapper.classList.toggle("toggled");
        }
    }
    
    if (window.innerWidth <= 991 && !e.target.closest("#sidebar-wrapper") && !toggleBtn) {
        document.getElementById("wrapper")?.classList.remove("toggled");
    }
});

// 4. NAVEGACIÓN INTELIGENTE (Marcar enlace activo automáticamente)
document.addEventListener("DOMContentLoaded", function() {
    const currentPath = window.location.pathname;

    document.querySelectorAll('.sb-item, .sb-sub').forEach(el => {
        el.classList.remove('active');
    });

    const activeLink = document.querySelector(`.sb-body a[href="${currentPath}"]`);

    if (activeLink) {
        activeLink.classList.add('active');
        const parentCollapse = activeLink.closest('.collapse');
        
        if (parentCollapse) {
            parentCollapse.classList.add('show');
            const toggleBtn = document.querySelector(`[aria-controls="${parentCollapse.id}"]`);
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', 'true');
                toggleBtn.classList.add('active');
            }
        }
    }
});