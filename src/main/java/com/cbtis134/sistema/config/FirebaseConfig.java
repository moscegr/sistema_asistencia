package com.cbtis134.sistema.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void initialize() {
        try {
            InputStream serviceAccount = null;

            String firebaseCredentialsJson = System.getenv("FIREBASE_CREDENTIALS_JSON");

            if (firebaseCredentialsJson != null && !firebaseCredentialsJson.trim().isEmpty()) {
                serviceAccount = new ByteArrayInputStream(firebaseCredentialsJson.getBytes(StandardCharsets.UTF_8));
                System.out.println("=== [FIREBASE SDK] Inicializado desde variable segura en RAM (PROD) ===");
            } else {
                ClassPathResource resource = new ClassPathResource("serviceAccountKey.json");
                if (resource.exists()) {
                    serviceAccount = resource.getInputStream();
                    System.out.println("=== [FIREBASE SDK] Inicializado desde ClassPath interno (LOCAL/DEV) ===");
                } else {
                    System.out.println("=== [FIREBASE SDK] ADVERTENCIA: No se encontró la variable FIREBASE_CREDENTIALS_JSON ni el archivo local serviceAccountKey.json ===");
                    System.out.println("=== [FIREBASE SDK] La aplicación continuará en modo seguro/local. ===");
                    return;
                }
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setDatabaseUrl("https://cbtis134-37029.firebaseio.com")
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
                System.out.println("=================================================");
                System.out.println("¡CONEXIÓN EXITOSA CON FIREBASE - CBTIS 134!");
                System.out.println("=================================================");
            }
        } catch (Exception e) {
            System.err.println("ADVERTENCIA: No se pudo inicializar Firebase SDK: " + e.getMessage());
        }
    }
}
