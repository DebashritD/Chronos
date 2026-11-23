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

    public void updateMaxYellows(long id, int maxYellows) {
        jdbc.sql("UPDATE app_user SET max_yellows = :maxYellows WHERE id = :id")
                .param("id", id).param("maxYellows", maxYellows).update();
    }

    public void updatePasswordHash(long id, String passwordHash) {
        jdbc.sql("UPDATE app_user SET password_hash = :hash WHERE id = :id")
                .param("id", id).param("hash", passwordHash).update();
    }
}
