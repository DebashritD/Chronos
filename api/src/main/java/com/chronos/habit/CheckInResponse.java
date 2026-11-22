package com.chronos.habit;

import com.chronos.habit.domain.Color;

import java.time.LocalDate;

public record CheckInResponse(LocalDate periodStart, Color color, String note) {

    public static CheckInResponse from(CheckIn c) {
        return new CheckInResponse(c.periodStart(), c.color(), c.note());
    }
}
