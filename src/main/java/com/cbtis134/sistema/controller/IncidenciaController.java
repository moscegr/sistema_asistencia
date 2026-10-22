package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incidencias")
public class IncidenciaController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping
    public List<Document> obtenerTodos() {
        return mongoTemplate.findAll(Document.class, "incidencias");
    }

    @GetMapping("/siguiente-folio")
    public ResponseEntity<Map<String, Object>> obtenerSiguienteFolio() {
        List<Document> docs = mongoTemplate.findAll(Document.class, "incidencias");
        int maxFolio = 0;
        for (Document d : docs) {
            Object folObj = d.get("folio_incidencia");
            if (folObj == null) folObj = d.get("_id");
            if (folObj != null) {
                String str = folObj.toString();
                String numStr = str.replaceAll("[^0-9]", "");
                if (!numStr.isEmpty()) {
                    try {
                        int num = Integer.parseInt(numStr);
                        if (num > maxFolio) {
                            maxFolio = num;
                        }
                    } catch (Exception ignored) {}
                }
            }
        }
        int siguiente = maxFolio + 1;
        String folioStr = String.format("INC-%04d", siguiente);
        return ResponseEntity.ok(Map.of("siguiente_numero", siguiente, "siguiente_folio", folioStr));
    }

    @GetMapping("/personal")
    public List<Document> obtenerPersonal() {
        return mongoTemplate.findAll(Document.class, "incidencias_personal");
    }

    @GetMapping("/personal/siguiente-folio")
    public ResponseEntity<Map<String, Object>> obtenerSiguienteFolioPersonal() {
        List<Document> docs = mongoTemplate.findAll(Document.class, "incidencias_personal");
        int maxFolio = 0;
        for (Document d : docs) {
            Object folObj = d.get("clave_reporte");
            if (folObj == null) folObj = d.get("_id");
            if (folObj != null) {
                String str = folObj.toString();
                String numStr = str.replaceAll("[^0-9]", "");
                if (!numStr.isEmpty()) {
                    try {
                        int num = Integer.parseInt(numStr);
                        if (num > maxFolio) {
                            maxFolio = num;
                        }
                    } catch (Exception ignored) {}
                }
            }
        }
        int siguiente = maxFolio + 1;
        String folioStr = String.format("PREF-%04d", siguiente);
        return ResponseEntity.ok(Map.of("siguiente_numero", siguiente, "siguiente_folio", folioStr));
    }

    @PostMapping
    public ResponseEntity<Document> guardar(@RequestBody Map<String, Object> body) {
        Document doc = new Document(body);
        if (!doc.containsKey("_id") && doc.containsKey("folio_incidencia")) {
            doc.put("_id", doc.get("folio_incidencia"));
        }
        mongoTemplate.save(doc, "incidencias");
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/personal")
    public ResponseEntity<Document> guardarPersonal(@RequestBody Map<String, Object> body) {
        Document doc = new Document(body);
        if (!doc.containsKey("_id") && doc.containsKey("clave_reporte")) {
            doc.put("_id", doc.get("clave_reporte"));
        }
        mongoTemplate.save(doc, "incidencias_personal");
        return ResponseEntity.ok(doc);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        mongoTemplate.remove(new Query(Criteria.where("_id").is(id)), "incidencias");
        mongoTemplate.remove(new Query(Criteria.where("folio_incidencia").is(id)), "incidencias");
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/personal/{id}")
    public ResponseEntity<Void> eliminarPersonal(@PathVariable String id) {
        mongoTemplate.remove(new Query(Criteria.where("_id").is(id)), "incidencias_personal");
        mongoTemplate.remove(new Query(Criteria.where("clave_reporte").is(id)), "incidencias_personal");
        return ResponseEntity.noContent().build();
    }
}
