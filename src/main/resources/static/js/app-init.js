// static/js/app-init.js
// Sincronización de sesión y perfil desde Spring Security & MongoDB API REST

document.addEventListener("DOMContentLoaded", () => {
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
            actualizarEncabezadoUsuario(nombreReal, rolReal);
        }
    } catch (e) {
        console.error("Error al sincronizar sesión de usuario:", e);
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
