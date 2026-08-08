let alumnosCache = [];
let especialidadesConfig = [];
let alumnosDelGrupoSeleccionado = [];
let cfgSistema = {};
let alumnoSeleccionadoInd = null;
let plantillaFrente = null;
let plantillaReverso = null;
let fotoTemporalAlumno = null;

document.getElementById('inputFotoTemporal')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const recuadroFoto = document.getElementById('pvcFoto');

    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { 
            fotoTemporalAlumno = event.target.result; 
            if (recuadroFoto) {
                recuadroFoto.style.backgroundImage = `url(${fotoTemporalAlumno})`;
                recuadroFoto.style.backgroundSize = 'cover';
                recuadroFoto.style.backgroundPosition = 'center';
            }
        };
        reader.readAsDataURL(file);
    } else {
        fotoTemporalAlumno = null;
        if (recuadroFoto) recuadroFoto.style.backgroundImage = 'none';
    }
});

document.getElementById('inputBgFrente')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { plantillaFrente = event.target.result; };
        reader.readAsDataURL(file);
    }
});

document.getElementById('inputBgReverso')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { plantillaReverso = event.target.result; };
        reader.readAsDataURL(file);
    }
});

function limpiarPlantillasPVC() {
    plantillaFrente = null;
    plantillaReverso = null;
    if (document.getElementById('inputBgFrente')) document.getElementById('inputBgFrente').value = "";
    if (document.getElementById('inputBgReverso')) document.getElementById('inputBgReverso').value = "";
    Swal.fire({ icon: 'success', title: 'Fondos removidos', text: 'Se utilizará el diseño base del sistema.', toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
}

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionSistema();
    await cargarConfiguracionYEspecialidades();
    await cargarAlumnosActivos();
});

async function cargarConfiguracionSistema() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            cfgSistema = await res.json();
        }
    } catch (e) { console.error("Error al obtener config:", e); }
}

async function cargarConfiguracionYEspecialidades() {
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (res.ok) {
            const data = await res.json();
            especialidadesConfig = data.especialidades || [];
            
            const selectEsp = document.getElementById('filtroEspCred');
            if (selectEsp) {
                selectEsp.innerHTML = '<option value="">-- Seleccione Carrera --</option>';
                especialidadesConfig.forEach(esp => {
                    selectEsp.innerHTML += `<option value="${esp.nombre}">${esp.nombre}</option>`;
                });
            }
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

async function cargarAlumnosActivos() {
    try {
        Swal.fire({ title: 'Preparando sistema...', didOpen: () => Swal.showLoading() });
        const res = await fetch('/api/alumnos');
        if (res.ok) {
            const data = await res.json();
            alumnosCache = data.filter(al => (al.estatus_escolar || al.estatus || 'Activo') === 'Activo');
        }
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo cargar el padrón de alumnos.", "error");
    }
}

function limpiarVistaPrevia() {
    if (document.getElementById('btnDescargarGafetesPDF')) document.getElementById('btnDescargarGafetesPDF').disabled = true;
    if (document.getElementById('btnDescargarGafetesPNG')) document.getElementById('btnDescargarGafetesPNG').disabled = true;
    if (document.getElementById('btnDescargarCredencialMasiva')) document.getElementById('btnDescargarCredencialMasiva').disabled = true;
    if (document.getElementById('btnDescargarCredencialInd')) document.getElementById('btnDescargarCredencialInd').disabled = true;

    document.querySelectorAll('.infoConteo').forEach(el => el.innerText = "");
    document.querySelectorAll('.msgSeleccion').forEach(el => el.classList.remove('d-none'));

    const contGafete = document.getElementById('gafeteMuestra');
    if (contGafete) { contGafete.classList.add('d-none'); contGafete.innerHTML = ""; }

    const contCred = document.getElementById('credencialMuestraPVC');
    if (contCred) { contCred.classList.add('d-none'); }
	
	fotoTemporalAlumno = null;
	if (document.getElementById('inputFotoTemporal')) document.getElementById('inputFotoTemporal').value = "";
	if (document.getElementById('btnDescargarCredencialPNG')) document.getElementById('btnDescargarCredencialPNG').disabled = true;
    
    alumnoSeleccionadoInd = null;
}

function alCambiarEspecialidad() {
    const especialidad = document.getElementById('filtroEspCred').value;
    const selectGpo = document.getElementById('filtroGpoCred');
    const tarjeta = document.getElementById('tarjetaVistaPrevia');
    const tbody = document.getElementById('tablaAlumnosCredenciales');

    if (!especialidad) {
        selectGpo.disabled = true;
        selectGpo.innerHTML = '<option value="">Seleccione especialidad</option>';
        if(tarjeta) tarjeta.style.borderTop = "5px solid var(--guinda) !important";
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">Seleccione un grupo para ver a los alumnos.</td></tr>';
        limpiarVistaPrevia();
        return;
    }

    const espData = especialidadesConfig.find(e => e.nombre === especialidad);
    const colorEsp = espData ? espData.color : 'var(--guinda)';
    if(tarjeta) tarjeta.style.borderTop = `5px solid ${colorEsp}`;

    const gruposReales = [...new Set(alumnosCache
        .filter(al => al.especialidad === especialidad)
        .map(al => `${al.grado}° "${al.grupo}"`)
    )].sort();

    if (gruposReales.length === 0) {
        selectGpo.disabled = true;
        selectGpo.innerHTML = '<option value="">Sin grupos activos</option>';
        tbody.innerHTML = `<tr><td colspan="3" class="text-muted py-4">No se encontraron alumnos activos en ${especialidad}.</td></tr>`;
        limpiarVistaPrevia();
        return;
    }

    selectGpo.disabled = false;
    selectGpo.innerHTML = '<option value="">-- Seleccione Grupo --</option>';
    
    gruposReales.forEach(gpo => {
        selectGpo.innerHTML += `<option value='${gpo}'>${gpo}</option>`;
    });

    tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">Seleccione un grupo para ver a los alumnos.</td></tr>';
    limpiarVistaPrevia();
}

function renderizarAlumnosGrupo() {
    const especialidad = document.getElementById('filtroEspCred').value;
    const grupoSelect = document.getElementById('filtroGpoCred').value;
    const tbody = document.getElementById('tablaAlumnosCredenciales');

    const btnPdfGaf = document.getElementById('btnDescargarGafetesPDF');
    const btnPngGaf = document.getElementById('btnDescargarGafetesPNG');
    const btnPdfCred = document.getElementById('btnDescargarCredencialMasiva');

    if (!grupoSelect) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">Seleccione un grupo para ver a los alumnos.</td></tr>';
        limpiarVistaPrevia();
        return;
    }

    alumnosDelGrupoSeleccionado = alumnosCache.filter(al => 
        al.especialidad === especialidad && `${al.grado}° "${al.grupo}"` === grupoSelect
    ).sort((a, b) => `${a.apepat || a.primerApellido || ''} ${a.apemat || a.segundoApellido || ''} ${a.nombre}`.localeCompare(`${b.apepat || b.primerApellido || ''} ${b.apemat || b.segundoApellido || ''} ${b.nombre}`));

    if (alumnosDelGrupoSeleccionado.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">No hay alumnos activos en este grupo.</td></tr>';
        limpiarVistaPrevia();
        return;
    }

    tbody.innerHTML = "";
    alumnosDelGrupoSeleccionado.forEach(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        tbody.innerHTML += `
            <tr style="cursor: pointer;" onclick="seleccionarAlumnoCredencial('${mat}', this)">
                <td class="fw-bold text-secondary">${mat}</td>
                <td class="text-start fw-bold" style="font-size: 0.85rem;">${pat} ${matApe} ${al.nombre}</td>
                <td><i class="bi bi-check-circle-fill text-success"></i></td>
            </tr>`;
    });

    if (btnPdfGaf) {
        btnPdfGaf.disabled = false;
        btnPdfGaf.innerHTML = `<i class="bi bi-file-earmark-pdf-fill me-2"></i>Descargar ${alumnosDelGrupoSeleccionado.length} Gafetes (PDF)`;
    }
    if (btnPngGaf) {
        btnPngGaf.disabled = false;
        btnPngGaf.innerHTML = `<i class="bi bi-file-zip-fill text-warning me-2"></i>Descargar ${alumnosDelGrupoSeleccionado.length} PNGs (ZIP)`;
    }
    if (btnPdfCred) {
        btnPdfCred.disabled = false;
        btnPdfCred.innerHTML = `<i class="bi bi-collection-fill text-primary me-2"></i>Descargar Grupo (Credenciales PDF)`;
    }

    document.querySelectorAll('.infoConteo').forEach(el => {
        el.innerText = `Hojas estimadas (PDF): ${Math.ceil(alumnosDelGrupoSeleccionado.length / 8)}`;
    });

    const primerMat = alumnosDelGrupoSeleccionado[0].ncontrol || alumnosDelGrupoSeleccionado[0].matricula;
    seleccionarAlumnoCredencial(primerMat, tbody.firstElementChild);
}

function seleccionarAlumnoCredencial(matricula, filaHtml) {
    alumnoSeleccionadoInd = alumnosCache.find(al => (al.ncontrol || al.matricula) === matricula);
    if (!alumnoSeleccionadoInd) return;

    document.querySelectorAll('#tablaAlumnosCredenciales tr').forEach(tr => tr.classList.remove('table-active'));
    if (filaHtml) filaHtml.classList.add('table-active');

    document.querySelectorAll('.msgSeleccion').forEach(el => el.classList.add('d-none'));

    const contGafete = document.getElementById('gafeteMuestra');
    if (contGafete) {
        contGafete.classList.remove('d-none');
        contGafete.innerHTML = `<div class="spinner-border text-secondary" role="status"></div>`;
        generarImagenGafete(alumnoSeleccionadoInd).then(img => {
            contGafete.innerHTML = `<img src="${img}" class="img-fluid border rounded shadow-sm" style="max-height: 250px;">`;
        });
    }

    const contCred = document.getElementById('credencialMuestraPVC');
    if (contCred) {
        contCred.classList.remove('d-none');
        const pat = alumnoSeleccionadoInd.apepat || alumnoSeleccionadoInd.primerApellido || '';
        const mat = alumnoSeleccionadoInd.ncontrol || alumnoSeleccionadoInd.matricula || '';
        document.getElementById('pvcNombre').innerText = `${alumnoSeleccionadoInd.nombre} ${pat}`.toUpperCase();
        document.getElementById('pvcMatricula').innerText = mat;

        const recuadroFoto = document.getElementById('pvcFoto');
        if (recuadroFoto) recuadroFoto.style.backgroundImage = 'none';

        const inputFoto = document.getElementById('inputFotoTemporal');
        if(inputFoto) inputFoto.value = '';
        fotoTemporalAlumno = null;
    }

    if (document.getElementById('btnDescargarCredencialInd')) document.getElementById('btnDescargarCredencialInd').disabled = false;
    if (document.getElementById('btnDescargarCredencialPNG')) document.getElementById('btnDescargarCredencialPNG').disabled = false;
}

async function generarQRConTigre(texto) {
    return new Promise((resolve) => {
        const size = 250;
        const divTemporal = document.createElement('div');
        const textoLimpio = (texto || '').substring(0, 100);
        
        new QRCode(divTemporal, { 
            text: textoLimpio, 
            width: size, 
            height: size, 
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel: QRCode.CorrectLevel.L 
        });

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            const imgQrGenerado = divTemporal.querySelector('img');
            const finalQR = new Image();
            finalQR.src = imgQrGenerado ? imgQrGenerado.src : (divTemporal.querySelector('canvas') ? divTemporal.querySelector('canvas').toDataURL() : '');

            finalQR.onload = () => {
                ctx.drawImage(finalQR, 0, 0, size, size);

                const imgTigre = new Image();
                imgTigre.src = '/img/tigres.png';
                imgTigre.onload = () => {
                    const logoSize = 60;
                    const pos = (size - logoSize) / 2;

                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(pos - 5, pos - 5, logoSize + 10, logoSize + 10);
                    ctx.drawImage(imgTigre, pos, pos, logoSize, logoSize);
                    
                    resolve(canvas.toDataURL("image/png"));
                };
                imgTigre.onerror = () => resolve(canvas.toDataURL("image/png"));
            };
            finalQR.onerror = () => resolve(divTemporal.querySelector('canvas') ? divTemporal.querySelector('canvas').toDataURL() : '');
        }, 150); 
    });
}

async function generarImagenGafete(alumno) {
    return new Promise((resolve, reject) => {
        if (!alumno) return reject("Alumno no proporcionado");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400; canvas.height = 550;

        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 400, 550);
        ctx.strokeStyle = "#888888"; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 396, 546); ctx.setLineDash([]);

        const imgTigre = new Image();
        imgTigre.src = '/img/tigres.png';
        
        imgTigre.onload = function() {
            const pat = alumno.apepat || alumno.primerApellido || '';
            const mat = alumno.ncontrol || alumno.matricula || '';
            ctx.fillStyle = "#000000"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
            ctx.fillText(`${alumno.nombre} ${pat}`.toUpperCase(), 200, 80);

            const divTemporal = document.createElement('div');
            const textoQR = (alumno.qrCode || alumno.qr_texto || `${mat}|${alumno.nombre}`).substring(0, 100);
            new QRCode(divTemporal, { text: textoQR, width: 250, height: 250, correctLevel: QRCode.CorrectLevel.L });

            setTimeout(() => {
                const imgQrGenerado = divTemporal.querySelector('img');
                if(!imgQrGenerado && !divTemporal.querySelector('canvas')) return resolve(canvas.toDataURL("image/png"));

                const finalQR = new Image();
                finalQR.src = imgQrGenerado ? imgQrGenerado.src : divTemporal.querySelector('canvas').toDataURL();
                
                finalQR.onload = function() {
                    ctx.drawImage(finalQR, 75, 120, 250, 250); 
                    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(165, 210, 70, 70);
                    ctx.drawImage(imgTigre, 170, 215, 60, 60);

                    ctx.fillStyle = "#7b1b37"; ctx.font = "bold 32px Arial";
                    ctx.fillText(mat, 200, 420);
                    ctx.fillStyle = "#555555"; ctx.font = "bold 16px Arial";
                    ctx.fillText(alumno.especialidad || "", 200, 450);

                    resolve(canvas.toDataURL("image/png"));
                };
                finalQR.onerror = () => resolve(canvas.toDataURL("image/png"));
            }, 150); 
        };
        imgTigre.onerror = () => resolve(canvas.toDataURL("image/png")); 
    });
}