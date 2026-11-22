package com.chronos.core.auth;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/** Sliding-window failed-login counter per key ("user:&lt;name&gt;" and "ip:&lt;addr&gt;"). */
@Component
public class LoginThrottle {

    static final int MAX_FAILURES = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> failures = new HashMap<>();
    private final Clock clock;

    public LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    public synchronized void check(String... keys) {
        for (String key : keys) {
            if (pruned(key).size() >= MAX_FAILURES) {
                throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Too many failed logins; try again later");
            }
        }
    }

    public synchronized void recordFailure(String... keys) {
        Instant now = clock.instant();
        for (String key : keys) {
            pruned(key);
            failures.computeIfAbsent(key, k -> new ArrayDeque<>()).addLast(now);
        }
    }

    public synchronized void reset(String key) {
        failures.remove(key);
    }

    public synchronized void clear() {
        failures.clear();
    }

    private Deque<Instant> pruned(String key) {
        Deque<Instant> deque = failures.get(key);
        if (deque == null) {
            return new ArrayDeque<>();
        }
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!deque.isEmpty() && !deque.peekFirst().isAfter(cutoff)) {
            deque.removeFirst();
        }
        if (deque.isEmpty()) {
            failures.remove(key);
        }
        return deque;
    }
}
