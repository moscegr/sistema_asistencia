package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.model.Alumno;
import com.cbtis134.sistema.repository.AlumnoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alumnos")
public class AlumnoController {

    @Autowired
    private AlumnoRepository alumnoRepository;

    @GetMapping
    public List<Alumno> obtenerTodos() {
        return alumnoRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Alumno> obtenerPorId(@PathVariable String id) {
        return alumnoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/ncontrol/{ncontrol}")
    public ResponseEntity<Alumno> obtenerPorNControl(@PathVariable String ncontrol) {
        return alumnoRepository.findFirstByNcontrol(ncontrol)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/qr/{qrCode}")
    public ResponseEntity<Alumno> obtenerPorQr(@PathVariable String qrCode) {
        return alumnoRepository.findFirstByQrCode(qrCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Alumno guardar(@RequestBody Alumno alumno) {
        return alumnoRepository.save(alumno);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Alumno> actualizar(@PathVariable String id, @RequestBody Alumno alumnoActualizado) {
        return alumnoRepository.findById(id)
                .map(alumno -> {
                    alumnoActualizado.setId(id);
                    return ResponseEntity.ok(alumnoRepository.save(alumnoActualizado));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        if (alumnoRepository.existsById(id)) {
            alumnoRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
