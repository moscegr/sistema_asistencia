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

Al arrancar la aplicación por primera vez con MongoDB vacío, se creará automáticamente el usuario administrador inicial:

- **Correo por defecto**: `koyer.pop@gmail.com` (o configurable mediante `ADMIN_EMAIL`).
- **Contraseña por defecto**: `kike1992` (o configurable mediante `ADMIN_PASSWORD`).

---

## 🔑 Variables de Entorno (Coolify / Producción)

Configura las siguientes variables en el panel de tu aplicación en Coolify:

| Variable | Descripción | Valor Ejemplo | Obligatorio |
| :--- | :--- | :--- | :---: |
| `SPRING_DATA_MONGODB_URI` | Cadena de conexión a MongoDB en Coolify | `mongodb://root:pass@mongodb:27017/cbtis134_db?authSource=admin` | **Sí** |
| `ADMIN_EMAIL` | Correo del Administrador Inicial | `koyer.pop@gmail.com` | No (opcional) |
| `ADMIN_PASSWORD` | Contraseña del Administrador Inicial | `kike1992` | No (opcional) |
| `UPLOAD_DIR` | Directorio de almacenamiento persistente | `/app/uploads` | No (opcional) |

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
