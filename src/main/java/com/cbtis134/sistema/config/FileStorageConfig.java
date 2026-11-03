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
        if (!dir.exists() && System.getProperty("os.name", "").toLowerCase().contains("win")) {
            File localDir = new File(System.getProperty("user.dir"), "uploads");
            localDir.mkdirs();
            dir = localDir;
            uploadDir = dir.getAbsolutePath();
        } else {
            dir.mkdirs();
        }

        ImageOptimizer.setUploadDir(dir.getAbsolutePath());
        new File(dir, "alumnos").mkdirs();
        new File(dir, "usuarios").mkdirs();
        new File(dir, "logos").mkdirs();
        System.out.println("=== [FILE STORAGE] Directorio activo de almacenamiento: " + dir.getAbsolutePath() + " (escribible: " + dir.canWrite() + ") ===");
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
