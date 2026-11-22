package com.chronos.core.auth;

import com.chronos.core.error.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginThrottleTest {

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-18T00:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginThrottle throttle = new LoginThrottle(clock);

    @Test
    void blocksAKeyAfterTenFailures() {
        for (int i = 0; i < 9; i++) {
            throttle.recordFailure("user:bob");
        }
        assertThatCode(() -> throttle.check("user:bob")).doesNotThrowAnyException();

        throttle.recordFailure("user:bob");

        assertThatThrownBy(() -> throttle.check("user:bob", "ip:1.2.3.4")).isInstanceOf(ApiException.class);
        assertThatCode(() -> throttle.check("user:alice", "ip:1.2.3.4")).doesNotThrowAnyException();
    }

    @Test
    void failuresExpireAfterTheWindow() {
        for (int i = 0; i < 10; i++) {
            throttle.recordFailure("ip:1.2.3.4");
        }
        clock.now = clock.now.plus(Duration.ofMinutes(15)).plusSeconds(1);

        assertThatCode(() -> throttle.check("ip:1.2.3.4")).doesNotThrowAnyException();
    }

    @Test
    void staleKeysAreEvictedOnTheNextRecordedFailure() {
        throttle.recordFailure("ip:1.1.1.1", "ip:2.2.2.2");
        clock.now = clock.now.plus(Duration.ofMinutes(15)).plusSeconds(1);

        throttle.recordFailure("ip:3.3.3.3");

        assertThat(throttle.trackedKeys()).isEqualTo(1);
    }

    @Test
    void resetClearsOnlyThatKey() {
        for (int i = 0; i < 10; i++) {
            throttle.recordFailure("user:bob", "ip:1.2.3.4");
        }
        throttle.reset("user:bob");

        assertThatCode(() -> throttle.check("user:bob")).doesNotThrowAnyException();
        assertThatThrownBy(() -> throttle.check("ip:1.2.3.4")).isInstanceOf(ApiException.class);
    }
}
