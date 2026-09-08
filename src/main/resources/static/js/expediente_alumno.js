/**
 * Expediente Digital Alumnos (MongoDB REST API)
 */

document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidades();
    await cargarAlumnosBusqueda();

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
        let textoLimpio = (texto || '').trim();
        if (textoLimpio.length > 60 || textoLimpio.startsWith('data:')) {
            textoLimpio = textoLimpio.substring(0, 60);
        }
        new QRCode(divTemp, {
            text: textoLimpio,
            width: size,
            height: size,
            correctLevel: QRCode.CorrectLevel.L
        });

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            const imgQR = divTemp.querySelector('img');
            const imgTigre = new Image();
            imgTigre.src = '/img/tigres.png';

            imgTigre.onload = () => {
                if (imgQR) ctx.drawImage(imgQR, 0, 0, size, size);
                const logoSize = size * 0.22;
                const pos = (size - logoSize) / 2;
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(pos - 5, pos - 5, logoSize + 10, logoSize + 10);
                ctx.drawImage(imgTigre, pos, pos, logoSize, logoSize);
                resolve(canvas.toDataURL("image/png"));
            };
            imgTigre.onerror = () => resolve(imgQR ? imgQR.src : divTemp.querySelector('canvas') ? divTemp.querySelector('canvas').toDataURL() : '');
        }, 150);
    });
}

let todosLosAlumnos = [];

async function cargarAlumnosBusqueda() {
    try {
        const res = await fetch('/api/alumnos');
        if (res.ok) {
            todosLosAlumnos = await res.json();
            filtrarYMostrarAlumnos();
        }
    } catch (e) {
        console.error("Error cargando alumnos:", e);
    }
}

function filtrarYMostrarAlumnos() {
    const tbody = document.getElementById('tablaAlumnosBody');
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const b = (document.getElementById('busquedaGeneral')?.value || '').toLowerCase();
    const fEsp = document.getElementById('filtroEspecialidad')?.value || '';
    const fGrado = document.getElementById('filtroGrado')?.value || '';
    const fGpo = (document.getElementById('filtroGrupo')?.value || '').toUpperCase();

    let filtrados = todosLosAlumnos.filter(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreCompleto = `${al.nombre} ${pat} ${matApe}`.toLowerCase();

        if (b && !nombreCompleto.includes(b) && !mat.includes(b)) return false;
        if (fEsp && al.especialidad !== fEsp) return false;
        if (fGrado && String(al.grado) !== fGrado) return false;
        if (fGpo && al.grupo !== fGpo) return false;
        return true;
    });

    const limitados = filtrados.slice(0, 30);

    limitados.forEach(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const estatus = al.estatus_escolar || al.estatus || 'Activo';
        const statusClass = estatus === 'Activo' ? 'bg-success' : 'bg-secondary';
        
        tbody.innerHTML += `
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
    });

    if (filtrados.length > 30) {
        tbody.innerHTML += `<tr><td colspan="6" class="text-center text-muted small py-2">Mostrando 30 de ${filtrados.length} expedientes. Utiliza el buscador para más precisión.</td></tr>`;
    }
}

document.getElementById('busquedaGeneral')?.addEventListener('input', filtrarYMostrarAlumnos);
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

        const [pasesRes, justRes, incRes] = await Promise.all([
            fetch('/api/pases').then(r => r.ok ? r.json() : []),
            fetch('/api/justificantes').then(r => r.ok ? r.json() : []),
            fetch('/api/incidencias').then(r => r.ok ? r.json() : [])
        ]);

        const pasesAlumno = pasesRes.filter(p => (p.matricula || p.id_alumno) === mat);
        const justAlumno = justRes.filter(j => (j.id_alumno || j.matricula) === mat);
        const incAlumno = incRes.filter(i => (i.id_alumno || i.matricula) === mat);

        document.getElementById('expNombre').innerText = `${al.nombre} ${pat} ${matApe}`.trim().toUpperCase();
        document.getElementById('expMatricula').innerText = mat;
        document.getElementById('expEsp').innerText = al.especialidad || 'N/A';
        document.getElementById('expCurp').innerText = al.curp || 'N/A';
        document.getElementById('expTutor').innerText = al.nombretutor || 'No registrado';
        document.getElementById('expTelTutor').innerText = al.teltutor || 'N/A';
        
        const fotoReal = al.fotoUrl || al.foto_url || al.foto || '/img/logo_aniversario.jpg';
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

        llenarLista(document.getElementById('listaHistorialPases'), pasesAlumno, p => 
            `<div class="d-flex justify-content-between">
                <span><i class="bi bi-calendar-event me-2 text-guinda"></i><b>${p.fecha}</b></span>
                <span class="text-muted">${p.motivo || 'Salida'}</span>
            </div>`);
            
        llenarLista(document.getElementById('listaHistorialJust'), justAlumno, j => 
            `<div class="d-flex justify-content-between">
                <span><i class="bi bi-file-medical text-warning me-2"></i><b>Folio: ${j.folio_justificante}</b></span>
                <small class="text-muted">${j.inasistencia_dia}</small>
             </div>
             <small class="text-muted d-block mt-1"><i class="bi bi-arrow-return-right me-1"></i>Motivo: ${j.motivo_detalle}</small>`);
            
        llenarLista(document.getElementById('listaHistorialInc'), incAlumno, i => {
            const fechaTxt = i.fecha || i.fecha_registro || i.fecharegistro || 'S/F';
            return `<div class="d-flex justify-content-between">
                <span><i class="bi bi-exclamation-triangle me-2 text-danger"></i><b>${fechaTxt}</b></span>
                <span class="text-truncate" style="max-width: 200px;">${i.faltas_checklist ? i.faltas_checklist.join(', ') : 'Sin detalle'}</span>
            </div>`;
        });

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