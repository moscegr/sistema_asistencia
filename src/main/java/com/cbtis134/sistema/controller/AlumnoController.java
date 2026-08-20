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
        return alumnoRepository.findFirstByNcontrolOrMatricula(ncontrol, ncontrol)
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
        if (alumno.getId() == null) {
            String searchKey = alumno.getNcontrol() != null ? alumno.getNcontrol() : alumno.getMatricula();
            if (searchKey != null) {
                alumnoRepository.findFirstByNcontrolOrMatricula(searchKey, searchKey)
                        .ifPresent(existente -> alumno.setId(existente.getId()));
            }
        }
        return alumnoRepository.save(alumno);
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<Alumno>> guardarMasivo(@RequestBody List<Alumno> alumnos) {
        if (alumnos == null || alumnos.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        for (Alumno a : alumnos) {
            String searchKey = a.getNcontrol() != null ? a.getNcontrol() : a.getMatricula();
            if (a.getId() == null && searchKey != null) {
                alumnoRepository.findFirstByNcontrolOrMatricula(searchKey, searchKey)
                        .ifPresent(existente -> a.setId(existente.getId()));
            }
        }
        List<Alumno> guardados = alumnoRepository.saveAll(alumnos);
        return ResponseEntity.ok(guardados);
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

    @DeleteMapping("/depurar-inactivos")
    public ResponseEntity<java.util.Map<String, Object>> depurarAlumnosInactivos() {
        List<Alumno> todos = alumnoRepository.findAll();
        List<Alumno> aEliminar = todos.stream()
                .filter(a -> {
                    String est = a.getEstatus_escolar() != null ? a.getEstatus_escolar() : (a.getEstatus() != null ? a.getEstatus() : "Activo");
                    return "BAJA".equalsIgnoreCase(est) || "EGRESADO".equalsIgnoreCase(est) || "INACTIVO".equalsIgnoreCase(est);
                })
                .toList();

        alumnoRepository.deleteAll(aEliminar);
        return ResponseEntity.ok(java.util.Map.of(
                "eliminados", aEliminar.size(),
                "mensaje", "Se eliminaron permanentemente " + aEliminar.size() + " alumnos con estatus Baja, Egresado o Inactivo."
        ));
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
