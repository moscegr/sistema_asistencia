// static/js/app-init.js
// Sincronización global de sesión, perfil e identidad institucional (MongoDB API REST)

document.addEventListener("DOMContentLoaded", () => {
    // Renderizado inmediato desde caché local para 0ms de retardo visual
    const cachedName = localStorage.getItem('userName');
    const cachedRole = localStorage.getItem('userRole');
    const cachedFoto = localStorage.getItem('userFotoUrl');
    if (cachedName) {
        actualizarEncabezadoUsuario(cachedName, cachedRole, cachedFoto);
    }

    const cachedCfg = sessionStorage.getItem('cfg_sistema');
    if (cachedCfg) {
        try {
            const data = JSON.parse(cachedCfg);
            window.cfgSistemaGlobal = data;
            aplicarConfiguracionInstitucionalUI(data);
        } catch (e) {}
    }

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
            const fotoReal = user.fotoUrl || '';

            localStorage.setItem('userRole', rolReal);
            localStorage.setItem('userName', nombreReal);
            localStorage.setItem('userEmail', user.correo || '');
            if (fotoReal) {
                localStorage.setItem('userFotoUrl', fotoReal);
            } else {
                localStorage.removeItem('userFotoUrl');
            }

            window.rolUsuarioActual = rolReal;
            actualizarEncabezadoUsuario(nombreReal, rolReal, fotoReal);
        }
    } catch (e) {
        console.error("Error al sincronizar sesión de usuario:", e);
    }
}

function aplicarConfiguracionInstitucionalUI(data) {
    if (!data) return;
    const nomPlantel = data.nombre_plantel || 'Control Escolar';
    const nomOficial = data.nombre_oficial_plantel || 'CENTRO DE BACHILLERATO TECNOLÓGICO INDUSTRIAL Y DE SERVICIOS';
    const slogan = data.slogan_plantel || '';
    const logoPlantel = data.logo_plantel_url || '/img/logo_aniversario.jpg';
    const logoInicio = data.logo_inicio_url || '/img/tigres.png';

    // Actualizar título del documento si contiene referencias al plantel anterior
    if (document.title.includes('CBTis 134') && nomPlantel !== 'CBTis 134') {
        document.title = document.title.replace(/CBTis 134/g, nomPlantel);
    }

    // Actualizar logotipos
    document.querySelectorAll('.img-logo-plantel, #logoPlantelHeader, #sidebarLogo, .sidebar-logo, .navbar-logo').forEach(img => {
        if (img.tagName === 'IMG') {
            img.onerror = () => { img.onerror = null; img.src = '/img/logo_aniversario.jpg'; };
            if (img.src !== logoPlantel) img.src = logoPlantel;
        }
    });

    document.querySelectorAll('.img-logo-inicio, #headerMascotaLogo, img[src*="tigres.png"]').forEach(img => {
        if (img.tagName === 'IMG') {
            img.onerror = () => { img.onerror = null; img.src = '/img/tigres.png'; };
            if (img.src !== logoInicio) img.src = logoInicio;
        }
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

    const dirPlantel = data.direccion_plantel || '';
    const cdPlantel = data.ciudad_plantel || (dirPlantel ? dirPlantel.split(',').slice(-2).join(',').trim() : '');

    document.querySelectorAll('.direccion-plantel, .plantel-direccion, .domicilio-plantel').forEach(el => {
        if (dirPlantel) el.innerText = dirPlantel;
    });

    document.querySelectorAll('.ciudad-plantel, .plantel-ciudad').forEach(el => {
        if (cdPlantel) el.innerText = cdPlantel;
    });

    const climaUbicacion = document.getElementById('climaUbicacion');
    if (climaUbicacion && (cdPlantel || dirPlantel)) {
        climaUbicacion.innerText = cdPlantel || dirPlantel;
    }
}
window.aplicarConfiguracionInstitucionalUI = aplicarConfiguracionInstitucionalUI;

async function sincronizarDatosInstitucionalesGlobal() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            window.cfgSistemaGlobal = data;
            try {
                sessionStorage.setItem('cfg_sistema', JSON.stringify(data));
            } catch (e) {}
            aplicarConfiguracionInstitucionalUI(data);
        }

        // Sincronizar ciclo escolar en el sidebar
        const cachedCiclo = sessionStorage.getItem('ciclo_escolar_actual');
        if (cachedCiclo) {
            const sbCiclo = document.getElementById('sidebarCicloActual');
            if (sbCiclo) sbCiclo.innerText = cachedCiclo;
            const dispCiclo = document.getElementById('displayCicloActual');
            if (dispCiclo) dispCiclo.innerText = cachedCiclo;
        }

        const resCiclo = await fetch('/api/configuracion/ciclo_escolar');
        if (resCiclo.ok) {
            const cicloData = await resCiclo.json();
            if (cicloData.actual) {
                try {
                    sessionStorage.setItem('ciclo_escolar_actual', cicloData.actual);
                } catch (e) {}
                const sbCiclo = document.getElementById('sidebarCicloActual');
                if (sbCiclo) sbCiclo.innerText = cicloData.actual;
                const dispCiclo = document.getElementById('displayCicloActual');
                if (dispCiclo) dispCiclo.innerText = cicloData.actual;
            }
        }
    } catch (e) {
        console.error("Error al sincronizar datos institucionales:", e);
    }
}
window.sincronizarDatosInstitucionalesGlobal = sincronizarDatosInstitucionalesGlobal;

function actualizarEncabezadoUsuario(nombre, rol, fotoUrl) {
    const elName = document.getElementById('userName');
    const elBannerName = document.getElementById('userBannerName');
    const elBannerRole = document.getElementById('userBannerRole');
    const elBannerRol = document.getElementById('userBannerRol');

    if (elName) elName.innerText = nombre;
    if (elBannerName) elBannerName.innerText = nombre;
    if (elBannerRole) elBannerRole.innerText = `Rol: ${rol || 'SISTEMA'}`;
    if (elBannerRol) elBannerRol.innerText = rol || 'SISTEMA';

    const foto = fotoUrl || localStorage.getItem('userFotoUrl') || '';
    document.querySelectorAll('.welcome-avatar, #welcomeAvatarContainer').forEach(avatarEl => {
        if (foto && !foto.includes('default_avatar.png')) {
            avatarEl.innerHTML = `<img src="${foto}" alt="${nombre || 'Perfil'}" onerror="this.parentElement.innerHTML='<i class=&quot;bi bi-person-circle&quot;></i>'">`;
        } else {
            avatarEl.innerHTML = `<i class="bi bi-person-circle"></i>`;
        }
    });
}
window.actualizarEncabezadoUsuario = actualizarEncabezadoUsuario;
