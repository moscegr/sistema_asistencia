/**
 * Incidencias Orientación - CBTis 134 (REST API Spring Boot Backend)
 */

let alumnoSeleccionado = null;
let incidenciasCache = [];
let limiteIncidencias = 10;

const PUNTOS_OFICIALES = [
    "NO PORTA EL UNIFORME CORRECTAMENTE",
    "NO CUMPLE CON LOS TRABAJOS ESCOLARES",
    "UTILIZAR LENGUAJE SOEZ",
    "PROVOCAR DESORDEN EN LOS PASILLOS O AULAS",
    "FALTA DE RESPETO A SUS COMPAÑEROS",
    "FALTA DE RESPETO A PERSONAL DOCENTE, ADMINISTRATIVO O SERVICIOS",
    "NO PORTA CREDENCIAL",
    "CABELLO LARGO, TATUAJES VISIBLES, PERFORACIONES (PIERCING), CABELLO TEÑIDO, UÑAS EXTRAVAGANTES (MUJERES)",
    "DAÑOS A LA INFRAESTRUCTURA DEL PLANTEL",
    "FUMAR DENTRO DE LAS INSTALACIONES EDUCATIVAS (VAPEADOR, CIGARRO)",
    "PRESENTARSE BAJO LOS EFECTOS DEL ALCOHOL U OTRA SUSTANCIA NOCIVA",
    "FALTA DE RESPETO A LOS SÍMBOLOS PATRIOS",
    "FALTAS A LA MORAL Y BUENAS COSTUMBRES",
    "UTILIZAR DISPOSITIVO ELECTRÓNICO ESTANDO EN CLASES",
    "AUSENTISMO EN CLASES"
];

const POSICIONES_Y = [22.6, 25.3, 28.0, 30.7, 33.4, 36.1, 38.8, 41.5, 44.2, 46.9, 49.6, 52.3, 55.0, 57.7, 60.4];
const POS_X_OVALO = 90.8; 

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

document.addEventListener('DOMContentLoaded', () => {
    renderizarChecklistInfacciones();
    configurarBusquedaInteligente();
    configurarEventosReglamento();
    escucharIncidenciasGlobales();

    const inputFiltro = document.getElementById('buscarIncidenciaGlobal');
    if (inputFiltro) {
        inputFiltro.addEventListener('input', renderizarTablaIncidencias);
    }
});

function renderizarChecklistInfacciones() {
    const contenedor = document.getElementById('checklistIncidencias');
    if (!contenedor) return;

    contenedor.innerHTML = PUNTOS_OFICIALES.map((falta, idx) => `
        <div class="form-check mb-2">
            <input class="form-check-input check-falta" type="checkbox" value="${falta}" id="falta_${idx}">
            <label class="form-check-label x-small text-dark fw-bold" for="falta_${idx}" style="cursor: pointer; font-size: 0.82rem;">
                ${falta}
            </label>
        </div>
    `).join('');
}

function configurarEventosReglamento() {
    const checkboxes = document.querySelectorAll('.check-falta');
    checkboxes.forEach(cb => cb.addEventListener('change', actualizarMarcasX));

    const inputOtro = document.getElementById('inputOtro');
    if (inputOtro) {
        inputOtro.addEventListener('input', (e) => {
            const txt = document.getElementById('pdfTextoOtro');
            if (txt) txt.innerText = e.target.value.toUpperCase();
        });
    }
}

function actualizarMarcasX() {
    const capa = document.getElementById('capaMarcasX');
    if (!capa) return;
    capa.innerHTML = "";

    const seleccionados = Array.from(document.querySelectorAll('.check-falta:checked')).map(cb => cb.value);

    seleccionados.forEach(falta => {
        const idx = PUNTOS_OFICIALES.indexOf(falta);
        if (idx !== -1) {
            capa.innerHTML += `<span class="marca-x" style="top: ${POSICIONES_Y[idx]}%; left: ${POS_X_OVALO}%;">X</span>`;
        }
    });
}

function configurarBusquedaInteligente() {
    const input = document.getElementById('busquedaAlInc');
    const sugerencias = document.getElementById('sugerenciasInc');
    if (!input || !sugerencias) return;

    input.addEventListener('input', async (e) => {
        const query = normalizar(e.target.value);
        if (query.length < 3) {
            sugerencias.style.display = 'none';
            return;
        }

        try {
            const res = await fetch('/api/alumnos');
            if (!res.ok) return;
            const alumnos = await res.json();

            const filtrados = alumnos.filter(al => {
                const estatus = al.estatus_escolar || al.estatus || 'Activo';
                if (estatus !== 'Activo') return false;
                const mat = al.ncontrol || al.matricula || '';
                const pat = al.apepat || al.primerApellido || '';
                const nom = normalizar(`${al.nombre} ${pat}`);
                return nom.includes(query) || normalizar(mat).includes(query);
            }).slice(0, 5);

            if (filtrados.length > 0) {
                sugerencias.innerHTML = filtrados.map(al => {
                    const mat = al.ncontrol || al.matricula;
                    const pat = al.apepat || al.primerApellido || '';
                    return `
                        <button type="button" class="list-group-item list-group-item-action py-2" onclick="seleccionarParaIncidencia('${mat}')">
                            <div class="fw-bold small">${al.nombre} ${pat}</div>
                            <small class="text-muted">${mat} | ${al.especialidad || ''}</small>
                        </button>`;
                }).join('');
                sugerencias.style.display = 'block';
            } else {
                sugerencias.style.display = 'none';
            }
        } catch (e) { console.error(e); }
    });
}

async function seleccionarParaIncidencia(matricula) {
    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matricula}`);
        if (res.ok) {
            const data = await res.json();
            const estatus = data.estatus_escolar || data.estatus || 'Activo';
            if (estatus !== "Activo") {
                return Swal.fire("Alumno Inactivo", "No se pueden registrar incidencias a alumnos en BAJA.", "error");
            }

            alumnoSeleccionado = data;
            const pat = data.apepat || data.primerApellido || '';
            const matApe = data.apemat || data.segundoApellido || '';
            
            document.getElementById('pdfNombreAl').innerText = `${data.nombre} ${pat} ${matApe}`.toUpperCase();
            document.getElementById('pdfSemestre').innerText = data.grado || '';
            document.getElementById('pdfGrupo').innerText = data.grupo || '';
            document.getElementById('pdfEsp').innerText = (data.especialidad || '').toUpperCase();
            
            const hoy = new Date();
            document.getElementById('pdfDia').innerText = hoy.getDate().toString().padStart(2, '0');
            document.getElementById('pdfMes').innerText = hoy.toLocaleString('es-MX', { month: 'long' }).toUpperCase();
            
            const anioDoc = document.getElementById('pdfAnio');
            if (anioDoc) anioDoc.innerText = hoy.getFullYear();
            
            if (document.getElementById('sugerenciasInc')) document.getElementById('sugerenciasInc').style.display = 'none';
            document.getElementById('busquedaAlInc').value = matricula;
        }
    } catch(e) {}
}

async function guardarIncidencia() {
    if (!alumnoSeleccionado) return Swal.fire("Error", "Seleccione un alumno primero", "warning");

    const faltas = Array.from(document.querySelectorAll('.check-falta:checked')).map(cb => cb.value);
    if (faltas.length === 0) return Swal.fire("Atención", "Marque al menos una falta del reglamento", "info");

    try {
        Swal.fire({ title: 'Guardando reporte...', didOpen: () => Swal.showLoading() });

        const mat = alumnoSeleccionado.ncontrol || alumnoSeleccionado.matricula;
        const hoy = new Date().toISOString().split('T')[0];
        const docId = `INC_${mat}_${hoy}_${Date.now()}`;
        
        const datos = {
            folio_incidencia: docId, 
            id_alumno: mat,
            matricula: mat,
            grado: Number(alumnoSeleccionado.grado), 
            grupo: alumnoSeleccionado.grupo, 
            especialidad: alumnoSeleccionado.especialidad,
            ciclo: "FEB-JUL 2026",
            faltas_checklist: faltas, 
            descripcion_detallada: document.getElementById('inputOtro').value.toUpperCase(), 
            fecha_registro: new Date().toISOString(),
            fecha: hoy
        };

        await fetch('/api/incidencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const element = document.getElementById('contenedorReporteReal');
        const scrollOriginalY = window.scrollY;
        const originalTransform = element.style.transform;
        const originalMargin = element.style.marginBottom;

        window.scrollTo(0, 0);
        element.style.transform = "none";
        element.style.marginBottom = "0";

        const opt = {
            margin: 0,
            filename: `Incidencia_${mat}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opt).from(element).save();
        }

        element.style.transform = originalTransform;
        element.style.marginBottom = originalMargin;
        window.scrollTo(0, scrollOriginalY);

        Swal.fire("Éxito", "Incidencia registrada y PDF generado", "success").then(() => location.reload());

    } catch (e) {
        console.error("Error en proceso de guardado:", e);
        Swal.fire("Error", "Hubo un problema al procesar el reporte: " + e.message, "error");
    }
}

async function reimprimirIncidencia(folio) {
    const inc = incidenciasCache.find(i => i.folio_incidencia === folio);
    if (!inc) return Swal.fire("Error", "No se encontró la información de la incidencia.", "error");

    Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });

    try {
        document.getElementById('pdfNombreAl').innerText = (inc.nombreFull || '').toUpperCase();
        document.getElementById('pdfSemestre').innerText = inc.grado || '';
        document.getElementById('pdfGrupo').innerText = inc.grupo || '';
        document.getElementById('pdfEsp').innerText = (inc.especialidad || '').toUpperCase();
        document.getElementById('pdfTextoOtro').innerText = inc.descripcion_detallada || "";

        const fecha = inc.fecha_registro ? new Date(inc.fecha_registro) : new Date();
        document.getElementById('pdfDia').innerText = fecha.getDate().toString().padStart(2, '0');
        document.getElementById('pdfMes').innerText = fecha.toLocaleString('es-MX', { month: 'long' }).toUpperCase();
        
        const anioDoc = document.getElementById('pdfAnio');
        if (anioDoc) anioDoc.innerText = fecha.getFullYear();

        const capa = document.getElementById('capaMarcasX');
        capa.innerHTML = "";
        (inc.faltas_checklist || []).forEach(falta => {
            const idx = PUNTOS_OFICIALES.indexOf(falta);
            if (idx !== -1) {
                capa.innerHTML += `<span class="marca-x" style="top: ${POSICIONES_Y[idx]}%; left: ${POS_X_OVALO}%;">X</span>`;
            }
        });

        const element = document.getElementById('contenedorReporteReal');
        const scrollOriginalY = window.scrollY;
        const originalTransform = element.style.transform;
        const originalMargin = element.style.marginBottom;
        
        window.scrollTo(0, 0);
        element.style.transform = "none";
        element.style.marginBottom = "0";

        const opt = {
            margin: 0,
            filename: `Incidencia_${inc.id_alumno}_REIMPRESION.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opt).from(element).save();
        }

        element.style.transform = originalTransform;
        element.style.marginBottom = originalMargin;
        window.scrollTo(0, scrollOriginalY);

        Swal.close();

    } catch (error) {
        console.error("Error al reimprimir:", error);
        Swal.fire("Error", "No se pudo generar el PDF: " + error.message, "error");
    }
}

async function escucharIncidenciasGlobales() {
    try {
        const [resInc, resAl] = await Promise.all([
            fetch('/api/incidencias').then(r => r.ok ? r.json() : []),
            fetch('/api/alumnos').then(r => r.ok ? r.json() : [])
        ]);

        const mapAlumnos = {};
        resAl.forEach(a => {
            const mat = a.ncontrol || a.matricula;
            const pat = a.apepat || a.primerApellido || '';
            if (mat) mapAlumnos[mat] = `${a.nombre} ${pat}`.trim();
        });

        incidenciasCache = resInc.map(inc => ({
            ...inc,
            nombreFull: mapAlumnos[inc.id_alumno || inc.matricula] || inc.nombre || "Estudiante"
        }));

        renderizarTablaIncidencias();
    } catch(e) { console.error(e); }
}

function renderizarTablaIncidencias() {
    const tbody = document.getElementById('tablaIncidenciasGlobal');
    if (!tbody) return;
    tbody.innerHTML = "";

    const inputBusqueda = document.getElementById('buscarIncidenciaGlobal');
    const filtro = normalizar(inputBusqueda ? inputBusqueda.value : "");

    const filtrados = incidenciasCache.filter(inc => {
        const folio = normalizar(inc.folio_incidencia);
        const nombre = normalizar(inc.nombreFull);
        const matricula = normalizar(inc.id_alumno || inc.matricula);
        return folio.includes(filtro) || nombre.includes(filtro) || matricula.includes(filtro);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron incidencias.</td></tr>`;
        return;
    }

    const paginados = filtrados.slice(0, limiteIncidencias);

    paginados.forEach(inc => {
        const fechaTxt = inc.fecha || (inc.fecha_registro ? new Date(inc.fecha_registro).toLocaleDateString() : 'Pendiente');
        const folio = inc.folio_incidencia || inc.id || 'INC-001';
        const faltas = inc.faltas_checklist || (inc.motivo ? [inc.motivo] : []);

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${String(folio).substring(0,15)}...</td>
                <td>
                    <div class="fw-bold small">${inc.nombreFull}</div>
                    <small class="text-muted">${inc.id_alumno || inc.matricula}</small>
                </td>
                <td>${fechaTxt}</td>
                <td>
                    <small class="text-truncate d-inline-block" style="max-width: 200px;">
                        ${faltas.join(', ')}
                    </small>
                </td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirIncidencia('${folio}')">
                            <i class="bi bi-file-pdf-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarIncidencia('${inc.id || folio}')">
                            <i class="bi bi-trash3-fill fs-5"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    if (filtrados.length > limiteIncidencias) {
        tbody.innerHTML += `
            <tr>
                <td colspan="5" class="text-center py-2">
                    <button class="btn btn-link text-guinda btn-sm fw-bold text-decoration-none" onclick="limiteIncidencias += 10; renderizarTablaIncidencias();">
                        <i class="bi bi-arrow-down-circle me-1"></i> Ver más incidencias...
                    </button>
                </td>
            </tr>`;
    }
}

async function confirmarEliminarIncidencia(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar incidencia?',
        text: "Esta acción no se puede deshacer y el registro desaparecerá de las estadísticas.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            await fetch(`/api/incidencias/${id}`, { method: 'DELETE' });
            Swal.fire("Eliminado", "El registro ha sido borrado.", "success");
            escucharIncidenciasGlobales();
        } catch (e) {
            Swal.fire("Error", "No se pudo eliminar: " + e.message, "error");
        }
    }
}