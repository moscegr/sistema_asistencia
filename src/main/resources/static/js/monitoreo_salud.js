// static/js/monitoreo_salud.js

let alumnosSaludCache = [];
let limiteSalud = 12; 
let modalPadecimiento = null;

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('modalPadecimiento');
    if (modalEl) modalPadecimiento = new bootstrap.Modal(modalEl);

    cargarDatosSalud();

    const buscadorInput = document.getElementById('busquedaSalud');
    if (buscadorInput) {
        buscadorInput.addEventListener('input', filtrarTarjetasSalud);
    }

    const collapseEl = document.getElementById('collapseNuevoRegistro');
    const btnGuardar = document.getElementById('btnGuardarSalud');

	if (collapseEl && btnGuardar) {
	        collapseEl.addEventListener('show.bs.collapse', () => {
	            btnGuardar.style.display = 'block';
	            setTimeout(() => {
	                collapseEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
	            }, 300);
	        });
	        
	        collapseEl.addEventListener('hide.bs.collapse', () => {
	            btnGuardar.style.display = 'none';
	        });
    }
});

async function cargarDatosSalud() {
    const contenedor = document.getElementById('gridSalud');
    if (!contenedor) return;
    
    contenedor.innerHTML = `
        <div class="col-12 text-center p-5 text-muted">
            <div class="spinner-border text-danger mb-2" role="status"></div><br>
            Construyendo expedientes médicos...
        </div>`;

    try {
        const snapAlumnos = await db.collection("alumnos").where("estatus_escolar", "==", "Activo").get();
        let alumnosMap = {};
        
        snapAlumnos.forEach(doc => {
            const al = doc.data();
            alumnosMap[al.matricula] = { 
                ...al, 
                totalFaltasSalud: 0 
            };
        });

        const snapJustificantes = await db.collection("justificantes").get();
        snapJustificantes.forEach(doc => {
            const just = doc.data();
            const mat = just.id_alumno;
            const motivo = (just.motivo_detalle || "").toLowerCase();
            
            if (alumnosMap[mat] && (motivo.includes("enferm") || motivo.includes("salud") || motivo.includes("medic") || motivo.includes("cita"))) {
                alumnosMap[mat].totalFaltasSalud += 1;
            }
        });

        alumnosSaludCache = Object.values(alumnosMap).map(al => {
            let peso = 0;
            if (al.color_semaforo === 'Rojo') peso = 3;
            else if (al.color_semaforo === 'Amarillo') peso = 2;
            else if (al.totalFaltasSalud >= 3) peso = 1; 
            
            return { ...al, prioridadSemaforo: peso };
        });

        alumnosSaludCache.sort((a, b) => b.prioridadSemaforo - a.prioridadSemaforo);
        renderizarTarjetas(alumnosSaludCache);

    } catch (error) {
        console.error("Error cargando salud:", error);
        contenedor.innerHTML = "<div class='col-12 text-center text-danger'>Error al sincronizar expedientes clínicos.</div>";
    }
}

function obtenerColorHex(colorSemaforo) {
    if (colorSemaforo === 'Rojo') return '#dc3545';
    if (colorSemaforo === 'Amarillo') return '#ffc107';
    return '#198754'; 
}

function renderizarTarjetas(listaRenderizar) {
    const contenedor = document.getElementById('gridSalud');
    if (!contenedor) return;
    contenedor.innerHTML = "";

    if (listaRenderizar.length === 0) {
        contenedor.innerHTML = `<div class="col-12 text-center text-muted py-5">No se encontraron estudiantes con esos datos.</div>`;
        return;
    }

    const paginados = listaRenderizar.slice(0, limiteSalud);

    paginados.forEach(al => {
        const colorHex = obtenerColorHex(al.color_semaforo);
        const alertaAusentismo = al.totalFaltasSalud >= 3 
            ? `<span class="badge bg-dark mt-2 w-100"><i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> ${al.totalFaltasSalud} Inasistencias médicas</span>` 
            : '';

        const cantPadecimientos = al.padecimientos_registrados ? al.padecimientos_registrados.length : 0;
        const textoPadecimientos = cantPadecimientos > 0 
            ? `<small class="text-danger fw-bold"><i class="bi bi-file-medical-fill me-1"></i>${cantPadecimientos} Condición(es) registradas</small>` 
            : `<small class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Sin condiciones graves</small>`;

        contenedor.innerHTML += `
            <div class="col-md-6 col-lg-4 col-xl-3 mb-4">
                <div class="card h-100 shadow-sm border-0" style="border-top: 5px solid ${colorHex} !important; cursor: pointer; transition: transform 0.2s;" 
                     onclick="abrirModalPadecimiento('${al.matricula}')"
                     onmouseover="this.style.transform='scale(1.02)'" 
                     onmouseout="this.style.transform='scale(1)'">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge bg-light text-dark border">${al.matricula}</span>
                            <span class="badge rounded-pill" style="background-color: ${colorHex}; color: ${al.color_semaforo === 'Amarillo' ? '#000' : '#fff'}">${al.color_semaforo || 'Verde'}</span>
                        </div>
                        <h6 class="card-title fw-bold text-uppercase mb-1" style="color: #7b1b37; line-height: 1.2;">
                            ${al.nombre} ${al.apepat} ${al.apemat || ''}
                        </h6>
                        <p class="card-text small text-muted mb-2">
                            ${al.especialidad}<br>${al.grado}° "${al.grupo}"
                        </p>
                        ${textoPadecimientos}
                        ${alertaAusentismo}
                    </div>
                </div>
            </div>`;
    });

    if (listaRenderizar.length > limiteSalud) {
        contenedor.innerHTML += `
            <div class="col-12 text-center mt-3 mb-4">
                <button class="btn btn-outline-secondary rounded-pill px-4 fw-bold shadow-sm" onclick="limiteSalud += 12; filtrarTarjetasSalud();">
                    <i class="bi bi-arrow-clockwise me-2"></i>Cargar más expedientes...
                </button>
            </div>`;
    }
}

function filtrarTarjetasSalud() {
    const q = normalizar(document.getElementById('busquedaSalud').value);
    
    if (q === "") {
        renderizarTarjetas(alumnosSaludCache);
        return;
    }

    const filtrados = alumnosSaludCache.filter(al => {
        const nombreStr = normalizar(`${al.nombre} ${al.apepat} ${al.apemat}`);
        return nombreStr.includes(q) || normalizar(al.matricula).includes(q) || normalizar(al.especialidad).includes(q);
    });

    const limiteTemp = limiteSalud; 
    limiteSalud = 12; 
    renderizarTarjetas(filtrados);
    limiteSalud = limiteTemp; 
}

// --- LÓGICA DE GUARDADO, VISUALIZACIÓN Y ELIMINACIÓN ---
function abrirModalPadecimiento(matricula) {
    const al = alumnosSaludCache.find(a => a.matricula === matricula);
    if (!al) return;
    
    const rol = rolUsuarioActual ? rolUsuarioActual.toUpperCase() : "";
    const puedeEditar = (rol === 'ADMIN' || rol === 'ORIENTACION');

    const collapseEl = document.getElementById('collapseNuevoRegistro');
    if (collapseEl) {
        const bsCollapse = bootstrap.Collapse.getInstance(collapseEl);
        if (bsCollapse) bsCollapse.hide();
        else document.getElementById('btnGuardarSalud').style.display = 'none';
    }

    document.getElementById('saludMatricula').value = al.matricula;
    document.getElementById('saludNombreAlumno').innerText = `${al.nombre} ${al.apepat} ${al.apemat}`.toUpperCase();

    document.getElementById('saludTipo').value = "";
    document.getElementById('saludGravedad').value = "Verde";
    document.getElementById('saludDetalles').value = "";
    
    const infoPrevia = document.getElementById('infoPreviaPadecimientos');
    if (infoPrevia) {
        if (al.padecimientos_registrados && al.padecimientos_registrados.length > 0) {
            let listaHtml = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="small fw-bold text-muted text-uppercase mb-0">Historial Médico</h6>
                    <span class="badge rounded-pill bg-light text-dark border">${al.padecimientos_registrados.length} registros</span>
                </div>
                <div class="list-group">`;
            
            al.padecimientos_registrados.forEach((p, idx) => {
                let badgeColor = p.gravedad === 'Rojo' ? 'danger' : (p.gravedad === 'Amarillo' ? 'warning' : 'success');
                
                listaHtml += `
                    <div class="list-group-item bg-white shadow-sm border-0 mb-2 rounded p-2" style="border-left: 4px solid var(--bs-${badgeColor}) !important;">
                        <div class="d-flex justify-content-between align-items-start">
                            <div style="flex: 1;">
                                <div class="d-flex align-items-center mb-1">
                                    <span class="badge bg-${badgeColor} p-1 me-2" style="font-size: 0.6rem;">${p.gravedad.toUpperCase()}</span>
                                    <span class="small fw-bold text-dark">${p.tipo}</span>
                                </div>
                                <p class="mb-0 text-muted" style="font-size: 0.75rem; line-height: 1.2;">${p.detalles || 'Sin detalles'}</p>
                            </div>
                            ${puedeEditar ? `
                                <button class="btn btn-sm text-danger p-0 ms-2" onclick="eliminarPadecimiento('${matricula}', ${idx})">
                                    <i class="bi bi-trash-fill" style="font-size: 0.9rem;"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>`;
            });
            infoPrevia.innerHTML = listaHtml + '</div>';
        } else {
            infoPrevia.innerHTML = `
                <div class="text-center py-3 bg-light rounded border-dashed">
                    <i class="bi bi-shield-check text-success fs-2"></i>
                    <p class="text-muted small mb-0">Expediente limpio. Sin padecimientos.</p>
                </div>`;
        }
    }

    if(modalPadecimiento) modalPadecimiento.show();
}

// Función auxiliar para saber el color global basado en el array de padecimientos
function recalcularSemaforoGlobal(padecimientosArray) {
    if (!padecimientosArray || padecimientosArray.length === 0) return 'Verde';
    if (padecimientosArray.some(p => p.gravedad === 'Rojo')) return 'Rojo';
    if (padecimientosArray.some(p => p.gravedad === 'Amarillo')) return 'Amarillo';
    return 'Verde';
}

async function guardarPadecimiento() {
    const modalEl = document.getElementById('modalPadecimiento');

    const matricula = document.getElementById('saludMatricula').value;
    const tipo = document.getElementById('saludTipo').value.trim();
    const gravedad = document.getElementById('saludGravedad').value;
    const detalles = document.getElementById('saludDetalles').value.trim();

    if (!tipo || tipo.length < 3) {
        return Swal.fire({
            icon: "warning",
            title: "Dato/s incompleto",
            text: "Por favor, escribe el padecimiento (mín. 3 letras).",
            target: modalEl
        });
    }

    if (detalles.length > 300) {
        return Swal.fire({
            icon: "warning",
            title: "Texto muy largo",
            text: "Las indicaciones no deben exceder los 300 caracteres.",
            target: modalEl
        });
    }

    Swal.fire({ 
        title: 'Añadiendo al Expediente...', 
        didOpen: () => Swal.showLoading(),
        target: modalEl
    });

    try {
        const nuevoPadecimiento = {
            tipo: tipo,
            gravedad: gravedad,
            detalles: detalles,
            fecha_registro: new Date().toISOString()
        };

        const al = alumnosSaludCache.find(a => a.matricula === matricula);
        let arrayActual = al.padecimientos_registrados ? [...al.padecimientos_registrados] : [];
        arrayActual.push(nuevoPadecimiento);
        
        let colorFinal = recalcularSemaforoGlobal(arrayActual);

        await db.collection("alumnos").doc(matricula).update({
            color_semaforo: colorFinal, 
            padecimientos_registrados: firebase.firestore.FieldValue.arrayUnion(nuevoPadecimiento)
        });

        al.color_semaforo = colorFinal;
        al.padecimientos_registrados = arrayActual;
        al.prioridadSemaforo = (colorFinal === 'Rojo') ? 3 : (colorFinal === 'Amarillo' ? 2 : 1);
        alumnosSaludCache.sort((a, b) => b.prioridadSemaforo - a.prioridadSemaforo);

        modalPadecimiento.hide();

        Swal.fire({
            icon: "success",
            title: "Éxito",
            text: `Expediente médico actualizado.`,
            target: modalEl
        });
        
        filtrarTarjetasSalud(); 

    } catch (error) {
        console.error("Error al guardar padecimiento:", error);

        Swal.fire({
            icon: "error",
            title: "Error",
            text: "No se pudo registrar.",
            target: modalEl
        });
    }
}

async function eliminarPadecimiento(matricula, index) {
    const modalEl = document.getElementById('modalPadecimiento');
    
    const al = alumnosSaludCache.find(a => a.matricula === matricula);
    if (!al) return;

    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar diagnóstico?',
        text: "Este padecimiento se borrará del historial del alumno.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Sí, eliminar',
        target: modalEl
    });

    if (isConfirmed) {
        Swal.fire({ 
            title: 'Eliminando...', 
            didOpen: () => Swal.showLoading(),
            target: modalEl
        });

        try {
            const padecimientoAEliminar = al.padecimientos_registrados[index];
            
            let nuevoArray = [...al.padecimientos_registrados];
            nuevoArray.splice(index, 1);
            let colorFinal = recalcularSemaforoGlobal(nuevoArray);

            await db.collection("alumnos").doc(matricula).update({
                color_semaforo: colorFinal,
                padecimientos_registrados: firebase.firestore.FieldValue.arrayRemove(padecimientoAEliminar)
            });

            al.color_semaforo = colorFinal;
            al.padecimientos_registrados = nuevoArray;
            al.prioridadSemaforo = (colorFinal === 'Rojo') ? 3 : (colorFinal === 'Amarillo' ? 2 : 1);
            alumnosSaludCache.sort((a, b) => b.prioridadSemaforo - a.prioridadSemaforo);

            await Swal.fire({
                title: "Eliminado",
                text: "El diagnóstico ha sido borrado.",
                icon: "success",
                target: modalEl
            });

            abrirModalPadecimiento(matricula); 
            filtrarTarjetasSalud();

        } catch (e) {
            console.error(e);
            Swal.fire({
                title: "Error",
                text: "No se pudo eliminar: " + e.message,
                icon: "error",
                target: modalEl
            });
        }
    }
}