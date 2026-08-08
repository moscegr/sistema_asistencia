let alumnosCache = [];
let especialidadesConfig = [];
let alumnoSeleccionado = null;

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionEscolar();
    await cargarAlumnos();
    conectarEventosFiltros();
});

function conectarEventosFiltros() {
    ['busquedaGeneral', 'filtroEspecialidad', 'filtroEstatus', 'filtroGrado', 'filtroGrupo', 'filtroTurno'].forEach(id => {
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
                selectEsp.innerHTML = '<option value="">-- Todas las Especialidades --</option>';
                especialidadesConfig.forEach(esp => {
                    selectEsp.innerHTML += `<option value="${esp.nombre}">${esp.nombre}</option>`;
                });
            }
        }
    } catch (e) { console.error("Error al cargar especialidades:", e); }
}

async function cargarAlumnos() {
    try {
        const res = await fetch('/api/alumnos');
        if (res.ok) {
            alumnosCache = await res.json();
            
            // Auto-sincronizar cualquier especialidad de alumnos que no esté en la lista
            const especialidadesAlumnos = [...new Set(alumnosCache.map(a => a.especialidad).filter(Boolean))];
            const selectEsp = document.getElementById('filtroEspecialidad');
            if (selectEsp) {
                especialidadesAlumnos.forEach(espNombre => {
                    if (!Array.from(selectEsp.options).some(opt => opt.value === espNombre)) {
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
    const filtroTurno = document.getElementById('filtroTurno')?.value || '';

    const filtrados = alumnosCache.filter(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreCompleto = `${al.nombre} ${pat} ${matApe}`.toLowerCase();
        const estatusVal = (al.estatus_escolar || al.estatus || 'Activo');

        if (busqueda && !nombreCompleto.includes(busqueda) && !mat.includes(busqueda)) return false;
        if (filtroEsp && al.especialidad !== filtroEsp) return false;
        if (filtroEstatus && estatusVal !== filtroEstatus) return false;
        if (filtroGrado && String(al.grado) !== filtroGrado) return false;
        if (filtroGrupo && (al.grupo || '').toUpperCase() !== filtroGrupo) return false;
        if (filtroTurno && al.turno !== filtroTurno) return false;

        return true;
    });

    tbody.innerHTML = "";

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron estudiantes con los filtros seleccionados.</td></tr>`;
        return;
    }

    filtrados.forEach(al => {
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

        tbody.innerHTML += `
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
                        <button class="btn btn-sm btn-outline-secondary" onclick="editarAlumno('${mat}')" title="Editar">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarAlumno('${docId}', '${mat}')" title="Baja y Limpieza Multimedia">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
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
            const src = alumnoSeleccionado.fotoUrl || alumnoSeleccionado.foto_url || alumnoSeleccionado.foto || '/img/logo-256.png';
            fotoEl.src = src;
        }

        const contenedorQR = document.getElementById('imgQR');
        // Usar formato ultra seguro y recortado para evitar cualquier overflow de la librería QRCode
        const qrText = `${matricula}|${alumnoSeleccionado.nombre || ''}`.substring(0, 60);
        if (contenedorQR) {
            contenedorQR.innerHTML = "";
            
            new QRCode(contenedorQR, {
                text: qrText,
                width: 200,
                height: 200,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L 
            });
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