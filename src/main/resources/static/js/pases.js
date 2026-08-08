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
    await cargarConfiguracionPases();
    
    inicializarPaseIndividual();
    configurarBusquedaInteligente();
    
    escucharCambiosGrupos();
    escucharPasesGlobales(); 

    const fFolio = document.getElementById('buscarFolioGlobal');
    const fNombre = document.getElementById('buscarNombreGlobal');
    if(fFolio) fFolio.addEventListener('input', filtrarTablaGlobal);
    if(fNombre) fNombre.addEventListener('input', filtrarTablaGlobal);
});

async function cargarConfiguracionPases() {
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            especialidadesConfig = data.especialidades || [];
            await cargarTableroGrupal(); 
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

async function cargarTableroGrupal() {
    try {
        const res = await fetch('/api/alumnos');
        if (!res.ok) return;
        const alumnos = await res.json();
        const estructura = {};

        const rol = (localStorage.getItem('userRole') || 'ADMIN').toUpperCase();
        const esAdminUOrientacion = (rol === "ADMIN" || rol === "ORIENTACION" || rol === "PREFECTO");

        alumnos.forEach(al => {
            const estatus = al.estatus_escolar || al.estatus || 'Activo';
            if (estatus === 'Activo' && al.especialidad) {
                if (!estructura[al.especialidad]) estructura[al.especialidad] = new Set();
                estructura[al.especialidad].add(`${al.grado}${al.grupo}`);
            }
        });

        const tablero = document.getElementById('tableroOrientacion');
        if (!tablero) return;
        tablero.innerHTML = "";

        especialidadesConfig.forEach(esp => {
            if (!estructura[esp.nombre]) return;
            
            const grupos = Array.from(estructura[esp.nombre]).sort();
            
            tablero.innerHTML += `
                <div class="col-md-4 mb-3">
                    <div class="card h-100 border-0 bg-light shadow-sm" style="border-left: 5px solid ${esp.color || '#7b1b37'} !important;">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3" style="color: ${esp.color || '#7b1b37'}">${esp.nombre}</h6>
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
    } catch(e) {
        console.error("Error en cargarTableroGrupal:", e);
    }
}

async function escucharCambiosGrupos() {
    const hoy = obtenerFechaLocal();
    try {
        const res = await fetch('/api/pases');
        if (res.ok) {
            const pases = await res.json();
            pases.forEach(p => {
                if (p.es_grupal && p.fecha === hoy && p.estatus_vigencia) {
                    const id = `chk-${p.grado}${p.grupo}-${p.especialidad.replace(/ /g,'_')}`;
                    const el = document.getElementById(id);
                    if (el) el.checked = true;
                }
            });
        }
    } catch(e){}
}

async function alternarPaseGrupal(grado, grupo, especialidad, estado) {
	const rol = (localStorage.getItem('userRole') || 'ADMIN').toUpperCase();
	if (rol !== "ADMIN" && rol !== "ORIENTACION" && rol !== "PREFECTO") {
	    Swal.fire("Acceso Restringido", "Solo Orientación Educativa o Prefectura pueden autorizar salidas grupales.", "error");
	    return; 
	}
		
	const hoy = obtenerFechaLocal();
	const folio = `GRP-${grado}${grupo}-${especialidad.substring(0,3)}-${hoy}`;
    const grupoEspecialidad = `${grado}${grupo}-${especialidad}`;

	try {
        if (estado) {
            await fetch('/api/pases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folio_pase: folio,
                    es_grupal: true,
                    grado: Number(grado),
                    grupo: grupo,
                    especialidad: especialidad,
                    grupo_especialidad: grupoEspecialidad,
                    fecha: hoy,
                    estatus_vigencia: true,
                    estatus: 'AUTORIZADO',
                    hora_salida: new Date().toLocaleTimeString(),
                    autorizado_por: rol
                })
            });
            Swal.fire({ icon: 'success', title: 'Salida Grupal Autorizada', text: `Grupo ${grado}° "${grupo}" de ${especialidad}`, toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
        } else {
            const rPases = await fetch('/api/pases');
            if (rPases.ok) {
                const list = await rPases.json();
                const match = list.find(p => p.folio_pase === folio || (p.es_grupal && p.grado == grado && p.grupo == grupo && p.especialidad === especialidad && p.fecha === hoy));
                if (match && match.id) {
                    await fetch(`/api/pases/${match.id}`, { method: 'DELETE' });
                }
            }
            Swal.fire({ icon: 'info', title: 'Pase Grupal Removido', toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
        }
	} catch (e) {
		console.error("Error al alternar pase grupal:", e);
	    Swal.fire("Error", "No se pudo actualizar el estatus del grupo.", "error");
	}
}

async function guardarPaseIndividual() {
	const rol = (localStorage.getItem('userRole') || 'ADMIN').toUpperCase();
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

    const mat = alumnoPase.ncontrol || alumnoPase.matricula;
    const pat = alumnoPase.apepat || alumnoPase.primerApellido || '';
    const matApe = alumnoPase.apemat || alumnoPase.segundoApellido || '';

    const datosPase = {
        folio_pase: folio,
        matricula: mat,
        id_alumno: mat,
        nombreFull: `${alumnoPase.nombre} ${pat} ${matApe}`.trim(),
        es_grupal: false,
        grado: Number(alumnoPase.grado),
        grupo: alumnoPase.grupo,
        especialidad: alumnoPase.especialidad,
        hora_salida: hora,
        motivo: mot,
        estatus_vigencia: true,
        estatus: 'AUTORIZADO',
        fecha: obtenerFechaLocal()
    };

    try {
        Swal.fire({ title: 'Procesando...', text: 'Guardando en base de datos y generando PDF', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        await fetch('/api/pases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosPase)
        });

        const elementoPDF = document.getElementById('contenedorPaseReal');

        const opciones = {
            margin: [80, 80, 80, 80], 
            filename: `Pase_${folio}_${mat}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'px', format: [954, 719], orientation: 'landscape' }
        };
        
        if (typeof html2pdf !== 'undefined') {
            await html2pdf().set(opciones).from(elementoPDF).save();
        }
        await Swal.fire({ icon: 'success', title: '¡Pase Autorizado!', confirmButtonColor: '#7b1b37' });
        limpiarFormularioPase();
        escucharPasesGlobales();

    } catch (err) {
        console.error(err);
        Swal.fire("Error", err.message, "error");
    }
}

function limpiarFormularioPase() {
    alumnoPase = null;

    const camposInput = ['busquedaGlobalAl', 'motInd', 'horaInd'];
    camposInput.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const etiquetasPreview = {
        'prevNombre': '',
        'prevGrado': '',
        'prevGpo': '',
        'prevEsp': '',
        'prevHora': '',
        'prevMot': '',
        'prevFolio': '----'
    };

    for (const [id, valor] of Object.entries(etiquetasPreview)) {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    }

    const sugerencias = document.getElementById('sugerenciasAl');
    if (sugerencias) sugerencias.style.display = 'none';
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

        try {
            const res = await fetch('/api/alumnos');
            if (!res.ok) return;
            const list = await res.json();
            const filtrados = list.filter(al => {
                const estatus = al.estatus_escolar || al.estatus || 'Activo';
                if (estatus !== 'Activo') return false;
                const mat = al.ncontrol || al.matricula || '';
                const pat = al.apepat || al.primerApellido || '';
                const nombreCompleto = quitarAcentos(`${al.nombre} ${pat}`);
                const matricula = quitarAcentos(mat);
                return matricula.includes(queryNormalizada) || nombreCompleto.includes(queryNormalizada);
            }).slice(0, 5);

            if (filtrados.length > 0) {
                sugerencias.innerHTML = filtrados.map(al => {
                    const mat = al.ncontrol || al.matricula;
                    const pat = al.apepat || al.primerApellido || '';
                    return `
                        <button type="button" class="list-group-item list-group-item-action py-2" onclick="seleccionarParaPase('${mat}')">
                            <div class="fw-bold small">${al.nombre} ${pat}</div>
                            <small class="text-muted">${mat} | ${al.especialidad}</small>
                        </button>
                    `;
                }).join('');
                sugerencias.style.display = 'block';
            } else { sugerencias.style.display = 'none'; }
        } catch(err){}
    });
}

async function seleccionarParaPase(matricula) {
    if (document.getElementById('sugerenciasAl')) document.getElementById('sugerenciasAl').style.display = 'none';

    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matricula}`);
        if (res.ok) {
            const data = await res.json();
            const estatus = data.estatus_escolar || data.estatus || 'Activo';
            if (estatus !== "Activo") {
                return Swal.fire("Error", "El alumno está en estatus BAJA.", "error");
            }

            alumnoPase = data;
            const pat = data.apepat || data.primerApellido || '';
            const matApe = data.apemat || data.segundoApellido || '';
            const mat = data.ncontrol || data.matricula || '';
            document.getElementById('prevNombre').innerText = `${data.nombre} ${pat} ${matApe}`.toUpperCase();
            document.getElementById('prevGrado').innerText = data.grado;
            document.getElementById('prevGpo').innerText = data.grupo;
            document.getElementById('prevEsp').innerText = data.especialidad;
            
            document.getElementById('prevFecha').innerText = obtenerFechaFormateada();
            
            const rPases = await fetch('/api/pases');
            let maxFolio = 0;
            if (rPases.ok) {
                const listPases = await rPases.json();
                listPases.forEach(p => {
                    if (!p.es_grupal && p.folio_pase) {
                        const num = parseInt(p.folio_pase, 10);
                        if (!isNaN(num) && num > maxFolio) maxFolio = num;
                    }
                });
            }

            const siguienteFolio = (maxFolio + 1).toString().padStart(4, '0');
            document.getElementById('prevFolio').innerText = siguienteFolio;

            document.getElementById('busquedaGlobalAl').value = mat;
        }
    } catch(err){}
}

async function escucharPasesGlobales() {
    try {
        const res = await fetch('/api/pases');
        if (res.ok) {
            const list = await res.json();
            pasesGlobales = list.filter(p => !p.es_grupal);
            filtrarTablaGlobal();
        }
    } catch(err){}
}

function filtrarTablaGlobal() {
    const fFolio = document.getElementById('buscarFolioGlobal') ? document.getElementById('buscarFolioGlobal').value.toLowerCase() : "";
    const fNombre = document.getElementById('buscarNombreGlobal') ? document.getElementById('buscarNombreGlobal').value.toLowerCase() : "";
    const tbody = document.getElementById('tablaPasesGlobal');
    const hoy = obtenerFechaLocal();
    if(!tbody) return;
    
    tbody.innerHTML = "";
    let filtrados = pasesGlobales.filter(p => {
        const fol = (p.folio_pase || "").toLowerCase();
        const mat = (p.matricula || "").toLowerCase();
        const nom = (p.nombreFull || p.nombre || "").toLowerCase();
        return fol.includes(fFolio) && (nom.includes(fNombre) || mat.includes(fNombre));
    });

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
		            <div class="fw-bold small">${p.nombreFull || p.matricula}</div>
		            <small class="text-muted">${p.matricula}</small>
		        </td>
		        <td><small>${p.fecha}</small></td>
		        <td><small class="text-truncate d-inline-block" style="max-width: 150px;">${p.motivo || 'N/A'}</small></td>
		        <td><span class="badge ${bClase}">${bTexto}</span></td>
		        <td class="text-center">
		            <div class="btn-group">
		                <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarPase('${p.id || p.folio_pase}')" title="Eliminar Pase">
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

async function confirmarEliminarPase(idPase) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar Pase de Salida?',
        text: `Se borrará el registro de salida. Esto afectará el historial de salidas del alumno.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, borrar registro'
    });

    if (isConfirmed) {
        try {
            await fetch(`/api/pases/${idPase}`, { method: 'DELETE' });
            Swal.fire('Eliminado', 'El pase de salida ha sido removido.', 'success');
            escucharPasesGlobales();
        } catch (e) {
            Swal.fire('Error', 'No se pudo eliminar el pase.', 'error');
        }
    }
}

function inicializarPaseIndividual() {
    ['motInd', 'horaInd'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', (e) => {
            const map = { 'motInd': 'prevMot', 'horaInd': 'prevHora' };
            const target = document.getElementById(map[id]);
            if (target) target.innerText = e.target.value.toUpperCase();
        });
    });
}