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
            const input = document.getElementById('inputCicloEscolarConfig') || document.getElementById('selectCicloEscolarConfig');
            if (input && data.actual) input.value = data.actual;
        }
    } catch (e) {
        console.error(e);
    }
}

async function guardarCicloEscolarConfig() {
    const input = document.getElementById('inputCicloEscolarConfig') || document.getElementById('selectCicloEscolarConfig');
    if (!input) return;
    const nuevoCiclo = input.value.trim();
    if (!nuevoCiclo) {
        return Swal.fire("Atención", "Por favor ingresa un nombre para el ciclo escolar.", "warning");
    }

    try {
        Swal.fire({ title: 'Guardando ciclo escolar...', didOpen: () => Swal.showLoading() });
        const res = await fetch('/api/configuracion/ciclo_escolar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _id: 'ciclo_escolar', actual: nuevoCiclo })
        });
        if (res.ok) {
            Swal.fire("Éxito", `Ciclo escolar activo actualizado a "${nuevoCiclo}"`, "success");
            const labelHeader = document.getElementById('displayCicloActual');
            if (labelHeader) labelHeader.innerText = nuevoCiclo;
        } else {
            throw new Error("No se pudo guardar");
        }
    } catch(e) {
        Swal.fire("Error", "Error al actualizar ciclo escolar.", "error");
    }
}
window.guardarCicloEscolarConfig = guardarCicloEscolarConfig;

function previewLogoPlantel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const imgPrev = document.getElementById('imgPreviewLogoPlantel');
        if (imgPrev) imgPrev.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
window.previewLogoPlantel = previewLogoPlantel;

async function cargarDatosInstitucionales() {
    try {
        const res = await fetch('/api/configuracion/sistema');
        if (res.ok) {
            const data = await res.json();
            if (document.getElementById('confDirector')) document.getElementById('confDirector').value = data.nombre_director || "JOSE MARTIN RODEA ZUÑIGA";
            if (document.getElementById('confOrientacion')) document.getElementById('confOrientacion').value = data.responsable_orientacion || "MATILDE ABIGAIL GARCIA NAJERA";
            if (document.getElementById('confCCT')) document.getElementById('confCCT').value = data.cct_escuela || "12DCT0001L";
            if (document.getElementById('confTelefono')) document.getElementById('confTelefono').value = data.telefono_escuela || "747 47 2 34 64";
            if (document.getElementById('confVigencia')) document.getElementById('confVigencia').value = data.vigencia_actual || "Agosto 2026";
            if (document.getElementById('switchNotifWhatsapp')) document.getElementById('switchNotifWhatsapp').checked = (data.notificaciones_whatsapp_activas !== false);
            if (document.getElementById('imgPreviewLogoPlantel') && data.logo_plantel_url) {
                document.getElementById('imgPreviewLogoPlantel').src = data.logo_plantel_url;
            }
        }
    } catch (e) { console.error("Error al cargar datos institucionales:", e); }
}

const formInst = document.getElementById('formInstitucional');
if (formInst) {
    formInst.addEventListener('submit', async (e) => {
        e.preventDefault();
        Swal.fire({ title: 'Guardando configuración...', didOpen: () => Swal.showLoading() });

        const actualizaciones = {
            nombre_director: document.getElementById('confDirector').value.trim().toUpperCase(),
            responsable_orientacion: document.getElementById('confOrientacion').value.trim().toUpperCase(),
            cct_escuela: document.getElementById('confCCT').value.trim().toUpperCase(),
            telefono_escuela: document.getElementById('confTelefono').value.trim(),
            vigencia_actual: document.getElementById('confVigencia').value.trim(),
            notificaciones_whatsapp_activas: document.getElementById('switchNotifWhatsapp') ? document.getElementById('switchNotifWhatsapp').checked : true
        };

        const imgPreview = document.getElementById('imgPreviewLogoPlantel');
        if (imgPreview && imgPreview.src && imgPreview.src.startsWith('data:image')) {
            actualizaciones.logo_plantel_url = imgPreview.src;
        }

        try {
            await fetch('/api/configuracion/sistema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actualizaciones)
            });
            Swal.fire("Éxito", "Datos institucionales y logotipo guardados correctamente en MongoDB.", "success");
            
            if (actualizaciones.logo_plantel_url) {
                document.querySelectorAll('.img-logo-plantel, #logoPlantelHeader, #sidebarLogo').forEach(img => {
                    if (img.tagName === 'IMG') img.src = actualizaciones.logo_plantel_url;
                });
            }
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
                            color: "#7b1b37",
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

            if (document.getElementById('switchNotifWhatsapp')) {
                document.getElementById('switchNotifWhatsapp').checked = (data.notificaciones_whatsapp_activas !== false);
            }
            if (document.getElementById('plantillaEntradaWs')) {
                document.getElementById('plantillaEntradaWs').value = data.plantilla_entrada || '🏫 [CBTis 134] Notificación:\nEl estudiante {nombre} ha registrado su ENTRADA al plantel a las {hora}.';
            }
            if (document.getElementById('plantillaSalidaWs')) {
                document.getElementById('plantillaSalidaWs').value = data.plantilla_salida || '🏫 [CBTis 134] Notificación:\nEl estudiante {nombre} ha registrado su SALIDA del plantel a las {hora}.';
            }

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

const switchWsToggle = document.getElementById('switchNotifWhatsapp');
if (switchWsToggle) {
    switchWsToggle.addEventListener('change', async () => {
        const isChecked = switchWsToggle.checked;
        try {
            await fetch('/api/configuracion/sistema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificaciones_whatsapp_activas: isChecked })
            });
            await fetch('/api/configuracion/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificaciones_whatsapp_activas: isChecked })
            });
            const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });
            toast.fire({ icon: isChecked ? 'success' : 'warning', title: `Notificaciones de WhatsApp ${isChecked ? 'ACTIVADAS' : 'DESACTIVADAS'}` });
        } catch(e) { console.error("Error al actualizar switch de WhatsApp:", e); }
    });
}

async function guardarConfigWhatsApp() {
    const tipo = document.getElementById('tipoApiWs').value;
    const campo1 = document.getElementById('wsCampo1').value.trim();
    const campo2 = document.getElementById('wsCampo2').value.trim();
    const campo3 = document.getElementById('wsCampo3').value.trim();
    const switchWs = document.getElementById('switchNotifWhatsapp');
    const isActivo = switchWs ? switchWs.checked : true;

    const plantillaEntrada = document.getElementById('plantillaEntradaWs') ? document.getElementById('plantillaEntradaWs').value.trim() : '';
    const plantillaSalida = document.getElementById('plantillaSalidaWs') ? document.getElementById('plantillaSalidaWs').value.trim() : '';

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
            phoneNumberId: campo2,
            notificaciones_whatsapp_activas: isActivo,
            plantilla_entrada: plantillaEntrada,
            plantilla_salida: plantillaSalida
        };

        await fetch('/api/configuracion/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });

        await fetch('/api/configuracion/sistema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificaciones_whatsapp_activas: isActivo })
        });

        await cargarConfigWhatsApp();

        Swal.fire({
            title: "¡Configuración Guardada!",
            text: `La API de ${tipo} ha sido configurada correctamente en MongoDB. Notificaciones: ${isActivo ? 'ACTIVAS' : 'DESACTIVAS'}.`,
            icon: "success",
            confirmButtonColor: '#198754'
        });
    } catch (error) {
        console.error("Error al guardar API WhatsApp:", error);
        Swal.fire("Error", "No se pudo actualizar la configuración.", "error");
    }
}

async function probarEnvioWhatsApp() {
    const tipo = document.getElementById('tipoApiWs')?.value || 'EVOLUTION';
    const campo1 = document.getElementById('wsCampo1')?.value.trim() || '';
    const campo2 = document.getElementById('wsCampo2')?.value.trim() || '';
    const campo3 = document.getElementById('wsCampo3')?.value.trim() || '';

    if (!campo1 || !campo2) {
        Swal.fire("Campos incompletos", "Llena la URL y la API Key para realizar la prueba de envío.", "warning");
        return;
    }

    const { value: telPrueba } = await Swal.fire({
        title: 'Prueba de Envío de WhatsApp',
        text: 'Ingresa un número telefónico de 10 dígitos para enviar un mensaje de prueba:',
        input: 'text',
        inputPlaceholder: 'Ej: 7470000000',
        showCancelButton: true,
        confirmButtonText: 'Enviar Mensaje de Prueba',
        confirmButtonColor: '#198754',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value || value.replace(/[^0-9]/g, '').length < 10) {
                return 'Por favor ingresa un número válido de 10 dígitos';
            }
        }
    });

    if (!telPrueba) return;

    Swal.fire({ title: 'Enviando mensaje de prueba...', didOpen: () => Swal.showLoading() });

    try {
        const tipoEndpoint = tipo.toLowerCase();
        const res = await fetch(`/api/whatsapp/${tipoEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiUrl: campo1,
                apiKey: campo2,
                token: campo2,
                instanceName: campo3,
                to: telPrueba,
                body: "🧪 [CBTis 134] Mensaje de prueba de conexión con la API de WhatsApp."
            })
        });

        const resText = await res.text();

        if (res.ok) {
            Swal.fire({
                title: "¡Mensaje Enviado con Éxito!",
                html: `<p class="text-success fw-bold mb-2"><i class="bi bi-check-circle-fill me-1"></i> La API de WhatsApp respondió correctamente (HTTP ${res.status}).</p><div class="p-3 bg-light border rounded text-start small"><i class="bi bi-info-circle me-1 text-primary"></i> El mensaje de prueba se entregó exitosamente a la cola de salida de la API de WhatsApp.</div>`,
                icon: "success"
            });
        } else {
            Swal.fire({
                title: `Error en la API (HTTP ${res.status})`,
                html: `<p class="text-danger fw-bold mb-1">Respuesta del servidor:</p><pre class="text-start bg-light p-2 border rounded x-small" style="max-height:180px; overflow:auto;">${resText}</pre>`,
                icon: "error"
            });
        }
    } catch(e) {
        Swal.fire("Error de Conexión", e.message, "error");
    }
}
window.probarEnvioWhatsApp = probarEnvioWhatsApp;

async function depurarAlumnosInactivos() {
    const { isConfirmed } = await Swal.fire({
        title: '¿Depurar Alumnos Inactivos / Egresados?',
        html: `
            <p class="small text-muted mb-2">Esta acción buscará y <b>eliminará permanentemente</b> de la base de datos a todos los alumnos que tengan estatus <code>Baja</code>, <code>Egresado</code> o <code>Inactivo</code>.</p>
            <div class="alert alert-danger py-2 px-3 text-start small mb-0">
                <i class="bi bi-exclamation-triangle-fill me-1"></i> <b>Atención:</b> Los alumnos activos no se verán afectados. Esta operación no se puede deshacer.
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="bi bi-trash3-fill me-1"></i> Sí, depurar registros',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Depurando base de datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await fetch('/api/alumnos/depurar-inactivos', { method: 'DELETE' });
            if (!res.ok) throw new Error("Error HTTP " + res.status);
            const data = await res.json();

            await Swal.fire({
                icon: 'success',
                title: 'Depuración Completada',
                text: data.mensaje || `Se eliminaron ${data.eliminados || 0} alumnos inactivos/egresados.`,
                confirmButtonColor: '#7b1b37'
            });
        } catch(e) {
            Swal.fire("Error", "No se pudo completar la depuración: " + e.message, "error");
        }
    }
}
window.depurarAlumnosInactivos = depurarAlumnosInactivos;

async function revertirCicloEscolar() {
    const { isConfirmed } = await Swal.fire({
        title: '¿Revertir Ciclo y Deshacer Promoción?',
        html: `
            <p class="small text-muted mb-2">Esta acción <b>deshace el último cambio de ciclo</b>:</p>
            <ul class="text-start small text-dark mb-3">
                <li>Regresa a los alumnos activos a su grado anterior (ej. 3° &rarr; 2°, 2° &rarr; 1°).</li>
                <li>Restaura a los alumnos con estatus <code>Egresado</code> de vuelta a <b>6° Semestre Activo</b>.</li>
                <li>Restaura el nombre del ciclo escolar previo en la configuración general.</li>
            </ul>
            <div class="alert alert-warning py-2 px-3 text-start small mb-0">
                <i class="bi bi-arrow-counterclockwise me-1"></i> Úsalo si aplicaste una promoción por error.
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ffc107',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="bi bi-arrow-counterclockwise me-1"></i> Sí, deshacer cambios',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Revirtiendo ciclo escolar...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await fetch('/api/configuracion/revertir-ciclo', { method: 'POST' });
            if (!res.ok) throw new Error("Error HTTP " + res.status);
            const data = await res.json();

            await Swal.fire({
                icon: 'success',
                title: 'Ciclo Restaurado',
                text: data.mensaje || `Ciclo revertido a "${data.ciclo_restaurado}".`,
                confirmButtonColor: '#7b1b37'
            });
            location.reload();
        } catch(e) {
            Swal.fire("Error", "No se pudo revertir el ciclo: " + e.message, "error");
        }
    }
}
window.revertirCicloEscolar = revertirCicloEscolar;

async function descargarRespaldoZipTotal() {
    Swal.fire({ title: 'Generando Respaldo Total...', text: 'Empaquetando Base de Datos completa + Carpeta Multimedia en un archivo ZIP...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const a = document.createElement('a');
        a.href = '/api/configuracion/backup/zip-completo';
        a.download = `Respaldo_TOTAL_CBTis134_${new Date().toLocaleDateString('en-CA')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
            Swal.fire({
                icon: 'success',
                title: '¡Respaldo Total Descargado!',
                html: `
                    <div class="text-start small p-2 bg-light border rounded">
                        <p class="mb-1 text-success fw-bold"><i class="bi bi-file-earmark-zip-fill me-1"></i>Paquete ZIP Completo.</p>
                        <hr class="my-1">
                        <ul class="mb-0 ps-3 x-small text-muted">
                            <li><b>base_de_datos_cbtis134.json:</b> Todas las colecciones de MongoDB</li>
                            <li><b>multimedia/:</b> Fotografías, evidencias y archivos subidos</li>
                            <li><b>LEEME_RESPALDO.txt:</b> Instrucciones del respaldo</li>
                        </ul>
                    </div>
                `,
                confirmButtonColor: '#7b1b37'
            });
        }, 1500);
    } catch(e) {
        Swal.fire("Error", "No se pudo descargar el paquete total: " + e.message, "error");
    }
}
window.descargarRespaldoZipTotal = descargarRespaldoZipTotal;

async function abrirModalImportarRespaldo() {
    const { value: fileData } = await Swal.fire({
        title: 'Importar / Migrar Respaldo',
        html: `
            <p class="small text-muted mb-3">Selecciona el archivo <b>.ZIP</b> (Respaldo Total con Base de Datos y Multimedia) o <b>.JSON</b> para restaurar el sistema en este servidor.</p>
            <div class="mb-3 text-start">
                <label class="form-label small fw-bold">Archivo de Respaldo (.zip o .json):</label>
                <input type="file" id="swalInputRespaldoFile" class="form-control" accept=".zip,.json">
            </div>
            <div class="form-check text-start p-2 bg-light border rounded">
                <input class="form-check-input ms-0 me-2" type="checkbox" id="swalCheckLimpiarAntes">
                <label class="form-check-label small fw-bold text-danger" for="swalCheckLimpiarAntes">
                    Reemplazar datos existentes (Limpiar colecciones antes de importar)
                </label>
                <div class="x-small text-muted ps-4">Si no se marca, los registros se fusionarán/actualizarán por ID sin borrar los no coincidentes.</div>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Iniciar Importación',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const input = document.getElementById('swalInputRespaldoFile');
            const limpiar = document.getElementById('swalCheckLimpiarAntes').checked;
            if (!input || !input.files || input.files.length === 0) {
                Swal.showValidationMessage('Por favor selecciona un archivo .zip o .json');
                return false;
            }
            return { file: input.files[0], limpiar };
        }
    });

    if (fileData && fileData.file) {
        Swal.fire({
            title: 'Restaurando Respaldo...',
            html: '<p class="small text-muted">Procesando colecciones de MongoDB y extrayendo archivos multimedia...</p><div class="spinner-border text-guinda my-2"></div>',
            allowOutsideClick: false,
            showConfirmButton: false
        });

        try {
            const formData = new FormData();
            formData.append('archivo', fileData.file);
            formData.append('limpiarAntes', fileData.limpiar);

            const res = await fetch('/api/configuracion/restore', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Error HTTP ${res.status}`);
            }

            const data = await res.json();
            const cols = Object.entries(data.colecciones || {}).map(([k, v]) => `<li><b>${k}:</b> ${v} documentos</li>`).join('');

            await Swal.fire({
                icon: 'success',
                title: '¡Migración y Restauración Exitosa!',
                html: `
                    <div class="text-start small p-3 bg-light border rounded">
                        <p class="mb-2 text-success fw-bold"><i class="bi bi-check-circle-fill me-1"></i> ${data.mensaje}</p>
                        <hr class="my-1">
                        <ul class="mb-2 ps-3 x-small">
                            <li><b>Total Documentos Restaurados:</b> ${data.total_documentos || 0}</li>
                            <li><b>Archivos Multimedia Extraídos:</b> ${data.archivos_multimedia || 0}</li>
                        </ul>
                        ${cols ? `<div class="x-small text-muted"><b>Detalle por colección:</b><ul class="mb-0 ps-3">${cols}</ul></div>` : ''}
                    </div>
                `,
                confirmButtonColor: '#7b1b37'
            });

            location.reload();

        } catch(e) {
            Swal.fire("Error en Restauración", e.message, "error");
        }
    }
}
window.abrirModalImportarRespaldo = abrirModalImportarRespaldo;

async function limpiarTodosLosPases() {
    const { isConfirmed } = await Swal.fire({
        title: '¿Purgar TODOS los pases de salida?',
        text: 'Esta acción eliminará permanentemente de MongoDB todos los pases de salida (grupales e individuales).',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar pases'
    });

    if (isConfirmed) {
        try {
            Swal.fire({ title: 'Eliminando pases...', didOpen: () => Swal.showLoading() });
            await fetch('/api/pases/limpiar-todos', { method: 'DELETE' });
            Swal.fire("Éxito", "Todos los pases de salida han sido borrados de la base de datos.", "success");
        } catch (e) {
            Swal.fire("Error", "No se pudieron borrar los pases: " + e.message, "error");
        }
    }
}
window.limpiarTodosLosPases = limpiarTodosLosPases;