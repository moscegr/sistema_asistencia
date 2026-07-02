// static/js/justificantes.js 

let alumnoJust = null;
let limiteJustificantes = 10;
let justificantesCache = [];
const obtenerHoyLocal = () => new Date().toLocaleDateString('en-CA');

document.addEventListener('DOMContentLoaded', () => {
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    const spanFecha = document.getElementById('valFechaEmi');
    if (spanFecha) {
        spanFecha.innerText = new Date().toLocaleDateString('es-MX', opciones);
    }
    
	inicializarDatosJustificantes();
    configurarBusquedaJust();
    escucharJustificantesGlobales();
    
    document.getElementById('buscarFolioJust').addEventListener('input', filtrarJustificantes);
    document.getElementById('buscarNombreJust').addEventListener('input', filtrarJustificantes);
	
	    document.getElementById('fechaFalta').addEventListener('input', (e) => {
	        const fechaFormateada = formatearFechaFalta(e.target.value);
	        document.getElementById('valFechaFalta').innerText = fechaFormateada.toUpperCase();
	    });

	    document.getElementById('motivoJust').addEventListener('input', (e) => {
	        document.getElementById('valMotivo').innerText = e.target.value.toUpperCase();
	    });
});

async function inicializarDatosJustificantes() {
    try {
        const configDoc = await db.collection("configuracion").doc("sistema").get();
        if (configDoc.exists) {
            const data = configDoc.data();
            const responsable = data.responsable_orientacion || "MATILDE ABIGAIL GARCIA NAJERA";
            
            // Actualizamos la firma en el diseño del justificante
            const firmaJust = document.getElementById('nombreResponsableJust');
            if (firmaJust) firmaJust.innerText = responsable.toUpperCase();
        }
    } catch (e) {
        console.error("Error al cargar datos institucionales:", e);
    }
}

function formatearFechaFalta(fechaStr) {
    if(!fechaStr) return "";
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const partes = fechaStr.split('-');
    return `${partes[2]} DE ${meses[parseInt(partes[1]) - 1]}`;
}

// Búsqueda Inteligente
function configurarBusquedaJust() {
    const input = document.getElementById('buscarAlumnoJust');
    const sugerencias = document.getElementById('sugerenciasJust');

    input.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 3) { sugerencias.style.display = 'none'; return; }

        // VALIDACION: Solo alumnos que no estén en Baja
        const snap = await db.collection("alumnos")
                            .where("estatus_escolar", "==", "Activo").get();
        
        const filtrados = snap.docs.map(doc => doc.data())
            .filter(al => al.matricula.includes(query) || `${al.nombre} ${al.apepat}`.toLowerCase().includes(query))
            .slice(0, 5);

        if (filtrados.length > 0) {
            sugerencias.innerHTML = filtrados.map(al => `
                <button type="button" class="list-group-item list-group-item-action py-2" onclick="seleccionarParaJust('${al.matricula}')">
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

async function seleccionarParaJust(matricula) {
    try {
        const doc = await db.collection("alumnos").doc(matricula).get();
        if (!doc.exists) return;
        const data = doc.data();

        if (data.estatus_escolar !== "Activo") {
            return Swal.fire("Alumno Inactivo", "No se pueden emitir justificantes a alumnos en BAJA.", "error");
        }

        alumnoJust = data;
        
        document.getElementById('valNombre').innerText = `${data.nombre} ${data.apepat} ${data.apemat}`.toUpperCase();
        document.getElementById('valGrado').innerText = data.grado;
        document.getElementById('valGpo').innerText = data.grupo;
        document.getElementById('valEsp').innerText = data.especialidad.toUpperCase();
        
        inicializarDatosJustificantes();

        const snapJust = await db.collection("justificantes").get();
        const nuevoFolio = (snapJust.size + 1).toString().padStart(4, '0');

        document.getElementById('prevFolio').innerText = "FOLIO: " + nuevoFolio;
        document.getElementById('sugerenciasJust').style.display = 'none';
        document.getElementById('buscarAlumnoJust').value = `${data.nombre} ${data.apepat}`;

    } catch (e) { console.error(e); }
}

async function guardarJustificante() {
    const fechaFaltaRaw = document.getElementById('fechaFalta').value;
    const motivo = document.getElementById('motivoJust').value.trim().toUpperCase();

    if (!alumnoJust || !fechaFaltaRaw || !motivo) {
        return Swal.fire("Datos Incompletos", "Por favor llene todos los datos antes de imprimir.", "warning");
    }

    const folioStr = document.getElementById('prevFolio').innerText;
    const folioLimpio = folioStr.replace("FOLIO: ", "");

    const datos = {
        folio_justificante: folioLimpio,
        id_alumno: alumnoJust.matricula,
        grado: Number(alumnoJust.grado),
        grupo: alumnoJust.grupo,
        especialidad: alumnoJust.especialidad,
        fecha_expedicion: obtenerHoyLocal(),
        inasistencia_dia: fechaFaltaRaw,
        motivo_detalle: motivo,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
        await db.collection("justificantes").doc(datos.folio_justificante).set(datos);

        const original = document.getElementById('disenoJustificante');

        const tempContainer = document.createElement('div');
        tempContainer.style.width = "216mm";
        tempContainer.style.height = "279mm";
        tempContainer.style.display = "flex";
        tempContainer.style.flexDirection = "column";

        const copiaSuperior = original.cloneNode(true);
        const copiaInferior = original.cloneNode(true);

        copiaSuperior.style.margin = "0";
        copiaInferior.style.margin = "0";

        tempContainer.appendChild(copiaSuperior);
        tempContainer.appendChild(copiaInferior);

        const opciones = {
            margin: 0,
            filename: `Justificante_${datos.folio_justificante}.pdf`,
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollY: 0
            },
            jsPDF: {
                unit: 'mm',
                format: [216, 279],
                orientation: 'portrait'
            }
        };

        await html2pdf().set(opciones).from(tempContainer).save();

        Swal.fire("Éxito", "Justificante generado.", "success")
            .then(() => location.reload());

    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

function escucharJustificantesGlobales() {
    db.collection("justificantes").orderBy("folio_justificante", "desc").onSnapshot(async snap => {

        const promesas = snap.docs.map(async docD => {
            const j = docD.data();
            const alDoc = await db.collection("alumnos").doc(j.id_alumno).get();
            const nombre = alDoc.exists ? `${alDoc.data().nombre} ${alDoc.data().apepat}` : "N/A";
            return { ...j, nombreFull: nombre };
        });

        justificantesCache = await Promise.all(promesas);
        renderizarTablaJustificantes();
    });
}

function renderizarTablaJustificantes() {
    const tbody = document.getElementById('tablaJustGlobal');
    if (!tbody) return;
    tbody.innerHTML = "";

    const fFolio = document.getElementById('buscarFolioJust').value.toLowerCase();
    const fNombre = document.getElementById('buscarNombreJust').value.toLowerCase();

    const filtrados = justificantesCache.filter(j => 
        j.folio_justificante.toLowerCase().includes(fFolio) && 
        (j.nombreFull.toLowerCase().includes(fNombre) || j.id_alumno.includes(fNombre))
    );

    const paginados = filtrados.slice(0, limiteJustificantes);

    paginados.forEach(j => {
		tbody.innerHTML += `
		    <tr>
		        <td class="fw-bold text-guinda">${j.folio_justificante}</td>
		        <td>
		            <div class="fw-bold small">${j.nombreFull}</div>
		            <small class="text-muted">${j.id_alumno}</small>
		        </td>
		        <td>${j.inasistencia_dia}</td>
		        <td><small class="text-truncate d-inline-block" style="max-width: 150px;">${j.motivo_detalle}</small></td>
		        <td class="text-center">
		            <div class="btn-group">
		                <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirJust('${j.folio_justificante}')" title="Reimprimir">
		                    <i class="bi bi-file-pdf-fill fs-5"></i>
		                </button>
		                <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarJustificante('${j.folio_justificante}')" title="Eliminar Justificante">
		                    <i class="bi bi-trash3-fill fs-5"></i>
		                </button>
		            </div>
		        </td>
		    </tr>`;
    });

    if (filtrados.length > limiteJustificantes) {
        tbody.innerHTML += `
            <tr><td colspan="5" class="text-center py-2">
                <button class="btn btn-link text-guinda btn-sm fw-bold" onclick="limiteJustificantes += 10; renderizarTablaJustificantes();">
                    Mostrar más justificantes...
                </button>
            </td></tr>`;
    }
}

async function confirmarEliminarJustificante(folio) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Borrar Justificante?',
        text: `El folio ${folio} será eliminado permanentemente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Eliminar justificante'
    });

    if (isConfirmed) {
        try {
            await db.collection("justificantes").doc(folio).delete();
            Swal.fire("Éxito", "Justificante eliminado correctamente.", "success");
        } catch (e) {
            Swal.fire("Error", "Error al borrar: " + e.message, "error");
        }
    }
}

function filtrarJustificantes() {
    const fFolio = document.getElementById('buscarFolioJust').value.toLowerCase();
    const fNombre = document.getElementById('buscarNombreJust').value.toLowerCase();
    const tbody = document.getElementById('tablaJustGlobal');
    
    if(!tbody) return;
    tbody.innerHTML = "";

    const filtrados = justificantesCache.filter(j => 
        j.folio_justificante.toLowerCase().includes(fFolio) && 
        (j.nombreFull.toLowerCase().includes(fNombre) || j.id_alumno.includes(fNombre))
    );

    const paginados = filtrados.slice(0, limiteJustificantes);

    paginados.forEach(j => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${j.folio_justificante}</td>
                <td>
                    <div class="fw-bold small">${j.nombreFull}</div>
                    <small class="text-muted">${j.id_alumno}</small>
                </td>
                <td><small>${j.inasistencia_dia}</small></td>
                <td><small class="text-truncate d-inline-block" style="max-width: 150px;">${j.motivo_detalle}</small></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirJust('${j.folio_justificante}')" title="Reimprimir PDF">
                        <i class="bi bi-file-pdf-fill fs-5"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    if (filtrados.length > limiteJustificantes) {
        tbody.innerHTML += `
            <tr>
                <td colspan="5" class="text-center py-2">
                    <button class="btn btn-link text-guinda btn-sm fw-bold" onclick="limiteJustificantes += 10; filtrarJustificantes();">
                        Mostrar más registros (+10)
                    </button>
                </td>
            </tr>`;
    }
}

async function reimprimirJust(folio) {
    const j = justificantesCache.find(item => item.folio_justificante === folio);
    
    if (!j) return Swal.fire("Error", "No se encontraron los datos en el sistema.", "error");

    document.getElementById('valNombre').innerText = j.nombreFull.toUpperCase();
    document.getElementById('valGrado').innerText = j.grado;
    document.getElementById('valGpo').innerText = j.grupo;
    document.getElementById('valEsp').innerText = j.especialidad.toUpperCase();
    document.getElementById('prevFolio').innerText = "FOLIO: " + j.folio_justificante;

    const fechaFaltaStr = typeof formatearFechaFalta === 'function' ? 
        formatearFechaFalta(j.inasistencia_dia).toUpperCase() : 
        j.inasistencia_dia;

    document.getElementById('valFechaFalta').innerText = fechaFaltaStr;
    document.getElementById('valMotivo').innerText = j.motivo_detalle.toUpperCase();

    const original = document.getElementById('disenoJustificante');
    if (!original) return Swal.fire("Error", "No se encontró el diseño base del justificante.", "error");

    const tempContainer = document.createElement('div');
    tempContainer.style.width = "216mm";
    tempContainer.style.height = "279mm";
    tempContainer.style.display = "flex";
    tempContainer.style.flexDirection = "column";

    const copiaSuperior = original.cloneNode(true);
    const copiaInferior = original.cloneNode(true);

    copiaSuperior.style.margin = "0";
    copiaInferior.style.margin = "0";

    tempContainer.appendChild(copiaSuperior);
    tempContainer.appendChild(copiaInferior);

    try {
        Swal.fire({ 
            title: 'Generando PDF...', 
            text: 'Preparando justificante doble para impresión',
            didOpen: () => Swal.showLoading() 
        });

        const opciones = {
            margin: 0,
            filename: `Reimpresion_Justificante_${folio}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                scrollY: 0
            },
            jsPDF: { 
                unit: 'mm', 
                format: [216, 279], 
                orientation: 'portrait' 
            }
        };

        await html2pdf().set(opciones).from(tempContainer).save();
        Swal.close();

    } catch (e) {
        console.error("Error html2pdf:", e);
        Swal.fire("Error", "No se pudo generar el archivo: " + e.message, "error");
    }
}