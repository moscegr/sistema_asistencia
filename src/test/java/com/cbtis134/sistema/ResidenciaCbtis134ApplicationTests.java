package com.cbtis134.sistema;

import com.cbtis134.sistema.config.ImageOptimizer;
import com.cbtis134.sistema.controller.UploadFallbackController;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class ResidenciaCbtis134ApplicationTests {

    @Test
    void testClasspathResource() {
        UploadFallbackController ctrl = new UploadFallbackController();
        ResponseEntity<byte[]> resp = ctrl.servirOReconstruirArchivo("logos", "logo_plantel.jpg");
        System.out.println("Default fallback status: " + resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertTrue(resp.getBody().length > 0);
    }

    @Test
    void testDecodificarBase64Seguro() {
        String original = "Hola Mundo";
        String b64 = Base64.getEncoder().encodeToString(original.getBytes());
        String conSaltos = "data:image/jpeg;base64,\r\n " + b64.substring(0, 4) + "\n \r " + b64.substring(4) + " \r\n";

        byte[] dec = ImageOptimizer.decodificarBase64Seguro(conSaltos);
        assertNotNull(dec);
        assertEquals(original, new String(dec));
    }

    @Test
    void testRealImageAndServe() throws Exception {
        BufferedImage img = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 100, 100);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", baos);
        String realJpgB64 = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(baos.toByteArray());

        String res = ImageOptimizer.guardarLogoEnDisco(realJpgB64, "logo_plantel");
        System.out.println("Result URL: " + res);
        String fileName = res.substring(res.lastIndexOf('/') + 1);

        UploadFallbackController ctrl = new UploadFallbackController();
        ResponseEntity<byte[]> resp = ctrl.servirOReconstruirArchivo("logos", fileName);
        System.out.println("Status: " + resp.getStatusCode());
        System.out.println("Content-Type: " + resp.getHeaders().getContentType());
        System.out.println("Bytes length: " + (resp.getBody() != null ? resp.getBody().length : "null"));
        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
    }

}
