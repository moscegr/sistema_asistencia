// static/js/nav_tigre.js

// 1. Lógica de Redirección
function redirigirAlInicio() {
    const rol = localStorage.getItem('userRole'); 
    const rutas = {
        'admin': '/admin/dashboard',
        'prefecto': '/admin/dashboard',
        'orientacion': '/admin/dashboard',
        'guardia': '/admin/escaneo'
    };

    if (rol && rutas[rol.toLowerCase()]) {
        window.location.href = rutas[rol.toLowerCase()];
    } else {
        window.location.href = '/login';
    }
}

// 2. Cerrar Sesión (Spring Security /logout)
function confirmarCerrarSesion() {
    const nomPlantel = (window.cfgSistemaGlobal && window.cfgSistemaGlobal.nombre_plantel) 
        ? window.cfgSistemaGlobal.nombre_plantel 
        : 'el sistema';
    Swal.fire({
        title: '¿Cerrar Sesión?',
        text: `¿Estás seguro de que deseas salir de ${nomPlantel}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#7b1b37',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie = "AuthToken=; path=/; max-age=0; SameSite=Lax";
            window.location.href = "/logout";
        }
    });
}

// 3. EL TOGGLE MAESTRO CON BACKDROP MÓVIL
function asegurarBackdrop() {
    let backdrop = document.getElementById("sidebar-backdrop");
    if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.id = "sidebar-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", function() {
            cerrarSidebarMovil();
        });
    }
    return backdrop;
}

function abrirSidebarMovil() {
    const wrapper = document.getElementById("wrapper");
    const backdrop = asegurarBackdrop();
    if (wrapper) wrapper.classList.add("toggled");
    if (backdrop && window.innerWidth <= 991) backdrop.classList.add("show");
}

function cerrarSidebarMovil() {
    const wrapper = document.getElementById("wrapper");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (wrapper) wrapper.classList.remove("toggled");
    if (backdrop) backdrop.classList.remove("show");
}

document.addEventListener("click", function(e) {
    const toggleBtn = e.target.closest("#menu-toggle");
    if (toggleBtn) {
        e.preventDefault();
        const wrapper = document.getElementById("wrapper");
        const backdrop = asegurarBackdrop();
        if (wrapper) {
            const isToggled = wrapper.classList.toggle("toggled");
            if (window.innerWidth <= 991) {
                if (isToggled) backdrop.classList.add("show");
                else backdrop.classList.remove("show");
            }
        }
        return;
    }
    
    // Si hace click en un enlace del sidebar en móvil, cerrar sidebar
    const sbLink = e.target.closest("#sidebar-wrapper a.sb-item, #sidebar-wrapper a.sb-sub");
    if (sbLink && window.innerWidth <= 991) {
        cerrarSidebarMovil();
        return;
    }

    if (window.innerWidth <= 991 && !e.target.closest("#sidebar-wrapper") && !toggleBtn) {
        cerrarSidebarMovil();
    }
});

window.addEventListener("resize", function() {
    if (window.innerWidth > 991) {
        const backdrop = document.getElementById("sidebar-backdrop");
        if (backdrop) backdrop.classList.remove("show");
    }
});

// 4. NAVEGACIÓN INTELIGENTE (Marcar enlace activo automáticamente)
document.addEventListener("DOMContentLoaded", function() {
    asegurarBackdrop();
    const currentPath = window.location.pathname;

    document.querySelectorAll('.sb-item, .sb-sub').forEach(el => {
        el.classList.remove('active');
    });

    const activeLink = document.querySelector(`.sb-body a[href="${currentPath}"]`);

    if (activeLink) {
        activeLink.classList.add('active');
        const parentCollapse = activeLink.closest('.collapse');
        
        if (parentCollapse) {
            parentCollapse.classList.add('show');
            const toggleBtn = document.querySelector(`[aria-controls="${parentCollapse.id}"]`);
            if (toggleBtn) {
                toggleBtn.setAttribute('aria-expanded', 'true');
                toggleBtn.classList.add('active');
            }
        }
    }
});

// 5. EDITAR MI PERFIL (ADMINISTRATIVOS)
async function abrirModalMiPerfil() {
    let modalEl = document.getElementById('modalMiPerfilGenerico');
    if (!modalEl) {
        const div = document.createElement('div');
        div.innerHTML = `
        <div class="modal fade" id="modalMiPerfilGenerico" tabindex="-1" aria-hidden="true" style="z-index: 1080 !important;">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 15px;">
                    <div class="modal-header bg-guinda text-white">
                        <h5 class="modal-title fw-bold">
                            <i class="bi bi-person-gear me-2"></i>Mi Perfil - Editar Mis Datos
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="formMiPerfil">
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-dark">Nombre Completo</label>
                                <input type="text" id="miPerfilNombre" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-dark">Correo Institucional</label>
                                <input type="email" id="miPerfilCorreo" class="form-control no-uppercase" style="text-transform: none !important;" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-bold text-dark">Nueva Contraseña (Opcional)</label>
                                <div class="input-group">
                                    <input type="password" id="miPerfilPassword" class="form-control no-uppercase" placeholder="Dejar en blanco para conservar actual" style="text-transform: none !important;" autocomplete="new-password">
                                    <button class="btn btn-outline-secondary" type="button" onclick="const p=document.getElementById('miPerfilPassword'); p.type=p.type==='password'?'text':'password';">
                                        <i class="bi bi-eye"></i>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-guinda px-4" onclick="guardarDatosMiPerfil()">
                            <i class="bi bi-check-circle me-2"></i>Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        modalEl = document.getElementById('modalMiPerfilGenerico');
    }

    const currentEmail = localStorage.getItem('userEmail') || localStorage.getItem('userEmailAuth') || '';
    const currentName = localStorage.getItem('userName') || 'Administrador';

    document.getElementById('miPerfilNombre').value = currentName;
    document.getElementById('miPerfilCorreo').value = currentEmail;
    document.getElementById('miPerfilPassword').value = '';

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

async function guardarDatosMiPerfil() {
    const nombre = document.getElementById('miPerfilNombre').value.trim().toUpperCase();
    const correo = document.getElementById('miPerfilCorreo').value.trim().toLowerCase();
    const password = document.getElementById('miPerfilPassword').value;

    if (!nombre || !correo) {
        return Swal.fire("Campos incompletos", "El nombre y el correo son obligatorios.", "warning");
    }

    const currentEmail = localStorage.getItem('userEmail') || localStorage.getItem('userEmailAuth') || correo;

    try {
        Swal.fire({ title: 'Actualizando perfil...', didOpen: () => Swal.showLoading() });

        const payload = { nombre, correo };
        if (password && password.trim() !== '') {
            payload.password = password;
        }

        const res = await fetch(`/api/usuarios/${encodeURIComponent(currentEmail)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("No se pudieron guardar los cambios de perfil.");

        localStorage.setItem('userName', nombre);
        localStorage.setItem('userEmail', correo);

        const elUserName = document.getElementById('userName');
        const elBannerName = document.getElementById('userBannerName');
        if (elUserName) elUserName.innerText = nombre;
        if (elBannerName) elBannerName.innerText = nombre;

        const modalEl = document.getElementById('modalMiPerfilGenerico');
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();

        Swal.fire({
            icon: 'success',
            title: '¡Perfil Actualizado!',
            text: 'Tus datos administrativos se actualizaron correctamente.',
            toast: true,
            position: 'bottom-end',
            timer: 3500,
            showConfirmButton: false
        });

    } catch (e) {
        Swal.fire("Error", e.message, "error");
    }
}
window.abrirModalMiPerfil = abrirModalMiPerfil;
window.guardarDatosMiPerfil = guardarDatosMiPerfil;