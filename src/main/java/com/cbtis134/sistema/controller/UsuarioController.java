package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.config.ImageOptimizer;
import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping("/me")
    public ResponseEntity<?> obtenerUsuarioActual(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body("No autenticado");
        }
        String correo = authentication.getName();
        return usuarioRepository.findByCorreoIgnoreCase(correo)
                .or(() -> usuarioRepository.findByCorreo(correo))
                .map(u -> {
                    if (u.getNombre() != null) u.setNombre(u.getNombre().toUpperCase());
                    migrarFotoUsuarioSiBase64(u);
                    return ResponseEntity.ok((Object) u);
                })
                .orElseGet(() -> {
                    Usuario u = new Usuario();
                    u.setCorreo(correo);
                    u.setNombre(correo.contains("@") ? correo.substring(0, correo.indexOf('@')).toUpperCase() : correo.toUpperCase());
                    boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("ADMIN"));
                    boolean isPrefecto = authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("PREFECTO"));
                    boolean isOrientacion = authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("ORIENTACION"));
                    boolean isGuardia = authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().contains("GUARDIA"));
                    
                    if (isAdmin) u.setRol("ADMIN");
                    else if (isPrefecto) u.setRol("PREFECTO");
                    else if (isOrientacion) u.setRol("ORIENTACION");
                    else if (isGuardia) u.setRol("GUARDIA");
                    else u.setRol("ORIENTACION");

                    return ResponseEntity.ok(u);
                });
    }

    @GetMapping
    public List<Usuario> obtenerTodos() {
        List<Usuario> lista = usuarioRepository.findAll();
        for (Usuario u : lista) {
            if (u.getNombre() != null) {
                u.setNombre(u.getNombre().toUpperCase());
            }
            migrarFotoUsuarioSiBase64(u);
        }
        return lista;
    }

    private static String obtenerIdentificadorArchivoUsuario(Usuario u) {
        if (u.getRfc() != null && !u.getRfc().isBlank()) return u.getRfc();
        if (u.getUid() != null && !u.getUid().isBlank()) return u.getUid();
        if (u.getId() != null && !u.getId().isBlank()) return u.getId();
        return UUID.randomUUID().toString();
    }

    private void migrarFotoUsuarioSiBase64(Usuario u) {
        if (u != null && ImageOptimizer.esBase64Imagen(u.getFotoUrl())) {
            String idArchivo = obtenerIdentificadorArchivoUsuario(u);
            String nuevaUrl = ImageOptimizer.guardarFotoPerfilEnDisco(u.getFotoUrl(), "usuarios", idArchivo);
            if (!nuevaUrl.equals(u.getFotoUrl())) {
                u.setFotoUrl(nuevaUrl);
                try {
                    usuarioRepository.save(u);
                } catch (Exception ignored) {}
            }
        }
    }

    @GetMapping("/{id:.+}")
    public ResponseEntity<Usuario> obtenerPorId(@PathVariable String id) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByCorreoIgnoreCase(idLimpio))
                .map(u -> {
                    if (u.getNombre() != null) u.setNombre(u.getNombre().toUpperCase());
                    migrarFotoUsuarioSiBase64(u);
                    return u;
                })
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/rfc/{rfc}")
    public ResponseEntity<Usuario> obtenerPorRfc(@PathVariable String rfc) {
        String rfcLimpio = rfc != null ? rfc.trim().toUpperCase() : "";
        return usuarioRepository.findByRfc(rfcLimpio)
                .map(u -> {
                    if (u.getNombre() != null) u.setNombre(u.getNombre().toUpperCase());
                    migrarFotoUsuarioSiBase64(u);
                    return ResponseEntity.ok(u);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private static String sanitizarTexto(String s) {
        if (s == null) return null;
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^\\x20-\\x7E]", "").replaceAll("\\s+", " ").trim().toUpperCase();
    }

    private static String sanitizarAlfanumerico(String s) {
        if (s == null) return null;
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^A-Za-z0-9]", "").trim().toUpperCase();
    }

    private static String sanitizarCorreo(String s) {
        if (s == null) return null;
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^\\x20-\\x7E]", "").replaceAll("\\s+", "").toLowerCase();
    }

    private static String sanitizarTelefono(String s) {
        if (s == null) return null;
        return s.replaceAll("[^0-9]", "");
    }

    @PostMapping
    public ResponseEntity<?> guardar(@RequestBody Usuario usuario) {
        if (usuario.getCorreo() != null && !usuario.getCorreo().trim().isEmpty()) {
            usuario.setCorreo(sanitizarCorreo(usuario.getCorreo()));
            if (usuarioRepository.existsByCorreo(usuario.getCorreo())) {
                return ResponseEntity.badRequest().body("El correo ya está registrado.");
            }
        }
        if (usuario.getRfc() != null && !usuario.getRfc().trim().isEmpty()) {
            usuario.setRfc(sanitizarAlfanumerico(usuario.getRfc()));
            if (usuarioRepository.existsByRfc(usuario.getRfc())) {
                return ResponseEntity.badRequest().body("El RFC ya está registrado.");
            }
        }
        if (usuario.getUid() == null || usuario.getUid().isEmpty()) {
            usuario.setUid(UUID.randomUUID().toString());
        }
        if (usuario.getNombre() != null) {
            usuario.setNombre(sanitizarTexto(usuario.getNombre()));
        }
        if (usuario.getRol() != null) {
            usuario.setRol(sanitizarTexto(usuario.getRol()));
        }
        if (usuario.getTelefono() != null) {
            usuario.setTelefono(sanitizarTelefono(usuario.getTelefono()));
        }
        if (usuario.getTurno() != null) {
            usuario.setTurno(usuario.getTurno().trim());
        }
        if (usuario.getQrCode() == null || usuario.getQrCode().isEmpty()) {
            usuario.setQrCode(usuario.getRfc() != null && !usuario.getRfc().isEmpty() ? usuario.getRfc() : usuario.getUid());
        } else {
            usuario.setQrCode(sanitizarTexto(usuario.getQrCode()));
        }
        if (usuario.getPassword() != null && !usuario.getPassword().isEmpty()) {
            usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
        }
        if (usuario.getFotoUrl() != null && ImageOptimizer.esBase64Imagen(usuario.getFotoUrl())) {
            String idArchivo = obtenerIdentificadorArchivoUsuario(usuario);
            usuario.setFotoUrl(ImageOptimizer.guardarFotoPerfilEnDisco(usuario.getFotoUrl(), "usuarios", idArchivo));
        }
        if (usuario.getEstatus() == null) {
            usuario.setEstatus("Activo");
        }
        Usuario creado = usuarioRepository.save(usuario);
        return ResponseEntity.ok(creado);
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> guardarMasivo(@RequestBody List<Usuario> lista) {
        int insertados = 0;
        int actualizados = 0;

        for (Usuario u : lista) {
            if (u.getNombre() == null || u.getNombre().trim().isEmpty()) continue;

            String rfc = (u.getRfc() != null && !u.getRfc().trim().isEmpty()) ? sanitizarAlfanumerico(u.getRfc()) : null;
            String correo = (u.getCorreo() != null && !u.getCorreo().trim().isEmpty()) ? sanitizarCorreo(u.getCorreo()) : null;
            String nombreLimpio = sanitizarTexto(u.getNombre());

            Usuario existente = null;
            if (rfc != null && !rfc.isEmpty()) {
                existente = usuarioRepository.findByRfc(rfc).orElse(null);
            }
            if (existente == null && correo != null) {
                existente = usuarioRepository.findByCorreoIgnoreCase(correo).orElse(null);
            }

            if (existente != null) {
                existente.setNombre(nombreLimpio);
                if (rfc != null) existente.setRfc(rfc);
                if (correo != null) existente.setCorreo(correo);
                if (u.getRol() != null) existente.setRol(sanitizarTexto(u.getRol()));
                if (u.getTurno() != null) existente.setTurno(u.getTurno());
                if (u.getTelefono() != null) existente.setTelefono(sanitizarTelefono(u.getTelefono()));
                if (u.getFotoUrl() != null) {
                    String foto = u.getFotoUrl();
                    if (ImageOptimizer.esBase64Imagen(foto)) {
                        foto = ImageOptimizer.guardarFotoPerfilEnDisco(foto, "usuarios", obtenerIdentificadorArchivoUsuario(existente));
                    }
                    existente.setFotoUrl(foto);
                }
                if (u.getDescriptor_facial() != null) existente.setDescriptor_facial(u.getDescriptor_facial());
                if (u.getEstatus() != null) existente.setEstatus(u.getEstatus());
                usuarioRepository.save(existente);
                actualizados++;
            } else {
                if (u.getUid() == null || u.getUid().isEmpty()) {
                    u.setUid(UUID.randomUUID().toString());
                }
                u.setNombre(nombreLimpio);
                if (rfc != null) u.setRfc(rfc);
                if (correo != null) u.setCorreo(correo);
                if (u.getRol() == null || u.getRol().isEmpty()) u.setRol("DOCENTE");
                else u.setRol(sanitizarTexto(u.getRol()));
                if (u.getTelefono() != null) u.setTelefono(sanitizarTelefono(u.getTelefono()));
                if (u.getTurno() == null || u.getTurno().isEmpty()) u.setTurno("Matutino");
                if (u.getQrCode() == null || u.getQrCode().isEmpty()) {
                    u.setQrCode(rfc != null && !rfc.isEmpty() ? rfc : u.getUid());
                } else {
                    u.setQrCode(sanitizarTexto(u.getQrCode()));
                }
                if (u.getPassword() != null && !u.getPassword().isEmpty()) {
                    u.setPassword(passwordEncoder.encode(u.getPassword()));
                }
                if (u.getFotoUrl() != null && ImageOptimizer.esBase64Imagen(u.getFotoUrl())) {
                    u.setFotoUrl(ImageOptimizer.guardarFotoPerfilEnDisco(u.getFotoUrl(), "usuarios", obtenerIdentificadorArchivoUsuario(u)));
                }
                if (u.getEstatus() == null) u.setEstatus("Activo");
                usuarioRepository.save(u);
                insertados++;
            }
        }

        return ResponseEntity.ok(java.util.Map.of(
            "insertados", insertados,
            "actualizados", actualizados,
            "total", insertados + actualizados
        ));
    }

    @PatchMapping("/{id:.+}/descriptor-facial")
    public ResponseEntity<?> guardarDescriptorFacial(@PathVariable String id, @RequestBody List<Double> descriptor) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByRfc(idLimpio.toUpperCase()))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
                .map(u -> {
                    u.setDescriptor_facial(descriptor);
                    usuarioRepository.save(u);
                    return ResponseEntity.ok(java.util.Map.of("status", "ok", "id", u.getId()));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id:.+}")
    public ResponseEntity<?> actualizar(@PathVariable String id, @RequestBody Usuario usuarioActualizado) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByRfc(idLimpio.toUpperCase()))
                .or(() -> usuarioRepository.findByCorreoIgnoreCase(idLimpio))
                .map(usuario -> {
                    if (usuarioActualizado.getNombre() != null) {
                        usuario.setNombre(sanitizarTexto(usuarioActualizado.getNombre()));
                    }
                    if (usuarioActualizado.getCorreo() != null && !usuarioActualizado.getCorreo().trim().isEmpty()) {
                        usuario.setCorreo(sanitizarCorreo(usuarioActualizado.getCorreo()));
                    }
                    if (usuarioActualizado.getRfc() != null) usuario.setRfc(sanitizarAlfanumerico(usuarioActualizado.getRfc()));
                    if (usuarioActualizado.getTurno() != null) usuario.setTurno(usuarioActualizado.getTurno());
                    if (usuarioActualizado.getTelefono() != null) usuario.setTelefono(sanitizarTelefono(usuarioActualizado.getTelefono()));
                    if (usuarioActualizado.getFotoUrl() != null) {
                        if (usuarioActualizado.getFotoUrl().trim().isEmpty()) {
                            ImageOptimizer.eliminarArchivoDisco(usuario.getFotoUrl());
                            usuario.setFotoUrl(null);
                            usuario.setDescriptor_facial(null);
                        } else {
                            String foto = usuarioActualizado.getFotoUrl();
                            if (ImageOptimizer.esBase64Imagen(foto)) {
                                foto = ImageOptimizer.guardarFotoPerfilEnDisco(foto, "usuarios", obtenerIdentificadorArchivoUsuario(usuario));
                            }
                            usuario.setFotoUrl(foto);
                        }
                    }
                    if (usuarioActualizado.getDescriptor_facial() != null) {
                        if (usuarioActualizado.getDescriptor_facial().isEmpty()) {
                            usuario.setDescriptor_facial(null);
                        } else {
                            usuario.setDescriptor_facial(usuarioActualizado.getDescriptor_facial());
                        }
                    }
                    if (usuarioActualizado.getEstado() != null) usuario.setEstado(usuarioActualizado.getEstado());
                    if (usuarioActualizado.getQrCode() != null) usuario.setQrCode(sanitizarTexto(usuarioActualizado.getQrCode()));
                    if (usuarioActualizado.getRol() != null) usuario.setRol(sanitizarTexto(usuarioActualizado.getRol()));
                    if (usuarioActualizado.getEstatus() != null) usuario.setEstatus(usuarioActualizado.getEstatus());
                    if (usuarioActualizado.getPermisos() != null) usuario.setPermisos(usuarioActualizado.getPermisos());
                    if (usuarioActualizado.getPassword() != null && !usuarioActualizado.getPassword().isEmpty()) {
                        usuario.setPassword(passwordEncoder.encode(usuarioActualizado.getPassword()));
                    }
                    return ResponseEntity.ok(usuarioRepository.save(usuario));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id:.+}/foto")
    public ResponseEntity<?> eliminarFoto(@PathVariable String id) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByRfc(idLimpio.toUpperCase()))
                .or(() -> usuarioRepository.findByCorreoIgnoreCase(idLimpio))
                .map(usuario -> {
                    ImageOptimizer.eliminarArchivoDisco(usuario.getFotoUrl());
                    usuario.setFotoUrl(null);
                    usuario.setDescriptor_facial(null);
                    Usuario guardado = usuarioRepository.save(usuario);
                    return ResponseEntity.ok(java.util.Map.of(
                        "status", "ok",
                        "mensaje", "Foto de perfil eliminada correctamente de la base de datos.",
                        "id", guardado.getId() != null ? guardado.getId() : guardado.getUid()
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id:.+}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByRfc(idLimpio.toUpperCase()))
                .or(() -> usuarioRepository.findByCorreoIgnoreCase(idLimpio))
                .map(usuario -> {
                    // Recopilar identificadores del usuario
                    String uid = usuario.getUid() != null ? usuario.getUid() : "";
                    String rfc = usuario.getRfc() != null ? usuario.getRfc().toUpperCase() : "";
                    String nombre = usuario.getNombre() != null ? usuario.getNombre() : "";

                    // ── Borrado en cascada ──────────────────────────────────────────────
                    // Registros diarios del personal (identificados por uid o rfc como matricula)
                    if (!uid.isEmpty()) {
                        mongoTemplate.remove(
                                new Query(Criteria.where("matricula").is(uid)),
                                "registros_diarios");
                    }
                    if (!rfc.isEmpty()) {
                        mongoTemplate.remove(
                                new Query(Criteria.where("matricula").is(rfc)),
                                "registros_diarios");
                        mongoTemplate.remove(
                                new Query(Criteria.where("rfc").is(rfc)),
                                "registros_diarios");
                    }
                    if (!nombre.isEmpty()) {
                        mongoTemplate.remove(
                                new Query(Criteria.where("nombre").is(nombre)),
                                "registros_diarios");
                    }

                    // Incidencias del personal
                    if (!uid.isEmpty()) {
                        mongoTemplate.remove(
                                new Query(Criteria.where("uid").is(uid)),
                                "incidencias_personal");
                    }
                    if (!rfc.isEmpty()) {
                        mongoTemplate.remove(
                                new Query(Criteria.where("rfc").is(rfc)),
                                "incidencias_personal");
                    }

                    // ── Borrar foto y el usuario ────────────────────────────────────────
                    ImageOptimizer.eliminarArchivoDisco(usuario.getFotoUrl());
                    usuarioRepository.delete(usuario);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
