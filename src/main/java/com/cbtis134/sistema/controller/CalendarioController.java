package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.model.EventoCalendario;
import com.cbtis134.sistema.repository.EventoCalendarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/calendario")
public class CalendarioController {

    @Autowired
    private EventoCalendarioRepository eventoCalendarioRepository;

    @GetMapping
    public List<EventoCalendario> obtenerEventos() {
        return eventoCalendarioRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<EventoCalendario> guardarEvento(@RequestBody EventoCalendario evento) {
        EventoCalendario guardado = eventoCalendarioRepository.save(evento);
        return ResponseEntity.ok(guardado);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarEvento(@PathVariable String id) {
        eventoCalendarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
