package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.model.RegistroDiario;
import com.cbtis134.sistema.repository.RegistroDiarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/registros-diarios")
public class RegistroDiarioController {

    @Autowired
    private RegistroDiarioRepository registroDiarioRepository;

    @GetMapping
    public List<RegistroDiario> obtenerTodos() {
        return registroDiarioRepository.findAll();
    }

    @GetMapping("/matricula/{matricula}")
    public List<RegistroDiario> obtenerPorMatricula(@PathVariable String matricula) {
        return registroDiarioRepository.findByMatricula(matricula);
    }

    @GetMapping("/fecha/{fecha}")
    public List<RegistroDiario> obtenerPorFecha(@PathVariable String fecha) {
        return registroDiarioRepository.findByFecha(fecha);
    }

    @PostMapping
    public ResponseEntity<RegistroDiario> guardar(@RequestBody RegistroDiario registro) {
        RegistroDiario guardado = registroDiarioRepository.save(registro);
        return ResponseEntity.ok(guardado);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        registroDiarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
