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
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // ─── Constantes de Rate Limiting ───────────────────────────────────────────
    private static final int MAX_INTENTOS_LOGIN   = 5;   // intentos máximos
    private static final long VENTANA_BLOQUEO_MS  = 15L * 60 * 1000; // 15 minutos

    // Mapa en memoria: IP → [intentos, timestamp primer intento]
    private final Map<String, long[]> loginAttempts = new ConcurrentHashMap<>();

    // ─── BCrypt con strength 12 (más seguro que el default 10) ─────────────────
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    // ─── UserDetailsService ─────────────────────────────────────────────────────
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
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado o sin acceso: " + username));
    }

    // ─── Rate-Limiting Filter (brute-force en /login) ───────────────────────────
    private OncePerRequestFilter loginRateLimitFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain filterChain)
                    throws ServletException, IOException {

                boolean esPostLogin = "POST".equalsIgnoreCase(request.getMethod())
                        && "/login".equals(request.getServletPath());

                if (esPostLogin) {
                    String ip = obtenerIpReal(request);
                    long ahora = Instant.now().toEpochMilli();
                    long[] estado = loginAttempts.computeIfAbsent(ip, k -> new long[]{0, ahora});

                    // Reiniciar ventana si ya pasaron los 15 minutos
                    if (ahora - estado[1] > VENTANA_BLOQUEO_MS) {
                        estado[0] = 0;
                        estado[1] = ahora;
                    }

                    estado[0]++;

                    if (estado[0] > MAX_INTENTOS_LOGIN) {
                        long espera = (VENTANA_BLOQUEO_MS - (ahora - estado[1])) / 1000;
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("text/html;charset=UTF-8");
                        response.getWriter().write(
                            "<html><body><h2>Demasiados intentos fallidos.</h2>" +
                            "<p>Tu IP ha sido bloqueada temporalmente. Intenta de nuevo en " + espera + " segundos.</p></body></html>"
                        );
                        return;
                    }
                }
                filterChain.doFilter(request, response);
            }

            /** Obtiene la IP real considerando proxies y Traefik (Coolify) */
            private String obtenerIpReal(HttpServletRequest request) {
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                    return xForwardedFor.split(",")[0].trim();
                }
                String xRealIp = request.getHeader("X-Real-IP");
                if (xRealIp != null && !xRealIp.isBlank()) {
                    return xRealIp.trim();
                }
                return request.getRemoteAddr();
            }
        };
    }

    // ─── Security Filter Chain ──────────────────────────────────────────────────
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            // ── CSRF: habilitado para rutas HTML (formularios), deshabilitado para /api/** ──
            .csrf(csrf -> csrf
                .ignoringRequestMatchers(new AntPathRequestMatcher("/api/**"))
            )

            // ── Cabeceras de seguridad HTTP ──────────────────────────────────────
            .headers(headers -> headers
                // Evitar clickjacking
                .frameOptions(fo -> fo.deny())
                // Forzar HTTPS por 1 año (incluye subdominios)
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                )
                // No inferir Content-Type
                .contentTypeOptions(cto -> {})
                // Referrer mínimo
                .referrerPolicy(rp -> rp
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                )
                // Permissions-Policy via header writer (compatible Spring Security 6.x)
                .addHeaderWriter((req, res) ->
                    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
                )
                // Content-Security-Policy
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
                        "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com " +
                        "https://cdn.sweetalert2.com https://unpkg.com; " +
                    "style-src 'self' 'unsafe-inline' " +
                        "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
                    "img-src 'self' data: blob:; " +
                    "connect-src 'self'; " +
                    "frame-ancestors 'none'; " +
                    "form-action 'self';"
                ))
            )

            // ── Rutas públicas y protegidas ──────────────────────────────────────
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.FORWARD, DispatcherType.ERROR).permitAll()
                // Recursos estáticos públicos (SIN /uploads que contiene datos de alumnos)
                .requestMatchers(
                    "/", "/index", "/landing", "/login",
                    "/css/**", "/js/**", "/img/**", "/qrs/**",
                    "/models/**", "/error", "/favicon.ico", "/favicon.png"
                ).permitAll()
                // Configuración pública de lectura (nombre del plantel, logo, etc.)
                .requestMatchers(HttpMethod.GET, "/api/configuracion/sistema", "/api/configuracion/escolar").permitAll()

                // /uploads REQUIERE autenticación (fotos de alumnos son datos sensibles)
                .requestMatchers("/uploads/**").authenticated()

                // Endpoint para consultar datos y rol de la sesión activa
                .requestMatchers("/api/usuarios/me").authenticated()

                // --- REGLAS SEGURIDAD API ---
                .requestMatchers(HttpMethod.GET,    "/api/usuarios/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST,   "/api/usuarios/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/usuarios/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.PATCH,  "/api/usuarios/**").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers(HttpMethod.DELETE, "/api/usuarios/**").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET,    "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST,   "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "GUARDIA")
                .requestMatchers(HttpMethod.PUT,    "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "GUARDIA")
                .requestMatchers(HttpMethod.PATCH,  "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION", "GUARDIA")
                .requestMatchers(HttpMethod.DELETE, "/api/alumnos/**").hasAnyRole("ADMIN", "ORIENTACION")

                .requestMatchers(HttpMethod.GET,    "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST,   "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")
                .requestMatchers(HttpMethod.PUT,    "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")
                .requestMatchers(HttpMethod.DELETE, "/api/pases/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")

                .requestMatchers(HttpMethod.GET,    "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO")
                .requestMatchers(HttpMethod.POST,   "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION")
                .requestMatchers(HttpMethod.PUT,    "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION")
                .requestMatchers(HttpMethod.DELETE, "/api/justificantes/**").hasAnyRole("ADMIN", "ORIENTACION")

                .requestMatchers(HttpMethod.GET,    "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO", "ORIENTACION")
                .requestMatchers(HttpMethod.POST,   "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO")
                .requestMatchers(HttpMethod.PUT,    "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO")
                .requestMatchers(HttpMethod.DELETE, "/api/incidencias/personal/**").hasAnyRole("ADMIN", "PREFECTO")
                .requestMatchers(                   "/api/incidencias/**").hasAnyRole("ADMIN", "PREFECTO", "ORIENTACION")

                .requestMatchers(HttpMethod.GET,    "/api/registros-diarios/**").hasAnyRole("ADMIN", "PREFECTO", "GUARDIA", "ORIENTACION")
                .requestMatchers(HttpMethod.POST,   "/api/registros-diarios/**").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers(HttpMethod.PUT,    "/api/registros-diarios/**").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers(HttpMethod.DELETE, "/api/registros-diarios/**").hasAnyRole("ADMIN", "GUARDIA")

                // Configuración — operaciones críticas solo ADMIN
                .requestMatchers("/api/configuracion/backup/**", "/api/configuracion/restore", "/api/configuracion/revertir-ciclo").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET,    "/api/configuracion/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST,   "/api/configuracion/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/configuracion/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/configuracion/**").hasRole("ADMIN")

                .requestMatchers("/api/whatsapp/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")

                .requestMatchers(HttpMethod.GET,    "/api/calendario/**").hasAnyRole("ADMIN", "ORIENTACION", "PREFECTO", "GUARDIA")
                .requestMatchers(HttpMethod.POST,   "/api/calendario/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT,    "/api/calendario/**").hasRole("ADMIN")
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

            // ── Rate Limiting en formulario de login ─────────────────────────────
            .addFilterBefore(loginRateLimitFilter(), UsernamePasswordAuthenticationFilter.class)

            // ── Formulario de login ──────────────────────────────────────────────
            .formLogin(form -> form
                .loginPage("/login")
                .successHandler((request, response, authentication) -> {
                    // Limpiar conteo de intentos fallidos al loguearse bien
                    loginAttempts.remove(obtenerIpReal(request));
                    boolean isGuardia = authentication.getAuthorities().stream()
                            .anyMatch(a -> a.getAuthority().contains("GUARDIA"));
                    if (isGuardia) {
                        response.sendRedirect("/admin/escaneo");
                    } else {
                        response.sendRedirect("/admin/dashboard");
                    }
                })
                .failureUrl("/login?error")
                .permitAll()
            )

            // ── Logout ───────────────────────────────────────────────────────────
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login?logout")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("JSESSIONID", "AuthToken", "remember-me")
                .permitAll()
            )

            // ── Manejo de errores de acceso ──────────────────────────────────────
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

    /** Helper para obtener IP real desde encabezados de proxy (reutilizable fuera del filtro) */
    private String obtenerIpReal(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}