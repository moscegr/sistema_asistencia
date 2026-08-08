package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
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

    @GetMapping("/personal")
    public List<Document> obtenerPersonal() {
        return mongoTemplate.findAll(Document.class, "incidencias_personal");
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
}
