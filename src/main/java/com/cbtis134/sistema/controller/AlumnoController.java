package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.model.Alumno;
import com.cbtis134.sistema.repository.AlumnoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alumnos")
public class AlumnoController {

    @Autowired
    private AlumnoRepository alumnoRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

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

        // Recopilar todas las matrículas/ncontrol a borrar en cascada
        List<String> matriculas = aEliminar.stream()
                .flatMap(a -> java.util.stream.Stream.of(a.getMatricula(), a.getNcontrol()))
                .filter(m -> m != null && !m.isBlank())
                .distinct()
                .toList();

        if (!matriculas.isEmpty()) {
            Criteria critMatricula = Criteria.where("matricula").in(matriculas);
            Criteria critNcontrol  = Criteria.where("ncontrol").in(matriculas);

            mongoTemplate.remove(new Query(critMatricula), "registros_diarios");
            mongoTemplate.remove(new Query(critMatricula), "incidencias");
            mongoTemplate.remove(new Query(critNcontrol),  "incidencias");
            mongoTemplate.remove(new Query(critMatricula), "justificantes");
            mongoTemplate.remove(new Query(critNcontrol),  "justificantes");
            mongoTemplate.remove(
                    new Query(new Criteria().andOperator(
                            critMatricula, Criteria.where("es_grupal").ne(true))),
                    "pases_salida");
        }

        alumnoRepository.deleteAll(aEliminar);
        return ResponseEntity.ok(java.util.Map.of(
                "eliminados", aEliminar.size(),
                "mensaje", "Se eliminaron permanentemente " + aEliminar.size() + " alumnos con estatus Baja, Egresado o Inactivo."
        ));
    }

    @PatchMapping("/{matricula}/descriptor-facial")
    public ResponseEntity<?> actualizarDescriptorFacial(@PathVariable String matricula, @RequestBody List<Double> descriptor) {
        return alumnoRepository.findFirstByNcontrolOrMatricula(matricula, matricula)
                .map(alumno -> {
                    alumno.setDescriptor_facial(descriptor);
                    alumnoRepository.save(alumno);
                    return ResponseEntity.ok(java.util.Map.of("status", "ok", "matricula", matricula));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        return alumnoRepository.findById(id)
                .or(() -> alumnoRepository.findFirstByNcontrolOrMatricula(id, id))
                .map(alumno -> {
                    String matricula = alumno.getMatricula() != null ? alumno.getMatricula()
                            : alumno.getNcontrol() != null ? alumno.getNcontrol() : id;
                    String ncontrol = alumno.getNcontrol() != null ? alumno.getNcontrol() : matricula;

                    // ── Borrado en cascada ──────────────────────────────────────────────
                    // Registros diarios
                    mongoTemplate.remove(
                            new Query(Criteria.where("matricula").in(matricula, ncontrol)),
                            "registros_diarios");

                    // Incidencias de alumno
                    mongoTemplate.remove(
                            new Query(Criteria.where("matricula").in(matricula, ncontrol)),
                            "incidencias");
                    mongoTemplate.remove(
                            new Query(Criteria.where("ncontrol").in(matricula, ncontrol)),
                            "incidencias");

                    // Justificantes
                    mongoTemplate.remove(
                            new Query(Criteria.where("matricula").in(matricula, ncontrol)),
                            "justificantes");
                    mongoTemplate.remove(
                            new Query(Criteria.where("ncontrol").in(matricula, ncontrol)),
                            "justificantes");

                    // Pases de salida individuales (grupales NO se tocan, son del grupo)
                    mongoTemplate.remove(
                            new Query(new Criteria().andOperator(
                                    Criteria.where("matricula").in(matricula, ncontrol),
                                    Criteria.where("es_grupal").ne(true))),
                            "pases_salida");

                    // ── Borrar el alumno ────────────────────────────────────────────────
                    alumnoRepository.delete(alumno);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
