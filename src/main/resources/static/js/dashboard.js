let chartEsp = null;
let chartFlujo = null;
let chartGpo = null;
let chartPersonal = null;
let listaAlumnosRiesgoGlobal = [];
let filtroRiesgoActual = 'TODOS';
let calendarioInstancia = null;
let todosEventosCalendario = [];
let filtroCalendarioActual = 'TODOS';

document.addEventListener('DOMContentLoaded', () => {
    inicializarVistaCiclo();
    verificarIntegridadSistema();
    inicializarSesion();
    cargarClimaPlantel();
    cargarDashboardCompleto();
    cargarEstadisticas();
    cargarEstadisticasPersonal();
    
    // Recarga en vivo periódica
    setInterval(() => {
        cargarDashboardCompleto();
        cargarEstadisticas();
        cargarEstadisticasPersonal();
    }, 60000);

    // Recarga de clima cada 10 minutos
    setInterval(cargarClimaPlantel, 600000);
});

async function cargarClimaPlantel() {
    const elTemp = document.getElementById('climaTemp');
    const elSens = document.getElementById('climaSensacion');
    const elDesc = document.getElementById('climaDesc');
    const elIcono = document.getElementById('climaIcono');
    const elHum = document.getElementById('climaHumedad');
    const elViento = document.getElementById('climaViento');
    const elAlerta = document.getElementById('climaAlerta');

    if (!elTemp) return;

    try {
        // Coordenadas oficiales de Chilpancingo de los Bravo, Guerrero (Plantel CBTis 134)
        const lat = 17.5513;
        const lon = -99.5005;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=America%2FMexico_City`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error("Error en API Open-Meteo");
        const data = await res.json();
        const curr = data.current;

        const temp = Math.round(curr.temperature_2m);
        const sens = Math.round(curr.apparent_temperature);
        const hum = Math.round(curr.relative_humidity_2m);
        const viento = Math.round(curr.wind_speed_10m);
        const code = curr.weather_code;
        const isDay = curr.is_day === 1;

        elTemp.innerText = `${temp}°C`;
        if (elSens) elSens.innerText = `(${sens}°C sens.)`;
        if (elHum) elHum.innerText = `${hum}%`;
        if (elViento) elViento.innerText = `${viento} km/h`;

        let desc = "Despejado";
        let iconHtml = isDay ? '<i class="bi bi-sun-fill text-warning"></i>' : '<i class="bi bi-moon-stars-fill text-warning"></i>';
        let alertaTxt = '<i class="bi bi-check-circle me-1"></i>Condiciones óptimas para actividades cívicas y deportivas.';

        if (code === 0) {
            desc = isDay ? "Cielo Despejado" : "Noche Despejada";
            iconHtml = isDay ? '<i class="bi bi-sun-fill text-warning"></i>' : '<i class="bi bi-moon-stars-fill text-warning"></i>';
        } else if (code >= 1 && code <= 3) {
            desc = code === 1 ? "Mayormente Soleado" : (code === 2 ? "Parcialmente Nublado" : "Nublado");
            iconHtml = isDay ? '<i class="bi bi-cloud-sun-fill text-warning"></i>' : '<i class="bi bi-cloud-moon-fill text-light"></i>';
            alertaTxt = '<i class="bi bi-check2-circle me-1"></i>Clima favorable para jornada escolar en explanada.';
        } else if (code === 45 || code === 48) {
            desc = "Niebla matutina";
            iconHtml = '<i class="bi bi-cloud-haze2-fill text-light"></i>';
            alertaTxt = '<i class="bi bi-eye-slash me-1"></i>Precaución por visibilidad en accesos al plantel.';
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
            desc = code >= 61 ? "Lluvia moderada" : "Llovizna";
            iconHtml = '<i class="bi bi-cloud-rain-heavy-fill text-info"></i>';
            alertaTxt = '<i class="bi bi-umbrella-fill me-1 text-danger"></i>Lluvia activa: Habilitar techumbre y resguardar alumnos.';
        } else if (code >= 95) {
            desc = "Tormenta Eléctrica";
            iconHtml = '<i class="bi bi-cloud-lightning-rain-fill text-danger"></i>';
            alertaTxt = '<i class="bi bi-lightning-charge-fill me-1 text-danger"></i>Alerta climática: Suspender actividades al aire libre.';
        }

        if (temp >= 33) {
            alertaTxt = '<i class="bi bi-thermometer-sun me-1 text-warning"></i>Temperatura alta: Mantener hidratación continua.';
        }

        if (elDesc) elDesc.innerText = desc;
        if (elIcono) elIcono.innerHTML = iconHtml;
        if (elAlerta) elAlerta.innerHTML = alertaTxt;

    } catch (e) {
        console.warn("Clima fallback local:", e);
        if (elTemp) elTemp.innerText = "24°C";
        if (elSens) elSens.innerText = "(25°C sens.)";
        if (elDesc) elDesc.innerText = "Mayormente Soleado";
        if (elHum) elHum.innerText = "48%";
        if (elViento) elViento.innerText = "12 km/h";
        if (elAlerta) elAlerta.innerHTML = '<i class="bi bi-check-circle me-1"></i>Jornada escolar regular en aulas y talleres.';
    }
}
window.cargarClimaPlantel = cargarClimaPlantel;

async function inicializarSesion() {
    const rawRole = localStorage.getItem('userRole') || "ADMIN";
    let userName = localStorage.getItem('userName') || "Administrador";
    let userEmail = localStorage.getItem('userEmail') || "";

    try {
        const list = await safeFetchJson('/api/usuarios');
        if (list && Array.isArray(list)) {
            const found = list.find(u => u.correo === userName || u.correo === userEmail || u.nombre === userName);
            if (found) {
                userName = found.nombre;
                userEmail = found.correo;
                localStorage.setItem('userName', found.nombre);
                localStorage.setItem('userEmail', found.correo);
                if (found.rol) localStorage.setItem('userRole', found.rol);
            }
        }
    } catch(e){}

    const userRole = (localStorage.getItem('userRole') || rawRole).toUpperCase(); 

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

async function cargarDashboardCompleto() {
    try {
        const hoy = new Date().toLocaleDateString('en-CA');
        const [rawAlumnos, rawRegistros, rawUsuarios, rawPases, rawConfig] = await Promise.all([
            safeFetchJson('/api/alumnos'),
            safeFetchJson(`/api/registros-diarios/fecha/${hoy}`),
            safeFetchJson('/api/usuarios'),
            safeFetchJson('/api/pases'),
            safeFetchJson('/api/configuracion/escolar')
        ]);

        const alumnos = Array.isArray(rawAlumnos) ? rawAlumnos : [];
        const registrosHoy = Array.isArray(rawRegistros) ? rawRegistros : [];
        const usuarios = Array.isArray(rawUsuarios) ? rawUsuarios : [];
        const pases = Array.isArray(rawPases) ? rawPases : [];
        const configEscolar = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {};

        const activos = alumnos.filter(al => (al.estatus_escolar || al.estatus || 'Activo') === 'Activo');
        const totalRegistrados = activos.length;
        
        // Mapeo preciso de asistencia de alumnos hoy
        const matriculasPresentesHoy = new Set();
        (registrosHoy || []).forEach(r => {
            const esDentro = (r.estatus_actual === 'DENTRO') || (r.hora_entrada && !r.hora_salida);
            if (esDentro && r.grupo !== 'PERSONAL') {
                if (r.matricula) matriculasPresentesHoy.add(String(r.matricula).trim().toUpperCase());
                if (r.ncontrol) matriculasPresentesHoy.add(String(r.ncontrol).trim().toUpperCase());
            }
        });

        let totalDentro = 0;
        const conteoCarrerasTotal = {};
        const conteoCarrerasPresentes = {};

        // Inicializar especialidades disponibles
        let especialidades = (configEscolar.especialidades || []).map(e => e.nombre);
        if (especialidades.length === 0) {
            especialidades = ["PROGRAMACIÓN", "OFIMÁTICA", "SOPORTE Y MANTENIMIENTO", "CONTABILIDAD", "CONSTRUCCIÓN", "LABORATORISTA CLÍNICO", "E-COMMERCE", "INTELIGENCIA ARTIFICIAL", "ADMINISTRACIÓN"];
        }

        // Agregar carreras presentes en los alumnos si no estaban en el catálogo
        activos.forEach(al => {
            const esp = (al.especialidad || 'TRONCO COMÚN').trim().toUpperCase();
            if (!especialidades.includes(esp)) especialidades.push(esp);
        });

        especialidades.forEach(esp => {
            conteoCarrerasTotal[esp] = 0;
            conteoCarrerasPresentes[esp] = 0;
        });

        activos.forEach(al => {
            const esp = (al.especialidad || 'TRONCO COMÚN').trim().toUpperCase();
            conteoCarrerasTotal[esp] = (conteoCarrerasTotal[esp] || 0) + 1;
            
            const mat = String(al.ncontrol || al.matricula || '').trim().toUpperCase();
            const estaDentro = matriculasPresentesHoy.has(mat) || al.estado === "DENTRO";
            if (estaDentro) {
                totalDentro++;
                conteoCarrerasPresentes[esp] = (conteoCarrerasPresentes[esp] || 0) + 1;
            }
        });

        // 1. Mini KPIs de Centro de Inteligencia
        const pctPermanencia = totalRegistrados > 0 ? ((totalDentro / totalRegistrados) * 100).toFixed(1) : 0;
        const elKpiPerm = document.getElementById('kpiPermanencia');
        const elKpiPermSub = document.getElementById('kpiPermanenciaSub');
        if (elKpiPerm) elKpiPerm.innerText = `${pctPermanencia}%`;
        if (elKpiPermSub) elKpiPermSub.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${totalDentro} de ${totalRegistrados} alumnos`;

        const pasesHoyCount = (pases || []).filter(p => p.fecha === hoy && (p.estatus_vigencia === true || p.estatus === 'AUTORIZADO')).length;
        const elKpiPases = document.getElementById('kpiPasesHoy');
        if (elKpiPases) elKpiPases.innerText = pasesHoyCount;

        // 2. Personal hoy
        let docMat = 0, docVesp = 0, admMat = 0, admVesp = 0, personalPresenteCount = 0;
        const personalHoySet = new Set();
        (registrosHoy || []).forEach(r => {
            const esDentro = (r.estatus_actual === 'DENTRO') || (r.hora_entrada && !r.hora_salida);
            if (esDentro) {
                if (r.matricula) personalHoySet.add(String(r.matricula).trim().toUpperCase());
                if (r.ncontrol) personalHoySet.add(String(r.ncontrol).trim().toUpperCase());
                if (r.id) personalHoySet.add(String(r.id).trim().toUpperCase());
            }
        });

        (usuarios || []).forEach(u => {
            const rol = (u.rol || 'DOCENTE').toUpperCase();
            const turno = (u.turno || 'Matutino').toUpperCase();
            const rfc = String(u.rfc || '').trim().toUpperCase();
            const uid = String(u.uid || '').trim().toUpperCase();
            const id = String(u.id || '').trim().toUpperCase();
            const correo = String(u.correo || '').trim().toUpperCase();

            if (rol === 'DOCENTE') {
                if (turno.includes('VESP') || turno === 'VESPERTINO') docVesp++;
                else docMat++;
            } else {
                if (turno.includes('VESP') || turno === 'VESPERTINO') admVesp++;
                else admMat++;
            }

            const estaPresente = (rfc && personalHoySet.has(rfc)) ||
                                 (uid && personalHoySet.has(uid)) ||
                                 (id && personalHoySet.has(id)) ||
                                 (correo && personalHoySet.has(correo)) ||
                                 (u.estado === 'DENTRO');

            if (estaPresente) {
                personalPresenteCount++;
            }
        });

        const elKpiPers = document.getElementById('kpiPersonalPresente');
        const elKpiPersSub = document.getElementById('kpiPersonalPresenteSub');
        if (elKpiPers) elKpiPers.innerText = personalPresenteCount;
        if (elKpiPersSub) elKpiPersSub.innerText = `${docMat + docVesp} Docentes / ${admMat + admVesp} Admin`;

        // 3. Renderizar Gráfica 1: Afluencia por Carrera (Inscritos vs Presentes)
        renderizarGraficoBarras(conteoCarrerasTotal, conteoCarrerasPresentes);

        // 4. Renderizar Gráfica 2: Curva de Flujo Horario (Entradas vs Salidas por hora)
        renderizarGraficoFlujoHorario(registrosHoy);

        // 5. Renderizar Gráfica 4: Personal & Turnos
        renderizarGraficoPersonal(docMat, docVesp, admMat, admVesp);

        // 6. Actualizar Gráfica 3: Incidencias por Semestre
        actualizarGraficaGrupos();

        // 7. Calcular y renderizar Alerta Temprana de Deserción Escolar (EWS)
        const todosRegistrosHistoricos = await safeFetchJson('/api/registros-diarios') || [];
        calcularAlertaTempranaDesercion(activos, todosRegistrosHistoricos);

        const elAct = document.getElementById('ultimaAct');
        if (elAct) elAct.innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    } catch (e) {
        console.error("Error en Dashboard:", e);
    }
}

function renderizarGraficoBarras(datosTotal, datosPresentes) {
    const ctx = document.getElementById('graficoEspecialidades');
    if (!ctx || typeof Chart === 'undefined') return;
    if (chartEsp) chartEsp.destroy();

    // Filtrar especialidades que tengan al menos 1 alumno o mostrar las principales
    let labels = Object.keys(datosTotal).filter(k => datosTotal[k] > 0);
    if (labels.length === 0) {
        labels = Object.keys(datosTotal).slice(0, 5);
    }

    const valTotal = labels.map(k => datosTotal[k] || 0);
    const valPresentes = labels.map(k => datosPresentes[k] || 0);

    chartEsp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Presentes Hoy',
                    data: valPresentes,
                    backgroundColor: '#7b1b37',
                    borderRadius: 4,
                    barPercentage: 0.7
                },
                {
                    label: 'Matrícula Total',
                    data: valTotal,
                    backgroundColor: '#e5e7eb',
                    borderRadius: 4,
                    barPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'DM Sans', size: 11 } } },
                tooltip: { padding: 8 }
            },
            scales: { 
                y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1 } },
                x: { grid: { display: false }, ticks: { font: { size: 9.5 } } }
            }
        }
    });
}

function renderizarGraficoFlujoHorario(registrosHoy) {
    const ctx = document.getElementById('graficoFlujoHorario');
    if (!ctx || typeof Chart === 'undefined') return;
    if (chartFlujo) chartFlujo.destroy();

    const horasLabels = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    const entradas = new Array(horasLabels.length).fill(0);
    const salidas = new Array(horasLabels.length).fill(0);

    let hayMovimientos = false;
    (registrosHoy || []).forEach(r => {
        if (r.hora_entrada) {
            const h = parseInt(r.hora_entrada.split(':')[0]);
            if (h >= 6 && h <= 20) {
                entradas[h - 6]++;
                hayMovimientos = true;
            }
        }
        if (r.hora_salida) {
            const h = parseInt(r.hora_salida.split(':')[0]);
            if (h >= 6 && h <= 20) {
                salidas[h - 6]++;
                hayMovimientos = true;
            }
        }
    });

    chartFlujo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: horasLabels,
            datasets: [
                {
                    label: 'Entradas',
                    data: entradas,
                    borderColor: '#198754',
                    backgroundColor: 'rgba(25, 135, 84, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 3
                },
                {
                    label: 'Salidas',
                    data: salidas,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.08)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'DM Sans', size: 11 } } },
                tooltip: { padding: 8 }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1 } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function renderizarGraficoPersonal(docMat, docVesp, admMat, admVesp) {
    const ctx = document.getElementById('graficoPersonalTurnos');
    if (!ctx || typeof Chart === 'undefined') return;
    if (chartPersonal) chartPersonal.destroy();

    const totalDoc = docMat + docVesp;
    const totalAdm = admMat + admVesp;
    const valores = (totalDoc + totalAdm > 0) ? [docMat, docVesp, admMat, admVesp] : [0, 0, 0, 0];

    chartPersonal = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Docentes Mat.', 'Docentes Vesp.', 'Admin. Mat.', 'Admin. Vesp.'],
            datasets: [{
                data: valores,
                backgroundColor: ['#6f42c1', '#a855f7', '#0d6efd', '#38bdf8'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'DM Sans', size: 10.5 } } }
            }
        }
    });
}

// -------------------------------------------------------------
// SISTEMA DE ALERTA TEMPRANA DE DESERCIÓN ESCOLAR (EWS)
// -------------------------------------------------------------
function calcularAlertaTempranaDesercion(alumnos, registrosHistoricos) {
    listaAlumnosRiesgoGlobal = [];

    const fechasUnicas = [...new Set((registrosHistoricos || []).map(r => r.fecha).filter(Boolean))].sort().reverse();
    const mapaAsistenciasPorAlumno = {};

    (registrosHistoricos || []).forEach(r => {
        const mat = String(r.matricula || r.ncontrol || '').trim().toUpperCase();
        if (mat) {
            if (!mapaAsistenciasPorAlumno[mat]) mapaAsistenciasPorAlumno[mat] = new Set();
            if (r.fecha) mapaAsistenciasPorAlumno[mat].add(r.fecha);
        }
    });

    alumnos.forEach(al => {
        const mat = String(al.ncontrol || al.matricula || '').trim().toUpperCase();
        const asistenciasSet = mapaAsistenciasPorAlumno[mat] || new Set();

        let diasSinRegistro = 0;
        if (fechasUnicas.length > 0) {
            for (let i = 0; i < Math.min(fechasUnicas.length, 10); i++) {
                const f = fechasUnicas[i];
                if (!asistenciasSet.has(f)) {
                    diasSinRegistro++;
                } else {
                    break;
                }
            }
        } else {
            if (al.estado === "FUERA" || !al.estado) {
                diasSinRegistro = 3;
            }
        }

        if (diasSinRegistro >= 3) {
            const nivelRiesgo = diasSinRegistro >= 5 ? 'CRITICO' : 'MODERADO';
            listaAlumnosRiesgoGlobal.push({
                matricula: al.ncontrol || al.matricula || 'S/N',
                nombre: `${al.nombre} ${al.apepat || al.primerApellido || ''} ${al.apemat || al.segundoApellido || ''}`.trim(),
                especialidad: al.especialidad || 'Tronco Común',
                grado: al.grado || '1',
                grupo: al.grupo || 'A',
                turno: al.turno || 'Matutino',
                foto: al.fotoUrl || al.foto_url || al.foto || '/img/logo_aniversario.jpg',
                diasSinRegistro: diasSinRegistro,
                nivelRiesgo: nivelRiesgo,
                tutor: al.nombretutor || al.nombre_tutor || 'Tutor Registrado',
                telefonoTutor: al.teltutor || (al.tutor && al.tutor.telefono) || al.celular || 'S/T'
            });
        }
    });

    listaAlumnosRiesgoGlobal.sort((a, b) => b.diasSinRegistro - a.diasSinRegistro);

    const criticos = listaAlumnosRiesgoGlobal.filter(a => a.nivelRiesgo === 'CRITICO').length;
    const moderados = listaAlumnosRiesgoGlobal.filter(a => a.nivelRiesgo === 'MODERADO').length;
    const total = listaAlumnosRiesgoGlobal.length;

    const elCountTotal = document.getElementById('countRiesgoTotal');
    const elCountCrit = document.getElementById('countRiesgoCritico');
    const elCountMod = document.getElementById('countRiesgoModerado');
    const elKpiRiesgo = document.getElementById('kpiRiesgoDesercion');

    if (elCountTotal) elCountTotal.innerText = total;
    if (elCountCrit) elCountCrit.innerText = criticos;
    if (elCountMod) elCountMod.innerText = moderados;
    if (elKpiRiesgo) elKpiRiesgo.innerText = total;

    renderizarTablaAlertaRiesgo();
}

function filtrarAlertaRiesgo(tipo) {
    filtroRiesgoActual = tipo;
    const btnTodos = document.getElementById('btnFiltroRiesgoTodos');
    const btnCrit = document.getElementById('btnFiltroRiesgoCritico');
    const btnMod = document.getElementById('btnFiltroRiesgoModerado');

    if (btnTodos) btnTodos.className = (tipo === 'TODOS') ? 'btn btn-secondary active' : 'btn btn-outline-secondary';
    if (btnCrit) btnCrit.className = (tipo === 'CRITICO') ? 'btn btn-danger active' : 'btn btn-outline-danger';
    if (btnMod) btnMod.className = (tipo === 'MODERADO') ? 'btn btn-warning text-dark active' : 'btn btn-outline-warning text-dark';

    renderizarTablaAlertaRiesgo();
}
window.filtrarAlertaRiesgo = filtrarAlertaRiesgo;

function renderizarTablaAlertaRiesgo() {
    const tbody = document.getElementById('tablaAlertaDesercionBody');
    if (!tbody) return;

    tbody.innerHTML = "";

    const filtrados = listaAlumnosRiesgoGlobal.filter(a => {
        if (filtroRiesgoActual === 'CRITICO') return a.nivelRiesgo === 'CRITICO';
        if (filtroRiesgoActual === 'MODERADO') return a.nivelRiesgo === 'MODERADO';
        return true;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-success fw-bold">
                    <i class="bi bi-check-circle-fill me-1 fs-5"></i>
                    No hay estudiantes en situación de riesgo con el filtro actual.
                </td>
            </tr>
        `;
        return;
    }

    filtrados.slice(0, 30).forEach(a => {
        const tr = document.createElement('tr');
        const badgeRiesgo = (a.nivelRiesgo === 'CRITICO')
            ? '<span class="badge bg-danger px-2 py-1"><i class="bi bi-exclamation-octagon-fill me-1"></i>Crítico</span>'
            : '<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-exclamation-triangle-fill me-1"></i>Moderado</span>';

        tr.innerHTML = `
            <td class="ps-3 py-2">
                <div class="d-flex align-items-center">
                    <img src="${a.foto}" class="rounded-circle border me-2" style="width: 32px; height: 32px; object-fit: cover;" onerror="this.src='/img/logo_aniversario.jpg'">
                    <div>
                        <span class="d-block fw-bold text-dark">${a.nombre}</span>
                        <span class="x-small text-muted">Tutor: ${a.tutor}</span>
                    </div>
                </div>
            </td>
            <td><span class="font-monospace fw-bold text-dark">${a.matricula}</span></td>
            <td>
                <span class="d-block fw-semibold text-dark">${a.especialidad}</span>
                <span class="x-small text-muted">${a.grado}° "${a.grupo}" • ${a.turno}</span>
            </td>
            <td class="text-center">
                <span class="badge bg-light text-danger border border-danger fw-bold px-2 py-1">${a.diasSinRegistro} días</span>
            </td>
            <td class="text-center">${badgeRiesgo}</td>
            <td class="text-center pe-3">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success btn-sm" onclick="enviarWhatsappTutorDesercion('${a.matricula}')" title="Contactar Tutor por WhatsApp">
                        <i class="bi bi-whatsapp"></i>
                    </button>
                    <a href="/admin/expediente_alumno?matricula=${encodeURIComponent(a.matricula)}" class="btn btn-outline-secondary btn-sm" title="Ver Expediente">
                        <i class="bi bi-folder2-open"></i>
                    </a>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function enviarWhatsappTutorDesercion(matricula) {
    const alumno = listaAlumnosRiesgoGlobal.find(a => a.matricula === matricula);
    if (!alumno) return;

    const tel = alumno.telefonoTutor;
    if (!tel || tel === 'S/T') {
        return Swal.fire("Sin número de teléfono", "El estudiante no tiene registrado un número telefónico de tutor.", "warning");
    }

    const { value: mensajeTxt } = await Swal.fire({
        title: `<div class="fs-5 fw-bold text-dark mb-0"><i class="bi bi-whatsapp text-success me-2"></i>Aviso de Inasistencias a Tutor</div>`,
        html: `
            <div class="text-start small mb-2 p-2 bg-light rounded border">
                <div class="mb-1"><b>Estudiante:</b> ${alumno.nombre} (${alumno.matricula})</div>
                <div class="mb-1"><b>Tutor:</b> <span class="fw-bold text-dark">${alumno.tutor}</span></div>
                <div class="mb-1"><b>Teléfono:</b> <code class="text-success fw-bold">${tel}</code></div>
                <div><b>Inasistencias continuas:</b> <span class="badge bg-danger">${alumno.diasSinRegistro} días</span></div>
            </div>
            <textarea id="swalWsMensajeDesercion" class="form-control form-control-sm border-danger mt-2" rows="4" style="width: 100%; box-sizing: border-box; resize: vertical; font-size: 0.9rem; text-transform: none !important;">🏫 *[CBTis 134 - AVISO URGENTE DE ORIENTACIÓN EDUCATIVA]*:\nEstimado(a) ${alumno.tutor}, le informamos que el alumno(a) ${alumno.nombre} ha acumulado ${alumno.diasSinRegistro} días consecutivos sin registro de asistencia en el plantel. Favor de comunicarse al departamento de Orientación Educativa.</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send me-1"></i>Enviar Alerta WhatsApp',
        confirmButtonColor: '#198754',
        cancelButtonText: 'Cancelar'
    });

    if (!mensajeTxt) return;

    Swal.fire({ title: 'Despachando mensaje...', didOpen: () => Swal.showLoading() });

    try {
        const resWs = await fetch('/api/configuracion/whatsapp');
        if (!resWs.ok) throw new Error("No hay API de WhatsApp configurada.");
        const configWs = await resWs.json();
        const tipoEndpoint = (configWs.tipo_api || 'EVOLUTION').toLowerCase();

        const res = await fetch(`/api/whatsapp/${tipoEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiUrl: configWs.apiUrl || configWs.serverUrl,
                apiKey: configWs.apiKey || configWs.token,
                token: configWs.token || configWs.apiKey,
                instanceName: configWs.instanceName || configWs.sessionName || 'cbtis134',
                to: tel,
                body: mensajeTxt
            })
        });

        if (res.ok) {
            Swal.fire("¡Alerta Enviada!", `El mensaje de inasistencia ha sido despachado al tutor con éxito.`, "success");
        } else {
            Swal.fire("Error", `La API respondió con error.`, "error");
        }
    } catch(e) {
        Swal.fire("Error", e.message, "error");
    }
}
window.enviarWhatsappTutorDesercion = enviarWhatsappTutorDesercion;

let calendarioInstancia = null;

const PALETA_COLORES_CALENDARIO = [
    { nombre: 'Institucional Guinda', valor: '#7b1b37' },
    { nombre: 'Inhábiles / Suspensión Oficial', valor: '#dc3545' },
    { nombre: 'Evaluaciones / Exámenes', valor: '#0d6efd' },
    { nombre: 'Actividad Cívica / Efemérides', valor: '#198754' },
    { nombre: 'Consejo Técnico Escolar (CTE)', valor: '#6f42c1' },
    { nombre: 'Avisos y Calificaciones', valor: '#fd7e14' }
];

// Catálogo base oficial SEP / DGETI de eventos escolares y académicos
const EVENTOS_CALENDARIO_SEP = [
    // 2025 - 2026
    { id: 'SEP_2025_01', title: "🇲🇽 Inicio de Semestre Ago-Dic", start: "2025-08-25", color: "#198754", tipo: "SEP", descripcion: "Apertura oficial del semestre escolar DGETI" },
    { id: 'SEP_2025_02', title: "🇲🇽 Aniversario de la Independencia", start: "2025-09-16", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión oficial de labores" },
    { id: 'SEP_2025_03', title: "📝 1er Periodo de Evaluaciones Parciales", start: "2025-09-29", end: "2025-10-04", color: "#0d6efd", tipo: "EVAL", descripcion: "Aplicación de exámenes del 1er Parcial" },
    { id: 'SEP_2025_04', title: "🟣 Consejo Técnico Escolar (CTE)", start: "2025-10-31", color: "#6f42c1", tipo: "SEP", descripcion: "Sesión ordinaria de Consejo Técnico" },
    { id: 'SEP_2025_05', title: "🇲🇽 Día de Muertos", start: "2025-11-02", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión cívica oficial" },
    { id: 'SEP_2025_06', title: "📝 2do Periodo de Evaluaciones Parciales", start: "2025-11-03", end: "2025-11-08", color: "#0d6efd", tipo: "EVAL", descripcion: "Exámenes y corte del 2do Parcial" },
    { id: 'SEP_2025_07', title: "🇲🇽 Revolución Mexicana (Suspensión)", start: "2025-11-17", color: "#dc3545", tipo: "SEP", descripcion: "Día inhábil oficial (3er lunes de noviembre)" },
    { id: 'SEP_2025_08', title: "🟣 Consejo Técnico Escolar (CTE)", start: "2025-11-28", color: "#6f42c1", tipo: "SEP", descripcion: "Sesión de Consejo Técnico" },
    { id: 'SEP_2025_09', title: "📝 3er Periodo de Evaluaciones Parciales", start: "2025-12-08", end: "2025-12-13", color: "#0d6efd", tipo: "EVAL", descripcion: "Cierre de periodo y evaluaciones finales" },
    { id: 'SEP_2025_10', title: "❄️ Periodo Vacacional de Invierno", start: "2025-12-22", end: "2026-01-10", color: "#dc3545", tipo: "SEP", descripcion: "Receso escolar de invierno" },
    // 2026
    { id: 'SEP_2026_01', title: "🇲🇽 Inicio de Cursos Feb-Jul 2026", start: "2026-02-03", color: "#198754", tipo: "SEP", descripcion: "Inicio de clases para semestres pares" },
    { id: 'SEP_2026_02', title: "🇲🇽 Día de la Constitución Mexicana", start: "2026-02-02", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión de labores oficial" },
    { id: 'SEP_2026_03', title: "📝 1er Periodo de Evaluaciones Parciales", start: "2026-03-09", end: "2026-03-14", color: "#0d6efd", tipo: "EVAL", descripcion: "1er Parcial semestres pares" },
    { id: 'SEP_2026_04', title: "🇲🇽 Natalicio de Benito Juárez", start: "2026-03-16", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión de labores oficial" },
    { id: 'SEP_2026_05', title: "🌴 Receso Escolar de Semana Santa", start: "2026-03-30", end: "2026-04-11", color: "#dc3545", tipo: "SEP", descripcion: "Periodo vacacional de primavera" },
    { id: 'SEP_2026_06', title: "🇲🇽 Día del Trabajo", start: "2026-05-01", color: "#dc3545", tipo: "SEP", descripcion: "Día inhábil oficial" },
    { id: 'SEP_2026_07', title: "🇲🇽 Batalla de Puebla", start: "2026-05-05", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión cívica" },
    { id: 'SEP_2026_08', title: "📝 2do Periodo de Evaluaciones Parciales", start: "2026-05-11", end: "2026-05-16", color: "#0d6efd", tipo: "EVAL", descripcion: "2do Parcial" },
    { id: 'SEP_2026_09', title: "👩‍🏫 Día del Maestro", start: "2026-05-15", color: "#dc3545", tipo: "SEP", descripcion: "Día inhábil del magisterio" },
    { id: 'SEP_2026_10', title: "📝 3er Periodo de Evaluaciones Parciales", start: "2026-06-15", end: "2026-06-20", color: "#0d6efd", tipo: "EVAL", descripcion: "Evaluaciones finales ordinarias" },
    { id: 'SEP_2026_11', title: "🎓 Fin de Cursos y Graduación", start: "2026-07-10", color: "#198754", tipo: "SEP", descripcion: "Clausura oficial del ciclo escolar" },
    { id: 'SEP_2026_12', title: "🇲🇽 Inicio de Semestre Ago-Dic 2026", start: "2026-08-24", color: "#198754", tipo: "SEP", descripcion: "Apertura oficial del semestre escolar DGETI" },
    { id: 'SEP_2026_13', title: "🇲🇽 Aniversario de la Independencia", start: "2026-09-16", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión oficial de labores" },
    { id: 'SEP_2026_14', title: "📝 1er Periodo de Evaluaciones Parciales", start: "2026-09-28", end: "2026-10-03", color: "#0d6efd", tipo: "EVAL", descripcion: "Aplicación de exámenes 1er Parcial" },
    { id: 'SEP_2026_15', title: "🟣 Consejo Técnico Escolar (CTE)", start: "2026-10-30", color: "#6f42c1", tipo: "SEP", descripcion: "Sesión ordinaria de Consejo Técnico" },
    { id: 'SEP_2026_16', title: "🇲🇽 Día de Muertos", start: "2026-11-02", color: "#dc3545", tipo: "SEP", descripcion: "Suspensión cívica oficial" },
    { id: 'SEP_2026_17', title: "📝 2do Periodo de Evaluaciones Parciales", start: "2026-11-03", end: "2026-11-07", color: "#0d6efd", tipo: "EVAL", descripcion: "2do Parcial" },
    { id: 'SEP_2026_18', title: "🇲🇽 Revolución Mexicana (Suspensión)", start: "2026-11-16", color: "#dc3545", tipo: "SEP", descripcion: "Día inhábil oficial" },
    { id: 'SEP_2026_19', title: "🟣 Consejo Técnico Escolar (CTE)", start: "2026-11-27", color: "#6f42c1", tipo: "SEP", descripcion: "Sesión de Consejo Técnico" },
    { id: 'SEP_2026_20', title: "📝 3er Periodo de Evaluaciones Parciales", start: "2026-12-07", end: "2026-12-12", color: "#0d6efd", tipo: "EVAL", descripcion: "Evaluaciones finales" },
    { id: 'SEP_2026_21', title: "❄️ Periodo Vacacional de Invierno", start: "2026-12-21", end: "2027-01-09", color: "#dc3545", tipo: "SEP", descripcion: "Receso escolar de invierno" }
];

async function inicializarCalendario(userRole) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || typeof FullCalendar === 'undefined') return;

    const esAdmin = (userRole === 'ADMIN' || userRole === 'ORIENTACION');

    calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,listMonth'
        },
        buttonText: {
            today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Agenda'
        },
        editable: esAdmin,
        selectable: esAdmin,
        selectMirror: true,
        dayMaxEvents: true,
        navLinks: true,
        events: async function(info, successCallback, failureCallback) {
            try {
                // 1. Obtener eventos locales de la BD
                const resLocal = await safeFetchJson('/api/calendario') || [];
                const localesMapeados = (resLocal || []).map(evt => ({
                    id: evt.id || evt._id,
                    title: evt.title,
                    start: evt.start,
                    end: evt.end,
                    allDay: evt.allDay !== false,
                    backgroundColor: evt.color || '#7b1b37',
                    borderColor: evt.color || '#7b1b37',
                    textColor: '#ffffff',
                    extendedProps: {
                        descripcion: evt.descripcion || '',
                        creadoPor: evt.creadoPor || 'ADMIN',
                        origen: 'PLANTEL',
                        tipo: evt.tipo || 'PLANTEL'
                    }
                }));

                // 2. Obtener días festivos de México desde API Nager.Date con timeout seguro
                let feriadosApiMapeados = [];
                try {
                    const fetchConTimeout = async (url, ms = 2000) => {
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), ms);
                            const res = await fetch(url, { signal: controller.signal });
                            clearTimeout(timeoutId);
                            if (res.ok) return await res.json();
                        } catch(e){}
                        return null;
                    };

                    const currentYear = new Date().getFullYear();
                    const years = [currentYear - 1, currentYear, currentYear + 1];
                    const promesasFeriados = years.map(y => fetchConTimeout(`https://date.nager.at/api/v3/PublicHolidays/${y}/MX`, 1800));
                    const resultadosFeriados = await Promise.all(promesasFeriados);
                    
                    resultadosFeriados.forEach(lista => {
                        if (Array.isArray(lista)) {
                            lista.forEach(f => {
                                feriadosApiMapeados.push({
                                    id: `FERIADO_${f.date}`,
                                    title: `🇲🇽 ${f.localName || f.name}`,
                                    start: f.date,
                                    allDay: true,
                                    backgroundColor: '#dc3545',
                                    borderColor: '#dc3545',
                                    textColor: '#ffffff',
                                    extendedProps: {
                                        descripcion: `Día festivo oficial federal en México (${f.name})`,
                                        creadoPor: 'SEP / Gobierno Federal',
                                        origen: 'SEP',
                                        tipo: 'SEP'
                                    }
                                });
                            });
                        }
                    });
                } catch (e) {
                    console.warn("Feriados API no disponible, usando catálogo SEP interno");
                }

                // 3. Mapear eventos oficiales SEP / DGETI
                const sepMapeados = EVENTOS_CALENDARIO_SEP.map(s => ({
                    id: s.id,
                    title: s.title,
                    start: s.start,
                    end: s.end || null,
                    allDay: true,
                    backgroundColor: s.color,
                    borderColor: s.color,
                    textColor: '#ffffff',
                    extendedProps: {
                        descripcion: s.descripcion,
                        creadoPor: 'SEP / DGETI',
                        origen: 'SEP',
                        tipo: s.tipo || 'SEP'
                    }
                }));

                // 4. Consolidar y deduplicar por título y fecha
                const setKeys = new Set();
                todosEventosCalendario = [];

                [...localesMapeados, ...feriadosApiMapeados, ...sepMapeados].forEach(ev => {
                    const key = `${ev.title}_${ev.start}`;
                    if (!setKeys.has(key)) {
                        setKeys.add(key);
                        todosEventosCalendario.push(ev);
                    }
                });

                // 5. Aplicar filtro seleccionado
                const eventosFiltrados = filtrarEventosPorTipo(todosEventosCalendario, filtroCalendarioActual);
                successCallback(eventosFiltrados);

            } catch (err) {
                console.error("Error al cargar eventos del calendario:", err);
                failureCallback(err);
            }
        },
        select: function(selectionInfo) {
            if (!esAdmin) return;
            abrirModalNuevoEvento(selectionInfo.startStr, selectionInfo.endStr, selectionInfo.allDay);
        },
        eventClick: function(clickInfo) {
            abrirModalDetalleEvento(clickInfo.event, esAdmin);
        },
        eventDrop: async function(changeInfo) {
            if (!esAdmin || changeInfo.event.extendedProps.origen === 'SEP') {
                if (changeInfo.event.extendedProps.origen === 'SEP') {
                    Swal.fire("Aviso", "Los eventos oficiales de la SEP no pueden ser movidos.", "info");
                }
                changeInfo.revert();
                return;
            }
            await actualizarFechasEvento(changeInfo.event, changeInfo.revert);
        },
        eventResize: async function(changeInfo) {
            if (!esAdmin || changeInfo.event.extendedProps.origen === 'SEP') {
                if (changeInfo.event.extendedProps.origen === 'SEP') {
                    Swal.fire("Aviso", "Los eventos oficiales de la SEP no pueden ser modificados.", "info");
                }
                changeInfo.revert();
                return;
            }
            await actualizarFechasEvento(changeInfo.event, changeInfo.revert);
        }
    });

    calendarioInstancia.render();
}

function filtrarEventosPorTipo(eventos, filtro) {
    if (filtro === 'TODOS') return eventos;
    if (filtro === 'SEP') return eventos.filter(e => e.extendedProps.origen === 'SEP' && e.extendedProps.tipo !== 'EVAL');
    if (filtro === 'EVAL') return eventos.filter(e => e.extendedProps.tipo === 'EVAL' || (e.title && e.title.toLowerCase().includes('evaluaci')));
    if (filtro === 'PLANTEL') return eventos.filter(e => e.extendedProps.origen === 'PLANTEL');
    return eventos;
}

function filtrarEventosCalendario(tipo) {
    filtroCalendarioActual = tipo;
    const btnTodos = document.getElementById('btnCalFiltroTodos');
    const btnSEP = document.getElementById('btnCalFiltroSEP');
    const btnEval = document.getElementById('btnCalFiltroEval');
    const btnPlantel = document.getElementById('btnCalFiltroPlantel');

    if (btnTodos) btnTodos.className = (tipo === 'TODOS') ? 'btn btn-secondary active' : 'btn btn-outline-secondary';
    if (btnSEP) btnSEP.className = (tipo === 'SEP') ? 'btn btn-danger active' : 'btn btn-outline-danger';
    if (btnEval) btnEval.className = (tipo === 'EVAL') ? 'btn btn-primary active' : 'btn btn-outline-primary';
    if (btnPlantel) btnPlantel.className = (tipo === 'PLANTEL') ? 'btn btn-dark active' : 'btn btn-outline-dark';

    if (calendarioInstancia) {
        calendarioInstancia.refetchEvents();
    }
}
window.filtrarEventosCalendario = filtrarEventosCalendario;

function sincronizarCalendarioSEP() {
    Swal.fire({
        title: 'Sincronizando con SEP y Feriados...',
        didOpen: () => Swal.showLoading(),
        timer: 1000
    }).then(() => {
        if (calendarioInstancia) calendarioInstancia.refetchEvents();
        Swal.fire({
            icon: 'success',
            title: 'Calendario Sincronizado',
            text: 'Se han cargado las fechas oficiales de la SEP, DGETI y días festivos de México.',
            timer: 2000,
            showConfirmButton: false
        });
    });
}
window.sincronizarCalendarioSEP = sincronizarCalendarioSEP;

async function abrirModalNuevoEvento(fechaInicio = '', fechaFin = '', esTodoElDia = true) {
    const hoyStr = new Date().toLocaleDateString('en-CA');
    const startVal = fechaInicio || hoyStr;
    const endVal = (fechaFin && fechaFin !== fechaInicio) ? fechaFin : '';

    const opcionesColorHtml = PALETA_COLORES_CALENDARIO.map(c => 
        `<option value="${c.valor}" ${c.valor === '#7b1b37' ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
        title: '<i class="bi bi-calendar-plus text-danger me-2"></i>Nuevo Evento Escolar',
        html: `
            <div class="text-start" style="font-size: 14px;">
                <div class="mb-3">
                    <label class="form-label fw-bold">Título del evento / actividad <span class="text-danger">*</span></label>
                    <input id="swalEvtTitulo" class="form-control" placeholder="Ej. Inicio de Exámenes Parciales" autocomplete="off">
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label fw-bold">Fecha Inicio <span class="text-danger">*</span></label>
                        <input id="swalEvtInicio" type="date" class="form-control" value="${startVal}">
                    </div>
                    <div class="col-6">
                        <label class="form-label fw-bold">Fecha Fin</label>
                        <input id="swalEvtFin" type="date" class="form-control" value="${endVal}">
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Categoría / Color</label>
                    <select id="swalEvtColor" class="form-select">
                        ${opcionesColorHtml}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Descripción u Observaciones</label>
                    <textarea id="swalEvtDesc" class="form-control" rows="2" placeholder="Detalles adicionales del evento..."></textarea>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="swalEvtAllDay" ${esTodoElDia ? 'checked' : ''}>
                    <label class="form-check-label small" for="swalEvtAllDay">Evento de todo el día</label>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-save me-1"></i> Guardar Evento',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        focusConfirm: false,
        preConfirm: () => {
            const title = document.getElementById('swalEvtTitulo').value.trim();
            const start = document.getElementById('swalEvtInicio').value;
            const end = document.getElementById('swalEvtFin').value;
            const color = document.getElementById('swalEvtColor').value;
            const descripcion = document.getElementById('swalEvtDesc').value.trim();
            const allDay = document.getElementById('swalEvtAllDay').checked;

            if (!title) {
                Swal.showValidationMessage('Por favor ingresa un título para el evento');
                return false;
            }
            if (!start) {
                Swal.showValidationMessage('La fecha de inicio es obligatoria');
                return false;
            }

            return { title, start, end: end || null, color, descripcion, allDay };
        }
    });

    if (formValues) {
        try {
            Swal.fire({ title: 'Guardando evento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const usuarioActual = localStorage.getItem('userName') || 'ADMIN';
            
            const res = await fetch('/api/calendario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 'EVT_' + Date.now(),
                    ...formValues,
                    creadoPor: usuarioActual
                })
            });

            if (!res.ok) throw new Error("Error al guardar en el servidor");

            await Swal.fire({
                icon: 'success',
                title: 'Evento Registrado',
                text: 'El evento se ha agregado a la agenda escolar con éxito.',
                timer: 2000,
                showConfirmButton: false
            });

            if (calendarioInstancia) calendarioInstancia.refetchEvents();
        } catch (e) {
            Swal.fire("Error", "No se pudo guardar el evento: " + e.message, "error");
        }
    }
}
window.abrirModalNuevoEvento = abrirModalNuevoEvento;

async function abrirModalDetalleEvento(eventObj, esAdmin) {
    const props = eventObj.extendedProps || {};
    const startStr = eventObj.startStr || (eventObj.start ? eventObj.start.toLocaleDateString('es-MX') : 'S/F');
    const endStr = eventObj.endStr || (eventObj.end ? eventObj.end.toLocaleDateString('es-MX') : '');
    const colorHex = eventObj.backgroundColor || '#7b1b37';
    const esOficialSEP = props.origen === 'SEP';

    const categoriaMatch = PALETA_COLORES_CALENDARIO.find(c => c.valor.toLowerCase() === colorHex.toLowerCase());
    const categoriaNombre = esOficialSEP ? 'Oficial SEP / Federal' : (categoriaMatch ? categoriaMatch.nombre : 'Evento Plantel');

    if (esAdmin && !esOficialSEP) {
        const result = await Swal.fire({
            title: `<span style="color:${colorHex};"><i class="bi bi-calendar-event me-2"></i>${eventObj.title}</span>`,
            html: `
                <div class="text-start p-2" style="font-size: 14px;">
                    <div class="mb-2">
                        <span class="badge" style="background-color: ${colorHex}; font-size: 12px;">${categoriaNombre}</span>
                        ${eventObj.allDay ? '<span class="badge bg-secondary ms-1">Todo el día</span>' : ''}
                    </div>
                    <p class="mb-1"><strong><i class="bi bi-clock me-1"></i>Periodo:</strong> ${startStr} ${endStr ? ' hasta ' + endStr : ''}</p>
                    ${props.descripcion ? `<p class="mb-1"><strong><i class="bi bi-card-text me-1"></i>Detalles:</strong> ${props.descripcion}</p>` : ''}
                    ${props.creadoPor ? `<p class="mb-0 text-muted x-small"><strong>Registrado por:</strong> ${props.creadoPor}</p>` : ''}
                </div>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-pencil-square me-1"></i> Editar',
            denyButtonText: '<i class="bi bi-trash3 me-1"></i> Eliminar',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#0d6efd',
            denyButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        });

        if (result.isConfirmed) {
            abrirModalEditarEvento(eventObj);
        } else if (result.isDenied) {
            confirmarEliminarEvento(eventObj);
        }
    } else {
        Swal.fire({
            title: `<span style="color:${colorHex};"><i class="bi bi-calendar-event me-2"></i>${eventObj.title}</span>`,
            html: `
                <div class="text-start p-2" style="font-size: 14px;">
                    <div class="mb-2">
                        <span class="badge" style="background-color: ${colorHex}; font-size: 12px;">${categoriaNombre}</span>
                        ${esOficialSEP ? '<span class="badge bg-danger ms-1">🇲🇽 Calendario Oficial SEP</span>' : ''}
                    </div>
                    <p class="mb-1"><strong><i class="bi bi-clock me-1"></i>Periodo:</strong> ${startStr} ${endStr ? ' hasta ' + endStr : ''}</p>
                    ${props.descripcion ? `<p class="mb-1"><strong><i class="bi bi-card-text me-1"></i>Detalles:</strong> ${props.descripcion}</p>` : ''}
                    ${esOficialSEP ? '<p class="mt-2 text-muted x-small fst-italic"><i class="bi bi-shield-lock me-1"></i>Evento normativo oficial de la SEP.</p>' : ''}
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#7b1b37'
        });
    }
}

async function abrirModalEditarEvento(eventObj) {
    const props = eventObj.extendedProps || {};
    const colorHex = eventObj.backgroundColor || '#7b1b37';
    
    const startVal = eventObj.startStr.split('T')[0];
    const endVal = eventObj.endStr ? eventObj.endStr.split('T')[0] : '';

    const opcionesColorHtml = PALETA_COLORES_CALENDARIO.map(c => 
        `<option value="${c.valor}" ${c.valor.toLowerCase() === colorHex.toLowerCase() ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
        title: '<i class="bi bi-pencil-square text-primary me-2"></i>Editar Evento',
        html: `
            <div class="text-start" style="font-size: 14px;">
                <div class="mb-3">
                    <label class="form-label fw-bold">Título del evento / actividad <span class="text-danger">*</span></label>
                    <input id="swalEditTitulo" class="form-control" value="${eventObj.title || ''}" autocomplete="off">
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label fw-bold">Fecha Inicio <span class="text-danger">*</span></label>
                        <input id="swalEditInicio" type="date" class="form-control" value="${startVal}">
                    </div>
                    <div class="col-6">
                        <label class="form-label fw-bold">Fecha Fin</label>
                        <input id="swalEditFin" type="date" class="form-control" value="${endVal}">
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Categoría / Color</label>
                    <select id="swalEditColor" class="form-select">
                        ${opcionesColorHtml}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold">Descripción u Observaciones</label>
                    <textarea id="swalEditDesc" class="form-control" rows="2">${props.descripcion || ''}</textarea>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="swalEditAllDay" ${eventObj.allDay !== false ? 'checked' : ''}>
                    <label class="form-check-label small" for="swalEditAllDay">Evento de todo el día</label>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-save me-1"></i> Actualizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        focusConfirm: false,
        preConfirm: () => {
            const title = document.getElementById('swalEditTitulo').value.trim();
            const start = document.getElementById('swalEditInicio').value;
            const end = document.getElementById('swalEditFin').value;
            const color = document.getElementById('swalEditColor').value;
            const descripcion = document.getElementById('swalEditDesc').value.trim();
            const allDay = document.getElementById('swalEditAllDay').checked;

            if (!title) {
                Swal.showValidationMessage('Por favor ingresa un título para el evento');
                return false;
            }
            if (!start) {
                Swal.showValidationMessage('La fecha de inicio es obligatoria');
                return false;
            }

            return { title, start, end: end || null, color, descripcion, allDay };
        }
    });

    if (formValues) {
        try {
            Swal.fire({ title: 'Actualizando evento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            const res = await fetch(`/api/calendario/${eventObj.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: eventObj.id,
                    ...formValues,
                    creadoPor: props.creadoPor || 'ADMIN'
                })
            });

            if (!res.ok) throw new Error("Error al actualizar en el servidor");

            await Swal.fire({
                icon: 'success',
                title: 'Evento Actualizado',
                timer: 1500,
                showConfirmButton: false
            });

            if (calendarioInstancia) calendarioInstancia.refetchEvents();
        } catch (e) {
            Swal.fire("Error", "No se pudo actualizar el evento: " + e.message, "error");
        }
    }
}

async function confirmarEliminarEvento(eventObj) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar Evento?',
        text: `¿Estás seguro de eliminar el evento "${eventObj.title}" de la agenda escolar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await fetch(`/api/calendario/${eventObj.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("No se pudo eliminar del servidor");

            eventObj.remove();
            Swal.fire({
                icon: 'success',
                title: 'Evento Eliminado',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (e) {
            Swal.fire("Error", "Error al eliminar el evento: " + e.message, "error");
        }
    }
}

async function actualizarFechasEvento(eventObj, revertFn) {
    try {
        const startStr = eventObj.startStr.split('T')[0];
        const endStr = eventObj.endStr ? eventObj.endStr.split('T')[0] : null;
        const props = eventObj.extendedProps || {};

        const res = await fetch(`/api/calendario/${eventObj.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: eventObj.id,
                title: eventObj.title,
                start: startStr,
                end: endStr,
                allDay: eventObj.allDay !== false,
                color: eventObj.backgroundColor || '#7b1b37',
                descripcion: props.descripcion || '',
                creadoPor: props.creadoPor || 'ADMIN'
            })
        });

        if (!res.ok) throw new Error("No se pudo actualizar la fecha");

        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: 'Fecha de evento actualizada'
        });
    } catch (e) {
        if (typeof revertFn === 'function') revertFn();
        Swal.fire("Error", "No se pudo actualizar la fecha del evento.", "error");
    }
}

async function inicializarSwitchSalida() {
    const switchSalida = document.getElementById('switchSalidaGeneral');
    const btnConfirmar = document.getElementById('btnConfirmarSalida');
    const modalElement = document.getElementById('modalConfirmacionGeneral');

    if (switchSalida && modalElement) {
        const modalConfirmacion = new bootstrap.Modal(modalElement);
        
        try {
            const dataContingencia = await safeFetchJson('/api/configuracion/modo_contingencia');
            if (dataContingencia) {
                switchSalida.checked = (dataContingencia.activo === true);
            }
        } catch(e){}

        switchSalida.addEventListener('click', (e) => {
            e.preventDefault();
            modalConfirmacion.show();
        });

        btnConfirmar?.addEventListener('click', async () => {
            const nuevoEstado = !switchSalida.checked;
            try {
                Swal.fire({ title: 'Guardando estado de contingencia...', didOpen: () => Swal.showLoading() });
                await fetch('/api/configuracion/modo_contingencia', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ _id: 'modo_contingencia', activo: nuevoEstado, fecha: new Date().toISOString() })
                });
                switchSalida.checked = nuevoEstado;
                modalConfirmacion.hide();
                Swal.fire({
                    icon: nuevoEstado ? 'warning' : 'info',
                    title: `Modo Contingencia ${nuevoEstado ? 'ACTIVADO' : 'DESACTIVADO'}`,
                    text: nuevoEstado ? 'Se ha activado la salida libre en todo el plantel.' : 'El control de salidas ha vuelto a la normalidad.',
                    timer: 3000,
                    showConfirmButton: false
                });
            } catch(e) {
                Swal.fire("Error", "No se pudo cambiar el estado de contingencia.", "error");
            }
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
        if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                return await res.json();
            } else {
                const text = await res.text();
                try { return JSON.parse(text); } catch(e) { return null; }
            }
        }
    } catch(e){
        console.warn("safeFetchJson warning for URL:", url, e);
    }
    return null;
}

async function cargarEstadisticas() {
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    const hoy = new Date().toLocaleDateString('en-CA');

    try {
        const [listAlumnos, listPases, listJustificantes, listIncidencias] = await Promise.all([
            safeFetchJson('/api/alumnos'),
            safeFetchJson('/api/pases'),
            safeFetchJson('/api/justificantes'),
            safeFetchJson('/api/incidencias')
        ]);

        setVal('totalAlumnos', Array.isArray(listAlumnos) ? listAlumnos.length : 0);

        if (Array.isArray(listPases)) {
            const pasesActivos = listPases.filter(p => p.fecha === hoy && (p.estatus_vigencia === true || p.estatus === 'AUTORIZADO'));
            setVal('totalPases', pasesActivos.length);
        } else {
            setVal('totalPases', 0);
        }

        setVal('totalJustificantes', Array.isArray(listJustificantes) ? listJustificantes.length : 0);
        setVal('totalIncidencias', Array.isArray(listIncidencias) ? listIncidencias.length : 0);
    } catch(e) {
        console.error("Error en cargarEstadisticas:", e);
    }
}

async function cargarEstadisticasPersonal() {
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    const hoy = new Date().toLocaleDateString('en-CA');
    try {
        const [rawUsuarios, rawRegistros] = await Promise.all([
            safeFetchJson('/api/usuarios'),
            safeFetchJson('/api/registros-diarios/fecha/' + hoy)
        ]);

        const usuarios = Array.isArray(rawUsuarios) ? rawUsuarios : [];
        const registrosHoy = Array.isArray(rawRegistros) ? rawRegistros : [];

        let docentes = 0;
        let adminis = 0;
        let mat = 0;
        let ves = 0;
        let dentroCount = 0;

        const dentroMap = new Set();
        registrosHoy.forEach(r => {
            const esDentro = (r.estatus_actual === 'DENTRO') || (r.hora_entrada && !r.hora_salida);
            if (esDentro) {
                if (r.matricula) dentroMap.add(r.matricula.trim().toUpperCase());
                if (r.ncontrol) dentroMap.add(r.ncontrol.trim().toUpperCase());
                if (r.id) dentroMap.add(r.id.trim().toUpperCase());
            }
        });

        usuarios.forEach(u => {
            const rol = (u.rol || '').toUpperCase();
            if (rol === 'DOCENTE') {
                docentes++;
            } else {
                adminis++;
            }

            const turno = (u.turno || '').toUpperCase();
            if (turno.includes('VESP') || turno === 'VESPERTINO') {
                ves++;
            } else {
                mat++;
            }

            const rfcKey = (u.rfc || '').trim().toUpperCase();
            const uidKey = (u.uid || '').trim().toUpperCase();
            const idKey = (u.id || '').trim().toUpperCase();
            const correoKey = (u.correo || '').trim().toUpperCase();

            const estaDentro = (rfcKey && dentroMap.has(rfcKey)) ||
                               (uidKey && dentroMap.has(uidKey)) ||
                               (idKey && dentroMap.has(idKey)) ||
                               (correoKey && dentroMap.has(correoKey)) ||
                               (u.estado === 'DENTRO');

            if (estaDentro) {
                dentroCount++;
            }
        });

        setVal('totalDocentes', docentes);
        setVal('totalAdminis', adminis);
        setVal('totalPersonalDentro', dentroCount);
        setVal('totalPersonalTurnos', `${mat} Mat / ${ves} Ves`);
    } catch (e) {
        console.error("Error al cargar estadísticas de personal:", e);
    }
}
window.cargarEstadisticasPersonal = cargarEstadisticasPersonal;

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

function cambiarScope(val) {
    const colEsp = document.getElementById('colEsp');
    const colGpo = document.getElementById('colGpo');
    const colNuevaLetra = document.getElementById('colNuevaLetra');
    const btnEjecutar = document.getElementById('btnEjecutarCambio');
    
    if (colEsp) colEsp.style.display = (val === 'especialidad' || val === 'grupo') ? 'block' : 'none';
    if (colGpo) colGpo.style.display = (val === 'grupo') ? 'block' : 'none';
    if (colNuevaLetra) colNuevaLetra.style.display = (val === 'grupo') ? 'block' : 'none';
    if (btnEjecutar) btnEjecutar.disabled = !val;

    previsualizarImpacto();
}
window.cambiarScope = cambiarScope;

async function actualizarGruposPromocion(esp) {
    const selectGpo = document.getElementById('selectCicloGpo');
    if (!selectGpo || !esp) {
        previsualizarImpacto();
        return;
    }

    const alumnos = await safeFetchJson('/api/alumnos');
    if (alumnos) {
        const grupos = [...new Set(alumnos.filter(a => (a.especialidad || '').toUpperCase() === esp.toUpperCase() && (a.estatus_escolar || a.estatus || 'Activo') === 'Activo').map(a => `${a.grado}° "${a.grupo}"`))].sort();
        selectGpo.innerHTML = '<option value="">-- Seleccionar --</option>';
        grupos.forEach(g => {
            selectGpo.innerHTML += `<option value="${g}">${g}</option>`;
        });
    }
    previsualizarImpacto();
}
window.actualizarGruposPromocion = actualizarGruposPromocion;

async function previsualizarImpacto() {
    const scope = document.getElementById('promocionScope')?.value;
    const prev = document.getElementById('previewImpacto');
    const det = document.getElementById('detalleImpacto');
    const btnEjecutar = document.getElementById('btnEjecutarCambio');
    if (!prev || !det) return;

    if (!scope) {
        prev.style.display = 'none';
        det.innerHTML = '';
        if (btnEjecutar) btnEjecutar.disabled = true;
        return;
    }

    prev.style.display = 'block';
    det.innerHTML = `<div class="text-muted small"><div class="spinner-border spinner-border-sm text-guinda me-1" role="status"></div> Calculando impacto de promoción en tiempo real...</div>`;

    try {
        const alumnos = await safeFetchJson('/api/alumnos') || [];
        const activos = alumnos.filter(a => (a.estatus_escolar || a.estatus || 'Activo') === 'Activo');

        if (scope === 'general') {
            let conteos = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            activos.forEach(a => {
                const g = parseInt(a.grado);
                if (g >= 1 && g <= 6) conteos[g]++;
            });

            const totalPromover = conteos[1] + conteos[2] + conteos[3] + conteos[4] + conteos[5];
            const totalEgresados = conteos[6];

            det.innerHTML = `
                <div class="p-3 bg-white rounded border shadow-sm">
                    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                        <span class="badge bg-guinda px-2 py-1"><i class="bi bi-buildings-fill me-1"></i>Promoción General</span>
                        <span class="fw-bold text-dark small">${activos.length} Alumnos Activos</span>
                    </div>
                    <p class="mb-2 x-small text-secondary">Avanzarán de semestre todos los alumnos activos del plantel:</p>
                    <div class="row g-2 text-center x-small">
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>1° &rarr; 2°</b><br><span class="text-guinda fw-bold">${conteos[1]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>2° &rarr; 3°</b><br><span class="text-guinda fw-bold">${conteos[2]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>3° &rarr; 4°</b><br><span class="text-guinda fw-bold">${conteos[3]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>4° &rarr; 5°</b><br><span class="text-guinda fw-bold">${conteos[4]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>5° &rarr; 6°</b><br><span class="text-guinda fw-bold">${conteos[5]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-warning bg-opacity-25 p-2 rounded border border-warning"><b>6° &rarr; EGRESADO</b><br><span class="text-danger fw-bold">${totalEgresados}</span></div></div>
                    </div>
                    <div class="mt-2 text-muted x-small">
                        <i class="bi bi-info-circle me-1"></i> Se promoverán <b>${totalPromover}</b> alumnos de 1°-5° y <b>${totalEgresados}</b> de 6° pasarán a Egresados.
                    </div>
                </div>
            `;
            if (btnEjecutar) btnEjecutar.disabled = (activos.length === 0);

        } else if (scope === 'especialidad') {
            const esp = document.getElementById('selectCicloEsp')?.value;
            if (!esp) {
                det.innerHTML = `<div class="alert alert-warning py-2 px-3 x-small mb-0"><i class="bi bi-exclamation-circle me-1"></i> Selecciona una Carrera en el paso 2 para previsualizar los grupos.</div>`;
                if (btnEjecutar) btnEjecutar.disabled = true;
                return;
            }

            const deCarrera = activos.filter(a => (a.especialidad || '').toUpperCase() === esp.toUpperCase());
            let conteos = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            deCarrera.forEach(a => {
                const g = parseInt(a.grado);
                if (g >= 1 && g <= 6) conteos[g]++;
            });

            const totalPromover = conteos[1] + conteos[2] + conteos[3] + conteos[4] + conteos[5];
            const totalEgresados = conteos[6];

            det.innerHTML = `
                <div class="p-3 bg-white rounded border shadow-sm">
                    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
                        <span class="badge bg-guinda px-2 py-1"><i class="bi bi-collection-fill me-1"></i>${esp}</span>
                        <span class="fw-bold text-dark small">${deCarrera.length} Alumnos en Carrera</span>
                    </div>
                    <div class="row g-2 text-center x-small">
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>1° &rarr; 2°</b><br><span class="text-guinda fw-bold">${conteos[1]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>2° &rarr; 3°</b><br><span class="text-guinda fw-bold">${conteos[2]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>3° &rarr; 4°</b><br><span class="text-guinda fw-bold">${conteos[3]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>4° &rarr; 5°</b><br><span class="text-guinda fw-bold">${conteos[4]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-light p-2 rounded border"><b>5° &rarr; 6°</b><br><span class="text-guinda fw-bold">${conteos[5]}</span></div></div>
                        <div class="col-4 col-md-2 p-1"><div class="bg-warning bg-opacity-25 p-2 rounded border border-warning"><b>6° &rarr; EGRESADO</b><br><span class="text-danger fw-bold">${totalEgresados}</span></div></div>
                    </div>
                    <div class="mt-2 text-muted x-small">
                        <i class="bi bi-info-circle me-1"></i> Se mantendrán las letras de grupo actuales para todos los alumnos de <b>${esp}</b>.
                    </div>
                </div>
            `;
            if (btnEjecutar) btnEjecutar.disabled = (deCarrera.length === 0);

        } else if (scope === 'grupo') {
            const esp = document.getElementById('selectCicloEsp')?.value;
            const gpoStr = document.getElementById('selectCicloGpo')?.value;
            const nuevaLetra = (document.getElementById('nuevaLetraGrupo')?.value || '').trim().toUpperCase();

            if (!esp) {
                det.innerHTML = `<div class="alert alert-warning py-2 px-3 x-small mb-0"><i class="bi bi-exclamation-circle me-1"></i> Selecciona una Carrera en el paso 2.</div>`;
                if (btnEjecutar) btnEjecutar.disabled = true;
                return;
            }
            if (!gpoStr) {
                det.innerHTML = `<div class="alert alert-warning py-2 px-3 x-small mb-0"><i class="bi bi-exclamation-circle me-1"></i> Selecciona el Grupo Actual en el paso 3.</div>`;
                if (btnEjecutar) btnEjecutar.disabled = true;
                return;
            }

            const match = gpoStr.match(/(\d+)[°\s]*"([^"]+)"/);
            const gradoActual = match ? parseInt(match[1]) : parseInt(gpoStr[0]);
            const letraActual = match ? match[2] : gpoStr.replace(/[^a-zA-Z]/g, '');

            const delGrupo = activos.filter(a => 
                (a.especialidad || '').toUpperCase() === esp.toUpperCase() &&
                parseInt(a.grado) === gradoActual &&
                (a.grupo || '').toUpperCase() === letraActual.toUpperCase()
            );

            const letraDestino = nuevaLetra || letraActual;
            let destinoTexto = "";
            if (gradoActual < 6) {
                destinoTexto = `<span class="badge bg-success fs-6">${gradoActual + 1}° "${letraDestino}"</span>`;
            } else {
                destinoTexto = `<span class="badge bg-danger fs-6">EGRESADO</span>`;
            }

            det.innerHTML = `
                <div class="p-3 bg-white rounded border shadow-sm">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-guinda px-2 py-1"><i class="bi bi-person-badge-fill me-1"></i>Grupo Seleccionado</span>
                        <span class="badge bg-light text-dark border">${delGrupo.length} Alumnos Registrados</span>
                    </div>
                    <div class="d-flex align-items-center justify-content-center gap-3 p-3 bg-light rounded border text-center">
                        <div>
                            <span class="text-muted d-block x-small">ORIGEN ACTUAL</span>
                            <span class="badge bg-secondary fs-6">${gradoActual}° "${letraActual}"</span>
                            <div class="x-small text-muted mt-1">${esp}</div>
                        </div>
                        <i class="bi bi-arrow-right fs-4 text-guinda"></i>
                        <div>
                            <span class="text-muted d-block x-small">NUEVO DESTINO</span>
                            ${destinoTexto}
                            <div class="x-small text-muted mt-1">${gradoActual < 6 ? esp : 'Concluye Bachillerato'}</div>
                        </div>
                    </div>
                    ${nuevaLetra && nuevaLetra !== letraActual ? `
                        <div class="mt-2 alert alert-info py-1 px-2 x-small mb-0">
                            <i class="bi bi-arrow-left-right me-1"></i> Se reasignará la letra de sección de <b>"${letraActual}"</b> a <b>"${nuevaLetra}"</b>.
                        </div>
                    ` : ''}
                </div>
            `;
            if (btnEjecutar) btnEjecutar.disabled = (delGrupo.length === 0);
        }
    } catch(e) {
        det.innerHTML = `<div class="text-danger x-small">Error al calcular previsualización: ${e.message}</div>`;
    }
}
window.previsualizarImpacto = previsualizarImpacto;

async function confirmarCambioCiclo() {
    const scope = document.getElementById('promocionScope')?.value;
    if (!scope) return Swal.fire("Aviso", "Selecciona un alcance para la promoción", "warning");

    const cicloActual = (document.getElementById('displayCicloActual')?.innerText || "AGO-DIC 2026").trim();

    const { value: nuevoCiclo } = await Swal.fire({
        title: '¿Confirmar Cambio de Ciclo?',
        html: `
            <p class="small text-muted mb-3">Los alumnos seleccionados avanzarán de semestre en la base de datos.</p>
            <div class="alert alert-info py-2 px-3 text-start small mb-3" style="font-size: 0.8rem; border-radius: 8px;">
                <i class="bi bi-info-circle-fill me-1"></i> <b>Ciclo escolar sugerido:</b><br>
                • <code>FEB-JUL AAAA</code> (Ej: FEB-JUL 2027)<br>
                • <code>AGO-DIC AAAA</code> (Ej: AGO-DIC 2026)
            </div>
            <label class="form-label small fw-bold text-start w-100 mb-1">Nombre del Ciclo Escolar:</label>
            <input id="swalCicloNombre" class="form-control form-control-lg fw-bold text-guinda text-center border-guinda" list="datalistCiclosModal" placeholder="Ej: AGO-DIC 2026" value="${cicloActual}" autocomplete="off" style="border-radius: 8px; font-size: 1.05rem;">
            <datalist id="datalistCiclosModal">
                <option value="AGO-DIC 2026"></option>
                <option value="FEB-JUL 2027"></option>
                <option value="AGO-DIC 2027"></option>
                <option value="FEB-JUL 2028"></option>
                <option value="AGO-DIC 2028"></option>
                <option value="FEB-JUL 2025"></option>
                <option value="AGO-DIC 2025"></option>
                <option value="FEB-JUL 2026"></option>
            </datalist>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        confirmButtonText: 'Sí, aplicar cambio',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const val = document.getElementById('swalCicloNombre').value.trim();
            if (!val) {
                Swal.showValidationMessage('Ingresa el nombre del ciclo escolar.');
            }
            return val;
        }
    });

    if (nuevoCiclo) {
        Swal.fire({ title: 'Aplicando cambios en base de datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            await fetch('/api/configuracion/ciclo_escolar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: 'ciclo_escolar', actual: nuevoCiclo })
            });

            const alumnos = await safeFetchJson('/api/alumnos') || [];
            let alumnosModificados = [];

            if (scope === 'general') {
                alumnos.forEach(al => {
                    const est = al.estatus_escolar || al.estatus || 'Activo';
                    if (est === 'Activo') {
                        let g = parseInt(al.grado || '1');
                        if (g < 6) {
                            al.grado = String(g + 1);
                        } else {
                            al.estatus_escolar = "Egresado";
                        }
                        alumnosModificados.push(al);
                    }
                });
            } else if (scope === 'especialidad') {
                const esp = document.getElementById('selectCicloEsp')?.value || '';
                alumnos.forEach(al => {
                    const est = al.estatus_escolar || al.estatus || 'Activo';
                    if (est === 'Activo' && (al.especialidad || '').toUpperCase() === esp.toUpperCase()) {
                        let g = parseInt(al.grado || '1');
                        if (g < 6) {
                            al.grado = String(g + 1);
                        } else {
                            al.estatus_escolar = "Egresado";
                        }
                        alumnosModificados.push(al);
                    }
                });
            } else if (scope === 'grupo') {
                const esp = document.getElementById('selectCicloEsp')?.value || '';
                const gpoStr = document.getElementById('selectCicloGpo')?.value || '';
                const nuevaLetra = (document.getElementById('nuevaLetraGrupo')?.value || '').trim().toUpperCase();

                const match = gpoStr.match(/(\d+)[°\s]*"([^"]+)"/);
                const gradoActual = match ? parseInt(match[1]) : parseInt(gpoStr[0]);
                const letraActual = match ? match[2] : gpoStr.replace(/[^a-zA-Z]/g, '');
                const letraDestino = nuevaLetra || letraActual;

                alumnos.forEach(al => {
                    const est = al.estatus_escolar || al.estatus || 'Activo';
                    if (est === 'Activo' &&
                        (al.especialidad || '').toUpperCase() === esp.toUpperCase() &&
                        parseInt(al.grado) === gradoActual &&
                        (al.grupo || '').toUpperCase() === letraActual.toUpperCase()) {
                        
                        if (gradoActual < 6) {
                            al.grado = String(gradoActual + 1);
                            al.grupo = letraDestino;
                        } else {
                            al.estatus_escolar = "Egresado";
                        }
                        alumnosModificados.push(al);
                    }
                });
            }

            // Guardar en bloques mediante /api/alumnos/bulk
            if (alumnosModificados.length > 0) {
                const CHUNK_SIZE = 50;
                for (let i = 0; i < alumnosModificados.length; i += CHUNK_SIZE) {
                    const batch = alumnosModificados.slice(i, i + CHUNK_SIZE);
                    await fetch('/api/alumnos/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(batch)
                    });
                }
            }

            await Swal.fire("¡Promoción Aplicada!", `Se actualizaron ${alumnosModificados.length} alumnos al nuevo ciclo "${nuevoCiclo}".`, "success");
            location.reload();

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
        const filtradas = esp ? incidencias.filter(i => (i.especialidad || '').toUpperCase() === esp.toUpperCase()) : incidencias;
        const totalEsp = filtradas.length;

        const elTotal = document.getElementById('totalEvidenciasModulo');
        if (elTotal) elTotal.innerText = totalEsp;

        let sem1 = 0, sem2 = 0, sem3 = 0, sem4 = 0, sem5 = 0, sem6 = 0;
        filtradas.forEach(i => {
            const g = parseInt(i.grado);
            if (g === 1) sem1++;
            else if (g === 2) sem2++;
            else if (g === 3) sem3++;
            else if (g === 4) sem4++;
            else if (g === 5) sem5++;
            else if (g === 6) sem6++;
        });

        if (chartGpo) chartGpo.destroy();
        chartGpo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['1° Sem', '2° Sem', '3° Sem', '4° Sem', '5° Sem', '6° Sem'],
                datasets: [{
                    label: 'Incidencias por Semestre',
                    data: [sem1, sem2, sem3, sem4, sem5, sem6],
                    backgroundColor: '#0d6efd',
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    } catch(e){}
}
window.actualizarGraficaGrupos = actualizarGraficaGrupos;

async function generarExcelModulos() {
    const esp = document.getElementById('selectFiltroModulo')?.value || '';
    Swal.fire({ title: 'Generando evidencias en Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const [incidencias, alumnos] = await Promise.all([
            safeFetchJson('/api/incidencias') || [],
            safeFetchJson('/api/alumnos') || []
        ]);

        const alumnosMap = {};
        alumnos.forEach(al => {
            const mat = al.ncontrol || al.matricula;
            if (mat) {
                const pat = al.apepat || al.primerApellido || '';
                const matApe = al.apemat || al.segundoApellido || '';
                alumnosMap[mat] = `${al.nombre} ${pat} ${matApe}`.trim().toUpperCase();
            }
        });

        const filtradas = esp 
            ? incidencias.filter(i => (i.especialidad || '').toUpperCase() === esp.toUpperCase()) 
            : incidencias;

        if (filtradas.length === 0) {
            return Swal.fire("Aviso", `No se encontraron incidencias/evidencias registradas para ${esp || 'la selección'}.`, "info");
        }

        const filasExcel = filtradas.map((i, index) => {
            const mat = i.id_alumno || i.matricula || 'S/N';
            const nomAlumno = alumnosMap[mat] || 'ALUMNO NO ENCONTRADO';
            const faltasTexto = Array.isArray(i.faltas_checklist) 
                ? i.faltas_checklist.join('; ') 
                : (i.faltas_checklist || i.motivo || 'Sin detalle de falta');
            
            const fechaRaw = i.fecha || i.fecha_registro || i.fecharegistro;
            let fechaFormateada = 'S/F';
            if (fechaRaw) {
                const d = new Date(fechaRaw);
                fechaFormateada = isNaN(d.getTime()) ? String(fechaRaw) : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }

            return {
                'No.': index + 1,
                'Folio Incidencia': i.folio_incidencia || i._id || i.id || `INC-${index + 1}`,
                'No. Control': mat,
                'Nombre del Alumno': nomAlumno,
                'Especialidad': i.especialidad || esp || 'N/A',
                'Semestre': i.grado ? `${i.grado}°` : 'N/A',
                'Grupo': i.grupo ? `"${i.grupo}"` : 'N/A',
                'Faltas Incurridas': faltasTexto,
                'Detalle / Observaciones': i.descripcion_detallada || i.descripcion || 'Sin observaciones adicionales',
                'Fecha de Registro': fechaFormateada,
                'Ciclo Escolar': i.ciclo || 'AGO-DIC 2026'
            };
        });

        const ws = XLSX.utils.json_to_sheet(filasExcel);
        
        // Ajustar anchos de columna automáticos
        ws['!cols'] = [
            { wch: 6 },  // No.
            { wch: 26 }, // Folio
            { wch: 18 }, // No. Control
            { wch: 35 }, // Nombre
            { wch: 25 }, // Especialidad
            { wch: 10 }, // Semestre
            { wch: 8 },  // Grupo
            { wch: 45 }, // Faltas
            { wch: 40 }, // Observaciones
            { wch: 18 }, // Fecha
            { wch: 16 }  // Ciclo
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Evidencias");
        const nombreArchivo = `Reporte_Evidencias_${esp ? esp.replace(/\s+/g, '_') : 'General'}_${new Date().toLocaleDateString('en-CA')}.xlsx`;
        XLSX.writeFile(wb, nombreArchivo);

        Swal.fire({
            icon: 'success',
            title: 'Reporte Descargado',
            text: `Se descargaron ${filasExcel.length} evidencias en "${nombreArchivo}".`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch(e) {
        console.error("Error al exportar evidencias:", e);
        Swal.fire("Error", "Fallo al exportar evidencias: " + e.message, "error");
    }
}
window.generarExcelModulos = generarExcelModulos;

async function generarExcelRiesgoDesercion() {
    Swal.fire({ title: 'Generando padrón de riesgo en Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        if (!listaAlumnosRiesgoGlobal || listaAlumnosRiesgoGlobal.length === 0) {
            return Swal.fire("Aviso", "No hay alumnos identificados en riesgo de deserción en este momento.", "info");
        }

        const filasExcel = listaAlumnosRiesgoGlobal.map((a, index) => ({
            'No.': index + 1,
            'No. Control': a.matricula,
            'Nombre Completo': a.nombre,
            'Especialidad': a.especialidad,
            'Semestre': `${a.grado}°`,
            'Grupo': `"${a.grupo}"`,
            'Turno': a.turno,
            'Días Sin Asistencia': a.diasSinRegistro,
            'Nivel de Riesgo': a.nivelRiesgo,
            'Nombre del Tutor': a.tutor,
            'Teléfono Tutor': a.telefonoTutor
        }));

        const ws = XLSX.utils.json_to_sheet(filasExcel);
        ws['!cols'] = [
            { wch: 6 },  // No.
            { wch: 18 }, // No. Control
            { wch: 38 }, // Nombre
            { wch: 28 }, // Especialidad
            { wch: 10 }, // Semestre
            { wch: 8 },  // Grupo
            { wch: 14 }, // Turno
            { wch: 20 }, // Días Sin Asistencia
            { wch: 16 }, // Nivel de Riesgo
            { wch: 32 }, // Tutor
            { wch: 18 }  // Teléfono Tutor
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Alumnos_Riesgo_EWS");
        const nombreArchivo = `Padron_Alumnos_Riesgo_Desercion_CBTIS134_${new Date().toLocaleDateString('en-CA')}.xlsx`;
        XLSX.writeFile(wb, nombreArchivo);

        Swal.fire({
            icon: 'success',
            title: 'Padrón Descargado',
            text: `Se exportaron ${filasExcel.length} estudiantes en "${nombreArchivo}".`,
            timer: 2000,
            showConfirmButton: false
        });
    } catch(e) {
        console.error("Error al exportar padrón:", e);
        Swal.fire("Error", "Fallo al exportar el padrón de riesgo: " + e.message, "error");
    }
}
window.generarExcelRiesgoDesercion = generarExcelRiesgoDesercion;

async function generarExcelPasesSalida() {
    Swal.fire({ title: 'Generando bitácora de pases en Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const pases = await safeFetchJson('/api/pases') || [];
        if (pases.length === 0) {
            return Swal.fire("Aviso", "No se encontraron pases de salida registrados.", "info");
        }

        const filasExcel = pases.map((p, index) => {
            const mat = p.id_alumno || p.matricula || p.no_control || 'GRUPAL';
            const alumnosNombres = p.nombre_alumno || (Array.isArray(p.alumnos) ? p.alumnos.map(a => a.nombre || a).join(', ') : 'Varios');
            return {
                'No.': index + 1,
                'Folio / ID': p.id || p._id || `PASE-${index + 1}`,
                'Tipo de Pase': p.tipo || (p.grupo ? 'GRUPAL' : 'INDIVIDUAL'),
                'Matrícula / No. Control': mat,
                'Nombre(s) Estudiante': alumnosNombres,
                'Especialidad': p.especialidad || 'N/A',
                'Semestre': p.grado ? `${p.grado}°` : 'N/A',
                'Grupo': p.grupo ? `"${p.grupo}"` : 'N/A',
                'Motivo de Salida': p.motivo || 'Sin especificar',
                'Fecha': p.fecha || 'S/F',
                'Hora Salida': p.hora || p.hora_salida || 'S/H',
                'Estatus': p.estatus || (p.estatus_vigencia ? 'AUTORIZADO' : 'CONCLUIDO'),
                'Autorizado Por': p.autorizado_por || p.usuario_autoriza || 'ADMIN'
            };
        });

        const ws = XLSX.utils.json_to_sheet(filasExcel);
        ws['!cols'] = [
            { wch: 6 },  // No.
            { wch: 22 }, // Folio
            { wch: 14 }, // Tipo
            { wch: 18 }, // Matricula
            { wch: 35 }, // Nombre
            { wch: 25 }, // Especialidad
            { wch: 10 }, // Semestre
            { wch: 8 },  // Grupo
            { wch: 35 }, // Motivo
            { wch: 14 }, // Fecha
            { wch: 12 }, // Hora
            { wch: 16 }, // Estatus
            { wch: 25 }  // Autorizado por
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pases_Salida");
        const nombreArchivo = `Bitacora_Pases_Salida_CBTIS134_${new Date().toLocaleDateString('en-CA')}.xlsx`;
        XLSX.writeFile(wb, nombreArchivo);

        Swal.fire({
            icon: 'success',
            title: 'Bitácora Descargada',
            text: `Se descargaron ${filasExcel.length} pases de salida en "${nombreArchivo}".`,
            timer: 2000,
            showConfirmButton: false
        });
    } catch(e) {
        console.error("Error al exportar pases:", e);
        Swal.fire("Error", "Fallo al exportar pases: " + e.message, "error");
    }
}
window.generarExcelPasesSalida = generarExcelPasesSalida;

async function generarExcelAsistenciaPersonal() {
    Swal.fire({ title: 'Generando asistencia de personal en Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const [usuarios, registros] = await Promise.all([
            safeFetchJson('/api/usuarios') || [],
            safeFetchJson('/api/registros-diarios') || []
        ]);

        const personalRegistros = registros.filter(r => r.grupo === 'PERSONAL' || r.especialidad === 'DOCENTE' || r.especialidad === 'ADMINISTRATIVO');
        
        const personalMap = {};
        usuarios.forEach(u => {
            const keyRfc = (u.rfc || u.uid || u.id || '').toUpperCase();
            if (keyRfc) {
                personalMap[keyRfc] = {
                    nombre: u.nombre,
                    rol: u.rol || 'DOCENTE',
                    turno: u.turno || 'Matutino',
                    correo: u.correo || ''
                };
            }
        });

        if (personalRegistros.length === 0 && usuarios.length === 0) {
            return Swal.fire("Aviso", "No hay registros de asistencia de personal para exportar.", "info");
        }

        const filasExcel = personalRegistros.map((r, index) => {
            const key = (r.matricula || r.ncontrol || '').toUpperCase();
            const infoUser = personalMap[key] || {};
            return {
                'No.': index + 1,
                'RFC / Identificador': r.matricula || r.ncontrol || 'S/N',
                'Nombre del Personal': r.nombre || infoUser.nombre || 'PERSONAL REGISTRADO',
                'Rol / Cargo': infoUser.rol || r.especialidad || 'DOCENTE',
                'Turno': infoUser.turno || 'Matutino',
                'Fecha': r.fecha || 'S/F',
                'Hora Entrada': r.hora_entrada || 'S/E',
                'Hora Salida': r.hora_salida || (r.estatus_actual === 'DENTRO' ? 'EN PLANTEL' : 'S/S'),
                'Estatus Actual': r.estatus_actual || (r.hora_salida ? 'FUERA' : 'DENTRO'),
                'Método de Checado': r.metodo || 'BIOMÉTRICO / QR'
            };
        });

        if (filasExcel.length === 0) {
            usuarios.forEach((u, index) => {
                filasExcel.push({
                    'No.': index + 1,
                    'RFC / Identificador': u.rfc || u.uid || u.id || 'S/N',
                    'Nombre del Personal': u.nombre,
                    'Rol / Cargo': u.rol || 'DOCENTE',
                    'Turno': u.turno || 'Matutino',
                    'Fecha': new Date().toLocaleDateString('es-MX'),
                    'Hora Entrada': '---',
                    'Hora Salida': '---',
                    'Estatus Actual': u.estado || 'FUERA',
                    'Método de Checado': 'CATÁLOGO'
                });
            });
        }

        const ws = XLSX.utils.json_to_sheet(filasExcel);
        ws['!cols'] = [
            { wch: 6 },  // No.
            { wch: 22 }, // RFC
            { wch: 35 }, // Nombre
            { wch: 20 }, // Rol
            { wch: 14 }, // Turno
            { wch: 14 }, // Fecha
            { wch: 14 }, // Hora Entrada
            { wch: 14 }, // Hora Salida
            { wch: 16 }, // Estatus
            { wch: 22 }  // Método
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Asistencia_Personal");
        const nombreArchivo = `Asistencia_Personal_Docentes_CBTIS134_${new Date().toLocaleDateString('en-CA')}.xlsx`;
        XLSX.writeFile(wb, nombreArchivo);

        Swal.fire({
            icon: 'success',
            title: 'Asistencia Descargada',
            text: `Se exportaron ${filasExcel.length} registros en "${nombreArchivo}".`,
            timer: 2000,
            showConfirmButton: false
        });
    } catch(e) {
        console.error("Error al exportar asistencia de personal:", e);
        Swal.fire("Error", "Fallo al exportar asistencia de personal: " + e.message, "error");
    }
}
window.generarExcelAsistenciaPersonal = generarExcelAsistenciaPersonal;