package com.cbtis134.sistema.config;

import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class AdminSeeder implements ApplicationRunner {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        System.out.println("=== [SEEDER SEGURA] Verificando usuarios iniciales y configuración del sistema... ===");

        try {
            seederUsuarios();
            seederCalendario();
            seederConfiguracion();

            System.out.println("=== [SEEDER SEGURA] Verificación de sistema completada sin afectar registros existentes. ===");

        } catch (Exception e) {
            System.err.println("=== [SEEDER SEGURA] Error durante la inicialización: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private String obtenerVarEnv(String... nombres) {
        for (String n : nombres) {
            String val = System.getenv(n);
            if (val != null && !val.trim().isEmpty()) {
                String limpio = val.trim();
                if ((limpio.startsWith("\"") && limpio.endsWith("\"")) || (limpio.startsWith("'") && limpio.endsWith("'"))) {
                    if (limpio.length() >= 2) {
                        limpio = limpio.substring(1, limpio.length() - 1).trim();
                    }
                }
                if (!limpio.isEmpty()) return limpio;
            }
        }
        return null;
    }

    private void seederUsuarios() {
        String adminEmail    = obtenerVarEnv("ADMIN_EMAIL", "ADMIN_USER", "ADMIN_MAIL", "APP_ADMIN_EMAIL");
        String adminPassword = obtenerVarEnv("ADMIN_PASSWORD", "ADMIN_PASS", "APP_ADMIN_PASS");

        if (adminEmail == null || adminPassword == null) {
            System.err.println("-> [SEEDER] ⚠️ ADMIN_EMAIL / ADMIN_PASSWORD no configurados en variables de entorno.");
            if (usuarioRepository.count() == 0) {
                System.err.println("-> [SEEDER] ⚠️ LA BASE DE DATOS TIENE 0 USUARIOS. Configura ADMIN_EMAIL y ADMIN_PASSWORD en Coolify para acceder.");
            }
        } else {
            Usuario admin = usuarioRepository.findByCorreoIgnoreCase(adminEmail)
                    .or(() -> usuarioRepository.findByCorreo(adminEmail))
                    .orElse(null);

            if (admin == null) {
                admin = new Usuario();
                admin.setUid(UUID.randomUUID().toString());
                admin.setCorreo(adminEmail.toLowerCase());
                admin.setPassword(passwordEncoder.encode(adminPassword));
                admin.setNombre("ADMINISTRADOR PRINCIPAL");
                admin.setRol("ADMIN");
                admin.setEstatus("Activo");
                admin.setUltimoAcceso("Inicializado");
                admin.setPermisos(Arrays.asList("ALL"));
                usuarioRepository.save(admin);
                System.out.println("-> [SEEDER] Admin Principal creado e inicializado con éxito: " + adminEmail);
            } else {
                admin.setPassword(passwordEncoder.encode(adminPassword));
                admin.setRol("ADMIN");
                admin.setEstatus("Activo");
                usuarioRepository.save(admin);
                System.out.println("-> [SEEDER] Contraseña de Admin Principal sincronizada exitosamente con la variable ADMIN_PASSWORD: " + adminEmail);
            }
        }

        // Solo sembrar usuarios de muestra si la base está vacía Y existen credenciales de entorno
        if (usuarioRepository.count() <= 1 && adminEmail != null) {
            String passGuardia     = obtenerVarEnv("SEED_GUARDIA_PASS", "GUARDIA_PASS");
            String passPrefecto    = obtenerVarEnv("SEED_PREFECTO_PASS", "PREFECTO_PASS");
            String passOrientacion = obtenerVarEnv("SEED_ORIENTACION_PASS", "ORIENTACION_PASS");

            if (passGuardia == null || passPrefecto == null || passOrientacion == null) {
                System.out.println("-> [SEEDER] Variables SEED_*_PASS no configuradas. Omitiendo usuarios de demostración.");
                return;
            }

            List<UsuarioSeed> usuariosData = Arrays.asList(
                new UsuarioSeed(UUID.randomUUID().toString(), "GUARDIA DEL PLANTEL",      "guardia@cbtis134.edu.mx",     "GUARDIA",     passGuardia),
                new UsuarioSeed(UUID.randomUUID().toString(), "PREFECTO DEL PLANTEL",     "prefecto@cbtis134.edu.mx",    "PREFECTO",    passPrefecto),
                new UsuarioSeed(UUID.randomUUID().toString(), "ORIENTACION DEL PLANTEL",  "orientacion@cbtis134.edu.mx", "ORIENTACION", passOrientacion)
            );

            for (UsuarioSeed u : usuariosData) {
                if (usuarioRepository.findByCorreo(u.correo).isEmpty()) {
                    Usuario usuario = new Usuario();
                    usuario.setUid(u.uid);
                    usuario.setNombre(u.nombre.toUpperCase());
                    usuario.setCorreo(u.correo);
                    usuario.setRol(u.rol);
                    usuario.setEstatus("Activo");
                    usuario.setPassword(passwordEncoder.encode(u.password));
                    usuarioRepository.save(usuario);
                    System.out.println("-> Usuario operativo creado: " + u.correo + " (" + u.rol + ")");
                }
            }
        }
    }

    private void seederCalendario() {
        String col = "calendario";
        guardarSiNoExiste(col, "EVT_20260419_233357", new Document("_id", "EVT_20260419_233357")
                .append("title", "EVALUACIONES DE 3RA UNIDAD")
                .append("start", "2026-04-27")
                .append("end", "2026-04-30")
                .append("allDay", true)
                .append("color", "#7b1b37")
                .append("creadoPor", "ADMIN"));

        guardarSiNoExiste(col, "EVT_20260528_014147", new Document("_id", "EVT_20260528_014147")
                .append("title", "SEMANA DEL ESTUDIANTE TECNOLÓGICO")
                .append("start", "2026-05-25")
                .append("end", "2026-05-30")
                .append("allDay", true)
                .append("color", "#7b1b37")
                .append("creadoPor", "ADMIN"));

        guardarSiNoExiste(col, "EVT_20260419_233415", new Document("_id", "EVT_20260419_233415")
                .append("title", "DIA DEL TRABAJO")
                .append("start", "2026-05-01")
                .append("end", "2026-05-02")
                .append("allDay", true)
                .append("color", "#7b1b37")
                .append("creadoPor", "ADMIN"));
    }

    private void seederConfiguracion() {
        String col = "configuracion";

        guardarSiNoExiste(col, "escolar", new Document("_id", "escolar")
                .append("especialidades", Arrays.asList(
                        new Document("alias", "TCS").append("turno", "Matutino").append("color", "#dc3545").append("nombre", "CONSTRUCCIÓN"),
                        new Document("alias", "LABO").append("turno", "Matutino").append("color", "#0dcaf0").append("nombre", "LABORATORISTA CLÍNICO"),
                        new Document("alias", "CONTA").append("turno", "Vespertino").append("color", "#198754").append("nombre", "CONTABILIDAD"),
                        new Document("alias", "PROG").append("turno", "Vespertino").append("color", "#6c757d").append("nombre", "PROGRAMACIÓN"),
                        new Document("alias", "COMER").append("turno", "Vespertino").append("color", "#6f42c1").append("nombre", "E.COMMERCE"),
                        new Document("alias", "IA").append("turno", "Vespertino").append("color", "#052c65").append("nombre", "INTELIGENCIA ARTIFICIAL"),
                        new Document("alias", "MECA").append("turno", "Matutino").append("color", "#0088cc").append("nombre", "MECATRÓNICA")
                )));

        guardarSiNoExiste(col, "ciclo_escolar", new Document("_id", "ciclo_escolar")
                .append("creado_automaticamente", true)
                .append("actual", "FEB-JUL 2026")
                .append("ciclo_anterior", "AGO-DIC 2025"));

        String nomPlantelEnv = System.getenv("PLANTEL_NOMBRE_CORTO");
        String nomOficialEnv = System.getenv("PLANTEL_NOMBRE_OFICIAL");
        String sloganEnv = System.getenv("PLANTEL_SLOGAN");
        String logoPlantelEnv = System.getenv("PLANTEL_LOGO_URL");
        String logoInicioEnv = System.getenv("PLANTEL_MASCOTA_URL");
        String cctEnv = System.getenv("PLANTEL_CCT");
        String directorEnv = System.getenv("PLANTEL_DIRECTOR");
        String telEnv = System.getenv("PLANTEL_TELEFONO");
        String direccionEnv = System.getenv("PLANTEL_DIRECCION");
        String ciudadEnv = System.getenv("PLANTEL_CIUDAD");

        Document docSistema = mongoTemplate.findById("sistema", Document.class, col);
        if (docSistema == null) {
            docSistema = new Document("_id", "sistema")
                    .append("nombre_plantel", nomPlantelEnv != null && !nomPlantelEnv.isBlank() ? nomPlantelEnv : "CBTIS 134")
                    .append("nombre_oficial_plantel", nomOficialEnv != null && !nomOficialEnv.isBlank() ? nomOficialEnv : "Centro de Bachillerato Tecnológico industrial y de servicios No. 134 \"Nicolás Catalán\"")
                    .append("slogan_plantel", sloganEnv != null ? sloganEnv : "\"POR QUE PRESTIGIO SE GANA CON ESFUERZO... SOMOS CBTIS 134\"")
                    .append("logo_plantel_url", logoPlantelEnv != null && !logoPlantelEnv.isBlank() ? logoPlantelEnv : "/img/logo_aniversario.jpg")
                    .append("logo_inicio_url", logoInicioEnv != null && !logoInicioEnv.isBlank() ? logoInicioEnv : "/img/tigres.png")
                    .append("vigencia_actual", "Agosto 2027")
                    .append("cct_escuela", cctEnv != null ? cctEnv : "12DCT0001L")
                    .append("responsable_orientacion", "MATILDE ABIGAIL GARCIA NAJERA")
                    .append("jefe_personal", "LIC. JUANA MORALES APARICIO")
                    .append("telefono_escuela", telEnv != null ? telEnv : "7474723464")
                    .append("nombre_director", directorEnv != null ? directorEnv : "JOSE MARTÍN RODEA ZUÑIGA")
                    .append("direccion_plantel", direccionEnv != null && !direccionEnv.isBlank() ? direccionEnv : "Carretera Nacional México - Acapulco Km. 275.5, Col. Salubridad, C.P. 39096, Chilpancingo, Guerrero")
                    .append("ciudad_plantel", ciudadEnv != null && !ciudadEnv.isBlank() ? ciudadEnv : "Chilpancingo de los Bravo, Guerrero")
                    .append("ultimaLimpieza", "2026-08-07");
            mongoTemplate.save(docSistema, col);
            System.out.println("-> [configuracion] Registro sembrado: sistema");
        } else {
            boolean mod = false;
            // Sincronizar con variables de entorno del plantel si están definidas en despliegue (Coolify / Docker)
            if (nomPlantelEnv != null && !nomPlantelEnv.isBlank() && !nomPlantelEnv.equals(docSistema.getString("nombre_plantel"))) {
                docSistema.put("nombre_plantel", nomPlantelEnv);
                mod = true;
            }
            if (nomOficialEnv != null && !nomOficialEnv.isBlank() && !nomOficialEnv.equals(docSistema.getString("nombre_oficial_plantel"))) {
                docSistema.put("nombre_oficial_plantel", nomOficialEnv);
                mod = true;
            }
            if (sloganEnv != null && !sloganEnv.equals(docSistema.getString("slogan_plantel"))) {
                docSistema.put("slogan_plantel", sloganEnv);
                mod = true;
            }
            if (logoPlantelEnv != null && !logoPlantelEnv.isBlank() && !logoPlantelEnv.equals(docSistema.getString("logo_plantel_url"))) {
                docSistema.put("logo_plantel_url", logoPlantelEnv);
                mod = true;
            }
            if (logoInicioEnv != null && !logoInicioEnv.isBlank() && !logoInicioEnv.equals(docSistema.getString("logo_inicio_url"))) {
                docSistema.put("logo_inicio_url", logoInicioEnv);
                mod = true;
            }
            if (direccionEnv != null && !direccionEnv.isBlank() && !direccionEnv.equals(docSistema.getString("direccion_plantel"))) {
                docSistema.put("direccion_plantel", direccionEnv);
                mod = true;
            }
            if (ciudadEnv != null && !ciudadEnv.isBlank() && !ciudadEnv.equals(docSistema.getString("ciudad_plantel"))) {
                docSistema.put("ciudad_plantel", ciudadEnv);
                mod = true;
            }
            if (cctEnv != null && !cctEnv.isBlank() && !cctEnv.equals(docSistema.getString("cct_escuela"))) {
                docSistema.put("cct_escuela", cctEnv);
                mod = true;
            }
            if (directorEnv != null && !directorEnv.isBlank() && !directorEnv.equals(docSistema.getString("nombre_director"))) {
                docSistema.put("nombre_director", directorEnv);
                mod = true;
            }
            if (telEnv != null && !telEnv.isBlank() && !telEnv.equals(docSistema.getString("telefono_escuela"))) {
                docSistema.put("telefono_escuela", telEnv);
                mod = true;
            }

            // Valores de fallback por si la base de datos existía pero no contenía los campos
            if (!docSistema.containsKey("nombre_plantel")) { docSistema.put("nombre_plantel", "Control Escolar"); mod = true; }
            if (!docSistema.containsKey("nombre_oficial_plantel")) { docSistema.put("nombre_oficial_plantel", "Centro de Bachillerato Tecnológico Industrial y de Servicios"); mod = true; }
            if (!docSistema.containsKey("slogan_plantel")) { docSistema.put("slogan_plantel", ""); mod = true; }
            if (!docSistema.containsKey("logo_plantel_url")) { docSistema.put("logo_plantel_url", "/img/logo_aniversario.jpg"); mod = true; }
            if (!docSistema.containsKey("logo_inicio_url")) { docSistema.put("logo_inicio_url", "/img/tigres.png"); mod = true; }
            if (!docSistema.containsKey("jefe_personal")) { docSistema.put("jefe_personal", "OFICINA DE PERSONAL"); mod = true; }
            if (!docSistema.containsKey("direccion_plantel") || docSistema.getString("direccion_plantel") == null || docSistema.getString("direccion_plantel").isBlank()) {
                docSistema.put("direccion_plantel", direccionEnv != null && !direccionEnv.isBlank() ? direccionEnv : "");
                mod = true;
            }
            if (!docSistema.containsKey("ciudad_plantel") || docSistema.getString("ciudad_plantel") == null || docSistema.getString("ciudad_plantel").isBlank()) {
                docSistema.put("ciudad_plantel", ciudadEnv != null && !ciudadEnv.isBlank() ? ciudadEnv : "");
                mod = true;
            }
            if (mod) {
                mongoTemplate.save(docSistema, col);
                System.out.println("-> [configuracion] Sincronización institucional actualizada en MongoDB");
            }
        }

        // Configuración de WhatsApp — se siembra vacía.
        // El administrador la configura desde el panel: Configuración → WhatsApp.
        guardarSiNoExiste(col, "whatsapp", new Document("_id", "whatsapp")
                .append("tipo_api", "ULTRAMSG")
                .append("token", "")
                .append("instanceId", ""));

    }

    private void guardarSiNoExiste(String coleccion, String id, Document doc) {
        if (mongoTemplate.findById(id, Document.class, coleccion) == null) {
            mongoTemplate.save(doc, coleccion);
            System.out.println("-> [" + coleccion + "] Registro sembrado: " + id);
        }
    }

    private static class UsuarioSeed {
        String uid;
        String nombre;
        String correo;
        String rol;
        String password;

        UsuarioSeed(String uid, String nombre, String correo, String rol, String password) {
            this.uid = uid;
            this.nombre = nombre;
            this.correo = correo;
            this.rol = rol;
            this.password = password;
        }
    }
}
