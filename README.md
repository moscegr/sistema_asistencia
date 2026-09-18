# 🏫 Sistema de Control de Acceso y Gestión Escolar

Sistema web escolar integral para el control de acceso, registro de asistencia mediante código QR, reconocimiento facial, expedientes de alumnos, seguimiento conductual/médico y notificación automática a tutores por WhatsApp.

Diseñado para ser **100% independiente, autosostenible y sin costo de licencias o APIs externas**, desplegable fácilmente en un servidor VPS mediante **Coolify** utilizando contenedores Docker.

---

## 🏗️ Arquitectura en Coolify (Docker)

```mermaid
graph TD
    User["👤 Navegador Web (Admin, Prefectura, Orientación, Guardia)"]
    Coolify["🖥️ Servidor VPS (Coolify Container Engine)"]
    
    subgraph Coolify
        App["☕ Spring Boot App (Java 17)<br/>Puerto 8080"]
        Mongo[("🍃 MongoDB Container<br/>Base de Datos Interna")]
        Storage[("📁 Volumen Persistente<br/>/app/uploads")]
        Wpp["💬 Evolution API / WPPConnect<br/>Gateway WhatsApp en Docker"]
    end
    
    User -->|HTTPS (Puerto 443)| App
    App -->|Red Interna Docker| Mongo
    App -->|Archivos y Multimedia| Storage
    App -->|Notificaciones| Wpp
    Wpp -->|Mensajes a Tutores| User
```

---

## 🛠️ Tecnologías

- **Backend**: Java 17, Spring Boot 3.4.2 (Spring Data MongoDB, Spring Security 6 con BCrypt).
- **Base de Datos**: MongoDB.
- **Frontend**: Thymeleaf, HTML5, CSS3, JavaScript.
- **Generación / Lectura de QR**: Google ZXing.
- **Reconocimiento Facial**: `face-api.js` (procesamiento 100% local en navegador cliente).
- **Notificaciones WhatsApp**: Integración multicanal (Evolution API, WPPConnect, Twilio, OpenWA, UltraMsg).

---

## 🔑 Variables de Entorno (Producción / Coolify)

Configura las siguientes variables en el panel de tu aplicación en **Coolify** o en tu archivo `.env`:

| Variable | Descripción | Formato / Ejemplo Genérico | Requerido |
| :--- | :--- | :--- | :---: |
| `SPRING_DATA_MONGODB_URI` | Cadena de conexión interna a MongoDB dentro de la red Docker | `mongodb://<usuario>:<password>@<servicio_mongo>:27017/<nombre_db>?authSource=admin` | **Sí** |
| `ADMIN_EMAIL` | Correo electrónico de la cuenta de Administrador Principal | `admin@institucion.edu.mx` | Opcional |
| `ADMIN_PASSWORD` | Contraseña segura para el Administrador Principal | `TuPasswordFuerteYUnico2026!#` | Opcional |
| `APP_UPLOAD_DIR` | Directorio interno del contenedor para subidas y respaldos | `/app/uploads` | Opcional (Default: `/app/uploads`) |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | Tamaño máximo permitido por archivo | `50MB` | Opcional |
| `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | Tamaño máximo por petición multipart | `50MB` | Opcional |

---

## 💾 Almacenamiento Persistente en Coolify (Storages)

Para evitar la pérdida de fotografías, credenciales y documentos al reconstruir o reiniciar los contenedores:

1. En **Coolify**, ve a la sección de tu aplicación.
2. En la pestaña **Storages / Volumes**, añade un volumen persistente:
   - **Destination Path**: `/app/uploads`
3. Guarda los cambios y despliega.

---

## 💬 Integración de Pasarelas de WhatsApp

El sistema incluye endpoints proxy para enviar notificaciones automáticas a tutores:

### 1. Evolution API (Docker)
- **Endpoint**: `POST /api/whatsapp/evolution`
- **Payload de ejemplo**:
  ```json
  {
    "apiUrl": "http://evolution-api:8080",
    "apiKey": "TU_API_KEY_AQUI",
    "instanceName": "instancia_escolar",
    "to": "+520000000000",
    "body": "Estimado tutor, el alumno ha registrado su entrada al plantel."
  }
  ```

### 2. WPPConnect Server (Docker)
- **Endpoint**: `POST /api/whatsapp/wppconnect`
- **Payload de ejemplo**:
  ```json
  {
    "apiUrl": "http://wppconnect:21465",
    "token": "TU_BEARER_TOKEN_AQUI",
    "session": "sesion_escolar",
    "to": "+520000000000",
    "body": "Notificación escolar institucional."
  }
  ```

---

## 🚀 Despliegue en VPS con Coolify

1. **Base de Datos**: Crea un servicio privado de **MongoDB** en Coolify y obtén su URI interna.
2. **Aplicación Web**: Crea una nueva aplicación desde tu repositorio Git en Coolify.
3. **Variables de Entorno**: Agrega `SPRING_DATA_MONGODB_URI`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
4. **Almacenamiento**: Configura el volumen persistente en `/app/uploads`.
5. **Dominio**: Asigna tu dominio en **FQDN** con HTTPS (ej. `https://control.institucion.edu.mx`).
6. **Desplegar**: Coolify utilizará el `Dockerfile` multietapa para compilar y ejecutar el proyecto con un usuario no-root seguro.
