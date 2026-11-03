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
            File fallbackDir = new File(System.getProperty("user.dir"), "uploads");
            fallbackDir.mkdirs();
            if (fallbackDir.exists() && fallbackDir.canWrite()) {
                dir = fallbackDir;
                uploadDir = dir.getAbsolutePath();
                System.out.println("=== [FILE STORAGE] Fallback de directorio de almacenamiento activado en: " + uploadDir + " ===");
            } else {
                File tmpDir = new File(System.getProperty("java.io.tmpdir"), "cbtis_uploads");
                tmpDir.mkdirs();
                if (tmpDir.exists()) {
                    dir = tmpDir;
                    uploadDir = dir.getAbsolutePath();
                    System.out.println("=== [FILE STORAGE] Fallback temporal de almacenamiento activado en: " + uploadDir + " ===");
                }
            }
        } else {
            System.out.println("=== [FILE STORAGE] Directorio de almacenamiento detectado en: " + dir.getAbsolutePath() + " ===");
        }

        ImageOptimizer.setUploadDir(uploadDir);
        new File(dir, "alumnos").mkdirs();
        new File(dir, "usuarios").mkdirs();
        new File(dir, "logos").mkdirs();
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
