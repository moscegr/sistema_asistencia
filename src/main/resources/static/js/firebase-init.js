// static/js/firebase-init.js
// Intelligent REST-backed compatibility layer for MongoDB & Spring Security

window.rolUsuarioActual = (localStorage.getItem('userRole') || 'ADMIN').toUpperCase();
window.usuarioActual = { email: localStorage.getItem('userName') || 'admin@cbtis134.edu.mx' };

window.db = window.db || {
    collection: function(colName) {
        return {
            doc: function(docId) {
                return {
                    get: async () => {
                        try {
                            if (colName === "configuracion") {
                                const res = await fetch(`/api/configuracion/${docId}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    return { exists: true, id: docId, data: () => data };
                                }
                            }
                            if (colName === "alumnos") {
                                const res = await fetch(`/api/alumnos/ncontrol/${docId}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    return { exists: true, id: docId, data: () => data };
                                }
                            }
                            if (colName === "usuarios") {
                                const res = await fetch(`/api/usuarios/${docId}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    return { exists: true, id: docId, data: () => data };
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        return { exists: false, data: () => ({}) };
                    },
                    set: async (datos) => {
                        if (colName === "configuracion") {
                            await fetch(`/api/configuracion/${docId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(datos)
                            });
                        }
                    },
                    update: async (datos) => {
                        if (colName === "configuracion") {
                            await fetch(`/api/configuracion/${docId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(datos)
                            });
                        }
                    },
                    delete: async () => {},
                    onSnapshot: async (cb) => {
                        try {
                            if (colName === "configuracion") {
                                const res = await fetch(`/api/configuracion/${docId}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    if (typeof cb === 'function') cb({ exists: true, id: docId, data: () => data });
                                }
                            }
                        } catch (e) {}
                    }
                };
            },
            where: function() { return this; },
            orderBy: function() { return this; },
            get: async () => {
                try {
                    let url = `/api/${colName}`;
                    if (colName === 'alumnos') url = '/api/alumnos';
                    if (colName === 'usuarios') url = '/api/usuarios';
                    if (colName === 'pases_salida') url = '/api/pases';
                    if (colName === 'justificantes') url = '/api/justificantes';
                    if (colName === 'incidencias') url = '/api/incidencias';

                    const res = await fetch(url);
                    if (res.ok) {
                        const items = await res.json();
                        const docs = items.map(item => ({
                            id: item.id || item._id || item.ncontrol || item.matricula || item.uid,
                            data: () => item,
                            ref: { update: async () => {} }
                        }));
                        return {
                            size: docs.length,
                            empty: docs.length === 0,
                            docs: docs,
                            forEach: (cb) => docs.forEach(cb)
                        };
                    }
                } catch (e) {}
                return { size: 0, empty: true, docs: [], forEach: () => {} };
            },
            onSnapshot: async (cb) => {
                try {
                    let url = `/api/${colName}`;
                    if (colName === 'alumnos') url = '/api/alumnos';
                    if (colName === 'usuarios') url = '/api/usuarios';
                    if (colName === 'pases_salida') url = '/api/pases';
                    if (colName === 'justificantes') url = '/api/justificantes';

                    const res = await fetch(url);
                    if (res.ok) {
                        const items = await res.json();
                        const docs = items.map(item => ({
                            id: item.id || item._id || item.ncontrol || item.matricula || item.uid,
                            data: () => item
                        }));
                        if (typeof cb === 'function') {
                            cb({
                                size: docs.length,
                                empty: docs.length === 0,
                                docs: docs,
                                forEach: (fn) => docs.forEach(fn)
                            });
                        }
                    }
                } catch (e) {}
            },
            add: async (data) => {
                try {
                    let url = `/api/${colName}`;
                    if (colName === 'pases_salida') url = '/api/pases';
                    if (colName === 'justificantes') url = '/api/justificantes';
                    if (colName === 'incidencias') url = '/api/incidencias';

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (res.ok) {
                        const saved = await res.json();
                        return { id: saved.id || saved._id || 'ok' };
                    }
                } catch (e) {}
                return { id: 'ok' };
            }
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