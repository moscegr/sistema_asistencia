package com.cbtis134.sistema.config;

import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import jakarta.servlet.DispatcherType;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(UsuarioRepository usuarioRepository) {
        return username -> usuarioRepository.findByCorreo(username)
                .or(() -> usuarioRepository.findByCorreo(username.toLowerCase()))
                .filter(u -> !"DOCENTE".equalsIgnoreCase(u.getRol()) && !"ADMINISTRATIVO".equalsIgnoreCase(u.getRol()))
                .map(u -> new User(
                        u.getCorreo(),
                        u.getPassword() != null ? u.getPassword() : "",
                        List.of(new SimpleGrantedAuthority("ROLE_" + u.getRol().toUpperCase()))
                ))
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado o sin acceso a la plataforma: " + username));
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.FORWARD, DispatcherType.ERROR).permitAll()
                .requestMatchers("/", "/index", "/landing", "/login", "/css/**", "/js/**", "/img/**", "/qrs/**", "/models/**", "/error", "/favicon.ico", "/favicon.png", "/uploads/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/configuracion/sistema", "/api/configuracion/escolar").permitAll()
                
                // Endpoint para consultar datos y rol de la sesión activa
                .requestMatchers("/api/usuarios/me").authenticated()

                // --- REGLAS SEGURIDAD API ---
                .requestMatchers(HttpMethod.GET, "/api/usuarios/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST, "/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/usuarios/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.PATCH, "/api/usuarios/**").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers(HttpMethod.DELETE, "/api/usuarios/**").hasRole("ADMIN")

                // match /alumnos/{matricula}
                .requestMatchers(HttpMethod.GET, "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST, "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "GUARDIA")
                .requestMatchers(HttpMethod.PUT, "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "GUARDIA")
                .requestMatchers(HttpMethod.DELETE, "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "GUARDIA")

                // match /pases_salida/{paseId}
                .requestMatchers(HttpMethod.GET, "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST, "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")
                .requestMatchers(HttpMethod.PUT, "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")
                .requestMatchers(HttpMethod.DELETE, "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")

                // match /justificantes/{justificanteId}
                .requestMatchers(HttpMethod.GET, "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")
                .requestMatchers(HttpMethod.POST, "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION")
                .requestMatchers(HttpMethod.PUT, "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION")
                .requestMatchers(HttpMethod.DELETE, "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION")

                // match /incidencias_personal/{incidenciaId}
                .requestMatchers(HttpMethod.GET, "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO", "ORIENTACION")
                .requestMatchers(HttpMethod.POST, "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO")
                .requestMatchers(HttpMethod.PUT, "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO")
                .requestMatchers(HttpMethod.DELETE, "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO")

                // match /incidencias/{incidenciaId}
                .requestMatchers("/api/incidencias/**").hasAnyRole("ADMIN", "PREFECTO", "ORIENTACION")

                // match /registros_diarios/{registroId}
                .requestMatchers(HttpMethod.GET, "/api/registros-diarios/**").hasAnyRole("ADMIN", "PREFECTO", "GUARDIA", "ORIENTACION")
                .requestMatchers(HttpMethod.POST, "/api/registros-diarios/**").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers(HttpMethod.PUT, "/api/registros-diarios/**").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers(HttpMethod.DELETE, "/api/registros-diarios/**").hasAnyRole("ADMIN", "GUARDIA")

                // match /configuracion (Backup, restore, modificaciones críticas solo ADMIN)
                .requestMatchers("/api/configuracion/backup/**", "/api/configuracion/restore", "/api/configuracion/revertir-ciclo").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/configuracion/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST, "/api/configuracion/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/configuracion/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/configuracion/**").hasRole("ADMIN")

                // match /whatsapp
                .requestMatchers("/api/whatsapp/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")

                // match /calendario/{docId}
                .requestMatchers(HttpMethod.GET, "/api/calendario/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST, "/api/calendario/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/calendario/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/calendario/**").hasRole("ADMIN")

                // --- RUTAS VISTAS HTML POR ROL ---
                .requestMatchers("/admin/configuracion", "/admin/usuarios", "/admin/alumnos", "/admin/alumnos/nuevo", "/admin/alumnos/gestion-archivos", "/admin/alumnos/credenciales").hasRole("ADMIN")
                .requestMatchers("/admin/dashboard", "/admin/alumnos/expediente", "/admin/expediente_alumno", "/admin/alumnos/seguimiento-conductual", "/admin/alumnos/monitoreo-salud", "/admin/pases").hasAnyRole("ADMIN", "PREFECTO", "ORIENTACION")
                .requestMatchers("/admin/justificantes", "/admin/incidencias/orientacion").hasAnyRole("ADMIN", "ORIENTACION")
                .requestMatchers("/admin/incidencias/prefectura").hasAnyRole("ADMIN", "PREFECTO")
                .requestMatchers("/admin/escaneo").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers("/admin/**").authenticated()
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .successHandler((request, response, authentication) -> {
                    boolean isGuardia = authentication.getAuthorities().stream()
                            .anyMatch(a -> a.getAuthority().contains("GUARDIA"));
                    if (isGuardia) {
                        response.sendRedirect("/admin/escaneo");
                    } else {
                        response.sendRedirect("/admin/dashboard");
                    }
                })
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("JSESSIONID", "AuthToken", "remember-me")
                .permitAll()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.sendRedirect("/login");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("GUARDIA"))) {
                        response.sendRedirect("/admin/escaneo");
                    } else {
                        response.sendRedirect("/admin/dashboard");
                    }
                })
            );
            
        return http.build();
    }
}