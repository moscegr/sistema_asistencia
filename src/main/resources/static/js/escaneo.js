// static/js/escaneo.js (REST API Spring Boot Backend)

let html5QrcodeScanner = null;
let alumnosCache = [];
let personalCache = [];
let especialidadesConfig = [];
let pasesIndividualesHoy = [];
let gruposAutorizadosHoy = [];
let procesandoEscaneo = false;
let ultimoEscaneo = { matricula: "", tiempo: 0 };

const igualMatricula = (val1, val2) => {
    return String(val1 || '').trim().toUpperCase() === String(val2 || '').trim().toUpperCase();
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
    
    // Precalentamiento silencioso en segundo plano de la IA Facial (Enterprise Edge Warm-up)
    precargarMotorFacialSilencioso();

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
        const [resAlumnos, resPersonal, resConfig, resPases, resContingencia] = await Promise.all([
            fetch('/api/alumnos').then(r => r.ok ? r.json() : []),
            fetch('/api/usuarios').then(r => r.ok ? r.json() : []),
            fetch('/api/configuracion/escolar').then(r => r.ok ? r.json() : {}),
            fetch('/api/pases').then(r => r.ok ? r.json() : []),
            fetch('/api/configuracion/modo_contingencia').then(r => r.ok ? r.json() : {})
        ]);

        alumnosCache = resAlumnos;
        personalCache = resPersonal;
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

// Audio feedback sintetizado de alta velocidad (Web Audio API)
const audioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ? new (window.AudioContext || window.webkitAudioContext)() : null;

function reproducirBeepExito() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono agradable A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch(e) {}
}

function reproducirBeepError() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    } catch(e) {}
}

let html5QrCode = null;

async function inicializarLectorQR() {
    if (typeof Html5Qrcode === 'undefined') return;

    if (html5QrCode) {
        try {
            if (html5QrCode.isScanning) await html5QrCode.stop();
            html5QrCode.clear();
        } catch(e) {}
    }

    const readerEl = document.getElementById('reader');
    if (!readerEl) return;
    readerEl.innerHTML = "";

    // Motor QR optimizado con aceleración nativa por GPU (BarcodeDetector API)
    html5QrCode = new Html5Qrcode("reader", {
        formatsToSupport: [ 0 ], // 0 = QR_CODE únicamente (máxima velocidad de decodificación)
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // Decodificación nativa por hardware en Chrome/Android/iOS/Edge
        },
        verbose: false
    });

    const config = {
        fps: 30, // 30 cuadros por segundo para escaneo continuo
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.floor(minDim * 0.75));
            return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: false
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => onScanSuccess(decodedText, false),
            (errorMessage) => {}
        );
    } catch (err) {
        console.warn("Intentando cámaras disponibles para lector QR...", err);
        try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
                await html5QrCode.start(
                    cameras[0].id,
                    config,
                    (decodedText) => onScanSuccess(decodedText, false),
                    (errorMessage) => {}
                );
            }
        } catch (e2) {
            console.error("Error al iniciar cámara QR:", e2);
        }
    }
}

async function onScanSuccess(decodedText, parametroExtra = false) {
    if (procesandoEscaneo) return; 

    const esManual = (parametroExtra === true);
    const textoCrudo = String(decodedText || '').trim();
    if (!textoCrudo) return;

    const matricula = textoCrudo.includes('|') ? textoCrudo.split('|')[0].trim() : textoCrudo;
    const ahora = Date.now();

    // Cooldown inteligente: 1.8 segundos para el mismo alumno, pero 0 segundos si pasa otro alumno inmediatamente
    if (!esManual && ultimoEscaneo.matricula === matricula && (ahora - ultimoEscaneo.tiempo) < 1800) {
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

        let persona = null;
        if (!al) {
            persona = personalCache.find(p => 
                igualMatricula(p.rfc, matricula) || 
                igualMatricula(p.uid, matricula) ||
                igualMatricula(p.qrCode, matricula) ||
                igualMatricula(p.id, matricula) ||
                igualMatricula(p.correo, matricula) ||
                String(p.qrCode || '').trim().toUpperCase() === textoCrudo.toUpperCase()
            );
        }

        if (!al && !persona) {
            // Intentar consultar por endpoint si es nuevo o no estaba en cache
            try {
                const resPers = await fetch(`/api/usuarios/rfc/${encodeURIComponent(matricula)}`);
                if (resPers.ok) persona = await resPers.json();
            } catch(e) {}
            if (!persona) {
                try {
                    const resAl = await fetch(`/api/alumnos/ncontrol/${encodeURIComponent(matricula)}`);
                    if (resAl.ok) al = await resAl.json();
                } catch(e) {}
            }
        }

        // ==========================================
        // CASO 1: DOCENTE O PERSONAL ADMINISTRATIVO
        // ==========================================
        if (persona) {
            const estatusPers = String(persona.estatus || 'ACTIVO').toUpperCase();
            if (estatusPers === 'INACTIVO' || estatusPers === 'BAJA') {
                reproducirBeepError();
                Swal.fire({
                    icon: 'error',
                    title: 'Personal Inactivo',
                    text: `El docente/personal ${persona.nombre} se encuentra inactivo.`,
                    position: 'bottom-end', toast: true, width: '600px', timer: 3000, showConfirmButton: false
                });
                procesandoEscaneo = false;
                return;
            }

            const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const estaDentro = (String(persona.estado || '').toUpperCase() === 'DENTRO');

            const resRegs = await fetch(`/api/registros-diarios/fecha/${hoy}`);
            const registrosHoy = resRegs.ok ? await resRegs.json() : [];
            const rfcKey = persona.rfc || persona.uid || persona.id;
            const regExistente = registrosHoy.find(r => igualMatricula(r.matricula, rfcKey));

            if (!estaDentro) {
                // Registrar ENTRADA de Docente / Personal
                const nuevoReg = regExistente || {
                    matricula: rfcKey,
                    nombre: persona.nombre,
                    especialidad: persona.rol || 'DOCENTE',
                    grado: persona.turno || 'Matutino',
                    grupo: 'PERSONAL',
                    fecha: hoy
                };
                nuevoReg.hora_entrada = horaActual;
                nuevoReg.estatus_actual = "DENTRO";

                fetch('/api/registros-diarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nuevoReg)
                }).catch(e => console.error("Error guardando registro docente:", e));

                persona.estado = "DENTRO";
                fetch(`/api/usuarios/${encodeURIComponent(persona.id || persona.uid)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: "DENTRO" })
                }).catch(e => console.error("Error actualizando estado docente:", e));

                mostrarResultadoPersonal(persona, "ENTRADA");

            } else {
                // Registrar SALIDA de Docente / Personal
                const regSalida = regExistente || {
                    matricula: rfcKey,
                    nombre: persona.nombre,
                    especialidad: persona.rol || 'DOCENTE',
                    grado: persona.turno || 'Matutino',
                    grupo: 'PERSONAL',
                    fecha: hoy
                };
                regSalida.hora_salida = horaActual;
                regSalida.estatus_actual = "FUERA";
                regSalida.tipo_salida = "PERSONAL";

                fetch('/api/registros-diarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(regSalida)
                }).catch(e => console.error("Error guardando salida docente:", e));

                persona.estado = "FUERA";
                fetch(`/api/usuarios/${encodeURIComponent(persona.id || persona.uid)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ estado: "FUERA" })
                }).catch(e => console.error("Error actualizando estado docente:", e));

                mostrarResultadoPersonal(persona, "SALIDA");
            }

            setTimeout(() => {
                procesandoEscaneo = false;
            }, 800);
            return;
        }

        // ==========================================
        // CASO 2: ALUMNO
        // ==========================================
        if (!al) {
            reproducirBeepError();
            Swal.fire({
                icon: 'error', 
                title: 'Estudiante / Personal No Encontrado', 
                text: `No se encontró ningún registro con la matrícula o RFC: ${matricula}`,
                position: 'bottom-end', toast: true, width: '600px', timer: 3000, showConfirmButton: false
            });
            procesandoEscaneo = false; 
            return;
        }

        const estatusNormalizado = String(al.estatus || al.estatus_escolar || 'ACTIVO').toUpperCase();
        if (estatusNormalizado === 'INACTIVO' || estatusNormalizado === 'BAJA') {
            reproducirBeepError();
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

            // Guardar registro asíncronamente
            fetch('/api/registros-diarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoReg)
            }).catch(e => console.error("Error guardando registro:", e));

            al.estado = "DENTRO";
            fetch('/api/alumnos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(al)
            }).catch(e => console.error("Error actualizando estado alumno:", e));
            
            mostrarResultado(al, "ENTRADA");
            enviarNotificacionTutor(al, "ENTRADA");

        } else {
            await validarSalida(al, regExistente, salidaGeneralActiva, hoy);
        }

        // Actualizar interfaz en tiempo real sin recargas bloqueantes
        renderizarListaFiltrada(document.getElementById('filtroRapido')?.value || "");

    } catch (e) { 
        console.error("Error en onScanSuccess:", e); 
    } finally {
        setTimeout(() => {
            procesandoEscaneo = false;
        }, 800);
    }
}

async function validarSalida(al, regExistente, salidaGeneralActiva, hoy) {
    const mat = String(al.ncontrol || al.matricula || '').trim();
    const gpoKey = `${al.grado}${al.grupo}-${al.especialidad}`;
    const tienePase = pasesIndividualesHoy.includes(mat) || gruposAutorizadosHoy.includes(gpoKey);

    if (tienePase || salidaGeneralActiva) {
        const horaSalida = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let motivo = "AUTORIZADO";
        if (salidaGeneralActiva) motivo = "CONTINGENCIA";
        else if (pasesIndividualesHoy.includes(mat)) motivo = "PASE_INDIVIDUAL";
        else if (gruposAutorizadosHoy.includes(gpoKey)) motivo = "PASE_GRUPAL";

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

        fetch('/api/registros-diarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regSalida)
        }).catch(e => console.error("Error guardando salida:", e));

        al.estado = "FUERA";
        fetch('/api/alumnos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(al)
        }).catch(e => console.error("Error actualizando estado alumno:", e));

        mostrarResultado(al, "SALIDA");
        enviarNotificacionTutor(al, "SALIDA");

    } else {
        reproducirBeepError();
        
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

function mostrarResultadoPersonal(persona, accion) {
    reproducirBeepExito();
    const colorBanda = accion === "ENTRADA" ? "#198754" : "#dc3545";
    const rol = (persona.rol || "DOCENTE").toUpperCase();
    const titulo = `${rol} - ${accion === "ENTRADA" ? "ENTRADA REGISTRADA" : "SALIDA REGISTRADA"}`;
    const foto = persona.fotoUrl || '/img/logo_aniversario.jpg';
    const rfc = persona.rfc || persona.uid || 'N/A';
    const turno = persona.turno || 'Matutino';

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
                    <h4 class="fw-bold mb-1" style="color: #212529;">${persona.nombre}</h4>
                    <p class="mb-0 text-muted" style="font-size: 1.1rem;">
                        <strong>RFC:</strong> <span class="font-monospace fw-bold text-dark">${rfc}</span> <br>
                        <strong>Rol:</strong> <span class="badge ${rol === 'DOCENTE' ? 'bg-purple' : 'bg-primary'} text-white" style="${rol === 'DOCENTE' ? 'background-color:#6f42c1 !important;' : ''}">${rol}</span> | <strong>Turno:</strong> ${turno}
                    </p>
                </div>
            </div>
        `
    });
}

function mostrarResultado(al, accion) {
    reproducirBeepExito();

    // Verde para ENTRADA (#198754), Rojo para SALIDA (#dc3545)
    const colorBanda = accion === "ENTRADA" ? "#198754" : "#dc3545";
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

        const mensajeFinal = plantillaBase
            .replace(/\{nombre\}/g, nombreCompleto)
            .replace(/\{matricula\}/g, mat)
            .replace(/\{hora\}/g, hora)
            .replace(/\{fecha\}/g, fecha)
            .replace(/\{carrera\}/g, al.especialidad || 'N/A')
            .replace(/\{grado\}/g, al.grado || '')
            .replace(/\{grupo\}/g, al.grupo || '');

        const payload = {
            telefono: tel,
            mensaje: mensajeFinal
        };

        fetch('/api/whatsapp/enviar-mensaje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(errWs => console.warn("Error enviando WhatsApp:", errWs));

    } catch (e) {
        console.error("Error en enviarNotificacionTutor:", e);
    }
}

function generarTableroDinamico() {
    const contenedor = document.getElementById('tableroEspecialidades');
    if (!contenedor) return;

    contenedor.innerHTML = "";

    especialidadesConfig.forEach(esp => {
        const color = esp.color || "#6c757d";
        const alumnosDeEstaEsp = alumnosCache.filter(a => a.especialidad === esp.nombre);
        const gruposUnicos = [...new Set(alumnosDeEstaEsp.map(a => `${a.grado}${a.grupo}`))].sort();

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
    const filtradosAlumnos = alumnosCache.filter(a => {
        const nom = normalizarTexto(`${a.nombre} ${a.apepat || a.primerApellido || ''} ${a.apemat || a.segundoApellido || ''}`);
        const mat = normalizarTexto(a.ncontrol || a.matricula);
        return nom.includes(f) || mat.includes(f);
    });

    filtradosAlumnos.slice(0, 50).forEach(al => {
        const tr = document.createElement('tr');
        tr.className = "table-active-hover";
        const pat = al.apepat || al.primerApellido || '';
        const estadoLabel = al.estado === "DENTRO" ? '<span class="badge bg-success">DENTRO</span>' : '<span class="badge bg-danger">FUERA</span>';

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

// -------------------------------------------------------------
// ARQUITECTURA BIOMÉTRICA EMPRESARIAL (EDGE-BIOMETRICS)
// -------------------------------------------------------------
const DB_NAME = 'cbtis134_biometrics_db';
const DB_VERSION = 1;
const STORE_DESCRIPTORES = 'face_descriptors';

let motorFacialListo = false;
let streamReconocimiento = null;
let escaneoFacialActivo = false;
let faceMatcher = null;
let modoEscaneoFacial = 'AMBOS';
const descriptoresCargados = new Map();

function abrirDBBiometria() {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_DESCRIPTORES)) {
                db.createObjectStore(STORE_DESCRIPTORES, { keyPath: 'matricula' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function obtenerDescriptorLocal(matricula) {
    try {
        const db = await abrirDBBiometria();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_DESCRIPTORES, 'readonly');
            const store = tx.objectStore(STORE_DESCRIPTORES);
            const req = store.get(matricula);
            req.onsuccess = () => resolve(req.result ? req.result.descriptor : null);
            req.onerror = () => resolve(null);
        });
    } catch(e) { return null; }
}

async function guardarDescriptorLocal(matricula, descriptor) {
    try {
        const db = await abrirDBBiometria();
        if (!db) return;
        const tx = db.transaction(STORE_DESCRIPTORES, 'readwrite');
        const store = tx.objectStore(STORE_DESCRIPTORES);
        store.put({ matricula, descriptor, actualizado: Date.now() });
    } catch(e) {}
}

async function precargarMotorFacialSilencioso() {
    if (typeof faceapi === 'undefined') return;
    try {
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
            const rutaModelos = window.location.origin + '/models';
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(rutaModelos),
                faceapi.nets.faceLandmark68Net.loadFromUri(rutaModelos),
                faceapi.nets.faceRecognitionNet.loadFromUri(rutaModelos)
            ]);
        }

        // 2. Extraer descriptores matemáticos (vector de 128 floats) de Alumnos y de Personal
        const todoElPersonalYAlumnos = [...alumnosCache, ...personalCache];

        for (const item of todoElPersonalYAlumnos) {
            const idKey = String(item.ncontrol || item.matricula || item.rfc || item.uid || item.id || '').trim();
            if (!idKey) continue;

            let desc = item.descriptor_facial || item.descriptorFacial;
            if (!desc || desc.length !== 128) {
                desc = await obtenerDescriptorLocal(idKey);
                if (desc && desc.length === 128) {
                    item.descriptor_facial = desc;
                }
            }

            if (desc && desc.length === 128) {
                descriptoresCargados.set(idKey, desc);
            }
        }

        actualizarFaceMatcher();
        motorFacialListo = true;

        setTimeout(procesarFotosFaltantesSegundoPlano, 1500);

    } catch (e) {
        console.warn("[FaceID Enterprise] Precalentamiento de IA omitido:", e);
    }
}

function actualizarFaceMatcher() {
    const descriptoresEtiquetados = [];
    const todoElPersonalYAlumnos = [...alumnosCache, ...personalCache];

    for (const [idKey, desc] of descriptoresCargados.entries()) {
        const item = todoElPersonalYAlumnos.find(a => 
            igualMatricula(a.ncontrol || a.matricula, idKey) ||
            igualMatricula(a.rfc, idKey) ||
            igualMatricula(a.uid, idKey) ||
            igualMatricula(a.id, idKey)
        );
        if (!item) continue;

        if (modoEscaneoFacial === 'ENTRADA' && String(item.estado).toUpperCase() === 'DENTRO') continue;
        if (modoEscaneoFacial === 'SALIDA' && String(item.estado).toUpperCase() !== 'DENTRO') continue;

        descriptoresEtiquetados.push(
            new faceapi.LabeledFaceDescriptors(idKey, [new Float32Array(desc)])
        );
    }

    if (descriptoresEtiquetados.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(descriptoresEtiquetados, 0.58);
    } else {
        faceMatcher = null;
    }
}

async function procesarFotosFaltantesSegundoPlano() {
    if (typeof faceapi === 'undefined' || !faceapi.nets.ssdMobilenetv1.isLoaded) return;

    // Alumnos pendientes
    const alumnosPendientes = alumnosCache.filter(al => {
        const mat = String(al.ncontrol || al.matricula || '').trim();
        return mat && !descriptoresCargados.has(mat) && (al.fotoUrl || al.foto_url || al.foto);
    });

    for (const al of alumnosPendientes) {
        const mat = String(al.ncontrol || al.matricula || '').trim();
        try {
            const src = al.fotoUrl || al.foto_url || al.foto;
            const img = await faceapi.fetchImage(src);
            const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (deteccion) {
                const desc = Array.from(deteccion.descriptor);
                al.descriptor_facial = desc;
                descriptoresCargados.set(mat, desc);
                await guardarDescriptorLocal(mat, desc);

                fetch(`/api/alumnos/${encodeURIComponent(mat)}/descriptor-facial`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(desc)
                }).catch(() => {});

                actualizarFaceMatcher();
            }
        } catch(e) {}
        await new Promise(r => setTimeout(r, 40));
    }

    // Personal / Docentes pendientes
    const personalPendiente = personalCache.filter(p => {
        const idKey = String(p.rfc || p.uid || p.id || '').trim();
        return idKey && !descriptoresCargados.has(idKey) && p.fotoUrl;
    });

    for (const pers of personalPendiente) {
        const idKey = String(pers.rfc || pers.uid || pers.id || '').trim();
        try {
            const img = await faceapi.fetchImage(pers.fotoUrl);
            const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (deteccion) {
                const desc = Array.from(deteccion.descriptor);
                pers.descriptor_facial = desc;
                descriptoresCargados.set(idKey, desc);
                await guardarDescriptorLocal(idKey, desc);

                fetch(`/api/usuarios/${encodeURIComponent(pers.id || pers.uid)}/descriptor-facial`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(desc)
                }).catch(() => {});

                actualizarFaceMatcher();
            }
        } catch(e) {}
        await new Promise(r => setTimeout(r, 40));
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

            let etiquetaTexto = "DESCONOCIDO";
            let colorBox = '#dc3545'; // Rojo por defecto para desconocido / salida

            if (bestMatch.label !== 'unknown') {
                const alumnoEncontrado = alumnosCache.find(a => igualMatricula(a.ncontrol || a.matricula, bestMatch.label));
                const personalEncontrado = !alumnoEncontrado ? personalCache.find(p => igualMatricula(p.rfc || p.uid || p.id, bestMatch.label)) : null;

                if (alumnoEncontrado) {
                    const pat = alumnoEncontrado.apepat || alumnoEncontrado.primerApellido || '';
                    const accion = (alumnoEncontrado.estado === 'DENTRO') ? 'SALIDA' : 'ENTRADA';
                    colorBox = (accion === 'ENTRADA') ? '#198754' : '#dc3545';
                    etiquetaTexto = `${alumnoEncontrado.nombre} ${pat} (${accion})`.toUpperCase();
                } else if (personalEncontrado) {
                    const accion = (personalEncontrado.estado === 'DENTRO') ? 'SALIDA' : 'ENTRADA';
                    colorBox = (accion === 'ENTRADA') ? '#198754' : '#dc3545';
                    const rol = personalEncontrado.rol || 'DOCENTE';
                    etiquetaTexto = `${personalEncontrado.nombre} [${rol}] (${accion})`.toUpperCase();
                } else {
                    etiquetaTexto = bestMatch.label;
                }
            }

            ctx.strokeStyle = colorBox;
            ctx.lineWidth = 3;
            ctx.strokeRect(xEspejo, box.y, box.width, box.height);

            ctx.fillStyle = colorBox;
            ctx.font = 'bold 15px sans-serif';
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
        setTimeout(procesarFotogramasFaciales, 200);
    }
}