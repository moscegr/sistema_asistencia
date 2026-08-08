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
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
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
        System.out.println("=== [SEEDER MAESTRO] Iniciando verificación e inyección de datos completos en MongoDB... ===");

        try {
            seederUsuarios();
            seederAlumnos();
            seederCalendario();
            seederConfiguracion();
            seederIncidencias();
            seederIncidenciasPersonal();
            seederJustificantes();
            seederPasesSalida();
            seederRegistrosDiarios();

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
            admin.setNombre("Administrador Principal");
            admin.setRol("ADMIN");
            admin.setEstatus("Activo");
            admin.setUltimoAcceso("Sembrado en inicio");
            admin.setPermisos(Arrays.asList("ALL"));
            usuarioRepository.save(admin);
            System.out.println("-> Admin Principal creado: " + adminEmail);
        }

        List<UsuarioSeed> usuariosData = Arrays.asList(
            new UsuarioSeed("2MNSM3eLm4QjGMFZk7KZUlK7v8m1", "Juan Jeus Garcia", "jesus1@gmail.com", "GUARDIA", "cbtis134"),
            new UsuarioSeed("5HXPsUCs1VdEratsqFDx0PIbbfF3", "Pedro Prefecto Act", "prefect1@gmail.com", "PREFECTO", "cbtis134"),
            new UsuarioSeed("Cbv74BQJQ3bA0qtZYlLvhX6q3Tj1", "Cruz Enrique Garcia Ramos", "cruz.egr@cbtis134.edu.mx", "ADMIN", "cbtis134"),
            new UsuarioSeed("Of8qrsaMLCXH4KyAtYimTG0vRax2", "Ortiz Orientacion", "orient1@gmail.com", "ORIENTACION", "cbtis134"),
            new UsuarioSeed("uvTx2qsgVbMWFhz0InbpeIY81b43", "Kevin Sanchez", "kev99cbtisk@gmail.com", "ADMIN", "cbtis134")
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
        List<Alumno> lista = crearListaAlumnosSeed();
        for (Alumno a : lista) {
            String matricula = a.getMatricula();
            if (alumnoRepository.findByNcontrol(matricula).isEmpty()) {
                alumnoRepository.save(a);
                System.out.println("-> Alumno registrado: " + matricula + " - " + a.getNombre() + " " + a.getApepat());
            }
        }
    }

    private List<Alumno> crearListaAlumnosSeed() {
        List<Alumno> alumnos = new ArrayList<>();

        // 12344670011122
        Alumno a1 = new Alumno();
        a1.setMatricula("12344670011122");
        a1.setNcontrol("12344670011122");
        a1.setNombre("Gabriel");
        a1.setApepat("Muñóz");
        a1.setApemat("Perez");
        a1.setGenero("H");
        a1.setCurp("CGPP900101HDCCNS09");
        a1.setEmail("cruz10cbtisk@gmail.com");
        a1.setCelular("1234567890");
        a1.setDireccion("CALLE JAZMIN NO. 18");
        a1.setEspecialidad("CONSTRUCCIÓN");
        a1.setGrado("4");
        a1.setGrupo("D");
        a1.setTurno("Matutino");
        a1.setEstatus_escolar("Activo");
        a1.setEstatus("Activo");
        a1.setColor_semaforo("Verde");
        a1.setPerfil_completo(true);
        a1.setNombretutor("Jose");
        a1.setTeltutor("7472529153");
        a1.setOcupaciontutor("Trabajador");
        a1.setQr_texto("12344670011122|GABRIEL MUÑÓZ PEREZ");
        a1.setQrCode("12344670011122|GABRIEL MUÑÓZ PEREZ");
        a1.setAula_especifica("N/A");
        alumnos.add(a1);

        // 14122678444105
        Alumno a2 = new Alumno();
        a2.setMatricula("14122678444105");
        a2.setNcontrol("14122678444105");
        a2.setCurp("SAOK030412HGRNJVA4");
        a2.setNombre("ALAN");
        a2.setApepat("");
        a2.setApemat("ORTIZ");
        a2.setGenero("M");
        a2.setEmail("alan.mor@gmail.com");
        a2.setCelular("5121313123");
        a2.setDireccion("Col. Industrial");
        a2.setEspecialidad("LABORATORISTA CLÍNICO");
        a2.setGrado("4");
        a2.setGrupo("E");
        a2.setTurno("Matutino");
        a2.setEstatus_escolar("Activo");
        a2.setEstatus("Activo");
        a2.setColor_semaforo("Verde");
        a2.setPerfil_completo(true);
        a2.setNombretutor("RAUL MORALES");
        a2.setTeltutor("7478889900");
        a2.setOcupaciontutor("Empleado");
        a2.setQr_texto("14122678444105|ALAN  ORTIZ");
        a2.setQrCode("14122678444105|ALAN  ORTIZ");
        a2.setAula_especifica("N/A");
        alumnos.add(a2);

        // 14122678444109
        Alumno a3 = new Alumno();
        a3.setMatricula("14122678444109");
        a3.setNcontrol("14122678444109");
        a3.setCurp("GOME950321MGRDPN08");
        a3.setNombre("XIMENA");
        a3.setApepat("FLORES");
        a3.setApemat("LOPEZ");
        a3.setGenero("M");
        a3.setEmail("ksjvjhv@gmail.com");
        a3.setCelular("1234567890");
        a3.setDireccion("N/A");
        a3.setEspecialidad("CONTABILIDAD");
        a3.setGrado("5");
        a3.setGrupo("D");
        a3.setTurno("Vespertino");
        a3.setEstatus_escolar("Activo");
        a3.setEstatus("Activo");
        a3.setColor_semaforo("Verde");
        a3.setPerfil_completo(true);
        a3.setNombretutor("LOPEZ ELENA");
        a3.setTeltutor("7471321335");
        a3.setOcupaciontutor("N/A");
        a3.setEstado("FUERA");
        a3.setFecha_ultima_asistencia("2026-07-08");
        a3.setQr_texto("14122678444109|XIMENA FLORES LOPEZ");
        a3.setQrCode("14122678444109|XIMENA FLORES LOPEZ");
        a3.setAula_especifica("N/A");
        alumnos.add(a3);

        // 14122678444104
        Alumno a4 = new Alumno();
        a4.setMatricula("14122678444104");
        a4.setNcontrol("14122678444104");
        a4.setCurp("SOSX110814MGR");
        a4.setNombre("XIMENA");
        a4.setApepat("SOSA");
        a4.setApemat("RIVERA");
        a4.setGenero("F");
        a4.setEmail("xime.sosa@gmail.com");
        a4.setCelular("7474005566");
        a4.setDireccion("Col. Guerrero");
        a4.setEspecialidad("CONTABILIDAD");
        a4.setGrado("2");
        a4.setGrupo("D");
        a4.setTurno("Vespertino");
        a4.setEstatus_escolar("Activo");
        a4.setEstatus("Activo");
        a4.setColor_semaforo("Verde");
        a4.setPerfil_completo(true);
        a4.setNombretutor("ELENA RIVERA");
        a4.setTeltutor("7477778899");
        a4.setOcupaciontutor("Ama de Casa");
        a4.setQr_texto("14122678444104|XIMENA SOSA RIVERA");
        a4.setQrCode("14122678444104|XIMENA SOSA RIVERA");
        alumnos.add(a4);

        // 14122678444103
        Alumno a5 = new Alumno();
        a5.setMatricula("14122678444103");
        a5.setNcontrol("14122678444103");
        a5.setCurp("RIZL100225HGR");
        a5.setNombre("LUIS");
        a5.setApepat("RUIZ");
        a5.setApemat("DIAZ");
        a5.setGenero("M");
        a5.setEmail("luis.rz@gmail.com");
        a5.setCelular("7473004455");
        a5.setDireccion("Fracc. Los Sauces");
        a5.setEspecialidad("MECATRÓNICA");
        a5.setGrado("6");
        a5.setGrupo("C");
        a5.setTurno("Matutino");
        a5.setEstatus_escolar("Activo");
        a5.setEstatus("Activo");
        a5.setColor_semaforo("Verde");
        a5.setPerfil_completo(true);
        a5.setNombretutor("JORGE RUIZ");
        a5.setTeltutor("7476667788");
        a5.setOcupaciontutor("Chofer");
        a5.setQr_texto("14122678444103|LUIS RUIZ DIAZ");
        a5.setQrCode("14122678444103|LUIS RUIZ DIAZ");
        alumnos.add(a5);

        // 14122678444107
        Alumno a6 = new Alumno();
        a6.setMatricula("14122678444107");
        a6.setNcontrol("14122678444107");
        a6.setCurp("RATS090415MGR");
        a6.setNombre("SOFIA");
        a6.setApepat("RAMIREZ");
        a6.setApemat("TORRES");
        a6.setGenero("F");
        a6.setEmail("");
        a6.setCelular("");
        a6.setDireccion("N/A");
        a6.setEspecialidad("CONSTRUCCIÓN");
        a6.setGrado("6");
        a6.setGrupo("B");
        a6.setTurno("Matutino");
        a6.setEstatus_escolar("Baja");
        a6.setEstatus("Baja");
        a6.setColor_semaforo("Verde");
        a6.setPerfil_completo(true);
        a6.setNombretutor("TORRES LUCIA");
        a6.setTeltutor("7478887766");
        a6.setOcupaciontutor("N/A");
        a6.setQr_texto("14122678444107|SOFIA RAMIREZ TORRES");
        a6.setQrCode("14122678444107|SOFIA RAMIREZ TORRES");
        alumnos.add(a6);

        // 14122678890122
        Alumno a7 = new Alumno();
        a7.setMatricula("14122678890122");
        a7.setNcontrol("14122678890122");
        a7.setCurp("GRAP900101HDFRNS10");
        a7.setNombre("Graciela");
        a7.setApepat("Castillo");
        a7.setApemat("Casares");
        a7.setEmail("graciela9cbtisk@gmail.com");
        a7.setCelular("1234567890");
        a7.setDireccion("CALLE JAZMIN NO. 18");
        a7.setEspecialidad("CONTABILIDAD");
        a7.setGrado("6");
        a7.setGrupo("D");
        a7.setTurno("Vespertino");
        a7.setPromedio(9.1);
        a7.setEscuela_procedencia("Wilfrido Massieu");
        a7.setNss("12345678900");
        a7.setColor_semaforo("Verde");
        a7.setAula_especifica("N/A");
        a7.setNombretutor("Jose");
        a7.setTeltutor("7472529153");
        a7.setOcupaciontutor("Trabajador");
        a7.setQr_url("14122678890122.png");
        a7.setEstado("FUERA");
        a7.setEstatus_escolar("Activo");
        a7.setEstatus("Activo");
        alumnos.add(a7);

        // 14122678444102
        Alumno a8 = new Alumno();
        a8.setMatricula("14122678444102");
        a8.setNcontrol("14122678444102");
        a8.setCurp("LOPA091102MGR");
        a8.setNombre("ANA");
        a8.setApepat("LOPEZ");
        a8.setApemat("PEREZ");
        a8.setGenero("F");
        a8.setEmail("ana.lpz@gmail.com");
        a8.setCelular("7472003344");
        a8.setDireccion("Barrio San Mateo");
        a8.setEspecialidad("CONSTRUCCIÓN");
        a8.setGrado("6");
        a8.setGrupo("B");
        a8.setTurno("Matutino");
        a8.setEstatus_escolar("Baja");
        a8.setEstatus("Baja");
        a8.setColor_semaforo("Verde");
        a8.setPerfil_completo(true);
        a8.setNombretutor("MARIA PEREZ");
        a8.setTeltutor("7475556677");
        a8.setOcupaciontutor("Comerciante");
        a8.setQr_texto("14122678444102|ANA LOPEZ PEREZ");
        a8.setQrCode("14122678444102|ANA LOPEZ PEREZ");
        alumnos.add(a8);

        // 12345678890123
        Alumno a9 = new Alumno();
        a9.setMatricula("12345678890123");
        a9.setNcontrol("12345678890123");
        a9.setNombre("Elian Salomón");
        a9.setApepat("Flores");
        a9.setApemat("Chavez");
        a9.setGenero("H");
        a9.setCurp("ESFC900101HDFRNS10");
        a9.setEmail("DrivenSaloo@gmail.com");
        a9.setCelular("1234567890");
        a9.setDireccion("CALLE JAZMIN NO. 18");
        a9.setEspecialidad("CONSTRUCCIÓN");
        a9.setGrado("6");
        a9.setGrupo("E");
        a9.setTurno("Matutino");
        a9.setEstatus_escolar("Activo");
        a9.setEstatus("Activo");
        a9.setColor_semaforo("Amarillo");
        a9.setEstado("FUERA");
        a9.setPerfil_completo(true);
        a9.setNombretutor("Angel");
        a9.setTeltutor("7472529153");
        a9.setOcupaciontutor("Trabajador");
        a9.setQr_texto("12345678890123|ELIAN SALOMÓN FLORES CHAVEZ");
        a9.setQrCode("12345678890123|ELIAN SALOMÓN FLORES CHAVEZ");
        a9.setAula_especifica("N/A");

        List<Map<String, Object>> padecimientos = new ArrayList<>();
        Map<String, Object> p1 = new HashMap<>();
        p1.put("tipo", "Discapacidad para leer");
        p1.put("gravedad", "Amarillo");
        p1.put("detalles", "");
        p1.put("fecha_registro", "2026-05-03T05:36:36.407Z");
        padecimientos.add(p1);

        Map<String, Object> p2 = new HashMap<>();
        p2.put("tipo", "Gastritis");
        p2.put("gravedad", "Amarillo");
        p2.put("detalles", "");
        p2.put("fecha_registro", "2026-05-03T05:42:39.303Z");
        padecimientos.add(p2);

        a9.setPadecimientos_registrados(padecimientos);
        alumnos.add(a9);

        // 14122678444101
        Alumno a10 = new Alumno();
        a10.setMatricula("14122678444101");
        a10.setNcontrol("14122678444101");
        a10.setCurp("GOMJ080512HGR");
        a10.setNombre("JUAN");
        a10.setApepat("GOMEZ");
        a10.setApemat("MARTINEZ");
        a10.setGenero("M");
        a10.setEmail("juan.go@gmail.com");
        a10.setCelular("7471002233");
        a10.setDireccion("Col. Centro");
        a10.setEspecialidad("PROGRAMACIÓN");
        a10.setGrado("2");
        a10.setGrupo("A");
        a10.setTurno("Vespertino");
        a10.setEstatus_escolar("Activo");
        a10.setEstatus("Activo");
        a10.setColor_semaforo("Verde");
        a10.setPerfil_completo(true);
        a10.setNombretutor("PEDRO GOMEZ");
        a10.setTeltutor("7474445566");
        a10.setOcupaciontutor("Albañil");
        a10.setQr_texto("14122678444101|JUAN GOMEZ MARTINEZ");
        a10.setQrCode("14122678444101|JUAN GOMEZ MARTINEZ");
        alumnos.add(a10);

        // 14122678444108
        Alumno a11 = new Alumno();
        a11.setMatricula("14122678444108");
        a11.setNcontrol("14122678444108");
        a11.setCurp("MACJ100730HGR");
        a11.setNombre("JORGE");
        a11.setApepat("MARTINEZ");
        a11.setApemat("CRUZ");
        a11.setGenero("M");
        a11.setEmail("");
        a11.setCelular("");
        a11.setDireccion("N/A");
        a11.setEspecialidad("CONTABILIDAD");
        a11.setGrado("6");
        a11.setGrupo("C");
        a11.setTurno("Vespertino");
        a11.setEstatus_escolar("Activo");
        a11.setEstatus("Activo");
        a11.setColor_semaforo("Verde");
        a11.setPerfil_completo(true);
        a11.setNombretutor("MARTINEZ RAUL");
        a11.setTeltutor("7477776655");
        a11.setOcupaciontutor("N/A");
        a11.setQr_texto("14122678444108|JORGE MARTINEZ CRUZ");
        a11.setQrCode("14122678444108|JORGE MARTINEZ CRUZ");
        alumnos.add(a11);

        // 14122678444110
        Alumno a12 = new Alumno();
        a12.setMatricula("14122678444110");
        a12.setNcontrol("14122678444110");
        a12.setCurp("CARA120310HGR");
        a12.setNombre("ALAN");
        a12.setApepat("CASTRO");
        a12.setApemat("RIVERA");
        a12.setGenero("M");
        a12.setEmail("");
        a12.setCelular("");
        a12.setDireccion("N/A");
        a12.setEspecialidad("E.COMMERCE");
        a12.setGrado("4");
        a12.setGrupo("E");
        a12.setTurno("Vespertino");
        a12.setEstatus_escolar("Activo");
        a12.setEstatus("Activo");
        a12.setColor_semaforo("Verde");
        a12.setPerfil_completo(true);
        a12.setNombretutor("RIVERA SONIA");
        a12.setTeltutor("7475554433");
        a12.setOcupaciontutor("N/A");
        a12.setQr_texto("14122678444110|ALAN CASTRO RIVERA");
        a12.setQrCode("14122678444110|ALAN CASTRO RIVERA");
        alumnos.add(a12);

        // 14122678444106
        Alumno a13 = new Alumno();
        a13.setMatricula("14122678444106");
        a13.setNcontrol("14122678444106");
        a13.setCurp("HESD080120HGR");
        a13.setNombre("DIEGO");
        a13.setApepat("HERNANDEZ");
        a13.setApemat("SANCHEZ");
        a13.setGenero("M");
        a13.setEmail("");
        a13.setCelular("");
        a13.setDireccion("N/A");
        a13.setEspecialidad("PROGRAMACIÓN");
        a13.setGrado("5");
        a13.setGrupo("A");
        a13.setTurno("Vespertino");
        a13.setEstatus_escolar("Activo");
        a13.setEstatus("Activo");
        a13.setColor_semaforo("Verde");
        a13.setPerfil_completo(true);
        a13.setNombretutor("HERNANDEZ MARCO");
        a13.setTeltutor("7479998877");
        a13.setOcupaciontutor("N/A");
        a13.setQr_texto("14122678444106|DIEGO HERNANDEZ SANCHEZ");
        a13.setQrCode("14122678444106|DIEGO HERNANDEZ SANCHEZ");
        alumnos.add(a13);

        return alumnos;
    }

    private void seederCalendario() {
        String col = "calendario";
        guardarSiNoExiste(col, "EVT_20260419_233357", new Document("_id", "EVT_20260419_233357")
                .append("title", "Evaluaciones de 3ra unidad")
                .append("start", "2026-04-27")
                .append("end", "2026-04-30")
                .append("allDay", true)
                .append("color", "#7b1b37")
                .append("creadoPor", "ADMIN"));

        guardarSiNoExiste(col, "EVT_20260528_014147", new Document("_id", "EVT_20260528_014147")
                .append("title", "Semana del Estudiante Tecnológico")
                .append("start", "2026-05-25")
                .append("end", "2026-05-30")
                .append("allDay", true)
                .append("color", "#7b1b37")
                .append("creadoPor", "ADMIN"));

        guardarSiNoExiste(col, "EVT_20260419_233415", new Document("_id", "EVT_20260419_233415")
                .append("title", "Dia del Trabajo")
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
                        new Document("alias", "IA").append("turno", "Vespertino").append("color", "#052c65").append("nombre", "INTELIGENCIA ARTIFICIAL")
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

    private void seederIncidencias() {
        String col = "incidencias";
        guardarSiNoExiste(col, "14122678444104_2026-04-24_1777013122257", new Document("_id", "14122678444104_2026-04-24_1777013122257")
                .append("folio_incidencia", "14122678444104_2026-04-24_1777013122257")
                .append("id_alumno", "14122678444104")
                .append("grado", 2).append("grupo", "D").append("especialidad", "CONTABILIDAD").append("ciclo", "FEB-JUL 2026")
                .append("faltas_checklist", Arrays.asList("AUSENTISMO EN CLASES", "PORTAR OBJETOS NO PERMITIDOS")));

        guardarSiNoExiste(col, "12345678890123_2026-05-04_1777875552290", new Document("_id", "12345678890123_2026-05-04_1777875552290")
                .append("folio_incidencia", "12345678890123_2026-05-04_1777875552290")
                .append("id_alumno", "12345678890123")
                .append("grado", 1).append("grupo", "E").append("especialidad", "CONSTRUCCIÓN").append("ciclo", "FEB-JUL 2026")
                .append("faltas_checklist", Arrays.asList("PROVOCAR DESORDEN EN LOS PASILLOS O AULAS", "FALTA DE RESPETO A SUS COMPAÑEROS", "FALTA DE RESPETO A PERSONAL DOCENTE, ADMINISTRATIVO SERVICIOS")));

        guardarSiNoExiste(col, "14122678444101_2026-05-04_1777877018465", new Document("_id", "14122678444101_2026-05-04_1777877018465")
                .append("folio_incidencia", "14122678444101_2026-05-04_1777877018465")
                .append("id_alumno", "14122678444101")
                .append("grado", 2).append("grupo", "A").append("especialidad", "PROGRAMACIÓN").append("ciclo", "FEB-JUL 2026")
                .append("faltas_checklist", Arrays.asList("NO CUMPLE CON LOS TRABAJOS ESCOLARES", "PROVOCAR DESORDEN EN LOS PASILLOS O AULAS")));
    }

    private void seederIncidenciasPersonal() {
        String col = "incidencias_personal";
        guardarSiNoExiste(col, "20260314_3763", new Document("_id", "20260314_3763")
                .append("clave_reporte", "20260314_3763")
                .append("interesado", "RAUL JIMENEZ")
                .append("jefe_personal", "C. LIC. JUANA MORALES APARICIO")
                .append("turno", "VESPERTINO")
                .append("fecha", "2026-03-14")
                .append("elaborado_por", "MANUAL"));

        guardarSiNoExiste(col, "20260503_2214", new Document("_id", "20260503_2214")
                .append("clave_reporte", "20260503_2214")
                .append("interesado", "JUAN DONOJU RAMIREZ")
                .append("jefe_personal", "C. LIC. JUANA MORALES APARICIO")
                .append("turno", "VESPERTINO")
                .append("fecha", "2026-05-03")
                .append("elaborado_por", "MANUAL"));
    }

    private void seederJustificantes() {
        String col = "justificantes";
        guardarSiNoExiste(col, "0001", new Document("_id", "0001")
                .append("folio_justificante", "0001")
                .append("id_alumno", "12345678890123")
                .append("grado", 1).append("grupo", "E").append("especialidad", "CONSTRUCCIÓN")
                .append("fecha_expedicion", "2026-04-22")
                .append("inasistencia_dia", "2026-04-23")
                .append("motivo_detalle", "PERSONALES (PADRE DEL ALUMNO COMINICÓ EL CASO PERSONALMENTE)."));
    }

    private void seederPasesSalida() {
        String col = "pases_salida";
        guardarSiNoExiste(col, "0001", new Document("_id", "0001")
                .append("folio_pase", "0001").append("matricula", "12345678890123")
                .append("es_grupal", false).append("grado", 1).append("grupo", "E").append("especialidad", "CONSTRUCCIÓN")
                .append("hora_salida", "20:44").append("motivo", "Se sentia enfermo, le dolía el estomago")
                .append("estatus_vigencia", true).append("fecha", "2026-04-23"));

        guardarSiNoExiste(col, "0002", new Document("_id", "0002")
                .append("folio_pase", "0002").append("matricula", "12345678890123")
                .append("es_grupal", false).append("grado", 1).append("grupo", "E").append("especialidad", "CONSTRUCCIÓN")
                .append("hora_salida", "10:15").append("motivo", "LE DUELE PANZA")
                .append("estatus_vigencia", true).append("fecha", "2026-04-27"));
    }

    private void seederRegistrosDiarios() {
        String col = "registros_diarios";
        guardarSiNoExiste(col, "2026-04-27_12345678890123", new Document("_id", "2026-04-27_12345678890123")
                .append("fecha", "2026-04-27").append("grado", "1").append("grupo", "E")
                .append("matricula", "12345678890123").append("especialidad", "CONSTRUCCIÓN")
                .append("nombre", "Elian Salomón").append("estatus_actual", "FUERA")
                .append("hora_entrada", "9:14:17 a.m.").append("hora_salida", "9:16:04 a.m.")
                .append("tipo_salida", "PASE AUTORIZADO"));
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
