package com.cbtis134.sistema.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.HashMap;
import java.util.Map;

/**
 * Controlador de errores personalizado para evitar pantallas 200 inesperadas
 * y garantizar que la información institucional del plantel se renderice adecuadamente.
 */
@Controller
public class CustomErrorController implements ErrorController {

    @Autowired(required = false)
    private MongoTemplate mongoTemplate;

    @RequestMapping("/error")
    public String handleError(HttpServletRequest request, HttpServletResponse response, Model model) {
        Object statusObj = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int statusCode = 500;
        if (statusObj != null) {
            try {
                statusCode = Integer.parseInt(statusObj.toString());
            } catch (Exception ignored) {}
        }

        // Si el estado es 200 (error ocurrido con respuesta pre-comiteada o flujo de sesión)
        // o cualquier código exitoso/redirección en /error, redirigir inmediatamente al login
        if (statusCode == 200 || statusCode < 400 || statusCode == 401) {
            return "redirect:/login";
        }

        response.setStatus(statusCode);
        model.addAttribute("status", statusCode);

        // Proveer configSistema para que el header y logos institucionales del plantel se muestren correctamente
        model.addAttribute("configSistema", obtenerConfiguracion());

        return "error";
    }

    private Map<String, Object> obtenerConfiguracion() {
        if (mongoTemplate != null) {
            try {
                Document doc = mongoTemplate.findById("sistema", Document.class, "configuracion");
                if (doc != null) {
                    return doc;
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
}
