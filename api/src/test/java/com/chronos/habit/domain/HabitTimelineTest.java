package com.chronos.habit.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HabitTimelineTest {

    private static final LocalDate TODAY = nov(18); // Wednesday

    private static LocalDate nov(int day) {
        return LocalDate.of(2026, 11, day);
    }

    private static HabitTimeline daily(LocalDate start, Map<LocalDate, Color> colors, List<DateRange> pauses) {
        return new HabitTimeline(new HabitSchedule(Frequency.DAILY, null, start), pauses, colors, false, TODAY);
    }

    @Test
    void stateOfUsesColorThenPauseThenPendingThenGrey() {
        var timeline = daily(nov(1), Map.of(nov(10), Color.GREEN, nov(12), Color.RED),
                List.of(new DateRange(nov(12), nov(14))));

        assertThat(timeline.stateOf(nov(10))).isEqualTo(CellState.GREEN);
        assertThat(timeline.stateOf(nov(11))).isEqualTo(CellState.GREY);
        assertThat(timeline.stateOf(nov(12))).isEqualTo(CellState.RED);
        assertThat(timeline.stateOf(nov(13))).isEqualTo(CellState.PAUSED);
        assertThat(timeline.stateOf(TODAY)).isEqualTo(CellState.PENDING);
        assertThat(timeline.stateOf(nov(19))).isEqualTo(CellState.PENDING);
    }

    @Test
    void openPauseCoversEverythingFromItsStart() {
        var timeline = daily(nov(1), Map.of(), List.of(new DateRange(nov(15), null)));

        assertThat(timeline.stateOf(nov(14))).isEqualTo(CellState.GREY);
        assertThat(timeline.stateOf(TODAY)).isEqualTo(CellState.PAUSED);
    }

    @Test
    void editWindowCoversTheLastSevenDaysUpToToday() {
        var timeline = daily(nov(1), Map.of(), List.of(new DateRange(nov(15), nov(15))));

        assertThat(timeline.isEditable(TODAY)).isTrue();
        assertThat(timeline.isEditable(nov(11))).isTrue();
        assertThat(timeline.isEditable(nov(10))).isFalse();
        assertThat(timeline.isEditable(nov(19))).isFalse();
        assertThat(timeline.isEditable(nov(15))).isFalse();
        assertThat(timeline.isEditable(LocalDate.of(2026, 10, 31))).isFalse();
    }

    @Test
    void archivedHabitsAreNeverEditable() {
        var timeline = new HabitTimeline(new HabitSchedule(Frequency.DAILY, null, nov(1)),
                List.of(), Map.of(), true, TODAY);

        assertThat(timeline.isEditable(TODAY)).isFalse();
    }

    @Test
    void editWindowUsesThePeriodEndForLongerPeriods() {
        var weekly = new HabitTimeline(new HabitSchedule(Frequency.WEEKLY, null, nov(1)),
                List.of(), Map.of(), false, TODAY);
        assertThat(weekly.isEditable(nov(9))).isTrue();   // ends Nov 15 >= Nov 11
        assertThat(weekly.isEditable(nov(2))).isFalse();  // ends Nov 8
        assertThat(weekly.isEditable(nov(10))).isFalse(); // not a Monday

        var everyThree = new HabitTimeline(new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2)),
                List.of(), Map.of(), false, TODAY);
        assertThat(everyThree.isEditable(nov(17))).isTrue();
        assertThat(everyThree.isEditable(nov(18))).isFalse(); // not a period start
    }

    @Test
    void streakCountsGreenAndYellowAndResetsOnRedOrGrey() {
        var timeline = daily(nov(10), Map.of(
                nov(10), Color.GREEN, nov(11), Color.YELLOW, nov(12), Color.RED,
                nov(13), Color.GREEN, nov(14), Color.GREEN, nov(15), Color.YELLOW,
                nov(17), Color.GREEN), List.of());

        assertThat(timeline.streak(null)).isEqualTo(new Streak(1, 3, 0));
    }

    @Test
    void streakSkipsPausedPeriodsAndCountsAMarkedCurrentPeriod() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.GREEN, nov(17), Color.GREEN, TODAY, Color.YELLOW),
                List.of(new DateRange(nov(15), nov(16))));

        assertThat(timeline.streak(null)).isEqualTo(new Streak(3, 3, 1));
    }

    @Test
    void yellowCapAllowsNYellowsInARowAndGreenClearsTheRun() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.GREEN, nov(15), Color.YELLOW, nov(16), Color.YELLOW,
                nov(17), Color.GREEN, TODAY, Color.YELLOW), List.of());

        assertThat(timeline.streak(2)).isEqualTo(new Streak(5, 5, 1));
    }

    @Test
    void yellowBeyondTheCapStartsANewStreakAtOne() {
        var colors = Map.of(nov(14), Color.GREEN, nov(15), Color.YELLOW, nov(16), Color.YELLOW, nov(17), Color.YELLOW);

        assertThat(daily(nov(14), colors, List.of()).streak(2)).isEqualTo(new Streak(1, 3, 1));
        assertThat(daily(nov(14), colors, List.of()).streak(null)).isEqualTo(new Streak(4, 4, 3));
    }

    @Test
    void redClearsTheYellowRun() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.YELLOW, nov(15), Color.YELLOW, nov(16), Color.RED,
                nov(17), Color.YELLOW, TODAY, Color.YELLOW), List.of());

        assertThat(timeline.streak(2)).isEqualTo(new Streak(2, 2, 2));
    }

    @Test
    void pausedPeriodsNeitherExtendNorClearTheYellowRun() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.YELLOW, nov(16), Color.YELLOW, nov(17), Color.YELLOW),
                List.of(new DateRange(nov(15), nov(15))));

        assertThat(timeline.streak(2)).isEqualTo(new Streak(1, 2, 1));
    }

    @Test
    void distributionCountsEndedAndMarkedPeriodsOnly() {
        var timeline = daily(nov(12), Map.of(nov(12), Color.GREEN, nov(13), Color.YELLOW, nov(14), Color.RED),
                List.of(new DateRange(nov(17), nov(17))));

        assertThat(timeline.distribution(nov(10), nov(22))).isEqualTo(new Distribution(1, 1, 1, 2, 5));
    }

    @Test
    void scoreUsesThePeriodCoveringTheDate() {
        var weekly = new HabitTimeline(new HabitSchedule(Frequency.WEEKLY, null, nov(1)),
                List.of(), Map.of(nov(9), Color.YELLOW), false, TODAY);

        assertThat(weekly.scoreOn(nov(12))).hasValue(1);
        assertThat(weekly.scoreOn(nov(4))).hasValue(0);   // week of Nov 2 is GREY
        assertThat(weekly.scoreOn(nov(17))).isEmpty();    // current week is PENDING
        assertThat(weekly.scoreOn(LocalDate.of(2026, 10, 20))).isEmpty();
    }

    @Test
    void averageScoreAveragesHabitsThatCountThatDay() {
        var green = daily(nov(1), Map.of(nov(10), Color.GREEN), List.of());
        var red = daily(nov(1), Map.of(nov(10), Color.RED), List.of());
        var notStarted = daily(nov(15), Map.of(), List.of());

        assertThat(HabitTimeline.averageScore(List.of(green, red, notStarted), nov(10))).isEqualTo(1.0);
        assertThat(HabitTimeline.averageScore(List.of(notStarted), nov(10))).isNull();
    }

    @Test
    void dueOnIsTheDateItselfWhenItStartsAPeriod() {
        var everyThree = new HabitTimeline(new HabitSchedule(Frequency.EVERY_N_DAYS, 3, nov(2)),
                List.of(), Map.of(), false, TODAY);

        assertThat(everyThree.dueOn(nov(5))).contains(nov(5));
        assertThat(everyThree.dueOn(nov(6))).isEmpty();
    }
}
