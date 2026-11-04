/**
 * Motor de Gestión de Excel Dinámico - CBTis 134 (REST API Spring Boot Backend)
 */

let especialidadesCache = [];
let datosPendientesCarga = null;
let jsonDatosPendientes = null;
let estructuraEscolar = {};

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionInicial();
    await cargarEstructuraReal();
});

async function cargarConfiguracionInicial() {
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            especialidadesCache = data.especialidades || [];
            
            const selectEsp = document.getElementById('exportEsp');
            if (selectEsp) {
                selectEsp.innerHTML = '<option value="">-- Seleccione Especialidad --</option>';
                especialidadesCache.forEach(esp => {
                    const opt = document.createElement('option');
                    opt.value = esp.nombre;
                    opt.textContent = esp.nombre;
                    selectEsp.appendChild(opt);
                });
            }
        }
    } catch (e) { console.error("Error al cargar config:", e); }
}

function limpiarSinAcentos(val) {
    return String(val || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function normalizarDatosCBTis(valorExcel) {
    if (!valorExcel) return { grado: "", grupo: "", especialidad: "POR ASIGNAR", color: "#6c757d", turno: "Matutino" };
    
    const regex = /^(\d)([A-Z])\s*(.*)$/i;
    const match = limpiarSinAcentos(valorExcel).match(regex);

    if (match) {
        const grado = match[1];
        const grupo = match[2].toUpperCase();
        const aliasExcel = match[3].trim().toUpperCase();

        const mapaAliasUniversal = {
            "PRO": "PROGRAMACION", "PROG": "PROGRAMACION", "PROGR": "PROGRAMACION",
            "ARH": "ADMINISTRACION DE RECURSOS HUMANOS", "ADM": "ADMINISTRACION DE RECURSOS HUMANOS",
            "CON": "CONTABILIDAD", "CONT": "CONTABILIDAD", "CONTA": "CONTABILIDAD",
            "CST": "CONSTRUCCION", "CONS": "CONSTRUCCION", "TCS": "CONSTRUCCION",
            "ELE": "ELECTRICIDAD", "ELEC": "ELECTRICIDAD",
            "OFI": "OFIMATICA", "OFIM": "OFIMATICA",
            "LAB": "LABORATORISTA CLINICO", "LABC": "LABORATORISTA CLINICO", "LABO": "LABORATORISTA CLINICO",
            "MEC": "MECATRONICA", "MECA": "MECATRONICA",
            "IA": "INTELIGENCIA ARTIFICIAL",
            "ECO": "E.COMMERCE", "ECOM": "E.COMMERCE", "COMER": "E.COMMERCE"
        };
        const nombreMapeado = mapaAliasUniversal[aliasExcel];
        const config = especialidadesCache.find(e => 
            limpiarSinAcentos(e.alias) === aliasExcel || 
            (nombreMapeado && limpiarSinAcentos(e.nombre) === nombreMapeado)
        );
        
        return {
            grado: grado,
            grupo: grupo,
            especialidad: config ? limpiarSinAcentos(config.nombre) : (nombreMapeado || aliasExcel || "POR ASIGNAR"),
            color: config ? config.color : "#6c757d",
            turno: config ? config.turno : "Matutino"
        };
    }
    return { grado: "", grupo: "", especialidad: limpiarSinAcentos(valorExcel), color: "#6c757d", turno: "Matutino" }; 
}

let alumnosNuevosPendientes = [];
let alumnosExistentesAnalisis = [];
let alumnosInvalidosAnalisis = [];

async function procesarCargaMasiva() {
    const input = document.getElementById('excelInput');
    const file = input.files[0];
    if (!file) return Swal.fire("Aviso", "Selecciona un archivo .xlsx", "warning");

    Swal.fire({
        title: 'Analizando archivo Excel...',
        text: 'Verificando matrículas y comprobando alumnos ya existentes en la base de datos...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            jsonDatosPendientes = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: "" });

            if (!jsonDatosPendientes || jsonDatosPendientes.length === 0) {
                Swal.close();
                return Swal.fire("Archivo vacío", "El archivo Excel no contiene filas de datos.", "warning");
            }

            // Consultar alumnos actuales en la base de datos para detectar cuáles ya existen
            const resAlumnos = await fetch('/api/alumnos');
            const alumnosExistentesBD = resAlumnos.ok ? await resAlumnos.json() : [];
            const mapaExistentesPorMatricula = new Map();
            const mapaExistentesPorCurp = new Map();

            alumnosExistentesBD.forEach(a => {
                const matBD = limpiarSinAcentos(a.ncontrol || a.matricula || "").replace(/[^A-Z0-9]/g, "");
                const curpBD = limpiarSinAcentos(a.curp || "").replace(/[^A-Z0-9]/g, "");
                if (matBD) mapaExistentesPorMatricula.set(matBD, a);
                if (curpBD && curpBD.length >= 10) mapaExistentesPorCurp.set(curpBD, a);
            });

            alumnosNuevosPendientes = [];
            alumnosExistentesAnalisis = [];
            alumnosInvalidosAnalisis = [];
            const matriculasVistasEnArchivo = new Set();
            const regexMatricula = /^\d{14}$/;

            for (let i = 0; i < jsonDatosPendientes.length; i++) {
                const row = jsonDatosPendientes[i];
                const r = Object.keys(row).reduce((acc, key) => { 
                    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
                    acc[cleanKey] = row[key]; 
                    return acc; 
                }, {});

                const matricula = limpiarSinAcentos(r.matricula || r.no_control || r.no__control || r.control || r.ncontrol || "").replace(/[^A-Z0-9]/g, "");
                const curp = limpiarSinAcentos(r.curp || "").replace(/[^A-Z0-9]/g, "");
                const teltutor = String(r.teltutor || r.telefono_del_tutor || r.telefono_tutor || "").replace(/[^0-9]/g, "");

                let nombre = limpiarSinAcentos(r.nombre || "");
                let apepat = limpiarSinAcentos(r.apepat || r.apellido_paterno || "");
                let apemat = limpiarSinAcentos(r.apemat || r.apellido_materno || "");

                if (nombre && !apepat) {
                    const partes = nombre.split(" ");
                    if (partes.length >= 3) {
                        apepat = partes[0];
                        apemat = partes[1];
                        nombre = partes.slice(2).join(" ");
                    } else if (partes.length === 2) {
                        apepat = partes[0];
                        nombre = partes[1];
                    }
                }

                const nombreCompleto = `${nombre} ${apepat} ${apemat}`.replace(/\s+/g, " ").trim();

                let especialidadFinal = "POR ASIGNAR";
                let gradoFinal = limpiarSinAcentos(r.grado || "").replace(/[^0-9]/g, "");
                let grupoFinal = limpiarSinAcentos(r.grupo || "").replace(/[^A-Z0-9]/g, "");
                let turnoFinal = "Matutino";

                const gpoCod = r.gpo || r.grupo_oficial || r.grupo_redis;
                if (gpoCod) {
                    const infoEscolar = normalizarDatosCBTis(gpoCod);
                    especialidadFinal = limpiarSinAcentos(infoEscolar.especialidad);
                    gradoFinal = infoEscolar.grado || gradoFinal;
                    grupoFinal = infoEscolar.grupo || grupoFinal;
                    turnoFinal = infoEscolar.turno;
                } else {
                    const excelEsp = limpiarSinAcentos(r.especialidad || r.carrera || "");
                    const configEsp = especialidadesCache.find(e => 
                        limpiarSinAcentos(e.nombre) === excelEsp || limpiarSinAcentos(e.alias) === excelEsp
                    );

                    if (configEsp) {
                        especialidadFinal = limpiarSinAcentos(configEsp.nombre);
                        turnoFinal = configEsp.turno || "Matutino";
                    } else if (excelEsp !== "") {
                        especialidadFinal = excelEsp;
                    }
                }

                const rawTurnoExcel = limpiarSinAcentos(r.turno || r.Turno || r.TURNO || "");
                if (rawTurnoExcel) {
                    const tLower = rawTurnoExcel.toLowerCase();
                    if (tLower.startsWith('mat')) turnoFinal = "Matutino";
                    else if (tLower.startsWith('ves')) turnoFinal = "Vespertino";
                    else if (tLower.startsWith('mix')) turnoFinal = "Mixto";
                    else turnoFinal = rawTurnoExcel;
                }

                if (!regexMatricula.test(matricula)) {
                    alumnosInvalidosAnalisis.push({
                        fila: i + 2,
                        matricula: matricula || '(Vacía)',
                        nombre: nombreCompleto || '(Sin nombre)',
                        motivo: 'Matrícula inválida (debe tener 14 dígitos numéricos)'
                    });
                    continue;
                }

                if (!nombre) {
                    alumnosInvalidosAnalisis.push({
                        fila: i + 2,
                        matricula: matricula,
                        nombre: '(Sin nombre)',
                        motivo: 'Falta el nombre del estudiante'
                    });
                    continue;
                }

                const existenteBD = mapaExistentesPorMatricula.get(matricula) || (curp.length >= 18 ? mapaExistentesPorCurp.get(curp) : null);
                if (existenteBD) {
                    const nomBD = `${existenteBD.nombre || ''} ${existenteBD.apepat || existenteBD.primerApellido || ''} ${existenteBD.apemat || existenteBD.segundoApellido || ''}`.replace(/\s+/g, ' ').trim();
                    alumnosExistentesAnalisis.push({
                        fila: i + 2,
                        matricula: matricula,
                        curp: curp || existenteBD.curp || '-',
                        nombreExcel: nombreCompleto,
                        nombreBD: nomBD || nombreCompleto,
                        especialidad: existenteBD.especialidad || especialidadFinal,
                        gradoGrupo: `${existenteBD.grado || gradoFinal}° ${existenteBD.grupo || grupoFinal}`,
                        motivo: 'Ya existe en BD (No se actualizará)'
                    });
                    continue;
                }

                if (matriculasVistasEnArchivo.has(matricula)) {
                    alumnosExistentesAnalisis.push({
                        fila: i + 2,
                        matricula: matricula,
                        curp: curp || '-',
                        nombreExcel: nombreCompleto,
                        nombreBD: nombreCompleto,
                        especialidad: especialidadFinal,
                        gradoGrupo: `${gradoFinal}° ${grupoFinal}`,
                        motivo: 'Duplicado en el mismo Excel (Se omitirá)'
                    });
                    continue;
                }

                matriculasVistasEnArchivo.add(matricula);
                const textoUnicoQR = `${matricula}|${nombreCompleto}`.substring(0, 48).trim();

                alumnosNuevosPendientes.push({
                    ncontrol: matricula,
                    matricula: matricula,
                    curp: curp,
                    nombre: nombre,
                    apepat: apepat,
                    apemat: apemat,
                    primerApellido: apepat,
                    segundoApellido: apemat,
                    genero: limpiarSinAcentos(r.genero || r.sexo || "N/A").substring(0,1), 
                    email: String(r.email || r.correo_electronico || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase(),
                    celular: String(r.celular || r.telefono_celular_alumno || r.numero_celular || "").replace(/[^0-9]/g, ""),
                    direccion: limpiarSinAcentos(r.direccion || "N/A"),
                    especialidad: especialidadFinal,
                    grado: gradoFinal,
                    grupo: grupoFinal,
                    turno: turnoFinal,
                    estatus_escolar: "Activo",
                    estatus: "Activo",
                    color_semaforo: "Verde",
                    nombretutor: limpiarSinAcentos(r.tutor || r.nombre_tutor || r.nombre_del_tutor || r.nombre_tutor_ || "PENDIENTE"),
                    teltutor: teltutor,
                    ocupaciontutor: limpiarSinAcentos(r.ocupacion || r.ocupacion_del_tutor || "N/A"),
                    qrCode: textoUnicoQR,
                    qr_texto: textoUnicoQR,
                    fecharegistro: new Date().toISOString()
                });
            }

            Swal.close();
            mostrarVentanaFlotanteAnalisisAlumnos(file.name, jsonDatosPendientes.length);

        } catch (err) {
            Swal.close();
            Swal.fire("Error en lectura", err.message, "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

function mostrarVentanaFlotanteAnalisisAlumnos(nombreArchivo, totalLeidos) {
    const contenedor = document.getElementById('contenidoAnalisisAlumnos');
    const btnConfirmar = document.getElementById('btnConfirmarImportacionAlumnos');
    const progresoModal = document.getElementById('progresoModalAlumnos');

    if (progresoModal) progresoModal.classList.add('d-none');

    const cantNuevos = alumnosNuevosPendientes.length;
    const cantExistentes = alumnosExistentesAnalisis.length;
    const cantInvalidos = alumnosInvalidosAnalisis.length;

    const tabActivaNuevos = cantNuevos > 0;
    const tabActivaExistentes = !tabActivaNuevos && cantExistentes > 0;
    const tabActivaInvalidos = !tabActivaNuevos && !tabActivaExistentes && cantInvalidos > 0;

    const filasNuevosHtml = cantNuevos > 0
        ? alumnosNuevosPendientes.map((a, idx) => `
            <tr>
                <td class="text-muted small">${idx + 1}</td>
                <td class="font-monospace fw-bold text-dark small">${a.matricula}</td>
                <td class="fw-bold text-dark small">${a.nombre} ${a.apepat} ${a.apemat}</td>
                <td class="small text-muted">${a.curp || '-'}</td>
                <td class="small">${a.especialidad}</td>
                <td class="small text-center">${a.grado || '-'}° ${a.grupo || '-'}</td>
                <td class="text-center"><span class="badge bg-success-subtle text-success border border-success-subtle">Nuevo a importar</span></td>
            </tr>
        `).join('')
        : `<tr><td colspan="7" class="text-center text-muted py-4">No hay registros nuevos para importar en este archivo.</td></tr>`;

    const filasExistentesHtml = cantExistentes > 0
        ? alumnosExistentesAnalisis.map((ex, idx) => `
            <tr class="table-warning">
                <td class="text-muted small">${idx + 1}</td>
                <td class="font-monospace fw-bold text-dark small">${ex.matricula}</td>
                <td class="fw-bold text-dark small">${ex.nombreBD}</td>
                <td class="small text-muted">${ex.curp}</td>
                <td class="small">${ex.especialidad} (${ex.gradoGrupo})</td>
                <td class="text-center"><span class="badge bg-warning text-dark"><i class="bi bi-shield-lock-fill me-1"></i>${ex.motivo}</span></td>
            </tr>
        `).join('')
        : `<tr><td colspan="6" class="text-center text-muted py-4">Ningún registro del archivo coincide con alumnos ya registrados.</td></tr>`;

    const filasInvalidosHtml = cantInvalidos > 0
        ? alumnosInvalidosAnalisis.map((inv) => `
            <tr class="table-danger">
                <td class="small fw-bold">Fila ${inv.fila}</td>
                <td class="font-monospace small">${inv.matricula}</td>
                <td class="small">${inv.nombre}</td>
                <td class="small text-danger fw-bold"><i class="bi bi-x-circle-fill me-1"></i>${inv.motivo}</td>
            </tr>
        `).join('')
        : `<tr><td colspan="4" class="text-center text-muted py-4">No se detectaron filas con formato inválido.</td></tr>`;

    if (contenedor) {
        contenedor.innerHTML = `
            <div class="alert alert-light border shadow-sm mb-3 py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <i class="bi bi-file-earmark-spreadsheet-fill text-guinda me-2 fs-5"></i>
                    <strong>Archivo analizado:</strong> <span class="text-dark">${nombreArchivo}</span>
                </div>
                <span class="badge bg-dark rounded-pill px-3 py-2">Total filas en Excel: ${totalLeidos}</span>
            </div>

            <div class="row g-3 mb-3">
                <div class="col-md-4">
                    <div class="p-3 rounded-3 border bg-success-subtle border-success-subtle h-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small fw-bold text-success text-uppercase">Nuevos a Importar</div>
                                <div class="fs-3 fw-bold text-success">${cantNuevos}</div>
                            </div>
                            <i class="bi bi-person-plus-fill fs-1 text-success opacity-75"></i>
                        </div>
                        <small class="text-muted d-block mt-1">Se registrarán en la base de datos.</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 rounded-3 border bg-warning-subtle border-warning-subtle h-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small fw-bold text-dark text-uppercase">Ya Existentes (Omitidos)</div>
                                <div class="fs-3 fw-bold text-dark">${cantExistentes}</div>
                            </div>
                            <i class="bi bi-person-check-fill fs-1 text-warning opacity-75"></i>
                        </div>
                        <small class="text-dark d-block mt-1"><strong>No se actualizarán</strong> ni modificarán.</small>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 rounded-3 border bg-danger-subtle border-danger-subtle h-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small fw-bold text-danger text-uppercase">Filas Inválidas</div>
                                <div class="fs-3 fw-bold text-danger">${cantInvalidos}</div>
                            </div>
                            <i class="bi bi-exclamation-octagon-fill fs-1 text-danger opacity-75"></i>
                        </div>
                        <small class="text-muted d-block mt-1">Sin matrícula válida de 14 dígitos.</small>
                    </div>
                </div>
            </div>

            <ul class="nav nav-pills mb-3 bg-light p-1 rounded border" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${tabActivaNuevos ? 'active' : ''} fw-bold small" data-bs-toggle="pill" data-bs-target="#tabNuevosAlumnos" type="button" role="tab">
                        <i class="bi bi-check-circle-fill text-success me-1"></i>Nuevos a Importar (${cantNuevos})
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${tabActivaExistentes ? 'active' : ''} fw-bold small" data-bs-toggle="pill" data-bs-target="#tabExistentesAlumnos" type="button" role="tab">
                        <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>Ya Existentes - No se actualizarán (${cantExistentes})
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${tabActivaInvalidos ? 'active' : ''} fw-bold small" data-bs-toggle="pill" data-bs-target="#tabInvalidosAlumnos" type="button" role="tab">
                        <i class="bi bi-x-circle-fill text-danger me-1"></i>Inválidos (${cantInvalidos})
                    </button>
                </li>
            </ul>

            <div class="tab-content border rounded-3 bg-white">
                <div class="tab-pane fade ${tabActivaNuevos ? 'show active' : ''}" id="tabNuevosAlumnos" role="tabpanel">
                    <div class="table-responsive" style="max-height: 310px;">
                        <table class="table table-sm table-hover align-middle mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>#</th>
                                    <th>Matrícula</th>
                                    <th>Nombre del Estudiante</th>
                                    <th>CURP</th>
                                    <th>Especialidad</th>
                                    <th class="text-center">Gdo/Gpo</th>
                                    <th class="text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>${filasNuevosHtml}</tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-pane fade ${tabActivaExistentes ? 'show active' : ''}" id="tabExistentesAlumnos" role="tabpanel">
                    <div class="table-responsive" style="max-height: 310px;">
                        <table class="table table-sm table-hover align-middle mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>#</th>
                                    <th>Matrícula</th>
                                    <th>Alumno Registrado</th>
                                    <th>CURP</th>
                                    <th>Carrera / Grupo</th>
                                    <th class="text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody>${filasExistentesHtml}</tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-pane fade ${tabActivaInvalidos ? 'show active' : ''}" id="tabInvalidosAlumnos" role="tabpanel">
                    <div class="table-responsive" style="max-height: 310px;">
                        <table class="table table-sm table-hover align-middle mb-0">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>Fila</th>
                                    <th>Matrícula Leída</th>
                                    <th>Nombre</th>
                                    <th>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>${filasInvalidosHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    if (btnConfirmar) {
        if (cantNuevos > 0) {
            btnConfirmar.style.display = 'inline-block';
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-2"></i>Confirmar e Importar (${cantNuevos} Nuevos)`;
        } else {
            btnConfirmar.style.display = 'none';
        }
    }

    const modalEl = document.getElementById('modalAnalisisCargaAlumnos');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

async function ejecutarCargaReal() {
    if (!alumnosNuevosPendientes || alumnosNuevosPendientes.length === 0) {
        return Swal.fire("Aviso", "No hay registros nuevos para importar.", "info");
    }

    const btnConfirmar = document.getElementById('btnConfirmarImportacionAlumnos');
    const btnCancelar = document.getElementById('btnCancelarModalAlumnos');
    const progresoModal = document.getElementById('progresoModalAlumnos');
    const barraModal = document.getElementById('barraProgresoModalAlumnos');
    const textoModal = document.getElementById('textoProgresoModalAlumnos');

    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
    if (progresoModal) progresoModal.classList.remove('d-none');
    if (document.getElementById('statusCarga')) document.getElementById('statusCarga').classList.remove('d-none');
    if (document.getElementById('btnIniciarCarga')) document.getElementById('btnIniciarCarga').disabled = true;
    if (document.getElementById('excelInput')) document.getElementById('excelInput').disabled = true;

    let exitosos = 0, fallos = 0;
    const duplicados = alumnosExistentesAnalisis.length;
    const invalidos = alumnosInvalidosAnalisis.length;

    try {
        const lotes = [];
        for (let i = 0; i < alumnosNuevosPendientes.length; i += 50) {
            lotes.push(alumnosNuevosPendientes.slice(i, i + 50));
        }

        for (let idx = 0; idx < lotes.length; idx++) {
            const lote = lotes[idx];
            try {
                const res = await fetch('/api/alumnos/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(lote)
                });

                if (res.ok) {
                    const guardados = await res.json();
                    exitosos += Array.isArray(guardados) ? guardados.length : lote.length;
                } else {
                    fallos += lote.length;
                }
            } catch (errBatch) {
                fallos += lote.length;
            }

            const procesados = Math.min(alumnosNuevosPendientes.length, (idx + 1) * 50);
            const pct = Math.min(100, Math.round((procesados / alumnosNuevosPendientes.length) * 100));

            if (barraModal) barraModal.style.width = pct + "%";
            if (textoModal) textoModal.innerText = `Importando lote ${idx + 1} de ${lotes.length}... (${pct}%)`;
            if (document.getElementById('barraProgreso')) document.getElementById('barraProgreso').style.width = pct + "%";
            if (document.getElementById('textoProgreso')) document.getElementById('textoProgreso').innerText = `Importando lote ${idx + 1}/${lotes.length}... ${pct}%`;

            await new Promise(resolve => setTimeout(resolve, 20));
        }

    } catch (e) {
        console.error("Error en importación masiva:", e);
    }

    const modalEl = document.getElementById('modalAnalisisCargaAlumnos');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    Swal.fire({
        icon: 'success',
        title: 'Carga Masiva Finalizada',
        html: `<div class="text-start p-3 bg-light rounded border">
            <p class="mb-1 text-success"><strong>✅ Nuevos importados:</strong> ${exitosos}</p>
            <p class="mb-1 text-warning"><strong>⚠️ Ya existentes (omitidos sin actualizar):</strong> ${duplicados}</p>
            <p class="mb-0 text-danger"><strong>❌ Filas inválidas descartadas:</strong> ${invalidos + fallos}</p>
        </div>`,
        confirmButtonColor: '#7b1b37'
    }).then(() => location.reload());
}

function descargarPlantillaManual() {
    if (typeof XLSX === 'undefined') {
        return Swal.fire("Error", "La librería SheetJS no está disponible en este momento. Intenta recargar la página.", "error");
    }
    const getEsp = (idx, fallback) => (especialidadesCache && especialidadesCache.length > 0) ? limpiarSinAcentos(especialidadesCache[idx % especialidadesCache.length].nombre || fallback) : fallback;
    const headers = [
        ["Matricula", "CURP", "Nombre", "ApePat", "ApeMat", "Genero", "Email", "Celular", "Direccion", "Especialidad", "Grado", "Grupo", "Tutor", "TelTutor", "Ocupacion"],
        ["25312051340001", "AANK100908MGRYXRA6", "KARIME ALEJANDRA", "AYALA", "NUNEZ", "M", "karime.ayala@ejemplo.edu.mx", "7471234567", "COL. CENTRO CALLE GALEANA #12", getEsp(0, "PROGRAMACION"), "4", "A", "KARIME NUNEZ HIDALGO", "7479876543", "COMERCIANTE"],
        ["25312051340002", "GARM090315HGRZLR01", "CARLOS EDUARDO", "GARCIA", "RIVERA", "H", "carlos.garcia@ejemplo.edu.mx", "7472345678", "AV. INSURGENTES #45", getEsp(1, "ADMINISTRACION DE RECURSOS HUMANOS"), "4", "B", "EDUARDO GARCIA LOPEZ", "7478765432", "EMPLEADO"],
        ["25312051340003", "HEML100122MGRNNS03", "LIZBETH GUADALUPE", "HERNANDEZ", "MORALES", "M", "lizbeth.hernandez@ejemplo.edu.mx", "7473456789", "COL. VIGURI ANDADOR 3", getEsp(2, "CONTABILIDAD"), "2", "A", "GUADALUPE MORALES RIOS", "7477654321", "DOCENTE"],
        ["25312051340004", "MASE091105HGRRLA08", "EMILIANO", "MARTINEZ", "SANCHEZ", "H", "emiliano.martinez@ejemplo.edu.mx", "7474567890", "CALLE 5 DE MAYO #88", getEsp(3, "CONSTRUCCION"), "6", "A", "ROSA SANCHEZ VEGA", "7476543210", "HOGAR"],
        ["25312051340005", "ROTA100618MGRDCN02", "ANA VALERIA", "RODRIGUEZ", "TORRES", "M", "ana.rodriguez@ejemplo.edu.mx", "7475678901", "BARRIO DE SAN MATEO #14", getEsp(4, "ELECTRICIDAD"), "2", "B", "VALERIA TORRES CASTRO", "7475432109", "ABOGADA"],
        ["25312051340006", "TOFA090829HGRMNB05", "ALEXIS DANIEL", "TORRES", "FLORES", "H", "alexis.torres@ejemplo.edu.mx", "7476789012", "COL. DEL PRI MANZANA 4", getEsp(5, "OFIMATICA"), "4", "C", "DANIEL TORRES MENDOZA", "7474321098", "INGENIERO"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [
        { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
        { wch: 8 }, { wch: 32 }, { wch: 14 }, { wch: 30 }, { wch: 32 },
        { wch: 8 }, { wch: 8 }, { wch: 26 }, { wch: 14 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Alumnos");
    XLSX.writeFile(wb, "Plantilla_Carga_Masiva_Alumnos.xlsx");

    Swal.fire({
        icon: 'success',
        title: 'Plantilla Descargada',
        text: 'Se ha descargado "Plantilla_Carga_Masiva_Alumnos.xlsx". Llena los datos y usa el panel de importación.',
        confirmButtonColor: '#7b1b37'
    });
}

function descargarPlantillaInstitucional() {
    if (typeof XLSX === 'undefined') {
        return Swal.fire("Error", "La librería SheetJS no está disponible en este momento. Intenta recargar la página.", "error");
    }
    const getAlias = (idx, fallback) => (especialidadesCache && especialidadesCache.length > 0) ? limpiarSinAcentos(especialidadesCache[idx % especialidadesCache.length].alias || fallback) : fallback;
    const headers = [
        ["GPO", "NO. CONTROL", "NOMBRE", "CURP", "GENERO", "TELEFONO CELULAR ALUMNO", "TELEFONO TUTOR", "NOMBRE TUTOR"],
        [`2A ${getAlias(0, "PRO")}`, "25312051340001", "AYALA NUNEZ KARIME ALEJANDRA", "AANK100908MGRYXRA6", "M", "7471234567", "7479876543", "KARIME NUNEZ HIDALGO"],
        [`2B ${getAlias(1, "ARH")}`, "25312051340002", "GARCIA RIVERA CARLOS EDUARDO", "GARM090315HGRZLR01", "H", "7472345678", "7478765432", "EDUARDO GARCIA LOPEZ"],
        [`4A ${getAlias(2, "CON")}`, "25312051340003", "HERNANDEZ MORALES LIZBETH GUADALUPE", "HEML100122MGRNNS03", "M", "7473456789", "7477654321", "GUADALUPE MORALES RIOS"],
        [`6A ${getAlias(3, "CST")}`, "25312051340004", "MARTINEZ SANCHEZ EMILIANO", "MASE091105HGRRLA08", "H", "7474567890", "7476543210", "ROSA SANCHEZ VEGA"],
        [`2B ${getAlias(4, "ELE")}`, "25312051340005", "RODRIGUEZ TORRES ANA VALERIA", "ROTA100618MGRDCN02", "M", "7475678901", "7475432109", "VALERIA TORRES CASTRO"],
        [`4C ${getAlias(5, "OFI")}`, "25312051340006", "TORRES FLORES ALEXIS DANIEL", "TOFA090829HGRMNB05", "H", "7476789012", "7474321098", "DANIEL TORRES MENDOZA"]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [
        { wch: 12 }, { wch: 18 }, { wch: 38 }, { wch: 22 },
        { wch: 10 }, { wch: 28 }, { wch: 20 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Layout_REDIS_Oficial");
    XLSX.writeFile(wb, "Layout_REDIS_Oficial.xlsx");

    Swal.fire({
        icon: 'success',
        title: 'Plantilla REDIS Descargada',
        text: 'Se ha descargado "Layout_REDIS_Oficial.xlsx". Llena los datos y usa el panel de importación.',
        confirmButtonColor: '#7b1b37'
    });
}

async function descargarExcelFiltrado() {
    const esp = document.getElementById('exportEsp').value;
    const gg = document.getElementById('exportGradoGpo').value;

    Swal.fire({ 
        title: 'Generando Reporte...', 
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    try {
        const res = await fetch('/api/alumnos');
        if (!res.ok) throw new Error("No se pudo conectar al servidor.");
        const alumnos = await res.json();
        
        let filtrados = alumnos.filter(al => {
            const mat = al.ncontrol || al.matricula;
            if (!mat) return false;
            let okEsp = !esp || al.especialidad === esp;
            let okGpo = !gg || (`${al.grado}${al.grupo}` === gg);
            return okEsp && okGpo;
        });

        if (filtrados.length === 0) throw new Error("No hay registros que coincidan con la búsqueda.");

        const data = filtrados.map(d => {
            const mat = d.ncontrol || d.matricula;
            const pat = d.apepat || d.primerApellido || '';
            const matApe = d.apemat || d.segundoApellido || '';

            return {
                "Matrícula": mat,
                "CURP": d.curp || "",
                "Género": d.genero || "",
                "Nombre": d.nombre,
                "Ape. Paterno": pat,
                "Ape. Materno": matApe,
                "Correo": d.email || "",
                "Celular": d.celular || "",
                "Dirección": d.direccion || "",
                "Especialidad": d.especialidad || "",
                "Grado": d.grado || "",
                "Grupo": d.grupo || "",
                "Turno": d.turno || "",
                "Estatus": d.estatus_escolar || d.estatus || "Activo",
                "Semáforo": d.color_semaforo || "Verde",
                "Tutor": d.nombretutor || "",
                "Tel. Tutor": d.teltutor || "",
                "Ocupación Tutor": d.ocupaciontutor || "N/A"
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Base_Datos_Alumnos");
        
        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Reporte_Alumnos_${esp || 'General'}_${fecha}.xlsx`);
        
        Swal.close();
    } catch (e) { 
        Swal.fire("Aviso", e.message, "info"); 
    }
}

async function cargarEstructuraReal() {
    try {
        const res = await fetch('/api/alumnos');
        if (!res.ok) return;
        const alumnos = await res.json();
        
        estructuraEscolar = {};
        const selectEsp = document.getElementById('exportEsp');

        alumnos.forEach(al => {
            const estatus = al.estatus_escolar || al.estatus || 'Activo';
            if (estatus === 'Activo' && al.especialidad) {
                const espTrim = al.especialidad.trim();
                if (!estructuraEscolar[espTrim]) {
                    estructuraEscolar[espTrim] = new Set();
                }
                if (al.grado && al.grupo) {
                    estructuraEscolar[espTrim].add(`${al.grado}${al.grupo}`);
                }
                if (selectEsp && !Array.from(selectEsp.options).some(opt => opt.value.toUpperCase() === espTrim.toUpperCase())) {
                    const opt = document.createElement('option');
                    opt.value = espTrim;
                    opt.textContent = espTrim;
                    selectEsp.appendChild(opt);
                }
            }
        });
    } catch (e) { 
        console.error("Error al mapear estructura:", e); 
    }
}

function actualizarFiltrosDinamicos() {
    const esp = document.getElementById('exportEsp').value;
    const selectGpo = document.getElementById('exportGradoGpo');
    
    if (!selectGpo) return;
    selectGpo.innerHTML = '<option value="">-- Todos los Grupos --</option>';
    
    if (esp && estructuraEscolar[esp]) {
        Array.from(estructuraEscolar[esp]).sort().forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = `Grado: ${g[0]}° - Grupo: "${g.substring(1)}"`;
            selectGpo.appendChild(opt);
        });
    }
}