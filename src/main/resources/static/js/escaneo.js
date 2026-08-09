// static/js/escaneo.js (REST API Spring Boot Backend)

let html5QrcodeScanner = null;
let alumnosCache = [];
let especialidadesConfig = [];
let pasesIndividualesHoy = [];
let gruposAutorizadosHoy = [];
let procesandoEscaneo = false;
let ultimoEscaneo = { matricula: "", tiempo: 0 };

const igualMatricula = (val1, val2) => {
    return String(val1 || '').trim() === String(val2 || '').trim();
};

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

    // Ping Keep-Alive cada 4 minutos para mantener la sesión del vigilante siempre activa
    setInterval(async () => {
        try { await fetch('/api/usuarios/me'); } catch (e) {}
    }, 240000);
});

async function cargarConfiguracionInicial() {
    try {
        const [resAlumnos, resConfig, resPases, resContingencia] = await Promise.all([
            fetch('/api/alumnos').then(r => r.ok ? r.json() : []),
            fetch('/api/configuracion/escolar').then(r => r.ok ? r.json() : {}),
            fetch('/api/pases').then(r => r.ok ? r.json() : []),
            fetch('/api/configuracion/modo_contingencia').then(r => r.ok ? r.json() : {})
        ]);

        alumnosCache = resAlumnos;
        especialidadesConfig = resConfig.especialidades || [];

        const modoContingenciaActivo = (resContingencia?.activo === true);
        const bannerCont = document.getElementById('bannerContingencia');
        if (bannerCont) {
            bannerCont.style.display = modoContingenciaActivo ? 'block' : 'none';
        }
        
        const hoy = obtenerFechaLocal();

        pasesIndividualesHoy = resPases
            .filter(p => p.fecha === hoy && (p.estatus_vigencia === true || p.estatus === 'AUTORIZADO') && (p.matricula || p.id_alumno))
            .map(p => String(p.matricula || p.id_alumno).trim());

        gruposAutorizadosHoy = resPases
            .filter(p => p.fecha === hoy && (p.estatus_vigencia === true || p.estatus === 'AUTORIZADO') && (p.grupo_especialidad || (p.grado && p.grupo && p.especialidad)))
            .map(p => p.grupo_especialidad || `${p.grado}${p.grupo}-${p.especialidad}`);

        generarTableroDinamico();
        renderizarListaFiltrada("");

    } catch (err) {
        console.error("Error al conectar con backend:", err);
    }
}

function inicializarLectorQR() {
    if (typeof Html5QrcodeScanner === 'undefined') return;

    const qrboxCalc = (viewfinderWidth, viewfinderHeight) => {
        const minDim = Math.min(viewfinderWidth, viewfinderHeight);
        const size = Math.max(160, Math.floor(minDim * 0.8));
        return { width: size, height: size };
    };

    const config = {
        fps: 30,
        qrbox: qrboxCalc,
        aspectRatio: 1.0
    };

    if (html5QrcodeScanner) {
        try { html5QrcodeScanner.clear(); } catch(e) {}
    }

    html5QrcodeScanner = new Html5QrcodeScanner("reader", config, /* verbose= */ false);
    html5QrcodeScanner.render((text) => onScanSuccess(text, false), (err) => {});
}

async function onScanSuccess(decodedText, parametroExtra = false) {
    if (procesandoEscaneo) return; 

    const esManual = (parametroExtra === true);
    const textoCrudo = String(decodedText || '').trim();
    if (!textoCrudo) return;

    const matricula = textoCrudo.includes('|') ? textoCrudo.split('|')[0].trim() : textoCrudo;
    const ahora = Date.now();

    if (!esManual && ultimoEscaneo.matricula === matricula && (ahora - ultimoEscaneo.tiempo) < 3000) {
        return;
    }

    procesandoEscaneo = true; 
    ultimoEscaneo = { matricula, tiempo: ahora };

    const hoy = obtenerFechaLocal();
    
    try {
        let al = alumnosCache.find(a => 
            igualMatricula(a.ncontrol, matricula) || 
            igualMatricula(a.matricula, matricula) ||
            String(a.qrCode || '').trim() === textoCrudo ||
            String(a.qr_texto || '').trim() === textoCrudo
        );

        if (!al) {
            const resAl = await fetch(`/api/alumnos/ncontrol/${encodeURIComponent(matricula)}`);
            if (resAl.ok) al = await resAl.json();
        }

        if (!al) {
            if (typeof sonidoError !== 'undefined') sonidoError.play();
            Swal.fire({
                icon: 'error', 
                title: 'Estudiante No Encontrado', 
                text: `No se encontró ningún estudiante con la matrícula: ${matricula}`,
                position: 'bottom-end', toast: true, width: '600px', timer: 3000, showConfirmButton: false
            });
            procesandoEscaneo = false; 
            return;
        }

        const estatusNormalizado = String(al.estatus || al.estatus_escolar || 'ACTIVO').toUpperCase();
        if (estatusNormalizado === 'INACTIVO' || estatusNormalizado === 'BAJA') {
            if (typeof sonidoError !== 'undefined') sonidoError.play();
            Swal.fire({
                icon: 'error', 
                title: 'Estudiante Inactivo', 
                text: `El alumno ${al.nombre} se encuentra inactivo.`,
                position: 'bottom-end', toast: true, width: '600px', timer: 3000, showConfirmButton: false
            });
            procesandoEscaneo = false; 
            return;
        }

        const resRegs = await fetch(`/api/registros-diarios/fecha/${hoy}`);
        const registrosHoy = resRegs.ok ? await resRegs.json() : [];
        const regExistente = registrosHoy.find(r => 
            igualMatricula(r.matricula, matricula) || igualMatricula(r.ncontrol, matricula)
        );

        const resContingencia = await fetch('/api/configuracion/modo_contingencia');
        const dataContingencia = resContingencia.ok ? await resContingencia.json() : {};
        const salidaGeneralActiva = (dataContingencia?.activo === true);

        const estaFuera = (!al.estado || String(al.estado).toUpperCase() === "FUERA" || !regExistente || !regExistente.estatus_actual || String(regExistente.estatus_actual).toUpperCase() === "FUERA");

        if (estaFuera) {
            const horaEntrada = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const pat = al.apepat || al.primerApellido || '';
            const matApe = al.apemat || al.segundoApellido || '';
            const nombreCompleto = `${al.nombre || ''} ${pat} ${matApe}`.trim();

            const nuevoReg = regExistente || {
                matricula: matricula,
                nombre: nombreCompleto,
                especialidad: al.especialidad,
                grado: String(al.grado || ''),
                grupo: al.grupo,
                fecha: hoy
            };

            nuevoReg.hora_entrada = horaEntrada;
            nuevoReg.estatus_actual = "DENTRO";

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

        } else {
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
    const mat = String(al.ncontrol || al.matricula || '').trim();
    const gpoKey = `${al.grado}${al.grupo}-${al.especialidad}`;
    const tienePase = pasesIndividualesHoy.some(p => igualMatricula(p, mat)) || gruposAutorizadosHoy.includes(gpoKey);

    if (tienePase || salidaGeneralActiva) {
        let motivo = tienePase ? "PASE AUTORIZADO" : "MODO CONTINGENCIA (SALIDA LIBRE)";
        let colorBanda = tienePase ? "#198754" : "#dc3545";

        const horaSalida = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreCompleto = `${al.nombre || ''} ${pat} ${matApe}`.trim();

        const regSalida = regExistente || {
            matricula: mat,
            nombre: nombreCompleto,
            especialidad: al.especialidad,
            grado: String(al.grado || ''),
            grupo: al.grupo,
            fecha: hoy
        };

        regSalida.hora_salida = horaSalida;
        regSalida.estatus_actual = "FUERA";
        regSalida.tipo_salida = motivo;

        await fetch('/api/registros-diarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regSalida)
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
            timer: 4000,
            showConfirmButton: false
        });
    }
}

function mostrarResultado(al, accion) {
    if (typeof sonidoExito !== 'undefined') sonidoExito.play();

    const colorBanda = accion === "ENTRADA" ? "#198754" : "#0d6efd";
    const titulo = accion === "ENTRADA" ? "ENTRADA REGISTRADA" : "SALIDA REGISTRADA";
    const pat = al.apepat || al.primerApellido || '';
    const matApe = al.apemat || al.segundoApellido || '';
    const foto = al.fotoUrl || al.foto_url || al.foto || '/img/logo_aniversario.jpg';

    Swal.fire({
        position: 'bottom-end',
        toast: true,
        width: '600px',
        timer: 3500,
        showConfirmButton: false,
        background: '#ffffff',
        html: `
            <div id="bandaEstatus" style="background-color: ${colorBanda}; color: white; padding: 10px; font-weight: bold; font-size: 1.4rem; border-radius: 8px 8px 0 0; text-align: center;">
                ${titulo}
            </div>
            <div class="d-flex align-items-center p-3">
                <img src="${foto}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 3px solid ${colorBanda};">
                <div class="ms-3 text-start">
                    <h4 class="fw-bold mb-1" style="color: #212529;">${al.nombre} ${pat} ${matApe}</h4>
                    <p class="mb-0 text-muted" style="font-size: 1.1rem;">
                        <strong>Matrícula:</strong> ${al.ncontrol || al.matricula} <br>
                        <strong>Carrera:</strong> ${al.especialidad} (${al.grado}° "${al.grupo}")
                    </p>
                </div>
            </div>
        `
    });
}

async function enviarNotificacionTutor(al, tipoAcceso) {
    try {
        const resSys = await fetch('/api/configuracion/sistema');
        if (resSys.ok) {
            const dataSys = await resSys.json();
            if (dataSys.notificaciones_whatsapp_activas === false) {
                console.log("Notificaciones de WhatsApp desactivadas globalmente desde configuración. Evento guardado en MongoDB.");
                return;
            }
        }

        const tel = al.teltutor || (al.tutor && al.tutor.telefono) || al.celular;
        if (!tel) return;

        const resWs = await fetch('/api/configuracion/whatsapp');
        if (!resWs.ok) return;
        const configWs = await resWs.json();
        if (!configWs || !configWs.tipo_api) return;

        const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const fecha = new Date().toLocaleDateString('es-MX');
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const nombreCompleto = `${al.nombre} ${pat} ${matApe}`.trim();
        const mat = al.ncontrol || al.matricula || '';

        let plantillaBase = (tipoAcceso === 'ENTRADA')
            ? (configWs.plantilla_entrada || '🏫 [CBTis 134] Notificación:\nEl estudiante {nombre} ha registrado su ENTRADA al plantel a las {hora}.')
            : (configWs.plantilla_salida || '🏫 [CBTis 134] Notificación:\nEl estudiante {nombre} ha registrado su SALIDA del plantel a las {hora}.');

        let mensaje = plantillaBase
            .replace(/{nombre}/g, nombreCompleto)
            .replace(/{matricula}/g, mat)
            .replace(/{grado}/g, al.grado || '')
            .replace(/{grupo}/g, al.grupo || '')
            .replace(/{carrera}/g, al.especialidad || '')
            .replace(/{hora}/g, hora)
            .replace(/{fecha}/g, fecha);

        const tipoEndpoint = (configWs.tipo_api || 'EVOLUTION').toLowerCase();

        const resp = await fetch(`/api/whatsapp/${tipoEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiUrl: configWs.apiUrl || configWs.serverUrl,
                apiKey: configWs.apiKey || configWs.token,
                token: configWs.token || configWs.apiKey,
                instanceName: configWs.instanceName || configWs.sessionName || 'cbtis134',
                to: tel,
                body: mensaje
            })
        });

        if (resp.ok) {
            const resData = await resp.json();
            console.log(`[Punto de Control] Notificación WhatsApp enviada con éxito al tutor (${tel}):`, resData);
        } else {
            const errBody = await resp.text();
            console.error(`[Punto de Control] ERROR al enviar WhatsApp (${resp.status}):`, errBody);
        }
    } catch(e) {
        console.warn("No se pudo enviar la notificación de WhatsApp:", e);
    }
}

function generarTableroDinamico() {
    const contenedor = document.getElementById('tableroEspecialidades');
    if (!contenedor) return;

    contenedor.innerHTML = "";

    const paletaColores = ['#7b1b37', '#0d6efd', '#198754', '#ffc107', '#0dcaf0', '#6f42c1', '#fd7e14'];

    especialidadesConfig.forEach((esp, index) => {
        const color = paletaColores[index % paletaColores.length];
        
        const alumnosEsp = alumnosCache.filter(a => a.especialidad === esp.nombre);
        const gruposUnicos = [...new Set(alumnosEsp.map(a => `${a.grado}${a.grupo}`))].sort();

        let badgesHTML = "";
        gruposUnicos.forEach(gpo => {
            const gpoKey = `${gpo}-${esp.nombre}`;
            const estaAutorizado = gruposAutorizadosHoy.includes(gpoKey);
            const badgeClass = estaAutorizado ? 'bg-success text-white' : 'bg-light text-dark border';
            
            badgesHTML += `<span class="badge ${badgeClass} me-1 mb-1 p-2">${gpo}</span>`;
        });

        const card = document.createElement('div');
        card.className = "col-md-6 col-lg-4";
        card.innerHTML = `
            <div class="card border-0 shadow-sm especialidad-card h-100" style="border-top-color: ${color} !important; border-radius: 12px;">
                <div class="card-body">
                    <h6 class="fw-bold mb-2" style="color: ${color};">${esp.nombre}</h6>
                    <div class="d-flex flex-wrap gap-1">
                        ${badgesHTML || '<span class="text-muted small">Sin grupos</span>'}
                    </div>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

function renderizarListaFiltrada(filtro) {
    const tbody = document.getElementById('tablaSimpleAlumnos');
    if (!tbody) return;

    tbody.innerHTML = "";

    const f = normalizarTexto(filtro);
    const filtrados = alumnosCache.filter(a => {
        const nom = normalizarTexto(`${a.nombre} ${a.apepat || a.primerApellido || ''} ${a.apemat || a.segundoApellido || ''}`);
        const mat = normalizarTexto(a.ncontrol || a.matricula);
        return nom.includes(f) || mat.includes(f);
    });

    filtrados.slice(0, 50).forEach(al => {
        const tr = document.createElement('tr');
        tr.className = "table-active-hover";
        const pat = al.apepat || al.primerApellido || '';
        const estadoLabel = al.estado === "DENTRO" ? '<span class="badge bg-success">DENTRO</span>' : '<span class="badge bg-secondary">FUERA</span>';

        tr.innerHTML = `
            <td>
                <div class="fw-bold">${al.nombre} ${pat}</div>
                <div class="x-small text-muted">${al.ncontrol || al.matricula}</div>
            </td>
            <td class="text-end align-middle">
                ${estadoLabel}
            </td>
        `;

        tr.onclick = () => {
            onScanSuccess(al.ncontrol || al.matricula, true);
        };

        tbody.appendChild(tr);
    });
}

// ── RECONOCIMIENTO FACIAL ──
let faceMatcher = null;
let escaneoFacialActivo = false;
let streamReconocimiento = null;
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
        if (typeof faceapi === 'undefined') return;

        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
            const rutaModelos = window.location.origin + '/models';
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(rutaModelos),
                faceapi.nets.faceLandmark68Net.loadFromUri(rutaModelos),
                faceapi.nets.faceRecognitionNet.loadFromUri(rutaModelos)
            ]);
        }

        const descriptoresEtiquetados = [];

        for (const al of alumnosCache) {
            const mat = String(al.ncontrol || al.matricula || '').trim();
            if (!mat) continue;

            if (modoEscaneoFacial === 'ENTRADA' && String(al.estado).toUpperCase() === 'DENTRO') continue;
            if (modoEscaneoFacial === 'SALIDA' && String(al.estado).toUpperCase() !== 'DENTRO') continue;

            let desc = al.descriptor_facial || al.descriptorFacial;

            // Extracción dinámica en segundo plano si la foto existe pero el descriptor no fue guardado previamente
            if ((!desc || desc.length !== 128) && (al.fotoUrl || al.foto_url || al.foto)) {
                try {
                    const src = al.fotoUrl || al.foto_url || al.foto;
                    const img = await faceapi.fetchImage(src);
                    const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                    if (deteccion) {
                        desc = Array.from(deteccion.descriptor);
                        al.descriptor_facial = desc;
                    }
                } catch(e) {
                    console.warn("No se pudo procesar la foto guardada de:", mat);
                }
            }

            if (desc && desc.length === 128) {
                const floatArray = new Float32Array(desc);
                descriptoresEtiquetados.push(
                    new faceapi.LabeledFaceDescriptors(mat, [floatArray])
                );
            }
        }

        if (descriptoresEtiquetados.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(descriptoresEtiquetados, 0.58);
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
                width: { ideal: 640 },
                height: { ideal: 480 }
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
            
            const xEspejo = displaySize.width - box.x - box.width;

            ctx.strokeStyle = (bestMatch.label !== 'unknown') ? '#198754' : '#dc3545';
            ctx.lineWidth = 3;
            ctx.strokeRect(xEspejo, box.y, box.width, box.height);

            let etiquetaTexto = "DESCONOCIDO";
            if (bestMatch.label !== 'unknown') {
                const alumnoEncontrado = alumnosCache.find(a => igualMatricula(a.ncontrol || a.matricula, bestMatch.label));
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