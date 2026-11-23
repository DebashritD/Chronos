package com.chronos.core.auth;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** Every field is optional; a new password requires the current one. */
public record UpdateMeRequest(String timezone, String currentPassword, @Size(min = 8, max = 128) @MaxUtf8Bytes(72) String newPassword,
                             @Min(1) @Max(7) Integer maxYellows) {
}
