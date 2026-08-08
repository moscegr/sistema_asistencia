// static/js/firebase-init.js
// Safe compatibility shim for MongoDB & Spring Security

window.db = window.db || {
    collection: function(colName) {
        return {
            doc: function(docId) {
                return {
                    get: async () => ({ exists: false, data: () => ({}) }),
                    set: async () => {},
                    update: async () => {},
                    delete: async () => {},
                    onSnapshot: (cb) => {}
                };
            },
            where: function() { return this; },
            orderBy: function() { return this; },
            get: async () => ({ size: 0, empty: true, docs: [], forEach: () => {} }),
            onSnapshot: (cb) => {},
            add: async () => ({ id: 'mock' })
        };
    },
    batch: function() {
        return {
            update: () => {},
            set: () => {},
            delete: () => {},
            commit: async () => {}
        };
    }
};

window.auth = window.auth || {
    currentUser: { uid: 'admin_local', email: localStorage.getItem('userName') || 'admin@cbtis134.edu.mx' },
    onAuthStateChanged: function(cb) {
        const user = { uid: 'admin_local', email: localStorage.getItem('userName') || 'admin@cbtis134.edu.mx' };
        if (typeof cb === 'function') cb(user);
    },
    signOut: async function() {
        localStorage.clear();
        window.location.href = '/logout';
    }
};

window.firebase = window.firebase || {
    auth: () => window.auth,
    firestore: () => window.db,
    apps: [1]
};
window.firebase.firestore = window.firebase.firestore || (() => window.db);
window.firebase.firestore.FieldValue = {
    serverTimestamp: () => new Date().toISOString(),
    arrayUnion: (item) => item,
    arrayRemove: (item) => item,
    delete: () => null
};

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