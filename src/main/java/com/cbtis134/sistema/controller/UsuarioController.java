package com.cbtis134.sistema.controller;

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
        return usuarioRepository.findByCorreo(correo)
                .or(() -> usuarioRepository.findByCorreo(correo.toLowerCase()))
                .map(u -> {
                    if (u.getNombre() != null) u.setNombre(u.getNombre().toUpperCase());
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
        }
        return lista;
    }

    @GetMapping("/{id:.+}")
    public ResponseEntity<Usuario> obtenerPorId(@PathVariable String id) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
                .map(u -> {
                    if (u.getNombre() != null) u.setNombre(u.getNombre().toUpperCase());
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
                    return ResponseEntity.ok(u);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> guardar(@RequestBody Usuario usuario) {
        if (usuario.getCorreo() != null && !usuario.getCorreo().trim().isEmpty() && usuarioRepository.existsByCorreo(usuario.getCorreo().trim().toLowerCase())) {
            return ResponseEntity.badRequest().body("El correo ya está registrado.");
        }
        if (usuario.getRfc() != null && !usuario.getRfc().trim().isEmpty() && usuarioRepository.existsByRfc(usuario.getRfc().trim().toUpperCase())) {
            return ResponseEntity.badRequest().body("El RFC ya está registrado.");
        }
        if (usuario.getUid() == null || usuario.getUid().isEmpty()) {
            usuario.setUid(UUID.randomUUID().toString());
        }
        if (usuario.getCorreo() != null) {
            usuario.setCorreo(usuario.getCorreo().trim().toLowerCase());
        }
        if (usuario.getNombre() != null) {
            usuario.setNombre(usuario.getNombre().toUpperCase());
        }
        if (usuario.getRfc() != null) {
            usuario.setRfc(usuario.getRfc().trim().toUpperCase());
        }
        if (usuario.getTurno() != null) {
            usuario.setTurno(usuario.getTurno().trim());
        }
        if (usuario.getQrCode() == null || usuario.getQrCode().isEmpty()) {
            usuario.setQrCode(usuario.getRfc() != null && !usuario.getRfc().isEmpty() ? usuario.getRfc() : usuario.getUid());
        }
        if (usuario.getPassword() != null && !usuario.getPassword().isEmpty()) {
            usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
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

            String rfc = (u.getRfc() != null) ? u.getRfc().trim().toUpperCase() : null;
            String correo = (u.getCorreo() != null && !u.getCorreo().trim().isEmpty()) ? u.getCorreo().trim().toLowerCase() : null;

            Usuario existente = null;
            if (rfc != null && !rfc.isEmpty()) {
                existente = usuarioRepository.findByRfc(rfc).orElse(null);
            }
            if (existente == null && correo != null) {
                existente = usuarioRepository.findByCorreo(correo).orElse(null);
            }

            if (existente != null) {
                existente.setNombre(u.getNombre().toUpperCase());
                if (rfc != null) existente.setRfc(rfc);
                if (correo != null) existente.setCorreo(correo);
                if (u.getRol() != null) existente.setRol(u.getRol().toUpperCase());
                if (u.getTurno() != null) existente.setTurno(u.getTurno());
                if (u.getTelefono() != null) existente.setTelefono(u.getTelefono());
                if (u.getFotoUrl() != null) existente.setFotoUrl(u.getFotoUrl());
                if (u.getDescriptor_facial() != null) existente.setDescriptor_facial(u.getDescriptor_facial());
                if (u.getEstatus() != null) existente.setEstatus(u.getEstatus());
                usuarioRepository.save(existente);
                actualizados++;
            } else {
                if (u.getUid() == null || u.getUid().isEmpty()) {
                    u.setUid(UUID.randomUUID().toString());
                }
                u.setNombre(u.getNombre().toUpperCase());
                if (rfc != null) u.setRfc(rfc);
                if (correo != null) u.setCorreo(correo);
                if (u.getRol() == null || u.getRol().isEmpty()) u.setRol("DOCENTE");
                else u.setRol(u.getRol().toUpperCase());
                if (u.getTurno() == null || u.getTurno().isEmpty()) u.setTurno("Matutino");
                if (u.getQrCode() == null || u.getQrCode().isEmpty()) {
                    u.setQrCode(rfc != null && !rfc.isEmpty() ? rfc : u.getUid());
                }
                if (u.getPassword() != null && !u.getPassword().isEmpty()) {
                    u.setPassword(passwordEncoder.encode(u.getPassword()));
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
                .or(() -> usuarioRepository.findByCorreo(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
                .map(usuario -> {
                    if (usuarioActualizado.getNombre() != null) {
                        usuario.setNombre(usuarioActualizado.getNombre().toUpperCase());
                    }
                    if (usuarioActualizado.getCorreo() != null && !usuarioActualizado.getCorreo().trim().isEmpty()) {
                        usuario.setCorreo(usuarioActualizado.getCorreo().trim().toLowerCase());
                    }
                    if (usuarioActualizado.getRfc() != null) usuario.setRfc(usuarioActualizado.getRfc().trim().toUpperCase());
                    if (usuarioActualizado.getTurno() != null) usuario.setTurno(usuarioActualizado.getTurno());
                    if (usuarioActualizado.getTelefono() != null) usuario.setTelefono(usuarioActualizado.getTelefono());
                    if (usuarioActualizado.getFotoUrl() != null) {
                        if (usuarioActualizado.getFotoUrl().trim().isEmpty()) {
                            usuario.setFotoUrl(null);
                            usuario.setDescriptor_facial(null);
                        } else {
                            usuario.setFotoUrl(usuarioActualizado.getFotoUrl());
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
                    if (usuarioActualizado.getQrCode() != null) usuario.setQrCode(usuarioActualizado.getQrCode());
                    if (usuarioActualizado.getRol() != null) usuario.setRol(usuarioActualizado.getRol());
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
                .or(() -> usuarioRepository.findByCorreo(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
                .map(usuario -> {
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
                .or(() -> usuarioRepository.findByCorreo(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
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

                    // ── Borrar el usuario ───────────────────────────────────────────────
                    usuarioRepository.delete(usuario);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
