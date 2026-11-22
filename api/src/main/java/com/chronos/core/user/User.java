package com.chronos.core.user;

import java.time.OffsetDateTime;

public record User(long id, String username, String passwordHash, String timezone, OffsetDateTime createdAt) {
}
