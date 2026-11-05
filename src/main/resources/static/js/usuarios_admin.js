/**
 * Gestión de Docentes y Personal Administrativo - CBTis 134 (MongoDB REST API)
 */

// Pre-fetch inmediato de la lista de usuarios al interpretar el script para 0 latencia
let prefetchUsuariosPromise = fetch('/api/usuarios?_t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .catch(() => []);

let usuariosCache = [];
let editUserUID = null;
let fotoBase64Temporal = null;
let descriptorFacialTemporal = null;
let filtroRolActual = 'TODOS';
let datosExcelMasivoPendientes = [];
let cfgSistemaPersonal = {};

async function cargarConfiguracionSistemaPersonal() {
    try {
        if (window.cfgSistemaGlobal && window.cfgSistemaGlobal.nombre_plantel) {
            cfgSistemaPersonal = window.cfgSistemaGlobal;
            return;
        }
        const cached = sessionStorage.getItem('cfg_sistema');
        if (cached) {
            cfgSistemaPersonal = JSON.parse(cached);
            window.cfgSistemaGlobal = cfgSistemaPersonal;
            return;
        }
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            cfgSistemaPersonal = await res.json();
            window.cfgSistemaGlobal = cfgSistemaPersonal;
            try { sessionStorage.setItem('cfg_sistema', JSON.stringify(cfgSistemaPersonal)); } catch(e) {}
        }
    } catch (e) {
        console.warn("No se pudo cargar la configuración del sistema:", e);
    }
}

let timerBusquedaUsuarios = null;

document.addEventListener('DOMContentLoaded', () => {
    // Cargar directorio y configuración en paralelo sin bloquear la interfaz
    Promise.all([
        listarUsuarios(),
        cargarConfiguracionSistemaPersonal()
    ]);

    const modalElement = document.getElementById('modalNuevoUsuario');
    if (modalElement) {
        modalElement.addEventListener('show.bs.modal', function () {
            // Diferir carga de modelos FaceAPI únicamente cuando se abre el modal de registro/edición
            inicializarModelosFacialesSilencioso();
            if (!editUserUID) {
                document.getElementById('formNuevoUsuario').reset();
                fotoBase64Temporal = null;
                descriptorFacialTemporal = null;
                document.getElementById('prevFotoUsuario').src = '/img/default_avatar.png';
                
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

// Inicializar modelos face-api (diferido a Punto de Control para evitar bloqueo de UI)
async function inicializarModelosFacialesSilencioso() {
    // Los descriptores faciales se extraen en segundo plano en escaneo.js cuando se usa FaceID
}

// 1. LEER (READ): Cargar lista desde /api/usuarios
async function listarUsuarios(forzar = false) {
    try {
        let raw = [];
        if (prefetchUsuariosPromise && !forzar) {
            raw = await prefetchUsuariosPromise;
            prefetchUsuariosPromise = null;
        } else {
            prefetchUsuariosPromise = null;
            const response = await fetch('/api/usuarios?_t=' + Date.now(), { cache: 'no-store' });
            if (response.ok) raw = await response.json();
        }
        usuariosCache = (Array.isArray(raw) ? raw : []).map(u => {
            u._rolUpper = (u.rol || "").toUpperCase();
            u._searchStr = `${u.nombre || ''} ${u.rfc || ''} ${u.correo || ''} ${u.telefono || ''}`.toLowerCase();
            return u;
        });

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
    if (timerBusquedaUsuarios) clearTimeout(timerBusquedaUsuarios);
    timerBusquedaUsuarios = setTimeout(renderizarTablaUsuarios, 65);
}

function renderizarTablaUsuarios() {
    const tbody = document.getElementById('tablaUsuariosBody');
    const contador = document.getElementById('contadorUsuarios');
    if (!tbody) return;

    const texto = (document.getElementById('filtroTexto')?.value || "").trim().toLowerCase();

    const filtrados = usuariosCache.filter(u => {
        const rol = u._rolUpper || (u.rol || "").toUpperCase();
        
        // Filtro por Rol
        if (filtroRolActual === 'DOCENTE' && rol !== 'DOCENTE') return false;
        if (filtroRolActual === 'ADMINISTRATIVO' && rol !== 'ADMINISTRATIVO') return false;
        if (filtroRolActual === 'PLATAFORMA' && (rol === 'DOCENTE' || rol === 'ADMINISTRATIVO')) return false;

        // Filtro por Texto pre-indexado
        if (texto) {
            const idx = u._searchStr || `${u.nombre || ''} ${u.rfc || ''} ${u.correo || ''} ${u.telefono || ''}`.toLowerCase();
            return idx.includes(texto);
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
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-muted small"><i class="bi bi-inbox me-1"></i>No se encontraron registros de personal o docentes.</td></tr>`;
        return;
    }

    // Construcción en un solo lote (O(N)) para evitar re-parseo DOM e imágenes base64 en cada fila
    const rowsHtml = filtrados.map((user) => {
        const idDoc = user.id || user.uid || user.correo;
        const rolKey = user._rolUpper || (user.rol || "").toUpperCase();
        const badgeClass = coloresRoles[rolKey] || 'bg-dark text-white';
        const estatusClass = user.estatus === 'Activo' ? 'text-success' : 'text-danger';
        const foto = user.fotoUrl || '/img/default_avatar.png';
        const rfc = user.rfc || '<span class="text-muted fst-italic">Sin RFC</span>';
        const turno = user.turno || 'Matutino';
        const presenciaBadge = user.estado === 'DENTRO' 
            ? '<span class="badge bg-success">DENTRO</span>' 
            : '<span class="badge bg-danger">FUERA</span>';

        return `
            <tr>
                <td class="ps-3 text-start">
                    <div class="d-flex align-items-center">
                        <img src="${foto}" loading="lazy" decoding="async" class="rounded-circle me-2 border flex-shrink-0" style="width: 38px; height: 38px; object-fit: cover;" onerror="this.src='/img/default_avatar.png'">
                        <div class="text-truncate" style="max-width: 240px;">
                            <span class="d-block fw-bold text-dark text-truncate" title="${user.nombre}">${user.nombre}</span>
                            <small class="text-muted d-block text-truncate" title="${user.correo || idDoc}">${user.correo || idDoc}</small>
                        </div>
                    </div>
                </td>
                <td class="text-nowrap"><span class="font-monospace fw-bold text-dark small">${rfc}</span></td>
                <td class="text-nowrap">
                    <div class="d-inline-flex flex-column align-items-center gap-1">
                        <span class="badge ${badgeClass} rounded-pill shadow-sm">${rolKey}</span>
                        <span class="badge bg-light text-dark border" style="font-size: 0.7rem;">${turno}</span>
                    </div>
                </td>
                <td class="text-nowrap"><small class="text-muted">${user.telefono || 'N/A'}</small></td>
                <td class="text-nowrap">${presenciaBadge}</td>
                <td class="text-nowrap">
                    <div class="form-check form-switch d-inline-block mb-0">
                        <input class="form-check-input shadow-none" type="checkbox" 
                               ${user.estatus === 'Activo' ? 'checked' : ''} 
                               onchange="toggleEstatusUsuario('${idDoc}', this.checked)">
                        <label class="small ${estatusClass} fw-bold ms-1">${user.estatus || 'Activo'}</label>
                    </div>
                </td>
                <td class="text-center pe-3 text-nowrap">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-sm btn-outline-success border-0 px-2" onclick="enviarWhatsappPersonalPersonalizado('${idDoc}')" title="Enviar WhatsApp a Personal / Docente">
                            <i class="bi bi-whatsapp fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-guinda border-0 px-2" onclick="abrirModalGafeteCredencialPersonal('${idDoc}')" title="Generar Gafete y Credencial">
                            <i class="bi bi-person-badge fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary border-0 px-2" onclick="prepararEdicion('${idDoc}')" title="Editar">
                            <i class="bi bi-pencil-square fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger border-0 px-2" onclick="eliminarUsuario('${idDoc}')" title="Eliminar">
                            <i class="bi bi-trash3-fill fs-5"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.innerHTML = rowsHtml;
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

    if (confirmarBD && editUserUID && fotoBase64Temporal && !fotoBase64Temporal.includes('default_avatar')) {
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
            document.getElementById('prevFotoUsuario').src = '/img/default_avatar.png';
            if (inputFoto) inputFoto.value = '';
            if (btnQuitar) btnQuitar.style.display = 'none';

            Swal.fire({
                icon: 'success',
                title: 'Foto Eliminada',
                text: 'La fotografía de perfil se eliminó de la base de datos con éxito.',
                timer: 2000,
                showConfirmButton: false
            });

            await listarUsuarios(true);
            return;
        } catch (err) {
            console.error(err);
            return Swal.fire("Error", "No se pudo eliminar la foto: " + err.message, "error");
        }
    }

    // Reset local
    fotoBase64Temporal = null;
    descriptorFacialTemporal = null;
    document.getElementById('prevFotoUsuario').src = '/img/default_avatar.png';
    if (inputFoto) inputFoto.value = '';
    if (btnQuitar) btnQuitar.style.display = 'none';
}
window.eliminarFotoPersonal = eliminarFotoPersonal;

function toggleSpinnerFotoPersonal(mostrar, mensaje = 'Cargando y optimizando fotografía...', exito = false) {
    const spinnerOverlay = document.getElementById('spinnerFotoPersonal');
    const estadoBox = document.getElementById('estadoCargaFotoPersonal');
    const inputArchivo = document.getElementById('inputFotoUsuario');

    if (mostrar) {
        if (spinnerOverlay) {
            spinnerOverlay.classList.remove('d-none');
            spinnerOverlay.classList.add('d-flex');
        }
        if (estadoBox) {
            estadoBox.classList.remove('d-none');
            estadoBox.style.color = '#7b1b37';
            estadoBox.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span><span>${mensaje}</span>`;
        }
        if (inputArchivo) inputArchivo.disabled = true;
    } else {
        if (spinnerOverlay) {
            spinnerOverlay.classList.add('d-none');
            spinnerOverlay.classList.remove('d-flex');
        }
        if (inputArchivo) inputArchivo.disabled = false;
        if (estadoBox) {
            if (exito) {
                estadoBox.classList.remove('d-none');
                estadoBox.style.color = '#198754';
                estadoBox.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i><span>Fotografía lista en alta resolución</span>`;
                setTimeout(() => {
                    if (estadoBox) estadoBox.classList.add('d-none');
                }, 2500);
            } else {
                estadoBox.classList.add('d-none');
            }
        }
    }
}

function comprimirFotoClientSide(file, maxDim = 1000, calidad = 0.92) {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            try {
                if (typeof img.decode === 'function') {
                    try { await img.decode(); } catch (e) {}
                }
                const w = img.width || 400;
                const h = img.height || 400;
                const scale = Math.min(1.0, maxDim / Math.max(w, h));
                const nw = Math.max(1, Math.round(w * scale));
                const nh = Math.max(1, Math.round(h * scale));
                const canvas = document.createElement('canvas');
                canvas.width = nw;
                canvas.height = nh;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, nw, nh);
                ctx.drawImage(img, 0, 0, nw, nh);

                if (typeof canvas.toBlob === 'function') {
                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(objectUrl);
                        if (!blob) {
                            resolve(canvas.toDataURL('image/jpeg', calidad));
                            return;
                        }
                        const fr = new FileReader();
                        fr.onloadend = () => resolve(fr.result);
                        fr.onerror = () => resolve(canvas.toDataURL('image/jpeg', calidad));
                        fr.readAsDataURL(blob);
                    }, 'image/jpeg', calidad);
                } else {
                    URL.revokeObjectURL(objectUrl);
                    resolve(canvas.toDataURL('image/jpeg', calidad));
                }
            } catch (e) {
                URL.revokeObjectURL(objectUrl);
                resolve(null);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        img.src = objectUrl;
    });
}

async function procesarFotoUsuario(input) {
    const file = input.files[0];
    if (!file) return;

    try {
        toggleSpinnerFotoPersonal(true, 'Cargando y optimizando fotografía...');
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 25)));

        fotoBase64Temporal = await comprimirFotoClientSide(file, 1000, 0.92);
        if (!fotoBase64Temporal) {
            toggleSpinnerFotoPersonal(false);
            return;
        }

        document.getElementById('prevFotoUsuario').src = fotoBase64Temporal;
        
        const btnQuitar = document.getElementById('btnQuitarFotoPersonal');
        if (btnQuitar) btnQuitar.style.display = 'inline-block';

        toggleSpinnerFotoPersonal(false, '', true);
    } catch(err) {
        console.warn("No se pudo procesar la foto de perfil:", err);
        toggleSpinnerFotoPersonal(false);
    }
}

function limpiarSinAcentosPersonal(val) {
    return String(val || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

// 4. CREAR / ACTUALIZAR USUARIO
async function guardarUsuarioFormulario() {
    const nombre = limpiarSinAcentosPersonal(document.getElementById('regNombre').value);
    const rfc = limpiarSinAcentosPersonal(document.getElementById('regRfc').value).replace(/[^A-Z0-9]/g, '');
    const rol = limpiarSinAcentosPersonal(document.getElementById('regRol').value);
    const turno = document.getElementById('regTurno').value;
    const correo = String(document.getElementById('regCorreo').value || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
    const telefono = String(document.getElementById('regTelefono').value || '').replace(/[^0-9]/g, '');
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
        await listarUsuarios(true);

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
        document.getElementById('prevFotoUsuario').src = u.fotoUrl || '/img/default_avatar.png';

        const btnQuitar = document.getElementById('btnQuitarFotoPersonal');
        if (btnQuitar) {
            btnQuitar.style.display = (u.fotoUrl && u.fotoUrl.trim() !== '' && !u.fotoUrl.includes('default_avatar')) ? 'inline-block' : 'none';
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
        await listarUsuarios(true);
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
                // Actualización optimista de UI inmediata
                usuariosCache = usuariosCache.filter(u => (u.id || u.uid || u.correo) !== id && u.rfc !== id);
                renderizarTablaUsuarios();

                const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("Error al eliminar");
                Swal.fire("Eliminado", "El usuario ha sido removido del sistema.", "success");
                await listarUsuarios(true);
            } catch (e) {
                Swal.fire("Error", "No se pudo eliminar el registro.", "error");
                await listarUsuarios(true);
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
        ["JUAN CARLOS PEREZ LOPEZ", "PELJ850101XYZ", "DOCENTE", "Matutino", "juan.perez@ejemplo.edu.mx", "7471234567"],
        ["MARIA ELENA GOMEZ RIOS", "GORM900215ABC", "DOCENTE", "Vespertino", "elena.gomez@ejemplo.edu.mx", "7479876543"],
        ["ROBERTO SANCHEZ DIAZ", "SADR781120H12", "ADMINISTRATIVO", "Tiempo Completo", "roberto.sanchez@ejemplo.edu.mx", "7475551234"],
        ["ANA LAURA TORRES VEGA", "TOVA820410M34", "PREFECTO", "Matutino", "prefectura.mat@ejemplo.edu.mx", "7474448899"],
        ["RICARDO HERNANDEZ CASTRO", "HECR870614P89", "DOCENTE", "Matutino", "ricardo.hernandez@ejemplo.edu.mx", "7473332211"],
        ["PATRICIA MORALES JIMENEZ", "MOJP911205K56", "ORIENTACION", "Matutino", "orientacion@ejemplo.edu.mx", "7478889900"],
        ["GUSTAVO RAMIREZ FLORES", "RAFG800425R78", "GUARDIA", "Mixto", "vigilancia@ejemplo.edu.mx", "7471112233"],
        ["SANDRA LUZ DOMINGUEZ NAVA", "DONS840918L45", "ADMINISTRATIVO", "Vespertino", "sandra.dominguez@ejemplo.edu.mx", "7476667788"]
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
    XLSX.writeFile(wb, "Plantilla_Personal_Docentes.xlsx");

    Swal.fire({
        icon: 'success',
        title: 'Plantilla Descargada',
        text: 'Se ha descargado "Plantilla_Personal_Docentes.xlsx" con datos de prueba de referencia. Rellena los datos e impórtala con el botón Carga Masiva.',
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

// 9. ANALIZAR ARCHIVO EXCEL PARA CARGA MASIVA DE PERSONAL
let personalNuevoPendiente = [];
let personalExistenteAnalisis = [];
let personalInvalidoAnalisis = [];

async function analizarArchivoExcelMasivo(input) {
    const file = input.files[0];
    if (!file) return;

    const resumenDiv = document.getElementById('resumenExcelMasivo');
    const btnEjecutar = document.getElementById('btnEjecutarCargaMasiva');
    const progresoModal = document.getElementById('progresoModalPersonal');

    if (progresoModal) progresoModal.classList.add('d-none');
    if (resumenDiv) {
        resumenDiv.style.display = 'block';
        resumenDiv.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-guinda me-2" role="status"></div>
                <span class="text-muted fw-bold">Analizando archivo y consultando personal registrado en la base de datos...</span>
            </div>
        `;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

            if (!rawRows || rawRows.length === 0) {
                if (resumenDiv) resumenDiv.style.display = 'none';
                return Swal.fire("Archivo Vacío", "No se encontraron filas de datos en el archivo.", "warning");
            }

            // Consultar personal existente en la base de datos
            let usuariosBD = usuariosCache;
            if (!usuariosBD || usuariosBD.length === 0) {
                try {
                    const resUsers = await fetch('/api/usuarios');
                    if (resUsers.ok) usuariosBD = await resUsers.json();
                } catch(errFetch) {
                    console.warn("Error obteniendo usuarios:", errFetch);
                }
            }

            const mapaExistentesPorRfc = new Map();
            const mapaExistentesPorCorreo = new Map();

            (usuariosBD || []).forEach(u => {
                const rfcBD = limpiarSinAcentosPersonal(u.rfc || '').replace(/[^A-Z0-9]/g, '');
                const correoBD = String(u.correo || '').trim().toLowerCase();
                if (rfcBD) mapaExistentesPorRfc.set(rfcBD, u);
                if (correoBD && correoBD.includes('@')) mapaExistentesPorCorreo.set(correoBD, u);
            });

            personalNuevoPendiente = [];
            personalExistenteAnalisis = [];
            personalInvalidoAnalisis = [];
            const rfcsVistosEnExcel = new Set();
            const correosVistosEnExcel = new Set();

            rawRows.forEach((row, idx) => {
                const keys = Object.keys(row);
                const r = {};
                keys.forEach(k => {
                    const cleanKey = limpiarSinAcentosPersonal(k).replace(/[^A-Z0-9]/g, '_');
                    r[cleanKey] = String(row[k] || '').trim();
                });

                const nombre = limpiarSinAcentosPersonal(r.NOMBRE_COMPLETO || r.NOMBRE || r.NOMBRES || '');
                const rfc = limpiarSinAcentosPersonal(r.RFC || r.CLAVE || '').replace(/[^A-Z0-9]/g, '');
                const rol = limpiarSinAcentosPersonal(r.ROL || r.CARGO || r.PUESTO || 'DOCENTE');
                const turno = r.TURNO || 'Matutino';
                const correo = String(r.CORREO_INSTITUCIONAL || r.CORREO || r.EMAIL || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
                const telefono = String(r.TELEFONO || r.CELULAR || r.TEL || '').replace(/[^0-9]/g, '');

                if (!nombre) {
                    personalInvalidoAnalisis.push({
                        fila: idx + 2,
                        nombre: '(Sin nombre)',
                        rfc: rfc || '-',
                        correo: correo || '-',
                        motivo: 'Falta el nombre completo del personal/docente'
                    });
                    return;
                }

                if (!rfc && !correo) {
                    personalInvalidoAnalisis.push({
                        fila: idx + 2,
                        nombre: nombre,
                        rfc: '-',
                        correo: '-',
                        motivo: 'No incluye RFC ni Correo Electrónico para identificación'
                    });
                    return;
                }

                // Verificar si ya existe en la base de datos
                const existenteBD = (rfc ? mapaExistentesPorRfc.get(rfc) : null) || (correo ? mapaExistentesPorCorreo.get(correo) : null);
                if (existenteBD) {
                    personalExistenteAnalisis.push({
                        fila: idx + 2,
                        nombreExcel: nombre,
                        nombreBD: existenteBD.nombre || nombre,
                        rfc: rfc || existenteBD.rfc || '-',
                        correo: correo || existenteBD.correo || '-',
                        rol: existenteBD.rol || rol,
                        turno: existenteBD.turno || turno,
                        motivo: 'Ya registrado en la BD (No se modificará ni sobrescribirá)'
                    });
                    return;
                }

                // Verificar si está repetido dentro del mismo archivo Excel
                if ((rfc && rfcsVistosEnExcel.has(rfc)) || (correo && correosVistosEnExcel.has(correo))) {
                    personalExistenteAnalisis.push({
                        fila: idx + 2,
                        nombreExcel: nombre,
                        nombreBD: nombre,
                        rfc: rfc || '-',
                        correo: correo || '-',
                        rol: rol,
                        turno: turno,
                        motivo: 'Fila duplicada en el mismo Excel (Omitida)'
                    });
                    return;
                }

                if (rfc) rfcsVistosEnExcel.add(rfc);
                if (correo) correosVistosEnExcel.add(correo);

                personalNuevoPendiente.push({
                    nombre: nombre,
                    rfc: rfc || null,
                    rol: rol,
                    turno: turno,
                    correo: correo || null,
                    telefono: telefono || null,
                    qrCode: rfc || correo,
                    estatus: 'Activo'
                });
            });

            // Renderizar la ventana de análisis con tabs y tarjetas resumen
            mostrarResumenAnalisisPersonal(file.name, rawRows.length);

        } catch(err) {
            console.error("Error al leer Excel masivo:", err);
            if (resumenDiv) resumenDiv.style.display = 'none';
            Swal.fire("Error", "No se pudo procesar el archivo Excel. Verifica el formato.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

function mostrarResumenAnalisisPersonal(nombreArchivo, totalLeidos) {
    const resumenDiv = document.getElementById('resumenExcelMasivo');
    const btnEjecutar = document.getElementById('btnEjecutarCargaMasiva');

    const cantNuevos = personalNuevoPendiente.length;
    const cantExistentes = personalExistenteAnalisis.length;
    const cantInvalidos = personalInvalidoAnalisis.length;

    const tabActivaNuevos = cantNuevos > 0;
    const tabActivaExistentes = !tabActivaNuevos && cantExistentes > 0;
    const tabActivaInvalidos = !tabActivaNuevos && !tabActivaExistentes && cantInvalidos > 0;

    const filasNuevosHtml = cantNuevos > 0
        ? personalNuevoPendiente.map((u, idx) => `
            <tr>
                <td class="text-muted small">${idx + 1}</td>
                <td class="fw-bold text-dark small">${u.nombre}</td>
                <td class="font-monospace small">${u.rfc || '<span class="text-muted fst-italic">Sin RFC</span>'}</td>
                <td><span class="badge bg-light text-dark border small">${u.rol}</span></td>
                <td class="small">${u.turno}</td>
                <td class="small text-muted">${u.correo || '-'}</td>
                <td class="small">${u.telefono || '-'}</td>
                <td class="text-center"><span class="badge bg-success-subtle text-success border border-success-subtle">Nuevo a registrar</span></td>
            </tr>
        `).join('')
        : `<tr><td colspan="8" class="text-center text-muted py-4">No hay nuevos registros de personal para importar en este archivo.</td></tr>`;

    const filasExistentesHtml = cantExistentes > 0
        ? personalExistenteAnalisis.map((ex, idx) => `
            <tr class="table-warning">
                <td class="text-muted small">${idx + 1}</td>
                <td class="fw-bold text-dark small">${ex.nombreBD}</td>
                <td class="font-monospace small">${ex.rfc}</td>
                <td><span class="badge bg-light text-dark border small">${ex.rol}</span></td>
                <td class="small text-muted">${ex.correo}</td>
                <td class="text-center"><span class="badge bg-warning text-dark"><i class="bi bi-shield-lock-fill me-1"></i>${ex.motivo}</span></td>
            </tr>
        `).join('')
        : `<tr><td colspan="6" class="text-center text-muted py-4">Ningún registro del archivo coincide con personal ya registrado.</td></tr>`;

    const filasInvalidosHtml = cantInvalidos > 0
        ? personalInvalidoAnalisis.map((inv) => `
            <tr class="table-danger">
                <td class="small fw-bold">Fila ${inv.fila}</td>
                <td class="small fw-bold">${inv.nombre}</td>
                <td class="font-monospace small">${inv.rfc}</td>
                <td class="small text-muted">${inv.correo}</td>
                <td class="small text-danger fw-bold"><i class="bi bi-x-circle-fill me-1"></i>${inv.motivo}</td>
            </tr>
        `).join('')
        : `<tr><td colspan="5" class="text-center text-muted py-4">No se detectaron filas con datos incompletos.</td></tr>`;

    if (resumenDiv) {
        resumenDiv.style.display = 'block';
        resumenDiv.innerHTML = `
            <div class="alert alert-light border shadow-sm mb-3 py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <i class="bi bi-file-earmark-spreadsheet-fill text-guinda me-2 fs-5"></i>
                    <strong>Archivo:</strong> <span class="text-dark">${nombreArchivo}</span>
                </div>
                <span class="badge bg-dark rounded-pill px-3 py-2">Total filas en Excel: ${totalLeidos}</span>
            </div>

            <div class="row g-3 mb-3">
                <div class="col-md-4">
                    <div class="p-3 rounded-3 border bg-success-subtle border-success-subtle h-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small fw-bold text-success text-uppercase">Nuevos a Importar</div>
                                <div class="fs-3 fw-bold text-success">${cantNuevos}</div>
                            </div>
                            <i class="bi bi-person-plus-fill fs-1 text-success opacity-75"></i>
                        </div>
                        <small class="text-muted d-block mt-1">Se crearán en la base de datos.</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 rounded-3 border bg-warning-subtle border-warning-subtle h-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small fw-bold text-dark text-uppercase">Ya Existentes (Omitidos)</div>
                                <div class="fs-3 fw-bold text-dark">${cantExistentes}</div>
                            </div>
                            <i class="bi bi-person-check-fill fs-1 text-warning opacity-75"></i>
                        </div>
                        <small class="text-dark d-block mt-1"><strong>No se actualizarán</strong> ni modificarán.</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 rounded-3 border bg-danger-subtle border-danger-subtle h-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small fw-bold text-danger text-uppercase">Descartados / Inválidos</div>
                                <div class="fs-3 fw-bold text-danger">${cantInvalidos}</div>
                            </div>
                            <i class="bi bi-exclamation-octagon-fill fs-1 text-danger opacity-75"></i>
                        </div>
                        <small class="text-muted d-block mt-1">Sin nombre o sin RFC/Correo.</small>
                    </div>
                </div>
            </div>

            <ul class="nav nav-pills mb-3 bg-light p-1 rounded border" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${tabActivaNuevos ? 'active' : ''} fw-bold small" data-bs-toggle="pill" data-bs-target="#tabNuevosPersonal" type="button" role="tab">
                        <i class="bi bi-check-circle-fill text-success me-1"></i>Nuevos a Importar (${cantNuevos})
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${tabActivaExistentes ? 'active' : ''} fw-bold small" data-bs-toggle="pill" data-bs-target="#tabExistentesPersonal" type="button" role="tab">
                        <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>Ya Existentes - No se actualizarán (${cantExistentes})
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${tabActivaInvalidos ? 'active' : ''} fw-bold small" data-bs-toggle="pill" data-bs-target="#tabInvalidosPersonal" type="button" role="tab">
                        <i class="bi bi-x-circle-fill text-danger me-1"></i>Inválidos (${cantInvalidos})
                    </button>
                </li>
            </ul>

            <div class="tab-content border rounded-3 bg-white">
                <div class="tab-pane fade ${tabActivaNuevos ? 'show active' : ''}" id="tabNuevosPersonal" role="tabpanel">
                    <div class="table-responsive" style="max-height: 280px;">
                        <table class="table table-sm table-hover align-middle mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>#</th>
                                    <th>Nombre Completo</th>
                                    <th>RFC</th>
                                    <th>Rol</th>
                                    <th>Turno</th>
                                    <th>Correo</th>
                                    <th>Teléfono</th>
                                    <th class="text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>${filasNuevosHtml}</tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-pane fade ${tabActivaExistentes ? 'show active' : ''}" id="tabExistentesPersonal" role="tabpanel">
                    <div class="table-responsive" style="max-height: 280px;">
                        <table class="table table-sm table-hover align-middle mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>#</th>
                                    <th>Personal Registrado en BD</th>
                                    <th>RFC</th>
                                    <th>Rol Actual</th>
                                    <th>Correo</th>
                                    <th class="text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody>${filasExistentesHtml}</tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-pane fade ${tabActivaInvalidos ? 'show active' : ''}" id="tabInvalidosPersonal" role="tabpanel">
                    <div class="table-responsive" style="max-height: 280px;">
                        <table class="table table-sm table-hover align-middle mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>Fila</th>
                                    <th>Nombre Leído</th>
                                    <th>RFC</th>
                                    <th>Correo</th>
                                    <th>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>${filasInvalidosHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    if (btnEjecutar) {
        if (cantNuevos > 0) {
            btnEjecutar.style.display = 'inline-block';
            btnEjecutar.disabled = false;
            btnEjecutar.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-2"></i>Confirmar e Importar (${cantNuevos} Nuevos)`;
        } else {
            btnEjecutar.style.display = 'none';
        }
    }
}

// 10. EJECUTAR IMPORTACIÓN MASIVA A BASE DE DATOS
async function ejecutarImportacionMasiva() {
    if (!personalNuevoPendiente || personalNuevoPendiente.length === 0) {
        return Swal.fire("Aviso", "No hay registros nuevos de personal para importar.", "warning");
    }

    const btnEjecutar = document.getElementById('btnEjecutarCargaMasiva');
    const progresoModal = document.getElementById('progresoModalPersonal');
    const barraModal = document.getElementById('barraProgresoModalPersonal');
    const textoModal = document.getElementById('textoProgresoModalPersonal');

    if (btnEjecutar) btnEjecutar.disabled = true;
    if (progresoModal) progresoModal.classList.remove('d-none');

    let exitosos = 0;
    let fallos = 0;
    const duplicados = personalExistenteAnalisis.length;
    const invalidos = personalInvalidoAnalisis.length;

    try {
        const lotes = [];
        for (let i = 0; i < personalNuevoPendiente.length; i += 50) {
            lotes.push(personalNuevoPendiente.slice(i, i + 50));
        }

        for (let idx = 0; idx < lotes.length; idx++) {
            const lote = lotes[idx];
            try {
                const res = await fetch('/api/usuarios/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(lote)
                });

                if (res.ok) {
                    const data = await res.json();
                    exitosos += data.insertados || lote.length;
                } else {
                    fallos += lote.length;
                }
            } catch (errBatch) {
                fallos += lote.length;
            }

            const procesados = Math.min(personalNuevoPendiente.length, (idx + 1) * 50);
            const pct = Math.min(100, Math.round((procesados / personalNuevoPendiente.length) * 100));

            if (barraModal) barraModal.style.width = pct + "%";
            if (textoModal) textoModal.innerText = `Importando lote ${idx + 1} de ${lotes.length}... (${pct}%)`;

            await new Promise(resolve => setTimeout(resolve, 20));
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCargaMasiva'));
        if (modal) modal.hide();

        Swal.fire({
            icon: 'success',
            title: '¡Carga Masiva Exitosa!',
            html: `<div class="text-start p-3 bg-light rounded border">
                <p class="mb-1 text-success"><strong>✅ Nuevos importados:</strong> ${exitosos}</p>
                <p class="mb-1 text-warning"><strong>⚠️ Ya existentes (omitidos sin actualizar):</strong> ${duplicados}</p>
                <p class="mb-0 text-danger"><strong>❌ Descartados / Inválidos:</strong> ${invalidos + fallos}</p>
            </div>`,
            confirmButtonColor: '#7b1b37'
        });

        personalNuevoPendiente = [];
        personalExistenteAnalisis = [];
        personalInvalidoAnalisis = [];
        document.getElementById('excelMasivoInput').value = '';
        if (document.getElementById('resumenExcelMasivo')) document.getElementById('resumenExcelMasivo').style.display = 'none';
        if (btnEjecutar) btnEjecutar.style.display = 'none';

        await listarUsuarios(true);

    } catch (e) {
        Swal.fire("Error", "Ocurrió un error en la carga masiva: " + e.message, "error");
        if (btnEjecutar) btnEjecutar.disabled = false;
        if (progresoModal) progresoModal.classList.add('d-none');
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
        const fotoReal = user.fotoUrl || '/img/default_avatar.png';
        recuadroFoto.style.backgroundImage = `url('${fotoReal}')`;
        recuadroFoto.style.backgroundPosition = 'center';
        recuadroFoto.style.backgroundRepeat = 'no-repeat';
        recuadroFoto.style.backgroundSize = 'cover';
        if (fotoReal !== '/img/default_avatar.png') {
            const probe = new Image();
            probe.onerror = () => {
                recuadroFoto.style.backgroundImage = `url('/img/default_avatar.png')`;
            };
            probe.src = fotoReal;
        }
    }

    const persSelloImg = document.getElementById('persPvcSelloInstitucionalImg');
    if (persSelloImg) {
        const selloUrl = cfgSistemaPersonal.sello_institucional_url || cfgSistemaPersonal.sello_institucional_base64 || '';
        if (selloUrl) {
            persSelloImg.src = selloUrl;
            persSelloImg.style.display = 'block';
        } else {
            persSelloImg.style.display = 'none';
        }
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

    if (document.getElementById('persPvcDirector')) {
        document.getElementById('persPvcDirector').innerText = cfgSistemaPersonal.nombre_director || "Dirección del Plantel";
    }
    const persFirmaImg = document.getElementById('persPvcFirmaDirectorImg');
    if (persFirmaImg) {
        const firmaUrl = cfgSistemaPersonal.firma_director_url || cfgSistemaPersonal.firma_director_base64 || '';
        if (firmaUrl) {
            persFirmaImg.src = firmaUrl;
            persFirmaImg.style.display = 'block';
        } else {
            persFirmaImg.style.display = 'none';
        }
    }
    if (document.getElementById('persPvcTelefono')) {
        document.getElementById('persPvcTelefono').innerText = cfgSistemaPersonal.telefono_escuela || '';
    }
    if (document.getElementById('persPvcDireccion')) {
        document.getElementById('persPvcDireccion').innerText = cfgSistemaPersonal.direccion_plantel || '';
    }

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
        const idFallback = String(texto || 'PERSONAL').split('|')[0].trim();
        const textoLimpio = String(texto || idFallback)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\x20-\x7E]/g, "")
            .trim()
            .substring(0, 48) || 'PERSONAL';
        
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(divTemporal, { 
                    text: textoLimpio, 
                    width: size, 
                    height: size, 
                    colorDark : "#000000", 
                    colorLight : "#ffffff", 
                    correctLevel: QRCode.CorrectLevel.M 
                });
            } catch (errQr) {
                divTemporal.innerHTML = "";
                new QRCode(divTemporal, { 
                    text: idFallback.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").substring(0, 30) || 'PERSONAL', 
                    width: size, 
                    height: size, 
                    colorDark : "#000000", 
                    colorLight : "#ffffff", 
                    correctLevel: QRCode.CorrectLevel.L 
                });
            }

            setTimeout(() => {
                const canvas = divTemporal.querySelector('canvas');
                const imgQrGenerado = divTemporal.querySelector('img');
                if (canvas && canvas.width > 0) {
                    resolve(canvas.toDataURL("image/png"));
                } else if (imgQrGenerado && imgQrGenerado.src) {
                    resolve(imgQrGenerado.src);
                } else {
                    resolve('/img/default_avatar.png');
                }
            }, 100);
        } else {
            resolve('/img/default_avatar.png');
        }
    });
}

async function generarImagenGafetePersonal(user) {
    return new Promise(async (resolve, reject) => {
        if (!user) return reject("Usuario no proporcionado");

        const SCALE = 3; // Ultra HD: 1200 x 1680 píxeles (~360 DPI para impresión nítida)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400 * SCALE; 
        canvas.height = 560 * SCALE;

        // Escalar contexto para gráficos y tipografías vectoriales ultra nítidas
        ctx.scale(SCALE, SCALE);

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

        const logoEscuelaSrc = obtenerLogoAltaResolucionPersonal(cfgSistemaPersonal.logo_plantel_url, 'plantel');
        const logoInicioSrc = obtenerLogoAltaResolucionPersonal(cfgSistemaPersonal.logo_inicio_url, 'inicio');
        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis No. 134';

        const imgEscuela = new Image();
        const imgTigre = new Image();
        const imgFoto = new Image();
        imgEscuela.crossOrigin = "anonymous";
        imgTigre.crossOrigin = "anonymous";
        imgFoto.crossOrigin = "anonymous";

        let cargas = 0;
        let renderizado = false;
        const totalImagenes = 3;
        const alCargarImg = () => {
            cargas++;
            if (cargas < totalImagenes || renderizado) return;
            renderizado = true;

            const dibujarMedallonCircular = (imgObj, cx, cy, r) => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fillStyle = "#FFFFFF";
                ctx.fill();
                ctx.clip();
                try {
                    if (imgObj && imgObj.complete && imgObj.naturalWidth > 0) {
                        const maxDim = (r - 3) * 2;
                        const iw = imgObj.naturalWidth || imgObj.width || maxDim;
                        const ih = imgObj.naturalHeight || imgObj.height || maxDim;
                        const ratio = Math.min(maxDim / iw, maxDim / ih);
                        const dw = iw * ratio;
                        const dh = ih * ratio;
                        ctx.drawImage(imgObj, cx - dw / 2, cy - dh / 2, dw, dh);
                    }
                } catch (eImg) {}
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            };

            dibujarMedallonCircular(imgEscuela, 48, 44, 30);
            dibujarMedallonCircular(imgTigre, 352, 44, 30);

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

            // Fotografía de la persona con ajuste Cover proporcional (sin estirar ni aplastar rostros)
            const fotoX = 50, fotoY = 173, fotoW = 130, fotoH = 130, fotoR = 8;
            try {
                if (imgFoto && imgFoto.complete && imgFoto.naturalWidth > 0) {
                    dibujarFotoCoverCanvas(ctx, imgFoto, fotoX, fotoY, fotoW, fotoH, fotoR);
                } else {
                    ctx.save();
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(fotoX, fotoY, fotoW, fotoH, fotoR);
                    else ctx.rect(fotoX, fotoY, fotoW, fotoH);
                    ctx.closePath();
                    ctx.clip();
                    ctx.fillStyle = "#f1f5f9";
                    ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
                    ctx.fillStyle = "#94a3b8";
                    ctx.beginPath();
                    ctx.arc(fotoX + fotoW / 2, fotoY + fotoH * 0.38, fotoW * 0.22, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(fotoX + fotoW / 2, fotoY + fotoH * 0.95, fotoW * 0.38, Math.PI, 0, false);
                    ctx.fill();
                    ctx.restore();
                }
            } catch (eFoto) {}

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
                imgQR.onload = () => {
                    try {
                        ctx.drawImage(imgQR, 220, 173, 130, 130);
                    } catch (eQr) {}
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
                imgQR.src = qrDataUrl;
            });
        };

        imgEscuela.onload = alCargarImg;
        imgTigre.onload = alCargarImg;
        imgFoto.onload = alCargarImg;

        imgEscuela.onerror = () => {
            if (!imgEscuela.src.includes('logo_aniversario.jpg')) {
                imgEscuela.src = '/img/logo_aniversario.jpg';
            } else {
                alCargarImg();
            }
        };
        imgTigre.onerror = () => {
            if (!imgTigre.src.includes('tigres.png')) {
                imgTigre.src = '/img/tigres.png';
            } else {
                alCargarImg();
            }
        };
        imgFoto.onerror = () => {
            if (!imgFoto.src.includes('default_avatar.png')) {
                imgFoto.src = '/img/default_avatar.png';
            } else {
                alCargarImg();
            }
        };

        imgEscuela.src = logoEscuelaSrc;
        imgTigre.src = logoInicioSrc;
        imgFoto.src = obtenerUrlFotoPersonalAltaResolucion(user);
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

function obtenerUrlFotoPersonalAltaResolucion(user) {
    if (!user) return '/img/default_avatar.png';
    const rfc = (user.rfc || user.curp || user.uid || user.id || '').toString().trim();
    if (user.fotoUrl && user.fotoUrl.startsWith('/uploads/')) return user.fotoUrl;
    if (rfc) {
        return `/uploads/usuarios/${encodeURIComponent(rfc)}.jpg`;
    }
    if (user.fotoUrl && !user.fotoUrl.startsWith('data:')) return user.fotoUrl;
    return user.fotoUrl || '/img/default_avatar.png';
}

function obtenerLogoAltaResolucionPersonal(urlConfig, tipo) {
    if (urlConfig && urlConfig.startsWith('/uploads/')) return urlConfig;
    if (urlConfig && !urlConfig.startsWith('data:')) return urlConfig;
    if (tipo === 'plantel') {
        return '/uploads/logos/logo_plantel.png';
    } else {
        return '/uploads/logos/logo_inicio.png';
    }
}

/**
 * Dibuja una imagen sobre un contexto 2D de canvas aplicando recorte inteligente proporcional (object-fit: cover)
 * para evitar que las fotos de personal y alumnos se estiren, alarguen o deformen.
 */
function dibujarFotoCoverCanvas(ctx, img, x, y, w, h, r = 0) {
    if (!img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const targetAspect = w / h;
    const imgAspect = iw / ih;

    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (imgAspect > targetAspect) {
        sw = ih * targetAspect;
        sx = (iw - sw) / 2;
    } else {
        sh = iw / targetAspect;
        sy = (ih - sh) * 0.25; // 25% superior para encuadrar adecuadamente cabeza y rostro
        if (sy < 0) sy = 0;
        if (sy + sh > ih) sy = ih - sh;
    }

    ctx.save();
    ctx.beginPath();
    if (r > 0 && ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
    } else if (r > 0) {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
    } else {
        ctx.rect(x, y, w, h);
    }
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
}

/**
 * Recorta asíncronamente una fotografía al aspect ratio exacto requerido (por ej. 26mm x 32mm)
 * generando un PNG en ultra alta resolución (600x738 px @ ~600 DPI). Al coincidir el aspect ratio
 * de la imagen con el contenedor HTML, html2canvas no sufre de deformaciones ni rostros alargados.
 */
async function recortarFotoAspectoHD(url, targetWmm, targetHmm) {
    return new Promise((resolve) => {
        if (!url) return resolve('/img/default_avatar.png');
        
        let terminado = false;
        const finalizar = (resVal) => {
            if (terminado) return;
            terminado = true;
            resolve(resVal);
        };

        const timerSeguridad = setTimeout(() => finalizar(url), 2000);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            clearTimeout(timerSeguridad);
            try {
                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;
                if (!iw || !ih) return finalizar(url);

                const targetAspect = targetWmm / targetHmm;
                const imgAspect = iw / ih;

                let sx = 0, sy = 0, sw = iw, sh = ih;
                if (imgAspect > targetAspect) {
                    sw = ih * targetAspect;
                    sx = (iw - sw) / 2;
                } else {
                    sh = iw / targetAspect;
                    sy = (ih - sh) * 0.25;
                    if (sy < 0) sy = 0;
                    if (sy + sh > ih) sy = ih - sh;
                }

                const c = document.createElement('canvas');
                c.width = 400;
                c.height = Math.round(400 / targetAspect);
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);

                finalizar(c.toDataURL('image/jpeg', 0.95));
            } catch (e) {
                finalizar(url);
            }
        };
        img.onerror = () => {
            clearTimeout(timerSeguridad);
            finalizar(url);
        };
        img.src = url;
    });
}

async function generarCanvasCredencialPersonalFrente(user) {
    return new Promise(async (resolve) => {
        let container = document.getElementById('tempCardContainerPersonal');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tempCardContainerPersonal';
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
        }

        const nombre = (user.nombre || '').toUpperCase();
        const rfc = (user.rfc || 'SIN RFC').toUpperCase();
        const rol = (user.rol || 'DOCENTE').toUpperCase();
        const turno = user.turno || 'Matutino';
        const fotoSrcOriginal = obtenerUrlFotoPersonalAltaResolucion(user);
        const fotoSrc = await recortarFotoAspectoHD(fotoSrcOriginal, 26, 32);
        const colorRol = (rol === 'DOCENTE') ? '#6f42c1' : ((rol === 'ADMINISTRATIVO') ? '#0d6efd' : '#7b1b37');

        const logoEscuelaSrc = obtenerLogoAltaResolucionPersonal(cfgSistemaPersonal.logo_plantel_url, 'plantel');
        const logoInicioSrc = obtenerLogoAltaResolucionPersonal(cfgSistemaPersonal.logo_inicio_url, 'inicio');
        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis 134';
        const vigencia = cfgSistemaPersonal.vigencia_actual || 'AGOSTO 2026 - JULIO 2027';
        const selloInstitucionalSrc = cfgSistemaPersonal.sello_institucional_url || cfgSistemaPersonal.sello_institucional_base64 || '';

        container.innerHTML = `
            <div id="cardPersFrenteTemp" style="width: 54mm; height: 85.6mm; background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); height: 12mm; min-height: 12mm; max-height: 12mm; box-sizing: border-box; padding: 3px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    <img src="${logoEscuelaSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('logo_aniversario.jpg')) this.src='/img/logo_aniversario.jpg';">
                    <div style="text-align: center; flex: 1; margin: 0 4px;">
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff;">${nomPlantel}</div>
                        <div style="font-size: 5.5px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; display: inline-block; color: #ffe699; letter-spacing: 0.5px; margin-top: 1px;">CREDENCIAL DE PERSONAL</div>
                    </div>
                    <img src="${logoInicioSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('tigres.png')) this.src='/img/tigres.png';">
                </div>
                
                <div style="padding: 2px 8px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly;">
                    <div style="margin: 0 auto; position: relative; display: inline-block;">
                        <div style="width: 26mm; height: 32mm; background: #f1f5f9; border: 2.5px solid #7b1b37; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 8px rgba(123, 27, 55, 0.25); display: flex; align-items: center; justify-content: center; position: relative;">
                            <img src="${fotoSrc}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('default_avatar.png')) this.src='/img/default_avatar.png';" />
                        </div>
                        ${selloInstitucionalSrc ? `
                            <img src="${selloInstitucionalSrc}" crossorigin="anonymous" style="position: absolute; right: -7mm; bottom: -11mm; width: 19mm; height: 19mm; z-index: 10; pointer-events: none; object-fit: contain; mix-blend-mode: multiply; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));" onerror="this.style.display='none';">
                        ` : ''}
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
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; height: 8.5mm; min-height: 8.5mm; max-height: 8.5mm; box-sizing: border-box; padding: 2px 6px; border-top: 2px solid #d4af37; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 5.5px; font-weight: 800; letter-spacing: 0.3px;">
                        <span>VIGENCIA: <strong style="color: #ffe699;">${vigencia}</strong></span>
                        <span>${nomPlantel}</span>
                    </div>
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const imgs = Array.from(targetEl.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(res => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2500);
            });
        }));

        try {
            const canvas = await html2canvas(targetEl, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                imageTimeout: 5000,
                logging: false
            });

            container.innerHTML = "";
            resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch (err) {
            console.error("Error renderizando canvas credencial frente:", err);
            container.innerHTML = "";
            resolve(null);
        }
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
            container.style.top = '0';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
        }

        const qrTexto = (user.qrCode || user.rfc || user.uid || user.nombre || '').trim();
        const qrImgData = await generarQRConTigrePersonal(qrTexto);

        const logoEscuelaSrc = obtenerLogoAltaResolucionPersonal(cfgSistemaPersonal.logo_plantel_url, 'plantel');
        const logoInicioSrc = obtenerLogoAltaResolucionPersonal(cfgSistemaPersonal.logo_inicio_url, 'inicio');
        const nomPlantel = cfgSistemaPersonal.nombre_plantel || 'CBTis 134';
        const director = cfgSistemaPersonal.nombre_director || 'JOSE MARTÍN RODEA ZUÑIGA';
        const cct = cfgSistemaPersonal.cct_escuela || '12DCT0001L';
        const telPlantel = cfgSistemaPersonal.telefono_escuela || '';
        const dirPlantel = cfgSistemaPersonal.direccion_plantel || '';
        const firmaDirectorSrc = cfgSistemaPersonal.firma_director_url || cfgSistemaPersonal.firma_director_base64 || '';

        container.innerHTML = `
            <div id="cardPersReversoTemp" style="width: 54mm; height: 85.6mm; background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); height: 12mm; min-height: 12mm; max-height: 12mm; box-sizing: border-box; padding: 3px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px;">
                    <img src="${logoEscuelaSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('logo_aniversario.jpg')) this.src='/img/logo_aniversario.jpg';">
                    <div style="text-align: center; flex: 1; margin: 0 4px;">
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff;">${nomPlantel}</div>
                        <div style="font-size: 5.5px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; display: inline-block; color: #ffe699; letter-spacing: 0.5px; margin-top: 1px;">CONTROL Y ACCESO BIOMÉTRICO</div>
                    </div>
                    <img src="${logoInicioSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('tigres.png')) this.src='/img/tigres.png';">
                </div>
                
                <div style="padding: 3px 6px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;">
                    <div style="background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 8px; padding: 3px; box-shadow: 0 2px 6px rgba(123, 27, 55, 0.15);">
                        <div style="width: 24mm; height: 24mm; margin: 0 auto;">
                            <img src="${qrImgData}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;">
                        </div>
                        <div style="font-size: 5.2px; font-weight: 800; color: #7b1b37; letter-spacing: 0.5px; margin-top: 1px;">ESCANEAME PARA ACCESO</div>
                    </div>
                    
                    <div style="font-size: 5.5px; font-weight: 600; color: #475569; line-height: 1.25; margin: 1.5px auto; max-width: 48mm;">
                        Esta credencial es personal e intransferible. Acredita al portador como personal adscrito al plantel educativo ${nomPlantel}.
                    </div>
                    
                    <div style="width: 100%; margin-top: 1px; display: flex; flex-direction: column; align-items: center;">
                        <div style="height: 15mm; width: 40mm; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 1px;">
                            ${firmaDirectorSrc ? `<img src="${firmaDirectorSrc}" crossorigin="anonymous" style="max-height: 15mm; max-width: 40mm; object-fit: contain; display: block;" onerror="this.style.display='none';">` : ''}
                        </div>
                        <div style="width: 40mm; border-bottom: 1.5px solid #334155; margin: 0 auto 2px auto;"></div>
                        <div style="font-size: 7.5px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${director}</div>
                        <div style="font-size: 5.6px; color: #64748b; font-weight: 700;">Director del Plantel ${nomPlantel}</div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; height: 8.5mm; min-height: 8.5mm; max-height: 8.5mm; box-sizing: border-box; padding: 2px 6px; border-top: 2px solid #d4af37; border-radius: 10px 10px 0 0; display: flex; flex-direction: column; justify-content: center;">
                    <div style="display: flex; justify-content: space-between; font-size: 5.2px; font-weight: 800; letter-spacing: 0.3px; margin-bottom: 0.5px;">
                        <span>CLAVE CCT: ${cct}</span>
                        ${telPlantel ? `<span>TEL: ${telPlantel}</span>` : ''}
                    </div>
                    ${dirPlantel ? `<div style="font-size: 4.4px; font-weight: 600; color: #ffe699; line-height: 1.15; text-align: center; word-break: break-word;">${dirPlantel}</div>` : ''}
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const imgs = Array.from(targetEl.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(res => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2500);
            });
        }));

        try {
            const canvas = await html2canvas(targetEl, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                imageTimeout: 5000,
                logging: false
            });

            container.innerHTML = "";
            resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch (err) {
            console.error("Error renderizando canvas credencial reverso:", err);
            container.innerHTML = "";
            resolve(null);
        }
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
            if (Swal.isVisible()) {
                Swal.update({
                    text: `Procesando personal ${i + 1} de ${usuariosCache.length} (${(u.nombre || '').toUpperCase()})...`
                });
            }
            const imgFrente = await generarCanvasCredencialPersonalFrente(u);
            const imgReverso = await generarCanvasCredencialPersonalReverso(u);

            if (imgFrente) {
                if (i > 0) pdf.addPage([54, 85.6], 'portrait');
                pdf.addImage(imgFrente, 'JPEG', 0, 0, 54, 85.6, undefined, 'FAST');
            }

            if (imgReverso) {
                pdf.addPage([54, 85.6], 'portrait');
                pdf.addImage(imgReverso, 'JPEG', 0, 0, 54, 85.6, undefined, 'FAST');
            }
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
                instanceName: configWs.instanceName || configWs.sessionName || (window.cfgSistemaGlobal && window.cfgSistemaGlobal.cct_escuela) || 'asistencia',
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

// Refrescar automáticamente al regresar a la vista (evita datos obsoletos por BFCache o navegación hacia atrás)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        listarUsuarios(true);
    }
});
