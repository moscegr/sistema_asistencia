/**
 * Panel de Configuración - CBTis 134 (MongoDB & REST API)
 */

document.addEventListener('DOMContentLoaded', async () => {
    cargarCicloEscolar();
    cargarDatosInstitucionales();
    cargarEspecialidades();
    cargarConfigWhatsApp();
});

async function cargarCicloEscolar() {
    try {
        const res = await fetch('/api/configuracion/ciclo_escolar');
        if (res.ok) {
            const data = await res.json();
            const lbl = document.getElementById('labelCicloActual');
            if (lbl) lbl.innerText = data.actual || "FEB-JUL 2026";
        }
    } catch (e) {
        console.error(e);
        const lbl = document.getElementById('labelCicloActual');
        if (lbl) lbl.innerText = "FEB-JUL 2026";
    }
}

async function cargarDatosInstitucionales() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('confDirector').value = data.nombre_director || "";
            document.getElementById('confOrientacion').value = data.responsable_orientacion || "";
            document.getElementById('confCCT').value = data.cct_escuela || "";
            document.getElementById('confTelefono').value = data.telefono_escuela || "";
            document.getElementById('confVigencia').value = data.vigencia_actual || "";
        }
    } catch (e) { console.error(e); }
}

const formInst = document.getElementById('formInstitucional');
if (formInst) {
    formInst.addEventListener('submit', async (e) => {
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
            await fetch('/api/configuracion/sistema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actualizaciones)
            });
            Swal.fire("Éxito", "Datos de la institución actualizados.", "success");
        } catch (error) {
            Swal.fire("Error", "No se pudieron guardar los datos.", "error");
        }
    });
}

async function cargarEspecialidades() {
    try {
        const res = await fetch('/api/configuracion/escolar');
        if (!res.ok) return;
        const data = await res.json();
        let lista = data.especialidades || [];

        // Descubrir y sincronizar especialidades existentes en alumnos que falten en la lista
        try {
            const resAlumnos = await fetch('/api/alumnos');
            if (resAlumnos.ok) {
                const alumnos = await resAlumnos.json();
                let actualizados = false;
                alumnos.forEach(al => {
                    if (al.especialidad && !lista.some(esp => esp.nombre === al.especialidad)) {
                        lista.push({
                            nombre: al.especialidad,
                            alias: al.especialidad.substring(0, 5).toUpperCase(),
                            color: "#0088cc",
                            turno: al.turno || "Matutino"
                        });
                        actualizados = true;
                    }
                });
                if (actualizados) {
                    await fetch('/api/configuracion/escolar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ especialidades: lista })
                    });
                }
            }
        } catch(e) {}

        const tbody = document.getElementById('tablaEspecialidades');
        if (!tbody) return;
        tbody.innerHTML = "";

        lista.forEach((esp, idx) => {
            tbody.innerHTML += `
                <tr>
                    <td><span class="badge p-2" style="background-color: ${esp.color || '#7b1b37'}">&nbsp;&nbsp;</span></td>
                    <td class="fw-bold">${esp.nombre}</td>
                    <td><code>${esp.alias || esp.nombre.substring(0, 5)}</code></td>
                    <td>${esp.turno || 'Matutino'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarEspecialidad(${idx})">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error(e); }
}

const formEsp = document.getElementById('formEspecialidad');
if (formEsp) {
    formEsp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('confNombre').value.trim().toUpperCase();
        const alias = document.getElementById('confAlias').value.trim().toUpperCase();
        const color = document.getElementById('confColor').value;
        const turno = document.getElementById('confTurno').value;

        try {
            const res = await fetch('/api/configuracion/escolar');
            let data = res.ok ? await res.json() : { especialidades: [] };
            let lista = data.especialidades || [];
            lista.push({ nombre, alias, color, turno });

            await fetch('/api/configuracion/escolar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ especialidades: lista })
            });

            Swal.fire("Éxito", "Carrera agregada correctamente", "success");
            formEsp.reset();
            cargarEspecialidades();
        } catch (e) { console.error(e); }
    });
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
        try {
            const res = await fetch('/api/configuracion/escolar');
            if (res.ok) {
                let data = await res.json();
                let lista = data.especialidades || [];
                lista.splice(index, 1);
                await fetch('/api/configuracion/escolar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ especialidades: lista })
                });
                cargarEspecialidades();
            }
        } catch (e) { console.error(e); }
    }
}

// --- FUNCIONES DE WHATSAPP API ---
function cambiarFormularioWs(tipo) {
    const lbl1 = document.getElementById('lblWsCampo1');
    const desc1 = document.getElementById('descWsCampo1');
    const lbl2 = document.getElementById('lblWsCampo2');
    const lbl3 = document.getElementById('lblWsCampo3');
    const cont3 = document.getElementById('contenedorCampo3');

    if (!lbl1 || !lbl2 || !cont3) return;

    if (tipo === 'EVOLUTION') {
        lbl1.innerText = "API Host / Server URL";
        desc1.innerText = "Ej: https://evolution.cegr.cloud o http://localhost:8080";
        lbl2.innerText = "Global / Instance API Key";
        lbl3.innerText = "Instance Name";
        document.getElementById('wsCampo1').placeholder = "Ej. https://evolution.cegr.cloud";
        document.getElementById('wsCampo2').placeholder = "Ej. 4296403A61694158...";
        document.getElementById('wsCampo3').placeholder = "Ej. cbtis134";
        cont3.style.display = "block";
    }
    else if (tipo === 'WPPCONNECT') {
        lbl1.innerText = "WPPConnect Server URL";
        desc1.innerText = "Ej: http://localhost:21465";
        lbl2.innerText = "Secret Key / Token";
        lbl3.innerText = "Session Name";
        document.getElementById('wsCampo1').placeholder = "Ej. http://localhost:21465";
        document.getElementById('wsCampo2').placeholder = "Ej. THISISMYSECURETOKEN";
        document.getElementById('wsCampo3').placeholder = "Ej. cbtis134";
        cont3.style.display = "block";
    }
    else if (tipo === 'META') {
        lbl1.innerText = "Permanent Access Token";
        desc1.innerText = "Token generado en la consola de Meta Developers.";
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
        document.getElementById('wsCampo3').placeholder = "Ej. cbtis134";
        cont3.style.display = "block";
    }
}

async function cargarConfigWhatsApp() {
    const badge = document.getElementById('badgeWsStatus');
    const tipoSelect = document.getElementById('tipoApiWs');
    if (!badge || !tipoSelect) return;

    try {
        const res = await fetch('/api/configuracion/whatsapp');
        if (res.ok) {
            const data = await res.json();
            const tipo = data.tipo_api || 'EVOLUTION';
            tipoSelect.value = tipo;
            cambiarFormularioWs(tipo);

            if (tipo === 'EVOLUTION' || tipo === 'WPPCONNECT') {
                document.getElementById('wsCampo1').value = data.apiUrl || data.serverUrl || '';
                document.getElementById('wsCampo2').value = data.apiKey || data.token || '';
                document.getElementById('wsCampo3').value = data.instanceName || data.sessionName || '';
            } else if (tipo === 'META') {
                document.getElementById('wsCampo1').value = data.accessToken || '';
                document.getElementById('wsCampo2').value = data.phoneNumberId || '';
            } else if (tipo === 'ULTRAMSG') {
                document.getElementById('wsCampo1').value = data.token || '';
                document.getElementById('wsCampo2').value = data.instanceId || '';
            } else if (tipo === 'TWILIO') {
                document.getElementById('wsCampo1').value = data.authToken || '';
                document.getElementById('wsCampo2').value = data.accountSid || '';
                document.getElementById('wsCampo3').value = data.twilioNumber || '';
            } else if (tipo === 'OPENWA') {
                document.getElementById('wsCampo1').value = data.apiUrl || '';
                document.getElementById('wsCampo2').value = data.token || '';
                document.getElementById('wsCampo3').value = data.sessionId || '';
            }

            badge.className = "badge bg-success-subtle text-success rounded-pill px-3 py-2 me-3";
            badge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Estado: Configurado';
        } else {
            badge.className = "badge bg-secondary-subtle text-secondary rounded-pill px-3 py-2 me-3";
            badge.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Estado: Sin configurar';
            cambiarFormularioWs('EVOLUTION');
        }
    } catch (error) {
        console.error("Error al cargar WhatsApp:", error);
        badge.className = "badge bg-danger-subtle text-danger rounded-pill px-3 py-2 me-3";
        badge.innerHTML = '<i class="bi bi-wifi-off me-1"></i> Error de conexión';
    }
}

async function guardarConfigWhatsApp() {
    const tipo = document.getElementById('tipoApiWs').value;
    const campo1 = document.getElementById('wsCampo1').value.trim();
    const campo2 = document.getElementById('wsCampo2').value.trim();
    const campo3 = document.getElementById('wsCampo3').value.trim();

    if (!campo1 || !campo2) {
        Swal.fire("Campos incompletos", "Por favor llena los campos requeridos para este proveedor.", "warning");
        return;
    }

    try {
        Swal.fire({ title: 'Guardando configuración...', didOpen: () => Swal.showLoading() });

        let configData = {
            tipo_api: tipo,
            apiUrl: campo1,
            serverUrl: campo1,
            apiKey: campo2,
            token: campo2,
            instanceName: campo3,
            sessionName: campo3,
            instanceId: campo2,
            accessToken: campo1,
            phoneNumberId: campo2
        };

        await fetch('/api/configuracion/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });

        await cargarConfigWhatsApp();

        Swal.fire({
            title: "¡Configuración Guardada!",
            text: `La API de ${tipo} ha sido configurada correctamente en MongoDB.`,
            icon: "success",
            confirmButtonColor: '#198754'
        });
    } catch (error) {
        console.error("Error al guardar API WhatsApp:", error);
        Swal.fire("Error", "No se pudo actualizar la configuración.", "error");
    }
}