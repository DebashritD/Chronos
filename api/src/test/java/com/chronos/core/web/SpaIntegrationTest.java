package com.chronos.core.web;

import com.chronos.support.IntegrationTest;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SpaIntegrationTest extends IntegrationTest {

    @Test
    void clientRoutesServeIndexWithoutCaching() throws Exception {
        for (String path : new String[] {"/month", "/habits", "/login?next=/month"}) {
            mvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(content().string(containsString("Chronos test")))
                    .andExpect(header().string("Cache-Control", "no-cache"));
        }
    }

    @Test
    void rootIsForwardedToIndex() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk()).andExpect(forwardedUrl("index.html"));
    }

    @Test
    void fingerprintedAssetsAreCachedForever() throws Exception {
        mvc.perform(get("/assets/app-abc123.js"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("immutable")));
    }

    @Test
    void missingFilesAndUnknownApiPathsAreNotFoundRatherThanIndex() throws Exception {
        mvc.perform(get("/assets/missing.js")).andExpect(status().isNotFound());
        mvc.perform(get("/robots.txt")).andExpect(status().isNotFound());
        mvc.perform(get("/api/public/nope")).andExpect(status().isNotFound());
    }

    @Test
    void healthIsPublicAndUncached() throws Exception {
        mvc.perform(get("/api/public/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
