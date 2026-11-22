package com.chronos.habit.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HabitScheduleTest {

    private static LocalDate nov(int day) {
        return LocalDate.of(2026, 11, day);
    }

    @Test
    void dailyPeriodsAreSingleDaysFromTheStartDate() {
        var schedule = new HabitSchedule(Frequency.DAILY, null, nov(10));

        assertThat(schedule.firstPeriodStart()).isEqualTo(nov(10));
        assertThat(schedule.periodContaining(nov(9))).isEmpty();
        assertThat(schedule.periodContaining(nov(14))).contains(nov(14));
        assertThat(schedule.isPeriodStart(nov(14))).isTrue();
        assertThat(schedule.periodEnd(nov(14))).isEqualTo(nov(14));
    }

    @Test
    void everyNDaysPeriodsRepeatFromTheStartDate() {
        var schedule = new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2));

        assertThat(schedule.periodContaining(nov(6))).contains(nov(5));
        assertThat(schedule.isPeriodStart(nov(5))).isTrue();
        assertThat(schedule.isPeriodStart(nov(6))).isFalse();
        assertThat(schedule.periodEnd(nov(5))).isEqualTo(nov(7));
    }

    @Test
    void weeklyPeriodsRunMondayToSundayStartingWithTheWeekOfTheStartDate() {
        var schedule = new HabitSchedule(Frequency.WEEKLY, null, nov(18)); // Wednesday

        assertThat(schedule.firstPeriodStart()).isEqualTo(nov(16));
        assertThat(schedule.periodContaining(nov(22))).contains(nov(16));
        assertThat(schedule.periodContaining(nov(15))).isEmpty();
        assertThat(schedule.isPeriodStart(nov(16))).isTrue();
        assertThat(schedule.isPeriodStart(nov(18))).isFalse();
        assertThat(schedule.periodEnd(nov(16))).isEqualTo(nov(22));
    }

    @Test
    void periodStartsBetweenIsInclusiveAndSkipsPartialPeriods() {
        var everyThree = new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2));
        assertThat(everyThree.periodStartsBetween(nov(4), nov(11))).containsExactly(nov(5), nov(8), nov(11));

        var daily = new HabitSchedule(Frequency.DAILY, null, nov(2));
        assertThat(daily.periodStartsBetween(LocalDate.of(2026, 10, 1), nov(3))).containsExactly(nov(2), nov(3));
        assertThat(daily.periodStartsBetween(nov(5), nov(4))).isEmpty();
    }

    @Test
    void everyNDaysRequiresAnIntervalOfAtLeastTwo() {
        assertThatThrownBy(() -> new HabitSchedule(Frequency.EVERY_N_DAYS, null, nov(2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new HabitSchedule(Frequency.EVERY_N_DAYS, 1, nov(2)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
