let iaCargada = false;
let descriptorFacialGlobal = null;
let fotoPerfilGlobal = null;
let alumnoEdicionId = null;
let adminUID = "ADMIN_DEFAULT";

document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidadesForm();
    cargarModelosIABackground();
    await verificarEdicion();
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

let streamWebcamAlumno = null;

async function abrirCamaraWebcamAlumno() {
    const video = document.getElementById('videoWebcamAlumno');
    const modalEl = document.getElementById('modalCamaraWebcamAlumno');
    if (!video || !modalEl) return;

    try {
        if (streamWebcamAlumno) {
            streamWebcamAlumno.getTracks().forEach(t => t.stop());
        }
        streamWebcamAlumno = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        video.srcObject = streamWebcamAlumno;

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (err) {
        console.error("Error al abrir webcam alumno:", err);
        Swal.fire({
            icon: 'error',
            title: 'Error de Cámara',
            text: 'No se pudo acceder a la webcam. Verifique los permisos de su navegador.',
            confirmButtonColor: '#7b1b37'
        });
    }
}

function cerrarCamaraWebcamAlumno() {
    if (streamWebcamAlumno) {
        streamWebcamAlumno.getTracks().forEach(t => t.stop());
        streamWebcamAlumno = null;
    }
    const video = document.getElementById('videoWebcamAlumno');
    if (video) video.srcObject = null;

    const modalEl = document.getElementById('modalCamaraWebcamAlumno');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
}

async function capturarFotoWebcamAlumno() {
    const video = document.getElementById('videoWebcamAlumno');
    const canvas = document.getElementById('canvasWebcamAlumno');
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    const size = Math.min(video.videoWidth || 640, video.videoHeight || 480);
    const startX = ((video.videoWidth || 640) - size) / 2;
    const startY = ((video.videoHeight || 480) - size) / 2;

    canvas.width = 400;
    canvas.height = 400;
    
    // Espejo para coincidir con la vista previa
    ctx.translate(400, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);

    fotoPerfilGlobal = canvas.toDataURL('image/jpeg', 0.90);
    mostrarFotoPreview(fotoPerfilGlobal);
    cerrarCamaraWebcamAlumno();

    // Extracción de descriptor facial FaceID
    if (typeof faceapi !== 'undefined') {
        try {
            if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
                ]);
            }
            const deteccion = await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor();
            if (deteccion) {
                descriptorFacialGlobal = Array.from(deteccion.descriptor);
            }
        } catch(e) {
            console.warn("Extracción facial webcam diferida:", e);
        }
    }

    Swal.fire({
        icon: 'success',
        title: 'Foto Capturada',
        text: 'La fotografía del estudiante se ha capturado exitosamente para FaceID y Credenciales.',
        timer: 1800,
        showConfirmButton: false
    });
}

function cargarFotoDesdeArchivo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = async () => {
            const canvasSnap = document.createElement('canvas');
            canvasSnap.width = 400;
            canvasSnap.height = 400;
            const ctxSnap = canvasSnap.getContext('2d');
            ctxSnap.drawImage(img, 0, 0, 400, 400);
            fotoPerfilGlobal = canvasSnap.toDataURL('image/jpeg', 0.90);
            mostrarFotoPreview(fotoPerfilGlobal);

            // Generar vector facial si la IA está cargada
            if (typeof faceapi !== 'undefined') {
                try {
                    if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
                        await Promise.all([
                            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                            faceapi.nets.faceRecognitionNet.loadFromUri('/models')
                        ]);
                    }
                    const deteccion = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                    if (deteccion) {
                        descriptorFacialGlobal = Array.from(deteccion.descriptor);
                    }
                } catch(err) {
                    console.warn("Extracción vectorial facial desde archivo omitida:", err);
                }
            }
        };
    };
    reader.readAsDataURL(file);
}

function mostrarFotoPreview(srcFoto) {
    const imgPrev = document.getElementById('imgFotoPerfilPreview');
    const btnDel = document.getElementById('btnEliminarFoto');

    if (imgPrev) {
        imgPrev.src = srcFoto;
        imgPrev.style.display = 'block';
    }
    if (btnDel) btnDel.style.display = 'inline-block';
}

function eliminarFotoEstudiante() {
    fotoPerfilGlobal = null;
    descriptorFacialGlobal = null;

    const imgPrev = document.getElementById('imgFotoPerfilPreview');
    const inputArchivo = document.getElementById('inputFotoArchivo');
    const btnDel = document.getElementById('btnEliminarFoto');

    if (imgPrev) imgPrev.src = '/img/default_avatar.png';
    if (inputArchivo) inputArchivo.value = '';
    if (btnDel) btnDel.style.display = 'none';

    Swal.fire({
        icon: 'info',
        title: 'Fotografía removida',
        text: 'Se ha restablecido la imagen por defecto.',
        timer: 1500,
        showConfirmButton: false
    });
}

window.abrirCamaraWebcamAlumno = abrirCamaraWebcamAlumno;
window.cerrarCamaraWebcamAlumno = cerrarCamaraWebcamAlumno;
window.capturarFotoWebcamAlumno = capturarFotoWebcamAlumno;
window.cargarFotoDesdeArchivo = cargarFotoDesdeArchivo;
window.eliminarFotoEstudiante = eliminarFotoEstudiante;

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
            const nombre = document.getElementById('nombre').value.trim().toUpperCase();
            const apepat = document.getElementById('apepat').value.trim().toUpperCase();
            const apemat = document.getElementById('apemat').value.trim().toUpperCase();
            
            const nombreCompleto = `${nombre} ${apepat} ${apemat}`.trim();
            const textoUnicoQR = `${matricula}|${nombreCompleto}`
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\x20-\x7E]/g, "")
                .trim()
                .substring(0, 48);

            const teltutor = document.getElementById('teltutor').value.trim();
            const alumnoObj = {
                id: alumnoEdicionId || null,
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
                direccion: document.getElementById('direccion').value.trim().toUpperCase(),
                especialidad: document.getElementById('especialidad').value.toUpperCase(),
                grado: document.getElementById('grado').value,
                grupo: document.getElementById('grupo').value.toUpperCase(),
                turno: document.getElementById('turno').value,
                estatus: document.getElementById('estatus_escolar').value,
                estatus_escolar: document.getElementById('estatus_escolar').value,
                color_semaforo: document.getElementById('color_semaforo').value,
                aula_especifica: document.getElementById('aula_especifica') ? (document.getElementById('aula_especifica').value || "N/A").trim().toUpperCase() : "N/A",
                nombretutor: document.getElementById('nombretutor').value.trim().toUpperCase(),
                teltutor: teltutor,
                ocupaciontutor: document.getElementById('ocupaciontutor').value.trim().toUpperCase(),
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