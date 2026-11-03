package com.cbtis134.sistema.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import jakarta.annotation.PostConstruct;
import java.io.File;

@Configuration
public class FileStorageConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:/app/uploads}")
    private String uploadDir;

    @PostConstruct
    public void init() {
        File dir = new File(uploadDir);
        boolean dirOk = dir.exists();
        if (!dirOk) {
            try {
                dirOk = dir.mkdirs();
            } catch (Exception ignored) {}
        }
        if (!dirOk || !dir.canWrite()) {
            // Si /app/uploads no se puede crear o carece de permisos de escritura (ej. Windows local),
            // usar fallback relativo seguro en el directorio de ejecución para garantizar persistencia física
            File fallbackDir = new File(System.getProperty("user.dir"), "uploads");
            fallbackDir.mkdirs();
            if (fallbackDir.exists()) {
                dir = fallbackDir;
                uploadDir = dir.getAbsolutePath();
                System.out.println("=== [FILE STORAGE] Fallback de directorio de almacenamiento activado en: " + uploadDir + " ===");
            }
        } else {
            System.out.println("=== [FILE STORAGE] Directorio de almacenamiento detectado en: " + dir.getAbsolutePath() + " ===");
        }

        ImageOptimizer.setUploadDir(uploadDir);
        new File(dir, "alumnos").mkdirs();
        new File(dir, "usuarios").mkdirs();
        File logosDir = new File(dir, "logos");
        logosDir.mkdirs();

        copiarLogoPorDefectoSiFalta(logosDir, "logo_plantel.jpg", "/static/img/logo_aniversario.jpg");
        copiarLogoPorDefectoSiFalta(logosDir, "logo_plantel.png", "/static/img/logo-cbtis.png");
        copiarLogoPorDefectoSiFalta(logosDir, "logo_inicio.png", "/static/img/tigres.png");
        copiarLogoPorDefectoSiFalta(logosDir, "logo_inicio.jpg", "/static/img/tigres.png");
    }

    private void copiarLogoPorDefectoSiFalta(File logosDir, String nombreArchivo, String rutaClasspath) {
        File destino = new File(logosDir, nombreArchivo);
        if (!destino.exists() || destino.length() == 0) {
            try (java.io.InputStream in = getClass().getResourceAsStream(rutaClasspath)) {
                if (in != null) {
                    java.nio.file.Files.copy(in, destino.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        File dir = new File(uploadDir);
        String location = dir.toURI().toString();
        if (!location.endsWith("/")) {
            location += "/";
        }
        
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location)
                .setCachePeriod(3600);

        registry.addResourceHandler("/img/**")
                .addResourceLocations("classpath:/static/img/");

        registry.addResourceHandler("/css/**")
                .addResourceLocations("classpath:/static/css/");

        registry.addResourceHandler("/js/**")
                .addResourceLocations("classpath:/static/js/");

        registry.addResourceHandler("/qrs/**")
                .addResourceLocations("classpath:/static/qrs/");

        registry.addResourceHandler("/models/**")
                .addResourceLocations("classpath:/static/models/")
                .setCachePeriod(31536000); // 1 year cache
    }

    @Override
    public void addCorsMappings(org.springframework.web.servlet.config.annotation.CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
