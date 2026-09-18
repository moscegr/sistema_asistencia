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

function normalizarDatosCBTis(valorExcel) {
    if (!valorExcel) return { grado: "", grupo: "", especialidad: "POR ASIGNAR", color: "#6c757d", turno: "Matutino" };
    
    const regex = /^(\d)([A-Z])\s*(.*)$/i;
    const match = String(valorExcel).trim().match(regex);

    if (match) {
        const grado = match[1];
        const grupo = match[2].toUpperCase();
        const aliasExcel = match[3].trim().toUpperCase();

        const config = especialidadesCache.find(e => e.alias === aliasExcel);
        
        return {
            grado: grado,
            grupo: grupo,
            especialidad: config ? config.nombre : (aliasExcel || "POR ASIGNAR"),
            color: config ? config.color : "#6c757d",
            turno: config ? config.turno : "Matutino"
        };
    }
    return { grado: "", grupo: "", especialidad: valorExcel, color: "#6c757d", turno: "Matutino" }; 
}

async function procesarCargaMasiva() {
    const input = document.getElementById('excelInput');
    const file = input.files[0];
    if (!file) return Swal.fire("Aviso", "Selecciona un archivo .xlsx", "warning");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            jsonDatosPendientes = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: "" });

            let posiblesExitos = 0;
            let descartadosPreviamente = 0;
            const regexMatricula = /^\d{14}$/;

            for (let row of jsonDatosPendientes) {
                const r = Object.keys(row).reduce((acc, key) => { 
                    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
                    acc[cleanKey] = row[key]; 
                    return acc; 
                }, {});
                const matricula = String(r.matricula || r.no_control || r.no__control || r.control || r.ncontrol || "").trim();
                
                if (regexMatricula.test(matricula)) posiblesExitos++;
                else descartadosPreviamente++;
            }

            const result = await Swal.fire({
                title: '¿Iniciar importación?',
                html: `
                    <div class="text-start p-3 bg-light rounded border">
                        <p class="mb-1"><strong>Archivo:</strong> ${file.name}</p>
                        <p class="mb-1"><strong>Total de filas leídas:</strong> ${jsonDatosPendientes.length}</p>
                        <hr class="my-2">
                        <p class="mb-1 text-success"><i class="bi bi-check-circle"></i> <strong>Matrículas válidas:</strong> ${posiblesExitos}</p>
                        <p class="mb-0 text-danger"><i class="bi bi-exclamation-triangle"></i> <strong>Sin matrícula de 14 dígitos:</strong> ${descartadosPreviamente}</p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#7b1b37',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, iniciar carga',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                ejecutarCargaReal();
            } else {
                jsonDatosPendientes = null;
                input.value = "";
            }

        } catch (err) { Swal.fire("Error en lectura", err.message, "error"); }
    };
    reader.readAsArrayBuffer(file);
}

async function ejecutarCargaReal() {
    const json = jsonDatosPendientes;
    if (!json) return;

    if (document.getElementById('statusCarga')) document.getElementById('statusCarga').classList.remove('d-none');
    if (document.getElementById('btnIniciarCarga')) document.getElementById('btnIniciarCarga').disabled = true;
    if (document.getElementById('excelInput')) document.getElementById('excelInput').disabled = true;
    
    Swal.fire({ title: 'Procesando lista...', text: 'Importando en bloques para evitar congelamiento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let exitosos = 0, fallos = 0, duplicados = 0;
    const regexMatricula = /^\d{14}$/;

    try {
        const resAlumnos = await fetch('/api/alumnos');
        const alumnosExistentes = resAlumnos.ok ? await resAlumnos.json() : [];
        const setMatriculas = new Set(alumnosExistentes.map(a => a.ncontrol || a.matricula));

        const lotes = [];
        let loteActual = [];

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            const r = Object.keys(row).reduce((acc, key) => { 
                const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
                acc[cleanKey] = row[key]; 
                return acc; 
            }, {});
            
            const matricula = String(r.matricula || r.no_control || r.no__control || r.control || r.ncontrol || "").trim();
            const teltutor = String(r.teltutor || r.telefono_del_tutor || r.telefono_tutor || "").trim();

            let nombre = String(r.nombre || "").trim();
            let apepat = String(r.apepat || r.apellido_paterno || "").trim();
            let apemat = String(r.apemat || r.apellido_materno || "").trim();

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

            if (!regexMatricula.test(matricula)) { 
                fallos++; 
                continue; 
            }

            if (setMatriculas.has(matricula)) { 
                duplicados++; 
                continue; 
            }

            const nombreCompletoQR = `${nombre} ${apepat} ${apemat}`.trim().toUpperCase();
            const textoUnicoQR = `${matricula}|${nombreCompletoQR}`;

            let especialidadFinal = "POR ASIGNAR";
            let gradoFinal = String(r.grado || "").trim();
            let grupoFinal = String(r.grupo || "").trim().toUpperCase();
            let turnoFinal = "Matutino";

            const gpoCod = r.gpo || r.grupo_oficial || r.grupo_redis;
            if (gpoCod) {
                const infoEscolar = normalizarDatosCBTis(gpoCod);
                especialidadFinal = infoEscolar.especialidad;
                gradoFinal = infoEscolar.grado || gradoFinal;
                grupoFinal = infoEscolar.grupo || grupoFinal;
                turnoFinal = infoEscolar.turno;
            } else {
                const excelEsp = String(r.especialidad || r.carrera || "").trim().toUpperCase();
                const configEsp = especialidadesCache.find(e => 
                    e.nombre.toUpperCase() === excelEsp || e.alias === excelEsp
                );

                if (configEsp) {
                    especialidadFinal = configEsp.nombre;
                    turnoFinal = configEsp.turno || "Matutino";
                } else if (excelEsp !== "") {
                    especialidadFinal = excelEsp;
                }
            }

            const rawTurnoExcel = String(r.turno || r.Turno || r.TURNO || "").trim();
            if (rawTurnoExcel) {
                const tLower = rawTurnoExcel.toLowerCase();
                if (tLower.startsWith('mat')) turnoFinal = "Matutino";
                else if (tLower.startsWith('ves')) turnoFinal = "Vespertino";
                else if (tLower.startsWith('mix')) turnoFinal = "Mixto";
                else turnoFinal = rawTurnoExcel;
            }

            const alumno = {
                ncontrol: matricula,
                matricula: matricula,
                curp: String(r.curp || "").toUpperCase(),
                nombre: nombre.toUpperCase(),
                apepat: apepat.toUpperCase(),
                apemat: apemat.toUpperCase(),
                genero: String(r.genero || r.sexo || "N/A").toUpperCase().substring(0,1), 
                email: String(r.email || r.correo_electronico || "").trim(),
                celular: String(r.celular || r.telefono_celular_alumno || r.numero_celular || "").trim(),
                direccion: String(r.direccion || "N/A"),
                
                especialidad: especialidadFinal,
                grado: gradoFinal,
                grupo: grupoFinal,
                turno: turnoFinal,
                
                estatus_escolar: "Activo",
                estatus: "Activo",
                color_semaforo: "Verde",
                
                nombretutor: String(r.tutor || r.nombre_tutor || r.nombre_del_tutor || r.nombre_tutor_ || "PENDIENTE").trim(),
                teltutor: teltutor,
                ocupaciontutor: String(r.ocupacion || r.ocupacion_del_tutor || "N/A").trim(),
                
                qr_texto: textoUnicoQR,
                fecharegistro: new Date().toISOString()
            };

            setMatriculas.add(matricula);
            loteActual.push(alumno);

            if (loteActual.length >= 50) {
                lotes.push(loteActual);
                loteActual = [];
            }
        }

        if (loteActual.length > 0) {
            lotes.push(loteActual);
        }

        // Procesar lotes asíncronamente cediendo el hilo de ejecución a la interfaz gráfica
        for (let idx = 0; idx < lotes.length; idx++) {
            const lote = lotes[idx];
            try {
                const res = await fetch('/api/alumnos/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(lote)
                });

                if (res.ok) {
                    exitosos += lote.length;
                } else {
                    fallos += lote.length;
                }
            } catch (errBatch) {
                fallos += lote.length;
            }

            const totalProcesados = exitosos + fallos + duplicados;
            const pct = Math.min(100, Math.round((totalProcesados / json.length) * 100));

            if (document.getElementById('barraProgreso')) document.getElementById('barraProgreso').style.width = pct + "%";
            if (document.getElementById('textoProgreso')) document.getElementById('textoProgreso').innerText = `Procesando batch ${idx + 1}/${lotes.length}... ${pct}%`;

            // Ceder control al event loop del navegador para repintar la UI
            await new Promise(resolve => setTimeout(resolve, 20));
        }

    } catch (e) {
        console.error("Error en importación masiva:", e);
    }

    Swal.fire({
        icon: 'success',
        title: 'Carga Masiva Completa',
        html: `<div class="text-start p-2 bg-light rounded border">
            <p class="mb-1 text-success"><strong>✅ Exitosos:</strong> ${exitosos}</p>
            <p class="mb-1 text-warning"><strong>⚠️ Duplicados omitidos:</strong> ${duplicados}</p>
            <p class="mb-0 text-danger"><strong>❌ Errores/Filas inválidas:</strong> ${fallos}</p>
        </div>`,
        confirmButtonColor: '#7b1b37'
    }).then(() => location.reload());
}

function descargarPlantillaManual() {
    const headers = [
        ["Matricula", "CURP", "Nombre", "ApePat", "ApeMat", "Genero", "Email", "Celular", "Direccion", "Especialidad", "Grado", "Grupo", "Tutor", "TelTutor", "Ocupacion"],
        ["25312051340001", "AANK100908MGRYXRA6", "KARIME ALEJANDRA", "AYALA", "NUÑEZ", "M", "karime.ayala@cbtis134.edu.mx", "7471234567", "Col. Centro Calle Galeana #12", "PROGRAMACIÓN", "4", "A", "KARIME NUÑEZ HIDALGO", "7479876543", "COMERCIANTE"],
        ["25312051340002", "GARM090315HGRZLR01", "CARLOS EDUARDO", "GARCÍA", "RIVERA", "H", "carlos.garcia@cbtis134.edu.mx", "7472345678", "Av. Insurgentes #45", "ADMINISTRACIÓN DE RECURSOS HUMANOS", "4", "B", "EDUARDO GARCÍA LÓPEZ", "7478765432", "EMPLEADO"],
        ["25312051340003", "HEML100122MGRNNS03", "LIZBETH GUADALUPE", "HERNÁNDEZ", "MORALES", "M", "lizbeth.hernandez@cbtis134.edu.mx", "7473456789", "Col. Viguri Andador 3", "CONTABILIDAD", "2", "A", "GUADALUPE MORALES RÍOS", "7477654321", "DOCENTE"],
        ["25312051340004", "MASE091105HGRRLA08", "EMILIANO", "MARTÍNEZ", "SÁNCHEZ", "H", "emiliano.martinez@cbtis134.edu.mx", "7474567890", "Calle 5 de Mayo #88", "CONSTRUCCIÓN", "6", "A", "ROSA SÁNCHEZ VEGA", "7476543210", "HOGAR"],
        ["25312051340005", "ROTA100618MGRDCN02", "ANA VALERIA", "RODRÍGUEZ", "TORRES", "M", "ana.rodriguez@cbtis134.edu.mx", "7475678901", "Barrio de San Mateo #14", "ELECTRICIDAD", "2", "B", "VALERIA TORRES CASTRO", "7475432109", "ABOGADA"],
        ["25312051340006", "TOFA090829HGRMNB05", "ALEXIS DANIEL", "TORRES", "FLORES", "H", "alexis.torres@cbtis134.edu.mx", "7476789012", "Col. del PRI Manzana 4", "OFIMÁTICA", "4", "C", "DANIEL TORRES MENDOZA", "7474321098", "INGENIERO"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [
        { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
        { wch: 8 }, { wch: 32 }, { wch: 14 }, { wch: 30 }, { wch: 32 },
        { wch: 8 }, { wch: 8 }, { wch: 26 }, { wch: 14 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manual_CBTis134");
    XLSX.writeFile(wb, "Plantilla_Manual_Alumnos.xlsx");
}

function descargarPlantillaInstitucional() {
    const headers = [
        ["GPO", "NO. CONTROL", "NOMBRE", "CURP", "GENERO", "TELEFONO CELULAR ALUMNO", "TELEFONO TUTOR", "NOMBRE TUTOR"],
        ["2A PRO", "25312051340001", "AYALA NUÑEZ KARIME ALEJANDRA", "AANK100908MGRYXRA6", "M", "7471234567", "7479876543", "KARIME NUÑEZ HIDALGO"],
        ["2B ARH", "25312051340002", "GARCÍA RIVERA CARLOS EDUARDO", "GARM090315HGRZLR01", "H", "7472345678", "7478765432", "EDUARDO GARCÍA LÓPEZ"],
        ["4A CON", "25312051340003", "HERNÁNDEZ MORALES LIZBETH GUADALUPE", "HEML100122MGRNNS03", "M", "7473456789", "7477654321", "GUADALUPE MORALES RÍOS"],
        ["6A CST", "25312051340004", "MARTÍNEZ SÁNCHEZ EMILIANO", "MASE091105HGRRLA08", "H", "7474567890", "7476543210", "ROSA SÁNCHEZ VEGA"],
        ["2B ELE", "25312051340005", "RODRÍGUEZ TORRES ANA VALERIA", "ROTA100618MGRDCN02", "M", "7475678901", "7475432109", "VALERIA TORRES CASTRO"],
        ["4C OFI", "25312051340006", "TORRES FLORES ALEXIS DANIEL", "TOFA090829HGRMNB05", "H", "7476789012", "7474321098", "DANIEL TORRES MENDOZA"]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [
        { wch: 12 }, { wch: 18 }, { wch: 38 }, { wch: 22 },
        { wch: 10 }, { wch: 28 }, { wch: 20 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Layout_REDIS_Oficial");
    XLSX.writeFile(wb, "Layout_REDIS_CBTis134.xlsx");
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

        alumnos.forEach(al => {
            const estatus = al.estatus_escolar || al.estatus || 'Activo';
            if (estatus === 'Activo' && al.especialidad) {
                if (!estructuraEscolar[al.especialidad]) {
                    estructuraEscolar[al.especialidad] = new Set();
                }
                if (al.grado && al.grupo) {
                    estructuraEscolar[al.especialidad].add(`${al.grado}${al.grupo}`);
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