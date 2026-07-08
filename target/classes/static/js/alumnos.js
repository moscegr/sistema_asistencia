let adminUID = null;
let editMatricula = null;
let especialidadesCache = [];

let descriptorFacialGlobal = null; 
let streamCamara = null;
let iaCargada = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación de Seguridad y Sesión
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            adminUID = user.uid;
        } else {
            window.location.href = "/login";
        }
    });

    // 2. Cargar Especialidades desde Configuración
    await cargarEspecialidadesConfig();
	cargarModelosIA();

    // 3. Validación Visual de Inputs (Bootstrap)
    const inputs = document.querySelectorAll('#formAlumno input, #formAlumno select');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            if (input.checkValidity()) {
                input.classList.remove('is-invalid');
                input.classList.add('is-valid');
            } else {
                input.classList.remove('is-valid');
                input.classList.add('is-invalid');
            }
        });
    });

    // 4. Modo Edición: Detectar parámetro en URL
    const urlParams = new URLSearchParams(window.location.search);
    editMatricula = urlParams.get('edit');

    if (editMatricula) {
        configurarModoEdicion(editMatricula);
    }
});

/**
 * Carga las carreras desde la colección 'configuracion'
 */
async function cargarEspecialidadesConfig() {
    const select = document.getElementById('especialidad');
    try {
        const doc = await db.collection("configuracion").doc("escolar").get();
        if (doc.exists && doc.data().especialidades) {
            especialidadesCache = doc.data().especialidades;
            select.innerHTML = '<option value="">Seleccionar carrera...</option>';
            especialidadesCache.forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.nombre;
                opt.textContent = esp.nombre;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error cargando configuración:", e);
    }
}

/**
 * Ajusta el turno automáticamente según la carrera seleccionada
 */
function ajustarTurnos(nombreCarrera) {
    const turnoSelect = document.getElementById('turno');
    const config = especialidadesCache.find(e => e.nombre === nombreCarrera);
    if (config && config.turno) {
        turnoSelect.value = config.turno;
    }
}

/**
 * Carga los datos del alumno en el formulario para editar
 */
async function configurarModoEdicion(matricula) {
    document.getElementById('matricula').readOnly = true; 
    document.querySelector('button[type="submit"]').innerHTML = '<i class="bi bi-pencil-square me-2"></i> Actualizar Estudiante';
    
    try {
        const doc = await db.collection("alumnos").doc(matricula).get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('matricula').value = d.matricula;
            document.getElementById('curp').value = d.curp;
            document.getElementById('genero').value = d.genero || '';
            document.getElementById('nombre').value = d.nombre;
            document.getElementById('apepat').value = d.apepat;
            document.getElementById('apemat').value = d.apemat;
            document.getElementById('email').value = d.email;
            document.getElementById('celular').value = d.celular;
            document.getElementById('direccion').value = d.direccion;
            document.getElementById('especialidad').value = d.especialidad;
            document.getElementById('grado').value = d.grado;
            document.getElementById('grupo').value = d.grupo;
            document.getElementById('turno').value = d.turno;
            document.getElementById('estatus_escolar').value = d.estatus_escolar;
            document.getElementById('color_semaforo').value = d.color_semaforo;
            document.getElementById('nombretutor').value = d.nombretutor;
            document.getElementById('teltutor').value = d.teltutor;
            document.getElementById('ocupaciontutor').value = d.ocupaciontutor;
			
			if (d.descriptor_facial && d.descriptor_facial.length === 128) {
			                descriptorFacialGlobal = d.descriptor_facial;
			                document.getElementById('iconoEspera').style.display = 'none';
			                document.getElementById('rostroCapturado').style.display = 'block';
			                document.getElementById('btnActivarCamara').innerHTML = '<i class="bi bi-arrow-repeat"></i> Reemplazar Rostro';
			            }
            
            toggleAula(d.color_semaforo);
            if (d.aula_especifica) document.getElementById('aula_especifica').value = d.aula_especifica;
        }
    } catch (e) { console.error(e); }
}

async function cargarModelosIA() {
    try {
        document.getElementById('msgBiometria').style.display = 'block';
        document.getElementById('msgBiometria').innerText = "Descargando modelos de IA...";
		
		const rutaModelos = window.location.origin + '/models';
        
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        
        iaCargada = true;
        document.getElementById('msgBiometria').style.display = 'none';
    } catch (e) {
        console.error("Error cargando IA:", e);
        document.getElementById('msgBiometria').innerText = "Error al cargar módulo facial.";
    }
}

async function iniciarCamaraRegistro() {
    if (!iaCargada) return Swal.fire("Aviso", "La Inteligencia Artificial aún se está cargando. Espere unos segundos.", "info");
    
    const video = document.getElementById('videoRegistro');
    
    try {
        streamCamara = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = streamCamara;
        
        document.getElementById('iconoEspera').style.display = 'none';
        document.getElementById('rostroCapturado').style.display = 'none';
        document.getElementById('contenedorCamara').style.display = 'block';
        document.getElementById('btnActivarCamara').style.display = 'none';
        document.getElementById('btnCapturarRostro').style.display = 'block';
        
    } catch (e) {
        Swal.fire("Error", "No se detectó cámara o denegaste los permisos.", "error");
    }
}

async function capturarFirmaFacial() {
    const video = document.getElementById('videoRegistro');
    Swal.fire({ title: 'Analizando rostro...', html: 'Mire directamente a la cámara...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    // Aquí ocurre la magia: Busca 1 cara, mapea los puntos y extrae los 128 números
    const deteccion = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
    
    if (deteccion) {
        // Convertimos el Float32Array que da face-api a un Array normal compatible con Firebase
        descriptorFacialGlobal = Array.from(deteccion.descriptor); 
        
        // Apagamos la cámara por seguridad y recursos
        if (streamCamara) streamCamara.getTracks().forEach(track => track.stop());
        
        document.getElementById('contenedorCamara').style.display = 'none';
        document.getElementById('btnCapturarRostro').style.display = 'none';
        document.getElementById('rostroCapturado').style.display = 'block';
        
        document.getElementById('btnActivarCamara').style.display = 'block';
        document.getElementById('btnActivarCamara').innerHTML = '<i class="bi bi-arrow-repeat"></i> Volver a Escanear';
        
        Swal.fire("¡Completado!", "Firma facial extraída correctamente.", "success");
    } else {
        Swal.fire("Rostro no detectado", "Por favor, asegúrese de tener buena iluminación y mirar a la cámara.", "warning");
    }
}

// --- PROCESO DE GUARDADO (REGISTRO/ACTUALIZACIÓN) ---
document.getElementById('formAlumno').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!e.target.checkValidity()) {
        e.target.classList.add('was-validated');
        return Swal.fire("Aviso", "Completa los campos obligatorios correctamente.", "warning");
    }

    const matricula = document.getElementById('matricula').value.trim();
    const curp = document.getElementById('curp').value.toUpperCase().trim();

    // 1. VALIDACIÓN DE DUPLICADOS (Solo si es registro nuevo)
    if (!editMatricula) {
        Swal.fire({ title: 'Validando...', didOpen: () => Swal.showLoading() });
        
        const docMat = await db.collection("alumnos").doc(matricula).get();
        if (docMat.exists) return Swal.fire("Error", "La matrícula ya está registrada.", "error");

        const qCurp = await db.collection("alumnos").where("curp", "==", curp).get();
        if (!qCurp.empty) return Swal.fire("Error", "El CURP ya pertenece a otro alumno.", "error");
    }

    Swal.fire({ title: 'Guardando datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // 2. CONSTRUCCIÓN DEL STRING ÚNICO PARA EL QR
        // Obtenemos los nombres para construir la cadena
        const nombre = document.getElementById('nombre').value.trim();
        const apepat = document.getElementById('apepat').value.trim();
        const apemat = document.getElementById('apemat').value.trim();
        
        // Formato propuesto: "MATRICULA|NOMBRE COMPLETO"
        const nombreCompleto = `${nombre} ${apepat} ${apemat}`.trim().toUpperCase();
        const textoUnicoQR = `${matricula}|${nombreCompleto}`;

        // 3. CONSTRUCCIÓN DEL OBJETO FINAL
        const teltutor = document.getElementById('teltutor').value.trim();
        const alumnoObj = {
            matricula: matricula,
            curp: curp,
            genero: document.getElementById('genero').value,
            nombre: nombre,
            apepat: apepat,
            apemat: apemat,
			descriptor_facial: descriptorFacialGlobal || [],
            email: document.getElementById('email').value.trim(),
            celular: document.getElementById('celular').value.trim(),
            direccion: document.getElementById('direccion').value.trim(),
            especialidad: document.getElementById('especialidad').value,
            grado: document.getElementById('grado').value,
            grupo: document.getElementById('grupo').value.toUpperCase(),
            turno: document.getElementById('turno').value,
            estatus_escolar: document.getElementById('estatus_escolar').value,
            color_semaforo: document.getElementById('color_semaforo').value,
            aula_especifica: document.getElementById('aula_especifica').value || "N/A",
            nombretutor: document.getElementById('nombretutor').value.trim(),
            teltutor: teltutor,
            ocupaciontutor: document.getElementById('ocupaciontutor').value.trim(),
            
            // Reemplazamos la URL de la imagen por el texto crudo del QR
            qr_texto: textoUnicoQR, 
            perfil_completo: !!teltutor,
            registradoPor: adminUID,
            fecharegistro: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 4. GUARDADO EN FIRESTORE
        await db.collection("alumnos").doc(matricula).set(alumnoObj, { merge: true });

        Swal.fire("Éxito", "Estudiante gestionado correctamente.", "success")
            .then(() => window.location.href = "/admin/alumnos");

    } catch (error) {
        console.error("Error al guardar alumno:", error);
        Swal.fire("Error Crítico", error.message, "error");
    }
});

function toggleAula(valor) {
    document.getElementById('divAula').style.display = (valor === 'Rojo') ? 'block' : 'none';
}