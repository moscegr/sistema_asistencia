package com.cbtis134.sistema.repository;

import com.cbtis134.sistema.model.RegistroDiario;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface RegistroDiarioRepository extends MongoRepository<RegistroDiario, String> {
    List<RegistroDiario> findByMatricula(String matricula);
    List<RegistroDiario> findByFecha(String fecha);
}
