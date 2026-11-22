package com.chronos.stats;

import com.chronos.core.user.AppUserPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService stats;

    public StatsController(StatsService stats) {
        this.stats = stats;
    }

    @GetMapping("/week")
    public WeekResponse week(@AuthenticationPrincipal AppUserPrincipal principal,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                             LocalDate start) {
        return stats.week(principal.id(), start);
    }

    @GetMapping("/month")
    public MonthResponse month(@AuthenticationPrincipal AppUserPrincipal principal,
                               @RequestParam(required = false) String month) {
        return stats.month(principal.id(), month);
    }

    @GetMapping("/streaks")
    public List<StreakResponse> streaks(@AuthenticationPrincipal AppUserPrincipal principal) {
        return stats.streaks(principal.id());
    }
}
