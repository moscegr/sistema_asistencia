package com.cbtis134.sistema.repository;

import com.cbtis134.sistema.model.Alumno;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AlumnoRepository extends MongoRepository<Alumno, String> {
    Optional<Alumno> findByNcontrol(String ncontrol);
    Optional<Alumno> findByQrCode(String qrCode);
    Optional<Alumno> findByCurp(String curp);
}
