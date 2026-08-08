package com.cbtis134.sistema.config;

import com.cbtis134.sistema.model.Alumno;
import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.AlumnoRepository;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
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
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String envEmail = System.getenv("ADMIN_EMAIL");
        String envPass = System.getenv("ADMIN_PASSWORD");

        String adminEmail = (envEmail != null && !envEmail.trim().isEmpty()) ? envEmail : "koyer.pop@gmail.com";
        String adminPassword = (envPass != null && !envPass.trim().isEmpty()) ? envPass : "kike1992";

        try {
            // 1. Sembrar Administrador Principal
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
                System.out.println("=== [SEEDER] Administrador inicial creado: " + adminEmail);
            }

            // 2. Sembrar Usuarios del JSON (Omitir los existentes)
            seederUsuarios();

            // 3. Sembrar Alumnos del JSON (Omitir los existentes)
            seederAlumnos();

            System.out.println("=== [SEEDER] Proceso de siembra finalizado correctamente. ===");

        } catch (Exception e) {
            System.err.println("=== [SEEDER] Error durante la siembra de datos: " + e.getMessage());
        }
    }

    private void seederUsuarios() {
        List<UsuarioSeed> usuariosData = Arrays.asList(
            new UsuarioSeed("2MNSM3eLm4QjGMFZk7KZUlK7v8m1", "Juan Jeus Garcia", "jesus1@gmail.com", "GUARDIA", "cbtis134"),
            new UsuarioSeed("5HXPsUCs1VdEratsqFDx0PIbbfF3", "Pedro Prefecto", "prefect1@gmail.com", "PREFECTO", "cbtis134"),
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
                System.out.println("=== [SEEDER] Usuario registrado: " + u.correo + " (Rol: " + u.rol + ")");
            }
        }
    }

    private void seederAlumnos() {
        List<Alumno> listaAlumnos = crearListaAlumnosSeed();

        for (Alumno a : listaAlumnos) {
            String matricula = a.getMatricula();
            if (alumnoRepository.findByNcontrol(matricula).isEmpty()) {
                alumnoRepository.save(a);
                System.out.println("=== [SEEDER] Alumno registrado: " + matricula + " - " + a.getNombre() + " " + a.getApepat());
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

        // 12345678890123
        Alumno a2 = new Alumno();
        a2.setMatricula("12345678890123");
        a2.setNcontrol("12345678890123");
        a2.setNombre("Elian Salomón");
        a2.setApepat("Flores");
        a2.setApemat("Chavez");
        a2.setGenero("H");
        a2.setCurp("ESFC900101HDFRNS10");
        a2.setEmail("DrivenSaloo@gmail.com");
        a2.setCelular("1234567890");
        a2.setDireccion("CALLE JAZMIN NO. 18");
        a2.setEspecialidad("CONSTRUCCIÓN");
        a2.setGrado("6");
        a2.setGrupo("E");
        a2.setTurno("Matutino");
        a2.setEstatus_escolar("Activo");
        a2.setEstatus("Activo");
        a2.setColor_semaforo("Amarillo");
        a2.setEstado("FUERA");
        a2.setPerfil_completo(true);
        a2.setNombretutor("Angel");
        a2.setTeltutor("7472529153");
        a2.setOcupaciontutor("Trabajador");
        a2.setQr_texto("12345678890123|ELIAN SALOMÓN FLORES CHAVEZ");
        a2.setQrCode("12345678890123|ELIAN SALOMÓN FLORES CHAVEZ");
        a2.setAula_especifica("N/A");
        alumnos.add(a2);

        // 14122678444101
        Alumno a3 = new Alumno();
        a3.setMatricula("14122678444101");
        a3.setNcontrol("14122678444101");
        a3.setCurp("GOMJ080512HGR");
        a3.setNombre("JUAN");
        a3.setApepat("GOMEZ");
        a3.setApemat("MARTINEZ");
        a3.setGenero("M");
        a3.setEmail("juan.go@gmail.com");
        a3.setCelular("7471002233");
        a3.setDireccion("Col. Centro");
        a3.setEspecialidad("PROGRAMACIÓN");
        a3.setGrado("2");
        a3.setGrupo("A");
        a3.setTurno("Vespertino");
        a3.setEstatus_escolar("Activo");
        a3.setEstatus("Activo");
        a3.setColor_semaforo("Verde");
        a3.setPerfil_completo(true);
        a3.setNombretutor("PEDRO GOMEZ");
        a3.setTeltutor("7474445566");
        a3.setOcupaciontutor("Albañil");
        a3.setQr_texto("14122678444101|JUAN GOMEZ MARTINEZ");
        a3.setQrCode("14122678444101|JUAN GOMEZ MARTINEZ");
        alumnos.add(a3);

        // 14122678444102
        Alumno a4 = new Alumno();
        a4.setMatricula("14122678444102");
        a4.setNcontrol("14122678444102");
        a4.setCurp("LOPA091102MGR");
        a4.setNombre("ANA");
        a4.setApepat("LOPEZ");
        a4.setApemat("PEREZ");
        a4.setGenero("F");
        a4.setEmail("ana.lpz@gmail.com");
        a4.setCelular("7472003344");
        a4.setDireccion("Barrio San Mateo");
        a4.setEspecialidad("CONSTRUCCIÓN");
        a4.setGrado("6");
        a4.setGrupo("B");
        a4.setTurno("Matutino");
        a4.setEstatus_escolar("Baja");
        a4.setEstatus("Baja");
        a4.setColor_semaforo("Verde");
        a4.setPerfil_completo(true);
        a4.setNombretutor("MARIA PEREZ");
        a4.setTeltutor("7475556677");
        a4.setOcupaciontutor("Comerciante");
        a4.setQr_texto("14122678444102|ANA LOPEZ PEREZ");
        a4.setQrCode("14122678444102|ANA LOPEZ PEREZ");
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

        // 14122678444104
        Alumno a6 = new Alumno();
        a6.setMatricula("14122678444104");
        a6.setNcontrol("14122678444104");
        a6.setCurp("SOSX110814MGR");
        a6.setNombre("XIMENA");
        a6.setApepat("SOSA");
        a6.setApemat("RIVERA");
        a6.setGenero("F");
        a6.setEmail("xime.sosa@gmail.com");
        a6.setCelular("7474005566");
        a6.setDireccion("Col. Guerrero");
        a6.setEspecialidad("CONTABILIDAD");
        a6.setGrado("2");
        a6.setGrupo("D");
        a6.setTurno("Vespertino");
        a6.setEstatus_escolar("Activo");
        a6.setEstatus("Activo");
        a6.setColor_semaforo("Verde");
        a6.setPerfil_completo(true);
        a6.setNombretutor("ELENA RIVERA");
        a6.setTeltutor("7477778899");
        a6.setOcupaciontutor("Ama de Casa");
        a6.setQr_texto("14122678444104|XIMENA SOSA RIVERA");
        a6.setQrCode("14122678444104|XIMENA SOSA RIVERA");
        alumnos.add(a6);

        // 14122678444105
        Alumno a7 = new Alumno();
        a7.setMatricula("14122678444105");
        a7.setNcontrol("14122678444105");
        a7.setCurp("SAOK030412HGRNJVA4");
        a7.setNombre("ALAN");
        a7.setApepat("");
        a7.setApemat("ORTIZ");
        a7.setGenero("M");
        a7.setEmail("alan.mor@gmail.com");
        a7.setCelular("5121313123");
        a7.setDireccion("Col. Industrial");
        a7.setEspecialidad("LABORATORISTA CLÍNICO");
        a7.setGrado("4");
        a7.setGrupo("E");
        a7.setTurno("Matutino");
        a7.setEstatus_escolar("Activo");
        a7.setEstatus("Activo");
        a7.setColor_semaforo("Verde");
        a7.setPerfil_completo(true);
        a7.setNombretutor("RAUL MORALES");
        a7.setTeltutor("7478889900");
        a7.setOcupaciontutor("Empleado");
        a7.setQr_texto("14122678444105|ALAN  ORTIZ");
        a7.setQrCode("14122678444105|ALAN  ORTIZ");
        a7.setAula_especifica("N/A");
        alumnos.add(a7);

        // 14122678444106
        Alumno a8 = new Alumno();
        a8.setMatricula("14122678444106");
        a8.setNcontrol("14122678444106");
        a8.setCurp("HESD080120HGR");
        a8.setNombre("DIEGO");
        a8.setApepat("HERNANDEZ");
        a8.setApemat("SANCHEZ");
        a8.setGenero("M");
        a8.setEmail("");
        a8.setCelular("");
        a8.setDireccion("N/A");
        a8.setEspecialidad("PROGRAMACIÓN");
        a8.setGrado("5");
        a8.setGrupo("A");
        a8.setTurno("Vespertino");
        a8.setEstatus_escolar("Activo");
        a8.setEstatus("Activo");
        a8.setColor_semaforo("Verde");
        a8.setPerfil_completo(true);
        a8.setNombretutor("HERNANDEZ MARCO");
        a8.setTeltutor("7479998877");
        a8.setOcupaciontutor("N/A");
        a8.setQr_texto("14122678444106|DIEGO HERNANDEZ SANCHEZ");
        a8.setQrCode("14122678444106|DIEGO HERNANDEZ SANCHEZ");
        alumnos.add(a8);

        // 14122678444107
        Alumno a9 = new Alumno();
        a9.setMatricula("14122678444107");
        a9.setNcontrol("14122678444107");
        a9.setCurp("RATS090415MGR");
        a9.setNombre("SOFIA");
        a9.setApepat("RAMIREZ");
        a9.setApemat("TORRES");
        a9.setGenero("F");
        a9.setEmail("");
        a9.setCelular("");
        a9.setDireccion("N/A");
        a9.setEspecialidad("CONSTRUCCIÓN");
        a9.setGrado("6");
        a9.setGrupo("B");
        a9.setTurno("Matutino");
        a9.setEstatus_escolar("Baja");
        a9.setEstatus("Baja");
        a9.setColor_semaforo("Verde");
        a9.setPerfil_completo(true);
        a9.setNombretutor("TORRES LUCIA");
        a9.setTeltutor("7478887766");
        a9.setOcupaciontutor("N/A");
        a9.setQr_texto("14122678444107|SOFIA RAMIREZ TORRES");
        a9.setQrCode("14122678444107|SOFIA RAMIREZ TORRES");
        alumnos.add(a9);

        // 14122678444108
        Alumno a10 = new Alumno();
        a10.setMatricula("14122678444108");
        a10.setNcontrol("14122678444108");
        a10.setCurp("MACJ100730HGR");
        a10.setNombre("JORGE");
        a10.setApepat("MARTINEZ");
        a10.setApemat("CRUZ");
        a10.setGenero("M");
        a10.setEmail("");
        a10.setCelular("");
        a10.setDireccion("N/A");
        a10.setEspecialidad("CONTABILIDAD");
        a10.setGrado("6");
        a10.setGrupo("C");
        a10.setTurno("Vespertino");
        a10.setEstatus_escolar("Activo");
        a10.setEstatus("Activo");
        a10.setColor_semaforo("Verde");
        a10.setPerfil_completo(true);
        a10.setNombretutor("MARTINEZ RAUL");
        a10.setTeltutor("7477776655");
        a10.setOcupaciontutor("N/A");
        a10.setQr_texto("14122678444108|JORGE MARTINEZ CRUZ");
        a10.setQrCode("14122678444108|JORGE MARTINEZ CRUZ");
        alumnos.add(a10);

        // 14122678444109
        Alumno a11 = new Alumno();
        a11.setMatricula("14122678444109");
        a11.setNcontrol("14122678444109");
        a11.setCurp("GOME950321MGRDPN08");
        a11.setNombre("XIMENA");
        a11.setApepat("FLORES");
        a11.setApemat("LOPEZ");
        a11.setGenero("M");
        a11.setEmail("ksjvjhv@gmail.com");
        a11.setCelular("1234567890");
        a11.setDireccion("N/A");
        a11.setEspecialidad("CONTABILIDAD");
        a11.setGrado("5");
        a11.setGrupo("D");
        a11.setTurno("Vespertino");
        a11.setEstatus_escolar("Activo");
        a11.setEstatus("Activo");
        a11.setColor_semaforo("Verde");
        a11.setPerfil_completo(true);
        a11.setNombretutor("LOPEZ ELENA");
        a11.setTeltutor("7471321335");
        a11.setOcupaciontutor("N/A");
        a11.setEstado("FUERA");
        a11.setFecha_ultima_asistencia("2026-07-08");
        a11.setQr_texto("14122678444109|XIMENA FLORES LOPEZ");
        a11.setQrCode("14122678444109|XIMENA FLORES LOPEZ");
        a11.setAula_especifica("N/A");
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

        // 14122678890122
        Alumno a13 = new Alumno();
        a13.setMatricula("14122678890122");
        a13.setNcontrol("14122678890122");
        a13.setCurp("GRAP900101HDFRNS10");
        a13.setNombre("Graciela");
        a13.setApepat("Castillo");
        a13.setApemat("Casares");
        a13.setEmail("graciela9cbtisk@gmail.com");
        a13.setCelular("1234567890");
        a13.setDireccion("CALLE JAZMIN NO. 18");
        a13.setEspecialidad("CONTABILIDAD");
        a13.setGrado("6");
        a13.setGrupo("D");
        a13.setTurno("Vespertino");
        a13.setPromedio(9.1);
        a13.setEscuela_procedencia("Wilfrido Massieu");
        a13.setNss("12345678900");
        a13.setColor_semaforo("Verde");
        a13.setAula_especifica("N/A");
        a13.setNombretutor("Jose");
        a13.setTeltutor("7472529153");
        a13.setOcupaciontutor("Trabajador");
        a13.setQr_url("14122678890122.png");
        a13.setEstado("FUERA");
        a13.setEstatus_escolar("Activo");
        a13.setEstatus("Activo");
        alumnos.add(a13);

        return alumnos;
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
