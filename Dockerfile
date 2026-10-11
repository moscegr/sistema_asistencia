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

# Crear usuario y grupo sin privilegios 'spring' para evitar ejecucion como root
RUN addgroup -g 1001 -S spring && adduser -u 1001 -S spring -G spring

# Crear directorio de subidas con permisos asignados
RUN mkdir -p /app/uploads && chown -R spring:spring /app

COPY --from=build --chown=spring:spring /app/target/*.jar app.jar

USER spring:spring

VOLUME ["/app/uploads"]

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:8080/ || exit 1

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]