package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/configuracion")
public class ConfiguracionController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> obtenerPorId(@PathVariable String id) {
        Document doc = mongoTemplate.findById(id, Document.class, "configuracion");
        if (doc != null) {
            return ResponseEntity.ok(doc);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}")
    public ResponseEntity<Map<String, Object>> guardarOActualizar(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Document doc = new Document(body);
        doc.put("_id", id);
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
