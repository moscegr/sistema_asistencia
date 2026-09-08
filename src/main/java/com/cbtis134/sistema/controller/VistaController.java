package com.cbtis134.sistema.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class VistaController {

    @GetMapping({"/", "/index"})
    public String index(org.springframework.security.core.Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
            boolean isGuardia = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().contains("GUARDIA"));
            if (isGuardia) {
                return "redirect:/admin/escaneo";
            }
            return "redirect:/admin/dashboard";
        }
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String login() {
        return "auth/login";
    }

    @GetMapping("/admin/dashboard")
    public String verDashboard() {
        return "admin/dashboard";
    }

    @GetMapping("/admin/alumnos/nuevo")
    public String mostrarFormularioNuevoAlumno() {
        return "admin/nuevo_alumno";
    }

    @GetMapping("/admin/alumnos")
    public String listarAlumnos() {
        return "admin/alumnos";
    }

    @GetMapping("/admin/escaneo")
    public String mostrarEscaneo() {
        return "admin/escaneo";
    }

    @GetMapping("/admin/pases")
    public String mostrarPases() {
        return "admin/pases";
    }

    @GetMapping("/admin/justificantes")
    public String mostrarJustificantes() {
        return "admin/justificantes";
    }

    @GetMapping("/admin/incidencias/prefectura")
    public String incidenciasPrefectura() {
        return "admin/incidencias_prefectura";
    }

    @GetMapping("/admin/incidencias/orientacion")
    public String incidenciasOrientacion() {
        return "admin/incidencias_orientacion";
    }

    @GetMapping("/admin/alumnos/gestion-archivos")
    public String gestionArchivosExcel() {
        return "admin/gestion_excel";
    }

    @GetMapping({"/admin/alumnos/expediente", "/admin/expediente_alumno"})
    public String expedienteAlumno() {
        return "admin/expediente_alumno";
    }

    @GetMapping("/admin/configuracion")
    public String configuracionEscolar() {
        return "admin/configuracion";
    }

    @GetMapping("/admin/usuarios")
    public String vistaUsuarios() {
        return "admin/usuarios";
    }
    
    @GetMapping("/admin/alumnos/seguimiento-conductual")
    public String vistaSeguimientoConductual() {
        return "admin/seguimiento_conductual"; 
    }

    @GetMapping("/admin/alumnos/monitoreo-salud")
    public String vistaMonitoreoSalud() {
        return "admin/monitoreo_salud";
    }
    
    @GetMapping("/admin/alumnos/credenciales")
    public String vistaCredenciales() {
        return "admin/credenciales";
    }
}