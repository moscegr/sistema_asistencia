/**
 * Gestión de Usuarios Administrativos - CBTis 134 (MongoDB REST API)
 */

let editUserUID = null;

document.addEventListener('DOMContentLoaded', () => {
    listarUsuarios();

    const modalElement = document.getElementById('modalNuevoUsuario');
    if (modalElement) {
        modalElement.addEventListener('show.bs.modal', function (event) {
            if (!editUserUID) {
                document.getElementById('formNuevoUsuario').reset();
                
                document.getElementById('regCorreo').readOnly = false;
                document.getElementById('regPassword').parentElement.style.display = 'block';
                
                document.querySelector('#modalNuevoUsuario .modal-title').innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Registrar Personal';
                const btnSave = document.querySelector('#modalNuevoUsuario .btn-guinda');
                btnSave.innerHTML = '<i class="bi bi-save me-2"></i>Guardar Usuario';
                
                btnSave.onclick = crearUsuario;
            }
        });

        modalElement.addEventListener('hidden.bs.modal', function () {
            editUserUID = null;
        });
    }
});

// 1. LEER (READ): Cargar lista desde /api/usuarios
async function listarUsuarios() {
    try {
        const response = await fetch('/api/usuarios');
        if (!response.ok) return;
        const usuarios = await response.json();

        const tbody = document.getElementById('tablaUsuariosBody');
        if (!tbody) return;
        tbody.innerHTML = "";

        const coloresRoles = {
            'ADMIN': 'bg-guinda text-white',
            'PREFECTO': 'bg-primary text-white',
            'ORIENTACION': 'bg-info text-dark',
            'GUARDIA': 'bg-secondary text-white'
        };

        usuarios.forEach((user) => {
            const idDoc = user.id || user.uid;
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
    } catch (e) {
        console.error("Error al cargar usuarios:", e);
    }
}

// 2. CREAR (CREATE): POST /api/usuarios
async function crearUsuario() {
    const nombre = document.getElementById('regNombre').value.trim();
    const correo = document.getElementById('regCorreo').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const rol = document.getElementById('regRol').value;

    if (!nombre || !correo || !password || !rol) {
        return Swal.fire("Campos Incompletos", "Llena todos los datos.", "warning");
    }

    try {
        Swal.fire({ title: 'Creando cuenta...', didOpen: () => Swal.showLoading() });

        const res = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, password, rol, estatus: 'Activo' })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "No se pudo crear el usuario");
        }

        Swal.fire("Éxito", `Usuario ${nombre} creado correctamente.`, "success");
        
        document.getElementById('formNuevoUsuario').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario'));
        if (modal) modal.hide();
        listarUsuarios();

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo crear: " + error.message, "error");
    }
}

// 3. ACTUALIZAR (UPDATE): Preparar modal para edición
async function prepararEdicion(id) {
    try {
        const res = await fetch(`/api/usuarios/${id}`);
        if (!res.ok) return;

        const u = await res.json();
        editUserUID = u.id || u.uid;

        document.getElementById('regNombre').value = u.nombre;
        document.getElementById('regCorreo').value = u.correo;
        document.getElementById('regRol').value = u.rol;

        document.getElementById('regCorreo').readOnly = true;
        document.getElementById('regPassword').parentElement.style.display = 'none';

        const modalTitle = document.querySelector('#modalNuevoUsuario .modal-title');
        const saveBtn = document.querySelector('#modalNuevoUsuario .btn-guinda');
        
        modalTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Personal';
        saveBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Actualizar Datos';
        saveBtn.onclick = actualizarUsuarioExistente;

        const myModal = new bootstrap.Modal(document.getElementById('modalNuevoUsuario'));
        myModal.show();

    } catch (e) {
        console.error("Error al preparar edición:", e);
    }
}

// 3.1 ACTUALIZAR (UPDATE): PUT /api/usuarios/{id}
async function actualizarUsuarioExistente() {
    const nombre = document.getElementById('regNombre').value.trim();
    const rol = document.getElementById('regRol').value;

    try {
        Swal.fire({ title: 'Actualizando...', didOpen: () => Swal.showLoading() });

        const res = await fetch(`/api/usuarios/${editUserUID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, rol })
        });

        if (!res.ok) throw new Error("Error al actualizar");

        Swal.fire("Éxito", "Usuario actualizado correctamente.", "success");
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario'));
        if (modal) modal.hide();
        listarUsuarios();
    } catch (e) {
        Swal.fire("Error", "No se pudo actualizar.", "error");
    }
}

// 4. CAMBIAR ESTATUS
async function toggleEstatusUsuario(id, activo) {
    const nuevoEstatus = activo ? "Activo" : "Inactivo";
    try {
        await fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estatus: nuevoEstatus })
        });
        listarUsuarios();
    } catch (e) {
        Swal.fire("Error", "No se pudo cambiar el estatus del usuario.", "error");
    }
}

// 5. BORRAR (DELETE): DELETE /api/usuarios/{id}
function eliminarUsuario(id) {
    Swal.fire({
        title: '¿Eliminar cuenta?',
        text: `Se borrará el perfil del usuario. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("Error al eliminar");
                Swal.fire("Eliminado", "El usuario ha sido removido del sistema.", "success");
                listarUsuarios();
            } catch (e) {
                Swal.fire("Error", "No se pudo eliminar el registro.", "error");
            }
        }
    });
}