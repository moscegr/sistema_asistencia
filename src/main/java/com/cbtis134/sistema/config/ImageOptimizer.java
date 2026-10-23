package com.cbtis134.sistema.config;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Base64;
import java.util.Iterator;
import java.util.UUID;

/**
 * Gestiona la optimización y almacenamiento físico en disco (/app/uploads) de fotografías
 * de alumnos, personal administrativo y logotipos institucionales.
 * Convierte automáticamente cadenas Base64 (data:image/...;base64,...) en archivos ligeros
 * servidos desde /uploads/** para mantener MongoDB limpio y las respuestas JSON instantáneas.
 */
public class ImageOptimizer {

    // Umbral aproximado para optimización en memoria (fallback): ~42 KB (~56,000 caracteres Base64)
    private static final int MAX_BASE64_LENGTH = 56000;

    private static volatile String configuredUploadDir = null;

    public static void setUploadDir(String dir) {
        if (dir != null && !dir.isBlank()) {
            configuredUploadDir = dir.trim();
        }
    }

    public static String getUploadDir() {
        if (configuredUploadDir != null && !configuredUploadDir.isBlank()) {
            return configuredUploadDir;
        }
        String envDir = System.getenv("APP_UPLOAD_DIR");
        if (envDir != null && !envDir.isBlank()) {
            return envDir.trim();
        }
        return "/app/uploads";
    }

    /**
     * Indica si la cadena corresponde a una imagen codificada en Base64 (data URI).
     */
    public static boolean esBase64Imagen(String valor) {
        return valor != null
                && valor.startsWith("data:image/")
                && valor.contains(";base64,");
    }

    public static boolean requiereOptimizacion(String dataUri) {
        return esBase64Imagen(dataUri) && dataUri.length() > MAX_BASE64_LENGTH;
    }

    /**
     * Guarda una fotografía de perfil (alumno o administrativo) como archivo físico optimizado
     * en /app/uploads/{subcarpeta}/{identificador}.jpg y devuelve su ruta pública (/uploads/...).
     * Si el valor ya es una URL (/uploads/... o /img/...), lo devuelve intacto.
     */
    public static String guardarFotoPerfilEnDisco(String dataUriOrUrl, String subcarpeta, String identificador) {
        if (dataUriOrUrl == null || dataUriOrUrl.isBlank()) {
            return dataUriOrUrl;
        }
        if (!esBase64Imagen(dataUriOrUrl)) {
            return dataUriOrUrl;
        }
        try {
            byte[] jpegBytes = procesarImagenBytes(dataUriOrUrl, 360, false, 0.84f, new boolean[]{false});
            if (jpegBytes == null || jpegBytes.length == 0) {
                return optimizarFotoPerfil(dataUriOrUrl);
            }

            String safeFolder = limpiarNombreArchivo(subcarpeta != null ? subcarpeta : "perfiles");
            String safeId = limpiarNombreArchivo(identificador);
            if (safeId.isEmpty()) {
                safeId = UUID.randomUUID().toString().replace("-", "");
            }

            File folder = new File(getUploadDir(), safeFolder);
            if (!folder.exists() && !folder.mkdirs()) {
                return optimizarFotoPerfil(dataUriOrUrl);
            }

            String fileName = safeId + ".jpg";
            File targetFile = new File(folder, fileName);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(jpegBytes);
            }

            long version = System.currentTimeMillis() / 1000;
            return "/uploads/" + safeFolder + "/" + fileName + "?v=" + version;
        } catch (Exception e) {
            System.err.println("[IMAGE STORAGE] Fallback a Base64 comprimido por error de disco: " + e.getMessage());
            return optimizarFotoPerfil(dataUriOrUrl);
        }
    }

    /**
     * Guarda un logotipo institucional en /app/uploads/logos/{identificador}.png (o .jpg)
     * preservando transparencia si es PNG/WebP, y devuelve su ruta pública (/uploads/logos/...).
     */
    public static String guardarLogoEnDisco(String dataUriOrUrl, String identificador) {
        if (dataUriOrUrl == null || dataUriOrUrl.isBlank()) {
            return dataUriOrUrl;
        }
        if (!esBase64Imagen(dataUriOrUrl)) {
            return dataUriOrUrl;
        }
        try {
            boolean esPngOriginal = dataUriOrUrl.startsWith("data:image/png") || dataUriOrUrl.startsWith("data:image/webp");
            boolean[] salioPng = new boolean[]{false};
            byte[] imgBytes = procesarImagenBytes(dataUriOrUrl, 320, esPngOriginal, 0.88f, salioPng);
            if (imgBytes == null || imgBytes.length == 0) {
                return optimizarLogo(dataUriOrUrl);
            }

            String safeId = limpiarNombreArchivo(identificador);
            if (safeId.isEmpty()) {
                safeId = "logo_" + System.currentTimeMillis();
            }

            File folder = new File(getUploadDir(), "logos");
            if (!folder.exists() && !folder.mkdirs()) {
                return optimizarLogo(dataUriOrUrl);
            }

            String ext = salioPng[0] ? ".png" : ".jpg";
            String fileName = safeId + ext;
            File targetFile = new File(folder, fileName);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(imgBytes);
            }

            long version = System.currentTimeMillis() / 1000;
            return "/uploads/logos/" + fileName + "?v=" + version;
        } catch (Exception e) {
            System.err.println("[IMAGE STORAGE] Fallback logo a Base64 comprimido: " + e.getMessage());
            return optimizarLogo(dataUriOrUrl);
        }
    }

    /**
     * Elimina del disco un archivo previamente almacenado en /uploads/** cuando se elimina
     * el registro o su fotografía.
     */
    public static void eliminarArchivoDisco(String fotoUrl) {
        if (fotoUrl == null || !fotoUrl.startsWith("/uploads/")) {
            return;
        }
        try {
            String cleanPath = fotoUrl;
            int qIdx = cleanPath.indexOf('?');
            if (qIdx >= 0) {
                cleanPath = cleanPath.substring(0, qIdx);
            }
            String relPath = cleanPath.substring("/uploads/".length());
            if (relPath.isBlank() || relPath.contains("..")) {
                return;
            }
            File baseDir = new File(getUploadDir()).getCanonicalFile();
            File target = new File(baseDir, relPath).getCanonicalFile();
            if (target.getPath().startsWith(baseDir.getPath() + File.separator) && target.exists() && target.isFile()) {
                target.delete();
            }
        } catch (Exception ignored) {}
    }

    public static boolean existeArchivoEnDisco(String fotoUrl) {
        if (fotoUrl == null || !fotoUrl.startsWith("/uploads/")) {
            return false;
        }
        try {
            String cleanPath = fotoUrl;
            int qIdx = cleanPath.indexOf('?');
            if (qIdx >= 0) {
                cleanPath = cleanPath.substring(0, qIdx);
            }
            String relPath = cleanPath.substring("/uploads/".length());
            if (relPath.isBlank() || relPath.contains("..")) {
                return false;
            }
            File baseDir = new File(getUploadDir()).getCanonicalFile();
            File target = new File(baseDir, relPath).getCanonicalFile();
            return target.exists() && target.isFile() && target.length() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    public static String sanitizarUrlOExistente(String url, String fallbackDefault) {
        if (url == null || url.isBlank()) {
            return fallbackDefault;
        }
        if (url.startsWith("/uploads/")) {
            if (!existeArchivoEnDisco(url)) {
                return fallbackDefault;
            }
        }
        return url;
    }

    private static String limpiarNombreArchivo(String input) {
        if (input == null) return "";
        return input.trim().replaceAll("[^A-Za-z0-9_-]", "_");
    }

    /**
     * Optimiza una foto de perfil en memoria (fallback Base64) a máximo 320x320 en JPEG.
     */
    public static String optimizarFotoPerfil(String dataUri) {
        if (!requiereOptimizacion(dataUri)) {
            return dataUri;
        }
        return redimensionarBase64(dataUri, 320, false, 0.82f);
    }

    /**
     * Optimiza un logotipo institucional en memoria (fallback Base64) a máximo 280x280.
     */
    public static String optimizarLogo(String dataUri) {
        if (!requiereOptimizacion(dataUri)) {
            return dataUri;
        }
        boolean esPng = dataUri.startsWith("data:image/png") || dataUri.startsWith("data:image/webp");
        return redimensionarBase64(dataUri, 280, esPng, 0.85f);
    }

    private static byte[] procesarImagenBytes(String dataUri, int maxDim, boolean preservarAlpha, float jpegQuality, boolean[] outEsPng) {
        try {
            int commaIdx = dataUri.indexOf(',');
            if (commaIdx < 0) return null;

            String base64Part = dataUri.substring(commaIdx + 1).trim();
            byte[] rawBytes = Base64.getDecoder().decode(base64Part);

            BufferedImage src = ImageIO.read(new ByteArrayInputStream(rawBytes));
            if (src == null) return rawBytes;

            int w = src.getWidth();
            int h = src.getHeight();
            if (w <= 0 || h <= 0) return rawBytes;

            double scale = Math.min(1.0, (double) maxDim / Math.max(w, h));
            int nw = Math.max(1, (int) Math.round(w * scale));
            int nh = Math.max(1, (int) Math.round(h * scale));

            boolean tieneAlpha = preservarAlpha && src.getColorModel().hasAlpha();
            int imageType = tieneAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;

            BufferedImage dst = new BufferedImage(nw, nh, imageType);
            Graphics2D g2d = dst.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

            if (!tieneAlpha) {
                g2d.setColor(Color.WHITE);
                g2d.fillRect(0, 0, nw, nh);
            }
            g2d.drawImage(src, 0, 0, nw, nh, null);
            g2d.dispose();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            if (tieneAlpha) {
                ImageIO.write(dst, "png", baos);
                if (outEsPng != null && outEsPng.length > 0) outEsPng[0] = true;
            } else {
                Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
                if (writers.hasNext()) {
                    ImageWriter writer = writers.next();
                    ImageWriteParam param = writer.getDefaultWriteParam();
                    if (param.canWriteCompressed()) {
                        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                        param.setCompressionQuality(jpegQuality);
                    }
                    try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
                        writer.setOutput(ios);
                        writer.write(null, new IIOImage(dst, null, null), param);
                    } finally {
                        writer.dispose();
                    }
                } else {
                    ImageIO.write(dst, "jpg", baos);
                }
                if (outEsPng != null && outEsPng.length > 0) outEsPng[0] = false;
            }
            return baos.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    private static String redimensionarBase64(String dataUri, int maxDim, boolean preservarAlpha, float jpegQuality) {
        try {
            boolean[] salioPng = new boolean[]{false};
            byte[] bytes = procesarImagenBytes(dataUri, maxDim, preservarAlpha, jpegQuality, salioPng);
            if (bytes == null) return dataUri;
            String mimeOut = salioPng[0] ? "image/png" : "image/jpeg";
            String encoded = Base64.getEncoder().encodeToString(bytes);
            String result = "data:" + mimeOut + ";base64," + encoded;
            return result.length() < dataUri.length() ? result : dataUri;
        } catch (Exception e) {
            return dataUri;
        }
    }
}
