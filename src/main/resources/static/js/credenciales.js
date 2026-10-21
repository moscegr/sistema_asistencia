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
        const fotoDefault = (alumnoSeleccionadoInd && (alumnoSeleccionadoInd.fotoUrl || alumnoSeleccionadoInd.foto_url || alumnoSeleccionadoInd.foto)) || '/img/default_avatar.png';
        if (recuadroFoto) {
            recuadroFoto.style.backgroundImage = `url('${fotoDefault}')`;
            recuadroFoto.style.backgroundSize = 'contain';
            recuadroFoto.style.backgroundRepeat = 'no-repeat';
            recuadroFoto.style.backgroundPosition = 'center';
        }
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

            const selectEsp = document.getElementById('filtroEspCred');
            if (selectEsp) {
                const espReales = [...new Set(alumnosCache.map(a => (a.especialidad || '').trim()).filter(Boolean))];
                espReales.forEach(espNombre => {
                    if (!Array.from(selectEsp.options).some(opt => opt.value.toUpperCase() === espNombre.toUpperCase())) {
                        const opt = document.createElement('option');
                        opt.value = espNombre;
                        opt.textContent = espNombre;
                        selectEsp.appendChild(opt);
                    }
                    if (!especialidadesConfig.some(e => (e.nombre || '').toUpperCase() === espNombre.toUpperCase())) {
                        especialidadesConfig.push({ nombre: espNombre, color: '#7b1b37', turno: 'Matutino' });
                    }
                });
            }
        }
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo cargar el padrón de alumnos.", "error");
    }
}

function limpiarVistaPrevia() {
    const ids = [
        'btnDescargarGafeteIndPDF',
        'btnDescargarGafetesPDF', 'btnDescargarGafetesPNG',
        'btnDescargarCredencialIndTermico',
        'btnDescargarCredencialMasivaPlanilla', 'btnDescargarCredencialMasivaTermica'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });

    document.querySelectorAll('.infoConteo, .infoConteoCred').forEach(el => el.innerText = "");
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

    const espData = especialidadesConfig.find(e => (e.nombre || '').trim().toUpperCase() === especialidad.trim().toUpperCase());
    const colorEsp = espData ? espData.color : 'var(--guinda)';
    if(tarjeta) tarjeta.style.borderTop = `5px solid ${colorEsp}`;

    const gruposReales = [...new Set(alumnosCache
        .filter(al => (al.especialidad || '').trim().toUpperCase() === especialidad.trim().toUpperCase())
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
    const btnPlanillaCred = document.getElementById('btnDescargarCredencialMasivaPlanilla');
    const btnTermicaCred = document.getElementById('btnDescargarCredencialMasivaTermica');

    if (!grupoSelect) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted py-4">Seleccione un grupo para ver a los alumnos.</td></tr>';
        limpiarVistaPrevia();
        return;
    }

    alumnosDelGrupoSeleccionado = alumnosCache.filter(al => 
        (al.especialidad || '').trim().toUpperCase() === especialidad.trim().toUpperCase() && `${al.grado}° "${al.grupo}"` === grupoSelect
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

    const total = alumnosDelGrupoSeleccionado.length;
    if (btnPdfGaf) {
        btnPdfGaf.disabled = false;
        btnPdfGaf.innerHTML = `<i class="bi bi-grid-fill me-2"></i>Descargar ${total} Gafetes (PDF Carta)`;
    }
    if (btnPngGaf) {
        btnPngGaf.disabled = false;
        btnPngGaf.innerHTML = `<i class="bi bi-file-zip-fill text-warning me-2"></i>Descargar ${total} Gafetes (ZIP)`;
    }
    if (btnPlanillaCred) {
        btnPlanillaCred.disabled = false;
        btnPlanillaCred.innerHTML = `<i class="bi bi-file-earmark-pdf-fill me-2"></i>Descargar Planilla Doble Cara (${total} Credenciales)`;
    }
    if (btnTermicaCred) {
        btnTermicaCred.disabled = false;
        btnTermicaCred.innerHTML = `<i class="bi bi-collection-fill me-2"></i>Descargar Grupo Térmico (${total} PDF CR80)`;
    }

    document.querySelectorAll('.infoConteo').forEach(el => {
        el.innerText = `Total Alumnos: ${total} • Hojas Carta estimadas: ${Math.ceil(total / 4)} hojas`;
    });
    document.querySelectorAll('.infoConteoCred').forEach(el => {
        el.innerText = `Total Alumnos: ${total} • Hojas Carta Vertical (9 por hoja / Doble Cara): ${Math.ceil(total / 9)} hojas`;
    });

    const primerMat = alumnosDelGrupoSeleccionado[0].ncontrol || alumnosDelGrupoSeleccionado[0].matricula;
    seleccionarAlumnoCredencial(primerMat, tbody.firstElementChild);
}

function cambiarCaraPreviaPVC(cara) {
    const btnFrente = document.getElementById('btnVerFrentePVC');
    const btnReverso = document.getElementById('btnVerReversoPVC');
    const vistaFrente = document.getElementById('vistaPreviaPvcFrente');
    const vistaReverso = document.getElementById('vistaPreviaPvcReverso');

    if (cara === 'frente') {
        btnFrente?.classList.add('active');
        btnReverso?.classList.remove('active');
        vistaFrente?.classList.remove('d-none');
        vistaReverso?.classList.add('d-none');
    } else {
        btnReverso?.classList.add('active');
        btnFrente?.classList.remove('active');
        vistaReverso?.classList.remove('d-none');
        vistaFrente?.classList.add('d-none');
    }
}

function seleccionarAlumnoCredencial(matricula, filaHtml) {
    alumnoSeleccionadoInd = alumnosCache.find(al => (al.ncontrol || al.matricula) === matricula);
    if (!alumnoSeleccionadoInd) return;

    document.querySelectorAll('#tablaAlumnosCredenciales tr').forEach(tr => tr.classList.remove('table-active'));
    if (filaHtml) filaHtml.classList.add('table-active');

    document.querySelectorAll('.msgSeleccion').forEach(el => el.classList.add('d-none'));

    // 1. Vista Previa Gafete
    const contGafete = document.getElementById('gafeteMuestra');
    if (contGafete) {
        contGafete.classList.remove('d-none');
        contGafete.innerHTML = `<div class="spinner-border text-secondary" role="status"></div>`;
        generarImagenGafete(alumnoSeleccionadoInd).then(img => {
            contGafete.innerHTML = `<img src="${img}" class="img-fluid border rounded shadow-sm" style="max-height: 230px;">`;
        });
    }

    // 2. Vista Previa PVC Frente y Reverso
    const contCred = document.getElementById('credencialMuestraPVC');
    if (contCred) {
        contCred.classList.remove('d-none');
        const al = alumnoSeleccionadoInd;
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        const mat = al.ncontrol || al.matricula || '';

        // Frente
        if (document.getElementById('pvcNombre')) document.getElementById('pvcNombre').innerText = `${al.nombre} ${pat} ${matApe}`.trim().toUpperCase();
        if (document.getElementById('pvcMatricula')) document.getElementById('pvcMatricula').innerText = mat;
        if (document.getElementById('pvcEspecialidad')) document.getElementById('pvcEspecialidad').innerText = al.especialidad || 'N/A';
        if (document.getElementById('pvcGradoGrupo')) document.getElementById('pvcGradoGrupo').innerText = `${al.grado || ''}° "${al.grupo || ''}" ${al.turno || 'Matutino'}`;
        if (document.getElementById('pvcCurp')) document.getElementById('pvcCurp').innerText = al.curp || 'N/A';
        if (document.getElementById('pvcVigencia')) document.getElementById('pvcVigencia').innerText = cfgSistema.vigencia_actual || 'AGOSTO 2026 - JULIO 2027';

        const recuadroFoto = document.getElementById('pvcFoto');
        if (recuadroFoto) {
            const fotoReal = fotoTemporalAlumno || al.fotoUrl || al.foto_url || al.foto || '/img/default_avatar.png';
            recuadroFoto.style.backgroundImage = `url('${fotoReal}')`;
            recuadroFoto.style.backgroundPosition = 'center';
            recuadroFoto.style.backgroundRepeat = 'no-repeat';
            recuadroFoto.style.backgroundSize = 'contain';
        }

        // Reverso
        const textoQR = (al.qrCode || al.qr_texto || `${mat}|${al.nombre}`).substring(0, 60);
        generarQRConTigre(textoQR).then(qrImg => {
            const qrEl = document.getElementById('pvcQrImg');
            if (qrEl) qrEl.src = qrImg;
        });

        if (document.getElementById('pvcDirector')) {
            document.getElementById('pvcDirector').innerText = cfgSistema.nombre_director || "Dirección del Plantel";
        }

        const inputFoto = document.getElementById('inputFotoTemporal');
        if(inputFoto) inputFoto.value = '';
        fotoTemporalAlumno = null;
    }

    // Habilitar botones individuales
    const indIds = [
        'btnDescargarGafeteIndPDF',
        'btnDescargarCredencialIndTermico'
    ];
    indIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
}

function sanitizarTextoQR(texto, fallbackId = '') {
    let limpio = String(texto || fallbackId || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .trim();
    if (!limpio || limpio.startsWith('data:')) {
        limpio = String(fallbackId || 'ALUMNO').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
    }
    return limpio.substring(0, 48);
}

async function generarQRConTigre(texto) {
    return new Promise((resolve) => {
        const size = 250;
        const divTemporal = document.createElement('div');
        const idFallback = String(texto || '').split('|')[0].trim();
        const textoLimpio = sanitizarTextoQR(texto, idFallback);
        
        try {
            new QRCode(divTemporal, { 
                text: textoLimpio, 
                width: size, 
                height: size, 
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel: QRCode.CorrectLevel.M 
            });
        } catch (errQr) {
            divTemporal.innerHTML = "";
            new QRCode(divTemporal, { 
                text: sanitizarTextoQR(idFallback, '00000000000000'), 
                width: size, 
                height: size, 
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel: QRCode.CorrectLevel.L 
            });
        }

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            const qrCanvas = divTemporal.querySelector('canvas');
            if (qrCanvas && qrCanvas.width > 0) {
                ctx.drawImage(qrCanvas, 0, 0, size, size);
                resolve(canvas.toDataURL("image/png"));
                return;
            }

            const imgQrGenerado = divTemporal.querySelector('img');
            const finalQR = new Image();
            finalQR.onload = () => {
                ctx.drawImage(finalQR, 0, 0, size, size);
                resolve(canvas.toDataURL("image/png"));
            };
            finalQR.onerror = () => resolve(qrCanvas ? qrCanvas.toDataURL() : '');
            finalQR.src = (imgQrGenerado && imgQrGenerado.src) ? imgQrGenerado.src : (qrCanvas ? qrCanvas.toDataURL() : '');
        }, 100); 
    });
}

async function generarImagenGafete(alumno) {
    return new Promise((resolve, reject) => {
        if (!alumno) return reject("Alumno no proporcionado");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400; canvas.height = 560;

        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 400, 560);
        ctx.strokeStyle = "#7b1b37"; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.strokeRect(3, 3, 394, 554); ctx.setLineDash([]);

        // Franja superior institucional en degradado guinda
        const gradient = ctx.createLinearGradient(0, 0, 400, 0);
        gradient.addColorStop(0, '#7b1b37');
        gradient.addColorStop(1, '#5a1228');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 400, 90);

        // Línea dorada de acento
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(0, 88, 400, 3);

        const logoEscuelaSrc = (cfgSistema && cfgSistema.logo_plantel_url) ? cfgSistema.logo_plantel_url : '/img/logo-cbtis.png';
        const logoInicioSrc = (cfgSistema && cfgSistema.logo_inicio_url) ? cfgSistema.logo_inicio_url : '/img/logo.png';
        const nomPlantel = (cfgSistema && cfgSistema.nombre_plantel) ? cfgSistema.nombre_plantel : 'Plantel Escolar';
        const imgEscuela = new Image();
        const imgTigre = new Image();

        let cargas = 0;
        let renderizado = false;
        const alCargarLogo = () => {
            cargas++;
            if (cargas < 2 || renderizado) return;
            renderizado = true;

            const dibujarMedallonCircular = (imgObj, cx, cy, r) => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.fillStyle = "#FFFFFF";
                ctx.fill();
                ctx.clip();
                try {
                    if (imgObj && imgObj.complete && imgObj.naturalWidth > 0) {
                        const maxDim = (r - 3) * 2;
                        const iw = imgObj.naturalWidth || imgObj.width || maxDim;
                        const ih = imgObj.naturalHeight || imgObj.height || maxDim;
                        const ratio = Math.min(maxDim / iw, maxDim / ih);
                        const dw = iw * ratio;
                        const dh = ih * ratio;
                        ctx.drawImage(imgObj, cx - dw / 2, cy - dh / 2, dw, dh);
                    }
                } catch (errImg) {
                    console.warn("No se pudo dibujar logo en gafete:", errImg);
                }
                ctx.restore();

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            };

            dibujarMedallonCircular(imgEscuela, 48, 44, 30);
            dibujarMedallonCircular(imgTigre, 352, 44, 30);

            // Cabecera Central
            ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
            ctx.fillText(nomPlantel, 200, 42);
            ctx.fillStyle = "#ffe699"; ctx.font = "bold 11px Arial";
            ctx.fillText("GAFETE OFICIAL DE ESTUDIANTE", 200, 64);

            const pat = alumno.apepat || alumno.primerApellido || '';
            const matApe = alumno.apemat || alumno.segundoApellido || '';
            const mat = alumno.ncontrol || alumno.matricula || '';
            
            ctx.fillStyle = "#111111"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
            ctx.fillText(`${alumno.nombre} ${pat} ${matApe}`.toUpperCase(), 200, 125);

            const divTemporal = document.createElement('div');
            let textoQR = `${mat}|${alumno.nombre || ''}`.trim();
            if (alumno.qrCode && !alumno.qrCode.startsWith('data:')) {
                textoQR = alumno.qrCode.trim();
            } else if (alumno.qr_texto && !alumno.qr_texto.startsWith('data:')) {
                textoQR = alumno.qr_texto.trim();
            }
            textoQR = sanitizarTextoQR(textoQR, mat);

            try {
                new QRCode(divTemporal, {
                    text: textoQR,
                    width: 240,
                    height: 240,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (errQr) {
                divTemporal.innerHTML = "";
                new QRCode(divTemporal, {
                    text: sanitizarTextoQR(mat, '00000000000000'),
                    width: 240,
                    height: 240,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.L
                });
            }

            const finalizarGafeteConQR = (qrSource) => {
                try {
                    if (qrSource) {
                        ctx.drawImage(qrSource, 80, 145, 240, 240);
                    }
                } catch (eQr) {
                    console.warn("Error dibujando QR:", eQr);
                }

                ctx.fillStyle = "#7b1b37"; ctx.font = "bold 28px Arial";
                ctx.fillText(mat, 200, 420);
                
                ctx.fillStyle = "#333333"; ctx.font = "bold 15px Arial";
                ctx.fillText(alumno.especialidad || "", 200, 450);
                ctx.fillStyle = "#666666"; ctx.font = "bold 14px Arial";
                ctx.fillText(`${alumno.grado || ''}° "${alumno.grupo || ''}" • ${alumno.turno || 'Matutino'}`, 200, 475);

                // Pie de página institucional
                ctx.fillStyle = "#7b1b37";
                ctx.fillRect(0, 515, 400, 45);
                ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 11px Arial";
                ctx.fillText(`${nomPlantel.toUpperCase()} • SISTEMA DE CONTROL DE ACCESOS Y REGISTRO`, 200, 542);

                resolve(canvas.toDataURL("image/png"));
            };

            setTimeout(() => {
                const qrCanvas = divTemporal.querySelector('canvas');
                if (qrCanvas && qrCanvas.width > 0) {
                    finalizarGafeteConQR(qrCanvas);
                    return;
                }
                const imgQrGenerado = divTemporal.querySelector('img');
                const finalQR = new Image();
                finalQR.onload = () => finalizarGafeteConQR(finalQR);
                finalQR.onerror = () => finalizarGafeteConQR(null);
                finalQR.src = (imgQrGenerado && imgQrGenerado.src) ? imgQrGenerado.src : '';
            }, 100); 
        };

        imgEscuela.onload = alCargarLogo;
        imgTigre.onload = alCargarLogo;
        imgEscuela.onerror = alCargarLogo;
        imgTigre.onerror = alCargarLogo;
        imgEscuela.src = logoEscuelaSrc;
        imgTigre.src = logoInicioSrc;
    });
}

// --- DESCARGA DE GAFETES Y CREDENCIALES (PDF Y PNG ZIP) ---

// --- DESCARGA DE GAFETES (INDIVIDUAL Y MASIVO) ---

async function descargarGafeteIndividualPDF() {
    if (!alumnoSeleccionadoInd) return Swal.fire("Aviso", "Seleccione un alumno de la tabla.", "warning");
    Swal.fire({ title: 'Generando Gafete Individual...', text: 'Preparando PDF con medidas estándar...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'letter'); // 215.9 x 279.4 mm
        const imgData = await generarImagenGafete(alumnoSeleccionadoInd);
        const nomPlantel = (cfgSistema && cfgSistema.nombre_plantel) ? cfgSistema.nombre_plantel : 'Plantel Escolar';

        const widthGafete = 90;
        const heightGafete = 120;
        const x = (215.9 - widthGafete) / 2;
        const y = (279.4 - heightGafete) / 2;

        // Encabezado informativo en la hoja
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(123, 27, 55);
        pdf.text(`${nomPlantel} • GAFETE OFICIAL DE ESTUDIANTE`, 107.95, 45, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text("Imprimir en Hoja Carta al 100% de Escala • Recortar por las líneas punteadas", 107.95, 51, { align: "center" });

        // Líneas guía de corte alrededor del gafete
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineDashPattern([2, 2], 0);
        pdf.rect(x - 0.5, y - 0.5, widthGafete + 1, heightGafete + 1);

        // Imagen del gafete
        pdf.addImage(imgData, 'PNG', x, y, widthGafete, heightGafete);

        const mat = alumnoSeleccionadoInd.ncontrol || alumnoSeleccionadoInd.matricula || 'ALUMNO';
        pdf.save(`Gafete_${mat}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar el PDF del gafete.", "error");
    }
}
window.descargarGafeteIndividualPDF = descargarGafeteIndividualPDF;

async function descargarGafetesDelGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return;
    Swal.fire({ title: 'Generando Planilla de Gafetes...', text: 'Acomodando gafetes en hojas tamaño Carta con guías de corte...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', 'letter');
        
        let col = 0, row = 0;
        const widthGafete = 85, heightGafete = 118;
        const marginX = 16, marginY = 16;
        const gapX = 13.9, gapY = 11.4;

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

            const x = marginX + (col * (widthGafete + gapX));
            const y = marginY + (row * (heightGafete + gapY));

            // Guías de corte
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineDashPattern([2, 2], 0);
            pdf.rect(x - 0.5, y - 0.5, widthGafete + 1, heightGafete + 1);

            pdf.addImage(imgData, 'PNG', x, y, widthGafete, heightGafete);
        }

        const esp = document.getElementById('filtroEspCred').value || 'GRUPO';
        const gpo = document.getElementById('filtroGpoCred').value || '';
        pdf.save(`Planilla_Gafetes_${esp}_${gpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar el PDF de gafetes.", "error");
    }
}
window.descargarGafetesDelGrupo = descargarGafetesDelGrupo;

async function descargarPNGsDelGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return;
    Swal.fire({ title: 'Generando imágenes PNG...', text: 'Empaquetando archivo ZIP', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const zip = new JSZip();
        for (let i = 0; i < alumnosDelGrupoSeleccionado.length; i++) {
            const al = alumnosDelGrupoSeleccionado[i];
            const mat = al.ncontrol || al.matricula || `ALUMNO_${i}`;
            const pat = al.apepat || al.primerApellido || '';
            const imgData = await generarImagenGafete(al);
            const base64Data = imgData.replace(/^data:image\/png;base64,/, "");
            zip.file(`Gafete_${mat}_${pat}_${al.nombre}.png`, base64Data, { base64: true });
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
window.descargarPNGsDelGrupo = descargarPNGsDelGrupo;

// --- GENERACIÓN DE IMÁGENES DE CREDENCIALES PVC (CR-80 EXACTO 54 x 85.6 mm) ---

async function generarCanvasCredencialFrente(alumno) {
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
        const fotoSrc = fotoTemporalAlumno || alumno.fotoUrl || alumno.foto_url || alumno.foto || '/img/default_avatar.png';
        const vigencia = cfgSistema.vigencia_actual || 'AGOSTO 2026 - JULIO 2027';
        const logoEscuelaSrc = cfgSistema.logo_plantel_url || '/img/logo-cbtis.png';
        const logoInicioSrc = cfgSistema.logo_inicio_url || '/img/logo.png';
        const nomPlantel = cfgSistema.nombre_plantel || 'Plantel Escolar';

        const estiloFondoCustom = plantillaFrente ? `background-image: url('${plantillaFrente}'); background-size: cover; background-position: center;` : `background: #ffffff;`;

        container.innerHTML = `
            <div id="cardFrenteTemp" style="width: 54mm; height: 85.6mm; ${estiloFondoCustom} border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); padding: 6px 8px 8px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    <img src="${logoEscuelaSrc}" style="width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1px;">
                    <div style="text-align: center; flex: 1; margin: 0 4px;">
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff;">${nomPlantel}</div>
                        <div style="font-size: 5.5px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; display: inline-block; color: #ffe699; letter-spacing: 0.5px; margin-top: 1px;">CREDENCIAL DE ESTUDIANTE</div>
                    </div>
                    <img src="${logoInicioSrc}" style="width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1px;">
                </div>
                
                <div style="padding: 2px 8px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly;">
                    <div style="margin: 0 auto;">
                        <div style="width: 26mm; height: 32mm; background: #f1f5f9; border: 2.5px solid #7b1b37; border-radius: 8px; background-image: url('${fotoSrc}'); background-size: cover; background-repeat: no-repeat; background-position: center; box-shadow: 0 3px 8px rgba(123, 27, 55, 0.25);"></div>
                    </div>
                    
                    <div style="margin: 1px 0;">
                        <div style="font-size: 9.5px; font-weight: 900; color: #0f172a; text-transform: uppercase; line-height: 1.15; padding: 0 2px;">${nombreCompleto}</div>
                        <div style="margin-top: 1.5px;">
                            <span style="background: #7b1b37; color: #ffffff; font-size: 6px; font-weight: 800; padding: 1.5px 8px; border-radius: 10px; letter-spacing: 0.5px; text-transform: uppercase;">ALUMNO ACTIVO</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 7px; text-align: left; font-size: 6.5px; line-height: 1.45; box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 2px;">
                            <span style="color: #64748b; font-weight: 700;">MATRÍCULA:</span>
                            <span style="color: #7b1b37; font-weight: 900; font-size: 8px; letter-spacing: 0.5px;">${mat}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 2px;">
                            <span style="color: #64748b; font-weight: 700;">CARRERA:</span>
                            <span style="color: #0f172a; font-weight: 800; text-align: right; max-width: 65%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${alumno.especialidad || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; margin-bottom: 2px;">
                            <span style="color: #64748b; font-weight: 700;">GRUPO / TURNO:</span>
                            <span style="color: #334155; font-weight: 800;">${alumno.grado || ''}° "${alumno.grupo || ''}" • ${alumno.turno || 'Matutino'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b; font-weight: 700;">CURP:</span>
                            <span style="color: #334155; font-weight: 700; font-family: monospace; font-size: 6.5px;">${alumno.curp || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; padding: 4px 6px; border-top: 2px solid #d4af37; border-radius: 12px 12px 0 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 5.5px; font-weight: 800; letter-spacing: 0.3px;">
                        <span>VIGENCIA: <strong style="color: #ffe699;">${vigencia}</strong></span>
                        <span>${nomPlantel}</span>
                    </div>
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const canvas = await html2canvas(targetEl, {
            scale: 6,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        resolve(canvas.toDataURL("image/png"));
    });
}

async function generarCanvasCredencialReverso(alumno) {
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
        const textoQR = (alumno.qrCode || alumno.qr_texto || `${mat}|${alumno.nombre}`).substring(0, 60);
        const qrImgData = await generarQRConTigre(textoQR);
        const director = cfgSistema.nombre_director || "Dirección del Plantel";
        const logoEscuelaSrc = cfgSistema.logo_plantel_url || '/img/logo-cbtis.png';
        const logoInicioSrc = cfgSistema.logo_inicio_url || '/img/logo.png';
        const nomPlantel = cfgSistema.nombre_plantel || 'Plantel Escolar';
        const cct = cfgSistema.cct_escuela || '12DCT0001L';

        const estiloFondoCustom = plantillaReverso ? `background-image: url('${plantillaReverso}'); background-size: cover; background-position: center;` : `background: #ffffff;`;

        container.innerHTML = `
            <div id="cardReversoTemp" style="width: 54mm; height: 85.6mm; ${estiloFondoCustom} border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); padding: 6px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px;">
                    <img src="${logoEscuelaSrc}" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid #ffffff; object-fit: contain; background: #fff; padding: 1px;">
                    <div style="font-size: 8px; font-weight: 900; letter-spacing: 0.5px; flex: 1; text-transform: uppercase;">CONTROL Y ACCESO VIGILANTE</div>
                    <img src="${logoInicioSrc}" style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid #ffffff; object-fit: contain; background: #fff; padding: 1px;">
                </div>
                
                <div style="padding: 4px 8px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;">
                    <div style="background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 10px; padding: 4px; box-shadow: 0 3px 8px rgba(123, 27, 55, 0.15);">
                        <div style="width: 32mm; height: 32mm; margin: 0 auto;">
                            <img src="${qrImgData}" style="width: 100%; height: 100%; object-fit: contain;">
                        </div>
                        <div style="font-size: 5.5px; font-weight: 800; color: #7b1b37; letter-spacing: 0.5px; margin-top: 2px;">ESCANEAME PARA ACCESO</div>
                    </div>
                    
                    <div style="font-size: 5.8px; font-weight: 600; color: #475569; line-height: 1.3; margin: 2px auto; max-width: 48mm;">
                        Esta credencial es personal e intransferible. Acredita al portador como alumno regular inscrito en el plantel ${nomPlantel}.
                    </div>
                    
                    <div style="width: 100%; margin-top: 2px;">
                        <div style="width: 36mm; border-bottom: 1.5px solid #334155; margin: 0 auto 2px auto;"></div>
                        <div style="font-size: 7.5px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${director}</div>
                        <div style="font-size: 5.8px; color: #64748b; font-weight: 700;">Director del Plantel ${nomPlantel}</div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; padding: 4px 6px; border-top: 2px solid #d4af37; border-radius: 12px 12px 0 0;">
                    <div style="font-size: 5.5px; font-weight: 800; letter-spacing: 0.4px;">CLAVE CCT: ${cct}</div>
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const canvas = await html2canvas(targetEl, {
            scale: 6,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        resolve(canvas.toDataURL("image/png"));
    });
}

// 1. CREDENCIALES INDIVIDUAL / GRUPO - MODO TÉRMICO CR80 (54 x 85.6 mm por página)
async function generarCredencialPDF(esMasivo) {
    const listaAlumnos = esMasivo ? alumnosDelGrupoSeleccionado : (alumnoSeleccionadoInd ? [alumnoSeleccionadoInd] : []);
    if (listaAlumnos.length === 0) return Swal.fire("Aviso", "Seleccione al menos un alumno para generar la credencial.", "warning");

    Swal.fire({ title: 'Generando Credenciales Térmicas...', text: 'Formato directo para impresoras PVC (CR-80 54 x 85.6 mm)', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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
        pdf.save(`Credenciales_Termicas_CR80_${matOrGpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron generar las credenciales térmicas.", "error");
    }
}
window.generarCredencialPDF = generarCredencialPDF;

// 2. CREDENCIALES GRUPO - PLANILLA HOJA CARTA DOBLE CARA (Vertical / Portrait con 3 columnas x 3 filas = 9 credenciales por hoja y alineación espejo exacta)
async function generarCredencialesPlanillaCartaGrupo() {
    if (alumnosDelGrupoSeleccionado.length === 0) return Swal.fire("Aviso", "Seleccione un grupo para generar la planilla.", "warning");
    Swal.fire({ title: 'Generando Planilla Doble Cara...', text: 'Acomodando credenciales en Hoja Carta Vertical con alineación espejo para recorte...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const { jsPDF } = window.jspdf;
        // Hoja Carta Vertical / Portrait: 215.9 mm de ancho x 279.4 mm de alto
        const pdf = new jsPDF('portrait', 'mm', 'letter');

        const w = 54.0;
        const h = 85.6;

        // 3 columnas perfectamente simétricas en 215.9 mm de ancho
        // Margen lateral de 13.95 mm y separación uniforme entre columnas de 13.0 mm
        const xCoords = [13.95, 80.95, 147.95];

        // 3 filas perfectamente simétricas en 279.4 mm de alto
        // Margen superior/inferior de 8.0 mm y separación vertical de 3.3 mm
        const yCoords = [8.00, 96.90, 185.80];

        const alumnos = alumnosDelGrupoSeleccionado;
        const porPagina = 9; // 3 columnas x 3 filas = 9 credenciales por hoja
        const totalPaginasLote = Math.ceil(alumnos.length / porPagina);

        for (let p = 0; p < totalPaginasLote; p++) {
            const lote = alumnos.slice(p * porPagina, (p + 1) * porPagina);
            if (p > 0) pdf.addPage('letter', 'portrait');

            // PÁGINA 1: FRENTES (Hoja delantera)
            for (let i = 0; i < lote.length; i++) {
                const al = lote[i];
                const col = i % 3;
                const row = Math.floor(i / 3);
                const x = xCoords[col];
                const y = yCoords[row];

                const imgFrente = await generarCanvasCredencialFrente(al);

                // Líneas guía de corte finas
                pdf.setDrawColor(190, 190, 190);
                pdf.setLineDashPattern([2, 2], 0);
                pdf.rect(x - 0.3, y - 0.3, w + 0.6, h + 0.6);

                pdf.addImage(imgFrente, 'PNG', x, y, w, h);
            }

            // PÁGINA 2: REVERSOS (Hoja trasera en posición espejo horizontal exacta para impresión dúplex / volteo)
            pdf.addPage('letter', 'portrait');
            for (let i = 0; i < lote.length; i++) {
                const al = lote[i];
                const col = i % 3;
                const colEspejo = 2 - col; // Columna 0 -> Columna 2, Columna 1 -> Columna 1, Columna 2 -> Columna 0
                const row = Math.floor(i / 3);
                const x = xCoords[colEspejo];
                const y = yCoords[row];

                const imgReverso = await generarCanvasCredencialReverso(al);

                // Líneas guía de corte finas
                pdf.setDrawColor(190, 190, 190);
                pdf.setLineDashPattern([2, 2], 0);
                pdf.rect(x - 0.3, y - 0.3, w + 0.6, h + 0.6);

                pdf.addImage(imgReverso, 'PNG', x, y, w, h);
            }
        }

        const esp = document.getElementById('filtroEspCred').value || 'GRUPO';
        const gpo = document.getElementById('filtroGpoCred').value || '';
        pdf.save(`Planilla_Credenciales_Vertical_DobleCara_${esp}_${gpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar la planilla en PDF.", "error");
    }
}
window.generarCredencialesPlanillaCartaGrupo = generarCredencialesPlanillaCartaGrupo;