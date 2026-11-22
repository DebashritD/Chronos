package com.chronos.habit;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.habit.domain.HabitStatus;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService habits;

    public HabitController(HabitService habits) {
        this.habits = habits;
    }

    @GetMapping
    public List<HabitResponse> list(@AuthenticationPrincipal AppUserPrincipal principal,
                                    @RequestParam(required = false) HabitStatus status) {
        return habits.list(principal.id(), status).stream().map(HabitResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HabitResponse create(@AuthenticationPrincipal AppUserPrincipal principal,
                                @Valid @RequestBody CreateHabitRequest body) {
        return HabitResponse.from(habits.create(principal.id(), body));
    }

    @PutMapping("/{id}")
    public HabitResponse update(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id,
                                @Valid @RequestBody UpdateHabitRequest body) {
        return HabitResponse.from(habits.update(principal.id(), id, body));
    }

    @PostMapping("/{id}/pause")
    public HabitResponse pause(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.pause(principal.id(), id));
    }

    @PostMapping("/{id}/resume")
    public HabitResponse resume(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.resume(principal.id(), id));
    }

    @PostMapping("/{id}/archive")
    public HabitResponse archive(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.archive(principal.id(), id));
    }

    @PostMapping("/{id}/unarchive")
    public HabitResponse unarchive(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id) {
        return HabitResponse.from(habits.unarchive(principal.id(), id));
    }
}
