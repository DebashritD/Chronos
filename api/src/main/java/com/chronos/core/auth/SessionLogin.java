package com.chronos.core.auth;

import com.chronos.core.user.AppUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

@Component
public class SessionLogin {

    private final SecurityContextRepository securityContextRepository;

    public SessionLogin(SecurityContextRepository securityContextRepository) {
        this.securityContextRepository = securityContextRepository;
    }

    public void establish(AppUserPrincipal principal, HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal stored = principal.withoutPassword();
        var authentication = UsernamePasswordAuthenticationToken.authenticated(stored, null, stored.getAuthorities());

        request.getSession(true);
        request.changeSessionId();

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        securityContextRepository.saveContext(context, request, response);
    }
}
