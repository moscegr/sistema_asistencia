package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> obtenerPorId(@PathVariable String id) {
        return usuarioRepository.findById(id)
                .or(() -> usuarioRepository.findByUid(id))
                .or(() -> usuarioRepository.findByCorreo(id))
                .map(u -> {
                    if (u.getNombre() != null) u.setNombre(u.getNombre().toUpperCase());
                    return u;
                })
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> guardar(@RequestBody Usuario usuario) {
        if (usuario.getCorreo() != null && usuarioRepository.existsByCorreo(usuario.getCorreo())) {
            return ResponseEntity.badRequest().body("El correo ya está registrado.");
        }
        if (usuario.getUid() == null || usuario.getUid().isEmpty()) {
            usuario.setUid(UUID.randomUUID().toString());
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

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable String id, @RequestBody Usuario usuarioActualizado) {
        return usuarioRepository.findById(id)
                .or(() -> usuarioRepository.findByUid(id))
                .or(() -> usuarioRepository.findByCorreo(id))
                .map(usuario -> {
                    if (usuarioActualizado.getNombre() != null) {
                        usuario.setNombre(usuarioActualizado.getNombre().toUpperCase());
                    }
                    if (usuarioActualizado.getCorreo() != null && !usuarioActualizado.getCorreo().trim().isEmpty()) {
                        usuario.setCorreo(usuarioActualizado.getCorreo().trim());
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        return usuarioRepository.findById(id)
                .or(() -> usuarioRepository.findByUid(id))
                .or(() -> usuarioRepository.findByCorreo(id))
                .map(usuario -> {
                    usuarioRepository.delete(usuario);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
