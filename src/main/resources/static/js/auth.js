const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailVal = document.getElementById('email').value.trim();
        const passwordVal = document.getElementById('password').value;

        if (!emailVal || !passwordVal) {
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

        try {
            const formData = new URLSearchParams();
            formData.append('username', emailVal);
            formData.append('password', passwordVal);

            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData,
                redirect: 'follow'
            });

            if (response.redirected && response.url.includes('/login?error')) {
                if (loader) {
                    loader.classList.remove('active');
                    setTimeout(() => { loader.classList.add('d-none'); }, 500);
                }
                return Swal.fire("Acceso Denegado", "Correo o contraseña incorrectos.", "error");
            }

            if (response.ok) {
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('userName', emailVal);

                const lblSaludo = document.getElementById('lbl-saludo-usuario');
                if (lblSaludo) {
                    lblSaludo.innerText = `¡Bienvenido!`;
                    lblSaludo.style.display = 'block';
                }

                if (lblRol) lblRol.innerText = "ADMINISTRADOR";
                if (txtSecundario) txtSecundario.innerText = "Accediendo al panel escolar...";

                setTimeout(() => {
                    window.location.href = response.url || '/admin/dashboard';
                }, 1000);
            } else {
                if (loader) {
                    loader.classList.remove('active');
                    setTimeout(() => { loader.classList.add('d-none'); }, 500);
                }
                Swal.fire("Acceso Denegado", "No se pudo iniciar sesión. Verifica tus credenciales.", "error");
            }

        } catch (error) {
            if (loader) {
                loader.classList.remove('active');
                setTimeout(() => { loader.classList.add('d-none'); }, 500);
            }
            console.error("Error de autenticación:", error);
            Swal.fire("Error de Conexión", "No se pudo conectar con el servidor.", "error");
        }
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