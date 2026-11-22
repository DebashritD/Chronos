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
