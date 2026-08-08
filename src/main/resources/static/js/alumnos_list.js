// static/js/alumnos_list.js - MongoDB REST API

document.addEventListener('DOMContentLoaded', async () => {
    await cargarFiltrosDinamicos();
    cargarAlumnos();
    
    const btnBuscar = document.getElementById('btnBuscar');
    if (btnBuscar) btnBuscar.addEventListener('click', cargarAlumnos);

    const ids = ['busquedaGeneral', 'filtroEspecialidad', 'filtroGrado', 'filtroGrupo', 'filtroTurno', 'filtroEstatus'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', cargarAlumnos);
    });
});

async function cargarFiltrosDinamicos() {
    const select = document.getElementById('filtroEspecialidad');
    if (!select) return;

    let listaEsp = [];

    try {
        const resConfig = await fetch('/api/configuracion/escolar');
        if (resConfig.ok) {
            const dataConfig = await resConfig.json();
            if (dataConfig.especialidades && dataConfig.especialidades.length > 0) {
                listaEsp = dataConfig.especialidades.map(e => e.nombre);
            }
        }
    } catch(e) {}

    try {
        const resAlumnos = await fetch('/api/alumnos');
        if (resAlumnos.ok) {
            const alumnos = await resAlumnos.json();
            alumnos.forEach(a => {
                if (a.especialidad && !listaEsp.includes(a.especialidad)) {
                    listaEsp.push(a.especialidad);
                }
            });
        }
    } catch(e) {}

    if (listaEsp.length === 0) {
        listaEsp = ["PROGRAMACIÓN", "OFIMÁTICA", "SOPORTE Y MANTENIMIENTO", "CONTABILIDAD", "CONSTRUCCIÓN"];
    }

    listaEsp.sort();

    select.innerHTML = '<option value="">Todas las Especialidades</option>';
    listaEsp.forEach(esp => {
        const opt = document.createElement('option');
        opt.value = esp;
        opt.textContent = esp;
        select.appendChild(opt);
    });
}

async function cargarAlumnos() {
    const tablaBody = document.getElementById('tablaAlumnosBody');
    if (!tablaBody) return;

    try {
        const res = await fetch('/api/alumnos');
        if (!res.ok) return;
        const alumnosData = await res.json();

        tablaBody.innerHTML = "";
        
        const busquedaInput = document.getElementById('busquedaGeneral');
        const busqueda = busquedaInput ? busquedaInput.value.toLowerCase() : "";
        const fEsp = document.getElementById('filtroEspecialidad') ? document.getElementById('filtroEspecialidad').value : "";
        const fGrado = document.getElementById('filtroGrado') ? document.getElementById('filtroGrado').value : "";
        const fGrupo = document.getElementById('filtroGrupo') ? document.getElementById('filtroGrupo').value.toUpperCase() : "";
        const fTurno = document.getElementById('filtroTurno') ? document.getElementById('filtroTurno').value : "";
        const fEstatus = document.getElementById('filtroEstatus') ? document.getElementById('filtroEstatus').value : "Activo";

        let filtrados = [];

        alumnosData.forEach((al) => {
            const mat = al.ncontrol || al.matricula || "";
            const nom = al.nombre || "";
            const pat = al.apepat || al.primerApellido || "";
            const matApe = al.apemat || al.segundoApellido || "";
            const nombreCompleto = `${nom} ${pat} ${matApe}`.toLowerCase();

            if (busqueda && !nombreCompleto.includes(busqueda) && !mat.toLowerCase().includes(busqueda)) return;
            
            if (fEsp && al.especialidad !== fEsp) return;
            if (fGrado && String(al.grado) !== fGrado) return;
            if (fGrupo && al.grupo !== fGrupo) return; 
            if (fTurno && al.turno !== fTurno) return;
            if (fEstatus && (al.estatus_escolar || al.estatus) !== fEstatus) return;

            filtrados.push(al);
        });

        const limitados = filtrados.slice(0, 30);

        limitados.forEach(al => {
            renderizarFila(tablaBody, al, al.id || al.ncontrol);
        });

        if (filtrados.length > 30) {
            tablaBody.innerHTML += `
                <tr>
                    <td colspan="6" class="text-center text-muted small py-3">
                        Mostrando 30 de ${filtrados.length} resultados. Usa los filtros o el buscador para encontrar un alumno específico.
                    </td>
                </tr>`;
        }
    } catch (e) {
        console.error("Error al cargar alumnos:", e);
    }
}

function renderizarFila(contenedor, al, docId) {
    let faltantes = [];
    const mat = al.ncontrol || al.matricula || "N/A";
    const pat = al.apepat || al.primerApellido || "";
    const matApe = al.apemat || al.segundoApellido || "";
    
    if (!al.curp || al.curp.trim() === "" || al.curp === "N/A") faltantes.push("CURP");
    if (!al.email || al.email.trim() === "") faltantes.push("Correo");
    if (!al.celular || al.celular.trim() === "") faltantes.push("Celular");
    if (!al.direccion || al.direccion.trim() === "" || al.direccion === "N/A") faltantes.push("Dirección");
    
    if (!al.nombretutor || al.nombretutor.trim() === "" || al.nombretutor === "PENDIENTE") faltantes.push("Nombre de Tutor");
    if (!al.teltutor || al.teltutor.trim() === "" || al.teltutor === "N/A") faltantes.push("Tel. Tutor");
    if (!al.ocupaciontutor || al.ocupaciontutor.trim() === "" || al.ocupaciontutor === "N/A") faltantes.push("Ocupación Tutor");

    let alertaBiometria = "";
    if ((!al.descriptor_facial || al.descriptor_facial.length !== 128) && (!al.descriptorFacial || al.descriptorFacial.length !== 128)) {
        alertaBiometria = `<i class="bi bi-person-bounding-box text-warning ms-1" style="cursor: help;" title="Falta captura biométrica (Rostro)"></i>`;
    }

    const alertaPerfil = (faltantes.length > 0) 
        ? `<i class="bi bi-exclamation-triangle-fill text-warning ms-1" style="cursor: help;" title="Faltan datos de perfil: ${faltantes.join(', ')}"></i>` 
        : "";

    contenedor.innerHTML += `
        <tr>
            <td class="fw-bold" style="color: #7b1b37;">${mat}</td>
            <td>
                <div class="fw-bold text-uppercase">${al.nombre} ${pat} ${matApe} ${alertaPerfil} ${alertaBiometria}</div>
                <small class="text-muted">${al.curp || 'SIN CURP'} | <b class="text-dark">${al.genero || 'N/A'}</b></small>
            </td>
            <td><span class="badge bg-light text-dark border">${al.especialidad || 'GENERAL'}</span></td>
            <td>
                ${al.grado || '1'}° "${al.grupo || 'A'}"
                <br><small class="text-muted">${al.turno || 'Matutino'}</small>
            </td>
            <td>
                <span class="badge rounded-pill" style="background-color: ${getColorSemaforo(al.color_semaforo)}">
                    ${al.color_semaforo || 'Verde'}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="verQR('${mat}')" title="Ver QR">
                        <i class="bi bi-qr-code"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editarAlumno('${mat}')" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarAlumno('${docId}', '${mat}')" title="Baja">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

let alumnoSeleccionado = null;

async function verQR(matricula) {
    try {
        const res = await fetch(`/api/alumnos/ncontrol/${matricula}`);
        if (res.ok) {
            alumnoSeleccionado = await res.json();
            
            const matTxt = document.getElementById('matriculaQR');
            if (matTxt) matTxt.innerText = matricula;

            const contenedorQR = document.getElementById('imgQR');
            const qrText = (alumnoSeleccionado.qrCode || alumnoSeleccionado.qr_texto || `${matricula}|${alumnoSeleccionado.nombre}`).substring(0, 100);
            if (contenedorQR && qrText) {
                contenedorQR.innerHTML = "";
                
                new QRCode(contenedorQR, {
                    text: qrText,
                    width: 200,
                    height: 200,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.L 
                });
            }

            const modalEl = document.getElementById('modalQR');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        }
    } catch (err) { console.error("Error al abrir ficha de alumno:", err); }
}

function editarAlumno(matricula) {
    window.location.href = `/admin/alumnos/nuevo?edit=${matricula}`;
}

async function eliminarAlumno(docId, matricula) {
    const result = await Swal.fire({
        title: '¿Dar de baja?',
        text: `El alumno con matrícula ${matricula} cambiará su estatus a 'Baja'.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        confirmButtonText: 'Sí, dar de baja',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`/api/alumnos/${docId}`, {
                method: 'DELETE'
            });
            Swal.fire('Actualizado', 'El registro de alumno ha sido removido.', 'success');
            cargarAlumnos();
        } catch (error) {
            Swal.fire('Error', 'No se pudo procesar la baja: ' + error.message, 'error');
        }
    }
}

function limpiarFiltros() {
    ['busquedaGeneral', 'filtroEspecialidad', 'filtroGrado', 'filtroGrupo', 'filtroTurno'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    cargarAlumnos();
}

function getColorSemaforo(color) {
    if (!color) return "#6c757d";
    if (color.includes("Verde")) return "#198754";
    if (color.includes("Amarillo")) return "#ffc107";
    return "#dc3545"; 
}