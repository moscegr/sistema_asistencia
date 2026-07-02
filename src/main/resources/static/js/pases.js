let alumnoPase = null;
let pasesGlobales = [];
let limitePases = 10; 
let especialidadesConfig = []; 

const obtenerFechaLocal = () => new Date().toLocaleDateString('en-CA');

const obtenerFechaFormateada = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Configuración de Carreras (Colores y Nombres)
    await cargarConfiguracionPases();
    
    // 2. Inicializar Slide Individual
    inicializarPaseIndividual();
    configurarBusquedaInteligente();
    
    // 3. Inicializar Slide Grupal e Historial
    escucharCambiosGrupos();
    escucharPasesGlobales(); 

    const fFolio = document.getElementById('buscarFolioGlobal');
    const fNombre = document.getElementById('buscarNombreGlobal');
    if(fFolio) fFolio.addEventListener('input', filtrarTablaGlobal);
    if(fNombre) fNombre.addEventListener('input', filtrarTablaGlobal);
});

// --- SECCIÓN 1: CONFIGURACIÓN DINÁMICA ---

async function cargarConfiguracionPases() {
    try {
        const doc = await db.collection("configuracion").doc("escolar").get();
        if (doc.exists && doc.data().especialidades) {
            especialidadesConfig = doc.data().especialidades;
            await cargarTableroGrupal(); 
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

// --- SECCIÓN 2: SLIDE GRUPAL (TABLERO DE ORIENTACIÓN) ---
async function cargarTableroGrupal() {

    const snapAlumnos = await db.collection("alumnos").where("estatus_escolar", "==", "Activo").get();
    const estructura = {};

    const rol = rolUsuarioActual ? rolUsuarioActual.toUpperCase() : "";
    const esAdminUOrientacion = (rol === "ADMIN" || rol === "ORIENTACION" || rol === "PREFECTO");

    snapAlumnos.forEach(doc => {
        const al = doc.data();
        if (!al.especialidad) return;
        if (!estructura[al.especialidad]) estructura[al.especialidad] = new Set();
        estructura[al.especialidad].add(`${al.grado}${al.grupo}`);
    });

    const tablero = document.getElementById('tableroOrientacion');
    if (!tablero) return;
    tablero.innerHTML = "";

    especialidadesConfig.forEach(esp => {
        if (!estructura[esp.nombre]) return;
        
        const grupos = Array.from(estructura[esp.nombre]).sort();
        
        tablero.innerHTML += `
            <div class="col-md-4 mb-3">
                <div class="card h-100 border-0 bg-light shadow-sm" style="border-left: 5px solid ${esp.color} !important;">
                    <div class="card-body">
                        <h6 class="fw-bold mb-3" style="color: ${esp.color}">${esp.nombre}</h6>
                        <div class="d-flex flex-wrap gap-2">
                            ${grupos.map(g => `
                                <input type="checkbox" class="btn-check" 
                                       id="chk-${g}-${esp.nombre.replace(/ /g,'_')}" 
                                       ${!esAdminUOrientacion ? 'disabled' : ''} 
                                       onchange="alternarPaseGrupal('${g[0]}','${g[1]}','${esp.nombre}', this.checked)">
                                <label class="btn btn-sm btn-outline-dark px-3 rounded-pill" 
                                       for="chk-${g}-${esp.nombre.replace(/ /g,'_')}"
                                       style="${!esAdminUOrientacion ? 'cursor: not-allowed; opacity: 0.6;' : ''}">
                                    ${g}
                                </label>
                            `).join('')}
                        </div>
                        ${!esAdminUOrientacion ? '<div class="mt-2 text-muted" style="font-size: 0.7rem;"><i class="bi bi-info-circle"></i> Vista de solo lectura</div>' : ''}
                    </div>
                </div>
            </div>`;
    });
}

function escucharCambiosGrupos() {
    const hoy = obtenerFechaLocal();
    db.collection("pases_salida").where("fecha", "==", hoy).where("es_grupal", "==", true)
        .onSnapshot(snap => {
            snap.forEach(doc => {
                const p = doc.data();
                const id = `chk-${p.grado}${p.grupo}-${p.especialidad.replace(/ /g,'_')}`;
                const el = document.getElementById(id);
                if (el) el.checked = p.estatus_vigencia;
            });
        });
}

async function alternarPaseGrupal(grado, grupo, especialidad, estado) {
	const rol = rolUsuarioActual ? rolUsuarioActual.toUpperCase() : "";
	if (rol !== "ADMIN" && rol !== "ORIENTACION" && rol !== "PREFECTO") {
	        Swal.fire("Acceso Restringido", "Solo Orientación Educativa o Prefectura pueden autorizar salidas grupales.", "error");
	        return; 
	    }
		
		const hoy = obtenerFechaLocal();
		const folio = `GRP-${grado}${grupo}-${especialidad.substring(0,3)}-${hoy}`;

	try{
    if (estado) {
        await db.collection("pases_salida").doc(folio).set({
            folio_pase: folio,
            es_grupal: true,
            grado: Number(grado),
            grupo: grupo,
            especialidad: especialidad,
            fecha: hoy,
            estatus_vigencia: true,
            hora_salida: new Date().toLocaleTimeString(),
			autorizado_por: rol
        });
    } else {
        await db.collection("pases_salida").doc(folio).delete();
		}
	} catch (e) {
		console.error("Error al alternar pase grupal:", e);
	    Swal.fire("Error", "No se pudo actualizar el estatus del grupo.", "error");
	}
	
}

// --- SECCIÓN 3: SLIDE INDIVIDUAL (BÚSQUEDA Y PDF) ---
async function guardarPaseIndividual() {
	const rol = rolUsuarioActual ? rolUsuarioActual.toUpperCase() : "";
	    if (rol !== "ADMIN" && rol !== "ORIENTACION") {
	        return Swal.fire("Acceso Restringido", "Solo Orientación Educativa puede generar pases individuales.", "error");
	    }
    if (!alumnoPase) { return Swal.fire("Atención", "Primero debes buscar y seleccionar un alumno activo.", "warning"); }

    const mot = document.getElementById('motInd').value.trim();
    const hora = document.getElementById('horaInd').value;
    const folio = document.getElementById('prevFolio').innerText;

    if (!mot || !hora || folio === "----") { 
        return Swal.fire("Campos Incompletos", "El motivo y la hora son obligatorios.", "warning"); 
    }

    const datosPase = {
        folio_pase: folio,
        matricula: alumnoPase.matricula,
        es_grupal: false,
        grado: Number(alumnoPase.grado),
        grupo: alumnoPase.grupo,
        especialidad: alumnoPase.especialidad,
        hora_salida: hora,
        motivo: mot,
        estatus_vigencia: true,
        fecha: obtenerFechaLocal(),
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        Swal.fire({ title: 'Procesando...', text: 'Guardando en base de datos y generando PDF', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        await db.collection("pases_salida").doc(folio).set(datosPase);

        const elementoPDF = document.getElementById('contenedorPaseReal');

        const opciones = {
            margin: [80, 80, 80, 80], 
            filename: `Pase_${folio}_${alumnoPase.matricula}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'px', format: [954, 719], orientation: 'landscape' }
        };
        
        await html2pdf().set(opciones).from(elementoPDF).save();
        await Swal.fire({ icon: 'success', title: '¡Pase Autorizado!', confirmButtonColor: '#7b1b37' });
        limpiarFormularioPase();

    } catch (err) {
        console.error(err);
        Swal.fire("Error", err.message, "error");
    }
}

async function reimprimirPase(folio) {
    const p = pasesGlobales.find(item => item.folio_pase === folio);
    if (!p) return Swal.fire("Error", "Datos no encontrados", "error");

    document.getElementById('prevNombre').innerText = p.nombreFull.toUpperCase();
    document.getElementById('prevGrado').innerText = p.grado;
    document.getElementById('prevGpo').innerText = p.grupo;
    document.getElementById('prevEsp').innerText = p.especialidad;
    document.getElementById('prevHora').innerText = p.hora_salida;
    document.getElementById('prevMot').innerText = p.motivo.toUpperCase();
    document.getElementById('prevFolio').innerText = p.folio_pase;
    
    const partesFecha = p.fecha.split('-');
    document.getElementById('prevFecha').innerText = partesFecha.length === 3 ? `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}` : p.fecha;

    const elemento = document.getElementById('contenedorPaseReal');
    
    const opciones = {
        margin: [80, 80, 80, 80], 
        filename: `Reimpresion_${folio}_${p.matricula}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'px', format: [954, 719], orientation: 'landscape' }
    };

    try {
        Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });
        await html2pdf().set(opciones).from(elemento).save();
        Swal.fire("Éxito", "PDF generado", "success");
    } catch (e) { Swal.fire("Error", e.message, "error"); }
}

function limpiarFormularioPase() {
    // 1. Resetear el objeto del alumno
    alumnoPase = null;

    // 2. Limpiar los inputs del formulario
    const camposInput = ['busquedaGlobalAl', 'motInd', 'horaInd'];
    camposInput.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 3. Resetear las etiquetas de la previsualización (formato amarillo)
    const etiquetasPreview = {
        'prevNombre': '',
        'prevGrado': '',
        'prevGpo': '',
        'prevEsp': '',
        'prevHora': '',
        'prevMot': '',
        'prevFolio': '----' // Volver al estado inicial
    };

    for (const [id, valor] of Object.entries(etiquetasPreview)) {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    }

    // 4. Ocultar sugerencias si quedaron abiertas
    const sugerencias = document.getElementById('sugerenciasAl');
    if (sugerencias) sugerencias.style.display = 'none';

    console.log("Interfaz de pase individual reseteada correctamente.");
}

function configurarBusquedaInteligente() {
    const input = document.getElementById('busquedaGlobalAl');
    const sugerencias = document.getElementById('sugerenciasAl');
    if(!input) return;

    const quitarAcentos = (str) => {
        if (!str) return "";
        return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    input.addEventListener('input', async (e) => {
        const queryNormalizada = quitarAcentos(e.target.value);
        if (queryNormalizada.length < 3) { sugerencias.style.display = 'none'; return; }

        const snap = await db.collection("alumnos").where("estatus_escolar", "==", "Activo").get();
        const filtrados = snap.docs.map(doc => doc.data()).filter(al => {
            const nombreCompleto = quitarAcentos(`${al.nombre} ${al.apepat}`);
            const matricula = quitarAcentos(al.matricula);
            return matricula.includes(queryNormalizada) || nombreCompleto.includes(queryNormalizada);
        }).slice(0, 5);

        if (filtrados.length > 0) {
            sugerencias.innerHTML = filtrados.map(al => `
                <button type="button" class="list-group-item list-group-item-action py-2" onclick="seleccionarParaPase('${al.matricula}')">
                    <div class="fw-bold small">${al.nombre} ${al.apepat}</div>
                    <small class="text-muted">${al.matricula} | ${al.especialidad}</small>
                </button>
            `).join('');
            sugerencias.style.display = 'block';
        } else { sugerencias.style.display = 'none'; }
    });
}

async function seleccionarParaPase(matricula) {
    // Cerramos las sugerencias al instante
    document.getElementById('sugerenciasAl').style.display = 'none';

    const doc = await db.collection("alumnos").doc(matricula).get();
    if (doc.exists) {
        const data = doc.data();
        if (data.estatus_escolar !== "Activo") {
            return Swal.fire("Error", "El alumno está en estatus BAJA.", "error");
        }

        alumnoPase = data;
        document.getElementById('prevNombre').innerText = `${data.nombre} ${data.apepat} ${data.apemat || ''}`.toUpperCase();
        document.getElementById('prevGrado').innerText = data.grado;
        document.getElementById('prevGpo').innerText = data.grupo;
        document.getElementById('prevEsp').innerText = data.especialidad;
        
        document.getElementById('prevFecha').innerText = obtenerFechaFormateada();
        
        // --- Lógica del Folio inquebrantable ---
        const snapshot = await db.collection("pases_salida").where("es_grupal", "==", false).get();
        let maxFolio = 0;
        
        snapshot.forEach(docPase => {
            const num = parseInt(docPase.data().folio_pase, 10);
            if (!isNaN(num) && num > maxFolio) {
                maxFolio = num;
            }
        });

        const siguienteFolio = (maxFolio + 1).toString().padStart(4, '0');
        document.getElementById('prevFolio').innerText = siguienteFolio;

        document.getElementById('busquedaGlobalAl').value = matricula;
    }
}

// --- SECCIÓN 4: HISTORIAL Y REIMPRESIÓN (OPTIMIZADO) ---

function escucharPasesGlobales() {
    
    db.collection("pases_salida")
        .where("es_grupal", "==", false)
        .orderBy("folio_pase", "desc")
        .onSnapshot(async snap => {
            const promesas = snap.docs.map(async docP => {
                const p = docP.data();
                const alSnap = await db.collection("alumnos").doc(p.matricula).get();
                const nombre = alSnap.exists ? `${alSnap.data().nombre} ${alSnap.data().apepat}` : "No encontrado";
                return { ...p, nombreFull: nombre };
            });
            pasesGlobales = await Promise.all(promesas);
            filtrarTablaGlobal();
        });
}

function filtrarTablaGlobal() {
    const fFolio = document.getElementById('buscarFolioGlobal').value.toLowerCase();
    const fNombre = document.getElementById('buscarNombreGlobal').value.toLowerCase();
    const tbody = document.getElementById('tablaPasesGlobal');
    const hoy = obtenerFechaLocal();
    if(!tbody) return;
    
    tbody.innerHTML = "";
    let filtrados = pasesGlobales.filter(p => 
        p.folio_pase.toLowerCase().includes(fFolio) && 
        (p.nombreFull.toLowerCase().includes(fNombre) || p.matricula.includes(fNombre))
    );

    const paginados = filtrados.slice(0, limitePases);

    paginados.forEach(p => {
        let bClase = 'bg-secondary', bTexto = 'Usado';
        if (p.estatus_vigencia) {
            bClase = (p.fecha === hoy) ? 'bg-success' : 'bg-warning text-dark';
            bTexto = (p.fecha === hoy) ? 'Vigente' : 'Expirado';
        }

		tbody.innerHTML += `
		    <tr>
		        <td class="fw-bold text-guinda">${p.folio_pase}</td>
		        <td>
		            <div class="fw-bold small">${p.nombreFull}</div>
		            <small class="text-muted">${p.matricula}</small>
		        </td>
		        <td><small>${p.fecha}</small></td>
		        <td><small class="text-truncate d-inline-block" style="max-width: 150px;">${p.motivo || 'N/A'}</small></td>
		        <td><span class="badge ${bClase}">${bTexto}</span></td>
		        <td class="text-center">
		            <div class="btn-group">
		                <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirPase('${p.folio_pase}')" title="Reimprimir">
		                    <i class="bi bi-file-pdf-fill fs-5"></i>
		                </button>
		                <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarPase('${p.folio_pase}')" title="Eliminar Pase">
		                    <i class="bi bi-trash3-fill fs-5"></i>
		                </button>
		            </div>
		        </td>
		    </tr>`;
    });

    if (filtrados.length > limitePases) {
        tbody.innerHTML += `
            <tr>
                <td colspan="6" class="text-center py-2">
                    <button class="btn btn-link text-guinda btn-sm fw-bold" onclick="limitePases += 10; filtrarTablaGlobal();">
                        Ver más registros...
                    </button>
                </td>
            </tr>`;
    }
}

async function confirmarEliminarPase(folio) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar Pase de Salida?',
        text: `Se borrará el folio ${folio}. Esto afectará el historial de salidas del alumno.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, borrar registro'
    });

    if (isConfirmed) {
        try {
            await db.collection("pases_salida").doc(folio).delete();
            Swal.fire("Eliminado", "El pase ha sido depurado de la base de datos.", "success");
        } catch (e) {
            Swal.fire("Error", "No se pudo eliminar el pase: " + e.message, "error");
        }
    }
}

function inicializarPaseIndividual() {
    ['motInd', 'horaInd'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => {
            const map = { 'motInd': 'prevMot', 'horaInd': 'prevHora' };
            document.getElementById(map[id]).innerText = e.target.value.toUpperCase();
        });
    });
}