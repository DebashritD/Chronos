package com.chronos.habit;

import com.chronos.core.user.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/habits/{id}/check-ins/{periodStart}")
public class CheckInController {

    private final CheckInService checkIns;

    public CheckInController(CheckInService checkIns) {
        this.checkIns = checkIns;
    }

    @PutMapping
    public CheckInResponse mark(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id,
                                @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
                                @Valid @RequestBody CheckInRequest body) {
        return CheckInResponse.from(checkIns.mark(principal.id(), id, periodStart, body));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable long id,
                      @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart) {
        checkIns.clear(principal.id(), id, periodStart);
    }
}
