package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;

import java.util.HashMap;
import java.util.Map;

@Controller
public class VistaController {

    @Autowired(required = false)
    private MongoTemplate mongoTemplate;

    @ModelAttribute("configSistema")
    public Map<String, Object> cargarConfiguracionGlobal() {
        if (mongoTemplate != null) {
            try {
                Document doc = mongoTemplate.findById("sistema", Document.class, "configuracion");
                if (doc != null) {
                    return doc;
                }
            } catch (Exception ignored) {}
        }
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("nombre_plantel", "CBTis 134");
        fallback.put("nombre_oficial_plantel", "Centro de Bachillerato Tecnológico industrial y de servicios No. 134 \"Nicolás Catalán\"");
        fallback.put("slogan_plantel", "\"Por que prestigio se gana con esfuerzo... Somos CBTis 134\"");
        fallback.put("logo_plantel_url", "/img/logo_aniversario.jpg");
        fallback.put("logo_inicio_url", "/img/tigres.png");
        fallback.put("telefono_escuela", "(747) 47 2 34 64");
        fallback.put("cct_escuela", "12DCT0001L");
        return fallback;
    }

    @GetMapping({"/", "/index", "/landing"})
    public String index(org.springframework.security.core.Authentication auth, Model model) {
        boolean estaAutenticado = (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken));
        model.addAttribute("autenticado", estaAutenticado);
        return "landing";
    }

    @GetMapping("/login")
    public String login(org.springframework.security.core.Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
            boolean isGuardia = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().contains("GUARDIA"));
            if (isGuardia) {
                return "redirect:/admin/escaneo";
            }
            return "redirect:/admin/dashboard";
        }
        return "auth/login";
    }

    @GetMapping({"/admin", "/admin/"})
    public String redireccionarAdmin(Authentication auth) {
        if (auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("GUARDIA"))) {
            return "redirect:/admin/escaneo";
        }
        return "redirect:/admin/dashboard";
    }

    @GetMapping({"/admin/dashboard", "/dashboard"})
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

    @GetMapping({"/admin/escaneo", "/escaneo"})
    public String mostrarEscaneo() {
        return "admin/escaneo";
    }

    @GetMapping("/logout")
    public String cerrarSesionManual(HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            new SecurityContextLogoutHandler().logout(request, response, auth);
        }
        return "redirect:/login?logout";
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