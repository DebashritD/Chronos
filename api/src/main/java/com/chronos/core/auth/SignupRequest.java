package com.chronos.core.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Pattern(regexp = "[a-zA-Z0-9_.-]{3,32}", message = "3-32 letters, digits, '_', '.' or '-'")
        String username,
        @NotBlank @Size(min = 8, max = 128) @MaxUtf8Bytes(72) String password,
        @NotBlank String timezone) {
}
