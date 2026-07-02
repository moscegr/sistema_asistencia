const obtenerHoy = () => new Date().toLocaleDateString('en-CA');
let historialPrefecturaCache = [];
let limiteHistorialPref = 10;

const normalizar = (texto) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fechaIncidenciaPref').value = obtenerHoy();
    generarFilasModulos();
    escucharHistorialPersonal();

    const fInteresado = document.getElementById('filtroInteresado');
    const fFecha = document.getElementById('filtroFechaPref');
    const fTurno = document.getElementById('filtroTurnoPref');

    if (fInteresado) fInteresado.addEventListener('input', filtrarHistorialPrefectura);
    if (fFecha) fFecha.addEventListener('input', filtrarHistorialPrefectura);
    if (fTurno) fTurno.addEventListener('change', filtrarHistorialPrefectura);
});

function generarFilasModulos() {
    const tbody = document.getElementById('tablaModulosIncidencias');
    tbody.innerHTML = "";
    for (let i = 1; i <= 8; i++) {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${i}</td>
                <td><input type="time" class="form-control form-control-sm border-0 text-center" id="hora-${i}"></td>
                <td><input type="text" class="form-control form-control-sm border-0 text-center fw-bold" id="clave-${i}" maxlength="2" placeholder="..."></td>
                <td><input type="text" class="form-control form-control-sm border-0" id="incid-${i}"></td>
                <td><input type="text" class="form-control form-control-sm border-0" id="obs-${i}"></td>
            </tr>`;
    }
}

async function guardarReportePrefectura() {
    const interesado = document.getElementById('nombreInteresado').value.trim();
    const jefe = document.getElementById('jefePersonal').value.trim();
    const turno = document.getElementById('turnoSelect').value;
    const fecha = document.getElementById('fechaIncidenciaPref').value;

    if (!interesado || !jefe) return Swal.fire("Atención", "Complete el nombre del interesado y el jefe de personal.", "warning");

    const incidencias = [];
    for (let i = 1; i <= 8; i++) {
        const h = document.getElementById(`hora-${i}`).value;
        const c = document.getElementById(`clave-${i}`).value.toUpperCase();
        if (h || c) {
            incidencias.push({ modulo: i, hora: h, clave: c, detalle: document.getElementById(`incid-${i}`).value, obs: document.getElementById(`obs-${i}`).value });
        }
    }

    const claveBD = fecha.replace(/-/g, '') + "_" + Math.floor(Date.now() / 1000).toString().slice(-4);
    
    try {
        await db.collection("incidencias_personal").doc(claveBD).set({
            clave_reporte: claveBD,
            interesado: interesado.toUpperCase(),
            jefe_personal: jefe.toUpperCase(),
            turno: turno,
            fecha: fecha,
            datos_modulos: incidencias,
            elaborado_por: "MANUAL"
        });

        generarPDFPrefectura(interesado.toUpperCase(), fecha, turno, jefe.toUpperCase(), incidencias);
        Swal.fire("Éxito", "Reporte guardado con clave: " + claveBD, "success");
    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

function generarPDFPrefectura(nombre, fechaStr, turno, jefe, datos) {
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    const fecha = new Date(fechaStr + "T00:00:00");
    
    const elements = {
        dia: document.getElementById('pdfDia'),
        mes: document.getElementById('pdfMes'),
        anio: document.getElementById('pdfAnio'),
        interesado: document.getElementById('pdfInteresado'),
        turno: document.getElementById('pdfTurno'),
        jefe: document.getElementById('pdfJefeFirma'),
        tbody: document.getElementById('pdfCuerpoTabla'),
        formato: document.getElementById('formatoPdfPrefectura')
    };

    if (Object.values(elements).some(el => !el)) {
        return Swal.fire("Error de Plantilla", "IDs faltantes en el HTML oculto.", "error");
    }

    elements.dia.innerText = fecha.getDate();
    elements.mes.innerText = meses[fecha.getMonth()];
    elements.anio.innerText = fecha.getFullYear();
    elements.interesado.innerText = nombre;
    elements.turno.innerText = turno;
    elements.jefe.innerText = jefe;

    elements.tbody.innerHTML = "";
    const datosMap = {};
    datos.forEach(d => datosMap[d.modulo] = d);

    for (let i = 1; i <= 8; i++) {
        const d = datosMap[i] || { hora: '', clave: '', detalle: '', obs: '' };
        elements.tbody.innerHTML += `
            <tr style="height: 30px;">
                <td style="border: 1px solid black; font-weight: bold;">${i}</td>
                <td style="border: 1px solid black;">${d.hora}</td>
                <td style="border: 1px solid black; font-weight: bold;">${d.clave}</td>
                <td style="border: 1px solid black; text-align: left; padding-left: 5px;">${d.detalle}</td>
                <td style="border: 1px solid black; text-align: left; padding-left: 5px;">${d.obs}</td>
            </tr>`;
    }

    html2pdf().set({
        margin: 0,
        filename: `Reporte_Prefectura_${nombre}.pdf`,
        html2canvas: { scale: 3 },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
    }).from(elements.formato).save();
}

function escucharHistorialPersonal() {
    db.collection("incidencias_personal").orderBy("fecha", "desc").onSnapshot(snap => {
        historialPrefecturaCache = snap.docs.map(doc => doc.data());
        renderizarTablaHistorial();
    });
}

function renderizarTablaHistorial() {
    const tbody = document.getElementById('tablaHistorialPersonal');
    if (!tbody) return;
    tbody.innerHTML = "";

    const fNombre = normalizar(document.getElementById('filtroInteresado')?.value || "");
    const fFecha = document.getElementById('filtroFechaPref')?.value || "";
    const fTurno = document.getElementById('filtroTurnoPref')?.value || "";

    const filtrados = historialPrefecturaCache.filter(d => {
        return normalizar(d.interesado || "").includes(fNombre) &&
               (fFecha === "" || d.fecha === fFecha) &&
               (fTurno === "" || d.turno === fTurno);
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted small">No se encontraron reportes.</td></tr>`;
        return;
    }

    filtrados.slice(0, limiteHistorialPref).forEach(d => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-guinda">${d.clave_reporte}</td>
                <td>${d.interesado}</td>
                <td>${d.fecha}</td>
                <td><span class="badge bg-info text-dark">${d.turno}</span></td>
                <td class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-danger" onclick="reimprimirReportePersonal('${d.clave_reporte}')">
                            <i class="bi bi-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-dark border-0 text-danger" onclick="confirmarEliminarReportePersonal('${d.clave_reporte}')">
                            <i class="bi bi-trash-fill"></i>
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

async function confirmarEliminarReportePersonal(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Borrar reporte?',
        text: `El folio ${id} se eliminará permanentemente.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar'
    });

    if (isConfirmed) {
        try {
            await db.collection("incidencias_personal").doc(id).delete();
            Swal.fire("Éxito", "Reporte eliminado.", "success");
        } catch (e) {
            Swal.fire("Error", e.message, "error");
        }
    }
}

function reimprimirReportePersonal(clave) {
    const r = historialPrefecturaCache.find(item => item.clave_reporte === clave);
    if (r) {
        Swal.fire({ title: 'Generando PDF...', didOpen: () => Swal.showLoading() });
        generarPDFPrefectura(r.interesado, r.fecha, r.turno, r.jefe_personal, r.datos_modulos);
        Swal.close();
    }
}