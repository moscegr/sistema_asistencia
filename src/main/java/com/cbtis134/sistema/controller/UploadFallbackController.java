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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.Base64;
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

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private AlumnoRepository alumnoRepository;

    @GetMapping("/{categoria}/{nombreArchivo:.+}")
    public ResponseEntity<byte[]> servirOReconstruirArchivo(
            @PathVariable String categoria,
            @PathVariable String nombreArchivo) {

        String safeCat = categoria != null ? categoria.trim().toLowerCase() : "general";
        String cleanNombre = nombreArchivo != null ? nombreArchivo.trim() : "";

        // 1. Verificar si el archivo ya existe físicamente en disco
        File target = new File(new File(ImageOptimizer.getUploadDir(), safeCat), cleanNombre);
        if (target.exists() && target.isFile() && target.length() > 0) {
            try (FileInputStream fis = new FileInputStream(target)) {
                byte[] data = fis.readAllBytes();
                MediaType mt = inferirMediaType(cleanNombre);
                return ResponseEntity.ok()
                        .contentType(mt)
                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                        .body(data);
            } catch (Exception ignored) {}
        }

        // 2. Si no existe, manejar por categoría
        String idKey = cleanNombre.replaceAll("\\.[^.]+$", "").trim();

        if ("usuarios".equals(safeCat)) {
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
                    byte[] bytesImg = decodificarDataUri(base64);
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

        if ("alumnos".equals(safeCat)) {
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
                    byte[] bytesImg = decodificarDataUri(base64);
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

    private byte[] decodificarDataUri(String dataUri) {
        try {
            int commaIdx = dataUri.indexOf(',');
            if (commaIdx >= 0) {
                String raw = dataUri.substring(commaIdx + 1).trim();
                return Base64.getDecoder().decode(raw);
            }
        } catch (Exception ignored) {}
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
