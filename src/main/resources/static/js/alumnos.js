let iaCargada = false;
let streamCamara = null;
let descriptorFacialGlobal = null;
let fotoPerfilGlobal = null;
let adminUID = "ADMIN_DEFAULT";

document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidadesForm();
    await cargarModelosIA();
    verificarEdicion();
});

async function cargarEspecialidadesForm() {
    const selectEsp = document.getElementById('especialidad');
    if (!selectEsp) return;
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            selectEsp.innerHTML = '<option value="">-- Seleccionar Carrera --</option>';
            (data.especialidades || []).forEach(esp => {
                selectEsp.innerHTML += `<option value="${esp.nombre}">${esp.nombre}</option>`;
            });
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

function ajustarTurnos(especialidadSel) {
    const selectTurno = document.getElementById('turno');
    if (!selectTurno) return;
    selectTurno.value = "Matutino";
}

async function verificarEdicion() {
    const urlParams = new URLSearchParams(window.location.search);
    const matEdit = urlParams.get('edit');
    if (!matEdit) return;

    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matEdit}`);
        if (res.ok) {
            const d = await res.json();
            
            if (document.getElementById('matricula')) {
                document.getElementById('matricula').value = d.ncontrol || d.matricula;
                document.getElementById('matricula').readOnly = true;
            }
            if (document.getElementById('curp')) document.getElementById('curp').value = d.curp || '';
            if (document.getElementById('genero')) document.getElementById('genero').value = d.genero || '';
            if (document.getElementById('nombre')) document.getElementById('nombre').value = d.nombre || '';
            if (document.getElementById('apepat')) document.getElementById('apepat').value = d.apepat || d.primerApellido || '';
            if (document.getElementById('apemat')) document.getElementById('apemat').value = d.apemat || d.segundoApellido || '';
            if (document.getElementById('email')) document.getElementById('email').value = d.email || '';
            if (document.getElementById('celular')) document.getElementById('celular').value = d.celular || '';
            if (document.getElementById('direccion')) document.getElementById('direccion').value = d.direccion || '';
            if (document.getElementById('especialidad')) document.getElementById('especialidad').value = d.especialidad || '';
            if (document.getElementById('grado')) document.getElementById('grado').value = d.grado || '';
            if (document.getElementById('grupo')) document.getElementById('grupo').value = d.grupo || '';
            if (document.getElementById('turno')) document.getElementById('turno').value = d.turno || 'Matutino';
            if (document.getElementById('estatus_escolar')) document.getElementById('estatus_escolar').value = d.estatus_escolar || d.estatus || 'Activo';
            if (document.getElementById('color_semaforo')) document.getElementById('color_semaforo').value = d.color_semaforo || 'Verde';
            if (document.getElementById('nombretutor')) document.getElementById('nombretutor').value = d.nombretutor || '';
            if (document.getElementById('teltutor')) document.getElementById('teltutor').value = d.teltutor || '';
            if (document.getElementById('ocupaciontutor')) document.getElementById('ocupaciontutor').value = d.ocupaciontutor || '';
            
            if (d.descriptor_facial) descriptorFacialGlobal = d.descriptor_facial;
            if (d.fotoUrl || d.foto_url || d.foto) {
                fotoPerfilGlobal = d.fotoUrl || d.foto_url || d.foto;
                mostrarFotoPreview(fotoPerfilGlobal);
            }
            
            toggleAula(d.color_semaforo);
            if (d.aula_especifica && document.getElementById('aula_especifica')) document.getElementById('aula_especifica').value = d.aula_especifica;
        }
    } catch (e) { console.error("Error al cargar datos para edición:", e); }
}

async function cargarModelosIA() {
    try {
        const msg = document.getElementById('msgBiometria');
        if (msg) {
            msg.style.display = 'block';
            msg.innerText = "Descargando modelos de IA...";
        }
        
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        
        iaCargada = true;
        if (msg) msg.style.display = 'none';
    } catch (e) {
        console.error("Error cargando IA:", e);
        const msg = document.getElementById('msgBiometria');
        if (msg) msg.innerText = "Error al cargar módulo facial.";
    }
}

async function iniciarCamaraRegistro() {
    if (!iaCargada) return Swal.fire("Aviso", "La Inteligencia Artificial aún se está cargando. Espere unos segundos.", "info");
    
    const video = document.getElementById('videoRegistro');
    
    try {
        streamCamara = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = streamCamara;
        
        if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'none';
        if (document.getElementById('rostroCapturado')) document.getElementById('rostroCapturado').style.display = 'none';
        if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'block';
        if (document.getElementById('btnActivarCamara')) document.getElementById('btnActivarCamara').style.display = 'none';
        if (document.getElementById('btnCapturarRostro')) document.getElementById('btnCapturarRostro').style.display = 'block';
        
    } catch (e) {
        Swal.fire("Error", "No se detectó cámara o denegaste los permisos.", "error");
    }
}

async function capturarFirmaFacial() {
    const video = document.getElementById('videoRegistro');
    Swal.fire({ title: 'Analizando rostro y capturando fotografía...', html: 'Mire directamente a la cámara...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const deteccion = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        
        // Snapshot photo frame from video stream
        const canvasSnap = document.createElement('canvas');
        canvasSnap.width = video.videoWidth || 320;
        canvasSnap.height = video.videoHeight || 240;
        const ctxSnap = canvasSnap.getContext('2d');
        ctxSnap.drawImage(video, 0, 0, canvasSnap.width, canvasSnap.height);
        fotoPerfilGlobal = canvasSnap.toDataURL('image/jpeg', 0.85);

        if (deteccion) {
            descriptorFacialGlobal = Array.from(deteccion.descriptor);
        }

        if (streamCamara) streamCamara.getTracks().forEach(track => track.stop());

        if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
        if (document.getElementById('btnCapturarRostro')) document.getElementById('btnCapturarRostro').style.display = 'none';
        
        mostrarFotoPreview(fotoPerfilGlobal);

        if (document.getElementById('btnActivarCamara')) {
            document.getElementById('btnActivarCamara').style.display = 'inline-block';
            document.getElementById('btnActivarCamara').innerHTML = '<i class="bi bi-arrow-repeat"></i> Volver a Tomar Foto';
        }
        
        Swal.fire("¡Foto y Biometría Registradas!", "Fotografía de perfil y patrón facial guardados.", "success");

    } catch (err) {
        console.error(err);
        Swal.fire("Error", "No se pudo capturar la imagen.", "error");
    }
}

function cargarFotoDesdeArchivo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        fotoPerfilGlobal = e.target.result;
        mostrarFotoPreview(fotoPerfilGlobal);
    };
    reader.readAsDataURL(file);
}

function mostrarFotoPreview(srcFoto) {
    if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'none';
    if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
    
    const divRes = document.getElementById('rostroCapturado');
    const imgPrev = document.getElementById('imgFotoPerfilPreview');
    const btnDel = document.getElementById('btnEliminarFoto');

    if (divRes) divRes.style.display = 'block';
    if (imgPrev) {
        imgPrev.src = srcFoto;
        imgPrev.style.display = 'block';
    }
    if (btnDel) btnDel.style.display = 'inline-block';
}

function eliminarFotoEstudiante() {
    fotoPerfilGlobal = null;
    descriptorFacialGlobal = null;

    if (document.getElementById('rostroCapturado')) document.getElementById('rostroCapturado').style.display = 'none';
    if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
    if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'flex';
    if (document.getElementById('btnEliminarFoto')) document.getElementById('btnEliminarFoto').style.display = 'none';
    if (document.getElementById('inputFotoArchivo')) document.getElementById('inputFotoArchivo').value = '';
    
    if (document.getElementById('btnActivarCamara')) {
        document.getElementById('btnActivarCamara').style.display = 'inline-block';
        document.getElementById('btnActivarCamara').innerHTML = '<i class="bi bi-camera-video me-1"></i> Activar Cámara';
    }

    Swal.fire({ icon: 'info', title: 'Fotografía removida', text: 'Se eliminará la foto de perfil del estudiante.', toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
}

const formAlumno = document.getElementById('formAlumno');
if (formAlumno) {
    formAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!e.target.checkValidity()) {
            e.target.classList.add('was-validated');
            return Swal.fire("Aviso", "Completa los campos obligatorios correctamente.", "warning");
        }

        const matricula = document.getElementById('matricula').value.trim();
        const curp = document.getElementById('curp').value.toUpperCase().trim();

        Swal.fire({ title: 'Guardando estudiante...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const nombre = document.getElementById('nombre').value.trim();
            const apepat = document.getElementById('apepat').value.trim();
            const apemat = document.getElementById('apemat').value.trim();
            
            const nombreCompleto = `${nombre} ${apepat} ${apemat}`.trim().toUpperCase();
            const textoUnicoQR = `${matricula}|${nombreCompleto}`;

            const teltutor = document.getElementById('teltutor').value.trim();
            const alumnoObj = {
                ncontrol: matricula,
                matricula: matricula,
                curp: curp,
                genero: document.getElementById('genero').value,
                nombre: nombre,
                apepat: apepat,
                apemat: apemat,
                primerApellido: apepat,
                segundoApellido: apemat,
                descriptor_facial: descriptorFacialGlobal || [],
                fotoUrl: fotoPerfilGlobal || null,
                foto_url: fotoPerfilGlobal || null,
                foto: fotoPerfilGlobal || null,
                email: document.getElementById('email').value.trim(),
                celular: document.getElementById('celular').value.trim(),
                direccion: document.getElementById('direccion').value.trim(),
                especialidad: document.getElementById('especialidad').value,
                grado: document.getElementById('grado').value,
                grupo: document.getElementById('grupo').value.toUpperCase(),
                turno: document.getElementById('turno').value,
                estatus: document.getElementById('estatus_escolar').value,
                estatus_escolar: document.getElementById('estatus_escolar').value,
                color_semaforo: document.getElementById('color_semaforo').value,
                aula_especifica: document.getElementById('aula_especifica') ? document.getElementById('aula_especifica').value || "N/A" : "N/A",
                nombretutor: document.getElementById('nombretutor').value.trim(),
                teltutor: teltutor,
                ocupaciontutor: document.getElementById('ocupaciontutor').value.trim(),
                qrCode: textoUnicoQR,
                qr_texto: textoUnicoQR, 
                perfil_completo: !!teltutor,
                registradoPor: adminUID
            };

            const res = await fetch('/api/alumnos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alumnoObj)
            });

            if (!res.ok) throw new Error("Error al guardar alumno en servidor.");

            Swal.fire("Éxito", "Estudiante gestionado correctamente.", "success")
                .then(() => window.location.href = "/admin/alumnos");

        } catch (error) {
            console.error("Error al guardar alumno:", error);
            Swal.fire("Error Crítico", error.message, "error");
        }
    });
}

function toggleAula(valor) {
    const div = document.getElementById('divAula');
    if (div) div.style.display = (valor === 'Rojo') ? 'block' : 'none';
}