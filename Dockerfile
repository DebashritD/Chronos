# One image serving both the web app and the API (same origin, so the session cookie just works).

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS api
WORKDIR /api
COPY api/gradlew api/settings.gradle api/build.gradle ./
COPY api/gradle gradle
RUN ./gradlew resolveDependencies --no-daemon --console=plain
COPY api/src src
COPY --from=web /web/dist src/main/resources/static
RUN ./gradlew bootJar --no-daemon --offline --console=plain -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=api /api/build/libs/api-*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
