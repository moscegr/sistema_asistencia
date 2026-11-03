# Stage 1: Compilar la aplicacion con Maven
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# Stage 2: Imagen final ligera y segura para ejecucion
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Instalar curl para healthchecks de Docker y Coolify
RUN apk add --no-cache curl

# Crear directorio de subidas con permisos asignados
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads

COPY --from=build /app/target/*.jar app.jar

VOLUME ["/app/uploads"]

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:8080/ || exit 1

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]