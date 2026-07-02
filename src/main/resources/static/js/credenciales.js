let alumnosCache = [];
let especialidadesConfig = [];
let alumnosDelGrupoSeleccionado = [];
let cfgSistema = {};
let alumnoSeleccionadoInd = null;
let plantillaFrente = null;
let plantillaReverso = null;
let fotoTemporalAlumno = null;

// Lector de archivo para la foto temporal
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

// Lector de archivo para el Frente
document.getElementById('inputBgFrente')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { plantillaFrente = event.target.result; };
        reader.readAsDataURL(file);
    }
});

// Lector de archivo para el Reverso
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
    document.getElementById('inputBgFrente').value = "";
    document.getElementById('inputBgReverso').value = "";
    Swal.fire({ icon: 'success', title: 'Fondos removidos', text: 'Se utilizará el diseño base del sistema.', toast: true, position: 'bottom-end', timer: 3000, showConfirmButton: false });
}

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracionSistema();
    await cargarConfiguracionYEspecialidades();
    await cargarAlumnosActivos();
});

// 1. CARGAR CONFIGURACIÓN GLOBAL (Para la credencial de PVC)
async function cargarConfiguracionSistema() {
    try {
        const doc = await db.collection("configuracion").doc("sistema").get();
        if (doc.exists) {
            cfgSistema = doc.data();
        }
    } catch (e) { console.error("Error al obtener config:", e); }
}

// 2. CARGAR COLORES DE ESPECIALIDADES
async function cargarConfiguracionYEspecialidades() {
    try {
        const docEscolar = await db.collection("configuracion").doc("escolar").get();
        if (docEscolar.exists && docEscolar.data().especialidades) {
            especialidadesConfig = docEscolar.data().especialidades;
            
            const selectEsp = document.getElementById('filtroEspCred');
            selectEsp.innerHTML = '<option value="">-- Seleccione Carrera --</option>';
            
            especialidadesConfig.forEach(esp => {
                selectEsp.innerHTML += `<option value="${esp.nombre}">${esp.nombre}</option>`;
            });
        }
    } catch (e) { console.error("Error cargando especialidades:", e); }
}

// 3. CARGAR ALUMNOS A MEMORIA
async function cargarAlumnosActivos() {
    try {
        Swal.fire({ title: 'Preparando sistema...', didOpen: () => Swal.showLoading() });
        const snap = await db.collection("alumnos").where("estatus_escolar", "==", "Activo").get();
        
        alumnosCache = snap.docs.map(doc => doc.data());
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo cargar el padrón.", "error");
    }
}

// --- FUNCIÓN DE APOYO PARA LIMPIAR INTERFAZ ---
function limpiarVistaPrevia() {
    // Deshabilitar todos los botones
    document.getElementById('btnDescargarGafetesPDF').disabled = true;
    document.getElementById('btnDescargarGafetesPNG').disabled = true;
    document.getElementById('btnDescargarCredencialMasiva').disabled = true;
    document.getElementById('btnDescargarCredencialInd').disabled = true;

    document.querySelectorAll('.infoConteo').forEach(el => el.innerText = "");
    document.querySelectorAll('.msgSeleccion').forEach(el => el.classList.remove('d-none'));

    const contGafete = document.getElementById('gafeteMuestra');
    if (contGafete) { contGafete.classList.add('d-none'); contGafete.innerHTML = ""; }

    const contCred = document.getElementById('credencialMuestraPVC');
    if (contCred) { contCred.classList.add('d-none'); }
	
	fotoTemporalAlumno = null;
	if(document.getElementById('inputFotoTemporal')) document.getElementById('inputFotoTemporal').value = "";

	if(document.getElementById('btnDescargarCredencialPNG')) document.getElementById('btnDescargarCredencialPNG').disabled = true;
    
    alumnoSeleccionadoInd = null;
}

// 4. AL SELECCIONAR ESPECIALIDAD
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

    // Cambiar color de la tarjeta visualmente
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

// 5. AL SELECCIONAR GRUPO
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
    ).sort((a, b) => `${a.apepat} ${a.apemat || ''} ${a.nombre}`.localeCompare(`${b.apepat} ${b.apemat || ''} ${b.nombre}`));

    if (alumnosDelGrupoSeleccionado.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">No hay alumnos activos en este grupo.</td></tr>';
        limpiarVistaPrevia();
        return;
    }

    tbody.innerHTML = "";
    alumnosDelGrupoSeleccionado.forEach(al => {
        tbody.innerHTML += `
            <tr style="cursor: pointer;" onclick="seleccionarAlumnoCredencial('${al.matricula}', this)">
                <td class="fw-bold text-secondary">${al.matricula}</td>
                <td class="text-start fw-bold" style="font-size: 0.85rem;">${al.apepat} ${al.apemat || ''} ${al.nombre}</td>
                <td><i class="bi bi-check-circle-fill text-success"></i></td>
            </tr>`;
    });

    btnPdfGaf.disabled = false;
    btnPdfGaf.innerHTML = `<i class="bi bi-file-earmark-pdf-fill me-2"></i>Descargar ${alumnosDelGrupoSeleccionado.length} Gafetes (PDF)`;
    
    btnPngGaf.disabled = false;
    btnPngGaf.innerHTML = `<i class="bi bi-file-zip-fill text-warning me-2"></i>Descargar ${alumnosDelGrupoSeleccionado.length} PNGs (ZIP)`;

    btnPdfCred.disabled = false;
    btnPdfCred.innerHTML = `<i class="bi bi-collection-fill text-primary me-2"></i>Descargar Grupo (Credenciales PDF)`;

    document.querySelectorAll('.infoConteo').forEach(el => {
        el.innerText = `Hojas estimadas (PDF): ${Math.ceil(alumnosDelGrupoSeleccionado.length / 8)}`;
    });

    seleccionarAlumnoCredencial(alumnosDelGrupoSeleccionado[0].matricula, tbody.firstElementChild);
}

// 6. SELECCIÓN INDIVIDUAL DESDE LA TABLA
function seleccionarAlumnoCredencial(matricula, filaHtml) {
    alumnoSeleccionadoInd = alumnosCache.find(al => al.matricula === matricula);
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

    // Actualizar Muestra Credencial PVC
    const contCred = document.getElementById('credencialMuestraPVC');
    if (contCred) {
        contCred.classList.remove('d-none');
        document.getElementById('pvcNombre').innerText = `${alumnoSeleccionadoInd.nombre} ${alumnoSeleccionadoInd.apepat}`.toUpperCase();
        document.getElementById('pvcMatricula').innerText = alumnoSeleccionadoInd.matricula;

        const recuadroFoto = document.getElementById('pvcFoto');
        if (recuadroFoto) recuadroFoto.style.backgroundImage = 'none';

        const inputFoto = document.getElementById('inputFotoTemporal');
        if(inputFoto) inputFoto.value = '';
        fotoTemporalAlumno = null;
    }

    document.getElementById('btnDescargarCredencialInd').disabled = false;
    document.getElementById('btnDescargarCredencialPNG').disabled = false;
}

// DESCARGAR GAFETES MASIVOS (PDF TAMAÑO CARTA)
async function descargarGafetesDelGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return;

    Swal.fire({ title: 'Generando PDF', html: 'Armando planillas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const contenedorMasivo = document.getElementById('contenedorGafetesMasivo');
    contenedorMasivo.innerHTML = "";
    contenedorMasivo.style.display = "grid"; 
    contenedorMasivo.style.gridTemplateColumns = "repeat(4, 1fr)";
    contenedorMasivo.style.gap = "5mm";
    contenedorMasivo.style.justifyItems = "center";

    try {
        for (const al of alumnosDelGrupoSeleccionado) {
            const imgDataUrl = await generarImagenGafete(al);
            const divGafete = document.createElement('div');

            divGafete.style.pageBreakInside = "avoid";

            divGafete.innerHTML = `<img src="${imgDataUrl}" style="width: 40mm; height: 55mm; display: block; margin: 0 auto;">`;
            contenedorMasivo.appendChild(divGafete);
        }

        const especialidad = document.getElementById('filtroEspCred').value;
        const grupo = document.getElementById('filtroGpoCred').value.replace('° ', '').replace(/"/g, '');

        const opt = {
            margin: [10, 5, 10, 5], 
            filename: `Gafetes_QR_${especialidad}_${grupo}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(contenedorMasivo).save();
        contenedorMasivo.style.display = "none";
        contenedorMasivo.innerHTML = "";
        Swal.fire("¡Listo!", "Planilla PDF descargada.", "success");

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "Problema al generar el PDF.", "error");
        contenedorMasivo.style.display = "none";
    }
}

// DESCARGAR GAFETES EN ZIP (PNGs)
async function descargarPNGsDelGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return;

    Swal.fire({ title: 'Empaquetando Gafetes', html: 'Comprimiendo imágenes en ZIP...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const zip = new JSZip();
        
        for (const al of alumnosDelGrupoSeleccionado) {
            const imgDataUrl = await generarImagenGafete(al); 
            const base64Data = imgDataUrl.split(',')[1]; 
            const nombreArchivo = `${al.matricula}_${al.apepat}_${al.apemat||''}`.replace(/ /g, "_") + ".png";
            zip.file(nombreArchivo, base64Data, {base64: true});
        }

        const content = await zip.generateAsync({type:"blob"});
        const especialidad = document.getElementById('filtroEspCred').value;
        const grupo = document.getElementById('filtroGpoCred').value.replace('° ', '').replace(/"/g, '');
        
        saveAs(content, `Gafetes_Imagenes_${especialidad}_${grupo}.zip`);
        Swal.fire("¡Éxito!", `ZIP con ${alumnosDelGrupoSeleccionado.length} imágenes descargado.`, "success");

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar el archivo ZIP.", "error");
    }
}

async function generarQRConTigre(texto) {
    return new Promise((resolve) => {
        const size = 250;
        const divTemporal = document.createElement('div');
        new QRCode(divTemporal, { 
            text: texto, 
            width: size, 
            height: size, 
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel: QRCode.CorrectLevel.M 
        });

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            const imgQrGenerado = divTemporal.querySelector('img');
            const finalQR = new Image();
            finalQR.src = imgQrGenerado ? imgQrGenerado.src : divTemporal.querySelector('canvas').toDataURL();

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
        }, 150); 
    });
}

// GENERAR CREDENCIALES (PVC / jsPDF)
async function generarCredencialPDF(esMasivo = false) {
    const { jsPDF } = window.jspdf;
    
    let listaAlumnos = [];
    if (esMasivo) {
        if (alumnosDelGrupoSeleccionado.length === 0) return;
        listaAlumnos = alumnosDelGrupoSeleccionado;
    } else {
        if (!alumnoSeleccionadoInd) return Swal.fire("Aviso", "Seleccione un alumno.", "warning");
        listaAlumnos = [alumnoSeleccionadoInd];
    }

    try {
        Swal.fire({ title: 'Generando Credenciales...', html: 'Procesando diseño y fotografías...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const director = cfgSistema.nombre_director || "JOSE MARTIN RODEA ZUÑIGA";
        const cct = cfgSistema.cct_escuela || "12DCT0001L";
        const telefono = cfgSistema.telefono_escuela || "01 747 47 2 34 64";
        const vigencia = cfgSistema.vigencia_actual || "Agosto 2026";
        const maroon = [123, 27, 55];

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [54, 85.6] });

        for (let i = 0; i < listaAlumnos.length; i++) {
            const al = listaAlumnos[i];

            if (i > 0) doc.addPage([54, 85.6], 'portrait');

            // ----------------------------------------------------
            // CARA FRONTAL (ANVERSO)
            // ----------------------------------------------------
            if (plantillaFrente) {
                doc.addImage(plantillaFrente, 'PNG', 0, 0, 54, 85.6);
            } else {

                doc.setFillColor(...maroon);
                doc.rect(0, 0, 54, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.text("ALUMNO", 27, 5, { align: "center" });
            }

            if (fotoTemporalAlumno && !esMasivo) {

                doc.addImage(fotoTemporalAlumno, 'JPEG', 14.5, 10, 25, 30);
            } else if (al.foto_url) {

                try {
                    doc.addImage(al.foto_url, 'JPEG', 14.5, 10, 25, 30);
                } catch (err) {
                    dibujarPlaceholderFoto(doc);
                }
            } else {

                dibujarPlaceholderFoto(doc);
            }

            doc.setTextColor(0, 0, 0); 
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(`${al.nombre} ${al.apepat} ${al.apemat || ''}`.toUpperCase(), 27, 45, { align: "center" });

            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.text(`Carrera: ${al.especialidad}`, 5, 51);
            doc.text(`Grado: ${al.grado}°      Grupo: ${al.grupo}`, 5, 55);
            doc.text(`No. de control: ${al.matricula}`, 5, 59);
            doc.text(`Curp: ${al.curp}`, 5, 63);

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text("CBTIS 134", 27, 72, { align: "center" });
            doc.setFontSize(6);
            doc.setFont("helvetica", "normal");
            doc.text('"Nicolas Catalan"', 27, 75, { align: "center" });
            doc.text(`C.C.T.: ${cct}`, 27, 78, { align: "center" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6);
            doc.text(`VIGENCIA ${vigencia.toUpperCase()}`, 52, 40, { angle: 270, renderingMode: "fill" });


            // ----------------------------------------------------
            // CARA TRASERA (REVERSO)
            // ----------------------------------------------------
            doc.addPage([54, 85.6], 'portrait');

            if (plantillaReverso) {
                doc.addImage(plantillaReverso, 'PNG', 0, 0, 54, 85.6);
            }

            doc.setFontSize(5.5);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("ESTA IDENTIFICACION ES PROPIEDAD DEL CBTIS 134", 27, 8, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.text("CARR. NAL. MEX-ACA COL SALUBRIDAD", 27, 11, { align: "center" });
            doc.text("CHILPANCINGO, GRO. C.P.39096", 27, 14, { align: "center" });
            doc.text(`TEL.- ${telefono}`, 27, 17, { align: "center" });

            doc.text("__________________________", 27, 65, { align: "center" });
            doc.setFont("helvetica", "bold");
            doc.text("DIRECTOR DEL PLANTEL", 27, 69, { align: "center" });
            doc.text(director.toUpperCase(), 27, 72, { align: "center" });

            doc.setFontSize(5);
            doc.setFont("helvetica", "italic");
            doc.text('"POR QUE PRESTIGIO SE GANA CON ESFUERZO..."', 27, 80, { align: "center" });
            doc.text("SOMOS CBTIS 134", 27, 83, { align: "center" });

            const textoQR = al.qr_texto || `${al.matricula}|${al.nombre} ${al.apepat}`;
            const qrDataURL = await generarQRConTigre(textoQR); 
            doc.addImage(qrDataURL, 'PNG', 14.5, 23, 25, 25);
        }

        const nombreArchivo = esMasivo 
            ? `Credenciales_PVC_${document.getElementById('filtroEspCred').value}_${document.getElementById('filtroGpoCred').value.replace('° ', '')}.pdf`
            : `Credencial_PVC_${listaAlumnos[0].matricula}.pdf`;

        doc.save(nombreArchivo.replace(/"/g, ''));
        Swal.close();

    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar la credencial", "error");
    }
}

function dibujarPlaceholderFoto(doc) {
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.rect(14.5, 10, 25, 30, 'FD'); 
    doc.setTextColor(150);
    doc.setFontSize(6);
    doc.text("FOTOGRAFÍA", 27, 25, { align: "center" });
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
            ctx.fillStyle = "#000000"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
            ctx.fillText(`${alumno.nombre} ${alumno.apepat}`.toUpperCase(), 200, 80);

            const divTemporal = document.createElement('div');
            const textoQR = alumno.qr_texto || `${alumno.matricula}|${alumno.nombre} ${alumno.apepat}`;
            new QRCode(divTemporal, { text: textoQR, width: 250, height: 250, correctLevel: QRCode.CorrectLevel.M });

            setTimeout(() => {
                const imgQrGenerado = divTemporal.querySelector('img');
                if(!imgQrGenerado) return resolve(canvas.toDataURL("image/png"));

                const finalQR = new Image();
                finalQR.src = imgQrGenerado.src;
                
                finalQR.onload = function() {
                    ctx.drawImage(finalQR, 75, 120, 250, 250); 
                    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(165, 210, 70, 70);
                    ctx.drawImage(imgTigre, 170, 215, 60, 60);

                    ctx.fillStyle = "#7b1b37"; ctx.font = "bold 32px Arial";
                    ctx.fillText(alumno.matricula || "", 200, 420);
                    ctx.fillStyle = "#555555"; ctx.font = "bold 16px Arial";
                    ctx.fillText(alumno.especialidad || "", 200, 450);

                    resolve(canvas.toDataURL("image/png"));
                };
            }, 150); 
        };
        imgTigre.onerror = () => resolve(canvas.toDataURL("image/png")); 
    });
}

async function descargarCredencialIndividualPNG() {
    if (!alumnoSeleccionadoInd) return Swal.fire("Aviso", "Seleccione un alumno.", "warning");
    
    Swal.fire({ title: 'Procesando Imágenes', html: 'Renderizando frente y reverso...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const al = alumnoSeleccionadoInd;
        const zip = new JSZip();
        
        const imgFrente = await renderizarCaraCanvas(al, 'FRENTE');
        const imgReverso = await renderizarCaraCanvas(al, 'REVERSO');

        zip.file(`${al.matricula}_Frente.png`, imgFrente.split(',')[1], {base64: true});
        zip.file(`${al.matricula}_Reverso.png`, imgReverso.split(',')[1], {base64: true});

        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, `Credencial_${al.matricula}_PNG.zip`);
        
        Swal.fire("¡Éxito!", "Se descargó un archivo ZIP con el frente y reverso.", "success");

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Fallo al generar las imágenes PNG.", "error");
    }
}

async function renderizarCaraCanvas(al, cara) {
    return new Promise(async (resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scale = 12; 
        canvas.width = 54 * scale;
        canvas.height = 85.6 * scale;

        const director = cfgSistema.nombre_director || "JOSE MARTIN RODEA ZUÑIGA";
        const cct = cfgSistema.cct_escuela || "12DCT0001L";
        const telefono = cfgSistema.telefono_escuela || "01 747 47 2 34 64";
        const vigencia = cfgSistema.vigencia_actual || "Agosto 2026";

        ctx.fillStyle = "#FFFFFF"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (cara === 'FRENTE') {
            if (plantillaFrente) {
                const imgBg = new Image(); imgBg.src = plantillaFrente;
                await new Promise(r => { imgBg.onload = r; });
                ctx.drawImage(imgBg, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = "#7b1b37"; ctx.fillRect(0, 0, canvas.width, 8*scale);
                ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
                ctx.fillText("ALUMNO", canvas.width/2, 6*scale);
            }

            if (fotoTemporalAlumno) {
                const imgFoto = new Image(); imgFoto.src = fotoTemporalAlumno;
                await new Promise(r => { imgFoto.onload = r; });
                ctx.drawImage(imgFoto, 14.5*scale, 10*scale, 25*scale, 30*scale);
            } else {
                ctx.fillStyle = "#eeeeee"; ctx.fillRect(14.5*scale, 10*scale, 25*scale, 30*scale);
            }


            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            ctx.font = "bold 32px Arial"; 
            ctx.fillText(`${al.nombre} ${al.apepat} ${al.apemat || ''}`.toUpperCase(), canvas.width/2, 45*scale);
            
            ctx.textAlign = "left"; 
            ctx.font = "20px Arial";
            ctx.fillText(`Carrera: ${al.especialidad}`, 5*scale, 51*scale);
            ctx.fillText(`Grado: ${al.grado}°      Grupo: ${al.grupo}`, 5*scale, 55*scale);
            ctx.fillText(`No. de control: ${al.matricula}`, 5*scale, 59*scale);
            ctx.fillText(`Curp: ${al.curp}`, 5*scale, 63*scale);

            ctx.textAlign = "center";
            ctx.font = "bold 24px Arial";
            ctx.fillText("CBTIS 134", canvas.width/2, 72*scale);
            ctx.font = "18px Arial";
            ctx.fillText('"Nicolas Catalan"', canvas.width/2, 75*scale);
            ctx.fillText(`C.C.T.: ${cct}`, canvas.width/2, 78*scale);

            ctx.save();
            ctx.translate(52*scale, 40*scale);
            ctx.rotate(-Math.PI / 2);
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`VIGENCIA ${vigencia.toUpperCase()}`, 0, 0);
            ctx.restore();

        } else {
            if (plantillaReverso) {
                const imgBg = new Image(); imgBg.src = plantillaReverso;
                await new Promise(r => { imgBg.onload = r; });
                ctx.drawImage(imgBg, 0, 0, canvas.width, canvas.height);
            }

            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            ctx.font = "bold 18px Arial";
            ctx.fillText("ESTA IDENTIFICACION ES PROPIEDAD DEL CBTIS 134", canvas.width/2, 8*scale);
            ctx.font = "18px Arial";
            ctx.fillText("CARR. NAL. MEX-ACA COL SALUBRIDAD", canvas.width/2, 11*scale);
            ctx.fillText("CHILPANCINGO, GRO. C.P.39096", canvas.width/2, 14*scale);
            ctx.fillText(`TEL.- ${telefono}`, canvas.width/2, 17*scale);
            
            ctx.fillText("__________________________", canvas.width/2, 65*scale);
            ctx.font = "bold 18px Arial";
            ctx.fillText("DIRECTOR DEL PLANTEL", canvas.width/2, 69*scale);
            ctx.fillText(director.toUpperCase(), canvas.width/2, 72*scale);

            ctx.font = "italic 16px Arial";
            ctx.fillText('"POR QUE PRESTIGIO SE GANA CON ESFUERZO..."', canvas.width/2, 80*scale);
            ctx.fillText("SOMOS CBTIS 134", canvas.width/2, 83*scale);

            const textoQR = al.qr_texto || `${al.matricula}|${al.nombre} ${al.apepat}`;
            const qrDataURL = await generarQRConTigre(textoQR);
            const imgQr = new Image(); imgQr.src = qrDataURL;
            await new Promise(r => { imgQr.onload = r; });
            ctx.drawImage(imgQr, 14.5*scale, 23*scale, 25*scale, 25*scale);
        }

        resolve(canvas.toDataURL("image/png"));
    });
}