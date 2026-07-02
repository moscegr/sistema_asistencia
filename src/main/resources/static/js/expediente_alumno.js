// static/js/expediente_alumno.js

// 1. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarFiltros(); // Carga las carreras del panel
    cargarAlumnosBusqueda();
    
    // Listeners de búsqueda
    ['busquedaGeneral', 'filtroEspecialidad', 'filtroGrado', 'filtroGrupo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', cargarAlumnosBusqueda);
    });
});

// 2. CARGAR ESPECIALIDADES DESDE CONFIGURACIÓN
async function inicializarFiltros() {
    const selectEsp = document.getElementById('filtroEspecialidad');
    if (!selectEsp) return;

    try {
        const doc = await db.collection("configuracion").doc("escolar").get();
        if (doc.exists && doc.data().especialidades) {

            selectEsp.innerHTML = '<option value="">-- Todas las Especialidades --</option>';
            doc.data().especialidades.forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.nombre; 
                opt.textContent = esp.nombre;
                selectEsp.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

// Para el QR
async function obtenerDataURLQR(texto, size = 400) {
    return new Promise((resolve) => {
        const divTemp = document.createElement('div');
        new QRCode(divTemp, {
            text: texto,
            width: size,
            height: size,
            correctLevel: QRCode.CorrectLevel.M
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
                ctx.drawImage(imgQR, 0, 0, size, size);
                const logoSize = size * 0.22;
                const pos = (size - logoSize) / 2;
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(pos - 5, pos - 5, logoSize + 10, logoSize + 10);
                ctx.drawImage(imgTigre, pos, pos, logoSize, logoSize);
                resolve(canvas.toDataURL("image/png"));
            };
            imgTigre.onerror = () => resolve(imgQR.src);
        }, 150);
    });
}

// 3. BUSCADOR EN TIEMPO REAL
function cargarAlumnosBusqueda() {
    db.collection("alumnos").orderBy("fecharegistro", "desc").onSnapshot((snap) => {
        const tbody = document.getElementById('tablaAlumnosBody');
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const b = document.getElementById('busquedaGeneral').value.toLowerCase();
        const fEsp = document.getElementById('filtroEspecialidad').value;
        const fGrado = document.getElementById('filtroGrado').value;
        const fGpo = document.getElementById('filtroGrupo').value.toUpperCase();

        let filtrados = [];

        snap.forEach(doc => {
            const al = doc.data();
            
            const nombreCompleto = `${al.nombre} ${al.apepat} ${al.apemat}`.toLowerCase();
            if (b && !nombreCompleto.includes(b) && !al.matricula.includes(b)) return;
            if (fEsp && al.especialidad !== fEsp) return;
            if (fGrado && String(al.grado) !== fGrado) return;
            if (fGpo && al.grupo !== fGpo) return;

            filtrados.push(al);
        });

        const limitados = filtrados.slice(0, 30);

        limitados.forEach(al => {
            const statusClass = al.estatus_escolar === 'Activo' ? 'bg-success' : 'bg-secondary';
            tbody.innerHTML += `
                <tr>
                    <td class="fw-bold text-guinda">${al.matricula}</td>
                    <td>${al.nombre} ${al.apepat} ${al.apemat || ''}</td>
                    <td><span class="badge bg-light text-dark border">${al.especialidad}</span></td>
                    <td class="text-center">${al.grado}° "${al.grupo}"</td>
                    <td><span class="badge ${statusClass}">${al.estatus_escolar}</span></td>
					<td>
					    <button class="btn btn-sm btn-guinda" onclick="verExpedienteDetalle('${al.matricula}')">
					       <i class="bi bi-eye-fill"></i> Ver Expediente
					    </button>        
                    </td>
                </tr>`;
        });

        if (filtrados.length > 30) {
            tbody.innerHTML += `<tr><td colspan="6" class="text-center text-muted small py-2">Mostrando 30 de ${filtrados.length} expedientes. Utiliza el buscador para más precisión.</td></tr>`;
        }
    });
}

// 4. DETALLE DEL EXPEDIENTE
async function verExpedienteDetalle(matricula) {
    Swal.fire({ title: 'Sincronizando Historial...', didOpen: () => Swal.showLoading() });

    try {
        const alDoc = await db.collection("alumnos").doc(matricula).get();
        if (!alDoc.exists) throw new Error("Alumno no encontrado");
        const al = alDoc.data();

        const [pasesSnap, justSnap, incSnap] = await Promise.all([
            db.collection("pases_salida").where("matricula", "==", matricula).get(),
            db.collection("justificantes").where("id_alumno", "==", matricula).get(),
            db.collection("incidencias").where("id_alumno", "==", matricula).get()
        ]);

        document.getElementById('expNombre').innerText = `${al.nombre} ${al.apepat} ${al.apemat || ''}`.toUpperCase();
        document.getElementById('expMatricula').innerText = al.matricula;
        document.getElementById('expEsp').innerText = al.especialidad;
        document.getElementById('expCurp').innerText = al.curp || 'N/A';
        document.getElementById('expTutor').innerText = al.nombretutor || 'No registrado';
        document.getElementById('expTelTutor').innerText = al.teltutor || 'N/A';
        
        // Generación de QR
        if (al.qr_texto) {
            const qrDataUrl = await obtenerDataURLQR(al.qr_texto, 200);
            document.getElementById('expQR').src = qrDataUrl;
        } else {
            document.getElementById('expQR').src = ''; 
            document.getElementById('expQR').alt = 'QR No Generado';
        }
        document.getElementById('expMatriculaQR').innerText = matricula;
        
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
		
        document.getElementById('cntPases').innerText = pasesSnap.size;
        document.getElementById('cntJustificantes').innerText = justSnap.size;
        document.getElementById('cntIncidencias').innerText = incSnap.size;

        llenarLista(document.getElementById('listaHistorialPases'), pasesSnap, p => 
            `<div class="d-flex justify-content-between">
                <span><i class="bi bi-calendar-event me-2 text-guinda"></i><b>${p.fecha}</b></span>
                <span class="text-muted">${p.motivo || 'Salida'}</span>
            </div>`);
            
        llenarLista(document.getElementById('listaHistorialJust'), justSnap, j => 
            `<div class="d-flex justify-content-between">
                <span><i class="bi bi-file-medical text-warning me-2"></i><b>Folio: ${j.folio_justificante}</b></span>
                <small class="text-muted">${j.inasistencia_dia}</small>
             </div>
             <small class="text-muted d-block mt-1"><i class="bi bi-arrow-return-right me-1"></i>Motivo: ${j.motivo_detalle}</small>`);
            
        llenarLista(document.getElementById('listaHistorialInc'), incSnap, i => {
            const fecha = i.fecha_registro?.toDate() ? i.fecha_registro.toDate().toLocaleDateString() : 'S/F';
            return `<div class="d-flex justify-content-between">
                <span><i class="bi bi-exclamation-triangle me-2 text-danger"></i><b>${fecha}</b></span>
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

function llenarLista(contenedor, snapshot, formatoFn) {
    if (!contenedor) return;
    contenedor.innerHTML = snapshot.empty 
        ? '<li class="list-group-item text-muted small text-center py-3">Sin registros previos en esta categoría</li>' 
        : "";
        
    snapshot.forEach(doc => {
        const item = document.createElement('li');
        item.className = "list-group-item small shadow-sm mb-2 border-0 border-start border-3 border-guinda";
        item.innerHTML = formatoFn(doc.data());
        contenedor.appendChild(item);
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