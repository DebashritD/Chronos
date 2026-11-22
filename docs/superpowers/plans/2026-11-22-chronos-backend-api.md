# Chronos Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chronos REST API: multi-user password auth, habits with DAILY / EVERY_N_DAYS / WEEKLY frequencies, RED/YELLOW/GREEN check-ins within a 7-day edit window, and week/month/streak stats.

**Architecture:** Spring Boot 4 app in `api/` mirroring `../Dionysus/api`: `JdbcClient` repositories, Flyway migrations, Spring Session JDBC cookie sessions with SPA-style CSRF, problem-details errors. All date logic is pure Java in `com.chronos.habit.domain` (unit-tested), used by `HabitService` (edit-window checks) and `StatsService` (views). A `Clock` bean makes "today" (in the user's timezone) testable.

**Tech Stack:** Java 21, Spring Boot 4.1.2, Gradle 9.9.1 wrapper, Postgres 17, Flyway, Spring Security 7, JUnit 5, AssertJ, Testcontainers.

**Spec:** `docs/superpowers/specs/2026-11-22-chronos-habit-tracker-design.md`

## Global Constraints

- Java 21 toolchain; Spring Boot `4.1.2`; `io.spring.dependency-management` `1.1.7`; Gradle wrapper `9.9.1` (copied from `../Dionysus/api`).
- Base package `com.chronos`; packages `core.{auth,user,config,error,web}`, `habit` (records, repositories, services, controllers, DTOs side by side), `habit.domain` (pure date logic, no Spring), `stats` (week/month/streak views).
- Edit window: a period is editable only if its last day ≥ `today − 7 days`.
- Week starts on Monday.
- Username: 3–32 chars `[a-zA-Z0-9_.-]`, stored lowercase. Password: 8–128 chars.
- Login throttle: 10 failed attempts per username or per IP within 15 minutes → 429 `TOO_MANY_ATTEMPTS`.
- Every POST/PUT/DELETE requires the `X-XSRF-TOKEN` header matching the `XSRF-TOKEN` cookie.
- Errors are `ProblemDetail` JSON with a `code` property (an `ErrorCode` name).
- Environment variables: `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `COOKIE_SECURE` (default `true`), `PORT` (default `8080`).
- Local Postgres (docker compose) listens on host port `5433` so it can run alongside Dionysus on `5432`.
- Production: Render (free Docker web service) + Neon (free Postgres, its own database). Deployment files are created in the web plan, since the image bundles the web app.
- Integration tests run against a fixed clock: `2026-11-18T06:30:00Z` (Wednesday); test users use timezone `Asia/Kolkata`, so "today" is `2026-11-18` and the current week starts `2026-11-16`.
- Every commit ends with the trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- Docker must be running for integration tests. With Rancher Desktop first run:
  `export DOCKER_HOST=unix://$HOME/.rd/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`

---

### Task 1: Project scaffold, schema, health and SPA serving

**Files:**
- Create: `.gitignore`, `api/build.gradle`, `api/settings.gradle`, `api/docker-compose.yml`, `api/.env.example`
- Copy: `api/gradlew`, `api/gradlew.bat`, `api/gradle/` (from `../Dionysus/api`)
- Create: `api/src/main/resources/application.yml`, `api/src/main/resources/db/migration/V1__init.sql`
- Create: `api/src/main/java/com/chronos/ChronosApplication.java`
- Create: `api/src/main/java/com/chronos/core/config/{ClockConfig,SessionConfig,SecurityConfig}.java` (SecurityConfig completed in Task 2)
- Create: `api/src/main/java/com/chronos/core/error/{ErrorCode,ApiException,GlobalExceptionHandler}.java`
- Create: `api/src/main/java/com/chronos/core/web/{HealthController,SpaWebConfig}.java`
- Test: `api/src/test/java/com/chronos/support/{TestcontainersConfig,IntegrationTest}.java`, `api/src/test/resources/static/{index.html,assets/app-abc123.js}`, `api/src/test/java/com/chronos/ApplicationStartupTest.java`, `api/src/test/java/com/chronos/core/web/SpaIntegrationTest.java`

**Interfaces:**
- Produces: `Clock` bean; `ApiException(ErrorCode, String)`, `ApiException.notFound(String what)`; `ErrorCode` values `VALIDATION(400)`, `BAD_CREDENTIALS(401)`, `NOT_FOUND(404)`, `USERNAME_TAKEN(409)`, `INVALID_STATE(409)`, `CONFLICT(409)`, `CHECK_IN_NOT_ALLOWED(422)`, `TOO_MANY_ATTEMPTS(429)`.
- Produces (tests): abstract `IntegrationTest` with `mvc`, `jdbc`, `TODAY` (`LocalDate.of(2026, 11, 18)`), `xsrf()`. Task 2 adds user helpers.
- Tables: `app_user`, `habit`, `habit_pause`, `check_in`, `spring_session`, `spring_session_attributes`.

- [ ] **Step 1: Create root `.gitignore` and copy the Gradle wrapper**

`.gitignore`:
```
.idea/
*.iml
.DS_Store
node_modules/
web/dist/
web/test-results/
web/playwright-report/
.superpowers/
api/.gradle/
api/build/
api/.env
```

Run:
```bash
mkdir -p api && cp -R ../Dionysus/api/gradlew ../Dionysus/api/gradlew.bat ../Dionysus/api/gradle api/
```

- [ ] **Step 2: Create build files and local Postgres**

`api/settings.gradle`:
```groovy
rootProject.name = 'api'
```

`api/build.gradle`:
```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '4.1.2'
    id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.chronos'
version = '0.1.0'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-webmvc'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-jdbc'
    implementation 'org.springframework.boot:spring-boot-starter-flyway'
    implementation 'org.springframework.boot:spring-boot-starter-session-jdbc'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.flywaydb:flyway-database-postgresql'
    runtimeOnly 'org.postgresql:postgresql'

    testImplementation 'org.springframework.boot:spring-boot-starter-webmvc-test'
    testImplementation 'org.springframework.boot:spring-boot-starter-security-test'
    testImplementation 'org.springframework.boot:spring-boot-testcontainers'
    testImplementation 'org.testcontainers:testcontainers-postgresql'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

`api/docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: chronos
      POSTGRES_USER: chronos
      POSTGRES_PASSWORD: chronos
    ports:
      - "5433:5432"   # 5432 is left free for Dionysus
    volumes:
      - chronos-pg:/var/lib/postgresql/data

volumes:
  chronos-pg:
```

`api/.env.example`:
```
# Copy to api/.env (gitignored). Load with: set -a && . ./.env && set +a
COOKIE_SECURE=false            # only for plain-HTTP local development
# DATABASE_URL=jdbc:postgresql://localhost:5433/chronos
# DATABASE_USER=chronos
# DATABASE_PASSWORD=chronos
# PORT=8080
```

- [ ] **Step 3: Create `application.yml` and the migration**

`api/src/main/resources/application.yml`:
```yaml
spring:
  application:
    name: chronos-api
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5433/chronos}
    username: ${DATABASE_USER:chronos}
    password: ${DATABASE_PASSWORD:chronos}
  session:
    jdbc:
      initialize-schema: never
    timeout: 30d

server:
  port: ${PORT:8080}
  forward-headers-strategy: framework

chronos:
  cookie:
    secure: ${COOKIE_SECURE:true}
```

`api/src/main/resources/db/migration/V1__init.sql`:
```sql
CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    timezone      VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE habit (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    name          VARCHAR(80)  NOT NULL,
    min_text      VARCHAR(200) NOT NULL,
    target_text   VARCHAR(200) NOT NULL,
    frequency     VARCHAR(16)  NOT NULL CHECK (frequency IN ('DAILY', 'EVERY_N_DAYS', 'WEEKLY')),
    interval_days INT,
    start_date    DATE         NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT habit_interval_ck CHECK (
        (frequency = 'EVERY_N_DAYS' AND interval_days BETWEEN 2 AND 365)
        OR (frequency <> 'EVERY_N_DAYS' AND interval_days IS NULL))
);
CREATE INDEX habit_user_ix ON habit (user_id);

-- Inclusive date range; to_date NULL means the pause is still open (at most one open pause per habit).
CREATE TABLE habit_pause (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    habit_id  BIGINT NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
    from_date DATE   NOT NULL,
    to_date   DATE,
    CONSTRAINT habit_pause_range_ck CHECK (to_date IS NULL OR to_date >= from_date)
);
CREATE UNIQUE INDEX habit_pause_open_ux ON habit_pause (habit_id) WHERE to_date IS NULL;

CREATE TABLE check_in (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    habit_id     BIGINT      NOT NULL REFERENCES habit (id) ON DELETE CASCADE,
    period_start DATE        NOT NULL,
    color        VARCHAR(8)  NOT NULL CHECK (color IN ('RED', 'YELLOW', 'GREEN')),
    note         VARCHAR(500),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_in_period_uq UNIQUE (habit_id, period_start)
);

-- Spring Session JDBC (copied from spring-session-jdbc schema-postgresql.sql)
CREATE TABLE spring_session (
    primary_id            CHAR(36) NOT NULL,
    session_id            CHAR(36) NOT NULL,
    creation_time         BIGINT   NOT NULL,
    last_access_time      BIGINT   NOT NULL,
    max_inactive_interval INT      NOT NULL,
    expiry_time           BIGINT   NOT NULL,
    principal_name        VARCHAR(100),
    CONSTRAINT spring_session_pk PRIMARY KEY (primary_id)
);
CREATE UNIQUE INDEX spring_session_ix1 ON spring_session (session_id);
CREATE INDEX spring_session_ix2 ON spring_session (expiry_time);
CREATE INDEX spring_session_ix3 ON spring_session (principal_name);

CREATE TABLE spring_session_attributes (
    session_primary_id CHAR(36)     NOT NULL,
    attribute_name     VARCHAR(200) NOT NULL,
    attribute_bytes    BYTEA        NOT NULL,
    CONSTRAINT spring_session_attributes_pk PRIMARY KEY (session_primary_id, attribute_name),
    CONSTRAINT spring_session_attributes_fk FOREIGN KEY (session_primary_id)
        REFERENCES spring_session (primary_id) ON DELETE CASCADE
);
```

- [ ] **Step 4: Write the test support and failing tests**

`api/src/test/java/com/chronos/support/TestcontainersConfig.java`:
```java
package com.chronos.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    /** Wednesday 2026-11-18, 12:00 in Asia/Kolkata. */
    public static final Instant NOW = Instant.parse("2026-11-18T06:30:00Z");

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:17-alpine");
    }

    @Bean
    @Primary
    Clock fixedClock() {
        return Clock.fixed(NOW, ZoneOffset.UTC);
    }
}
```

`api/src/test/java/com/chronos/support/IntegrationTest.java`:
```java
package com.chronos.support;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@SpringBootTest(properties = {
        "chronos.cookie.secure=false",
        // Docker VMs (e.g. Rancher Desktop) can expose the container port a moment after it is ready
        "spring.flyway.connect-retries=10"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
public abstract class IntegrationTest {

    public static final LocalDate TODAY = LocalDate.of(2026, 11, 18);

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcClient jdbc;

    /** Empties every application table (keeps Flyway history), so new tables need no changes here. */
    @BeforeEach
    void cleanDatabase() {
        List<String> tables = jdbc.sql("""
                        SELECT tablename FROM pg_tables
                        WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history'
                        """)
                .query(String.class)
                .list();
        jdbc.sql("TRUNCATE " + String.join(", ", tables) + " RESTART IDENTITY CASCADE").update();
    }

    /**
     * Sends a matching XSRF-TOKEN cookie and X-XSRF-TOKEN header, exactly like the SPA does.
     * (Spring Security's {@code csrf()} test helper rewires the shared filter and leaks between tests.)
     */
    protected static RequestPostProcessor xsrf() {
        return request -> {
            Cookie token = new Cookie("XSRF-TOKEN", "test-xsrf-token");
            Cookie[] existing = request.getCookies() == null ? new Cookie[0] : request.getCookies();
            Cookie[] cookies = Arrays.copyOf(existing, existing.length + 1);
            cookies[existing.length] = token;
            request.setCookies(cookies);
            request.addHeader("X-XSRF-TOKEN", token.getValue());
            return request;
        };
    }
}
```

`api/src/test/resources/static/index.html`:
```html
<!doctype html><title>Chronos test</title><div id="root"></div>
```

`api/src/test/resources/static/assets/app-abc123.js`:
```js
console.log('test')
```

`api/src/test/java/com/chronos/ApplicationStartupTest.java`:
```java
package com.chronos;

import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ApplicationStartupTest extends IntegrationTest {

    @Test
    void migrationsCreateAllTables() {
        List<String> tables = jdbc.sql("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """).query(String.class).list();

        assertThat(tables).contains(
                "app_user", "habit", "habit_pause", "check_in", "spring_session", "spring_session_attributes");
    }
}
```

`api/src/test/java/com/chronos/core/web/SpaIntegrationTest.java`:
```java
package com.chronos.core.web;

import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SpaIntegrationTest extends IntegrationTest {

    @Test
    void clientRoutesServeIndexWithoutCaching() throws Exception {
        for (String path : new String[] {"/month", "/habits", "/login?next=/month"}) {
            mvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("Chronos test")))
                    .andExpect(header().string("Cache-Control", "no-cache"));
        }
    }

    @Test
    void rootIsForwardedToIndex() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk()).andExpect(forwardedUrl("index.html"));
    }

    @Test
    void fingerprintedAssetsAreCachedForever() throws Exception {
        mvc.perform(get("/assets/app-abc123.js"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("immutable")));
    }

    @Test
    void missingFilesAndUnknownApiPathsAreNotFoundRatherThanIndex() throws Exception {
        mvc.perform(get("/assets/missing.js")).andExpect(status().isNotFound());
        mvc.perform(get("/robots.txt")).andExpect(status().isNotFound());
        mvc.perform(get("/api/public/nope")).andExpect(status().isNotFound());
    }

    @Test
    void healthIsPublicAndUncached() throws Exception {
        mvc.perform(get("/api/public/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd api && ./gradlew test`
Expected: FAIL — no `@SpringBootConfiguration` found (no `ChronosApplication` yet).

- [ ] **Step 6: Write the application, config, errors and web classes**

`api/src/main/java/com/chronos/ChronosApplication.java`:
```java
package com.chronos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ChronosApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChronosApplication.class, args);
    }
}
```

`api/src/main/java/com/chronos/core/config/ClockConfig.java`:
```java
package com.chronos.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
```

`api/src/main/java/com/chronos/core/config/SessionConfig.java`:
```java
package com.chronos.core.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SessionConfig {

    @Bean
    CookieSerializer cookieSerializer(@Value("${chronos.cookie.secure:true}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("SESSION");
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(secure);
        serializer.setSameSite("Lax");
        return serializer;
    }
}
```

`api/src/main/java/com/chronos/core/config/SecurityConfig.java` (initial; Task 2 replaces it):
```java
package com.chronos.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.savedrequest.NullRequestCache;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.spa())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                        // The web app itself (index.html, assets, client-side routes) is public.
                        .requestMatchers(request -> HttpMethod.GET.matches(request.getMethod())
                                && !request.getRequestURI().startsWith("/api/")).permitAll()
                        .anyRequest().authenticated())
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());
        return http.build();
    }
}
```

`api/src/main/java/com/chronos/core/error/ErrorCode.java`:
```java
package com.chronos.core.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION(HttpStatus.BAD_REQUEST),
    BAD_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    USERNAME_TAKEN(HttpStatus.CONFLICT),
    INVALID_STATE(HttpStatus.CONFLICT),
    CONFLICT(HttpStatus.CONFLICT),
    CHECK_IN_NOT_ALLOWED(HttpStatus.UNPROCESSABLE_CONTENT),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
```

> If `HttpStatus.UNPROCESSABLE_CONTENT` doesn't compile, use `HttpStatus.UNPROCESSABLE_ENTITY` (same code, 422).

`api/src/main/java/com/chronos/core/error/ApiException.java`:
```java
package com.chronos.core.error;

public class ApiException extends RuntimeException {

    private final ErrorCode code;

    public ApiException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }

    public static ApiException notFound(String what) {
        return new ApiException(ErrorCode.NOT_FOUND, what + " not found");
    }
}
```

`api/src/main/java/com/chronos/core/error/GlobalExceptionHandler.java`:
```java
package com.chronos.core.error;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApi(ApiException ex) {
        return problem(ex.code(), ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleInvalidBody(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return problem(ErrorCode.VALIDATION, detail);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> handleUnreadable(HttpMessageNotReadableException ex) {
        return problem(ErrorCode.VALIDATION, "Malformed request body");
    }

    @ExceptionHandler({HandlerMethodValidationException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class})
    ResponseEntity<ProblemDetail> handleInvalidParam(Exception ex) {
        return problem(ErrorCode.VALIDATION, "Invalid request parameter");
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ProblemDetail> handleAuth(AuthenticationException ex) {
        return problem(ErrorCode.BAD_CREDENTIALS, "Invalid username or password");
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<ProblemDetail> handleDuplicate(DuplicateKeyException ex) {
        return problem(ErrorCode.CONFLICT, "Resource already exists");
    }

    private static ResponseEntity<ProblemDetail> problem(ErrorCode code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(code.status(), detail);
        body.setProperty("code", code.name());
        return ResponseEntity.status(code.status()).body(body);
    }
}
```

`api/src/main/java/com/chronos/core/web/HealthController.java`:
```java
package com.chronos.core.web;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Liveness probe for the hosting platform; deliberately does not touch the database. */
@RestController
public class HealthController {

    @GetMapping("/api/public/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("status", "UP"));
    }
}
```

`api/src/main/java/com/chronos/core/web/SpaWebConfig.java`:
```java
package com.chronos.core.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.time.Duration;

/**
 * Serves the built web app (copied to {@code classpath:/static/} by the Docker build) from the same
 * origin as the API, so the session cookie works without CORS. Client-side routes such as
 * {@code /month} fall back to {@code index.html}; {@code /api/**} and missing files stay 404.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

    private static final String LOCATION = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Vite fingerprints everything under /assets, so it can be cached forever.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(LOCATION + "assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());

        registry.addResourceHandler("/**")
                .addResourceLocations(LOCATION)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(false)
                .addResolver(new SpaFallbackResolver());
    }

    static class SpaFallbackResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String path, Resource location) throws IOException {
            Resource resource = location.createRelative(path);
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            String lastSegment = path.substring(path.lastIndexOf('/') + 1);
            if (path.startsWith("api/") || lastSegment.contains(".")) {
                return null;
            }
            Resource index = location.createRelative("index.html");
            return index.exists() ? index : null;
        }
    }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd api && ./gradlew test`
Expected: BUILD SUCCESSFUL; `ApplicationStartupTest` and `SpaIntegrationTest` pass.

- [ ] **Step 8: Commit**

```bash
git add .gitignore api
git commit -m "feat(api): scaffold Spring Boot app with schema, health and SPA serving" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Accounts and authentication

**Files:**
- Create: `api/src/main/java/com/chronos/core/user/{User,UserRepository,UserService,AppUserPrincipal,AppUserDetailsService}.java`
- Create: `api/src/main/java/com/chronos/core/auth/{LoginThrottle,SessionLogin,AccountService,AuthController,SignupRequest,LoginRequest,UpdateMeRequest,MeResponse}.java`
- Modify: `api/src/main/java/com/chronos/core/config/SecurityConfig.java` (full replacement below)
- Modify: `api/src/test/java/com/chronos/support/IntegrationTest.java` (add user helpers)
- Test: `api/src/test/java/com/chronos/core/auth/LoginThrottleTest.java`, `api/src/test/java/com/chronos/core/auth/AuthIntegrationTest.java`

**Interfaces:**
- Consumes: `ApiException`, `ErrorCode`, `Clock` (Task 1).
- Produces:
  - `record AppUserPrincipal(long id, String username, String passwordHash) implements UserDetails` — controllers take `@AuthenticationPrincipal AppUserPrincipal principal` and use `principal.id()`.
  - `UserService#today(long userId): LocalDate` — "today" in the user's timezone.
  - `UserRepository#insert(String username, String passwordHash, String timezone): long`.
  - Tests: `IntegrationTest.createUser(String username): AppUserPrincipal` (timezone `Asia/Kolkata`, password `PASSWORD`), `IntegrationTest.as(AppUserPrincipal): RequestPostProcessor`.
- Endpoints: `GET /api/auth/csrf`, `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/me`.

- [ ] **Step 1: Write the failing throttle unit test**

`api/src/test/java/com/chronos/core/auth/LoginThrottleTest.java`:
```java
package com.chronos.core.auth;

import com.chronos.core.error.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginThrottleTest {

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-18T00:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginThrottle throttle = new LoginThrottle(clock);

    @Test
    void blocksAKeyAfterTenFailures() {
        for (int i = 0; i < 9; i++) {
            throttle.recordFailure("user:bob");
        }
        assertThatCode(() -> throttle.check("user:bob")).doesNotThrowAnyException();

        throttle.recordFailure("user:bob");

        assertThatThrownBy(() -> throttle.check("user:bob", "ip:1.2.3.4")).isInstanceOf(ApiException.class);
        assertThatCode(() -> throttle.check("user:alice", "ip:1.2.3.4")).doesNotThrowAnyException();
    }

    @Test
    void failuresExpireAfterTheWindow() {
        for (int i = 0; i < 10; i++) {
            throttle.recordFailure("ip:1.2.3.4");
        }
        clock.now = clock.now.plus(Duration.ofMinutes(15)).plusSeconds(1);

        assertThatCode(() -> throttle.check("ip:1.2.3.4")).doesNotThrowAnyException();
    }

    @Test
    void resetClearsOnlyThatKey() {
        for (int i = 0; i < 10; i++) {
            throttle.recordFailure("user:bob", "ip:1.2.3.4");
        }
        throttle.reset("user:bob");

        assertThatCode(() -> throttle.check("user:bob")).doesNotThrowAnyException();
        assertThatThrownBy(() -> throttle.check("ip:1.2.3.4")).isInstanceOf(ApiException.class);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*LoginThrottleTest'`
Expected: compilation FAILS — `LoginThrottle` does not exist.

- [ ] **Step 3: Implement `LoginThrottle`**

`api/src/main/java/com/chronos/core/auth/LoginThrottle.java`:
```java
package com.chronos.core.auth;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/** Sliding-window failed-login counter per key ("user:&lt;name&gt;" and "ip:&lt;addr&gt;"). */
@Component
public class LoginThrottle {

    static final int MAX_FAILURES = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> failures = new HashMap<>();
    private final Clock clock;

    public LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    public synchronized void check(String... keys) {
        for (String key : keys) {
            if (pruned(key).size() >= MAX_FAILURES) {
                throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Too many failed logins; try again later");
            }
        }
    }

    public synchronized void recordFailure(String... keys) {
        Instant now = clock.instant();
        for (String key : keys) {
            pruned(key);
            failures.computeIfAbsent(key, k -> new ArrayDeque<>()).addLast(now);
        }
    }

    public synchronized void reset(String key) {
        failures.remove(key);
    }

    public synchronized void clear() {
        failures.clear();
    }

    private Deque<Instant> pruned(String key) {
        Deque<Instant> deque = failures.get(key);
        if (deque == null) {
            return new ArrayDeque<>();
        }
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!deque.isEmpty() && !deque.peekFirst().isAfter(cutoff)) {
            deque.removeFirst();
        }
        if (deque.isEmpty()) {
            failures.remove(key);
        }
        return deque;
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && ./gradlew test --tests '*LoginThrottleTest'`
Expected: PASS (3 tests).

- [ ] **Step 5: Extend `IntegrationTest` and write the failing auth integration test**

Add to `IntegrationTest` (keep everything from Task 1):
```java
// new imports
import com.chronos.core.auth.LoginThrottle;
import com.chronos.core.user.AppUserPrincipal;
import com.chronos.core.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

// new members
    public static final String PASSWORD = "password123";
    public static final String ZONE = "Asia/Kolkata";

    @Autowired
    protected UserRepository users;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected LoginThrottle loginThrottle;

    @BeforeEach
    void clearLoginThrottle() {
        loginThrottle.clear();
    }

    protected AppUserPrincipal createUser(String username) {
        long id = users.insert(username, passwordEncoder.encode(PASSWORD), ZONE);
        return new AppUserPrincipal(id, username, null);
    }

    protected static RequestPostProcessor as(AppUserPrincipal principal) {
        return user(principal);
    }
```

`api/src/test/java/com/chronos/core/auth/AuthIntegrationTest.java`:
```java
package com.chronos.core.auth;

import com.chronos.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthIntegrationTest extends IntegrationTest {

    @Test
    void meRequiresAuthenticationWithoutCreatingSession() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().doesNotExist("SESSION"));
    }

    @Test
    void csrfEndpointIssuesCookie() throws Exception {
        mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(cookie().doesNotExist("SESSION"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void signupCreatesAccountAndLogsIn() throws Exception {
        Cookie session = mvc.perform(signup("Alice", PASSWORD, "Europe/Berlin"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.timezone").value("Europe/Berlin"))
                .andReturn().getResponse().getCookie("SESSION");
        assertThat(session).isNotNull();

        mvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    void signupRejectsTakenUsernameIgnoringCase() throws Exception {
        createUser("alice");

        mvc.perform(signup("ALICE", PASSWORD, ZONE))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void signupValidatesInput() throws Exception {
        mvc.perform(signup("al", PASSWORD, ZONE)).andExpect(status().isBadRequest());
        mvc.perform(signup("alice!", PASSWORD, ZONE)).andExpect(status().isBadRequest());
        mvc.perform(signup("alice", "short", ZONE)).andExpect(status().isBadRequest());
        mvc.perform(signup("alice", PASSWORD, "Mars/Olympus"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    @Test
    void signupWithoutCsrfTokenIsForbidden() throws Exception {
        mvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("alice", PASSWORD, ZONE)))
                .andExpect(status().isForbidden());
    }

    @Test
    void loginCreatesSessionCookie() throws Exception {
        createUser("bob");

        Cookie session = mvc.perform(login("Bob", PASSWORD, "10.0.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("bob"))
                .andExpect(jsonPath("$.timezone").value(ZONE))
                .andExpect(header().string("Set-Cookie", allOf(
                        containsString("SESSION="), containsString("HttpOnly"), containsString("SameSite=Lax"))))
                .andReturn().getResponse().getCookie("SESSION");

        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk());
    }

    @Test
    void loginWithWrongPasswordIsRejected() throws Exception {
        createUser("bob");

        mvc.perform(login("bob", "nope-nope", "10.0.0.1"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));
    }

    @Test
    void logoutInvalidatesSession() throws Exception {
        createUser("bob");
        Cookie session = mvc.perform(login("bob", PASSWORD, "10.0.0.1"))
                .andReturn().getResponse().getCookie("SESSION");

        mvc.perform(post("/api/auth/logout").with(xsrf()).cookie(session)).andExpect(status().isOk());

        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void tenFailuresForOneUsernameLockItAcrossIps() throws Exception {
        createUser("bob");
        createUser("alice");
        for (int i = 0; i < 10; i++) {
            mvc.perform(login("bob", "wrong-pass", "10.0.0." + i)).andExpect(status().isUnauthorized());
        }

        mvc.perform(login("bob", PASSWORD, "10.0.1.1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
        mvc.perform(login("alice", PASSWORD, "10.0.1.1")).andExpect(status().isOk());
    }

    @Test
    void tenFailuresFromOneIpLockEveryUsernameFromThatIp() throws Exception {
        createUser("alice");
        for (int i = 0; i < 10; i++) {
            mvc.perform(login("ghost" + i, "wrong-pass", "10.0.0.9")).andExpect(status().isUnauthorized());
        }

        mvc.perform(login("alice", PASSWORD, "10.0.0.9")).andExpect(status().isTooManyRequests());
        mvc.perform(login("alice", PASSWORD, "10.0.0.10")).andExpect(status().isOk());
    }

    @Test
    void successfulLoginResetsTheUsernameCount() throws Exception {
        createUser("bob");
        for (int i = 0; i < 9; i++) {
            mvc.perform(login("bob", "wrong-pass", "10.0.0." + i)).andExpect(status().isUnauthorized());
        }
        mvc.perform(login("bob", PASSWORD, "10.0.1.1")).andExpect(status().isOk());

        for (int i = 0; i < 9; i++) {
            mvc.perform(login("bob", "wrong-pass", "10.0.2." + i)).andExpect(status().isUnauthorized());
        }
        mvc.perform(login("bob", PASSWORD, "10.0.1.2")).andExpect(status().isOk());
    }

    @Test
    void updateMeChangesTimezone() throws Exception {
        var bob = createUser("bob");

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"timezone": "America/New_York"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("America/New_York"));
    }

    @Test
    void updateMeChangesPasswordOnlyWithTheCurrentOne() throws Exception {
        var bob = createUser("bob");

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "wrong-pass", "newPassword": "brand-new-pass"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "%s", "newPassword": "brand-new-pass"}
                                """.formatted(PASSWORD)))
                .andExpect(status().isOk());

        mvc.perform(login("bob", "brand-new-pass", "10.0.0.1")).andExpect(status().isOk());
    }

    private static String signupJson(String username, String password, String timezone) {
        return """
                {"username": "%s", "password": "%s", "timezone": "%s"}
                """.formatted(username, password, timezone);
    }

    private static MockHttpServletRequestBuilder signup(String username, String password, String timezone) {
        return post("/api/auth/signup").with(xsrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(signupJson(username, password, timezone));
    }

    private static MockHttpServletRequestBuilder login(String username, String password, String ip) {
        return post("/api/auth/login").with(xsrf())
                .with(request -> {
                    request.setRemoteAddr(ip);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"username": "%s", "password": "%s"}
                        """.formatted(username, password));
    }
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*AuthIntegrationTest'`
Expected: compilation FAILS — `AppUserPrincipal`, `UserRepository` do not exist.

- [ ] **Step 7: Implement the user package**

`api/src/main/java/com/chronos/core/user/User.java`:
```java
package com.chronos.core.user;

import java.time.OffsetDateTime;

public record User(long id, String username, String passwordHash, String timezone, OffsetDateTime createdAt) {
}
```

`api/src/main/java/com/chronos/core/user/UserRepository.java`:
```java
package com.chronos.core.user;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserRepository {

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long insert(String username, String passwordHash, String timezone) {
        return jdbc.sql("""
                        INSERT INTO app_user (username, password_hash, timezone)
                        VALUES (:username, :passwordHash, :timezone)
                        RETURNING id
                        """)
                .param("username", username)
                .param("passwordHash", passwordHash)
                .param("timezone", timezone)
                .query(Long.class)
                .single();
    }

    public Optional<User> findById(long id) {
        return jdbc.sql("SELECT * FROM app_user WHERE id = :id").param("id", id).query(User.class).optional();
    }

    public Optional<User> findByUsername(String username) {
        return jdbc.sql("SELECT * FROM app_user WHERE username = :username")
                .param("username", username)
                .query(User.class)
                .optional();
    }

    public void updateTimezone(long id, String timezone) {
        jdbc.sql("UPDATE app_user SET timezone = :timezone WHERE id = :id")
                .param("id", id).param("timezone", timezone).update();
    }

    public void updatePasswordHash(long id, String passwordHash) {
        jdbc.sql("UPDATE app_user SET password_hash = :hash WHERE id = :id")
                .param("id", id).param("hash", passwordHash).update();
    }
}
```

`api/src/main/java/com/chronos/core/user/UserService.java`:
```java
package com.chronos.core.user;

import com.chronos.core.error.ApiException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
public class UserService {

    private final UserRepository users;
    private final Clock clock;

    public UserService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    public User get(long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    /** The current date in the user's own timezone. */
    public LocalDate today(long userId) {
        return LocalDate.now(clock.withZone(ZoneId.of(get(userId).timezone())));
    }
}
```

`api/src/main/java/com/chronos/core/user/AppUserPrincipal.java`:
```java
package com.chronos.core.user;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/** The signed-in user. Stored in the HTTP session without the password hash. */
public record AppUserPrincipal(long id, String username, String passwordHash) implements UserDetails {

    public static AppUserPrincipal from(User user) {
        return new AppUserPrincipal(user.id(), user.username(), user.passwordHash());
    }

    public AppUserPrincipal withoutPassword() {
        return new AppUserPrincipal(id, username, null);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }
}
```

`api/src/main/java/com/chronos/core/user/AppUserDetailsService.java`:
```java
package com.chronos.core.user;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public AppUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        return users.findByUsername(username.trim().toLowerCase(Locale.ROOT))
                .map(AppUserPrincipal::from)
                .orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
    }
}
```

- [ ] **Step 8: Implement the auth package and security config**

`api/src/main/java/com/chronos/core/auth/SignupRequest.java`:
```java
package com.chronos.core.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Pattern(regexp = "[a-zA-Z0-9_.-]{3,32}", message = "3-32 letters, digits, '_', '.' or '-'")
        String username,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotBlank String timezone) {
}
```

`api/src/main/java/com/chronos/core/auth/LoginRequest.java`:
```java
package com.chronos.core.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String username, @NotBlank String password) {
}
```

`api/src/main/java/com/chronos/core/auth/UpdateMeRequest.java`:
```java
package com.chronos.core.auth;

import jakarta.validation.constraints.Size;

/** Every field is optional; a new password requires the current one. */
public record UpdateMeRequest(String timezone, String currentPassword, @Size(min = 8, max = 128) String newPassword) {
}
```

`api/src/main/java/com/chronos/core/auth/MeResponse.java`:
```java
package com.chronos.core.auth;

import com.chronos.core.user.User;

public record MeResponse(String username, String timezone) {

    public static MeResponse from(User user) {
        return new MeResponse(user.username(), user.timezone());
    }
}
```

`api/src/main/java/com/chronos/core/auth/SessionLogin.java`:
```java
package com.chronos.core.auth;

import com.chronos.core.user.AppUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

@Component
public class SessionLogin {

    private final SecurityContextRepository securityContextRepository;

    public SessionLogin(SecurityContextRepository securityContextRepository) {
        this.securityContextRepository = securityContextRepository;
    }

    public void establish(AppUserPrincipal principal, HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal stored = principal.withoutPassword();
        var authentication = UsernamePasswordAuthenticationToken.authenticated(stored, null, stored.getAuthorities());

        request.getSession(true);
        request.changeSessionId();

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        securityContextRepository.saveContext(context, request, response);
    }
}
```

`api/src/main/java/com/chronos/core/auth/AccountService.java`:
```java
package com.chronos.core.auth;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.AppUserPrincipal;
import com.chronos.core.user.User;
import com.chronos.core.user.UserRepository;
import com.chronos.core.user.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Locale;

@Service
public class AccountService {

    private final UserRepository users;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public AccountService(UserRepository users, UserService userService, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AppUserPrincipal signup(SignupRequest request) {
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String timezone = validZone(request.timezone());
        if (users.findByUsername(username).isPresent()) {
            throw new ApiException(ErrorCode.USERNAME_TAKEN, "Username is already taken");
        }
        long id = users.insert(username, passwordEncoder.encode(request.password()), timezone);
        return new AppUserPrincipal(id, username, null);
    }

    @Transactional
    public User updateMe(long userId, UpdateMeRequest request) {
        User user = userService.get(userId);
        if (request.timezone() != null) {
            users.updateTimezone(userId, validZone(request.timezone()));
        }
        if (request.newPassword() != null) {
            if (request.currentPassword() == null
                    || !passwordEncoder.matches(request.currentPassword(), user.passwordHash())) {
                throw new ApiException(ErrorCode.VALIDATION, "currentPassword: is incorrect");
            }
            users.updatePasswordHash(userId, passwordEncoder.encode(request.newPassword()));
        }
        return userService.get(userId);
    }

    private static String validZone(String timezone) {
        try {
            return ZoneId.of(timezone).getId();
        } catch (DateTimeException ex) {
            throw new ApiException(ErrorCode.VALIDATION, "timezone: unknown timezone");
        }
    }
}
```

`api/src/main/java/com/chronos/core/auth/AuthController.java`:
```java
package com.chronos.core.auth;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.core.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SessionLogin sessionLogin;
    private final LoginThrottle loginThrottle;
    private final AccountService accounts;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager, SessionLogin sessionLogin,
                          LoginThrottle loginThrottle, AccountService accounts, UserService userService) {
        this.authenticationManager = authenticationManager;
        this.sessionLogin = sessionLogin;
        this.loginThrottle = loginThrottle;
        this.accounts = accounts;
        this.userService = userService;
    }

    /** Touching the token makes Spring Security write the XSRF-TOKEN cookie for the SPA. */
    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public MeResponse signup(@Valid @RequestBody SignupRequest body, HttpServletRequest request,
                             HttpServletResponse response) {
        AppUserPrincipal principal = accounts.signup(body);
        sessionLogin.establish(principal, request, response);
        return MeResponse.from(userService.get(principal.id()));
    }

    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request,
                            HttpServletResponse response) {
        String userKey = "user:" + body.username().trim().toLowerCase(Locale.ROOT);
        String ipKey = "ip:" + request.getRemoteAddr();
        loginThrottle.check(userKey, ipKey);
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(body.username(), body.password()));
        } catch (AuthenticationException ex) {
            loginThrottle.recordFailure(userKey, ipKey);
            throw ex;
        }
        loginThrottle.reset(userKey);
        AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
        sessionLogin.establish(principal, request, response);
        return MeResponse.from(userService.get(principal.id()));
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AppUserPrincipal principal) {
        return MeResponse.from(userService.get(principal.id()));
    }

    @PutMapping("/me")
    public MeResponse updateMe(@AuthenticationPrincipal AppUserPrincipal principal,
                               @Valid @RequestBody UpdateMeRequest body) {
        return MeResponse.from(accounts.updateMe(principal.id(), body));
    }
}
```

`api/src/main/java/com/chronos/core/config/SecurityConfig.java` (replace the whole file):
```java
package com.chronos.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.savedrequest.NullRequestCache;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.spa())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/csrf", "/api/auth/login", "/api/auth/signup").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                        // The web app itself (index.html, assets, client-side routes) is public.
                        .requestMatchers(request -> HttpMethod.GET.matches(request.getMethod())
                                && !request.getRequestURI().startsWith("/api/")).permitAll()
                        .anyRequest().authenticated())
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler()))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }
}
```

- [ ] **Step 9: Run the full suite to verify it passes**

Run: `cd api && ./gradlew test`
Expected: BUILD SUCCESSFUL; all `AuthIntegrationTest`, `LoginThrottleTest`, and Task 1 tests pass.

- [ ] **Step 10: Commit**

```bash
git add api
git commit -m "feat(api): add signup, login, logout and account settings" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Habit schedule (period arithmetic)

**Files:**
- Create: `api/src/main/java/com/chronos/habit/domain/{Frequency,HabitSchedule}.java`
- Test: `api/src/test/java/com/chronos/habit/domain/HabitScheduleTest.java`

**Interfaces:**
- Produces:
  - `enum Frequency { DAILY, EVERY_N_DAYS, WEEKLY }`
  - `record HabitSchedule(Frequency frequency, Integer intervalDays, LocalDate startDate)` with
    `LocalDate firstPeriodStart()`, `int periodLength()`, `Optional<LocalDate> periodContaining(LocalDate date)`,
    `boolean isPeriodStart(LocalDate date)`, `LocalDate periodEnd(LocalDate periodStart)`,
    `List<LocalDate> periodStartsBetween(LocalDate from, LocalDate to)` (inclusive, ascending).

Rules: DAILY periods are single days from `startDate`. EVERY_N_DAYS periods start at `startDate + k·N`, length N. WEEKLY periods are Monday–Sunday; the first is the week containing `startDate`.

- [ ] **Step 1: Write the failing test**

`api/src/test/java/com/chronos/habit/domain/HabitScheduleTest.java`:
```java
package com.chronos.habit.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HabitScheduleTest {

    private static LocalDate nov(int day) {
        return LocalDate.of(2026, 11, day);
    }

    @Test
    void dailyPeriodsAreSingleDaysFromTheStartDate() {
        var schedule = new HabitSchedule(Frequency.DAILY, null, nov(10));

        assertThat(schedule.firstPeriodStart()).isEqualTo(nov(10));
        assertThat(schedule.periodContaining(nov(9))).isEmpty();
        assertThat(schedule.periodContaining(nov(14))).contains(nov(14));
        assertThat(schedule.isPeriodStart(nov(14))).isTrue();
        assertThat(schedule.periodEnd(nov(14))).isEqualTo(nov(14));
    }

    @Test
    void everyNDaysPeriodsRepeatFromTheStartDate() {
        var schedule = new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2));

        assertThat(schedule.periodContaining(nov(6))).contains(nov(5));
        assertThat(schedule.isPeriodStart(nov(5))).isTrue();
        assertThat(schedule.isPeriodStart(nov(6))).isFalse();
        assertThat(schedule.periodEnd(nov(5))).isEqualTo(nov(7));
    }

    @Test
    void weeklyPeriodsRunMondayToSundayStartingWithTheWeekOfTheStartDate() {
        var schedule = new HabitSchedule(Frequency.WEEKLY, null, nov(18)); // Wednesday

        assertThat(schedule.firstPeriodStart()).isEqualTo(nov(16));
        assertThat(schedule.periodContaining(nov(22))).contains(nov(16));
        assertThat(schedule.periodContaining(nov(15))).isEmpty();
        assertThat(schedule.isPeriodStart(nov(16))).isTrue();
        assertThat(schedule.isPeriodStart(nov(18))).isFalse();
        assertThat(schedule.periodEnd(nov(16))).isEqualTo(nov(22));
    }

    @Test
    void periodStartsBetweenIsInclusiveAndSkipsPartialPeriods() {
        var everyThree = new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2));
        assertThat(everyThree.periodStartsBetween(nov(4), nov(11))).containsExactly(nov(5), nov(8), nov(11));

        var daily = new HabitSchedule(Frequency.DAILY, null, nov(2));
        assertThat(daily.periodStartsBetween(LocalDate.of(2026, 10, 1), nov(3))).containsExactly(nov(2), nov(3));
        assertThat(daily.periodStartsBetween(nov(5), nov(4))).isEmpty();
    }

    @Test
    void everyNDaysRequiresAnIntervalOfAtLeastTwo() {
        assertThatThrownBy(() -> new HabitSchedule(Frequency.EVERY_N_DAYS, null, nov(2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new HabitSchedule(Frequency.EVERY_N_DAYS, 1, nov(2)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*HabitScheduleTest'`
Expected: compilation FAILS — `HabitSchedule` does not exist.

- [ ] **Step 3: Implement**

`api/src/main/java/com/chronos/habit/domain/Frequency.java`:
```java
package com.chronos.habit.domain;

public enum Frequency {
    DAILY, EVERY_N_DAYS, WEEKLY
}
```

`api/src/main/java/com/chronos/habit/domain/HabitSchedule.java`:
```java
package com.chronos.habit.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Splits time into a habit's periods. Every period is identified by its first day. */
public record HabitSchedule(Frequency frequency, Integer intervalDays, LocalDate startDate) {

    public HabitSchedule {
        Objects.requireNonNull(frequency, "frequency");
        Objects.requireNonNull(startDate, "startDate");
        if (frequency == Frequency.EVERY_N_DAYS && (intervalDays == null || intervalDays < 2)) {
            throw new IllegalArgumentException("EVERY_N_DAYS needs intervalDays >= 2");
        }
    }

    public LocalDate firstPeriodStart() {
        return frequency == Frequency.WEEKLY
                ? startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                : startDate;
    }

    public int periodLength() {
        return switch (frequency) {
            case DAILY -> 1;
            case EVERY_N_DAYS -> intervalDays;
            case WEEKLY -> 7;
        };
    }

    /** Start of the period containing {@code date}, or empty if {@code date} is before the first period. */
    public Optional<LocalDate> periodContaining(LocalDate date) {
        LocalDate first = firstPeriodStart();
        if (date.isBefore(first)) {
            return Optional.empty();
        }
        long offset = ChronoUnit.DAYS.between(first, date) % periodLength();
        return Optional.of(date.minusDays(offset));
    }

    public boolean isPeriodStart(LocalDate date) {
        return periodContaining(date).filter(date::equals).isPresent();
    }

    public LocalDate periodEnd(LocalDate periodStart) {
        return periodStart.plusDays(periodLength() - 1L);
    }

    /** Period starts {@code s} with {@code from <= s <= to}, ascending. */
    public List<LocalDate> periodStartsBetween(LocalDate from, LocalDate to) {
        List<LocalDate> starts = new ArrayList<>();
        LocalDate first = firstPeriodStart();
        LocalDate start = from.isBefore(first) ? first : periodContaining(from).orElseThrow();
        if (start.isBefore(from)) {
            start = start.plusDays(periodLength());
        }
        for (; !start.isAfter(to); start = start.plusDays(periodLength())) {
            starts.add(start);
        }
        return starts;
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && ./gradlew test --tests '*HabitScheduleTest'`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat(api): add habit schedule period arithmetic" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Habit timeline (cell states, edit window, streaks, distribution, scores)

**Files:**
- Create: `api/src/main/java/com/chronos/habit/domain/{Color,CellState,DateRange,Streak,Distribution,HabitTimeline}.java`
- Test: `api/src/test/java/com/chronos/habit/domain/HabitTimelineTest.java`

**Interfaces:**
- Consumes: `HabitSchedule`, `Frequency` (Task 3).
- Produces:
  - `enum Color { RED, YELLOW, GREEN }`
  - `enum CellState { GREEN, YELLOW, RED, PAUSED, PENDING, GREY, NOT_DUE }` with `static CellState of(Color)`
  - `record DateRange(LocalDate from, LocalDate to)` (`to == null` → open-ended) with `boolean contains(LocalDate)`
  - `record Streak(int current, int best)`
  - `record Distribution(int green, int yellow, int red, int grey, int total)` with `static Distribution EMPTY`, `Distribution plus(CellState)`, `Distribution plus(Distribution)`
  - `final class HabitTimeline(HabitSchedule schedule, List<DateRange> pauses, Map<LocalDate, Color> colors, boolean archived, LocalDate today)` with
    `HabitSchedule schedule()`, `boolean isPaused(LocalDate periodStart)`, `CellState stateOf(LocalDate periodStart)`,
    `boolean isEditable(LocalDate periodStart)`, `Optional<LocalDate> dueOn(LocalDate date)`, `Streak streak()`,
    `Distribution distribution(LocalDate from, LocalDate to)`, `OptionalInt scoreOn(LocalDate date)`,
    `static Double averageScore(Collection<HabitTimeline> timelines, LocalDate date)` (null when no habit counts).

Rules (from the spec):
- `stateOf`: a check-in color wins; else `PAUSED` if a pause contains the period start; else `PENDING` if the period's last day ≥ today; else `GREY`.
- `isEditable`: not archived, is a period start, start ≤ today, period end ≥ today − 7, not paused.
- `streak`: walk period starts from the first through the one containing today; GREEN/YELLOW → +1; RED/GREY → reset; PAUSED/PENDING → skip.
- `distribution`: counts GREEN/YELLOW/RED/GREY states of period starts in `[from, to]`; others ignored.
- `scoreOn(date)`: state of the period covering `date` → GREEN 2, YELLOW 1, RED/GREY 0, otherwise empty.

- [ ] **Step 1: Write the failing test**

`api/src/test/java/com/chronos/habit/domain/HabitTimelineTest.java`:
```java
package com.chronos.habit.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HabitTimelineTest {

    private static final LocalDate TODAY = nov(18); // Wednesday

    private static LocalDate nov(int day) {
        return LocalDate.of(2026, 11, day);
    }

    private static HabitTimeline daily(LocalDate start, Map<LocalDate, Color> colors, List<DateRange> pauses) {
        return new HabitTimeline(new HabitSchedule(Frequency.DAILY, null, start), pauses, colors, false, TODAY);
    }

    @Test
    void stateOfUsesColorThenPauseThenPendingThenGrey() {
        var timeline = daily(nov(1), Map.of(nov(10), Color.GREEN, nov(12), Color.RED),
                List.of(new DateRange(nov(12), nov(14))));

        assertThat(timeline.stateOf(nov(10))).isEqualTo(CellState.GREEN);
        assertThat(timeline.stateOf(nov(11))).isEqualTo(CellState.GREY);
        assertThat(timeline.stateOf(nov(12))).isEqualTo(CellState.RED);
        assertThat(timeline.stateOf(nov(13))).isEqualTo(CellState.PAUSED);
        assertThat(timeline.stateOf(TODAY)).isEqualTo(CellState.PENDING);
        assertThat(timeline.stateOf(nov(19))).isEqualTo(CellState.PENDING);
    }

    @Test
    void openPauseCoversEverythingFromItsStart() {
        var timeline = daily(nov(1), Map.of(), List.of(new DateRange(nov(15), null)));

        assertThat(timeline.stateOf(nov(14))).isEqualTo(CellState.GREY);
        assertThat(timeline.stateOf(TODAY)).isEqualTo(CellState.PAUSED);
    }

    @Test
    void editWindowCoversTheLastSevenDaysUpToToday() {
        var timeline = daily(nov(1), Map.of(), List.of(new DateRange(nov(15), nov(15))));

        assertThat(timeline.isEditable(TODAY)).isTrue();
        assertThat(timeline.isEditable(nov(11))).isTrue();
        assertThat(timeline.isEditable(nov(10))).isFalse();
        assertThat(timeline.isEditable(nov(19))).isFalse();
        assertThat(timeline.isEditable(nov(15))).isFalse();
        assertThat(timeline.isEditable(LocalDate.of(2026, 10, 31))).isFalse();
    }

    @Test
    void archivedHabitsAreNeverEditable() {
        var timeline = new HabitTimeline(new HabitSchedule(Frequency.DAILY, null, nov(1)),
                List.of(), Map.of(), true, TODAY);

        assertThat(timeline.isEditable(TODAY)).isFalse();
    }

    @Test
    void editWindowUsesThePeriodEndForLongerPeriods() {
        var weekly = new HabitTimeline(new HabitSchedule(Frequency.WEEKLY, null, nov(1)),
                List.of(), Map.of(), false, TODAY);
        assertThat(weekly.isEditable(nov(9))).isTrue();   // ends Nov 15 >= Nov 11
        assertThat(weekly.isEditable(nov(2))).isFalse();  // ends Nov 8
        assertThat(weekly.isEditable(nov(10))).isFalse(); // not a Monday

        var everyThree = new HabitTimeline(new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2)),
                List.of(), Map.of(), false, TODAY);
        assertThat(everyThree.isEditable(nov(17))).isTrue();
        assertThat(everyThree.isEditable(nov(18))).isFalse(); // not a period start
    }

    @Test
    void streakCountsGreenAndYellowAndResetsOnRedOrGrey() {
        var timeline = daily(nov(10), Map.of(
                nov(10), Color.GREEN, nov(11), Color.YELLOW, nov(12), Color.RED,
                nov(13), Color.GREEN, nov(14), Color.GREEN, nov(15), Color.YELLOW,
                nov(17), Color.GREEN), List.of());

        assertThat(timeline.streak()).isEqualTo(new Streak(1, 3));
    }

    @Test
    void streakSkipsPausedPeriodsAndCountsAMarkedCurrentPeriod() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.GREEN, nov(17), Color.GREEN, TODAY, Color.YELLOW),
                List.of(new DateRange(nov(15), nov(16))));

        assertThat(timeline.streak()).isEqualTo(new Streak(3, 3));
    }

    @Test
    void distributionCountsEndedAndMarkedPeriodsOnly() {
        var timeline = daily(nov(12), Map.of(nov(12), Color.GREEN, nov(13), Color.YELLOW, nov(14), Color.RED),
                List.of(new DateRange(nov(17), nov(17))));

        assertThat(timeline.distribution(nov(10), nov(22))).isEqualTo(new Distribution(1, 1, 1, 2, 5));
    }

    @Test
    void scoreUsesThePeriodCoveringTheDate() {
        var weekly = new HabitTimeline(new HabitSchedule(Frequency.WEEKLY, null, nov(1)),
                List.of(), Map.of(nov(9), Color.YELLOW), false, TODAY);

        assertThat(weekly.scoreOn(nov(12))).hasValue(1);
        assertThat(weekly.scoreOn(nov(4))).hasValue(0);   // week of Nov 2 is GREY
        assertThat(weekly.scoreOn(nov(17))).isEmpty();    // current week is PENDING
        assertThat(weekly.scoreOn(LocalDate.of(2026, 10, 20))).isEmpty();
    }

    @Test
    void averageScoreAveragesHabitsThatCountThatDay() {
        var green = daily(nov(1), Map.of(nov(10), Color.GREEN), List.of());
        var red = daily(nov(1), Map.of(nov(10), Color.RED), List.of());
        var notStarted = daily(nov(15), Map.of(), List.of());

        assertThat(HabitTimeline.averageScore(List.of(green, red, notStarted), nov(10))).isEqualTo(1.0);
        assertThat(HabitTimeline.averageScore(List.of(notStarted), nov(10))).isNull();
    }

    @Test
    void dueOnIsTheDateItselfWhenItStartsAPeriod() {
        var everyThree = new HabitTimeline(new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2)),
                List.of(), Map.of(), false, TODAY);

        assertThat(everyThree.dueOn(nov(5))).contains(nov(5));
        assertThat(everyThree.dueOn(nov(6))).isEmpty();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*HabitTimelineTest'`
Expected: compilation FAILS — `HabitTimeline` does not exist.

- [ ] **Step 3: Implement the value types**

`api/src/main/java/com/chronos/habit/domain/Color.java`:
```java
package com.chronos.habit.domain;

public enum Color {
    RED, YELLOW, GREEN
}
```

`api/src/main/java/com/chronos/habit/domain/CellState.java`:
```java
package com.chronos.habit.domain;

public enum CellState {
    GREEN, YELLOW, RED,
    /** Period starts inside a pause. */
    PAUSED,
    /** Period has not ended yet and is unmarked. */
    PENDING,
    /** Period ended unmarked: unknown, never treated as RED automatically. */
    GREY,
    /** Not a period start (or before the habit started). */
    NOT_DUE;

    public static CellState of(Color color) {
        return switch (color) {
            case RED -> RED;
            case YELLOW -> YELLOW;
            case GREEN -> GREEN;
        };
    }
}
```

`api/src/main/java/com/chronos/habit/domain/DateRange.java`:
```java
package com.chronos.habit.domain;

import java.time.LocalDate;

/** Inclusive date range; {@code to == null} means open-ended. */
public record DateRange(LocalDate from, LocalDate to) {

    public boolean contains(LocalDate date) {
        return !date.isBefore(from) && (to == null || !date.isAfter(to));
    }
}
```

`api/src/main/java/com/chronos/habit/domain/Streak.java`:
```java
package com.chronos.habit.domain;

public record Streak(int current, int best) {
}
```

`api/src/main/java/com/chronos/habit/domain/Distribution.java`:
```java
package com.chronos.habit.domain;

public record Distribution(int green, int yellow, int red, int grey, int total) {

    public static final Distribution EMPTY = new Distribution(0, 0, 0, 0, 0);

    public Distribution plus(CellState state) {
        return switch (state) {
            case GREEN -> new Distribution(green + 1, yellow, red, grey, total + 1);
            case YELLOW -> new Distribution(green, yellow + 1, red, grey, total + 1);
            case RED -> new Distribution(green, yellow, red + 1, grey, total + 1);
            case GREY -> new Distribution(green, yellow, red, grey + 1, total + 1);
            case PAUSED, PENDING, NOT_DUE -> this;
        };
    }

    public Distribution plus(Distribution other) {
        return new Distribution(green + other.green, yellow + other.yellow, red + other.red,
                grey + other.grey, total + other.total);
    }
}
```

- [ ] **Step 4: Implement `HabitTimeline`**

`api/src/main/java/com/chronos/habit/domain/HabitTimeline.java`:
```java
package com.chronos.habit.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;

/** One habit's periods, pauses and check-ins as seen on {@code today} (in the user's timezone). */
public final class HabitTimeline {

    static final int EDIT_WINDOW_DAYS = 7;

    private final HabitSchedule schedule;
    private final List<DateRange> pauses;
    private final Map<LocalDate, Color> colors;
    private final boolean archived;
    private final LocalDate today;

    public HabitTimeline(HabitSchedule schedule, List<DateRange> pauses, Map<LocalDate, Color> colors,
                         boolean archived, LocalDate today) {
        this.schedule = schedule;
        this.pauses = List.copyOf(pauses);
        this.colors = Map.copyOf(colors);
        this.archived = archived;
        this.today = today;
    }

    public HabitSchedule schedule() {
        return schedule;
    }

    public boolean isPaused(LocalDate periodStart) {
        return pauses.stream().anyMatch(p -> p.contains(periodStart));
    }

    public CellState stateOf(LocalDate periodStart) {
        Color color = colors.get(periodStart);
        if (color != null) {
            return CellState.of(color);
        }
        if (isPaused(periodStart)) {
            return CellState.PAUSED;
        }
        if (!schedule.periodEnd(periodStart).isBefore(today)) {
            return CellState.PENDING;
        }
        return CellState.GREY;
    }

    public boolean isEditable(LocalDate periodStart) {
        return !archived
                && schedule.isPeriodStart(periodStart)
                && !periodStart.isAfter(today)
                && !schedule.periodEnd(periodStart).isBefore(today.minusDays(EDIT_WINDOW_DAYS))
                && !isPaused(periodStart);
    }

    /** {@code date} itself when a period starts on it; used for per-day cells of DAILY and EVERY_N_DAYS habits. */
    public Optional<LocalDate> dueOn(LocalDate date) {
        return schedule.isPeriodStart(date) ? Optional.of(date) : Optional.empty();
    }

    public Streak streak() {
        int current = 0;
        int best = 0;
        for (LocalDate start : schedule.periodStartsBetween(schedule.firstPeriodStart(), today)) {
            switch (stateOf(start)) {
                case GREEN, YELLOW -> {
                    current++;
                    best = Math.max(best, current);
                }
                case RED, GREY -> current = 0;
                case PAUSED, PENDING, NOT_DUE -> {
                }
            }
        }
        return new Streak(current, best);
    }

    public Distribution distribution(LocalDate from, LocalDate to) {
        Distribution result = Distribution.EMPTY;
        for (LocalDate start : schedule.periodStartsBetween(from, to)) {
            result = result.plus(stateOf(start));
        }
        return result;
    }

    /** GREEN 2, YELLOW 1, RED/GREY 0 for the period covering {@code date}; empty if it doesn't count. */
    public OptionalInt scoreOn(LocalDate date) {
        Optional<LocalDate> start = schedule.periodContaining(date);
        if (start.isEmpty()) {
            return OptionalInt.empty();
        }
        return switch (stateOf(start.get())) {
            case GREEN -> OptionalInt.of(2);
            case YELLOW -> OptionalInt.of(1);
            case RED, GREY -> OptionalInt.of(0);
            case PAUSED, PENDING, NOT_DUE -> OptionalInt.empty();
        };
    }

    /** Mean score (0-2) over the habits that count on {@code date}, or null if none do. */
    public static Double averageScore(Collection<HabitTimeline> timelines, LocalDate date) {
        var stats = timelines.stream()
                .map(t -> t.scoreOn(date))
                .filter(OptionalInt::isPresent)
                .mapToInt(OptionalInt::getAsInt)
                .summaryStatistics();
        return stats.getCount() == 0 ? null : stats.getAverage();
    }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd api && ./gradlew test --tests '*HabitTimelineTest'`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add api
git commit -m "feat(api): add habit timeline with states, edit window, streaks and scores" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Habits — CRUD and lifecycle

**Files:**
- Create: `api/src/main/java/com/chronos/habit/domain/HabitStatus.java`
- Create: `api/src/main/java/com/chronos/habit/{Habit,HabitPause,HabitRepository,PauseRepository,HabitService,HabitController,CreateHabitRequest,UpdateHabitRequest,HabitResponse}.java`
- Modify: `api/src/test/java/com/chronos/support/IntegrationTest.java` (add data helpers)
- Test: `api/src/test/java/com/chronos/habit/HabitIntegrationTest.java`

**Interfaces:**
- Consumes: `AppUserPrincipal`, `UserService#today(long)` (Task 2); `Frequency`, `HabitSchedule`, `DateRange` (Tasks 3–4); `ApiException`, `ErrorCode` (Task 1).
- Produces:
  - `enum HabitStatus { ACTIVE, PAUSED, ARCHIVED }` (package `com.chronos.habit.domain`)
  - `record Habit(long id, long userId, String name, String minText, String targetText, Frequency frequency, Integer intervalDays, LocalDate startDate, HabitStatus status, OffsetDateTime createdAt, OffsetDateTime updatedAt)` with `HabitSchedule schedule()` and `boolean archived()`
  - `HabitRepository#findByUser(long userId, Collection<HabitStatus> statuses): List<Habit>` (ordered by id)
  - `HabitService#requireOwned(long userId, long habitId): Habit` (404 `NOT_FOUND` when missing or someone else's)
  - `PauseRepository#rangesByHabit(Collection<Long> habitIds): Map<Long, List<DateRange>>` (habits without pauses are absent)
  - Tests: `IntegrationTest.insertHabit(AppUserPrincipal owner, String name, String frequency, Integer intervalDays, LocalDate startDate): long`, `insertPause(long habitId, LocalDate from, LocalDate to)`, `insertCheckIn(long habitId, LocalDate periodStart, String color)`, `setStatus(long habitId, String status)`.
- Endpoints: `GET /api/habits[?status=]`, `POST /api/habits` (201), `PUT /api/habits/{id}`, `POST /api/habits/{id}/pause|resume|archive|unarchive` — all return `HabitResponse` JSON `{id, name, minText, targetText, frequency, intervalDays, startDate, status}`.

- [ ] **Step 1: Add data helpers to `IntegrationTest`**

Add to `IntegrationTest` (keep everything from Tasks 1–2):
```java
    protected long insertHabit(AppUserPrincipal owner, String name, String frequency, Integer intervalDays,
                               LocalDate startDate) {
        return jdbc.sql("""
                        INSERT INTO habit (user_id, name, min_text, target_text, frequency, interval_days, start_date)
                        VALUES (:userId, :name, 'min', 'target', :frequency, :intervalDays, :startDate)
                        RETURNING id
                        """)
                .param("userId", owner.id())
                .param("name", name)
                .param("frequency", frequency)
                .param("intervalDays", intervalDays)
                .param("startDate", startDate)
                .query(Long.class)
                .single();
    }

    protected void insertPause(long habitId, LocalDate from, LocalDate to) {
        jdbc.sql("INSERT INTO habit_pause (habit_id, from_date, to_date) VALUES (:habitId, :from, :to)")
                .param("habitId", habitId).param("from", from).param("to", to).update();
    }

    protected void insertCheckIn(long habitId, LocalDate periodStart, String color) {
        jdbc.sql("INSERT INTO check_in (habit_id, period_start, color) VALUES (:habitId, :periodStart, :color)")
                .param("habitId", habitId).param("periodStart", periodStart).param("color", color).update();
    }

    protected void setStatus(long habitId, String status) {
        jdbc.sql("UPDATE habit SET status = :status WHERE id = :id").param("id", habitId).param("status", status).update();
    }
```

- [ ] **Step 2: Write the failing integration test**

`api/src/test/java/com/chronos/habit/HabitIntegrationTest.java`:
```java
package com.chronos.habit;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class HabitIntegrationTest extends IntegrationTest {

    private AppUserPrincipal bob;

    @BeforeEach
    void setUp() {
        bob = createUser("bob");
    }

    @Test
    void createsADailyHabitStartingToday() throws Exception {
        mvc.perform(create("""
                        {"name": " Read ", "minText": "1 page", "targetText": "20 pages", "frequency": "DAILY"}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Read"))
                .andExpect(jsonPath("$.minText").value("1 page"))
                .andExpect(jsonPath("$.targetText").value("20 pages"))
                .andExpect(jsonPath("$.frequency").value("DAILY"))
                .andExpect(jsonPath("$.intervalDays").doesNotExist())
                .andExpect(jsonPath("$.startDate").value("2026-11-18"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void createsAnEveryNDaysHabitWithAPastStartDate() throws Exception {
        mvc.perform(create("""
                        {"name": "Run", "minText": "1 km", "targetText": "5 km", "frequency": "EVERY_N_DAYS",
                         "intervalDays": 3, "startDate": "2026-11-02"}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.intervalDays").value(3))
                .andExpect(jsonPath("$.startDate").value("2026-11-02"));
    }

    @Test
    void rejectsInvalidHabits() throws Exception {
        mvc.perform(create("""
                        {"name": "Run", "minText": "a", "targetText": "b", "frequency": "EVERY_N_DAYS"}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
        mvc.perform(create("""
                        {"name": "Run", "minText": "a", "targetText": "b", "frequency": "EVERY_N_DAYS", "intervalDays": 1}
                        """))
                .andExpect(status().isBadRequest());
        mvc.perform(create("""
                        {"name": "Run", "minText": "a", "targetText": "b", "frequency": "DAILY", "intervalDays": 3}
                        """))
                .andExpect(status().isBadRequest());
        mvc.perform(create("""
                        {"name": "Run", "minText": "a", "targetText": "b", "frequency": "DAILY", "startDate": "2026-11-19"}
                        """))
                .andExpect(status().isBadRequest());
        mvc.perform(create("""
                        {"name": " ", "minText": "a", "targetText": "b", "frequency": "DAILY"}
                        """))
                .andExpect(status().isBadRequest());
        mvc.perform(create("""
                        {"name": "Run", "minText": "a", "targetText": "b", "frequency": "MONTHLY"}
                        """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listsOwnActiveAndPausedHabitsByDefault() throws Exception {
        long active = insertHabit(bob, "Active", "DAILY", null, TODAY);
        long paused = insertHabit(bob, "Paused", "DAILY", null, TODAY);
        long archived = insertHabit(bob, "Archived", "DAILY", null, TODAY);
        setStatus(paused, "PAUSED");
        setStatus(archived, "ARCHIVED");
        insertHabit(createUser("alice"), "Not mine", "DAILY", null, TODAY);

        mvc.perform(get("/api/habits").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(active))
                .andExpect(jsonPath("$[1].id").value(paused));

        mvc.perform(get("/api/habits").param("status", "ARCHIVED").with(as(bob)))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(archived));
    }

    @Test
    void updatesTextsButNotTheSchedule() throws Exception {
        long id = insertHabit(bob, "Read", "DAILY", null, LocalDate.of(2026, 11, 1));

        mvc.perform(put("/api/habits/{id}", id).with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Read more", "minText": "2 pages", "targetText": "30 pages"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Read more"))
                .andExpect(jsonPath("$.minText").value("2 pages"))
                .andExpect(jsonPath("$.startDate").value("2026-11-01"));
    }

    @Test
    void someoneElsesHabitIsNotFound() throws Exception {
        long id = insertHabit(createUser("alice"), "Hers", "DAILY", null, TODAY);

        mvc.perform(put("/api/habits/{id}", id).with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Mine now", "minText": "a", "targetText": "b"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(lifecycle(id, "pause")).andExpect(status().isNotFound());
    }

    @Test
    void pauseThenResumeOnTheSameDayLeavesNoPause() throws Exception {
        long id = insertHabit(bob, "Read", "DAILY", null, LocalDate.of(2026, 11, 1));

        mvc.perform(lifecycle(id, "pause")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAUSED"));
        assertThat(pauses(id)).containsExactly(Map.of("from_date", TODAY.toString(), "to_date", "open"));

        mvc.perform(lifecycle(id, "resume")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        assertThat(pauses(id)).isEmpty();
    }

    @Test
    void resumeClosesAnOlderPauseYesterday() throws Exception {
        long id = insertHabit(bob, "Read", "DAILY", null, LocalDate.of(2026, 11, 1));
        setStatus(id, "PAUSED");
        insertPause(id, LocalDate.of(2026, 11, 10), null);

        mvc.perform(lifecycle(id, "resume")).andExpect(status().isOk());

        assertThat(pauses(id)).containsExactly(Map.of("from_date", "2026-11-10", "to_date", "2026-11-17"));
    }

    @Test
    void archiveOpensAPauseAndUnarchiveClosesIt() throws Exception {
        long id = insertHabit(bob, "Read", "DAILY", null, LocalDate.of(2026, 11, 1));
        insertPause(id, LocalDate.of(2026, 11, 3), LocalDate.of(2026, 11, 4));

        mvc.perform(lifecycle(id, "archive")).andExpect(jsonPath("$.status").value("ARCHIVED"));
        jdbc.sql("UPDATE habit_pause SET from_date = '2026-11-12' WHERE to_date IS NULL").update();

        mvc.perform(lifecycle(id, "unarchive")).andExpect(jsonPath("$.status").value("ACTIVE"));
        assertThat(pauses(id)).containsExactly(
                Map.of("from_date", "2026-11-03", "to_date", "2026-11-04"),
                Map.of("from_date", "2026-11-12", "to_date", "2026-11-17"));
    }

    @Test
    void archivingAPausedHabitKeepsItsOpenPause() throws Exception {
        long id = insertHabit(bob, "Read", "DAILY", null, LocalDate.of(2026, 11, 1));
        setStatus(id, "PAUSED");
        insertPause(id, LocalDate.of(2026, 11, 10), null);

        mvc.perform(lifecycle(id, "archive")).andExpect(status().isOk());

        assertThat(pauses(id)).containsExactly(Map.of("from_date", "2026-11-10", "to_date", "open"));
    }

    @Test
    void rejectsInvalidTransitions() throws Exception {
        long id = insertHabit(bob, "Read", "DAILY", null, TODAY);

        mvc.perform(lifecycle(id, "resume")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATE"));
        mvc.perform(lifecycle(id, "unarchive")).andExpect(status().isConflict());
        mvc.perform(lifecycle(id, "pause")).andExpect(status().isOk());
        mvc.perform(lifecycle(id, "pause")).andExpect(status().isConflict());
        mvc.perform(lifecycle(id, "archive")).andExpect(status().isOk());
        mvc.perform(lifecycle(id, "archive")).andExpect(status().isConflict());
        mvc.perform(lifecycle(id, "pause")).andExpect(status().isConflict());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/habits")).andExpect(status().isUnauthorized());
    }

    private MockHttpServletRequestBuilder create(String json) {
        return post("/api/habits").with(as(bob)).with(xsrf()).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private MockHttpServletRequestBuilder lifecycle(long id, String action) {
        return post("/api/habits/{id}/" + action, id).with(as(bob)).with(xsrf());
    }

    private java.util.List<Map<String, String>> pauses(long habitId) {
        return jdbc.sql("SELECT from_date, to_date FROM habit_pause WHERE habit_id = :id ORDER BY from_date")
                .param("id", habitId)
                .query((rs, n) -> Map.of(
                        "from_date", rs.getString("from_date"),
                        "to_date", rs.getString("to_date") == null ? "open" : rs.getString("to_date")))
                .list();
    }
}
```

> `archiveOpensAPauseAndUnarchiveClosesIt` moves the open pause's start back to 11-12 after archiving so that unarchive closes it (to yesterday) instead of deleting a same-day pause.

- [ ] **Step 3: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*HabitIntegrationTest'`
Expected: tests FAIL with 404s/401s — `/api/habits` does not exist yet (or compilation fails on missing classes).

- [ ] **Step 4: Implement the model and repositories**

`api/src/main/java/com/chronos/habit/domain/HabitStatus.java`:
```java
package com.chronos.habit.domain;

public enum HabitStatus {
    ACTIVE, PAUSED, ARCHIVED
}
```

`api/src/main/java/com/chronos/habit/Habit.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitSchedule;
import com.chronos.habit.domain.HabitStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record Habit(long id, long userId, String name, String minText, String targetText, Frequency frequency,
                   Integer intervalDays, LocalDate startDate, HabitStatus status, OffsetDateTime createdAt,
                   OffsetDateTime updatedAt) {

    public HabitSchedule schedule() {
        return new HabitSchedule(frequency, intervalDays, startDate);
    }

    public boolean archived() {
        return status == HabitStatus.ARCHIVED;
    }
}
```

`api/src/main/java/com/chronos/habit/HabitPause.java`:
```java
package com.chronos.habit;

import java.time.LocalDate;

public record HabitPause(long id, long habitId, LocalDate fromDate, LocalDate toDate) {
}
```

`api/src/main/java/com/chronos/habit/HabitRepository.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public class HabitRepository {

    private final JdbcClient jdbc;

    public HabitRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long insert(long userId, String name, String minText, String targetText, Frequency frequency,
                       Integer intervalDays, LocalDate startDate) {
        return jdbc.sql("""
                        INSERT INTO habit (user_id, name, min_text, target_text, frequency, interval_days, start_date)
                        VALUES (:userId, :name, :minText, :targetText, :frequency, :intervalDays, :startDate)
                        RETURNING id
                        """)
                .param("userId", userId)
                .param("name", name)
                .param("minText", minText)
                .param("targetText", targetText)
                .param("frequency", frequency.name())
                .param("intervalDays", intervalDays)
                .param("startDate", startDate)
                .query(Long.class)
                .single();
    }

    public Optional<Habit> findOwned(long userId, long habitId) {
        return jdbc.sql("SELECT * FROM habit WHERE id = :id AND user_id = :userId")
                .param("id", habitId)
                .param("userId", userId)
                .query(Habit.class)
                .optional();
    }

    public List<Habit> findByUser(long userId, Collection<HabitStatus> statuses) {
        return jdbc.sql("SELECT * FROM habit WHERE user_id = :userId AND status IN (:statuses) ORDER BY id")
                .param("userId", userId)
                .param("statuses", statuses.stream().map(Enum::name).toList())
                .query(Habit.class)
                .list();
    }

    public void updateTexts(long habitId, String name, String minText, String targetText) {
        jdbc.sql("""
                        UPDATE habit SET name = :name, min_text = :minText, target_text = :targetText, updated_at = now()
                        WHERE id = :id
                        """)
                .param("id", habitId)
                .param("name", name)
                .param("minText", minText)
                .param("targetText", targetText)
                .update();
    }

    public void updateStatus(long habitId, HabitStatus status) {
        jdbc.sql("UPDATE habit SET status = :status, updated_at = now() WHERE id = :id")
                .param("id", habitId)
                .param("status", status.name())
                .update();
    }
}
```

`api/src/main/java/com/chronos/habit/PauseRepository.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.DateRange;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class PauseRepository {

    private final JdbcClient jdbc;

    public PauseRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void open(long habitId, LocalDate from) {
        jdbc.sql("INSERT INTO habit_pause (habit_id, from_date) VALUES (:habitId, :from)")
                .param("habitId", habitId).param("from", from).update();
    }

    public Optional<HabitPause> findOpen(long habitId) {
        return jdbc.sql("SELECT * FROM habit_pause WHERE habit_id = :habitId AND to_date IS NULL")
                .param("habitId", habitId)
                .query(HabitPause.class)
                .optional();
    }

    public void close(long pauseId, LocalDate to) {
        jdbc.sql("UPDATE habit_pause SET to_date = :to WHERE id = :id").param("id", pauseId).param("to", to).update();
    }

    public void delete(long pauseId) {
        jdbc.sql("DELETE FROM habit_pause WHERE id = :id").param("id", pauseId).update();
    }

    public Map<Long, List<DateRange>> rangesByHabit(Collection<Long> habitIds) {
        Map<Long, List<DateRange>> result = new HashMap<>();
        if (habitIds.isEmpty()) {
            return result;
        }
        jdbc.sql("SELECT * FROM habit_pause WHERE habit_id IN (:ids)")
                .param("ids", List.copyOf(habitIds))
                .query(HabitPause.class)
                .list()
                .forEach(p -> result.computeIfAbsent(p.habitId(), k -> new ArrayList<>())
                        .add(new DateRange(p.fromDate(), p.toDate())));
        return result;
    }
}
```

- [ ] **Step 5: Implement the service, DTOs and controller**

`api/src/main/java/com/chronos/habit/CreateHabitRequest.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateHabitRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 200) String minText,
        @NotBlank @Size(max = 200) String targetText,
        @NotNull Frequency frequency,
        Integer intervalDays,
        LocalDate startDate) {
}
```

`api/src/main/java/com/chronos/habit/UpdateHabitRequest.java`:
```java
package com.chronos.habit;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateHabitRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 200) String minText,
        @NotBlank @Size(max = 200) String targetText) {
}
```

`api/src/main/java/com/chronos/habit/HabitResponse.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HabitResponse(long id, String name, String minText, String targetText, Frequency frequency,
                            Integer intervalDays, LocalDate startDate, HabitStatus status) {

    public static HabitResponse from(Habit h) {
        return new HabitResponse(h.id(), h.name(), h.minText(), h.targetText(), h.frequency(), h.intervalDays(),
                h.startDate(), h.status());
    }
}
```

> Jackson 3 (Spring Boot 4) keeps annotations in `com.fasterxml.jackson.annotation`; this import is correct.

`api/src/main/java/com/chronos/habit/HabitService.java`:
```java
package com.chronos.habit;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
public class HabitService {

    private final HabitRepository habits;
    private final PauseRepository pauses;
    private final UserService userService;

    public HabitService(HabitRepository habits, PauseRepository pauses, UserService userService) {
        this.habits = habits;
        this.pauses = pauses;
        this.userService = userService;
    }

    public Habit requireOwned(long userId, long habitId) {
        return habits.findOwned(userId, habitId).orElseThrow(() -> ApiException.notFound("Habit"));
    }

    public List<Habit> list(long userId, HabitStatus status) {
        Set<HabitStatus> statuses = status == null ? EnumSet.of(HabitStatus.ACTIVE, HabitStatus.PAUSED) : Set.of(status);
        return habits.findByUser(userId, statuses);
    }

    @Transactional
    public Habit create(long userId, CreateHabitRequest request) {
        LocalDate today = userService.today(userId);
        LocalDate startDate = request.startDate() == null ? today : request.startDate();
        if (startDate.isAfter(today)) {
            throw validation("startDate: may not be in the future");
        }
        Integer interval = request.intervalDays();
        if (request.frequency() == Frequency.EVERY_N_DAYS) {
            if (interval == null || interval < 2 || interval > 365) {
                throw validation("intervalDays: must be between 2 and 365");
            }
        } else if (interval != null) {
            throw validation("intervalDays: only allowed for EVERY_N_DAYS");
        }
        long id = habits.insert(userId, request.name().strip(), request.minText().strip(),
                request.targetText().strip(), request.frequency(), interval, startDate);
        return requireOwned(userId, id);
    }

    @Transactional
    public Habit update(long userId, long habitId, UpdateHabitRequest request) {
        requireOwned(userId, habitId);
        habits.updateTexts(habitId, request.name().strip(), request.minText().strip(), request.targetText().strip());
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit pause(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        requireStatus(habit, HabitStatus.ACTIVE);
        pauses.open(habitId, userService.today(userId));
        habits.updateStatus(habitId, HabitStatus.PAUSED);
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit resume(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        requireStatus(habit, HabitStatus.PAUSED);
        closeOpenPause(userId, habitId);
        habits.updateStatus(habitId, HabitStatus.ACTIVE);
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit archive(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        if (habit.archived()) {
            throw invalidState(habit);
        }
        if (pauses.findOpen(habitId).isEmpty()) {
            pauses.open(habitId, userService.today(userId));
        }
        habits.updateStatus(habitId, HabitStatus.ARCHIVED);
        return requireOwned(userId, habitId);
    }

    @Transactional
    public Habit unarchive(long userId, long habitId) {
        Habit habit = requireOwned(userId, habitId);
        requireStatus(habit, HabitStatus.ARCHIVED);
        closeOpenPause(userId, habitId);
        habits.updateStatus(habitId, HabitStatus.ACTIVE);
        return requireOwned(userId, habitId);
    }

    /** Ends the open pause yesterday, or drops it if it only started today. */
    private void closeOpenPause(long userId, long habitId) {
        LocalDate today = userService.today(userId);
        pauses.findOpen(habitId).ifPresent(pause -> {
            if (pause.fromDate().isBefore(today)) {
                pauses.close(pause.id(), today.minusDays(1));
            } else {
                pauses.delete(pause.id());
            }
        });
    }

    private static void requireStatus(Habit habit, HabitStatus expected) {
        if (habit.status() != expected) {
            throw invalidState(habit);
        }
    }

    private static ApiException invalidState(Habit habit) {
        return new ApiException(ErrorCode.INVALID_STATE, "Habit is " + habit.status());
    }

    private static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION, message);
    }
}
```

`api/src/main/java/com/chronos/habit/HabitController.java`:
```java
package com.chronos.habit;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.habit.domain.HabitStatus;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService habits;

    public HabitController(HabitService habits) {
        this.habits = habits;
    }

    @GetMapping
    public List<HabitResponse> list(@AuthenticationPrincipal AppUserPrincipal principal,
                                    @RequestParam(required = false) HabitStatus status) {
        return habits.list(principal.id(), status).stream().map(HabitResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HabitResponse create(@AuthenticationPrincipal AppUserPrincipal principal,
                                @Valid @RequestBody CreateHabitRequest body) {
        return HabitResponse.from(habits.create(principal.id(), body));
    }

    @PutMapping("/{id}")
    public HabitResponse update(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id,
                                @Valid @RequestBody UpdateHabitRequest body) {
        return HabitResponse.from(habits.update(principal.id(), id, body));
    }

    @PostMapping("/{id}/pause")
    public HabitResponse pause(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.pause(principal.id(), id));
    }

    @PostMapping("/{id}/resume")
    public HabitResponse resume(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.resume(principal.id(), id));
    }

    @PostMapping("/{id}/archive")
    public HabitResponse archive(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.archive(principal.id(), id));
    }

    @PostMapping("/{id}/unarchive")
    public HabitResponse unarchive(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.unarchive(principal.id(), id));
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api && ./gradlew test --tests '*HabitIntegrationTest'`
Expected: PASS (12 tests). If `query(Habit.class)` fails to map a column, check that record component names match the snake_case columns (`min_text` → `minText`); `DataClassRowMapper` already converts `VARCHAR` to enums.

- [ ] **Step 7: Run the full suite and commit**

Run: `cd api && ./gradlew test`
Expected: BUILD SUCCESSFUL.

```bash
git add api
git commit -m "feat(api): add habit CRUD with pause, resume, archive and unarchive" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Check-ins

**Files:**
- Create: `api/src/main/java/com/chronos/habit/{CheckIn,CheckInRepository,HabitTimelines,CheckInService,CheckInController,CheckInRequest,CheckInResponse}.java`
- Test: `api/src/test/java/com/chronos/habit/CheckInIntegrationTest.java`

**Interfaces:**
- Consumes: `Habit`, `HabitService#requireOwned`, `PauseRepository#rangesByHabit` (Task 5); `HabitTimeline`, `Color`, `CellState` (Task 4); `UserService#today` (Task 2); test helpers `insertHabit`, `insertPause`, `insertCheckIn`, `setStatus` (Task 5).
- Produces:
  - `CheckInRepository#colorsByHabit(Collection<Long> habitIds): Map<Long, Map<LocalDate, Color>>`
  - `CheckInRepository#notesBetween(Collection<Long> habitIds, LocalDate from, LocalDate to): Map<Long, Map<LocalDate, String>>` (only non-null notes, keyed by `period_start`)
  - `HabitTimelines#load(List<Habit> habits, LocalDate today): Map<Long, HabitTimeline>` (insertion order = `habits` order)
- Endpoints: `PUT /api/habits/{id}/check-ins/{periodStart}` `{color, note?}` → 200 `{periodStart, color, note}`; `DELETE` same path → 204. Not editable → 422 `CHECK_IN_NOT_ALLOWED`.

- [ ] **Step 1: Write the failing integration test**

`api/src/test/java/com/chronos/habit/CheckInIntegrationTest.java`:
```java
package com.chronos.habit;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CheckInIntegrationTest extends IntegrationTest {

    private static final LocalDate NOV_1 = LocalDate.of(2026, 11, 1);

    private AppUserPrincipal bob;
    private long daily;

    @BeforeEach
    void setUp() {
        bob = createUser("bob");
        daily = insertHabit(bob, "Read", "DAILY", null, NOV_1);
    }

    @Test
    void marksAndRemarksAPeriod() throws Exception {
        mvc.perform(mark(daily, "2026-11-18", """
                        {"color": "GREEN"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodStart").value("2026-11-18"))
                .andExpect(jsonPath("$.color").value("GREEN"));

        mvc.perform(mark(daily, "2026-11-18", """
                        {"color": "YELLOW", "note": "only 2 pages"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.color").value("YELLOW"))
                .andExpect(jsonPath("$.note").value("only 2 pages"));

        assertThat(colors(daily)).containsExactly("2026-11-18=YELLOW");
    }

    @Test
    void enforcesTheSevenDayWindow() throws Exception {
        mvc.perform(mark(daily, "2026-11-11", """
                        {"color": "RED"}
                        """))
                .andExpect(status().isOk());
        mvc.perform(mark(daily, "2026-11-10", """
                        {"color": "RED"}
                        """))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("CHECK_IN_NOT_ALLOWED"));
        mvc.perform(mark(daily, "2026-11-19", """
                        {"color": "GREEN"}
                        """))
                .andExpect(status().isUnprocessableContent());
    }

    @Test
    void rejectsDatesThatAreNotPeriodStarts() throws Exception {
        long weekly = insertHabit(bob, "Clean", "WEEKLY", null, NOV_1);
        long everyThree = insertHabit(bob, "Run", "EVERY_N_DAYS", 3, LocalDate.of(2026, 11, 2));
        long late = insertHabit(bob, "Late", "DAILY", null, LocalDate.of(2026, 11, 17));

        mvc.perform(mark(weekly, "2026-11-16", "{\"color\": \"GREEN\"}")).andExpect(status().isOk());
        mvc.perform(mark(weekly, "2026-11-18", "{\"color\": \"GREEN\"}")).andExpect(status().isUnprocessableContent());
        mvc.perform(mark(everyThree, "2026-11-17", "{\"color\": \"GREEN\"}")).andExpect(status().isOk());
        mvc.perform(mark(everyThree, "2026-11-18", "{\"color\": \"GREEN\"}")).andExpect(status().isUnprocessableContent());
        mvc.perform(mark(late, "2026-11-16", "{\"color\": \"GREEN\"}")).andExpect(status().isUnprocessableContent());
    }

    @Test
    void rejectsPausedPeriodsAndArchivedHabits() throws Exception {
        setStatus(daily, "PAUSED");
        insertPause(daily, LocalDate.of(2026, 11, 17), null);

        mvc.perform(mark(daily, "2026-11-18", "{\"color\": \"GREEN\"}")).andExpect(status().isUnprocessableContent());
        mvc.perform(mark(daily, "2026-11-16", "{\"color\": \"GREEN\"}")).andExpect(status().isOk());

        setStatus(daily, "ARCHIVED");
        mvc.perform(mark(daily, "2026-11-16", "{\"color\": \"RED\"}")).andExpect(status().isUnprocessableContent());
    }

    @Test
    void deletesACheckIn() throws Exception {
        insertCheckIn(daily, LocalDate.of(2026, 11, 17), "GREEN");

        mvc.perform(delete("/api/habits/{id}/check-ins/{date}", daily, "2026-11-17").with(as(bob)).with(xsrf()))
                .andExpect(status().isNoContent());

        assertThat(colors(daily)).isEmpty();
    }

    @Test
    void cannotDeleteOutsideTheWindow() throws Exception {
        insertCheckIn(daily, LocalDate.of(2026, 11, 3), "GREEN");

        mvc.perform(delete("/api/habits/{id}/check-ins/{date}", daily, "2026-11-03").with(as(bob)).with(xsrf()))
                .andExpect(status().isUnprocessableContent());

        assertThat(colors(daily)).containsExactly("2026-11-03=GREEN");
    }

    @Test
    void validatesTheRequest() throws Exception {
        mvc.perform(mark(daily, "2026-11-18", "{\"color\": \"BLUE\"}")).andExpect(status().isBadRequest());
        mvc.perform(mark(daily, "2026-11-18", "{}")).andExpect(status().isBadRequest());
        mvc.perform(mark(daily, "2026-11-18", "{\"color\": \"GREEN\", \"note\": \"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(mark(daily, "18-11-2026", "{\"color\": \"GREEN\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void someoneElsesHabitIsNotFound() throws Exception {
        long hers = insertHabit(createUser("alice"), "Hers", "DAILY", null, NOV_1);

        mvc.perform(mark(hers, "2026-11-18", "{\"color\": \"GREEN\"}")).andExpect(status().isNotFound());
    }

    private MockHttpServletRequestBuilder mark(long habitId, String date, String json) {
        return put("/api/habits/{id}/check-ins/{date}", habitId, date).with(as(bob)).with(xsrf())
                .contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private List<String> colors(long habitId) {
        return jdbc.sql("SELECT period_start || '=' || color FROM check_in WHERE habit_id = :id ORDER BY period_start")
                .param("id", habitId).query(String.class).list();
    }
}
```

> If `isUnprocessableContent()` doesn't exist in this Spring version, use `isUnprocessableEntity()` (same 422), matching whatever `ErrorCode.CHECK_IN_NOT_ALLOWED` uses.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*CheckInIntegrationTest'`
Expected: FAIL — the check-in endpoints don't exist (404s / 405s instead of the expected statuses).

- [ ] **Step 3: Implement the repository and timeline loader**

`api/src/main/java/com/chronos/habit/CheckIn.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Color;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CheckIn(long id, long habitId, LocalDate periodStart, Color color, String note,
                      OffsetDateTime updatedAt) {
}
```

`api/src/main/java/com/chronos/habit/CheckInRepository.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Color;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class CheckInRepository {

    private final JdbcClient jdbc;

    public CheckInRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public CheckIn upsert(long habitId, LocalDate periodStart, Color color, String note) {
        return jdbc.sql("""
                        INSERT INTO check_in (habit_id, period_start, color, note)
                        VALUES (:habitId, :periodStart, :color, :note)
                        ON CONFLICT (habit_id, period_start)
                        DO UPDATE SET color = EXCLUDED.color, note = EXCLUDED.note, updated_at = now()
                        RETURNING *
                        """)
                .param("habitId", habitId)
                .param("periodStart", periodStart)
                .param("color", color.name())
                .param("note", note)
                .query(CheckIn.class)
                .single();
    }

    public void delete(long habitId, LocalDate periodStart) {
        jdbc.sql("DELETE FROM check_in WHERE habit_id = :habitId AND period_start = :periodStart")
                .param("habitId", habitId).param("periodStart", periodStart).update();
    }

    public Map<Long, Map<LocalDate, Color>> colorsByHabit(Collection<Long> habitIds) {
        Map<Long, Map<LocalDate, Color>> result = new HashMap<>();
        if (habitIds.isEmpty()) {
            return result;
        }
        jdbc.sql("SELECT * FROM check_in WHERE habit_id IN (:ids)")
                .param("ids", List.copyOf(habitIds))
                .query(CheckIn.class)
                .list()
                .forEach(c -> result.computeIfAbsent(c.habitId(), k -> new HashMap<>()).put(c.periodStart(), c.color()));
        return result;
    }

    public Map<Long, Map<LocalDate, String>> notesBetween(Collection<Long> habitIds, LocalDate from, LocalDate to) {
        Map<Long, Map<LocalDate, String>> result = new HashMap<>();
        if (habitIds.isEmpty()) {
            return result;
        }
        jdbc.sql("""
                        SELECT * FROM check_in
                        WHERE habit_id IN (:ids) AND period_start BETWEEN :from AND :to AND note IS NOT NULL
                        """)
                .param("ids", List.copyOf(habitIds))
                .param("from", from)
                .param("to", to)
                .query(CheckIn.class)
                .list()
                .forEach(c -> result.computeIfAbsent(c.habitId(), k -> new HashMap<>()).put(c.periodStart(), c.note()));
        return result;
    }
}
```

`api/src/main/java/com/chronos/habit/HabitTimelines.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.HabitTimeline;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds {@link HabitTimeline}s for habits with two queries (pauses, check-ins) regardless of habit count. */
@Component
public class HabitTimelines {

    private final PauseRepository pauses;
    private final CheckInRepository checkIns;

    public HabitTimelines(PauseRepository pauses, CheckInRepository checkIns) {
        this.pauses = pauses;
        this.checkIns = checkIns;
    }

    public Map<Long, HabitTimeline> load(List<Habit> habits, LocalDate today) {
        List<Long> ids = habits.stream().map(Habit::id).toList();
        var pausesByHabit = pauses.rangesByHabit(ids);
        var colorsByHabit = checkIns.colorsByHabit(ids);
        Map<Long, HabitTimeline> result = new LinkedHashMap<>();
        for (Habit habit : habits) {
            result.put(habit.id(), new HabitTimeline(habit.schedule(),
                    pausesByHabit.getOrDefault(habit.id(), List.of()),
                    colorsByHabit.getOrDefault(habit.id(), Map.of()),
                    habit.archived(), today));
        }
        return result;
    }
}
```

- [ ] **Step 4: Implement the service, DTOs and controller**

`api/src/main/java/com/chronos/habit/CheckInRequest.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Color;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CheckInRequest(@NotNull Color color, @Size(max = 500) String note) {
}
```

`api/src/main/java/com/chronos/habit/CheckInResponse.java`:
```java
package com.chronos.habit;

import com.chronos.habit.domain.Color;

import java.time.LocalDate;

public record CheckInResponse(LocalDate periodStart, Color color, String note) {

    public static CheckInResponse from(CheckIn c) {
        return new CheckInResponse(c.periodStart(), c.color(), c.note());
    }
}
```

`api/src/main/java/com/chronos/habit/CheckInService.java`:
```java
package com.chronos.habit;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class CheckInService {

    private final HabitService habits;
    private final HabitTimelines timelines;
    private final CheckInRepository checkIns;
    private final UserService userService;

    public CheckInService(HabitService habits, HabitTimelines timelines, CheckInRepository checkIns,
                          UserService userService) {
        this.habits = habits;
        this.timelines = timelines;
        this.checkIns = checkIns;
        this.userService = userService;
    }

    @Transactional
    public CheckIn mark(long userId, long habitId, LocalDate periodStart, CheckInRequest request) {
        requireEditable(userId, habitId, periodStart);
        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        return checkIns.upsert(habitId, periodStart, request.color(), note);
    }

    @Transactional
    public void clear(long userId, long habitId, LocalDate periodStart) {
        requireEditable(userId, habitId, periodStart);
        checkIns.delete(habitId, periodStart);
    }

    private void requireEditable(long userId, long habitId, LocalDate periodStart) {
        Habit habit = habits.requireOwned(userId, habitId);
        var timeline = timelines.load(List.of(habit), userService.today(userId)).get(habitId);
        if (!timeline.isEditable(periodStart)) {
            throw new ApiException(ErrorCode.CHECK_IN_NOT_ALLOWED,
                    "This period can't be changed (outside the last 7 days, not a period start, or paused)");
        }
    }
}
```

`api/src/main/java/com/chronos/habit/CheckInController.java`:
```java
package com.chronos.habit;

import com.chronos.core.user.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/habits/{id}/check-ins/{periodStart}")
public class CheckInController {

    private final CheckInService checkIns;

    public CheckInController(CheckInService checkIns) {
        this.checkIns = checkIns;
    }

    @PutMapping
    public CheckInResponse mark(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id,
                                @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
                                @Valid @RequestBody CheckInRequest body) {
        return CheckInResponse.from(checkIns.mark(principal.id(), id, periodStart, body));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id,
                      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart) {
        checkIns.clear(principal.id(), id, periodStart);
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd api && ./gradlew test --tests '*CheckInIntegrationTest'`
Expected: PASS (8 tests).

- [ ] **Step 6: Run the full suite and commit**

Run: `cd api && ./gradlew test`
Expected: BUILD SUCCESSFUL.

```bash
git add api
git commit -m "feat(api): add check-ins limited to the 7-day edit window" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Stats — week, month and streaks

**Files:**
- Create: `api/src/main/java/com/chronos/stats/{StatsService,StatsController,WeekResponse,MonthResponse,StreakResponse}.java`
- Test: `api/src/test/java/com/chronos/stats/StatsIntegrationTest.java`

**Interfaces:**
- Consumes: `HabitService#list(long, HabitStatus)` (null status → ACTIVE + PAUSED), `HabitTimelines#load`, `CheckInRepository#notesBetween` (Tasks 5–6); `HabitTimeline`, `CellState`, `Distribution` (Task 4); `UserService#today` (Task 2).
- Produces (JSON shapes the web plan relies on):
  - `GET /api/stats/week?start=YYYY-MM-DD` → `{start, today, habits:[{id, name, minText, targetText, frequency, intervalDays, cells:[{date, periodStart, state, editable, note, closesAt}]}], distribution:{green, yellow, red, grey, total}}`. `start` defaults to this week's Monday; a non-Monday → 400 `VALIDATION`. DAILY/EVERY_N_DAYS habits have 7 cells (non-due days: `state: NOT_DUE`, `periodStart: null`, `editable: false`, `closesAt: null`); WEEKLY habits have 1 cell dated Monday. `intervalDays` is set for EVERY_N_DAYS habits and `null` otherwise (the web app shows "Every 3 days").
  - `closesAt` (ISO-8601 UTC instant, e.g. `"2026-11-18T18:30:00Z"`) is midnight in the user's timezone at the start of the day after the period's last day (`periodEnd(periodStart) + 1 day`), i.e. when the period stops being current and an unmarked cell turns GREY. It is set whenever `periodStart` is set (including PAUSED and past periods) and `null` when `periodStart` is `null` (NOT_DUE). It drives the web app's "time left" countdown; it is not an edit lock (the 7-day editing window still applies).
  - `GET /api/stats/month?month=YYYY-MM` → `{month, overview:[{date, score}], habits:[{id, name, frequency, cells:[{date, state}]}], distribution}`. One overview entry and one cell per day of the month; `score` is 0–2 or `null`.
  - `GET /api/stats/streaks` → `[{habitId, name, current, best}]`.
  - Archived habits are excluded everywhere; habits are ordered by id.

- [ ] **Step 1: Write the failing integration test**

`api/src/test/java/com/chronos/stats/StatsIntegrationTest.java`:
```java
package com.chronos.stats;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StatsIntegrationTest extends IntegrationTest {

    private AppUserPrincipal bob;

    @BeforeEach
    void setUp() {
        bob = createUser("bob");
    }

    private static LocalDate nov(int day) {
        return LocalDate.of(2026, 11, day);
    }

    @Test
    void weekShowsCellsPerFrequencyAndTheDistribution() throws Exception {
        long daily = insertHabit(bob, "Read", "DAILY", null, nov(1));
        long everyThree = insertHabit(bob, "Run", "EVERY_N_DAYS", 3, nov(2));
        long weekly = insertHabit(bob, "Clean", "WEEKLY", null, nov(1));
        long archived = insertHabit(bob, "Old", "DAILY", null, nov(1));
        setStatus(archived, "ARCHIVED");
        insertCheckIn(daily, nov(16), "GREEN");
        jdbc.sql("UPDATE check_in SET note = 'great' WHERE habit_id = :id").param("id", daily).update();
        insertCheckIn(weekly, nov(16), "YELLOW");

        mvc.perform(get("/api/stats/week").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.start").value("2026-11-16"))
                .andExpect(jsonPath("$.today").value("2026-11-18"))
                .andExpect(jsonPath("$.habits", hasSize(3)))

                .andExpect(jsonPath("$.habits[0].id").value(daily))
                .andExpect(jsonPath("$.habits[0].minText").value("min"))
                .andExpect(jsonPath("$.habits[0].intervalDays").value(nullValue()))
                .andExpect(jsonPath("$.habits[0].cells", hasSize(7)))
                .andExpect(jsonPath("$.habits[0].cells[0].date").value("2026-11-16"))
                .andExpect(jsonPath("$.habits[0].cells[0].periodStart").value("2026-11-16"))
                .andExpect(jsonPath("$.habits[0].cells[0].state").value("GREEN"))
                .andExpect(jsonPath("$.habits[0].cells[0].editable").value(true))
                .andExpect(jsonPath("$.habits[0].cells[0].note").value("great"))
                .andExpect(jsonPath("$.habits[0].cells[0].closesAt").value("2026-11-16T18:30:00Z"))
                .andExpect(jsonPath("$.habits[0].cells[1].state").value("GREY"))
                .andExpect(jsonPath("$.habits[0].cells[2].state").value("PENDING"))
                .andExpect(jsonPath("$.habits[0].cells[2].editable").value(true))
                .andExpect(jsonPath("$.habits[0].cells[2].closesAt").value("2026-11-18T18:30:00Z"))
                .andExpect(jsonPath("$.habits[0].cells[3].state").value("PENDING"))
                .andExpect(jsonPath("$.habits[0].cells[3].editable").value(false))

                .andExpect(jsonPath("$.habits[1].id").value(everyThree))
                .andExpect(jsonPath("$.habits[1].intervalDays").value(3))
                .andExpect(jsonPath("$.habits[1].cells", hasSize(7)))
                .andExpect(jsonPath("$.habits[1].cells[0].state").value("NOT_DUE"))
                .andExpect(jsonPath("$.habits[1].cells[0].periodStart").value(nullValue()))
                .andExpect(jsonPath("$.habits[1].cells[0].editable").value(false))
                .andExpect(jsonPath("$.habits[1].cells[0].closesAt").value(nullValue()))
                .andExpect(jsonPath("$.habits[1].cells[1].periodStart").value("2026-11-17"))
                .andExpect(jsonPath("$.habits[1].cells[1].state").value("GREY"))
                // period 17–19 Nov closes at midnight 20 Nov IST
                .andExpect(jsonPath("$.habits[1].cells[1].closesAt").value("2026-11-19T18:30:00Z"))
                .andExpect(jsonPath("$.habits[1].cells[4].state").value("PENDING"))

                .andExpect(jsonPath("$.habits[2].id").value(weekly))
                .andExpect(jsonPath("$.habits[2].cells", hasSize(1)))
                .andExpect(jsonPath("$.habits[2].cells[0].date").value("2026-11-16"))
                .andExpect(jsonPath("$.habits[2].cells[0].state").value("YELLOW"))
                .andExpect(jsonPath("$.habits[2].cells[0].editable").value(true))
                .andExpect(jsonPath("$.habits[2].cells[0].closesAt").value("2026-11-22T18:30:00Z"))

                .andExpect(jsonPath("$.distribution.green").value(1))
                .andExpect(jsonPath("$.distribution.yellow").value(1))
                .andExpect(jsonPath("$.distribution.red").value(0))
                .andExpect(jsonPath("$.distribution.grey").value(2))
                .andExpect(jsonPath("$.distribution.total").value(4));
    }

    @Test
    void weekBeforeAHabitStartedIsNotDue() throws Exception {
        insertHabit(bob, "Clean", "WEEKLY", null, nov(18));

        mvc.perform(get("/api/stats/week").param("start", "2026-11-09").with(as(bob)))
                .andExpect(jsonPath("$.habits[0].cells[0].state").value("NOT_DUE"))
                .andExpect(jsonPath("$.habits[0].cells[0].periodStart").value(nullValue()))
                .andExpect(jsonPath("$.habits[0].cells[0].closesAt").value(nullValue()))
                .andExpect(jsonPath("$.distribution.total").value(0));
    }

    @Test
    void weekStartMustBeAMonday() throws Exception {
        mvc.perform(get("/api/stats/week").param("start", "2026-11-18").with(as(bob)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    @Test
    void monthShowsDailyScoresHeatmapsAndDistribution() throws Exception {
        long daily = insertHabit(bob, "Read", "DAILY", null, nov(15));
        long weekly = insertHabit(bob, "Clean", "WEEKLY", null, nov(1));
        insertCheckIn(daily, nov(15), "GREEN");
        insertCheckIn(daily, nov(16), "RED");
        insertCheckIn(weekly, nov(9), "YELLOW");

        mvc.perform(get("/api/stats/month").param("month", "2026-11").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value("2026-11"))
                .andExpect(jsonPath("$.overview", hasSize(30)))
                .andExpect(jsonPath("$.overview[0].date").value("2026-11-01"))
                .andExpect(jsonPath("$.overview[0].score").value(0.0))   // weekly: week of Oct 26 is GREY
                .andExpect(jsonPath("$.overview[13].score").value(1.0))  // Nov 14: weekly YELLOW only
                .andExpect(jsonPath("$.overview[14].score").value(1.5))  // Nov 15: GREEN 2 + YELLOW 1
                .andExpect(jsonPath("$.overview[15].score").value(0.0))  // Nov 16: RED, weekly pending
                .andExpect(jsonPath("$.overview[17].score").value(nullValue())) // Nov 18: all pending

                .andExpect(jsonPath("$.habits", hasSize(2)))
                .andExpect(jsonPath("$.habits[0].cells", hasSize(30)))
                .andExpect(jsonPath("$.habits[0].cells[13].state").value("NOT_DUE"))
                .andExpect(jsonPath("$.habits[0].cells[14].date").value("2026-11-15"))
                .andExpect(jsonPath("$.habits[0].cells[14].state").value("GREEN"))
                .andExpect(jsonPath("$.habits[0].cells[16].state").value("GREY"))
                .andExpect(jsonPath("$.habits[1].frequency").value("WEEKLY"))
                .andExpect(jsonPath("$.habits[1].cells[0].state").value("GREY"))
                .andExpect(jsonPath("$.habits[1].cells[8].state").value("YELLOW"))
                .andExpect(jsonPath("$.habits[1].cells[14].state").value("YELLOW"))
                .andExpect(jsonPath("$.habits[1].cells[15].state").value("PENDING"))

                .andExpect(jsonPath("$.distribution.green").value(1))
                .andExpect(jsonPath("$.distribution.yellow").value(1))
                .andExpect(jsonPath("$.distribution.red").value(1))
                .andExpect(jsonPath("$.distribution.grey").value(2))
                .andExpect(jsonPath("$.distribution.total").value(5));
    }

    @Test
    void monthDefaultsToTheCurrentMonthAndValidatesTheParam() throws Exception {
        mvc.perform(get("/api/stats/month").with(as(bob))).andExpect(jsonPath("$.month").value("2026-11"));
        mvc.perform(get("/api/stats/month").param("month", "2026-13").with(as(bob)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    @Test
    void streaksPerHabit() throws Exception {
        long daily = insertHabit(bob, "Read", "DAILY", null, nov(16));
        insertCheckIn(daily, nov(16), "GREEN");
        insertCheckIn(daily, nov(17), "YELLOW");

        mvc.perform(get("/api/stats/streaks").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].habitId").value(daily))
                .andExpect(jsonPath("$[0].name").value("Read"))
                .andExpect(jsonPath("$[0].current").value(2))
                .andExpect(jsonPath("$[0].best").value(2));
    }

    @Test
    void onlyShowsTheCallersHabits() throws Exception {
        insertHabit(createUser("alice"), "Hers", "DAILY", null, nov(1));

        mvc.perform(get("/api/stats/week").with(as(bob))).andExpect(jsonPath("$.habits", hasSize(0)));
        mvc.perform(get("/api/stats/streaks").with(as(bob))).andExpect(jsonPath("$", hasSize(0)));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && ./gradlew test --tests '*StatsIntegrationTest'`
Expected: FAIL — `/api/stats/**` returns 404.

- [ ] **Step 3: Implement the response records**

`api/src/main/java/com/chronos/stats/WeekResponse.java`:
```java
package com.chronos.stats;

import com.chronos.habit.domain.CellState;
import com.chronos.habit.domain.Distribution;
import com.chronos.habit.domain.Frequency;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record WeekResponse(LocalDate start, LocalDate today, List<Habit> habits, Distribution distribution) {

    public record Habit(long id, String name, String minText, String targetText, Frequency frequency,
                        Integer intervalDays, List<Cell> cells) {
    }

    /** {@code closesAt}: midnight (user's zone) after the period's last day; null when {@code periodStart} is null. */
    public record Cell(LocalDate date, LocalDate periodStart, CellState state, boolean editable, String note,
                       Instant closesAt) {
    }
}
```

`api/src/main/java/com/chronos/stats/MonthResponse.java`:
```java
package com.chronos.stats;

import com.chronos.habit.domain.CellState;
import com.chronos.habit.domain.Distribution;
import com.chronos.habit.domain.Frequency;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

public record MonthResponse(YearMonth month, List<Day> overview, List<Habit> habits, Distribution distribution) {

    public record Day(LocalDate date, Double score) {
    }

    public record Habit(long id, String name, Frequency frequency, List<Cell> cells) {
    }

    public record Cell(LocalDate date, CellState state) {
    }
}
```

> Jackson 3 (Spring Boot 4) writes `Instant` as an ISO-8601 string (`"2026-11-18T18:30:00Z"`) by default. If `closesAt` comes out as a number, set `spring.jackson.serialization.write-dates-as-timestamps=false`.

> Jackson serializes `YearMonth` as `"2026-11"` by default in Spring Boot 4 (Jackson 3, java.time built in). If it comes out as an array, change the component to `String month` and pass `month.toString()`.

`api/src/main/java/com/chronos/stats/StreakResponse.java`:
```java
package com.chronos.stats;

public record StreakResponse(long habitId, String name, int current, int best) {
}
```

- [ ] **Step 4: Implement the service and controller**

`api/src/main/java/com/chronos/stats/StatsService.java`:
```java
package com.chronos.stats;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.UserService;
import com.chronos.habit.CheckInRepository;
import com.chronos.habit.Habit;
import com.chronos.habit.HabitService;
import com.chronos.habit.HabitTimelines;
import com.chronos.habit.domain.CellState;
import com.chronos.habit.domain.Distribution;
import com.chronos.habit.domain.Frequency;
import com.chronos.habit.domain.HabitTimeline;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class StatsService {

    private final HabitService habitService;
    private final HabitTimelines timelines;
    private final CheckInRepository checkIns;
    private final UserService userService;

    public StatsService(HabitService habitService, HabitTimelines timelines, CheckInRepository checkIns,
                        UserService userService) {
        this.habitService = habitService;
        this.timelines = timelines;
        this.checkIns = checkIns;
        this.userService = userService;
    }

    public WeekResponse week(long userId, LocalDate requestedStart) {
        LocalDate today = userService.today(userId);
        LocalDate start = requestedStart == null
                ? today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                : requestedStart;
        if (start.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new ApiException(ErrorCode.VALIDATION, "start: must be a Monday");
        }
        LocalDate end = start.plusDays(6);
        ZoneId zone = ZoneId.of(userService.get(userId).timezone());
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);
        var notes = checkIns.notesBetween(byId.keySet(), start, end);

        List<WeekResponse.Habit> rows = new ArrayList<>();
        Distribution distribution = Distribution.EMPTY;
        for (Habit habit : habits) {
            HabitTimeline timeline = byId.get(habit.id());
            Map<LocalDate, String> habitNotes = notes.getOrDefault(habit.id(), Map.of());
            List<LocalDate> days = habit.frequency() == Frequency.WEEKLY
                    ? List.of(start)
                    : start.datesUntil(end.plusDays(1)).toList();
            List<WeekResponse.Cell> cells = days.stream()
                    .map(day -> timeline.dueOn(day)
                            .map(p -> new WeekResponse.Cell(day, p, timeline.stateOf(p), timeline.isEditable(p),
                                    habitNotes.get(p), closesAt(timeline, p, zone)))
                            .orElseGet(() -> new WeekResponse.Cell(day, null, CellState.NOT_DUE, false, null, null)))
                    .toList();
            rows.add(new WeekResponse.Habit(habit.id(), habit.name(), habit.minText(), habit.targetText(),
                    habit.frequency(), habit.intervalDays(), cells));
            distribution = distribution.plus(timeline.distribution(start, end));
        }
        return new WeekResponse(start, today, rows, distribution);
    }

    public MonthResponse month(long userId, String requestedMonth) {
        LocalDate today = userService.today(userId);
        YearMonth month = parseMonth(requestedMonth, today);
        LocalDate first = month.atDay(1);
        LocalDate last = month.atEndOfMonth();
        List<LocalDate> days = first.datesUntil(last.plusDays(1)).toList();
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);

        List<MonthResponse.Day> overview = days.stream()
                .map(day -> new MonthResponse.Day(day, HabitTimeline.averageScore(byId.values(), day)))
                .toList();

        List<MonthResponse.Habit> rows = new ArrayList<>();
        Distribution distribution = Distribution.EMPTY;
        for (Habit habit : habits) {
            HabitTimeline timeline = byId.get(habit.id());
            List<MonthResponse.Cell> cells = days.stream()
                    .map(day -> new MonthResponse.Cell(day, monthState(habit, timeline, day)))
                    .toList();
            rows.add(new MonthResponse.Habit(habit.id(), habit.name(), habit.frequency(), cells));
            distribution = distribution.plus(timeline.distribution(first, last));
        }
        return new MonthResponse(month, overview, rows, distribution);
    }

    public List<StreakResponse> streaks(long userId) {
        LocalDate today = userService.today(userId);
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);
        return habits.stream()
                .map(h -> {
                    var streak = byId.get(h.id()).streak();
                    return new StreakResponse(h.id(), h.name(), streak.current(), streak.best());
                })
                .toList();
    }

    /** Midnight in the user's zone after the period's last day, i.e. when the period stops being current. */
    private static Instant closesAt(HabitTimeline timeline, LocalDate periodStart, ZoneId zone) {
        return timeline.schedule().periodEnd(periodStart).plusDays(1).atStartOfDay(zone).toInstant();
    }

    /** WEEKLY habits show their week's state on every day; others show the state on due days only. */
    private static CellState monthState(Habit habit, HabitTimeline timeline, LocalDate day) {
        var periodStart = habit.frequency() == Frequency.WEEKLY
                ? timeline.schedule().periodContaining(day)
                : timeline.dueOn(day);
        return periodStart.map(timeline::stateOf).orElse(CellState.NOT_DUE);
    }

    private static YearMonth parseMonth(String value, LocalDate today) {
        if (value == null) {
            return YearMonth.from(today);
        }
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException ex) {
            throw new ApiException(ErrorCode.VALIDATION, "month: expected YYYY-MM");
        }
    }
}
```

`api/src/main/java/com/chronos/stats/StatsController.java`:
```java
package com.chronos.stats;

import com.chronos.core.user.AppUserPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService stats;

    public StatsController(StatsService stats) {
        this.stats = stats;
    }

    @GetMapping("/week")
    public WeekResponse week(@AuthenticationPrincipal AppUserPrincipal principal,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                             LocalDate start) {
        return stats.week(principal.id(), start);
    }

    @GetMapping("/month")
    public MonthResponse month(@AuthenticationPrincipal AppUserPrincipal principal,
                               @RequestParam(required = false) String month) {
        return stats.month(principal.id(), month);
    }

    @GetMapping("/streaks")
    public List<StreakResponse> streaks(@AuthenticationPrincipal AppUserPrincipal principal) {
        return stats.streaks(principal.id());
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd api && ./gradlew test --tests '*StatsIntegrationTest'`
Expected: PASS (7 tests).

- [ ] **Step 6: Run the full suite and commit**

Run: `cd api && ./gradlew test`
Expected: BUILD SUCCESSFUL.

```bash
git add api
git commit -m "feat(api): add week, month and streak stats" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Backend README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above (documents it). The web plan later appends the "Frontend" and "Deployment" sections.

- [ ] **Step 1: Write the README**

`README.md`:
````markdown
# Chronos

A multi-user habit tracker built on the "no red" principle. Every period of a habit is marked
**RED** (did nothing), **YELLOW** (did the bare minimum) or **GREEN** (hit the target); unmarked past periods show grey.
Week and month views show the grid, streaks, a daily score heatmap and the color distribution.

## Backend API (`api/`)

Spring Boot 4 (Java 21) + Postgres. Requires JDK 21 and Docker.

```bash
cd api
docker compose up -d                       # local Postgres 17 on :5433
cp .env.example .env
set -a && . ./.env && set +a
./gradlew bootRun                          # http://localhost:8080
```

- Anyone can sign up (`POST /api/auth/signup`); each user only sees their own habits.
- For every POST/PUT/DELETE, call `GET /api/auth/csrf` first, then send the `XSRF-TOKEN` cookie value as the `X-XSRF-TOKEN` header.
- 10 failed logins per username or per IP within 15 minutes → 429 until the window passes.
- "Today" is computed in the user's timezone (captured at sign-up, changeable via `PUT /api/auth/me`).
- Check-ins can be set or cleared only for periods ending within the last 7 days, and not while paused or archived.
- `GET /api/public/health` returns `{"status":"UP"}` (liveness probe, no database call).
- Code layout (`com.chronos`): `core` (`auth`, `user`, `config`, `error`, `web`), `habit` (habits, pauses, check-ins),
  `habit.domain` (pure period/streak/score logic), `stats` (week, month and streak views).

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/csrf` · `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` | Session auth |
| `GET` / `PUT /api/auth/me` | Username + timezone; change timezone or password |
| `GET /api/habits[?status=]` · `POST /api/habits` · `PUT /api/habits/{id}` | Habits |
| `POST /api/habits/{id}/pause` · `resume` · `archive` · `unarchive` | Lifecycle |
| `PUT` / `DELETE /api/habits/{id}/check-ins/{periodStart}` | Mark a period RED / YELLOW / GREEN |
| `GET /api/stats/week?start=` · `/month?month=` · `/streaks` | Views |

Tests (Testcontainers starts its own Postgres):

```bash
cd api && ./gradlew test
```

With Rancher Desktop, export these first:

```bash
export DOCKER_HOST=unix://$HOME/.rd/docker.sock
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

Backend environment variables: `DATABASE_URL` (JDBC URL), `DATABASE_USER`, `DATABASE_PASSWORD`,
`COOKIE_SECURE` (default `true`), `PORT` (default `8080`).
````

- [ ] **Step 2: Smoke-test the documented commands**

Run:
```bash
cd api && docker compose up -d && set -a && . ./.env.example && set +a && (./gradlew bootRun > /tmp/chronos-boot.log 2>&1 &) \
  && sleep 25 && curl -s localhost:8080/api/public/health
```
Expected: `{"status":"UP"}`. Then stop the app (`kill` the `bootRun` java PID from `jps`) and `docker compose down`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Chronos README with backend usage" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
