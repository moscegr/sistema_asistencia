/**
 * Dashboard Logic - CBTis 134
 */
let chartEsp = null;
let chartEst = null;
let chartGpo = null;

document.addEventListener('DOMContentLoaded', inicializarVistaCiclo);
document.addEventListener('DOMContentLoaded', verificarIntegridadSistema);

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. GESTIÓN DE AUTENTICACIÓN Y CARGA INICIAL ---
    auth.onAuthStateChanged(user => {
        if (user) {
            validarRolUsuario(user.uid);
        } else {
            window.location.href = "/login";
        }
    });

    cargarDashboardCompleto();
    setInterval(cargarDashboardCompleto, 60000);

    const rawRole = localStorage.getItem('userRole') || "";
    const userRole = rawRole.toUpperCase(); 
    const calendarEl = document.getElementById('calendar');

    if (calendarEl) {
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

            events: async function(info, successCallback, failureCallback) {
                try {
                    const snap = await db.collection("calendario").get();
                    const events = snap.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            title: data.title,
                            start: data.start,
                            end: data.end,
                            allDay: data.allDay,
                            backgroundColor: '#7b1b37',
                            borderColor: '#7b1b37'
                        };
                    });
                    successCallback(events);
                } catch (e) { failureCallback(e); }
            },

            select: async function(selectionInfo) {
                if (userRole !== 'ADMIN') return;
                
                const { value: title } = await Swal.fire({
                    title: 'Nuevo Evento Escolar',
                    input: 'text',
                    inputLabel: 'Nombre del evento',
                    placeholder: 'Ej. Periodo de Exámenes',
                    showCancelButton: true,
                    confirmButtonColor: '#7b1b37',
                    cancelButtonText: 'Cancelar'
                });

                if (title) {
                    const ahora = new Date();
                    const timestamp = ahora.getFullYear() + 
                                      String(ahora.getMonth() + 1).padStart(2, '0') + 
                                      String(ahora.getDate()).padStart(2, '0') + "_" + 
                                      String(ahora.getHours()).padStart(2, '0') + 
                                      String(ahora.getMinutes()).padStart(2, '0') + 
                                      String(ahora.getSeconds()).padStart(2, '0');
                    
                    const customDocId = `EVT_${timestamp}`;

                    try {
                        await db.collection("calendario").doc(customDocId).set({
                            title: title,
                            start: selectionInfo.startStr,
                            end: selectionInfo.endStr,
                            allDay: selectionInfo.allDay,
                            color: '#7b1b37',
                            creadoPor: 'ADMIN',
                            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        calendar.refetchEvents();
                    } catch (error) {
                        console.error("Error al guardar:", error);
                    }
                }
                calendar.unselect();
            },

            eventClick: async function(info) {
                if (userRole !== 'ADMIN') return;

                const confirmar = await Swal.fire({
                    title: '¿Eliminar evento?',
                    text: info.event.title,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    confirmButtonText: 'Eliminar'
                });

                if (confirmar.isConfirmed) {
                    await db.collection("calendario").doc(info.event.id).delete();
                    info.event.remove();
                }
            }
        });

        calendar.render();
    }

	
    // --- 3. LÓGICA DEL SWITCH DE SALIDA GENERAL ---
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
            actualizarEstadoSalidaGeneral(nuevoEstado).then(() => {
                switchSalida.checked = nuevoEstado;
                modalConfirmacion.hide();
            }).catch(error => {
                console.error("Error al actualizar:", error);
            });
        });
    }
});

function inicializarVistaCiclo() {
	    db.collection("configuracion").doc("ciclo_escolar").onSnapshot(doc => {
	        if (doc.exists) {
	            const ciclo = doc.data().actual;
	            // Intenta actualizar en Dashboard
	            const displayHeader = document.getElementById('displayCicloActual');
	            if (displayHeader) displayHeader.innerText = ciclo;
	        }
	    });
	}

	async function verificarIntegridadSistema() {
	    const ref = db.collection("configuracion").doc("ciclo_escolar");
	    const doc = await ref.get();
	    
	    if (!doc.exists) {
	        const anio = new Date().getFullYear();
	        const mes = new Date().getMonth();
	        const cicloSugerido = (mes >= 7 || mes === 11) ? `AGO-DIC ${anio}` : `FEB-JUL ${anio}`;
	        
	        await ref.set({
	            actual: cicloSugerido,
	            ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
	        });
	        console.log("Sistema inicializado con el ciclo:", cicloSugerido);
	    }
	}
	
/**
 * Función Maestra: Carga TODO el Dashboard de un solo golpe
 */
async function cargarDashboardCompleto() {
    try {
        await limpiarFantasmasNocturnos();

        const snapAlumnos = await db.collection("alumnos").where("estatus_escolar", "==", "Activo").get();
        
        const totalRegistrados = snapAlumnos.size;
        let totalDentro = 0;
        let totalFuera = 0;
        const conteoEspecialidades = {};

        snapAlumnos.forEach(doc => {
            const al = doc.data();
            if (al.estado === "DENTRO") {
                totalDentro++;
                const esp = al.especialidad || 'OTRO';
                conteoEspecialidades[esp] = (conteoEspecialidades[esp] || 0) + 1;
            } else {
                totalFuera++;
            }
        });

        // 3. ACTUALIZAR CONTADORES SUPERIORES
        if(document.getElementById('totalAlumnos')) 
            document.getElementById('totalAlumnos').innerText = totalRegistrados;

        // 4. ACTUALIZAR KPI'S DE INTELIGENCIA
        actualizarKPIs(totalDentro, totalRegistrados);

        // 5. RENDERIZAR GRÁFICOS
        renderizarGraficoBarras(conteoEspecialidades);
        renderizarGraficoPastel(totalDentro, totalFuera);

        // Actualizar hora de corte
        document.getElementById('ultimaAct').innerText = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    } catch (e) {
        console.error("Error en Dashboard:", e);
    }
}

async function limpiarFantasmasNocturnos() {
    const hoy = new Date().toLocaleDateString('en-CA');
    const configRef = db.collection("configuracion").doc("sistema");
    
    try {
        const doc = await configRef.get();
        if (doc.exists && doc.data().ultimaLimpieza === hoy) return;

        const snap = await db.collection("alumnos").where("estado", "==", "DENTRO").get();
        
        if (!snap.empty) {
            const chunks = [];
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 400) {
                chunks.push(docs.slice(i, i + 400));
            }

            for (const chunk of chunks) {
                const batch = db.batch();
                chunk.forEach(alumno => batch.update(alumno.ref, { estado: "FUERA" }));
                await batch.commit();
            }
            console.log(`Limpieza completada: ${snap.size} alumnos reseteados.`);
        }

        await configRef.set({ ultimaLimpieza: hoy }, { merge: true });
    } catch (e) {
        console.error("Error en la limpieza nocturna:", e);
    }
}

// 2. SEGURIDAD Y CARGA INICIAL
async function validarRolUsuario(uid) {
    try {
        const doc = await db.collection("usuarios").doc(uid).get();
        
        if (doc.exists) {
            const data = doc.data();
            const rol = data.rol.toUpperCase();
            const rolesDashboard = ["ADMIN", "PREFECTO", "ORIENTACION"];

            if (rolesDashboard.includes(rol)) {
                // --- UI PARA TODOS LOS USUARIOS DEL DASHBOARD ---
                const elUserName = document.getElementById('userName');
                const elUserRol = document.getElementById('userBannerRol');
                const elBannerName = document.getElementById('userBannerName');

                if (elUserName) elUserName.innerText = data.nombre;
                if (elUserRol) elUserRol.innerText = data.rol;
                if (elBannerName) elBannerName.innerText = data.nombre;

                if (rol === "ADMIN") {
                    determinarCicloSugerido();
                    await cargarEspecialidadesPromocion();
                }

                cargarEstadisticas(); 

            } else if (rol === "GUARDIA") {
                window.location.href = "/admin/escaneo";
            } else {
                throw new Error("Rol no reconocido o sin permisos.");
            }
        } else {
            throw new Error("El perfil no existe en Firestore.");
        }
    } catch (error) {
        console.error("Error validando rol:", error);
        Swal.fire("Acceso Denegado", "No tienes permisos para esta área.", "error");
        auth.signOut().then(() => window.location.href = "/login");
    }
}

// 3. ESTADÍSTICAS
function cargarEstadisticas() {
    const hoy = new Date().toLocaleDateString('en-CA');
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };

    db.collection("alumnos").where("estatus_escolar", "==", "Activo")
      .onSnapshot(snap => setVal('totalAlumnos', snap.size));

    db.collection("pases_salida").where("fecha", "==", hoy).where("estatus_vigencia", "==", true)
      .onSnapshot(snap => setVal('totalPases', snap.size));

    db.collection("justificantes").onSnapshot(snap => setVal('totalJustificantes', snap.size));

    db.collection("incidencias").onSnapshot(s1 => {
        db.collection("incidencias_personal").onSnapshot(s2 => {
            setVal('totalIncidencias', s1.size + s2.size);
        });
    });
}

// 4. LÓGICA DE ESPECIALIDADES
async function cargarEspecialidadesPromocion() {
    const selectCiclo = document.getElementById('selectCicloEsp');
    const selectFiltro = document.getElementById('selectFiltroModulo'); 

    try {
        const doc = await db.collection("configuracion").doc("escolar").get();
        
        if (doc.exists && doc.data().especialidades) {
            if (selectCiclo) selectCiclo.innerHTML = '<option value="">-- Seleccionar Carrera --</option>';
            if (selectFiltro) selectFiltro.innerHTML = '<option value="" disabled selected>Selecciona una Especialidad...</option>';

            doc.data().especialidades.forEach(esp => {
                if (selectCiclo) {
                    const opt1 = document.createElement('option');
                    opt1.value = esp.nombre; 
                    opt1.textContent = esp.nombre;
                    selectCiclo.appendChild(opt1);
                }
                
                if (selectFiltro) {
                    const opt2 = document.createElement('option');
                    opt2.value = esp.nombre; 
                    opt2.textContent = esp.nombre;
                    selectFiltro.appendChild(opt2);
                }
            });
            console.log("Especialidades inyectadas en ambos selectores.");
        }
    } catch (e) {
        console.error("Error en cargarEspecialidadesPromocion:", e);
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

function cambiarScope(val) {
    const infoInicio = document.getElementById('infoInicioPromocion');
    const colEsp = document.getElementById('colEsp');
    const colGpo = document.getElementById('colGpo');
    const colLetra = document.getElementById('colNuevaLetra');
    const preview = document.getElementById('previewImpacto');
    
    if(preview) preview.style.display = 'none';
    if(document.getElementById('nuevaLetraGrupo')) document.getElementById('nuevaLetraGrupo').value = "";
    if(document.getElementById('selectCicloEsp')) document.getElementById('selectCicloEsp').value = "";

    if (val === "") {
        if(infoInicio) infoInicio.style.display = 'block';
        if(colEsp) colEsp.style.display = 'none';
        if(colGpo) colGpo.style.display = 'none';
        if(colLetra) colLetra.style.display = 'none';
        document.getElementById('btnEjecutarCambio').disabled = true;
    } 
    else {
        if(infoInicio) infoInicio.style.display = 'none';

        if (val === 'general') {
            if(colEsp) colEsp.style.display = 'none'; 
            if(colGpo) colGpo.style.display = 'none'; 
            if(colLetra) colLetra.style.display = 'none';
            previsualizarImpacto();
        } else if (val === 'especialidad') {
            if(colEsp) colEsp.style.display = 'block'; 
            if(colGpo) colGpo.style.display = 'none'; 
            if(colLetra) colLetra.style.display = 'none';
        } else if (val === 'grupo') {
            if(colEsp) colEsp.style.display = 'block'; 
            if(colGpo) colGpo.style.display = 'block'; 
            if(colLetra) colLetra.style.display = 'block';
        }
    }
}

async function actualizarGruposPromocion(esp) {
    const selectGpo = document.getElementById('selectCicloGpo');
    if(!selectGpo) return;
    selectGpo.innerHTML = '<option value="">-- Seleccionar --</option>';
    if (!esp) return;

    const snap = await db.collection("alumnos").where("especialidad", "==", esp).where("estatus_escolar", "==", "Activo").get();
    let gruposSet = new Set();
    snap.forEach(doc => gruposSet.add(doc.data().grupo));
    Array.from(gruposSet).sort().forEach(gpo => {
        const opt = document.createElement('option'); opt.value = gpo; opt.textContent = gpo;
        selectGpo.appendChild(opt);
    });
    if (document.getElementById('promocionScope').value === 'especialidad') previsualizarImpacto();
}

async function previsualizarImpacto() {
    const scope = document.getElementById('promocionScope').value;
    const esp = document.getElementById('selectCicloEsp').value;
    const gpo = document.getElementById('selectCicloGpo').value;
    const detalle = document.getElementById('detalleImpacto');

    if (!detalle) return;

    let query = db.collection("alumnos").where("estatus_escolar", "==", "Activo");
    if (scope === 'especialidad' && esp) query = query.where("especialidad", "==", esp);
    if (scope === 'grupo' && esp && gpo) query = query.where("especialidad", "==", esp).where("grupo", "==", gpo);

    try {
        const snap = await query.get();
        if (snap.empty) {
            detalle.innerHTML = "<p class='text-muted small'><i class='bi bi-info-circle me-1'></i> No se encontraron alumnos para los criterios seleccionados.</p>";
            document.getElementById('btnEjecutarCambio').disabled = true;
            return;
        }

        let html = "";

        if (scope === 'general') {
            let resumen = {};
            snap.forEach(doc => {
                const d = doc.data();
                const carrera = d.especialidad || "SIN ESPECIALIDAD";
                const grado = d.grado;
                const grupo = d.grupo;

                if (!resumen[carrera]) resumen[carrera] = {};
                if (!resumen[carrera][grado]) resumen[carrera][grado] = new Set();
                resumen[carrera][grado].add(grupo);
            });

            Object.keys(resumen).sort().forEach(carrera => {
                html += `
                <div class="mb-3 p-2 border-start border-4 border-guinda bg-white shadow-sm rounded-end">
                    <h6 class="fw-bold text-guinda mb-2 text-uppercase" style="font-size: 0.85rem;">
                        <i class="bi bi-bookmark-star-fill me-1"></i> ${carrera}
                    </h6>
                    <div class="ps-2">`;
                
                Object.keys(resumen[carrera]).sort().forEach(grado => {
                    const g = parseInt(grado);
                    const listaGrupos = Array.from(resumen[carrera][grado]).sort().join(", ");
                    const siguiente = g < 6 ? `${g + 1}° Semestre` : `<span class="badge bg-danger">EGRESADO (BAJA)</span>`;
                    
                    html += `
                        <div class="d-flex justify-content-between align-items-center mb-1 border-bottom border-light pb-1">
                            <span class="small">Grupos: <b>${listaGrupos}</b> <span class="text-muted">(${grado}° Semestre)</span></span>
                            <span class="fw-bold text-primary" style="font-size: 1.05rem;">
                                <i class="bi bi-arrow-right-short"></i> ${siguiente}
                            </span>
                        </div>`;
                });
                html += `</div></div>`;
            });
        } else {
            let conteos = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
            snap.forEach(doc => { 
                const g = parseInt(doc.data().grado); 
                if(conteos[g] !== undefined) conteos[g]++; 
            });

            html = `<div class="p-3 bg-white rounded shadow-sm">
                        <h6 class="text-muted x-small fw-bold text-uppercase mb-3">Movimiento de Matrícula:</h6>
                        <ul class="list-unstyled mb-0">`;

            Object.keys(conteos).forEach(grado => {
                if (conteos[grado] > 0) {
                    const g = parseInt(grado);
                    const siguiente = g < 6 ? `${g + 1}° Semestre` : `EGRESADO (BAJA)`;
                    const color = g < 6 ? 'text-primary' : 'text-danger';
                    
                    html += `
                    <li class="mb-3 d-flex justify-content-between align-items-center border-bottom pb-2">
                        <span><b class="fs-5">${conteos[grado]}</b> <span class="text-muted">alumnos de</span> <b>${grado}° Semestre</b></span>
                        <span class="fw-bold ${color}" style="font-size: 1.1rem; letter-spacing: -0.5px;">
                            <i class="bi bi-arrow-right-circle-fill me-1"></i> ${siguiente}
                        </span>
                    </li>`;
                }
            });
            html += `</ul></div>`;
        }

        detalle.innerHTML = html;
        if(document.getElementById('previewImpacto')) document.getElementById('previewImpacto').style.display = 'block';
        if(document.getElementById('btnEjecutarCambio')) document.getElementById('btnEjecutarCambio').disabled = false;

    } catch (e) {
        console.error("Error en previsualización:", e);
        detalle.innerHTML = "<p class='text-danger small'>Error al procesar la previsualización.</p>";
    }
}

async function confirmarCambioCiclo() {
    const { isConfirmed } = await Swal.fire({
        title: '¿Confirmar Cambio de Ciclo?',
        text: "Esta acción incrementará el grado y egresará a los alumnos de 6to semestre.",
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#7b1b37',
        confirmButtonText: 'Sí, aplicar cambios', cancelButtonText: 'Cancelar'
    });
    if (isConfirmed) ejecutarCambioMasivoFinal();
}

async function ejecutarCambioMasivoFinal() {
    const scope = document.getElementById('promocionScope').value;
    const esp = document.getElementById('selectCicloEsp').value;
    const gpo = document.getElementById('selectCicloGpo').value;
    const nuevaLetra = document.getElementById('nuevaLetraGrupo').value.toUpperCase().trim();
    
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth(); 
    const nuevoCicloCalculado = (mes >= 7 || mes === 11) ? `AGO-DIC ${anio}` : `FEB-JUL ${anio}`;

    try {
        const configRef = db.collection("configuracion").doc("ciclo_escolar");
        const docConfig = await configRef.get();
        const cicloActualEnBD = docConfig.exists ? docConfig.data().actual : "";

        if (scope === 'general' && nuevoCicloCalculado === cicloActualEnBD) {
            return Swal.fire({
                title: 'Ciclo ya actualizado',
                html: `El sistema detecta que ya te encuentras en el ciclo <b>${cicloActualEnBD}</b>.<br><br>No puedes realizar un cambio de ciclo general hacia el mismo ciclo porque se duplicarían los registros históricos.`,
                icon: 'info',
                confirmButtonColor: '#7b1b37'
            });
        }

        if (scope === 'general') {
            const esMesTipico = [0, 1, 6, 7].includes(mes);
            if (!esMesTipico) {
                const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const { isConfirmed: forzar } = await Swal.fire({
                    title: '📅 Fecha Inusual',
                    html: `Estamos en <b>${nombresMeses[mes]}</b>. Las promociones suelen ser en Enero/Febrero o Julio/Agosto.<br><br>¿Seguro que deseas avanzar el grado de <b>todos</b> los alumnos?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    confirmButtonText: 'Sí, forzar promoción general',
                    cancelButtonText: 'Cancelar'
                });
                if (!forzar) return;
            }
        }

        Swal.fire({ title: 'Actualizando alumnos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        let query = db.collection("alumnos").where("estatus_escolar", "==", "Activo");
        if (scope === 'especialidad') query = query.where("especialidad", "==", esp);
        if (scope === 'grupo') query = query.where("especialidad", "==", esp).where("grupo", "==", gpo);

        const snap = await query.get();
        if (snap.empty) return Swal.fire("Sin alumnos", "No hay alumnos activos que coincidan con los filtros.", "info");

        const batch = db.batch();
        
        snap.forEach(doc => {
            const gradoActual = parseInt(doc.data().grado);
            let updates = {};
            
            if (gradoActual < 6) {
                updates.grado = String(gradoActual + 1);
                if (nuevaLetra && scope === 'grupo') updates.grupo = nuevaLetra;
                updates.fecha_ultima_asistencia = null;
            } else { 
                updates.estatus_escolar = "Egresado"; 
                updates.motivo_baja = "Término de estudios"; 
            }
            batch.update(doc.ref, updates);
        });

        if (scope === 'general') {
            batch.update(configRef, { 
                actual: nuevoCicloCalculado,
                ciclo_anterior: cicloActualEnBD,
                ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await batch.commit();
        Swal.fire("¡Éxito!", "Cambio de ciclo y promoción completados.", "success").then(() => location.reload());

    } catch (e) { 
        console.error(e);
        Swal.fire("Error", e.message, "error"); 
    }
}

async function toggleEstadoContingencia(estado) {
    const hoy = new Date().toLocaleDateString('en-CA'); 

    try {
        await db.collection("configuracion").doc("escolar").update({
            salidaGeneralAutorizada: estado,
            fechaSalidaGeneral: estado ? hoy : null,
            ultimoCambio: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (estado) {
            console.log("⚠️ MODO CONTINGENCIA ACTIVADO");
            
            const confirmar = confirm("¿Deseas notificar a todos los tutores de alumnos que están dentro del plantel ahora mismo? (Esto enviará WhatsApps masivos)");
            if (confirmar) {
                await ejecutarSalidaGeneralContingencia();
            }
        } else {
            console.log("✅ Modo normal restablecido");
        }
        
        cargarEstadisticas(); 
        
    } catch (error) {
        console.error("Error al activar contingencia:", error);
        alert("Error al comunicar con el servidor. Verifica los permisos.");
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ejecutarSalidaGeneralContingencia() {
    const hoy = obtenerFechaLocal();
    const DELAY_MS = 300;

    try {
        const snapshot = await db.collection("registros_diarios")
                                 .where("fecha", "==", hoy)
                                 .where("estatus_actual", "==", "DENTRO")
                                 .get();

        for (const doc of snapshot.docs) {
            const regData = doc.data();

            await doc.ref.update({
                estatus_actual: "FUERA",
                hora_salida: new Date().toLocaleTimeString(),
                motivo: "CONTINGENCIA"
            });

            const alumnoDoc = await db.collection("alumnos").doc(regData.matricula).get();
            if (alumnoDoc.exists) {
                await enviarNotificacionTutor(alumnoDoc.data(), "CONTINGENCIA");
            }
            
            await sleep(DELAY_MS);
        }
        alert("Proceso de contingencia terminado.");
    } catch (error) {
        console.error(error);
    }
}


/**
 * Calcula porcentajes y mueve las barras de progreso
 */
function actualizarKPIs(dentro, total) {
    const porcentaje = total > 0 ? ((dentro / total) * 100).toFixed(1) : 0;
    
    const txtPct = document.getElementById('pctAsistencia');
    const barra = document.getElementById('barraAsistencia');
    
    if (txtPct) txtPct.innerText = `${porcentaje}%`;
    if (barra) barra.style.width = `${porcentaje}%`;
}

/**
 * Gráfico de Barras (Especialidades)
 */
function renderizarGraficoBarras(datos) {
    const ctx = document.getElementById('graficoEspecialidades');
    if (!ctx) return;
    if (chartEsp) chartEsp.destroy();

    chartEsp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(datos),
            datasets: [{
                label: 'Alumnos en Plantel',
                data: Object.values(datos),
                backgroundColor: '#7b1b37',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: 20,
                    left: 10,
                    right: 10,
                    top: 10
                }
            },
            plugins: { 
                legend: { display: false } 
            },
            scales: { 
                y: { beginAtZero: true },
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

/**
 * Gráfico de Dona (Estatus)
 */
function renderizarGraficoPastel(dentro, fuera) {
    const ctx = document.getElementById('graficoEstatus');
    if (!ctx) return;
    if (chartEst) chartEst.destroy();

    chartEst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['En Plantel', 'Fuera'],
            datasets: [{
                data: [dentro, fuera],
                backgroundColor: ['#0d6efd', '#e9ecef'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', 
            layout: {
                padding: {
                    bottom: 30
                }
            },
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { 
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 11 }
                    } 
                }
            }
        }
    });
}

async function calcularRiesgoDesercion() {
    const ul = document.getElementById('ulAlertaDesercion');
    const div = document.getElementById('listaDesercion');
    if (!ul || !div) return;

    div.style.display = 'block';
    ul.innerHTML = "<li class='list-group-item text-center'><div class='spinner-border spinner-border-sm text-danger'></div></li>";

    try {
        const hoy = new Date();
        const hoyISO = hoy.toISOString().split('T')[0];

        // 1. VALIDACIÓN DE CALENDARIO (Omitir fines de semana de entrada)
        if (hoy.getDay() === 0 || hoy.getDay() === 6) {
            ul.innerHTML = "<li class='list-group-item text-muted text-center small'>Fin de semana: Monitoreo pausado.</li>";
            return;
        }

        // 2. CONSULTA DE DATOS
        const snapAlumnos = await db.collection("alumnos").where("estatus_escolar", "==", "Activo").get();
        const totalAlumnos = snapAlumnos.size;
        let enRiesgo = [];

        snapAlumnos.forEach(doc => {
            const al = doc.data();
            if (!al.fecha_ultima_asistencia) {
                al.diasAusente = 99; // Prioridad por falta de registro inicial
                enRiesgo.push(al);
            } else {
                const ultima = new Date(al.fecha_ultima_asistencia + "T00:00:00");
                const difDias = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));
                
                if (difDias >= 5 && difDias <= 30) {
                    al.diasAusente = difDias;
                    enRiesgo.push(al);
                }
            }
        });

        // 3. VÁLVULA DE SEGURIDAD (Si el 30% está ausente, no es deserción, es puente o vacaciones)
        const umbralAnomalia = totalAlumnos * 0.3;
        if (enRiesgo.length > umbralAnomalia) {
            ul.innerHTML = `
                <li class="list-group-item list-group-item-warning text-center small py-3">
                    <i class="bi bi-info-circle-fill d-block fs-4 mb-2"></i>
                    <b>Monitoreo Suspendido</b><br>
                    Se detectaron ${enRiesgo.length} ausencias simultáneas. <br>
                    (Probable periodo vacacional o día inhábil)
                </li>`;
            return;
        }

        // 4. RENDERIZADO NORMAL
        ul.innerHTML = "";
        if (enRiesgo.length === 0) {
            ul.innerHTML = "<li class='list-group-item text-success text-center small'>Asistencia regular.</li>";
        } else {
            enRiesgo.sort((a, b) => b.diasAusente - a.diasAusente);
            enRiesgo.slice(0, 8).forEach(al => {
                const diasLabel = al.diasAusente === 99 ? 'NUNCA HA ASISTIDO' : `${al.diasAusente} días ausente`;
                ul.innerHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center py-2 border-start border-danger border-3 mb-1">
                    <div class="d-flex flex-column">
                        <span class="fw-bold" style="font-size: 0.8rem;">${al.nombre} ${al.apepat}</span>
                        <small class="text-danger" style="font-size: 0.7rem;">${diasLabel}</small>
                    </div>
                    <button class="btn btn-sm btn-light border" onclick="verExpedienteDetalle('${al.matricula}')">
                        <i class="bi bi-search"></i>
                    </button>
                </li>`;
            });
        }
    } catch (error) {
        console.error(error);
        ul.innerHTML = "<li class='list-group-item text-danger text-center'>Error en el análisis.</li>";
    }
}

async function verDetalleRiesgo(matricula) {
    const doc = await db.collection("alumnos").doc(matricula).get();
    if (!doc.exists) return;
    const al = doc.data();

    Swal.fire({
        title: 'Ficha de Riesgo',
        html: `
            <div class="text-start border-start border-4 border-danger ps-3">
                <p class="mb-1"><b>Matrícula:</b> ${al.matricula}</p>
                <p class="mb-1"><b>Estudiante:</b> ${al.nombre} ${al.apepat} ${al.apemat}</p>
                <p class="mb-1"><b>Especialidad:</b> ${al.especialidad}</p>
                <p class="mb-1"><b>Grado/Gpo:</b> ${al.grado}° "${al.grupo}"</p>
                <p class="mb-0"><b>Último Acceso:</b> ${al.fecha_ultima_asistencia || 'Sin registros'}</p>
            </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#7b1b37'
    });
}


function renderizarGrafica(conteoGrupos, listaDetallada) {
    const ctx = document.getElementById('graficoGruposModulo').getContext('2d');

    if (chartGpo) {
        chartGpo.destroy();
    }

    const labels = Object.keys(conteoGrupos).sort();
    const dataValues = labels.map(label => conteoGrupos[label]);

    chartGpo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Incidencias',
                data: dataValues,
                backgroundColor: '#7b1b37',
                borderRadius: 5,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${context.raw} incidencias registradas`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const grupoSeleccionado = chartGpo.data.labels[index];
                    
                    mostrarDetalleAlumnos(grupoSeleccionado, listaDetallada);
                }
            }
        }
    });
}

async function actualizarGraficaGrupos() {
    const esp = document.getElementById('selectFiltroModulo').value;
    if (!esp) return;

    try {
        const configDoc = await db.collection("configuracion").doc("ciclo_escolar").get();
        const cicloActivo = configDoc.exists ? configDoc.data().actual : "";

        const snapAlumnos = await db.collection("alumnos")
                                    .where("especialidad", "==", esp)
                                    .where("estatus_escolar", "==", "Activo")
                                    .get();
        
        const infoAlumnos = {};
        snapAlumnos.forEach(doc => { infoAlumnos[doc.id] = doc.data().nombre; });

        const snapIncidencias = await db.collection("incidencias")
                                      .where("especialidad", "==", esp)
                                      .where("ciclo", "==", cicloActivo) 
                                      .get();
        
        const conteoGrupos = {};
        const listaDetallada = [];

        snapIncidencias.forEach(doc => {
            const data = doc.data();
            const nombreAlumno = infoAlumnos[data.id_alumno];

            if (nombreAlumno) { 
                const grupoLlave = `${data.grado}${data.grupo}`;
                conteoGrupos[grupoLlave] = (conteoGrupos[grupoLlave] || 0) + 1;
                
                const motivoPrincipal = data.faltas_checklist && data.faltas_checklist.length > 0 
                                        ? data.faltas_checklist[0] : "Sin especificar";

                listaDetallada.push({
                    nombre: nombreAlumno, grado: data.grado, grupo: data.grupo,
                    motivo: motivoPrincipal, grupoLlave: grupoLlave,
					
						id_alumno: data.id_alumno,
					    folio_incidencia: data.folio_incidencia,
					    fecha_registro: data.fecha_registro,
					    faltas_checklist: data.faltas_checklist,
					    descripcion_detallada: data.descripcion_detallada
                });
            }
        });

        const totalEl = document.getElementById('totalEvidenciasModulo');
        if (totalEl) totalEl.innerText = Object.values(conteoGrupos).reduce((a, b) => a + b, 0);

        renderizarGrafica(conteoGrupos, listaDetallada);

    } catch (error) {
        console.error("Error al cargar gráfica:", error);
    }
}

function mostrarDetalleAlumnos(grupo, lista) {
    const filtrados = lista.filter(item => item.grupoLlave === grupo);
    
    let html = filtrados.map(al => {
        try {

            const folio = al.folio_incidencia || "S/F";

            let fechaTxt = "Sin fecha";
            if (al.fecha_registro) {

                const d = al.fecha_registro.seconds ? new Date(al.fecha_registro.seconds * 1000) : new Date(al.fecha_registro);
                fechaTxt = d.toLocaleDateString('es-MX') + " " + d.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'});
            }

            let motivos = "";
            if (al.faltas_checklist && Array.isArray(al.faltas_checklist)) {
                motivos = al.faltas_checklist.join(", ");
            } else {
                motivos = al.descripcion_detallada || "Sin descripción";
            }

            const nombreMostrar = al.nombre || `Estudiante (${al.id_alumno})`;

            return `
                <li class="list-group-item py-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <div class="fw-bold text-uppercase" style="color: #7b1b37; font-size: 1.1rem;">
                                ${nombreMostrar}
                            </div>
                            <small class="text-muted">
                                <i class="bi bi-tag-fill me-1"></i>Folio: ${folio}
                            </small>
                        </div>
                        <span class="badge bg-primary rounded-pill">${al.grado}° "${al.grupo}"</span>
                    </div>

                    <div class="p-2 bg-light rounded border-start border-3 border-danger mb-2">
                        <small class="fw-bold d-block mb-1">Motivos reportados:</small>
                        <span class="small text-dark">• ${motivos}</span>
                    </div>

                    <div class="d-flex justify-content-between text-muted" style="font-size: 0.8rem;">
                        <span><i class="bi bi-person-vcard me-1"></i>Matrícula: <b>${al.id_alumno}</b></span>
                        <span><i class="bi bi-clock me-1"></i>${fechaTxt}</span>
                    </div>
                </li>
            `;
        } catch (err) {
            return `<li class="list-group-item text-danger">Error al procesar registro: ${al.id_alumno}</li>`;
        }
    }).join('');

    Swal.fire({
        title: `<div class="pb-2 border-bottom">Reporte de Incidencias<br><small class="text-muted" style="font-size: 0.9rem">Grupo: ${grupo}</small></div>`,
        html: `
            <div class="mt-3" style="max-height: 450px; overflow-y: auto;">
                <ul class="list-group list-group-flush text-start">
                    ${html || '<li class="list-group-item text-center">No hay registros</li>'}
                </ul>
            </div>`,
        width: '600px',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#7b1b37'
    });
}

// =========================================================
// MÓDULO DE EXPORTACIÓN A EXCEL
// =========================================================

/**
 * REPORTE 1: ASISTENCIAS MENSUALES
 */
async function generarExcelAsistencias() {
    const mes = document.getElementById('mesReporteAsistencia').value;
    if (!mes) return Swal.fire("Aviso", "Selecciona un mes para el reporte", "info");

    Swal.fire({ title: 'Generando Libro de Especialidades...', didOpen: () => Swal.showLoading() });

    try {
        const snapshot = await db.collection("registros_diarios")
                                 .where("fecha", ">=", `${mes}-01`)
                                 .where("fecha", "<=", `${mes}-31`)
                                 .get();

        if (snapshot.empty) {
            return Swal.fire("Sin datos", "No hay asistencias registradas en este periodo.", "warning");
        }

        const registros = snapshot.docs.map(doc => doc.data());
        
        const wb = XLSX.utils.book_new();

        const especialidades = [...new Set(registros.map(r => r.especialidad))];

        especialidades.forEach(esp => {
            const datosFiltrados = registros.filter(r => r.especialidad === esp).map(d => ({
                "FECHA": d.fecha,
                "MATRICULA": d.matricula,
                "ESTUDIANTE": d.nombre,
                "GPO": `${d.grado}${d.grupo}`,
                "ENTRADA": d.hora_entrada,
                "SALIDA": d.hora_salida || "---",
                "TIPO SALIDA": d.tipo_salida || "N/A"
            }));

            const ws = XLSX.utils.json_to_sheet(datosFiltrados);
            XLSX.utils.book_append_sheet(wb, ws, esp.substring(0, 31));
        });

        XLSX.writeFile(wb, `Reporte_Asistencias_CBTis134_${mes}.xlsx`);
        Swal.fire("Éxito", "Reporte generado por especialidades.", "success");

    } catch (e) { 
        console.error("Error Excel:", e);
        Swal.fire("Error", "Ocurrió un problema al procesar los datos.", "error"); 
    }
}

/**
 * REPORTE 2: ESTADÍSTICAS POR MÓDULOS
 */
async function generarExcelModulos() {
    const especialidad = document.getElementById('selectFiltroModulo').value;
    if (!especialidad) return Swal.fire("Aviso", "Selecciona una especialidad primero", "info");
    
    Swal.fire({ title: 'Generando evidencias...', html: 'Construyendo reporte en Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {

        const configDoc = await db.collection("configuracion").doc("ciclo_escolar").get();
        const cicloActivo = configDoc.exists ? configDoc.data().actual : "";

        const snapIncidencias = await db.collection("incidencias")
                             .where("especialidad", "==", especialidad)
                             .where("ciclo", "==", cicloActivo)
                             .get();

        if (snapIncidencias.empty) return Swal.fire("Sin datos", `No hay evidencias para ${especialidad} en el ciclo ${cicloActivo}.`, "info");

        const snapAlumnos = await db.collection("alumnos")
                                    .where("especialidad", "==", especialidad)
                                    .get();
        
        const infoAlumnos = {};
        snapAlumnos.forEach(doc => { 
            const d = doc.data();
            infoAlumnos[doc.id] = `${d.nombre} ${d.apepat} ${d.apemat || ''}`.trim().toUpperCase(); 
        });

        let dataExcel = [];

        snapIncidencias.docs.forEach(doc => {
            const d = doc.data();

            let fechaLegible = "S/F";
            if (d.fecha_registro) {
                if (typeof d.fecha_registro.toDate === 'function') {
                    fechaLegible = d.fecha_registro.toDate().toLocaleDateString('es-MX', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                } else if (typeof d.fecha_registro === 'string') {
                    fechaLegible = d.fecha_registro; 
                }
            }

            const nombreCompleto = infoAlumnos[d.id_alumno] || "ALUMNO NO ENCONTRADO";

            dataExcel.push({
                "FOLIO DE INCIDENCIA": d.folio_incidencia || doc.id,
                "FECHA DE REGISTRO": fechaLegible,
                "CICLO ESCOLAR": d.ciclo || "N/A",
                "MATRÍCULA": d.id_alumno,
                "NOMBRE DEL ALUMNO": nombreCompleto,
                "GRADO Y GRUPO": `${d.grado}° "${d.grupo}"`,
                "FALTAS AL REGLAMENTO (CHECKLIST)": d.faltas_checklist && Array.isArray(d.faltas_checklist) ? d.faltas_checklist.join(" | ") : "Sin especificar",
                "DESCRIPCIÓN / OBSERVACIONES": d.descripcion_detallada || "N/A"
            });
        });

        const ws = XLSX.utils.json_to_sheet(dataExcel);

        ws['!cols'] = [
            { wch: 35 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 35 },
            { wch: 15 },
            { wch: 50 },
            { wch: 40 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Historial_Incidencias");

        XLSX.writeFile(wb, `Reporte_Incidencias_${especialidad}_${cicloActivo}.xlsx`.replace(/ /g, "_"));
        Swal.close();

    } catch (e) { 
        console.error("Error al generar Excel:", e);
        Swal.fire("Error Crítico", "Fallo al generar el archivo Excel: " + e.message, "error"); 
    }
}