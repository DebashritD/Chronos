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
                       Integer intervalDays, LocalDate startDate, boolean yellowCap) {
        return jdbc.sql("""
                        INSERT INTO habit (user_id, name, min_text, target_text, frequency, interval_days, start_date, yellow_cap)
                        VALUES (:userId, :name, :minText, :targetText, :frequency, :intervalDays, :startDate, :yellowCap)
                        RETURNING id
                        """)
                .param("userId", userId)
                .param("name", name)
                .param("minText", minText)
                .param("targetText", targetText)
                .param("frequency", frequency.name())
                .param("intervalDays", intervalDays)
                .param("yellowCap", yellowCap)
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

    public void updateYellowCap(long habitId, boolean yellowCap) {
        jdbc.sql("UPDATE habit SET yellow_cap = :yellowCap, updated_at = now() WHERE id = :id")
                .param("id", habitId).param("yellowCap", yellowCap).update();
    }

    public void updateStatus(long habitId, HabitStatus status) {
        jdbc.sql("UPDATE habit SET status = :status, updated_at = now() WHERE id = :id")
                .param("id", habitId)
                .param("status", status.name())
                .update();
    }
}
