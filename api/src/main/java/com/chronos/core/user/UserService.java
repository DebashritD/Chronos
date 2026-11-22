package com.chronos.core.user;

import com.chronos.core.error.ApiException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
public class UserService {

    private final UserRepository users;
    private final Clock clock;

    public UserService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    public User get(long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    /** The current date in the user's own timezone. */
    public LocalDate today(long userId) {
        return LocalDate.now(clock.withZone(ZoneId.of(get(userId).timezone())));
    }
}
