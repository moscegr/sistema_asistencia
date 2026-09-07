/**
 * Gestión de Docentes y Personal Administrativo - CBTis 134 (MongoDB REST API)
 */

let usuariosCache = [];
let editUserUID = null;
let fotoBase64Temporal = null;
let descriptorFacialTemporal = null;
let filtroRolActual = 'TODOS';
let datosExcelMasivoPendientes = [];

document.addEventListener('DOMContentLoaded', async () => {
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

// 3. Procesar Fotografía y extraer vector FaceID
async function procesarFotoUsuario(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        fotoBase64Temporal = e.target.result;
        document.getElementById('prevFotoUsuario').src = fotoBase64Temporal;

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

    if (fotoBase64Temporal) payload.fotoUrl = fotoBase64Temporal;
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

// 8. DESCARGAR PLANTILLA LAYOUT EXCEL OFICIAL
function descargarPlantillaLayoutExcel() {
    if (typeof XLSX === 'undefined') {
        return Swal.fire("Error", "La librería SheetJS no está disponible.", "error");
    }

    const headers = [
        ["NOMBRE_COMPLETO", "RFC", "ROL", "TURNO", "CORREO_INSTITUCIONAL", "TELEFONO"],
        ["JUAN CARLOS PÉREZ LÓPEZ", "PELJ850101XYZ", "DOCENTE", "Matutino", "juan.perez@cbtis134.edu.mx", "7471234567"],
        ["MARÍA ELENA GÓMEZ RÍOS", "GORM900215ABC", "DOCENTE", "Vespertino", "elena.gomez@cbtis134.edu.mx", "7479876543"],
        ["ROBERTO SÁNCHEZ DÍAZ", "SADR781120H12", "ADMINISTRATIVO", "Tiempo Completo", "roberto.sanchez@cbtis134.edu.mx", "7475551234"],
        ["ANA LAURA TORRES VEGA", "TOVA820410M34", "PREFECTO", "Matutino", "prefectura.mat@cbtis134.edu.mx", "7474448899"]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);

    ws['!cols'] = [
        { wch: 32 }, // NOMBRE_COMPLETO
        { wch: 18 }, // RFC
        { wch: 18 }, // ROL
        { wch: 18 }, // TURNO
        { wch: 35 }, // CORREO_INSTITUCIONAL
        { wch: 16 }  // TELEFONO
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Personal_Docentes");
    XLSX.writeFile(wb, "Plantilla_Personal_Docentes_CBTIS134.xlsx");

    Swal.fire({
        icon: 'success',
        title: 'Plantilla Descargada',
        text: 'Se ha descargado "Plantilla_Personal_Docentes_CBTIS134.xlsx". Rellena los datos e impórtala con el botón Carga Masiva.',
        confirmButtonColor: '#7b1b37'
    });
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