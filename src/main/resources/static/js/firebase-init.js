// static/js/firebase-init.js
// Alias para compatibilidad con app-init.js (MongoDB REST API Backend)

if (typeof window.rolUsuarioActual === 'undefined') {
    window.rolUsuarioActual = (localStorage.getItem('userRole') || '').toUpperCase();
}
window.usuarioActual = { email: localStorage.getItem('userEmail') || '' };

(function aplicarAntiParpadeoGlobal() {
    const rolGuardado = localStorage.getItem('userRole');
    const rolMayus = (rolGuardado || '').toUpperCase();
    
    if (rolMayus !== 'ADMIN') {
        let estilo = document.getElementById('style-anti-flicker-instantaneo');
        if (!estilo) {
            estilo = document.createElement('style');
            estilo.id = 'style-anti-flicker-instantaneo';
            document.head.appendChild(estilo);
        }

        estilo.innerHTML = `
            .requiere-permiso { display: none !important; }
            ${rolMayus ? `
                .requiere-permiso[data-roles*="${rolMayus}"] { display: flex !important; }
                p.sb-label[data-roles*="${rolMayus}"] { display: flex !important; }
                div.requiere-permiso[data-roles*="${rolMayus}"] { display: block !important; }
            ` : ''}
        `;
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const rolLocal = (localStorage.getItem('userRole') || '').toUpperCase();
    aplicarPermisosVisuales(rolLocal);
    protegerRutasCentralizado(rolLocal);
    
    sincronizarRolDesdeServidor();
});

async function sincronizarRolDesdeServidor() {
    try {
        const res = await fetch('/api/usuarios/me');
        if (res.ok) {
            const user = await res.json();
            const rolReal = (user.rol || '').toUpperCase();
            const nombreReal = user.nombre || user.correo;

            const rolPrevio = localStorage.getItem('userRole');
            localStorage.setItem('userRole', rolReal);
            localStorage.setItem('userName', nombreReal);
            localStorage.setItem('userEmail', user.correo || '');

            window.rolUsuarioActual = rolReal;

            if (rolPrevio !== rolReal) {
                aplicarPermisosVisuales(rolReal);
                protegerRutasCentralizado(rolReal);
            }
            actualizarEncabezadoUsuario(nombreReal, rolReal);
            return;
        }
    } catch (e) {
        console.error("Error al sincronizar sesión:", e);
    }

    const rolFallback = (localStorage.getItem('userRole') || '').toUpperCase();
    aplicarPermisosVisuales(rolFallback);
    protegerRutasCentralizado(rolFallback);
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

    if (rolesPermitidos) {
        if (!rolesPermitidos.includes(rol)) {
            console.warn(`ACCESO DENEGADO: El rol '${rol}' no tiene acceso a ${path}`);

            if (rol === 'GUARDIA') {
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
}

function aplicarPermisosVisuales(rolActual) {
    const rolMayuscula = (rolActual || '').toUpperCase();
    const elementosProtegidos = document.querySelectorAll('.requiere-permiso');

    elementosProtegidos.forEach(elemento => {
        const rolesString = elemento.getAttribute('data-roles');
        if (!rolesString) {
            if (rolMayuscula !== 'ADMIN') {
                elemento.style.setProperty('display', 'none', 'important');
            } else {
                elemento.style.removeProperty('display');
            }
            return;
        }

        const rolesPermitidos = rolesString.split(',').map(r => r.trim().toUpperCase());

        if (!rolesPermitidos.includes(rolMayuscula)) {
            elemento.style.setProperty('display', 'none', 'important');
        } else {
            elemento.style.removeProperty('display');
        }
    });
}