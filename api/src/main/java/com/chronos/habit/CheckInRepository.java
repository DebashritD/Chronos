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
