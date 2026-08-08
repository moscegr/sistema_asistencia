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

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> actualizar(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Document doc = mongoTemplate.findById(id, Document.class, "configuracion");
        if (doc == null) {
            doc = new Document();
            doc.put("_id", id);
        }
        doc.putAll(body);
        mongoTemplate.save(doc, "configuracion");
        return ResponseEntity.ok(doc);
    }
}
