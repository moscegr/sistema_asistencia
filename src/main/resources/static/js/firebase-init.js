(function aplicarAntiParpadeoGlobal() {
    const rolGuardado = localStorage.getItem('userRole');
    if (rolGuardado) {
        const rolMayus = rolGuardado.toUpperCase();
        const estilo = document.createElement('style');

        estilo.innerHTML = `
            .requiere-permiso:not([data-roles*="${rolMayus}"]) { 
                display: none !important; 
            }
        `;
        document.documentElement.appendChild(estilo);
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const rol = (localStorage.getItem('userRole') || 'admin').toUpperCase();
    aplicarPermisosVisuales(rol);
    protegerRutasCentralizado(rol);
});

function protegerRutasCentralizado(rol) {
    const path = window.location.pathname;

    const reglasDeAcceso = {
        '/admin/dashboard': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        
        // Gestión
        '/admin/alumnos': ['ADMIN'],
        '/admin/alumnos/nuevo': ['ADMIN'],
        '/admin/alumnos/gestion-archivos': ['ADMIN'],
        '/admin/alumnos/credenciales': ['ADMIN'],
        '/admin/alumnos/expediente': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/alumnos/seguimiento-conductual': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/alumnos/monitoreo-salud': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        
        // Gestión
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
            console.warn(`ACCESO DENEGADO: El rol ${rol} no puede ver ${path}`);

            if (rol === 'GUARDIA') {
                window.location.href = '/admin/escaneo';
            } else {
                window.location.href = '/admin/dashboard';
            }
        }
    }
}

function aplicarPermisosVisuales(rolActual) {
    if (!rolActual) return;
    const rolMayuscula = rolActual.toUpperCase();

    const elementosProtegidos = document.querySelectorAll('.requiere-permiso');

    elementosProtegidos.forEach(elemento => {
        const rolesString = elemento.getAttribute('data-roles');
        if (!rolesString) return;

        const rolesPermitidos = rolesString.split(',').map(r => r.trim().toUpperCase());

        if (!rolesPermitidos.includes(rolMayuscula)) {
            elemento.style.display = 'none';
        }
    });
}