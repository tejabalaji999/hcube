package com.smartmigrate.auth;

import com.smartmigrate.config.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final JwtUtil jwtUtil;

    @Value("${app.auth.username}")
    private String staticUsername;

    @Value("${app.auth.password}")
    private String staticPassword;

    public AuthService(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    public String login(String username, String password) {
        if (!staticUsername.equals(username) || !staticPassword.equals(password)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return jwtUtil.generateToken(username);
    }
}
