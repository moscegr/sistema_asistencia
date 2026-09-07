// static/js/seguimiento_conductual.js

let historialConductualCache = [];
let limiteConductual = 15;
let modalDetallesConductual = null;

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('modalDetalleIncidencias');
    if (modalEl) modalDetallesConductual = new bootstrap.Modal(modalEl);

    cargarAlertasConductuales();

    const buscadorInput = document.getElementById('buscarAlumnoConductual');
    if (buscadorInput) {
        buscadorInput.addEventListener('input', filtrarTablaConductual);
    }
});

function parsearFechaSegura(val) {
    if (!val) return null;
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

function formatearFechaTexto(val) {
    const d = parsearFechaSegura(val);
    if (d) return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (typeof val === 'string' && val.trim().length > 0) return val;
    return 'S/F';
}

async function cargarAlertasConductuales() {
    const contenedor = document.getElementById('listaConductual');
    if (!contenedor) return;
    
    contenedor.innerHTML = `
        <tr>
            <td colspan="4" class="text-center p-4 text-muted">
                <div class="spinner-border text-danger mb-2" role="status"></div><br>
                Analizando base de datos conductual...
            </td>
        </tr>`;

    try {
        const [resAlumnos, resIncidencias] = await Promise.all([
            fetch('/api/alumnos').then(r => r.ok ? r.json() : []),
            fetch('/api/incidencias').then(r => r.ok ? r.json() : [])
        ]);

        let alumnosMap = {};
        
        resAlumnos.forEach(al => {
            const mat = al.ncontrol || al.matricula;
            if (mat && (al.estatus_escolar === 'Activo' || al.estatus === 'Activo' || !al.estatus)) {
                alumnosMap[mat] = { 
                    ...al,
                    matricula: mat,
                    totalIncidencias: 0, 
                    listaIncidencias: [] 
                };
            }
        });

        resIncidencias.forEach(inc => {
            const mat = inc.id_alumno || inc.matricula;
            
            if (alumnosMap[mat]) {
                const fechaObj = parsearFechaSegura(inc.fecha || inc.fecha_registro || inc.fecharegistro);
                const fechaRaw = inc.fecha || inc.fecha_registro || inc.fecharegistro;
                
                alumnosMap[mat].totalIncidencias += 1;
                alumnosMap[mat].listaIncidencias.push({
                    folio: inc.folio_incidencia || inc.id || 'N/A',
                    fechaObj: fechaObj,
                    fechaStr: formatearFechaTexto(fechaRaw),
                    motivos: inc.faltas_checklist || (inc.motivo ? [inc.motivo] : []),
                    descripcion: inc.descripcion_detallada || inc.descripcion || ""
                });
            }
        });

        historialConductualCache = Object.values(alumnosMap).filter(al => al.totalIncidencias >= 1);
        historialConductualCache.sort((a, b) => b.totalIncidencias - a.totalIncidencias);

        renderizarTablaConductual(historialConductualCache);

    } catch (error) {
        console.error("Error en seguimiento conductual:", error);
        contenedor.innerHTML = "<tr><td colspan='4' class='text-center text-danger py-4'>Error al cargar los datos. Revisa la consola.</td></tr>";
    }
}

function renderizarTablaConductual(listaRenderizar) {
    const tbody = document.getElementById('listaConductual');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (listaRenderizar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-success py-4"><i class="bi bi-check-circle-fill me-2"></i>No hay registros que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    const paginados = listaRenderizar.slice(0, limiteConductual);

    paginados.forEach(al => {
        const nivelAlerta = al.totalIncidencias >= 3 ? 'danger' : (al.totalIncidencias === 2 ? 'warning' : 'secondary');
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';

        al.listaIncidencias.sort((a, b) => (b.fechaObj ? b.fechaObj.getTime() : 0) - (a.fechaObj ? a.fechaObj.getTime() : 0));
        const ultimaIncidencia = al.listaIncidencias[0];
        const fechaTxt = ultimaIncidencia ? ultimaIncidencia.fechaStr : 'S/F';

        tbody.innerHTML += `
            <tr class="align-middle">
                <td>
                    <div class="fw-bold" style="color: #7b1b37;">${al.nombre} ${pat} ${matApe}</div>
                    <small class="text-muted"><i class="bi bi-person-vcard me-1"></i>${al.matricula}</small>
                </td>
                <td class="text-center">
                    <span class="badge bg-light text-dark border">${al.especialidad || 'N/A'}</span><br>
                    <small class="text-muted">${al.grado || ''}° "${al.grupo || ''}"</small>
                </td>
                <td class="text-center">
                    <span class="badge bg-${nivelAlerta} rounded-pill fs-6">${al.totalIncidencias}</span>
                    <div class="small text-muted mt-1">Última: ${fechaTxt}</div>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-dark" onclick="abrirModalDetalles('${al.matricula}')">
                        <i class="bi bi-journal-text me-1"></i> Detalles
                    </button>
                </td>
            </tr>`;
    });

    if (listaRenderizar.length > limiteConductual) {
        tbody.innerHTML += `
            <tr>
                <td colspan="4" class="text-center py-3 bg-light">
                    <button class="btn btn-link text-guinda btn-sm fw-bold text-decoration-none" onclick="limiteConductual += 10; filtrarTablaConductual();">
                        <i class="bi bi-arrow-down-circle me-1"></i> Ver más alumnos en riesgo
                    </button>
                </td>
            </tr>`;
    }
}

function filtrarTablaConductual() {
    const q = normalizar(document.getElementById('buscarAlumnoConductual')?.value || '');
    
    if (q === "") {
        renderizarTablaConductual(historialConductualCache);
        return;
    }

    const filtrados = historialConductualCache.filter(al => {
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreStr = normalizar(`${al.nombre} ${pat} ${matApe}`);
        return nombreStr.includes(q) || normalizar(al.matricula).includes(q) || normalizar(al.especialidad).includes(q);
    });

    const limiteTemp = limiteConductual; 
    limiteConductual = 15; 
    renderizarTablaConductual(filtrados);
    limiteConductual = limiteTemp; 
}

function abrirModalDetalles(matricula) {
    const alumno = historialConductualCache.find(a => a.matricula === matricula);
    if (!alumno) return;

    const elNombre = document.getElementById('mdlNombre');
    const elMatricula = document.getElementById('mdlMatricula');
    const elInfo = document.getElementById('mdlInfoExtra');
    const elTotal = document.getElementById('mdlTotal');
    const elTutor = document.getElementById('mdlTutor');
    const elFoto = document.getElementById('mdlFotoPerfil');
    const contenedor = document.getElementById('mdlListaIncidencias');

    if (elNombre && elMatricula && elInfo && elTotal && contenedor) {
        const pat = alumno.apepat || alumno.primerApellido || '';
        const matApe = alumno.apemat || alumno.segundoApellido || '';

        elNombre.innerText = `${alumno.nombre} ${pat} ${matApe}`.toUpperCase();
        elMatricula.innerText = alumno.matricula;
        elInfo.innerText = `${alumno.grado || ''}° "${alumno.grupo || ''}" - ${alumno.especialidad || 'N/A'}`;
        elTotal.innerText = alumno.totalIncidencias;

        if (elFoto) {
            elFoto.src = alumno.fotoUrl || alumno.foto_url || alumno.foto || '/img/logo_aniversario.jpg';
        }

        if (elTutor) {
            const nomTutor = alumno.nombretutor || 'No registrado';
            const telTutor = alumno.teltutor || 'N/A';
            elTutor.innerHTML = `
                <i class="bi bi-person-badge-fill text-guinda me-1"></i><b>Tutor:</b> ${nomTutor} <br>
                <i class="bi bi-telephone-fill text-guinda me-1"></i><b>Tel:</b> ${telTutor}
            `;
        }

        contenedor.innerHTML = "";

        alumno.listaIncidencias.sort((a, b) => (b.fechaObj ? b.fechaObj.getTime() : 0) - (a.fechaObj ? a.fechaObj.getTime() : 0));
        
        alumno.listaIncidencias.forEach((inc, index) => {
            let motivosTxt = inc.motivos.length > 0 ? inc.motivos.join('</li><li>') : '';
            if (inc.descripcion) motivosTxt += `</li><li class="mt-1"><i>Nota: ${inc.descripcion}</i>`;

            contenedor.innerHTML += `
                <div class="list-group-item py-3 ${index === 0 ? 'bg-light border-start border-4 border-danger' : ''}">
                    <div class="d-flex justify-content-between w-100 mb-1">
                        <h6 class="mb-0 fw-bold text-dark"><i class="bi bi-calendar-event me-2"></i>${inc.fechaStr}</h6>
                        <small class="text-muted text-uppercase" style="font-size: 0.7rem;">Folio: ${String(inc.folio).split('_').pop()}</small>
                    </div>
                    <ul class="mb-0 mt-2 small text-muted ps-3">
                        <li>${motivosTxt || 'Sin motivo especificado'}</li>
                    </ul>
                </div>
            `;
        });

        if (modalDetallesConductual) modalDetallesConductual.show();
    } else {
        console.error("No se pudieron encontrar todos los IDs del modal en el HTML.");
    }
}