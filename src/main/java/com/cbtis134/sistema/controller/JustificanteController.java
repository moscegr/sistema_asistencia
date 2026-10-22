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
@RequestMapping("/api/justificantes")
public class JustificanteController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping
    public List<Document> obtenerTodos() {
        return mongoTemplate.findAll(Document.class, "justificantes");
    }

    @GetMapping("/siguiente-folio")
    public ResponseEntity<Map<String, Object>> obtenerSiguienteFolio() {
        List<Document> docs = mongoTemplate.findAll(Document.class, "justificantes");
        int maxFolio = 0;
        for (Document d : docs) {
            Object folObj = d.get("folio_justificante");
            if (folObj == null) folObj = d.get("_id");
            if (folObj != null) {
                try {
                    String numStr = folObj.toString().replaceAll("[^0-9]", "");
                    if (!numStr.isEmpty()) {
                        int num = Integer.parseInt(numStr);
                        if (num > maxFolio) {
                            maxFolio = num;
                        }
                    }
                } catch (Exception ignored) {}
            }
        }
        int siguiente = maxFolio + 1;
        String folioStr = String.format("%04d", siguiente);
        return ResponseEntity.ok(Map.of("siguiente_numero", siguiente, "siguiente_folio", folioStr));
    }
    @GetMapping("/{id}")
    public ResponseEntity<Document> obtenerPorId(@PathVariable String id) {
        Document doc = mongoTemplate.findById(id, Document.class, "justificantes");
        if (doc != null) {
            return ResponseEntity.ok(doc);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<Document> guardar(@RequestBody Map<String, Object> body) {
        Document doc = new Document(body);
        if (!doc.containsKey("_id") && doc.containsKey("folio_justificante")) {
            doc.put("_id", doc.get("folio_justificante"));
        }
        mongoTemplate.save(doc, "justificantes");
        return ResponseEntity.ok(doc);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        mongoTemplate.remove(new Query(Criteria.where("_id").is(id)), "justificantes");
        mongoTemplate.remove(new Query(Criteria.where("folio_justificante").is(id)), "justificantes");
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/limpiar-todos")
    public ResponseEntity<Map<String, String>> eliminarTodos() {
        mongoTemplate.dropCollection("justificantes");
        return ResponseEntity.ok(Map.of("mensaje", "Todos los justificantes han sido eliminados correctamente."));
    }
}
