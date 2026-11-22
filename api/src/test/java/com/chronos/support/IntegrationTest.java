package com.chronos.support;

import com.chronos.core.auth.LoginThrottle;
import com.chronos.core.user.AppUserPrincipal;
import com.chronos.core.user.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties = {
        "chronos.cookie.secure=false",
        // Docker VMs (e.g. Rancher Desktop) can expose the container port a moment after it is ready
        "spring.flyway.connect-retries=10"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
public abstract class IntegrationTest {

    public static final LocalDate TODAY = LocalDate.of(2026, 11, 18);
    public static final String PASSWORD = "password123";
    public static final String ZONE = "Asia/Kolkata";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcClient jdbc;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected LoginThrottle loginThrottle;

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
}
