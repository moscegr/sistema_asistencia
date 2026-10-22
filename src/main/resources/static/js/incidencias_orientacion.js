/**
 * Incidencias Orientación - CBTis 134 (REST API Spring Boot Backend)
 * Formato Vectorial Oficial 100% Nativo en HTML/CSS
 */

let alumnoSeleccionado = null;
let incidenciasCache = [];
let limiteIncidencias = 10;
let alumnosActivosCache = null;

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
    "AUSENTISMO EN CLASES",
    "PORTAR OBJETOS NO PERMITIDOS POR LA INSTITUCION EDUCATIVA",
    "OTRO (ESPECIFIQUE)"
];

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

document.addEventListener('DOMContentLoaded', async () => {
    renderizarChecklistInfacciones();
    renderizarListaFaltasVisual();
    inicializarFechaHoy();
    configurarBusquedaInteligente();
    configurarEventosReglamento();
    await actualizarSiguienteFolioIncidencia();
    await escucharIncidenciasGlobales();

    const inputFiltro = document.getElementById('buscarIncidenciaGlobal');
    if (inputFiltro) {
        inputFiltro.addEventListener('input', renderizarTablaIncidencias);
    }
});

function inicializarFechaHoy() {
    const hoy = new Date();
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    
    const diaEl = document.getElementById('pdfDia');
    const mesEl = document.getElementById('pdfMes');
    const anioEl = document.getElementById('pdfAnio');

    if (diaEl) diaEl.innerText = hoy.getDate().toString().padStart(2, '0');
    if (mesEl) mesEl.innerText = meses[hoy.getMonth()];
    if (anioEl) anioEl.innerText = hoy.getFullYear();
}

async function actualizarSiguienteFolioIncidencia() {
    try {
        const res = await fetch('/api/incidencias/siguiente-folio');
        if (res.ok) {
            const data = await res.json();
            const el = document.getElementById('pdfFolioInc');
            if (el) el.innerText = "FOLIO: " + (data.siguiente_folio || "INC-0001");
        }
    } catch(e) {
        console.warn("Error al sincronizar folio:", e);
    }
}

function renderizarChecklistInfacciones() {
    const contenedor = document.getElementById('checklistIncidencias');
    if (!contenedor) return;

    contenedor.innerHTML = PUNTOS_OFICIALES.map((falta, idx) => `
        <div class="form-check mb-2">
            <input class="form-check-input check-falta" type="checkbox" value="${falta}" id="falta_${idx}">
            <label class="form-check-label text-dark fw-bold" for="falta_${idx}" style="cursor: pointer; font-size: 0.80rem;">
                ${idx + 1}. ${falta}
            </label>
        </div>
    `).join('');
}

function renderizarListaFaltasVisual() {
    const contenedor = document.getElementById('contenedorListaFaltasVisual');
    if (!contenedor) return;

    contenedor.innerHTML = PUNTOS_OFICIALES.map((falta, idx) => {
        if (idx === PUNTOS_OFICIALES.length - 1) {
            return `
                <div class="fila-falta-item py-1">
                    <div style="flex-grow: 1; max-width: 88%;">
                        <span class="fw-bold text-muted me-1">&gt;</span>
                        <span class="fw-bold text-uppercase">OTRO (ESPECIFIQUE):</span>
                        <span id="pdfTextoOtro" class="border-bottom-dark fw-bold text-uppercase" style="min-width: 200px; display: inline-block; padding-left: 6px;">&nbsp;</span>
                    </div>
                    <div class="ovalo-falta" id="visual_ovalo_${idx}">X</div>
                </div>
            `;
        }
        return `
            <div class="fila-falta-item">
                <div style="max-width: 88%;">
                    <span class="fw-bold text-muted me-1">&gt;</span>
                    <span>${falta}</span>
                </div>
                <div class="ovalo-falta" id="visual_ovalo_${idx}">X</div>
            </div>
        `;
    }).join('');
}

function configurarEventosReglamento() {
    const checkboxes = document.querySelectorAll('.check-falta');
    checkboxes.forEach(cb => cb.addEventListener('change', actualizarOvalosVisuales));

    const inputOtro = document.getElementById('inputOtro');
    if (inputOtro) {
        inputOtro.addEventListener('input', (e) => {
            const val = e.target.value.toUpperCase();
            const txt = document.getElementById('pdfTextoOtro');
            if (txt) txt.innerText = val || "";
            
            const idxOtro = PUNTOS_OFICIALES.length - 1;
            const cbOtro = document.getElementById(`falta_${idxOtro}`);
            if (cbOtro) {
                cbOtro.checked = (val.trim().length > 0);
            }
            actualizarOvalosVisuales();
        });
    }
}

function actualizarOvalosVisuales() {
    const seleccionados = Array.from(document.querySelectorAll('.check-falta:checked')).map(cb => cb.value);
    
    const contadorBadge = document.getElementById('contadorFaltasSel');
    if (contadorBadge) {
        contadorBadge.innerText = `${seleccionados.length} seleccionada${seleccionados.length === 1 ? '' : 's'}`;
    }

    PUNTOS_OFICIALES.forEach((falta, idx) => {
        const ovalo = document.getElementById(`visual_ovalo_${idx}`);
        if (!ovalo) return;
        if (seleccionados.includes(falta)) {
            ovalo.classList.add('marcado');
        } else {
            ovalo.classList.remove('marcado');
        }
    });
}

function configurarBusquedaInteligente() {
    const input = document.getElementById('busquedaAlInc');
    const sugerencias = document.getElementById('sugerenciasInc');
    if (!input || !sugerencias) return;

    input.addEventListener('input', async (e) => {
        const query = normalizar(e.target.value);
        if (query.length < 2) {
            sugerencias.style.display = 'none';
            return;
        }

        try {
            if (!alumnosActivosCache || alumnosActivosCache.length === 0) {
                const res = await fetch('/api/alumnos');
                if (!res.ok) return;
                alumnosActivosCache = await res.json();
            }

            const filtrados = alumnosActivosCache.filter(al => {
                const estatus = al.estatus_escolar || al.estatus || 'Activo';
                if (estatus !== 'Activo') return false;
                const mat = al.ncontrol || al.matricula || '';
                const pat = al.apepat || al.primerApellido || '';
                const matApe = al.apemat || al.segundoApellido || '';
                const nom = normalizar(`${al.nombre || ''} ${pat} ${matApe}`);
                return normalizar(mat).includes(query) || nom.includes(query);
            }).slice(0, 6);

            if (filtrados.length > 0) {
                sugerencias.innerHTML = filtrados.map(al => {
                    const mat = al.ncontrol || al.matricula || al.id || '';
                    const pat = al.apepat || al.primerApellido || '';
                    const matApe = al.apemat || al.segundoApellido || '';
                    const nombreCompleto = `${al.nombre || ''} ${pat} ${matApe}`.replace(/\s+/g, ' ').trim();
                    return `
                        <button type="button" class="list-group-item list-group-item-action py-2" 
                                onmousedown="event.preventDefault(); seleccionarParaIncidencia('${mat}')" 
                                onclick="seleccionarParaIncidencia('${mat}')">
                            <div class="fw-bold small text-dark">${nombreCompleto}</div>
                            <small class="text-muted">${mat} | ${al.especialidad || 'Sin especialidad'} | ${al.grado || ''}° "${al.grupo || ''}"</small>
                        </button>
                    `;
                }).join('');
                sugerencias.style.display = 'block';
            } else {
                sugerencias.style.display = 'none';
            }
        } catch (e) {
            console.error("Error en búsqueda:", e);
        }
    });

    // Cerrar lista si se hace clic fuera
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !sugerencias.contains(e.target)) {
            sugerencias.style.display = 'none';
        }
    });
}

async function seleccionarParaIncidencia(matricula) {
    try {
        let data = null;
        if (alumnosActivosCache && alumnosActivosCache.length > 0) {
            data = alumnosActivosCache.find(al => 
                (al.ncontrol && al.ncontrol.toString() === matricula.toString()) || 
                (al.matricula && al.matricula.toString() === matricula.toString()) ||
                (al.id && al.id.toString() === matricula.toString()) ||
                (al._id && al._id.toString() === matricula.toString())
            );
        }

        if (!data) {
            const res = await fetch(`/api/alumnos/ncontrol/${encodeURIComponent(matricula)}`);
            if (res.ok) {
                data = await res.json();
            } else {
                const resId = await fetch(`/api/alumnos/${encodeURIComponent(matricula)}`);
                if (resId.ok) {
                    data = await resId.json();
                }
            }
        }

        if (!data) {
            console.warn("No se pudo obtener el alumno:", matricula);
            return;
        }
        
        alumnoSeleccionado = data;
        const pat = data.apepat || data.primerApellido || '';
        const matApe = data.apemat || data.segundoApellido || '';
        const nombreCompleto = `${data.nombre || ''} ${pat} ${matApe}`.replace(/\s+/g, ' ').trim();

        const elNom = document.getElementById('pdfNombreAl');
        if (elNom) elNom.innerText = nombreCompleto.toUpperCase();

        const elSem = document.getElementById('pdfSemestre');
        if (elSem) elSem.innerText = data.grado || '';

        const elGpo = document.getElementById('pdfGrupo');
        if (elGpo) elGpo.innerText = data.grupo || '';

        const elEsp = document.getElementById('pdfEsp');
        if (elEsp) elEsp.innerText = (data.especialidad || '').toUpperCase();

        // Extraer y asignar tutor dinámicamente
        let tutorNom = "";
        if (data.nombretutor && typeof data.nombretutor === 'string' && data.nombretutor.trim() !== '') {
            tutorNom = data.nombretutor.trim();
        } else if (data.nombre_tutor && typeof data.nombre_tutor === 'string' && data.nombre_tutor.trim() !== '') {
            tutorNom = data.nombre_tutor.trim();
        } else if (data.tutor) {
            if (typeof data.tutor === 'string' && data.tutor.trim() !== '') {
                tutorNom = data.tutor.trim();
            } else if (typeof data.tutor === 'object') {
                tutorNom = (data.tutor.nombre || data.tutor.nombre_completo || data.tutor.nombretutor || "").trim();
            }
        }
        const elTutor = document.getElementById('pdfTutorAl');
        if (elTutor) {
            elTutor.innerText = tutorNom ? tutorNom.toUpperCase() : "PADRE DE FAMILIA O TUTOR";
        }
        
        inicializarFechaHoy();

        const sug = document.getElementById('sugerenciasInc');
        if (sug) sug.style.display = 'none';

        const inp = document.getElementById('busquedaAlInc');
        if (inp) inp.value = nombreCompleto;

    } catch(e) {
        console.error("Error seleccionando alumno:", e);
    }
}
window.seleccionarParaIncidencia = seleccionarParaIncidencia;

async function guardarIncidencia() {
    if (!alumnoSeleccionado) {
        return Swal.fire("Atención", "Busque y seleccione un alumno activo primero.", "warning");
    }

    const faltas = Array.from(document.querySelectorAll('.check-falta:checked')).map(cb => cb.value);
    if (faltas.length === 0) {
        return Swal.fire("Faltas Requeridas", "Marque al menos una falta del reglamento escolar.", "info");
    }

    const folioStr = document.getElementById('pdfFolioInc').innerText.replace("FOLIO: ", "").trim();
    const mat = alumnoSeleccionado.ncontrol || alumnoSeleccionado.matricula;
    const pat = alumnoSeleccionado.apepat || alumnoSeleccionado.primerApellido || '';
    const matApe = alumnoSeleccionado.apemat || alumnoSeleccionado.segundoApellido || '';
    const nombreFull = `${alumnoSeleccionado.nombre} ${pat} ${matApe}`.replace(/\s+/g, ' ').trim();
    const hoy = new Date().toISOString().split('T')[0];
    const tutorTexto = document.getElementById('pdfTutorAl') ? document.getElementById('pdfTutorAl').innerText : '';

    const datos = {
        _id: folioStr,
        folio_incidencia: folioStr, 
        id_alumno: mat,
        matricula: mat,
        nombre: nombreFull,
        tutor: tutorTexto,
        grado: Number(alumnoSeleccionado.grado) || 0, 
        grupo: alumnoSeleccionado.grupo || '', 
        especialidad: alumnoSeleccionado.especialidad || '',
        faltas_checklist: faltas, 
        descripcion_detallada: (document.getElementById('inputOtro')?.value || '').trim().toUpperCase(), 
        fecha_registro: new Date().toISOString(),
        fecha: hoy
    };

    try {
        Swal.fire({ title: 'Guardando reporte...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const res = await fetch('/api/incidencias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        if (!res.ok) {
            const errTxt = await res.text();
            throw new Error(`Error en servidor (${res.status}): ${errTxt || res.statusText}`);
        }

        // Generar PDF limpio y seguro
        const original = document.getElementById('contenedorReporteReal');
        const clonPDF = original.cloneNode(true);
        clonPDF.removeAttribute('id');
        clonPDF.style.boxShadow = 'none';
        clonPDF.style.margin = '0';
        clonPDF.style.width = '216mm';
        clonPDF.style.minHeight = '279mm';
        clonPDF.style.padding = '12mm 24mm 10mm 24mm';

        // Convertir imágenes a base64 de manera preventiva para blindar contra cualquier fallo de CORS/red
        const imagenes = clonPDF.querySelectorAll('img');
        for (const img of imagenes) {
            try {
                if (img.src && !img.src.startsWith('data:') && img.complete && img.naturalWidth > 0) {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    img.src = c.toDataURL('image/png');
                }
            } catch (eImg) {
                console.warn("Conversión preventiva omitida:", eImg);
            }
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '216mm';
        tempContainer.style.background = '#ffffff';
        tempContainer.appendChild(clonPDF);
        document.body.appendChild(tempContainer);

        const opt = {
            margin: 0,
            filename: `Incidencia_${folioStr}_${mat}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: false, allowTaint: true, scrollY: 0, scrollX: 0 },
            jsPDF: { unit: 'mm', format: [216, 279], orientation: 'portrait' }
        };

        let pdfGenerado = false;
        try {
            if (typeof html2pdf !== 'undefined') {
                await html2pdf().set(opt).from(clonPDF).save();
                pdfGenerado = true;
            }
        } catch (pdfErr) {
            console.error("Aviso al descargar PDF:", pdfErr);
        }

        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }

        if (pdfGenerado) {
            await Swal.fire("Éxito", "Reporte de incidencia registrado y PDF generado exitosamente.", "success");
        } else {
            await Swal.fire("Guardado", "El reporte ha sido registrado en la base de datos con éxito.", "success");
        }
        location.reload();

    } catch (e) {
        console.error("Error en proceso de guardado:", e);
        Swal.fire("Error", "Hubo un problema al procesar el reporte: " + e.message, "error");
    }
}
window.guardarIncidencia = guardarIncidencia;

async function escucharIncidenciasGlobales() {
    try {
        const [resInc, resAl] = await Promise.all([
            fetch('/api/incidencias').then(r => r.ok ? r.json() : []),
            fetch('/api/alumnos').then(r => r.ok ? r.json() : [])
        ]);

        alumnosActivosCache = resAl;

        const mapAlumnos = {};
        resAl.forEach(a => {
            const mat = a.ncontrol || a.matricula;
            const pat = a.apepat || a.primerApellido || '';
            const matApe = a.apemat || a.segundoApellido || '';
            if (mat) mapAlumnos[mat] = `${a.nombre} ${pat} ${matApe}`.replace(/\s+/g, ' ').trim();
        });

        incidenciasCache = resInc.map(inc => ({
            ...inc,
            nombreFull: mapAlumnos[inc.id_alumno || inc.matricula] || inc.nombre || "Estudiante"
        }));

        renderizarTablaIncidencias();
    } catch(e) { 
        console.error("Error cargando incidencias:", e); 
    }
}

function renderizarTablaIncidencias() {
    const tbody = document.getElementById('tablaIncidenciasGlobal');
    if (!tbody) return;
    tbody.innerHTML = "";

    const inputBusqueda = document.getElementById('buscarIncidenciaGlobal');
    const filtro = normalizar(inputBusqueda ? inputBusqueda.value : "");

    const filtrados = incidenciasCache.filter(inc => {
        const folio = normalizar(inc.folio_incidencia || inc._id || "");
        const nombre = normalizar(inc.nombreFull);
        const matricula = normalizar(inc.id_alumno || inc.matricula);
        return folio.includes(filtro) || nombre.includes(filtro) || matricula.includes(filtro);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron incidencias registradas.</td></tr>`;
        return;
    }

    const paginados = filtrados.slice(0, limiteIncidencias);

    paginados.forEach(inc => {
        const fechaTxt = inc.fecha || (inc.fecha_registro ? inc.fecha_registro.split('T')[0] : 'Pendiente');
        const folio = inc.folio_incidencia || inc._id || 'INC-0001';
        const faltas = inc.faltas_checklist || (inc.motivo ? [inc.motivo] : []);

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${folio}</td>
                <td>
                    <div class="fw-bold small">${inc.nombreFull}</div>
                    <small class="text-muted">${inc.id_alumno || inc.matricula}</small>
                </td>
                <td>${fechaTxt}</td>
                <td>
                    <small class="text-truncate d-inline-block" style="max-width: 250px;" title="${faltas.join(', ')}">
                        ${faltas.length} falta${faltas.length === 1 ? '' : 's'}: ${faltas.join(', ')}
                    </small>
                </td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary border-0" title="Ver Formato Completo" onclick="verIncidencia('${folio}')">
                            <i class="bi bi-eye-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger border-0" title="Descargar PDF" onclick="reimprimirIncidencia('${folio}')">
                            <i class="bi bi-file-pdf-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-dark border-0 text-danger" title="Eliminar Incidencia" onclick="confirmarEliminarIncidencia('${folio}')">
                            <i class="bi bi-trash-fill fs-5"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (filtrados.length > limiteIncidencias) {
        tbody.innerHTML += `<tr><td colspan="5" class="text-center py-2 bg-light"><button class="btn btn-link btn-sm fw-bold" onclick="limiteIncidencias += 10; renderizarTablaIncidencias();">Mostrar más (+10)</button></td></tr>`;
    }
}

async function verIncidencia(folio) {
    const inc = incidenciasCache.find(i => (i.folio_incidencia === folio || i._id === folio));
    if (!inc) return Swal.fire("Error", "No se encontró la información de la incidencia.", "error");

    const original = document.getElementById('contenedorReporteReal');
    const contenedorModal = document.getElementById('contenedorModalIncidencia');
    if (!original || !contenedorModal) return;

    // Clonar nodo para aislarlo de la pantalla de captura
    const clon = original.cloneNode(true);
    clon.removeAttribute('id');

    // Asignar datos del registro en el clon
    const folEl = clon.querySelector('#pdfFolioInc');
    if (folEl) folEl.innerText = "FOLIO: " + (inc.folio_incidencia || inc._id || 'INC-0001');

    const nomEl = clon.querySelector('#pdfNombreAl');
    if (nomEl) nomEl.innerText = (inc.nombreFull || inc.nombre || inc.id_alumno || inc.matricula || '').toUpperCase();

    const semEl = clon.querySelector('#pdfSemestre');
    if (semEl) semEl.innerText = inc.grado || '';

    const gpoEl = clon.querySelector('#pdfGrupo');
    if (gpoEl) gpoEl.innerText = inc.grupo || '';

    const espEl = clon.querySelector('#pdfEsp');
    if (espEl) espEl.innerText = (inc.especialidad || '').toUpperCase();

    const tutEl = clon.querySelector('#pdfTutorAl');
    if (tutEl) tutEl.innerText = (inc.tutor || inc.nombretutor || 'PADRE DE FAMILIA O TUTOR').toUpperCase();

    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const fechaObj = inc.fecha ? new Date(inc.fecha + "T12:00:00") : (inc.fecha_registro ? new Date(inc.fecha_registro) : new Date());
    
    const diaEl = clon.querySelector('#pdfDia');
    const mesEl = clon.querySelector('#pdfMes');
    const anioEl = clon.querySelector('#pdfAnio');

    if (diaEl) diaEl.innerText = fechaObj.getDate().toString().padStart(2, '0');
    if (mesEl) mesEl.innerText = meses[fechaObj.getMonth()];
    if (anioEl) anioEl.innerText = fechaObj.getFullYear();

    // Actualizar texto otro
    const txtOtro = clon.querySelector('#pdfTextoOtro');
    if (txtOtro) txtOtro.innerText = (inc.descripcion_detallada || '').toUpperCase();

    // Marcar los óvalos correspondientes
    const faltas = inc.faltas_checklist || [];
    PUNTOS_OFICIALES.forEach((falta, idx) => {
        const ovalo = clon.querySelector(`#visual_ovalo_${idx}`);
        if (!ovalo) return;
        if (faltas.includes(falta) || (falta === "OTRO (ESPECIFIQUE)" && inc.descripcion_detallada)) {
            ovalo.classList.add('marcado');
        } else {
            ovalo.classList.remove('marcado');
        }
    });

    contenedorModal.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = "100%";
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "center";
    wrapper.style.overflow = "hidden";

    clon.style.transform = "scale(0.68)";
    clon.style.transformOrigin = "top center";
    clon.style.margin = "0 auto";
    clon.style.marginBottom = "-90mm"; // Ajuste para compensar el scaling
    clon.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
    clon.style.borderRadius = "4px";

    wrapper.appendChild(clon);
    contenedorModal.appendChild(wrapper);

    const modalEl = document.getElementById('modalVisualizarIncidencia');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
window.verIncidencia = verIncidencia;

async function reimprimirIncidencia(folio) {
    const inc = incidenciasCache.find(i => (i.folio_incidencia === folio || i._id === folio));
    if (!inc) return Swal.fire("Error", "No se encontró la información de la incidencia.", "error");

    try {
        Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });

        const original = document.getElementById('contenedorReporteReal');
        const clon = original.cloneNode(true);
        clon.removeAttribute('id');

        const folEl = clon.querySelector('#pdfFolioInc');
        if (folEl) folEl.innerText = "FOLIO: " + (inc.folio_incidencia || inc._id || 'INC-0001');

        const nomEl = clon.querySelector('#pdfNombreAl');
        if (nomEl) nomEl.innerText = (inc.nombreFull || inc.nombre || inc.id_alumno || inc.matricula || '').toUpperCase();

        const semEl = clon.querySelector('#pdfSemestre');
        if (semEl) semEl.innerText = inc.grado || '';

        const gpoEl = clon.querySelector('#pdfGrupo');
        if (gpoEl) gpoEl.innerText = inc.grupo || '';

        const espEl = clon.querySelector('#pdfEsp');
        if (espEl) espEl.innerText = (inc.especialidad || '').toUpperCase();

        const tutEl = clon.querySelector('#pdfTutorAl');
        if (tutEl) tutEl.innerText = (inc.tutor || inc.nombretutor || 'PADRE DE FAMILIA O TUTOR').toUpperCase();

        const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const fechaObj = inc.fecha ? new Date(inc.fecha + "T12:00:00") : (inc.fecha_registro ? new Date(inc.fecha_registro) : new Date());
        
        const diaEl = clon.querySelector('#pdfDia');
        const mesEl = clon.querySelector('#pdfMes');
        const anioEl = clon.querySelector('#pdfAnio');

        if (diaEl) diaEl.innerText = fechaObj.getDate().toString().padStart(2, '0');
        if (mesEl) mesEl.innerText = meses[fechaObj.getMonth()];
        if (anioEl) anioEl.innerText = fechaObj.getFullYear();

        const txtOtro = clon.querySelector('#pdfTextoOtro');
        if (txtOtro) txtOtro.innerText = (inc.descripcion_detallada || '').toUpperCase();

        const faltas = inc.faltas_checklist || [];
        PUNTOS_OFICIALES.forEach((falta, idx) => {
            const ovalo = clon.querySelector(`#visual_ovalo_${idx}`);
            if (!ovalo) return;
            if (faltas.includes(falta) || (falta === "OTRO (ESPECIFIQUE)" && inc.descripcion_detallada)) {
                ovalo.classList.add('marcado');
            } else {
                ovalo.classList.remove('marcado');
            }
        });

        clon.style.boxShadow = 'none';
        clon.style.margin = '0';
        clon.style.width = '216mm';
        clon.style.minHeight = '279mm';
        clon.style.padding = '12mm 24mm 10mm 24mm';

        // Pre-convertir imágenes a base64 de manera preventiva
        const imagenes = clon.querySelectorAll('img');
        for (const img of imagenes) {
            try {
                if (img.src && !img.src.startsWith('data:') && img.complete && img.naturalWidth > 0) {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    img.src = c.toDataURL('image/png');
                }
            } catch (eImg) {
                console.warn("Conversión preventiva omitida:", eImg);
            }
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '216mm';
        tempContainer.style.background = '#ffffff';
        tempContainer.appendChild(clon);
        document.body.appendChild(tempContainer);

        const folClean = inc.folio_incidencia || inc._id || 'INC-0001';
        const opt = {
            margin: 0,
            filename: `Incidencia_${folClean}_${inc.id_alumno || inc.matricula}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: false, allowTaint: true, scrollY: 0, scrollX: 0 },
            jsPDF: { unit: 'mm', format: [216, 279], orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opt).from(clon).save();
        }

        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }

        Swal.close();

    } catch (error) {
        console.error("Error al reimprimir:", error);
        Swal.fire("Error", "No se pudo generar el PDF: " + error.message, "error");
    }
}
window.reimprimirIncidencia = reimprimirIncidencia;

async function confirmarEliminarIncidencia(folio) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar incidencia?',
        text: `Se eliminará permanentemente la incidencia ${folio}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Eliminando...', didOpen: () => Swal.showLoading() });
            const res = await fetch(`/api/incidencias/${encodeURIComponent(folio)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Error en servidor al eliminar");

            await Swal.fire("Eliminada", "La incidencia ha sido eliminada.", "success");
            await actualizarSiguienteFolioIncidencia();
            await escucharIncidenciasGlobales();
        } catch (e) {
            Swal.fire("Error", "No se pudo eliminar la incidencia: " + e.message, "error");
        }
    }
}
window.confirmarEliminarIncidencia = confirmarEliminarIncidencia;
