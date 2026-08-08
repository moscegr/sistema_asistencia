let adminUID = "admin_local";
let editMatricula = null;
let especialidadesCache = [];

let descriptorFacialGlobal = null; 
let streamCamara = null;
let iaCargada = false;

document.addEventListener('DOMContentLoaded', async () => {
    await cargarEspecialidadesConfig();
    cargarModelosIA();

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

    const urlParams = new URLSearchParams(window.location.search);
    editMatricula = urlParams.get('edit');

    if (editMatricula) {
        configurarModoEdicion(editMatricula);
    }
});

async function cargarEspecialidadesConfig() {
    const select = document.getElementById('especialidad');
    if (!select) return;

    let listaEsp = [];

    try {
        const resConfig = await fetch('/api/configuracion/escolar');
        if (resConfig.ok) {
            const dataConfig = await resConfig.json();
            if (dataConfig.especialidades && dataConfig.especialidades.length > 0) {
                especialidadesCache = dataConfig.especialidades;
                listaEsp = dataConfig.especialidades.map(e => e.nombre);
            }
        }
    } catch(e) {}

    try {
        const resAlumnos = await fetch('/api/alumnos');
        if (resAlumnos.ok) {
            const alumnos = await resAlumnos.json();
            alumnos.forEach(a => {
                if (a.especialidad && !listaEsp.includes(a.especialidad)) {
                    listaEsp.push(a.especialidad);
                }
            });
        }
    } catch(e) {}

    if (listaEsp.length === 0) {
        listaEsp = ["PROGRAMACIÓN", "OFIMÁTICA", "SOPORTE Y MANTENIMIENTO", "CONTABILIDAD", "CONSTRUCCIÓN"];
    }

    listaEsp.sort();

    select.innerHTML = '<option value="">Seleccionar carrera...</option>';
    listaEsp.forEach(esp => {
        const opt = document.createElement('option');
        opt.value = esp;
        opt.textContent = esp;
        select.appendChild(opt);
    });
}

function ajustarTurnos(nombreCarrera) {
    const turnoSelect = document.getElementById('turno');
    const config = especialidadesCache.find(e => e.nombre === nombreCarrera);
    if (config && config.turno && turnoSelect) {
        turnoSelect.value = config.turno;
    }
}

async function configurarModoEdicion(matricula) {
    document.getElementById('matricula').readOnly = true; 
    document.querySelector('button[type="submit"]').innerHTML = '<i class="bi bi-pencil-square me-2"></i> Actualizar Estudiante';
    
    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matricula}`);
        if (res.ok) {
            const d = await res.json();
            document.getElementById('matricula').value = d.ncontrol || d.matricula || '';
            document.getElementById('curp').value = d.curp || '';
            document.getElementById('genero').value = d.genero || '';
            document.getElementById('nombre').value = d.nombre || '';
            document.getElementById('apepat').value = d.apepat || d.primerApellido || '';
            document.getElementById('apemat').value = d.apemat || d.segundoApellido || '';
            document.getElementById('email').value = d.email || '';
            document.getElementById('celular').value = d.celular || '';
            document.getElementById('direccion').value = d.direccion || '';
            document.getElementById('especialidad').value = d.especialidad || '';
            document.getElementById('grado').value = d.grado || '';
            document.getElementById('grupo').value = d.grupo || '';
            document.getElementById('turno').value = d.turno || '';
            document.getElementById('estatus_escolar').value = d.estatus_escolar || d.estatus || 'Activo';
            document.getElementById('color_semaforo').value = d.color_semaforo || 'Verde';
            document.getElementById('nombretutor').value = d.nombretutor || '';
            document.getElementById('teltutor').value = d.teltutor || '';
            document.getElementById('ocupaciontutor').value = d.ocupaciontutor || '';
            
            if (d.descriptor_facial && d.descriptor_facial.length === 128) {
                descriptorFacialGlobal = d.descriptor_facial;
                if (document.getElementById('iconoEspera')) document.getElementById('iconoEspera').style.display = 'none';
                if (document.getElementById('rostroCapturado')) document.getElementById('rostroCapturado').style.display = 'block';
                if (document.getElementById('btnActivarCamara')) document.getElementById('btnActivarCamara').innerHTML = '<i class="bi bi-arrow-repeat"></i> Reemplazar Rostro';
            }
            
            toggleAula(d.color_semaforo);
            if (d.aula_especifica && document.getElementById('aula_especifica')) document.getElementById('aula_especifica').value = d.aula_especifica;
        }
    } catch (e) { console.error(e); }
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
    Swal.fire({ title: 'Analizando rostro...', html: 'Mire directamente a la cámara...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const deteccion = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
    
    if (deteccion) {
        descriptorFacialGlobal = Array.from(deteccion.descriptor); 
        
        if (streamCamara) streamCamara.getTracks().forEach(track => track.stop());
        
        if (document.getElementById('contenedorCamara')) document.getElementById('contenedorCamara').style.display = 'none';
        if (document.getElementById('btnCapturarRostro')) document.getElementById('btnCapturarRostro').style.display = 'none';
        if (document.getElementById('rostroCapturado')) document.getElementById('rostroCapturado').style.display = 'block';
        
        if (document.getElementById('btnActivarCamara')) {
            document.getElementById('btnActivarCamara').style.display = 'block';
            document.getElementById('btnActivarCamara').innerHTML = '<i class="bi bi-arrow-repeat"></i> Volver a Escanear';
        }
        
        Swal.fire("¡Completado!", "Firma facial extraída correctamente.", "success");
    } else {
        Swal.fire("Rostro no detectado", "Por favor, asegúrese de tener buena iluminación y mirar a la cámara.", "warning");
    }
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

        Swal.fire({ title: 'Guardando datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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