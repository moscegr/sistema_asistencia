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
import java.util.Base64;
import java.util.Iterator;

/**
 * Optimiza imágenes Base64 (data:image/...;base64,...) en memoria para evitar
 * transferencias multimillonarias en bytes en logos institucionales y fotos de perfil.
 */
public class ImageOptimizer {

    // Umbral aproximado: ~42 KB en binario (~56,000 caracteres en Base64)
    private static final int MAX_BASE64_LENGTH = 56000;

    public static boolean requiereOptimizacion(String dataUri) {
        return dataUri != null
                && dataUri.startsWith("data:image/")
                && dataUri.contains(";base64,")
                && dataUri.length() > MAX_BASE64_LENGTH;
    }

    /**
     * Optimiza una foto de perfil (usuario o alumno) a máximo 320x320 en JPEG (calidad 0.82, ~15-22 KB).
     */
    public static String optimizarFotoPerfil(String dataUri) {
        if (!requiereOptimizacion(dataUri)) {
            return dataUri;
        }
        return redimensionarBase64(dataUri, 320, false, 0.82f);
    }

    /**
     * Optimiza un logotipo institucional a máximo 280x280 preservando transparencia PNG si aplica.
     */
    public static String optimizarLogo(String dataUri) {
        if (!requiereOptimizacion(dataUri)) {
            return dataUri;
        }
        boolean esPng = dataUri.startsWith("data:image/png") || dataUri.startsWith("data:image/webp");
        return redimensionarBase64(dataUri, 280, esPng, 0.85f);
    }

    private static String redimensionarBase64(String dataUri, int maxDim, boolean preservarAlpha, float jpegQuality) {
        try {
            int commaIdx = dataUri.indexOf(',');
            if (commaIdx < 0) return dataUri;

            String base64Part = dataUri.substring(commaIdx + 1).trim();
            byte[] rawBytes = Base64.getDecoder().decode(base64Part);

            BufferedImage src = ImageIO.read(new ByteArrayInputStream(rawBytes));
            if (src == null) return dataUri;

            int w = src.getWidth();
            int h = src.getHeight();
            if (w <= 0 || h <= 0) return dataUri;

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
            String mimeOut;

            if (tieneAlpha) {
                ImageIO.write(dst, "png", baos);
                mimeOut = "image/png";
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
                mimeOut = "image/jpeg";
            }

            String encoded = Base64.getEncoder().encodeToString(baos.toByteArray());
            String result = "data:" + mimeOut + ";base64," + encoded;
            return result.length() < dataUri.length() ? result : dataUri;
        } catch (Exception e) {
            return dataUri;
        }
    }
}
