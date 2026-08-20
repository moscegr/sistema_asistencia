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

    @GetMapping("/{id}")
    public ResponseEntity<EventoCalendario> obtenerEventoPorId(@PathVariable String id) {
        return eventoCalendarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<EventoCalendario> guardarEvento(@RequestBody EventoCalendario evento) {
        if (evento.getId() == null || evento.getId().trim().isEmpty()) {
            evento.setId("EVT_" + System.currentTimeMillis());
        }
        if (evento.getFechaRegistro() == null) {
            evento.setFechaRegistro(new java.util.Date());
        }
        EventoCalendario guardado = eventoCalendarioRepository.save(evento);
        return ResponseEntity.ok(guardado);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventoCalendario> actualizarEvento(@PathVariable String id, @RequestBody EventoCalendario evento) {
        evento.setId(id);
        EventoCalendario actualizado = eventoCalendarioRepository.save(evento);
        return ResponseEntity.ok(actualizado);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarEvento(@PathVariable String id) {
        eventoCalendarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
