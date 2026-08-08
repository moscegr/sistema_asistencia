package com.cbtis134.sistema.controller;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/whatsapp")
public class WhatsappController {

    @PostMapping("/twilio")
    public ResponseEntity<?> enviarMensajeTwilio(@RequestBody Map<String, String> payload) {
        String accountSid = payload.get("accountSid");
        String authToken = payload.get("authToken");
        String to = payload.get("to");
        String from = payload.get("from");
        String body = payload.get("body");

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(accountSid, authToken);

        try {
            String requestBody = "To=" + URLEncoder.encode(to, StandardCharsets.UTF_8.toString()) +
                                 "&From=" + URLEncoder.encode(from, StandardCharsets.UTF_8.toString()) +
                                 "&Body=" + URLEncoder.encode(body, StandardCharsets.UTF_8.toString());

            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de Twilio: " + e.getMessage());
            return ResponseEntity.status(500).body("Error de Twilio: " + e.getMessage());
        }
    }

    @PostMapping("/openwa")
    public ResponseEntity<?> enviarMensajeOpenWA(@RequestBody Map<String, String> payload) {

        String apiUrl = payload.get("apiUrl");
        String token = payload.get("token");
        String sessionId = payload.get("sessionId");
        String to = payload.get("to");     
        String body = payload.get("body");

        if (apiUrl != null && apiUrl.contains("/api/")) {
            apiUrl = apiUrl.split("/api/")[0]; 
        }
        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        String numeroLimpio = to.replace("whatsapp:", "").replace("+", "");

        String urlFinal = apiUrl + "/api/sessions/" + sessionId + "/messages/send-text";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.isEmpty()) {
            headers.setBearerAuth(token);
        }

        Map<String, String> jsonMap = Map.of(
            "chatId", numeroLimpio + "@c.us", 
            "text", body
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            System.out.println("[Proxy OpenWA] Disparando a: " + urlFinal);
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de OpenWA: " + e.getMessage());
            return ResponseEntity.status(500).body("Error de OpenWA: " + e.getMessage());
        }
    }
    
    @PostMapping("/ultramsg")
    public ResponseEntity<?> enviarMensajeUltramsg(@RequestBody Map<String, String> payload) {
        String instanceId = payload.get("instanceId");
        String token = payload.get("token");
        String to = payload.get("to");
        String body = payload.get("body");

        String urlFinal = "https://api.ultramsg.com/" + instanceId + "/messages/chat";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        try {
            String requestBody = "token=" + URLEncoder.encode(token, StandardCharsets.UTF_8.toString()) +
                                 "&to=" + URLEncoder.encode(to, StandardCharsets.UTF_8.toString()) +
                                 "&body=" + URLEncoder.encode(body, StandardCharsets.UTF_8.toString());

            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);
            RestTemplate restTemplate = new RestTemplate();

            System.out.println("[Proxy UltraMsg] Despachando a: " + urlFinal);
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
            
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de UltraMsg: " + e.getMessage());
            return ResponseEntity.status(500).body("Error de UltraMsg: " + e.getMessage());
        }
    }

    @PostMapping("/evolution")
    public ResponseEntity<?> enviarMensajeEvolutionAPI(@RequestBody Map<String, String> payload) {
        String apiUrl = payload.get("apiUrl");
        String apiKey = payload.get("apiKey");
        String instanceName = payload.get("instanceName");
        String to = payload.get("to");
        String body = payload.get("body");

        if (apiUrl != null) {
            apiUrl = apiUrl.trim();
            if (apiUrl.endsWith("/")) {
                apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
            }
        }
        if (instanceName != null) {
            instanceName = instanceName.trim();
        }

        // Limpiar número telefónico y asegurar código de país para México (52)
        String numeroLimpio = (to != null) ? to.replaceAll("[^0-9]", "") : "";
        if (numeroLimpio.length() == 10) {
            numeroLimpio = "52" + numeroLimpio;
        }

        String urlFinal = apiUrl + "/message/sendText/" + instanceName;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isEmpty()) {
            headers.set("apikey", apiKey.trim());
        }

        Map<String, Object> jsonMap = new HashMap<>();
        jsonMap.put("number", numeroLimpio);
        jsonMap.put("text", body);
        jsonMap.put("textMessage", Map.of("text", body));

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            System.out.println("[Proxy Evolution API] Despachando a: " + urlFinal + " para " + numeroLimpio);
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de Evolution API: " + e.getMessage());
            
            // Intento alternativo con el nombre de instancia en minúsculas si fue escrito diferente
            if (instanceName != null && !instanceName.equals(instanceName.toLowerCase())) {
                try {
                    String urlRetry = apiUrl + "/message/sendText/" + instanceName.toLowerCase();
                    System.out.println("[Proxy Evolution API] Reintentando con instancia en minúsculas: " + urlRetry);
                    ResponseEntity<String> res2 = restTemplate.postForEntity(urlRetry, request, String.class);
                    return ResponseEntity.ok(res2.getBody());
                } catch(Exception ex) {}
            }

            return ResponseEntity.status(500).body("Error de Evolution API: " + e.getMessage());
        }
    }

    @PostMapping("/wppconnect")
    public ResponseEntity<?> enviarMensajeWppConnect(@RequestBody Map<String, String> payload) {
        String apiUrl = payload.get("apiUrl");
        String token = payload.get("token");
        String session = payload.get("session");
        String to = payload.get("to");
        String body = payload.get("body");

        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        String numeroLimpio = to.replace("whatsapp:", "").replace("+", "").replace(" ", "");
        String urlFinal = apiUrl + "/api/" + session + "/send-message";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.isEmpty()) {
            headers.setBearerAuth(token);
        }

        Map<String, String> jsonMap = Map.of(
            "phone", numeroLimpio,
            "message", body
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            System.out.println("[Proxy WPPConnect] Despachando a: " + urlFinal);
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            System.err.println("Fallo en el Proxy de WPPConnect: " + e.getMessage());
            return ResponseEntity.status(500).body("Error de WPPConnect: " + e.getMessage());
        }
    }
}