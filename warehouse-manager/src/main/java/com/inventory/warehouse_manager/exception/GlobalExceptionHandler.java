package com.inventory.warehouse_manager.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralized handler for API errors.
 * Converts exceptions into simple JSON: { "error": "message here" }
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleNotFound(ResourceNotFoundException ex) {
        return Map.of("error", ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleBadRequest(IllegalArgumentException ex) {
        return Map.of("error", ex.getMessage());
    }

    // e.g. "Cannot delete warehouse that has items assigned."
    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleIllegalState(IllegalStateException ex) {
        return Map.of("error", ex.getMessage());
    }

    // BUG-1 fix: @Valid failures (e.g. @NotBlank name, @Min(0) capacity) used to fall
    // through to the generic handler and return 500. Return 400 and list each bad
    // field, e.g. "maxCapacity: must be greater than or equal to 0".
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return Map.of("error", message.isEmpty() ? "Invalid request." : message);
    }

    // BUG-3 fix: a body that isn't valid JSON (or has the wrong types) is the
    // client's mistake, so return 400 instead of 500.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return Map.of("error", "Request body is missing or is not valid JSON.");
    }

    // BUG-2 / BUG-4 fix: duplicates are detected in the services and reported as 409.
    @ExceptionHandler(ConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleConflict(ConflictException ex) {
        return Map.of("error", ex.getMessage());
    }

    // BUG-2 safety net: if two requests race past the service check, the database's
    // unique constraint still rejects the duplicate. Report that as 409, not 500.
    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleDataIntegrity(DataIntegrityViolationException ex) {
        return Map.of("error", "This change conflicts with existing data (for example, a duplicate name).");
    }

    // Catch-all fallback so we don't leak stack traces / ugly messages
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Map<String, String> handleGeneric(Exception ex) {
        // In a real app you would log ex here
        return Map.of("error", "Unexpected server error. Please try again.");
    }
}
