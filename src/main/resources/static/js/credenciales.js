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
                recuadroFoto.style.backgroundSize = 'contain';
                recuadroFoto.style.backgroundRepeat = 'no-repeat';
                recuadroFoto.style.backgroundPosition = 'center';
            }
        };
        reader.readAsDataURL(file);
    } else {
        fotoTemporalAlumno = null;
        if (recuadroFoto) recuadroFoto.style.backgroundImage = `url('/img/logo-256.png')`;
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
    if (document.getElementById('btnDescargarCredencialPNG')) document.getElementById('btnDescargarCredencialPNG').disabled = true;

    document.querySelectorAll('.infoConteo').forEach(el => el.innerText = "");
    document.querySelectorAll('.msgSeleccion').forEach(el => el.classList.remove('d-none'));

    const contGafete = document.getElementById('gafeteMuestra');
    if (contGafete) { contGafete.classList.add('d-none'); contGafete.innerHTML = ""; }

    const contCred = document.getElementById('credencialMuestraPVC');
    if (contCred) { contCred.classList.add('d-none'); }
	
	fotoTemporalAlumno = null;
	if (document.getElementById('inputFotoTemporal')) document.getElementById('inputFotoTemporal').value = "";
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
        btnPdfCred.innerHTML = `<i class="bi bi-collection-fill text-primary me-2"></i>Descargar Grupo (${alumnosDelGrupoSeleccionado.length} Credenciales PDF)`;
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
        const al = alumnoSeleccionadoInd;
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const mat = al.ncontrol || al.matricula || '';

        if (document.getElementById('pvcNombre')) document.getElementById('pvcNombre').innerText = `${al.nombre} ${pat} ${matApe}`.trim().toUpperCase();
        if (document.getElementById('pvcMatricula')) document.getElementById('pvcMatricula').innerText = mat;
        if (document.getElementById('pvcEspecialidad')) document.getElementById('pvcEspecialidad').innerText = al.especialidad || 'N/A';
        if (document.getElementById('pvcGradoGrupo')) document.getElementById('pvcGradoGrupo').innerText = `${al.grado || ''}° "${al.grupo || ''}" ${al.turno || 'Matutino'}`;
        if (document.getElementById('pvcCurp')) document.getElementById('pvcCurp').innerText = al.curp || 'N/A';
        if (document.getElementById('pvcVigencia')) document.getElementById('pvcVigencia').innerText = cfgSistema.vigencia_actual || 'Agosto 2027';

        const recuadroFoto = document.getElementById('pvcFoto');
        if (recuadroFoto) {
            if (fotoTemporalAlumno) {
                recuadroFoto.style.backgroundImage = `url(${fotoTemporalAlumno})`;
            } else {
                recuadroFoto.style.backgroundImage = `url('/img/logo-256.png')`;
            }
            recuadroFoto.style.backgroundSize = 'contain';
            recuadroFoto.style.backgroundRepeat = 'no-repeat';
            recuadroFoto.style.backgroundPosition = 'center';
        }

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

// --- DESCARGA DE GAFETES Y CREDENCIALES (PDF Y PNG ZIP) ---

async function descargarGafetesDelGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return;
    Swal.fire({ title: 'Generando PDF de Gafetes...', text: 'Por favor espere unos segundos', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'letter');
        
        let col = 0, row = 0;
        const widthGafete = 90, heightGafete = 120;
        const marginX = 15, marginY = 15;

        for (let i = 0; i < alumnosDelGrupoSeleccionado.length; i++) {
            const al = alumnosDelGrupoSeleccionado[i];
            const imgData = await generarImagenGafete(al);

            if (i > 0 && i % 4 === 0) {
                pdf.addPage();
                col = 0; row = 0;
            } else if (i > 0 && i % 2 === 0) {
                row++; col = 0;
            } else if (i > 0) {
                col++;
            }

            const x = marginX + (col * (widthGafete + 10));
            const y = marginY + (row * (heightGafete + 10));
            pdf.addImage(imgData, 'PNG', x, y, widthGafete, heightGafete);
        }

        const esp = document.getElementById('filtroEspCred').value || 'GRUPO';
        const gpo = document.getElementById('filtroGpoCred').value || '';
        pdf.save(`Gafetes_${esp}_${gpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar el PDF de gafetes.", "error");
    }
}

async function descargarPNGsDelGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return;
    Swal.fire({ title: 'Generando imágenes PNG...', text: 'Empaquetando archivo ZIP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const zip = new JSZip();
        for (let i = 0; i < alumnosDelGrupoSeleccionado.length; i++) {
            const al = alumnosDelGrupoSeleccionado[i];
            const mat = al.ncontrol || al.matricula || `ALUMNO_${i}`;
            const imgData = await generarImagenGafete(al);
            const base64Data = imgData.replace(/^data:image\/png;base64,/, "");
            zip.file(`Gafete_${mat}.png`, base64Data, { base64: true });
        }

        const esp = document.getElementById('filtroEspCred').value || 'GRUPO';
        const gpo = document.getElementById('filtroGpoCred').value || '';
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Gafetes_PNG_${esp}_${gpo}.zip`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo empaquetar el archivo ZIP.", "error");
    }
}

// --- GENERACIÓN DE IMÁGENES DE CREDENCIALES VIA HTML2CANVAS (1:1 FIDELIDAD) ---

async function generarCanvasCredencialFrente(alumno) {
    if (plantillaFrente) {
        return generarCanvasCustomFrente(alumno);
    }
    return new Promise(async (resolve) => {
        let container = document.getElementById('tempCardContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tempCardContainer';
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            document.body.appendChild(container);
        }

        const pat = alumno.apepat || alumno.primerApellido || '';
        const matApe = alumno.apemat || alumno.segundoApellido || '';
        const nombreCompleto = `${alumno.nombre} ${pat} ${matApe}`.trim().toUpperCase();
        const mat = alumno.ncontrol || alumno.matricula || '';
        const fotoSrc = fotoTemporalAlumno || '/img/logo-256.png';
        const vigencia = cfgSistema.vigencia_actual || 'Agosto 2027';

        container.innerHTML = `
            <div id="cardFrenteTemp" style="width: 58mm; height: 88mm; background: white; border: 2px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: Arial, sans-serif; text-align: left; box-sizing: border-box;">
                <div style="background-color: #7b1b37; padding: 5px 2px; color: white; text-align: center;">
                    <div style="font-size: 8.5px; font-weight: bold; letter-spacing: 0.5px;">CBTis No. 134</div>
                    <div style="font-size: 6px; opacity: 0.9;">CREDENCIAL ESCOLAR DE ESTUDIANTE</div>
                </div>
                <div style="padding: 8px 6px;">
                    <div style="width: 28mm; height: 34mm; background: #eee; border: 1px dashed #999; margin: 0 auto 6px auto; background-image: url('${fotoSrc}'); background-size: contain; background-repeat: no-repeat; background-position: center; border-radius: 4px;"></div>
                    <div style="font-size: 9.5px; font-weight: bold; color: #222; text-transform: uppercase; line-height: 1.1; margin-bottom: 8px; text-align: center;">${nombreCompleto}</div>
                    
                    <div style="background: #f8f9fa; border-radius: 6px; padding: 8px 10px; font-size: 7px; color: #333; margin: 8px auto 0 auto; border: 1px solid #e9ecef; line-height: 1.6; text-align: center;">
                        <div><strong>MATRÍCULA:</strong> <span style="color: #7b1b37; font-weight: bold;">${mat}</span></div>
                        <div><strong>CARRERA:</strong> <span>${alumno.especialidad || 'N/A'}</span></div>
                        <div><strong>GRUPO:</strong> <span>${alumno.grado || ''}° "${alumno.grupo || ''}" ${alumno.turno || 'Matutino'}</span></div>
                        <div><strong>CURP:</strong> <span>${alumno.curp || 'N/A'}</span></div>
                        <div><strong>VIGENCIA:</strong> <span>${vigencia}</span></div>
                    </div>
                </div>
                <div style="position: absolute; bottom: 0; width: 100%; background: #7b1b37; font-size: 6px; color: white; font-weight: bold; padding: 3px 0; text-align: center;">CBTIS 134 • SISTEMA DE CONTROL ESCOLAR</div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const canvas = await html2canvas(targetEl, {
            scale: 4,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        resolve(canvas.toDataURL("image/png"));
    });
}

async function generarCanvasCredencialReverso(alumno) {
    if (plantillaReverso) {
        return generarCanvasCustomReverso(alumno);
    }
    return new Promise(async (resolve) => {
        let container = document.getElementById('tempCardContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tempCardContainer';
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '-9999px';
            document.body.appendChild(container);
        }

        const mat = alumno.ncontrol || alumno.matricula || '';
        const textoQR = (alumno.qrCode || alumno.qr_texto || `${mat}|${alumno.nombre}`).substring(0, 100);
        const qrImgData = await generarQRConTigre(textoQR);
        const director = cfgSistema.nombre_director || "JOSE MARTÍN RODEA ZUÑIGA";

        container.innerHTML = `
            <div id="cardReversoTemp" style="width: 58mm; height: 88mm; background: white; border: 2px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: Arial, sans-serif; text-align: center; box-sizing: border-box;">
                <div style="background-color: #7b1b37; padding: 5px 2px; color: white; text-align: center;">
                    <div style="font-size: 8.5px; font-weight: bold; letter-spacing: 0.5px;">INFORMACIÓN DE CONTROL Y ACCESO</div>
                </div>
                <div style="padding: 12px 6px;">
                    <div style="width: 34mm; height: 34mm; margin: 4px auto 8px auto;">
                        <img src="${qrImgData}" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>
                    <div style="font-size: 6.5px; color: #333; line-height: 1.3; margin-bottom: 15px;">
                        Esta credencial es personal e intransferible.<br>
                        Acredita al portador como alumno(a) del plantel CBTis No. 134.
                    </div>
                    
                    <div style="width: 40mm; border-bottom: 1px solid #333; margin: 15px auto 4px auto;"></div>
                    <div style="font-size: 8px; font-weight: bold; color: #000;">${director}</div>
                    <div style="font-size: 6.5px; color: #555;">Director del Plantel CBTis No. 134</div>
                </div>
                <div style="position: absolute; bottom: 0; width: 100%; background: #7b1b37; font-size: 6px; color: white; font-weight: bold; padding: 3px 0; text-align: center;">CLAVE CCT: 12DCT0001L</div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const canvas = await html2canvas(targetEl, {
            scale: 4,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        resolve(canvas.toDataURL("image/png"));
    });
}

async function generarCredencialPDF(esMasivo) {
    const listaAlumnos = esMasivo ? alumnosDelGrupoSeleccionado : (alumnoSeleccionadoInd ? [alumnoSeleccionadoInd] : []);
    if (listaAlumnos.length === 0) return Swal.fire("Aviso", "Seleccione al menos un alumno para generar la credencial.", "warning");

    Swal.fire({ title: 'Generando Credenciales PDF...', text: 'Procesando diseño en alta definición (CR80)', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', [54, 85.6]);

        for (let i = 0; i < listaAlumnos.length; i++) {
            const al = listaAlumnos[i];
            const imgFrente = await generarCanvasCredencialFrente(al);
            const imgReverso = await generarCanvasCredencialReverso(al);

            if (i > 0) pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgFrente, 'PNG', 0, 0, 54, 85.6);

            pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgReverso, 'PNG', 0, 0, 54, 85.6);
        }

        const matOrGpo = esMasivo ? `Grupo_${document.getElementById('filtroGpoCred').value}` : (listaAlumnos[0].ncontrol || listaAlumnos[0].matricula);
        pdf.save(`Credencial_PVC_${matOrGpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron generar las credenciales PDF.", "error");
    }
}

async function descargarCredencialIndividualPNG() {
    if (!alumnoSeleccionadoInd) return Swal.fire("Aviso", "Seleccione un alumno de la tabla.", "warning");

    Swal.fire({ title: 'Generando PNGs...', text: 'Empaquetando en ZIP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const zip = new JSZip();
        const mat = alumnoSeleccionadoInd.ncontrol || alumnoSeleccionadoInd.matricula || 'ALUMNO';
        
        const imgFrente = await generarCanvasCredencialFrente(alumnoSeleccionadoInd);
        const imgReverso = await generarCanvasCredencialReverso(alumnoSeleccionadoInd);

        zip.file(`Credencial_Frente_${mat}.png`, imgFrente.replace(/^data:image\/png;base64,/, ""), { base64: true });
        zip.file(`Credencial_Reverso_${mat}.png`, imgReverso.replace(/^data:image\/png;base64,/, ""), { base64: true });

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `Credencial_${mat}.zip`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron generar las imágenes PNG.", "error");
    }
}