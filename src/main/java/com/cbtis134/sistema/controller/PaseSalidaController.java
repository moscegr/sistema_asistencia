package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pases")
public class PaseSalidaController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping
    public List<Document> obtenerTodos() {
        return mongoTemplate.findAll(Document.class, "pases_salida");
    }

    @GetMapping("/siguiente-folio")
    public ResponseEntity<Map<String, Object>> obtenerSiguienteFolio() {
        List<Document> docs = mongoTemplate.findAll(Document.class, "pases_salida");
        int maxFolio = 0;
        for (Document d : docs) {
            Boolean esGrupal = d.getBoolean("es_grupal");
            if (Boolean.TRUE.equals(esGrupal)) continue;

            Object folObj = d.get("folio_pase");
            if (folObj == null) folObj = d.get("_id");
            if (folObj != null) {
                String str = folObj.toString();
                if (str.startsWith("GRP-")) continue;
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
        String folioStr = String.format("%04d", siguiente);
        return ResponseEntity.ok(Map.of("siguiente_numero", siguiente, "siguiente_folio", folioStr));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> obtenerPorId(@PathVariable String id) {
        Document doc = mongoTemplate.findById(id, Document.class, "pases_salida");
        if (doc != null) {
            return ResponseEntity.ok(doc);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<Document> guardar(@RequestBody Map<String, Object> body) {
        Document doc = new Document(body);
        if (!doc.containsKey("_id") && doc.containsKey("folio_pase")) {
            doc.put("_id", doc.get("folio_pase"));
        }
        mongoTemplate.save(doc, "pases_salida");
        return ResponseEntity.ok(doc);
    }

    @PostMapping("/sincronizar-grupales")
    public ResponseEntity<Map<String, Object>> sincronizarGrupales(@RequestBody Map<String, Object> payload) {
        String hoy = (String) payload.getOrDefault("fecha", LocalDate.now().toString());
        @SuppressWarnings("unchecked")
        List<String> foliosActivos = (List<String>) payload.getOrDefault("foliosActivos", List.of());

        Query query = new Query();
        query.addCriteria(Criteria.where("es_grupal").is(true));
        query.addCriteria(Criteria.where("fecha").is(hoy));
        if (!foliosActivos.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(
                Criteria.where("_id").nin(foliosActivos),
                Criteria.where("folio_pase").nin(foliosActivos)
            ));
        }

        mongoTemplate.remove(query, "pases_salida");

        return ResponseEntity.ok(Map.of("status", "ok", "retendidos", foliosActivos.size()));
    }

    @DeleteMapping("/limpiar-todos")
    public ResponseEntity<Map<String, String>> eliminarTodos() {
        mongoTemplate.dropCollection("pases_salida");
        return ResponseEntity.ok(Map.of("mensaje", "Todos los pases de salida han sido eliminados correctamente."));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable String id) {
        mongoTemplate.remove(new Query(Criteria.where("_id").is(id)), "pases_salida");
        mongoTemplate.remove(new Query(Criteria.where("folio_pase").is(id)), "pases_salida");
        mongoTemplate.remove(new Query(Criteria.where("grupo_especialidad").is(id)), "pases_salida");
        return ResponseEntity.noContent().build();
    }
}
