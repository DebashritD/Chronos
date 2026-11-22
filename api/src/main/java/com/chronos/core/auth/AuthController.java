package com.chronos.core.auth;

import com.chronos.core.user.AppUserPrincipal;
import com.chronos.core.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SessionLogin sessionLogin;
    private final LoginThrottle loginThrottle;
    private final AccountService accounts;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager, SessionLogin sessionLogin,
                          LoginThrottle loginThrottle, AccountService accounts, UserService userService) {
        this.authenticationManager = authenticationManager;
        this.sessionLogin = sessionLogin;
        this.loginThrottle = loginThrottle;
        this.accounts = accounts;
        this.userService = userService;
    }

    /** Touching the token makes Spring Security write the XSRF-TOKEN cookie for the SPA. */
    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public MeResponse signup(@Valid @RequestBody SignupRequest body, HttpServletRequest request,
                             HttpServletResponse response) {
        AppUserPrincipal principal = accounts.signup(body);
        sessionLogin.establish(principal, request, response);
        return MeResponse.from(userService.get(principal.id()));
    }

    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request,
                            HttpServletResponse response) {
        String userKey = "user:" + body.username().trim().toLowerCase(Locale.ROOT);
        String ipKey = "ip:" + request.getRemoteAddr();
        loginThrottle.check(userKey, ipKey);
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(body.username(), body.password()));
        } catch (AuthenticationException ex) {
            loginThrottle.recordFailure(userKey, ipKey);
            throw ex;
        }
        loginThrottle.reset(userKey);
        AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
        sessionLogin.establish(principal, request, response);
        return MeResponse.from(userService.get(principal.id()));
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AppUserPrincipal principal) {
        return MeResponse.from(userService.get(principal.id()));
    }

    @PutMapping("/me")
    public MeResponse updateMe(@AuthenticationPrincipal AppUserPrincipal principal,
                               @Valid @RequestBody UpdateMeRequest body) {
        return MeResponse.from(accounts.updateMe(principal.id(), body));
    }
}
