package com.chronos.core.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION(HttpStatus.BAD_REQUEST),
    BAD_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    USERNAME_TAKEN(HttpStatus.CONFLICT),
    INVALID_STATE(HttpStatus.CONFLICT),
    CONFLICT(HttpStatus.CONFLICT),
    CHECK_IN_NOT_ALLOWED(HttpStatus.UNPROCESSABLE_CONTENT),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
