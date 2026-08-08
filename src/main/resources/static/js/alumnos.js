let iaCargada = false;
let streamCamara = null;
let descriptorFacialGlobal = null;
let fotoPerfilGlobal = null;
let alumnoEdicionId = null;
let adminUID = "ADMIN_DEFAULT";

document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidadesForm();
    cargarModelosIABackground();
    const esEdicion = await verificarEdicion();

    // Si es un nuevo estudiante y no hay foto cargada, activar cámara automáticamente de inmediato
    if (!esEdicion && !fotoPerfilGlobal) {
        iniciarCamaraRegistro();
    }
});

async function cargarEspecialidadesForm() {
    const selectEsp = document.getElementById('especialidad');
    if (!selectEsp) return;
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            const especialidades = data.especialidades || [];
            selectEsp.innerHTML = '<option value="" disabled selected>-- Seleccionar Carrera --</option>';
            especialidades.forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.nombre;
                opt.textContent = esp.nombre;
                selectEsp.appendChild(opt);
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
    if (!matEdit) return false;

    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matEdit}`);
        if (res.ok) {
            const d = await res.json();
            
            alumnoEdicionId = d.id;

            if (document.getElementById('matricula')) {
                document.getElementById('matricula').value = d.ncontrol || d.matricula;
                document.getElementById('matricula').readOnly = true;
            }
            if (document.getElementById('curp')) document.getElementById('curp').value = d.curp || '';
            if (document.getElementById('genero')) {
                const g = (d.genero || '').toUpperCase();
                if (g.startsWith('H') || g.includes('HOMB') || g.includes('MASC')) {
                    document.getElementById('genero').value = 'H';
                } else if (g.startsWith('M') || g.includes('MUJ') || g.includes('FEM')) {
                    document.getElementById('genero').value = 'M';
                } else {
                    document.getElementById('genero').value = d.genero || '';
                }
            }
            if (document.getElementById('nombre')) document.getElementById('nombre').value = d.nombre || '';
            if (document.getElementById('apepat')) document.getElementById('apepat').value = d.apepat || d.primerApellido || '';
            if (document.getElementById('apemat')) document.getElementById('apemat').value = d.apemat || d.segundoApellido || '';
            if (document.getElementById('email')) document.getElementById('email').value = d.email || '';
            if (document.getElementById('celular')) document.getElementById('celular').value = d.celular || '';
            if (document.getElementById('direccion')) document.getElementById('direccion').value = d.direccion || '';
            
            if (document.getElementById('especialidad') && d.especialidad) {
                const selectEsp = document.getElementById('especialidad');
                let exists = Array.from(selectEsp.options).some(opt => opt.value === d.especialidad);
                if (!exists) {
                    const opt = document.createElement('option');
                    opt.value = d.especialidad;
                    opt.textContent = d.especialidad;
                    selectEsp.appendChild(opt);
                }
                selectEsp.value = d.especialidad;
            }

            if (document.getElementById('grado')) document.getElementById('grado').value = d.grado || '';
            if (document.getElementById('grupo')) document.getElementById('grupo').value = d.grupo || '';
            if (document.getElementById('turno')) document.getElementById('turno').value = d.turno || 'Matutino';
            if (document.getElementById('estatus_escolar')) document.getElementById('estatus_escolar').value = d.estatus_escolar || d.estatus || 'Activo';
            if (document.getElementById('color_semaforo')) document.getElementById('color_semaforo').value = d.color_semaforo || 'Verde';
            if (document.getElementById('nombretutor')) document.getElementById('nombretutor').value = d.nombretutor || '';
            if (document.getElementById('teltutor')) document.getElementById('teltutor').value = d.teltutor || '';
            if (document.getElementById('ocupaciontutor')) document.getElementById('ocupaciontutor').value = d.ocupaciontutor || '';
            
            if (d.descriptor_facial) descriptorFacialGlobal = d.descriptor_facial;
            
            const fotoExistente = d.fotoUrl || d.foto_url || d.foto;
            if (fotoExistente) {
                fotoPerfilGlobal = fotoExistente;
                mostrarFotoPreview(fotoPerfilGlobal);
            } else {
                iniciarCamaraRegistro();
            }
            
            toggleAula(d.color_semaforo);
            if (d.aula_especifica && document.getElementById('aula_especifica')) document.getElementById('aula_especifica').value = d.aula_especifica;
            return true;
        }
    } catch (e) { console.error("Error al cargar datos para edición:", e); }
    return false;
}

async function cargarModelosIABackground() {
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        iaCargada = true;
    } catch (e) {
        console.warn("Extracción vectorial omitida:", e);
    }
}

async function iniciarCamaraRegistro() {
    const video = document.getElementById('videoRegistro');
    if (!video) return;
    
    try {
        if (streamCamara) {
            streamCamara.getTracks().forEach(t => t.stop());
        }
        streamCamara = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = streamCamara;
        
        if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'none';
        if (document.getElementById('rostroCapturado')) document.getElementById('rostroCapturado').style.display = 'none';
        if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'block';
        if (document.getElementById('btnCapturarRostro')) document.getElementById('btnCapturarRostro').style.display = 'inline-block';
        if (document.getElementById('btnTomarOtraFoto')) document.getElementById('btnTomarOtraFoto').style.display = 'none';
        if (document.getElementById('btnEliminarFoto')) document.getElementById('btnEliminarFoto').style.display = 'none';
        
    } catch (e) {
        console.warn("Cámara no iniciada:", e);
    }
}

async function capturarFirmaFacial() {
    const video = document.getElementById('videoRegistro');
    Swal.fire({ title: 'Capturando fotografía...', text: 'Guardando foto de perfil', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        // Redimensionar y comprimir la captura a 300x400 JPEG para máxima eficiencia (pesa ~20KB)
        const canvasSnap = document.createElement('canvas');
        canvasSnap.width = 300;
        canvasSnap.height = 400;
        const ctxSnap = canvasSnap.getContext('2d');

        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;
        ctxSnap.drawImage(video, 0, 0, vW, vH, 0, 0, 300, 400);
        
        fotoPerfilGlobal = canvasSnap.toDataURL('image/jpeg', 0.85);

        if (iaCargada) {
            try {
                const deteccion = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
                if (deteccion) {
                    descriptorFacialGlobal = Array.from(deteccion.descriptor);
                }
            } catch(e) { console.warn("Extracción vectorial omitida:", e); }
        }

        if (streamCamara) streamCamara.getTracks().forEach(track => track.stop());

        if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
        if (document.getElementById('btnCapturarRostro')) document.getElementById('btnCapturarRostro').style.display = 'none';
        
        mostrarFotoPreview(fotoPerfilGlobal);

        Swal.fire("¡Foto Capturada!", "La fotografía de perfil se ha asignado correctamente al estudiante.", "success");

    } catch (err) {
        console.error(err);
        Swal.fire("Error", "No se pudo capturar la imagen de la cámara.", "error");
    }
}

function cargarFotoDesdeArchivo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvasSnap = document.createElement('canvas');
            canvasSnap.width = 300;
            canvasSnap.height = 400;
            const ctxSnap = canvasSnap.getContext('2d');
            ctxSnap.drawImage(img, 0, 0, 300, 400);
            fotoPerfilGlobal = canvasSnap.toDataURL('image/jpeg', 0.85);
            mostrarFotoPreview(fotoPerfilGlobal);
        };
    };
    reader.readAsDataURL(file);
}

function mostrarFotoPreview(srcFoto) {
    if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'none';
    if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
    
    const divRes = document.getElementById('rostroCapturado');
    const imgPrev = document.getElementById('imgFotoPerfilPreview');
    const btnTomarOtra = document.getElementById('btnTomarOtraFoto');
    const btnDel = document.getElementById('btnEliminarFoto');

    if (divRes) divRes.style.display = 'block';
    if (imgPrev) {
        imgPrev.src = srcFoto;
        imgPrev.style.display = 'block';
    }
    if (btnTomarOtra) btnTomarOtra.style.display = 'inline-block';
    if (btnDel) btnDel.style.display = 'inline-block';
}

function eliminarFotoEstudiante() {
    fotoPerfilGlobal = null;
    descriptorFacialGlobal = null;

    if (document.getElementById('rostroCapturado')) document.getElementById('rostroCapturado').style.display = 'none';
    if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
    if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'flex';
    if (document.getElementById('btnEliminarFoto')) document.getElementById('btnEliminarFoto').style.display = 'none';
    if (document.getElementById('btnTomarOtraFoto')) document.getElementById('btnTomarOtraFoto').style.display = 'none';
    if (document.getElementById('inputFotoArchivo')) document.getElementById('inputFotoArchivo').value = '';
    
    iniciarCamaraRegistro();
    Swal.fire({ icon: 'info', title: 'Fotografía removida', text: 'Se eliminará la foto de perfil del estudiante al guardar.', toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
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
                id: alumnoEdicionId || null, // ¡ID MONGODB PARA OVERWRITE GARANTIZADO!
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

            Swal.fire("Éxito", "Estudiante guardado correctamente con su foto de perfil.", "success")
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