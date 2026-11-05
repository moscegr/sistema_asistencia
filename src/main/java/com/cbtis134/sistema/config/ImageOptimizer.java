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
        File defaultApp = new File("/app/uploads");
        if (defaultApp.exists() || (!System.getProperty("os.name", "").toLowerCase().contains("win") && defaultApp.mkdirs())) {
            return "/app/uploads";
        }
        return new File(System.getProperty("user.dir"), "uploads").getAbsolutePath();
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
            byte[] jpegBytes = procesarImagenBytes(dataUriOrUrl, 1200, false, 0.95f, new boolean[]{false});
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
     * Si la escritura en disco no es posible de inmediato, asegura de todas formas una URL pública
     * válida (/uploads/logos/...) para que UploadFallbackController sirva los bytes directamente desde MongoDB.
     */
    public static String guardarLogoEnDisco(String dataUriOrUrl, String identificador) {
        if (dataUriOrUrl == null || dataUriOrUrl.isBlank()) {
            return dataUriOrUrl;
        }
        if (!esBase64Imagen(dataUriOrUrl)) {
            return dataUriOrUrl;
        }
        try {
            boolean esFirmaOSello = identificador != null && (identificador.contains("firma") || identificador.contains("sello"));
            boolean esPngOriginal = esFirmaOSello || dataUriOrUrl.startsWith("data:image/png") || dataUriOrUrl.startsWith("data:image/webp");
            boolean[] salioPng = new boolean[]{false};
            byte[] imgBytes = esFirmaOSello
                    ? procesarFirmaOSelloTransparenteBytes(dataUriOrUrl, 1000)
                    : procesarImagenBytes(dataUriOrUrl, 1200, esPngOriginal, 0.95f, salioPng);
            if (imgBytes == null || imgBytes.length == 0) {
                imgBytes = decodificarBase64Seguro(dataUriOrUrl);
            }

            String tempId = limpiarNombreArchivo(identificador);
            if (tempId.isEmpty()) {
                tempId = "logo_" + System.currentTimeMillis();
            }
            final String safeId = tempId;

            String ext = esFirmaOSello ? ".png" : ((salioPng != null && salioPng.length > 0 && salioPng[0]) ? ".png" : (esPngOriginal ? ".png" : ".jpg"));
            long version = System.currentTimeMillis();
            String fileName = safeId + "_" + version + ext;

            try {
                File folder = new File(getUploadDir(), "logos");
                if (folder.exists() || folder.mkdirs()) {
                    // Limpiar versiones anteriores de este identificador
                    File[] oldFiles = folder.listFiles((d, name) -> name.startsWith(safeId));
                    if (oldFiles != null) {
                        for (File old : oldFiles) {
                            try { old.delete(); } catch (Exception ignored) {}
                        }
                    }
                    if (imgBytes != null && imgBytes.length > 0) {
                        File targetFile = new File(folder, fileName);
                        try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                            fos.write(imgBytes);
                        }
                    }
                }
            } catch (Exception writeEx) {
                System.err.println("[IMAGE STORAGE] Aviso al escribir logo en disco: " + writeEx.getMessage());
            }

            return "/uploads/logos/" + fileName;
        } catch (Exception e) {
            System.err.println("[IMAGE STORAGE] Error en procesamiento de logo: " + e.getMessage());
            return "/uploads/logos/" + limpiarNombreArchivo(identificador) + "_" + System.currentTimeMillis() + ".jpg";
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

    /**
     * Decodifica con máxima tolerancia cualquier cadena Base64 o Data URI,
     * ignorando espacios en blanco, saltos de línea \r\n y aplicando MimeDecoder como contingencia.
     */
    public static byte[] decodificarBase64Seguro(String dataUriOrRaw) {
        if (dataUriOrRaw == null || dataUriOrRaw.isBlank()) return null;
        try {
            int commaIdx = dataUriOrRaw.indexOf(',');
            String raw = (commaIdx >= 0) ? dataUriOrRaw.substring(commaIdx + 1) : dataUriOrRaw;
            raw = raw.replaceAll("\\s+", "");
            try {
                return Base64.getDecoder().decode(raw);
            } catch (Exception e) {
                return Base64.getMimeDecoder().decode(raw);
            }
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Reconstruye físicamente en disco (/app/uploads/{subcarpeta}/{nombreArchivo}) un archivo a partir de su
     * cadena Base64 preservada en MongoDB. Devuelve true si se pudo restaurar exitosamente.
     */
    public static boolean restaurarArchivoEnDisco(String subcarpeta, String nombreArchivoConExt, String dataUri) {
        if (dataUri == null || !esBase64Imagen(dataUri) || subcarpeta == null || nombreArchivoConExt == null) {
            return false;
        }
        try {
            boolean esFirmaOSello = nombreArchivoConExt.contains("firma") || nombreArchivoConExt.contains("sello");
            boolean esPng = esFirmaOSello || dataUri.startsWith("data:image/png") || dataUri.startsWith("data:image/webp");
            boolean[] outPng = new boolean[]{false};
            byte[] bytes = esFirmaOSello
                    ? procesarFirmaOSelloTransparenteBytes(dataUri, 1000)
                    : procesarImagenBytes(dataUri, 1200, esPng, 0.95f, outPng);
            if (bytes == null || bytes.length == 0) {
                bytes = decodificarBase64Seguro(dataUri);
            }
            if (bytes == null || bytes.length == 0) return false;

            File folder = new File(getUploadDir(), limpiarNombreArchivo(subcarpeta));
            if (!folder.exists() && !folder.mkdirs()) return false;

            File targetFile = new File(folder, nombreArchivoConExt);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(bytes);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Procesa una fotografía de firma o sello oficial eliminando automáticamente el fondo
     * blanco/gris del papel y convirtiendo los píxeles claros en transparencia alfa,
     * devolviendo los bytes en formato PNG nítido.
     */
    public static byte[] procesarFirmaOSelloTransparenteBytes(String dataUri, int maxDim) {
        try {
            byte[] rawBytes = decodificarBase64Seguro(dataUri);
            if (rawBytes == null || rawBytes.length == 0) return null;

            BufferedImage src = ImageIO.read(new ByteArrayInputStream(rawBytes));
            if (src == null) return rawBytes;

            int w = src.getWidth();
            int h = src.getHeight();
            if (w <= 0 || h <= 0) return rawBytes;

            double scale = Math.min(1.0, (double) maxDim / Math.max(w, h));
            int nw = Math.max(1, (int) Math.round(w * scale));
            int nh = Math.max(1, (int) Math.round(h * scale));

            BufferedImage scaled = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g2d = scaled.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.drawImage(src, 0, 0, nw, nh, null);
            g2d.dispose();

            // Muestrear las esquinas y bordes para calibrar el tono del papel
            int[][] samplePts = {
                {2, 2}, {nw - 3, 2}, {2, nh - 3}, {nw - 3, nh - 3},
                {nw / 2, 2}, {2, nh / 2}, {nw - 3, nh / 2}, {nw / 2, nh - 3}
            };
            long sumR = 0, sumG = 0, sumB = 0;
            int countBg = 0;
            for (int[] pt : samplePts) {
                int px = pt[0], py = pt[1];
                if (px >= 0 && px < nw && py >= 0 && py < nh) {
                    int rgb = scaled.getRGB(px, py);
                    int a = (rgb >> 24) & 0xff;
                    int r = (rgb >> 16) & 0xff;
                    int g = (rgb >> 8) & 0xff;
                    int b = rgb & 0xff;
                    double lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    if (a > 50 && lum > 140) {
                        sumR += r; sumG += g; sumB += b;
                        countBg++;
                    }
                }
            }
            int bgR = countBg > 0 ? (int)(sumR / countBg) : 250;
            int bgG = countBg > 0 ? (int)(sumG / countBg) : 250;
            int bgB = countBg > 0 ? (int)(sumB / countBg) : 250;

            BufferedImage transparentDst = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_ARGB);
            for (int y = 0; y < nh; y++) {
                for (int x = 0; x < nw; x++) {
                    int rgb = scaled.getRGB(x, y);
                    int a = (rgb >> 24) & 0xff;
                    int r = (rgb >> 16) & 0xff;
                    int g = (rgb >> 8) & 0xff;
                    int b = rgb & 0xff;
                    if (a == 0) {
                        transparentDst.setRGB(x, y, 0);
                        continue;
                    }

                    double lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    int maxC = Math.max(r, Math.max(g, b));
                    int minC = Math.min(r, Math.min(g, b));
                    double sat = maxC == 0 ? 0 : (double)(maxC - minC) / maxC;
                    double dist = Math.sqrt((r - bgR)*(r - bgR) + (g - bgG)*(g - bgG) + (b - bgB)*(b - bgB));

                    if ((lum > 215 && sat < 0.18) || dist < 28) {
                        transparentDst.setRGB(x, y, 0); // Papel blanco/gris -> 100% transparente
                    } else if (dist < 80 && lum > 165 && sat < 0.25) {
                        // Transición suave en bordes anti-aliasing
                        double factor = (dist - 28) / (80 - 28);
                        int newA = (int) Math.min(a, factor * 255);
                        int nr = (int) Math.max(0, Math.min(255, Math.round(r * 0.70)));
                        int ng = (int) Math.max(0, Math.min(255, Math.round(g * 0.70)));
                        int nb = (int) Math.max(0, Math.min(255, Math.round(b * 0.70)));
                        transparentDst.setRGB(x, y, (newA << 24) | (nr << 16) | (ng << 8) | nb);
                    } else {
                        // Tinta nítida y profunda (más negrita y realista)
                        int nr = (int) Math.max(0, Math.min(255, Math.round(r * 0.65)));
                        int ng = (int) Math.max(0, Math.min(255, Math.round(g * 0.65)));
                        int nb = (int) Math.max(0, Math.min(255, Math.round(b * 0.65)));
                        transparentDst.setRGB(x, y, (a << 24) | (nr << 16) | (ng << 8) | nb);
                    }
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(transparentDst, "png", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Convierte una cadena Data URI a formato PNG transparente si corresponde a firma o sello.
     */
    public static String convertirFirmaOSelloBase64Transparente(String dataUri) {
        if (!esBase64Imagen(dataUri)) return dataUri;
        try {
            byte[] pngBytes = procesarFirmaOSelloTransparenteBytes(dataUri, 800);
            if (pngBytes != null && pngBytes.length > 0) {
                return "data:image/png;base64," + Base64.getEncoder().encodeToString(pngBytes);
            }
        } catch (Exception ignored) {}
        return dataUri;
    }

    public static String sanitizarUrlOExistente(String url, String fallbackDefault) {
        if (url == null || url.isBlank()) {
            return fallbackDefault;
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

            byte[] rawBytes = decodificarBase64Seguro(dataUri);
            if (rawBytes == null || rawBytes.length == 0) return null;

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
