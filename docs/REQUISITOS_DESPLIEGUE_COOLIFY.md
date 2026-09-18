# 📄 ESPECIFICACIÓN TÉCNICA: DESPLIEGUE DEL SISTEMA EN COOLIFY (DOCKER)
**Plataforma de Control de Acceso y Gestión Escolar**  
*Guía de Requisitos, Configuración de Recursos y Despliegue en Coolify PaaS*

---

## 1. 🖥️ REQUISITOS DEL SERVIDOR (VPS / DEDICADO)

Coolify es un PaaS autoalojado que gestiona contenedores Docker y el proxy inverso Traefik de forma automática. A continuación se presentan los requisitos del servidor para alojar Coolify + la aplicación Spring Boot + la base de datos MongoDB:

| Recurso | Requisito Mínimo (Entorno Base / Pruebas) | Requisito Recomendado (Producción +1,500 Alumnos) |
| :--- | :--- | :--- |
| **Sistema Operativo** | Ubuntu Server 22.04 / 24.04 LTS (x86_64 o ARM64) | Ubuntu Server 24.04 LTS (x86_64) |
| **Núcleos de CPU** | 2 vCPUs | 4 vCPUs |
| **Memoria RAM** | 4 GB RAM + 2 GB Swap | 8 GB RAM + 4 GB Swap |
| **Almacenamiento (Disco)** | 40 GB SSD / NVMe | 80+ GB NVMe (Alta velocidad I/O) |
| **Ancho de Banda / Red** | 100 Mbps (IP Pública Estática) | 1 Gbps (IP Pública Estática) |
| **Puertos de Firewall** | 80, 443 (Web/SSL) y 22 (SSH) | 80, 443, 22 y 8000 (Panel Coolify) |

---

## 2. 🏗️ ARQUITECTURA DE CONTENEDORES EN COOLIFY

Coolify orquesta los siguientes componentes dentro de su red interna:

1. **Traefik (Proxy Inverso de Coolify):** Gestiona certificados SSL automáticos con Let's Encrypt y balancea el tráfico HTTPS hacia el puerto 8080 de la aplicación.
2. **Aplicación Spring Boot (Java 17):** Se ejecuta en su propio contenedor Docker con acceso al volumen persistente /app/uploads. Límite de RAM sugerido: 2 GB - 3 GB.
3. **MongoDB 7.0:** Se ejecuta en un contenedor dedicado o base de datos gestionada en Coolify con almacenamiento persistente en /data/db. Límite de RAM sugerido: 1.5 GB - 2 GB.

---

## 3. ⚙️ ARCHIVO DOCKER-COMPOSE LISTO PARA COOLIFY

En Coolify puedes crear un recurso de tipo **Docker Compose** y pegar la siguiente configuración:

\\\yaml
version: '3.8'

services:
  # 1. Base de Datos MongoDB
  mongodb:
    image: mongo:7.0
    container_name: cbtis_mongodb
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: \
      MONGO_INITDB_ROOT_PASSWORD: \
      MONGO_INITDB_DATABASE: residencia_cbtis
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 2. Aplicación Principal Spring Boot
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cbtis_app
    restart: always
    depends_on:
      mongodb:
        condition: service_healthy
    environment:
      SPRING_DATA_MONGODB_URI: mongodb://\:\@mongodb:27017/residencia_cbtis?authSource=admin
      SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE: 50MB
      SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE: 50MB
      APP_UPLOAD_DIR: /app/uploads
      ADMIN_EMAIL: \
      ADMIN_PASSWORD: \
    volumes:
      - app_uploads:/app/uploads
    expose:
      - "8080"

volumes:
  mongo_data:
    name: cbtis_mongo_data
  app_uploads:
    name: cbtis_app_uploads
\\\

---

## 4. 🔑 VARIABLES DE ENTORNO EN COOLIFY

Configurar en la pestaña **Environment Variables** de la aplicación:

| Variable | Valor / Ejemplo | Descripción |
| :--- | :--- | :--- |
| `SPRING_DATA_MONGODB_URI` | `mongodb://<usuario>:<password>@mongodb:27017/residencia_cbtis?authSource=admin` | Conexión interna a MongoDB |
| `APP_UPLOAD_DIR` | `/app/uploads` | Ruta interna para almacenamiento de fotos/documentos |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | `50MB` | Límite por archivo multimedia |
| `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | `50MB` | Límite por petición HTTP |
| `ADMIN_EMAIL` | `admin@tudominio.edu.mx` | Correo inicial de administración |
| `ADMIN_PASSWORD` | `TuPasswordSeguro2026!#` | Contraseña del administrador |

---

## 5. 💾 VOLÚMENES PERSISTENTES EN COOLIFY (Storages)

Para evitar la pérdida de fotografías y datos al reconstruir la imagen:

* **Volumen 1 (App):** \pp_uploads\ montado en \/app/uploads\
* **Volumen 2 (Base de datos):** \mongo_data\ montado en \/data/db\

---

## 6. 🌐 DOMINIO Y SSL EN COOLIFY

1. Ingresar el dominio completo en el campo **FQDN** (ej. \https://residencia.cbtis134.edu.mx\).
2. Configurar el registro **DNS A** en tu proveedor de dominio apuntando a la IP pública del VPS.
3. Coolify y Traefik generarán el certificado SSL HTTPS Let's Encrypt automáticamente.
