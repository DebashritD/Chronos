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
                .andExpect(jsonPath("$.habits[1].cells[1].state").value("PENDING"))   // 17–19 Nov contains today
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
                .andExpect(jsonPath("$.distribution.grey").value(1))
                .andExpect(jsonPath("$.distribution.total").value(3));
    }

    @Test
    void weekCarriesTheCurrentPeriodOfEachHabit() throws Exception {
        insertHabit(bob, "Read", "DAILY", null, nov(1));
        long run = insertHabit(bob, "Run", "EVERY_N_DAYS", 3, nov(2));     // periods …, 17–19, 20–22
        insertHabit(bob, "Swim", "EVERY_N_DAYS", 7, nov(1));              // period 15–21 began last week
        long clean = insertHabit(bob, "Clean", "WEEKLY", null, nov(1));
        insertHabit(bob, "Later", "DAILY", null, nov(20));
        jdbc.sql("UPDATE habit SET status = 'PAUSED' WHERE id = :id").param("id", clean).update();
        insertCheckIn(run, nov(17), "YELLOW");
        jdbc.sql("UPDATE check_in SET note = 'slow' WHERE habit_id = :id").param("id", run).update();

        // A past week is requested on purpose: `current` always describes today.
        mvc.perform(get("/api/stats/week").param("start", "2026-11-09").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habits[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.habits[3].status").value("PAUSED"))
                .andExpect(jsonPath("$.habits[0].current.periodStart").value("2026-11-18"))
                .andExpect(jsonPath("$.habits[0].current.state").value("PENDING"))
                .andExpect(jsonPath("$.habits[0].current.editable").value(true))
                .andExpect(jsonPath("$.habits[0].current.closesAt").value("2026-11-18T18:30:00Z"))

                .andExpect(jsonPath("$.habits[1].current.periodStart").value("2026-11-17"))
                .andExpect(jsonPath("$.habits[1].current.state").value("YELLOW"))
                .andExpect(jsonPath("$.habits[1].current.note").value("slow"))
                .andExpect(jsonPath("$.habits[1].current.closesAt").value("2026-11-19T18:30:00Z"))

                .andExpect(jsonPath("$.habits[2].current.periodStart").value("2026-11-15"))
                .andExpect(jsonPath("$.habits[2].current.closesAt").value("2026-11-21T18:30:00Z"))

                .andExpect(jsonPath("$.habits[3].current.periodStart").value("2026-11-16"))
                .andExpect(jsonPath("$.habits[3].current.closesAt").value("2026-11-22T18:30:00Z"))

                .andExpect(jsonPath("$.habits[4].current").value(nullValue()));
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

    @Test
    void streaksApplyTheUsersYellowCapToCappedHabitsOnly() throws Exception {
        long capped = insertHabit(bob, "Read", "DAILY", null, nov(15));
        long free = insertHabit(bob, "Run", "DAILY", null, nov(15));
        jdbc.sql("UPDATE habit SET yellow_cap = false WHERE id = :id").param("id", free).update();
        for (long habit : new long[] {capped, free}) {
            insertCheckIn(habit, nov(15), "YELLOW");
            insertCheckIn(habit, nov(16), "YELLOW");
            insertCheckIn(habit, nov(17), "YELLOW");
        }

        mvc.perform(get("/api/stats/streaks").with(as(bob)))
                .andExpect(jsonPath("$[0].current").value(1))
                .andExpect(jsonPath("$[0].yellowRun").value(1))
                .andExpect(jsonPath("$[0].yellowLimit").value(2))
                .andExpect(jsonPath("$[1].current").value(3))
                .andExpect(jsonPath("$[1].yellowRun").value(3))
                .andExpect(jsonPath("$[1].yellowLimit").doesNotExist());
    }
}
