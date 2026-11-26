package com.chronos.task;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class TaskRepository {

    private final JdbcClient jdbc;

    public TaskRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Empty when the id belongs to another user: the conflict update is skipped and nothing is returned. */
    public Optional<Task> upsert(UUID id, long userId, String text, LocalDate scheduledOn, LocalDate doneOn) {
        return jdbc.sql("""
                        INSERT INTO task (id, user_id, text, scheduled_on, done_on)
                        VALUES (:id, :userId, :text, :scheduledOn, :doneOn)
                        ON CONFLICT (id) DO UPDATE
                          SET text = EXCLUDED.text, scheduled_on = EXCLUDED.scheduled_on, done_on = EXCLUDED.done_on
                          WHERE task.user_id = EXCLUDED.user_id
                        RETURNING *
                        """)
                .param("id", id).param("userId", userId).param("text", text)
                .param("scheduledOn", scheduledOn).param("doneOn", doneOn)
                .query(Task.class)
                .optional();
    }

    public List<Task> listFrom(long userId, LocalDate today) {
        return jdbc.sql("""
                        SELECT * FROM task
                        WHERE user_id = :userId AND (done_on IS NULL OR done_on >= :today)
                        ORDER BY created_at, id
                        """)
                .param("userId", userId).param("today", today)
                .query(Task.class)
                .list();
    }

    public int delete(UUID id, long userId) {
        return jdbc.sql("DELETE FROM task WHERE id = :id AND user_id = :userId").param("id", id).param("userId", userId).update();
    }

    public boolean exists(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM task WHERE id = :id)").param("id", id).query(Boolean.class).single();
    }
}
