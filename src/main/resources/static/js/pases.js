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
    actualizarSiguienteFolioPase();
    
    escucharCambiosGrupos();
    escucharPasesGlobales(); 

    const fFolio = document.getElementById('buscarFolioGlobal');
    const fNombre = document.getElementById('buscarNombreGlobal');
    if(fFolio) fFolio.addEventListener('input', filtrarTablaGlobal);
    if(fNombre) fNombre.addEventListener('input', filtrarTablaGlobal);
});

async function actualizarSiguienteFolioPase() {
    try {
        const res = await fetch('/api/pases/siguiente-folio');
        if (res.ok) {
            const data = await res.json();
            const elFolio = document.getElementById('prevFolio');
            if (elFolio && data.siguiente_folio) {
                elFolio.innerText = data.siguiente_folio;
            }
        }
    } catch(e) {
        let maxFolio = 0;
        if (pasesGlobales && pasesGlobales.length > 0) {
            pasesGlobales.forEach(p => {
                if (!p.es_grupal && p.folio_pase) {
                    const numStr = String(p.folio_pase).replace(/\D/g, '');
                    const num = parseInt(numStr, 10);
                    if (!isNaN(num) && num > maxFolio) maxFolio = num;
                }
            });
        }
        const sig = (maxFolio + 1).toString().padStart(4, '0');
        const elFolio = document.getElementById('prevFolio');
        if (elFolio) elFolio.innerText = sig;
    }
}
window.actualizarSiguienteFolioPase = actualizarSiguienteFolioPase;

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

const normalizarTexto = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
};

async function cargarTableroGrupal() {
    try {
        const res = await fetch('/api/alumnos');
        if (!res.ok) return;
        const alumnos = await res.json();
        const estructura = {};

        const rol = (localStorage.getItem('userRole') || 'ADMIN').toUpperCase();
        const esAdminUOrientacion = (rol === "ADMIN" || rol === "ORIENTACION" || rol === "PREFECTO");

        alumnos.forEach(al => {
            const estatus = (al.estatus_escolar || al.estatus || 'Activo').toUpperCase();
            if (estatus !== 'INACTIVO' && estatus !== 'BAJA' && estatus !== 'EGRESADO' && al.especialidad && al.grado && al.grupo) {
                const espOriginal = al.especialidad.trim();
                const normEsp = normalizarTexto(espOriginal);
                if (!estructura[normEsp]) {
                    estructura[normEsp] = {
                        nombre: espOriginal,
                        grupos: new Set()
                    };
                }
                estructura[normEsp].grupos.add(`${al.grado}${al.grupo}`);
            }
        });

        const tablero = document.getElementById('tableroOrientacion');
        if (!tablero) return;
        tablero.innerHTML = "";

        const keys = Object.keys(estructura).sort();
        if (keys.length === 0) {
            tablero.innerHTML = `<div class="col-12 text-center py-4 text-muted">No hay grupos registrados en la base de datos.</div>`;
            return;
        }

        keys.forEach(normKey => {
            const espObj = estructura[normKey];
            const grupos = Array.from(espObj.grupos).sort();
            const matchConfig = especialidadesConfig.find(e => normalizarTexto(e.nombre) === normKey);
            const color = matchConfig?.color || '#7b1b37';
            const espNombre = espObj.nombre;

            let btnsHtml = "";
            grupos.forEach(g => {
                const grado = g.slice(0, -1);
                const grupo = g.slice(-1);
                const cleanId = 'chk-' + g + '-' + normalizarTexto(espNombre).replace(/[^a-z0-9]/g, '_');
                btnsHtml += '<input type="checkbox" class="btn-check" id="' + cleanId + '" autocomplete="off" ' + (!esAdminUOrientacion ? 'disabled' : '') + ' onchange="alternarPaseGrupal(\'' + grado + '\',\'' + grupo + '\',\'' + espNombre + '\', this.checked)">';
                btnsHtml += '<label class="btn btn-sm btn-outline-success px-3 rounded-pill me-1 mb-1 fw-bold" for="' + cleanId + '" style="' + (!esAdminUOrientacion ? 'cursor: not-allowed; opacity: 0.6;' : '') + '"><i class="bi bi-check-lg d-none me-1 check-icon"></i>' + g + '</label>';
            });

            tablero.innerHTML += `
                <div class="col-md-4 mb-3">
                    <div class="card h-100 border-0 bg-light shadow-sm" style="border-left: 5px solid ${color} !important;">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3" style="color: ${color}">${espNombre}</h6>
                            <div class="d-flex flex-wrap gap-2">
                                ${btnsHtml}
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        await escucharCambiosGrupos();
    } catch (e) {
        console.error("Error en cargarTableroGrupal:", e);
    }
}

async function escucharCambiosGrupos() {
    const hoy = obtenerFechaLocal();
    try {
        const res = await fetch('/api/pases');
        if (res.ok) {
            const pases = await res.json();
            
            // Limpiar estado visual previo
            document.querySelectorAll('input[id^="chk-"]').forEach(chk => {
                chk.checked = false;
            });

            pases.forEach(p => {
                const esGrupal = (p.es_grupal === true || p.es_grupal === 'true');
                const esVigente = (p.estatus_vigencia === true || p.estatus_vigencia === 'true' || p.estatus === 'AUTORIZADO');
                const esHoy = (!p.fecha || p.fecha === hoy);

                if (esGrupal && esVigente && esHoy) {
                    let grado = p.grado || '';
                    let grupo = p.grupo || '';
                    let especialidad = p.especialidad || '';

                    if ((!grado || !grupo) && p.grupo_especialidad) {
                        const parts = p.grupo_especialidad.split('-');
                        if (parts.length >= 2) {
                            const gpoStr = parts[0];
                            grado = gpoStr.slice(0, -1);
                            grupo = gpoStr.slice(-1);
                            if (!especialidad) especialidad = parts.slice(1).join('-');
                        }
                    }

                    const gpoKey = `${grado}${grupo}`;
                    const espNorm = normalizarTexto(especialidad).replace(/[^a-z0-9]/g, '_');
                    
                    let el = document.getElementById(`chk-${gpoKey}-${espNorm}`);
                    
                    if (!el) {
                        const allChks = document.querySelectorAll(`input[id^="chk-${gpoKey}-"]`);
                        for (const chk of allChks) {
                            const suffix = chk.id.replace(`chk-${gpoKey}-`, '');
                            if (suffix === espNorm || espNorm.includes(suffix) || suffix.includes(espNorm)) {
                                el = chk;
                                break;
                            }
                        }
                    }

                    if (el) {
                        el.checked = true;
                    }
                }
            });
        }
    } catch(e){
        console.warn("Error en escucharCambiosGrupos:", e);
    }
}

async function alternarPaseGrupal(grado, grupo, especialidad, estado) {
	const rol = (localStorage.getItem('userRole') || 'ADMIN').toUpperCase();
	if (rol !== "ADMIN" && rol !== "ORIENTACION" && rol !== "PREFECTO") {
	    Swal.fire("Acceso Restringido", "Solo Orientación Educativa o Prefectura pueden autorizar salidas grupales.", "error");
	    return; 
	}
		
	const hoy = obtenerFechaLocal();
    const espLimpia = especialidad.replace(/ /g,'_');
	const folio = `GRP-${grado}${grupo}-${espLimpia}-${hoy}`;
    const grupoEspecialidad = `${grado}${grupo}-${especialidad}`;

	try {
        if (estado) {
            await fetch('/api/pases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    _id: folio,
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
            await fetch(`/api/pases/${encodeURIComponent(folio)}`, { method: 'DELETE' });
            await fetch(`/api/pases/${encodeURIComponent(grupoEspecialidad)}`, { method: 'DELETE' });
            
            const rPases = await fetch('/api/pases');
            if (rPases.ok) {
                const list = await rPases.json();
                const matches = list.filter(p => {
                    const esG = (p.es_grupal === true || p.es_grupal === 'true');
                    const gMatch = String(p.grado) === String(grado) && String(p.grupo) === String(grupo);
                    const espMatch = normalizarTexto(p.especialidad) === normalizarTexto(especialidad);
                    return esG && gMatch && espMatch;
                });
                for (const match of matches) {
                    const idBorrar = match._id || match.id || match.folio_pase;
                    if (idBorrar) {
                        await fetch(`/api/pases/${encodeURIComponent(idBorrar)}`, { method: 'DELETE' });
                    }
                }
            }
            Swal.fire({ icon: 'info', title: 'Pase Grupal Removido', toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
        }

        await escucharCambiosGrupos();
        await escucharPasesGlobales();

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
    const hoy = obtenerFechaLocal();

    const datosPase = {
        _id: `IND-${folio}-${mat}-${hoy}`,
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
        fecha: hoy
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
            margin: [8, 10, 8, 10], 
            filename: `Pase_${folio}_${mat}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
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
            await actualizarSiguienteFolioPase();
            document.getElementById('busquedaGlobalAl').value = mat;
        }
    } catch(err){}
}

async function escucharPasesGlobales() {
    try {
        const res = await fetch('/api/pases');
        if (res.ok) {
            pasesGlobales = await res.json();
            filtrarTablaGlobal();
        }
    } catch(err){
        console.warn("Error cargando pases globales:", err);
    }
}

function filtrarTablaGlobal() {
    const fFolio = document.getElementById('buscarFolioGlobal') ? document.getElementById('buscarFolioGlobal').value.toLowerCase() : "";
    const fNombre = document.getElementById('buscarNombreGlobal') ? document.getElementById('buscarNombreGlobal').value.toLowerCase() : "";
    const tbody = document.getElementById('tablaPasesGlobal');
    const hoy = obtenerFechaLocal();
    if(!tbody) return;
    
    tbody.innerHTML = "";
    let filtrados = pasesGlobales.filter(p => {
        const fol = (p.folio_pase || p._id || "").toLowerCase();
        const mat = (p.matricula || p.grupo_especialidad || "").toLowerCase();
        const nom = (p.nombreFull || p.nombre || p.especialidad || "").toLowerCase();
        return fol.includes(fFolio) && (nom.includes(fNombre) || mat.includes(fNombre));
    });

    const paginados = filtrados.slice(0, limitePases);

    if (paginados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay pases de salida registrados hoy.</td></tr>`;
        return;
    }

    paginados.forEach(p => {
        let bClase = 'bg-secondary', bTexto = 'Usado';
        if (p.estatus_vigencia === true || p.estatus_vigencia === 'true' || p.estatus === 'AUTORIZADO') {
            bClase = (p.fecha === hoy || !p.fecha) ? 'bg-success' : 'bg-warning text-dark';
            bTexto = (p.fecha === hoy || !p.fecha) ? 'Vigente' : 'Expirado';
        }

        const esG = (p.es_grupal === true || p.es_grupal === 'true');
        const badgeTipo = esG 
            ? '<span class="badge bg-primary me-1" style="font-size: 10px;">Grupal</span>' 
            : '<span class="badge bg-secondary me-1" style="font-size: 10px;">Individual</span>';

        const nombreMostrar = esG 
            ? `Salida Grupal ${p.grado || ''}° "${p.grupo || ''}" • ${p.especialidad || ''}`
            : (p.nombreFull || p.nombre || p.matricula || 'Estudiante');

        const matMostrar = esG
            ? `<span class="badge bg-light text-dark border">Grupo ${p.grado || ''}${p.grupo || ''}</span>`
            : (p.matricula || 'S/M');

		tbody.innerHTML += `
		    <tr>
		        <td class="fw-bold text-guinda">${badgeTipo}${p.folio_pase || p._id}</td>
		        <td>
		            <div class="fw-bold small">${nombreMostrar}</div>
		            <small class="text-muted">${matMostrar}</small>
		        </td>
		        <td><small>${p.fecha || hoy}</small></td>
		        <td><small class="text-truncate d-inline-block" style="max-width: 170px;">${p.motivo || (esG ? 'Salida Anticipada Grupal' : 'N/A')}</small></td>
		        <td><span class="badge ${bClase}">${bTexto}</span></td>
		        <td class="text-center">
		            <div class="btn-group">
		                ${!esG ? `
		                <button class="btn btn-sm btn-outline-primary border-0 text-primary" onclick="verPaseIndividual('${p._id || p.id || p.folio_pase}')" title="Ver Pase">
		                    <i class="bi bi-eye-fill fs-5"></i>
		                </button>
		                <button class="btn btn-sm btn-outline-success border-0 text-success" onclick="reimprimirPaseIndividual('${p._id || p.id || p.folio_pase}')" title="Imprimir / Descargar Pase">
		                    <i class="bi bi-printer-fill fs-5"></i>
		                </button>` : ''}
		                <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarPase('${p._id || p.id || p.folio_pase}')" title="Eliminar Pase">
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
            await escucharPasesGlobales();
            await actualizarSiguienteFolioPase();
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

async function limpiarTodosLosPases() {
    const { isConfirmed } = await Swal.fire({
        title: '¿Purgar TODOS los pases de salida?',
        text: 'Esta acción eliminará permanentemente de MongoDB todos los pases (grupales e individuales) y reiniciará las autorizaciones del día a cero.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, borrar todos los pases',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Limpiando base de datos...', didOpen: () => Swal.showLoading() });
            await fetch('/api/pases/limpiar-todos', { method: 'DELETE' });
            await Swal.fire("Éxito", "Todos los pases de salida han sido eliminados de MongoDB.", "success");
            location.reload();
        } catch (e) {
            Swal.fire("Error", "No se pudieron eliminar los pases: " + e.message, "error");
        }
    }
}
window.limpiarTodosLosPases = limpiarTodosLosPases;

async function verPaseIndividual(idPase) {
    const pase = pasesGlobales.find(p => (p._id === idPase || p.id === idPase || p.folio_pase === idPase));
    if (!pase) return Swal.fire("Error", "No se encontró la información del pase.", "error");

    const original = document.getElementById('contenedorPaseReal');
    const contenedor = document.getElementById('contenedorModalPase');
    if (!original || !contenedor) return;

    // Clonar el nodo para NO tocar la plantilla de captura en pantalla
    const clon = original.cloneNode(true);
    clon.removeAttribute('id');

    const folClean = pase.folio_pase ? (String(pase.folio_pase).includes('-') ? String(pase.folio_pase).split('-').pop() : String(pase.folio_pase)) : '0001';
    
    const elFolio = clon.querySelector('#prevFolio');
    if (elFolio) elFolio.innerText = folClean;

    const elFecha = clon.querySelector('#prevFecha');
    if (elFecha) elFecha.innerText = pase.fecha || obtenerFechaFormateada();

    const elNombre = clon.querySelector('#prevNombre');
    if (elNombre) elNombre.innerText = (pase.nombreFull || pase.nombre || pase.matricula || '').toUpperCase();

    const elGrado = clon.querySelector('#prevGrado');
    if (elGrado) elGrado.innerText = pase.grado || '';

    const elGpo = clon.querySelector('#prevGpo');
    if (elGpo) elGpo.innerText = pase.grupo || '';

    const elEsp = clon.querySelector('#prevEsp');
    if (elEsp) elEsp.innerText = (pase.especialidad || '').toUpperCase();

    const elHora = clon.querySelector('#prevHora');
    if (elHora) elHora.innerText = pase.hora_salida || '';

    const elMot = clon.querySelector('#prevMot');
    if (elMot) elMot.innerText = (pase.motivo || '').toUpperCase();

    contenedor.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = "100%";
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "center";
    wrapper.style.overflow = "hidden";

    clon.style.margin = "0 auto";
    clon.style.maxWidth = "100%";
    clon.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
    clon.style.borderRadius = "4px";

    wrapper.appendChild(clon);
    contenedor.appendChild(wrapper);

    const modalEl = document.getElementById('modalVisualizarPase');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
window.verPaseIndividual = verPaseIndividual;

async function reimprimirPaseIndividual(idPase) {
    const pase = pasesGlobales.find(p => (p._id === idPase || p.id === idPase || p.folio_pase === idPase));
    if (!pase) return Swal.fire("Error", "No se encontró la información del pase.", "error");

    const folClean = pase.folio_pase ? (String(pase.folio_pase).includes('-') ? String(pase.folio_pase).split('-').pop() : String(pase.folio_pase)) : '0001';
    if (document.getElementById('prevFolio')) document.getElementById('prevFolio').innerText = folClean;
    if (document.getElementById('prevFecha')) document.getElementById('prevFecha').innerText = pase.fecha || obtenerFechaFormateada();
    if (document.getElementById('prevNombre')) document.getElementById('prevNombre').innerText = (pase.nombreFull || pase.matricula || '').toUpperCase();
    if (document.getElementById('prevGrado')) document.getElementById('prevGrado').innerText = pase.grado || '';
    if (document.getElementById('prevGpo')) document.getElementById('prevGpo').innerText = pase.grupo || '';
    if (document.getElementById('prevEsp')) document.getElementById('prevEsp').innerText = (pase.especialidad || '').toUpperCase();
    if (document.getElementById('prevHora')) document.getElementById('prevHora').innerText = pase.hora_salida || '';
    if (document.getElementById('prevMot')) document.getElementById('prevMot').innerText = (pase.motivo || '').toUpperCase();

    const tabBtn = document.getElementById('pills-individual-tab');
    if (tabBtn) {
        const bsTab = bootstrap.Tab.getInstance(tabBtn) || new bootstrap.Tab(tabBtn);
        bsTab.show();
    }

    const contenedor = document.getElementById('contenedorPaseReal');
    if (contenedor) {
        contenedor.scrollIntoView({ behavior: 'smooth' });
    }

    setTimeout(() => {
        window.print();
    }, 400);
}
window.reimprimirPaseIndividual = reimprimirPaseIndividual;