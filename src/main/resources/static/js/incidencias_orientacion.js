// static/js/incidencias_orientacion.js

let alumnoSeleccionado = null;
let incidenciasCache = [];
let limiteIncidencias = 10;

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

const PUNTOS_OFICIALES = [
    "NO PORTA EL UNIFORME CORRECTAMENTE",
    "NO CUMPLE CON LOS TRABAJOS ESCOLARES",
    "UTILIZAR LENGUAJE SOEZ",
    "PROVOCAR DESORDEN EN LOS PASILLOS O AULAS",
    "FALTA DE RESPETO A SUS COMPAÑEROS",
    "FALTA DE RESPETO A PERSONAL DOCENTE, ADMINISTRATIVO SERVICIOS",
    "NO PORTA CREDENCIAL",
    "CABELLO LARGO, TATUAJES, PERFORACIONES, UÑAS",
    "DAÑOS A LA INFRAESTRUCTURA DEL PLANTEL",
    "FUMAR DENTRO DE LAS INSTALACIONES (VAPEADOR)",
    "BAJO EFECTOS DE ALCOHOL O SUSTANCIAS",
    "FALTA DE RESPETO A LOS SÍMBOLOS PATRIOS",
    "FALTAS A LA MORAL Y BUENAS COSTUMBRES",
    "UTILIZAR DISPOSITIVO ELECTRÓNICO EN CLASES",
    "AUSENTISMO EN CLASES",
    "PORTAR OBJETOS NO PERMITIDOS",
    "OTRO (ESPECIFIQUE)"
];

const POSICIONES_Y = [24.1, 26.1, 28, 30.2, 32.6, 34.2, 37.6, 40.2, 45, 47, 50.6, 54.2, 56.3, 58, 60.6, 62.2, 64.5];
const POS_X_OVALO = 85;

document.addEventListener('DOMContentLoaded', () => {
    renderizarChecklist();
    configurarBuscadorAlumnos();
    escucharIncidenciasGlobales();
    
    document.getElementById('inputOtro').addEventListener('input', (e) => {
        document.getElementById('pdfTextoOtro').innerText = e.target.value.toUpperCase();
    });
	
	const inputBuscador = document.getElementById('buscarIncidenciaGlobal');
	    if (inputBuscador) {
	        inputBuscador.addEventListener('input', () => {
	            limiteIncidencias = 10; 
	            renderizarTablaIncidencias();
	        });
	    }
		
		const anioDoc = document.getElementById('pdfAnio');
		    if (anioDoc) {
		        anioDoc.innerText = new Date().getFullYear();
		    }
});

function renderizarChecklist() {
    const container = document.getElementById('checklistIncidencias');
    container.innerHTML = PUNTOS_OFICIALES.map((p, i) => `
        <div class="form-check mb-2">
            <input class="form-check-input check-falta" type="checkbox" data-index="${i}" value="${p}" id="inc-${i}" onchange="actualizarMarcasX()">
            <label class="form-check-label small fw-bold" for="inc-${i}">${p}</label>
        </div>`).join('');
}

function actualizarMarcasX() {
    const capa = document.getElementById('capaMarcasX');
    capa.innerHTML = "";
    document.querySelectorAll('.check-falta:checked').forEach(cb => {
        const idx = parseInt(cb.dataset.index);
        capa.innerHTML += `<span class="marca-x" style="top: ${POSICIONES_Y[idx]}%; left: ${POS_X_OVALO}%;">X</span>`;
    });
}

function configurarBuscadorAlumnos() {
    const input = document.getElementById('busquedaAlInc');
    const sugerencias = document.getElementById('sugerenciasInc');

    input.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 3) { sugerencias.style.display = 'none'; return; }

        const snap = await db.collection("alumnos")
                            .where("estatus_escolar", "==", "Activo").get();
        
        const filtrados = snap.docs.map(doc => doc.data())
            .filter(al => 
                al.matricula.includes(query) || 
                `${al.nombre} ${al.apepat} ${al.apemat}`.toLowerCase().includes(query)
            ).slice(0, 5);

        if (filtrados.length > 0) {
            sugerencias.innerHTML = filtrados.map(al => `
                <button type="button" class="list-group-item list-group-item-action py-2" 
                        onclick="seleccionarParaIncidencia('${al.matricula}')">
                    <div class="fw-bold small">${al.nombre} ${al.apepat}</div>
                    <small class="text-muted">${al.matricula} | ${al.especialidad}</small>
                </button>
            `).join('');
            sugerencias.style.display = 'block';
        } else {
            sugerencias.style.display = 'none';
        }
    });
}

async function seleccionarParaIncidencia(matricula) {
    const doc = await db.collection("alumnos").doc(matricula).get();
    if (doc.exists) {
        const data = doc.data();
        
        if (data.estatus_escolar !== "Activo") {
            return Swal.fire("Alumno Inactivo", "No se pueden registrar incidencias a alumnos en BAJA.", "error");
        }

        alumnoSeleccionado = data;
        
        // Llenado de datos del alumno
        document.getElementById('pdfNombreAl').innerText = `${data.nombre} ${data.apepat} ${data.apemat || ''}`.toUpperCase();
        document.getElementById('pdfSemestre').innerText = data.grado;
        document.getElementById('pdfGrupo').innerText = data.grupo;
        document.getElementById('pdfEsp').innerText = data.especialidad.toUpperCase();
        
        // Llenado de fecha dinámica
        const hoy = new Date();
        document.getElementById('pdfDia').innerText = hoy.getDate().toString().padStart(2, '0');
        document.getElementById('pdfMes').innerText = hoy.toLocaleString('es-MX', { month: 'long' }).toUpperCase();
        
        const anioDoc = document.getElementById('pdfAnio');
        if (anioDoc) {
            anioDoc.innerText = hoy.getFullYear();
        }
		
        // UI Feedback
        document.getElementById('sugerenciasInc').style.display = 'none';
        document.getElementById('busquedaAlInc').value = matricula;
    }
}

async function guardarIncidencia() {
    if (!alumnoSeleccionado) return Swal.fire("Error", "Seleccione un alumno primero", "warning");

    const faltas = Array.from(document.querySelectorAll('.check-falta:checked')).map(cb => cb.value);
    if (faltas.length === 0) return Swal.fire("Atención", "Marque al menos una falta del reglamento", "info");

	try {
        Swal.fire({ title: 'Guardando reporte...', didOpen: () => Swal.showLoading() });

        let configDoc = await db.collection("configuracion").doc("ciclo_escolar").get();
        let cicloActivo = "";

        if (!configDoc.exists) {
            const fechaAuto = new Date();
            const anioAuto = fechaAuto.getFullYear();
            const mesAuto = fechaAuto.getMonth();
            cicloActivo = (mesAuto >= 7 || mesAuto === 11) ? `AGO-DIC ${anioAuto}` : `FEB-JUL ${anioAuto}`;
            
            await db.collection("configuracion").doc("ciclo_escolar").set({
                actual: cicloActivo,
                ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp(),
                creado_automaticamente: true
            });
            console.log("Se detectó ausencia de ciclo. Creado automáticamente:", cicloActivo);
        } else {
            cicloActivo = configDoc.data().actual;
        }

        const hoy = new Date().toISOString().split('T')[0];
        const docId = `${alumnoSeleccionado.matricula}_${hoy}_${Date.now()}`;
        
        const datos = {
            folio_incidencia: docId, 
            id_alumno: alumnoSeleccionado.matricula, 
            grado: Number(alumnoSeleccionado.grado), 
            grupo: alumnoSeleccionado.grupo, 
            especialidad: alumnoSeleccionado.especialidad,
            ciclo: cicloActivo,
            faltas_checklist: faltas, 
            descripcion_detallada: document.getElementById('inputOtro').value.toUpperCase(), 
            fecha_registro: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 2. Guardamos en Firestore
        await db.collection("incidencias").doc(docId).set(datos);
        
		// --- 3. PREPARACIÓN Y GENERACIÓN DEL PDF ---
		        const element = document.getElementById('contenedorReporteReal');

		        // Guardamos el estado original
		        const scrollOriginalY = window.scrollY;
		        const originalTransform = element.style.transform;
		        const originalMargin = element.style.marginBottom;

		        // Limpieza: Quitamos escala y subimos scroll
		        window.scrollTo(0, 0);
		        element.style.transform = "none";
		        element.style.marginBottom = "0";
		        // ELIMINADO: Ya no forzamos el left aquí, el PDF usará el 5% de tu HTML

		        const opt = {
		            margin: 0,
		            filename: `Incidencia_${alumnoSeleccionado.matricula}.pdf`,
		            image: { type: 'jpeg', quality: 0.98 },
		            html2canvas: { scale: 3, useCORS: true, scrollY: 0 },
		            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
		        };

		        await html2pdf().set(opt).from(element).save();

		        // Restauramos para la vista del usuario
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
    // 1. Buscamos los datos
    const inc = incidenciasCache.find(i => i.folio_incidencia === folio);
    
    if (!inc) {
        return Swal.fire("Error", "No se encontró la información de la incidencia.", "error");
    }

    Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });

    try {
        // 2. Rellenamos temporalmente los textos
        document.getElementById('pdfNombreAl').innerText = inc.nombreFull.toUpperCase();
        document.getElementById('pdfSemestre').innerText = inc.grado;
        document.getElementById('pdfGrupo').innerText = inc.grupo;
        document.getElementById('pdfEsp').innerText = inc.especialidad.toUpperCase();
        document.getElementById('pdfTextoOtro').innerText = inc.descripcion_detallada || "";

        const fecha = inc.fecha_registro?.toDate() || new Date();
        document.getElementById('pdfDia').innerText = fecha.getDate().toString().padStart(2, '0');
        document.getElementById('pdfMes').innerText = fecha.toLocaleString('es-MX', { month: 'long' }).toUpperCase();
        
        const anioDoc = document.getElementById('pdfAnio');
        if (anioDoc) anioDoc.innerText = fecha.getFullYear();

        const capa = document.getElementById('capaMarcasX');
        capa.innerHTML = "";
        inc.faltas_checklist.forEach(falta => {
            const idx = PUNTOS_OFICIALES.indexOf(falta);
            if (idx !== -1) {
                capa.innerHTML += `<span class="marca-x" style="top: ${POSICIONES_Y[idx]}%; left: ${POS_X_OVALO}%;">X</span>`;
            }
        });

		// --- 3. PREPARACIÓN Y GENERACIÓN DEL PDF ---
		        const element = document.getElementById('contenedorReporteReal');

		        // Guardamos el estado original
		        const scrollOriginalY = window.scrollY;
		        const originalTransform = element.style.transform;
		        const originalMargin = element.style.marginBottom;
		        
		        // Forzamos la vista real
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

		        // Generamos el documento
		        await html2pdf().set(opt).from(element).save();

		        // Restauramos el diseño
		        element.style.transform = originalTransform;
		        element.style.marginBottom = originalMargin;
		        window.scrollTo(0, scrollOriginalY);

        // 6. Restauramos las marcas visuales del alumno que se estaba capturando
        if (alumnoSeleccionado) {
            document.getElementById('pdfNombreAl').innerText = `${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apepat}`.toUpperCase();
            document.getElementById('pdfSemestre').innerText = alumnoSeleccionado.grado;
            document.getElementById('pdfGrupo').innerText = alumnoSeleccionado.grupo;
            document.getElementById('pdfEsp').innerText = alumnoSeleccionado.especialidad.toUpperCase();
            document.getElementById('pdfTextoOtro').innerText = document.getElementById('inputOtro').value.toUpperCase();
            actualizarMarcasX(); 
        } else {
            capa.innerHTML = "";
            document.getElementById('pdfNombreAl').innerText = "________________________________________";
            document.getElementById('pdfSemestre').innerText = "__";
            document.getElementById('pdfGrupo').innerText = "__";
            document.getElementById('pdfEsp').innerText = "_______________________";
            document.getElementById('pdfTextoOtro').innerText = "";
        }

        Swal.close();

    } catch (error) {
        console.error("Error al reimprimir:", error);
        Swal.fire("Error", "No se pudo generar el PDF: " + error.message, "error");
    }
}

function escucharIncidenciasGlobales() {
    db.collection("incidencias").orderBy("fecha_registro", "desc").onSnapshot(async snap => {
        const promesas = snap.docs.map(async d => {
            const inc = d.data();
            const alSnap = await db.collection("alumnos").doc(inc.id_alumno).get();
            const nombre = alSnap.exists ? `${alSnap.data().nombre} ${alSnap.data().apepat}` : "Desconocido";
            return { ...inc, nombreFull: nombre };
        });

        incidenciasCache = await Promise.all(promesas);
        renderizarTablaIncidencias();
    });
}

function renderizarTablaIncidencias() {
    const tbody = document.getElementById('tablaIncidenciasGlobal');
    if (!tbody) return;
    tbody.innerHTML = "";

    // Obtenemos y normalizamos la búsqueda del usuario
    const inputBusqueda = document.getElementById('buscarIncidenciaGlobal');
    const filtro = normalizar(inputBusqueda ? inputBusqueda.value : "");

    // Filtramos la caché global aplicando normalizar a cada campo
    const filtrados = incidenciasCache.filter(inc => {
        const folio = normalizar(inc.folio_incidencia);
        const nombre = normalizar(inc.nombreFull);
        const matricula = normalizar(inc.id_alumno);

        return folio.includes(filtro) || nombre.includes(filtro) || matricula.includes(filtro);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron incidencias.</td></tr>`;
        return;
    }

    const paginados = filtrados.slice(0, limiteIncidencias);

    paginados.forEach(inc => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${inc.folio_incidencia.substring(0,15)}...</td>
                <td>
                    <div class="fw-bold small">${inc.nombreFull}</div>
                    <small class="text-muted">${inc.id_alumno}</small>
                </td>
                <td>${inc.fecha_registro?.toDate().toLocaleDateString() || 'Pendiente'}</td>
                <td>
                    <small class="text-truncate d-inline-block" style="max-width: 200px;">
                        ${inc.faltas_checklist.join(', ')}
                    </small>
                </td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirIncidencia('${inc.folio_incidencia}')">
                            <i class="bi bi-file-pdf-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarIncidencia('${inc.folio_incidencia}')">
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
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            await db.collection("incidencias").doc(id).delete();
            Swal.fire("Eliminado", "El registro ha sido borrado.", "success");
            // No hace falta recargar, el onSnapshot de escucharIncidenciasGlobales lo hará solo
        } catch (e) {
            Swal.fire("Error", "No se pudo eliminar: " + e.message, "error");
        }
    }
}