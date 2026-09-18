package com.cbtis134.sistema.controller;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
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

    @Autowired
    private MongoTemplate mongoTemplate;

    private String normalizarNumero(String to) {
        if (to == null) return "";
        String num = to.replaceAll("[^0-9]", "");
        if (num.length() == 10) {
            num = "52" + num;
        } else if (num.length() == 11 && num.startsWith("1")) {
            num = "52" + num.substring(1);
        }
        return num;
    }

    /**
     * Endpoint unificado para el envío de notificaciones automáticas y personalizadas.
     * Carga automáticamente las credenciales desde MongoDB si no vienen en la petición.
     */
    @PostMapping(value = {"/enviar-mensaje", "/enviar"})
    public ResponseEntity<?> enviarMensajeGenerico(@RequestBody Map<String, Object> payload) {
        String to = null;
        if (payload.containsKey("to") && payload.get("to") != null) {
            to = String.valueOf(payload.get("to"));
        } else if (payload.containsKey("telefono") && payload.get("telefono") != null) {
            to = String.valueOf(payload.get("telefono"));
        } else if (payload.containsKey("phone") && payload.get("phone") != null) {
            to = String.valueOf(payload.get("phone"));
        }

        String body = null;
        if (payload.containsKey("body") && payload.get("body") != null) {
            body = String.valueOf(payload.get("body"));
        } else if (payload.containsKey("mensaje") && payload.get("mensaje") != null) {
            body = String.valueOf(payload.get("mensaje"));
        } else if (payload.containsKey("text") && payload.get("text") != null) {
            body = String.valueOf(payload.get("text"));
        }

        if (to == null || to.trim().isEmpty() || body == null || body.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Número telefónico destinatario y mensaje son requeridos."));
        }

        // Consultar configuración en MongoDB
        Document configWs = mongoTemplate.findById("whatsapp", Document.class, "configuracion");
        Document configSys = mongoTemplate.findById("sistema", Document.class, "configuracion");

        if (configSys != null && Boolean.FALSE.equals(configSys.getBoolean("notificaciones_whatsapp_activas"))) {
            return ResponseEntity.ok(Map.of("status", "skipped", "message", "Notificaciones de WhatsApp desactivadas globalmente en el sistema."));
        }
        if (configWs != null && Boolean.FALSE.equals(configWs.getBoolean("notificaciones_whatsapp_activas"))) {
            return ResponseEntity.ok(Map.of("status", "skipped", "message", "Notificaciones de WhatsApp desactivadas en la configuración."));
        }

        String tipoApi = null;
        if (payload.containsKey("tipo_api") && payload.get("tipo_api") != null) {
            tipoApi = String.valueOf(payload.get("tipo_api"));
        } else if (payload.containsKey("tipoApi") && payload.get("tipoApi") != null) {
            tipoApi = String.valueOf(payload.get("tipoApi"));
        } else if (configWs != null && configWs.containsKey("tipo_api")) {
            tipoApi = configWs.getString("tipo_api");
        }

        if (tipoApi == null || tipoApi.trim().isEmpty()) {
            tipoApi = "EVOLUTION";
        }
        tipoApi = tipoApi.trim().toUpperCase();

        Map<String, String> dispatchMap = new HashMap<>();
        dispatchMap.put("to", to);
        dispatchMap.put("body", body);

        if (configWs != null) {
            for (String key : configWs.keySet()) {
                Object val = configWs.get(key);
                if (val != null) dispatchMap.put(key, String.valueOf(val));
            }
        }
        for (String key : payload.keySet()) {
            Object val = payload.get(key);
            if (val != null) dispatchMap.put(key, String.valueOf(val));
        }

        switch (tipoApi) {
            case "EVOLUTION":
                return enviarMensajeEvolutionAPI(dispatchMap);
            case "WPPCONNECT":
                return enviarMensajeWppConnect(dispatchMap);
            case "ULTRAMSG":
                return enviarMensajeUltramsg(dispatchMap);
            case "TWILIO":
                return enviarMensajeTwilio(dispatchMap);
            case "OPENWA":
                return enviarMensajeOpenWA(dispatchMap);
            case "META":
                return enviarMensajeMeta(dispatchMap);
            default:
                return ResponseEntity.badRequest().body(Map.of("error", "Proveedor de WhatsApp no reconocido: " + tipoApi));
        }
    }

    @PostMapping("/twilio")
    public ResponseEntity<?> enviarMensajeTwilio(@RequestBody Map<String, String> payload) {
        String accountSid = payload.get("accountSid");
        String authToken = payload.get("authToken") != null ? payload.get("authToken") : payload.get("token");
        String to = normalizarNumero(payload.get("to"));
        String from = payload.get("from");
        String body = payload.get("body");

        if (accountSid == null || authToken == null || from == null) {
            return ResponseEntity.badRequest().body("Parámetros insuficientes para Twilio (accountSid, authToken, from).");
        }

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
        String apiUrl = payload.get("apiUrl") != null ? payload.get("apiUrl") : payload.get("serverUrl");
        String token = payload.get("token") != null ? payload.get("token") : payload.get("apiKey");
        String sessionId = payload.get("sessionId") != null ? payload.get("sessionId") : payload.get("instanceName");
        String to = normalizarNumero(payload.get("to"));     
        String body = payload.get("body");

        if (apiUrl != null && apiUrl.contains("/api/")) {
            apiUrl = apiUrl.split("/api/")[0]; 
        }
        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }

        String urlFinal = apiUrl + "/api/sessions/" + (sessionId != null ? sessionId : "default") + "/messages/send-text";

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
        String instanceId = payload.get("instanceId") != null ? payload.get("instanceId") : payload.get("instanceName");
        String token = payload.get("token") != null ? payload.get("token") : payload.get("apiKey");
        String to = normalizarNumero(payload.get("to"));
        String body = payload.get("body");

        if (instanceId == null || token == null) {
            return ResponseEntity.badRequest().body("Parámetros insuficientes para UltraMsg (instanceId, token).");
        }

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
        String apiUrl = payload.get("apiUrl") != null ? payload.get("apiUrl") : payload.get("serverUrl");
        String apiKey = payload.get("apiKey") != null ? payload.get("apiKey") : payload.get("token");
        String instanceName = payload.get("instanceName") != null ? payload.get("instanceName") : payload.get("sessionName");
        String to = normalizarNumero(payload.get("to"));
        String body = payload.get("body");

        if (apiUrl == null || apiKey == null || instanceName == null) {
            return ResponseEntity.badRequest().body("Parámetros insuficientes para Evolution API (apiUrl, apiKey, instanceName).");
        }

        apiUrl = apiUrl.trim();
        if (apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }
        instanceName = instanceName.trim();

        String urlFinal = apiUrl + "/message/sendText/" + instanceName;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String keyClean = apiKey.trim();
        headers.set("apikey", keyClean);
        headers.set("apiKey", keyClean);

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
        String apiUrl = payload.get("apiUrl") != null ? payload.get("apiUrl") : payload.get("serverUrl");
        String token = payload.get("token") != null ? payload.get("token") : payload.get("apiKey");
        String session = payload.get("session") != null ? payload.get("session") : (payload.get("instanceName") != null ? payload.get("instanceName") : "cbtis134");
        String to = normalizarNumero(payload.get("to"));
        String body = payload.get("body");

        if (apiUrl == null) {
            return ResponseEntity.badRequest().body("Falta apiUrl para WPPConnect.");
        }

        apiUrl = apiUrl.trim();
        if (apiUrl.endsWith("/")) {
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

    @PostMapping("/meta")
    public ResponseEntity<?> enviarMensajeMeta(@RequestBody Map<String, String> payload) {
        String token = payload.get("token") != null ? payload.get("token") : (payload.get("apiKey") != null ? payload.get("apiKey") : payload.get("accessToken"));
        String phoneNumberId = payload.get("phoneNumberId") != null ? payload.get("phoneNumberId") : (payload.get("instanceId") != null ? payload.get("instanceId") : payload.get("instanceName"));
        String to = normalizarNumero(payload.get("to"));
        String body = payload.get("body");

        if (token == null || phoneNumberId == null) {
            return ResponseEntity.badRequest().body("Parámetros insuficientes para Meta WhatsApp API (token, phoneNumberId).");
        }

        String urlFinal = "https://graph.facebook.com/v20.0/" + phoneNumberId.trim() + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token.trim());

        Map<String, Object> textObj = Map.of("body", body);
        Map<String, Object> jsonMap = Map.of(
            "messaging_product", "whatsapp",
            "recipient_type", "individual",
            "to", to,
            "type", "text",
            "text", textObj
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(jsonMap, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(urlFinal, request, String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error de Meta WhatsApp API: " + e.getMessage());
        }
    }
}