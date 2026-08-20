package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracion")
public class ConfiguracionController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> obtenerPorId(@PathVariable String id) {
        Document doc = mongoTemplate.findById(id, Document.class, "configuracion");
        
        if (doc == null) {
            doc = new Document("_id", id);
            
            if ("sistema".equals(id)) {
                doc.put("nombre_director", "JOSE MARTIN RODEA ZUÑIGA");
                doc.put("responsable_orientacion", "MATILDE ABIGAIL GARCIA NAJERA");
                doc.put("cct_escuela", "12DCT0001L");
                doc.put("telefono_escuela", "747 47 2 34 64");
                doc.put("vigencia_actual", "Agosto 2026");
                mongoTemplate.save(doc, "configuracion");
            } else if ("escolar".equals(id)) {
                doc.put("especialidades", List.of(
                    Map.of("nombre", "CONSTRUCCIÓN", "alias", "CONS", "color", "#7b1b37", "turno", "Matutino"),
                    Map.of("nombre", "PROGRAMACIÓN", "alias", "PROG", "color", "#0088cc", "turno", "Vespertino"),
                    Map.of("nombre", "LABORATORISTA CLÍNICO", "alias", "LABC", "color", "#28a745", "turno", "Matutino"),
                    Map.of("nombre", "CONTABILIDAD", "alias", "CONT", "color", "#ffc107", "turno", "Matutino"),
                    Map.of("nombre", "E.COMMERCE", "alias", "ECOM", "color", "#6f42c1", "turno", "Vespertino"),
                    Map.of("nombre", "MECATRÓNICA", "alias", "MECA", "color", "#fd7e14", "turno", "Matutino")
                ));
                mongoTemplate.save(doc, "configuracion");
            } else if ("ciclo_escolar".equals(id)) {
                doc.put("actual", "FEB-JUL 2026");
                mongoTemplate.save(doc, "configuracion");
            }
        }
        
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/{id}")
    public ResponseEntity<Map<String, Object>> guardarOActualizar(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Document doc = mongoTemplate.findById(id, Document.class, "configuracion");
        if (doc == null) {
            doc = new Document();
            doc.put("_id", id);
        }
        doc.putAll(body);
        mongoTemplate.save(doc, "configuracion");
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/revertir-ciclo")
    public ResponseEntity<Map<String, Object>> revertirCicloEscolar() {
        Document docCiclo = mongoTemplate.findById("ciclo_escolar", Document.class, "configuracion");
        String cicloActual = "AGO-DIC 2026";
        String cicloAnterior = "FEB-JUL 2026";

        if (docCiclo != null) {
            cicloActual = docCiclo.getString("actual");
            if (docCiclo.containsKey("ciclo_anterior") && docCiclo.get("ciclo_anterior") != null) {
                cicloAnterior = docCiclo.getString("ciclo_anterior");
            } else {
                // Inferir ciclo anterior si no estaba explícito
                if (cicloActual != null && cicloActual.startsWith("AGO-DIC")) {
                    String anio = cicloActual.replace("AGO-DIC", "").trim();
                    cicloAnterior = "FEB-JUL " + anio;
                } else if (cicloActual != null && cicloActual.startsWith("FEB-JUL")) {
                    try {
                        int anio = Integer.parseInt(cicloActual.replace("FEB-JUL", "").trim());
                        cicloAnterior = "AGO-DIC " + (anio - 1);
                    } catch(Exception e) {
                        cicloAnterior = "AGO-DIC 2025";
                    }
                }
            }
            docCiclo.put("actual", cicloAnterior);
            docCiclo.put("ciclo_anterior", cicloActual);
            mongoTemplate.save(docCiclo, "configuracion");
        }

        List<Document> todosAlumnos = mongoTemplate.findAll(Document.class, "alumnos");
        int alumnosRestaurados = 0;

        for (Document al : todosAlumnos) {
            String est = al.getString("estatus_escolar");
            if (est == null) est = al.getString("estatus");
            
            boolean modificado = false;
            if ("Egresado".equalsIgnoreCase(est)) {
                al.put("estatus_escolar", "Activo");
                al.put("grado", 6);
                modificado = true;
            } else if ("Activo".equalsIgnoreCase(est) || est == null) {
                Object gObj = al.get("grado");
                int g = 1;
                if (gObj instanceof Number) g = ((Number) gObj).intValue();
                else if (gObj instanceof String) {
                    try { g = Integer.parseInt((String) gObj); } catch(Exception ignored){}
                }

                if (g > 1) {
                    al.put("grado", g - 1);
                    modificado = true;
                }
            }

            if (modificado) {
                mongoTemplate.save(al, "alumnos");
                alumnosRestaurados++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "ciclo_restaurado", cicloAnterior,
                "alumnos_afectados", alumnosRestaurados,
                "mensaje", "Se restauró el ciclo escolar a \"" + cicloAnterior + "\" y se revirtieron los grados de " + alumnosRestaurados + " alumnos."
        ));
    }

    @GetMapping("/backup")
    public ResponseEntity<Map<String, Object>> descargarBackupCompleto() {
        Map<String, Object> backup = new java.util.LinkedHashMap<>();
        backup.put("version", "2.0");
        backup.put("sistema", "CBTis 134 - Residencia Escolar");
        backup.put("fecha_generacion", new java.util.Date().toString());
        backup.put("timestamp", System.currentTimeMillis());

        backup.put("alumnos", mongoTemplate.findAll(Document.class, "alumnos"));
        backup.put("pases_salida", mongoTemplate.findAll(Document.class, "pases_salida"));
        backup.put("justificantes", mongoTemplate.findAll(Document.class, "justificantes"));
        backup.put("incidencias", mongoTemplate.findAll(Document.class, "incidencias"));
        backup.put("incidencias_personal", mongoTemplate.findAll(Document.class, "incidencias_personal"));
        backup.put("calendario", mongoTemplate.findAll(Document.class, "calendario"));
        backup.put("configuracion", mongoTemplate.findAll(Document.class, "configuracion"));
        backup.put("registros_diarios", mongoTemplate.findAll(Document.class, "registros_diarios"));
        
        List<Document> usuarios = mongoTemplate.findAll(Document.class, "usuarios");
        List<Document> usuariosSeguros = usuarios.stream().map(u -> {
            Document copy = new Document(u);
            copy.remove("password");
            return copy;
        }).toList();
        backup.put("usuarios", usuariosSeguros);

        return ResponseEntity.ok(backup);
    }
}
