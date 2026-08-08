// static/js/escaneo.js (REST API Spring Boot Backend)

let html5QrcodeScanner = null;
let alumnosCache = [];
let especialidadesConfig = [];
let pasesIndividualesHoy = [];
let gruposAutorizadosHoy = [];
let procesandoEscaneo = false;
let ultimoEscaneo = { matricula: "", tiempo: 0 };

const normalizarTexto = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
};

function obtenerFechaLocal() {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionInicial();
    inicializarLectorQR();
    
    const filtroInput = document.getElementById('filtroRapido');
    if (filtroInput) {
        filtroInput.addEventListener('input', (e) => {
            renderizarListaFiltrada(e.target.value);
        });
    }
});

async function cargarConfiguracionInicial() {
    try {
        const [resAlumnos, resConfig, resPases] = await Promise.all([
            fetch('/api/alumnos').then(r => r.ok ? r.json() : []),
            fetch('/api/configuracion/escolar').then(r => r.ok ? r.json() : {}),
            fetch('/api/pases').then(r => r.ok ? r.json() : [])
        ]);

        alumnosCache = resAlumnos;
        especialidadesConfig = resConfig.especialidades || [];
        
        const hoy = obtenerFechaLocal();

        pasesIndividualesHoy = resPases
            .filter(p => p.fecha === hoy && p.estatus === 'AUTORIZADO' && p.matricula)
            .map(p => p.matricula);

        gruposAutorizadosHoy = resPases
            .filter(p => p.fecha === hoy && p.estatus === 'AUTORIZADO' && p.grupo_especialidad)
            .map(p => p.grupo_especialidad);

        generarTableroDinamico();
        renderizarListaFiltrada("");

    } catch (err) {
        console.error("Error al conectar con backend:", err);
    }
}

function inicializarLectorQR() {
    if (typeof Html5QrcodeScanner === 'undefined') return;

    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", 
        { fps: 15, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
    );

    html5QrcodeScanner.render((text) => onScanSuccess(text, false), (err) => {});
}

async function onScanSuccess(decodedText, parametroExtra = false) {
    if (procesandoEscaneo) return; 

    const esManual = (parametroExtra === true);
    const textoCrudo = decodedText.trim();
    const matricula = textoCrudo.includes('|') ? textoCrudo.split('|')[0] : textoCrudo;
    const ahora = Date.now();

    if (!esManual && ultimoEscaneo.matricula === matricula && (ahora - ultimoEscaneo.tiempo) < 5000) {
        return;
    }

    procesandoEscaneo = true; 
    ultimoEscaneo = { matricula, tiempo: ahora };

    const hoy = obtenerFechaLocal();
    
    try {
        let al = alumnosCache.find(a => (a.ncontrol || a.matricula) === matricula);

        if (!al) {
            const resAl = await fetch(`/api/alumnos/ncontrol/${matricula}`);
            if (resAl.ok) al = await resAl.json();
        }

        if (!al || (al.estatus_escolar && al.estatus_escolar !== "Activo" && al.estatus !== "Activo")) {
            if (typeof sonidoError !== 'undefined') sonidoError.play();
            Swal.fire({
                icon: 'error', title: 'Error de Validación', text: 'Estudiante no encontrado o inactivo',
                position: 'bottom-end', toast: true, width: '600px', timer: 4000, showConfirmButton: false
            });
            procesandoEscaneo = false; 
            return;
        }

        const resRegs = await fetch(`/api/registros-diarios/fecha/${hoy}`);
        const registrosHoy = resRegs.ok ? await resRegs.json() : [];
        const regExistente = registrosHoy.find(r => (r.matricula || r.ncontrol) === matricula);

        const configEscolarRes = await fetch('/api/configuracion/escolar');
        const configData = configEscolarRes.ok ? await configEscolarRes.json() : {};
        const salidaGeneralActiva = (configData?.salidaGeneralAutorizada === true) && 
                                    (configData?.fechaSalidaGeneral === hoy);

        if (!regExistente || regExistente.estatus_actual === "FUERA" || !regExistente.estatus_actual) {
            
            const horaEntrada = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const nuevoReg = {
                matricula: matricula,
                nombre: `${al.nombre} ${al.apepat || al.primerApellido || ''} ${al.apemat || al.segundoApellido || ''}`.trim(),
                especialidad: al.especialidad,
                grado: String(al.grado),
                grupo: al.grupo,
                fecha: hoy,
                hora_entrada: horaEntrada,
                estatus_actual: "DENTRO"
            };

            await fetch('/api/registros-diarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoReg)
            });

            al.estado = "DENTRO";
            await fetch('/api/alumnos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(al)
            });
            
            mostrarResultado(al, "ENTRADA");
            enviarNotificacionTutor(al, "ENTRADA");

        } else if (regExistente.estatus_actual === "DENTRO") {
            await validarSalida(al, regExistente, salidaGeneralActiva, hoy);
        }

        await cargarConfiguracionInicial();

    } catch (e) { 
        console.error("Error en onScanSuccess:", e); 
    } finally {
        setTimeout(() => {
            procesandoEscaneo = false;
        }, 1000);
    }
}

async function validarSalida(al, regExistente, salidaGeneralActiva, hoy) {
    const mat = al.ncontrol || al.matricula;
    const gpoKey = `${al.grado}${al.grupo}-${al.especialidad}`;
    const tienePase = pasesIndividualesHoy.includes(mat) || gruposAutorizadosHoy.includes(gpoKey);

    if (tienePase || salidaGeneralActiva) {
        let motivo = tienePase ? "PASE AUTORIZADO" : "SALIDA GENERAL";
        let colorBanda = tienePase ? "#198754" : "#0d6efd";

        const horaSalida = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        regExistente.hora_salida = horaSalida;
        regExistente.estatus_actual = "FUERA";
        regExistente.tipo_salida = motivo;

        await fetch('/api/registros-diarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regExistente)
        });

        al.estado = "FUERA";
        await fetch('/api/alumnos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(al)
        });

        mostrarResultado(al, "SALIDA");
        
        const banda = document.getElementById('bandaEstatus');
        if (banda) banda.style.backgroundColor = colorBanda;
        
        enviarNotificacionTutor(al, "SALIDA");

    } else {
        if (typeof sonidoError !== 'undefined') sonidoError.play();
        
        const banda = document.getElementById('bandaEstatus');
        if (banda) banda.style.backgroundColor = "#dc3545";

        Swal.fire({
            icon: 'error',
            title: '<span style="font-size: 1.6rem; font-weight: bold;">SALIDA DENEGADA</span>',
            html: '<span style="font-size: 1.2rem;">El alumno no cuenta con pases de salida vigentes.</span>',
            position: 'bottom-end',
            toast: true,
            width: '600px',
            padding: '2rem',
            timer: 4500,
            showConfirmButton: false 
        });
    }
}

async function enviarNotificacionTutor(al, tipoAcceso) {
    try {
        if (!al.teltutor) return;
        const payload = {
            telefono: al.teltutor,
            alumno: `${al.nombre} ${al.apepat || ''}`.trim(),
            tipo: tipoAcceso,
            fecha: new Date().toLocaleString('es-MX')
        };
        await fetch('/api/whatsapp/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    } catch (e) {
        // Soft catch
    }
}

function generarTableroDinamico() {
    const contenedor = document.getElementById('tableroEspecialidades');
    if (!contenedor) return;
    contenedor.innerHTML = "";

    especialidadesConfig.forEach(esp => {
        const gruposReales = [...new Set(alumnosCache
            .filter(al => al.especialidad === esp.nombre)
            .map(al => `${al.grado}${al.grupo}`)
        )].sort();

        if (gruposReales.length > 0) {
            contenedor.innerHTML += `
                <div class="col-md-4 mb-3">
                    <div class="card shadow-sm h-100 border-0" style="border-top: 5px solid ${esp.color}">
                        <div class="card-body p-3">
                            <h6 class="fw-bold mb-3" style="color: ${esp.color}">${esp.nombre}</h6>
                            <div class="d-flex flex-wrap gap-2">
                                ${gruposReales.map(g => {
                                    const isAuth = gruposAutorizadosHoy.includes(`${g}-${esp.nombre}`);
                                    const claseBadge = isAuth ? 'bg-success text-white' : 'bg-light text-muted border';
                                    const icono = isAuth ? '<i class="bi bi-check-lg ms-1"></i>' : '';

                                    return `
                                        <span class="badge ${claseBadge} p-2 shadow-sm" style="min-width: 45px; font-size: 0.85rem;">
                                            ${g}${icono}
                                        </span>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>`;
        }
    });
}

function renderizarListaFiltrada(busqueda) {
    const contenedor = document.getElementById('tablaSimpleAlumnos');
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const busquedaLimpia = normalizarTexto(busqueda);

    const filtrados = alumnosCache.filter(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreCompleto = normalizarTexto(`${al.nombre} ${pat} ${matApe}`);
        return nombreCompleto.includes(busquedaLimpia) || mat.includes(busquedaLimpia);
    });

    const limitados = filtrados.slice(0, 30);

    limitados.forEach(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const estaDentro = al.estado === "DENTRO";
        const dotColor = estaDentro ? "text-primary" : "text-muted";

        const tienePase = pasesIndividualesHoy.includes(mat) || 
                         gruposAutorizadosHoy.includes(`${al.grado}${al.grupo}-${al.especialidad}`);

        contenedor.innerHTML += `
            <tr class="table-active-hover ${tienePase ? 'table-success' : ''}" style="cursor: pointer;" onclick="consultarEstatus('${mat}')">
                <td class="ps-3 py-2">
                    <i class="bi bi-circle-fill ${dotColor} me-2" style="font-size: 0.5rem;"></i>
                    <span class="fw-bold small text-uppercase">${al.nombre} ${pat}</span>
                    <br><span class="x-small text-muted">${mat}</span>
                </td>
                <td class="text-end pe-3">
                    <span class="badge ${estaDentro ? 'bg-primary' : 'bg-light text-muted'} rounded-pill" style="font-size: 0.6rem;">
                        ${estaDentro ? 'PRESENTE' : 'FUERA'}
                    </span>
                </td>
            </tr>`;
    });

    if (filtrados.length > 30) {
        contenedor.innerHTML += `<tr><td colspan="2" class="text-center x-small text-muted py-2">Mostrando 30 de ${filtrados.length} coincidencias. Refine su búsqueda.</td></tr>`;
    }
}

async function consultarEstatus(matriculaDirecta = null) {
    let valorBusqueda = "";

    if (matriculaDirecta) {
        valorBusqueda = matriculaDirecta.toLowerCase();
    } else {
        const input = document.getElementById('busquedaManual');
        if (!input) return;
        valorBusqueda = normalizarTexto(input.value.trim());
        input.value = "";
    }

    if (valorBusqueda.length < 3) {
        return Swal.fire("Aviso", "Ingresa al menos 3 caracteres para buscar.", "info");
    }

    const resultado = alumnosCache.find(al => {
        const mat = (al.ncontrol || al.matricula || "").toLowerCase();
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreCompleto = normalizarTexto(`${al.nombre} ${pat} ${matApe}`);
        return mat === valorBusqueda || nombreCompleto.includes(valorBusqueda);
    });

    if (!resultado) {
        return Swal.fire("No encontrado", "No existe un alumno activo con ese dato.", "error");
    }

    const estaDentro = resultado.estado === "DENTRO";
    const colorEstado = estaDentro ? '#7b1b37' : '#6c757d';
    const textoEstado = estaDentro ? 'ACTUALMENTE EN EL PLANTEL' : 'FUERA DEL PLANTEL';
    const pat = resultado.apepat || resultado.primerApellido || '';
    const matApe = resultado.apemat || resultado.segundoApellido || '';

    Swal.fire({
        title: 'Consulta de Estatus',
        html: `
            <div class="text-start">
                <p class="mb-1"><b>Alumno:</b> ${resultado.nombre} ${pat} ${matApe}</p>
                <p class="mb-1"><b>Matrícula:</b> ${resultado.ncontrol || resultado.matricula}</p>
                <p class="mb-1"><b>Especialidad:</b> ${resultado.especialidad}</p>
                <p class="mb-3"><b>Grado y Grupo:</b> ${resultado.grado}° "${resultado.grupo}"</p>
                <div class="text-center p-2 rounded shadow-sm" style="background-color: ${colorEstado}; color: white; font-weight: bold; font-size: 1.1rem;">
                    <i class="bi ${estaDentro ? 'bi-building-check' : 'bi-building-dash'} me-2"></i>${textoEstado}
                </div>
            </div>
        `,
        icon: 'info',
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#7b1b37'
    });
}

function mostrarResultado(al, tipo) {
    if (tipo === 'ENTRADA' && typeof sonidoEntrada !== 'undefined') sonidoEntrada.play();
    if (tipo === 'SALIDA' && typeof sonidoSalidaAuth !== 'undefined') sonidoSalidaAuth.play();
    
    const colorNotificacion = (tipo === 'ENTRADA') ? '#0d6efd' : '#198754';
    const icono = (tipo === 'ENTRADA') ? 'success' : 'success';
    const pat = al.apepat || al.primerApellido || '';
    const matApe = al.apemat || al.segundoApellido || '';

    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 4500,
        width: '600px',
        padding: '2rem',
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    Toast.fire({
        icon: icono,
        title: `<span style="color: ${colorNotificacion}; font-weight: 900; font-size: 1.6rem;">${tipo} REGISTRADA</span>`,
        html: `
            <div class="d-flex align-items-center mt-2">
                <div class="ms-2 text-start">
                    <div class="fw-bold text-uppercase" style="font-size: 1.2rem; line-height: 1.2;">
                        ${al.nombre} ${pat} ${matApe}
                    </div>
                    <div class="text-muted mt-1" style="font-size: 1rem; letter-spacing: 0.5px;">
                        <i class="bi bi-mortarboard-fill"></i> ${al.especialidad || 'N/A'} <br>
                        <i class="bi bi-geo-alt-fill"></i> ${al.grado || ''}° "${al.grupo || ''}"
                    </div>
                </div>
            </div>
        `
    });
}

let faceMatcher = null;
let escaneoFacialActivo = false;
let streamReconocimiento = null;
let ultimoRostroDetectado = { matricula: "", tiempo: 0 };
let modoEscaneoFacial = 'AMBOS'; 

async function cambiarModoFacial(modo) {
    modoEscaneoFacial = modo;

    if (document.getElementById('btnModoAmbos')) document.getElementById('btnModoAmbos').className = (modo === 'AMBOS') ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-outline-secondary';
    if (document.getElementById('btnModoEntrada')) document.getElementById('btnModoEntrada').className = (modo === 'ENTRADA') ? 'btn btn-sm btn-success' : 'btn btn-sm btn-outline-success';
    if (document.getElementById('btnModoSalida')) document.getElementById('btnModoSalida').className = (modo === 'SALIDA') ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-primary';

    await inicializarMotorFacial();
}

async function inicializarMotorFacial() {
    try {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
            const rutaModelos = window.location.origin + '/models';
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(rutaModelos),
                faceapi.nets.faceLandmark68Net.loadFromUri(rutaModelos),
                faceapi.nets.faceRecognitionNet.loadFromUri(rutaModelos)
            ]);
        }

        const descriptoresEtiquetados = [];

        alumnosCache.forEach(al => {
            const mat = al.ncontrol || al.matricula;
            if (al.descriptor_facial && al.descriptor_facial.length === 128 && mat) {
                if (modoEscaneoFacial === 'ENTRADA' && al.estado === 'DENTRO') return;
                if (modoEscaneoFacial === 'SALIDA' && al.estado !== 'DENTRO') return;

                const floatArray = new Float32Array(al.descriptor_facial);
                descriptoresEtiquetados.push(
                    new faceapi.LabeledFaceDescriptors(mat, [floatArray])
                );
            }
        });

        if (descriptoresEtiquetados.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(descriptoresEtiquetados, 0.45);
        } else {
            faceMatcher = null;
        }

    } catch (error) {
        console.error("Error iniciando motor facial:", error);
    }
}

async function toggleReconocimientoFacial() {
    const video = document.getElementById('videoReconocimiento'); 
    const btn = document.getElementById('btnToggleFaceID');
    const contFacial = document.getElementById('contenedorFacial');
    const contQR = document.getElementById('contenedorQR');
    const controlesFiltro = document.getElementById('controlesModoFacial');
    const textoIns = document.getElementById('textoInstruccion');

    if (!video) return;

    if (escaneoFacialActivo) {
        escaneoFacialActivo = false;
        if (streamReconocimiento) streamReconocimiento.getTracks().forEach(track => track.stop());
        video.srcObject = null;

        if (contFacial) contFacial.style.display = 'none';
        if (controlesFiltro) controlesFiltro.style.display = 'none';
        if (contQR) contQR.style.display = 'block';
        if (btn) {
            btn.innerHTML = '<i class="bi bi-person-bounding-box me-2"></i>Activar Face ID';
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'var(--guinda)';
        }
        if (textoIns) textoIns.innerHTML = '<i class="bi bi-camera me-1"></i> Posicione el código frente a la cámara';

    } else {
        try {
            await cambiarModoFacial('AMBOS');

            streamReconocimiento = await navigator.mediaDevices.getUserMedia({ video: {
                width: { ideal: 640},
                height: { ideal: 480}
            } });
            video.srcObject = streamReconocimiento;
            escaneoFacialActivo = true;

            if (contQR) contQR.style.display = 'none';
            if (contFacial) contFacial.style.display = 'block';
            if (controlesFiltro) controlesFiltro.style.display = 'block';
            if (btn) {
                btn.innerHTML = '<i class="bi bi-qr-code-scan me-2"></i>Volver a QR';
                btn.style.backgroundColor = 'var(--guinda)';
                btn.style.color = 'white';
            }
            if (textoIns) textoIns.innerHTML = '<i class="bi bi-person-video me-1"></i> Mire a la cámara para registrar acceso';

            video.addEventListener('play', procesarFotogramasFaciales);
            
        } catch (e) {
            Swal.fire("Error", "No se pudo acceder a la cámara. Revisa los permisos del navegador.", "error");
        }
    }
}

async function procesarFotogramasFaciales() {
    const video = document.getElementById('videoReconocimiento');
    const canvas = document.getElementById('canvasOverlayFacial');
    
    if (!video || video.paused || video.ended || !escaneoFacialActivo) return;

    try {
        const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        if (canvas.width !== displaySize.width) {
            canvas.width = displaySize.width;
            canvas.height = displaySize.height;
        }

        const opcionesDeteccion = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        const deteccion = await faceapi.detectSingleFace(video, opcionesDeteccion)
                                       .withFaceLandmarks()
                                       .withFaceDescriptor();
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (deteccion && faceMatcher) {
            const resizedDeteccion = faceapi.resizeResults(deteccion, displaySize);
            const bestMatch = faceMatcher.findBestMatch(resizedDeteccion.descriptor);
            
            const box = resizedDeteccion.detection.box;
            
            // Invertir coordenada X para alinear con el video en modo espejo
            const xEspejo = displaySize.width - box.x - box.width;

            ctx.strokeStyle = (bestMatch.label !== 'unknown') ? '#198754' : '#dc3545';
            ctx.lineWidth = 3;
            ctx.strokeRect(xEspejo, box.y, box.width, box.height);

            let etiquetaTexto = "DESCONOCIDO";
            if (bestMatch.label !== 'unknown') {
                const alumnoEncontrado = alumnosCache.find(a => (a.ncontrol || a.matricula) === bestMatch.label);
                if (alumnoEncontrado) {
                    const pat = alumnoEncontrado.apepat || alumnoEncontrado.primerApellido || '';
                    etiquetaTexto = `${alumnoEncontrado.nombre} ${pat}`.toUpperCase();
                } else {
                    etiquetaTexto = bestMatch.label;
                }
            }

            ctx.fillStyle = (bestMatch.label !== 'unknown') ? '#198754' : '#dc3545';
            ctx.font = 'bold 16px sans-serif';
            const textWidth = ctx.measureText(etiquetaTexto).width;
            ctx.fillRect(xEspejo, Math.max(0, box.y - 25), textWidth + 10, 25);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(etiquetaTexto, xEspejo + 5, Math.max(18, box.y - 7));

            if (bestMatch.label !== 'unknown') {
                onScanSuccess(bestMatch.label, false);
            }
        }
    } catch (e) {
        console.error("Error procesando rostros:", e);
    }

    if (escaneoFacialActivo) {
        setTimeout(procesarFotogramasFaciales, 250);
    }
}