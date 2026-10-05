package com.inventory.warehouse_manager.exception;

/**
 * Thrown when a request would create a duplicate of something that must be
 * unique (a warehouse name, or a SKU within one warehouse). Mapped to 409 Conflict.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
