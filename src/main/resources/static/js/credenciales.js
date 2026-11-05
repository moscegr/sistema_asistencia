let alumnosCache = [];
let especialidadesConfig = [];
let alumnosDelGrupoSeleccionado = [];
let cfgSistema = {};
let alumnoSeleccionadoInd = null;
let plantillaFrente = null;
let plantillaReverso = null;
let fotoTemporalAlumno = null;

/**
 * Resuelve la URL de la fotografía del alumno dando prioridad absoluta a las imágenes físicas
 * en disco (/uploads/alumnos/{matricula}.jpg) por encima de cadenas Base64 de la base de datos (MongoDB).
 * Esto garantiza que al imprimir credenciales o gafetes en PVC o papel, se obtenga la máxima resolución.
 */
function obtenerUrlFotoAlumnoAltaResolucion(alumno) {
    if (!alumno) return '/img/default_avatar.png';
    if (fotoTemporalAlumno) return fotoTemporalAlumno;

    const mat = (alumno.ncontrol || alumno.matricula || alumno.curp || alumno.id || '').toString().trim();

    // 1. Si la URL ya apunta directamente a un archivo físico en /uploads/
    if (alumno.fotoUrl && alumno.fotoUrl.startsWith('/uploads/')) return alumno.fotoUrl;
    if (alumno.foto_url && alumno.foto_url.startsWith('/uploads/')) return alumno.foto_url;
    if (alumno.foto && alumno.foto.startsWith('/uploads/')) return alumno.foto;

    // 2. Si cuenta con matrícula/número de control, solicitar SIEMPRE el archivo físico en uploads
    if (mat) {
        return `/uploads/alumnos/${encodeURIComponent(mat)}.jpg`;
    }

    // 3. Fallbacks si no es una cadena Base64 pesada de la base de datos
    if (alumno.fotoUrl && !alumno.fotoUrl.startsWith('data:')) return alumno.fotoUrl;
    if (alumno.foto_url && !alumno.foto_url.startsWith('data:')) return alumno.foto_url;
    if (alumno.foto && !alumno.foto.startsWith('data:')) return alumno.foto;

    return alumno.fotoUrl || alumno.foto_url || alumno.foto || '/img/default_avatar.png';
}

/**
 * Resuelve la URL del logotipo institucional dando prioridad a los archivos físicos en uploads (/uploads/logos/...).
 */
function obtenerLogoAltaResolucion(urlConfig, tipo) {
    if (urlConfig && urlConfig.startsWith('/uploads/')) return urlConfig;
    if (urlConfig && !urlConfig.startsWith('data:')) return urlConfig;
    if (tipo === 'plantel') {
        return '/uploads/logos/logo_plantel.png';
    } else {
        return '/uploads/logos/logo_inicio.png';
    }
}

/**
 * Recorta asíncronamente una fotografía al aspect ratio exacto requerido (por ej. 26mm x 32mm)
 * generando un PNG en ultra alta resolución (600x738 px @ ~600 DPI). Al coincidir el aspect ratio
 * de la imagen con el contenedor HTML, html2canvas no sufre de deformaciones ni rostros alargados o ensanchados.
 */
async function recortarFotoAspectoHD(url, targetWmm, targetHmm) {
    return new Promise((resolve) => {
        if (!url) return resolve('/img/default_avatar.png');
        
        let terminado = false;
        const finalizar = (resVal) => {
            if (terminado) return;
            terminado = true;
            resolve(resVal);
        };

        // Tiempo límite de seguridad de 2 segundos para evitar bloquear la generación masiva
        const timerSeguridad = setTimeout(() => finalizar(url), 2000);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            clearTimeout(timerSeguridad);
            try {
                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;
                if (!iw || !ih) return finalizar(url);

                const targetAspect = targetWmm / targetHmm;
                const imgAspect = iw / ih;

                let sx = 0, sy = 0, sw = iw, sh = ih;
                if (imgAspect > targetAspect) {
                    sw = ih * targetAspect;
                    sx = (iw - sw) / 2;
                } else {
                    sh = iw / targetAspect;
                    sy = (ih - sh) * 0.25; // 25% superior para encuadrar adecuadamente cabeza y rostro
                    if (sy < 0) sy = 0;
                    if (sy + sh > ih) sy = ih - sh;
                }

                const c = document.createElement('canvas');
                c.width = 400;
                c.height = Math.round(400 / targetAspect);
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);

                finalizar(c.toDataURL('image/jpeg', 0.95));
            } catch (e) {
                finalizar(url);
            }
        };
        img.onerror = () => {
            clearTimeout(timerSeguridad);
            finalizar(url);
        };
        img.src = url;
    });
}

document.getElementById('inputFotoTemporal')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const recuadroFoto = document.getElementById('pvcFoto');

    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { 
            fotoTemporalAlumno = event.target.result; 
            if (recuadroFoto) {
                recuadroFoto.innerHTML = `<img src="${fotoTemporalAlumno}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: block;">`;
                recuadroFoto.style.backgroundImage = 'none';
            }
        };
        reader.readAsDataURL(file);
    } else {
        fotoTemporalAlumno = null;
        const fotoDefault = obtenerUrlFotoAlumnoAltaResolucion(alumnoSeleccionadoInd);
        if (recuadroFoto) {
            recuadroFoto.innerHTML = `<img src="${fotoDefault}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: block;" onerror="if(!this.src.includes('default_avatar.png')) this.src='/img/default_avatar.png';">`;
            recuadroFoto.style.backgroundImage = 'none';
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

    tbody.innerHTML = alumnosDelGrupoSeleccionado.map(al => {
        const mat = al.ncontrol || al.matricula || '';
        const pat = al.apepat || al.primerApellido || '';
        const matApe = al.apemat || al.segundoApellido || '';
        return `
            <tr style="cursor: pointer;" onclick="seleccionarAlumnoCredencial('${mat}', this)">
                <td class="fw-bold text-secondary">${mat}</td>
                <td class="text-start fw-bold" style="font-size: 0.85rem;">${pat} ${matApe} ${al.nombre}</td>
                <td><i class="bi bi-check-circle-fill text-success"></i></td>
            </tr>`;
    }).join('');

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
            const fotoReal = obtenerUrlFotoAlumnoAltaResolucion(al);
            recuadroFoto.innerHTML = `<img src="${fotoReal}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: block;" onerror="if(!this.src.includes('default_avatar.png')) this.src='/img/default_avatar.png';">`;
            recuadroFoto.style.backgroundImage = 'none';
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
        const firmaImgEl = document.getElementById('pvcFirmaDirectorImg');
        if (firmaImgEl) {
            const firmaUrl = cfgSistema.firma_director_url || cfgSistema.firma_director_base64 || '';
            if (firmaUrl) {
                firmaImgEl.src = firmaUrl;
                firmaImgEl.style.display = 'block';
            } else {
                firmaImgEl.style.display = 'none';
            }
        }
        const selloImgEl = document.getElementById('pvcSelloInstitucionalImg');
        if (selloImgEl) {
            const selloUrl = cfgSistema.sello_institucional_url || cfgSistema.sello_institucional_base64 || '';
            if (selloUrl) {
                selloImgEl.src = selloUrl;
                selloImgEl.style.display = 'block';
            } else {
                selloImgEl.style.display = 'none';
            }
        }
        if (document.getElementById('pvcTelefono')) {
            document.getElementById('pvcTelefono').innerText = cfgSistema.telefono_escuela || '';
        }
        if (document.getElementById('pvcDireccion')) {
            document.getElementById('pvcDireccion').innerText = cfgSistema.direccion_plantel || '';
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

        const SCALE = 3; // Ultra HD: 1200 x 1680 píxeles (~360 DPI para impresión nítida)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400 * SCALE; 
        canvas.height = 560 * SCALE;

        // Escalar el contexto para gráficos y tipografías vectoriales ultra nítidas
        ctx.scale(SCALE, SCALE);

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

        const logoEscuelaSrc = obtenerLogoAltaResolucion(cfgSistema && cfgSistema.logo_plantel_url, 'plantel');
        const logoInicioSrc = obtenerLogoAltaResolucion(cfgSistema && cfgSistema.logo_inicio_url, 'inicio');
        const nomPlantel = (cfgSistema && cfgSistema.nombre_plantel) ? cfgSistema.nombre_plantel : 'Plantel Escolar';
        const imgEscuela = new Image();
        const imgTigre = new Image();
        imgEscuela.crossOrigin = "anonymous";
        imgTigre.crossOrigin = "anonymous";

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

            // Generar código QR a resolución HD (720x720 px)
            try {
                new QRCode(divTemporal, {
                    text: textoQR,
                    width: 240 * SCALE,
                    height: 240 * SCALE,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (errQr) {
                divTemporal.innerHTML = "";
                new QRCode(divTemporal, {
                    text: sanitizarTextoQR(mat, '00000000000000'),
                    width: 240 * SCALE,
                    height: 240 * SCALE,
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
        imgEscuela.onerror = () => {
            if (!imgEscuela.src.includes('logo_aniversario.jpg')) {
                imgEscuela.src = '/img/logo_aniversario.jpg';
            } else {
                alCargarLogo();
            }
        };
        imgTigre.onerror = () => {
            if (!imgTigre.src.includes('tigres.png')) {
                imgTigre.src = '/img/tigres.png';
            } else {
                alCargarLogo();
            }
        };
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
            container.style.top = '0';
            container.style.width = '54mm';
            container.style.height = '85.6mm';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
        }

        const pat = alumno.apepat || alumno.primerApellido || '';
        const matApe = alumno.apemat || alumno.segundoApellido || '';
        const nombreCompleto = `${alumno.nombre} ${pat} ${matApe}`.trim().toUpperCase();
        const mat = alumno.ncontrol || alumno.matricula || '';
        const fotoSrcOriginal = obtenerUrlFotoAlumnoAltaResolucion(alumno);
        const fotoSrc = await recortarFotoAspectoHD(fotoSrcOriginal, 26, 32);
        const vigencia = cfgSistema.vigencia_actual || 'AGOSTO 2026 - JULIO 2027';
        const logoEscuelaSrc = obtenerLogoAltaResolucion(cfgSistema.logo_plantel_url, 'plantel');
        const logoInicioSrc = obtenerLogoAltaResolucion(cfgSistema.logo_inicio_url, 'inicio');
        const selloInstitucionalSrc = cfgSistema.sello_institucional_url || cfgSistema.sello_institucional_base64 || '';
        const nomPlantel = cfgSistema.nombre_plantel || 'Plantel Escolar';

        const estiloFondoCustom = plantillaFrente ? `background-image: url('${plantillaFrente}'); background-size: cover; background-position: center;` : `background: #ffffff;`;

        container.innerHTML = `
            <div id="cardFrenteTemp" style="width: 54mm; height: 85.6mm; ${estiloFondoCustom} border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); height: 12mm; min-height: 12mm; max-height: 12mm; box-sizing: border-box; padding: 3px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    <img src="${logoEscuelaSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('logo_aniversario.jpg')) this.src='/img/logo_aniversario.jpg';">
                    <div style="text-align: center; flex: 1; margin: 0 4px;">
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff;">${nomPlantel}</div>
                        <div style="font-size: 5.5px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; display: inline-block; color: #ffe699; letter-spacing: 0.5px; margin-top: 1px;">CREDENCIAL DE ESTUDIANTE</div>
                    </div>
                    <img src="${logoInicioSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('tigres.png')) this.src='/img/tigres.png';">
                </div>
                
                <div style="padding: 2px 8px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly;">
                    <div style="margin: 0 auto; position: relative; display: inline-block;">
                        <div style="width: 26mm; height: 32mm; background: #f1f5f9; border: 2.5px solid #7b1b37; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 8px rgba(123, 27, 55, 0.25); display: flex; align-items: center; justify-content: center; position: relative;">
                            <img src="${fotoSrc}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('default_avatar.png')) this.src='/img/default_avatar.png';" />
                        </div>
                        ${selloInstitucionalSrc ? `
                            <img src="${selloInstitucionalSrc}" crossorigin="anonymous" style="position: absolute; right: -7mm; bottom: -11mm; width: 19mm; height: 19mm; z-index: 10; pointer-events: none; object-fit: contain; mix-blend-mode: multiply; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));" onerror="this.style.display='none';">
                        ` : ''}
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
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; height: 8.5mm; min-height: 8.5mm; max-height: 8.5mm; box-sizing: border-box; padding: 2px 6px; border-top: 2px solid #d4af37; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 5.5px; font-weight: 800; letter-spacing: 0.3px;">
                        <span>VIGENCIA: <strong style="color: #ffe699;">${vigencia}</strong></span>
                        <span>${nomPlantel}</span>
                    </div>
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;

        // Asegurar carga de todas las imágenes físicas antes de rasterizar con html2canvas
        const imgs = Array.from(targetEl.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(res => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2000);
            });
        }));

        try {
            const canvas = await html2canvas(targetEl, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                imageTimeout: 5000,
                logging: false
            });

            const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
            container.innerHTML = "";
            resolve(dataUrl);
        } catch(errRender) {
            console.warn("Fallo html2canvas frente:", errRender);
            container.innerHTML = "";
            resolve('/img/default_avatar.png');
        }
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
            container.style.top = '0';
            container.style.width = '54mm';
            container.style.height = '85.6mm';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
        }

        const mat = alumno.ncontrol || alumno.matricula || '';
        const textoQR = (alumno.qrCode || alumno.qr_texto || `${mat}|${alumno.nombre}`).substring(0, 60);
        const qrImgData = await generarQRConTigre(textoQR);
        const director = cfgSistema.nombre_director || "Dirección del Plantel";
        const logoEscuelaSrc = obtenerLogoAltaResolucion(cfgSistema.logo_plantel_url, 'plantel');
        const logoInicioSrc = obtenerLogoAltaResolucion(cfgSistema.logo_inicio_url, 'inicio');
        const nomPlantel = cfgSistema.nombre_plantel || 'Plantel Escolar';
        const cct = cfgSistema.cct_escuela || '12DCT0001L';
        const telPlantel = cfgSistema.telefono_escuela || '';
        const dirPlantel = cfgSistema.direccion_plantel || '';
        const firmaDirectorSrc = cfgSistema.firma_director_url || cfgSistema.firma_director_base64 || '';

        const estiloFondoCustom = plantillaReverso ? `background-image: url('${plantillaReverso}'); background-size: cover; background-position: center;` : `background: #ffffff;`;

        container.innerHTML = `
            <div id="cardReversoTemp" style="width: 54mm; height: 85.6mm; ${estiloFondoCustom} border: 1.5px solid #7b1b37; border-radius: 8px; position: relative; box-shadow: none; overflow: hidden; font-family: 'DM Sans', Arial, sans-serif; text-align: center; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); height: 12mm; min-height: 12mm; max-height: 12mm; box-sizing: border-box; padding: 3px 8px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #d4af37; border-radius: 0 0 12px 12px;">
                    <img src="${logoEscuelaSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('logo_aniversario.jpg')) this.src='/img/logo_aniversario.jpg';">
                    <div style="text-align: center; flex: 1; margin: 0 4px;">
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; color: #ffffff;">${nomPlantel}</div>
                        <div style="font-size: 5.5px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 8px; display: inline-block; color: #ffe699; letter-spacing: 0.5px; margin-top: 1px;">CONTROL Y ACCESO VIGILANTE</div>
                    </div>
                    <img src="${logoInicioSrc}" crossorigin="anonymous" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #ffffff; object-fit: contain; background: #fff; padding: 1.5px; image-rendering: -webkit-optimize-contrast; image-rendering: high-quality;" onerror="if(!this.src.includes('tigres.png')) this.src='/img/tigres.png';">
                </div>
                
                <div style="padding: 3px 6px; flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;">
                    <div style="background: #ffffff; border: 1.5px solid #7b1b37; border-radius: 8px; padding: 3px; box-shadow: 0 2px 6px rgba(123, 27, 55, 0.15);">
                        <div style="width: 24mm; height: 24mm; margin: 0 auto;">
                            <img src="${qrImgData}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;">
                        </div>
                        <div style="font-size: 5.2px; font-weight: 800; color: #7b1b37; letter-spacing: 0.5px; margin-top: 1px;">ESCANEAME PARA ACCESO</div>
                    </div>
                    
                    <div style="font-size: 5.5px; font-weight: 600; color: #475569; line-height: 1.25; margin: 1.5px auto; max-width: 48mm;">
                        Esta credencial es personal e intransferible. Acredita al portador como alumno regular inscrito en el plantel ${nomPlantel}.
                    </div>
                    
                    <div style="width: 100%; margin-top: 1px; display: flex; flex-direction: column; align-items: center;">
                        <div style="height: 15mm; width: 40mm; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 1px;">
                            ${firmaDirectorSrc ? `<img src="${firmaDirectorSrc}" crossorigin="anonymous" style="max-height: 15mm; max-width: 40mm; object-fit: contain; display: block;" onerror="this.style.display='none';">` : ''}
                        </div>
                        <div style="width: 40mm; border-bottom: 1.5px solid #334155; margin: 0 auto 2px auto;"></div>
                        <div style="font-size: 7.5px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${director}</div>
                        <div style="font-size: 5.6px; color: #64748b; font-weight: 700;">Director del Plantel ${nomPlantel}</div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #7b1b37 0%, #4a0d1e 100%); color: #ffffff; height: 8.5mm; min-height: 8.5mm; max-height: 8.5mm; box-sizing: border-box; padding: 2px 6px; border-top: 2px solid #d4af37; border-radius: 10px 10px 0 0; display: flex; flex-direction: column; justify-content: center;">
                    <div style="display: flex; justify-content: space-between; font-size: 5.2px; font-weight: 800; letter-spacing: 0.3px; margin-bottom: 0.5px;">
                        <span>CLAVE CCT: ${cct}</span>
                        ${telPlantel ? `<span>TEL: ${telPlantel}</span>` : ''}
                    </div>
                    ${dirPlantel ? `<div style="font-size: 4.4px; font-weight: 600; color: #ffe699; line-height: 1.15; text-align: center; word-break: break-word;">${dirPlantel}</div>` : ''}
                </div>
            </div>
        `;

        const targetEl = container.firstElementChild;
        const imgs = Array.from(targetEl.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(res => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2000);
            });
        }));

        try {
            const canvas = await html2canvas(targetEl, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                imageTimeout: 5000,
                logging: false
            });

            const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
            container.innerHTML = "";
            resolve(dataUrl);
        } catch(errRender) {
            console.warn("Fallo html2canvas reverso:", errRender);
            container.innerHTML = "";
            resolve('/img/default_avatar.png');
        }
    });
}

// 1. CREDENCIALES INDIVIDUAL / GRUPO - MODO TÉRMICO CR80 (54 x 85.6 mm por página)
async function generarCredencialPDF(esMasivo) {
    const listaAlumnos = esMasivo ? alumnosDelGrupoSeleccionado : (alumnoSeleccionadoInd ? [alumnoSeleccionadoInd] : []);
    if (!listaAlumnos || listaAlumnos.length === 0) {
        return Swal.fire("Aviso", "Seleccione al menos un alumno para generar la credencial.", "warning");
    }

    Swal.fire({
        title: 'Generando Credenciales Térmicas...',
        html: `<div class="mb-2">Formato directo para impresoras PVC (CR-80 54 x 85.6 mm)</div>
               <div class="small text-muted fw-bold" id="progresoTermicoTexto">Iniciando procesamiento de ${listaAlumnos.length} alumno(s)...</div>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('portrait', 'mm', [54, 85.6]);

        for (let i = 0; i < listaAlumnos.length; i++) {
            const al = listaAlumnos[i];
            const elProg = document.getElementById('progresoTermicoTexto');
            if (elProg) elProg.innerText = `Generando alumno ${i + 1} de ${listaAlumnos.length}...`;

            const imgFrente = await generarCanvasCredencialFrente(al);
            const imgReverso = await generarCanvasCredencialReverso(al);

            if (i > 0) pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgFrente, 'JPEG', 0, 0, 54, 85.6, undefined, 'FAST');

            pdf.addPage([54, 85.6], 'portrait');
            pdf.addImage(imgReverso, 'JPEG', 0, 0, 54, 85.6, undefined, 'FAST');
        }

        const matOrGpo = esMasivo ? `Grupo_${document.getElementById('filtroGpoCred')?.value || 'Masivo'}` : (listaAlumnos[0].ncontrol || listaAlumnos[0].matricula);
        pdf.save(`Credenciales_Termicas_CR80_${matOrGpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error("Error generando credenciales térmicas:", e);
        Swal.fire("Error", "No se pudieron generar las credenciales térmicas: " + (e.message || e), "error");
    }
}
window.generarCredencialPDF = generarCredencialPDF;

// 2. CREDENCIALES GRUPO - PLANILLA HOJA CARTA DOBLE CARA (Vertical / Portrait con 3 columnas x 3 filas = 9 credenciales por hoja y alineación espejo exacta)
async function generarCredencialesPlanillaCartaGrupo() {
    if (!alumnosDelGrupoSeleccionado || alumnosDelGrupoSeleccionado.length === 0) {
        return Swal.fire("Aviso", "Seleccione un grupo para generar la planilla.", "warning");
    }

    const totalAlumnos = alumnosDelGrupoSeleccionado.length;
    Swal.fire({
        title: 'Generando Planilla Doble Cara...',
        html: `<div class="mb-2">Acomodando credenciales en Hoja Carta Vertical con alineación espejo para recorte.</div>
               <div class="small text-muted fw-bold" id="progresoPlanillaTexto">Iniciando procesamiento de ${totalAlumnos} alumnos...</div>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { jsPDF } = window.jspdf;
        // Hoja Carta Vertical / Portrait: 215.9 mm de ancho x 279.4 mm de alto
        const pdf = new jsPDF('portrait', 'mm', 'letter');

        const w = 54.0;
        const h = 85.6;

        // 3 columnas perfectamente simétricas en 215.9 mm de ancho
        const xCoords = [13.95, 80.95, 147.95];

        // 3 filas perfectamente simétricas en 279.4 mm de alto
        const yCoords = [8.00, 96.90, 185.80];

        const alumnos = alumnosDelGrupoSeleccionado;
        const porPagina = 9; // 3 columnas x 3 filas = 9 credenciales por hoja
        const totalPaginasLote = Math.ceil(alumnos.length / porPagina);

        const actualizarProgreso = (texto) => {
            const el = document.getElementById('progresoPlanillaTexto');
            if (el) el.innerText = texto;
        };

        for (let p = 0; p < totalPaginasLote; p++) {
            const lote = alumnos.slice(p * porPagina, (p + 1) * porPagina);
            if (p > 0) pdf.addPage('letter', 'portrait');

            // PÁGINA 1: FRENTES (Hoja delantera)
            actualizarProgreso(`Generando hoja ${p + 1} de ${totalPaginasLote} (Frentes)...`);
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

                pdf.addImage(imgFrente, 'JPEG', x, y, w, h, undefined, 'FAST');
            }

            // PÁGINA 2: REVERSOS (Hoja trasera en posición espejo horizontal exacta para impresión dúplex / volteo)
            pdf.addPage('letter', 'portrait');
            actualizarProgreso(`Generando hoja ${p + 1} de ${totalPaginasLote} (Reversos)...`);
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

                pdf.addImage(imgReverso, 'JPEG', x, y, w, h, undefined, 'FAST');
            }
        }

        const esp = document.getElementById('filtroEspCred')?.value || 'GRUPO';
        const gpo = document.getElementById('filtroGpoCred')?.value || '';
        pdf.save(`Planilla_Credenciales_Vertical_DobleCara_${esp}_${gpo}.pdf`);
        Swal.close();
    } catch (e) {
        console.error("Error al generar planilla:", e);
        Swal.fire("Error", "No se pudo generar la planilla en PDF: " + (e.message || e), "error");
    }
}
window.generarCredencialesPlanillaCartaGrupo = generarCredencialesPlanillaCartaGrupo;