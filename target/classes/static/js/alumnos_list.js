// static/js/alumnos_list.js

// Al cargar la página, activamos los buscadores
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargamos las especialidades del panel de configuración primero
    await cargarFiltrosDinamicos();
    
    // 2. Luego cargamos la tabla
    cargarAlumnos();
    
    // Listeners de búsqueda
    document.getElementById('btnBuscar').addEventListener('click', cargarAlumnos);
	const ids = ['busquedaGeneral', 'filtroEspecialidad', 'filtroGrado', 'filtroGrupo', 'filtroTurno', 'filtroEstatus'];
	    ids.forEach(id => {
	        const el = document.getElementById(id);
	        if(el) el.addEventListener('input', cargarAlumnos);
	    });
});

async function cargarFiltrosDinamicos() {
    try {
        const doc = await db.collection("configuracion").doc("escolar").get();
        if (doc.exists && doc.data().especialidades) {
            const select = document.getElementById('filtroEspecialidad');
            select.innerHTML = '<option value="">Todas las Especialidades</option>';
            doc.data().especialidades.forEach(esp => {
                const opt = document.createElement('option');
                opt.value = esp.nombre;
                opt.textContent = esp.nombre;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error("Error cargando filtros:", e); }
}

function cargarAlumnos() {
    db.collection("alumnos").orderBy("fecharegistro", "desc").onSnapshot((querySnapshot) => {
        const tablaBody = document.getElementById('tablaAlumnosBody');
        if (!tablaBody) return;
        
        tablaBody.innerHTML = "";
        
        const busqueda = document.getElementById('busquedaGeneral').value.toLowerCase();
        const fEsp = document.getElementById('filtroEspecialidad').value;
        const fGrado = document.getElementById('filtroGrado').value;
        const fGrupo = document.getElementById('filtroGrupo').value.toUpperCase();
        const fTurno = document.getElementById('filtroTurno').value;
        const fEstatus = document.getElementById('filtroEstatus') ? document.getElementById('filtroEstatus').value : "Activo";

        let filtrados = [];

        querySnapshot.forEach((doc) => {
            const al = doc.data();
            
            const nombreCompleto = `${al.nombre} ${al.apepat} ${al.apemat}`.toLowerCase();
            if (busqueda && !nombreCompleto.includes(busqueda) && !al.matricula.includes(busqueda)) return;
            
            if (fEsp && al.especialidad !== fEsp) return;
            if (fGrado && String(al.grado) !== fGrado) return;
            if (fGrupo && al.grupo !== fGrupo) return; 
            if (fTurno && al.turno !== fTurno) return;
            if (fEstatus && al.estatus_escolar !== fEstatus) return;

            filtrados.push({ id: doc.id, ...al });
        });

        const limitados = filtrados.slice(0, 30);

        limitados.forEach(al => {
            renderizarFila(tablaBody, al, al.id);
        });

        if (filtrados.length > 30) {
            tablaBody.innerHTML += `
                <tr>
                    <td colspan="6" class="text-center text-muted small py-3">
                        Mostrando 30 de ${filtrados.length} resultados. Usa los filtros o el buscador para encontrar un alumno específico.
                    </td>
                </tr>`;
        }
    }, (error) => {
        console.error("Error en Snapshot:", error);
    });
}

function renderizarFila(contenedor, al, docId) {
    let faltantes = [];
    
    if (!al.curp || al.curp.trim() === "" || al.curp === "N/A") faltantes.push("CURP");
    if (!al.email || al.email.trim() === "") faltantes.push("Correo");
    if (!al.celular || al.celular.trim() === "") faltantes.push("Celular");
    if (!al.direccion || al.direccion.trim() === "" || al.direccion === "N/A") faltantes.push("Dirección");
    
    if (!al.nombretutor || al.nombretutor.trim() === "" || al.nombretutor === "PENDIENTE") faltantes.push("Nombre de Tutor");
    if (!al.teltutor || al.teltutor.trim() === "" || al.teltutor === "N/A") faltantes.push("Tel. Tutor");
    if (!al.ocupaciontutor || al.ocupaciontutor.trim() === "" || al.ocupaciontutor === "N/A") faltantes.push("Ocupación Tutor");

    let alertaBiometria = "";
    if (!al.descriptor_facial || al.descriptor_facial.length !== 128) {
        alertaBiometria = `<i class="bi bi-person-bounding-box text-warning ms-1" style="cursor: help;" title="Falta captura biométrica (Rostro)"></i>`;
    }

    const alertaPerfil = (faltantes.length > 0) 
        ? `<i class="bi bi-exclamation-triangle-fill text-warning ms-1" style="cursor: help;" title="Faltan datos de perfil: ${faltantes.join(', ')}"></i>` 
        : "";

    contenedor.innerHTML += `
        <tr>
            <td class="fw-bold" style="color: #7b1b37;">${al.matricula}</td>
            <td>
                <div class="fw-bold text-uppercase">${al.nombre} ${al.apepat} ${al.apemat} ${alertaPerfil} ${alertaBiometria}</div>
                <small class="text-muted">${al.curp || 'SIN CURP'} | <b class="text-dark">${al.genero || 'N/A'}</b></small>
            </td>
            <td><span class="badge bg-light text-dark border">${al.especialidad}</span></td>
            <td>
                ${al.grado}° "${al.grupo}"
                <br><small class="text-muted">${al.turno}</small>
            </td>
            <td>
                <span class="badge rounded-pill" style="background-color: ${getColorSemaforo(al.color_semaforo)}">
                    ${al.color_semaforo}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="verQR('${al.matricula}')" title="Ver QR">
                        <i class="bi bi-qr-code"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editarAlumno('${al.matricula}')" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarAlumno('${docId}', '${al.matricula}')" title="Baja">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

async function obtenerDataURLQR(texto, size = 400) {
    return new Promise((resolve) => {
        const divTemp = document.createElement('div');
        new QRCode(divTemp, {
            text: texto,
            width: size,
            height: size,
            correctLevel: QRCode.CorrectLevel.M
        });

        setTimeout(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            const imgQR = divTemp.querySelector('img');
            const imgTigre = new Image();
            imgTigre.src = '/img/tigres.png';

            imgTigre.onload = () => {
                ctx.drawImage(imgQR, 0, 0, size, size);
                const logoSize = size * 0.22;
                const pos = (size - logoSize) / 2;
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(pos - 5, pos - 5, logoSize + 10, logoSize + 10);
                ctx.drawImage(imgTigre, pos, pos, logoSize, logoSize);
                resolve(canvas.toDataURL("image/png"));
            };
            imgTigre.onerror = () => resolve(imgQR.src);
        }, 150);
    });
}

let alumnoSeleccionado = null;

// --- 1. VISUALIZAR EL QR EN EL MODAL ---
function verQR(matricula) {
    db.collection("alumnos").doc(matricula).get().then((doc) => {
        if (doc.exists) {
            alumnoSeleccionado = doc.data();
            
            const matTxt = document.getElementById('matriculaQR');
            if (matTxt) matTxt.innerText = matricula;

            const contenedorQR = document.getElementById('imgQR');
            if (contenedorQR && alumnoSeleccionado.qr_texto) {
                contenedorQR.innerHTML = "";
                
                new QRCode(contenedorQR, {
                    text: alumnoSeleccionado.qr_texto,
                    width: 200,
                    height: 200,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.M 
                });
            }

            const modalEl = document.getElementById('modalQR');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        }
    }).catch(err => console.error("Error al abrir ficha de alumno:", err));
}


// --- 2. DESCARGA DEL QR COMPUESTO (CON TIGRE, NOMBRE Y MARCO) ---
async function descargarQRCompuesto(matricula) {
    if (!alumnoSeleccionado || alumnoSeleccionado.matricula !== matricula) {
        Swal.fire("Error", "Carga primero la ficha del alumno.", "error");
        return;
    }

    Swal.fire({ title: 'Generando Gafete...', didOpen: () => Swal.showLoading() });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const anchoCanvas = 400;
    const altoCanvas = 550;
    canvas.width = anchoCanvas;
    canvas.height = altoCanvas;

    // 1. Fondo y Marco Punteado
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, anchoCanvas, altoCanvas);
    ctx.strokeStyle = "#888888";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, anchoCanvas - 4, altoCanvas - 4);
    ctx.setLineDash([]);

    // 2. Cargar el Logo
    const imgTigre = new Image();
    imgTigre.src = '/img/tigres.png';
    
    imgTigre.onload = function() {
        
        // 3. Texto Superior (Nombre del alumno)
        const nombreDisplay = `${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apepat}`;
        ctx.fillStyle = "#000000";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(nombreDisplay.toUpperCase(), anchoCanvas / 2, 80);

        // 4. Generar QR Temporal
        const divTemporal = document.createElement('div');
        new QRCode(divTemporal, {
            text: alumnoSeleccionado.qr_texto,
            width: 250,
            height: 250,
            correctLevel: QRCode.CorrectLevel.M
        });

        setTimeout(() => {
            const imgQrGenerado = divTemporal.querySelector('img');
            
            if (imgQrGenerado && imgQrGenerado.src) {
                const finalQR = new Image();
                finalQR.src = imgQrGenerado.src;
                
                finalQR.onload = function() {
                    // 5. Dibujar el QR centrado
                    const qrSize = 250;
                    const xQR = (anchoCanvas - qrSize) / 2;
                    const yQR = 120; // Lo subimos un poco para balancear
                    ctx.drawImage(finalQR, xQR, yQR, qrSize, qrSize);

                    // 6. DIBUJAR AL TIGRE EN EL CENTRO DEL QR
                    const sizeTigre = 60;
                    const xCentroTigre = xQR + (qrSize / 2) - (sizeTigre / 2);
                    const yCentroTigre = yQR + (qrSize / 2) - (sizeTigre / 2);

                    // Cuadro blanco de fondo para que el tigre resalte sobre los puntos negros
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(xCentroTigre - 5, yCentroTigre - 5, sizeTigre + 10, sizeTigre + 10);
                    
                    ctx.drawImage(imgTigre, xCentroTigre, yCentroTigre, sizeTigre, sizeTigre);

                    // 7. Texto Inferior (Matrícula, Especialidad y Aviso)
                    ctx.fillStyle = "#7b1b37";
                    ctx.font = "bold 32px Arial";
                    ctx.fillText(matricula, anchoCanvas / 2, 420);

                    ctx.fillStyle = "#555555";
                    ctx.font = "bold 16px Arial";
                    ctx.fillText(alumnoSeleccionado.especialidad, anchoCanvas / 2, 450);
                    
                    ctx.fillStyle = "#999999";
                    ctx.font = "italic 12px Arial";

                    // 8. Descarga
                    const enlace = document.createElement('a');
                    enlace.download = `Gafete_${matricula}.png`;
                    enlace.href = canvas.toDataURL("image/png");
                    enlace.click();
                    Swal.close();
                };
            } else {
                Swal.fire("Error", "No se pudo renderizar el QR para descarga.", "error");
            }
        }, 150); 
    };

    imgTigre.onerror = function() {
        console.warn("No se encontró tigres.png. Se generará sin logo.");
        Swal.fire("Aviso", "Falta la imagen tigres.png en /img/", "warning");
    };
}

async function generarCredencialPDF() {
    const { jsPDF } = window.jspdf;
    const al = alumnoSeleccionado;
    if (!al) return;

    try {
        Swal.fire({ title: 'Obteniendo datos...', didOpen: () => Swal.showLoading() });

        const configDoc = await db.collection("configuracion").doc("sistema").get();
        const cfg = configDoc.exists ? configDoc.data() : {};

        const director = cfg.nombre_director || "JOSE MARTIN RODEA ZUÑIGA";
        const cct = cfg.cct_escuela || "12DCT0001L";
        const telefono = cfg.telefono_escuela || "01 747 47 2 34 64";
        const vigencia = cfg.vigencia_actual || "Agosto 2026";

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [54, 85.6] });
        const maroon = [123, 27, 55];

        // --- CARA FRONTAL ---
        doc.setFillColor(...maroon);
        doc.rect(0, 0, 54, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("ALUMNO", 27, 5, { align: "center" });

        // Recuadro de foto
        doc.setDrawColor(200);
        doc.rect(14.5, 10, 25, 30); 
        doc.setTextColor(100);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("IMAGEN", 27, 25, { align: "center" });

        // Datos del Alumno
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("Acredita como Alumno (a):", 27, 45, { align: "center" });
        doc.setFontSize(9);
        doc.text(`${al.nombre} ${al.apepat} ${al.apemat}`.toUpperCase(), 27, 50, { align: "center" });

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Carrera: ${al.especialidad}`, 5, 56);
        doc.text(`Grado: ${al.grado}°      Grupo: ${al.grupo}`, 5, 60);
        doc.text(`No. de control: ${al.matricula}`, 5, 64);
        doc.text(`Curp: ${al.curp}`, 5, 68);

        // Pie de página frontal
        doc.setFontSize(8);
        doc.setTextColor(...maroon);
        doc.setFont("helvetica", "bold");
        doc.text("CBTIS 134", 27, 75, { align: "center" });
        doc.setFontSize(6);
        doc.text('"Nicolas Catalan"', 27, 78, { align: "center" });
        doc.text(`C.C.T.: ${cct}`, 27, 81, { align: "center" });

        doc.setFontSize(5);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
		doc.text(`Vigencia ${vigencia}`, 52, 40, { angle: 270 });

        // --- CARA TRASERA ---
        doc.addPage([54, 85.6], 'portrait');
        doc.setFontSize(6);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text("ESTA IDENTIFICACION ES PROPIEDAD DEL CBTIS 134", 27, 10, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text("CARR. NAL. MEX-ACA COL SALUBRIDAD", 27, 13, { align: "center" });
        doc.text("CHILPANCINGO, GRO. C.P.39096", 27, 16, { align: "center" });
        doc.text(`TEL.- ${telefono}`, 27, 19, { align: "center" });

        // QR con Logo
        const qrDataURL = await obtenerDataURLQR(al.qr_texto, 300);
        doc.addImage(qrDataURL, 'PNG', 14.5, 25, 25, 25);

        doc.text("__________________________", 27, 65, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.text("DIRECTOR DEL PLANTEL", 27, 69, { align: "center" });
        doc.text(director.toUpperCase(), 27, 72, { align: "center" });

        doc.setFontSize(5);
        doc.setFont("helvetica", "italic");
        doc.text('"POR QUE PRESTIGIO SE GANA CON ESFUERZO..."', 27, 80, { align: "center" });
        doc.text("SOMOS CBTIS 134", 27, 83, { align: "center" });

        doc.save(`Credencial_${al.matricula}.pdf`);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudo generar la credencial", "error");
    }
}

// 2. Redirigir a Edición
function editarAlumno(matricula) {
    window.location.href = `/admin/alumnos/nuevo?edit=${matricula}`;
}

// 3. Eliminar (Baja Lógica en Firestore)
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
            await db.collection("alumnos").doc(docId).update({
                estatus_escolar: "Baja"
            });
            Swal.fire('Actualizado', 'El estatus se ha cambiado a Baja.', 'success');
        } catch (error) {
            Swal.fire('Error', 'No se pudo procesar la baja: ' + error.message, 'error');
        }
    }
}

// 4. Limpiar Filtros
function limpiarFiltros() {
    ['busquedaGeneral', 'filtroEspecialidad', 'filtroGrado', 'filtroGrupo', 'filtroTurno'].forEach(id => {
        document.getElementById(id).value = "";
    });
    cargarAlumnos();
}

// Reconocer nombres largos del semáforo para asignar color
function getColorSemaforo(color) {
    if (!color) return "#6c757d";
    if (color.includes("Verde")) return "#198754";
    if (color.includes("Amarillo")) return "#ffc107";
    return "#dc3545"; 
}