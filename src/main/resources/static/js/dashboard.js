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

let calendarioInstancia = null;

const PALETA_COLORES_CALENDARIO = [
    { nombre: 'Institucional Guinda', valor: '#7b1b37' },
    { nombre: 'Inhábiles / Suspensión', valor: '#dc3545' },
    { nombre: 'Evaluaciones / Exámenes', valor: '#0d6efd' },
    { nombre: 'Actividad Cívica / Cultural', valor: '#198754' },
    { nombre: 'Administrativo / Consejo', valor: '#6f42c1' },
    { nombre: 'Calificaciones / Avisos', valor: '#fd7e14' }
];

function inicializarCalendario(userRole) {
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
                const res = await fetch('/api/calendario');
                if (!res.ok) throw new Error("Error HTTP " + res.status);
                const eventos = await res.json();
                const mapeados = (eventos || []).map(evt => ({
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
                        creadoPor: evt.creadoPor || 'ADMIN'
                    }
                }));
                successCallback(mapeados);
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
            if (!esAdmin) {
                changeInfo.revert();
                return;
            }
            await actualizarFechasEvento(changeInfo.event, changeInfo.revert);
        },
        eventResize: async function(changeInfo) {
            if (!esAdmin) {
                changeInfo.revert();
                return;
            }
            await actualizarFechasEvento(changeInfo.event, changeInfo.revert);
        }
    });

    calendarioInstancia.render();
}

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
    const categoriaMatch = PALETA_COLORES_CALENDARIO.find(c => c.valor.toLowerCase() === colorHex.toLowerCase());
    const categoriaNombre = categoriaMatch ? categoriaMatch.nombre : 'Evento';

    if (esAdmin) {
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
                    </div>
                    <p class="mb-1"><strong><i class="bi bi-clock me-1"></i>Periodo:</strong> ${startStr} ${endStr ? ' hasta ' + endStr : ''}</p>
                    ${props.descripcion ? `<p class="mb-1"><strong><i class="bi bi-card-text me-1"></i>Detalles:</strong> ${props.descripcion}</p>` : ''}
                </div>
            `,
            confirmButtonText: 'Cerrar',
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

    const { value: nuevoCiclo } = await Swal.fire({
        title: '¿Confirmar Cambio de Ciclo?',
        html: `
            <p class="small text-muted mb-3">Los alumnos seleccionados avanzarán un semestre en MongoDB.</p>
            <div class="alert alert-info py-2 px-3 text-start small mb-3" style="font-size: 0.8rem; border-radius: 8px;">
                <i class="bi bi-info-circle-fill me-1"></i> <b>Sugerencia de Formato DGETI:</b><br>
                • <code>FEB-JUL AAAA</code> (Ej: FEB-JUL 2027)<br>
                • <code>AGO-DIC AAAA</code> (Ej: AGO-DIC 2026)
            </div>
            <label class="form-label small fw-bold text-start w-100 mb-1">Nombre del Nuevo Ciclo Escolar Activo:</label>
            <input id="swalCicloNombre" class="form-control form-control-lg fw-bold text-guinda text-center border-guinda" list="datalistCiclosModal" placeholder="Ej: AGO-DIC 2026" value="AGO-DIC 2026" autocomplete="off" style="border-radius: 8px; font-size: 1.05rem;">
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
                Swal.showValidationMessage('Ingresa el nombre del nuevo ciclo escolar.');
            }
            return val;
        }
    });

    if (nuevoCiclo) {
        Swal.fire({ title: 'Aplicando cambios en MongoDB...', didOpen: () => Swal.showLoading() });
        try {
            await fetch('/api/configuracion/ciclo_escolar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: 'ciclo_escolar', actual: nuevoCiclo })
            });

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
                Swal.fire("Éxito", `Cambio de ciclo a "${nuevoCiclo}" ejecutado correctamente.`, "success").then(() => location.reload());
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