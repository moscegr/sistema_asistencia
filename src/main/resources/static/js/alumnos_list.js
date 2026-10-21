let alumnosCache = [];
let especialidadesConfig = [];
let alumnoSeleccionado = null;
let timerBusquedaAlumnos = null;

document.addEventListener('DOMContentLoaded', () => {
    conectarEventosFiltros();
    Promise.all([
        cargarConfiguracionEscolar(),
        cargarAlumnos()
    ]);
});

function conectarEventosFiltros() {
    const inputBusqueda = document.getElementById('busquedaGeneral');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', () => {
            if (timerBusquedaAlumnos) clearTimeout(timerBusquedaAlumnos);
            timerBusquedaAlumnos = setTimeout(filtrarAlumnos, 65);
        });
    }

    ['filtroEspecialidad', 'filtroEstatus', 'filtroGrado', 'filtroGrupo', 'filtroTurno'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', filtrarAlumnos);
            el.addEventListener('change', filtrarAlumnos);
        }
    });
}

async function cargarConfiguracionEscolar() {
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            especialidadesConfig = data.especialidades || [];
            
            const selectEsp = document.getElementById('filtroEspecialidad');
            if (selectEsp) {
                const existentes = new Set(Array.from(selectEsp.options).map(o => o.value));
                const nuevasOpts = [];
                if (!existentes.has("")) {
                    nuevasOpts.push('<option value="">-- Todas las Especialidades --</option>');
                }
                especialidadesConfig.forEach(esp => {
                    if (esp.nombre && !existentes.has(esp.nombre)) {
                        existentes.add(esp.nombre);
                        nuevasOpts.push(`<option value="${esp.nombre}">${esp.nombre}</option>`);
                    }
                });
                if (nuevasOpts.length > 0) {
                    selectEsp.insertAdjacentHTML('beforeend', nuevasOpts.join(''));
                }
            }
        }
    } catch (e) { console.error("Error al cargar especialidades:", e); }
}

async function cargarAlumnos() {
    try {
        const res = await fetch('/api/alumnos');
        if (res.ok) {
            const raw = await res.json();
            alumnosCache = (Array.isArray(raw) ? raw : []).map(al => {
                const mat = al.ncontrol || al.matricula || '';
                const pat = al.apepat || al.primerApellido || '';
                const matApe = al.apemat || al.segundoApellido || '';
                al._searchStr = `${al.nombre || ''} ${pat} ${matApe} ${mat}`.toLowerCase();
                return al;
            });
            
            // Auto-sincronizar cualquier especialidad de alumnos que no esté en la lista
            const especialidadesAlumnos = [...new Set(alumnosCache.map(a => a.especialidad).filter(Boolean))];
            const selectEsp = document.getElementById('filtroEspecialidad');
            if (selectEsp) {
                const existentes = new Set(Array.from(selectEsp.options).map(o => o.value));
                especialidadesAlumnos.forEach(espNombre => {
                    if (!existentes.has(espNombre)) {
                        existentes.add(espNombre);
                        const option = document.createElement('option');
                        option.value = espNombre;
                        option.textContent = espNombre;
                        selectEsp.appendChild(option);
                    }
                });
            }

            filtrarAlumnos();
        }
    } catch (e) {
        console.error("Error al cargar alumnos:", e);
    }
}

function filtrarAlumnos() {
    const tbody = document.getElementById('tablaAlumnosBody') || document.getElementById('tablaAlumnos');
    if (!tbody) return;

    const busqueda = (document.getElementById('busquedaGeneral')?.value || '').toLowerCase().trim();
    const filtroEsp = document.getElementById('filtroEspecialidad')?.value || '';
    const filtroEstatus = document.getElementById('filtroEstatus')?.value || '';
    const filtroGrado = document.getElementById('filtroGrado')?.value || '';
    const filtroGrupo = (document.getElementById('filtroGrupo')?.value || '').toUpperCase().trim();
    const filtroTurno = (document.getElementById('filtroTurno')?.value || '').toLowerCase();

    const filtrados = alumnosCache.filter(al => {
        const estatusVal = (al.estatus_escolar || al.estatus || 'Activo');

        if (busqueda && !(al._searchStr || '').includes(busqueda)) return false;
        if (filtroEsp && al.especialidad !== filtroEsp) return false;
        if (filtroEstatus && estatusVal !== filtroEstatus) return false;
        if (filtroGrado && String(al.grado) !== filtroGrado) return false;
        if (filtroGrupo && (al.grupo || '').toUpperCase() !== filtroGrupo) return false;
        if (filtroTurno && String(al.turno || '').toLowerCase() !== filtroTurno) return false;

        return true;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron estudiantes con los filtros seleccionados.</td></tr>`;
        return;
    }

    // Renderizado en lote único (O(N)) para eliminar el congelamiento del navegador
    const rowsHtml = filtrados.map(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const estatus = al.estatus_escolar || al.estatus || 'Activo';
        
        let badgeClass = 'bg-success';
        if (estatus === 'Baja') badgeClass = 'bg-danger';
        else if (estatus === 'Egresado') badgeClass = 'bg-secondary';

        const colorSem = getColorSemaforo(al.color_semaforo);
        const docId = al.id || mat;
        const tieneFoto = !!(al.fotoUrl || al.foto_url || al.foto);
        const iconFoto = tieneFoto ? '<i class="bi bi-person-circle text-primary me-1" title="Foto Registrada"></i>' : '';

        return `
            <tr>
                <td class="fw-bold text-guinda">${iconFoto}${mat}</td>
                <td class="text-start">${pat} ${matApe} ${al.nombre}</td>
                <td><span class="badge bg-light text-dark border">${al.especialidad || 'N/A'}</span></td>
                <td>${al.grado || ''}° "${al.grupo || ''}" ${al.turno || ''}</td>
                <td>
                    <span class="badge rounded-circle p-2" style="background-color: ${colorSem};" title="${al.color_semaforo || 'Verde'}"> </span>
                </td>
                <td><span class="badge ${badgeClass}">${estatus}</span></td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-guinda" onclick="verExpedienteQuick('${mat}')" title="Ver Ficha">
                            <i class="bi bi-eye-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="enviarWhatsappPersonalizado('${mat}')" title="Enviar WhatsApp a Tutor">
                            <i class="bi bi-whatsapp"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="editarAlumno('${mat}')" title="Editar">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarAlumno('${docId}', '${mat}')" title="Baja y Limpieza Multimedia">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

async function verExpedienteQuick(matricula) {
    alumnoSeleccionado = alumnosCache.find(a => (a.ncontrol || a.matricula) === matricula);
    if (!alumnoSeleccionado) return;

    try {
        const pat = alumnoSeleccionado.apepat || alumnoSeleccionado.primerApellido || '';
        const matApe = alumnoSeleccionado.apemat || alumnoSeleccionado.segundoApellido || '';

        if (document.getElementById('modalNombre')) document.getElementById('modalNombre').innerText = `${alumnoSeleccionado.nombre} ${pat} ${matApe}`.toUpperCase();
        if (document.getElementById('modalMatricula')) document.getElementById('modalMatricula').innerText = matricula;
        if (document.getElementById('modalEspecialidad')) document.getElementById('modalEspecialidad').innerText = alumnoSeleccionado.especialidad || 'N/A';
        if (document.getElementById('modalGradoGrupo')) document.getElementById('modalGradoGrupo').innerText = `${alumnoSeleccionado.grado || ''}° "${alumnoSeleccionado.grupo || ''}" - ${alumnoSeleccionado.turno || ''}`;

        const fotoEl = document.getElementById('modalFoto');
        if (fotoEl) {
            const src = alumnoSeleccionado.fotoUrl || alumnoSeleccionado.foto_url || alumnoSeleccionado.foto || '/img/default_avatar.png';
            fotoEl.src = src;
        }

        const contenedorQR = document.getElementById('imgQR');
        // Usar formato ASCII sin acentos para evitar el bug de overflow de QRCode.js con UTF-8
        const qrText = `${matricula}|${alumnoSeleccionado.nombre || ''}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\x20-\x7E]/g, "")
            .trim()
            .substring(0, 48);
        if (contenedorQR) {
            contenedorQR.innerHTML = "";
            try {
                new QRCode(contenedorQR, {
                    text: qrText || String(matricula),
                    width: 170,
                    height: 170,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.M 
                });
            } catch (errQr) {
                contenedorQR.innerHTML = "";
                new QRCode(contenedorQR, {
                    text: String(matricula),
                    width: 170,
                    height: 170,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.L 
                });
            }
        }

        const modalEl = document.getElementById('modalQR');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.show();
        }
    } catch (err) { console.error("Error al abrir ficha de alumno:", err); }
}

function editarAlumno(matricula) {
    window.location.href = `/admin/alumnos/nuevo?edit=${matricula}`;
}

async function eliminarAlumno(docId, matricula) {
    const result = await Swal.fire({
        title: '¿Eliminar expediente y multimedia?',
        text: `Se eliminarán el registro del alumno ${matricula}, su foto de perfil, patrón biométrico y archivos multimedia asociados de forma permanente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        confirmButtonText: 'Sí, eliminar todo',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`/api/alumnos/${docId}`, {
                method: 'DELETE'
            });
            Swal.fire('Eliminado', 'El estudiante y todos sus datos multimedia han sido removidos en cascada.', 'success');
            await cargarAlumnos();
        } catch (error) {
            Swal.fire('Error', 'No se pudo procesar la eliminación: ' + error.message, 'error');
        }
    }
}

function limpiarFiltros() {
    ['busquedaGeneral', 'filtroEspecialidad', 'filtroEstatus', 'filtroGrado', 'filtroGrupo', 'filtroTurno'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    filtrarAlumnos();
}

function getColorSemaforo(color) {
    if (!color) return "#6c757d";
    if (color.includes("Verde")) return "#198754";
    if (color.includes("Amarillo")) return "#ffc107";
    return "#dc3545"; 
}

async function enviarWhatsappPersonalizado(matricula) {
    const alumno = alumnosCache.find(a => (a.ncontrol || a.matricula) === matricula);
    if (!alumno) return;

    const tel = alumno.teltutor || (alumno.tutor && alumno.tutor.telefono) || alumno.celular;
    if (!tel) {
        return Swal.fire("Sin número de teléfono", "El estudiante no tiene registrado un número telefónico de tutor.", "warning");
    }

    const pat = alumno.apepat || alumno.primerApellido || '';
    const matApe = alumno.apemat || alumno.segundoApellido || '';
    const nombreCompleto = `${alumno.nombre} ${pat} ${matApe}`.trim();
    const nombreTutor = alumno.nombretutor || alumno.nombre_tutor || alumno.tutor_nombre || alumno.nombreTutor || (typeof alumno.tutor === 'object' ? alumno.tutor?.nombre : alumno.tutor) || 'Padre / Tutor';

    const { value: mensajeTxt } = await Swal.fire({
        title: `<div class="fs-5 fw-bold text-dark mb-0"><i class="bi bi-whatsapp text-success me-2"></i>Enviar WhatsApp a Tutor</div>`,
        html: `
            <div class="text-start small mb-2 p-2 bg-light rounded border">
                <div class="mb-1"><b>Estudiante:</b> ${nombreCompleto}</div>
                <div class="mb-1"><b>Tutor:</b> <span class="fw-bold text-dark">${nombreTutor}</span></div>
                <div><b>Teléfono Tutor:</b> <code class="text-success fw-bold">${tel}</code></div>
            </div>
            <textarea id="swalWsMensajePersonalizado" class="form-control form-control-sm border-success mt-2" placeholder="Escribe tu mensaje aquí..." rows="4" style="width: 100%; box-sizing: border-box; resize: vertical; font-size: 0.9rem; text-transform: none !important;">🏫 *[CBTis 134 - AVISO OFICIAL]*:\n</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send me-1"></i>Enviar Mensaje',
        confirmButtonColor: '#198754',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const val = document.getElementById('swalWsMensajePersonalizado').value.trim();
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
            Swal.fire("¡Mensaje Enviado!", `El mensaje ha sido entregado a la API de WhatsApp con éxito.`, "success");
        } else {
            Swal.fire("Error al Enviar", `La API respondió con error (HTTP ${res.status}): ${resText}`, "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
}
window.enviarWhatsappPersonalizado = enviarWhatsappPersonalizado;