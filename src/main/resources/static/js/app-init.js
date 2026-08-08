// static/js/app-init.js
// Inicialización centralizada de sesión REST/MongoDB y permisos por rol en Spring Security

window.rolUsuarioActual = (localStorage.getItem('userRole') || '').toUpperCase();
window.usuarioActual = { email: localStorage.getItem('userEmail') || '' };

(function aplicarAntiParpadeoGlobal() {
    const rolGuardado = localStorage.getItem('userRole');
    if (rolGuardado) {
        aplicarPermisosVisuales(rolGuardado);
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const rolLocal = localStorage.getItem('userRole');
    if (rolLocal) {
        aplicarPermisosVisuales(rolLocal);
        protegerRutasCentralizado(rolLocal);
    }
    
    // Sincronizar rol real autenticado en backend Spring Security / MongoDB
    sincronizarRolDesdeServidor();
});

async function sincronizarRolDesdeServidor() {
    try {
        const res = await fetch('/api/usuarios/me');
        if (res.ok) {
            const user = await res.json();
            const rolReal = (user.rol || 'ADMIN').toUpperCase();
            const nombreReal = user.nombre || user.correo;

            localStorage.setItem('userRole', rolReal);
            localStorage.setItem('userName', nombreReal);
            localStorage.setItem('userEmail', user.correo || '');

            window.rolUsuarioActual = rolReal;

            aplicarPermisosVisuales(rolReal);
            protegerRutasCentralizado(rolReal);
            actualizarEncabezadoUsuario(nombreReal, rolReal);
            return;
        }
    } catch (e) {
        console.error("Error al sincronizar sesión de usuario:", e);
    }

    const rolFallback = localStorage.getItem('userRole');
    if (rolFallback) {
        aplicarPermisosVisuales(rolFallback);
        protegerRutasCentralizado(rolFallback);
    }
}

function actualizarEncabezadoUsuario(nombre, rol) {
    const elName = document.getElementById('userName');
    const elBannerName = document.getElementById('userBannerName');
    const elBannerRole = document.getElementById('userBannerRole');

    if (elName) elName.innerText = nombre;
    if (elBannerName) elBannerName.innerText = nombre;
    if (elBannerRole) elBannerRole.innerText = `Rol: ${rol || 'SISTEMA'}`;
}

function protegerRutasCentralizado(rol) {
    if (!rol || rol.trim() === '') return;
    const rolMayus = rol.toUpperCase();
    const path = window.location.pathname;

    const reglasDeAcceso = {
        '/admin/dashboard': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        
        // Gestión Alumnos
        '/admin/alumnos': ['ADMIN'],
        '/admin/alumnos/nuevo': ['ADMIN'],
        '/admin/alumnos/gestion-archivos': ['ADMIN'],
        '/admin/alumnos/credenciales': ['ADMIN'],
        '/admin/alumnos/expediente': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/alumnos/seguimiento-conductual': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/alumnos/monitoreo-salud': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        
        // Gestión Administrativos
        '/admin/usuarios': ['ADMIN'],
        
        // Movimientos
        '/admin/pases': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/justificantes': ['ADMIN', 'ORIENTACION'],
        '/admin/incidencias/prefectura': ['ADMIN', 'PREFECTO'],
        '/admin/incidencias/orientacion': ['ADMIN', 'ORIENTACION'],
        
        // Accesos y Sistema
        '/admin/escaneo': ['ADMIN', 'GUARDIA'],
        '/admin/configuracion': ['ADMIN']
    };

    const rolesPermitidos = reglasDeAcceso[path];

    if (rolesPermitidos && !rolesPermitidos.includes(rolMayus)) {
        console.warn(`ACCESO DENEGADO: El rol '${rolMayus}' no tiene acceso a ${path}`);

        if (rolMayus === 'GUARDIA') {
            if (path !== '/admin/escaneo') {
                window.location.href = '/admin/escaneo';
            }
        } else {
            if (path !== '/admin/dashboard') {
                window.location.href = '/admin/dashboard';
            }
        }
    }
}

function aplicarPermisosVisuales(rolActual) {
    if (!rolActual) return;
    const rolMayus = rolActual.toUpperCase();

    let estilo = document.getElementById('style-anti-flicker-instantaneo');
    if (!estilo) {
        estilo = document.createElement('style');
        estilo.id = 'style-anti-flicker-instantaneo';
        document.head.appendChild(estilo);
    }

    if (rolMayus === 'ADMIN') {
        estilo.innerHTML = `
            .requiere-permiso { display: flex !important; }
            div.requiere-permiso { display: block !important; }
        `;
    } else {
        estilo.innerHTML = `
            .requiere-permiso { display: none !important; }
            .requiere-permiso[data-roles*="${rolMayus}"] { display: flex !important; }
            p.sb-label[data-roles*="${rolMayus}"] { display: flex !important; }
            div.requiere-permiso[data-roles*="${rolMayus}"] { display: block !important; }
        `;
    }
}
