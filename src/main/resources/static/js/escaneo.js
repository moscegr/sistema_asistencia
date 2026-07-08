// 1. CONFIGURACIÓN Y VARIABLES
let alumnosCache = [];
let scanner;
let gruposAutorizadosHoy = [];
let pasesIndividualesHoy = [];
let especialidadesConfig = []; 
let html5QrcodeScanner = null;

let ultimoEscaneo = { matricula: "", tiempo: 0 };
let procesandoEscaneo = false;

const obtenerFechaLocal = () => new Date().toLocaleDateString('en-CA');

const normalizarTexto = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// SONIDOS DEL PUNTO DE CONTROL
const sonidoEntrada = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
const sonidoSalidaAuth = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
const sonidoError = new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3');

document.addEventListener('DOMContentLoaded', async () => {
    inicializarReloj();
    await cargarConfiguracionEscaneo(); 
    cargarListaAlumnosActivos(); 
    escucharPasesDelDia();
	limpiarFantasmasNocturnos();
    
    const readerDiv = document.getElementById("reader");
    if (readerDiv) {
        html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
        html5QrcodeScanner.render(onScanSuccess);
    }

    const inputFiltro = document.getElementById('filtroRapido');
    if (inputFiltro) {
        inputFiltro.addEventListener('input', (e) => renderizarListaFiltrada(e.target.value.toLowerCase()));
    }
});

async function procesarLecturaQR(idAlumno) {
    // 1. Consultar estado del sistema
    const config = await db.collection("configuracion").doc("sistema").get();
    const esContingencia = config.data()?.salidaGeneral || false;

    if (esContingencia) {
        registrarAccesoRapido(idAlumno, "SALIDA"); 
        mostrarMensajeVisual("SALIDA LIBRE POR CONTINGENCIA", "warning");
        return;
    }
}

async function limpiarFantasmasNocturnos() {
    const hoy = new Date().toLocaleDateString('en-CA');
    const configRef = db.collection("configuracion").doc("sistema");
    
    try {
        const doc = await configRef.get();
        if (doc.exists && doc.data().ultimaLimpieza === hoy) return;

        const snap = await db.collection("alumnos").where("estado", "==", "DENTRO").get();
        
        if (!snap.empty) {
            const chunks = [];
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 400) {
                chunks.push(docs.slice(i, i + 400));
            }

            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(alumno => batch.update(alumno.ref, { estado: "FUERA" }));
                await batch.commit();
            }
            console.log(`Limpieza completada: ${snap.size} alumnos reseteados.`);
        }

        await configRef.set({ ultimaLimpieza: hoy }, { merge: true });
    } catch (e) {
        console.error("Error en la limpieza nocturna:", e);
    }
}

// --- 2. CARGA DE DATOS ---
async function cargarConfiguracionEscaneo() {
    try {
        const doc = await db.collection("configuracion").doc("escolar").get();
        if (!doc.exists) return;

        const data = doc.data();
        const hoy = obtenerFechaLocal();
        if (data.especialidades) especialidadesConfig = data.especialidades;

        const banner = document.getElementById('bannerContingencia');
        if (banner) {
            banner.style.display = (data.salidaGeneralAutorizada && data.fechaSalidaGeneral === hoy) ? 'block' : 'none';
        }
    } catch (e) { console.error("Error config:", e); }
}

function cargarListaAlumnosActivos() {
    db.collection("alumnos").where("estatus_escolar", "==", "Activo")
      .onSnapshot(snapshot => {
        alumnosCache = snapshot.docs.map(doc => doc.data());
        generarTableroDinamico();
		inicializarMotorFacial();
        
        const inputFiltro = document.getElementById('filtroRapido');
        if (inputFiltro) {
            renderizarListaFiltrada(inputFiltro.value.toLowerCase());
        }
    });

    const inputFiltro = document.getElementById('filtroRapido');
    if (inputFiltro) {
        inputFiltro.addEventListener('input', (e) => renderizarListaFiltrada(e.target.value.toLowerCase()));
    }
}

function escucharPasesDelDia() {
    const hoy = obtenerFechaLocal();
    db.collection("pases_salida")
        .where("fecha", "==", hoy)
        .where("estatus_vigencia", "==", true)
        .onSnapshot((snapshot) => {
            gruposAutorizadosHoy = [];
            pasesIndividualesHoy = []; 
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.es_grupal) gruposAutorizadosHoy.push(`${data.grado}${data.grupo}-${data.especialidad}`);
                else pasesIndividualesHoy.push(data.matricula);
            });
            generarTableroDinamico();
            const f = document.getElementById('filtroRapido');
            if (f) renderizarListaFiltrada(f.value.toLowerCase()); 
        });
}

// --- 3. LÓGICA DE ESCANEO Y VALIDACIÓN ---
async function enviarNotificacionTutor(alumno, tipoAcceso) {
    try {
        console.log("=== [RASTREO] Iniciando despacho de notificación ===");

        const configDoc = await db.collection("configuracion").doc("whatsapp").get();
        if (!configDoc.exists) {
            return console.warn("=== [RASTREO] ABORTADO: El documento 'whatsapp' no existe en Firestore ===");
        }

        const config = configDoc.data();
        console.log("Configuración de WhatsApp obtenida de Firestore");
        
        const teltutor = alumno.teltutor; 
        console.log("Teléfono del tutor extraído:");
        
        if (!teltutor) {
            return console.log(`=== [RASTREO] ABORTADO: Sin teléfono para el alumno ===`);
        }

        const infoAlumno = `*${alumno.nombre}* (${alumno.grado}° "${alumno.grupo}" - ${alumno.especialidad})`;
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let mensaje = "";
        switch(tipoAcceso) {
            case "ENTRADA":
                mensaje = `🔔 *CBTis 134 - AVISO*\n\nSu hijo(a) ${infoAlumno} ha INGRESADO al plantel.\nHora: ${hora}`;
                break;
            case "SALIDA":
                mensaje = `🚪 *CBTis 134 - AVISO*\n\nSu hijo(a) ${infoAlumno} ha SALIDO del plantel.\nHora: ${hora}`;
                break;
            case "CONTINGENCIA":
                mensaje = `⚠️ *CBTis 134 - AVISO DE EMERGENCIA*\n\nSe ha decretado *SALIDA GENERAL* por contingencia.\nSu hijo(a) ${infoAlumno} ha sido liberado del plantel.\nHora: ${hora}`;
                break;
        }

        console.log("Mensaje construido listo para enviar");
        console.log("Evaluando proveedor de API guardado");

        if (config.tipo_api === 'META') {
            console.log("Redirigiendo a enviarPorMeta...");
            await enviarPorMeta(config, teltutor, mensaje);
        } else if (config.tipo_api === 'ULTRAMSG') {
            console.log("Redirigiendo a enviarPorUltramsg...");
            await enviarPorUltramsg(config, teltutor, mensaje);
        } else if (config.tipo_api === 'TWILIO') {
            console.log("¡Correcto! Redirigiendo a enviarPorTwilio...");
            await enviarPorTwilio(config, teltutor, mensaje);
		} else if (config.tipo_api === 'OPENWA') {
			await enviarPorOpenWA(config, teltutor, mensaje);
        } else {
            console.error("=== [RASTREO] ERROR: Proveedor de API no reconocido en el config ===");
        }

    } catch (error) {
        console.error("=== [RASTREO] Error crítico al despachar WhatsApp ===", error);
    }
}

// Meta
async function enviarPorMeta(config, tel, msg) {
    return fetch(`https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: "52" + tel.trim(), 
            type: "text",
            text: { body: msg }
        })
    });
}

// Ultramsg
async function enviarPorUltramsg(config, tel, msg) {
    try {
        const numeroLimpio = tel.replace(/\s+/g, '').replace(/[-()]/g, '');
        
        console.log(`[UltraMsg Proxy] Pidiendo a Spring Boot que despache a +52${numeroLimpio}...`);

        const response = await fetch('/api/whatsapp/ultramsg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instanceId: config.instanceId.trim(),
                token: config.token.trim(),
                to: `+52${numeroLimpio}`,
                body: msg
            })
        });

        const textResponse = await response.text();

        if (!response.ok) {
            console.error("[UltraMsg Backend Error]:", textResponse);
        } else {
            console.log("[UltraMsg Backend Éxito]: ¡Mensaje procesado con éxito por UltraMsg!");
        }

        return response;

    } catch (err) {
        console.error("Fallo crítico al conectar con el backend local de Java:", err);
    }
}

// Twilio
async function enviarPorTwilio(config, tel, msg) {
    try {
        const numeroLimpio = tel.replace(/\s+/g, '').replace(/[-()]/g, '');
        
        const sidLimpio = config.accountSid.trim();
        const tokenLimpio = config.authToken.trim();
        
        console.log(`[Twilio Proxy] Despachando con formato estricto: +521${numeroLimpio}...`);

        const response = await fetch('/api/whatsapp/twilio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                accountSid: sidLimpio,
                authToken: tokenLimpio,
                to: `whatsapp:+521${numeroLimpio}`,
                from: `whatsapp:${config.twilioNumber.trim()}`,
                body: msg
            })
        });

        const textResponse = await response.text();

        if (!response.ok) {
            console.error("[Twilio Backend Error]:", textResponse);
        } else {
            console.log("[Twilio Backend Éxito]: ¡Mensaje enviado y procesado con éxito por Twilio!");
        }

        return response;

    } catch (err) {
        console.error("Fallo crítico al conectar con el backend local de Java:", err);
    }
}

async function enviarPorOpenWA(config, tel, msg) {
    try {
        const numeroLimpio = tel.replace(/\s+/g, '').replace(/[-()]/g, '');
        const numeroDestino = `521${numeroLimpio}`; 

        console.log(`[OpenWA Proxy] Pidiendo a Spring Boot que contacte al contenedor local...`);

        const urlBase = config.apiUrl.replace(/\/$/, "");

        const response = await fetch('/api/whatsapp/openwa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiUrl: urlBase,
                token: config.token || "", 
                sessionId: config.sessionId || "",
                to: numeroDestino,
                body: msg
            })
        });

        const textResponse = await response.text();

        if (!response.ok) {
            console.error("[OpenWA Backend Error]:", textResponse);
        } else {
            console.log("[OpenWA Backend Éxito]: ¡Mensaje despachado al contenedor Docker por Spring Boot!");
        }

        return response;

    } catch (err) {
        console.error("Fallo crítico al conectar con el backend local de Java:", err);
    }
}

// --- 3.2 LÓGICA DE ESCANEO ---
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
    const registroId = `${hoy}_${matricula}`;
    
    try {
        const alumnoDoc = await db.collection("alumnos").doc(matricula).get();

        if (!alumnoDoc.exists || alumnoDoc.data().estatus_escolar !== "Activo") {
            if (typeof sonidoError !== 'undefined') sonidoError.play();
            Swal.fire({
                icon: 'error', title: 'Error de Validación', text: 'QR no reconocido o inactivo',
                position: 'bottom-end', toast: true, width: '800px', timer: 4000, showConfirmButton: false
            });
            procesandoEscaneo = false; 
            return;
        }
				
        const al = alumnoDoc.data();
        const registroRef = db.collection("registros_diarios").doc(registroId);
        const regDoc = await registroRef.get();

        const configEscolar = await db.collection("configuracion").doc("escolar").get();
        const configData = configEscolar.data();
        const salidaGeneralActiva = (configData?.salidaGeneralAutorizada === true) && 
                                    (configData?.fechaSalidaGeneral === hoy);

        if (!regDoc.exists || regDoc.data().estatus_actual === "FUERA") {
            
            await registroRef.set({
                matricula, nombre: al.nombre, especialidad: al.especialidad,
                grado: al.grado, grupo: al.grupo, fecha: hoy,
                hora_entrada: new Date().toLocaleTimeString(), estatus_actual: "DENTRO"
            }, { merge: true });

			await db.collection("alumnos").doc(matricula).update({ 
			        estado: "DENTRO",
			        fecha_ultima_asistencia: hoy
			    });
            
            mostrarResultado(al, "ENTRADA");

            if (!esManual && typeof enviarNotificacionTutor === 'function') {
                enviarNotificacionTutor(al, "ENTRADA");
            }

        } else if (regDoc.data().estatus_actual === "DENTRO") {
            await validarSalida(al, registroRef, salidaGeneralActiva);
        }
    } catch (e) { 
        console.error("Error en onScanSuccess:", e); 
    } finally {
        setTimeout(() => {
            procesandoEscaneo = false;
        }, 1000);
    }
}

async function validarSalida(al, registroRef, salidaGeneralActiva) {
    const gpoKey = `${al.grado}${al.grupo}-${al.especialidad}`;
    const tienePase = pasesIndividualesHoy.includes(al.matricula) || gruposAutorizadosHoy.includes(gpoKey);

    if (tienePase || salidaGeneralActiva) {
        let motivo = tienePase ? "PASE AUTORIZADO" : "SALIDA GENERAL";
        let colorBanda = tienePase ? "#198754" : "#0d6efd";

        await registroRef.update({ 
            hora_salida: new Date().toLocaleTimeString(), 
            estatus_actual: "FUERA", 
            tipo_salida: motivo 
        });
        
        await db.collection("alumnos").doc(al.matricula).update({ estado: "FUERA" });

        mostrarResultado(al, "SALIDA");
        
        const banda = document.getElementById('bandaEstatus');
        if (banda) banda.style.backgroundColor = colorBanda;
        
        if (typeof enviarNotificacionTutor === 'function') enviarNotificacionTutor(al, "SALIDA");
        

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
            width: '800px',
            padding: '3rem',
            timer: 4500,
            showConfirmButton: false 
        });
    }
}

// --- 4. COMPONENTES VISUALES (UI) ---
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
        const nombreCompleto = normalizarTexto(`${al.nombre} ${al.apepat} ${al.apemat}`);
        return nombreCompleto.includes(busquedaLimpia) || al.matricula.includes(busquedaLimpia);
    });

    const limitados = filtrados.slice(0, 30);

    limitados.forEach(al => {
        const estaDentro = al.estado === "DENTRO";
        const dotColor = estaDentro ? "text-primary" : "text-muted";

        const tienePase = pasesIndividualesHoy.includes(al.matricula) || 
                         gruposAutorizadosHoy.includes(`${al.grado}${al.grupo}-${al.especialidad}`);

						 contenedor.innerHTML += `
						             <tr class="table-active-hover ${tienePase ? 'table-success' : ''}" style="cursor: pointer;" onclick="consultarEstatus('${al.matricula}')">
						                 <td class="ps-3 py-2">
						                     <i class="bi bi-circle-fill ${dotColor} me-2" style="font-size: 0.5rem;"></i>
						                     <span class="fw-bold small text-uppercase">${al.nombre} ${al.apepat}</span>
						                     <br><span class="x-small text-muted">${al.matricula}</span>
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
        const nombreCompleto = normalizarTexto(`${al.nombre} ${al.apepat} ${al.apemat || ''}`);
        const matricula = (al.matricula || "").toLowerCase();
        return matricula === valorBusqueda || nombreCompleto.includes(valorBusqueda);
    });

    if (!resultado) {
        return Swal.fire("No encontrado", "No existe un alumno activo con ese dato.", "error");
    }

    const estaDentro = resultado.estado === "DENTRO";
    const colorEstado = estaDentro ? '#7b1b37' : '#6c757d';
    const textoEstado = estaDentro ? 'ACTUALMENTE EN EL PLANTEL' : 'FUERA DEL PLANTEL';

    Swal.fire({
        title: 'Consulta de Estatus',
        html: `
            <div class="text-start">
                <p class="mb-1"><b>Alumno:</b> ${resultado.nombre} ${resultado.apepat} ${resultado.apemat || ''}</p>
                <p class="mb-1"><b>Matrícula:</b> ${resultado.matricula}</p>
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

    const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 4500,
        width: '900px',
        padding: '3.5rem',
		borderLeft: `8px solid ${colorNotificacion}`,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: icono,
        title: `<span style="color: ${colorNotificacion}; font-weight: 900; font-size: 1.8rem;">${tipo} REGISTRADA</span>`,
        html: `
            <div class="d-flex align-items-center mt-3">
                <div class="ms-2 text-start">
                    <div class="fw-bold text-uppercase" style="font-size: 1.4rem; line-height: 1.2;">
                        ${al.nombre} ${al.apepat} ${al.apemat}
                    </div>
                    <div class="text-muted mt-2" style="font-size: 1.1rem; letter-spacing: 0.5px;">
                        <i class="bi bi-mortarboard-fill"></i> ${al.especialidad} <br>
                        <i class="bi bi-geo-alt-fill"></i> ${al.grado}° "${al.grupo}"
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
let ultimoDesconocido = 0;
let modoEscaneoFacial = 'AMBOS'; 

async function cambiarModoFacial(modo) {
    modoEscaneoFacial = modo;

    document.getElementById('btnModoAmbos').className = (modo === 'AMBOS') ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-outline-secondary';
    document.getElementById('btnModoEntrada').className = (modo === 'ENTRADA') ? 'btn btn-sm btn-success' : 'btn btn-sm btn-outline-success';
    document.getElementById('btnModoSalida').className = (modo === 'SALIDA') ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-primary';

    Swal.fire({
        title: '<span style="font-size: 1.8rem; font-weight: bold;">Optimizando motor...</span>',
        html: `<span style="font-size: 1.3rem;">Filtro aplicado: <b style="color: var(--guinda);">${modo}</b></span>`,
        icon: 'info',
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 1500,
        width: '800px',
        padding: '2rem'
    });

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
            console.log("Modelos faciales cargados.");
        }

        const descriptoresEtiquetados = [];
        let ignorados = 0;

        const horaActual = new Date().getHours(); 

        alumnosCache.forEach(al => {
            if (al.descriptor_facial && al.descriptor_facial.length === 128) {

                // 1. FILTRO DE TURNO VESPERTINO
                const esVespertino = (al.turno && al.turno.toUpperCase() === 'VESPERTINO');
                if (horaActual < 10 && esVespertino && modoEscaneoFacial !== 'SALIDA') {
                    ignorados++;
                    return; 
                }

                if (modoEscaneoFacial === 'ENTRADA' && al.estado === 'DENTRO') {
                    ignorados++;
                    return;
                } else if (modoEscaneoFacial === 'SALIDA' && al.estado !== 'DENTRO') {
                    ignorados++;
                    return;
                }

                const floatArray = new Float32Array(al.descriptor_facial);
                descriptoresEtiquetados.push(
                    new faceapi.LabeledFaceDescriptors(al.matricula, [floatArray])
                );
            }
        });

        if (descriptoresEtiquetados.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(descriptoresEtiquetados, 0.45);
            console.log(`Motor facial listo [Modo: ${modoEscaneoFacial}]. Cargados: ${descriptoresEtiquetados.length} | Ignorados: ${ignorados}`);
        } else {
            faceMatcher = null;
            console.log(`[Filtro Vacío]: No hay alumnos válidos para el modo ${modoEscaneoFacial} en este horario.`);
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

    if (!video) return console.error("No se encontró el elemento videoReconocimiento");

    if (escaneoFacialActivo) {
        // --- APAGANDO FACE ID ---
        escaneoFacialActivo = false;
        if (streamReconocimiento) streamReconocimiento.getTracks().forEach(track => track.stop());
        video.srcObject = null;

        contFacial.style.display = 'none';
        controlesFiltro.style.display = 'none';
        contQR.style.display = 'block';
        btn.innerHTML = '<i class="bi bi-person-bounding-box me-2"></i>Activar Face ID';
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--guinda)';
        textoIns.innerHTML = '<i class="bi bi-camera me-1"></i> Posicione el código frente a la cámara';

        if (html5QrcodeScanner) html5QrcodeScanner.resume();
        
        Swal.fire({ 
            icon: 'info', 
            title: '<span style="font-size: 1.6rem; font-weight: bold;">Modo Clásico</span>', 
            html: '<span style="font-size: 1.2rem;">Lector de QR activado.</span>', 
            toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false, width: '500px'
        });
        
    } else {
        // --- ENCENDIENDO FACE ID ---
        try {
            if (html5QrcodeScanner) html5QrcodeScanner.pause();

            await cambiarModoFacial('AMBOS');

            if (!faceMatcher) {
                Swal.fire({
                    icon: 'warning',
                    title: '<span style="font-size: 1.6rem;">Aviso</span>',
                    html: '<span style="font-size: 1.2rem;">La cámara se encenderá, pero no hay rostros cargados en el motor en este momento.</span>',
                    toast: true, position: 'bottom-end', timer: 4000, showConfirmButton: false, width: '600px'
                });
            }

            streamReconocimiento = await navigator.mediaDevices.getUserMedia({ video: {
                width: { ideal: 640},
                height: { ideal: 480}
            } });
            video.srcObject = streamReconocimiento;
            escaneoFacialActivo = true;

            contQR.style.display = 'none';
            contFacial.style.display = 'block';
            controlesFiltro.style.display = 'block';
            btn.innerHTML = '<i class="bi bi-qr-code-scan me-2"></i>Volver a QR';
            btn.style.backgroundColor = 'var(--guinda)';
            btn.style.color = 'white';
            textoIns.innerHTML = '<i class="bi bi-person-video me-1"></i> Mire a la cámara para registrar acceso';

            video.addEventListener('play', procesarFotogramasFaciales);
            
            Swal.fire({ 
                icon: 'success', 
                title: '<span style="font-size: 1.6rem; font-weight: bold;">Face ID Activado</span>', 
                html: '<span style="font-size: 1.2rem;">Buscando rostros conocidos...</span>', 
                toast: true, position: 'bottom-end', timer: 3000, width: '600px', padding: '2rem', showConfirmButton: false 
            });
            
        } catch (e) {
            if (html5QrcodeScanner) html5QrcodeScanner.resume();
            Swal.fire("Error", "No se pudo acceder a la cámara. Revisa los permisos del navegador.", "error");
        }
    }
}

// 3.
async function procesarFotogramasFaciales() {
    const video = document.getElementById('videoReconocimiento');
    const canvas = document.getElementById('canvasOverlayFacial');
    
    if (video.paused || video.ended || !escaneoFacialActivo) return;

    try {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        if (canvas.width !== displaySize.width) {
            faceapi.matchDimensions(canvas, displaySize);
        }

        const opcionesDeteccion = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        const deteccion = await faceapi.detectSingleFace(video, opcionesDeteccion)
                                       .withFaceLandmarks()
                                       .withFaceDescriptor();
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (deteccion && faceMatcher) {
            const deteccionAjustada = faceapi.resizeResults(deteccion, displaySize);
            const coincidencia = faceMatcher.findBestMatch(deteccion.descriptor);
            
            const esConocido = coincidencia.label !== 'unknown';
            const colorCaja = esConocido ? '#198754' : '#dc3545';
            const textoCaja = esConocido ? coincidencia.label : 'NO RECONOCIDO';

            const drawBox = new faceapi.draw.DrawBox(deteccionAjustada.detection.box, {
                label: textoCaja,
                boxColor: colorCaja,
                lineWidth: 3
            });
            drawBox.draw(canvas);

            if (!Swal.isVisible()) {
                const ahora = Date.now();

                if (esConocido) {
                    const matriculaIdentificada = coincidencia.label;
                    if (ultimoRostroDetectado.matricula !== matriculaIdentificada || (ahora - ultimoRostroDetectado.tiempo) > 5000) {
                        ultimoRostroDetectado = { matricula: matriculaIdentificada, tiempo: ahora };
                        onScanSuccess(matriculaIdentificada, false);
                    }
                } else {
                    if (ahora - ultimoDesconocido > 4000) {
                        ultimoDesconocido = ahora;

                        if (typeof sonidoError !== 'undefined') sonidoError.play();
                        
                        Swal.fire({
                            icon: 'error',
                            title: '<span style="font-size: 1.8rem; font-weight: bold;">ROSTRO DESCONOCIDO</span>',
                            html: '<span style="font-size: 1.3rem;">No se encontró registro biométrico o el alumno fue filtrado.</span>',
                            position: 'bottom-end',
                            toast: true,
                            width: '700px',
                            padding: '2.5rem',
                            timer: 3000,
                            showConfirmButton: false
                        });
                    }
                }
            }
        } else if (deteccion && !faceMatcher) {

            const deteccionAjustada = faceapi.resizeResults(deteccion, displaySize);
            const drawBox = new faceapi.draw.DrawBox(deteccionAjustada.detection.box, {
                label: "ESPERANDO ALUMNOS...",
                boxColor: "#ffc107",
                lineWidth: 3
            });
            drawBox.draw(canvas);
        }

    } catch (e) {
        console.error("Error procesando frame facial:", e);
    }

	if (escaneoFacialActivo) {
	        setTimeout(procesarFotogramasFaciales, 2000);
	    }
}

function inicializarReloj() {
    setInterval(() => {
        const ahora = new Date();
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        if(document.getElementById('relojActual')) document.getElementById('relojActual').innerText = ahora.toLocaleString('es-MX', opciones);
    }, 1000);
}