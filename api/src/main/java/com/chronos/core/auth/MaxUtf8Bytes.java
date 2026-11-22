package com.chronos.core.auth;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.RECORD_COMPONENT;
import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/** BCrypt only accepts up to 72 bytes, so longer UTF-8 passwords must be rejected up front. */
@Documented
@Constraint(validatedBy = MaxUtf8Bytes.Validator.class)
@Target({FIELD, PARAMETER, RECORD_COMPONENT})
@Retention(RUNTIME)
public @interface MaxUtf8Bytes {
    int value();

    String message() default "must be at most {value} bytes when UTF-8 encoded";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<MaxUtf8Bytes, String> {
        private int max;

        @Override
        public void initialize(MaxUtf8Bytes annotation) {
            max = annotation.value();
        }

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            return value == null || value.getBytes(StandardCharsets.UTF_8).length <= max;
        }
    }
}
