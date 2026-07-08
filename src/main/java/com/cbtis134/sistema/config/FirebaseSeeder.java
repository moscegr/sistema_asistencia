package com.cbtis134.sistema.config;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.google.firebase.auth.UserRecord.CreateRequest;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@Component
public class FirebaseSeeder implements ApplicationRunner {

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String adminEmail = "admin@sistema.com";
        String adminPassword = "AdminCbtis134!";

        try {
            Firestore dbFirestore = FirestoreClient.getFirestore();
            
            ApiFuture<QuerySnapshot> future = dbFirestore.collection("usuarios").limit(1).get();
            QuerySnapshot querySnapshot = future.get();

            if (querySnapshot.isEmpty()) {
                System.out.println("=== [SEEDER] ¡Base de datos limpia detectada en Firestore! Sembrando Administrador... ===");

                try {
                    String uidGenerado;
                    try {
                        CreateRequest request = new CreateRequest()
                                .setEmail(adminEmail)
                                .setEmailVerified(true)
                                .setPassword(adminPassword)
                                .setDisplayName("Administrador Inicial");

                        UserRecord newUser = FirebaseAuth.getInstance().createUser(request);
                        uidGenerado = newUser.getUid();

                        Map<String, Object> claims = new HashMap<>();
                        claims.put("role", "ADMIN");
                        FirebaseAuth.getInstance().setCustomUserClaims(uidGenerado, claims);
                    } catch (Exception authEx) {
                        System.out.println("=== [SEEDER] Nota: Auth omitido o controlado de forma local. ===");
                        uidGenerado = "admin_maestro_inicial_cbtis";
                    }

                    Map<String, Object> perfilUsuario = new HashMap<>();
                    perfilUsuario.put("correo", adminEmail);
                    perfilUsuario.put("estatus", "Activo");
                    perfilUsuario.put("nombre", "Administrador Inicial");
                    perfilUsuario.put("permisos", Arrays.asList("ALL"));
                    perfilUsuario.put("rol", "ADMIN");
                    perfilUsuario.put("uid", uidGenerado);
                    perfilUsuario.put("ultimo_acceso", "Primer acceso pendiente");

                    dbFirestore.collection("usuarios").document(uidGenerado).set(perfilUsuario).get();

                    System.out.println("==================================================================");
                    System.out.println("¡SISTEMA INICIALIZADO CON ÉXITO DESDE EL FLUJO DE RESILIENCIA!");
                    System.out.println("Correo: " + adminEmail);
                    System.out.println("Contraseña: " + adminPassword);
                    System.out.println("==================================================================");

                } catch (Exception ex) {
                    System.err.println("=== [SEEDER] Error al escribir el documento inicial: " + ex.getMessage());
                }
            } else {
                System.out.println("=== [SEEDER] La base de datos ya cuenta con registros. Omitiendo siembra. ===");
            }
        } catch (Exception e) {
            System.err.println("=== [SEEDER] Fallo general en la verificación de Firestore: " + e.getMessage());
        }
    }
}