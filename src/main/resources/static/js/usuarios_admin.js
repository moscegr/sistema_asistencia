/**
 * Gestión de Usuarios Administrativos - CBTis 134
 */

let editUserUID = null; // Usaremos el UID (ID del doc) para la edición

document.addEventListener('DOMContentLoaded', () => {
    listarUsuarios();

    // --- MAGIA SIN TOCAR HTML: Interceptar cuando se abre el modal ---
    const modalElement = document.getElementById('modalNuevoUsuario');
    if (modalElement) {
        modalElement.addEventListener('show.bs.modal', function (event) {
            // Verificamos si el modal se abrió por el botón "Registrar Nuevo" o por la función "prepararEdicion"
            // Si editUserUID es nulo, significa que vamos a Crear uno nuevo.
            if (!editUserUID) {
                // 1. Limpiamos el formulario
                document.getElementById('formNuevoUsuario').reset();
                
                // 2. Restauramos los campos (quitamos bloqueos de la edición pasada)
                document.getElementById('regCorreo').readOnly = false;
                document.getElementById('regPassword').parentElement.style.display = 'block';
                
                // 3. Restauramos títulos y botones a su estado original
                document.querySelector('#modalNuevoUsuario .modal-title').innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Registrar Personal';
                const btnSave = document.querySelector('#modalNuevoUsuario .btn-guinda');
                btnSave.innerHTML = '<i class="bi bi-save me-2"></i>Guardar Usuario';
                
                // 4. Asignamos la función correcta
                btnSave.onclick = crearUsuarioFirestore;
            }
        });

        // Limpiar la variable cuando se cierra el modal para evitar bugs en la próxima apertura
        modalElement.addEventListener('hidden.bs.modal', function () {
            editUserUID = null;
        });
    }
});

// 1. LEER (READ): Sincronización en tiempo real con Firestore
function listarUsuarios() {
    db.collection("usuarios").onSnapshot((snapshot) => {
        const tbody = document.getElementById('tablaUsuariosBody');
        if (!tbody) return;
        tbody.innerHTML = "";

        const coloresRoles = {
            'ADMIN': 'bg-guinda text-white',
            'PREFECTO': 'bg-primary text-white',
            'ORIENTACION': 'bg-info text-dark',
            'GUARDIA': 'bg-secondary text-white'
        };

        snapshot.forEach((doc) => {
            const user = doc.data();
            const idDoc = doc.id; // Esto asume que el ID es el UID
            
            const rolKey = (user.rol || "").toUpperCase();
            const badgeClass = coloresRoles[rolKey] || 'bg-dark text-white';
            const estatusClass = user.estatus === 'Activo' ? 'text-success' : 'text-danger';

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4">
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle me-3 bg-light text-guinda fw-bold d-flex align-items-center justify-content-center" 
                                 style="width: 35px; height: 35px; border-radius: 50%; border: 1px solid #7b1b37; color: #7b1b37;">
                                ${user.nombre ? user.nombre.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                                <span class="d-block fw-bold">${user.nombre}</span>
                            </div>
                        </div>
                    </td>
                    <td><small class="text-muted">${user.correo || idDoc}</small></td>
                    <td><span class="badge ${badgeClass} rounded-pill shadow-sm">${rolKey}</span></td>
                    <td>
                        <div class="form-check form-switch">
                            <input class="form-check-input shadow-none" type="checkbox" 
                                   ${user.estatus === 'Activo' ? 'checked' : ''} 
                                   onchange="toggleEstatusUsuario('${idDoc}', this.checked)">
                            <label class="small ${estatusClass} fw-bold ms-1">${user.estatus || 'Activo'}</label>
                        </div>
                    </td>
                    <td class="text-center">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary border-0" onclick="prepararEdicion('${idDoc}')" title="Editar">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarUsuario('${idDoc}')" title="Eliminar">
                                <i class="bi bi-trash3-fill"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    });
}

// 2. CREAR (CREATE): Registro de nuevo personal con Firebase Auth
async function crearUsuarioFirestore() {
    const nombre = document.getElementById('regNombre').value.trim();
    const correo = document.getElementById('regCorreo').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const rol = document.getElementById('regRol').value;

    if (!nombre || !correo || !password || !rol) {
        return Swal.fire("Campos Incompletos", "Llena todos los datos.", "warning");
    }

    try {
        Swal.fire({ title: 'Creando cuenta...', didOpen: () => Swal.showLoading() });

        const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
        
        const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(correo, password);
        const newUser = userCredential.user;

        await db.collection("usuarios").doc(newUser.uid).set({
            nombre: nombre,
            correo: correo,
            rol: rol,
            uid: newUser.uid,
            estatus: "Activo",
            fecha_registro: firebase.firestore.FieldValue.serverTimestamp()
        });

        await secondaryApp.auth().signOut();
        await secondaryApp.delete();

        Swal.fire("Éxito", `Usuario ${nombre} creado. Contraseña: ${password}`, "success");
        
        // Limpiamos y cerramos
        document.getElementById('formNuevoUsuario').reset();
        bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario')).hide();

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo crear: " + error.message, "error");
    }
}

// 3. ACTUALIZAR (UPDATE): Preparar modal para edición
async function prepararEdicion(id) {
    try {
        const doc = await db.collection("usuarios").doc(id).get();
        if (!doc.exists) return;

        const u = doc.data();
        editUserUID = id; // Declaramos que estamos en modo edición

        document.getElementById('regNombre').value = u.nombre;
        document.getElementById('regCorreo').value = u.correo;
        document.getElementById('regRol').value = u.rol;

        // Bloqueamos correo y ocultamos contraseña
        document.getElementById('regCorreo').readOnly = true;
        document.getElementById('regPassword').parentElement.style.display = 'none';

        // Modificamos el modal visualmente
        const modalTitle = document.querySelector('#modalNuevoUsuario .modal-title');
        const saveBtn = document.querySelector('#modalNuevoUsuario .btn-guinda');
        
        modalTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Personal';
        saveBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Actualizar Datos';
        saveBtn.onclick = actualizarUsuarioExistente;

        // Mostramos el modal manualmente
        const myModal = new bootstrap.Modal(document.getElementById('modalNuevoUsuario'));
        myModal.show();

    } catch (e) {
        console.error("Error al preparar edición:", e);
    }
}

// 3.1 ACTUALIZAR (UPDATE): Guardar cambios editados
async function actualizarUsuarioExistente() {
    const nombre = document.getElementById('regNombre').value.trim();
    const rol = document.getElementById('regRol').value;

    try {
        Swal.fire({ title: 'Actualizando...', didOpen: () => Swal.showLoading() });

        await db.collection("usuarios").doc(editUserUID).update({
            nombre: nombre,
            rol: rol,
            ultima_edicion: firebase.firestore.FieldValue.serverTimestamp()
        });

        Swal.fire("Éxito", "Usuario actualizado correctamente.", "success");
        
        // Cerramos el modal
        bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario')).hide();
    } catch (e) {
        Swal.fire("Error", "No se pudo actualizar.", "error");
    }
}

// 4. CAMBIAR ESTATUS
async function toggleEstatusUsuario(id, activo) {
    const nuevoEstatus = activo ? "Activo" : "Inactivo";
    try {
        await db.collection("usuarios").doc(id).update({ estatus: nuevoEstatus });
    } catch (e) {
        Swal.fire("Error", "No se pudo cambiar el estatus del usuario.", "error");
    }
}

// 5. BORRAR (DELETE)
function eliminarUsuario(id) {
    Swal.fire({
        title: '¿Eliminar cuenta?',
        text: `Se borrará el perfil de ${id}. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await db.collection("usuarios").doc(id).delete();
                Swal.fire("Eliminado", "El usuario ha sido removido del sistema.", "success");
            } catch (e) {
                Swal.fire("Error", "No se pudo eliminar el registro.", "error");
            }
        }
    });
}