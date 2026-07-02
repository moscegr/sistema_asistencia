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

const firebaseConfig = {
    apiKey: "AIzaSyAzxAZhm5UC8RhSbs_pTURwP2qRIlix8ww",
    authDomain: "cbtis134-37029.firebaseapp.com",
    projectId: "cbtis134-37029",
    storageBucket: "cbtis134-37029.firebasestorage.app",
    messagingSenderId: "113128399234",
    appId: "1:113128399234:web:43f375ea15675ba4df6f9b"
};

// Inicialización única
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}


const db = firebase.firestore();
const auth = firebase.auth();

let rolUsuarioActual = null;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const docUsuario = await db.collection("usuarios").doc(user.uid).get();
            if (docUsuario.exists) {
                rolUsuarioActual = docUsuario.data().rol;
                const rolMayus = rolUsuarioActual.toUpperCase();

                aplicarPermisosVisuales(rolUsuarioActual);

                protegerRutasCentralizado(rolMayus);
            } else {
                window.location.href = "/login";
            }
        } catch (error) {
            console.error("Error al obtener perfil:", error);
        }
    } else {

        if (window.location.pathname !== '/login') {
            window.location.href = "/login";
        }
    }
});

function protegerRutasCentralizado(rol) {
    const path = window.location.pathname;

    const reglasDeAcceso = {
        '/admin/dashboard': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        
        // Gestión -> Alumnos
        '/admin/alumnos': ['ADMIN'],
        '/admin/alumnos/nuevo': ['ADMIN'],
        '/admin/alumnos/gestion-archivos': ['ADMIN'],
        '/admin/alumnos/credenciales': ['ADMIN'],
        '/admin/alumnos/expediente': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/alumnos/seguimiento-conductual': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        '/admin/alumnos/monitoreo-salud': ['ADMIN', 'PREFECTO', 'ORIENTACION'],
        
        // Gestión -> Administrativos
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

    else if (path !== '/login' && path !== '/') {
        console.warn(`RUTA DESCONOCIDA O NO REGISTRADA: ${path}`);
        window.location.href = '/admin/dashboard';
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