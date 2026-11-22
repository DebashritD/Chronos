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
