// static/js/incidencias_prefectura.js (REST API Spring Boot Backend)

const obtenerHoy = () => new Date().toLocaleDateString('en-CA');
let historialPrefecturaCache = [];
let catalogoPersonalCache = [];
let limiteHistorialPref = 10;

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
};

document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('fechaIncidenciaPref')) {
        document.getElementById('fechaIncidenciaPref').value = obtenerHoy();
    }
    generarFilasModulos();
    await actualizarSiguienteFolioPrefectura();
    await cargarJefePersonalConfig();
    await cargarCatalogoPersonal();
    await escucharHistorialPersonal();

    const fInteresado = document.getElementById('filtroInteresado');
    const fFecha = document.getElementById('filtroFechaPref');
    const fTurno = document.getElementById('filtroTurnoPref');
    const inputInteresado = document.getElementById('nombreInteresado');

    if (fInteresado) fInteresado.addEventListener('input', filtrarHistorialPrefectura);
    if (fFecha) fFecha.addEventListener('input', filtrarHistorialPrefectura);
    if (fTurno) fTurno.addEventListener('change', filtrarHistorialPrefectura);

    if (inputInteresado) {
        inputInteresado.addEventListener('input', sincronizarInfoPersonalSeleccionado);
        inputInteresado.addEventListener('change', sincronizarInfoPersonalSeleccionado);
    }
});

async function actualizarSiguienteFolioPrefectura() {
    try {
        const res = await fetch('/api/incidencias/personal/siguiente-folio');
        if (res.ok) {
            const data = await res.json();
            const folio = data.siguiente_folio || "PREF-0001";
            const b = document.getElementById('badgeFolioPref');
            if (b) b.innerText = folio;
            const pdfF = document.getElementById('pdfFolioPref');
            if (pdfF) pdfF.innerText = "FOLIO: " + folio;
        }
    } catch (e) {
        console.warn("Error al sincronizar folio de prefectura:", e);
    }
}

async function cargarJefePersonalConfig() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            const inputJefe = document.getElementById('jefePersonal');
            const jefe = data.jefe_personal || data.nombre_jefe_personal || "LIC. JUANA MORALES APARICIO";
            if (inputJefe) inputJefe.value = jefe;
            const pdfJefe = document.getElementById('pdfJefeFirma');
            if (pdfJefe) pdfJefe.innerText = jefe;
        }
    } catch (e) {
        console.warn("No se pudo sincronizar jefe de personal:", e);
    }
}

async function cargarCatalogoPersonal() {
    try {
        const res = await fetch('/api/usuarios');
        if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
                catalogoPersonalCache = list.filter(u => u.nombre && u.nombre.trim() !== '');
                poblarDatalistPersonal();
            }
        }
    } catch (e) {
        console.error("Error al cargar personal de MongoDB:", e);
    }
}

function poblarDatalistPersonal() {
    const datalist = document.getElementById('listaPersonalDatalist');
    if (!datalist) return;
    datalist.innerHTML = '';

    catalogoPersonalCache.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.nombre;
        const rolTxt = (p.rol || 'PERSONAL').toUpperCase();
        const turnoTxt = (p.turno || 'REGULAR').toUpperCase();
        opt.label = `${rolTxt} • ${turnoTxt}`;
        datalist.appendChild(opt);
    });
}

function sincronizarInfoPersonalSeleccionado() {
    const input = document.getElementById('nombreInteresado');
    const badge = document.getElementById('badgeInfoPersonal');
    const selectTurno = document.getElementById('turnoSelect');
    if (!input) return;

    const val = normalizar(input.value);
    if (!val) {
        if (badge) {
            badge.innerText = '';
            badge.classList.add('d-none');
        }
        return;
    }

    const persona = catalogoPersonalCache.find(p => normalizar(p.nombre) === val || normalizar(p.nombre).includes(val));
    if (persona) {
        const rol = (persona.rol || 'PERSONAL').toUpperCase();
        const turno = (persona.turno || '').toUpperCase();
        if (badge) {
            badge.innerText = `${rol} • ${turno || 'SIN TURNO'}`;
            badge.classList.remove('d-none');
        }
        if (turno && selectTurno) {
            for (let opt of selectTurno.options) {
                if (opt.value === turno) {
                    selectTurno.value = turno;
                    break;
                }
            }
        }
    } else {
        if (badge) {
            badge.innerText = 'No registrado en catálogo';
            badge.classList.remove('d-none');
        }
    }
}

function generarFilasModulos() {
    const tbody = document.getElementById('tablaModulosIncidencias');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    for (let i = 1; i <= 8; i++) {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${i}</td>
                <td><input type="time" class="form-control form-control-sm text-center" id="hora-${i}"></td>
                <td>
                    <select class="form-select form-select-sm fw-bold text-center" id="clave-${i}">
                        <option value="">--</option>
                        <option value="F">F</option>
                        <option value="R">R</option>
                        <option value="PE">PE</option>
                        <option value="LI">LI</option>
                        <option value="CO">CO</option>
                    </select>
                </td>
                <td><input type="text" class="form-control form-control-sm" id="incid-${i}" placeholder="Detalle..."></td>
                <td><input type="text" class="form-control form-control-sm" id="obs-${i}" placeholder="Observación..."></td>
            </tr>`;
    }
}

async function guardarReportePrefectura() {
    const interesado = document.getElementById('nombreInteresado').value.trim();
    const jefe = document.getElementById('jefePersonal').value.trim();
    const turno = document.getElementById('turnoSelect').value;
    const fecha = document.getElementById('fechaIncidenciaPref').value;

    if (!interesado || !fecha) {
        return Swal.fire("Campos Incompletos", "El nombre del interesado y la fecha son obligatorios.", "warning");
    }

    const incidencias = [];
    for (let i = 1; i <= 8; i++) {
        const h = document.getElementById(`hora-${i}`).value;
        const c = document.getElementById(`clave-${i}`).value.toUpperCase();
        const det = document.getElementById(`incid-${i}`).value.trim();
        const obs = document.getElementById(`obs-${i}`).value.trim();
        if (h || c || det || obs) {
            incidencias.push({ modulo: i, hora: h, clave: c, detalle: det, obs: obs });
        }
    }

    if (incidencias.length === 0) {
        return Swal.fire("Módulos Requeridos", "Debe registrar al menos un módulo o incidencia.", "warning");
    }

    const folioStr = document.getElementById('badgeFolioPref').innerText.trim();
    
    try {
        Swal.fire({ title: 'Guardando reporte y generando PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        await fetch('/api/incidencias/personal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                _id: folioStr,
                clave_reporte: folioStr,
                interesado: interesado.toUpperCase(),
                jefe_personal: jefe.toUpperCase(),
                turno: turno,
                fecha: fecha,
                datos_modulos: incidencias,
                elaborado_por: "PREFECTURA"
            })
        });

        await generarPDFPrefectura(folioStr, interesado.toUpperCase(), fecha, turno, jefe.toUpperCase(), incidencias);
        await Swal.fire("Éxito", "Reporte guardado con folio: " + folioStr, "success");
        location.reload();
    } catch (e) {
        console.error("Error guardando reporte:", e);
        Swal.fire("Error", e.message, "error");
    }
}
window.guardarReportePrefectura = guardarReportePrefectura;

async function generarPDFPrefectura(folio, nombre, fechaStr, turno, jefe, datos) {
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const fecha = new Date(fechaStr + "T00:00:00");
    
    const original = document.getElementById('formatoPdfPrefectura');
    if (!original) return;

    const clon = original.cloneNode(true);
    clon.removeAttribute('id');

    const folEl = clon.querySelector('#pdfFolioPref');
    if (folEl) folEl.innerText = "FOLIO: " + folio;

    const diaEl = clon.querySelector('#pdfDia');
    if (diaEl) diaEl.innerText = fecha.getDate().toString().padStart(2, '0');

    const mesEl = clon.querySelector('#pdfMes');
    if (mesEl) mesEl.innerText = meses[fecha.getMonth()];

    const anioEl = clon.querySelector('#pdfAnio');
    if (anioEl) anioEl.innerText = fecha.getFullYear();

    const intEl = clon.querySelector('#pdfInteresado');
    if (intEl) intEl.innerText = nombre;

    const turEl = clon.querySelector('#pdfTurno');
    if (turEl) turEl.innerText = turno;

    const jefeEl = clon.querySelector('#pdfJefeFirma');
    if (jefeEl) jefeEl.innerText = jefe;

    const elabEl = clon.querySelector('#pdfElaboro');
    if (elabEl) elabEl.innerText = "PREFECTURA";

    const fElab = clon.querySelector('#pdfFechaElab');
    if (fElab) fElab.innerText = `${fecha.getDate()} DE ${meses[fecha.getMonth()]} DEL ${fecha.getFullYear()}`;

    const tbody = clon.querySelector('#pdfCuerpoTabla');
    if (tbody) {
        tbody.innerHTML = "";
        const datosMap = {};
        datos.forEach(d => datosMap[d.modulo] = d);

        for (let i = 1; i <= 8; i++) {
            const d = datosMap[i] || { hora: '', clave: '', detalle: '', obs: '' };
            tbody.innerHTML += `
                <tr style="height: 24px;">
                    <td style="border: 1px solid black; font-weight: bold; background: #fbfbfb;">${i}</td>
                    <td style="border: 1px solid black;">${d.hora || ''}</td>
                    <td style="border: 1px solid black; font-weight: bold; color: ${d.clave ? '#7b1b37' : '#000'};">${d.clave || ''}</td>
                    <td style="border: 1px solid black; text-align: left; padding-left: 6px;">${d.detalle || ''}</td>
                    <td style="border: 1px solid black; text-align: left; padding-left: 6px;">${d.obs || ''}</td>
                </tr>`;
        }
    }

    clon.style.boxShadow = 'none';
    clon.style.margin = '0';
    clon.style.width = '216mm';
    clon.style.minHeight = '279mm';

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '216mm';
    tempContainer.style.background = '#ffffff';
    tempContainer.appendChild(clon);
    document.body.appendChild(tempContainer);

    if (typeof html2pdf !== 'undefined') {
        await html2pdf().set({
            margin: 0,
            filename: `Reporte_Prefectura_${folio}_${nombre.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
            jsPDF: { unit: 'mm', format: [216, 279], orientation: 'portrait' }
        }).from(clon).save();
    }

    if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
    }
}

async function escucharHistorialPersonal() {
    try {
        const res = await fetch('/api/incidencias/personal');
        if (res.ok) {
            historialPrefecturaCache = await res.json();
            renderizarTablaHistorial();
        }
    } catch(e) { console.error(e); }
}

function renderizarTablaHistorial() {
    const tbody = document.getElementById('tablaHistorialPersonal');
    if (!tbody) return;
    tbody.innerHTML = "";

    const fNombre = normalizar(document.getElementById('filtroInteresado')?.value || "");
    const fFecha = document.getElementById('filtroFechaPref')?.value || "";
    const fTurno = document.getElementById('filtroTurnoPref')?.value || "";

    const filtrados = historialPrefecturaCache.filter(d => {
        const clave = normalizar(d.clave_reporte || d._id || "");
        const intNom = normalizar(d.interesado || "");
        return (intNom.includes(fNombre) || clave.includes(fNombre)) &&
               (fFecha === "" || d.fecha === fFecha) &&
               (fTurno === "" || d.turno === fTurno);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted small">No se encontraron reportes.</td></tr>`;
        return;
    }

    filtrados.slice(0, limiteHistorialPref).forEach(d => {
        const clave = d.clave_reporte || d._id || 'N/A';
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${clave}</td>
                <td class="fw-bold">${d.interesado}</td>
                <td>${d.fecha}</td>
                <td><span class="badge bg-light text-guinda border">${d.turno}</span></td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary border-0" title="Ver Formato Completo" onclick="verReportePersonal('${clave}')">
                            <i class="bi bi-eye-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger border-0" title="Descargar PDF" onclick="reimprimirReportePersonal('${clave}')">
                            <i class="bi bi-file-pdf-fill fs-5"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-dark border-0 text-danger" title="Eliminar Reporte" onclick="confirmarEliminarReportePersonal('${clave}')">
                            <i class="bi bi-trash-fill fs-5"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    if (filtrados.length > limiteHistorialPref) {
        tbody.innerHTML += `<tr><td colspan="5" class="text-center py-2 bg-light"><button class="btn btn-link btn-sm fw-bold" onclick="limiteHistorialPref += 10; renderizarTablaHistorial();">Mostrar más (+10)</button></td></tr>`;
    }
}

function filtrarHistorialPrefectura() {
    limiteHistorialPref = 10;
    renderizarTablaHistorial();
}

async function verReportePersonal(clave) {
    const item = historialPrefecturaCache.find(d => (d.clave_reporte === clave || d._id === clave));
    if (!item) return Swal.fire("Error", "No se encontró el reporte seleccionado.", "error");

    const original = document.getElementById('formatoPdfPrefectura');
    const contenedorModal = document.getElementById('contenedorModalPrefectura');
    if (!original || !contenedorModal) return;

    const clon = original.cloneNode(true);
    clon.removeAttribute('id');

    const folEl = clon.querySelector('#pdfFolioPref');
    if (folEl) folEl.innerText = "FOLIO: " + (item.clave_reporte || item._id || 'PREF-0001');

    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const fechaObj = item.fecha ? new Date(item.fecha + "T12:00:00") : new Date();

    const diaEl = clon.querySelector('#pdfDia');
    if (diaEl) diaEl.innerText = fechaObj.getDate().toString().padStart(2, '0');

    const mesEl = clon.querySelector('#pdfMes');
    if (mesEl) mesEl.innerText = meses[fechaObj.getMonth()];

    const anioEl = clon.querySelector('#pdfAnio');
    if (anioEl) anioEl.innerText = fechaObj.getFullYear();

    const intEl = clon.querySelector('#pdfInteresado');
    if (intEl) intEl.innerText = (item.interesado || '').toUpperCase();

    const turEl = clon.querySelector('#pdfTurno');
    if (turEl) turEl.innerText = item.turno || '';

    const jefeEl = clon.querySelector('#pdfJefeFirma');
    if (jefeEl) jefeEl.innerText = item.jefe_personal || document.getElementById('jefePersonal')?.value || '';

    const elabEl = clon.querySelector('#pdfElaboro');
    if (elabEl) elabEl.innerText = item.elaborado_por || "PREFECTURA";

    const fElab = clon.querySelector('#pdfFechaElab');
    if (fElab) fElab.innerText = `${fechaObj.getDate()} DE ${meses[fechaObj.getMonth()]} DEL ${fechaObj.getFullYear()}`;

    const tbody = clon.querySelector('#pdfCuerpoTabla');
    if (tbody) {
        tbody.innerHTML = "";
        const datosMap = {};
        (item.datos_modulos || []).forEach(d => datosMap[d.modulo] = d);

        for (let i = 1; i <= 8; i++) {
            const d = datosMap[i] || { hora: '', clave: '', detalle: '', obs: '' };
            tbody.innerHTML += `
                <tr style="height: 24px;">
                    <td style="border: 1px solid black; font-weight: bold; background: #fbfbfb;">${i}</td>
                    <td style="border: 1px solid black;">${d.hora || ''}</td>
                    <td style="border: 1px solid black; font-weight: bold; color: ${d.clave ? '#7b1b37' : '#000'};">${d.clave || ''}</td>
                    <td style="border: 1px solid black; text-align: left; padding-left: 6px;">${d.detalle || ''}</td>
                    <td style="border: 1px solid black; text-align: left; padding-left: 6px;">${d.obs || ''}</td>
                </tr>`;
        }
    }

    contenedorModal.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = "100%";
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = "center";
    wrapper.style.overflow = "hidden";

    clon.style.transform = "scale(0.68)";
    clon.style.transformOrigin = "top center";
    clon.style.margin = "0 auto";
    clon.style.marginBottom = "-90mm";
    clon.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
    clon.style.borderRadius = "4px";

    wrapper.appendChild(clon);
    contenedorModal.appendChild(wrapper);

    const modalEl = document.getElementById('modalVisualizarPrefectura');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
window.verReportePersonal = verReportePersonal;

async function reimprimirReportePersonal(clave) {
    const item = historialPrefecturaCache.find(d => (d.clave_reporte === clave || d._id === clave));
    if (!item) return Swal.fire("Error", "No se encontró el reporte seleccionado.", "error");

    try {
        Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });
        await generarPDFPrefectura(
            item.clave_reporte || item._id || 'PREF-0001',
            item.interesado || '',
            item.fecha,
            item.turno || '',
            item.jefe_personal || document.getElementById('jefePersonal')?.value || '',
            item.datos_modulos || []
        );
        Swal.close();
    } catch(e) {
        console.error("Error al reimprimir:", e);
        Swal.fire("Error", "No se pudo generar el PDF: " + e.message, "error");
    }
}
window.reimprimirReportePersonal = reimprimirReportePersonal;

async function confirmarEliminarReportePersonal(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Borrar reporte?',
        text: `El reporte ${id} se eliminará permanentemente de MongoDB.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Eliminando...', didOpen: () => Swal.showLoading() });
            const res = await fetch(`/api/incidencias/personal/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Error en servidor al eliminar");

            await Swal.fire("Eliminado", "El reporte ha sido eliminado.", "success");
            await actualizarSiguienteFolioPrefectura();
            await escucharHistorialPersonal();
        } catch (e) {
            Swal.fire("Error", "No se pudo eliminar el reporte: " + e.message, "error");
        }
    }
}
window.confirmarEliminarReportePersonal = confirmarEliminarReportePersonal;
