// static/js/auth.js
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

        lblRol.innerText = "CREDENCIALES..."; 
        if(txtSecundario) txtSecundario.innerText = "Verificando conexión segura con el servidor";

        loader.classList.remove('d-none');
        setTimeout(() => { loader.classList.add('active'); }, 10);

        try {

            const userCredential = await firebase.auth().signInWithEmailAndPassword(emailVal, passwordVal);
            const user = userCredential.user;
            const userDoc = await db.collection("usuarios").doc(user.uid).get();

            if (userDoc.exists) {
                const userData = userDoc.data();

                if (userData.estatus !== 'Activo') {

                    loader.classList.remove('active');
                    setTimeout(() => { loader.classList.add('d-none'); }, 500);
                    await firebase.auth().signOut();
                    return Swal.fire("Acceso Suspendido", "Tu cuenta administrativa ha sido desactivada.", "error");
                }

                const rolLimpio = userData.rol.toLowerCase();
                localStorage.setItem('userRole', rolLimpio);
                localStorage.setItem('userName', userData.nombre);
				
                const idToken = await user.getIdToken();
                document.cookie = `AuthToken=${idToken}; path=/; max-age=3600; SameSite=Strict`;
				
				const lblSaludo = document.getElementById('lbl-saludo-usuario');
				const lblRol = document.getElementById('lbl-rol-destino');
				const txtSecundario = document.getElementById('loader-texto-secundario');

				lblSaludo.innerText = `¡Hola, ${userData.nombre}!`;
				lblSaludo.style.display = 'block';

				lblRol.innerText = userData.rol.toUpperCase();
				if(txtSecundario) txtSecundario.innerText = "Configurando tus accesos y herramientas...";

				const rutas = {
				   'admin': '/admin/dashboard',
				   'prefecto': '/admin/dashboard',
				   'orientacion': '/admin/dashboard',
				   'guardia': '/admin/escaneo'
				   };
				const rutaDestino = rutas[rolLimpio] || '/login';

				setTimeout(() => {
				   window.location.href = rutaDestino;
				}, 1500);

            } else {
                loader.classList.remove('active');
                setTimeout(() => { loader.classList.add('d-none'); }, 500);
                await firebase.auth().signOut();
                Swal.fire("Acceso Denegado", "No tienes un perfil configurado en la base de datos.", "error");
            }

        } catch (error) {

            loader.classList.remove('active');
            setTimeout(() => { loader.classList.add('d-none'); }, 500);

            console.error("Error completo de Firebase:", error);
            let mensaje = "Error de conexión o datos incorrectos.";
            if (error.code === 'auth/wrong-password') mensaje = "Contraseña incorrecta.";
            if (error.code === 'auth/user-not-found') mensaje = "El usuario no existe.";
            
            Swal.fire("Error", mensaje, "error");
        }
    });
}

/**
 * Envía un correo de recuperación de contraseña a través de Firebase Auth
 */
async function recuperarPassword(e) {
    if(e) e.preventDefault(); 

    const emailInput = document.getElementById('email') ? document.getElementById('email').value.trim() : "";

    const { value: email } = await Swal.fire({
        title: 'Restablecer Contraseña',
        text: "Te enviaremos un enlace a tu correo institucional para cambiar tu clave.",
        input: 'email',
        inputLabel: 'Correo Electrónico',
        inputValue: emailInput, 
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        confirmButtonText: 'Enviar enlace',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) return '¡Es necesario el correo para continuar!';
        }
    });

    if (email) {
        try {
            Swal.fire({ title: 'Enviando correo...', didOpen: () => Swal.showLoading() });
            
            await firebase.auth().sendPasswordResetEmail(email);

            Swal.fire({
                icon: 'success',
                title: '¡Correo Enviado!',
                text: 'Revisa tu bandeja de entrada (y la carpeta de spam) para completar el proceso.',
                confirmButtonColor: '#7b1b37'
            });

        } catch (error) {
            let mensaje = "No se pudo enviar el correo de recuperación.";
            if (error.code === 'auth/user-not-found') {
                mensaje = "Ese correo no está registrado en el sistema.";
            }
            Swal.fire("Error", mensaje, "error");
        }
    }
}