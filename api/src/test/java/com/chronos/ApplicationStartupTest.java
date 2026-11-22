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
