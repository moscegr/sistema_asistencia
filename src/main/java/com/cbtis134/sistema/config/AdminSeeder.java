package com.cbtis134.sistema.config;

import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.UUID;

@Component
public class AdminSeeder implements ApplicationRunner {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String envEmail = System.getenv("ADMIN_EMAIL");
        String envPass = System.getenv("ADMIN_PASSWORD");

        String adminEmail = (envEmail != null && !envEmail.trim().isEmpty()) ? envEmail : "koyer.pop@gmail.com";
        String adminPassword = (envPass != null && !envPass.trim().isEmpty()) ? envPass : "kike1992";

        try {
            if (!usuarioRepository.existsByCorreo(adminEmail)) {
                System.out.println("=== [SEEDER] Base de datos de MongoDB lista. Sembrando Administrador inicial... ===");

                Usuario admin = new Usuario();
                admin.setUid(UUID.randomUUID().toString());
                admin.setCorreo(adminEmail);
                admin.setPassword(passwordEncoder.encode(adminPassword));
                admin.setNombre("Administrador Inicial");
                admin.setRol("ADMIN");
                admin.setEstatus("Activo");
                admin.setUltimoAcceso("Primer acceso pendiente");
                admin.setPermisos(Arrays.asList("ALL"));

                usuarioRepository.save(admin);

                System.out.println("==================================================================");
                System.out.println("¡SISTEMA INICIALIZADO CON ÉXITO EN MONGODB!");
                System.out.println("Correo Administrador: " + adminEmail);
                System.out.println("Contraseña: [CONFIGURADA CON SEGURIDAD BCrypt]");
                System.out.println("==================================================================");
            } else {
                System.out.println("=== [SEEDER] El usuario administrador (" + adminEmail + ") ya existe en MongoDB. Omitiendo siembra. ===");
            }
        } catch (Exception e) {
            System.err.println("=== [SEEDER] Fallo en la siembra inicial de MongoDB: " + e.getMessage());
        }
    }
}
