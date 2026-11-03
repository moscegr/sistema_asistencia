package com.cbtis134.sistema.controller;

import com.cbtis134.sistema.config.ImageOptimizer;
import com.cbtis134.sistema.model.Alumno;
import com.cbtis134.sistema.model.Usuario;
import com.cbtis134.sistema.repository.AlumnoRepository;
import com.cbtis134.sistema.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Controlador de contingencia para /uploads/**.
 * Si un archivo físico solicitado no existe en /app/uploads (por ejemplo, tras un despliegue
 * o reinicio del contenedor Docker), intenta reconstruirlo instantáneamente a partir del
 * respaldo Base64 almacenado en MongoDB.
 * Si no cuenta con fotografía, devuelve transparentemente el avatar por defecto con HTTP 200,
 * garantizando que las credenciales, gafetes, tablas y vistas jamás muestren errores 404 ni recuadros vacíos.
 */
@Controller
@RequestMapping("/uploads")
public class UploadFallbackController {

    @Autowired(required = false)
    private UsuarioRepository usuarioRepository;

    @Autowired(required = false)
    private AlumnoRepository alumnoRepository;

    @Autowired(required = false)
    private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    @GetMapping("/{categoria}/{nombreArchivo:.+}")
    public ResponseEntity<byte[]> servirOReconstruirArchivo(
            @PathVariable("categoria") String categoria,
            @PathVariable("nombreArchivo") String nombreArchivo) {

        String safeCat = categoria != null ? categoria.trim().toLowerCase() : "general";
        String cleanNombre = nombreArchivo != null ? nombreArchivo.trim() : "";
        int qIdx = cleanNombre.indexOf('?');
        if (qIdx >= 0) {
            cleanNombre = cleanNombre.substring(0, qIdx);
        }

        // 1. Para logotipos institucionales, MongoDB es siempre la fuente primaria de la verdad
        if ("logos".equals(safeCat)) {
            if (mongoTemplate != null) {
                try {
                    org.bson.Document doc = mongoTemplate.findById("sistema", org.bson.Document.class, "configuracion");
                    if (doc != null) {
                        boolean esInicio = cleanNombre.contains("inicio") || cleanNombre.contains("tigre");
                        String campoB64 = esInicio ? "logo_inicio_base64" : "logo_plantel_base64";
                        String campoUrl = esInicio ? "logo_inicio_url" : "logo_plantel_url";

                        String base64 = doc.getString(campoB64);
                        if (base64 == null || !ImageOptimizer.esBase64Imagen(base64)) {
                            String urlVal = doc.getString(campoUrl);
                            if (urlVal != null && ImageOptimizer.esBase64Imagen(urlVal)) {
                                base64 = urlVal;
                            }
                        }

                        if (base64 != null && ImageOptimizer.esBase64Imagen(base64)) {
                            ImageOptimizer.restaurarArchivoEnDisco("logos", cleanNombre, base64);
                            byte[] bytesImg = ImageOptimizer.decodificarBase64Seguro(base64);
                            if (bytesImg != null && bytesImg.length > 0) {
                                MediaType mt = (base64.startsWith("data:image/png") || cleanNombre.toLowerCase().endsWith(".png"))
                                        ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
                                return ResponseEntity.ok()
                                        .contentType(mt)
                                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=60, must-revalidate")
                                        .body(bytesImg);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }
        }

        // 2. Verificar si el archivo ya existe físicamente en disco (en /app/uploads, getUploadDir o user.dir)
        File target = buscarArchivoEnDisco(safeCat, cleanNombre);
        if (target != null && target.exists() && target.isFile() && target.length() > 0) {
            try (FileInputStream fis = new FileInputStream(target)) {
                byte[] data = fis.readAllBytes();
                MediaType mt = inferirMediaType(target.getName());
                return ResponseEntity.ok()
                        .contentType(mt)
                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=60, must-revalidate")
                        .body(data);
            } catch (Exception ignored) {}
        }

        // 3. Si no existe en disco, reconstruir o servir fallback según categoría
        String idKey = cleanNombre.replaceAll("\\.[^.]+$", "").trim();

        if ("usuarios".equals(safeCat) && usuarioRepository != null) {
            Optional<Usuario> optUser = usuarioRepository.findByRfc(idKey.toUpperCase())
                    .or(() -> usuarioRepository.findById(idKey))
                    .or(() -> usuarioRepository.findByUid(idKey));

            if (optUser.isPresent()) {
                Usuario u = optUser.get();
                String base64 = null;
                if (u.getFotoBase64() != null && ImageOptimizer.esBase64Imagen(u.getFotoBase64())) {
                    base64 = u.getFotoBase64();
                } else if (u.getFotoUrl() != null && ImageOptimizer.esBase64Imagen(u.getFotoUrl())) {
                    base64 = u.getFotoUrl();
                }

                if (base64 != null) {
                    // Reconstruir en disco para futuras peticiones estáticas
                    ImageOptimizer.restaurarArchivoEnDisco("usuarios", cleanNombre, base64);
                    byte[] bytesImg = ImageOptimizer.decodificarBase64Seguro(base64);
                    if (bytesImg != null && bytesImg.length > 0) {
                        return ResponseEntity.ok()
                                .contentType(MediaType.IMAGE_JPEG)
                                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                                .body(bytesImg);
                    }
                }
            }
            return servirDefaultAvatar();
        }

        if ("alumnos".equals(safeCat) && alumnoRepository != null) {
            Optional<Alumno> optAlumno = alumnoRepository.findFirstByNcontrolOrMatricula(idKey, idKey)
                    .or(() -> alumnoRepository.findById(idKey))
                    .or(() -> alumnoRepository.findFirstByCurp(idKey));

            if (optAlumno.isPresent()) {
                Alumno a = optAlumno.get();
                String base64 = null;
                if (a.getFotoBase64() != null && ImageOptimizer.esBase64Imagen(a.getFotoBase64())) {
                    base64 = a.getFotoBase64();
                } else if (a.getFotoUrl() != null && ImageOptimizer.esBase64Imagen(a.getFotoUrl())) {
                    base64 = a.getFotoUrl();
                }

                if (base64 != null) {
                    ImageOptimizer.restaurarArchivoEnDisco("alumnos", cleanNombre, base64);
                    byte[] bytesImg = ImageOptimizer.decodificarBase64Seguro(base64);
                    if (bytesImg != null && bytesImg.length > 0) {
                        return ResponseEntity.ok()
                                .contentType(MediaType.IMAGE_JPEG)
                                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                                .body(bytesImg);
                    }
                }
            }
            return servirDefaultAvatar();
        }

        if ("logos".equals(safeCat)) {
            if (cleanNombre.contains("inicio") || cleanNombre.contains("tigre")) {
                return servirRecursoClasspath("/static/img/tigres.png", MediaType.IMAGE_PNG);
            } else {
                return servirRecursoClasspath("/static/img/logo_aniversario.jpg", MediaType.IMAGE_JPEG);
            }
        }

        return servirDefaultAvatar();
    }

    private ResponseEntity<byte[]> servirDefaultAvatar() {
        return servirRecursoClasspath("/static/img/default_avatar.png", MediaType.IMAGE_PNG);
    }

    private ResponseEntity<byte[]> servirRecursoClasspath(String classpathLocation, MediaType mediaType) {
        try (InputStream in = getClass().getResourceAsStream(classpathLocation)) {
            if (in != null) {
                byte[] data = in.readAllBytes();
                return ResponseEntity.ok()
                        .contentType(mediaType)
                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                        .body(data);
            }
        } catch (Exception ignored) {}
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    private File buscarArchivoEnDisco(String safeCat, String cleanNombre) {
        List<File> baseDirs = new ArrayList<>();
        baseDirs.add(new File(ImageOptimizer.getUploadDir()));
        baseDirs.add(new File("/app/uploads"));
        baseDirs.add(new File(System.getProperty("user.dir"), "uploads"));

        for (File base : baseDirs) {
            if (base == null || !base.exists()) continue;
            File folder = new File(base, safeCat);
            if (!folder.exists()) continue;

            File target = new File(folder, cleanNombre);
            if (target.exists() && target.isFile() && target.length() > 0) {
                return target;
            }

            String baseSinExt = cleanNombre.replaceAll("\\.[^.]+$", "");
            for (String ext : new String[]{".jpg", ".png", ".jpeg", ".webp", ".JPG", ".PNG", ".JPEG"}) {
                File alt = new File(folder, baseSinExt + ext);
                if (alt.exists() && alt.isFile() && alt.length() > 0) {
                    return alt;
                }
            }
        }
        return null;
    }

    private MediaType inferirMediaType(String nombreArchivo) {
        String lower = nombreArchivo.toLowerCase();
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF;
        if (lower.endsWith(".webp")) return MediaType.valueOf("image/webp");
        return MediaType.IMAGE_JPEG;
    }
}
