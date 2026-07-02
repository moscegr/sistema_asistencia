/**
 * Gestión Dinámica de Especialidades - CBTis 134
 */

let modalEdicion;

document.addEventListener('DOMContentLoaded', cargarDatosInstitucionales);
document.addEventListener('DOMContentLoaded', inicializarVistaCiclo);
document.addEventListener('DOMContentLoaded', () => {

    modalEdicion = new bootstrap.Modal(document.getElementById('modalEditarEsp'));
    
	cargarConfigWhatsApp();
    cargarEspecialidades();
    
    document.getElementById('formEspecialidad').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('confNombre').value.toUpperCase().trim();
        const alias = document.getElementById('confAlias').value.toUpperCase().trim();
        const color = document.getElementById('confColor').value;
		const turno = document.getElementById('confTurno').value;

        if (validarAlias(alias)) {
            await agregarEspecialidad(nombre, alias, color, turno);
            e.target.reset();
        }
    });

    // Listener para Editar Especialidad
    document.getElementById('formEditarEsp').addEventListener('submit', async (e) => {
        e.preventDefault();
        const index = document.getElementById('editIndex').value;
        const nombre = document.getElementById('editNombre').value.toUpperCase().trim();
        const alias = document.getElementById('editAlias').value.toUpperCase().trim();
        const color = document.getElementById('editColor').value;
		const turno = document.getElementById('editTurno').value;

        if (validarAlias(alias)) {
            await actualizarEspecialidad(index, nombre, alias, color, turno);
        }
    });
});

function inicializarVistaCiclo() {
    db.collection("configuracion").doc("ciclo_escolar").onSnapshot(doc => {
        if (doc.exists) {
            const ciclo = doc.data().actual;
            // Intenta actualizar en Configuración
            const displayLabel = document.getElementById('labelCicloActual');
            if (displayLabel) displayLabel.innerText = ciclo;
        }
    });
}

// VALIDACIONES
function validarAlias(alias) {
    const regex = /^[A-Z0-9]{2,5}$/;
    if (!regex.test(alias)) {
        Swal.fire("Alias Inválido", "El alias debe tener entre 2 y 5 caracteres y no incluir espacios.", "error");
        return false;
    }
    return true;
}

async function cargarEspecialidades() {
    db.collection("configuracion").doc("escolar").onSnapshot((doc) => {
        const tbody = document.getElementById('tablaEspecialidades');
        tbody.innerHTML = "";

        if (doc.exists && doc.data().especialidades) {
            const lista = doc.data().especialidades;
            lista.forEach((esp, index) => {
                tbody.innerHTML += `
                    <tr>
                        <td><div style="width:25px; height:25px; border-radius:5px; background:${esp.color}"></div></td>
                        <td class="fw-bold">${esp.nombre}</td>
                        <td><span class="badge bg-dark">${esp.alias}</span></td>
						<td>${esp.turno || 'N/A'}</td> <td class="text-center">
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="prepararEdicion(${index})">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="eliminarEspecialidad(${index})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
            });
        }
    });
}

async function prepararEdicion(index) {
    const doc = await db.collection("configuracion").doc("escolar").get();
    const esp = doc.data().especialidades[index];
    
    document.getElementById('editIndex').value = index;
    document.getElementById('editNombre').value = esp.nombre;
    document.getElementById('editAlias').value = esp.alias;
    document.getElementById('editColor').value = esp.color;
    document.getElementById('editTurno').value = esp.turno || 'Matutino';
    
    modalEdicion.show();
}

async function actualizarEspecialidad(index, nombre, alias, color, turno) {
    try {
        const docRef = db.collection("configuracion").doc("escolar");
        const doc = await docRef.get();
        let lista = doc.data().especialidades;

        if (lista.some((e, i) => e.alias === alias && i != index)) {
            return Swal.fire("Aviso", "Este alias ya está en uso por otra carrera", "warning");
        }

        lista[index] = { nombre, alias, color, turno };
        await docRef.update({ especialidades: lista });
        
        modalEdicion.hide();
        Swal.fire("Actualizado", "Especialidad modificada correctamente", "success");
    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}

async function agregarEspecialidad(nombre, alias, color, turno) {
    try {
        const docRef = db.collection("configuracion").doc("escolar");
        const doc = await docRef.get();
        let lista = doc.exists && doc.data().especialidades ? doc.data().especialidades : [];

        if (lista.some(e => e.alias === alias)) {
            return Swal.fire("Aviso", "Este alias ya está registrado", "warning");
        }

        lista.push({ nombre, alias, color, turno });
        await docRef.set({ especialidades: lista }, { merge: true });
        Swal.fire("Éxito", "Carrera agregada correctamente", "success");
    } catch (e) {
        console.error(e);
    }
}

async function eliminarEspecialidad(index) {
    const result = await Swal.fire({
        title: '¿Eliminar carrera?',
        text: "Esto puede afectar la carga de alumnos de este ciclo.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37'
    });

    if (result.isConfirmed) {
        const docRef = db.collection("configuracion").doc("escolar");
        const doc = await docRef.get();
        let lista = doc.data().especialidades;
        lista.splice(index, 1);
        await docRef.update({ especialidades: lista });
    }
}

// --- FUNCIONES DE WHATSAPP ---
function cambiarFormularioWs(tipo) {
    const lbl1 = document.getElementById('lblWsCampo1');
    const desc1 = document.getElementById('descWsCampo1');
    const lbl2 = document.getElementById('lblWsCampo2');
    const lbl3 = document.getElementById('lblWsCampo3'); // Referencia al label 3
    const cont3 = document.getElementById('contenedorCampo3');

    document.getElementById('wsCampo1').value = '';
    document.getElementById('wsCampo2').value = '';
    document.getElementById('wsCampo3').value = '';

    if (tipo === 'META') {
        lbl1.innerText = "Permanent Access Token";
        desc1.innerText = "Token generado en la consola de Meta.";
        lbl2.innerText = "Phone Number ID";
        cont3.style.display = "none";
    } 
    else if (tipo === 'ULTRAMSG') {
        lbl1.innerText = "Instance Token";
        desc1.innerText = "Token de seguridad proporcionado por Ultramsg.";
        lbl2.innerText = "Instance ID";
        cont3.style.display = "none";
    } 
    else if (tipo === 'TWILIO') {
        lbl1.innerText = "Auth Token";
        desc1.innerText = "Token de autenticación secreto.";
        lbl2.innerText = "Account SID";
        lbl3.innerText = "Número Remitente";
        cont3.style.display = "block";
    }
    else if (tipo === 'OPENWA') {
        lbl1.innerText = "URL del Servidor Local";
        desc1.innerText = "Ej: http://localhost:2785";
        lbl2.innerText = "API Token";
        lbl3.innerText = "Session ID / Name";
        document.getElementById('wsCampo3').placeholder = "Ej. cbtis o UUID";
        cont3.style.display = "block";
    }
}

async function cargarConfigWhatsApp() {
    const badge = document.getElementById('badgeWsStatus');
    const tipoSelect = document.getElementById('tipoApiWs');

    try {
        const doc = await db.collection("configuracion").doc("whatsapp").get();
        if (doc.exists) {
            const data = doc.data();

            if(data.tipo_api) {
                tipoSelect.value = data.tipo_api;
                cambiarFormularioWs(data.tipo_api);
            } else {
                cambiarFormularioWs('META');
            }

            if (data.tipo_api === 'META') {
                document.getElementById('wsCampo1').value = data.accessToken || '';
                document.getElementById('wsCampo2').value = data.phoneNumberId || '';
            } else if (data.tipo_api === 'ULTRAMSG') {
                document.getElementById('wsCampo1').value = data.token || '';
                document.getElementById('wsCampo2').value = data.instanceId || '';
            } else if (data.tipo_api === 'TWILIO') {
                document.getElementById('wsCampo1').value = data.authToken || '';
                document.getElementById('wsCampo2').value = data.accountSid || '';
                document.getElementById('wsCampo3').value = data.twilioNumber || '';
            } 

			else if (data.tipo_api === 'OPENWA') {
			    document.getElementById('wsCampo1').value = data.apiUrl || '';
			    document.getElementById('wsCampo2').value = data.token || '';
			    document.getElementById('wsCampo3').value = data.sessionId || '';
			}

            badge.className = "badge bg-success-subtle text-success rounded-pill px-3 py-2 me-3";
            badge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Estado: Configurado';
            
        } else {
            badge.className = "badge bg-secondary-subtle text-secondary rounded-pill px-3 py-2 me-3";
            badge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Estado: Sin configurar';
            cambiarFormularioWs('META');
        }
    } catch (error) {
        console.error("Error al cargar configuración de WhatsApp:", error);
        badge.className = "badge bg-danger-subtle text-danger rounded-pill px-3 py-2 me-3";
        badge.innerHTML = '<i class="bi bi-wifi-off me-1"></i> Error de conexión';
    }
}

async function guardarConfigWhatsApp() {
    const tipo = document.getElementById('tipoApiWs').value;
    const campo1 = document.getElementById('wsCampo1').value.trim();
    const campo2 = document.getElementById('wsCampo2').value.trim();
    const campo3 = document.getElementById('wsCampo3').value.trim();

    if (!campo1 || (tipo !== 'OPENWA' && !campo2) || (tipo === 'TWILIO' && !campo3)) {
        Swal.fire("Campos incompletos", "Por favor llena todos los campos requeridos para este proveedor.", "warning");
        return;
    }

    try {
        Swal.fire({
            title: 'Actualizando API...',
            text: 'Conectando con Firebase.',
            didOpen: () => { Swal.showLoading(); }
        });

        let configData = {
            tipo_api: tipo,
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (tipo === 'META') {
            configData.accessToken = campo1;
            configData.phoneNumberId = campo2;
        } else if (tipo === 'ULTRAMSG') {
            configData.token = campo1;
            configData.instanceId = campo2;
        } else if (tipo === 'TWILIO') {
            configData.authToken = campo1;
            configData.accountSid = campo2;
            configData.twilioNumber = campo3;
        } 

		else if (tipo === 'OPENWA') {
		    configData.apiUrl = campo1;
		    configData.token = campo2;
		    configData.sessionId = campo3;
		}

        await db.collection("configuracion").doc("whatsapp").set(configData);

        await cargarConfigWhatsApp();

        Swal.fire({
            title: "¡Configuración Guardada!",
            text: `La API de ${tipo} ha sido vinculada correctamente al sistema.`,
            icon: "success",
            confirmButtonColor: '#198754'
        });
    } catch (error) {
        console.error("Error al guardar API:", error);
        Swal.fire("Error", "No se pudo actualizar la configuración.", "error");
    }
}

async function cargarDatosInstitucionales() {
    const doc = await db.collection("configuracion").doc("sistema").get();
    if (doc.exists) {
        const data = doc.data();
        document.getElementById('confDirector').value = data.nombre_director || "";
        document.getElementById('confOrientacion').value = data.responsable_orientacion || "";
        document.getElementById('confCCT').value = data.cct_escuela || "";
        document.getElementById('confTelefono').value = data.telefono_escuela || "";
        document.getElementById('confVigencia').value = data.vigencia_actual || "";
    }
}


document.getElementById('formInstitucional').addEventListener('submit', async (e) => {
    e.preventDefault();
    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

    const actualizaciones = {
        nombre_director: document.getElementById('confDirector').value.trim().toUpperCase(),
        responsable_orientacion: document.getElementById('confOrientacion').value.trim().toUpperCase(),
        cct_escuela: document.getElementById('confCCT').value.trim().toUpperCase(),
        telefono_escuela: document.getElementById('confTelefono').value.trim(),
        vigencia_actual: document.getElementById('confVigencia').value.trim()
    };

    try {
        await db.collection("configuracion").doc("sistema").set(actualizaciones, { merge: true });
        Swal.fire("Éxito", "Datos de la institución actualizados.", "success");
    } catch (error) {
        Swal.fire("Error", "No se pudieron guardar los datos.", "error");
    }
});

async function depurarAlumnosInactivos() {
    const { value: confirmacion } = await Swal.fire({
        title: '⚠️ ADVERTENCIA CRÍTICA',
        html: `Esta acción:<br>
               1. Descargará un <b>Súper Excel de respaldo</b> con el expediente completo.<br>
               2. Borrará a los alumnos en <b>Baja/Egresado</b>.<br>
               3. <b>Limpiará en cascada</b> sus incidencias, justificantes, pases y registros diarios.<br><br>
               Escriba <b>CONFIRMAR</b> para proceder:`,
        input: 'text',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Eliminar Registros',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion !== "CONFIRMAR") return Swal.fire("Cancelado", "Palabra de seguridad incorrecta.", "info");

    Swal.fire({ title: 'Procesando...', html: 'Construyendo expediente en Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const snapAlumnos = await db.collection("alumnos").where("estatus_escolar", "in", ["Baja", "Egresado"]).get();
        if (snapAlumnos.empty) return Swal.fire("Todo limpio", "No hay alumnos inactivos para depurar.", "info");

        const datosExcel = snapAlumnos.docs.map(doc => {
            const d = doc.data();
            
            let padecimientosTexto = "Ninguno";
            if (d.padecimientos_registrados && d.padecimientos_registrados.length > 0) {
                padecimientosTexto = d.padecimientos_registrados.map(p => `${p.tipo} (${p.gravedad})`).join(' | ');
            }

            return {
                "Matrícula": d.matricula || "S/N",
                "CURP": d.curp || "N/A",
                "Apellido Paterno": d.apepat || "",
                "Apellido Materno": d.apemat || "",
                "Nombre(s)": d.nombre || "",
                "Género": d.genero || "N/A",
                "Especialidad": d.especialidad || "N/A",
                "Último Grado": d.grado || "N/A",
                "Último Grupo": d.grupo || "N/A",
                "Turno": d.turno || "N/A",
                "Dirección": d.direccion || "N/A",
                "Celular Alumno": d.celular || "N/A",
                "Correo Electrónico": d.email || "N/A",
                "Nombre del Tutor": d.nombretutor || "N/A",
                "Teléfono Tutor": d.teltutor || "N/A",
                "Ocupación Tutor": d.ocupaciontutor || "N/A",
                "Padecimientos Médicos": padecimientosTexto,
                "Última Asistencia": d.fecha_ultima_asistencia || "N/A",
                "Estatus Final": d.estatus_escolar || "Desconocido"
            };
        });

        const hoja = XLSX.utils.json_to_sheet(datosExcel);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Expedientes_Inactivos");
        XLSX.writeFile(libro, `Expedientes_Bajas_${new Date().toISOString().split('T')[0]}.xlsx`);

        Swal.update({ html: 'Excel asegurado.<br>Borrando perfil de alumnos...' });

        const matriculasBorradas = [];
        let operaciones = [];
        let batchActual = db.batch();
        let contOps = 0;

        snapAlumnos.docs.forEach(doc => {
            matriculasBorradas.push(doc.data().matricula);
            batchActual.delete(doc.ref);
            contOps++;
            if (contOps === 450) {
                operaciones.push(batchActual.commit());
                batchActual = db.batch();
                contOps = 0;
            }
        });
        if (contOps > 0) operaciones.push(batchActual.commit());
        await Promise.all(operaciones);

        Swal.update({ html: 'Alumnos borrados.<br>Limpiando historial en cascada (Esto puede tardar un poco)...' });

        const borrarRelacionados = async (nombreCol, campoBusqueda) => {
            let totalBorrados = 0;

            for (let i = 0; i < matriculasBorradas.length; i += 30) {
                const chunk = matriculasBorradas.slice(i, i + 30);
                const snapColeccion = await db.collection(nombreCol).where(campoBusqueda, "in", chunk).get();
                
                let subBatch = db.batch();
                let subCont = 0;
                let subOperaciones = [];

                snapColeccion.docs.forEach(doc => {
                    subBatch.delete(doc.ref);
                    subCont++;
                    totalBorrados++;

                    if (subCont === 450) { 
                        subOperaciones.push(subBatch.commit());
                        subBatch = db.batch();
                        subCont = 0;
                    }
                });
                if (subCont > 0) subOperaciones.push(subBatch.commit());

                if(subOperaciones.length > 0) await Promise.all(subOperaciones); 
            }
            return totalBorrados;
        };

        const eliminadasIncidencias = await borrarRelacionados("incidencias", "id_alumno");
        const eliminadasJustificantes = await borrarRelacionados("justificantes", "id_alumno"); 
        const eliminadasPases = await borrarRelacionados("pases_salida", "matricula");
        const eliminadosRegistros = await borrarRelacionados("registros_diarios", "matricula");

        Swal.fire(
            "¡Mantenimiento Completo!", 
            `<div class="text-start small mt-3">
                <p class="mb-1"><i class="bi bi-person-dash text-danger me-2"></i><b>Alumnos Inactivos:</b> ${snapAlumnos.size}</p>
                <p class="mb-1"><i class="bi bi-exclamation-triangle text-warning me-2"></i><b>Incidencias borradas:</b> ${eliminadasIncidencias}</p>
                <p class="mb-1"><i class="bi bi-file-earmark-medical text-primary me-2"></i><b>Justificantes borrados:</b> ${eliminadasJustificantes}</p>
                <p class="mb-1"><i class="bi bi-door-open text-success me-2"></i><b>Pases borrados:</b> ${eliminadasPases}</p>
                <p class="mb-1"><i class="bi bi-clock-history text-secondary me-2"></i><b>Entradas/Salidas borradas:</b> ${eliminadosRegistros}</p>
            </div>`, 
            "success"
        );

    } catch (error) {
        console.error("Error en depuración total:", error);
        Swal.fire("Error crítico", "Fallo al procesar la limpieza masiva: " + error.message, "error");
    }
}

async function revertirCicloEscolar() {
    try {
        const docRef = db.collection("configuracion").doc("ciclo_escolar");
        const doc = await docRef.get();
        
        if (!doc.exists || !doc.data().ciclo_anterior) {
            return Swal.fire("Operación no disponible", "No existe un registro histórico para revertir el ciclo o ya fue utilizado.", "info");
        }

        const actual = doc.data().actual;
        const anterior = doc.data().ciclo_anterior;

        const { isConfirmed } = await Swal.fire({
            title: '¿Revertir Ciclo y Grados?',
            html: `
                <div class="text-start">
                    <p>Esta acción devolverá el sistema al ciclo <b>${anterior}</b> e impactará a los alumnos:</p>
                    <ul>
                        <li>Los alumnos <b>Activos</b> bajarán un grado.</li>
                        <li>Los <b>Egresados</b> recientes volverán a ser Activos en 6° semestre.</li>
                    </ul>
                    <p class="text-danger small"><b>Advertencia:</b> Solo use esta opción si el cambio de ciclo fue un error. <b>Esta acción solo se puede realizar una vez.</b></p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<span class="text-dark fw-bold">Sí, revertir todo</span>',
            cancelButtonText: 'Cancelar'
        });

        if (isConfirmed) {
            Swal.fire({ title: 'Procesando reversión...', html: 'Ajustando expedientes de alumnos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const snapAlumnos = await db.collection("alumnos")
                .where("estatus_escolar", "in", ["Activo", "Egresado"])
                .get();

            const batch = db.batch();
            let cambiosContador = 0;

            snapAlumnos.forEach(alumnoDoc => {
                const al = alumnoDoc.data();
                let updates = {};

                if (al.estatus_escolar === "Activo") {
                    const gradoNum = parseInt(al.grado);
                    if (gradoNum > 1) {
                        updates.grado = String(gradoNum - 1);
                        cambiosContador++;
                    }
                } 
                else if (al.estatus_escolar === "Egresado" && al.motivo_baja === "Término de estudios") {
                    updates.estatus_escolar = "Activo";
                    updates.grado = "6";
                    updates.motivo_baja = "";
                    cambiosContador++;
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(alumnoDoc.ref, updates);
                }
            });

            batch.update(docRef, {
                actual: anterior,
                ciclo_anterior: firebase.firestore.FieldValue.delete(), 
                ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();

            Swal.fire({
                title: "Restauración Exitosa",
                html: `Se ha regresado al ciclo <b>${anterior}</b>.<br>Se actualizaron <b>${cambiosContador}</b> expedientes de alumnos.`,
                icon: "success"
            }).then(() => location.reload());
        }
    } catch (e) {
        console.error("Error al revertir:", e);
        Swal.fire("Error crítico", "No se pudo completar la reversión: " + e.message, "error");
    }
}