package com.cbtis134.sistema.config;

import com.cbtis134.sistema.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
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

    private static final Logger APP_LOG = LoggerFactory.getLogger(SecurityConfig.class);

    // ─── Constantes de Rate Limiting ───────────────────────────────────────────
    private static final int MAX_INTENTOS_LOGIN   = 15;  // intentos máximos permitidos
    private static final long VENTANA_BLOQUEO_MS  = 5L * 60 * 1000; // 5 minutos de ventana

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
        return username -> {
            String cleanUsername = (username != null) ? username.trim() : "";
            APP_LOG.info("Intento de autenticación para usuario: '{}'", cleanUsername);
            return usuarioRepository.findByCorreoIgnoreCase(cleanUsername)
                    .or(() -> usuarioRepository.findByCorreo(cleanUsername))
                    .filter(u -> !"DOCENTE".equalsIgnoreCase(u.getRol()) && !"ADMINISTRATIVO".equalsIgnoreCase(u.getRol()))
                    .map(u -> new User(
                            u.getCorreo(),
                            u.getPassword() != null ? u.getPassword() : "",
                            List.of(new SimpleGrantedAuthority("ROLE_" + (u.getRol() != null ? u.getRol().toUpperCase() : "ADMIN")))
                    ))
                    .orElseThrow(() -> {
                        APP_LOG.warn("Usuario no encontrado o sin acceso en MongoDB: '{}'", cleanUsername);
                        return new UsernameNotFoundException("Usuario no encontrado o sin acceso: " + cleanUsername);
                    });
        };
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
                    long[] estado = loginAttempts.get(ip);

                    if (estado != null) {
                        // Reiniciar si la ventana de bloqueo ya expiró
                        if (ahora - estado[1] > VENTANA_BLOQUEO_MS) {
                            loginAttempts.remove(ip);
                        } else if (estado[0] >= MAX_INTENTOS_LOGIN) {
                            long espera = Math.max(1, (VENTANA_BLOQUEO_MS - (ahora - estado[1])) / 1000);
                            APP_LOG.warn("IP bloqueada por exceso de intentos fallidos: {} (Espera restante: {}s)", ip, espera);
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("text/html;charset=UTF-8");
                            response.getWriter().write(
                                "<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'><title>Acceso Bloqueado</title>" +
                                "<style>body{font-family:system-ui,sans-serif;background:#0d1117;color:#f0f6fc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}" +
                                ".card{background:#161b22;padding:32px;border-radius:12px;border:1px solid #30363d;max-width:440px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.5);}" +
                                "h2{color:#f85149;margin-bottom:12px;}p{color:#8b949e;line-height:1.6;}.btn{display:inline-block;margin-top:20px;padding:10px 20px;background:#7b1b37;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;}</style></head>" +
                                "<body><div class='card'><h2>Demasiados intentos fallidos</h2>" +
                                "<p>Tu dirección IP (<code>" + ip + "</code>) ha sido bloqueada temporalmente por protección contra fuerza bruta.</p>" +
                                "<p>Por favor espera <b>" + espera + " segundos</b> antes de volver a intentar.</p>" +
                                "<a href='/login' class='btn'>Volver al Login</a>" +
                                "</div></body></html>"
                            );
                            return;
                        }
                    }
                }
                filterChain.doFilter(request, response);
            }
        };
    }

    // ─── Security Filter Chain ──────────────────────────────────────────────────
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
            // ── CSRF: habilitado para rutas HTML (formularios), deshabilitado para /api/** y /logout ──
            .csrf(csrf -> csrf
                .ignoringRequestMatchers(
                    new AntPathRequestMatcher("/api/**"),
                    new AntPathRequestMatcher("/logout")
                )
            )
            // Asegurar resolución del token CSRF y creación de sesión en cabecera HTTP antes de que
            // comience el renderizado de plantillas HTML (evita commit temprano del buffer en Tomcat)
            .addFilterAfter(new OncePerRequestFilter() {
                @Override
                protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                        throws ServletException, IOException {
                    CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
                    if (csrfToken != null) {
                        csrfToken.getToken();
                    }
                    filterChain.doFilter(request, response);
                }
            }, CsrfFilter.class)

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
                // Permissions-Policy via header writer (permitir cámara para Punto de Control / FaceID)
                .addHeaderWriter((req, res) ->
                    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()")
                )
                // Content-Security-Policy
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
                        "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com " +
                        "https://cdn.sweetalert2.com https://unpkg.com " +
                        "https://maps.googleapis.com https://maps.gstatic.com; " +
                    "style-src 'self' 'unsafe-inline' " +
                        "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com " +
                        "https://fonts.googleapis.com https://maps.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    // Imágenes: self + data URIs + blobs + Google Maps tiles + cualquier https (fotos externas)
                    "img-src 'self' data: blob: https:; " +
                    // Media (video/cámara web, streams para QR y FaceID)
                    "media-src 'self' blob: data: mediastream:; " +
                    // Workers (para procesamiento facial y decodificación QR en hilos secundarios)
                    "worker-src 'self' blob:; " +
                    // Conexiones: self + blobs + APIs de mapas
                    "connect-src 'self' blob: data: https://maps.googleapis.com https://*.googleapis.com; " +
                    // Iframes: Google Maps embed
                    "frame-src https://www.google.com https://maps.google.com https://maps.googleapis.com; " +
                    "frame-ancestors 'none'; " +
                    "form-action 'self';"
                ))
            )

            // ── Rutas públicas y protegidas ──────────────────────────────────────
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.FORWARD, DispatcherType.ERROR).permitAll()
                // Recursos estáticos públicos (SIN /uploads que contiene datos de alumnos)
                .requestMatchers(
                    "/", "/index", "/landing", "/login", "/login/**", "/logout",
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
                .requestMatchers("/admin/escaneo", "/escaneo").hasAnyRole("ADMIN", "GUARDIA")
                .requestMatchers("/admin", "/admin/**", "/dashboard").authenticated()
                .anyRequest().authenticated()
            )

            // ── Rate Limiting en formulario de login ─────────────────────────────
            .addFilterBefore(loginRateLimitFilter(), UsernamePasswordAuthenticationFilter.class)

            // ── Formulario de login ──────────────────────────────────────────────
            .formLogin(form -> form
                .loginPage("/login")
                .successHandler((request, response, authentication) -> {
                    String ip = obtenerIpReal(request);
                    loginAttempts.remove(ip);
                    APP_LOG.info("Login EXITOSO para usuario: '{}' desde IP: {}", authentication.getName(), ip);
                    boolean isGuardia = authentication.getAuthorities().stream()
                            .anyMatch(a -> a.getAuthority().contains("GUARDIA"));
                    if (isGuardia) {
                        response.sendRedirect("/admin/escaneo");
                    } else {
                        response.sendRedirect("/admin/dashboard");
                    }
                })
                .failureHandler((request, response, exception) -> {
                    String ip = obtenerIpReal(request);
                    long ahora = Instant.now().toEpochMilli();
                    long[] estado = loginAttempts.computeIfAbsent(ip, k -> new long[]{0, ahora});

                    if (ahora - estado[1] > VENTANA_BLOQUEO_MS) {
                        estado[0] = 0;
                        estado[1] = ahora;
                    }
                    estado[0]++;

                    String username = request.getParameter("username");
                    APP_LOG.warn("Intento de login FALLIDO ({}/{}) para usuario: '{}' desde IP: {}. Motivo: {}",
                            estado[0], MAX_INTENTOS_LOGIN, username, ip, exception.getMessage());

                    response.sendRedirect("/login?error");
                })
                .permitAll()
            )

            // ── Logout (Soporta GET y POST con o sin token CSRF) ────────────────
            .logout(logout -> logout
                .logoutRequestMatcher(new AntPathRequestMatcher("/logout"))
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
                    if (auth != null && auth.isAuthenticated() && !(auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)) {
                        if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("GUARDIA"))) {
                            response.sendRedirect("/admin/escaneo");
                        } else {
                            response.sendRedirect("/admin/dashboard");
                        }
                    } else {
                        response.sendRedirect("/login");
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