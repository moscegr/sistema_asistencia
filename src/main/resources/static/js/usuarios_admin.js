/**
 * Gestión de Docentes y Personal Administrativo - CBTis 134 (MongoDB REST API)
 */

let usuariosCache = [];
let editUserUID = null;
let fotoBase64Temporal = null;
let descriptorFacialTemporal = null;
let filtroRolActual = 'TODOS';
let datosExcelMasivoPendientes = [];
let cfgSistemaPersonal = {};

async function cargarConfiguracionSistemaPersonal() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            cfgSistemaPersonal = await res.json();
            window.cfgSistemaGlobal = cfgSistemaPersonal;
        }
    } catch (e) {
        console.warn("No se pudo cargar la configuración del sistema:", e);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionSistemaPersonal();
    listarUsuarios();
    inicializarModelosFacialesSilencioso();

    const modalElement = document.getElementById('modalNuevoUsuario');
    if (modalElement) {
        modalElement.addEventListener('show.bs.modal', function () {
            if (!editUserUID) {
                document.getElementById('formNuevoUsuario').reset();
                fotoBase64Temporal = null;
                descriptorFacialTemporal = null;
                document.getElementById('prevFotoUsuario').src = '/img/logo_aniversario.jpg';
                
                const lblPass = document.getElementById('lblRegPassword');
                const descPass = document.getElementById('descRegPassword');
                const regPass = document.getElementById('regPassword');
                
                if (lblPass) lblPass.innerText = 'Contraseña de Acceso a Plataforma';
                if (descPass) descPass.style.display = 'none';
                if (regPass) regPass.required = false;
                
                actualizarVisibilidadPassword();

                document.querySelector('#modalNuevoUsuario .modal-title').innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Registrar Personal / Docente';
                const btnSave = document.getElementById('btnGuardarUsuario');
                if (btnSave) {
                    btnSave.innerHTML = '<i class="bi bi-save me-2"></i>Guardar';
                }
            }
        });

        modalElement.addEventListener('hidden.bs.modal', function () {
            editUserUID = null;
            fotoBase64Temporal = null;
            descriptorFacialTemporal = null;
        });
    }
});

// Inicializar modelos face-api para auto-vectorizar al subir foto
async function inicializarModelosFacialesSilencioso() {
    try {
        if (typeof faceapi !== 'undefined' && !faceapi.nets.ssdMobilenetv1.isLoaded) {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/models')
            ]);
        }
    } catch(e) {
        console.warn("FaceAPI en carga silenciosa:", e);
    }
}

// 1. LEER (READ): Cargar lista desde /api/usuarios
async function listarUsuarios() {
    try {
        const response = await fetch('/api/usuarios');
        if (!response.ok) return;
        usuariosCache = await response.json();

        renderizarTablaUsuarios();
    } catch (e) {
        console.error("Error al cargar usuarios:", e);
    }
}

function cambiarFiltroRol(rol) {
    filtroRolActual = rol;
    
    ['btnFiltroTodos', 'btnFiltroDocentes', 'btnFiltroAdminis', 'btnFiltroPlataforma'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = 'btn btn-sm btn-outline-secondary';
    });

    if (rol === 'TODOS') document.getElementById('btnFiltroTodos').className = 'btn btn-sm btn-secondary active';
    else if (rol === 'DOCENTE') document.getElementById('btnFiltroDocentes').className = 'btn btn-sm btn-secondary active';
    else if (rol === 'ADMINISTRATIVO') document.getElementById('btnFiltroAdminis').className = 'btn btn-sm btn-secondary active';
    else if (rol === 'PLATAFORMA') document.getElementById('btnFiltroPlataforma').className = 'btn btn-sm btn-secondary active';

    renderizarTablaUsuarios();
}

function filtrarTablaUsuarios() {
    renderizarTablaUsuarios();
}

function renderizarTablaUsuarios() {
    const tbody = document.getElementById('tablaUsuariosBody');
    const contador = document.getElementById('contadorUsuarios');
    if (!tbody) return;

    tbody.innerHTML = "";

    const texto = (document.getElementById('filtroTexto')?.value || "").trim().toLowerCase();

    const filtrados = usuariosCache.filter(u => {
        const rol = (u.rol || "").toUpperCase();
        
        // Filtro por Rol
        if (filtroRolActual === 'DOCENTE' && rol !== 'DOCENTE') return false;
        if (filtroRolActual === 'ADMINISTRATIVO' && rol !== 'ADMINISTRATIVO') return false;
        if (filtroRolActual === 'PLATAFORMA' && (rol === 'DOCENTE' || rol === 'ADMINISTRATIVO')) return false;

        // Filtro por Texto
        if (texto) {
            const nom = (u.nombre || "").toLowerCase();
            const rfc = (u.rfc || "").toLowerCase();
            const cor = (u.correo || "").toLowerCase();
            const tel = (u.telefono || "").toLowerCase();
            return nom.includes(texto) || rfc.includes(texto) || cor.includes(texto) || tel.includes(texto);
        }
        return true;
    });

    if (contador) contador.innerText = filtrados.length;

    const coloresRoles = {
        'DOCENTE': 'badge-docente',
        'ADMINISTRATIVO': 'badge-adminis',
        'ADMIN': 'bg-guinda',
        'PREFECTO': 'bg-primary',
        'ORIENTACION': 'bg-info text-dark',
        'GUARDIA': 'bg-secondary text-white'
    };

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-muted small"><i class="bi bi-inbox me-1"></i>No se encontraron registros de personal o docentes.</td></tr>`;
        return;
    }

    filtrados.forEach((user) => {
        const idDoc = user.id || user.uid || user.correo;
        const rolKey = (user.rol || "").toUpperCase();
        const badgeClass = coloresRoles[rolKey] || 'bg-dark text-white';
        const estatusClass = user.estatus === 'Activo' ? 'text-success' : 'text-danger';
        const foto = user.fotoUrl || '/img/logo_aniversario.jpg';
        const rfc = user.rfc || '<span class="text-muted fst-italic">Sin RFC</span>';
        const turno = user.turno || 'Matutino';
        const presenciaBadge = user.estado === 'DENTRO' 
            ? '<span class="badge bg-success">DENTRO</span>' 
            : '<span class="badge bg-danger">FUERA</span>';

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 text-start">
                    <div class="d-flex align-items-center">
                        <img src="${foto}" class="rounded-circle me-3 border" style="width: 40px; height: 40px; object-fit: cover;">
                        <div>
                            <span class="d-block fw-bold text-dark">${user.nombre}</span>
                            <small class="text-muted">${user.correo || idDoc}</small>
                        </div>
                    </div>
                </td>
                <td><span class="font-monospace fw-bold text-dark small">${rfc}</span></td>
                <td><span class="badge ${badgeClass} rounded-pill shadow-sm">${rolKey}</span></td>
                <td><span class="badge bg-light text-dark border">${turno}</span></td>
                <td><small class="text-muted">${user.telefono || 'N/A'}</small></td>
                <td>${presenciaBadge}</td>
                <td>
                    <div class="form-check form-switch d-inline-block">
                        <input class="form-check-input shadow-none" type="checkbox" 
                               ${user.estatus === 'Activo' ? 'checked' : ''} 
                               onchange="toggleEstatusUsuario('${idDoc}', this.checked)">
                        <label class="small ${estatusClass} fw-bold ms-1">${user.estatus || 'Activo'}</label>
                    </div>
                </td>
                <td class="text-center pe-4">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-success border-0" onclick="enviarWhatsappPersonalPersonalizado('${idDoc}')" title="Enviar WhatsApp a Personal / Docente">
                            <i class="bi bi-whatsapp fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-guinda border-0" onclick="abrirModalGafeteCredencialPersonal('${idDoc}')" title="Generar Gafete y Credencial">
                            <i class="bi bi-person-badge fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary border-0" onclick="prepararEdicion('${idDoc}')" title="Editar">
                            <i class="bi bi-pencil-square fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarUsuario('${idDoc}')" title="Eliminar">
                            <i class="bi bi-trash3-fill fs-5"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
}

// 2. Control de visibilidad de contraseña según el Rol
function actualizarVisibilidadPassword() {
    const rol = document.getElementById('regRol')?.value || '';
    const seccionPass = document.getElementById('seccionPassword');
    const avisoDoc = document.getElementById('avisoDocenteSinPlataforma');
    const regPass = document.getElementById('regPassword');

    const esSinPlataforma = (rol === 'DOCENTE' || rol === 'ADMINISTRATIVO');

    if (esSinPlataforma) {
        if (seccionPass) seccionPass.style.display = 'none';
        if (avisoDoc) avisoDoc.style.display = 'block';
        if (regPass) regPass.required = false;
    } else {
        if (seccionPass) seccionPass.style.display = 'block';
        if (avisoDoc) avisoDoc.style.display = 'none';
        if (regPass && !editUserUID) regPass.required = true;
    }
}

// -------------------------------------------------------------
// 3. CAPTURA DE FOTOGRAFÍA (ARCHIVO Y WEBCAM)
// -------------------------------------------------------------
let streamWebcamPersonal = null;

async function abrirCamaraWebcamPersonal() {
    const video = document.getElementById('videoWebcamPersonal');
    const modalEl = document.getElementById('modalCamaraWebcamPersonal');
    if (!video || !modalEl) return;

    try {
        streamWebcamPersonal = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            }
        });
        video.srcObject = streamWebcamPersonal;
        await video.play();

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    } catch (err) {
        console.error("Error al iniciar cámara:", err);
        Swal.fire({
            icon: 'error',
            title: 'Cámara no disponible',
            text: 'No se pudo acceder a la webcam. Verifique los permisos de su navegador.',
            confirmButtonColor: '#7b1b37'
        });
    }
}

function cerrarCamaraWebcamPersonal() {
    if (streamWebcamPersonal) {
        streamWebcamPersonal.getTracks().forEach(t => t.stop());
        streamWebcamPersonal = null;
    }
    const video = document.getElementById('videoWebcamPersonal');
    if (video) video.srcObject = null;

    const modalEl = document.getElementById('modalCamaraWebcamPersonal');
    if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    }
}

async function capturarFotoWebcamPersonal() {
    const video = document.getElementById('videoWebcamPersonal');
    const canvas = document.getElementById('canvasWebcamPersonal');
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
    canvas.width = 400;
    canvas.height = 400;

    const sx = ((video.videoWidth || 480) - size) / 2;
    const sy = ((video.videoHeight || 480) - size) / 2;

    // Efecto espejo
    ctx.translate(400, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

    fotoBase64Temporal = canvas.toDataURL('image/jpeg', 0.92);
    document.getElementById('prevFotoUsuario').src = fotoBase64Temporal;
    
    const btnQuitar = document.getElementById('btnQuitarFotoPersonal');
    if (btnQuitar) btnQuitar.style.display = 'inline-block';

    cerrarCamaraWebcamPersonal();

    // Extraer vector biométrico FaceID en segundo plano
    try {
        if (typeof faceapi !== 'undefined' && faceapi.nets.ssdMobilenetv1.isLoaded) {
            const img = await faceapi.fetchImage(fotoBase64Temporal);
            const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (deteccion) {
                descriptorFacialTemporal = Array.from(deteccion.descriptor);
            }
        }
    } catch(e) {
        console.warn("Extracción facial webcam diferida:", e);
    }

    Swal.fire({
        icon: 'success',
        title: 'Foto Capturada',
        text: 'La fotografía se ha tomado y vinculado correctamente.',
        toast: true,
        position: 'bottom-end',
        timer: 2500,
        showConfirmButton: false
    });
}

async function eliminarFotoPersonal(confirmarBD = true) {
    const btnQuitar = document.getElementById('btnQuitarFotoPersonal');
    const inputFoto = document.getElementById('inputFotoUsuario');

    if (confirmarBD && editUserUID && fotoBase64Temporal && !fotoBase64Temporal.includes('logo_aniversario')) {
        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar foto de perfil?',
            text: 'Se eliminará la fotografía y el vector de FaceID de este usuario directamente de la base de datos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="bi bi-trash3-fill me-1"></i>Sí, eliminar de BD',
            cancelButtonText: 'Cancelar'
        });

        if (!isConfirmed) return;

        try {
            Swal.fire({ title: 'Eliminando foto de la base de datos...', didOpen: () => Swal.showLoading() });
            const res = await fetch(`/api/usuarios/${encodeURIComponent(editUserUID)}/foto`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errTxt = await res.text();
                throw new Error(errTxt || "Error al eliminar la foto");
            }

            fotoBase64Temporal = null;
            descriptorFacialTemporal = null;
            document.getElementById('prevFotoUsuario').src = '/img/logo_aniversario.jpg';
            if (inputFoto) inputFoto.value = '';
            if (btnQuitar) btnQuitar.style.display = 'none';

            Swal.fire({
                icon: 'success',
                title: 'Foto Eliminada',
                text: 'La fotografía de perfil se eliminó de la base de datos con éxito.',
                timer: 2000,
                showConfirmButton: false
            });

            listarUsuarios();
            return;
        } catch (err) {
            console.error(err);
            return Swal.fire("Error", "No se pudo eliminar la foto: " + err.message, "error");
        }
    }

    // Reset local
    fotoBase64Temporal = null;
    descriptorFacialTemporal = null;
    document.getElementById('prevFotoUsuario').src = '/img/logo_aniversario.jpg';
    if (inputFoto) inputFoto.value = '';
    if (btnQuitar) btnQuitar.style.display = 'none';
}
window.eliminarFotoPersonal = eliminarFotoPersonal;

async function procesarFotoUsuario(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        fotoBase64Temporal = e.target.result;
        document.getElementById('prevFotoUsuario').src = fotoBase64Temporal;
        
        const btnQuitar = document.getElementById('btnQuitarFotoPersonal');
        if (btnQuitar) btnQuitar.style.display = 'inline-block';

        try {
            if (typeof faceapi !== 'undefined' && faceapi.nets.ssdMobilenetv1.isLoaded) {
                const img = await faceapi.fetchImage(fotoBase64Temporal);
                const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                if (deteccion) {
                    descriptorFacialTemporal = Array.from(deteccion.descriptor);
                }
            }
        } catch(err) {
            console.warn("No se pudo extraer vector facial inmediatamente:", err);
        }
    };
    reader.readAsDataURL(file);
}

// 4. CREAR / ACTUALIZAR USUARIO
async function guardarUsuarioFormulario() {
    const nombre = document.getElementById('regNombre').value.trim().toUpperCase();
    const rfc = document.getElementById('regRfc').value.trim().toUpperCase();
    const rol = document.getElementById('regRol').value;
    const turno = document.getElementById('regTurno').value;
    const correo = document.getElementById('regCorreo').value.trim().toLowerCase();
    const telefono = document.getElementById('regTelefono').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!nombre || !rfc || !rol || !turno) {
        return Swal.fire("Campos Incompletos", "Por favor completa Nombre, RFC, Rol y Turno.", "warning");
    }

    const esSinPlataforma = (rol === 'DOCENTE' || rol === 'ADMINISTRATIVO');
    if (!esSinPlataforma && !editUserUID && (!password || password.length < 6)) {
        return Swal.fire("Contraseña Requerida", "Para roles con acceso a plataforma, la contraseña debe tener al menos 6 caracteres.", "warning");
    }

    const payload = {
        nombre,
        rfc,
        rol,
        turno,
        correo: correo || null,
        telefono: telefono || null,
        qrCode: rfc,
        estatus: 'Activo'
    };

    if (fotoBase64Temporal) {
        payload.fotoUrl = fotoBase64Temporal;
    } else if (editUserUID) {
        payload.fotoUrl = "";
        payload.descriptor_facial = [];
    }

    if (descriptorFacialTemporal) payload.descriptor_facial = descriptorFacialTemporal;

    if (!esSinPlataforma && password && password.trim() !== '') {
        payload.password = password;
    }

    try {
        Swal.fire({ title: 'Guardando datos...', didOpen: () => Swal.showLoading() });

        const url = editUserUID ? `/api/usuarios/${encodeURIComponent(editUserUID)}` : '/api/usuarios';
        const method = editUserUID ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Error al guardar el usuario");
        }

        Swal.fire("Éxito", `Registro de ${nombre} guardado correctamente.`, "success");
        
        document.getElementById('formNuevoUsuario').reset();
        eliminarFotoPersonal(false);
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario'));
        if (modal) modal.hide();
        listarUsuarios();

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo guardar: " + error.message, "error");
    }
}

// 5. PREPARAR EDICIÓN
async function prepararEdicion(id) {
    try {
        const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`);
        if (!res.ok) return;

        const u = await res.json();
        editUserUID = u.id || u.uid || u.correo;

        document.getElementById('regNombre').value = (u.nombre || '').toUpperCase();
        document.getElementById('regRfc').value = (u.rfc || '').toUpperCase();
        document.getElementById('regRol').value = u.rol || 'DOCENTE';
        document.getElementById('regTurno').value = u.turno || 'Matutino';
        document.getElementById('regCorreo').value = u.correo || '';
        document.getElementById('regTelefono').value = u.telefono || '';
        document.getElementById('regPassword').value = '';

        fotoBase64Temporal = u.fotoUrl || null;
        descriptorFacialTemporal = u.descriptor_facial || null;
        document.getElementById('prevFotoUsuario').src = u.fotoUrl || '/img/logo_aniversario.jpg';

        const btnQuitar = document.getElementById('btnQuitarFotoPersonal');
        if (btnQuitar) {
            btnQuitar.style.display = (u.fotoUrl && u.fotoUrl.trim() !== '' && !u.fotoUrl.includes('logo_aniversario')) ? 'inline-block' : 'none';
        }

        const lblPass = document.getElementById('lblRegPassword');
        const descPass = document.getElementById('descRegPassword');
        const regPass = document.getElementById('regPassword');

        if (lblPass) lblPass.innerText = 'Nueva Contraseña (Opcional)';
        if (descPass) descPass.style.display = 'block';
        if (regPass) regPass.required = false;

        actualizarVisibilidadPassword();

        const modalTitle = document.querySelector('#modalNuevoUsuario .modal-title');
        const saveBtn = document.getElementById('btnGuardarUsuario');
        
        if (modalTitle) modalTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Personal / Docente';
        if (saveBtn) saveBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Actualizar Datos';

        const myModal = new bootstrap.Modal(document.getElementById('modalNuevoUsuario'));
        myModal.show();

    } catch (e) {
        console.error("Error al preparar edición:", e);
    }
}

// 6. CAMBIAR ESTATUS
async function toggleEstatusUsuario(id, activo) {
    const nuevoEstatus = activo ? "Activo" : "Inactivo";
    try {
        await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estatus: nuevoEstatus })
        });
        listarUsuarios();
    } catch (e) {
        Swal.fire("Error", "No se pudo cambiar el estatus del usuario.", "error");
    }
}

// 7. BORRAR (DELETE)
function eliminarUsuario(id) {
    Swal.fire({
        title: '¿Eliminar registro?',
        text: `Se borrará la ficha del personal/docente. Esta acción no se puede revertir.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("Error al eliminar");
                Swal.fire("Eliminado", "El usuario ha sido removido del sistema.", "success");
                listarUsuarios();
            } catch (e) {
                Swal.fire("Error", "No se pudo eliminar el registro.", "error");
            }
        }
    });
}

// 8. DESCARGAR PLANTILLA LAYOUT EXCEL OFICIAL CON DATOS DE PRUEBA
function descargarPlantillaLayoutExcel() {
    if (typeof XLSX === 'undefined') {
        return Swal.fire("Error", "La librería SheetJS no está disponible.", "error");
    }

    const headers = [
        ["NOMBRE_COMPLETO", "RFC", "ROL", "TURNO", "CORREO_INSTITUCIONAL", "TELEFONO"],
        ["JUAN CARLOS PÉREZ LÓPEZ", "PELJ850101XYZ", "DOCENTE", "Matutino", "juan.perez@cbtis134.edu.mx", "7471234567"],
        ["MARÍA ELENA GÓMEZ RÍOS", "GORM900215ABC", "DOCENTE", "Vespertino", "elena.gomez@cbtis134.edu.mx", "7479876543"],
        ["ROBERTO SÁNCHEZ DÍAZ", "SADR781120H12", "ADMINISTRATIVO", "Tiempo Completo", "roberto.sanchez@cbtis134.edu.mx", "7475551234"],
        ["ANA LAURA TORRES VEGA", "TOVA820410M34", "PREFECTO", "Matutino", "prefectura.mat@cbtis134.edu.mx", "7474448899"],
        ["RICARDO HERNÁNDEZ CASTRO", "HECR870614P89", "DOCENTE", "Matutino", "ricardo.hernandez@cbtis134.edu.mx", "7473332211"],
        ["PATRICIA MORALES JIMÉNEZ", "MOJP911205K56", "ORIENTACION", "Matutino", "orientacion.cbtis134@gmail.com", "7478889900"],
        ["GUSTAVO RAMÍREZ FLORES", "RAFG800425R78", "GUARDIA", "Mixto", "vigilancia134@gmail.com", "7471112233"],
        ["SANDRA LUZ DOMÍNGUEZ NAVA", "DONS840918L45", "ADMINISTRATIVO", "Vespertino", "sandra.dominguez@cbtis134.edu.mx", "7476667788"]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);

    ws['!cols'] = [
        { wch: 34 }, // NOMBRE_COMPLETO
        { wch: 18 }, // RFC
        { wch: 18 }, // ROL
        { wch: 18 }, // TURNO
        { wch: 36 }, // CORREO_INSTITUCIONAL
        { wch: 16 }  // TELEFONO
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Personal_Docentes");
    XLSX.writeFile(wb, "Plantilla_Personal_Docentes_CBTIS134.xlsx");

    Swal.fire({
        icon: 'success',
        title: 'Plantilla Descargada',
        text: 'Se ha descargado "Plantilla_Personal_Docentes_CBTIS134.xlsx" con datos de prueba de referencia. Rellena los datos e impórtala con el botón Carga Masiva.',
        confirmButtonColor: '#7b1b37'
    });
}

// 8.1 DESCARGAR LISTA / REPORTE DE PERSONAL (EXCEL)
function descargarListaPersonalExcel() {
    if (typeof XLSX === 'undefined') {
        return Swal.fire("Error", "La librería SheetJS no está disponible.", "error");
    }

    const texto = (document.getElementById('filtroTexto')?.value || "").trim().toLowerCase();
    const filtrados = usuariosCache.filter(u => {
        const rol = (u.rol || "").toUpperCase();
        if (filtroRolActual === 'DOCENTE' && rol !== 'DOCENTE') return false;
        if (filtroRolActual === 'ADMINISTRATIVO' && rol !== 'ADMINISTRATIVO') return false;
        if (filtroRolActual === 'PLATAFORMA' && (rol === 'DOCENTE' || rol === 'ADMINISTRATIVO')) return false;
        if (texto) {
            const nom = (u.nombre || "").toLowerCase();
            const rfc = (u.rfc || "").toLowerCase();
            const cor = (u.correo || "").toLowerCase();
            const tel = (u.telefono || "").toLowerCase();
            return nom.includes(texto) || rfc.includes(texto) || cor.includes(texto) || tel.includes(texto);
        }
        return true;
    });

    if (filtrados.length === 0) {
        return Swal.fire("Aviso", "No hay registros para exportar con los filtros actuales.", "warning");
    }

    const filas = [
        ["#", "NOMBRE COMPLETO", "RFC", "ROL / PUESTO", "TURNO", "CORREO INSTITUCIONAL", "TELÉFONO", "PRESENCIA HOY", "ESTATUS"]
    ];

    filtrados.forEach((u, i) => {
        filas.push([
            i + 1,
            (u.nombre || '').toUpperCase(),
            (u.rfc || 'SIN RFC').toUpperCase(),
            (u.rol || 'DOCENTE').toUpperCase(),
            u.turno || 'Matutino',
            u.correo || 'N/A',
            u.telefono || 'N/A',
            u.estado === 'DENTRO' ? 'DENTRO' : 'FUERA',
            u.estatus || 'Activo'
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(filas);

    ws['!cols'] = [
        { wch: 6 },  // #
        { wch: 36 }, // NOMBRE
        { wch: 18 }, // RFC
        { wch: 18 }, // ROL
        { wch: 18 }, // TURNO
        { wch: 36 }, // CORREO
        { wch: 16 }, // TELÉFONO
        { wch: 16 }, // PRESENCIA
        { wch: 12 }  // ESTATUS
    ];

    const hoyStr = new Date().toISOString().split('T')[0];
    const nombreArchivo = `Directorio_Personal_${filtroRolActual}_${hoyStr}.xlsx`;
    XLSX.utils.book_append_sheet(wb, ws, "Directorio_Personal");
    XLSX.writeFile(wb, nombreArchivo);

    Swal.fire({
        icon: 'success',
        title: 'Reporte Excel Descargado',
        text: `Se exportaron ${filtrados.length} registros en "${nombreArchivo}".`,
        confirmButtonColor: '#7b1b37'
    });
}

// 8.2 DESCARGAR LISTA / REPORTE DE PERSONAL (PDF)
async function descargarListaPersonalPDF() {
    if (!usuariosCache || usuariosCache.length === 0) {
        return Swal.fire("Aviso", "No hay personal registrado en el sistema.", "warning");
    }

    const texto = (document.getElementById('filtroTexto')?.value || "").trim().toLowerCase();
    const filtrados = usuariosCache.filter(u => {
        const rol = (u.rol || "").toUpperCase();
        if (filtroRolActual === 'DOCENTE' && rol !== 'DOCENTE') return false;
        if (filtroRolActual === 'ADMINISTRATIVO' && rol !== 'ADMINISTRATIVO') return false;
        if (filtroRolActual === 'PLATAFORMA' && (rol === 'DOCENTE' || rol === 'ADMINISTRATIVO')) return false;
        if (texto) {
            const nom = (u.nombre || "").toLowerCase();
            const rfc = (u.rfc || "").toLowerCase();
            const cor = (u.correo || "").toLowerCase();
            const tel = (u.telefono || "").toLowerCase();
            return nom.includes(texto) || rfc.includes(texto) || cor.includes(texto) || tel.includes(texto);
        }
        return true;
    });

    if (filtrados.length === 0) {
        return Swal.fire("Aviso", "No hay registros para exportar.", "warning");
    }

    Swal.fire({ title: 'Generando Reporte PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'letter');
        const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        let y = 20;

        // Encabezado
        pdf.setFillColor(123, 27, 55);
        pdf.rect(14, y, 187.9, 14, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text("CBTis No. 134 • DIRECTORIO OFICIAL DE PERSONAL Y DOCENTES", 107.95, y + 9, { align: "center" });

        y += 20;
        pdf.setTextColor(60, 60, 60);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(`Fecha de emisión: ${hoy} | Filtro: ${filtroRolActual} | Total de registros: ${filtrados.length}`, 14, y);

        y += 6;
        // Cabecera de Tabla
        pdf.setFillColor(240, 240, 240);
        pdf.rect(14, y, 187.9, 7, 'F');
        pdf.setTextColor(40, 40, 40);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text("#", 16, y + 5);
        pdf.text("NOMBRE COMPLETO", 25, y + 5);
        pdf.text("RFC", 92, y + 5);
        pdf.text("ROL / PUESTO", 125, y + 5);
        pdf.text("TURNO", 158, y + 5);
        pdf.text("ESTATUS", 182, y + 5);

        y += 7;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        for (let i = 0; i < filtrados.length; i++) {
            const u = filtrados[i];

            if (y > 260) {
                pdf.addPage();
                y = 20;
                // Redibujar cabecera
                pdf.setFillColor(240, 240, 240);
                pdf.rect(14, y, 187.9, 7, 'F');
                pdf.setTextColor(40, 40, 40);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(8);
                pdf.text("#", 16, y + 5);
                pdf.text("NOMBRE COMPLETO", 25, y + 5);
                pdf.text("RFC", 92, y + 5);
                pdf.text("ROL / PUESTO", 125, y + 5);
                pdf.text("TURNO", 158, y + 5);
                pdf.text("ESTATUS", 182, y + 5);
                y += 7;
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(7.5);
            }

            if (i % 2 === 1) {
                pdf.setFillColor(248, 248, 248);
                pdf.rect(14, y, 187.9, 6, 'F');
            }

            pdf.setTextColor(40, 40, 40);
            pdf.text(String(i + 1), 16, y + 4.2);
            
            const nombreCorto = (u.nombre || '').substring(0, 38).toUpperCase();
            pdf.text(nombreCorto, 25, y + 4.2);
            pdf.text(String(u.rfc || 'SIN RFC').substring(0, 13).toUpperCase(), 92, y + 4.2);
            pdf.text(String(u.rol || 'DOCENTE').substring(0, 16).toUpperCase(), 125, y + 4.2);
            pdf.text(String(u.turno || 'Matutino').substring(0, 14), 158, y + 4.2);
            pdf.text(String(u.estatus || 'Activo'), 182, y + 4.2);

            y += 6;
        }

        const hoyStr = new Date().toISOString().split('T')[0];
        pdf.save(`Directorio_Personal_${filtroRolActual}_${hoyStr}.pdf`);
        Swal.close();
    } catch(err) {
        console.error("Error generando PDF de personal:", err);
        Swal.fire("Error", "No se pudo generar el reporte PDF: " + err.message, "error");
    }
}

// 9. ANALIZAR ARCHIVO EXCEL PARA CARGA MASIVA
function analizarArchivoExcelMasivo(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

            if (rawRows.length === 0) {
                return Swal.fire("Archivo Vacío", "No se encontraron filas de datos en el archivo.", "warning");
            }

            datosExcelMasivoPendientes = [];
            let validos = 0;
            let descartados = 0;

            rawRows.forEach((row) => {
                const keys = Object.keys(row);
                const r = {};
                keys.forEach(k => {
                    const cleanKey = k.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                    r[cleanKey] = String(row[k] || '').trim();
                });

                const nombre = r.NOMBRE_COMPLETO || r.NOMBRE || r.NOMBRES || '';
                const rfc = (r.RFC || r.CLAVE || '').toUpperCase();
                const rol = (r.ROL || r.CARGO || r.PUESTO || 'DOCENTE').toUpperCase();
                const turno = r.TURNO || 'Matutino';
                const correo = (r.CORREO_INSTITUCIONAL || r.CORREO || r.EMAIL || '').toLowerCase();
                const telefono = r.TELEFONO || r.CELULAR || r.TEL || '';

                if (nombre && (rfc || correo)) {
                    datosExcelMasivoPendientes.push({
                        nombre: nombre.toUpperCase(),
                        rfc: rfc || null,
                        rol: rol,
                        turno: turno,
                        correo: correo || null,
                        telefono: telefono || null,
                        qrCode: rfc || correo,
                        estatus: 'Activo'
                    });
                    validos++;
                } else {
                    descartados++;
                }
            });

            const resumenDiv = document.getElementById('resumenExcelMasivo');
            const btnEjecutar = document.getElementById('btnEjecutarCargaMasiva');

            if (resumenDiv) {
                resumenDiv.style.display = 'block';
                resumenDiv.innerHTML = `
                    <div class="card bg-light border p-3 rounded-3 text-start">
                        <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-file-earmark-check-fill text-success me-1"></i> Resumen de Archivo</h6>
                        <div class="row g-2 small">
                            <div class="col-6"><strong>Archivo:</strong> ${file.name}</div>
                            <div class="col-6"><strong>Filas Leídas:</strong> ${rawRows.length}</div>
                            <div class="col-6 text-success"><i class="bi bi-check-circle-fill me-1"></i><strong>Listos para importar:</strong> ${validos}</div>
                            <div class="col-6 text-danger"><i class="bi bi-exclamation-circle-fill me-1"></i><strong>Descartados (sin nombre/RFC):</strong> ${descartados}</div>
                        </div>
                    </div>
                `;
            }

            if (btnEjecutar) {
                btnEjecutar.style.display = (validos > 0) ? 'inline-block' : 'none';
            }

        } catch(err) {
            console.error("Error al leer Excel masivo:", err);
            Swal.fire("Error", "No se pudo procesar el archivo Excel. Verifica el formato.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

// 10. EJECUTAR IMPORTACIÓN MASIVA A BASE DE DATOS
async function ejecutarImportacionMasiva() {
    if (!datosExcelMasivoPendientes || datosExcelMasivoPendientes.length === 0) {
        return Swal.fire("Aviso", "No hay datos válidos para importar.", "warning");
    }

    try {
        Swal.fire({
            title: 'Importando personal...',
            text: `Guardando ${datosExcelMasivoPendientes.length} registros en MongoDB...`,
            didOpen: () => Swal.showLoading()
        });

        const res = await fetch('/api/usuarios/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosExcelMasivoPendientes)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Error al procesar carga masiva.");
        }

        const data = await res.json();
        const total = data.total || datosExcelMasivoPendientes.length;

        Swal.fire({
            icon: 'success',
            title: '¡Carga Masiva Exitosa!',
            html: `Se procesaron <strong>${total}</strong> registros correctamente.<br>
                   <span class="text-success small">Nuevos: ${data.insertados || 0} | Actualizados: ${data.actualizados || 0}</span>`,
            confirmButtonColor: '#7b1b37'
        });

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCargaMasiva'));
        if (modal) modal.hide();

        datosExcelMasivoPendientes = [];
        document.getElementById('excelMasivoInput').value = '';
        document.getElementById('resumenExcelMasivo').style.display = 'none';
        document.getElementById('btnEjecutarCargaMasiva').style.display = 'none';

        listarUsuarios();

    } catch (e) {
        Swal.fire("Error", "Ocurrió un error en la carga masiva: " + e.message, "error");
    }
}

// -------------------------------------------------------------
// 11. GAFETES Y CREDENCIALES DE PERSONAL Y DOCENTES
// -------------------------------------------------------------
let personalSeleccionadoGafete = null;
let imagenGafetePersonalGenerada = null;

async function abrirModalGafeteCredencialPersonal(id) {
    const user = usuariosCache.find(u => (u.id || u.uid || u.correo) === id);
    if (!user) return Swal.fire("Error", "No se encontró el registro del usuario.", "error");

    personalSeleccionadoGafete = user;

    const nombreEl = document.getElementById('nombreGafeteModal');
    const detallesEl = document.getElementById('detallesGafeteModal');
    if (nombreEl) nombreEl.innerText = user.nombre || 'PERSONAL';
    if (detallesEl) detallesEl.innerText = `RFC: ${user.rfc || 'N/A'} | ROL: ${user.rol || 'DOCENTE'} | TURNO: ${user.turno || 'Matutino'}`;

    // Renderizar Gafete en canvas
    const contGafete = document.getElementById('gafetePersonalMuestra');
    if (contGafete) {
        contGafete.innerHTML = '<div class="spinner-border text-guinda spinner-border-sm me-2"></div>Generando vista previa...';
        try {
            imagenGafetePersonalGenerada = await generarImagenGafetePersonal(user);
            contGafete.innerHTML = `<img src="${imagenGafetePersonalGenerada}" style="width: 200px; height: 280px; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">`;
        } catch(err) {
            console.error("Error generando gafete:", err);
            contGafete.innerHTML = '<span class="text-danger small">Error al generar vista previa</span>';
        }
    }

    // Renderizar Credencial PVC Frente y Reverso
    const recuadroFoto = document.getElementById('persPvcFoto');
    if (recuadroFoto) {
        const fotoReal = user.fotoUrl || '/img/logo_aniversario.jpg';
        recuadroFoto.style.backgroundImage = `url('${fotoReal}')`;
        recuadroFoto.style.backgroundPosition = 'center';
        recuadroFoto.style.backgroundRepeat = 'no-repeat';
        recuadroFoto.style.backgroundSize = 'cover';
    }

    const persPvcNombre = document.getElementById('persPvcNombre');
    if (persPvcNombre) persPvcNombre.innerText = user.nombre || 'NOMBRE COMPLETO';

    const persPvcRolBadge = document.getElementById('persPvcRolBadge');
    if (persPvcRolBadge) {
        persPvcRolBadge.innerText = (user.rol || 'DOCENTE').toUpperCase();
        if (user.rol === 'DOCENTE') {
            persPvcRolBadge.style.backgroundColor = '#6f42c1';
        } else if (user.rol === 'ADMINISTRATIVO') {
            persPvcRolBadge.style.backgroundColor = '#0d6efd';
        } else {
            persPvcRolBadge.style.backgroundColor = '#7b1b37';
        }
    }

    const persPvcRfc = document.getElementById('persPvcRfc');
    if (persPvcRfc) persPvcRfc.innerText = user.rfc || 'N/A';

    const persPvcTurno = document.getElementById('persPvcTurno');
    if (persPvcTurno) persPvcTurno.innerText = user.turno || 'Matutino';

    // Generar QR para el reverso
    const qrTexto = (user.qrCode || user.rfc || user.uid || user.nombre || '').trim();
    generarQRConTigrePersonal(qrTexto).then(qrImg => {
        const qrEl = document.getElementById('persPvcQrImg');
        if (qrEl) qrEl.src = qrImg;
    });

    cambiarCaraPreviaPersonalPVC('frente');

    const modalEl = document.getElementById('modalGafeteCredencialPersonal');
    if (modalEl) {
        const myModal = new bootstrap.Modal(modalEl);
        myModal.show();
    }
}

function cambiarCaraPreviaPersonalPVC(cara) {
    const frente = document.getElementById('vistaPreviaPersPvcFrente');
    const reverso = document.getElementById('vistaPreviaPersPvcReverso');
    const btnFrente = document.getElementById('btnVerFrentePersPVC');
    const btnReverso = document.getElementById('btnVerReversoPersPVC');

    if (cara === 'frente') {
        if (frente) frente.classList.remove('d-none');
        if (reverso) reverso.classList.add('d-none');
        if (btnFrente) btnFrente.classList.add('active');
        if (btnReverso) btnReverso.classList.remove('active');
    } else {
        if (frente) frente.classList.add('d-none');
        if (reverso) reverso.classList.remove('d-none');
        if (btnFrente) btnFrente.classList.remove('active');
        if (btnReverso) btnReverso.classList.add('active');
    }
}

async function generarQRConTigrePersonal(texto) {
    return new Promise((resolve) => {
        const size = 250;
        const divTemporal = document.createElement('div');
        const textoLimpio = (texto || '').substring(0, 60);
        
        if (typeof QRCode !== 'undefined') {
            new QRCode(divTemporal, { 
                text: textoLimpio, 
                width: size, 
                height: size, 
                colorDark : "#000000", 
                colorLight : "#ffffff", 
                correctLevel: QRCode.CorrectLevel.H 
            });

            setTimeout(() => {
                const imgQrGenerado = divTemporal.querySelector('img');
                const canvas = divTemporal.querySelector('canvas');
                if (imgQrGenerado && imgQrGenerado.src) {
                    resolve(imgQrGenerado.src);
                } else if (canvas) {
                    resolve(canvas.toDataURL("image/png"));
                } else {
                    resolve('/img/logo_aniversario.jpg');
                }
            }, 150);
        } else {
            resolve('/img/logo_aniversario.jpg');
        }
    });
}

async function generarImagenGafetePersonal(user) {
    return new Promise(async (resolve, reject) => {
        if (!user) return reject("Usuario no proporcionado");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400; 
        canvas.height = 560;

        ctx.fillStyle = "#FFFFFF"; 
        ctx.fillRect(0, 0, 400, 560);
        
        ctx.strokeStyle = "#7b1b37"; 
        ctx.setLineDash([6, 6]); 
        ctx.lineWidth = 2;
        ctx.strokeRect(3, 3, 394, 554); 
        ctx.setLineDash([]);

        // Franja superior institucional en degradado guinda
        const gradient = ctx.createLinearGradient(0, 0, 400, 0);
        gradient.addColorStop(0, '#7b1b37');
        gradient.addColorStop(1, '#5a1228');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 400, 90);

        // Línea dorada de acento
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(0, 88, 400, 3);

        const logoEscuelaSrc = cfgSistemaPersonal.logo_plantel_url || '/img/logo-cbtis.png';
        const logoInicioSrc = cfgSistemaPersonal.logo_inicio_url || '/img/logo.png';
        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis No. 134';

        const imgEscuela = new Image();
        const imgTigre = new Image();
        const imgFoto = new Image();
        
        imgEscuela.src = logoEscuelaSrc;
        imgTigre.src = logoInicioSrc;
        imgFoto.src = user.fotoUrl || '/img/logo_aniversario.jpg';

        let cargas = 0;
        const totalImagenes = 3;
        const alCargarImg = () => {
            cargas++;
            if (cargas < totalImagenes) return;

            // Logo Escuela (Circular)
            ctx.save();
            ctx.beginPath();
            ctx.arc(48, 44, 30, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(imgEscuela, 18, 14, 60, 60);
            ctx.restore();

            // Borde circular blanco
            ctx.save();
            ctx.beginPath();
            ctx.arc(48, 44, 30, 0, Math.PI * 2, true);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            
            // Logo Inicio / Mascota
            ctx.drawImage(imgTigre, 322, 14, 60, 60);

            // Cabecera Central
            ctx.fillStyle = "#FFFFFF"; 
            ctx.font = "bold 20px Arial"; 
            ctx.textAlign = "center";
            ctx.fillText(nomPlantel, 200, 42);
            ctx.fillStyle = "#ffe699"; 
            ctx.font = "bold 11px Arial";
            ctx.fillText("CREDENCIAL OFICIAL DE PERSONAL", 200, 64);

            // Nombre
            ctx.fillStyle = "#111111"; 
            ctx.font = "bold 20px Arial"; 
            ctx.textAlign = "center";
            ctx.fillText((user.nombre || '').toUpperCase(), 200, 122);

            // Fotografía de la persona (Cuadrada con esquinas redondeadas igual al QR)
            const fotoX = 50, fotoY = 173, fotoW = 130, fotoH = 130, fotoR = 8;
            ctx.save();
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(fotoX, fotoY, fotoW, fotoH, fotoR);
            } else {
                ctx.rect(fotoX, fotoY, fotoW, fotoH);
            }
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(imgFoto, fotoX, fotoY, fotoW, fotoH);
            ctx.restore();

            // Marco cuadrado institucional
            ctx.save();
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(fotoX, fotoY, fotoW, fotoH, fotoR);
            } else {
                ctx.rect(fotoX, fotoY, fotoW, fotoH);
            }
            ctx.strokeStyle = "#7b1b37";
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();

            // Código QR (Lado Derecho, dimensiones cuadradas idénticas a la foto: 130x130)
            const qrTexto = (user.qrCode || user.rfc || user.uid || user.nombre || '').trim();
            generarQRConTigrePersonal(qrTexto).then(qrDataUrl => {
                const imgQR = new Image();
                imgQR.src = qrDataUrl;
                imgQR.onload = () => {
                    ctx.drawImage(imgQR, 220, 173, 130, 130);
                    ctx.fillStyle = "#7b1b37";
                    ctx.font = "bold 9.5px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText("ESCANEAME PARA ACCESO", 285, 320);

                    // Información de la persona
                    const rfc = user.rfc || 'SIN RFC';
                    const rol = (user.rol || 'DOCENTE').toUpperCase();
                    const turno = user.turno || 'Matutino';

                    ctx.fillStyle = "#7b1b37"; 
                    ctx.font = "bold 23px monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(rfc, 200, 368);

                    // Badge de Rol
                    ctx.fillStyle = (rol === 'DOCENTE') ? "#6f42c1" : ((rol === 'ADMINISTRATIVO') ? "#0d6efd" : "#7b1b37");
                    ctx.fillRect(70, 390, 260, 32);
                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "bold 16px Arial";
                    ctx.fillText(rol, 200, 412);
                    
                    ctx.fillStyle = "#444444"; 
                    ctx.font = "bold 14px Arial";
                    ctx.fillText(`TURNO: ${turno.toUpperCase()}`, 200, 452);

                    // Pie de página institucional
                    ctx.fillStyle = "#7b1b37";
                    ctx.fillRect(0, 515, 400, 45);
                    ctx.fillStyle = "#FFFFFF"; 
                    ctx.font = "bold 11px Arial";
                    ctx.fillText(`${nomPlantel.toUpperCase()} • SISTEMA DE CONTROL DE ACCESOS Y REGISTRO`, 200, 542);

                    resolve(canvas.toDataURL("image/png"));
                };
                imgQR.onerror = () => resolve(canvas.toDataURL("image/png"));
            });
        };

        imgEscuela.onload = alCargarImg;
        imgTigre.onload = alCargarImg;
        imgFoto.onload = alCargarImg;

        imgEscuela.onerror = alCargarImg;
        imgTigre.onerror = alCargarImg;
        imgFoto.onerror = alCargarImg;
    });
}

async function descargarGafetePersonalPDF() {
    if (!personalSeleccionadoGafete) return;
    Swal.fire({ title: 'Generando Gafete...', text: 'Preparando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'letter');
        const imgData = imagenGafetePersonalGenerada || await generarImagenGafetePersonal(personalSeleccionadoGafete);

        const widthGafete = 90;
        const heightGafete = 120;
        const x = (215.9 - widthGafete) / 2;
        const y = (279.4 - heightGafete) / 2;

        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis No. 134';

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(123, 27, 55);
        pdf.text(`${nomPlantel} • GAFETE OFICIAL DE PERSONAL`, 107.95, 45, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text("Imprimir en Hoja Carta al 100% de Escala • Recortar por la línea punteada", 107.95, 51, { align: "center" });

        pdf.setDrawColor(180, 180, 180);
        pdf.setLineDashPattern([2, 2], 0);
        pdf.rect(x - 0.5, y - 0.5, widthGafete + 1, heightGafete + 1);

        pdf.addImage(imgData, 'PNG', x, y, widthGafete, heightGafete);

        const rfc = personalSeleccionadoGafete.rfc || 'PERSONAL';
        pdf.save(`Gafete_Personal_${rfc}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar el PDF del gafete.", "error");
    }
}

async function generarCanvasCredencialPersonalFrente(user) {
    return new Promise(async (resolve) => {
        let container = document.getElementById('tempCardContainerPersonal');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tempCardContainerPersonal';
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            document.body.appendChild(container);
        }

        const nombre = (user.nombre || '').toUpperCase();
        const rfc = (user.rfc || 'SIN RFC').toUpperCase();
        const rol = (user.rol || 'DOCENTE').toUpperCase();
        const turno = user.turno || 'Matutino';
        const fotoSrc = user.fotoUrl || '/img/logo_aniversario.jpg';
        const colorRol = (rol === 'DOCENTE') ? '#6f42c1' : ((rol === 'ADMINISTRATIVO') ? '#0d6efd' : '#7b1b37');

        const logoEscuelaSrc = cfgSistemaPersonal.logo_plantel_url || '/img/logo-cbtis.png';
        const logoInicioSrc = cfgSistemaPersonal.logo_inicio_url || '/img/logo.png';
        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis 134';
        const vigencia = cfgSistemaPersonal.vigencia_actual || 'AGOSTO 2026 - JULIO 2027';

        container.innerHTML = `
            <div id="cardPersFrenteTemp" style="width: 54mm; height: 85.6mm; background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); padding: 6px 8px 8px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    <img src="${logoEscuelaSrc}" style="width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: cover; background: #fff;">
                    <div style="text-align: center; flex: 1; margin: 0 4px;">
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff;">${nomPlantel}</div>
                        <div style="font-size: 5.5px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; display: inline-block; color: #ffe699; letter-spacing: 0.5px; margin-top: 1px;">CREDENCIAL DE PERSONAL</div>
                    </div>
                    <img src="${logoInicioSrc}" style="width: 24px; height: 24px; object-fit: contain;">
                </div>
                
                <div style="padding: 2px 8px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly;">
                    <div style="margin: 0 auto;">
                        <div style="width: 26mm; height: 32mm; background: #f1f5f9; border: 2.5px solid #7b1b37; border-radius: 8px; background-image: url('${fotoSrc}'); background-size: cover; background-repeat: no-repeat; background-position: center; box-shadow: 0 3px 8px rgba(123, 27, 55, 0.25);"></div>
                    </div>
                    
                    <div style="margin: 1px 0;">
                        <div style="font-size: 9.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; line-height: 1.15; padding: 0 2px;">${nombre}</div>
                        <div style="margin-top: 1.5px;">
                            <span style="background: ${colorRol}; color: #ffffff; font-size: 6.5px; font-weight: 800; padding: 1.5px 8px; border-radius: 10px; letter-spacing: 0.5px; text-transform: uppercase;">${rol}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 7px; text-align: left; font-size: 6.5px; line-height: 1.45; box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 2px;">
                            <span style="color: #64748b; font-weight: 700;">RFC:</span>
                            <span style="color: #7b1b37; font-weight: 900; font-size: 8px; letter-spacing: 0.5px;">${rfc}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 2px;">
                            <span style="color: #64748b; font-weight: 700;">TURNO:</span>
                            <span style="color: #0f172a; font-weight: 800;">${turno.toUpperCase()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b; font-weight: 700;">ADSCRIPCIÓN:</span>
                            <span style="color: #334155; font-weight: 800;">PLANTEL ${nomPlantel.toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; padding: 4px 6px; border-top: 2px solid #d4af37; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 5.5px; font-weight: 800; letter-spacing: 0.3px;">
                        <span>VIGENCIA: <strong style="color: #ffe699;">${vigencia}</strong></span>
                        <span>${nomPlantel}</span>
                    </div>
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const canvas = await html2canvas(targetEl, {
            scale: 4,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        resolve(canvas.toDataURL("image/jpeg", 0.95));
    });
}

async function generarCanvasCredencialPersonalReverso(user) {
    return new Promise(async (resolve) => {
        let container = document.getElementById('tempCardContainerPersonal');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tempCardContainerPersonal';
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            document.body.appendChild(container);
        }

        const qrTexto = (user.qrCode || user.rfc || user.uid || user.nombre || '').trim();
        const qrImgData = await generarQRConTigrePersonal(qrTexto);

        const logoEscuelaSrc = cfgSistemaPersonal.logo_plantel_url || '/img/logo-cbtis.png';
        const logoInicioSrc = cfgSistemaPersonal.logo_inicio_url || '/img/logo.png';
        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis 134';
        const director = cfgSistemaPersonal.nombre_director || 'JOSE MARTÍN RODEA ZUÑIGA';
        const cct = cfgSistemaPersonal.cct_escuela || '12DCT0001L';

        container.innerHTML = `
            <div id="cardPersReversoTemp" style="width: 54mm; height: 85.6mm; background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); padding: 6px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px;">
                    <img src="${logoEscuelaSrc}" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid #ffffff; object-fit: cover; background: #fff;">
                    <div style="font-size: 8px; font-weight: 900; letter-spacing: 0.5px; flex: 1; text-transform: uppercase;">CONTROL Y ACCESO VIGILANTE</div>
                    <img src="${logoInicioSrc}" style="width: 20px; height: 20px; object-fit: contain;">
                </div>
                
                <div style="padding: 4px 8px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;">
                    <div style="background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 10px; padding: 4px; box-shadow: 0 3px 8px rgba(123, 27, 55, 0.15);">
                        <div style="width: 32mm; height: 32mm; margin: 0 auto;">
                            <img src="${qrImgData}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div style="font-size: 5.5px; font-weight: 800; color: #7b1b37; letter-spacing: 0.5px; margin-top: 2px;">ESCANEAME PARA ACCESO</div>
                    </div>
                    
                    <div style="font-size: 5.8px; font-weight: 600; color: #475569; line-height: 1.3; margin: 2px auto; max-width: 48mm;">
                        Esta credencial es personal e intransferible. Acredita al portador como personal adscrito al plantel educativo ${nomPlantel}.
                    </div>
                    
                    <div style="width: 100%; margin-top: 2px;">
                        <div style="width: 36mm; border-bottom: 1.5px solid #334155; margin: 0 auto 2px auto;"></div>
                        <div style="font-size: 7.5px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${director}</div>
                        <div style="font-size: 5.8px; color: #64748b; font-weight: 700;">Director del Plantel ${nomPlantel}</div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; padding: 4px 6px; border-top: 2px solid #d4af37; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 5.5px; font-weight: 800; letter-spacing: 0.4px;">CLAVE CCT: ${cct}</div>
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const canvas = await html2canvas(targetEl, {
            scale: 4,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        resolve(canvas.toDataURL("image/jpeg", 0.95));
    });
}

async function descargarCredencialPersonalPVC(modoPlanilla = false) {
    if (!personalSeleccionadoGafete) return;
    Swal.fire({ title: 'Generando Credencial PVC...', text: 'Renderizando frente y reverso...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const imgFrente = await generarCanvasCredencialPersonalFrente(personalSeleccionadoGafete);
        const imgReverso = await generarCanvasCredencialPersonalReverso(personalSeleccionadoGafete);

        if (!modoPlanilla) {
            // Formato Térmico CR80: 54mm x 85.6mm por cara
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [54, 85.6]
            });

            pdf.addImage(imgFrente, 'JPEG', 0, 0, 54, 85.6);
            pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgReverso, 'JPEG', 0, 0, 54, 85.6);

            pdf.save(`Credencial_Termica_Personal_${personalSeleccionadoGafete.rfc || 'Personal'}.pdf`);
        } else {
            // Formato Planilla Carta
            const pdf = new jsPDF('portrait', 'mm', 'letter');
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.setTextColor(123, 27, 55);
            pdf.text("CBTis No. 134 • CREDENCIAL DE PERSONAL (CR-80)", 107.95, 40, { align: "center" });

            const w = 54, h = 85.6;
            const y = 60;
            const x1 = (215.9 / 2) - w - 6;
            const x2 = (215.9 / 2) + 6;

            pdf.setDrawColor(200, 200, 200);
            pdf.setLineDashPattern([2, 2], 0);
            pdf.rect(x1 - 0.5, y - 0.5, w + 1, h + 1);
            pdf.rect(x2 - 0.5, y - 0.5, w + 1, h + 1);

            pdf.addImage(imgFrente, 'JPEG', x1, y, w, h);
            pdf.addImage(imgReverso, 'JPEG', x2, y, w, h);

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text("FRENTE", x1 + (w / 2), y + h + 6, { align: "center" });
            pdf.text("REVERSO", x2 + (w / 2), y + h + 6, { align: "center" });

            pdf.save(`Planilla_Credencial_${personalSeleccionadoGafete.rfc || 'Personal'}.pdf`);
        }

        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar la credencial PVC: " + e.message, "error");
    }
}

async function descargarCredencialesTermicasMasivasPersonal() {
    if (!usuariosCache || usuariosCache.length === 0) {
        return Swal.fire("Aviso", "No hay personal registrado en el directorio.", "warning");
    }

    Swal.fire({
        title: 'Generando Credenciales Térmicas Masivas...',
        text: `Procesando ${usuariosCache.length} credenciales en formato CR-80 (54x85.6mm)...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [54, 85.6]
        });

        for (let i = 0; i < usuariosCache.length; i++) {
            const u = usuariosCache[i];
            const imgFrente = await generarCanvasCredencialPersonalFrente(u);
            const imgReverso = await generarCanvasCredencialPersonalReverso(u);

            if (i > 0) pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgFrente, 'JPEG', 0, 0, 54, 85.6);

            pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgReverso, 'JPEG', 0, 0, 54, 85.6);
        }

        pdf.save(`Credenciales_Termicas_Personal_CR80.pdf`);
        Swal.close();
    } catch(e) {
        console.error("Error generando credenciales térmicas masivas:", e);
        Swal.fire("Error", "No se pudieron generar las credenciales térmicas: " + e.message, "error");
    }
}

async function descargarPlanillaGafetesTodoPersonal() {
    if (!usuariosCache || usuariosCache.length === 0) {
        return Swal.fire("Aviso", "No hay personal registrado en el directorio.", "warning");
    }

    Swal.fire({
        title: 'Generando Planilla de Gafetes...',
        text: `Generando gafetes para ${usuariosCache.length} miembros del personal...`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'letter');
        
        let col = 0, row = 0;
        const widthGafete = 85, heightGafete = 118;
        const marginX = 16, marginY = 16;
        const gapX = 13.9, gapY = 11.4;

        for (let i = 0; i < usuariosCache.length; i++) {
            const u = usuariosCache[i];
            const imgData = await generarImagenGafetePersonal(u);

            if (i > 0 && i % 4 === 0) {
                pdf.addPage();
                col = 0; row = 0;
            } else if (i > 0 && i % 2 === 0) {
                row++; col = 0;
            } else if (i > 0) {
                col++;
            }

            const x = marginX + (col * (widthGafete + gapX));
            const y = marginY + (row * (heightGafete + gapY));

            pdf.setDrawColor(200, 200, 200);
            pdf.setLineDashPattern([2, 2], 0);
            pdf.rect(x - 0.5, y - 0.5, widthGafete + 1, heightGafete + 1);

            pdf.addImage(imgData, 'PNG', x, y, widthGafete, heightGafete);
        }

        pdf.save(`Planilla_Gafetes_Personal_CBTIS134.pdf`);
        Swal.close();
    } catch(e) {
        console.error("Error generando planilla masiva:", e);
        Swal.fire("Error", "No se pudo generar la planilla: " + e.message, "error");
    }
}

async function enviarWhatsappPersonalPersonalizado(id) {
    const user = usuariosCache.find(u => (u.id || u.uid || u.correo) === id);
    if (!user) return Swal.fire("Error", "No se encontró el registro del usuario.", "error");

    const tel = user.telefono;
    if (!tel) {
        return Swal.fire("Sin número de teléfono", `El docente/personal ${user.nombre} no tiene registrado un número de teléfono/WhatsApp.`, "warning");
    }

    const rol = (user.rol || 'DOCENTE').toUpperCase();
    const nombre = user.nombre || 'Personal';

    const { value: mensajeTxt } = await Swal.fire({
        title: `<div class="fs-5 fw-bold text-dark mb-0"><i class="bi bi-whatsapp text-success me-2"></i>Enviar WhatsApp a Personal</div>`,
        html: `
            <div class="text-start small mb-2 p-2 bg-light rounded border">
                <div class="mb-1"><b>Nombre:</b> <span class="fw-bold text-dark">${nombre}</span></div>
                <div class="mb-1"><b>Cargo / Rol:</b> <span class="badge ${rol === 'DOCENTE' ? 'bg-purple' : 'bg-primary'} text-white">${rol}</span></div>
                <div><b>Teléfono:</b> <code class="text-success fw-bold">${tel}</code></div>
            </div>
            <textarea id="swalWsMensajePersonal" class="form-control form-control-sm border-success mt-2" placeholder="Escribe tu mensaje aquí..." rows="4" style="width: 100%; box-sizing: border-box; resize: vertical; font-size: 0.9rem; text-transform: none !important;">🏫 *[CBTis 134 - AVISO INSTITUCIONAL]*:\nEstimado(a) ${nombre},\n</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send me-1"></i>Enviar Mensaje',
        confirmButtonColor: '#198754',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const val = document.getElementById('swalWsMensajePersonal').value.trim();
            if (!val) Swal.showValidationMessage('Ingresa el texto del mensaje.');
            return val;
        }
    });

    if (!mensajeTxt) return;

    Swal.fire({ title: 'Despachando mensaje por WhatsApp...', didOpen: () => Swal.showLoading() });

    try {
        const resWs = await fetch('/api/configuracion/whatsapp');
        if (!resWs.ok) throw new Error("No hay API de WhatsApp configurada.");
        const configWs = await resWs.json();

        const tipoEndpoint = (configWs.tipo_api || 'EVOLUTION').toLowerCase();

        const res = await fetch(`/api/whatsapp/${tipoEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiUrl: configWs.apiUrl || configWs.serverUrl,
                apiKey: configWs.apiKey || configWs.token,
                token: configWs.token || configWs.apiKey,
                instanceName: configWs.instanceName || configWs.sessionName || 'cbtis134',
                to: tel,
                body: mensajeTxt
            })
        });

        const resText = await res.text();
        if (res.ok) {
            Swal.fire("¡Mensaje Enviado!", `El mensaje ha sido entregado a ${nombre} con éxito.`, "success");
        } else {
            Swal.fire("Error al Enviar", `La API respondió con error (HTTP ${res.status}): ${resText}`, "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
}

window.descargarCredencialPersonalPVC = descargarCredencialPersonalPVC;
window.descargarCredencialesTermicasMasivasPersonal = descargarCredencialesTermicasMasivasPersonal;
window.descargarPlanillaGafetesTodoPersonal = descargarPlanillaGafetesTodoPersonal;
window.descargarGafetePersonalPDF = descargarGafetePersonalPDF;
window.abrirModalGafeteCredencialPersonal = abrirModalGafeteCredencialPersonal;
window.descargarPlantillaLayoutExcel = descargarPlantillaLayoutExcel;
window.descargarListaPersonalExcel = descargarListaPersonalExcel;
window.descargarListaPersonalPDF = descargarListaPersonalPDF;
window.enviarWhatsappPersonalPersonalizado = enviarWhatsappPersonalPersonalizado;