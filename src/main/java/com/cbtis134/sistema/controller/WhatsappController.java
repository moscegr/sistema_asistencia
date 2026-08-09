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

    private String normalizarNumero(String to) {
        String num = (to != null) ? to.replaceAll("[^0-9]", "") : "";
        if (num.length() == 10) {
            num = "52" + num;
        }
        return num;
    }

    @PostMapping("/twilio")
    public ResponseEntity<?> enviarMensajeTwilio(@RequestBody Map<String, String> payload) {
        String accountSid = payload.get("accountSid");
        String authToken = payload.get("authToken");
        String to = normalizarNumero(payload.get("to"));
        String from = payload.get("from");
        String body = payload.get("body");

        String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(accountSid, authToken);

        try {
            String requestBody = "To=" + URLEncoder.encode("whatsapp:+" + to, StandardCharsets.UTF_8.toString()) +
                                 "&From=" + URLEncoder.encode(from, StandardCharsets.UTF_8.toString()) +
                                 "&Body=" + URLEncoder.encode(body, StandardCharsets.UTF_8.toString());

            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error de Twilio: " + e.getMessage());
        }
    }

    @PostMapping("/openwa")
    public ResponseEntity<?> enviarMensajeOpenWA(@RequestBody Map<String, String> payload) {
        String apiUrl = payload.get("apiUrl");
        String token = payload.get("token");
        String sessionId = payload.get("sessionId");
        String to = normalizarNumero(payload.get("to"));     
        String body = payload.get("body");

        if (apiUrl != null && apiUrl.contains("/api/")) {
            apiUrl = apiUrl.split("/api/")[0]; 
        }
        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        String urlFinal = apiUrl + "/api/sessions/" + sessionId + "/messages/send-text";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.isEmpty()) {
            headers.setBearerAuth(token);
        }

        Map<String, String> jsonMap = Map.of(
            "chatId", to + "@c.us", 
            "text", body
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error de OpenWA: " + e.getMessage());
        }
    }
    
    @PostMapping("/ultramsg")
    public ResponseEntity<?> enviarMensajeUltramsg(@RequestBody Map<String, String> payload) {
        String instanceId = payload.get("instanceId");
        String token = payload.get("token");
        String to = normalizarNumero(payload.get("to"));
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

            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error de UltraMsg: " + e.getMessage());
        }
    }

    @PostMapping("/evolution")
    public ResponseEntity<?> enviarMensajeEvolutionAPI(@RequestBody Map<String, String> payload) {
        String apiUrl = payload.get("apiUrl");
        String apiKey = payload.get("apiKey");
        String instanceName = payload.get("instanceName");
        String to = normalizarNumero(payload.get("to"));
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

        String urlFinal = apiUrl + "/message/sendText/" + instanceName;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isEmpty()) {
            String keyClean = apiKey.trim();
            headers.set("apikey", keyClean);
            headers.set("apiKey", keyClean);
        }

        Map<String, Object> jsonMap = new HashMap<>();
        jsonMap.put("number", to);
        jsonMap.put("text", body);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error de Evolution API: " + e.getMessage());
        }
    }

    @PostMapping("/wppconnect")
    public ResponseEntity<?> enviarMensajeWppConnect(@RequestBody Map<String, String> payload) {
        String apiUrl = payload.get("apiUrl");
        String token = payload.get("token");
        String session = payload.get("session");
        String to = normalizarNumero(payload.get("to"));
        String body = payload.get("body");

        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        String urlFinal = apiUrl + "/api/" + session + "/send-message";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.isEmpty()) {
            headers.setBearerAuth(token);
        }

        Map<String, String> jsonMap = Map.of(
            "phone", to,
            "message", body
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error de WPPConnect: " + e.getMessage());
        }
    }
}