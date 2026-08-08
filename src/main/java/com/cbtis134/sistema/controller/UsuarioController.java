package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
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

    @PostMapping
    public ResponseEntity<?> guardar(@RequestBody Usuario usuario) {
        if (usuario.getCorreo() != null && usuarioRepository.existsByCorreo(usuario.getCorreo().trim().toLowerCase())) {
            return ResponseEntity.badRequest().body("El correo ya está registrado.");
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
        if (usuario.getPassword() != null && !usuario.getPassword().isEmpty()) {
            usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));
        }
        if (usuario.getEstatus() == null) {
            usuario.setEstatus("Activo");
        }
        Usuario creado = usuarioRepository.save(usuario);
        return ResponseEntity.ok(creado);
    }

    @PutMapping("/{id:.+}")
    public ResponseEntity<?> actualizar(@PathVariable String id, @RequestBody Usuario usuarioActualizado) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
                .map(usuario -> {
                    if (usuarioActualizado.getNombre() != null) {
                        usuario.setNombre(usuarioActualizado.getNombre().toUpperCase());
                    }
                    if (usuarioActualizado.getCorreo() != null && !usuarioActualizado.getCorreo().trim().isEmpty()) {
                        usuario.setCorreo(usuarioActualizado.getCorreo().trim().toLowerCase());
                    }
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

    @DeleteMapping("/{id:.+}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        String idLimpio = id != null ? id.trim() : "";
        return usuarioRepository.findById(idLimpio)
                .or(() -> usuarioRepository.findByUid(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio))
                .or(() -> usuarioRepository.findByCorreo(idLimpio.toLowerCase()))
                .map(usuario -> {
                    usuarioRepository.delete(usuario);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
