package com.cbtis134.sistema.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import javax.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void initialize() {
        try {
            InputStream serviceAccount;

            String firebaseCredentialsJson = System.getenv("FIREBASE_CREDENTIALS_JSON");

            if (firebaseCredentialsJson != null && !firebaseCredentialsJson.isEmpty()) {
                serviceAccount = new ByteArrayInputStream(firebaseCredentialsJson.getBytes(StandardCharsets.UTF_8));
                System.out.println("=== [FIREBASE SDK] Inicializado desde variable segura en RAM (PROD) ===");
            } else {
                ClassPathResource resource = new ClassPathResource("serviceAccountKey.json");
                if (resource.exists()) {
                    serviceAccount = resource.getInputStream();
                    System.out.println("=== [FIREBASE SDK] Inicializado desde ClassPath interno (LOCAL/DEV) ===");
                } else {
                    throw new IllegalStateException("Error crítico: No se encontró la variable FIREBASE_CREDENTIALS_JSON ni el archivo local serviceAccountKey.json");
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
        } catch (IOException e) {
            System.err.println("ERROR CRÍTICO: No se pudo conectar con Firebase. " + e.getMessage());
        }
    }
}
