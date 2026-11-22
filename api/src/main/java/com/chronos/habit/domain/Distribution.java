package com.chronos.habit.domain;

public record Distribution(int green, int yellow, int red, int grey, int total) {

    public static final Distribution EMPTY = new Distribution(0, 0, 0, 0, 0);

    public Distribution plus(CellState state) {
        return switch (state) {
            case GREEN -> new Distribution(green + 1, yellow, red, grey, total + 1);
            case YELLOW -> new Distribution(green, yellow + 1, red, grey, total + 1);
            case RED -> new Distribution(green, yellow, red + 1, grey, total + 1);
            case GREY -> new Distribution(green, yellow, red, grey + 1, total + 1);
            case PAUSED, PENDING, NOT_DUE -> this;
        };
    }

    public Distribution plus(Distribution other) {
        return new Distribution(green + other.green, yellow + other.yellow, red + other.red,
                grey + other.grey, total + other.total);
    }
}
