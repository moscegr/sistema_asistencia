package com.cbtis134.sistema.repository;

import com.cbtis134.sistema.model.Usuario;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepository extends MongoRepository<Usuario, String> {
    Optional<Usuario> findByCorreo(String correo);
    Optional<Usuario> findByCorreoIgnoreCase(String correo);
    boolean existsByCorreo(String correo);
    boolean existsByCorreoIgnoreCase(String correo);
    Optional<Usuario> findByUid(String uid);
    Optional<Usuario> findByRfc(String rfc);
    boolean existsByRfc(String rfc);
    Optional<Usuario> findByQrCode(String qrCode);
}
