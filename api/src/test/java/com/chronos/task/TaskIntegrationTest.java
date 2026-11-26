package com.chronos.task;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TaskIntegrationTest extends IntegrationTest {

    private AppUserPrincipal bob;

    @BeforeEach
    void setUp() {
        bob = createUser("bob");
    }

    @Test
    void createsThenReplacesATaskAndARepeatIsHarmless() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(save(bob, id, "{\"text\": \"  Call the plumber  \", \"scheduledOn\": \"2026-11-18\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.text").value("Call the plumber"))
                .andExpect(jsonPath("$.scheduledOn").value("2026-11-18"))
                .andExpect(jsonPath("$.doneOn").doesNotExist());

        String done = "{\"text\": \"Call the plumber\", \"scheduledOn\": \"2026-11-18\", \"doneOn\": \"2026-11-18\"}";
        mvc.perform(save(bob, id, done)).andExpect(status().isOk()).andExpect(jsonPath("$.doneOn").value("2026-11-18"));
        mvc.perform(save(bob, id, done)).andExpect(status().isOk());

        assertThat(count()).isEqualTo(1);
    }

    @Test
    void listsOpenLaterAndDoneTodayButNotDoneBefore() throws Exception {
        UUID open = UUID.randomUUID(), later = UUID.randomUUID(), doneToday = UUID.randomUUID(), doneYesterday = UUID.randomUUID();
        mvc.perform(save(bob, open, "{\"text\": \"Open\", \"scheduledOn\": \"2026-11-15\"}")).andExpect(status().isOk());
        mvc.perform(save(bob, later, "{\"text\": \"Later\"}")).andExpect(status().isOk());
        mvc.perform(save(bob, doneToday, "{\"text\": \"Today\", \"scheduledOn\": \"2026-11-18\", \"doneOn\": \"2026-11-18\"}"))
                .andExpect(status().isOk());
        mvc.perform(save(bob, doneYesterday, "{\"text\": \"Old\", \"scheduledOn\": \"2026-11-17\", \"doneOn\": \"2026-11-17\"}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/tasks").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[*].text", contains("Open", "Later", "Today")));
    }

    @Test
    void validatesTextAndDates() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(save(bob, id, "{\"text\": \"   \"}")).andExpect(status().isBadRequest());
        mvc.perform(save(bob, id, "{\"text\": \"" + "x".repeat(201) + "\"}")).andExpect(status().isBadRequest());
        mvc.perform(save(bob, id, "{\"text\": \"Ok\", \"scheduledOn\": \"2026-11-20\"}")).andExpect(status().isBadRequest());
        mvc.perform(save(bob, id, "{\"text\": \"Ok\", \"doneOn\": \"2026-11-20\"}")).andExpect(status().isBadRequest());
        mvc.perform(save(bob, id, "{\"text\": \"Ok\", \"scheduledOn\": \"2026-11-19\"}")).andExpect(status().isOk());
        assertThat(count()).isEqualTo(1);
    }

    @Test
    void deletesAndAMissingTaskIsAlreadyGone() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(save(bob, id, "{\"text\": \"Gone\"}")).andExpect(status().isOk());

        mvc.perform(delete("/api/tasks/{id}", id).with(as(bob)).with(xsrf())).andExpect(status().isNoContent());
        mvc.perform(delete("/api/tasks/{id}", id).with(as(bob)).with(xsrf())).andExpect(status().isNoContent());
        assertThat(count()).isZero();
    }

    @Test
    void someoneElsesTaskIsNotFound() throws Exception {
        AppUserPrincipal alice = createUser("alice");
        UUID hers = UUID.randomUUID();
        mvc.perform(save(alice, hers, "{\"text\": \"Hers\"}")).andExpect(status().isOk());

        mvc.perform(save(bob, hers, "{\"text\": \"Mine now\"}")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/tasks/{id}", hers).with(as(bob)).with(xsrf())).andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks").with(as(bob))).andExpect(jsonPath("$", hasSize(0)));
        assertThat(jdbc.sql("SELECT text FROM task").query(String.class).single()).isEqualTo("Hers");
    }

    private MockHttpServletRequestBuilder save(AppUserPrincipal who, UUID id, String json) {
        return put("/api/tasks/{id}", id).with(as(who)).with(xsrf()).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private long count() {
        return jdbc.sql("SELECT count(*) FROM task").query(Long.class).single();
    }
}
