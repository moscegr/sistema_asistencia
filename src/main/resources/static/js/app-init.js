// static/js/app-init.js
// Sincronización global de sesión, perfil e identidad institucional (MongoDB API REST)

document.addEventListener("DOMContentLoaded", () => {
    sincronizarRolDesdeServidor();
    sincronizarDatosInstitucionalesGlobal();
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

async function sincronizarDatosInstitucionalesGlobal() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            window.cfgSistemaGlobal = data;

            const nomPlantel = data.nombre_plantel || 'CBTis 134';
            const nomOficial = data.nombre_oficial_plantel || 'CENTRO DE BACHILLERATO TECNOLÓGICO INDUSTRIAL Y DE SERVICIOS NO. 134';
            const slogan = data.slogan_plantel || '"POR QUE PRESTIGIO SE GANA CON ESFUERZO... SOMOS CBTIS 134"';
            const logoPlantel = data.logo_plantel_url || '/img/logo-cbtis.png';
            const logoInicio = data.logo_inicio_url || '/img/logo.png';

            // Actualizar título del documento si contiene referencias al plantel anterior
            if (document.title.includes('CBTis 134') && nomPlantel !== 'CBTis 134') {
                document.title = document.title.replace(/CBTis 134/g, nomPlantel);
            }

            // Actualizar logotipos
            document.querySelectorAll('.img-logo-plantel, #logoPlantelHeader, #sidebarLogo, img[src*="logo_aniversario"]').forEach(img => {
                if (img.tagName === 'IMG') img.src = logoPlantel;
            });

            document.querySelectorAll('.img-logo-inicio, #headerMascotaLogo, img[src*="tigres.png"]').forEach(img => {
                if (img.tagName === 'IMG') img.src = logoInicio;
            });

            // Actualizar textos del plantel
            const sbNombre = document.getElementById('sidebarNombrePlantel');
            if (sbNombre) sbNombre.innerText = nomPlantel;

            const sbSlogan = document.getElementById('sidebarSloganPlantel');
            if (sbSlogan) sbSlogan.innerText = slogan;

            document.querySelectorAll('.nombre-plantel, .plantel-nombre').forEach(el => {
                el.innerText = nomPlantel;
            });

            document.querySelectorAll('.nombre-oficial-plantel').forEach(el => {
                el.innerText = nomOficial;
            });

            document.querySelectorAll('.slogan-plantel').forEach(el => {
                el.innerText = slogan;
            });

            document.querySelectorAll('.director-plantel, .nombre-director').forEach(el => {
                if (data.nombre_director) el.innerText = data.nombre_director;
            });

            document.querySelectorAll('.cct-plantel, .cct-escuela').forEach(el => {
                if (data.cct_escuela) el.innerText = data.cct_escuela;
            });

            document.querySelectorAll('.telefono-plantel, .telefono-escuela').forEach(el => {
                if (data.telefono_escuela) el.innerText = data.telefono_escuela;
            });

            document.querySelectorAll('.jefe-personal').forEach(el => {
                if (data.jefe_personal) el.innerText = data.jefe_personal;
            });
        }

        // Sincronizar ciclo escolar en el sidebar
        const resCiclo = await fetch('/api/configuracion/ciclo_escolar');
        if (resCiclo.ok) {
            const cicloData = await resCiclo.json();
            const sbCiclo = document.getElementById('sidebarCicloActual');
            if (sbCiclo && cicloData.actual) {
                sbCiclo.innerText = cicloData.actual;
            }
            const dispCiclo = document.getElementById('displayCicloActual');
            if (dispCiclo && cicloData.actual) {
                dispCiclo.innerText = cicloData.actual;
            }
        }
    } catch (e) {
        console.error("Error al sincronizar datos institucionales:", e);
    }
}
window.sincronizarDatosInstitucionalesGlobal = sincronizarDatosInstitucionalesGlobal;

function actualizarEncabezadoUsuario(nombre, rol) {
    const elName = document.getElementById('userName');
    const elBannerName = document.getElementById('userBannerName');
    const elBannerRole = document.getElementById('userBannerRole');

    if (elName) elName.innerText = nombre;
    if (elBannerName) elBannerName.innerText = nombre;
    if (elBannerRole) elBannerRole.innerText = `Rol: ${rol || 'SISTEMA'}`;
}
