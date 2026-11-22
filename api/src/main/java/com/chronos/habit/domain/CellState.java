package com.chronos.habit.domain;

public enum CellState {
    GREEN, YELLOW, RED,
    /** Period starts inside a pause. */
    PAUSED,
    /** Period has not ended yet and is unmarked. */
    PENDING,
    /** Period ended unmarked: unknown, never treated as RED automatically. */
    GREY,
    /** Not a period start (or before the habit started). */
    NOT_DUE;

    public static CellState of(Color color) {
        return switch (color) {
            case RED -> RED;
            case YELLOW -> YELLOW;
            case GREEN -> GREEN;
        };
    }
}
