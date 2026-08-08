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

        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userName', emailVal);
    });
}

function recuperarPassword(e) {
    if(e) e.preventDefault(); 
    Swal.fire({
        title: 'Restablecer Contraseña',
        text: "Contacta al administrador principal del plantel (koyer.pop@gmail.com) para gestionar el restablecimiento de tu acceso.",
        icon: 'info',
        confirmButtonColor: '#7b1b37'
    });
}