package com.chronos.core.auth;

import com.chronos.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthIntegrationTest extends IntegrationTest {

    @Test
    void meRequiresAuthenticationWithoutCreatingSession() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().doesNotExist("SESSION"));
    }

    @Test
    void csrfEndpointIssuesCookie() throws Exception {
        mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(cookie().doesNotExist("SESSION"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void signupCreatesAccountAndLogsIn() throws Exception {
        Cookie session = mvc.perform(signup("Alice", PASSWORD, "Europe/Berlin"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.timezone").value("Europe/Berlin"))
                .andReturn().getResponse().getCookie("SESSION");
        assertThat(session).isNotNull();

        mvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    void signupRejectsTakenUsernameIgnoringCase() throws Exception {
        createUser("alice");

        mvc.perform(signup("ALICE", PASSWORD, ZONE))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void signupValidatesInput() throws Exception {
        mvc.perform(signup("al", PASSWORD, ZONE)).andExpect(status().isBadRequest());
        mvc.perform(signup("alice!", PASSWORD, ZONE)).andExpect(status().isBadRequest());
        mvc.perform(signup("alice", "short", ZONE)).andExpect(status().isBadRequest());
        mvc.perform(signup("alice", PASSWORD, "Mars/Olympus"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    @Test
    void signupRejectsPasswordsOver72Bytes() throws Exception {
        mvc.perform(signup("alice", "नमस्ते".repeat(5), ZONE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    @Test
    void updateMeRejectsNewPasswordOver72Bytes() throws Exception {
        var bob = createUser("bob");

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "%s", "newPassword": "%s"}
                                """.formatted(PASSWORD, "😀".repeat(19))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }

    @Test
    void signupWithoutCsrfTokenIsForbidden() throws Exception {
        mvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("alice", PASSWORD, ZONE)))
                .andExpect(status().isForbidden());
    }

    @Test
    void loginCreatesSessionCookie() throws Exception {
        createUser("bob");

        Cookie session = mvc.perform(login("Bob", PASSWORD, "10.0.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("bob"))
                .andExpect(jsonPath("$.timezone").value(ZONE))
                .andExpect(header().string("Set-Cookie", allOf(
                        containsString("SESSION="), containsString("HttpOnly"), containsString("SameSite=Lax"))))
                .andReturn().getResponse().getCookie("SESSION");

        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk());
    }

    @Test
    void loginWithWrongPasswordIsRejected() throws Exception {
        createUser("bob");

        mvc.perform(login("bob", "nope-nope", "10.0.0.1"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));
    }

    @Test
    void logoutInvalidatesSession() throws Exception {
        createUser("bob");
        Cookie session = mvc.perform(login("bob", PASSWORD, "10.0.0.1"))
                .andReturn().getResponse().getCookie("SESSION");

        mvc.perform(post("/api/auth/logout").with(xsrf()).cookie(session)).andExpect(status().isOk());

        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void tenFailuresForOneUsernameLockItAcrossIps() throws Exception {
        createUser("bob");
        createUser("alice");
        for (int i = 0; i < 10; i++) {
            mvc.perform(login("bob", "wrong-pass", "10.0.0." + i)).andExpect(status().isUnauthorized());
        }

        mvc.perform(login("bob", PASSWORD, "10.0.1.1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
        mvc.perform(login("alice", PASSWORD, "10.0.1.1")).andExpect(status().isOk());
    }

    @Test
    void tenFailuresFromOneIpLockEveryUsernameFromThatIp() throws Exception {
        createUser("alice");
        for (int i = 0; i < 10; i++) {
            mvc.perform(login("ghost" + i, "wrong-pass", "10.0.0.9")).andExpect(status().isUnauthorized());
        }

        mvc.perform(login("alice", PASSWORD, "10.0.0.9")).andExpect(status().isTooManyRequests());
        mvc.perform(login("alice", PASSWORD, "10.0.0.10")).andExpect(status().isOk());
    }

    @Test
    void successfulLoginResetsTheUsernameCount() throws Exception {
        createUser("bob");
        for (int i = 0; i < 9; i++) {
            mvc.perform(login("bob", "wrong-pass", "10.0.0." + i)).andExpect(status().isUnauthorized());
        }
        mvc.perform(login("bob", PASSWORD, "10.0.1.1")).andExpect(status().isOk());

        for (int i = 0; i < 9; i++) {
            mvc.perform(login("bob", "wrong-pass", "10.0.2." + i)).andExpect(status().isUnauthorized());
        }
        mvc.perform(login("bob", PASSWORD, "10.0.1.2")).andExpect(status().isOk());
    }

    @Test
    void updateMeChangesTimezone() throws Exception {
        var bob = createUser("bob");

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"timezone": "America/New_York"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("America/New_York"));
    }

    @Test
    void updateMeChangesPasswordOnlyWithTheCurrentOne() throws Exception {
        var bob = createUser("bob");

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "wrong-pass", "newPassword": "brand-new-pass"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));

        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "%s", "newPassword": "brand-new-pass"}
                                """.formatted(PASSWORD)))
                .andExpect(status().isOk());

        mvc.perform(login("bob", "brand-new-pass", "10.0.0.1")).andExpect(status().isOk());
    }

    private static String signupJson(String username, String password, String timezone) {
        return """
                {"username": "%s", "password": "%s", "timezone": "%s"}
                """.formatted(username, password, timezone);
    }

    private static MockHttpServletRequestBuilder signup(String username, String password, String timezone) {
        return post("/api/auth/signup").with(xsrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(signupJson(username, password, timezone));
    }

    private static MockHttpServletRequestBuilder login(String username, String password, String ip) {
        return post("/api/auth/login").with(xsrf())
                .with(request -> {
                    request.setRemoteAddr(ip);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"username": "%s", "password": "%s"}
                        """.formatted(username, password));
    }

    @Test
    void updateMeSavesMaxYellowsWithinOneToSeven() throws Exception {
        var bob = createUser("bob");

        mvc.perform(get("/api/auth/me").with(as(bob)))
                .andExpect(jsonPath("$.maxYellows").value(2));
        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"maxYellows\": 3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxYellows").value(3));
        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"maxYellows\": 8}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }
}
