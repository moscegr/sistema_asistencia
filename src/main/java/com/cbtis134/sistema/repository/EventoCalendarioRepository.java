package com.cbtis134.sistema.repository;

import com.cbtis134.sistema.model.EventoCalendario;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EventoCalendarioRepository extends MongoRepository<EventoCalendario, String> {
}
