package com.cbtis134.sistema.repository;

import com.cbtis134.sistema.model.Alumno;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AlumnoRepository extends MongoRepository<Alumno, String> {
    Optional<Alumno> findFirstByNcontrol(String ncontrol);
    Optional<Alumno> findFirstByMatricula(String matricula);
    Optional<Alumno> findFirstByNcontrolOrMatricula(String ncontrol, String matricula);

    List<Alumno> findByNcontrol(String ncontrol);

    Optional<Alumno> findFirstByQrCode(String qrCode);
    List<Alumno> findByQrCode(String qrCode);

    Optional<Alumno> findFirstByCurp(String curp);
    List<Alumno> findByCurp(String curp);
}
