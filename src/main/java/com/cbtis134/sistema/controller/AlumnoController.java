package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.config.ImageOptimizer;
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
                .map(a -> {
                    migrarFotoAlumnoSiBase64(a);
                    return ResponseEntity.ok(a);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/ncontrol/{ncontrol}")
    public ResponseEntity<Alumno> obtenerPorNControl(@PathVariable String ncontrol) {
        return alumnoRepository.findFirstByNcontrolOrMatricula(ncontrol, ncontrol)
                .map(a -> {
                    migrarFotoAlumnoSiBase64(a);
                    return ResponseEntity.ok(a);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/qr/{qrCode}")
    public ResponseEntity<Alumno> obtenerPorQr(@PathVariable String qrCode) {
        return alumnoRepository.findFirstByQrCode(qrCode)
                .map(a -> {
                    migrarFotoAlumnoSiBase64(a);
                    return ResponseEntity.ok(a);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private void migrarFotoAlumnoSiBase64(Alumno a) {
        if (a == null) return;
        if (ImageOptimizer.esBase64Imagen(a.getFotoUrl())) {
            String idArchivo = a.getNcontrol() != null && !a.getNcontrol().isBlank() ? a.getNcontrol()
                    : (a.getMatricula() != null && !a.getMatricula().isBlank() ? a.getMatricula() : a.getId());
            String base64Opt = ImageOptimizer.optimizarFotoPerfil(a.getFotoUrl());
            a.setFotoBase64(base64Opt);
            String nuevaUrl = ImageOptimizer.guardarFotoPerfilEnDisco(base64Opt, "alumnos", idArchivo);
            if (!nuevaUrl.equals(a.getFotoUrl())) {
                a.setFotoUrl(nuevaUrl);
                try {
                    alumnoRepository.save(a);
                } catch (Exception ignored) {}
            }
        } else if (a.getFotoBase64() != null && ImageOptimizer.esBase64Imagen(a.getFotoBase64())) {
            String idArchivo = a.getNcontrol() != null && !a.getNcontrol().isBlank() ? a.getNcontrol()
                    : (a.getMatricula() != null && !a.getMatricula().isBlank() ? a.getMatricula() : a.getId());
            if (!ImageOptimizer.existeArchivoEnDisco(a.getFotoUrl())) {
                ImageOptimizer.restaurarArchivoEnDisco("alumnos", idArchivo + ".jpg", a.getFotoBase64());
            }
        }
    }

    private static String sanitizarTexto(String s) {
        if (s == null) return null;
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^\\x20-\\x7E]", "").replaceAll("\\s+", " ").trim().toUpperCase();
    }

    private static String sanitizarAlfanumerico(String s) {
        if (s == null) return null;
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^A-Za-z0-9]", "").trim().toUpperCase();
    }

    private static String sanitizarCorreo(String s) {
        if (s == null) return null;
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^\\x20-\\x7E]", "").replaceAll("\\s+", "").toLowerCase();
    }

    private static String sanitizarTelefono(String s) {
        if (s == null) return null;
        return s.replaceAll("[^0-9]", "");
    }

    public static void sanitizarAlumno(Alumno a) {
        if (a == null) return;
        String mat = sanitizarAlfanumerico(a.getNcontrol() != null ? a.getNcontrol() : a.getMatricula());
        if (mat != null && !mat.isEmpty()) {
            a.setNcontrol(mat);
            a.setMatricula(mat);
        }
        if (a.getCurp() != null) a.setCurp(sanitizarAlfanumerico(a.getCurp()));
        if (a.getNombre() != null) a.setNombre(sanitizarTexto(a.getNombre()));
        if (a.getApepat() != null) a.setApepat(sanitizarTexto(a.getApepat()));
        if (a.getApemat() != null) a.setApemat(sanitizarTexto(a.getApemat()));
        if (a.getPrimerApellido() != null) a.setPrimerApellido(sanitizarTexto(a.getPrimerApellido()));
        if (a.getSegundoApellido() != null) a.setSegundoApellido(sanitizarTexto(a.getSegundoApellido()));
        if (a.getGenero() != null) a.setGenero(sanitizarTexto(a.getGenero()));
        if (a.getEmail() != null) a.setEmail(sanitizarCorreo(a.getEmail()));
        if (a.getCelular() != null) a.setCelular(sanitizarTelefono(a.getCelular()));
        if (a.getDireccion() != null) a.setDireccion(sanitizarTexto(a.getDireccion()));
        if (a.getEspecialidad() != null) a.setEspecialidad(sanitizarTexto(a.getEspecialidad()));
        if (a.getGrado() != null) a.setGrado(sanitizarAlfanumerico(a.getGrado()));
        if (a.getGrupo() != null) a.setGrupo(sanitizarAlfanumerico(a.getGrupo()));
        if (a.getNombretutor() != null) a.setNombretutor(sanitizarTexto(a.getNombretutor()));
        if (a.getTeltutor() != null) a.setTeltutor(sanitizarTelefono(a.getTeltutor()));
        if (a.getOcupaciontutor() != null) a.setOcupaciontutor(sanitizarTexto(a.getOcupaciontutor()));
        if (a.getAula_especifica() != null) a.setAula_especifica(sanitizarTexto(a.getAula_especifica()));
        if (a.getEscuela_procedencia() != null) a.setEscuela_procedencia(sanitizarTexto(a.getEscuela_procedencia()));
        if (a.getMotivo_baja() != null) a.setMotivo_baja(sanitizarTexto(a.getMotivo_baja()));

        if (a.getFotoUrl() != null && ImageOptimizer.esBase64Imagen(a.getFotoUrl())) {
            String idArchivo = mat != null && !mat.isEmpty() ? mat
                    : (a.getCurp() != null && !a.getCurp().isEmpty() ? a.getCurp() : a.getId());
            String base64Opt = ImageOptimizer.optimizarFotoPerfil(a.getFotoUrl());
            a.setFotoBase64(base64Opt);
            a.setFotoUrl(ImageOptimizer.guardarFotoPerfilEnDisco(base64Opt, "alumnos", idArchivo));
        }

        String nomCompleto = ((a.getNombre() != null ? a.getNombre() : "") + " " +
                (a.getApepat() != null ? a.getApepat() : "") + " " +
                (a.getApemat() != null ? a.getApemat() : "")).replaceAll("\\s+", " ").trim();
        String qrLimpiado = ((mat != null ? mat : "") + "|" + nomCompleto).trim();
        if (qrLimpiado.length() > 48) qrLimpiado = qrLimpiado.substring(0, 48).trim();
        a.setQrCode(qrLimpiado);
        a.setQr_texto(qrLimpiado);
    }

    @PostMapping
    public Alumno guardar(@RequestBody Alumno alumno) {
        sanitizarAlumno(alumno);
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
            sanitizarAlumno(a);
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
        sanitizarAlumno(alumnoActualizado);
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

        for (Alumno a : aEliminar) {
            ImageOptimizer.eliminarArchivoDisco(a.getFotoUrl());
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

                    // ── Borrar archivo de foto y registro del alumno ────────────────────
                    ImageOptimizer.eliminarArchivoDisco(alumno.getFotoUrl());
                    alumnoRepository.delete(alumno);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
