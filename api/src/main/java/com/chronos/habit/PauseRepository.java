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
