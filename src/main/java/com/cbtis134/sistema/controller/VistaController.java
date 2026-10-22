package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.config.ImageOptimizer;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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

    /**
     * Control de visualización de la página landing institucional.
     * Por defecto (false): redirige directamente al login para despliegues multi-escuela DGETI.
     * Solo si se define ENABLE_LANDING_PAGE=true se muestra la landing page informativa.
     */
    @Value("${app.landing.enabled:${ENABLE_LANDING_PAGE:${HABILITAR_LANDING_PAGE:false}}}")
    private boolean habilitarLanding;

    private static volatile Map<String, Object> cachedConfigSistema = null;
    private static volatile long cachedConfigSistemaTime = 0;
    private static final long CACHE_TTL_MS = 300_000L; // 5 minutos de caché para evitar consultas redundantes

    public static void invalidarCacheConfig() {
        cachedConfigSistema = null;
        cachedConfigSistemaTime = 0;
    }

    @ModelAttribute("configSistema")
    public Map<String, Object> cargarConfiguracionGlobal() {
        if (cachedConfigSistema != null && (System.currentTimeMillis() - cachedConfigSistemaTime) < CACHE_TTL_MS) {
            return new HashMap<>(cachedConfigSistema);
        }

        if (mongoTemplate != null) {
            try {
                Document doc = mongoTemplate.findById("sistema", Document.class, "configuracion");
                if (doc != null) {
                    boolean modificado = false;
                    String logoP = doc.getString("logo_plantel_url");
                    if (ImageOptimizer.requiereOptimizacion(logoP)) {
                        doc.put("logo_plantel_url", ImageOptimizer.optimizarLogo(logoP));
                        modificado = true;
                    }
                    String logoI = doc.getString("logo_inicio_url");
                    if (ImageOptimizer.requiereOptimizacion(logoI)) {
                        doc.put("logo_inicio_url", ImageOptimizer.optimizarLogo(logoI));
                        modificado = true;
                    }
                    if (modificado) {
                        try {
                            mongoTemplate.save(doc, "configuracion");
                        } catch (Exception ignored) {}
                    }
                    Map<String, Object> resultado = new HashMap<>(doc);
                    cachedConfigSistema = resultado;
                    cachedConfigSistemaTime = System.currentTimeMillis();
                    return resultado;
                }
            } catch (Exception ignored) {}
        }
        Map<String, Object> fallback = new HashMap<>();
        String nomPlantelEnv = System.getenv("PLANTEL_NOMBRE_CORTO");
        String nomOficialEnv = System.getenv("PLANTEL_NOMBRE_OFICIAL");
        String sloganEnv = System.getenv("PLANTEL_SLOGAN");
        String logoPlantelEnv = System.getenv("PLANTEL_LOGO_URL");
        String logoInicioEnv = System.getenv("PLANTEL_MASCOTA_URL");
        String cctEnv = System.getenv("PLANTEL_CCT");
        String telEnv = System.getenv("PLANTEL_TELEFONO");
        String direccionEnv = System.getenv("PLANTEL_DIRECCION");
        String ciudadEnv = System.getenv("PLANTEL_CIUDAD");

        fallback.put("nombre_plantel", nomPlantelEnv != null && !nomPlantelEnv.isBlank() ? nomPlantelEnv : "Control Escolar");
        fallback.put("nombre_oficial_plantel", nomOficialEnv != null && !nomOficialEnv.isBlank() ? nomOficialEnv : "Centro de Bachillerato Tecnológico Industrial y de Servicios");
        fallback.put("slogan_plantel", sloganEnv != null ? sloganEnv : "");
        fallback.put("logo_plantel_url", logoPlantelEnv != null && !logoPlantelEnv.isBlank() ? logoPlantelEnv : "/img/logo_aniversario.jpg");
        fallback.put("logo_inicio_url", logoInicioEnv != null && !logoInicioEnv.isBlank() ? logoInicioEnv : "/img/tigres.png");
        fallback.put("telefono_escuela", telEnv != null ? telEnv : "");
        fallback.put("cct_escuela", cctEnv != null ? cctEnv : "");
        fallback.put("direccion_plantel", direccionEnv != null && !direccionEnv.isBlank() ? direccionEnv : "");
        fallback.put("ciudad_plantel", ciudadEnv != null && !ciudadEnv.isBlank() ? ciudadEnv : "");
        return fallback;
    }

    @GetMapping({"/", "/index", "/landing"})
    public String index(org.springframework.security.core.Authentication auth, Model model) {
        if (!habilitarLanding) {
            return "redirect:/login";
        }
        boolean estaAutenticado = (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken));
        model.addAttribute("autenticado", estaAutenticado);
        return "landing";
    }

    @GetMapping("/login")
    public String login(HttpServletRequest request, org.springframework.security.core.Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
            boolean isGuardia = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().contains("GUARDIA"));
            if (isGuardia) {
                return "redirect:/admin/escaneo";
            }
            return "redirect:/admin/dashboard";
        }
        try {
            request.getSession(true);
        } catch (Exception ignored) {}
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
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null) {
                new SecurityContextLogoutHandler().logout(request, response, auth);
            }
            jakarta.servlet.http.HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
        } catch (Exception ignored) {}
        SecurityContextHolder.clearContext();
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
