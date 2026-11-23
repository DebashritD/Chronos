package com.chronos.core.auth;

import com.chronos.core.error.ApiException;
import com.chronos.core.error.ErrorCode;
import com.chronos.core.user.AppUserPrincipal;
import com.chronos.core.user.User;
import com.chronos.core.user.UserRepository;
import com.chronos.core.user.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Locale;

@Service
public class AccountService {

    private final UserRepository users;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public AccountService(UserRepository users, UserService userService, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AppUserPrincipal signup(SignupRequest request) {
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String timezone = validZone(request.timezone());
        if (users.findByUsername(username).isPresent()) {
            throw new ApiException(ErrorCode.USERNAME_TAKEN, "Username is already taken");
        }
        long id = users.insert(username, passwordEncoder.encode(request.password()), timezone);
        return new AppUserPrincipal(id, username, null);
    }

    @Transactional
    public User updateMe(long userId, UpdateMeRequest request) {
        User user = userService.get(userId);
        if (request.timezone() != null) {
            users.updateTimezone(userId, validZone(request.timezone()));
        }
        if (request.maxYellows() != null) {
            users.updateMaxYellows(userId, request.maxYellows());
        }
        if (request.newPassword() != null) {
            if (request.currentPassword() == null
                    || !passwordEncoder.matches(request.currentPassword(), user.passwordHash())) {
                throw new ApiException(ErrorCode.VALIDATION, "currentPassword: is incorrect");
            }
            users.updatePasswordHash(userId, passwordEncoder.encode(request.newPassword()));
        }
        return userService.get(userId);
    }

    private static String validZone(String timezone) {
        try {
            return ZoneId.of(timezone).getId();
        } catch (DateTimeException ex) {
            throw new ApiException(ErrorCode.VALIDATION, "timezone: unknown timezone");
        }
    }
}
