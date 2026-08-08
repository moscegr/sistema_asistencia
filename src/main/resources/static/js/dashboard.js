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
    setInterval(cargarDashboardCompleto, 60000);
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

function inicializarVistaCiclo() {
    const displayHeader = document.getElementById('displayCicloActual');
    if (displayHeader) displayHeader.innerText = "AGO-DIC 2026";
}

function verificarIntegridadSistema() {
    console.log("Sistema CBTis 134 inicializado con MongoDB.");
}

/**
 * Carga el Dashboard consultando la REST API /api/alumnos
 */
async function cargarDashboardCompleto() {
    try {
        const res = await fetch('/api/alumnos');
        if (!res.ok) return;
        const alumnos = await res.json();

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

function cargarEspecialidadesPromocion() {
    const selectCiclo = document.getElementById('selectCicloEsp');
    const selectFiltro = document.getElementById('selectFiltroModulo'); 

    const especialidadesCache = [
        "PROGRAMACIÓN",
        "OFIMÁTICA",
        "SOPORTE Y MANTENIMIENTO",
        "CONTABILIDAD",
        "CONSTRUCCIÓN"
    ];

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