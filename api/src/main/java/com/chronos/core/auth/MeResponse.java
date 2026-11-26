package com.chronos.core.auth;

import com.chronos.core.user.User;

public record MeResponse(String username, String timezone, int maxYellows, boolean onboarded) {

    public static MeResponse from(User user) {
        return new MeResponse(user.username(), user.timezone(), user.maxYellows(), user.onboardedAt() != null);
    }
}
