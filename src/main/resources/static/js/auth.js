document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            const nom = data.nombre_plantel || 'CBTis 134';
            const nomOficial = data.nombre_oficial_plantel || 'CENTRO DE BACHILLERATO TECNOLÓGICO INDUSTRIAL Y DE SERVICIOS NO. 134';
            const slogan = data.slogan_plantel || '"POR QUE PRESTIGIO SE GANA CON ESFUERZO... SOMOS CBTIS 134"';
            const logoPlantel = data.logo_plantel_url || '/img/logo-cbtis.png';
            const logoInicio = data.logo_inicio_url || '/img/logo.png';

            document.title = `${nom} - Iniciar Sesión`;

            const imgPlantel = document.getElementById('loginLogoPlantel');
            if (imgPlantel) imgPlantel.src = logoPlantel;

            const lblNombre = document.getElementById('loginNombrePlantel');
            if (lblNombre) lblNombre.innerText = nom;

            const lblSlogan = document.getElementById('loginSloganPlantel');
            if (lblSlogan) lblSlogan.innerText = slogan;

            const imgInicio = document.getElementById('loginLogoInicio');
            if (imgInicio) imgInicio.src = logoInicio;

            const imgLoader = document.getElementById('loaderLogo');
            if (imgLoader) imgLoader.src = logoInicio;

            const descPlantel = document.getElementById('loginDescripcionPlantel');
            if (descPlantel) {
                descPlantel.innerText = `SISTEMA DE CONTROL DE ACCESO INTELIGENTE Y GESTIÓN COMPLEMENTARIA DEL ALUMNADO EN ${nomOficial.toUpperCase()}`;
            }
        }
    } catch (e) {
        console.warn("No se pudo cargar la configuración de marca en login:", e);
    }
});

// Toggle mostrar/ocultar contraseña
const togglePasswordBtn = document.getElementById('togglePassword');
if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
        const passwordInput = document.getElementById('password');
        const icon = document.getElementById('togglePasswordIcon');
        if (passwordInput && icon) {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            icon.classList.toggle('bi-eye', !isPassword);
            icon.classList.toggle('bi-eye-slash', isPassword);
        }
    });
}

const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        const emailVal = document.getElementById('email').value.trim();
        const passwordVal = document.getElementById('password').value;

        if (!emailVal || !passwordVal) {
            e.preventDefault();
            return Swal.fire("Campos vacíos", "Por favor, ingresa correo y contraseña.", "warning");
        }

        const loader = document.getElementById('loader-overlay');
        const lblRol = document.getElementById('lbl-rol-destino');
        const txtSecundario = document.getElementById('loader-texto-secundario');

        if (lblRol) lblRol.innerText = "CREDENCIALES..."; 
        if (txtSecundario) txtSecundario.innerText = "Verificando sesión en el servidor...";

        if (loader) {
            loader.classList.remove('d-none');
            setTimeout(() => { loader.classList.add('active'); }, 10);
        }

        localStorage.setItem('userEmail', emailVal);
        localStorage.setItem('userName', emailVal);
    });
}

function recuperarPassword(e) {
    if(e) e.preventDefault(); 
    Swal.fire({
        title: 'Restablecer Contraseña',
        text: "Contacta al administrador principal del plantel (admin@admin.edu.mx) para gestionar el restablecimiento de tu acceso.",
        icon: 'info',
        confirmButtonColor: '#7b1b37'
    });
}