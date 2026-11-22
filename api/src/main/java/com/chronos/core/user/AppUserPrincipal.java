package com.chronos.core.user;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/** The signed-in user. Stored in the HTTP session without the password hash. */
public record AppUserPrincipal(long id, String username, String passwordHash) implements UserDetails {

    public static AppUserPrincipal from(User user) {
        return new AppUserPrincipal(user.id(), user.username(), user.passwordHash());
    }

    public AppUserPrincipal withoutPassword() {
        return new AppUserPrincipal(id, username, null);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }
}
