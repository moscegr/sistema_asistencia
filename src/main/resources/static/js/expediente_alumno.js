/**
 * Expediente Digital Alumnos (MongoDB REST API)
 * Incluye historial de Pases, Justificantes, Incidencias, visualizador de documentos y Asistencia Semanal (Lunes a Viernes).
 */

let timerBusquedaExpediente = null;
let todosLosAlumnos = [];

window.alumnoSeleccionadoActual = null;
window.pasesAlumnoActual = [];
window.justAlumnoActual = [];
window.incAlumnoActual = [];
window.registrosAlumnoActual = [];
window.offsetSemanaActual = 0;
window.documentoActualTitulo = 'Documento';

const obtenerFechaFormateada = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        cargarEspecialidades(),
        cargarAlumnosBusqueda()
    ]);

    // Si viene con parámetro matricula o ncontrol en la URL, abrir su expediente directamente
    const params = new URLSearchParams(window.location.search);
    const matriculaParam = params.get('matricula') || params.get('ncontrol');
    if (matriculaParam) {
        const inputBusqueda = document.getElementById('busquedaGeneral');
        if (inputBusqueda) inputBusqueda.value = matriculaParam;
        filtrarYMostrarAlumnos();
        verExpedienteDetalle(matriculaParam);
    }
});

async function cargarEspecialidades() {
    const selectEsp = document.getElementById('filtroEspecialidad');
    if (!selectEsp) return;
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            selectEsp.innerHTML = '<option value="">-- Todas las Especialidades --</option>';
            (data.especialidades || []).forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.nombre; 
                opt.textContent = esp.nombre;
                selectEsp.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

async function obtenerDataURLQR(texto, size = 400) {
    return new Promise((resolve) => {
        const divTemp = document.createElement('div');
        const idFallback = String(texto || '').split('|')[0].trim() || '00000000000000';
        let textoLimpio = String(texto || '')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\x20-\x7E]/g, "")
            .trim()
            .substring(0, 48);
        if (!textoLimpio || textoLimpio.startsWith('data:')) {
            textoLimpio = idFallback;
        }
        try {
            new QRCode(divTemp, {
                text: textoLimpio,
                width: size,
                height: size,
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (errQr) {
            divTemp.innerHTML = "";
            new QRCode(divTemp, {
                text: idFallback.substring(0, 30),
                width: size,
                height: size,
                correctLevel: QRCode.CorrectLevel.L
            });
        }

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            const qrCanvas = divTemp.querySelector('canvas');
            if (qrCanvas && qrCanvas.width > 0) {
                ctx.drawImage(qrCanvas, 0, 0, size, size);
                resolve(canvas.toDataURL("image/png"));
                return;
            }

            const imgQR = divTemp.querySelector('img');
            const finalQR = new Image();
            finalQR.onload = () => {
                ctx.drawImage(finalQR, 0, 0, size, size);
                resolve(canvas.toDataURL("image/png"));
            };
            finalQR.onerror = () => resolve(qrCanvas ? qrCanvas.toDataURL() : '');
            finalQR.src = (imgQR && imgQR.src) ? imgQR.src : (qrCanvas ? qrCanvas.toDataURL() : '');
        }, 100);
    });
}

async function cargarAlumnosBusqueda() {
    try {
        const res = await fetch('/api/alumnos');
        if (res.ok) {
            const raw = await res.json();
            todosLosAlumnos = (Array.isArray(raw) ? raw : []).map(al => {
                const mat = al.ncontrol || al.matricula || '';
                const pat = al.apepat || al.primerApellido || '';
                const matApe = al.apemat || al.segundoApellido || '';
                al._searchStr = `${al.nombre || ''} ${pat} ${matApe} ${mat}`.toLowerCase();
                al._espUpper = (al.especialidad || '').trim().toUpperCase();
                return al;
            });
            const selectEsp = document.getElementById('filtroEspecialidad');
            if (selectEsp) {
                const espAlumnos = [...new Set(todosLosAlumnos.map(a => (a.especialidad || '').trim()).filter(Boolean))];
                espAlumnos.forEach(espNombre => {
                    if (!Array.from(selectEsp.options).some(opt => opt.value.toUpperCase() === espNombre.toUpperCase())) {
                        const opt = document.createElement('option');
                        opt.value = espNombre;
                        opt.textContent = espNombre;
                        selectEsp.appendChild(opt);
                    }
                });
            }
            filtrarYMostrarAlumnos();
        }
    } catch (e) {
        console.error("Error cargando alumnos:", e);
    }
}

function filtrarYMostrarAlumnos() {
    const tbody = document.getElementById('tablaAlumnosBody');
    if (!tbody) return;
    
    const b = (document.getElementById('busquedaGeneral')?.value || '').toLowerCase().trim();
    const fEsp = (document.getElementById('filtroEspecialidad')?.value || '').trim().toUpperCase();
    const fGrado = document.getElementById('filtroGrado')?.value || '';
    const fGpo = (document.getElementById('filtroGrupo')?.value || '').toUpperCase().trim();

    const filtrados = todosLosAlumnos.filter(al => {
        if (b && !(al._searchStr || '').includes(b)) return false;
        if (fEsp && al._espUpper !== fEsp) return false;
        if (fGrado && String(al.grado) !== fGrado) return false;
        if (fGpo && (al.grupo || '').toUpperCase() !== fGpo) return false;
        return true;
    });

    const limitados = filtrados.slice(0, 30);

    let rowsHtml = limitados.map(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const estatus = al.estatus_escolar || al.estatus || 'Activo';
        const statusClass = estatus === 'Activo' ? 'bg-success' : 'bg-secondary';
        
        return `
            <tr>
                <td class="fw-bold text-guinda">${mat}</td>
                <td>${al.nombre} ${pat} ${matApe}</td>
                <td><span class="badge bg-light text-dark border">${al.especialidad || 'N/A'}</span></td>
                <td class="text-center">${al.grado || ''}° "${al.grupo || ''}"</td>
                <td><span class="badge ${statusClass}">${estatus}</span></td>
                <td>
                    <button class="btn btn-sm btn-guinda" onclick="verExpedienteDetalle('${mat}')">
                       <i class="bi bi-eye-fill"></i> Ver Expediente
                    </button>        
                </td>
            </tr>`;
    }).join('');

    if (filtrados.length > 30) {
        rowsHtml += `<tr><td colspan="6" class="text-center text-muted small py-2">Mostrando 30 de ${filtrados.length} expedientes. Utiliza el buscador para más precisión.</td></tr>`;
    }

    tbody.innerHTML = rowsHtml;
}

document.getElementById('busquedaGeneral')?.addEventListener('input', () => {
    if (timerBusquedaExpediente) clearTimeout(timerBusquedaExpediente);
    timerBusquedaExpediente = setTimeout(filtrarYMostrarAlumnos, 65);
});
document.getElementById('filtroEspecialidad')?.addEventListener('change', filtrarYMostrarAlumnos);
document.getElementById('filtroGrado')?.addEventListener('input', filtrarYMostrarAlumnos);
document.getElementById('filtroGrupo')?.addEventListener('input', filtrarYMostrarAlumnos);

async function verExpedienteDetalle(matricula) {
    Swal.fire({ title: 'Sincronizando Historial...', didOpen: () => Swal.showLoading() });

    try {
        const resAl = await fetch(`/api/alumnos/ncontrol/${matricula}`);
        if (!resAl.ok) throw new Error("Alumno no encontrado");
        const al = await resAl.json();

        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const mat = al.ncontrol || al.matricula || matricula;

        const [pasesRes, justRes, incRes, regRes] = await Promise.all([
            fetch('/api/pases').then(r => r.ok ? r.json() : []),
            fetch('/api/justificantes').then(r => r.ok ? r.json() : []),
            fetch('/api/incidencias').then(r => r.ok ? r.json() : []),
            fetch(`/api/registros-diarios/matricula/${encodeURIComponent(mat)}`).then(r => r.ok ? r.json() : [])
        ]);

        const pasesAlumno = pasesRes.filter(p => (p.matricula || p.id_alumno) === mat);
        const justAlumno = justRes.filter(j => (j.id_alumno || j.matricula) === mat);
        const incAlumno = incRes.filter(i => (i.id_alumno || i.matricula) === mat);
        const registrosAlumno = Array.isArray(regRes) ? regRes : [];

        // Guardar estado en memoria global para el visor de documentos y asistencia
        window.alumnoSeleccionadoActual = al;
        window.pasesAlumnoActual = pasesAlumno;
        window.justAlumnoActual = justAlumno;
        window.incAlumnoActual = incAlumno;
        window.registrosAlumnoActual = registrosAlumno;
        window.offsetSemanaActual = 0;

        document.getElementById('expNombre').innerText = `${al.nombre} ${pat} ${matApe}`.trim().toUpperCase();
        document.getElementById('expMatricula').innerText = mat;
        document.getElementById('expEsp').innerText = al.especialidad || 'N/A';
        document.getElementById('expCurp').innerText = al.curp || 'N/A';
        document.getElementById('expTutor').innerText = al.nombretutor || 'No registrado';
        document.getElementById('expTelTutor').innerText = al.teltutor || 'N/A';
        
        const fotoReal = al.fotoUrl || al.foto_url || al.foto || '/img/default_avatar.png';
        const imgFoto = document.getElementById('expFotoPerfil');
        if (imgFoto) imgFoto.src = fotoReal;

        const qrTexto = al.qr_texto || al.qrCode || `${mat}|${al.nombre}`;
        const qrDataUrl = await obtenerDataURLQR(qrTexto, 200);
        document.getElementById('expQR').src = qrDataUrl;
        document.getElementById('expMatriculaQR').innerText = mat;
        
        const sem = document.getElementById('expSemaforo');
        sem.innerText = (al.color_semaforo || 'Verde').toUpperCase();
        sem.className = "badge px-3 py-2 text-white";
        sem.style.backgroundColor = getColorSemaforo(al.color_semaforo);

        const divPadecimientos = document.getElementById('expPadecimientos');
        if (divPadecimientos) {
            if (al.padecimientos_registrados && al.padecimientos_registrados.length > 0) {
                const bordeAlerta = al.color_semaforo === 'Rojo' ? '#ff4d4d' : '#ffc107';
                
                let htmlPadecimientos = `
                    <div class="p-3 rounded shadow-sm" style="background-color: rgba(0,0,0,0.15); border-left: 4px solid ${bordeAlerta};">
                        <p class="mb-2 fw-bold text-warning small"><i class="bi bi-heart-pulse-fill me-1"></i>Condiciones Médicas/Cógnitivas:</p>
                        <ul class="mb-0 ps-3 text-white" style="font-size: 0.8rem;">`;
                    
                al.padecimientos_registrados.forEach(pad => {
                    let badgeGrav = pad.gravedad === 'Rojo' ? 'danger' : (pad.gravedad === 'Amarillo' ? 'warning text-dark' : 'success');
                    htmlPadecimientos += `
                        <li class="mb-2">
                            <b>${pad.tipo}</b> <span class="badge bg-${badgeGrav} ms-1" style="font-size: 0.6rem;">${pad.gravedad || 'N/A'}</span><br>
                            <span class="text-white-50">${pad.detalles || 'Sin detalles extra'}</span>
                        </li>`;
                });
                
                htmlPadecimientos += `</ul></div>`;
                divPadecimientos.innerHTML = htmlPadecimientos;
            } else {
                divPadecimientos.innerHTML = `
                    <div class="p-2 rounded text-center shadow-sm" style="background-color: rgba(0,0,0,0.1);">
                        <small class="text-white-50"><i class="bi bi-check-circle-fill text-success me-1"></i>Sin condiciones médicas graves</small>
                    </div>`;
            }
        }
		
        document.getElementById('cntPases').innerText = pasesAlumno.length;
        document.getElementById('cntJustificantes').innerText = justAlumno.length;
        document.getElementById('cntIncidencias').innerText = incAlumno.length;

        // Historial con botón "Ver Documento"
        llenarLista(document.getElementById('listaHistorialPases'), pasesAlumno, p => 
            `<div class="d-flex justify-content-between align-items-center">
                <div>
                    <span><i class="bi bi-calendar-event me-2 text-guinda"></i><b>${p.fecha || ''}</b></span>
                    <span class="badge bg-light text-dark border ms-2">Folio: ${p.folio_pase || 'S/F'}</span>
                    <div class="text-muted small mt-1"><i class="bi bi-arrow-return-right me-1"></i>${p.motivo || 'Salida'}</div>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-sm" onclick="verDocumentoPase('${p._id || p.folio_pase || p.id}')">
                        <i class="bi bi-eye-fill me-1"></i>Ver Pase
                    </button>
                </div>
            </div>`);
            
        llenarLista(document.getElementById('listaHistorialJust'), justAlumno, j => 
            `<div class="d-flex justify-content-between align-items-center">
                <div>
                    <span><i class="bi bi-file-medical text-warning me-2"></i><b>Folio: ${j.folio_justificante || 'S/F'}</b></span>
                    <span class="badge bg-light text-dark border ms-2">${j.inasistencia_dia || ''}</span>
                    <div class="text-muted small mt-1"><i class="bi bi-arrow-return-right me-1"></i>Motivo: ${j.motivo_detalle || j.motivo || 'N/A'}</div>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-warning text-dark rounded-pill px-3 shadow-sm" onclick="verDocumentoJustificante('${j._id || j.folio_justificante || j.id}')">
                        <i class="bi bi-eye-fill me-1"></i>Ver Justificante
                    </button>
                </div>
            </div>`);
            
        llenarLista(document.getElementById('listaHistorialInc'), incAlumno, i => {
            const fechaTxt = i.fecha || i.fecha_registro || i.fecharegistro || 'S/F';
            const faltasStr = i.faltas_checklist ? (Array.isArray(i.faltas_checklist) ? i.faltas_checklist.join(', ') : i.faltas_checklist) : 'Sin detalle';
            return `<div class="d-flex justify-content-between align-items-center">
                <div>
                    <span><i class="bi bi-exclamation-triangle me-2 text-danger"></i><b>Folio: ${i.folio_incidencia || i._id || 'S/F'}</b></span>
                    <span class="badge bg-light text-dark border ms-2">${fechaTxt}</span>
                    <div class="text-muted small mt-1 text-truncate" style="max-width: 320px;">
                        <i class="bi bi-arrow-return-right me-1"></i>${faltasStr}
                    </div>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3 shadow-sm" onclick="verDocumentoIncidencia('${i._id || i.folio_incidencia || i.id}')">
                        <i class="bi bi-eye-fill me-1"></i>Ver Reporte
                    </button>
                </div>
            </div>`;
        });

        // Renderizar Asistencia Semanal (Lunes a Viernes)
        renderizarAsistenciaSemanal();

        document.getElementById('seccionBuscador').classList.add('d-none');
        document.getElementById('vistaExpediente').classList.remove('d-none');
        window.scrollTo(0,0);
        Swal.close();

    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

function llenarLista(contenedor, lista, formatoFn) {
    if (!contenedor) return;
    contenedor.innerHTML = (!lista || lista.length === 0) 
        ? '<li class="list-group-item text-muted small text-center py-3">Sin registros previos en esta categoría</li>' 
        : "";
        
    (lista || []).forEach(item => {
        const li = document.createElement('li');
        li.className = "list-group-item small shadow-sm mb-2 border-0 border-start border-3 border-guinda";
        li.innerHTML = formatoFn(item);
        contenedor.appendChild(li);
    });
}

function regresarABuscador() {
    document.getElementById('vistaExpediente').classList.add('d-none');
    document.getElementById('seccionBuscador').classList.remove('d-none');
}

function getColorSemaforo(c) {
    const colores = { 'Verde': '#198754', 'Amarillo': '#ffc107', 'Rojo': '#dc3545' };
    return colores[c] || colores['Verde'];
}

// ==========================================
// ASISTENCIA SEMANAL (LUNES A VIERNES)
// ==========================================

function cambiarSemanaExpediente(delta) {
    if (delta === 0) {
        window.offsetSemanaActual = 0;
    } else {
        window.offsetSemanaActual = (window.offsetSemanaActual || 0) + delta;
    }
    renderizarAsistenciaSemanal();
}
window.cambiarSemanaExpediente = cambiarSemanaExpediente;

function renderizarAsistenciaSemanal() {
    const contenedor = document.getElementById('contenedorDiasSemana');
    if (!contenedor) return;

    const offset = window.offsetSemanaActual || 0;
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

    // Calcular lunes de la semana correspondiente
    const diaSemana = hoy.getDay(); // 0 Dom, 1 Lun, 2 Mar, 3 Mie, 4 Jue, 5 Vie, 6 Sab
    const distALunes = (diaSemana === 0 ? -6 : 1 - diaSemana) + (offset * 7);
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + distALunes);
    lunes.setHours(0, 0, 0, 0);

    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const diasSemana = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        const y = d.getFullYear();
        const m = pad(d.getMonth() + 1);
        const diaNum = pad(d.getDate());
        diasSemana.push({
            diaNombre: nombresDias[i],
            fechaStr: `${y}-${m}-${diaNum}`,
            diaTexto: `${d.getDate()} de ${mesesNombres[d.getMonth()]} de ${y}`,
            objDate: d
        });
    }

    // Encabezado del rango de fechas de la semana
    const primerDia = diasSemana[0];
    const ultimoDia = diasSemana[4];
    const rangoTextoEl = document.getElementById('rangoSemanaTexto');
    if (rangoTextoEl) {
        rangoTextoEl.innerText = `Semana del ${primerDia.diaNombre} ${primerDia.objDate.getDate()} al ${ultimoDia.diaNombre} ${ultimoDia.diaTexto}`;
    }

    let asistenciasCnt = 0;
    let faltasCnt = 0;
    let omisionesCnt = 0;
    let justificadosCnt = 0;

    const registros = window.registrosAlumnoActual || [];
    const justificantes = window.justAlumnoActual || [];

    let htmlDias = '';

    diasSemana.forEach(d => {
        const fecha = d.fechaStr;
        const esHoy = (fecha === hoyStr);
        const esFuturo = (fecha > hoyStr);

        // Buscar registro de asistencia del día
        const reg = registros.find(r => r.fecha === fecha);
        
        // Buscar si existe justificante para este día
        const just = justificantes.find(j => {
            const campoInasistencia = String(j.inasistencia_dia || j.fecha || '').toLowerCase();
            if (campoInasistencia.includes(fecha)) return true;
            const partes = fecha.split('-');
            if (partes.length === 3 && campoInasistencia.includes(`${partes[2]}/${partes[1]}/${partes[0]}`)) return true;
            return false;
        });

        let claseTarjeta = '';
        let badgeHtml = '';
        let detalleHtml = '';

        if (esFuturo) {
            claseTarjeta = 'tarjeta-dia-futuro';
            badgeHtml = `<span class="badge bg-secondary px-3 py-2"><i class="bi bi-clock me-1"></i>POR TRANSCURRIR</span>`;
            detalleHtml = `<span class="text-muted"><i class="bi bi-info-circle me-1"></i>Jornada escolar aún no transcurrida.</span>`;
        } else if (reg && reg.hora_entrada && reg.hora_entrada.trim() !== '') {
            // El alumno checó entrada
            const tieneSalida = !!((reg.hora_salida && reg.hora_salida.trim() !== '') || reg.estatus_actual === 'FUERA');
            if (tieneSalida) {
                // Checó entrada y salida -> 1 asistencia en el día checado
                asistenciasCnt++;
                claseTarjeta = 'tarjeta-dia-asistio';
                badgeHtml = `<span class="badge bg-success px-3 py-2"><i class="bi bi-check-circle-fill me-1"></i>ASISTIÓ</span>`;
                detalleHtml = `<div class="d-flex flex-wrap gap-3 align-items-center">
                    <span><i class="bi bi-box-arrow-in-right text-success me-1"></i>Entrada: <b>${reg.hora_entrada}</b></span>
                    <span><i class="bi bi-box-arrow-right text-primary me-1"></i>Salida: <b>${reg.hora_salida || 'Registrada'}</b></span>
                    <span class="badge bg-light text-success border border-success"><i class="bi bi-check2-all me-1"></i>1 Asistencia Completa</span>
                </div>`;
            } else {
                // Checó entrada pero NO checó salida
                if (esHoy) {
                    claseTarjeta = 'tarjeta-dia-asistio';
                    badgeHtml = `<span class="badge bg-primary px-3 py-2"><i class="bi bi-geo-alt-fill me-1"></i>PRESENTE EN PLANTEL</span>`;
                    detalleHtml = `<div class="d-flex flex-wrap gap-3 align-items-center">
                        <span><i class="bi bi-box-arrow-in-right text-success me-1"></i>Entrada: <b>${reg.hora_entrada}</b></span>
                        <span class="text-muted"><i class="bi bi-hourglass-split me-1"></i>En jornada escolar activa (Salida pendiente de registrar al salir)</span>
                    </div>`;
                } else {
                    // Día pasado: No registró salida -> Omisión de salida
                    omisionesCnt++;
                    claseTarjeta = 'tarjeta-dia-omision';
                    badgeHtml = `<span class="badge bg-warning text-dark px-3 py-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>NO REGISTRÓ SALIDA</span>`;
                    detalleHtml = `<div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div>
                            <span><i class="bi bi-box-arrow-in-right text-success me-1"></i>Entrada: <b>${reg.hora_entrada}</b></span>
                            <span class="text-danger ms-3"><i class="bi bi-x-circle me-1"></i>Salida: <b>Sin registro de salida</b></span>
                        </div>
                        <div>
                            <small class="badge bg-danger-subtle text-danger border border-danger">Omisión de Salida</small>
                        </div>
                    </div>`;
                }
            }
        } else {
            // No hubo registro de entrada en este día hábil
            if (just) {
                justificadosCnt++;
                claseTarjeta = 'tarjeta-dia-justificado';
                badgeHtml = `<span class="badge bg-info text-dark px-3 py-2"><i class="bi bi-file-medical-fill me-1"></i>JUSTIFICADO</span>`;
                detalleHtml = `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                        <span class="text-dark"><i class="bi bi-shield-check text-info me-1"></i>Inasistencia Justificada: <b>${just.motivo_detalle || just.motivo || 'Motivo oficial'}</b></span>
                        <span class="badge bg-light text-dark border ms-2">Folio: ${just.folio_justificante || 'S/F'}</span>
                    </div>
                    <button class="btn btn-sm btn-outline-info text-dark rounded-pill" onclick="verDocumentoJustificante('${just._id || just.folio_justificante || just.id}')">
                        <i class="bi bi-eye-fill me-1"></i>Ver Justificante
                    </button>
                </div>`;
            } else if (esHoy) {
                claseTarjeta = 'tarjeta-dia-falto';
                badgeHtml = `<span class="badge bg-secondary px-3 py-2"><i class="bi bi-dash-circle me-1"></i>SIN ENTRADA HOY</span>`;
                detalleHtml = `<span class="text-muted"><i class="bi bi-clock-history me-1"></i>No ha registrado checada de entrada en el punto de control el día de hoy.</span>`;
            } else {
                faltasCnt++;
                claseTarjeta = 'tarjeta-dia-falto';
                badgeHtml = `<span class="badge bg-danger px-3 py-2"><i class="bi bi-x-circle-fill me-1"></i>FALTÓ</span>`;
                detalleHtml = `<div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span class="text-danger"><i class="bi bi-person-x-fill me-1"></i>Inasistencia no justificada (No registró entrada ni salida en este día hábil).</span>
                    <span class="badge bg-light text-danger border border-danger">1 Inasistencia</span>
                </div>`;
            }
        }

        htmlDias += `
            <div class="card card-custom p-3 shadow-sm tarjeta-dia-semana ${claseTarjeta}">
                <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2 border-bottom pb-2">
                    <div>
                        <span class="fw-bold fs-6 text-dark me-2">${d.diaNombre}</span>
                        <span class="text-muted small">${d.diaTexto}</span>
                        ${esHoy ? '<span class="badge bg-primary-subtle text-primary border border-primary ms-2 small">Hoy</span>' : ''}
                    </div>
                    <div>
                        ${badgeHtml}
                    </div>
                </div>
                <div class="small">
                    ${detalleHtml}
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = htmlDias;

    // Actualizar contadores
    const elAsis = document.getElementById('cntSemanaAsistencias');
    const elFal = document.getElementById('cntSemanaFaltas');
    const elOmi = document.getElementById('cntSemanaOmisiones');
    const elJust = document.getElementById('cntSemanaJustificados');
    if (elAsis) elAsis.innerText = asistenciasCnt;
    if (elFal) elFal.innerText = faltasCnt;
    if (elOmi) elOmi.innerText = omisionesCnt;
    if (elJust) elJust.innerText = justificadosCnt;
}
window.renderizarAsistenciaSemanal = renderizarAsistenciaSemanal;

// ==========================================
// VISOR DE DOCUMENTOS OFICIALES EN MODAL
// ==========================================

function verDocumentoPase(idPase) {
    const p = (window.pasesAlumnoActual || []).find(x => (x._id === idPase || x.folio_pase === idPase || x.id === idPase));
    if (!p) return Swal.fire("Error", "No se encontró el pase de salida.", "error");

    const al = window.alumnoSeleccionadoActual || {};
    const cfg = window.cfgSistemaGlobal || {};

    const pat = al.apepat || al.primerApellido || '';
    const matApe = al.apemat || al.segundoApellido || '';
    const nombreCompleto = (al.nombre ? `${al.nombre} ${pat} ${matApe}` : (p.nombreFull || p.nombre || al.matricula || '')).trim().toUpperCase();
    const grado = al.grado || p.grado || '';
    const grupo = al.grupo || p.grupo || '';
    const especialidad = al.especialidad || p.especialidad || '';
    const folio = p.folio_pase || (String(p._id || '').split('-').pop()) || '0001';
    const fecha = p.fecha || obtenerFechaFormateada();
    const hora = p.hora_salida || p.hora || '--:--';
    const motivo = (p.motivo || 'ASUNTOS PERSONALES / MÉDICOS').toUpperCase();
    const nomPlantel = cfg.nombre_oficial_plantel || cfg.nombre_plantel || 'Centro de Bachillerato Tecnológico Industrial y de Servicios';
    const orientacionResp = cfg.responsable_orientacion || 'Sello y Firma';

    const html = `
        <div class="hoja-pase-preview mx-auto">
            <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                <div style="width: 74px; flex-shrink: 0;">
                    <img src="/img/logoMujerGob.png" alt="Gobierno" style="width: 74px; height: auto; display: block;" onerror="this.src='/img/logo_sep_educacion.png'">
                </div>
                <div class="text-center flex-grow-1" style="line-height: 1.35; font-size: 11px; color: #7b1b37;">
                    Dirección General de Educación Tecnológica Industrial y de Servicios<br>
                    <span class="fw-bold">${nomPlantel}</span><br>
                    Departamento de Servicios Escolares<br>
                    Oficina de Orientación Educativa<br>
                    <div style="font-style: italic; font-weight: bold; font-size: 15px; margin-top: 3px;">PASE DE SALIDA INDIVIDUAL</div>
                </div>
                <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center;">
                    <img src="/img/logoSep.png" alt="SEP" style="width: 68px; height: auto; display: block;" onerror="this.src='/img/logo_sep_educacion.png'">
                    <div style="width: 72px; margin-top: 4px;">
                        <div style="background: #7b1b37; color: #fff; font-weight: bold; font-size: 10px; letter-spacing: 2.5px; text-align: center; padding: 2px 0;">FOLIO</div>
                        <div style="background: #fffde4; color: #7b1b37; font-weight: bold; font-size: 19px; text-align: center; border: 2px solid #7b1b37; border-top: none; padding: 1px 0;">${folio}</div>
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-start mb-2" style="font-size: 11.5px;">
                <div class="fw-bold" style="line-height: 1.4;">
                    CC: PREFECTOS Y PERSONAL DE VIGILANCIA.<br>
                    P R E S E N T E S
                </div>
                <div class="d-flex align-items-center gap-1">
                    <span class="fw-bold">Fecha:</span>
                    <span style="border-bottom: 1px solid #000; min-width: 140px; text-align: center; display: inline-block;">${fecha}</span>
                </div>
            </div>

            <div style="font-size: 11.5px; line-height: 1.8; margin-bottom: 10px;">
                <div>Por medio del presente se les solicita permitan la salida del alumno (a):</div>
                <div class="fw-bold text-center my-1" style="border-bottom: 1px solid #000; font-size: 13px;">${nombreCompleto}</div>
                <div class="d-flex flex-wrap align-items-baseline gap-1">
                    <span>del</span>
                    <span class="fw-bold text-center px-2" style="border-bottom: 1px solid #000; min-width: 50px;">${grado}</span>
                    <span>SEMESTRE, GRUPO: “</span>
                    <span class="fw-bold text-center px-2" style="border-bottom: 1px solid #000; min-width: 50px;">${grupo}</span>
                    <span>” ESPECIALIDAD</span>
                    <span class="fw-bold text-center px-2" style="border-bottom: 1px solid #000; min-width: 160px;">${especialidad}</span>
                    <span>Hora de Salida:</span>
                    <span class="fw-bold text-center px-2" style="border-bottom: 1px solid #000; min-width: 80px;">${hora}</span>
                </div>
                <div class="d-flex align-items-baseline gap-1 mt-1">
                    <span>horas por motivo de:</span>
                    <span class="fw-bold text-center px-2 flex-grow-1" style="border-bottom: 1px solid #000;">${motivo}</span>
                </div>
            </div>

            <div style="font-weight: bold; text-decoration: underline; font-size: 10.5px; text-align: justify; margin: 12px 0 20px 0; line-height: 1.35;">
                OBSERVACIONES: EL PRESENTE PASE DE SALIDA NO JUSTIFICA LAS INASISTENCIAS DE LOS MÓDULOS EN QUE SE AUSENTA.
            </div>

            <div class="d-flex justify-content-between align-items-end mt-4 px-3">
                <div style="width: 44%; text-align: center;">
                    <div style="height: 44px;"></div>
                    <div style="width: 100%; border-top: 1.5px solid #000; margin-bottom: 5px;"></div>
                    <div class="fw-bold" style="font-size: 11px;">Autoriza Salida de Alumno</div>
                    <div style="font-size: 10px; color: #333;">(Firma de Autorización)</div>
                </div>
                <div style="width: 44%; text-align: center;">
                    <div style="height: 44px;"></div>
                    <div style="width: 100%; border-top: 1.5px solid #000; margin-bottom: 5px;"></div>
                    <div class="fw-bold" style="font-size: 11px;">Orientación Educativa</div>
                    <div class="fw-bold text-uppercase" style="font-size: 10px; color: #333;">${orientacionResp}</div>
                </div>
            </div>
        </div>
    `;

    mostrarModalDocumento('Pase de Salida Individual - Folio ' + folio, html, 'Pase_Salida_' + folio);
}
window.verDocumentoPase = verDocumentoPase;

function verDocumentoJustificante(idJust) {
    const j = (window.justAlumnoActual || []).find(x => (x._id === idJust || x.folio_justificante === idJust || x.id === idJust));
    if (!j) return Swal.fire("Error", "No se encontró el justificante.", "error");

    const al = window.alumnoSeleccionadoActual || {};
    const cfg = window.cfgSistemaGlobal || {};

    const pat = al.apepat || al.primerApellido || '';
    const matApe = al.apemat || al.segundoApellido || '';
    const nombreCompleto = (al.nombre ? `${al.nombre} ${pat} ${matApe}` : (j.nombreFull || j.nombre || al.matricula || '')).trim().toUpperCase();
    const grado = al.grado || j.grado || '';
    const grupo = al.grupo || j.grupo || '';
    const especialidad = al.especialidad || j.especialidad || '';
    const tutor = (al.nombretutor || j.nombre_tutor || 'PADRE O TUTOR').toUpperCase();
    const folio = j.folio_justificante || (String(j._id || '').split('-').pop()) || '0001';
    const fechaEmi = j.fecha_emision || j.fecha || obtenerFechaFormateada();
    const inasistenciaDias = j.inasistencia_dia || j.fecha || '';
    const motivoDetalle = (j.motivo_detalle || j.motivo || 'ASUNTOS DE FUERZA MAYOR / DE SALUD').toUpperCase();
    const nomPlantel = cfg.nombre_plantel || 'CBTIS 134';
    const cct = cfg.cct_escuela || cfg.cct_plantel || '12DCT0001L';
    const ciudad = cfg.ciudad_plantel || 'Chilpancingo de los Bravo, Guerrero';
    const respOrientacion = cfg.responsable_orientacion || 'Sello y Firma';

    const html = `
        <div class="hoja-justificante-preview mx-auto">
            <div class="d-flex align-items-center justify-content-between mb-3" style="gap: 10px;">
                <div class="d-flex align-items-center" style="gap: 10px; flex-shrink: 0;">
                    <img src="/img/logo_sep_educacion.png" alt="SEP" style="height: 13.5mm; width: auto; object-fit: contain;">
                    <img src="/img/logo_dgeti_oficial.png" alt="DGETI" style="height: 14mm; width: auto; object-fit: contain;">
                </div>
                <div class="text-end flex-grow-1 px-1" style="line-height: 1.2;">
                    <div style="font-size: 10.5pt; font-weight: 700; color: #1f1f1f;">SEMS</div>
                    <div style="font-size: 9pt; font-weight: 700; color: #111; text-transform: uppercase;">${nomPlantel}</div>
                    <div style="font-size: 8pt; font-weight: 700; color: #444;">${cct}</div>
                </div>
                <div style="flex-shrink: 0;">
                    <img src="/img/logo_joven_patria.png" alt="Emblema Nacional" style="height: 20mm; width: auto; object-fit: contain;">
                </div>
            </div>

            <div class="text-end fw-bold mb-1" style="font-size: 11pt; color: #7b1b37;">
                FOLIO: ${folio}
            </div>
            <div class="text-center fw-bold mb-3" style="font-size: 10pt;">
                ${ciudad}; a ${fechaEmi}
            </div>

            <div class="fw-bold mb-3" style="font-size: 10.5pt; line-height: 1.25;">
                CC. CATEDRÁTICOS DE ESTA INSTITUCIÓN<br>
                P R E S E N T E .
            </div>

            <div style="font-size: 10.5pt; line-height: 1.8; text-align: justify; margin-bottom: 20px;">
                Por medio de la presente, me dirijo a ustedes de la manera más atenta para solicitarles tengan a bien justificar las inasistencias del alumno(a):
                <div class="fw-bold text-center py-1 my-1" style="border-bottom: 1.5px solid #000; font-size: 12pt;">${nombreCompleto}</div>
                del <span class="fw-bold">${grado}°</span> Semestre, Grupo <span class="fw-bold">"${grupo}"</span>, de la Especialidad de <span class="fw-bold">${especialidad}</span>,
                durante el/los día(s): <span class="fw-bold text-decoration-underline">${inasistenciaDias}</span>, por el siguiente motivo:
                <div class="fw-bold text-center py-1 my-1" style="border-bottom: 1.5px solid #000;">${motivoDetalle}</div>
                Agradeciendo de antemano la atención que brinden a la presente solicitud.
            </div>

            <div class="d-flex justify-content-between align-items-end mt-5 pt-3 px-3">
                <div style="width: 44%; text-align: center;">
                    <div style="border-top: 1.5px solid #000; padding-top: 4px;">
                        <div class="fw-bold" style="font-size: 10.5pt;">${tutor}</div>
                        <div class="text-muted small">Nombre y Firma del Tutor</div>
                    </div>
                </div>
                <div style="width: 44%; text-align: center;">
                    <div style="border-top: 1.5px solid #000; padding-top: 4px;">
                        <div class="fw-bold" style="font-size: 10.5pt;">Orientación Educativa</div>
                        <div class="text-muted small text-uppercase">${respOrientacion}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    mostrarModalDocumento('Justificante de Inasistencias - Folio ' + folio, html, 'Justificante_' + folio);
}
window.verDocumentoJustificante = verDocumentoJustificante;

function verDocumentoIncidencia(idInc) {
    const inc = (window.incAlumnoActual || []).find(x => (x._id === idInc || x.folio_incidencia === idInc || x.id === idInc));
    if (!inc) return Swal.fire("Error", "No se encontró el reporte de incidencia.", "error");

    const al = window.alumnoSeleccionadoActual || {};
    const cfg = window.cfgSistemaGlobal || {};

    const pat = al.apepat || al.primerApellido || '';
    const matApe = al.apemat || al.segundoApellido || '';
    const nombreCompleto = (al.nombre ? `${al.nombre} ${pat} ${matApe}` : (inc.nombreFull || inc.nombre || al.matricula || '')).trim().toUpperCase();
    const matricula = al.ncontrol || al.matricula || inc.id_alumno || inc.matricula || '';
    const grado = al.grado || inc.grado || '';
    const grupo = al.grupo || inc.grupo || '';
    const especialidad = al.especialidad || inc.especialidad || '';
    const turno = al.turno || inc.turno || 'Matutino';
    const tutor = (al.nombretutor || inc.nombre_tutor || 'No registrado').toUpperCase();
    const telTutor = al.teltutor || inc.telefono_tutor || 'No registrado';
    const folio = inc.folio_incidencia || (String(inc._id || '').split('-').pop()) || 'INC-0001';
    const fecha = inc.fecha || inc.fecharegistro || inc.fecha_registro || obtenerFechaFormateada();
    const nomPlantel = cfg.nombre_plantel || cfg.nombre_oficial_plantel || 'CBTIS 134';
    const cct = cfg.cct_escuela || cfg.cct_plantel || '12DCT0001L';
    const ciudad = cfg.ciudad_plantel || 'Chilpancingo de los Bravo, Guerrero';
    const responsable = cfg.responsable_orientacion || 'Orientación Educativa / Prefectura';

    const faltasLista = Array.isArray(inc.faltas_checklist) ? inc.faltas_checklist : (inc.faltas_checklist ? [inc.faltas_checklist] : []);
    const descripcion = inc.descripcion_hechos || inc.motivo || inc.observaciones || 'Sin observaciones asentadas.';
    const sancion = inc.compromisos_acuerdos || inc.sancion || inc.medida_formativa || 'Compromiso de cumplimiento al reglamento escolar.';

    let faltasBadgesHtml = faltasLista.map(f => `<span class="badge bg-danger-subtle text-danger border border-danger p-1 me-1 mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>${f}</span>`).join('');
    if (!faltasBadgesHtml) faltasBadgesHtml = '<span class="text-muted small">Sin infracciones específicas marcadas</span>';

    const html = `
        <div class="hoja-incidencia-preview mx-auto">
            <div class="d-flex align-items-center justify-content-between mb-2" style="gap: 10px;">
                <div class="d-flex align-items-center" style="gap: 8px; flex-shrink: 0;">
                    <img src="/img/logo_sep_educacion.png" alt="SEP" style="height: 13mm; width: auto; object-fit: contain;">
                    <div style="height: 12mm; border-left: 1.5px solid #a0a0a0; margin: 0 4px;"></div>
                    <img src="/img/logo_dgeti_oficial.png" alt="DGETI" style="height: 13mm; width: auto; object-fit: contain;">
                </div>
                <div class="text-end flex-grow-1 px-1" style="line-height: 1.2;">
                    <div style="font-size: 10pt; font-weight: 700; color: #1f1f1f;">SEMS</div>
                    <div style="font-size: 9pt; font-weight: 700; color: #7b1b37; text-transform: uppercase;">${nomPlantel}</div>
                    <div style="font-size: 8pt; font-weight: 700; color: #444;">${cct}</div>
                </div>
                <div style="flex-shrink: 0;">
                    <img src="/img/logo_joven_patria.png" alt="Joven Patria" style="height: 18mm; width: auto; object-fit: contain;">
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2" style="border-color: #7b1b37 !important;">
                <span class="badge bg-danger px-3 py-1 fs-6">FOLIO: ${folio}</span>
                <span class="fw-bold text-uppercase fs-6" style="color: #7b1b37;">Reporte de Incidencia</span>
                <span class="small fw-bold text-muted">${ciudad}; a ${fecha}</span>
            </div>

            <!-- Datos Alumno -->
            <div class="p-2 bg-light rounded border mb-2 small" style="line-height: 1.5;">
                <div class="row g-1">
                    <div class="col-8"><b>Alumno:</b> <span class="fw-bold">${nombreCompleto}</span></div>
                    <div class="col-4"><b>Matrícula:</b> ${matricula}</div>
                    <div class="col-4"><b>Semestre/Gpo:</b> ${grado}° "${grupo}"</div>
                    <div class="col-4"><b>Turno:</b> ${turno}</div>
                    <div class="col-4"><b>Especialidad:</b> ${especialidad}</div>
                    <div class="col-8"><b>Tutor:</b> ${tutor}</div>
                    <div class="col-4"><b>Teléfono:</b> ${telTutor}</div>
                </div>
            </div>

            <!-- Motivos / Infracciones -->
            <div class="mb-2">
                <div class="fw-bold small text-danger mb-1"><i class="bi bi-tag-fill me-1"></i>Faltas / Infracciones Reportadas:</div>
                <div class="d-flex flex-wrap">${faltasBadgesHtml}</div>
            </div>

            <!-- Descripción -->
            <div class="mb-2">
                <div class="fw-bold small text-dark mb-1"><i class="bi bi-card-text me-1"></i>Descripción de los Hechos:</div>
                <div class="p-2 border rounded bg-white small" style="min-height: 50px; text-align: justify;">
                    ${descripcion}
                </div>
            </div>

            <!-- Medidas Formativas -->
            <div class="mb-3">
                <div class="fw-bold small text-dark mb-1"><i class="bi bi-clipboard-check me-1"></i>Compromisos y Medidas Formativas:</div>
                <div class="p-2 border rounded bg-white small" style="min-height: 40px; text-align: justify;">
                    ${sancion}
                </div>
            </div>

            <!-- Firmas -->
            <div class="d-flex justify-content-between align-items-end mt-4 pt-2 text-center" style="font-size: 9.5pt;">
                <div style="width: 30%;">
                    <div style="border-top: 1.5px solid #000; padding-top: 3px;">
                        <div class="fw-bold">${al.nombre || 'Alumno'}</div>
                        <div class="text-muted small">Firma del Alumno</div>
                    </div>
                </div>
                <div style="width: 30%;">
                    <div style="border-top: 1.5px solid #000; padding-top: 3px;">
                        <div class="fw-bold">${tutor}</div>
                        <div class="text-muted small">Padre o Tutor</div>
                    </div>
                </div>
                <div style="width: 30%;">
                    <div style="border-top: 1.5px solid #000; padding-top: 3px;">
                        <div class="fw-bold">${responsable}</div>
                        <div class="text-muted small">Sello y Firma</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    mostrarModalDocumento('Reporte de Incidencia - Folio ' + folio, html, 'Reporte_Incidencia_' + folio);
}
window.verDocumentoIncidencia = verDocumentoIncidencia;

function mostrarModalDocumento(titulo, htmlContenido, nombreArchivo) {
    const tituloEl = document.getElementById('tituloModalDoc');
    const cuerpoEl = document.getElementById('cuerpoModalDocumento');
    if (tituloEl) tituloEl.innerHTML = `<i class="bi bi-file-earmark-text me-2"></i>${titulo}`;
    if (cuerpoEl) cuerpoEl.innerHTML = htmlContenido;
    window.documentoActualTitulo = nombreArchivo || 'Documento_Escolar';

    const modalEl = document.getElementById('modalVisualizarDocumentoExpediente');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const m = bootstrap.Modal.getOrCreateInstance(modalEl);
        m.show();
    }
}

function descargarPdfDocumentoActual() {
    const cuerpoEl = document.getElementById('cuerpoModalDocumento');
    const el = cuerpoEl ? cuerpoEl.firstElementChild : null;
    if (!el) return Swal.fire("Atención", "No hay documento para exportar.", "warning");
    
    const titulo = window.documentoActualTitulo || 'Documento_Escolar';
    Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });
    
    const opt = {
        margin: [8, 8, 8, 8],
        filename: `${titulo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(el).save().then(() => {
        Swal.close();
    }).catch(err => {
        console.error("Error generando PDF:", err);
        Swal.fire("Error", "No se pudo generar el PDF.", "error");
    });
}
window.descargarPdfDocumentoActual = descargarPdfDocumentoActual;

function imprimirDocumentoActual() {
    const cuerpoEl = document.getElementById('cuerpoModalDocumento');
    if (!cuerpoEl) return;
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${window.documentoActualTitulo || 'Documento'}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { margin: 15px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; }
                .hoja-pase-preview { width: 100% !important; background: #FFFAB9 !important; border: 1.5px solid #c8b44a !important; padding: 18px 22px; }
                .hoja-justificante-preview { width: 100% !important; background: #fff !important; border: 1px solid #ccc !important; padding: 24px; }
                .hoja-incidencia-preview { width: 100% !important; background: #fff !important; border: 1px solid #ccc !important; padding: 20px; }
                @media print {
                    body { margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="d-flex justify-content-center">
                ${cuerpoEl.innerHTML}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
    win.document.close();
}
window.imprimirDocumentoActual = imprimirDocumentoActual;
