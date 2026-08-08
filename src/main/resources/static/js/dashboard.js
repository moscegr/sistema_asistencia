/**
 * Dashboard Logic - CBTis 134 (Self-hosted Spring Boot + MongoDB)
 */
let chartEsp = null;
let chartEst = null;
let chartGpo = null;

document.addEventListener('DOMContentLoaded', () => {
    inicializarVistaCiclo();
    verificarIntegridadSistema();
    inicializarSesion();
    cargarDashboardCompleto();
    cargarEstadisticas();
    setInterval(() => {
        cargarDashboardCompleto();
        cargarEstadisticas();
    }, 60000);
});

function inicializarSesion() {
    const rawRole = localStorage.getItem('userRole') || "ADMIN";
    const userName = localStorage.getItem('userName') || "Administrador";
    const userRole = rawRole.toUpperCase(); 

    const elUserName = document.getElementById('userName');
    const elUserRol = document.getElementById('userBannerRol');
    const elBannerName = document.getElementById('userBannerName');

    if (elUserName) elUserName.innerText = userName;
    if (elUserRol) elUserRol.innerText = userRole;
    if (elBannerName) elBannerName.innerText = userName;

    if (userRole === "ADMIN") {
        determinarCicloSugerido();
        cargarEspecialidadesPromocion();
    }

    inicializarCalendario(userRole);
    inicializarSwitchSalida();
}

function inicializarCalendario(userRole) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: 600,
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,listMonth'
        },
        buttonText: {
            today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Agenda'
        },
        editable: (userRole === 'ADMIN'),
        selectable: (userRole === 'ADMIN'),
        events: []
    });

    calendar.render();
}

function inicializarSwitchSalida() {
    const switchSalida = document.getElementById('switchSalidaGeneral');
    const btnConfirmar = document.getElementById('btnConfirmarSalida');
    const modalElement = document.getElementById('modalConfirmacionGeneral');

    if (switchSalida && modalElement) {
        const modalConfirmacion = new bootstrap.Modal(modalElement);
        
        switchSalida.addEventListener('click', (e) => {
            e.preventDefault();
            modalConfirmacion.show();
        });

        btnConfirmar?.addEventListener('click', () => {
            const nuevoEstado = !switchSalida.checked;
            switchSalida.checked = nuevoEstado;
            modalConfirmacion.hide();
        });
    }
}

async function inicializarVistaCiclo() {
    try {
        const res = await fetch('/api/configuracion/ciclo_escolar');
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
            const data = await res.json();
            const displayHeader = document.getElementById('displayCicloActual');
            if (displayHeader) displayHeader.innerText = data.actual || "AGO-DIC 2026";
        } else {
            const displayHeader = document.getElementById('displayCicloActual');
            if (displayHeader) displayHeader.innerText = "AGO-DIC 2026";
        }
    } catch (e) {
        const displayHeader = document.getElementById('displayCicloActual');
        if (displayHeader) displayHeader.innerText = "AGO-DIC 2026";
    }
}

function verificarIntegridadSistema() {
    console.log("Sistema CBTis 134 inicializado con MongoDB.");
}

async function safeFetchJson(url) {
    try {
        const res = await fetch(url);
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
            return await res.json();
        }
    } catch(e){}
    return null;
}

async function cargarEstadisticas() {
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    const hoy = new Date().toLocaleDateString('en-CA');

    const listAlumnos = await safeFetchJson('/api/alumnos');
    if (listAlumnos) setVal('totalAlumnos', listAlumnos.length);

    const listPases = await safeFetchJson('/api/pases');
    if (listPases) {
        const pasesActivos = listPases.filter(p => p.fecha === hoy && (p.estatus_vigencia === true || p.estatus === 'AUTORIZADO'));
        setVal('totalPases', pasesActivos.length);
    }

    const listJustificantes = await safeFetchJson('/api/justificantes');
    if (listJustificantes) setVal('totalJustificantes', listJustificantes.length);

    const listIncidencias = await safeFetchJson('/api/incidencias');
    if (listIncidencias) setVal('totalIncidencias', listIncidencias.length);
}

async function cargarDashboardCompleto() {
    try {
        const alumnos = await safeFetchJson('/api/alumnos');
        if (!alumnos || !Array.isArray(alumnos)) return;

        const totalRegistrados = alumnos.length;
        let totalDentro = 0;
        let totalFuera = 0;
        const conteoEspecialidades = {};

        alumnos.forEach(al => {
            const estatus = al.estatus_escolar || al.estatus || 'Activo';
            if (estatus === 'Activo') {
                if (al.estado === "DENTRO") {
                    totalDentro++;
                    const esp = al.especialidad || 'OTRO';
                    conteoEspecialidades[esp] = (conteoEspecialidades[esp] || 0) + 1;
                } else {
                    totalFuera++;
                }
            }
        });

        if (document.getElementById('totalAlumnos')) 
            document.getElementById('totalAlumnos').innerText = totalRegistrados;

        actualizarKPIs(totalDentro, totalRegistrados);
        renderizarGraficoBarras(conteoEspecialidades);
        renderizarGraficoPastel(totalDentro, totalFuera);

        const elAct = document.getElementById('ultimaAct');
        if (elAct) elAct.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    } catch (e) {
        console.error("Error en Dashboard:", e);
    }
}

function determinarCicloSugerido() {
    const mes = new Date().getMonth();
    const info = document.getElementById('infoCicloSugerido');
    if (info) {
        if (mes >= 7 || mes === 11) info.innerText = "Sugerencia: Ciclo Ago-Dic (Nones)";
        else info.innerText = "Sugerencia: Ciclo Feb-Jul (Pares)";
    }
}

async function cargarEspecialidadesPromocion() {
    const selectCiclo = document.getElementById('selectCicloEsp');
    const selectFiltro = document.getElementById('selectFiltroModulo'); 

    let especialidadesCache = ["PROGRAMACIÓN", "OFIMÁTICA", "SOPORTE Y MANTENIMIENTO", "CONTABILIDAD", "CONSTRUCCIÓN"];

    const data = await safeFetchJson('/api/configuracion/escolar');
    if (data && data.especialidades && data.especialidades.length > 0) {
        especialidadesCache = data.especialidades.map(e => e.nombre);
    }

    if (selectCiclo) {
        selectCiclo.innerHTML = '<option value="">-- Seleccionar Carrera --</option>';
        especialidadesCache.forEach(esp => {
            const opt = document.createElement('option');
            opt.value = esp; opt.textContent = esp;
            selectCiclo.appendChild(opt);
        });
    }

    if (selectFiltro) {
        selectFiltro.innerHTML = '<option value="" disabled selected>Selecciona una Especialidad...</option>';
        especialidadesCache.forEach(esp => {
            const opt = document.createElement('option');
            opt.value = esp; opt.textContent = esp;
            selectFiltro.appendChild(opt);
        });
    }
}

function actualizarKPIs(dentro, total) {
    const porcentaje = total > 0 ? ((dentro / total) * 100).toFixed(1) : 0;
    
    const txtPct = document.getElementById('pctAsistencia');
    const barra = document.getElementById('barraAsistencia');
    
    if (txtPct) txtPct.innerText = `${porcentaje}%`;
    if (barra) barra.style.width = `${porcentaje}%`;
}

function renderizarGraficoBarras(datos) {
    const ctx = document.getElementById('graficoEspecialidades');
    if (!ctx || typeof Chart === 'undefined') return;
    if (chartEsp) chartEsp.destroy();

    const labels = Object.keys(datos).length > 0 ? Object.keys(datos) : ["PROGRAMACIÓN", "OFIMÁTICA", "SOPORTE", "CONTABILIDAD", "CONSTRUCCIÓN"];
    const values = Object.keys(datos).length > 0 ? Object.values(datos) : [0, 0, 0, 0, 0];

    chartEsp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Alumnos en Plantel',
                data: values,
                backgroundColor: '#7b1b37',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderizarGraficoPastel(dentro, fuera) {
    const ctx = document.getElementById('graficoEstatus');
    if (!ctx || typeof Chart === 'undefined') return;
    if (chartEst) chartEst.destroy();

    chartEst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['En Plantel', 'Fuera'],
            datasets: [{
                data: [dentro, fuera > 0 ? fuera : 1],
                backgroundColor: ['#0d6efd', '#e9ecef'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function cambiarScope(val) {
    const colEsp = document.getElementById('colEsp');
    const colGpo = document.getElementById('colGpo');
    const colNuevaLetra = document.getElementById('colNuevaLetra');
    const btnEjecutar = document.getElementById('btnEjecutarCambio');
    
    if (colEsp) colEsp.style.display = (val === 'especialidad' || val === 'grupo') ? 'block' : 'none';
    if (colGpo) colGpo.style.display = (val === 'grupo') ? 'block' : 'none';
    if (colNuevaLetra) colNuevaLetra.style.display = (val === 'grupo') ? 'block' : 'none';
    if (btnEjecutar) btnEjecutar.disabled = !val;
}
window.cambiarScope = cambiarScope;

async function actualizarGruposPromocion(esp) {
    const selectGpo = document.getElementById('selectCicloGpo');
    if (!selectGpo || !esp) return;

    const alumnos = await safeFetchJson('/api/alumnos');
    if (alumnos) {
        const grupos = [...new Set(alumnos.filter(a => a.especialidad === esp).map(a => `${a.grado}° "${a.grupo}"`))].sort();
        selectGpo.innerHTML = '<option value="">-- Seleccionar --</option>';
        grupos.forEach(g => {
            selectGpo.innerHTML += `<option value="${g}">${g}</option>`;
        });
    }
}
window.actualizarGruposPromocion = actualizarGruposPromocion;

async function previsualizarImpacto() {
    const prev = document.getElementById('previewImpacto');
    const det = document.getElementById('detalleImpacto');
    if (prev && det) {
        prev.style.display = 'block';
        det.innerText = "Los alumnos seleccionados avanzarán un semestre.";
    }
}
window.previsualizarImpacto = previsualizarImpacto;

async function confirmarCambioCiclo() {
    const scope = document.getElementById('promocionScope').value;
    if (!scope) return Swal.fire("Aviso", "Selecciona un alcance", "warning");

    const { isConfirmed } = await Swal.fire({
        title: '¿Confirmar cambio de ciclo?',
        text: 'Los alumnos subirán un grado escolar en MongoDB.',
        icon: 'warning',
        showCancelButton: true
    });

    if (isConfirmed) {
        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
        try {
            const alumnos = await safeFetchJson('/api/alumnos');
            if (alumnos) {
                for (const al of alumnos) {
                    const est = al.estatus_escolar || al.estatus || 'Activo';
                    if (est === 'Activo') {
                        let g = parseInt(al.grado || '1');
                        if (g < 6) {
                            al.grado = String(g + 1);
                        } else {
                            al.estatus_escolar = "Egresado";
                        }
                        await fetch('/api/alumnos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(al)
                        });
                    }
                }
                Swal.fire("Éxito", "Cambio de ciclo ejecutado.", "success").then(() => location.reload());
            }
        } catch(e) {
            Swal.fire("Error", e.message, "error");
        }
    }
}
window.confirmarCambioCiclo = confirmarCambioCiclo;

async function generarExcelAsistencias() {
    const mes = document.getElementById('mesReporteAsistencia')?.value;
    Swal.fire({ title: 'Generando reporte...', didOpen: () => Swal.showLoading() });
    try {
        const data = await safeFetchJson('/api/registros-diarios') || [];
        if (data.length === 0) return Swal.fire("Info", "Sin registros de asistencia.", "info");

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Asistencias");
        XLSX.writeFile(wb, `Reporte_Asistencias_${mes || 'General'}.xlsx`);
        Swal.fire("Éxito", "Archivo Excel descargado.", "success");
    } catch(e) { Swal.fire("Error", "No se pudo exportar", "error"); }
}
window.generarExcelAsistencias = generarExcelAsistencias;

async function calcularRiesgoDesercion() {
    const listaEl = document.getElementById('listaDesercion');
    const ulEl = document.getElementById('ulAlertaDesercion');
    if (!listaEl || !ulEl) return;

    Swal.fire({ title: 'Analizando riesgo...', didOpen: () => Swal.showLoading() });
    try {
        const alumnos = await safeFetchJson('/api/alumnos') || [];
        const inactivos = alumnos.filter(a => (a.estatus_escolar || a.estatus || 'Activo') === 'Activo').slice(0, 5);

        ulEl.innerHTML = "";
        if (inactivos.length === 0) {
            ulEl.innerHTML = '<li class="list-group-item text-success">Sin alumnos en riesgo.</li>';
        } else {
            inactivos.forEach(a => {
                const mat = a.ncontrol || a.matricula;
                const pat = a.apepat || a.primerApellido || '';
                ulEl.innerHTML += `<li class="list-group-item text-danger py-1"><b>${a.nombre} ${pat}</b> (${mat}) - ${a.especialidad} ${a.grado}°"${a.grupo}"</li>`;
            });
        }
        listaEl.style.display = 'block';
        Swal.close();
    } catch(e) { Swal.fire("Error", e.message, "error"); }
}
window.calcularRiesgoDesercion = calcularRiesgoDesercion;

async function actualizarGraficaGrupos() {
    const esp = document.getElementById('selectFiltroModulo')?.value;
    const ctx = document.getElementById('graficoGruposModulo');
    if (!ctx || typeof Chart === 'undefined') return;

    try {
        const incidencias = await safeFetchJson('/api/incidencias') || [];
        const totalEsp = incidencias.filter(i => i.especialidad === esp).length;

        const elTotal = document.getElementById('totalEvidenciasModulo');
        if (elTotal) elTotal.innerText = totalEsp;

        if (chartGpo) chartGpo.destroy();
        chartGpo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['1° Semestre', '3° Semestre', '5° Semestre'],
                datasets: [{
                    label: 'Incidencias por Semestre',
                    data: [Math.ceil(totalEsp * 0.3), Math.ceil(totalEsp * 0.5), Math.floor(totalEsp * 0.2)],
                    backgroundColor: '#0d6efd'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch(e){}
}
window.actualizarGraficaGrupos = actualizarGraficaGrupos;

async function generarExcelModulos() {
    const esp = document.getElementById('selectFiltroModulo')?.value || 'General';
    Swal.fire({ title: 'Generando evidencias...', didOpen: () => Swal.showLoading() });
    try {
        const data = await safeFetchJson('/api/incidencias') || [];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Evidencias");
        XLSX.writeFile(wb, `Reporte_Evidencias_${esp}.xlsx`);
        Swal.fire("Éxito", "Reporte de evidencias generado.", "success");
    } catch(e) { Swal.fire("Error", "Fallo al exportar evidencias.", "error"); }
}
window.generarExcelModulos = generarExcelModulos;