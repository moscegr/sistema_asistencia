# Stage 1: Compilar la aplicacion con Maven
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# Stage 2: Imagen final ligera y segura para ejecucion
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Crear usuario y grupo sin privilegios 'spring' para evitar ejecucion como root
RUN addgroup -g 1001 -S spring && adduser -u 1001 -S spring -G spring

# Crear directorio de subidas con permisos asignados
RUN mkdir -p /app/uploads && chown -R spring:spring /app

COPY --from=build --chown=spring:spring /app/target/*.jar app.jar

USER spring:spring

VOLUME ["/app/uploads"]

EXPOSE 8080

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]