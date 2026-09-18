# 🏫 Sistema Control de Acceso y Asistencia por QR - CBTis 134

Sistema web escolar de control de acceso, registro de asistencia mediante código QR, reconocimiento facial, expedientes de alumnos, seguimiento conductual/médico y notificación automática a tutores por WhatsApp.

Diseñado para ser **100% independiente, autosostenible y 0% costo de licencias o APIs externas**, desplegable fácilmente en un VPS mediante **Coolify** utilizando contenedores Docker.

---

## 🏗️ Arquitectura 100% Self-Hosted en Coolify

```mermaid
graph TD
    User["👤 Navegador (Admin, Prefectura, Orientación, Alumnos)"]
    Coolify["🖥️ VPS (Coolify Container Engine)"]
    
    subgraph Coolify
        App["☕ Spring Boot App (Java 17)<br/>Port 8080"]
        Mongo[("🍃 MongoDB Container<br/>Base de Datos")]
        Storage[("📁 Persistent Volume<br/>/app/uploads")]
        Wpp["💬 Evolution API / WPPConnect<br/>WhatsApp Gateway Docker"]
    end
    
    User -->|HTTP / HTTPS| App
    App -->|Persistencia| Mongo
    App -->|Archivos y Documentos| Storage
    App -->|Envío de Notificaciones| Wpp
    Wpp -->|Notificaciones a Tutores| User
```

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Java 17, Spring Boot 3.4.2 (Spring Data MongoDB, Spring Security 6 con BCrypt).
- **Base de Datos**: MongoDB.
- **Frontend**: Thymeleaf, HTML5, CSS3, JavaScript.
- **Generación / Escaneo de QR**: Google ZXing (3.5.3).
- **Reconocimiento Facial**: `face-api.js` (procesamiento 100% local en cliente).
- **Gateway de WhatsApp**: Proxy integrado multicanal (Evolution API, WPPConnect, Twilio, OpenWA, UltraMsg).

---

## 🔐 Administrador Inicial (Seeder Automático)

Al arrancar la aplicación por primera vez con MongoDB vacío, se inicializará el usuario administrador principal:

- **Correo por defecto**: `admin@cbtis134.edu.mx` (o configurable mediante la variable `ADMIN_EMAIL`).
- **Contraseña por defecto**: `AdminCBTis134_2026!` (o configurable mediante la variable `ADMIN_PASSWORD`).

---

## 🔑 Variables de Entorno (Coolify / Producción / Docker)

Configura las siguientes variables en el panel de tu aplicación en **Coolify** o en tu archivo `.env`:

| Variable | Descripción | Valor Ejemplo / Formato | Requerido |
| :--- | :--- | :--- | :---: |
| `SPRING_DATA_MONGODB_URI` | Cadena de conexión interna a MongoDB en la red Docker de Coolify | `mongodb://<usuario>:<password>@<host_o_servicio>:27017/<nombre_db>?authSource=admin` | **Sí** |
| `ADMIN_EMAIL` | Correo electrónico del Administrador Principal | `admin@tudominio.edu.mx` | Opcional |
| `ADMIN_PASSWORD` | Contraseña segura para el Administrador Principal | `TuPasswordFuerte2026!#` | Opcional |
| `APP_UPLOAD_DIR` | Ruta interna del contenedor para archivos multimedia y respaldos | `/app/uploads` | Opcional |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | Tamaño máximo permitido por archivo | `50MB` | Opcional |
| `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | Tamaño máximo por petición HTTP multipart | `50MB` | Opcional |

---

## 📁 Almacenamiento Persistente en Coolify (Persistent Storage)

Para evitar la pérdida de archivos cargados (Excels de alumnos, imágenes de credenciales, formatos de justificantes) al reiniciar o desplegar nuevas versiones en Coolify:

1. Ve a tu aplicación en **Coolify**.
2. En la pestaña **Storages / Volumes**, agrega un volumen persistente:
   - **Destination Path**: `/app/uploads`
3. Guarda los cambios y haz redeploy.

---

## 💬 Integraciones de WhatsApp Integradas (Proxy Endpoints)

El sistema incluye proxies REST para enviar mensajes automáticamente a los tutores a través de 5 proveedores distintos:

### 1. Evolution API (Recomendado 100% Gratis en Docker)
- **Endpoint**: `POST /api/whatsapp/evolution`
- **Payload**:
  ```json
  {
    "apiUrl": "http://evolution-api:8080",
    "apiKey": "TU_API_KEY",
    "instanceName": "cbtis134",
    "to": "+527471234567",
    "body": "Estimado tutor, su hijo ha ingresado al plantel."
  }
  ```

### 2. WPPConnect Server (100% Gratis en Docker)
- **Endpoint**: `POST /api/whatsapp/wppconnect`
- **Payload**:
  ```json
  {
    "apiUrl": "http://wppconnect:21465",
    "token": "TU_BEARER_TOKEN",
    "session": "cbtis134_session",
    "to": "+527471234567",
    "body": "Notificación escolar CBTis 134."
  }
  ```

### 3. OpenWA
- **Endpoint**: `POST /api/whatsapp/openwa`

### 4. UltraMsg
- **Endpoint**: `POST /api/whatsapp/ultramsg`

### 5. Twilio
- **Endpoint**: `POST /api/whatsapp/twilio`

---

## 🚀 Despliegue en VPS con Coolify

1. **Crear Servicio MongoDB**: Despliega un servicio de MongoDB en Coolify y copia su cadena de conexión.
2. **Crear Aplicación**: Conecta este repositorio de GitHub en Coolify (`moscegr/residencia-cbtis`).
3. **Configurar Variables**: Agrega `SPRING_DATA_MONGODB_URI` en las variables de entorno.
4. **Configurar Volumen**: Asigna el volumen en la ruta `/app/uploads`.
5. **Desplegar**: Coolify utilizará el `Dockerfile` multietapa para compilar y ejecutar el proyecto automáticamente.
