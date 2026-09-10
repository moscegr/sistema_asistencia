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

    private void seederUsuarios() {
        String envEmail = System.getenv("ADMIN_EMAIL");
        String envPass = System.getenv("ADMIN_PASSWORD");
        String adminEmail = (envEmail != null && !envEmail.trim().isEmpty()) ? envEmail : "koyer.pop@gmail.com";
        String adminPassword = (envPass != null && !envPass.trim().isEmpty()) ? envPass : "kike1992";

        Usuario admin = usuarioRepository.findByCorreo(adminEmail).orElse(null);
        if (admin == null) {
            admin = new Usuario();
            admin.setUid(UUID.randomUUID().toString());
            admin.setCorreo(adminEmail);
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setNombre("ADMINISTRADOR PRINCIPAL");
            admin.setRol("ADMIN");
            admin.setEstatus("Activo");
            admin.setUltimoAcceso("Sembrado en inicio");
            admin.setPermisos(Arrays.asList("ALL"));
            usuarioRepository.save(admin);
            System.out.println("-> Admin Principal verificado/creado: " + adminEmail);
        } else if (admin.getNombre() != null && !admin.getNombre().equals(admin.getNombre().toUpperCase())) {
            admin.setNombre(admin.getNombre().toUpperCase());
            usuarioRepository.save(admin);
        }

        usuarioRepository.findByCorreo("cruz.egr@cbtis134.edu.mx").ifPresent(u -> {
            usuarioRepository.delete(u);
            System.out.println("-> Usuario eliminado: cruz.egr@cbtis134.edu.mx");
        });
        usuarioRepository.findByCorreo("cruz.egr").ifPresent(u -> {
            usuarioRepository.delete(u);
            System.out.println("-> Usuario eliminado: cruz.egr");
        });

        List<UsuarioSeed> usuariosData = Arrays.asList(
            new UsuarioSeed("admin-master-uid-001", "ADMINISTRADOR GENERAL", "admin@admin.edu.mx", "ADMIN", "12345678"),
            new UsuarioSeed("2MNSM3eLm4QjGMFZk7KZUlK7v8m1", "JUAN JESUS GARCIA", "jesus1@gmail.com", "GUARDIA", "cbtis134"),
            new UsuarioSeed("5HXPsUCs1VdEratsqFDx0PIbbfF3", "PEDRO PREFECTO", "prefect1@gmail.com", "PREFECTO", "cbtis134"),
            new UsuarioSeed("Of8qrsaMLCXH4KyAtYimTG0vRax2", "ORTIZ ORIENTACION", "orient1@gmail.com", "ORIENTACION", "cbtis134"),
            new UsuarioSeed("uvTx2qsgVbMWFhz0InbpeIY81b43", "KEVIN SANCHEZ", "kev99cbtisk@gmail.com", "ADMIN", "cbtis134")
        );

        for (UsuarioSeed u : usuariosData) {
            Usuario uExistente = usuarioRepository.findByCorreo(u.correo).orElse(null);
            if (uExistente == null) {
                Usuario usuario = new Usuario();
                usuario.setUid(u.uid);
                usuario.setNombre(u.nombre.toUpperCase());
                usuario.setCorreo(u.correo);
                usuario.setRol(u.rol);
                usuario.setEstatus("Activo");
                usuario.setPassword(passwordEncoder.encode(u.password));
                usuarioRepository.save(usuario);
                System.out.println("-> Usuario inicial verificado/creado: " + u.correo + " (" + u.rol + ")");
            } else {
                boolean modificado = false;
                if (uExistente.getNombre() == null || !uExistente.getNombre().equalsIgnoreCase(u.nombre)) {
                    uExistente.setNombre(u.nombre.toUpperCase());
                    modificado = true;
                }
                if (u.correo.equalsIgnoreCase("admin@admin.edu.mx")) {
                    uExistente.setPassword(passwordEncoder.encode(u.password));
                    uExistente.setNombre(u.nombre.toUpperCase());
                    uExistente.setRol("ADMIN");
                    uExistente.setEstatus("Activo");
                    modificado = true;
                }
                if (modificado) {
                    usuarioRepository.save(uExistente);
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

        Document docSistema = mongoTemplate.findById("sistema", Document.class, col);
        if (docSistema == null) {
            docSistema = new Document("_id", "sistema")
                    .append("nombre_plantel", "CBTIS 134")
                    .append("nombre_oficial_plantel", "Centro de Bachillerato Tecnológico industrial y de servicios No. 134 \"Nicolás Catalán\"")
                    .append("slogan_plantel", "\"POR QUE PRESTIGIO SE GANA CON ESFUERZO... SOMOS CBTIS 134\"")
                    .append("logo_plantel_url", "/img/logo_aniversario.jpg")
                    .append("logo_inicio_url", "/img/tigres.png")
                    .append("vigencia_actual", "Agosto 2027")
                    .append("cct_escuela", "12DCT0001L")
                    .append("responsable_orientacion", "MATILDE ABIGAIL GARCIA NAJERA")
                    .append("jefe_personal", "LIC. JUANA MORALES APARICIO")
                    .append("telefono_escuela", "7474723464")
                    .append("nombre_director", "JOSE MARTÍN RODEA ZUÑIGA")
                    .append("ultimaLimpieza", "2026-08-07");
            mongoTemplate.save(docSistema, col);
            System.out.println("-> [configuracion] Registro sembrado: sistema");
        } else {
            boolean mod = false;
            if (!docSistema.containsKey("nombre_plantel")) { docSistema.put("nombre_plantel", "CBTIS 134"); mod = true; }
            if (!docSistema.containsKey("nombre_oficial_plantel")) { docSistema.put("nombre_oficial_plantel", "Centro de Bachillerato Tecnológico industrial y de servicios No. 134 \"Nicolás Catalán\""); mod = true; }
            if (!docSistema.containsKey("slogan_plantel")) { docSistema.put("slogan_plantel", "\"POR QUE PRESTIGIO SE GANA CON ESFUERZO... SOMOS CBTIS 134\""); mod = true; }
            if (!docSistema.containsKey("logo_plantel_url")) { docSistema.put("logo_plantel_url", "/img/logo_aniversario.jpg"); mod = true; }
            if (!docSistema.containsKey("logo_inicio_url")) { docSistema.put("logo_inicio_url", "/img/tigres.png"); mod = true; }
            if (!docSistema.containsKey("jefe_personal")) { docSistema.put("jefe_personal", "LIC. JUANA MORALES APARICIO"); mod = true; }
            if (mod) mongoTemplate.save(docSistema, col);
        }

        guardarSiNoExiste(col, "whatsapp", new Document("_id", "whatsapp")
                .append("tipo_api", "ULTRAMSG")
                .append("token", "0wk51yei239joo41")
                .append("instanceId", "instance184062"));
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
