package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
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
}
