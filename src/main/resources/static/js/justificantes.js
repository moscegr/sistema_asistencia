// static/js/justificantes.js (REST API Spring Boot Backend)

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
    
    if (document.getElementById('buscarFolioJust')) document.getElementById('buscarFolioJust').addEventListener('input', filtrarJustificantes);
    if (document.getElementById('buscarNombreJust')) document.getElementById('buscarNombreJust').addEventListener('input', filtrarJustificantes);
	
    if (document.getElementById('fechaFalta')) {
        document.getElementById('fechaFalta').addEventListener('input', (e) => {
            const fechaFormateada = formatearFechaFalta(e.target.value);
            document.getElementById('valFechaFalta').innerText = fechaFormateada.toUpperCase();
        });
    }

    if (document.getElementById('motivoJust')) {
        document.getElementById('motivoJust').addEventListener('input', (e) => {
            document.getElementById('valMotivo').innerText = e.target.value.toUpperCase();
        });
    }
});

async function inicializarDatosJustificantes() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            const responsable = data.responsable_orientacion || "MATILDE ABIGAIL GARCIA NAJERA";
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
    if (partes.length < 3) return fechaStr;
    return `${partes[2]} DE ${meses[parseInt(partes[1]) - 1]}`;
}

function configurarBusquedaJust() {
    const input = document.getElementById('buscarAlumnoJust');
    const sugerencias = document.getElementById('sugerenciasJust');
    if (!input || !sugerencias) return;

    const normalizar = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    input.addEventListener('input', async (e) => {
        const query = normalizar(e.target.value);
        if (query.length < 3) { sugerencias.style.display = 'none'; return; }

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
                return normalizar(mat).includes(query) || nom.includes(query);
            }).slice(0, 5);

            if (filtrados.length > 0) {
                sugerencias.innerHTML = filtrados.map(al => {
                    const mat = al.ncontrol || al.matricula;
                    const pat = al.apepat || al.primerApellido || '';
                    return `
                        <button type="button" class="list-group-item list-group-item-action py-2" onclick="seleccionarParaJust('${mat}')">
                            <div class="fw-bold small">${al.nombre} ${pat}</div>
                            <small class="text-muted">${mat} | ${al.especialidad || ''}</small>
                        </button>`;
                }).join('');
                sugerencias.style.display = 'block';
            } else {
                sugerencias.style.display = 'none';
            }
        } catch(e) {}
    });
}

async function seleccionarParaJust(matricula) {
    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matricula}`);
        if (!res.ok) return;
        const data = await res.json();

        const estatus = data.estatus_escolar || data.estatus || 'Activo';
        if (estatus !== "Activo") {
            return Swal.fire("Alumno Inactivo", "No se pueden emitir justificantes a alumnos en BAJA.", "error");
        }

        alumnoJust = data;
        const pat = data.apepat || data.primerApellido || '';
        const matApe = data.apemat || data.segundoApellido || '';
        const mat = data.ncontrol || data.matricula || '';

        document.getElementById('valNombre').innerText = `${data.nombre} ${pat} ${matApe}`.toUpperCase();
        document.getElementById('valGrado').innerText = data.grado || '';
        document.getElementById('valGpo').innerText = data.grupo || '';
        document.getElementById('valEsp').innerText = (data.especialidad || '').toUpperCase();
        
        inicializarDatosJustificantes();

        const resJust = await fetch('/api/justificantes');
        const listJust = resJust.ok ? await resJust.json() : [];
        const nuevoFolio = (listJust.length + 1).toString().padStart(4, '0');

        document.getElementById('prevFolio').innerText = "FOLIO: " + nuevoFolio;
        if (document.getElementById('sugerenciasJust')) document.getElementById('sugerenciasJust').style.display = 'none';
        document.getElementById('buscarAlumnoJust').value = `${data.nombre} ${pat}`;

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
    const mat = alumnoJust.ncontrol || alumnoJust.matricula;

    const datos = {
        folio_justificante: folioLimpio,
        id_alumno: mat,
        matricula: mat,
        grado: Number(alumnoJust.grado),
        grupo: alumnoJust.grupo,
        especialidad: alumnoJust.especialidad,
        fecha_expedicion: obtenerHoyLocal(),
        inasistencia_dia: fechaFaltaRaw,
        motivo_detalle: motivo
    };

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
        
        await fetch('/api/justificantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

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

        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opciones).from(tempContainer).save();
        }

        Swal.fire("Éxito", "Justificante generado.", "success")
            .then(() => location.reload());

    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

async function escucharJustificantesGlobales() {
    try {
        const [resJust, resAl] = await Promise.all([
            fetch('/api/justificantes').then(r => r.ok ? r.json() : []),
            fetch('/api/alumnos').then(r => r.ok ? r.json() : [])
        ]);

        const mapAlumnos = {};
        resAl.forEach(a => {
            const mat = a.ncontrol || a.matricula;
            const pat = a.apepat || a.primerApellido || '';
            if (mat) mapAlumnos[mat] = `${a.nombre} ${pat}`.trim();
        });

        justificantesCache = resJust.map(j => ({
            ...j,
            nombreFull: mapAlumnos[j.id_alumno || j.matricula] || j.nombre || "Estudiante"
        }));

        renderizarTablaJustificantes();
    } catch (e) { console.error(e); }
}

function renderizarTablaJustificantes() {
    const tbody = document.getElementById('tablaJustGlobal');
    if (!tbody) return;
    tbody.innerHTML = "";

    const fFolio = document.getElementById('buscarFolioJust')?.value.toLowerCase() || "";
    const fNombre = document.getElementById('buscarNombreJust')?.value.toLowerCase() || "";

    const filtrados = justificantesCache.filter(j => {
        const fol = (j.folio_justificante || "").toLowerCase();
        const mat = (j.id_alumno || j.matricula || "").toLowerCase();
        const nom = (j.nombreFull || "").toLowerCase();
        return fol.includes(fFolio) && (nom.includes(fNombre) || mat.includes(fNombre));
    });

    const paginados = filtrados.slice(0, limiteJustificantes);

    paginados.forEach(j => {
        const folio = j.folio_justificante || j.id || 'N/A';
        const mat = j.id_alumno || j.matricula || '';

		tbody.innerHTML += `
		    <tr>
		        <td class="fw-bold text-guinda">${folio}</td>
		        <td>
		            <div class="fw-bold small">${j.nombreFull}</div>
		            <small class="text-muted">${mat}</small>
		        </td>
		        <td>${j.inasistencia_dia || ''}</td>
		        <td><small class="text-truncate d-inline-block" style="max-width: 150px;">${j.motivo_detalle || ''}</small></td>
		        <td class="text-center">
		            <div class="btn-group">
		                <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirJust('${folio}')" title="Reimprimir">
		                    <i class="bi bi-file-pdf-fill fs-5"></i>
		                </button>
		                <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarJustificante('${j.id || folio}')" title="Eliminar Justificante">
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

async function confirmarEliminarJustificante(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Borrar Justificante?',
        text: `El registro de justificante será eliminado permanentemente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Eliminar justificante'
    });

    if (isConfirmed) {
        try {
            await fetch(`/api/justificantes/${id}`, { method: 'DELETE' });
            Swal.fire("Éxito", "Justificante eliminado correctamente.", "success");
            escucharJustificantesGlobales();
        } catch (e) {
            Swal.fire("Error", "Error al borrar: " + e.message, "error");
        }
    }
}

function filtrarJustificantes() {
    renderizarTablaJustificantes();
}

async function reimprimirJust(folio) {
    const j = justificantesCache.find(item => item.folio_justificante === folio || item.id === folio);
    
    if (!j) return Swal.fire("Error", "No se encontraron los datos en el sistema.", "error");

    document.getElementById('valNombre').innerText = (j.nombreFull || '').toUpperCase();
    document.getElementById('valGrado').innerText = j.grado || '';
    document.getElementById('valGpo').innerText = j.grupo || '';
    document.getElementById('valEsp').innerText = (j.especialidad || '').toUpperCase();
    document.getElementById('prevFolio').innerText = "FOLIO: " + (j.folio_justificante || j.id);

    const fechaFaltaStr = typeof formatearFechaFalta === 'function' ? 
        formatearFechaFalta(j.inasistencia_dia).toUpperCase() : 
        j.inasistencia_dia;

    document.getElementById('valFechaFalta').innerText = fechaFaltaStr;
    document.getElementById('valMotivo').innerText = (j.motivo_detalle || '').toUpperCase();

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

        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opciones).from(tempContainer).save();
        }
        Swal.close();

    } catch (e) {
        console.error("Error html2pdf:", e);
        Swal.fire("Error", "No se pudo generar el archivo: " + e.message, "error");
    }
}