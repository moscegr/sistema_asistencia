package com.cbtis134.sistema.config;

import com.cbtis134.sistema.model.Alumno;
import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.AlumnoRepository;
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
    private AlumnoRepository alumnoRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        System.out.println("=== [SEEDER MAESTRO] Iniciando verificación e inyección de datos de producción en MongoDB... ===");

        try {
            seederUsuarios();
            seederAlumnos();
            seederCalendario();
            seederConfiguracion();

            System.out.println("=== [SEEDER MAESTRO] ¡Proceso de siembra finalizado exitosamente! ===");

        } catch (Exception e) {
            System.err.println("=== [SEEDER MAESTRO] Error durante la siembra de datos: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void seederUsuarios() {
        String envEmail = System.getenv("ADMIN_EMAIL");
        String envPass = System.getenv("ADMIN_PASSWORD");
        String adminEmail = (envEmail != null && !envEmail.trim().isEmpty()) ? envEmail : "koyer.pop@gmail.com";
        String adminPassword = (envPass != null && !envPass.trim().isEmpty()) ? envPass : "kike1992";

        if (!usuarioRepository.existsByCorreo(adminEmail)) {
            Usuario admin = new Usuario();
            admin.setUid(UUID.randomUUID().toString());
            admin.setCorreo(adminEmail);
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setNombre("ADMINISTRADOR PRINCIPAL");
            admin.setRol("ADMIN");
            admin.setEstatus("Activo");
            admin.setUltimoAcceso("Sembrado en inicio");
            admin.setPermisos(Arrays.asList("ALL"));
            usuarioRepository.save(admin);
            System.out.println("-> Admin Principal creado: " + adminEmail);
        }

        List<UsuarioSeed> usuariosData = Arrays.asList(
            new UsuarioSeed("2MNSM3eLm4QjGMFZk7KZUlK7v8m1", "JUAN JESUS GARCIA", "jesus1@gmail.com", "GUARDIA", "cbtis134"),
            new UsuarioSeed("5HXPsUCs1VdEratsqFDx0PIbbfF3", "PEDRO PREFECTO ACT", "prefect1@gmail.com", "PREFECTO", "cbtis134"),
            new UsuarioSeed("Cbv74BQJQ3bA0qtZYlLvhX6q3Tj1", "CRUZ ENRIQUE GARCIA RAMOS", "cruz.egr@cbtis134.edu.mx", "ADMIN", "cbtis134"),
            new UsuarioSeed("Of8qrsaMLCXH4KyAtYimTG0vRax2", "ORTIZ ORIENTACION", "orient1@gmail.com", "ORIENTACION", "cbtis134"),
            new UsuarioSeed("uvTx2qsgVbMWFhz0InbpeIY81b43", "KEVIN SANCHEZ", "kev99cbtisk@gmail.com", "ADMIN", "cbtis134")
        );

        for (UsuarioSeed u : usuariosData) {
            if (!usuarioRepository.existsByCorreo(u.correo)) {
                Usuario usuario = new Usuario();
                usuario.setUid(u.uid);
                usuario.setNombre(u.nombre);
                usuario.setCorreo(u.correo);
                usuario.setRol(u.rol);
                usuario.setEstatus("Activo");
                usuario.setPassword(passwordEncoder.encode(u.password));
                usuarioRepository.save(usuario);
                System.out.println("-> Usuario registrado: " + u.correo + " (" + u.rol + ")");
            }
        }
    }

    private void seederAlumnos() {
        alumnoRepository.deleteAll();
        System.out.println("-> [SEEDER ALUMNOS] Colección 'alumnos' limpiada por completo.");

        List<Alumno> lista = crearListaAlumnosSeed();
        for (Alumno a : lista) {
            alumnoRepository.save(a);
            System.out.println("-> Alumno sembrado: " + a.getMatricula() + " - " + a.getNombre() + " (" + a.getEspecialidad() + ")");
        }
    }

    private List<Alumno> crearListaAlumnosSeed() {
        List<Alumno> alumnos = new ArrayList<>();

        // 1. CONSTRUCCIÓN
        Alumno a1 = new Alumno();
        a1.setMatricula("10000000000001");
        a1.setNcontrol("10000000000001");
        a1.setNombre("CARLOS");
        a1.setApepat("GONZALEZ");
        a1.setApemat("PEREZ");
        a1.setPrimerApellido("GONZALEZ");
        a1.setSegundoApellido("PEREZ");
        a1.setGenero("H");
        a1.setCurp("GOPC900101HDCCNS01");
        a1.setEmail("carlos.construccion@cbtis134.edu.mx");
        a1.setCelular("7471000001");
        a1.setDireccion("AV. CENTRAL NO. 1");
        a1.setEspecialidad("CONSTRUCCIÓN");
        a1.setGrado("4");
        a1.setGrupo("A");
        a1.setTurno("Matutino");
        a1.setEstatus_escolar("Activo");
        a1.setEstatus("Activo");
        a1.setColor_semaforo("Verde");
        a1.setPerfil_completo(true);
        a1.setNombretutor("JOSE GONZALEZ");
        a1.setTeltutor("7472000001");
        a1.setOcupaciontutor("COMERCIANTE");
        a1.setQr_texto("10000000000001|CARLOS GONZALEZ PEREZ");
        a1.setQrCode("10000000000001|CARLOS GONZALEZ PEREZ");
        a1.setAula_especifica("N/A");
        a1.setEstado("FUERA");
        alumnos.add(a1);

        // 2. LABORATORISTA CLÍNICO
        Alumno a2 = new Alumno();
        a2.setMatricula("10000000000002");
        a2.setNcontrol("10000000000002");
        a2.setNombre("LAURA");
        a2.setApepat("LOPEZ");
        a2.setApemat("MORALES");
        a2.setPrimerApellido("LOPEZ");
        a2.setSegundoApellido("MORALES");
        a2.setGenero("M");
        a2.setCurp("LOML920202MGRNJV02");
        a2.setEmail("laura.labo@cbtis134.edu.mx");
        a2.setCelular("7471000002");
        a2.setDireccion("COL. INDUSTRIAL NO. 2");
        a2.setEspecialidad("LABORATORISTA CLÍNICO");
        a2.setGrado("4");
        a2.setGrupo("A");
        a2.setTurno("Matutino");
        a2.setEstatus_escolar("Activo");
        a2.setEstatus("Activo");
        a2.setColor_semaforo("Verde");
        a2.setPerfil_completo(true);
        a2.setNombretutor("RAMON LOPEZ");
        a2.setTeltutor("7472000002");
        a2.setOcupaciontutor("EMPLEADO");
        a2.setQr_texto("10000000000002|LAURA LOPEZ MORALES");
        a2.setQrCode("10000000000002|LAURA LOPEZ MORALES");
        a2.setAula_especifica("N/A");
        a2.setEstado("FUERA");
        alumnos.add(a2);

        // 3. CONTABILIDAD
        Alumno a3 = new Alumno();
        a3.setMatricula("10000000000003");
        a3.setNcontrol("10000000000003");
        a3.setNombre("CRISTIAN");
        a3.setApepat("FLORES");
        a3.setApemat("RODRIGUEZ");
        a3.setPrimerApellido("FLORES");
        a3.setSegundoApellido("RODRIGUEZ");
        a3.setGenero("H");
        a3.setCurp("FORC940303HDRDPN03");
        a3.setEmail("cristian.conta@cbtis134.edu.mx");
        a3.setCelular("7471000003");
        a3.setDireccion("COL. CENTRO NO. 3");
        a3.setEspecialidad("CONTABILIDAD");
        a3.setGrado("4");
        a3.setGrupo("A");
        a3.setTurno("Vespertino");
        a3.setEstatus_escolar("Activo");
        a3.setEstatus("Activo");
        a3.setColor_semaforo("Verde");
        a3.setPerfil_completo(true);
        a3.setNombretutor("ELENA FLORES");
        a3.setTeltutor("7472000003");
        a3.setOcupaciontutor("DOCENTE");
        a3.setQr_texto("10000000000003|CRISTIAN FLORES RODRIGUEZ");
        a3.setQrCode("10000000000003|CRISTIAN FLORES RODRIGUEZ");
        a3.setAula_especifica("N/A");
        a3.setEstado("FUERA");
        alumnos.add(a3);

        // 4. PROGRAMACIÓN
        Alumno a4 = new Alumno();
        a4.setMatricula("10000000000004");
        a4.setNcontrol("10000000000004");
        a4.setNombre("PABLO");
        a4.setApepat("GOMEZ");
        a4.setApemat("SANCHEZ");
        a4.setPrimerApellido("GOMEZ");
        a4.setSegundoApellido("SANCHEZ");
        a4.setGenero("H");
        a4.setCurp("GOSP960404HGRMSN04");
        a4.setEmail("pablo.prog@cbtis134.edu.mx");
        a4.setCelular("7471000004");
        a4.setDireccion("FRACC. GUERRERO NO. 4");
        a4.setEspecialidad("PROGRAMACIÓN");
        a4.setGrado("4");
        a4.setGrupo("A");
        a4.setTurno("Vespertino");
        a4.setEstatus_escolar("Activo");
        a4.setEstatus("Activo");
        a4.setColor_semaforo("Verde");
        a4.setPerfil_completo(true);
        a4.setNombretutor("PEDRO GOMEZ");
        a4.setTeltutor("7472000004");
        a4.setOcupaciontutor("INGENIERO");
        a4.setQr_texto("10000000000004|PABLO GOMEZ SANCHEZ");
        a4.setQrCode("10000000000004|PABLO GOMEZ SANCHEZ");
        a4.setAula_especifica("N/A");
        a4.setEstado("FUERA");
        alumnos.add(a4);

        // 5. E.COMMERCE
        Alumno a5 = new Alumno();
        a5.setMatricula("10000000000005");
        a5.setNcontrol("10000000000005");
        a5.setNombre("ELENA");
        a5.setApepat("CASTRO");
        a5.setApemat("RIVERA");
        a5.setPrimerApellido("CASTRO");
        a5.setSegundoApellido("RIVERA");
        a5.setGenero("M");
        a5.setCurp("CARE980505MGRRVR05");
        a5.setEmail("elena.ecom@cbtis134.edu.mx");
        a5.setCelular("7471000005");
        a5.setDireccion("COL. SAUCES NO. 5");
        a5.setEspecialidad("E.COMMERCE");
        a5.setGrado("4");
        a5.setGrupo("A");
        a5.setTurno("Vespertino");
        a5.setEstatus_escolar("Activo");
        a5.setEstatus("Activo");
        a5.setColor_semaforo("Verde");
        a5.setPerfil_completo(true);
        a5.setNombretutor("SONIA RIVERA");
        a5.setTeltutor("7472000005");
        a5.setOcupaciontutor("CONTADORA");
        a5.setQr_texto("10000000000005|ELENA CASTRO RIVERA");
        a5.setQrCode("10000000000005|ELENA CASTRO RIVERA");
        a5.setAula_especifica("N/A");
        a5.setEstado("FUERA");
        alumnos.add(a5);

        // 6. INTELIGENCIA ARTIFICIAL
        Alumno a6 = new Alumno();
        a6.setMatricula("10000000000006");
        a6.setNcontrol("10000000000006");
        a6.setNombre("IGNACIO");
        a6.setApepat("MARTINEZ");
        a6.setApemat("CRUZ");
        a6.setPrimerApellido("MARTINEZ");
        a6.setSegundoApellido("CRUZ");
        a6.setGenero("H");
        a6.setCurp("MACI000606HGRCRZ06");
        a6.setEmail("ignacio.ia@cbtis134.edu.mx");
        a6.setCelular("7471000006");
        a6.setDireccion("COL. SAN MATEO NO. 6");
        a6.setEspecialidad("INTELIGENCIA ARTIFICIAL");
        a6.setGrado("4");
        a6.setGrupo("A");
        a6.setTurno("Vespertino");
        a6.setEstatus_escolar("Activo");
        a6.setEstatus("Activo");
        a6.setColor_semaforo("Verde");
        a6.setPerfil_completo(true);
        a6.setNombretutor("RAUL MARTINEZ");
        a6.setTeltutor("7472000006");
        a6.setOcupaciontutor("TECNICO");
        a6.setQr_texto("10000000000006|IGNACIO MARTINEZ CRUZ");
        a6.setQrCode("10000000000006|IGNACIO MARTINEZ CRUZ");
        a6.setAula_especifica("N/A");
        a6.setEstado("FUERA");
        alumnos.add(a6);

        // 7. MECATRÓNICA
        Alumno a7 = new Alumno();
        a7.setMatricula("10000000000007");
        a7.setNcontrol("10000000000007");
        a7.setNombre("MARIO");
        a7.setApepat("RUIZ");
        a7.setApemat("DIAZ");
        a7.setPrimerApellido("RUIZ");
        a7.setSegundoApellido("DIAZ");
        a7.setGenero("H");
        a7.setCurp("RUDM020707HGRDZZ07");
        a7.setEmail("mario.meca@cbtis134.edu.mx");
        a7.setCelular("7471000007");
        a7.setDireccion("COL. VILLA MODERNA NO. 7");
        a7.setEspecialidad("MECATRÓNICA");
        a7.setGrado("4");
        a7.setGrupo("A");
        a7.setTurno("Matutino");
        a7.setEstatus_escolar("Activo");
        a7.setEstatus("Activo");
        a7.setColor_semaforo("Verde");
        a7.setPerfil_completo(true);
        a7.setNombretutor("JORGE RUIZ");
        a7.setTeltutor("7472000007");
        a7.setOcupaciontutor("MECANICO");
        a7.setQr_texto("10000000000007|MARIO RUIZ DIAZ");
        a7.setQrCode("10000000000007|MARIO RUIZ DIAZ");
        a7.setAula_especifica("N/A");
        a7.setEstado("FUERA");
        alumnos.add(a7);

        return alumnos;
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

        guardarSiNoExiste(col, "sistema", new Document("_id", "sistema")
                .append("vigencia_actual", "Agosto 2027")
                .append("cct_escuela", "12DCT0001L")
                .append("responsable_orientacion", "MATILDE ABIGAIL GARCIA NAJERA")
                .append("telefono_escuela", "7474723464")
                .append("nombre_director", "JOSE MARTÍN RODEA ZUÑIGA")
                .append("ultimaLimpieza", "2026-08-07"));

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
