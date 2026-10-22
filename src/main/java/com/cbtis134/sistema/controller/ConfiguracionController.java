package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.config.ImageOptimizer;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import jakarta.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/configuracion")
public class ConfiguracionController {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Value("${app.upload.dir:/app/uploads}")
    private String uploadDir;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> obtenerPorId(@PathVariable String id) {
        Document doc = mongoTemplate.findById(id, Document.class, "configuracion");
        
        if (doc == null) {
            doc = new Document("_id", id);
            
            if ("sistema".equals(id)) {
                doc.put("nombre_plantel", "CBTis 134");
                doc.put("nombre_oficial_plantel", "CENTRO DE BACHILLERATO TECNOLÓGICO INDUSTRIAL Y DE SERVICIOS NO. 134");
                doc.put("slogan_plantel", "\"POR QUE PRESTIGIO SE GANA CON ESFUERZO... SOMOS CBTIS 134\"");
                doc.put("logo_plantel_url", "/img/logo-cbtis.png");
                doc.put("logo_inicio_url", "/img/logo.png");
                doc.put("nombre_director", "JOSE MARTIN RODEA ZUÑIGA");
                doc.put("responsable_orientacion", "MATILDE ABIGAIL GARCIA NAJERA");
                doc.put("cct_escuela", "12DCT0001L");
                doc.put("telefono_escuela", "747 47 2 34 64");
                doc.put("vigencia_actual", "Agosto 2026");
                doc.put("jefe_personal", "LIC. JUANA MORALES APARICIO");
                doc.put("direccion_plantel", "Carretera Nacional México - Acapulco Km. 275.5, Col. Salubridad, C.P. 39096, Chilpancingo, Guerrero");
                doc.put("ciudad_plantel", "Chilpancingo de los Bravo, Guerrero");
                mongoTemplate.save(doc, "configuracion");
            } else if ("escolar".equals(id)) {
                doc.put("especialidades", new ArrayList<>(List.of(
                    new Document("nombre", "PROGRAMACION").append("alias", "PRO").append("color", "#0088cc").append("turno", "Matutino"),
                    new Document("nombre", "ADMINISTRACION DE RECURSOS HUMANOS").append("alias", "ARH").append("color", "#6f42c1").append("turno", "Matutino"),
                    new Document("nombre", "CONTABILIDAD").append("alias", "CON").append("color", "#198754").append("turno", "Matutino"),
                    new Document("nombre", "CONSTRUCCION").append("alias", "CST").append("color", "#dc3545").append("turno", "Matutino"),
                    new Document("nombre", "ELECTRICIDAD").append("alias", "ELE").append("color", "#fd7e14").append("turno", "Matutino"),
                    new Document("nombre", "OFIMATICA").append("alias", "OFI").append("color", "#0dcaf0").append("turno", "Matutino")
                )));
                doc.put("migrado_especialidades_v2", true);
                mongoTemplate.save(doc, "configuracion");
            } else if ("ciclo_escolar".equals(id)) {
                doc.put("actual", "FEB-JUL 2026");
                mongoTemplate.save(doc, "configuracion");
            }
        }

        if ("sistema".equals(id) && doc != null) {
            boolean modificado = false;
            String logoP = doc.getString("logo_plantel_url");
            if (ImageOptimizer.requiereOptimizacion(logoP)) {
                doc.put("logo_plantel_url", ImageOptimizer.optimizarLogo(logoP));
                modificado = true;
            }
            String logoI = doc.getString("logo_inicio_url");
            if (ImageOptimizer.requiereOptimizacion(logoI)) {
                doc.put("logo_inicio_url", ImageOptimizer.optimizarLogo(logoI));
                modificado = true;
            }
            if (modificado) {
                try {
                    mongoTemplate.save(doc, "configuracion");
                    VistaController.invalidarCacheConfig();
                } catch (Exception ignored) {}
            }
        }

        if ("escolar".equals(id) && doc != null) {
            try {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> listaOriginal = (List<Map<String, Object>>) doc.get("especialidades");
                List<Map<String, Object>> listaEsp = new ArrayList<>();
                Set<String> nombresRegistrados = new HashSet<>();
                boolean actualizado = false;

                if (listaOriginal != null) {
                    for (Map<String, Object> esp : listaOriginal) {
                        Object nomObj = esp.get("nombre");
                        if (nomObj == null) continue;
                        String nomLimpio = sanitizarSinAcentos(nomObj.toString());
                        if (!nomLimpio.equals(nomObj.toString())) {
                            actualizado = true;
                        }
                        if (nombresRegistrados.add(nomLimpio)) {
                            Map<String, Object> copia = new LinkedHashMap<>(esp);
                            copia.put("nombre", nomLimpio);
                            if (copia.get("alias") != null) {
                                copia.put("alias", sanitizarSinAcentos(copia.get("alias").toString()));
                            }
                            listaEsp.add(copia);
                        } else {
                            actualizado = true;
                        }
                    }
                }

                List<String> especialidadesAlumnos = mongoTemplate.findDistinct(new Query(), "especialidad", "alumnos", String.class);
                String[] paleta = {"#7b1b37", "#0088cc", "#198754", "#fd7e14", "#6f42c1", "#dc3545", "#0dcaf0"};
                int colorIdx = listaEsp.size();

                for (String espAl : especialidadesAlumnos) {
                    if (espAl != null && !espAl.trim().isEmpty()) {
                        String espUpper = sanitizarSinAcentos(espAl);
                        if (!"POR ASIGNAR".equals(espUpper) && !nombresRegistrados.contains(espUpper)) {
                            String alias = generarAliasEspecialidad(espUpper);
                            Document nuevaEsp = new Document("nombre", espUpper)
                                    .append("alias", alias)
                                    .append("color", paleta[colorIdx % paleta.length])
                                    .append("turno", "Matutino");
                            listaEsp.add(nuevaEsp);
                            nombresRegistrados.add(espUpper);
                            colorIdx++;
                            actualizado = true;
                        }
                    }
                }

                if (actualizado) {
                    doc.put("especialidades", listaEsp);
                    mongoTemplate.save(doc, "configuracion");
                }
            } catch (Exception ignored) {}
        }
        
        return ResponseEntity.ok(doc);
    }

    private String sanitizarSinAcentos(String s) {
        if (s == null) return "";
        String sinAcentos = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sinAcentos.replaceAll("[^\\x20-\\x7E]", "").replaceAll("\\s+", " ").trim().toUpperCase();
    }

    private String generarAliasEspecialidad(String nombre) {
        if (nombre.contains("RECURSOS HUMANOS")) return "ARH";
        if (nombre.contains("PROGRAMAC")) return "PRO";
        if (nombre.contains("CONTABIL")) return "CON";
        if (nombre.contains("CONSTRUCC")) return "CST";
        if (nombre.contains("ELECTRIC")) return "ELE";
        if (nombre.contains("OFIM")) return "OFI";
        if (nombre.contains("LABORATOR")) return "LAB";
        if (nombre.contains("MECATR")) return "MEC";
        if (nombre.contains("INTELIGENCIA")) return "IA";
        if (nombre.contains("COMMERCE") || nombre.contains("COMERCIO")) return "ECO";
        return nombre.length() >= 4 ? nombre.substring(0, 4) : nombre;
    }

    @PostMapping("/{id}")
    public ResponseEntity<Map<String, Object>> guardarOActualizar(@PathVariable String id, @RequestBody Map<String, Object> body) {
        Document doc = mongoTemplate.findById(id, Document.class, "configuracion");
        if (doc == null) {
            doc = new Document();
            doc.put("_id", id);
        }
        if ("sistema".equals(id)) {
            if (body.containsKey("logo_plantel_url") && body.get("logo_plantel_url") != null) {
                String logoP = body.get("logo_plantel_url").toString();
                if (ImageOptimizer.requiereOptimizacion(logoP)) {
                    body.put("logo_plantel_url", ImageOptimizer.optimizarLogo(logoP));
                }
            }
            if (body.containsKey("logo_inicio_url") && body.get("logo_inicio_url") != null) {
                String logoI = body.get("logo_inicio_url").toString();
                if (ImageOptimizer.requiereOptimizacion(logoI)) {
                    body.put("logo_inicio_url", ImageOptimizer.optimizarLogo(logoI));
                }
            }
            VistaController.invalidarCacheConfig();
        }
        if ("escolar".equals(id) && body.get("especialidades") instanceof List<?> rawList) {
            List<Map<String, Object>> limpias = new ArrayList<>();
            Set<String> vistos = new HashSet<>();
            for (Object item : rawList) {
                if (item instanceof Map<?, ?> m) {
                    Map<String, Object> espMap = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> e : m.entrySet()) {
                        espMap.put(String.valueOf(e.getKey()), e.getValue());
                    }
                    String nom = sanitizarSinAcentos(String.valueOf(espMap.getOrDefault("nombre", "")));
                    String alias = sanitizarSinAcentos(String.valueOf(espMap.getOrDefault("alias", "")));
                    if (!nom.isEmpty() && vistos.add(nom)) {
                        espMap.put("nombre", nom);
                        espMap.put("alias", alias);
                        limpias.add(espMap);
                    }
                }
            }
            body.put("especialidades", limpias);
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

    @GetMapping(value = "/backup/zip-completo", produces = "application/zip")
    public ResponseEntity<StreamingResponseBody> descargarBackupZipCompleto(HttpServletResponse response) {
        String fechaHoy = java.time.LocalDate.now().toString();
        response.setHeader("Content-Disposition", "attachment; filename=\"Respaldo_TOTAL_CBTis134_" + fechaHoy + ".zip\"");

        return ResponseEntity.ok(outputStream -> {
            try (ZipOutputStream zos = new ZipOutputStream(outputStream)) {
                // 1. Agregar JSON de base de datos
                Map<String, Object> data = construirMapaBackup();
                String jsonStr = new org.bson.Document(data).toJson();
                ZipEntry jsonEntry = new ZipEntry("base_de_datos_cbtis134.json");
                zos.putNextEntry(jsonEntry);
                zos.write(jsonStr.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();

                // 2. Agregar archivos multimedia
                List<File> directorios = new ArrayList<>();
                if (uploadDir != null && !uploadDir.isBlank()) directorios.add(new File(uploadDir));
                directorios.add(new File("uploads"));
                directorios.add(new File(System.getProperty("user.dir"), "uploads"));

                Set<String> rutasProcesadas = new HashSet<>();
                for (File dir : directorios) {
                    if (dir.exists() && dir.isDirectory()) {
                        agregarCarpetaAZip(dir, "multimedia", zos, rutasProcesadas);
                    }
                }

                // 3. Agregar Readme de restauración
                ZipEntry readmeEntry = new ZipEntry("LEEME_RESPALDO.txt");
                zos.putNextEntry(readmeEntry);
                String readme = "========================================================\n" +
                               "RESPALDO COMPLETO DEL SISTEMA CBTIS 134\n" +
                               "Fecha de Generación: " + new java.util.Date() + "\n" +
                               "========================================================\n\n" +
                               "Contenido de este paquete:\n" +
                               "1. base_de_datos_cbtis134.json -> Contiene todas las colecciones de MongoDB (Alumnos, Incidencias, Pases, Calendario, etc.)\n" +
                               "2. multimedia/ -> Contiene todas las fotografías, documentos y archivos multimedia subidos al servidor.\n\n" +
                               "Para restaurar o migrar de VPS, simplemente sube este archivo .ZIP desde el panel de Configuración en el botón 'Importar / Migrar Respaldo'.\n";
                zos.write(readme.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();

                zos.finish();
            } catch (Exception e) {
                System.err.println("Error al generar zip total: " + e.getMessage());
            }
        });
    }

    @PostMapping("/restore")
    public ResponseEntity<Map<String, Object>> restaurarRespaldo(
            @RequestParam("archivo") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "limpiarAntes", defaultValue = "false") boolean limpiarAntes) {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No se seleccionó ningún archivo de respaldo."));
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        Map<String, Object> resultado = new LinkedHashMap<>();
        int totalDocumentos = 0;
        int archivosMultimediaRestaurados = 0;
        Map<String, Integer> detalleColecciones = new LinkedHashMap<>();

        try {
            if (filename.endsWith(".zip")) {
                // Procesar archivo ZIP
                try (java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(file.getInputStream())) {
                    java.util.zip.ZipEntry entry;
                    while ((entry = zis.getNextEntry()) != null) {
                        String entryName = entry.getName();

                        if (entryName.endsWith(".json")) {
                            // Leer JSON de base de datos
                            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                            byte[] buffer = new byte[8192];
                            int len;
                            while ((len = zis.read(buffer)) > 0) {
                                baos.write(buffer, 0, len);
                            }
                            String jsonContent = baos.toString(StandardCharsets.UTF_8);
                            Map<String, Integer> importRes = importarJsonEnMongo(jsonContent, limpiarAntes);
                            detalleColecciones.putAll(importRes);
                            for (int cant : importRes.values()) {
                                totalDocumentos += cant;
                            }
                        } else if (!entry.isDirectory() && (entryName.startsWith("multimedia/") || entryName.startsWith("uploads/"))) {
                            // Extraer archivo multimedia en destino de uploads con protección estricta contra Zip Slip (Path Traversal)
                            String subPath = entryName.replaceFirst("^(multimedia/|uploads/)", "");
                            File destDir = new File(uploadDir).getCanonicalFile();
                            File destFile = new File(destDir, subPath).getCanonicalFile();

                            // Verificación de seguridad: el archivo DEBE estar dentro del directorio de uploads
                            if (!destFile.getPath().startsWith(destDir.getPath() + File.separator)) {
                                System.err.println("ADVERTENCIA DE SEGURIDAD: Intento de Zip Slip bloqueado para la entrada: " + entryName);
                                continue;
                            }

                            // Solo permitir extensiones multimedia seguras (evitar scripts o ejecutables .sh, .jar, .py, .php, etc.)
                            String lowerName = destFile.getName().toLowerCase();
                            boolean extensionSegura = lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ||
                                                     lowerName.endsWith(".png") || lowerName.endsWith(".webp") ||
                                                     lowerName.endsWith(".gif") || lowerName.endsWith(".pdf") ||
                                                     lowerName.endsWith(".svg") || lowerName.endsWith(".txt");

                            if (!extensionSegura) {
                                System.err.println("ADVERTENCIA DE SEGURIDAD: Archivo no permitido bloqueado: " + entryName);
                                continue;
                            }

                            if (destFile.getParentFile() != null) {
                                destFile.getParentFile().mkdirs();
                            }

                            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(destFile)) {
                                byte[] buffer = new byte[8192];
                                int len;
                                while ((len = zis.read(buffer)) > 0) {
                                    fos.write(buffer, 0, len);
                                }
                            }
                            archivosMultimediaRestaurados++;
                        }
                        zis.closeEntry();
                    }
                }
            } else if (filename.endsWith(".json")) {
                // Procesar JSON directo
                String jsonContent = new String(file.getBytes(), StandardCharsets.UTF_8);
                Map<String, Integer> importRes = importarJsonEnMongo(jsonContent, limpiarAntes);
                detalleColecciones.putAll(importRes);
                for (int cant : importRes.values()) {
                    totalDocumentos += cant;
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Formato no válido. Debe ser un archivo .zip o .json."));
            }

            resultado.put("success", true);
            resultado.put("mensaje", "Respaldo restaurado exitosamente.");
            resultado.put("total_documentos", totalDocumentos);
            resultado.put("archivos_multimedia", archivosMultimediaRestaurados);
            resultado.put("colecciones", detalleColecciones);

            return ResponseEntity.ok(resultado);

        } catch (Exception e) {
            // No exponer detalles internos al cliente — solo registrar en servidor
            System.err.println("[CONFIG] Error al restaurar respaldo: " + e.getClass().getSimpleName());
            return ResponseEntity.status(500).body(Map.of("error", "Fallo al restaurar respaldo. Revisa el archivo e intenta de nuevo."));
        }
    }

    private Map<String, Integer> importarJsonEnMongo(String jsonContent, boolean limpiarAntes) {
        Map<String, Integer> conteos = new LinkedHashMap<>();
        try {
            org.bson.Document rootDoc = org.bson.Document.parse(jsonContent);
            List<String> coleccionesConocidas = List.of(
                    "alumnos", "pases_salida", "justificantes", "incidencias",
                    "incidencias_personal", "calendario", "configuracion",
                    "registros_diarios", "usuarios"
            );

            for (String colName : coleccionesConocidas) {
                if (rootDoc.containsKey(colName) && rootDoc.get(colName) instanceof List) {
                    List<?> items = (List<?>) rootDoc.get(colName);
                    if (limpiarAntes) {
                        mongoTemplate.dropCollection(colName);
                    }
                    int c = 0;
                    for (Object item : items) {
                        if (item instanceof org.bson.Document) {
                            mongoTemplate.save((org.bson.Document) item, colName);
                            c++;
                        } else if (item instanceof Map) {
                            mongoTemplate.save(new org.bson.Document((Map<String, Object>) item), colName);
                            c++;
                        }
                    }
                    conteos.put(colName, c);
                }
            }
        } catch(Exception e) {
            System.err.println("Error al importar JSON en MongoDB: " + e.getMessage());
        }
        return conteos;
    }

    private Map<String, Object> construirMapaBackup() {
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
        return backup;
    }

    private int agregarCarpetaAZip(File carpeta, String rutaBase, ZipOutputStream zos, Set<String> rutasProcesadas) throws IOException {
        int total = 0;
        File[] archivos = carpeta.listFiles();
        if (archivos == null) return 0;

        for (File archivo : archivos) {
            if (archivo.isDirectory()) {
                total += agregarCarpetaAZip(archivo, rutaBase + "/" + archivo.getName(), zos, rutasProcesadas);
            } else {
                String zipEntryPath = rutaBase + "/" + archivo.getName();
                if (rutasProcesadas.add(archivo.getAbsolutePath())) {
                    ZipEntry entry = new ZipEntry(zipEntryPath);
                    entry.setSize(archivo.length());
                    entry.setTime(archivo.lastModified());
                    zos.putNextEntry(entry);
                    try (FileInputStream fis = new FileInputStream(archivo)) {
                        byte[] buffer = new byte[8192];
                        int len;
                        while ((len = fis.read(buffer)) > 0) {
                            zos.write(buffer, 0, len);
                        }
                    }
                    zos.closeEntry();
                    total++;
                }
            }
        }
        return total;
    }
}
