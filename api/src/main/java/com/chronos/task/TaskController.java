package com.chronos.task;

import com.chronos.core.user.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService tasks;

    public TaskController(TaskService tasks) {
        this.tasks = tasks;
    }

    @GetMapping
    public List<TaskResponse> list(@AuthenticationPrincipal AppUserPrincipal principal) {
        return tasks.list(principal.id()).stream().map(TaskResponse::from).toList();
    }

    @PutMapping("/{id}")
    public TaskResponse save(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable UUID id,
                             @Valid @RequestBody TaskRequest body) {
        return TaskResponse.from(tasks.save(principal.id(), id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable UUID id) {
        tasks.delete(principal.id(), id);
    }
}
