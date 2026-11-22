package com.chronos.core.auth;

import com.chronos.core.user.User;

public record MeResponse(String username, String timezone) {

    public static MeResponse from(User user) {
        return new MeResponse(user.username(), user.timezone());
    }
}
