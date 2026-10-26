// static/js/justificantes.js (REST API Spring Boot Backend)

let alumnoJust = null;
let limiteJustificantes = 10;
let justificantesCache = [];
let alumnosActivosCache = null;
let tipoInasistenciaActual = 'UN_DIA';
const obtenerHoyLocal = () => new Date().toLocaleDateString('en-CA');

document.addEventListener('DOMContentLoaded', () => {
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    const spanFecha = document.getElementById('valFechaEmi');
    if (spanFecha) {
        spanFecha.innerText = new Date().toLocaleDateString('es-MX', opciones);
    }
    
    inicializarDatosJustificantes();
    actualizarFolioSiguiente();
    configurarBusquedaJust();
    escucharJustificantesGlobales();
    
    if (document.getElementById('buscarFolioJust')) document.getElementById('buscarFolioJust').addEventListener('input', filtrarJustificantes);
    if (document.getElementById('buscarNombreJust')) document.getElementById('buscarNombreJust').addEventListener('input', filtrarJustificantes);

    // Eventos de cambio de fecha
    const elFechaFalta = document.getElementById('fechaFalta');
    if (elFechaFalta) {
        elFechaFalta.addEventListener('input', () => actualizarTextoFechaEnPlantilla());
        elFechaFalta.addEventListener('change', () => actualizarTextoFechaEnPlantilla());
    }

    const elFechaInicio = document.getElementById('fechaFaltaInicio');
    if (elFechaInicio) {
        elFechaInicio.addEventListener('input', () => actualizarTextoFechaEnPlantilla());
        elFechaInicio.addEventListener('change', () => actualizarTextoFechaEnPlantilla());
    }

    const elFechaFin = document.getElementById('fechaFaltaFin');
    if (elFechaFin) {
        elFechaFin.addEventListener('input', () => actualizarTextoFechaEnPlantilla());
        elFechaFin.addEventListener('change', () => actualizarTextoFechaEnPlantilla());
    }

    // Evento de cambio de motivo
    if (document.getElementById('motivoJust')) {
        document.getElementById('motivoJust').addEventListener('input', (e) => {
            const elMot = document.getElementById('valMotivo');
            if (elMot) elMot.innerText = e.target.value.toUpperCase() || '\u00A0';
        });
    }

    // Eventos de selección de tipo
    const radioUnDia = document.getElementById('tipoUnDia');
    if (radioUnDia) {
        radioUnDia.addEventListener('change', () => cambiarTipoInasistencia('UN_DIA'));
    }
    const radioRango = document.getElementById('tipoRango');
    if (radioRango) {
        radioRango.addEventListener('change', () => cambiarTipoInasistencia('RANGO'));
    }
});

function cambiarTipoInasistencia(tipo) {
    tipoInasistenciaActual = tipo;
    const gUnDia = document.getElementById('grupoFechaUnDia');
    const gRango = document.getElementById('grupoFechaRango');

    if (tipo === 'RANGO') {
        if (gUnDia) gUnDia.classList.add('d-none');
        if (gRango) gRango.classList.remove('d-none');

        const fFalta = document.getElementById('fechaFalta')?.value;
        const fIni = document.getElementById('fechaFaltaInicio');
        const fFin = document.getElementById('fechaFaltaFin');
        if (fFalta) {
            if (fIni && !fIni.value) fIni.value = fFalta;
            if (fFin && !fFin.value) fFin.value = fFalta;
        }
    } else {
        if (gUnDia) gUnDia.classList.remove('d-none');
        if (gRango) gRango.classList.add('d-none');

        const fIni = document.getElementById('fechaFaltaInicio')?.value;
        const fFalta = document.getElementById('fechaFalta');
        if (fIni && fFalta && !fFalta.value) {
            fFalta.value = fIni;
        }
    }
    actualizarTextoFechaEnPlantilla();
}
window.cambiarTipoInasistencia = cambiarTipoInasistencia;

function actualizarTextoFechaEnPlantilla() {
    const elPrefijo = document.getElementById('valPrefijoFecha');
    const elFecha = document.getElementById('valFechaFalta');
    if (!elFecha) return;

    if (tipoInasistenciaActual === 'RANGO') {
        const fIni = document.getElementById('fechaFaltaInicio')?.value;
        const fFin = document.getElementById('fechaFaltaFin')?.value;
        if (!fIni && !fFin) {
            if (elPrefijo) elPrefijo.innerText = "EL DÍA";
            elFecha.innerText = '\u00A0';
            return;
        }
        const res = formatearRangoFechas(fIni || fFin, fFin || fIni);
        if (elPrefijo) elPrefijo.innerText = res.prefijo;
        elFecha.innerText = res.texto || '\u00A0';
    } else {
        const fUnica = document.getElementById('fechaFalta')?.value;
        if (elPrefijo) elPrefijo.innerText = "EL DÍA";
        if (fUnica) {
            elFecha.innerText = formatearFechaFalta(fUnica).toUpperCase();
        } else {
            elFecha.innerText = '\u00A0';
        }
    }
}
window.actualizarTextoFechaEnPlantilla = actualizarTextoFechaEnPlantilla;

function formatearRangoFechas(fechaInicioStr, fechaFinStr) {
    if (!fechaInicioStr && !fechaFinStr) return { prefijo: "EL DÍA", texto: "" };
    const fIni = fechaInicioStr || fechaFinStr;
    const fFin = fechaFinStr || fechaInicioStr;

    if (fIni === fFin) {
        return {
            prefijo: "EL DÍA",
            texto: formatearFechaFalta(fIni).toUpperCase()
        };
    }

    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const pIni = fIni.split('-');
    const pFin = fFin.split('-');

    if (pIni.length < 3 || pFin.length < 3) {
        return {
            prefijo: "LOS DÍAS",
            texto: `DEL ${fIni} AL ${fFin}`.toUpperCase()
        };
    }

    const diaIni = parseInt(pIni[2], 10);
    const mesIni = parseInt(pIni[1], 10) - 1;
    const anioIni = pIni[0];

    const diaFin = parseInt(pFin[2], 10);
    const mesFin = parseInt(pFin[1], 10) - 1;
    const anioFin = pFin[0];

    // Mismo mes y mismo año
    if (mesIni === mesFin && anioIni === anioFin) {
        return {
            prefijo: "LOS DÍAS",
            texto: `DEL ${diaIni} AL ${diaFin} DE ${meses[mesIni]}`
        };
    }

    // Diferente mes, mismo año
    if (anioIni === anioFin) {
        return {
            prefijo: "LOS DÍAS",
            texto: `DEL ${diaIni} DE ${meses[mesIni]} AL ${diaFin} DE ${meses[mesFin]}`
        };
    }

    // Diferente año
    return {
        prefijo: "LOS DÍAS",
        texto: `DEL ${diaIni} DE ${meses[mesIni]} DE ${anioIni} AL ${diaFin} DE ${meses[mesFin]} DE ${anioFin}`
    };
}
window.formatearRangoFechas = formatearRangoFechas;

async function inicializarDatosJustificantes() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            const responsable = data.responsable_orientacion || "MATILDE ABIGAIL GARCIA NAJERA";
            const firmaJust = document.getElementById('nombreResponsableJust');
            if (firmaJust) firmaJust.innerText = responsable.toUpperCase();

            const elNomPlantel = document.getElementById('justNombrePlantel');
            if (elNomPlantel && data.nombre_plantel) {
                elNomPlantel.innerText = data.nombre_plantel.toUpperCase();
            }

            const elCct = document.getElementById('justCctEscuela');
            if (elCct && data.cct_escuela) {
                elCct.innerText = data.cct_escuela.toUpperCase();
            }

            const elCiudad = document.getElementById('justCiudadPlantel');
            if (elCiudad && (data.ciudad_plantel || data.direccion_plantel)) {
                elCiudad.innerText = data.ciudad_plantel || data.direccion_plantel;
            }

            const elSlogan = document.getElementById('justSloganPlantel');
            if (elSlogan && data.slogan_plantel) {
                let sl = data.slogan_plantel.trim();
                if (!sl.startsWith('"') && !sl.startsWith('“')) sl = `"${sl}"`;
                elSlogan.innerText = sl.toUpperCase();
            }

            const elDir = document.getElementById('justDireccionPlantel');
            if (elDir && data.direccion_plantel) {
                elDir.innerText = data.direccion_plantel;
            }

            const elTel = document.getElementById('justTelSpan');
            if (elTel && data.telefono_escuela) {
                elTel.innerText = data.telefono_escuela;
            }
        }
    } catch (e) {
        console.error("Error al cargar datos institucionales:", e);
    }
}

async function actualizarFolioSiguiente() {
    try {
        const res = await fetch('/api/justificantes/siguiente-folio');
        if (res.ok) {
            const data = await res.json();
            const elFolio = document.getElementById('prevFolio');
            if (elFolio && data.siguiente_folio) {
                elFolio.innerText = "FOLIO: " + data.siguiente_folio;
            }
        }
    } catch (e) {
        let max = 0;
        if (justificantesCache && justificantesCache.length > 0) {
            justificantesCache.forEach(j => {
                const f = (j.folio_justificante || j.id || '').toString().replace(/\D/g, '');
                if (f) {
                    const n = parseInt(f, 10);
                    if (n > max) max = n;
                }
            });
        }
        const sig = (max + 1).toString().padStart(4, '0');
        const elFolio = document.getElementById('prevFolio');
        if (elFolio) elFolio.innerText = "FOLIO: " + sig;
    }
}

function formatearFechaFalta(fechaStr) {
    if (!fechaStr) return "";
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const partes = fechaStr.split('-');
    if (partes.length < 3) return fechaStr;
    return `${partes[2]} DE ${meses[parseInt(partes[1], 10) - 1]}`;
}

function configurarBusquedaJust() {
    const input = document.getElementById('buscarAlumnoJust');
    const sugerencias = document.getElementById('sugerenciasJust');
    if (!input || !sugerencias) return;

    const normalizar = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    input.addEventListener('input', async (e) => {
        const query = normalizar(e.target.value);
        if (query.length < 2) { sugerencias.style.display = 'none'; return; }

        try {
            if (!alumnosActivosCache) {
                const res = await fetch('/api/alumnos');
                if (!res.ok) return;
                alumnosActivosCache = await res.json();
            }
            
            const filtrados = alumnosActivosCache.filter(al => {
                const estatus = al.estatus_escolar || al.estatus || 'Activo';
                if (estatus !== 'Activo') return false;
                const mat = al.ncontrol || al.matricula || '';
                const pat = al.apepat || al.primerApellido || '';
                const matApe = al.apemat || al.segundoApellido || '';
                const nom = normalizar(`${al.nombre} ${pat} ${matApe}`);
                return normalizar(mat).includes(query) || nom.includes(query);
            }).slice(0, 5);

            if (filtrados.length > 0) {
                sugerencias.innerHTML = filtrados.map(al => {
                    const mat = al.ncontrol || al.matricula;
                    const pat = al.apepat || al.primerApellido || '';
                    const matApe = al.apemat || al.segundoApellido || '';
                    return `
                        <button type="button" class="list-group-item list-group-item-action py-2" onclick="seleccionarParaJust('${mat}')">
                            <div class="fw-bold small">${al.nombre} ${pat} ${matApe}</div>
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

        document.getElementById('valNombre').innerText = `${data.nombre || ''} ${pat} ${matApe}`.trim().toUpperCase();
        document.getElementById('valGrado').innerText = data.grado || '';
        document.getElementById('valGpo').innerText = data.grupo || '';
        document.getElementById('valEsp').innerText = (data.especialidad || '').toUpperCase();

        const elTurno = document.getElementById('valTurnoJust');
        if (elTurno) elTurno.innerText = '';
        
        inicializarDatosJustificantes();
        await actualizarFolioSiguiente();
        if (document.getElementById('sugerenciasJust')) document.getElementById('sugerenciasJust').style.display = 'none';
        document.getElementById('buscarAlumnoJust').value = `${data.nombre || ''} ${pat}`.trim();

    } catch (e) { console.error(e); }
}

/**
 * Construye el contenedor tamaño Carta (216mm x 279mm) con dos tantos idénticos
 * (superior e inferior) separados exactamente a la mitad por una línea punteada de corte.
 */
function construirHojaDobleConLineaDeCorte(originalElement) {
    const tempContainer = document.createElement('div');
    tempContainer.style.width = "216mm";
    tempContainer.style.height = "279mm";
    tempContainer.style.backgroundColor = "#ffffff";
    tempContainer.style.display = "flex";
    tempContainer.style.flexDirection = "column";
    tempContainer.style.justifyContent = "space-between";
    tempContainer.style.boxSizing = "border-box";
    tempContainer.style.overflow = "hidden";

    const copiaSuperior = originalElement.cloneNode(true);
    const copiaInferior = originalElement.cloneNode(true);

    copiaSuperior.style.margin = "0";
    copiaSuperior.style.boxShadow = "none";
    copiaSuperior.style.overflow = "visible";
    copiaInferior.style.margin = "0";
    copiaInferior.style.boxShadow = "none";
    copiaInferior.style.overflow = "visible";

    // Línea divisora central de corte entre las dos partes
    const lineaCorte = document.createElement('div');
    lineaCorte.style.width = "216mm";
    lineaCorte.style.height = "1.4mm";
    lineaCorte.style.display = "flex";
    lineaCorte.style.alignItems = "center";
    lineaCorte.style.justifyContent = "space-between";
    lineaCorte.style.padding = "0 6mm";
    lineaCorte.style.boxSizing = "border-box";
    lineaCorte.innerHTML = `
        <span style="font-size: 8pt; color: #666; line-height: 1; padding-right: 4px;">&#9986;</span>
        <div style="flex-grow: 1; border-top: 1.5px dashed #666666; height: 0;"></div>
        <span style="font-size: 8pt; color: #666; line-height: 1; padding-left: 4px;">&#9986;</span>
    `;

    tempContainer.appendChild(copiaSuperior);
    tempContainer.appendChild(lineaCorte);
    tempContainer.appendChild(copiaInferior);

    return tempContainer;
}

function limpiarFormularioJustificante() {
    alumnoJust = null;
    const inputBusqueda = document.getElementById('buscarAlumnoJust');
    if (inputBusqueda) inputBusqueda.value = '';
    
    const fFalta = document.getElementById('fechaFalta');
    if (fFalta) fFalta.value = '';
    const fIni = document.getElementById('fechaFaltaInicio');
    if (fIni) fIni.value = '';
    const fFin = document.getElementById('fechaFaltaFin');
    if (fFin) fFin.value = '';
    const fMot = document.getElementById('motivoJust');
    if (fMot) fMot.value = '';

    const elNom = document.getElementById('valNombre');
    if (elNom) elNom.innerText = '\u00A0';
    const elGra = document.getElementById('valGrado');
    if (elGra) elGra.innerText = '\u00A0';
    const elGpo = document.getElementById('valGpo');
    if (elGpo) elGpo.innerText = '\u00A0';
    const elEsp = document.getElementById('valEsp');
    if (elEsp) elEsp.innerText = '\u00A0';
    const elPref = document.getElementById('valPrefijoFecha');
    if (elPref) elPref.innerText = 'EL DÍA';
    const elFec = document.getElementById('valFechaFalta');
    if (elFec) elFec.innerText = '\u00A0';
    const elMotVal = document.getElementById('valMotivo');
    if (elMotVal) elMotVal.innerText = '\u00A0';

    const radioUnDia = document.getElementById('tipoUnDia');
    if (radioUnDia) {
        radioUnDia.checked = true;
        cambiarTipoInasistencia('UN_DIA');
    }
}
window.limpiarFormularioJustificante = limpiarFormularioJustificante;

async function guardarJustificante() {
    if (!alumnoJust) {
        return Swal.fire("Alumno Requerido", "Por favor seleccione un alumno antes de continuar.", "warning");
    }

    const motivo = document.getElementById('motivoJust')?.value.trim().toUpperCase();
    if (!motivo) {
        return Swal.fire("Motivo Requerido", "Por favor ingrese el motivo de la inasistencia.", "warning");
    }

    let inasistenciaDiaFinal = "";
    let fechaInicioFinal = "";
    let fechaFinFinal = "";
    let prefijoFinal = "EL DÍA";
    let textoFechaFinal = "";

    if (tipoInasistenciaActual === 'RANGO') {
        const fIni = document.getElementById('fechaFaltaInicio')?.value;
        const fFin = document.getElementById('fechaFaltaFin')?.value;
        if (!fIni || !fFin) {
            return Swal.fire("Fechas Incompletas", "Por favor seleccione la fecha de inicio y la fecha de fin de la inasistencia.", "warning");
        }
        if (fFin < fIni) {
            return Swal.fire("Rango Inválido", "La fecha de fin no puede ser anterior a la fecha de inicio.", "warning");
        }
        fechaInicioFinal = fIni;
        fechaFinFinal = fFin;
        inasistenciaDiaFinal = `${fIni} al ${fFin}`;
        const res = formatearRangoFechas(fIni, fFin);
        prefijoFinal = res.prefijo;
        textoFechaFinal = res.texto;
    } else {
        const fUnica = document.getElementById('fechaFalta')?.value;
        if (!fUnica) {
            return Swal.fire("Fecha Requerida", "Por favor seleccione la fecha de la inasistencia.", "warning");
        }
        fechaInicioFinal = fUnica;
        fechaFinFinal = fUnica;
        inasistenciaDiaFinal = fUnica;
        prefijoFinal = "EL DÍA";
        textoFechaFinal = formatearFechaFalta(fUnica).toUpperCase();
    }

    // Actualizar vista previa en vivo antes de la captura
    const elPrefijo = document.getElementById('valPrefijoFecha');
    if (elPrefijo) elPrefijo.innerText = prefijoFinal;
    const elFecha = document.getElementById('valFechaFalta');
    if (elFecha) elFecha.innerText = textoFechaFinal;
    const elMotivo = document.getElementById('valMotivo');
    if (elMotivo) elMotivo.innerText = motivo;

    const folioStr = document.getElementById('prevFolio').innerText;
    const folioLimpio = folioStr.replace("FOLIO: ", "").trim();
    const mat = alumnoJust.ncontrol || alumnoJust.matricula;

    const datos = {
        folio_justificante: folioLimpio,
        id_alumno: mat,
        matricula: mat,
        grado: Number(alumnoJust.grado),
        grupo: alumnoJust.grupo,
        especialidad: alumnoJust.especialidad,
        fecha_expedicion: obtenerHoyLocal(),
        tipo_inasistencia: tipoInasistenciaActual,
        inasistencia_dia: inasistenciaDiaFinal,
        fecha_inicio: fechaInicioFinal,
        fecha_fin: fechaFinFinal,
        inasistencia_texto: textoFechaFinal,
        prefijo_fecha: prefijoFinal,
        motivo_detalle: motivo
    };

    try {
        Swal.fire({
            title: 'Guardando e imprimiendo...',
            text: 'Generando justificante oficial...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        
        // 1. Guardar en MongoDB
        await fetch('/api/justificantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        // 2. Construir la hoja doble directamente (idéntico a reimpresión para evitar PDFs en blanco)
        const original = document.getElementById('disenoJustificante');
        const tempContainer = construirHojaDobleConLineaDeCorte(original);

        // Asegurar que las imágenes institucionales estén listas
        const imgs = tempContainer.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(res => {
                img.onload = res;
                img.onerror = res;
            });
        }));

        const opciones = {
            margin: 0,
            filename: `Justificante_${datos.folio_justificante}.pdf`,
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

        await Swal.fire({
            icon: 'success',
            title: '¡Justificante Emitido!',
            text: `El justificante con Folio ${datos.folio_justificante} se guardó exitosamente y se descargó el documento.`,
            confirmButtonColor: '#7b1b37',
            confirmButtonText: 'Aceptar'
        });

        limpiarFormularioJustificante();
        await escucharJustificantesGlobales();
        await actualizarFolioSiguiente();

    } catch (e) {
        console.error("Error al emitir justificante:", e);
        Swal.fire("Error", e.message || "No se pudo generar el justificante.", "error");
    }
}
window.guardarJustificante = guardarJustificante;

async function escucharJustificantesGlobales() {
    try {
        const [resJust, resAl] = await Promise.all([
            fetch('/api/justificantes').then(r => r.ok ? r.json() : []),
            fetch('/api/alumnos').then(r => r.ok ? r.json() : [])
        ]);

        alumnosActivosCache = resAl;

        const mapAlumnos = {};
        const mapTurno = {};
        resAl.forEach(a => {
            const mat = a.ncontrol || a.matricula;
            const pat = a.apepat || a.primerApellido || '';
            const matApe = a.apemat || a.segundoApellido || '';
            if (mat) {
                mapAlumnos[mat] = `${a.nombre || ''} ${pat} ${matApe}`.replace(/\s+/g, ' ').trim();
                mapTurno[mat] = a.turno || 'Matutino';
            }
        });

        justificantesCache = resJust.map(j => ({
            ...j,
            nombreFull: mapAlumnos[j.id_alumno || j.matricula] || j.nombre || "Estudiante",
            turnoAlumno: mapTurno[j.id_alumno || j.matricula] || "Matutino"
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
        const folio = j.folio_justificante || j.id || j._id || 'N/A';
        const mat = j.id_alumno || j.matricula || '';
        const inasistenciaDisplay = j.inasistencia_dia || j.fecha_inicio || '';
        const esRango = j.tipo_inasistencia === 'RANGO' || inasistenciaDisplay.includes(' al ');
        const badgeInasistencia = esRango ? 
            `<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-calendar-range me-1"></i>${inasistenciaDisplay}</span>` :
            `<span class="badge bg-light text-dark border"><i class="bi bi-calendar-event me-1"></i>${inasistenciaDisplay}</span>`;

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${folio}</td>
                <td>
                    <div class="fw-bold small">${j.nombreFull}</div>
                    <small class="text-muted">${mat}</small>
                </td>
                <td>${badgeInasistencia}</td>
                <td><small class="text-truncate d-inline-block" style="max-width: 150px;">${j.motivo_detalle || ''}</small></td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary border-0" onclick="verJustificante('${folio}')" title="Ver Justificante">
                            <i class="bi bi-eye-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="reimprimirJust('${folio}')" title="Descargar / Imprimir PDF">
                            <i class="bi bi-file-pdf-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="confirmarEliminarJustificante('${j._id || j.folio_justificante || j.id}')" title="Eliminar Justificante">
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
            await escucharJustificantesGlobales();
            await actualizarFolioSiguiente();
        } catch (e) {
            Swal.fire("Error", "Error al borrar: " + e.message, "error");
        }
    }
}

function filtrarJustificantes() {
    renderizarTablaJustificantes();
}

function verJustificante(folio) {
    const j = justificantesCache.find(item => (item.folio_justificante === folio || item.id === folio || item._id === folio));
    if (!j) return Swal.fire("Error", "No se encontraron los datos del justificante.", "error");

    const original = document.getElementById('disenoJustificante');
    const contenedor = document.getElementById('contenedorModalJustificante');
    if (!original || !contenedor) return;

    // Clonar el diseño base para NO modificar la plantilla principal de captura
    const clon = original.cloneNode(true);
    clon.removeAttribute('id');

    // Llenar los datos directamente en el clon aislado
    const elNom = clon.querySelector('#valNombre');
    if (elNom) elNom.innerText = (j.nombreFull || j.nombre || '').toUpperCase();

    const elGra = clon.querySelector('#valGrado');
    if (elGra) elGra.innerText = j.grado || '';

    const elGpo = clon.querySelector('#valGpo');
    if (elGpo) elGpo.innerText = j.grupo || '';

    const elEsp = clon.querySelector('#valEsp');
    if (elEsp) elEsp.innerText = (j.especialidad || '').toUpperCase();

    const elFol = clon.querySelector('#prevFolio');
    if (elFol) elFol.innerText = "FOLIO: " + (j.folio_justificante || j.id || j._id);

    // Resolver texto de inasistencia (un solo día o rango)
    let prefijo = "EL DÍA";
    let textoFecha = "";

    if (j.tipo_inasistencia === 'RANGO' || (j.fecha_inicio && j.fecha_fin && j.fecha_inicio !== j.fecha_fin) || (j.inasistencia_dia && j.inasistencia_dia.includes(' al '))) {
        let fIni = j.fecha_inicio;
        let fFin = j.fecha_fin;
        if (!fIni && j.inasistencia_dia && j.inasistencia_dia.includes(' al ')) {
            const partes = j.inasistencia_dia.split(' al ');
            fIni = partes[0].trim();
            fFin = partes[1].trim();
        }
        const res = formatearRangoFechas(fIni, fFin);
        prefijo = res.prefijo;
        textoFecha = res.texto;
    } else {
        const fechaUnica = j.inasistencia_dia || j.fecha_inicio || '';
        prefijo = "EL DÍA";
        textoFecha = formatearFechaFalta(fechaUnica).toUpperCase();
    }

    const elPref = clon.querySelector('#valPrefijoFecha');
    if (elPref) elPref.innerText = prefijo;

    const elFec = clon.querySelector('#valFechaFalta');
    if (elFec) elFec.innerText = textoFecha || '\u00A0';

    const elMot = clon.querySelector('#valMotivo');
    if (elMot) elMot.innerText = (j.motivo_detalle || '').toUpperCase();

    // Construir la hoja doble con línea de corte a partir del clon aislado
    contenedor.innerHTML = '';
    const tempContainer = construirHojaDobleConLineaDeCorte(clon);

    // Envolver en un contenedor escalable para que entre completo y perfectamente en pantalla
    const wrapperEscala = document.createElement('div');
    wrapperEscala.style.width = "100%";
    wrapperEscala.style.display = "flex";
    wrapperEscala.style.justifyContent = "center";
    wrapperEscala.style.overflow = "hidden";

    tempContainer.style.transform = "scale(0.55)";
    tempContainer.style.transformOrigin = "top center";
    tempContainer.style.margin = "0 auto -370px auto"; // compensar espacio inferior del scale
    tempContainer.style.boxShadow = "0 8px 30px rgba(0,0,0,0.15)";
    tempContainer.style.borderRadius = "4px";

    wrapperEscala.appendChild(tempContainer);
    contenedor.appendChild(wrapperEscala);

    const modalEl = document.getElementById('modalVisualizarJustificante');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
window.verJustificante = verJustificante;

function visualizarJustificanteModal() {
    const original = document.getElementById('disenoJustificante');
    const contenedor = document.getElementById('contenedorModalJustificante');
    if (!original || !contenedor) return;

    contenedor.innerHTML = '';
    const clon = original.cloneNode(true);
    clon.removeAttribute('id');
    const tempContainer = construirHojaDobleConLineaDeCorte(clon);

    const wrapperEscala = document.createElement('div');
    wrapperEscala.style.width = "100%";
    wrapperEscala.style.display = "flex";
    wrapperEscala.style.justifyContent = "center";
    wrapperEscala.style.overflow = "hidden";

    tempContainer.style.transform = "scale(0.55)";
    tempContainer.style.transformOrigin = "top center";
    tempContainer.style.margin = "0 auto -370px auto";
    tempContainer.style.boxShadow = "0 8px 30px rgba(0,0,0,0.15)";
    tempContainer.style.borderRadius = "4px";

    wrapperEscala.appendChild(tempContainer);
    contenedor.appendChild(wrapperEscala);

    const modalEl = document.getElementById('modalVisualizarJustificante');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
window.visualizarJustificanteModal = visualizarJustificanteModal;

async function reimprimirJust(folio) {
    const j = justificantesCache.find(item => (item.folio_justificante === folio || item.id === folio || item._id === folio));
    if (!j) return Swal.fire("Error", "No se encontraron los datos en el sistema.", "error");

    document.getElementById('valNombre').innerText = (j.nombreFull || j.nombre || '').toUpperCase();
    document.getElementById('valGrado').innerText = j.grado || '';
    document.getElementById('valGpo').innerText = j.grupo || '';
    document.getElementById('valEsp').innerText = (j.especialidad || '').toUpperCase();
    document.getElementById('prevFolio').innerText = "FOLIO: " + (j.folio_justificante || j.id || j._id);

    const elTurno = document.getElementById('valTurnoJust');
    if (elTurno) {
        const esVesp = (j.turnoAlumno || '').toUpperCase().startsWith('V');
        elTurno.innerText = esVesp ? 'T.V.' : 'T.M.';
    }

    let prefijo = "EL DÍA";
    let textoFecha = "";

    if (j.tipo_inasistencia === 'RANGO' || (j.fecha_inicio && j.fecha_fin && j.fecha_inicio !== j.fecha_fin) || (j.inasistencia_dia && j.inasistencia_dia.includes(' al '))) {
        let fIni = j.fecha_inicio;
        let fFin = j.fecha_fin;
        if (!fIni && j.inasistencia_dia && j.inasistencia_dia.includes(' al ')) {
            const partes = j.inasistencia_dia.split(' al ');
            fIni = partes[0].trim();
            fFin = partes[1].trim();
        }
        const res = formatearRangoFechas(fIni, fFin);
        prefijo = res.prefijo;
        textoFecha = res.texto;
    } else {
        const fechaUnica = j.inasistencia_dia || j.fecha_inicio || '';
        prefijo = "EL DÍA";
        textoFecha = formatearFechaFalta(fechaUnica).toUpperCase();
    }

    const elPref = document.getElementById('valPrefijoFecha');
    if (elPref) elPref.innerText = prefijo;
    document.getElementById('valFechaFalta').innerText = textoFecha || '\u00A0';
    document.getElementById('valMotivo').innerText = (j.motivo_detalle || '').toUpperCase();

    const original = document.getElementById('disenoJustificante');
    if (!original) return Swal.fire("Error", "No se encontró el diseño base del justificante.", "error");

    const tempContainer = construirHojaDobleConLineaDeCorte(original);

    // Asegurar carga de imágenes antes de capturar
    const imgs = tempContainer.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => {
            img.onload = res;
            img.onerror = res;
        });
    }));

    try {
        Swal.fire({ 
            title: 'Generando PDF...', 
            text: 'Preparando justificante doble con línea de corte',
            allowOutsideClick: false,
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
window.reimprimirJust = reimprimirJust;
